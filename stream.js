/* 첫 화면의 이름을 점으로 그리고, 그 주위에 점 몇 개를 띄워 둡니다.
   ① 화면 밖 사방에서 모여든 점이 이름이 됨. 주위에는 느리게 떠다니는 점
   ② 스크롤하면 이름이 흩어지고 떠다니는 점도 사라짐
   ③ Contact에서 이름을 그리던 점이 다시 모여 이름이 됨
   Three.js(MIT)의 Points + 셰이더로 그리기 호출 한 번. 점의 자리는 시간·스크롤만으로 정해져(상태 없음) 프레임마다 CPU가 하는 일은 값 몇 개를 넘기는 것뿐.
   글자 자리는 실제 글자(h1, .foot__name)를 캔버스에 그려 픽셀에서 뽑고, 글자 자체는 그대로 남겨 스크린리더·검색·복사에 씀.
   캔버스는 이름이 보이는 첫 화면과 Contact에서만 켜고 본문에서는 끔. 본문을 읽는 구간에는 움직이는 것을 두지 않음.
   모션 줄이기 환경이거나 WebGL이 없으면 아무것도 하지 않아 원래 글자가 보임. */
import * as THREE from './vendor/three.module.min.js';

THREE.ColorManagement.enabled = false; // CSS 색 값을 바꾸지 않고 그대로 칠함

const INTRO = 2.4; // 이름이 다 자리 잡는 시각(초)
const html = document.documentElement;
const $ = (s) => document.querySelector(s);
const hero = $('.hero'), h1 = $('#name'), foot = $('.foot'), endEl = $('#foot-name'), canvas = $('#gl');
const css = (el, n, fb) => getComputedStyle(el).getPropertyValue(n).trim() || fb;
const isLite = () => html.classList.contains('lite');
const clamp01 = (v) => Math.min(1, Math.max(0, v));

let renderer = null;
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && hero && h1 && canvas) {
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); } catch (e) { renderer = null; }
}

