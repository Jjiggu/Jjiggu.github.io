/* global gsap, ScrollTrigger, SplitText, Lenis */
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
  themeBtn.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true));

  /* ───────── 1. 데이터 → 화면 ───────── */
  const PICK = { x: '제외', ok: '선택' };
  const list = (items) =>
    `<ul>${items
      .map((it) => (typeof it === 'string' ? `<li>${esc(it)}</li>`
        : `<li class="grp${it.pick ? ' is-' + it.pick : ''}"><strong>${it.pick ? `<em>${PICK[it.pick]}</em>` : ''}${esc(it.h)}</strong>${list(it.items)}</li>`))
      .join('')}</ul>`;

  const metric = (m) => {
    const max = m.bar ? Math.max(...m.bar) : 0;
    const w = (v) => Math.max((v / max) * 100, 0.8).toFixed(2) + '%';
    return `<li class="metric${(m.a || '').length + m.b.length > 12 ? ' metric--wide' : ''}">
      <div class="metric__val num">${m.a ? `<s>${m.a}</s>` : ''}<b data-count data-from="${m.a || ''}">${m.b}</b><span>${m.unit}</span></div>
      ${m.bar ? `<div class="bars" aria-hidden="true"><i style="--w:${w(m.bar[0])}"></i><i style="--w:${w(m.bar[1])}"></i></div>` : ''}
      <p>${esc(m.label)}</p></li>`;
  };

  const phase = (title, items, mod = '') => (items ? `<section class="phase ${mod}"><h5>${title}</h5>${list(items)}</section>` : '');
  const chips = (xs) => `<ul class="chips">${xs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
  // 연락처 아이콘 (GitHub · LinkedIn 은 Simple Icons, 메일은 Lucide 모양)
  const ICONS = {
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  };
  const links = D.contact.filter((c) => c.href)
    .map((c) => `<li><a href="${c.href}" aria-label="${c.label}" title="${c.label}"${c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${ICONS[c.icon]}</a></li>`).join('');
  const mail = D.contact.find((c) => c.icon === 'mail');

  $('#role').textContent = D.role;
  $('#name').textContent = D.name;
  $('#line').textContent = D.line;
  $('#intro').textContent = D.intro;
  $('#hero-links').innerHTML = links;
  $('#foot-links').innerHTML = links;
  Object.assign($('#foot-mail'), { href: mail.href, textContent: mail.text });

  // 한눈에 보기: 본문과 같은 순서, 카드마다 대표 수치 하나
  const heads = D.projects.filter((p) => p.headline);
  $('#overview-track').innerHTML = heads
    .map((p, i) => `<a class="panel" href="#${p.id}">
        <p class="panel__top"><span>${esc(p.kind)} · <span class="num">${p.period}</span></span><span class="num">${i + 1} / ${heads.length}</span></p>
        <h3 class="panel__name">${esc(p.name)}</h3>
        <div class="panel__fig num">${p.headline.a ? `<s>${p.headline.a}</s>` : ''}<div><b data-count data-from="${p.headline.a}">${p.headline.b}</b><span>${p.headline.unit}</span></div></div>
        <p class="panel__label">${esc(p.headline.label)}</p>
        <p class="panel__note">${esc(p.headline.note)}</p>
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

  // 표지: 프로젝트로 넘어갈 때 화면을 꽉 채우는 장면 (data.js 의 cover)
  const coverHtml = (c) => `<div class="cover cover--${c.type}" data-type="${c.type}"${c.bg ? ` style="--cover-bg:${c.bg}"` : ''}>
      <div class="cover__stage"><div class="cover__frame">${c.type === 'crowd'
        ? `<canvas class="cover__crowd" aria-hidden="true"></canvas><div class="cover__say"><p class="cover__big">${esc(c.big)}</p><p class="cover__small">${esc(c.small)}</p></div>`
        : `<img class="cover__img" src="${c.img}" alt="${esc(c.alt)}" width="${c.w}" height="${c.h}" loading="lazy" decoding="async">`}</div></div>
    </div>`;

  const projectHtml = (p) => `<section class="project${p.cases ? '' : ' project--compact'}" id="${p.id}">
      ${p.cover ? coverHtml(p.cover) : ''}
      <header class="project__head">
        <p class="project__kind"><span>${esc(p.kind)}</span><span class="num">${p.period}</span></p>
        <h3 class="project__name">${esc(p.name)}</h3>
        <div class="split project__meta">
          <div><p class="project__sub">${esc(p.sub)}</p>${p.repo ? `<a class="project__repo" href="${p.repo}" target="_blank" rel="noopener">GitHub 레포 보기 ↗</a>` : ''}</div>
          ${p.facts || p.stack ? `<dl class="facts">${(p.facts || []).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}${p.stack ? `<div><dt>기술 스택</dt><dd>${chips(p.stack)}</dd></div>` : ''}</dl>` : ''}
        </div>
        <div class="project__rule"></div>
      </header>
      <div class="project__lead">${p.demo === 'lead' ? '<div class="demo-slot"></div>' : ''}</div>
      ${(p.cases || []).map(caseHtml).join('')}
      ${p.points ? `<div class="row split"><p class="row__h">주요 업무</p><div class="phase">${list(p.points)}</div></div>` : ''}
      ${p.demo === true ? '<div class="demo-slot"></div>' : ''}
      ${p.more ? moreHtml(p.more) : ''}
    </section>`;

  $('#career-list').innerHTML = D.projects.filter((p) => p.group === 'career').map(projectHtml).join('');
  $('#project-list').innerHTML = D.projects.filter((p) => p.group === 'project').map(projectHtml).join('');
  $('#coupon .demo-slot').append($('#tpl-coupon-demo').content.cloneNode(true)); // sim.js 가 이 다음에 그림

  $('#edu-list').innerHTML = D.edu
    .map((g) => `<div class="row split"><h3 class="row__h">${g.h}</h3><ul class="edu__items">${g.items
      .map((it) => `<li><p class="edu__t"><b>${esc(it.t)}</b><span class="num">${it.p}</span></p>${it.d.map((x) => `<p>${esc(x)}</p>`).join('')}</li>`).join('')}</ul></div>`)
    .join('');

  /* 모션을 줄이도록 설정한 환경: 내용만 그대로 보여 주고 끝 */
  if (reduce || !window.gsap) return; // 시뮬레이션은 자동 재생 없이, 방식을 누를 때만 실행

  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ───────── 2. 부드러운 스크롤 (Lenis ↔ ScrollTrigger) ───────── */
  const lenis = new Lenis({ anchors: { offset: -64 } }); // 고정 메뉴 높이만큼 덜 내려감
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ───────── 3. 숫자 카운트 ───────── */
  // 표시값은 원문 문자열 그대로 끝납니다. 범위(431~704)처럼 숫자가 아닌 값은 움직이지 않습니다.
  const isNum = (s) => /^[\d,]+(\.\d+)?$/.test(s);
  const toNum = (s) => parseFloat(s.replace(/,/g, ''));
  function countUp(el) {
    const txt = el.textContent;
    if (!isNum(txt)) return;
    const from = el.dataset.from;
    const dec = (txt.split('.')[1] || '').length;
    const o = { v: isNum(from) ? toNum(from) : 0 };
    gsap.to(o, {
      v: toNum(txt),
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => (el.textContent = o.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })),
      onComplete: () => (el.textContent = txt),
    });
  }

  /* ───────── 4. 몰려드는 요청(점 무리) ─────────
     예전 첫 화면(쿠폰 이벤트 대기)의 점 무리. 히어로에서는 이름 오른쪽을 맴돌고, 쿠폰 표지에서는 스크롤할수록 가운데로 빨려 듦.
     place(W, H) → { cx, cy, spread, alpha }, squeeze 0~1 이 클수록 가운데로 모임. 마우스는 비켜 감. */
  function swarm(cv, place, N = 700) {
    const ctx = cv.getContext('2d'), t0 = performance.now();
    const ps = Array.from({ length: N }, (_, i) => ({ a: Math.random() * 6.283, r: 0.18 + Math.random() * 0.5, sp: (Math.random() - 0.5) * 0.5, born: (i / N) * 2600 + Math.random() * 300, x: 0, y: 0, on: false, s: 1 + Math.random() * 1.4 }));
    const st = { mx: -999, my: -999, on: true, color: '#9db0ff', squeeze: 0 };
    const readColor = () => { st.color = getComputedStyle(cv).getPropertyValue('--dot').trim() || st.color; };
    readColor(); addEventListener('themechange', readColor);
    let W = 0, H = 0;
    const fit = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); new ResizeObserver(fit).observe(cv);
    cv.parentElement.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); st.mx = e.clientX - r.left; st.my = e.clientY - r.top; });
    cv.parentElement.addEventListener('pointerleave', () => { st.mx = st.my = -999; });
    function loop(now) {
      if (!st.on) return;
      const el = now - t0, P = place(W, H), R = Math.max(W, H), k = 1 - 0.92 * st.squeeze;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = st.color;
      ctx.globalAlpha = P.alpha;
      for (const p of ps) {
        if (el < p.born) continue;
        if (!p.on) { p.on = true; p.x = P.cx + Math.cos(p.a) * R; p.y = P.cy + Math.sin(p.a) * R; }
        p.a += p.sp * 0.006 * (1 + 4 * st.squeeze); // 모일수록 빨리 돎
        const rr = p.r * P.spread * k * (0.7 + 0.08 * Math.sin(now / 900 + p.a * 3));
        let tx = P.cx + Math.cos(p.a) * rr * 1.4, ty = P.cy + Math.sin(p.a) * rr;
        const dx = p.x - st.mx, dy = p.y - st.my;
        if (dx * dx + dy * dy < 9000) { tx += dx * 0.6; ty += dy * 0.6; }
        p.x += (tx - p.x) * 0.035; p.y += (ty - p.y) * 0.035;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(loop);
    }
    // 화면 밖이면 멈춤
    new IntersectionObserver(([e]) => { const was = st.on; st.on = e.isIntersecting; if (st.on && !was) requestAnimationFrame(loop); }).observe(cv);
    requestAnimationFrame(loop);
    return st;
  }
  // 좁은 화면의 히어로에서는 글자 뒤로 지나가므로 옅게
  swarm($('#hero-crowd'), (W, H) => (W >= 900 ? { cx: W * 0.72, cy: H * 0.46, spread: Math.min(W * 0.45, H), alpha: 0.5 } : { cx: W * 0.5, cy: H * 0.3, spread: Math.min(W, H), alpha: 0.28 }));
  const crowds = new Map($$('.cover__crowd').map((cv) => [cv, swarm(cv, (W, H) => ({ cx: W / 2, cy: H / 2, spread: Math.min(W * 0.42, H * 0.95), alpha: 0.6 }), 1000)]));

  /* ───────── 5. 나머지 모션은 폰트와 근거·데모가 모두 붙은 뒤 ───────── */
  const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  const domReady = new Promise((r) => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r) : r()));
  Promise.all([fonts, domReady]).then(() => {
    const name = SplitText.create('#name', { type: 'chars', mask: 'chars' });
    gsap.timeline()
      .from(name.chars, { yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'power4.out' })
      .from('.hero__role, .hero__line, .hero__intro, #hero-links li, .nav', { opacity: 0, y: 24, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, '-=0.8');

    // 내려갈 때 메뉴를 숨기고 올라갈 때 다시 보여 줌 (본문과 겹치지 않게)
    ScrollTrigger.create({ start: 80, end: 'max', onUpdate: (s) => gsap.to('.nav', { yPercent: s.direction === 1 ? -130 : 0, duration: 0.4, overwrite: true }), onLeaveBack: () => gsap.to('.nav', { yPercent: 0, duration: 0.4, overwrite: true }) });

    // 상단 진행 막대
    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    // 섹션 제목
    $$('.sec-head').forEach((h) => gsap.from(h.children, { opacity: 0, y: 24, duration: 0.8, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } }));

    // 한눈에 보기: 넓은 화면에서는 가로로 넘어감 (카드 폭 50vw → 한 화면 분량만 가로 이동)
    const mm = gsap.matchMedia();
    const sec = $('.overview'), track = $('#overview-track'), panels = $$('.panel');
    mm.add('(min-width: 900px)', () => {
      sec.classList.add('is-h');
      const dist = () => Math.max(track.scrollWidth - track.clientWidth, 0);
      const tw = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', pin: true, scrub: 0.6, end: () => '+=' + dist(), invalidateOnRefresh: true },
      });
      panels.forEach((p, i) => {
        const run = () => countUp($('[data-count]', p));
        // 처음 두 장은 가로 이동 전부터 보이므로 세로 기준으로 시작
        ScrollTrigger.create(i > 1 ? { trigger: p, containerAnimation: tw, start: 'left 80%', once: true, onEnter: run } : { trigger: sec, start: 'top 60%', once: true, onEnter: run });
      });
      return () => sec.classList.remove('is-h');
    });
    mm.add('(max-width: 899px)', () => {
      panels.forEach((p) => ScrollTrigger.create({ trigger: p, start: 'top 80%', once: true, onEnter: () => countUp($('[data-count]', p)) }));
    });

    // 프로젝트 표지: 넓은 화면에서는 화면에 고정한 채 스크롤로 장면을 진행
    //  expand: 가운데 카드가 화면 가득 펼쳐짐 / pan: 화면 높이로 세운 긴 이미지가 옆으로 흐름 / crowd: 1,000개 점이 가운데로 빨려 듦
    $$('.cover').forEach((cv) => {
      const type = cv.dataset.type, stage = $('.cover__stage', cv), frame = $('.cover__frame', cv), img = $('.cover__img', cv), say = $('.cover__say', cv);
      const card = { clipPath: 'inset(13% 11% 13% 11% round 28px)' }, full = { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' };
      mm.add('(min-width: 900px)', () => {
        const pan = () => (img ? Math.max(img.offsetWidth - innerWidth, 0) : 0);
        const tl = gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + (type === 'pan' ? pan() + innerHeight * 0.4 : innerHeight * 0.9), pin: true, scrub: 0.6, invalidateOnRefresh: true } });
        // expand 는 로고까지 든 키 비주얼이라 자르지 않고 카드째로 키움, 나머지는 잘린 카드가 열림
        if (type === 'expand') tl.fromTo(frame, { scale: 0.74, borderRadius: 28 }, { scale: 1, borderRadius: 0, ease: 'none', duration: 1 }, 0);
        else tl.fromTo(frame, card, { ...full, duration: type === 'pan' ? 0.25 : 1 }, 0);
        if (type === 'pan') tl.to(img, { x: () => -pan(), ease: 'none', duration: 1 }, 0.2);
        if (type === 'crowd') tl.to(crowds.get($('.cover__crowd', cv)), { squeeze: 1, ease: 'none', duration: 1 }, 0).from(say.children, { opacity: 0, y: 40, stagger: 0.15, duration: 0.4 }, 0.1);
      });
      mm.add('(max-width: 899px)', () => {
        gsap.fromTo(frame, { clipPath: 'inset(6% 6% 6% 6% round 20px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: frame, start: 'top 80%', once: true } });
        if (say) gsap.from(say.children, { opacity: 0, y: 30, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: frame, start: 'top 70%', once: true } });
      });
    });

    // 프로젝트 제목
    $$('.project__head').forEach((h) => {
      const st = { trigger: h, start: 'top 78%', once: true };
      const split = SplitText.create($('.project__name', h), { type: 'words,chars', mask: 'chars' }); // 단어 단위로만 줄바꿈
      gsap.from(split.chars, { yPercent: 110, duration: 1, stagger: 0.03, ease: 'power4.out', scrollTrigger: st });
      gsap.from($('.project__rule', h), { scaleX: 0, duration: 1.4, ease: 'power4.inOut', scrollTrigger: st });
      gsap.from($$('.project__kind, .project__meta', h), { opacity: 0, y: 20, duration: 0.8, delay: 0.25, stagger: 0.08, scrollTrigger: st });
    });

    // 사례: 제목 줄 단위 등장, 수치 카운트, 막대, 진행 선
    $$('.case').forEach((c) => {
      const st = { trigger: c, start: 'top 78%', once: true };
      SplitText.create($('.case__title', c), {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (s) => gsap.from(s.lines, { yPercent: 105, duration: 0.9, stagger: 0.08, ease: 'power4.out', scrollTrigger: st }),
      });
      gsap.from($$('.metric', c), { opacity: 0, y: 28, duration: 0.8, stagger: 0.09, ease: 'power3.out', scrollTrigger: { ...st, onEnter: () => $$('[data-count]', c).forEach(countUp) } });
      if ($('.bars', c)) gsap.from($$('.bars i', c), { scaleX: 0, duration: 1.3, stagger: 0.08, ease: 'power4.out', delay: 0.25, scrollTrigger: st });
      gsap.from($('.case__rail i', c), { scaleY: 0, ease: 'none', scrollTrigger: { trigger: $('.case__body', c), start: 'top 70%', end: 'bottom 70%', scrub: true } });
    });
    // 단계마다 따로 등장 (한꺼번에 건너뛰어도 밀리지 않게 묶지 않음)
    $$('.case .phase').forEach((ph) => gsap.from(ph, { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: ph, start: 'top 88%', once: true } }));

    // 쿠폰 시뮬레이션: 화면에 처음 들어올 때 자동 재생 시작
    ScrollTrigger.create({ trigger: '.cp .sim', start: 'top 85%', once: true, onEnter: () => window.Sim?.start() });

    // 커서 · 자석 버튼 (마우스가 있는 기기만)
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const cur = $('.cursor');
      const cx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
      const cy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
      addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); cur.classList.add('on'); });
      document.addEventListener('pointerover', (e) => cur.classList.toggle('big', !!e.target.closest('a, button')));
      $$('.totop, .links a').forEach((btn) => {
        btn.addEventListener('pointermove', (e) => {
          const r = btn.getBoundingClientRect();
          gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4 });
        });
        btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }));
      });
    }

    ScrollTrigger.refresh();
  });
})();
