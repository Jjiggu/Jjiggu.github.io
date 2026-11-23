/* global gsap, ScrollTrigger, SplitText, Flip, CustomEase */
/* 화면 연출 모음. main.js 가 내용을 그리고 기본 모션을 붙인 뒤에 얹습니다.
   쓰는 것: GSAP ScrollTrigger · SplitText · Flip · CustomEase (모두 gsap 3.15, 무료), Lenis, View Transitions API(main.js).
   모션 줄이기 환경이나 gsap 이 없을 때는 1~3번(길잡이·이미지 크게 보기)만 움직임 없이 동작합니다. */
(() => {
  const D = window.DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motion = !reduce && !!window.gsap;

  /* ───────── 1. 대표 수치 띠 (내용) ───────── */
  const heads = D.projects.filter((p) => p.headline);
  const bandItems = heads.map((p) => `<span class="band__item"><em>${esc(p.name)}</em><b class="num">${p.headline.a ? `<s>${p.headline.a}</s>` : ''}${p.headline.b}<small>${p.headline.unit}</small></b></span>`).join('');
  $('.band__track').innerHTML = bandItems + bandItems; // 두 벌을 이어 붙여 끊김 없이 돎

  /* ───────── 2. 길잡이: 메뉴의 현재 위치 표시 + 오른쪽 프로젝트 목차 ───────── */
  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', '경력·프로젝트 바로가기');
  rail.innerHTML = D.projects.map((p) => `<a href="#${p.id}"><span>${esc(p.name)}</span><i></i></a>`).join('');
  document.body.append(rail);

  const navBox = $('.nav nav'), pill = $('.nav__pill');
  const navLinks = $$('a', navBox), navSecs = navLinks.map((a) => $(a.getAttribute('href')));
  const railLinks = $$('a', rail), projSecs = D.projects.map((p) => document.getElementById(p.id));
  let navOn = -2, projOn = -2;
  const movePill = () => {
    const a = navLinks[navOn];
    pill.style.opacity = a ? 1 : 0;
    if (a) { pill.style.width = a.offsetWidth + 'px'; pill.style.transform = `translateX(${a.offsetLeft}px)`; }
  };
  // 화면 가운데 선에 걸친 구간을 IntersectionObserver 로 받음 (스크롤 프레임마다 위치를 재지 않음)
  const html = document.documentElement, isLite = () => html.classList.contains('lite');
  const setNav = (n) => { if (n === navOn) return; navOn = n; navLinks.forEach((a, i) => (i === n ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'))); movePill(); };
  const setProj = (p) => { if (p === projOn) return; projOn = p; rail.classList.toggle('is-on', p >= 0); railLinks.forEach((a, i) => a.classList.toggle('is-on', i === p)); };
  const midline = (els, on) => { const io = new IntersectionObserver((es) => es.forEach((e) => on(els.indexOf(e.target), e.isIntersecting)), { rootMargin: '-50% 0px -50% 0px' }); els.forEach((e) => io.observe(e)); };
  const intro = [$('.hero'), $('.say')]; // 이 구간에서는 메뉴 표시 없음
  midline([...navSecs.slice(0, -1), ...intro], (i, on) => { if (on) setNav(i < navSecs.length - 1 ? i : -1); });
  midline(projSecs, (i, on) => { if (on) setProj(i); else if (projOn === i) setProj(-1); });
  // Contact 는 화면 가운데까지 못 올라오므로 맨 아랫줄이 보이면 켬
  new IntersectionObserver(([e]) => { if (e.isIntersecting) setNav(navSecs.length - 1); else if (navOn === navSecs.length - 1) setNav(navSecs.length - 2); }).observe($('.foot__base'));
  addEventListener('resize', movePill);
  document.fonts.ready.then(movePill);

  /* ───────── 3. 이미지 크게 보기 (GSAP Flip) ─────────
     본문 속 그림이 제자리에서 화면 가득 커졌다가 돌아갑니다. Cmd/Ctrl 클릭은 그대로 새 탭. */
  let lightbox = null;
  function openLightbox(a) {
    const src = $('img', a);
    const box = document.createElement('div');
    box.className = 'lb';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '이미지 크게 보기');
    box.innerHTML = `<div class="lb__bg"></div><img class="lb__img" width="${src.getAttribute('width')}" height="${src.getAttribute('height')}">
      <div class="lb__bar"><a href="${a.getAttribute('href')}" target="_blank" rel="noopener">원본 새 탭으로 열기 ↗</a><button type="button" class="lb__x">닫기 ✕</button></div>`;
    const img = $('.lb__img', box), fade = $$('.lb__bg, .lb__bar', box), others = $$('main, .nav, .foot, .rail');
    img.alt = src.alt; img.src = src.currentSrc || src.src;
    document.body.append(box);
    others.forEach((el) => (el.inert = true));
    window.lenis?.stop();
    const anim = motion && window.Flip;
    let closing = false;
    const done = () => {
      src.style.visibility = ''; box.remove(); lightbox = null;
      others.forEach((el) => (el.inert = false));
      window.lenis?.start();
      a.focus({ preventScroll: true });
    };
    const close = () => {
      if (closing) return;
      closing = true;
      if (!anim) return done();
      gsap.to(fade, { opacity: 0, duration: 0.3 });
      Flip.fit(img, src, { scale: true, duration: 0.55, ease: 'power3.inOut', onComplete: done });
    };
    lightbox = { close };
    box.addEventListener('click', (e) => { if (!e.target.closest('.lb__bar a')) close(); });
    $('.lb__x', box).focus();
    if (anim) {
      Flip.fit(img, src, { scale: true });  // 본문 그림 자리·크기에 겹쳐 놓고
      src.style.visibility = 'hidden';
      gsap.to(img, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.7, ease: 'power4.inOut' }); // 제자리(화면 가운데)로 키움
      gsap.from(fade, { opacity: 0, duration: 0.4 });
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.ev__zoom');
    if (!a || lightbox || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    openLightbox(a);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox?.close(); });

  if (!motion) return;
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase);
  CustomEase.create('curtain', '0.76, 0, 0.24, 1');

  /* ───────── 4. 인트로: 숫자가 100 까지 오르고 막이 걷힘 ───────── */
  const introEl = $('.intro');
  if (document.documentElement.classList.contains('is-intro')) {
    window.fxIntro = true; // index.html 의 4초 안전장치가 막을 강제로 걷지 않게
    try { sessionStorage.setItem('intro', '1'); } catch (e) { /* 저장이 막혀도 재생은 됨 */ }
    const n = $('#intro-count'), o = { v: 0 };
    const count = gsap.timeline()
      .to(o, { v: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: () => (n.textContent = Math.round(o.v)) })
      .to('.intro__bar i', { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, 0);
    const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    Promise.all([count, fonts]).then(() => {
      gsap.timeline({ onComplete: () => { introEl.remove(); document.documentElement.classList.remove('is-intro'); } })
        .to('.intro__in > *', { yPercent: -120, opacity: 0, duration: 0.45, stagger: 0.05, ease: 'power3.in' })
        .call(window.introGo, null, 0.3)               // 막이 걷히기 시작할 때 첫 화면 모션 출발
        .to(introEl, { yPercent: -100, duration: 0.9, ease: 'curtain' }, 0.3);
    });
  } else introEl.remove();

  /* ───────── 5. 나머지: main.js 의 고정 구간이 자리 잡은 뒤 ───────── */
  const start = () => {
    const mm = gsap.matchMedia();

    // 첫 화면: 마우스를 따라오는 빛, 스크롤하면 글이 먼저 물러남
    const hero = $('.hero'), glow = $('.hero__glow');
    if (fine) {
      const gx = gsap.quickTo(glow, 'x', { duration: 1.2, ease: 'power3' }), gy = gsap.quickTo(glow, 'y', { duration: 1.2, ease: 'power3' });
      hero.addEventListener('pointermove', (e) => { if (isLite()) return; const r = hero.getBoundingClientRect(); gx(e.clientX - r.left - r.width * 0.7); gy(e.clientY - r.top - r.height * 0.25); });
    }
    gsap.to('.hero__in', { y: -90, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 35%', scrub: true } });
    gsap.to('.hero__cue', { opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '+=160', scrub: true } });

    // 소개: 스크롤에 맞춰 단어가 차례로 또렷해짐
    const say = $('#intro');
    gsap.from('.say .eyebrow', { opacity: 0, y: 20, duration: 0.8, scrollTrigger: { trigger: '.say', start: 'top 75%', once: true } });
    SplitText.create(say, {
      type: 'words', autoSplit: true,
      onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.13 }, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: say, start: 'top 80%', end: 'bottom 48%', scrub: 0.4 } }),
    });

    // 섹션 번호를 크게 깔고 스크롤과 어긋나게 움직임
    $$('.block > .sec-head').forEach((h) => {
      const ghost = Object.assign(document.createElement('span'), { className: 'sec-ghost num', textContent: $('.num', h).textContent });
      ghost.setAttribute('aria-hidden', 'true');
      h.append(ghost);
      gsap.fromTo(ghost, { yPercent: 35 }, { yPercent: -35, ease: 'none', scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // 한눈에 보기 카드: 마우스 쪽으로 기울고 빛이 따라옴
    if (fine) $$('.panel').forEach((p) => {
      gsap.set(p, { transformPerspective: 900 });
      const rx = gsap.quickTo(p, 'rotationX', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(p, 'rotationY', { duration: 0.5, ease: 'power3' });
      p.addEventListener('pointermove', (e) => {
        if (isLite()) return;
        const r = p.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 7); rx((0.5 - py) * 5);
        p.style.setProperty('--mx', px * 100 + '%'); p.style.setProperty('--my', py * 100 + '%');
      });
      p.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });

    // 근거 이미지: 위에서 아래로 열림
    $$('.ev__zoom img').forEach((img) => gsap.fromTo(img, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'curtain', scrollTrigger: { trigger: img.parentElement, start: 'top 85%', once: true } }));

    // 줄 단위 목록(교육·자격, 그 밖의 작업): 화면에 들어온 것끼리 묶어 차례로
    const rows = $$('#edu .row, .more__item');
    gsap.set(rows, { opacity: 0, y: 36 });
    ScrollTrigger.batch(rows, { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }) });

    // 대표 수치 띠: 계속 흐르다가 스크롤이 빠를수록 빨라지고 기울어짐
    const band = $('#band'), track = $('.band__track');
    const loop = gsap.to(track, { xPercent: -50, repeat: -1, duration: 38, ease: 'none', paused: true });
    const skew = gsap.quickTo(track, 'skewX', { duration: 0.4, ease: 'power3' });
    ScrollTrigger.create({
      trigger: band, start: 'top bottom', end: 'bottom top',
      onToggle: (s) => loop.paused(!s.isActive),
      onUpdate: (s) => {
        const v = s.getVelocity();
        skew(gsap.utils.clamp(-14, 14, v / -180));
        gsap.to(loop, { timeScale: gsap.utils.clamp(1, 8, Math.abs(v) / 220), duration: 0.2, overwrite: true, onComplete: () => { gsap.to(loop, { timeScale: 1, duration: 1 }); skew(0); } });
      },
    });

    // Contact: 아래에 깔려 있다가 드러남 + 메일 글자가 마우스 가까울수록 굵어짐(가변 글꼴 wght)
    const foot = $('.foot'), mail = $('#foot-mail');
    mm.add('(min-width: 900px)', () => { gsap.from('.foot__main', { yPercent: -45, ease: 'none', scrollTrigger: { trigger: foot, start: 'top bottom', end: 'bottom bottom', scrub: true } }); });
    const chars = SplitText.create(mail, { type: 'chars', mask: 'chars' }).chars;
    gsap.from(chars, { yPercent: 110, duration: 0.9, stagger: 0.025, ease: 'power4.out', scrollTrigger: { trigger: mail, start: 'top 95%', once: true } });
    if (fine) {
      mail.classList.add('is-live');
      // 글자 위치는 들어올 때 한 번만 재고(굵기가 바뀌어도 가운데는 거의 그대로), 굵기 계산은 프레임당 한 번
      let pts = null, mx = 0, my = 0, queued = false;
      const tos = chars.map((c) => gsap.quickTo(c, 'fontWeight', { duration: 0.35, ease: 'power2' }));
      const measure = () => { pts = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2 + scrollY]; }); };
      const weigh = () => { queued = false; if (pts) pts.forEach(([x, y], i) => tos[i](Math.round(gsap.utils.mapRange(0, 320, 900, 260, Math.min(Math.hypot(mx - x, my + scrollY - y), 320))))); };
      foot.addEventListener('pointerenter', measure);
      addEventListener('resize', () => (pts = null));
      foot.addEventListener('pointermove', (e) => { if (isLite()) return; if (!pts) measure(); mx = e.clientX; my = e.clientY; if (!queued) { queued = true; requestAnimationFrame(weigh); } });
      foot.addEventListener('pointerleave', () => tos.forEach((to) => to(260)));
    }

    // 커서: 눌러 볼 수 있는 큰 대상 위에서는 무엇을 하는지 글로 알려 줌
    if (fine) {
      const cur = $('.cursor'), label = $('span', cur);
      document.addEventListener('pointerover', (e) => {
        const t = e.target.closest('.ev__zoom, .panel');
        label.textContent = t ? (t.matches('.panel') ? '보기' : '확대') : '';
        cur.classList.toggle('label', !!t);
      });
    }

    ScrollTrigger.refresh();

    // 느린 기기 감지: 프레임 간격의 중앙값이 25ms(약 40fps)를 넘으면 가벼운 모드로 바꿈. 처음 한 번, 첫 스크롤 때 한 번
    const goLite = () => { if (isLite()) return; html.classList.add('lite'); gsap.set('.panel', { rotationX: 0, rotationY: 0 }); gsap.set('#foot-mail *', { clearProps: 'fontWeight' }); dispatchEvent(new Event('litechange')); };
    const probe = () => {
      if (isLite()) return;
      const ds = []; let last = 0;
      const f = (now) => {
        if (document.visibilityState !== 'visible') return; // 가려진 탭은 프레임이 느려지므로 재지 않음
        if (last) ds.push(now - last);
        last = now;
        if (ds.length < 60) return requestAnimationFrame(f);
        if (ds.sort((x, y) => x - y)[30] > 25) goLite();
      };
      requestAnimationFrame(f);
    };
    setTimeout(probe, 2000); // 첫 화면 등장 모션이 끝난 뒤
    addEventListener('scroll', probe, { once: true, passive: true });
  };
  if (window.motionReady) start(); else addEventListener('motionready', start, { once: true });
})();
