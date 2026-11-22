/* NoWait 체험 화면: 손님 휴대폰 · 서버 안 · 운영자 화면. 원격 줄서기와 테이블 주문 두 흐름.
   휴대폰과 운영자 화면은 NoWait 프론트엔드(GTable/NoWait_FE)의 색·문구·배치를 본떠 다시 만든 것이고,
   가운데가 nowait-demo.js 의 백엔드 모델입니다. 화면의 문구는 프론트 레포 원문을 따랐습니다. */
(() => {
  const host = document.querySelector('#nowait .demo-slot');
  if (!host || !window.NoWaitBackend) return;
  const A = 'assets/nowait/fe/', ME = 1, TABLE = 5;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const won = (n) => n.toLocaleString('en-US') + '원';
  const hhmm = (t) => new Date(t).toTimeString().slice(0, 5);

  const root = document.createElement('section');
  root.className = 'nw demo';
  root.innerHTML = `
    <div class="split demo__intro">
      <header class="ev__head">
        <p class="eyebrow">직접 해 보기</p>
        <h4 class="ev__title">직접 눌러 보는 NoWait</h4>
        <p class="ev__desc">휴대폰에서 줄을 서거나 테이블에서 주문하면 바로 오른쪽에 그때 서버 안에서 일어나는 일이 나옵니다. 아래 운영자 화면에서 입장 호출과 주문 처리를 해 보세요. 위 두 사례(캐시 무효화, 멱등 키)가 여기서 그대로 돌아갑니다.</p>
        <div class="bk__actions nw__flow"><button type="button" data-act="flow" data-f="wait">원격 줄서기</button><button type="button" data-act="flow" data-f="order">테이블 주문 (QR)</button></div>
      </header>
      <figure class="nw__mock"><img src="assets/nowait/service.png" alt="NoWait 서비스 화면 모음: 주점 목록, 메뉴, 주문, 대기 등록 화면" loading="lazy" width="2400" height="1350"><figcaption>실제 서비스 화면. 출처: NoWait 프론트엔드 README</figcaption></figure>
    </div>
    <div class="nw__grid">
      <div class="nw__col"><p class="nw__label">손님 화면</p><div class="phone"><div class="phone__screen" id="nw-phone" data-lenis-prevent></div></div></div>
      <div class="nw__col bk nw__server">
        <p class="nw__label">서버 안에서 일어나는 일</p>
        <div class="bk__actions" id="nw-actions"></div>
        <div class="bk__split"><div class="bk__state" id="nw-state"></div><ol class="bk__log" id="nw-log" data-lenis-prevent aria-live="polite"></ol></div>
      </div>
      <div class="nw__col nw__admin"><p class="nw__label">운영자 화면</p><div class="ipad"><div class="ipad__screen admin" id="nw-admin" data-lenis-prevent></div></div></div>
    </div>
    <details class="nw__credit"><summary>화면 출처와 안내</summary><p>화면 디자인과 프론트엔드는 NoWait 팀의 디자이너와 프론트엔드 개발자들이 만들었습니다(<a href="https://github.com/GTable/NoWait_FE" target="_blank" rel="noopener">GTable/NoWait_FE</a>). 여기서는 그 화면을 본떠 다시 그렸습니다. 실제 서버에 연결되지 않으며 실제 송금도 일어나지 않습니다. 음식 사진은 위키미디어 공용의 CC0(퍼블릭 도메인) 사진입니다: <a href="https://commons.wikimedia.org/wiki/File:Garaetteok_Tteokbokki.jpg" target="_blank" rel="noopener">Garaetteok Tteokbokki</a>(Kimseoeun2023079825), <a href="https://commons.wikimedia.org/wiki/File:Mozzarella-kimchi-buchimgae.jpg" target="_blank" rel="noopener">Mozzarella-kimchi-buchimgae</a>(b00142), <a href="https://commons.wikimedia.org/wiki/File:Eomuk-tang_2.jpg" target="_blank" rel="noopener">Eomuk-tang 2</a>(bigtorica), <a href="https://commons.wikimedia.org/wiki/File:Korean_corn_with_cheese.jpg" target="_blank" rel="noopener">Korean corn with cheese</a>(Fumikas Sagisavas). 카카오페이·토스·네이버페이 로고는 각 회사의 상표입니다. 주점·메뉴·대기 팀, 주점 위치·소개글·공지, 손님 이름은 모두 예시 데이터이고 전화번호는 가렸습니다. 줄서기의 멱등 키는 이 체험 화면이 붙여 보냅니다. 운영자 화면은 위쪽 탭 구성을 단순하게 바꿨고 확인 창은 생략했습니다.</p></details>`;
  host.append(root);

  const $ = (s) => root.querySelector(s);
  const phone = $('#nw-phone'), admin = $('#nw-admin'), logEl = $('#nw-log');

  /* ── 서버 로그 ── */
  const log = (src, text) => {
    const li = document.createElement('li');
    li.dataset.src = src;
    li.append(Object.assign(document.createElement('b'), { textContent: src }), Object.assign(document.createElement('span'), { textContent: text }));
    logEl.append(li);
    while (logEl.children.length > 80) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  };
  const B = window.NoWaitBackend({ emit: log });
  const st = { flow: 'wait', screen: 'home', party: 1, waiting: null, busy: false, last: null, modal: null, menus: [], cart: [], pick: null, qty: 1, depositor: '', nameErr: '', pay: '카카오페이', toast: '', tab: 'wait', wf: 'ALL', of: 'ING', banner: 0, draft: null };
  const queue = () => B.redis.zrange(B.queueKey);
  const partyOf = (m) => B.db.reservations.find((r) => String(r.userId) === m && r.status === 'WAITING')?.partySize ?? '-';
  const total = () => st.cart.reduce((n, c) => n + c.price * c.quantity, 0);
  const count = () => st.cart.reduce((n, c) => n + c.quantity, 0);
  const myOrders = () => B.db.orders.filter((o) => o.tableId === TABLE);

  /* ── 손님 화면 공통 조각 ── */
  const footer = (label, attrs, disabled) => `<div class="p-foot"><button type="button" class="p-big" ${attrs} ${disabled ? 'disabled' : ''}>${label}</button></div>`;
  const back = (to, onImage) => `<button type="button" class="p-back${onImage ? ' is-on-image' : ''}" data-act="go" data-to="${to}" aria-label="뒤로"><img src="${A}back.svg" alt=""></button>`;
  const qty = (n, dec, inc, min = 1, max = 99) => `<div class="p-qty"><button type="button" data-act="${dec}" ${n <= min ? 'disabled' : ''} aria-label="줄이기"><img src="${A}minus.svg" alt=""></button><b>${n}</b><button type="button" data-act="${inc}" ${n >= max ? 'disabled' : ''} aria-label="늘리기"><img src="${A}plus.svg" alt=""></button></div>`;
  const menuList = (clickable) => `<h2 class="p-t20s">메뉴</h2><ul class="p-menus">${st.menus.map((m) => {
    const inner = `<div><span class="p-menu-name">${esc(m.name)}</span>${m.soldOut ? '<span class="p-sold">품절</span>' : ''}<p class="p-menu-price">${won(m.price)}</p></div><img src="${m.img || A + 'default-menu-image-sm.png'}" alt="">`;
    return `<li class="${m.soldOut ? 'is-sold' : ''}">${clickable ? `<button type="button" data-act="menu" data-id="${m.id}" ${m.soldOut ? 'disabled' : ''}>${inner}</button>` : inner}</li>`;
  }).join('')}</ul>`;
  const center = (img, title, text, extra = '') => `<section class="p-center"><img src="${A}${img}" alt="" width="150">${title}<p>${text}</p>${extra}</section>`;
  const STATUS = { WAITING_FOR_PAYMENT: '입금 대기 중', COOKING: '조리 중', COOKED: '조리 완료', CANCELLED: '주문 취소' };

  const screens = {
    /* 원격 줄서기 */
    home() {
      const rank = B.myRank(ME);
      return `<header class="p-top"><img src="${A}logo.svg" alt="NoWait" width="58" height="24"></header>
        <section class="p-pad"><h2 class="p-t20b">나의 대기카드</h2>
        ${rank != null ? `<div class="p-card"><p class="p-card-store">${B.STORE.name}</p>
            <p class="p-card-ahead">내 앞 대기 <b>${rank}팀</b><button type="button" data-act="refresh" aria-label="새로고침"><img src="${A}refresh.svg" alt=""></button></p>
            <p class="p-card-meta">#${rank + 1} · 인원 ${st.waiting.partySize}명 · 대기번호 ${st.waiting.waitingNumber}</p></div>
          ${B.active(ME)?.status === 'CALLING' ? `<p class="p-calling">10분 안에 입장해주세요!<b data-cd="${B.active(ME).calledAt + 600000}"></b></p>` : ''}
          <button type="button" class="p-cancel" data-act="askCancel"><img src="${A}close.svg" alt="">대기 취소</button>`
          : '<div class="p-empty">대기 중인 주점이 없어요</div>'}
        <button type="button" class="p-store-row" data-act="go" data-to="store"><img src="${A}default-department.png" alt=""><span><small>${B.STORE.dept}</small>${B.STORE.name}</span><em>대기 ${queue().length}팀</em></button></section>`;
    },
    store() {
      const waiting = B.myRank(ME) != null, n = queue().length;
      const S = B.STORE;
      return `${back('home', true)}<div class="p-swiper"><div class="p-swiper__track" id="nw-swiper">${S.banners.map((b, i) => `<img src="${b}" alt="주점 배너 ${i + 1}">`).join('')}</div>
          <div class="p-swiper__dots">${S.banners.map((_, i) => `<button type="button" data-act="banner" data-i="${i}" aria-label="배너 ${i + 1}" aria-pressed="${i === st.banner}"></button>`).join('')}</div></div>
        <section class="p-pad"><div class="p-store-head"><div><p class="p-dept">${S.dept}</p><h1 class="p-h22">${S.name}</h1></div><img src="${A}default-department.png" alt=""></div>
        ${n ? `<p class="p-badge">대기 ${n}팀</p>` : ''}
        <div class="p-info"><p><img src="${A}subtract.svg" alt="위치">${esc(S.location)}</p><p><img src="${A}clock.svg" alt="운영 시간">${esc(S.hours)}</p>
          <p class="p-desc">${esc(S.desc)}</p>
          <button type="button" class="p-notice" data-act="go" data-to="notice"><span>${esc(S.notice.title)}</span><img src="${A}arrow-right.svg" alt=""></button></div></section><div class="p-divider"></div>
        <section class="p-pad p-menu-sec">${menuList(false)}</section>${footer(waiting ? '대기 중이에요' : '대기하기', 'data-act="toParty"', waiting)}`;
    },
    notice: () => `${back('store')}<p class="p-navtitle">공지사항</p><section class="p-pad p-notice-body"><h1>${esc(B.STORE.notice.title)}</h1><p>${esc(B.STORE.notice.content)}</p></section>`,
    party: () => `${back('store')}<section class="p-pad p-form"><h1 class="p-h24">대기 등록을 위해<br>인원 수를 입력해주세요</h1>
        <div class="p-row"><span class="p-t20s">입장 인원</span>${qty(st.party, 'dec', 'inc', 1, 10)}</div></section>${footer('다음', 'data-act="go" data-to="summary"')}`,
    summary: () => `${back('party')}<section class="p-pad p-form"><h1 class="p-h24">현재 <b>${queue().length}</b>팀이<br>대기하고 있어요</h1>
        <dl class="p-box"><div><dt>부스</dt><dd>${B.STORE.name} / ${B.STORE.dept}</dd></div><div><dt>입장 인원</dt><dd>${st.party}명</dd></div></dl></section>
        <section class="p-guide"><h3>대기 등록 전 꼭 확인해주세요</h3><ul><li>원활한 운영을 위해 호출 시 10분 이내로 입장해주세요. 10분 이내 미입장 시 부스 이용이 어려울 수 있습니다.</li><li>부스와 부스를 이용하는 다른 고객에게 피해를 줄 수 있어 꼭 방문하실 분만 신중하게 웨이팅을 등록해주세요.</li><li>부득이하게 방문이 힘드신 경우, 나의 대기카드에서 웨이팅을 취소해주세요.</li></ul></section>
        ${footer(st.busy ? '<i class="p-spin"></i>' : '등록하기', 'data-act="register"', st.busy)}`,
    success: () => `<section class="p-center"><img src="${A}waitingSuccess.svg" width="227" height="150" alt=""><h1 class="p-h24">대기 등록 완료</h1><p>원활한 운영을 위해 호출시<br>10분 이내로 입장해주세요!</p></section>${footer('확인', 'data-act="go" data-to="home"')}`,

    /* 테이블 주문 */
    ostore: () => `<section class="p-pad p-ohead"><div><h1 class="p-h24">${B.STORE.name}</h1><p>${TABLE}번 테이블</p></div><button type="button" class="p-chip" data-act="go" data-to="odetails">주문내역</button></section>
        <div class="p-divider"></div><section class="p-pad p-menu-sec">${menuList(true)}</section>
        ${st.cart.length ? footer(`<i class="p-count">${count()}</i>${won(total())} 주문하기`, 'data-act="go" data-to="ocart"') : ''}`,
    omenu: () => `${back('ostore')}<img class="p-banner p-banner--menu" src="${st.pick.img || A + 'default-image-lg.png'}" alt="">
        <section class="p-pad"><h1 class="p-h22 p-menu-title">${esc(st.pick.name)}</h1></section>
        <div class="p-buy"><b>${won(st.pick.price * st.qty)}</b>${qty(st.qty, 'qdec', 'qinc')}</div>${footer('추가하기', 'data-act="addCart"')}`,
    ocart: () => st.cart.length
      ? `${back('ostore')}<p class="p-navtitle">장바구니</p><section class="p-pad p-cart-head"><h1 class="p-h22">주문 <b>총 ${st.cart.length}건</b></h1></section>
        <ul class="p-cart">${st.cart.map((c) => `<li><div><p class="p-cart-name">${esc(c.name)}</p><button type="button" data-act="rm" data-id="${c.menuId}" aria-label="${esc(c.name)} 삭제"><img src="${A}close.svg" alt=""></button></div>
          <div><b>${won(c.price)}</b>${qty(c.quantity, `cdec" data-id="${c.menuId}`, `cinc" data-id="${c.menuId}`)}</div></li>`).join('')}</ul>
        <button type="button" class="p-more" data-act="go" data-to="ostore">+ 메뉴 추가하기</button>${footer(`${won(total())} 주문하기`, 'data-act="checkout"')}`
      : `${back('ostore')}<section class="p-center"><p>아직 담긴 메뉴가 없어요.<br>마음에 드는 메뉴를 담아주세요!</p></section>${footer('추가하기', 'data-act="go" data-to="ostore"')}`,
    oremit: () => `${back('ocart')}<p class="p-navtitle">주문하기</p><section class="p-pad p-remit"><p class="p-remit-sum">주문 ${st.cart.length}건 <span>${won(total())} · ${count()}개</span></p></section><div class="p-divider"></div>
        <section class="p-pad p-remit"><h2 class="p-t18">입금자명</h2><p class="p-hint">이후 주문은 동일한 입금자명으로 들어가요</p>
          <input type="text" id="nw-name" placeholder="입금자명 입력" maxlength="20" value="${esc(st.depositor)}" autocomplete="off">${st.nameErr ? `<p class="p-err">${st.nameErr}</p>` : ''}
          <h2 class="p-t18 p-gap">송금 수단</h2><div class="p-paybox"><p>간편 송금</p>${[['카카오페이', 'kakaoPay.png', 42, 18], ['토스', 'tossPay.png', 46, 16], ['네이버페이', 'naverPay.png', 43, 15]].map(([p, f, w, h]) => `<button type="button" role="radio" aria-checked="${st.pay === p}" aria-label="${p}" data-act="pay" data-p="${p}"><i></i><img src="${A}${f}" width="${w}" height="${h}" alt="">${p}</button>`).join('')}</div>
          <div class="p-total"><span>결제 금액</span><b>${won(total())}</b></div></section>${footer(`${won(total())} 이체하기`, 'data-act="toWait"')}`,
    owait: () => `${back('oremit')}${center('remittanceWait.webp', '<h1 class="p-h24">이체가 진행되고 있어요</h1>', '아직 주문이 완료되지 않았어요<br>이체를 완료하셨다면 버튼을 눌러주세요')}${footer(st.busy ? '<i class="p-spin"></i>' : '이체했어요', 'data-act="order"', st.busy)}`,
    osuccess: () => `${center('orderSuccess.webp', '<h1 class="p-h24">주문이 접수되었어요!</h1>', '입금 확인 후 조리를 진행할게요.<br>조금만 기다려 주세요.', '<button type="button" class="p-outline" data-act="go" data-to="odetails">주문내역 확인</button>')}${footer('확인', 'data-act="go" data-to="ostore"')}`,
    odetails() {
      const os = myOrders().slice().reverse();
      return os.length
        ? `${back('ostore')}<section class="p-orders"><h1 class="p-t20b">주문내역 ${os.length}건</h1>${os.map((o) => `<article><h2 class="${o.status === 'COOKED' ? 'is-done' : ''}">${STATUS[o.status]}</h2><time>${hhmm(o.createdAt)}</time>
          <ul>${o.items.map((i) => `<li><span>${esc(i.name)}</span><span>${i.quantity}</span></li>`).join('')}</ul><p><span>결제금액</span><b>${won(o.totalPrice)}</b></p></article>`).join('')}</section>`
        : `${back('ostore')}<section class="p-center"><p>주문 내역이 없습니다.<br>첫 주문을 시작해 보세요.</p></section>${footer('주문하기', 'data-act="go" data-to="ostore"')}`;
    },
  };
  const modals = {
    cancel: () => `<h2>대기를 취소할까요?</h2><p>삭제 후에는 대기 정보가 복구되지 않아요.</p><div><button type="button" data-act="closeModal">취소</button><button type="button" class="is-primary" data-act="cancel">확인</button></div>`,
    sold: () => `<h2>현재 ${esc(st.soldNames.join(', '))}는(은) 품절 상태입니다.</h2><p></p><div class="is-one"><button type="button" data-act="dropSold">주문 계속하기</button></div>`,
  };

  /* ── 운영자 화면 (태블릿) ── */
  const pill = (act, key, cur, label, n) => `<button type="button" class="ad-pill" data-act="${act}" data-k="${key}" aria-pressed="${cur === key}">${label}${n != null ? ` <b>${n}</b>` : ''}</button>`;
  const tbl = (o) => `<i class="ad-tbl">${o.tableId}</i>`;
  const menuImg = (m) => m.img || A + 'menu_placeholder.png';
  const adminPages = {
    wait() {
      const rows = queue().map((e, i) => ({ e, i, r: B.active(e.m) })).filter((x) => x.r);
      const shown = rows.filter((x) => st.wf === 'ALL' || x.r.status === st.wf);
      const n = (s) => rows.filter((x) => x.r.status === s).length;
      return `<div class="ad-bar"><p class="ad-title">대기 접수 <b>on</b></p><div>${pill('wf', 'ALL', st.wf, '전체', rows.length)}${pill('wf', 'WAITING', st.wf, '대기 중', n('WAITING'))}${pill('wf', 'CALLING', st.wf, '호출 중', n('CALLING'))}</div></div>
        <ul class="ad-cards">${shown.map(({ e, i, r }) => `<li>
          <header><b>#0${i + 1}번</b>${e.m === String(ME) ? '<em>체험 중인 손님</em>' : ''}<span>${hhmm(r.requestedAt)} · ${Math.max(0, Math.floor((Date.now() - r.requestedAt) / 60000))}분 대기 중</span><button type="button" data-act="acancel" data-m="${e.m}" aria-label="대기 취소">✕</button></header>
          <dl><div><dt>인원</dt><dd>${r.partySize}명</dd></div><div><dt>이름</dt><dd>${esc(r.name)}</dd></div><div><dt>전화번호</dt><dd>010-****-****</dd></div></dl>
          <footer>${r.status === 'CALLING'
            ? `<span class="ad-cd"><img src="${A}alarm.svg" alt=""><b data-cd="${r.calledAt + 600000}"></b></span>`
            : `<button type="button" class="ad-call" data-act="call" data-m="${e.m}"><img src="${A}Call.svg" alt="">호출</button>`}
            <button type="button" class="ad-enter" data-act="enter" data-m="${e.m}"><img src="${A}door_open.svg" alt="">입장</button></footer></li>`).join('') || '<li class="ad-none">해당하는 대기 팀이 없습니다</li>'}</ul>`;
    },
    order() {
      const by = (s) => B.db.orders.filter((o) => o.status === s);
      const wait = by('WAITING_FOR_PAYMENT'), cook = by('COOKING'), done = by('COOKED');
      const tabs = `<div class="ad-bar"><div>${pill('of', 'ING', st.of, '진행 중', wait.length + cook.length)}${pill('of', 'DONE', st.of, '조리 완료', done.length)}</div></div>`;
      if (st.of === 'DONE') return tabs + `<div class="ad-col"><p class="ad-thead ad-thead--done"><span>테이블</span><span>입금자</span><span>메뉴</span><span>금액</span><span>주문 시간</span><span></span></p><ul class="ad-rows ad-rows--done">${done.map((o) => `<li>${tbl(o)}<span>${esc(o.depositorName)}</span><span>${esc(o.items[0].name)}${o.items.length > 1 ? ` 외 ${o.items.length - 1}개` : ''}</span><span>${won(o.totalPrice)}</span><span>${hhmm(o.createdAt)}</span><button type="button" class="is-line" data-act="ostatus" data-id="${o.id}" data-to="COOKING">주문 복구</button></li>`).join('') || '<li class="ad-none">조리 완료된 주문이 없어요!</li>'}</ul></div>`;
      return tabs + `<div class="ad-cols">
        <div class="ad-col"><h4>입금 대기 <b>${wait.length}</b></h4><p class="ad-thead"><span>테이블</span><span>입금 내역</span></p><ul class="ad-rows">${wait.map((o) => `<li>${tbl(o)}<div><time>${hhmm(o.createdAt)}</time><p>${esc(o.depositorName)} <s></s> ${won(o.totalPrice)}</p></div><button type="button" data-act="ostatus" data-id="${o.id}" data-to="COOKING">입금 확인</button></li>`).join('') || '<li class="ad-none">아직 입금 대기 중인 주문이 없어요!</li>'}</ul></div>
        <div class="ad-col"><h4>조리 중 <b>${cook.length}</b></h4><p class="ad-thead"><span>테이블</span><span>메뉴</span><span>수량</span></p><ul class="ad-rows">${cook.map((o) => `<li>${tbl(o)}<div>${o.items.map((i) => `<p class="ad-line"><span>${esc(i.name)}</span><b>${i.quantity}</b></p>`).join('')}</div><button type="button" data-act="ostatus" data-id="${o.id}" data-to="COOKED">조리 완료</button></li>`).join('') || '<li class="ad-none">조리 중인 주문이 없어요!</li>'}</ul></div></div>`;
    },
    booth() {
      const d = st.draft || (st.draft = { desc: B.STORE.desc, title: B.STORE.notice.title, content: B.STORE.notice.content });
      return `<div class="ad-bar"><p class="ad-title">부스 정보</p><button type="button" class="ad-save" data-act="saveStore">저장하기</button></div>
        <div class="ad-form"><div class="ad-banners">${B.STORE.banners.map((b) => `<img src="${b}" alt="">`).join('')}</div>
          <label>부스 소개<textarea data-draft="desc" rows="5" maxlength="250">${esc(d.desc)}</textarea></label>
          <label>공지사항 제목<input type="text" data-draft="title" maxlength="20" value="${esc(d.title)}"></label>
          <label>공지사항 내용<textarea data-draft="content" rows="4" maxlength="200">${esc(d.content)}</textarea></label></div>`;
    },
    menu: () => `<div class="ad-bar"><p class="ad-title">메뉴</p></div><p class="ad-sub"><span>${B.db.menus.length}개의 메뉴</span><span>품절 표시</span></p>
      <ul class="ad-menus">${B.db.menus.map((m) => `<li><img src="${menuImg(m)}" alt=""><span>${esc(m.name)}<small>${won(m.price)}</small></span>
        <button type="button" class="ad-toggle" role="switch" aria-checked="${m.soldOut}" aria-label="${esc(m.name)} 품절 표시" data-act="soldout" data-id="${m.id}"></button></li>`).join('')}</ul>`,
  };
  function drawAdmin() {
    const y = admin.scrollTop;
    admin.innerHTML = `<nav class="ad-nav"><img src="${A}logo.svg" alt="NoWait" width="58" height="24"><span>${B.STORE.name}</span><div>${pill('tab', 'wait', st.tab, '웨이팅')}${pill('tab', 'order', st.tab, '주문')}${pill('tab', 'menu', st.tab, '메뉴')}${pill('tab', 'booth', st.tab, '부스')}</div></nav><div class="ad-page">${adminPages[st.tab]()}</div>`;
    admin.scrollTop = y;
    tick();
  }
  // 호출 뒤 10분 카운트다운 숫자만 매초 갱신
  function tick() {
    root.querySelectorAll('[data-cd]').forEach((el) => { const left = Math.max(0, Math.ceil((+el.dataset.cd - Date.now()) / 1000)); el.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; });
  }

  /* ── 서버 상태판 ── */
  const none = '<li class="is-none">(없음)</li>';
  function drawState() {
    const cacheBlock = `<div><h4>user-api 메뉴 캐시</h4><ul><li>HIT <b>${B.stats.hit}</b> · MISS <b>${B.stats.miss}</b></li><li>DB 메뉴 쿼리 <b>${B.db.menuQueries}</b>번</li><li>무효화 구독 <b class="${B.isSubscribed() ? '' : 'is-bad'}">${B.isSubscribed() ? '연결됨' : '끊김'}</b></li></ul></div>`;
    const pubsub = `<button type="button" data-act="pubsub">${B.isSubscribed() ? 'Pub/Sub 연결 끊기' : 'Pub/Sub 다시 연결'}</button>`;
    if (st.flow === 'wait') {
      const keys = B.redis.keys('idempotency:');
      $('#nw-state').innerHTML = `<div><h4>Redis Sorted Set <code>${B.queueKey}</code></h4><ol>${queue().map((e) => `<li class="${e.m === String(ME) ? 'is-me' : ''}"><code>user:${e.m}</code>${e.m === String(ME) ? ' 나' : ''}</li>`).join('') || none}</ol></div>
        <div><h4>멱등 키</h4><ul>${keys.map((k) => `<li><code>…${esc(k.k.slice(-8))}</code> ${k.v.endsWith('::IN-PROGRESS') ? '처리 중' : '완료 응답 저장'} · TTL ${Math.max(0, Math.ceil((k.exp - Date.now()) / 1000))}초</li>`).join('') || none}</ul></div>${cacheBlock}`;
      $('#nw-actions').innerHTML = `<button type="button" data-act="burst" ${B.myRank(ME) != null || st.busy ? 'disabled' : ''}>등록하기를 10번 연타</button><button type="button" data-act="replay" ${!st.last || st.busy ? 'disabled' : ''}>같은 키로 한 번 더 보내기</button>${pubsub}`;
    } else {
      const pop = B.redis.zrange(B.popularKey()).reverse();
      $('#nw-state').innerHTML = `<div><h4>MySQL <code>user_order</code></h4><ul>${B.db.orders.map((o) => `<li><code>#${o.id}</code> ${STATUS[o.status]}<br><small>서명 ${o.signature}</small></li>`).join('') || none}</ul></div>
        <div><h4>인기 메뉴 Sorted Set <code>${B.popularKey()}</code></h4><ol>${pop.map((e) => `<li>${esc(e.m)} <b>${e.score}</b></li>`).join('') || '<li class="is-none">(조리 완료된 주문이 생기면 집계)</li>'}</ol></div>${cacheBlock}`;
      $('#nw-actions').innerHTML = `<button type="button" data-act="double" ${st.busy ? 'disabled' : ''}>같은 주문을 연달아 2번 보내기</button><button type="button" data-act="skip">입금 대기 주문을 바로 조리 완료로</button>${pubsub}`;
    }
  }

  function draw() {
    const y = phone.scrollTop;
    phone.innerHTML = screens[st.screen]() + (st.modal ? `<div class="p-modal"><div>${modals[st.modal]()}</div></div>` : '') + (st.toast ? `<p class="p-toast">${st.toast}</p>` : '');
    phone.scrollTop = phone.dataset.screen === st.screen ? y : 0;
    phone.dataset.screen = st.screen;
    const sw = phone.querySelector('#nw-swiper');
    if (sw) { sw.scrollLeft = st.banner * sw.clientWidth; sw.addEventListener('scroll', () => { const i = Math.round(sw.scrollLeft / sw.clientWidth); if (i !== st.banner) { st.banner = i; phone.querySelectorAll('.p-swiper__dots button').forEach((b, k) => b.setAttribute('aria-pressed', k === i)); } }, { passive: true }); }
    root.querySelectorAll('[data-act="flow"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === st.flow));
    drawAdmin();
    drawState();
  }
  const loadMenus = (why) => { log('http', `GET /v1/stores/${B.STORE.code}/menus${why ? '  (' + why + ')' : ''}`); st.menus = B.getMenus(); };
  const toast = (t) => { st.toast = t; setTimeout(() => { st.toast = ''; draw(); }, 2200); };

  /* ── 요청 보내기 ── */
  async function send(n, key, party) {
    st.busy = true; draw();
    const rs = await Promise.allSettled(Array.from({ length: n }, () => B.registerWaiting(ME, party, key)));
    const ok = rs.filter((r) => r.status === 'fulfilled'), by = {};
    rs.forEach((r) => { const c = r.status === 'fulfilled' ? 200 : r.reason.status; by[c] = (by[c] || 0) + 1; });
    log('http', '← 응답 ' + Object.entries(by).map(([c, k]) => `${c} ${k}건`).join(', '));
    st.busy = false;
    if (ok[0]) { st.waiting = ok[0].value; st.last = { key, party }; }
    return ok.length > 0;
  }
  async function order(items, name) {
    try {
      const o = await B.createOrder(TABLE, name, items, items.reduce((n, i) => n + B.db.menus.find((m) => m.id === i.menuId).price * i.quantity, 0));
      log('http', `← 응답 201 (주문 #${o.id}, 입금 대기)`);
      return true;
    } catch (e) { log('http', `← 응답 ${e.status} ${e.message}`); return false; }
  }
  const cartItems = () => st.cart.map((c) => ({ menuId: c.menuId, quantity: c.quantity }));
  const cartLine = (id) => st.cart.find((c) => c.menuId === +id);

  const acts = {
    tab: (t) => { st.tab = t.dataset.k; },
    banner: (t) => { st.banner = +t.dataset.i; },
    saveStore: () => { const d = st.draft; B.updateStore({ desc: d.desc, notice: { title: d.title.trim() || '공지', content: d.content } }); log('http', '← 응답 200 · 손님 화면의 주점 상세에 바로 반영'); },
    wf: (t) => { st.wf = t.dataset.k; },
    of: (t) => { st.of = t.dataset.k; },
    call: (t) => { B.call(t.dataset.m); log('http', '← 응답 200'); },
    acancel: (t) => { B.adminCancel(t.dataset.m); if (t.dataset.m === String(ME)) { st.waiting = null; st.last = null; if (st.flow === 'wait') st.screen = 'home'; } },
    flow: (t) => { st.flow = t.dataset.f; st.tab = st.flow; st.screen = st.flow === 'wait' ? 'home' : 'ostore'; st.modal = null; if (st.flow === 'order') { log('http', `QR 접속 /${B.STORE.code}/${TABLE} → ${TABLE}번 테이블`); loadMenus(); } },
    go: (t) => { st.screen = t.dataset.to; if (st.screen === 'store' || st.screen === 'ostore') loadMenus(); },
    toParty: () => { st.party = 1; st.screen = 'party'; },
    inc: () => { st.party++; }, dec: () => { st.party--; },
    refresh: () => { log('http', 'GET /v1/users/me/waitings'); log('redis', `ZRANK ${B.queueKey} ${ME} → ${B.myRank(ME)}`); },
    register: async () => { if (await send(1, crypto.randomUUID(), st.party)) st.screen = 'success'; },
    burst: async () => { log('user-api', '같은 Idempotency-Key 로 등록 요청 10건이 동시에 도착'); if (await send(10, crypto.randomUUID(), st.party)) st.screen = 'success'; },
    replay: async () => { log('user-api', '이미 끝난 요청과 같은 키로 한 번 더 도착'); await send(1, st.last.key, st.last.party); },
    askCancel: () => { st.modal = 'cancel'; }, closeModal: () => { st.modal = null; },
    cancel: () => { B.cancelWaiting(ME); st.modal = null; st.waiting = null; st.last = null; },
    enter: (t) => { B.enter(t.dataset.m); if (t.dataset.m === String(ME)) { st.waiting = null; st.last = null; if (st.flow === 'wait' && st.screen !== 'store') st.screen = 'home'; } },
    soldout: (t) => { B.toggleSoldOut(+t.dataset.id); loadMenus('손님 화면이 메뉴를 다시 조회'); },
    pubsub: () => { B.setSubscribed(!B.isSubscribed()); if (B.isSubscribed()) loadMenus('손님 화면이 메뉴를 다시 조회'); },

    menu: (t) => { st.pick = st.menus.find((m) => m.id === +t.dataset.id); st.qty = 1; st.screen = 'omenu'; },
    qinc: () => { st.qty++; }, qdec: () => { st.qty--; },
    addCart: () => { const c = cartLine(st.pick.id); if (c) c.quantity += st.qty; else st.cart.push({ menuId: st.pick.id, name: st.pick.name, price: st.pick.price, quantity: st.qty }); st.screen = 'ostore'; toast('메뉴를 담았습니다'); },
    cinc: (t) => { cartLine(t.dataset.id).quantity++; }, cdec: (t) => { cartLine(t.dataset.id).quantity--; },
    rm: (t) => { st.cart = st.cart.filter((c) => c.menuId !== +t.dataset.id); },
    checkout: () => { // 프론트가 주문 전에 메뉴를 다시 조회해 품절을 확인 (이 조회는 캐시를 탐)
      loadMenus('주문 전 품절 확인');
      st.soldNames = st.cart.filter((c) => st.menus.find((m) => m.id === c.menuId)?.soldOut).map((c) => c.name);
      if (st.soldNames.length) st.modal = 'sold'; else st.screen = 'oremit';
    },
    dropSold: () => { st.cart = st.cart.filter((c) => !st.soldNames.includes(c.name)); st.modal = null; },
    pay: (t) => { st.pay = t.dataset.p; },
    toWait: () => { const n = st.depositor.trim(); st.nameErr = !n ? '입금자명을 입력해주세요' : n.length > 10 ? '입금자명은 10자 이하로 입력해주세요' : ''; if (!st.nameErr) st.screen = 'owait'; },
    order: async () => {
      st.busy = true; draw();
      const ok = await order(cartItems(), st.depositor.trim());
      st.busy = false;
      if (ok) { st.cart = []; st.screen = 'osuccess'; } else toast('주문에 실패했습니다. 다시 시도해 주세요');
    },
    double: async () => {
      const items = st.cart.length ? cartItems() : [{ menuId: (B.db.menus.find((m) => !m.soldOut) || B.db.menus[0]).id, quantity: 1 }];
      log('user-api', '같은 테이블에서 같은 장바구니 주문이 연달아 2번 도착');
      st.busy = true; draw();
      const first = await order(items, st.depositor.trim() || '체험손님');
      await order(items, st.depositor.trim() || '체험손님');
      st.busy = false;
      if (first) { st.cart = []; st.screen = 'osuccess'; }
    },
    skip: () => {
      const o = B.db.orders.find((x) => x.status === 'WAITING_FOR_PAYMENT');
      if (!o) return log('admin-api', '입금 대기 중인 주문이 없습니다. 먼저 휴대폰에서 주문을 넣어 보세요');
      try { B.updateOrderStatus(o.id, 'COOKED'); } catch (e) { log('http', `← 거절 ${e.message}`); }
    },
    ostatus: (t) => { try { B.updateOrderStatus(+t.dataset.id, t.dataset.to); log('http', '← 응답 200'); } catch (e) { log('http', `← 거절 ${e.message}`); } },
  };
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    await acts[t.dataset.act](t);
    draw();
  });
  root.addEventListener('input', (e) => { if (e.target.id === 'nw-name') st.depositor = e.target.value; else if (e.target.dataset.draft) st.draft[e.target.dataset.draft] = e.target.value; }); // 입력 중에는 다시 그리지 않음

  loadMenus();
  logEl.replaceChildren();
  log('user-api', '휴대폰이나 운영자 화면을 누르면 여기에 서버가 한 일이 나옵니다');
  draw();
  setInterval(() => { tick(); if (st.flow === 'wait' && !root.querySelector('#nw-actions:hover')) drawState(); }, 1000); // 멱등 키 TTL 초 표시
})();
