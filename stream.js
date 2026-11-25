/* 요청 스트림. 점 하나가 요청 하나입니다.
   ① 첫 화면: 사방에서 몰려온 점이 이름을 만들고, 오른쪽 빈 자리로는 요청 줄기가 이름 쪽으로 흘러듦 (WebGL)
   ② 본문: 이름이 풀려 양옆 여백을 따라 아래로 흐르는 두 줄기에 합류함. 빨리 넘기면 점이 선으로 늘어남 (CSS 레이어)
   ③ Contact: 줄기에서 나온 점이 다시 모여 큰 이름이 됨 (WebGL)
   이름은 Three.js(MIT)의 Points + 셰이더로 그리기 호출 한 번. 점의 자리는 시간·스크롤만으로 정해져(상태 없음) 프레임마다 CPU가 하는 일은 값 몇 개를 넘기는 것뿐.
   글자 자리는 실제 글자(h1, .foot__name)를 캔버스에 그려 픽셀에서 뽑고, 글자 자체는 그대로 남겨 스크린리더·검색·복사에 씀.
   WebGL 캔버스는 이름이 보이는 첫 화면과 Contact에서만 켜고, 그 사이 긴 본문에서는 끔(그릴 것이 없는 화면 크기 캔버스를 계속 돌리지 않음).
   본문 줄기는 점 무늬를 한 번 그려 둔 좁은 레이어 네 장을 transform·opacity로만 움직여서 스크롤 중에 다시 그리는 것이 없음.
   실측(Intel UHD 630, 1440×900, 1.6초에 4,000px 스크롤): 프레임 간격 중앙값 16.7ms, 25ms를 넘긴 프레임은 96장 중 0~1장으로 이 연출을 넣기 전과 같음.
   모션 줄이기 환경이면 아무것도 하지 않고, WebGL이 없으면 줄기만 흐르고 이름은 원래 글자가 보임. */
import * as THREE from './vendor/three.module.min.js';

THREE.ColorManagement.enabled = false; // CSS 색 값을 바꾸지 않고 그대로 칠함

const html = document.documentElement;
const $ = (s) => document.querySelector(s);
const hero = $('.hero'), h1 = $('#name'), foot = $('.foot'), endEl = $('#foot-name'), canvas = $('#gl');
const css = (el, n, fb) => getComputedStyle(el).getPropertyValue(n).trim() || fb;
const isLite = () => html.classList.contains('lite');
const clamp01 = (v) => Math.min(1, Math.max(0, v));

