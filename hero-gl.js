/* 첫 화면: 사방에서 몰려온 요청(점) 수천 개가 모여 이름을 만들고, 스크롤하면 흩어짐.
   Three.js(MIT) 의 Points + 셰이더. 점 위치는 실제 h1 글자를 캔버스에 그려 픽셀을 뽑아 정함(h1 은 그대로 남겨 스크린리더·검색용).
   WebGL 이 없거나 모션 줄이기 환경이면 아무것도 하지 않고 원래 글자가 보임. */
import * as THREE from './vendor/three.module.min.js';

const hero = document.querySelector('.hero');
const h1 = document.querySelector('#name');
const canvas = document.querySelector('#hero-gl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer = null;
if (!reduce && hero && canvas) {
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
}

if (!renderer) document.documentElement.classList.remove('gl-hero'); // 원래 글자를 다시 보이게
else {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10); // 화면 픽셀 좌표 (y 아래로)
  const css = (n) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#ffffff');
  const uniforms = {
    uTime: { value: 0 }, uScatter: { value: 0 }, uSize: { value: 3 }, uDpr: { value: 1 },
    uMouse: { value: new THREE.Vector2(-9999, -9999) }, uInk: { value: css('--ink') }, uSun: { value: css('--sun') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uScatter, uSize, uDpr; uniform vec2 uMouse;
      attribute vec3 aStart; attribute vec4 aMeta; // x 출발 시각, y 난수, z 강조색, w 떠도는 점
      varying float vAccent, vAlpha;
      void main() {
        float t = clamp((uTime - aMeta.x) / 1.7, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - t, 4.0);                      // 몰려와서 제자리에 안착
        vec3 p = mix(aStart, position, e);
        float r = aMeta.y, wob = 0.9 + aMeta.w * 26.0;          // 제자리에서 살짝 떨림, 떠도는 점은 크게
        p.x += sin(uTime * (0.5 + r) + r * 40.0) * wob;
        p.y += cos(uTime * (0.4 + r) + r * 23.0) * wob;
        vec2 d = p.xy - uMouse;                                 // 마우스 근처에서는 밀려남
        p.xy += normalize(d + 1e-4) * smoothstep(130.0, 0.0, length(d)) * 42.0 * e;
        p += (aStart - position) * uScatter * (0.5 + r);        // 스크롤하면 왔던 쪽으로 흩어짐
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * uDpr * (0.75 + r * 0.6);
        vAccent = aMeta.z;
        vAlpha = (0.25 + 0.75 * e) * (1.0 - uScatter) * (1.0 - aMeta.w * 0.55);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk, uSun; varying float vAccent, vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(mix(uInk, uSun, vAccent), smoothstep(0.5, 0.15, d) * vAlpha);
      }`,
  });
  let points = null, W = 0, H = 0, started = 0, running = true;

  // h1 글자를 같은 글꼴로 캔버스에 그려 픽셀 좌표를 뽑음
  function build() {
    W = hero.clientWidth; H = hero.clientHeight;
    const lite = document.documentElement.classList.contains('lite'); // 가벼운 모드: 해상도 1배, 점은 듬성하게
    const dpr = lite ? 1 : Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    Object.assign(camera, { right: W, bottom: H }); camera.updateProjectionMatrix();
    uniforms.uDpr.value = dpr;

    const r = h1.getBoundingClientRect(), hr = hero.getBoundingClientRect(), cs = getComputedStyle(h1);
    const fs = parseFloat(cs.fontSize), step = Math.max(2, Math.round(fs / 75)) + (lite ? 1 : 0);
    const off = document.createElement('canvas');
    off.width = Math.ceil(r.width + fs * 0.2); off.height = Math.ceil(r.height);
    const c = off.getContext('2d', { willReadFrequently: true });
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in c) c.letterSpacing = cs.letterSpacing;
    c.textBaseline = 'middle'; c.fillStyle = '#000';
    const lines = h1.innerText.split('\n'), lh = r.height / lines.length; // <br> 로 나뉜 줄마다 한 줄씩
    lines.forEach((t, i) => c.fillText(t, 0, lh * (i + 0.5)));
    const px = c.getImageData(0, 0, off.width, off.height).data;
    const ox = r.left - hr.left, oy = r.top - hr.top, cx = W * 0.5, cy = H * 0.5, R = Math.hypot(W, H) * 0.75;
    const pos = [], start = [], meta = [];
    const add = (x, y, free) => {
      const a = Math.random() * Math.PI * 2, far = R * (0.8 + Math.random() * 0.5); // 화면 밖 사방에서 출발
      pos.push(x, y, 0);
      start.push(cx + Math.cos(a) * far, cy + Math.sin(a) * far, 0);
      meta.push((free ? 0 : 0.15) + Math.random() * 1.1 + (x - ox) / (r.width || 1) * 0.5, Math.random(), Math.random() < 0.06 ? 1 : 0, free ? 1 : 0);
    };
    for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) if (px[(y * off.width + x) * 4 + 3] > 128) add(ox + x, oy + y, false);
    for (let i = 0; i < (lite ? 200 : 500); i++) add(Math.random() * W, Math.random() * H, true); // 주변을 떠도는 요청
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 4));
    if (points) { points.geometry.dispose(); scene.remove(points); }
    points = new THREE.Points(g, material);
    scene.add(points);
    uniforms.uSize.value = step * (fs < 120 ? 1.2 : 0.95); // 작은 글씨는 점을 키워야 글자가 채워져 보임
  }

  function frame(now) {
    if (!running) return;
    uniforms.uTime.value = (now - started) / 1000;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  hero.addEventListener('pointermove', (e) => { const hr = hero.getBoundingClientRect(); uniforms.uMouse.value.set(e.clientX - hr.left, e.clientY - hr.top); });
  hero.addEventListener('pointerleave', () => uniforms.uMouse.value.set(-9999, -9999));
  addEventListener('themechange', () => { uniforms.uInk.value = css('--ink'); uniforms.uSun.value = css('--sun'); });
  let t;
  addEventListener('litechange', () => points && build());
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 200); }); // ponytail: 크기가 바뀌면 다시 뽑음(이미 지난 출발 시각이라 바로 제자리)
  new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) requestAnimationFrame(frame); }).observe(hero);

  // 글꼴이 준비된 뒤에 뽑아야 글자 모양이 맞음
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
    build();
    started = performance.now();
    requestAnimationFrame(frame);
    if (window.ScrollTrigger) ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => (uniforms.uScatter.value = s.progress) });
  });
}
