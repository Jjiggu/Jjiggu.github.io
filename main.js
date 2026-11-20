/* global gsap, ScrollTrigger, SplitText, Lenis */
(() => {
  const D = window.DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
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
  const list = (items) =>
    `<ul>${items
      .map((it) => (typeof it === 'string' ? `<li>${esc(it)}</li>` : `<li class="grp"><strong>${esc(it.h)}</strong>${list(it.items)}</li>`))
      .join('')}</ul>`;

  const metric = (m) => {
    const max = m.bar ? Math.max(...m.bar) : 0;
    const w = (v) => Math.max((v / max) * 100, 0.8).toFixed(2) + '%';
    return `<li class="metric${(m.a || '').length + m.b.length > 9 ? ' metric--wide' : ''}">
      <div class="metric__val num">${m.a ? `<s>${m.a}</s>` : ''}<b data-count data-from="${m.a || ''}">${m.b}</b><span>${m.unit}</span></div>
      ${m.bar ? `<div class="bars" aria-hidden="true"><i style="--w:${w(m.bar[0])}"></i><i style="--w:${w(m.bar[1])}"></i></div>` : ''}
      <p>${esc(m.label)}</p></li>`;
  };

  const phase = (title, items, mod = '') => `<section class="phase ${mod}"><h4>${title}</h4>${list(items)}</section>`;

  $('#role').textContent = D.role;
  $('#name').textContent = D.name;
  $('#foot-name').textContent = D.name;
  $('#intro').textContent = D.intro;
  $('#nav').innerHTML =
    `<a href="#impact">결과 요약</a>` + D.projects.map((p) => `<a href="#${p.id}">${esc(p.name)}</a>`).join('');
  $('#marquee').innerHTML = [...D.stack, ...D.stack].map((s) => `<span>${esc(s)}</span>`).join('');

  $('#impact-track').innerHTML = D.impact
    .map(
      (m, i) => `<article class="panel">
        <p class="panel__label">${esc(m.label)}</p>
        <span class="panel__idx num">${i + 1} / ${D.impact.length}</span>
        <div class="panel__fig num">${m.a ? `<s>${m.a}</s>` : ''}<div><b data-count data-from="${m.a}">${m.b}</b><span>${m.unit}</span></div></div>
        <p class="panel__note">${esc(m.note)}</p>
      </article>`
    )
    .join('');

  $('#work').innerHTML = D.projects
    .map(
      (p) => `<section class="project" id="${p.id}">
        <header class="project__head">
          <h2 class="project__name${p.name.length > 8 ? ' is-long' : ''}">${esc(p.name)}</h2>
          <p class="project__sub">${esc(p.sub)}</p>
          <p class="project__period num">${p.period}</p>
          <div class="project__rule"></div>
        </header>
        ${p.cases
          .map(
            (c) => `<article class="case">
              <div class="case__aside">
                <h3 class="case__title">${esc(c.title)}</h3>
                <ul class="metrics">${c.metrics.map(metric).join('')}</ul>
              </div>
              <div class="case__body">
                <div class="case__rail" aria-hidden="true"><i></i></div>
                ${phase('문제 정의', c.problem)}${phase('해결 과정', c.solution)}${phase('결과', c.result, 'phase--result')}
              </div>
            </article>`
          )
          .join('')}
      </section>`
    )
    .join('');

  /* 모션을 줄이도록 설정한 환경: 내용만 그대로 보여 주고 끝 */
  if (reduce || !window.gsap) {
    $('#gate')?.remove();
    return; // 시뮬레이션은 자동 재생 없이, 방식을 누를 때만 실행
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ───────── 2. 부드러운 스크롤 (Lenis ↔ ScrollTrigger) ───────── */
  const lenis = new Lenis({ anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  window.scrollTo(0, 0);

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

  /* ───────── 4. 나머지 모션은 폰트가 준비된 뒤 ───────── */
  const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  fonts.then(() => {
    // 이벤트 대기 화면: 카운트다운 → 버튼 → 히어로(내 요청이 Redis Streams 를 거쳐 DB 로)
    const name = SplitText.create('#name', { type: 'chars', mask: 'chars' });
    const gate = $('#gate'), btn = $('#gate-btn'), secEl = $('#gate-sec'), waitEl = $('#gate-wait');
    const crowd = (() => { // 같이 기다리는 999명: 화면 밖에서 모여들어 버튼 주위를 맴돎
      const cv = $('#gate-crowd'), ctx = cv.getContext('2d'), N = 999, t0 = performance.now();
      const ps = Array.from({ length: N }, (_, i) => ({ a: Math.random() * 6.283, r: 0.18 + Math.random() * 0.5, sp: (Math.random() - 0.5) * 0.5, born: (i / N) * 4600 + Math.random() * 300, x: 0, y: 0, on: false, s: 1 + Math.random() * 1.6 }));
      const st = { suck: 0, mx: -99, my: -99, alive: true, shown: 0 };
      let W = 0, H = 0;
      const fit = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
      fit(); addEventListener('resize', fit);
      gate.addEventListener('pointermove', (e) => { st.mx = e.clientX; st.my = e.clientY; });
      (function loop(now) {
        if (!st.alive) return;
        const el = now - t0, R = Math.max(W, H), b = btn.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        ctx.clearRect(0, 0, W, H);
        let shown = 0;
        for (const p of ps) {
          if (el < p.born) continue;
          if (!p.on) { p.on = true; p.x = cx + Math.cos(p.a) * R; p.y = cy + Math.sin(p.a) * R; }
          shown++;
          p.a += p.sp * 0.006;
          const rr = st.suck ? 0 : p.r * Math.min(W, H) * (0.7 + 0.08 * Math.sin(now / 900 + p.a * 3));
          let tx = cx + Math.cos(p.a) * rr * 1.5, ty = cy + Math.sin(p.a) * rr;
          const dx = p.x - st.mx, dy = p.y - st.my, d2 = dx * dx + dy * dy; // 마우스 근처에서는 비켜남
          if (!st.suck && d2 < 9000) { tx += dx * 0.6; ty += dy * 0.6; }
          const k = st.suck ? 0.16 : 0.035;
          p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
          ctx.globalAlpha = st.suck ? 0.9 : 0.55;
          ctx.fillStyle = '#eef0ff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
        }
        st.shown = shown;
        if (st.mx > 0 && !st.suck) { ctx.globalAlpha = 1; ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(st.mx, st.my, 5, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.mx, st.my, 13 + 3 * Math.sin(now / 160), 0, 6.283); ctx.stroke(); }
        waitEl.textContent = shown.toLocaleString('en-US');
        requestAnimationFrame(loop);
      })(performance.now());
      return st;
    })();

    const title = SplitText.create('#gate-title', { type: 'chars' });
    gsap.from(title.chars, { yPercent: 120, opacity: 0, duration: 0.7, stagger: 0.03, ease: 'power4.out' });
    gsap.from('.gate__tag, .gate__count, .gate__wait, .gate__btn, .gate__skip, .gate__by', { opacity: 0, y: 20, duration: 0.7, stagger: 0.07, delay: 0.25, ease: 'power3.out' });
    let left = 5, entered = false;
    const open = () => {
      btn.disabled = false;
      gate.classList.add('is-open');
      title.revert();
      gsap.to('#gate-title', { duration: 0.8, scrambleText: { text: '이벤트가 시작됐습니다', chars: '01', speed: 0.6 } });
      gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      btn.focus({ preventScroll: true });
    };
    const iv = setInterval(() => {
      left--;
      secEl.textContent = String(left).padStart(2, '0');
      gsap.fromTo(secEl, { yPercent: -45, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
      if (left <= 0) { clearInterval(iv); open(); }
    }, 1000);
    const enter = (me) => {
      if (entered) return;
      entered = true;
      clearInterval(iv);
      crowd.suck = me ? 1 : 0; // 버튼을 누르면 기다리던 요청이 한꺼번에 몰려 들어감
      gsap.timeline({ onComplete: () => { crowd.alive = false; gate.remove(); lenis.start(); window.Sim?.start({ me }); } })
        .to(btn, { scale: 0.94, duration: 0.12 })
        .to('.gate__in, .gate__by', { opacity: 0, scale: 1.05, duration: 0.45, ease: 'power2.in' }, me ? '+=0.25' : 0)
        .to(gate, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.1')
        .from(name.chars, { yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'power4.out' }, '-=0.45')
        .from('.hero__role, .hero__line, .sim, .dock, .nav', { opacity: 0, y: 24, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, '-=0.8');
    };
    btn.addEventListener('click', () => enter(true));
    $('#gate-skip').addEventListener('click', () => enter(false));

    // 내려갈 때 메뉴를 숨기고 올라갈 때 다시 보여 줌 (본문과 겹치지 않게)
    ScrollTrigger.create({ start: 80, end: 'max', onUpdate: (s) => gsap.to('.nav', { yPercent: s.direction === 1 ? -130 : 0, duration: 0.4, overwrite: true }), onLeaveBack: () => gsap.to('.nav', { yPercent: 0, duration: 0.4, overwrite: true }) });

    // 상단 진행 막대
    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    // 소개 문장: 스크롤에 맞춰 단어가 켜짐
    const intro = SplitText.create('#intro', { type: 'words' });
    gsap.fromTo(intro.words, { opacity: 0.14 }, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: '.intro', start: 'top 75%', end: 'bottom 55%', scrub: true },
    });

    // 결과 요약: 넓은 화면에서는 가로로 넘어감
    const mm = gsap.matchMedia();
    const sec = $('.impact'), track = $('#impact-track'), panels = $$('.panel');
    mm.add('(min-width: 900px)', () => {
      sec.classList.add('is-h');
      const dist = () => track.scrollWidth - innerWidth;
      const tw = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: sec, pin: true, scrub: 0.6, end: () => '+=' + dist(), invalidateOnRefresh: true },
      });
      panels.forEach((p, i) => {
        const run = () => countUp($('[data-count]', p));
        // 첫 패널은 가로 이동 전부터 보이므로 세로 기준으로 시작
        ScrollTrigger.create(i ? { trigger: p, containerAnimation: tw, start: 'left 65%', once: true, onEnter: run } : { trigger: sec, start: 'top 55%', once: true, onEnter: run });
        gsap.from($('.panel__fig', p), { xPercent: 12, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: tw, start: 'left right', end: 'left left', scrub: true } });
      });
      return () => sec.classList.remove('is-h');
    });
    mm.add('(max-width: 899px)', () => {
      panels.forEach((p) => ScrollTrigger.create({ trigger: p, start: 'top 75%', once: true, onEnter: () => countUp($('[data-count]', p)) }));
    });

    // 기술 스택 띠: 스크롤 속도·방향을 따라감
    const mq = gsap.to('#marquee', { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
    lenis.on('scroll', ({ velocity }) => {
      gsap.to(mq, { timeScale: (velocity < 0 ? -1 : 1) * (1 + Math.min(Math.abs(velocity) / 6, 6)), duration: 0.4, overwrite: true });
    });

    // 프로젝트 제목
    $$('.project__head').forEach((h) => {
      const st = { trigger: h, start: 'top 72%' };
      const split = SplitText.create($('.project__name', h), { type: 'words,chars', mask: 'chars' }); // 단어 단위로만 줄바꿈
      gsap.from(split.chars, { yPercent: 110, duration: 1, stagger: 0.035, ease: 'power4.out', scrollTrigger: st });
      gsap.from($('.project__rule', h), { scaleX: 0, duration: 1.4, ease: 'power4.inOut', scrollTrigger: st });
      gsap.from($$('.project__sub, .project__period', h), { opacity: 0, y: 20, duration: 0.8, delay: 0.3, scrollTrigger: st });
    });

    // 사례: 제목 줄 단위 등장, 수치 카운트, 막대, 진행 선
    $$('.case').forEach((c) => {
      const st = { trigger: c, start: 'top 78%', once: true };
      SplitText.create($('.case__title', c), {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (s) => gsap.from(s.lines, { yPercent: 105, duration: 0.9, stagger: 0.08, ease: 'power4.out', scrollTrigger: st }),
      });
      gsap.from($$('.metric', c), { opacity: 0, y: 28, duration: 0.8, stagger: 0.09, ease: 'power3.out', scrollTrigger: { ...st, onEnter: () => $$('[data-count]', c).forEach(countUp) } });
      gsap.from($$('.bars i', c), { scaleX: 0, duration: 1.3, stagger: 0.08, ease: 'power4.out', delay: 0.25, scrollTrigger: st });
      gsap.from($('.case__rail i', c), { scaleY: 0, ease: 'none', scrollTrigger: { trigger: $('.case__body', c), start: 'top 70%', end: 'bottom 70%', scrub: true } });
    });
    // 단계마다 따로 등장 (한꺼번에 건너뛰어도 밀리지 않게 묶지 않음)
    $$('.phase').forEach((ph) => gsap.from(ph, { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: ph, start: 'top 88%', once: true } }));

    // 푸터 이름
    const foot = SplitText.create('#foot-name', { type: 'chars', mask: 'chars' });
    gsap.from(foot.chars, { yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'power4.out', scrollTrigger: { trigger: '.foot', start: 'top 70%' } });

    // 커서 · 자석 버튼 (마우스가 있는 기기만)
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const cur = $('.cursor');
      const cx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
      const cy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
      addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); cur.classList.add('on'); });
      document.addEventListener('pointerover', (e) => cur.classList.toggle('big', !!e.target.closest('a, button, .metric, .panel__fig')));
      const btn = $('.totop');
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.35, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4 });
      });
      btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }));
    }

    ScrollTrigger.refresh();
  });
})();