if (!renderer) html.classList.remove('gl-hero'); // 원래 글자를 다시 보이게
else {
  clearTimeout(window.glHeroTimer); html.classList.add('gl-hero'); // 늦게 준비돼도 점이 글자를 대신 그림
  const api = window.Stream = { intro: INTRO, covered: false, ready: null }; // covered: 표지가 화면을 다 덮음 (main.js가 알려 줌)
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10); // 화면 픽셀 좌표 (y 아래로)
  const v2 = (x = 0, y = 0) => ({ value: new THREE.Vector2(x, y) });
  const u = {
    uTime: { value: 0 }, uHero: { value: 0 }, uEnd: { value: 0 }, uFoot: { value: 0 }, uScroll: { value: 0 }, uVel: { value: 0 },
    uSize: { value: 2 }, uEndSize: { value: 2 }, uDpr: { value: 1 }, uHalo: { value: 3 }, uGlow: { value: 0.2 }, uPush: { value: 0 },
    uView: v2(1, 1), uNameO: v2(), uEndO: v2(), uEndS: v2(1, 1), uMouse: v2(-9999, -9999), uMouseV: v2(), uLook: v2(),
    uInk: { value: new THREE.Color('#eef0ff') }, uSun: { value: new THREE.Color('#ffd84a') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthTest: false, depthWrite: false,
    // 색과 알파를 모두 더함(미리 곱한 알파): 겹칠수록 밝고 진해지고, 캔버스는 어느 바탕 위에든 그대로 얹힘. 두 테마가 같은 혼합식을 써서 런타임에 바꾸지 않음
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: /* glsl */ `
      uniform float uTime, uHero, uEnd, uFoot, uScroll, uVel, uSize, uEndSize, uDpr, uHalo, uPush;
      uniform vec2 uView, uNameO, uEndO, uEndS, uMouse, uMouseV, uLook;
      attribute vec2 aEnd;   // Contact 이름 안의 자리 (글자 상자 왼쪽 위 기준)
      attribute vec4 aSeed;  // 난수: x·y 위치와 위상, z 깊이(가까울수록 크고 빠름), w 방향
      attribute vec3 aMeta;  // x 이름으로 출발하는 시각(초), y 종류(0 떠다니는 점 · 1 이름을 그리는 점), z 강조색
      varying float vAccent, vAlpha, vStretch, vCore;
      const float PI = 3.14159265;
      float arrive(float t) { float m = 1.0 - t; return 1.0 - m * m * m * m; } // 빠르게 와서 느리게 안착
      float ease(float t) { return t * t * (3.0 - 2.0 * t); }
      vec2 perp(vec2 v) { return vec2(-v.y, v.x); }
      vec2 jitter(float r) { return vec2(sin(uTime * (0.5 + r) + r * 40.0), cos(uTime * (0.4 + r) + r * 23.0)) * 0.9; } // 제자리에서 살짝 떨림

      void main() {
        vec4 s = aSeed;
        float depth = s.z, t = uTime;
        vec2 p;
        float alpha, size, formed = 0.0; // formed: 글자 안에 자리 잡은 정도

        if (aMeta.y < 0.5) {
          // 떠다니는 점: 화면 곳곳에서 제각기 느리게 흘러가고, 가장자리 밖으로 나가면 반대쪽에서 다시 들어옴.
          // 스크롤하면 가까운 점일수록 빨리 따라 올라가며(깊이감) 사라짐
          float a = s.w * 2.0 * PI;
          vec2 box = uView + 80.0;
          p = mod(s.xy * box + vec2(cos(a), sin(a)) * t * mix(5.0, 16.0, depth) - vec2(0.0, uScroll * mix(0.35, 1.0, depth)), box) - 40.0;
          p += vec2(sin(t * 0.3 + s.x * 40.0), cos(t * 0.25 + s.y * 31.0)) * 6.0;
          alpha = mix(0.35, 0.9, depth) * (0.7 + 0.3 * sin(t * (0.5 + s.w) + s.y * 50.0)) // 천천히 깜빡임
            * (1.0 - smoothstep(0.0, 0.75, uHero)) * smoothstep(${(INTRO - 0.9).toFixed(1)}, ${(INTRO + 0.6).toFixed(1)}, t); // 이름이 자리 잡을 즈음부터 보임
          size = mix(1.6, 4.2, depth);
        } else {
          // 화면 밖 사방의 한 점: 처음 들어오고, 스크롤하면 흩어져 나가고, Contact에서 다시 들어오는 자리
          float ang = s.x * 2.0 * PI;
          vec2 away = uView * 0.5 + vec2(cos(ang), sin(ang)) * length(uView) * (0.62 + s.y * 0.4);
          vec2 home = position.xy + uNameO;
          // ① 첫 등장: 화면 밖에서 휘어 들어와 제자리에 안착
          float ei = arrive(clamp((t - aMeta.x) / 1.5, 0.0, 1.0));
          vec2 np = mix(away, home, ei) + perp(home - away) * sin(ei * PI) * (s.w - 0.5) * 0.4 + jitter(s.y);
          // ② 스크롤: 왔던 쪽으로 흩어지며 사라짐 (점마다 출발이 조금씩 다름)
          float h = smoothstep(s.w * 0.45, s.w * 0.45 + 0.55, uHero);
          p = np + (away - np) * ease(h) * (0.3 + s.y * 0.4);
          alpha = (0.25 + 0.75 * ei) * (1.0 - h);
          size = uSize * (0.75 + s.y * 0.6);
          formed = 1.0 - h;
          // ③ Contact: 왼쪽 글자부터 차례로 자리를 채움. 푸터 안에 들어온 뒤에만 보임(앞 섹션의 글 위를 지나가지 않게)
          if (uEnd > 0.0) {
            float a0 = aEnd.x / uEndS.x * 0.28 + s.x * 0.17;
            float e = smoothstep(a0, a0 + 0.55, uEnd), ee = ease(e);
            vec2 seat = aEnd + uEndO + jitter(s.y);
            p = mix(away, seat, ee) + perp(seat - away) * sin(ee * PI) * (s.w - 0.5) * 0.3;
            alpha = smoothstep(uFoot - 20.0, uFoot + 110.0, p.y) * smoothstep(0.0, 0.25, e);
            size = mix(size, uEndSize * (0.8 + s.y * 0.4), ee);
            formed = e;
          }
        }

        // 포인터: 가까운 점은 비켜나며 휘돌고, 움직이는 쪽으로 끌려감
        vec2 dm = p - uMouse; float dl = length(dm) + 1e-3;
        float f = smoothstep(150.0, 0.0, dl) * uPush;
        p += dm / dl * f * 40.0 + perp(dm) / dl * f * 16.0 + uMouseV * f * 5.0;
        p += uLook * (depth - 0.5) * 28.0 * (1.0 - formed); // 떠다니는 점은 깊이마다 다르게 밀려 입체로 보임 (글자가 된 점은 또렷하게 그대로)

        // 빨리 넘길수록 움직이는 점이 세로 선으로(최대 4배). 늘어날 때는 번지는 빛을 줄이고 옅게 해서, 칠하는 넓이와 밝기가 불어나지 않게 묶어 둠
        float st = 1.0 + abs(uVel) * 3.0 * (1.0 - formed);
        float halo = mix(uHalo, min(uHalo, 1.3), clamp(st - 1.0, 0.0, 1.0));
        vStretch = st; vCore = 1.0 / halo; vAccent = aMeta.z; vAlpha = alpha / mix(1.0, st, 0.5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
        gl_PointSize = size * uDpr * halo * st;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk, uSun; uniform float uGlow;
      varying float vAccent, vAlpha, vStretch, vCore;
      void main() {
        vec2 q = gl_PointCoord - 0.5; q.x *= vStretch;
        float d = length(q) * 2.0;
        if (d > 1.0) discard;
        // 점 본체는 가운데(vCore 안쪽), 그 바깥은 번지는 빛
        float a = (1.0 - smoothstep(vCore * 0.35, vCore, d) + pow(1.0 - d, 2.4) * uGlow) * vAlpha;
        gl_FragColor = vec4(mix(uInk, uSun, vAccent) * a, a);
      }`,
  });

  let points = null, W = 0, H = 0, heroH = 1, started = 0, last = 0, lastY = 0, vel = 0, heroOn = true, footOn = false, shown = true;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0, seen: false };

  // 글자를 같은 글꼴로 캔버스에 그려 둠 (간격을 바꿔 가며 픽셀을 뽑을 수 있게)
  function raster(el) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    const off = document.createElement('canvas');
    off.width = Math.ceil(r.width + fs * 0.2); off.height = Math.ceil(r.height);
    const c = off.getContext('2d', { willReadFrequently: true });
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in c) c.letterSpacing = cs.letterSpacing;
    c.textBaseline = 'middle'; c.fillStyle = '#000';
    const copy = el.cloneNode(true); // <br>로 나뉜 줄마다 한 줄씩. innerText는 가려 둔 글자(첫 화면 연출 전)를 빈 글로 돌려주므로 쓰지 않음
    copy.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    const lines = copy.textContent.split('\n').map((t) => t.trim()), lh = r.height / lines.length;
    lines.forEach((t, i) => c.fillText(t, 0, lh * (i + 0.5)));
    return { px: c.getImageData(0, 0, off.width, off.height).data, w: off.width, h: off.height, bw: r.width || 1, bh: r.height || 1, fs };
  }
  const pick = (g, step) => {
    const out = [];
    for (let y = 0; y < g.h; y += step) for (let x = 0; x < g.w; x += step) if (g.px[((y | 0) * g.w + (x | 0)) * 4 + 3] > 128) out.push(x, y);
    return out;
  };
  // 글자 안에서 정확히 n개의 자리를 고름: n개 이상이 나오는 가장 넓은 간격을 찾고, 넘친 만큼은 고르게 솎아 냄
  function seats(g, n) {
    let lo = 0.5, hi = 16;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (pick(g, mid).length / 2 >= n) lo = mid; else hi = mid; }
    const all = pick(g, lo), m = all.length / 2, out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const j = Math.floor((i * m) / n) % m; out[i * 2] = all[j * 2]; out[i * 2 + 1] = all[j * 2 + 1]; }
    return { at: out, step: lo };
  }

  function build() {
    const lite = isLite(), dpr = lite ? 1 : Math.min(devicePixelRatio || 1, 2); // 가벼운 모드: 해상도 1배, 점은 듬성하게, 번지는 빛 없음
    W = innerWidth; H = innerHeight; heroH = hero.offsetHeight || H;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    Object.assign(camera, { right: W, bottom: H }); camera.updateProjectionMatrix();
    u.uView.value.set(W, H); u.uDpr.value = dpr; u.uHalo.value = lite ? 1 : 3;

    const name = raster(h1), step = Math.max(2, Math.round(name.fs / 75)) + (lite ? 1 : 0);
    const np = pick(name, step), nName = np.length / 2;
    const nFloat = Math.round((lite ? 120 : 280) * Math.min(1, Math.max(0.45, W / 1440))), total = nFloat + nName; // 떠다니는 점. 좁은 화면은 줄임
    const pos = new Float32Array(total * 3), end = new Float32Array(total * 2), seed = new Float32Array(total * 4), meta = new Float32Array(total * 3);
    for (let i = 0; i < total * 4; i++) seed[i] = Math.random();
    for (let i = 0; i < total; i++) meta[i * 3 + 2] = Math.random() < 0.06 ? 1 : 0; // 강조색 점
    for (let i = 0; i < nName; i++) {
      const j = nFloat + i, x = np[i * 2], y = np[i * 2 + 1];
      pos[j * 3] = x; pos[j * 3 + 1] = y;
      meta[j * 3] = 0.1 + Math.random() * 0.5 + (x / name.bw) * 0.3; // 왼쪽 글자부터 차례로
      meta[j * 3 + 1] = 1;
    }
    u.uSize.value = step * (name.fs < 120 ? 1.2 : 0.95); // 작은 글씨는 점을 키워야 글자가 채워져 보임

    // Contact 이름: 이름을 그리던 점 수만큼 자리를 뽑아 무작위로 나눠 줌
    if (endEl && endEl.offsetWidth && nName) {
      const g = raster(endEl), to = seats(g, nName), order = Array.from({ length: nName }, (_, i) => i);
      for (let i = nName - 1; i > 0; i--) { const k = (Math.random() * (i + 1)) | 0; [order[i], order[k]] = [order[k], order[i]]; }
      for (let i = 0; i < nName; i++) { const j = nFloat + i, o = order[i]; end[j * 2] = to.at[o * 2]; end[j * 2 + 1] = to.at[o * 2 + 1]; }
      u.uEndS.value.set(g.bw, g.bh); u.uEndSize.value = to.step * (g.fs < 120 ? 1.2 : 0.95);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 2));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 3));
    if (points) { points.geometry.dispose(); scene.remove(points); }
    points = new THREE.Points(g, material);
    points.frustumCulled = false; // 자리는 셰이더가 정하므로 원래 좌표로 화면 밖 판정을 하지 않음
    scene.add(points);
    theme();
    return nName;
  }

  function theme() { // 번지는 빛은 어두운 바탕에서만 (밝은 바탕에서는 잉크 점)
    u.uInk.value.set(css(html, '--ink', '#eef0ff')); u.uSun.value.set(css(html, '--sun', '#ffd84a'));
    u.uGlow.value = html.dataset.theme !== 'light' && !isLite() ? 0.2 : 0;
  }

  function frame() {
    if (!points || !started || document.hidden) return;
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05) || 0.016, t = (now - started) / 1000, y = scrollY;
    last = now;
    vel = Math.abs(y - lastY) > H ? 0 : vel + ((y - lastY) / dt / 2600 - vel) * 0.12; lastY = y; // 화면 세 장쯤을 1초에 넘기는 속도가 1. 한 프레임에 화면 한 장 넘게 뛰면(바로가기·새로고침 복원) 넘긴 것으로 치지 않음
    const uHero = heroOn ? clamp01(y / (heroH * 0.7)) : 1;
    let uEnd = 0;
    if (footOn) { // 푸터가 화면 아래에 걸칠 때부터 모이기 시작해 맨 끝 조금 전에 다 모임
      const r = endEl.getBoundingClientRect();
      u.uEndO.value.set(r.left, r.top); u.uFoot.value = foot.getBoundingClientRect().top;
      uEnd = clamp01(1 - (html.scrollHeight - H - y - 4) / (foot.offsetHeight * 0.8));
    }
    // 이름이 보이는 동안(첫 등장, 첫 화면, Contact)에만 캔버스를 켜고 그림
    const show = !api.covered && (t < INTRO + 1 || uHero < 1 || uEnd > 0);
    if (show !== shown) { shown = show; canvas.hidden = !show; }
    if (!show) return;
    u.uTime.value = t; u.uScroll.value = y; u.uVel.value = Math.max(-1, Math.min(1, vel)); u.uHero.value = uHero; u.uEnd.value = uEnd;
    if (heroOn) { const r = h1.getBoundingClientRect(); u.uNameO.value.set(r.left, r.top); }
    const px = ptr.x, py = ptr.y;
    ptr.x += (ptr.tx - ptr.x) * 0.2; ptr.y += (ptr.ty - ptr.y) * 0.2; ptr.on += (ptr.ton - ptr.on) * 0.1;
    u.uMouse.value.set(ptr.x, ptr.y); u.uMouseV.value.set(ptr.x - px, ptr.y - py); u.uPush.value = ptr.on;
    u.uLook.value.set((ptr.x / W - 0.5) * 2 * ptr.on, (ptr.y / H - 0.5) * 2 * ptr.on);
    renderer.render(scene, camera);
  }

  addEventListener('pointermove', (e) => {
    ptr.tx = e.clientX; ptr.ty = e.clientY; ptr.ton = 1;
    if (!ptr.seen) { ptr.seen = true; ptr.x = ptr.tx; ptr.y = ptr.ty; } // 처음에는 화면 밖에서 끌려오지 않게
  }, { passive: true });
  const release = () => { ptr.ton = 0; };
  addEventListener('pointerout', (e) => { if (!e.relatedTarget) release(); }, { passive: true });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') release(); }, { passive: true }); // 손가락을 떼면 밀어내기도 끝
  addEventListener('pointercancel', release, { passive: true });
  addEventListener('blur', release);
  addEventListener('themechange', theme);
  addEventListener('litechange', () => { if (points) build(); });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { // ponytail: 폭이 바뀌면 글자 자리를 다시 뽑음(이미 지난 출발 시각이라 바로 제자리). 높이만 바뀌면(휴대폰 주소창) 캔버스 크기만
    if (!points) return;
    if (innerWidth !== W) return build();
    H = innerHeight; heroH = hero.offsetHeight || H; renderer.setSize(W, H, false); u.uView.value.set(W, H); Object.assign(camera, { bottom: H }); camera.updateProjectionMatrix();
  }, 200); });
  new IntersectionObserver(([e]) => { heroOn = e.isIntersecting; }).observe(hero);
  if (foot) new IntersectionObserver(([e]) => { footOn = e.isIntersecting; }).observe(foot);
  // 컨텍스트를 잃은 동안에는 원래 글자를 보여 줌 (복구는 Three.js가 함)
  canvas.addEventListener('webglcontextlost', () => html.classList.remove('gl-hero'));
  canvas.addEventListener('webglcontextrestored', () => html.classList.add('gl-hero'));

  // 글꼴이 준비된 뒤에 뽑아야 글자 모양이 맞음. 셰이더를 미리 컴파일해 첫 프레임이 끊기지 않게 한 뒤 시작
  api.ready = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(async () => {
    const n = build();
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* 지원하지 않으면 첫 프레임에 컴파일 */ }
    started = last = performance.now(); lastY = scrollY;
    if (window.gsap) gsap.ticker.add(frame); // Lenis가 스크롤을 옮긴 뒤 같은 프레임에 그림
    else { const loop = () => { frame(); requestAnimationFrame(loop); }; loop(); }
    return n; // 이름을 그리는 점 수 (0이면 main.js가 글자로 연출)
  }).catch(() => { html.classList.remove('gl-hero'); return 0; }); // 글자를 뽑지 못하면 원래 글자로
}
