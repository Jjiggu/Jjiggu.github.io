/* 레포에서 가져온 근거 자료(실측 차트 · 구성도)를 프로젝트 아래에 붙입니다.
   데이터는 data.js 의 project.evidence. gsap 없이도 동작합니다(모션 줄이기 환경 포함). */
(() => {
  const D = window.DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const C = {};
  const redraws = []; // 테마가 바뀌면 차트를 다시 그림
  const readTheme = () => { const v = getComputedStyle(document.documentElement), g = (n) => v.getPropertyValue(n).trim(); Object.assign(C, { ink: g('--ink'), mute: g('--mute'), navy: g('--navy') }); C.grid = C.ink + '1f'; };
  readTheme();
  const accent = (el) => getComputedStyle(el).getPropertyValue('--sun').trim(); // 차트가 놓인 프로젝트의 대표색
  addEventListener('themechange', () => { readTheme(); redraws.forEach((f) => f()); });
  const h = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
  };
  const s = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent?.appendChild(e);
    return e;
  };
  const fmt = (v) => v.toLocaleString('en-US');

  /* ── 툴팁 하나를 모든 차트가 같이 씀 ── */
  const tip = document.body.appendChild(h('div', { className: 'tip' }));
  const showTip = (e, title, rows) => {
    tip.replaceChildren(h('p', { className: 'tip__title', textContent: title }), ...rows.map(([color, name, value]) =>
      h('p', {}, color ? h('i', { style: `background:${color}` }) : null, h('b', { textContent: value }), h('span', { textContent: name }))));
    tip.classList.add('on');
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 8) + 'px';
    tip.style.top = Math.max(e.clientY - r.height - 14, 8) + 'px';
  };
  const hideTip = () => tip.classList.remove('on');

  // 폭이 바뀔 때만 다시 그림
  const responsive = (host, draw) => {
    let w = 0;
    const go = () => { if (host.clientWidth && host.clientWidth !== w) { w = host.clientWidth; draw(w); } };
    redraws.push(() => { if (w) draw(w); });
    go();
    new ResizeObserver(go).observe(host);
  };

  const tableView = (head, rows) =>
    h('details', { className: 'ev__table' }, h('summary', { textContent: '표로 보기' }),
      h('table', {}, h('thead', {}, h('tr', {}, head.map((t) => h('th', { textContent: t })))),
        h('tbody', {}, rows.map((r) => h('tr', {}, r.map((t) => h('td', { textContent: t })))))));

  /* ── 선 차트 (y축 하나, 계열 2개 이하) ── */
  function lineChart(c) {
    const host = h('div', { className: 'chart' });
    responsive(host, (W) => {
      const colors = [C.mute, accent(host)]; // 기준(이전) 계열은 회색, 결과 계열은 대표색
      const wide = W >= 560, H = Math.round(Math.max(250, Math.min(400, W * 0.5)));
      const m = { l: (c.yUnit || '').length > 1 ? 62 : 46, r: wide ? 24 : 12, t: 34, b: 44 };
      const xs = [...new Set(c.series.flatMap((se) => se.pts.map((p) => p[0])))].sort((a, b) => a - b);
      const [x0, x1] = c.xRange, y1 = c.yMax;
      const X = (v) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r), Y = (v) => H - m.b - (v / y1) * (H - m.t - m.b);
      host.querySelector('svg')?.remove();
      const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': c.title }, host);
      c.yTicks.forEach((t) => {
        s('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: C.grid }, svg);
        s('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'chart__tick' }, svg).textContent = t + (c.yUnit || '');
      });
      c.xTicks.filter((_, i) => wide || i % 2 === 0).forEach((t) => {
        s('text', { x: X(t), y: H - m.b + 18, 'text-anchor': 'middle', class: 'chart__tick' }, svg).textContent = fmt(t);
      });
      s('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'chart__axis' }, svg).textContent = c.xLabel;
      const cross = s('line', { y1: m.t, y2: H - m.b, stroke: C.mute, 'stroke-dasharray': '3 4', opacity: 0 }, svg);
      c.series.forEach((se, i) => {
        s('path', { d: se.pts.map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(''), fill: 'none', stroke: colors[i], 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
        se.pts.forEach((p) => s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: colors[i], stroke: C.navy, 'stroke-width': 2 }, svg));
        if (se.mark) { // 따라간 최대 속도
          const p = se.pts.find((q) => q[0] === se.mark.x);
          s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 9, fill: 'none', stroke: C.ink, 'stroke-width': 1.5 }, svg);
          s('text', { x: X(p[0]), y: Y(p[1]) - 16, 'text-anchor': 'middle', class: 'chart__label' }, svg).textContent = se.mark.label;
        }
      });
      const hit = s('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', (e) => {
        const px = e.clientX - svg.getBoundingClientRect().left;
        const x = xs.reduce((a, b) => (Math.abs(X(b) - px) < Math.abs(X(a) - px) ? b : a));
        cross.setAttribute('x1', X(x)); cross.setAttribute('x2', X(x)); cross.setAttribute('opacity', 1);
        const rows = c.series.map((se, i) => [se.pts.find((p) => p[0] === x), se, colors[i]]).filter((r) => r[0])
          .map(([p, se, col]) => [col, se.name, p[1] + (c.yUnit || '')]);
        showTip(e, `${fmt(x)} ${c.xUnit}`, rows);
      });
      hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); hideTip(); });
    });
    const legend = h('ul', { className: 'chart__legend' }, c.series.map((se, i) => h('li', {}, h('i', { style: `background:var(${i ? '--sun' : '--mute'})` }), se.name)));
    const xsAll = [...new Set(c.series.flatMap((se) => se.pts.map((p) => p[0])))].sort((a, b) => a - b);
    const table = tableView([c.xLabel, ...c.series.map((se) => se.name)],
      xsAll.map((x) => [fmt(x), ...c.series.map((se) => { const p = se.pts.find((q) => q[0] === x); return p ? p[1] + (c.yUnit || '') : ''; })]));
    return [legend, host, table];
  }

  /* ── 막대 차트 묶음 (같은 x축, 측정값마다 따로: 축을 겹치지 않음) ── */
  function barCharts(c) {
    const wrap = h('div', { className: 'multiples' });
    c.measures.forEach((me) => {
      const host = h('div', { className: 'chart' });
      const max = Math.max(...me.values);
      responsive(host, (W) => {
        const H = 190, m = { l: 8, r: 8, t: 30, b: 26 }, n = me.values.length, bw = (W - m.l - m.r) / n;
        host.querySelector('svg')?.remove();
        const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': me.name }, host);
        s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: C.grid }, svg);
        me.values.forEach((v, i) => {
          const bh = Math.max((v / max) * (H - m.t - m.b), 2), x = m.l + i * bw + 1, y = H - m.b - bh;
          const bar = s('path', { d: `M${x} ${y + bh}V${y + 4}q0-4 4-4h${bw - 10}q4 0 4 4V${y + bh}z`, fill: accent(host) }, svg);
          if (v === max) s('text', { x: x + bw / 2 - 1, y: y - 8, 'text-anchor': 'middle', class: 'chart__label' }, svg).textContent = fmt(v) + me.unit;
          if (i % 2 === 0 || bw > 34) s('text', { x: x + bw / 2 - 1, y: H - 8, 'text-anchor': 'middle', class: 'chart__tick' }, svg).textContent = c.labels[i];
          const hit = s('rect', { x: m.l + i * bw, y: m.t, width: bw, height: H - m.t - m.b, fill: 'transparent' }, svg);
          hit.addEventListener('pointermove', (e) => { bar.setAttribute('fill', C.ink); showTip(e, `${c.labels[i]}${c.xUnit} · ${c.context[i]}`, [[null, me.name, fmt(v) + me.unit]]); });
          hit.addEventListener('pointerleave', () => { bar.setAttribute('fill', accent(host)); hideTip(); });
        });
      });
      wrap.append(h('figure', {}, h('figcaption', { textContent: me.name }), host));
    });
    const table = tableView([c.xLabel, c.contextLabel, ...c.measures.map((me) => me.name)],
      c.labels.map((l, i) => [l, c.context[i], ...c.measures.map((me) => fmt(me.values[i]) + me.unit)]));
    return [wrap, table];
  }

  // 누르면 그 자리에서 화면 가득 커짐(fx.js 의 Flip). 스크립트가 없으면 원본이 새 탭으로 열림
  const image = (c) => [h('a', { href: c.img, target: '_blank', rel: 'noopener', className: 'ev__zoom' },
    h('img', { src: c.img, alt: c.alt, loading: 'lazy', decoding: 'async', width: c.w, height: c.h }), h('span', { textContent: '크게 보기 ⤢' }))];

  /* ── 동작 흐름: 캐시 무효화가 어떻게 오가는지 움직이는 도식 ──
     선은 GSAP DrawSVG 로 그려지고, 요청·메시지(점)는 MotionPath 로 선을 따라 이동. 화면에 보일 때만 반복 재생.
     gsap 이 없거나 모션 줄이기 환경이면 도식과 단계 목록만 보임. */
  function flow(c) {
    const box = (id, x, y, w, hh, label, sub) => `<g class="fl-node" data-n="${id}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="14"/><text class="fl-t" x="${x + 18}" y="${y + 30}">${label}</text>${sub ? `<text class="fl-s" x="${x + 18}" y="${y + 52}">${sub}</text>` : ''}</g>`;
    const cell = (id, x, y) => `<g class="fl-cell is-full" data-c="${id}"><rect x="${x}" y="${y}" width="78" height="26" rx="7"/><text x="${x + 39}" y="${y + 18}">주점 7</text></g>`;
    const path = (id, d, label, lx, ly) => `<path id="fl-${id}" d="${d}"/>${label ? `<text class="fl-l" x="${lx}" y="${ly}">${label}</text>` : ''}`;
    const wrap = h('div', { className: 'flow' });
    wrap.innerHTML = `<svg viewBox="0 0 760 420" role="img" aria-label="${c.title}">
      <g class="fl-paths">
        ${path('p1', 'M150 88 C 220 88, 230 76, 300 76', 'GET /menus', 168, 70)}
        ${path('p2', 'M150 88 C 220 88, 230 176, 300 176')}
        ${path('p3', 'M150 330 L 300 330', 'PATCH 품절', 178, 320)}
        ${path('p4', 'M520 330 L 580 330', 'COMMIT', 524, 320)}
        ${path('p5', 'M470 296 C 470 250, 640 260, 650 212', 'PUBLISH INVALIDATE-7', 530, 262)}
        ${path('p6', 'M600 140 C 570 110, 560 82, 520 82')}
        ${path('p7', 'M580 180 L 520 180')}
        ${path('p8', 'M430 212 C 430 260, 600 250, 640 296', '', 0, 0)}
      </g>
      ${box('cust', 20, 60, 130, 56, '손님')}
      ${box('admin', 20, 302, 130, 56, '운영자')}
      ${box('u1', 300, 40, 220, 76, 'User API ①', 'Caffeine')}
      ${box('u2', 300, 140, 220, 76, 'User API ②', 'Caffeine')}
      ${box('adm', 300, 296, 220, 70, 'Admin API')}
      ${box('redis', 580, 140, 160, 72, 'Redis', 'Pub/Sub')}
      ${box('db', 580, 296, 160, 70, 'MySQL')}
      ${cell('u1', 424, 64)}${cell('u2', 424, 164)}
      <g class="fl-dots">${'<circle class="fl-dot" r="7" cx="-20" cy="-20"/>'.repeat(3)}</g>
    </svg>`;
    const steps = h('ol', { className: 'flow__steps' }, c.steps.map((s) => h('li', { textContent: s })));
    if (!window.gsap || !window.MotionPathPlugin || !window.DrawSVGPlugin || matchMedia('(prefers-reduced-motion: reduce)').matches) return [wrap, steps];

    gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin);
    const q = (s) => wrap.querySelector(s), dots = [...wrap.querySelectorAll('.fl-dot')], items = [...steps.children];
    const say = (i) => () => items.forEach((li, j) => li.classList.toggle('is-on', i === j));
    const lit = (n) => () => { const el = q(`[data-n="${n}"]`); el.classList.add('is-on'); setTimeout(() => el.classList.remove('is-on'), 700); };
    const fill = (id, on) => () => wrap.querySelectorAll(id ? `[data-c="${id}"]` : '.fl-cell').forEach((e) => e.classList.toggle('is-full', on));
    // 점 하나를 선을 따라 보냄(back 이면 거꾸로)
    const go = (dot, p, dur = 0.7, back = false) => gsap.fromTo(dot, { opacity: 1 }, { motionPath: { path: `#fl-${p}`, align: `#fl-${p}`, alignOrigin: [0.5, 0.5], start: back ? 1 : 0, end: back ? 0 : 1 }, duration: dur, ease: 'power1.inOut', immediateRender: false });
    const [a, b, m] = dots;
    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4 })
      .call(say(0)).call(fill(null, true))
      .add(go(a, 'p1')).call(lit('u1')).add(go(a, 'p1', 0.5, true))
      .add(go(b, 'p2'), '-=0.9').call(lit('u2')).add(go(b, 'p2', 0.5, true))
      .set([a, b], { opacity: 0 })
      .call(say(1), null, '+=0.3').add(go(m, 'p3', 0.8)).call(lit('adm')).add(go(m, 'p4', 0.5)).call(lit('db'))
      .call(say(2), null, '+=0.3').add(go(m, 'p5', 0.9)).call(lit('redis'))
      .call(say(3), null, '+=0.2').set(m, { opacity: 0 }).add(go(a, 'p6', 0.6)).add(go(b, 'p7', 0.6), '<')
      .call(lit('u1')).call(lit('u2')).call(fill(null, false)).set([a, b], { opacity: 0 })
      .call(say(4), null, '+=0.6').add(go(b, 'p2', 0.7)).call(lit('u2')).add(go(b, 'p8', 0.8)).call(lit('db')).add(go(b, 'p8', 0.6, true)).call(fill('u2', true))
      .add(go(b, 'p2', 0.5, true)).call(lit('u2')).set(b, { opacity: 0 });
    let drawn = false;
    if (window.ScrollTrigger) ScrollTrigger.create({
      trigger: wrap, start: 'top 85%', end: 'bottom 15%',
      onToggle: (s) => {
        if (!s.isActive) return tl.pause();
        if (drawn) return tl.play();
        drawn = true; // 처음 볼 때 선이 그려지고 상자가 들어온 뒤 재생
        gsap.timeline({ onComplete: () => tl.play() })
          .from(wrap.querySelectorAll('.fl-node, .fl-cell'), { opacity: 0, scale: 0.9, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.05, ease: 'back.out(1.6)' })
          .from(wrap.querySelectorAll('.fl-paths path'), { drawSVG: 0, duration: 0.9, stagger: 0.08, ease: 'power2.inOut' }, 0.2)
          .from(wrap.querySelectorAll('.fl-l'), { opacity: 0, duration: 0.4, stagger: 0.05 }, '-=0.4');
      },
    });
    else tl.play();
    return [wrap, steps];
  }

  // 전체 그림(구성도)은 프로젝트 첫머리에, 나머지는 해당 사례 바로 밑에 붙임. 모두 왼쪽 설명 | 오른쪽 자료
  const kinds = { line: lineChart, bars: barCharts, image, flow };
  D.projects.forEach((p) => {
    const sec = document.getElementById(p.id);
    (p.evidence || []).forEach((ev) => {
      const lead = ev.at === 'head';
      const host = lead ? sec.querySelector('.project__lead') : sec.querySelector(`.case-wrap[data-case="${ev.case}"]`);
      host.append(h('section', { className: `ev ev--${ev.type} split${lead ? ' ev--lead' : ''}` },
        h('header', { className: 'ev__head' },
          h('p', { className: 'eyebrow', textContent: ev.label || (lead ? '전체 그림' : '근거') }),
          h('h4', { className: 'ev__title', textContent: ev.title }),
          h('p', { className: 'ev__desc', textContent: ev.desc || '' }),
          ev.src ? h('a', { className: 'ev__src', href: ev.src.url, target: '_blank', rel: 'noopener', textContent: '출처: ' + ev.src.label }) : null),
        h('div', { className: 'ev__body' }, kinds[ev.type](ev))));
    });
  });
})();
