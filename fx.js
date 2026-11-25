/* global gsap, ScrollTrigger, SplitText, Flip */
/* 길잡이와 읽기 흐름. main.js가 내용을 그리고 기본 모션을 붙인 뒤에 얹습니다.
   여기 있는 것은 모두 용도가 있습니다: 지금 어디인지(메뉴 표시·오른쪽 목차), 어디서 온 그림인지(이미지 크게 보기),
   무엇부터 읽을지(줄 단위 등장). 꾸밈만을 위한 움직임은 두지 않습니다.
   모션 줄이기 환경이나 gsap이 없을 때는 1~2번이 움직임 없이 동작합니다. */
(() => {
  const D = window.DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reduce && !!window.gsap;

  /* ───────── 1. 길잡이: 메뉴의 현재 위치 표시 + 오른쪽 프로젝트 목차 ───────── */
  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', '경력과 프로젝트 바로가기');
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
  // 화면 가운데 선에 걸친 구간을 IntersectionObserver로 받음 (스크롤 프레임마다 위치를 재지 않음)
  const html = document.documentElement, isLite = () => html.classList.contains('lite');
  const setNav = (n) => { if (n === navOn) return; navOn = n; navLinks.forEach((a, i) => (i === n ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'))); movePill(); };
  // 목차와 진행 막대는 지금 읽는 프로젝트의 대표색을 따름 (프로젝트 밖에서는 기본 강조색)
  const tinted = [rail, $('.progress')];
  const tint = () => { const sec = projSecs[projOn], v = sec ? getComputedStyle(sec).getPropertyValue('--sun') : ''; tinted.forEach((el) => (v ? el.style.setProperty('--sun', v) : el.style.removeProperty('--sun'))); };
  addEventListener('themechange', tint);
  const setProj = (p) => { if (p === projOn) return; projOn = p; rail.classList.toggle('is-on', p >= 0); railLinks.forEach((a, i) => a.classList.toggle('is-on', i === p)); tint(); };
  const midline = (els, on) => { const io = new IntersectionObserver((es) => es.forEach((e) => on(els.indexOf(e.target), e.isIntersecting)), { rootMargin: '-50% 0px -50% 0px' }); els.forEach((e) => io.observe(e)); };
  midline([...navSecs.slice(0, -1), $('.hero')], // 첫 화면에서는 메뉴 표시 없음
    (i, on) => { if (on) setNav(i < navSecs.length - 1 ? i : -1); });
  midline(projSecs, (i, on) => { if (on) setProj(i); else if (projOn === i) setProj(-1); });
  // Contact는 화면 가운데까지 못 올라오므로 맨 아랫줄이 보이면 켬
  new IntersectionObserver(([e]) => { if (e.isIntersecting) setNav(navSecs.length - 1); else if (navOn === navSecs.length - 1) setNav(navSecs.length - 2); }).observe($('.foot__base'));
  addEventListener('resize', movePill);
  document.fonts.ready.then(movePill);

  /* ───────── 2. 이미지 크게 보기 (GSAP Flip) ─────────
     본문 속 그림이 제자리에서 커졌다가 돌아가, 어느 그림을 보고 있었는지 놓치지 않습니다. Cmd/Ctrl 클릭은 그대로 새 탭. */
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
      gsap.to(fade, { opacity: 0, duration: 0.25 });
      Flip.fit(img, src, { scale: true, duration: 0.35, ease: 'power2.inOut', onComplete: done });
    };
    lightbox = { close };
    box.addEventListener('click', (e) => { if (!e.target.closest('.lb__bar a')) close(); });
    $('.lb__x', box).focus();
    if (anim) {
      Flip.fit(img, src, { scale: true });  // 본문 그림 자리·크기에 겹쳐 놓고
      src.style.visibility = 'hidden';
      gsap.to(img, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.4, ease: 'power2.inOut' }); // 제자리(화면 가운데)로 키움
      gsap.from(fade, { opacity: 0, duration: 0.3 });
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
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

  /* ───────── 3. 읽기 흐름: main.js의 고정 구간이 자리 잡은 뒤 ───────── */
  const start = () => {
    // 첫 화면 글은 스크롤하면 물러나 다음 구역에 시선을 넘김
    gsap.to('.hero__in', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 35%', scrub: true } });
    gsap.to('.hero__cue', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=160', scrub: true } });

    // 줄 단위 목록(그 밖의 작업): 본문의 다른 등장(main.js의 섹션 제목)과 같은 값
    const rows = $$('.more__item');
    gsap.set(rows, { opacity: 0, y: 24 });
    ScrollTrigger.batch(rows, { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }) });

    ScrollTrigger.refresh();
    // 해시 주소(#gasip 등)로 들어온 경우: 고정 구간이 생겨 길이가 늘어난 뒤에 다시 그 위치로
    const to = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (to) window.lenis?.scrollTo(to, { immediate: true });

    // 느린 기기 감지: 프레임 간격의 중앙값이 25ms(약 40fps)를 넘으면 가벼운 모드로 바꿈. 처음 한 번, 첫 스크롤 때 한 번
    const goLite = () => { if (isLite()) return; html.classList.add('lite'); dispatchEvent(new Event('litechange')); };
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

// 첫 화면이 다 뜬 뒤, 아래쪽 이미지와 영상 정보를 미리 받아 둠 (스크롤해서 도착했을 때 빈 칸이 보이지 않게).
// 첫 화면을 그리는 동안에는 받지 않도록 load 이후로 미룸.
addEventListener('load', () => setTimeout(() => {
  document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
  document.querySelectorAll('video[preload="none"]').forEach((v) => (v.preload = 'metadata'));
}, 300));