if (matchMedia('(prefers-reduced-motion: reduce)').matches || !hero || !h1) html.classList.remove('gl-hero'); // 원래 글자를 다시 보이게
else {
  const api = window.Stream = { count: 0, intro: 2.4, covered: false, ready: Promise.resolve(0), accent() {} }; // count: 점 수, intro: 첫 등장이 끝나는 시각(초), covered: 표지가 화면을 다 덮음
  // 줄기의 자리: 본문 글자 칸에 닿지 않게 여백 안쪽에. 가운데(가장자리에서)와 폭
  const laneGeo = () => { const pad = parseFloat(getComputedStyle(hero).paddingLeft) || 20; return [pad * 0.42, Math.max(pad * 0.62, 18)]; };
  // 스크롤 속도: 화면 세 장쯤을 1초에 넘기면 1. 한 프레임에 화면 한 장 넘게 뛰면(바로가기·새로고침 복원) 넘긴 것으로 치지 않음
  const flow = { y: scrollY, vel: 0, t: 0, dt: 0.016, last: performance.now() };
  const steps = [() => {
    const now = performance.now(), y = scrollY;
    flow.dt = Math.min((now - flow.last) / 1000, 0.05) || 0.016; flow.last = now; flow.t = now / 1000;
    flow.vel = Math.abs(y - flow.y) > innerHeight ? 0 : Math.max(-1, Math.min(1, flow.vel + ((y - flow.y) / flow.dt / 2600 - flow.vel) * 0.12));
    flow.y = y;
  }];

  /* ───────── ② 본문 줄기 (CSS 레이어) ─────────
     점 무늬를 한 번만 그려 배경 그림으로 쓰고, 양옆에 깊이가 다른 두 장(먼 점·가까운 점)을 겹쳐 transform과 opacity로만 움직임 (다시 그리기 없음).
     무늬는 테마나 대표색이 바뀔 때만 다시 그림 */
  {
    const TILE = 640, box = document.createElement('div');
    box.className = 'lanes'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<div class="lane"><i></i><i></i></div><div class="lane lane--r"><i></i><i></i></div>';
    canvas ? canvas.after(box) : document.body.prepend(box);
    const KIND = [{ n: 170, r: [0.6, 1.0], speed: 16, par: 0.22, a: 0.5 }, { n: 110, r: [0.9, 1.6], speed: 44, par: 0.6, a: 0.9 }]; // 가까운 점일수록 크고, 진하고, 빨리 흐르고, 스크롤을 더 따라감(시차)
    const layers = [...box.querySelectorAll('i')].map((el, i) => ({ el, ...KIND[i % 2], phase: Math.random() * TILE, seed: [] }));
    let tint = ''; // 지금 읽는 프로젝트의 대표색 (fx.js가 알려 줌. 없으면 기본 강조색)
    const draw = () => {
      const [x, w] = laneGeo(), W = Math.round(w + 10), d = Math.min(devicePixelRatio || 1, 2), lite = isLite();
      const ink = css(html, '--ink', '#eef0ff'), sun = tint || css(html, '--sun', '#ffd84a');
      box.style.setProperty('--lane-x', Math.max(x - W / 2, 0) + 'px'); box.style.setProperty('--lane-w', W + 'px');
      layers.forEach((L, li) => {
        const c = document.createElement('canvas'), g = c.getContext('2d'), n = lite ? L.n / 2 : L.n;
        c.width = W * d; c.height = TILE * d; g.scale(d, d);
        for (let i = 0; i < n; i++) {
          const q = L.seed[i] ||= [Math.random(), Math.random(), Math.random(), Math.random()]; // 색만 바뀔 때 점 자리는 그대로
          const r = L.r[0] + q[0] * (L.r[1] - L.r[0]), px = r + q[1] * (W - 2 * r), py = q[2] * TILE;
          g.globalAlpha = 0.35 + q[3] * 0.65; g.fillStyle = li % 2 && i % 7 === 0 ? sun : ink; // 가까운 점 일곱 개 중 하나는 강조색
          for (const wrap of [-TILE, 0, TILE]) { g.beginPath(); g.arc(px, py + wrap, r, 0, 6.283); g.fill(); } // 이어 붙는 자리에서 점이 잘리지 않게
        }
        L.el.style.backgroundImage = `url(${c.toDataURL()})`;
      });
    };
    draw();
    const born = performance.now() / 1000;
    steps.push(() => {
      if (api.covered) return;
      const st = isLite() ? 1 : 1 + Math.abs(flow.vel) * 3; // 빨리 넘길수록 점이 세로 선으로(최대 4배), 그만큼 옅게
      const fade = clamp01((flow.t - born) / 1.6) / (1 + (st - 1) * 0.5); // 처음에는 서서히 켜짐
      for (const L of layers) {
        L.el.style.transform = `translate3d(0,${((((flow.t * L.speed - flow.y * L.par + L.phase) % TILE) + TILE) % TILE).toFixed(1)}px,0) scaleY(${st.toFixed(3)})`;
        const op = (L.a * fade).toFixed(3);
        if (op !== L.op) L.el.style.opacity = L.op = op;
      }
    });
    api.accent = (c) => { if ((c || '') !== tint) { tint = c || ''; draw(); } };
    let lw = innerWidth, rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (innerWidth !== lw) { lw = innerWidth; draw(); } }, 200); });
    addEventListener('litechange', draw);
    addEventListener('themechange', draw);
  }

  /* ───────── ①·③ 이름을 만드는 점 (WebGL) ───────── */
  let renderer = null;
  if (canvas) { try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); } catch (e) { renderer = null; } }
  if (!renderer) html.classList.remove('gl-hero');
  else {
    clearTimeout(window.glHeroTimer); html.classList.add('gl-hero'); // 늦게 준비돼도 점이 글자를 대신 그림
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10); // 화면 픽셀 좌표 (y 아래로)
    const v2 = (x = 0, y = 0) => ({ value: new THREE.Vector2(x, y) });
    const u = {
      uTime: { value: 0 }, uIn: { value: 0 }, uHero: { value: 0 }, uEnd: { value: 0 }, uFoot: { value: 0 }, uScroll: { value: 0 }, uVel: { value: 0 },
      uSize: { value: 2 }, uEndSize: { value: 3 }, uDpr: { value: 1 }, uHalo: { value: 3 }, uGlow: { value: 0.2 }, uPush: { value: 0 },
      uView: v2(1, 1), uNameO: v2(), uNameS: v2(1, 1), uEndO: v2(), uEndS: v2(1, 1), uMouse: v2(-9999, -9999), uMouseV: v2(), uLook: v2(), uPad: v2(30, 45),
      uInk: { value: new THREE.Color('#eef0ff') }, uSun: { value: new THREE.Color('#ffd84a') },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthTest: false, depthWrite: false,
      // 색과 알파를 모두 더함(미리 곱한 알파): 겹칠수록 밝고 진해지고, 캔버스는 어느 바탕 위에든 그대로 얹힘. 두 테마가 같은 혼합식을 써서 런타임에 바꾸지 않음
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: /* glsl */ `
        uniform float uTime, uIn, uHero, uEnd, uFoot, uScroll, uVel, uSize, uEndSize, uDpr, uHalo, uPush;
        uniform vec2 uView, uNameO, uNameS, uEndO, uEndS, uMouse, uMouseV, uLook, uPad;
        attribute vec2 aEnd;   // Contact 이름 안의 자리 (글자 상자 왼쪽 위 기준)
        attribute vec4 aSeed;  // 난수: x 좌우·방향, y 위상, z 깊이(가까울수록 크고 빠름), w 묶음
        attribute vec4 aMeta;  // x 첫 등장 출발 시각(초), y 이름 점 1 · 줄기 점 0, z 강조색, w Contact 자리 있음
        varying float vAccent, vAlpha, vStretch, vCore;
        const float PI = 3.14159265;
        float arrive(float t) { float m = 1.0 - t; return 1.0 - m * m * m * m; } // 빠르게 와서 느리게 안착
        float ease(float t) { return t * t * (3.0 - 2.0 * t); }
        vec2 perp(vec2 v) { return vec2(-v.y, v.x); }
        vec2 jitter(float r) { return vec2(sin(uTime * (0.5 + r) + r * 40.0), cos(uTime * (0.4 + r) + r * 23.0)) * 0.9; } // 제자리에서 살짝 떨림

        void main() {
          vec4 s = aSeed;
          float depth = s.z, t = uTime;

          // 양옆 줄기 안의 자리. 여기 도착한 점은 보이지 않음: 줄기 자체는 CSS 레이어가 그리고, 이 자리는 점이 합류해 사라지거나 다시 나오는 곳
          float span = uView.y + 240.0;
          float ly = mod(s.y * span + t * mix(16.0, 46.0, depth) - uScroll * mix(0.22, 0.62, depth), span) - 120.0;
          vec2 p = vec2(mix(uPad.x, uView.x - uPad.x, step(0.5, s.x)) + (fract(s.x * 7.13) - 0.5) * uPad.y, ly);
          float alpha = 0.0, size = mix(1.3, 3.2, depth);
          float formed = 0.0; // 글자 안에 자리 잡은 정도

          if (aMeta.y < 0.5) {
            // ① 첫 화면의 요청 줄기: 오른쪽 위에서 들어와 이름으로 휘어 듦. 스크롤하면 풀려 양옆 줄기로
            if (uHero < 1.0) {
              float k = fract(s.y + t * mix(0.03, 0.06, depth)), m = 1.0 - k;
              vec2 a = vec2(uView.x * 1.06, -uView.y * 0.04), b = vec2(uView.x * 0.72, uView.y * 0.26);
              vec2 c = vec2(uView.x * 0.66, uView.y * 0.68), d = uNameO + uNameS * vec2(1.0, 0.52);
              vec2 rp = m * m * m * a + 3.0 * m * m * k * b + 3.0 * m * k * k * c + k * k * k * d;
              vec2 tg = normalize(3.0 * m * m * (b - a) + 6.0 * m * k * (c - b) + 3.0 * k * k * (d - c));
              float o = (s.x - 0.5) * 2.0; o *= abs(o); // 가운데가 촘촘
              rp += perp(tg) * (o * mix(uView.x * 0.1, 8.0, k) + sin(t * 0.7 + s.x * 40.0 + k * 10.0) * 7.0);
              float gone = smoothstep(0.0, 0.75, uHero);
              p = mix(rp, p, gone);
              alpha = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.84, 1.0, k)) * mix(0.4, 1.0, depth) * (1.0 - gone) * smoothstep(0.2, 1.6, uIn); // 첫 등장 때는 서서히
            }
          } else {
            vec2 home = position.xy + uNameO;
            // 첫 등장: 화면 밖 사방에서 휘어 들어와 제자리에 안착
            float ei = arrive(clamp((uIn - aMeta.x) / 1.5, 0.0, 1.0));
            float ang = s.x * 2.0 * PI;
            vec2 from = uView * 0.5 + vec2(cos(ang), sin(ang)) * length(uView) * (0.62 + s.y * 0.4);
            vec2 np = mix(from, home, ei) + perp(home - from) * sin(ei * PI) * (s.w - 0.5) * 0.4 + jitter(s.y);
            // 스크롤: 글자가 풀려 줄기에 합류하며 사라짐 (점마다 출발이 조금씩 다름)
            float h = smoothstep(s.w * 0.45, s.w * 0.45 + 0.55, uHero), eh = ease(h);
            p = mix(np, p, eh) + perp(p - np) * sin(eh * PI) * (s.x - 0.5) * 0.3;
            alpha = (0.25 + 0.75 * ei) * (1.0 - h);
            size = uSize * (0.75 + s.y * 0.6);
            formed = 1.0 - h;
          }

          // ③ Contact: 줄기에서 빠져나와 왼쪽 글자부터 차례로 자리를 채움. 푸터 안에 들어온 뒤에만 보임(앞 섹션의 글 위를 지나가지 않게)
          if (aMeta.w > 0.5 && uEnd > 0.0) {
            float a0 = aEnd.x / uEndS.x * 0.28 + s.x * 0.17;
            float e = smoothstep(a0, a0 + 0.55, uEnd), ee = ease(e);
            vec2 home = aEnd + uEndO + jitter(s.y);
            p = mix(p, home, ee) + perp(home - p) * sin(ee * PI) * (s.w - 0.5) * 0.3;
            alpha = mix(alpha, smoothstep(uFoot - 20.0, uFoot + 110.0, p.y), smoothstep(0.0, 0.25, e));
            size = mix(size, uEndSize * (0.8 + s.y * 0.4), ee);
            formed = max(formed, e);
          }

          // 포인터: 가까운 점은 비켜나며 휘돌고, 움직이는 쪽으로 끌려감
          vec2 dm = p - uMouse; float dl = length(dm) + 1e-3;
          float f = smoothstep(150.0, 0.0, dl) * uPush;
          p += dm / dl * f * 40.0 + perp(dm) / dl * f * 16.0 + uMouseV * f * 5.0;
          p += uLook * (depth - 0.5) * 28.0 * (1.0 - formed); // 흐르는 점은 깊이마다 다르게 밀려 입체로 보임 (글자가 된 점은 또렷하게 그대로)

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

    let points = null, total = 0, W = 0, H = 0, heroH = 1, started = 0, heroOn = true, footOn = false, shown = true;
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
      const copy = el.cloneNode(true); // <br> 로 나뉜 줄마다 한 줄씩. innerText는 가려 둔 글자(첫 화면 연출 전)를 빈 글로 돌려주므로 쓰지 않음
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

    function build() {
      const lite = isLite(), dpr = lite ? 1 : Math.min(devicePixelRatio || 1, 2); // 가벼운 모드: 해상도 1배, 점은 듬성하게, 번지는 빛 없음
      W = innerWidth; H = innerHeight; heroH = hero.offsetHeight || H;
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
      Object.assign(camera, { right: W, bottom: H }); camera.updateProjectionMatrix();
      u.uView.value.set(W, H); u.uPad.value.set(...laneGeo()); u.uDpr.value = dpr; u.uHalo.value = lite ? 1 : 3;

      const name = raster(h1), step = Math.max(2, Math.round(name.fs / 75)) + (lite ? 1 : 0);
      const np = pick(name, step), nName = np.length / 2;
      const nRib = Math.round((lite ? 500 : 1400) * Math.min(1, Math.max(0.45, W / 1440))); // 첫 화면의 요청 줄기. 좁은 화면은 줄임
      total = nRib + nName;
      const pos = new Float32Array(total * 3), end = new Float32Array(total * 2), seed = new Float32Array(total * 4), meta = new Float32Array(total * 4);
      for (let i = 0; i < total * 4; i++) seed[i] = Math.random();
      for (let i = 0; i < total; i++) meta[i * 4 + 2] = Math.random() < 0.06 ? 1 : 0; // 강조색 점
      for (let i = 0; i < nName; i++) {
        const j = nRib + i, x = np[i * 2], y = np[i * 2 + 1];
        pos[j * 3] = x; pos[j * 3 + 1] = y;
        meta[j * 4] = 0.1 + Math.random() * 0.5 + x / name.bw * 0.3; // 왼쪽 글자부터 차례로
        meta[j * 4 + 1] = 1;
      }
      u.uNameS.value.set(name.bw, name.bh);
      u.uSize.value = step * (name.fs < 120 ? 1.2 : 0.95); // 작은 글씨는 점을 키워야 글자가 채워져 보임

      // Contact 이름: 가진 점 수에 맞는 간격으로 자리를 뽑아 무작위로 나눠 줌
      if (endEl && endEl.offsetWidth) {
        const g = raster(endEl), es = Math.max(2, Math.sqrt(pick(g, 4).length * 16 / total)), ep = pick(g, es), nEnd = ep.length / 2;
        const order = Array.from({ length: nEnd }, (_, i) => i);
        for (let i = nEnd - 1; i > 0; i--) { const k = (Math.random() * (i + 1)) | 0; [order[i], order[k]] = [order[k], order[i]]; }
        for (let i = 0; i < Math.min(total, nEnd); i++) { const o = order[i]; end[i * 2] = ep[o * 2]; end[i * 2 + 1] = ep[o * 2 + 1]; meta[i * 4 + 3] = 1; }
        u.uEndS.value.set(g.bw, g.bh); u.uEndSize.value = es * 0.95;
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aEnd', new THREE.BufferAttribute(end, 2));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
      g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));
      if (points) { points.geometry.dispose(); scene.remove(points); }
      points = new THREE.Points(g, material);
      points.frustumCulled = false; // 자리는 셰이더가 정하므로 원래 좌표로 화면 밖 판정을 하지 않음
      scene.add(points);
      api.count = total;
      theme();
    }

    function theme() { // 번지는 빛은 어두운 바탕에서만 (밝은 바탕에서는 잉크 점)
      u.uInk.value.set(css(html, '--ink', '#eef0ff')); u.uSun.value.set(css(html, '--sun', '#ffd84a'));
      u.uGlow.value = html.dataset.theme !== 'light' && !isLite() ? 0.2 : 0;
    }

    steps.push(() => {
      if (!points || !started) return;
      const t = (flow.last - started) / 1000, y = flow.y;
      const uHero = heroOn ? clamp01(y / (heroH * 0.7)) : 1;
      let uEnd = 0;
      if (footOn) { // 푸터가 화면 아래에 걸칠 때부터 모이기 시작해 맨 끝 조금 전에 다 모임
        const r = endEl.getBoundingClientRect();
        u.uEndO.value.set(r.left, r.top); u.uFoot.value = foot.getBoundingClientRect().top;
        uEnd = clamp01(1 - (html.scrollHeight - H - y - 4) / (foot.offsetHeight * 0.8));
      }
      // 이름이 보이는 동안(첫 등장, 첫 화면, Contact)에만 캔버스를 켜고 그림
      const show = !api.covered && (t < api.intro + 1 || uHero < 1 || uEnd > 0);
      if (show !== shown) { shown = show; canvas.hidden = !show; }
      if (!show) return;
      u.uTime.value = u.uIn.value = t; u.uScroll.value = y; u.uVel.value = flow.vel; u.uHero.value = uHero; u.uEnd.value = uEnd;
      if (heroOn) { const r = h1.getBoundingClientRect(); u.uNameO.value.set(r.left, r.top); }
      const px = ptr.x, py = ptr.y;
      ptr.x += (ptr.tx - ptr.x) * 0.2; ptr.y += (ptr.ty - ptr.y) * 0.2; ptr.on += (ptr.ton - ptr.on) * 0.1;
      u.uMouse.value.set(ptr.x, ptr.y); u.uMouseV.value.set(ptr.x - px, ptr.y - py); u.uPush.value = ptr.on;
      u.uLook.value.set((ptr.x / W - 0.5) * 2 * ptr.on, (ptr.y / H - 0.5) * 2 * ptr.on);
      renderer.render(scene, camera);
    });

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
    addEventListener('litechange', () => points && build());
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
      build();
      try { await renderer.compileAsync(scene, camera); } catch (e) { /* 지원하지 않으면 첫 프레임에 컴파일 */ }
      started = performance.now();
      return total;
    }).catch(() => { html.classList.remove('gl-hero'); return 0; }); // 글자를 뽑지 못하면 원래 글자로
  }

  // Lenis가 스크롤을 옮긴 뒤 같은 프레임에 그림 (gsap이 없으면 따로 돎)
  const tick = () => { if (!document.hidden) for (const f of steps) f(); };
  if (window.gsap) gsap.ticker.add(tick);
  else { const loop = () => { tick(); requestAnimationFrame(loop); }; loop(); }
}
