/* Gasip 체험 화면: 전체 리뷰 목록 → 리뷰 상세(좋아요·댓글) → 리뷰 작성, 그리고 조회 방식 세 가지 비교.
   휴대폰 화면은 Gasip 프론트엔드(GASIP-PROJECT/gasip-frontend)의 색·크기·문구를 본떠 다시 만든 것이고,
   오른쪽이 gasip-demo.js 의 조회 모델입니다. */
(() => {
  const host = document.querySelector('#gasip .demo-slot');
  if (!host || !window.GasipBoard) return;
  const A = 'assets/gasip/';
  const fmt = (n) => n.toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const MODES = {
    scan: { name: '인덱스 없는 OFFSET', fact: 'OFFSET 8,300 기준 SQL 실행 시간 6,271ms. 요청마다 100만 행 스캔과 727,554행 filesort, VU 20에서 모든 요청 실패' },
    index: { name: '커버링 인덱스 + OFFSET', fact: 'OFFSET 8,300에서는 147.6 TPS로 목표를 넘겼지만, OFFSET 100,000에서는 건너뛰는 행만큼 인덱스를 읽어 31 TPS' },
    cursor: { name: 'No-Offset (lastPostId)', fact: 'OFFSET 8,300 기준 SQL 실행 시간 0.90ms · 205.8 TPS, OFFSET 100,000 기준 211.8 TPS. 이미 본 리뷰가 중복 노출되지 않음' },
  };
  const REPLIES = ['저도 같은 생각이에요.', '이번 학기에 듣는데 도움이 됐어요.', '과제 제출 기한은 넉넉한가요?', '시험 범위 정보 감사합니다!', '다음 학기에 수강하려고요.'];

  const root = document.createElement('section');
  root.className = 'nw gs demo';
  root.innerHTML = `
    <div class="split demo__intro">
      <header class="ev__head">
        <p class="eyebrow">직접 해 보기</p>
        <h4 class="ev__title">직접 눌러 보는 Gasip</h4>
        <p class="ev__desc">왼쪽 휴대폰에서 리뷰 목록을 내려 보고 리뷰를 눌러 상세로 들어가거나 새 리뷰를 써 보세요. 목록 10건을 조회할 때마다 DB 가 스캔한 행 수가 오른쪽에 표시됩니다. 조회 방식 세 개는 위 사례의 해결 과정 세 단계와 같습니다.</p>
      </header>
      <figure class="nw__mock gs__video"><video src="assets/gasip/demo.mp4#t=1" controls muted playsinline preload="metadata"></video><figcaption>실제 앱 화면 영상. 출처: Gasip 백엔드 README</figcaption></figure>
    </div>
    <div class="gs__grid">
      <div class="nw__col"><p class="nw__label">학생 화면</p><div class="phone">
        <button type="button" class="gs-write" data-act="write">교수님 리뷰 작성하기</button>
        <div class="phone__screen gs-screen" id="gs-phone" data-lenis-prevent>
          <div class="gs-head"><button type="button" data-act="home" aria-label="홈으로"><img src="${A}icon_goback.png" width="28" height="28" alt=""></button></div>
          <div class="gs-title"><h2><img src="${A}icon_papers.png" width="28" height="28" alt="">전체 리뷰</h2><p>모든 리뷰가 모여있는 게시판이에요.</p></div>
          <div class="gs-feed"><ul id="gs-list"></ul><p class="gs-more" id="gs-more"></p></div>
        </div>
        <div class="gs-over" id="gs-over" data-lenis-prevent hidden></div>
      </div></div>
      <div class="nw__col bk">
        <p class="nw__label">목록 조회 방식</p>
        <div class="bk__actions gs-modes">${Object.entries(MODES).map(([k, m]) => `<button type="button" data-act="mode" data-k="${k}" aria-pressed="false">${m.name}</button>`).join('')}</div>
        <p class="nw__label">시나리오</p>
        <div class="bk__actions">
          <button type="button" data-act="other">다른 학생이 새 리뷰 등록</button>
          <button type="button" data-act="deep">100,000번째 글부터 이어 보기</button>
          <button type="button" data-act="reset">처음부터</button>
        </div>
        <dl class="gs-stats">
          <div><dt>이번 조회에서 스캔한 행</dt><dd class="num" id="gs-ex">0</dd><div class="gs-bar" aria-hidden="true"><i id="gs-bar"></i></div><small>막대는 로그 스케일 (10 ~ 100만 행)</small></div>
          <div><dt>화면에 가져온 리뷰</dt><dd class="num" id="gs-got">0</dd></div>
          <div><dt>중복 노출된 리뷰</dt><dd class="num" id="gs-dup">0</dd></div>
        </dl>
        <p class="dock__fact"><b>실측</b> <span id="gs-fact"></span></p>
        <ol class="bk__log gs-log" id="gs-log" data-lenis-prevent aria-live="polite"></ol>
      </div>
    </div>
    <details class="nw__credit"><summary>화면 출처와 안내</summary><p>화면 디자인과 앱은 Gasip 팀의 디자이너와 프론트엔드 개발자들이 만들었습니다(<a href="https://github.com/GASIP-PROJECT/gasip-frontend" target="_blank" rel="noopener">GASIP-PROJECT/gasip-frontend</a>). 여기서는 그 화면을 본떠 다시 그렸고 실제 서버에는 연결되지 않습니다. 리뷰·댓글 내용과 강의·교수·닉네임은 예시 데이터입니다. 스캔한 행 수는 브라우저에서 시뮬레이션으로 계산한 값입니다. 조회 방식을 화면에서 고르는 기능은 이 체험에만 있고 글쓰기의 교수 검색과 답글·신고는 생략했습니다.</p></details>`;
  host.append(root);

  const $ = (s) => root.querySelector(s);
  const phone = $('#gs-phone'), list = $('#gs-list'), logEl = $('#gs-log'), over = $('#gs-over');
  let board, mode = 'index', cur, seen, dup, got, loading, hasNext;
  const extra = new Map(); // 글별 체험 상태: { liked, views, comments[] }
  const ui = { view: null, from: null, post: null, draft: '', toast: '' }; // view: home | detail | write | null(전체 리뷰 목록), from: 덮개를 닫으면 돌아갈 곳

  const ago = (m) => (m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`);
  const nick = (p) => p.nick || `가천인${(p.id % 9000) + 1000}`;
  const stateOf = (p) => {
    if (!extra.has(p.id)) extra.set(p.id, { liked: false, views: p.likes * 7 + p.comments, comments: Array.from({ length: Math.min(p.comments, 3) }, (_, i) => ({ nick: `가천인${((p.id + i * 37) % 9000) + 1000}`, text: REPLIES[(p.id + i) % REPLIES.length], ago: ago(p.minutesAgo > 2 ? Math.floor(p.minutesAgo / (i + 2)) : 0) })) });
    return extra.get(p.id);
  };
  const likes = (p) => p.likes + (stateOf(p).liked ? 1 : 0);
  const commentsN = (p) => p.comments + (stateOf(p).added || 0);
  const log = (text, kind) => {
    const li = document.createElement('li');
    if (kind) li.dataset.src = kind === 'dup' ? 'redis' : 'http';
    li.append(Object.assign(document.createElement('b'), { textContent: kind === 'dup' ? '중복' : kind === 'http' ? 'http' : 'mysql' }), Object.assign(document.createElement('span'), { textContent: text }));
    logEl.append(li);
    logEl.scrollTop = logEl.scrollHeight;
  };

  /* ── 목록 ── */
  function card(p, isDup) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="gs-card${isDup ? ' is-dup' : ''}" data-act="open" data-id="${p.id}">${isDup ? '<em>이미 본 리뷰</em>' : ''}<div class="gs-row"><p>${esc(p.content)}</p><span>${esc(p.prof)}님</span></div>
      <div class="gs-foot"><time>${ago(p.minutesAgo)}</time><img src="${A}icon_thumbsup.png" alt="좋아요"><span data-likes>${likes(p)}</span><img src="${A}icon_comment.png" alt="댓글"><span data-comments>${commentsN(p)}</span><i>${esc(nick(p))}</i><b><img src="${A}icon_view.png" alt="조회"><span data-views>${stateOf(p).views}</span></b></div></button>`;
    return li;
  }
  function load() {
    if (loading || !hasNext) return;
    loading = true;
    const r = board.query(mode, cur);
    let d = 0;
    r.rows.forEach((p) => { const isDup = seen.has(p.id); if (isDup) d++; seen.add(p.id); list.append(card(p, isDup)); });
    got += r.rows.length; dup += d; hasNext = r.hasNext;
    const where = mode === 'cursor' ? `lastPostId=${cur.lastPostId ? fmt(cur.lastPostId) : '없음'}` : `page=${fmt(cur.page)}`;
    log(`목록 ${where} → ${fmt(r.examined)}행 스캔, ${r.rows.length}건 반환`);
    if (d) log(`새 글이 추가돼 목록이 한 칸 밀림 → 이미 본 리뷰 ${d}건 중복 노출`, 'dup');
    cur = mode === 'cursor' ? { lastPostId: r.rows.at(-1)?.id } : { page: cur.page + 1 };
    $('#gs-ex').textContent = fmt(r.examined);
    $('#gs-bar').style.width = Math.max(4, (Math.log10(r.examined) - 1) / 5 * 100) + '%';
    $('#gs-bar').dataset.heavy = r.examined > 1000;
    // ponytail: SQL 문은 화면에 안 냄(채용 담당자 피드백). r.sql 은 모델에 남겨 둠
    $('#gs-got').textContent = fmt(got);
    $('#gs-dup').textContent = fmt(dup);
    $('#gs-more').textContent = hasNext ? '아래로 내리면 다음 10건을 가져옵니다' : '마지막 글입니다';
    loading = false;
  }
  function start({ keepBoard = false, deep = false } = {}) {
    if (!keepBoard) { board = window.GasipBoard(); extra.clear(); }
    seen = new Set(); dup = 0; got = 0; hasNext = true; loading = false;
    cur = mode === 'cursor' ? { lastPostId: deep ? board.maxId() - 100000 + 1 : undefined } : { page: deep ? 10000 : 0 };
    list.replaceChildren();
    phone.scrollTop = 0;
    root.querySelectorAll('[data-act="mode"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === mode));
    $('#gs-fact').textContent = MODES[mode].fact;
    load();
  }

  /* ── 상세 · 글쓰기 (휴대폰 위에 덮이는 화면) ── */
  const SVG = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const views = {
    // 앱의 첫 화면. 실시간 인기글·전체 리뷰 미리보기에서 글을 열거나 더보기로 목록에 들어감
    home() {
      const top = board.maxId(), recent = Array.from({ length: 30 }, (_, i) => board.post(top - i));
      const row = (p) => `<li><button type="button" data-act="open" data-id="${p.id}"><span>${esc(p.content)}</span><i><img src="${A}icon_thumbsup.png" alt="좋아요">${likes(p)}</i><i><img src="${A}icon_comment.png" alt="댓글">${commentsN(p)}</i></button></li>`;
      const sec = (icon, title, rows, more) => `<section class="gh-sec"><header><h3><img src="${A}${icon}" width="20" height="20" alt="">${title}</h3>${more ? '<button type="button" data-act="list">더보기 ›</button>' : ''}</header><ul>${rows.map(row).join('')}</ul></section>`;
      return `<div class="gh-top"><b>Gasip</b><span>${SVG('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>')}${SVG('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}</span></div>
        <p class="gh-search">교수님 or 학과를 입력해주세요${SVG('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>')}</p>
        <ul class="gh-short">${['공지사항', '학사일정', '홈페이지', '사이버캠퍼스', '포털'].map((t) => `<li><i></i>${t}</li>`).join('')}</ul>
        <button type="button" class="gh-write" data-act="write">교수님 리뷰 작성하기</button>
        ${sec('icon_thumbsup.png', '실시간 인기글', recent.slice().sort((a, b) => likes(b) - likes(a)).slice(0, 4))}
        ${sec('icon_papers.png', '전체 리뷰', recent.slice(0, 4), true)}`;
    },
    detail() {
      const p = ui.post, s = stateOf(p);
      return `<div class="gd-head"><button type="button" data-act="close" aria-label="뒤로"><img src="${A}icon_goback.png" width="28" height="28" alt=""></button><h2>${esc(nick(p))} 님의 게시글</h2><i></i></div>
        <div class="gd-prof"><span>${esc(p.prof)}님</span></div>
        <article class="gd-body"><header><b>${esc(nick(p))}</b><time>${ago(p.minutesAgo)}</time><img src="${A}icon_dots_vertical.png" width="20" height="20" alt=""></header>
          <p>${esc(p.content)}</p>
          <footer><button type="button" data-act="like" class="${s.liked ? 'is-on' : ''}" aria-pressed="${s.liked}" aria-label="좋아요"><img src="${A}icon_thumbsup.png" alt="">${likes(p)}</button><span><img src="${A}icon_comment.png" alt="댓글">${commentsN(p)}</span><span><img src="${A}icon_view.png" alt="조회">${s.views}</span></footer></article>
        <ul class="gd-comments">${s.comments.map((c) => `<li><header><b>${esc(c.nick)}</b><time>${c.ago}</time></header><p>${esc(c.text)}</p></li>`).join('')}</ul>
        <form class="gd-input" data-form="comment"><input type="text" name="c" placeholder="댓글을 입력해주세요." maxlength="200" autocomplete="off"><button type="submit" aria-label="댓글 등록"><img src="${A}icon_plane_right.png" width="24" height="24" alt=""></button></form>`;
    },
    write: () => `<div class="gw-head"><button type="button" data-act="close" aria-label="닫기">✕</button><h2>리뷰 작성</h2><button type="button" class="gw-done" data-act="submit">완료</button></div>
        <div class="gw-body"><p class="gw-tag"><img src="${A}icon_x_circle.png" width="18" height="18" alt="">A 교수님</p><p class="gw-count" id="gw-count">${ui.draft.length}/500</p>
        <textarea id="gw-text" maxlength="500" placeholder="여러분의 자유로운 의견을 들려주세요.&#10;&#10;부적절하거나 불쾌감을 줄 수 있는 컨텐츠는 제재를 받을 수 있습니다.">${esc(ui.draft)}</textarea></div>
        ${ui.toast ? `<p class="gw-toast">${ui.toast}</p>` : ''}`,
  };
  let opener = null, lastKey = 0;
  function drawOver(focus) {
    over.hidden = !ui.view;
    phone.inert = !!ui.view; // 덮개가 열린 동안 뒤의 목록은 키보드·스크린리더에서 제외
    over.className = 'gs-over' + (ui.view ? ' is-' + ui.view : '');
    over.innerHTML = ui.view ? views[ui.view]() : '';
    if (focus && ui.view) over.querySelector('button')?.focus();
    if (focus && !ui.view) (opener?.isConnected ? opener : root.querySelector('.gs-write'))?.focus();
  }
  root.addEventListener('keydown', (e) => { if (e.key === 'Tab') lastKey = performance.now(); if (e.key === 'Escape' && ui.view) { ui.view = null; drawOver(true); } });
  const syncCard = (p) => { // 목록에 떠 있는 같은 글의 숫자도 맞춤
    list.querySelectorAll(`[data-id="${p.id}"]`).forEach((c) => { c.querySelector('[data-likes]').textContent = likes(p); c.querySelector('[data-comments]').textContent = commentsN(p); c.querySelector('[data-views]').textContent = stateOf(p).views; });
  };

  phone.addEventListener('scroll', () => { if (performance.now() - lastKey < 400) return; if (phone.scrollTop + phone.clientHeight > phone.scrollHeight - 160) load(); });
  root.addEventListener('input', (e) => { if (e.target.id === 'gw-text') { ui.draft = e.target.value; $('#gw-count').textContent = `${ui.draft.length}/500`; } });
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = e.target.c.value.trim();
    if (!text) return;
    const s = stateOf(ui.post);
    s.comments.push({ nick: '나', text, ago: '방금' });
    s.added = (s.added || 0) + 1;
    log(`POST 댓글 (글 #${fmt(ui.post.id)})`, 'http');
    log('INSERT INTO comment … · 1행');
    syncCard(ui.post); drawOver();
    over.scrollTop = over.scrollHeight;
    over.querySelector('.gd-input input').focus();
  });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'mode') { mode = t.dataset.k; logEl.replaceChildren(); log(`목록 조회 방식: ${MODES[mode].name}`); start(); }
    else if (act === 'reset') { logEl.replaceChildren(); start(); }
    else if (act === 'deep') { log('100,000번째 글 위치로 이동'); start({ keepBoard: true, deep: true }); }
    else if (act === 'other') { const p = board.addPost(); log(`INSERT INTO board … (새 리뷰 #${fmt(p.id)}) · 학생 화면에는 아직 미반영`); }
    else if (act === 'home') { ui.view = 'home'; drawOver(true); }
    else if (act === 'list') { ui.view = null; drawOver(true); }
    else if (act === 'open') {
      ui.from = ui.view; ui.post = board.post(+t.dataset.id); ui.view = 'detail';
      stateOf(ui.post).views++;
      log(`GET /boards/details/${ui.post.id}`, 'http');
      log('SELECT … FROM board WHERE post_id = ? → PK 로 1행 · 조회수 +1');
      opener = t; syncCard(ui.post); drawOver(true);
    }
    else if (act === 'like') { const s = stateOf(ui.post); s.liked = !s.liked; const keep = over.querySelector('.gd-input input')?.value; log(`${s.liked ? '좋아요' : '좋아요 취소'} (글 #${fmt(ui.post.id)})`, 'http'); log(`${s.liked ? 'INSERT INTO' : 'DELETE FROM'} likes … · 1행`); syncCard(ui.post); drawOver(); if (keep) over.querySelector('.gd-input input').value = keep; over.querySelector('[data-act="like"]').focus(); }
    else if (act === 'write') { opener = t; ui.from = ui.view; ui.view = 'write'; ui.draft = ''; ui.toast = ''; drawOver(); $('#gw-text').focus(); }
    else if (act === 'close') { ui.view = ui.from; ui.from = null; drawOver(true); }
    else if (act === 'submit') {
      const text = ui.draft.trim();
      if (!text) { ui.toast = '내용을 입력해주세요.'; drawOver(); $('#gw-text').focus(); return; }
      const p = board.addPost({ content: text, prof: 'A 교수', nick: '나', likes: 0, comments: 0, minutesAgo: 0 });
      log('POST /boards/{profId}  { content }', 'http');
      log(`INSERT INTO board … (새 리뷰 #${fmt(p.id)}) → 목록을 처음부터 다시 조회`);
      ui.view = null; ui.from = null; drawOver();
      start({ keepBoard: true });
    }
  });

  start(); // 첫 화면은 전체 리뷰 목록. 홈은 뒤로 가기로 들어감
})();
