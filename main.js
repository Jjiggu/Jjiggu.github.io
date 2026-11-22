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
  const contacts = D.contact.filter((c) => c.href)
    .map((c) => `<li><a href="${c.href}"${c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span>${c.label}</span><b>${esc(c.text)}</b></a></li>`).join('');

  $('#role').textContent = D.role;
  $('#name').textContent = D.name;
  $('#line').textContent = D.line;
  $('#intro').textContent = D.intro;
  $('#foot-name').textContent = D.name;
  $('#hero-contact').innerHTML = contacts;
  $('#foot-contact').innerHTML = contacts;
  $('#marquee').innerHTML = [...D.stack, ...D.stack].map((s) => `<span>${esc(s)}</span>`).join('');

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

  $('#stack-groups').innerHTML = D.stackGroups
    .map((g) => `<div class="row split"><h3 class="row__h">${g.h}</h3><ul class="stack__items">${g.items
      .map(([n, ps]) => `<li><span>${esc(n)}</span><small>${ps.split(' ').map((id) => D.short[id]).join(' · ')}</small></li>`).join('')}</ul></div>`)
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

  const projectHtml = (p) => `<section class="project${p.cases ? '' : ' project--compact'}" id="${p.id}">
      <header class="project__head">
        <p class="project__kind"><span>${esc(p.kind)}</span><span class="num">${p.period}</span></p>
        <h3 class="project__name">${esc(p.name)}</h3>
        <div class="split project__meta">
          <div><p class="project__sub">${esc(p.sub)}</p>${p.repo ? `<a class="project__repo" href="${p.repo}" target="_blank" rel="noopener">GitHub 레포 보기 ↗</a>` : ''}</div>
          ${p.facts || p.stack ? `<dl class="facts">${(p.facts || []).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}${p.stack ? `<div><dt>기술 스택</dt><dd>${chips(p.stack)}</dd></div>` : ''}</dl>` : ''}
        </div>
        <div class="project__rule"></div>
      </header>
      <div class="project__lead"></div>
      ${(p.cases || []).map(caseHtml).join('')}
      ${p.points ? `<div class="row split"><p class="row__h">주요 업무</p><div class="phase">${list(p.points)}</div></div>` : ''}
      ${p.demo ? '<div class="demo-slot"></div>' : ''}
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

  /* ───────── 4. 히어로 배경: 몰려드는 요청 ─────────
     예전 첫 화면(쿠폰 이벤트 대기)의 점 무리. 이름 오른쪽 빈 곳을 맴돌고 마우스를 비켜 감. */
  (() => {
    const cv = $('#hero-crowd'), ctx = cv.getContext('2d'), N = 700, t0 = performance.now();
    const ps = Array.from({ length: N }, (_, i) => ({ a: Math.random() * 6.283, r: 0.18 + Math.random() * 0.5, sp: (Math.random() - 0.5) * 0.5, born: (i / N) * 2600 + Math.random() * 300, x: 0, y: 0, on: false, s: 1 + Math.random() * 1.4 }));
    const st = { mx: -999, my: -999, on: true, color: '#eef0ff' };
    const readColor = () => { st.color = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim(); };
    readColor(); addEventListener('themechange', readColor);
    let W = 0, H = 0;
    const fit = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener('resize', fit);
    cv.parentElement.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); st.mx = e.clientX - r.left; st.my = e.clientY - r.top; });
    cv.parentElement.addEventListener('pointerleave', () => { st.mx = st.my = -999; });
    function loop(now) {
      if (!st.on) return;
      const el = now - t0, wide = W >= 900, cx = W * (wide ? 0.72 : 0.5), cy = H * (wide ? 0.46 : 0.3), R = Math.max(W, H);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = st.color;
      ctx.globalAlpha = wide ? 0.5 : 0.28; // 좁은 화면에서는 글자 뒤로 지나가므로 옅게
      for (const p of ps) {
        if (el < p.born) continue;
        if (!p.on) { p.on = true; p.x = cx + Math.cos(p.a) * R; p.y = cy + Math.sin(p.a) * R; }
        p.a += p.sp * 0.006;
        const rr = p.r * Math.min(W * (wide ? 0.45 : 1), H) * (0.7 + 0.08 * Math.sin(now / 900 + p.a * 3));
        let tx = cx + Math.cos(p.a) * rr * 1.4, ty = cy + Math.sin(p.a) * rr;
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
  })();

  /* ───────── 5. 나머지 모션은 폰트와 근거·데모가 모두 붙은 뒤 ───────── */
  const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  const domReady = new Promise((r) => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r) : r()));
  Promise.all([fonts, domReady]).then(() => {
    const name = SplitText.create('#name', { type: 'chars', mask: 'chars' });
    gsap.timeline()
      .from(name.chars, { yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'power4.out' })
      .from('.hero__role, .hero__line, .hero__intro, #hero-contact li, .nav', { opacity: 0, y: 24, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, '-=0.8');

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

    // 기술 스택 띠: 스크롤 속도·방향을 따라감
    const mq = gsap.to('#marquee', { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
    lenis.on('scroll', ({ velocity }) => {
      gsap.to(mq, { timeScale: (velocity < 0 ? -1 : 1) * (1 + Math.min(Math.abs(velocity) / 6, 6)), duration: 0.4, overwrite: true });
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

    // 푸터 이름
    const foot = SplitText.create('#foot-name', { type: 'chars', mask: 'chars' });
    gsap.from(foot.chars, { yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'power4.out', scrollTrigger: { trigger: '.foot__name', start: 'top 90%' } });

    // 커서 · 자석 버튼 (마우스가 있는 기기만)
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const cur = $('.cursor');
      const cx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
      const cy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
      addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); cur.classList.add('on'); });
      document.addEventListener('pointerover', (e) => cur.classList.toggle('big', !!e.target.closest('a, button')));
      $$('.totop, .contact--big a').forEach((btn) => {
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
