/* global gsap, ScrollTrigger, SplitText, CustomEase, Lenis */
(() => {
  const D = window.DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── 0. 다크 · 라이트 모드 ───────── */
  const themeBtn = $('#theme');
  const setTheme = (t, save) => {
    document.documentElement.dataset.theme = t;
    themeBtn.setAttribute('aria-label', t === 'light' ? '다크 모드로 바꾸기' : '라이트 모드로 바꾸기');
    if (save) { try { localStorage.setItem('theme', t); } catch (e) { /* file:// 에서 저장이 막혀도 전환은 됨 */ } }
    dispatchEvent(new Event('themechange')); // 캔버스·차트가 색을 다시 읽음
  };
  setTheme(document.documentElement.dataset.theme);
  themeBtn.addEventListener('click', () => {
    const next = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
    if (reduce || !document.startViewTransition) return next();
    // View Transitions API: 누른 버튼 자리에서 원이 퍼지며 새 테마가 덮음 (style.css의 ::view-transition-new)
    const r = themeBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const root = document.documentElement.style;
    root.setProperty('--vt-x', x + 'px'); root.setProperty('--vt-y', y + 'px');
    root.setProperty('--vt-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
    document.startViewTransition(next);
  });

  /* ───────── 1. 데이터 → 화면 ───────── */
  const PICK = { x: '제외', ok: '선택' };
  const list = (items) =>
    `<ul>${items
      .map((it) => (typeof it === 'string' ? `<li>${esc(it)}</li>`
        : `<li class="grp${it.pick ? ' is-' + it.pick : ''}"><strong>${it.pick ? `<em>${PICK[it.pick]}</em>` : ''}${esc(it.h)}</strong>${list(it.items)}</li>`))
      .join('')}</ul>`;

  // 이전 값에도 단위를 붙임 (단위가 이후 값과 다르면 data.js의 ua)
  const was = (m) => `<s>${m.a}${(m.ua ?? m.unit) && `<span>${m.ua ?? m.unit}</span>`}</s>`;
  const metric = (m) => {
    const max = m.bar ? Math.max(...m.bar) : 0;
    const w = (v) => Math.max((v / max) * 100, 0.8).toFixed(2) + '%';
    return `<li class="metric${(m.a || '').length + m.b.length > 12 ? ' metric--wide' : ''}">
      <div class="metric__val num">${m.a ? was(m) : ''}<b data-count data-from="${m.a || ''}">${m.b}</b><span>${m.unit}</span></div>
      ${m.bar ? `<div class="bars" aria-hidden="true"><i style="--w:${w(m.bar[0])}"></i><i style="--w:${w(m.bar[1])}"></i></div>` : ''}
      <p>${esc(m.label)}</p></li>`;
  };

  const phase = (title, items, mod = '') => (items ? `<section class="phase ${mod}"><h5>${title}</h5>${list(items)}</section>` : '');
  const chips = (xs) => `<ul class="chips">${xs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
  // 연락처 아이콘 (GitHub, LinkedIn은 Simple Icons, 메일과 전화는 Lucide 모양)
  const ICONS = {
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  };
  const linkList = (cs) => cs.filter((c) => c.href)
    .map((c) => `<li><a href="${c.href}" aria-label="${c.text ? `${c.label} ${c.text}` : c.label}" title="${c.text || c.label}"${c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${ICONS[c.icon]}</a></li>`).join('');
  const links = linkList(D.contact);

  $('#role').textContent = D.role;
  $('#name').innerHTML = D.name.split(' ').map(esc).join(' <br>'); // 이름 아래 성
  $('#line').textContent = D.line;
  $('#hero-links').innerHTML = links;
  $('#foot-links').innerHTML = links; // 첫 화면과 같은 아이콘 목록 (주소와 번호는 마우스를 올리면 보임)
  $('#foot-name').textContent = D.name; // 마지막 장면: 첫 화면의 이름을 그리던 점이 다시 모여 만드는 이름 (stream.js)

  // 한눈에 보기: 본문과 같은 순서, 카드마다 대표 수치 하나. 무엇에 대한 수치인지(label)를 숫자보다 먼저 보여 줌
  const heads = D.projects.flatMap((p) => [].concat(p.headline || []).map((h) => ({ p, h })));
  $('#overview-track').innerHTML = heads
    .map(({ p, h }, i) => `<a class="panel${p.accent ? ' has-accent' : ''}" href="#${p.id}"${p.accent ? ` style="--acc-d:${p.accent[0]};--acc-l:${p.accent[1]}"` : ''}>
        <p class="panel__top"><span>${esc(p.kind)}<span class="num">${p.period}</span></span><span class="num">${i + 1} / ${heads.length}</span></p>
        <h3 class="panel__name">${esc(p.name)}</h3>
        <p class="panel__label">${esc(h.label)}</p>
        <div class="panel__fig num">${h.a ? was(h) : '<s style="visibility:hidden" aria-hidden="true">0</s>' /* 이전 값이 없어도 큰 숫자 높이를 옆 카드와 맞춤 */}<div><b data-count data-from="${h.a || ''}">${h.b}</b><span>${h.unit}</span></div></div>
        <p class="panel__note">${esc(h.note)}</p>
        <span class="panel__more">자세히 보기 →</span>
      </a>`)
    .join('');

  const caseHtml = (c, i) => `<div class="case-wrap" data-case="${i}"><article class="case split">
      <div class="case__aside">
        <p class="case__no num">${String(i + 1).padStart(2, '0')}</p>
        <h4 class="case__title">${esc(c.title)}</h4>
        <ul class="metrics">${c.metrics.map(metric).join('')}</ul>
        ${c.metrics.some((m) => m.bar) ? '<p class="bars-key" aria-hidden="true"><i></i>이전 <i></i>이후</p>' : ''}
      </div>
      <div class="case__body">
        <div class="case__rail" aria-hidden="true"><i></i></div>
        ${phase('문제', c.problem)}${phase('해결 과정', c.solution)}${phase('결과', c.result, 'phase--result')}
      </div>
    </article></div>`;

  const moreHtml = (items) => `<section class="more">
      <h4 class="more__head">그 밖의 작업</h4>
      <ul>${items.map((m) => `<li class="more__item split">
        <div><p class="more__title">${esc(m.title)}</p>${m.metric ? `<p class="more__metric">${esc(m.metric)}</p>` : ''}</div>
        <div class="more__body">${m.text ? `<p>${esc(m.text)}</p>`
          : `${list(m.result)}<details class="more__detail"><summary>문제와 해결 과정 보기</summary>${phase('문제', m.problem)}${phase('해결 과정', m.solution)}</details>`}</div>
      </li>`).join('')}</ul>
    </section>`;

  // 표지: 프로젝트로 넘어갈 때 화면을 꽉 채우는 장면 (data.js의 cover)
  const coverHtml = (c) => `<div class="cover cover--${c.type}" data-type="${c.type}"${c.bg ? ` style="--cover-bg:${c.bg}"` : ''}>
      <div class="cover__stage"><div class="cover__frame">${c.type === 'crowd'
        ? `<canvas class="cover__crowd" aria-hidden="true"></canvas>
           <div class="cover__say"><p class="cover__kicker">${esc(c.kicker)}</p><p class="cover__big">${esc(c.big)}</p><p class="cover__small">${esc(c.small)}</p></div>
           ${c.gate ? `<div class="cover__gate">
             <p class="gate__tag">${esc(c.gate.tag)}</p>
             <p class="gate__title">${esc(c.gate.wait)}</p>
             <p class="gate__count num" aria-hidden="true"><span>00</span><i>:</i><span class="gate__sec">05</span></p>
             <p class="gate__left" aria-hidden="true"><small>${esc(c.gate.left)}</small><b class="num">${c.gate.stock.toLocaleString('en-US')}</b></p>
             <button type="button" class="gate__btn" disabled>${esc(c.gate.btn)}</button>
             <p class="gate__hint">${esc(c.gate.hint)}</p>
           </div>` : ''}`
        : `<img class="cover__img" src="${c.img}" alt="${esc(c.alt)}" width="${c.w}" height="${c.h}" loading="lazy" decoding="async">`}</div></div>
    </div>`;

  const projectHtml = (p) => `<section class="project${p.cases ? '' : ' project--compact'}${p.accent ? ' has-accent' : ''}" id="${p.id}"${p.accent ? ` style="--acc-d:${p.accent[0]};--acc-l:${p.accent[1]}"` : ''}>
      ${p.cover ? coverHtml(p.cover) : ''}
      ${p.demo === 'cover' ? '<div class="demo-slot"></div>' : ''}
      <header class="project__head">
        <p class="project__kind"><span>${esc(p.kind)}</span><span class="num">${p.period}</span></p>
        <h3 class="project__name">${esc(p.name)}</h3>
        ${p.sub || p.repo || p.facts || p.stack ? `<div class="split project__meta">
          <div>${p.sub ? `<p class="project__sub">${esc(p.sub)}</p>` : ''}${p.repo ? `<a class="project__repo" href="${p.repo}" target="_blank" rel="noopener">GitHub 레포 보기 ↗</a>` : ''}</div>
          ${p.facts || p.stack ? `<dl class="facts">${(p.facts || []).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}${p.stack ? `<div><dt>기술 스택</dt><dd>${chips(p.stack)}</dd></div>` : ''}</dl>` : ''}
        </div>` : ''}
        <div class="project__rule"></div>
      </header>
      <div class="project__lead"></div>
      ${(p.cases || []).map(caseHtml).join('')}
      ${p.points ? `<div class="row split"><p class="row__h">주요 업무</p><div class="phase">${list(p.points)}</div></div>` : ''}
      ${p.demo === true ? '<div class="demo-slot"></div>' : ''}
      ${p.more ? moreHtml(p.more) : ''}
    </section>`;

  $('#career-list').innerHTML = D.projects.filter((p) => p.group === 'career').map(projectHtml).join('');
  $('#project-list').innerHTML = D.projects.filter((p) => p.group === 'project').map(projectHtml).join('');
  $('#coupon .demo-slot').append($('#tpl-coupon-demo').content.cloneNode(true)); // sim.js가 이 다음에 그림

  // 쿠폰 표지의 이벤트 화면: 버튼을 누르면 바로 아래 시뮬레이션에서 내 요청을 Redis Streams로 흘려 보냄
  const gate = $('#coupon .cover__gate'), G = D.projects.find((p) => p.id === 'coupon').cover.gate;
  const sendMine = () => window.Sim?.play('stream');

  /* 모션을 줄이도록 설정한 환경: 내용만 그대로 보여 주고 끝 */
  if (reduce || !window.gsap) { // 시뮬레이션은 자동 재생 없이, 누를 때만 실행
    window.showHero?.(); clearTimeout(window.introTimer); // 첫 화면 연출 없이 바로 보여 줌
    if (gate) {
      const btn = $('.gate__btn', gate);
      gate.classList.add('is-open'); btn.disabled = false; $('.gate__title', gate).textContent = G.open; // 카운트다운과 재고 소진 없이 바로 열어 둠
      btn.addEventListener('click', () => { sendMine(); $('#coupon .cp').scrollIntoView(); });
    }
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  if (window.ScrambleTextPlugin) gsap.registerPlugin(ScrambleTextPlugin);
  // 이징은 두 가지만 씀 (style.css의 --settle, --swap과 같은 곡선). 등장은 전부 settle: 빠르게 와서 느리게 안착
  if (window.CustomEase) { gsap.registerPlugin(CustomEase); CustomEase.create('settle', '0.16, 1, 0.3, 1'); CustomEase.create('swap', '0.77, 0, 0.175, 1'); }
  const SETTLE = window.CustomEase ? 'settle' : 'expo.out', SWAP = window.CustomEase ? 'swap' : 'power4.inOut';

  /* ───────── 2. 부드러운 스크롤 (Lenis ↔ ScrollTrigger) ───────── */
  const lenis = new Lenis({ anchors: true }); // 고정 메뉴 높이는 style.css의 scroll-margin-top이 뺌 (브라우저 해시 이동과 같은 위치)
  window.lenis = lenis; // fx.js가 같은 스크롤을 씀
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ───────── 3. 숫자 카운트 ───────── */
  // 표시값은 원문 문자열 그대로 끝납니다. 범위(431~704)처럼 숫자가 아닌 값은 움직이지 않습니다.
  const isNum = (s) => /^[\d,]+(\.\d+)?$/.test(s);
  const toNum = (s) => parseFloat(s.replace(/,/g, ''));
  function countUp(el) {
    const txt = (el.dataset.to ||= el.textContent); // 다시 불려도(화면 폭 구간이 바뀔 때) 원문 값으로 끝남
    if (!isNum(txt)) return;
    const from = el.dataset.from;
    const dec = (txt.split('.')[1] || '').length;
    const o = { v: isNum(from) ? toNum(from) : 0 };
    let fin = false; // 끝난 뒤 matchMedia 구간이 바뀌며 트윈이 되감겨도 시작값을 다시 쓰지 않음
    gsap.to(o, {
      v: toNum(txt),
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => fin || (el.textContent = o.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })),
      onComplete: () => { fin = true; el.textContent = txt; },
    });
  }

  /* ───────── 4. 몰려드는 요청(점 무리) ─────────
     예전 첫 화면(쿠폰 이벤트 대기)의 점 무리. 쿠폰 표지에서 스크롤할수록 가운데로 빨려 듦.
     place(W, H) → { cx, cy, spread, alpha }, squeeze 0~1이 클수록 가운데로 모임. 마우스는 비켜 감. */
  function swarm(cv, place, N = 700) {
    const ctx = cv.getContext('2d'), t0 = performance.now();
    const ps = Array.from({ length: N }, (_, i) => ({ a: Math.random() * 6.283, r: 0.18 + Math.random() * 0.5, sp: (Math.random() - 0.5) * 0.5, born: (i / N) * 2600 + Math.random() * 300, x: 0, y: 0, on: false, s: 1 + Math.random() * 1.4 }));
    // focus: 모일 지점(없으면 place의 중심) / suck: 1 이면 focus 한 점으로 한꺼번에 빨려 듦 / me: 1 이면 focus에 '내 요청' 표시
    const st = { mx: -999, my: -999, on: true, color: '#9db0ff', sun: '#ffd84a', squeeze: 0, focus: null, suck: 0, me: 0 };
    const readColor = () => { const cs = getComputedStyle(cv); st.color = cs.getPropertyValue('--dot').trim() || st.color; st.sun = cs.getPropertyValue('--sun').trim() || st.sun; };
    readColor(); addEventListener('themechange', readColor);
    let W = 0, H = 0;
    const lite = () => document.documentElement.classList.contains('lite');
    const fit = () => { const d = lite() ? 1 : Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); new ResizeObserver(fit).observe(cv); addEventListener('litechange', fit);
    cv.parentElement.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); st.mx = e.clientX - r.left; st.my = e.clientY - r.top; });
    cv.parentElement.addEventListener('pointerleave', () => { st.mx = st.my = -999; });
    function loop(now) {
      if (!st.on) return;
      const el = now - t0, P = { ...place(W, H), ...(st.focus && { cx: st.focus.x, cy: st.focus.y }) }, R = Math.max(W, H);
      const k = st.suck ? 0 : 1 - 0.92 * st.squeeze, lerp = st.suck ? 0.14 : 0.035;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = st.color;
      ctx.globalAlpha = st.suck ? 0.9 : P.alpha;
      ctx.beginPath(); // 점 전체를 한 경로로 모아 한 번만 칠함 (점마다 fill 하면 1,000번 그리기 호출)
      const n = lite() ? Math.round(N * 0.45) : N;
      for (let i = 0; i < n; i++) {
        const p = ps[i];
        if (el < p.born) continue;
        if (!p.on) { p.on = true; p.x = P.cx + Math.cos(p.a) * R; p.y = P.cy + Math.sin(p.a) * R; }
        p.a += p.sp * 0.006 * (1 + 4 * st.squeeze); // 모일수록 빨리 돎
        const rr = p.r * P.spread * k * (0.7 + 0.08 * Math.sin(now / 900 + p.a * 3));
        let tx = P.cx + Math.cos(p.a) * rr * 1.4, ty = P.cy + Math.sin(p.a) * rr;
        const dx = p.x - st.mx, dy = p.y - st.my;
        if (dx * dx + dy * dy < 9000) { tx += dx * 0.6; ty += dy * 0.6; }
        p.x += (tx - p.x) * lerp; p.y += (ty - p.y) * lerp;
        ctx.moveTo(p.x + p.s, p.y); ctx.arc(p.x, p.y, p.s, 0, 6.283);
      }
      ctx.fill();
      if (st.me && st.focus) { // 내가 누른 요청: 시뮬레이션의 '내 요청' 표시와 같은 모양
        const { x, y } = st.focus, rr = 16 + 4 * Math.sin(now / 160);
        ctx.globalAlpha = 1; ctx.strokeStyle = ctx.fillStyle = st.sun; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke();
        ctx.font = '700 14px Pretendard, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(G.mine, x + rr + 8, y + 5);
      }
      requestAnimationFrame(loop);
    }
    // 화면 밖이면 멈춤
    new IntersectionObserver(([e]) => { const was = st.on; st.on = e.isIntersecting; if (st.on && !was) requestAnimationFrame(loop); }).observe(cv);
    requestAnimationFrame(loop);
    return st;
  }
  // 첫 화면의 이름은 stream.js(Three.js)가 점으로 그림
  const crowds = new Map($$('.cover__crowd').map((cv) => [cv, swarm(cv, (W, H) => ({ cx: W / 2, cy: H / 2, spread: Math.min(W * 0.42, H * 0.95), alpha: 0.6 }), 1000)]));

  const gateCtl = gate && (() => {
    /* 이벤트 한 판: 카운트다운 → 열림(남은 재고가 실측 소진 시간 동안 줄어듦) → 그 안에 누르면 접수(202), 못 누르면 매진(409) → 버튼이 이벤트를 다시 엶 */
    const btn = $('.gate__btn', gate), sec = $('.gate__sec', gate), title = $('.gate__title', gate), left = $('.gate__left b', gate), hint = $('.gate__hint', gate);
    const cvs = $('#coupon .cover__crowd'), sw = crowds.get(cvs);
    const say = (t) => gsap.to(title, { duration: 0.8, scrambleText: { text: t, chars: '01', speed: 0.6 } });
    let started = false, fired = false, drain = null;
    const over = (t, note) => { gate.classList.add('is-over'); say(t); hint.textContent = note; btn.textContent = G.retry; }; // 끝남: 접수됐거나 매진
    const open = () => {
      gate.classList.add('is-open'); btn.disabled = false; btn.removeAttribute('aria-disabled'); say(G.open);
      gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      const o = { v: G.stock };
      drain = gsap.to(o, { v: 0, duration: G.drain, ease: 'none', onUpdate: () => (left.textContent = Math.ceil(o.v).toLocaleString('en-US')), onComplete: () => over(G.soldout, G.fact) });
    };
    const count = (n) => { // n초 뒤에 엶
      sec.textContent = String(n).padStart(2, '0');
      const iv = setInterval(() => {
        sec.textContent = String(--n).padStart(2, '0');
        gsap.fromTo(sec, { yPercent: -45, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
        if (n <= 0) { clearInterval(iv); open(); }
      }, 1000);
    };
    btn.addEventListener('click', () => {
      if (fired || !gate.classList.contains('is-open')) return; // 열리기 전에는 눌러도 보내지 않음
      if (gate.classList.contains('is-over')) { // 다시 열기: 버튼은 그대로 두고(포커스 유지) 3초 뒤 새 이벤트
        gate.classList.remove('is-open', 'is-over'); btn.setAttribute('aria-disabled', 'true'); btn.textContent = G.btn;
        gsap.killTweensOf(title); title.textContent = G.wait; hint.textContent = G.hint; left.textContent = G.stock.toLocaleString('en-US');
        return count(3);
      }
      fired = true; drain.kill(); // 재고가 남아 있을 때 눌렀으니 접수. 남은 재고는 그 순간에 멈춤
      const b = btn.getBoundingClientRect(), c = cvs.getBoundingClientRect();
      Object.assign(sw, { focus: { x: b.left + b.width / 2 - c.left, y: b.top + b.height / 2 - c.top }, suck: 1, me: 1 }); // 기다리던 요청이 버튼 자리로 몰림
      btn.textContent = G.sent;
      sendMine();
      // 이벤트 화면을 잠깐 걷어 내 점과 '내 요청' 표시가 보이게 한 뒤, 바로 아래 시뮬레이션으로 내려감
      gsap.to(gate, { autoAlpha: 0, scale: 1.04, duration: 0.35, ease: 'power2.in' });
      // 요청 흐름 캔버스가 화면 아래쪽에 다 들어오게 (위로는 수치·판정이 보임)
      gsap.delayedCall(1.2, () => { const sim = $('#coupon .cp .sim'); lenis.scrollTo(sim, { offset: -Math.max(innerHeight - sim.offsetHeight - 24, 72), duration: 1.6 }); });
      gsap.delayedCall(4, () => {
        Object.assign(sw, { focus: null, suck: 0, me: 0 }); fired = false; over(G.done, G.hint);
        gsap.to(gate, { autoAlpha: 1, scale: 1, duration: 0.4 });
      });
    });
    return { start() { if (!started) { started = true; count(5); } } }; // 처음 보일 때 5초 카운트다운 (한 번만)
  })();

  /* ───────── 5. 나머지 모션은 폰트와 근거·데모가 모두 붙은 뒤 ───────── */
  const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  const domReady = new Promise((r) => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r) : r()));
  // stream.js(모듈이라 이 파일보다 늦게 실행됨)가 점의 자리를 다 뽑으면 그 수를, 못 쓰는 환경이면 0을 받음
  Promise.all([fonts, domReady]).then(() => (window.Stream ? window.Stream.ready : 0)).then((dots) => {
    /* 첫 화면: 주인공은 이름(점이 모여 만듦, stream.js). 역할은 먼저 조용히 켜지고, 한 줄 소개와 연락처는 이름이 자리 잡을 즈음 뒤따름.
       점으로 그리지 못하는 환경에서는 글자가 한 자씩 올라옴. 메뉴는 처음부터 보이고 눌림 */
    const gl = dots > 0 && document.documentElement.classList.contains('gl-hero');
    const T = gl ? window.Stream.intro : 0.9; // 이름이 자리 잡는 시각(초)
    const hero = gsap.timeline({ defaults: { ease: SETTLE } });
    hero.from('.hero__role', { opacity: 0, duration: 0.7, ease: 'none' }, 0.15);
    if (!gl) {
      const name = SplitText.create('#name', { type: 'chars', mask: 'chars' });
      hero.from(name.chars, { yPercent: 110, duration: 1.1, stagger: 0.08 }, 0);
    }
    SplitText.create('#line', { type: 'lines', mask: 'lines', autoSplit: true, onSplit: (s) => gsap.from(s.lines, { yPercent: 105, duration: 1, stagger: 0.12, ease: SETTLE, delay: Math.max(T - 0.9 - hero.time(), 0) }) });
    hero.from('#hero-links li', { opacity: 0, y: 16, duration: 0.7, stagger: { each: 0.09, ease: 'power1.in' } }, T - 0.65) // 뒤로 갈수록 간격이 좁아짐
      .from('.hero__cue', { opacity: 0, duration: 0.8, ease: 'none' }, T - 0.2);
    window.showHero?.(); clearTimeout(window.introTimer); // 시작 상태가 잡혔으니 가려 둔 것을 풂

    // 상단 진행 막대
    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    // 섹션 제목: 요청 하나(점)가 지나가며 선을 긋고(새 장), 번호가 켜지고, 제목이 단어째 흐릿한 데서 또렷하게 올라옴
    $$('.sec-head').forEach((h) => {
      const words = SplitText.create($('h2', h), { type: 'words', mask: 'words' }).words;
      gsap.timeline({ defaults: { ease: SETTLE }, scrollTrigger: { trigger: h, start: 'top 85%', once: true } })
        .fromTo(h, { '--rule': 0 }, { '--rule': 1, duration: 1.3, ease: SWAP }, 0)
        .fromTo(h, { '--tip': 0 }, { '--tip': 1, duration: 0.2, ease: 'none' }, 0)
        .to(h, { '--tip': 0, duration: 0.35, ease: 'none' }, 1.05)
        .from($('.num', h), { opacity: 0, duration: 0.6, ease: 'none' }, 0.1)
        .from(words, { yPercent: 110, duration: 0.9, stagger: 0.07 }, 0.15)
        .from($('h2', h), { filter: 'blur(8px)', duration: 0.9, clearProps: 'filter' }, 0.15);
    });

    // 한눈에 보기: 넓은 화면에서는 가로로 넘어감 (카드 폭 50vw → 한 화면 분량만 가로 이동)
    const mm = gsap.matchMedia();
    const sec = $('.overview'), track = $('#overview-track'), panels = $$('.panel');
    const settle = () => $$('[data-count]', sec).forEach((el) => { if (el.dataset.to) el.textContent = el.dataset.to; }); // 구간이 바뀔 때: 이미 센 수치는 최종값으로
    mm.add('(min-width: 900px)', () => {
      settle();
      sec.classList.add('is-h');
      const dist = () => Math.max(track.scrollWidth - track.clientWidth, 0);
      const tw = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', pin: true, anticipatePin: 1, scrub: 0.6, end: () => '+=' + dist(), invalidateOnRefresh: true },
      });
      panels.forEach((p, i) => {
        const run = () => countUp($('[data-count]', p));
        // 처음 두 장은 가로 이동 전부터 보이므로 세로 기준으로 시작
        ScrollTrigger.create(i > 1 ? { trigger: p, containerAnimation: tw, start: 'left 80%', once: true, onEnter: run } : { trigger: sec, start: 'top 60%', once: true, onEnter: run });
      });
      // 키보드로 화면 밖 카드에 포커스가 가면 그 카드가 보이는 세로 위치로 이동 (.overview는 overflow: clip이라 가로로 밀리지 않음)
      const onFocus = (e) => {
        const p = e.target.closest('.panel');
        if (!p || !e.target.matches(':focus-visible')) return;
        const x = p.getBoundingClientRect().left - track.getBoundingClientRect().left;
        lenis.scrollTo(tw.scrollTrigger.start + Math.min(x, dist()), { immediate: true });
      };
      track.addEventListener('focusin', onFocus);
      // 메뉴의 Summary: 아래에서 올라와도 가로 구간의 시작에 도착 (Lenis 기본 앵커는 끝 쪽에 멈춤)
      const toStart = (e) => { e.preventDefault(); e.stopPropagation(); lenis.scrollTo(tw.scrollTrigger.start); };
      const tops = $$('a[href="#overview"]');
      tops.forEach((a) => a.addEventListener('click', toStart));
      return () => { sec.classList.remove('is-h'); track.removeEventListener('focusin', onFocus); tops.forEach((a) => a.removeEventListener('click', toStart)); };
    });
    mm.add('(max-width: 899px)', () => {
      settle();
      panels.forEach((p) => ScrollTrigger.create({ trigger: p, start: 'top 80%', once: true, onEnter: () => countUp($('[data-count]', p)) }));
    });

    // 프로젝트 표지: 넓은 화면에서는 화면에 고정한 채 스크롤로 장면을 진행
    //  expand: 가운데 카드가 화면 가득 펼쳐짐 / pan: 화면 높이로 세운 긴 이미지가 옆으로 흐름 / crowd: 1,000개 점이 가운데로 빨려 듦
    $$('.cover').forEach((cv) => {
      const type = cv.dataset.type, stage = $('.cover__stage', cv), frame = $('.cover__frame', cv), img = $('.cover__img', cv), say = $('.cover__say', cv);
      const card = { clipPath: 'inset(13% 11% 13% 11% round 28px)' }, full = { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' };
      mm.add('(min-width: 900px)', () => {
        const pan = () => (img ? Math.max(img.offsetWidth - innerWidth, 0) : 0);
        const len = { pan: () => pan() + innerHeight * 0.4, crowd: () => innerHeight * (gate ? 2 : 0.9), expand: () => innerHeight * 0.9 }[type];
        // 표지가 화면을 다 덮은 동안에는 그 뒤의 점 캔버스(stream.js)를 그리지 않음 (expand·crowd는 1, pan은 0.25에서 다 펼쳐짐. 화면이 실제로 따라온 시점 기준)
        const fullAt = type === 'pan' ? 0.25 : 1, hide = (on) => { if (window.Stream) window.Stream.covered = on; };
        const tl = gsap.timeline({
          onUpdate() { hide(this.scrollTrigger.isActive && this.time() >= fullAt); },
          scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + len(), pin: true, anticipatePin: 1, scrub: 0.6, invalidateOnRefresh: true, onToggle: (self) => self.isActive || hide(false) },
        });
        // expand는 로고까지 든 키 비주얼이라 자르지 않고 카드째로 키움, 나머지는 잘린 카드가 열림
        if (type === 'expand') tl.fromTo(frame, { scale: 0.74, borderRadius: 28 }, { scale: 1, borderRadius: 0, ease: 'none', duration: 1 }, 0);
        else tl.fromTo(frame, card, { ...full, duration: type === 'pan' ? 0.25 : 1 }, 0);
        if (type === 'pan') tl.to(img, { x: () => -pan(), ease: 'none', duration: 1 }, 0.2);
        if (type === 'crowd') {
          const sw = crowds.get($('.cover__crowd', cv)), g = $('.cover__gate', cv);
          tl.to(sw, { squeeze: 1, ease: 'none', duration: 1 }, 0).from(say.children, { opacity: 0, y: 40, stagger: 0.15, duration: 0.4 }, 0.1);
          if (g) {
            gsap.set(g, { autoAlpha: 0 });
            tl.to(say, { autoAlpha: 0, y: -50, duration: 0.3 }, 1.15)            // 시나리오 문구가 빠지고
              .to(sw, { squeeze: 0.45, ease: 'none', duration: 0.4 }, 1.15)      // 점이 다시 퍼져 이벤트 화면을 둘러쌈
              .fromTo(g, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 1.3)
              .call(() => gateCtl?.start(), null, 1.45)                         // 이벤트 화면이 보이면 카운트다운
              .to({}, { duration: 0.4 });                                       // 누를 시간 동안 고정
          }
        }
        return () => hide(false); // 좁은 화면으로 바뀌어 고정이 풀리면 스트림을 다시 그림
      });
      mm.add('(max-width: 899px)', () => {
        gsap.fromTo(frame, { clipPath: 'inset(6% 6% 6% 6% round 20px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: frame, start: 'top 80%', once: true } });
        if (say) gsap.from(say.children, { opacity: 0, y: 30, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: frame, start: 'top 70%', once: true } });
        const g = $('.cover__gate', cv);
        if (g) ScrollTrigger.create({ trigger: g, start: 'top 75%', once: true, onEnter: () => gateCtl?.start() });
      });
    });

    // 프로젝트 제목
    $$('.project__head').forEach((h) => {
      const st = { trigger: h, start: 'top 78%', once: true };
      const split = SplitText.create($('.project__name', h), { type: 'words,chars', mask: 'chars' }); // 단어 단위로만 줄바꿈
      gsap.from(split.chars, { yPercent: 110, duration: 1, stagger: 0.03, ease: SETTLE, scrollTrigger: st });
      gsap.from($('.project__name', h), { filter: 'blur(8px)', duration: 0.9, ease: SETTLE, clearProps: 'filter', scrollTrigger: st }); // 흐릿한 데서 또렷하게 (글자마다가 아니라 제목 한 덩어리에 한 번)
      gsap.from($('.project__rule', h), { scaleX: 0, duration: 1.4, ease: SWAP, scrollTrigger: st });
      gsap.from($$('.project__kind, .project__meta', h), { opacity: 0, y: 20, duration: 0.8, delay: 0.25, stagger: 0.08, ease: SETTLE, scrollTrigger: st });
      // 소개 문장: 스크롤에 맞춰 어절이 차례로 또렷해짐 (옆 어절과 25% 겹침. 스크롤에 그대로 묶이므로 이징 없음)
      const sub = $('.project__sub', h);
      if (sub) gsap.fromTo(SplitText.create(sub, { type: 'words' }).words, { opacity: 0.25 }, { opacity: 1, duration: 1, stagger: 0.75, ease: 'none', scrollTrigger: { trigger: sub, start: 'top 88%', end: 'top 48%', scrub: true } });
    });

    // 사례: 제목 줄 단위 등장, 수치 카운트, 막대, 진행 선
    $$('.case').forEach((c) => {
      const st = { trigger: c, start: 'top 78%', once: true };
      SplitText.create($('.case__title', c), {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (s) => gsap.from(s.lines, { yPercent: 105, duration: 0.9, stagger: 0.08, ease: SETTLE, scrollTrigger: st }),
      });
      gsap.from($$('.metric', c), { opacity: 0, y: 28, duration: 0.8, stagger: 0.09, ease: SETTLE, scrollTrigger: { ...st, onEnter: () => $$('[data-count]', c).forEach(countUp) } });
      if ($('.bars', c)) gsap.from($$('.bars i', c), { scaleX: 0, duration: 1.3, stagger: 0.08, ease: SETTLE, delay: 0.25, scrollTrigger: st });
      gsap.from($('.case__rail i', c), { scaleY: 0, ease: 'none', scrollTrigger: { trigger: $('.case__body', c), start: 'top 70%', end: 'bottom 70%', scrub: true } });
    });
    // 단계마다 따로 등장 (한꺼번에 건너뛰어도 밀리지 않게 묶지 않음)
    $$('.case .phase').forEach((ph) => gsap.from(ph, { opacity: 0, y: 30, duration: 0.8, ease: SETTLE, scrollTrigger: { trigger: ph, start: 'top 88%', once: true } }));

    // 근거 그림: 위에서 아래로 열리고, 안의 그림은 조금 큰 데서 제 크기로 (한 번만. 화면 흐름 묶음은 evidence.js가 따로 등장시킴)
    $$('.ev__zoom').filter((a) => !a.closest('.flows') && $('img', a)).forEach((a) => {
      gsap.timeline({ scrollTrigger: { trigger: a, start: 'top 85%', once: true } })
        .fromTo(a, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: SWAP, clearProps: 'clipPath' })
        .fromTo($('img', a), { scale: 1.08 }, { scale: 1, duration: 1.3, ease: SETTLE, clearProps: 'transform' }, 0);
    });

    // Contact: 점으로 이름을 그리지 못하는 환경에서는 글자가 한 자씩 올라옴. 연락처는 뒤따라 등장
    const fst = { trigger: '.foot__main', start: 'top 70%', once: true };
    if (!gl) gsap.from(SplitText.create('#foot-name', { type: 'chars', mask: 'chars' }).chars, { yPercent: 110, duration: 1.1, stagger: 0.05, ease: SETTLE, scrollTrigger: fst });
    gsap.from('.foot__h, .foot .links li', { opacity: 0, y: 16, duration: 0.7, stagger: { each: 0.09, ease: 'power1.in' }, ease: SETTLE, scrollTrigger: fst });

    // 쿠폰 시뮬레이션: 화면에 처음 들어올 때 자동 재생 시작
    ScrollTrigger.create({ trigger: '.cp .sim', start: 'top 85%', once: true, onEnter: () => window.Sim?.start() });

    ScrollTrigger.refresh();
    document.addEventListener('toggle', () => ScrollTrigger.refresh(), true); // details를 열고 닫으면 본문 높이가 바뀌어 뒤쪽 고정 구간을 다시 계산
    window.motionReady = true; dispatchEvent(new Event('motionready')); // fx.js는 이 뒤에 붙음 (고정 구간 계산 순서)
  });
})();
