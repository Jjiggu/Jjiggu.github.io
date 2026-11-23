/* NoWait 체험: 휴대폰 화면을 누르면 브라우저 안의 작은 백엔드 모델이 실제 백엔드 코드와 같은 순서로 움직입니다.
   - 멱등 처리: IdempotencyService.execute (SET NX → action → 커밋 뒤 응답 저장, 처리 중 1분 / 완료 3분)
   - 대기열: Redis Sorted Set (ZADD NX, ZRANK, ZREM)
   - 메뉴 캐시: user-api 의 Caffeine 로컬 캐시 + Redis Pub/Sub 무효화, 재구독 시 전체 비움
   ponytail: Redis·MySQL 은 Map 과 배열로 흉내 낸 모델. 주점·메뉴·대기 팀은 예시 데이터.
   자체 점검: `node nowait-demo.js` */
(() => {
  const STORE = {
    id: 7, code: 'nowait-pocha', name: '노웨잇 포차', dept: '예시 데이터', isActive: true, // isActive: 대기 접수 on/off
    location: '예시대학교 중앙광장', hours: '18:00 - 24:00',
    desc: '안녕하세요! 축제 기간에만 여는 노웨잇 포차입니다.\n\n줄 서지 말고 원격으로 대기하세요.\n자리에 앉으면 QR 로 바로 주문할 수 있어요.',
    notice: { title: '입장 시 신분증 검사 필수', content: '주류를 판매하는 부스라 입장할 때 신분증을 확인합니다.\n호출 후 10분 안에 오지 않으면 대기가 취소될 수 있어요.' },
    banners: ['assets/nowait/banner/open.svg', 'assets/nowait/banner/menu.svg', 'assets/nowait/banner/queue.svg'], // 직접 그린 주점 홍보 배너
  };
  // ponytail: 두 번째 주점은 목록·상세만 보이는 예시(대기 접수 마감). 서버 모델은 STORE 하나만 다룸. 여러 주점을 실제로 돌리려면 queueKey·캐시 키를 주점별로.
  const OTHER = {
    id: 12, code: 'moonlight', name: '달빛 주막', dept: '예시 데이터', teams: 12,
    location: '예시대학교 공학관 앞마당', hours: '18:00 - 23:00',
    desc: '공과대학 학생회가 여는 달빛 주막입니다.\n\n오늘은 대기 접수가 마감됐어요.',
    banners: ['assets/nowait/banner/moon.svg'],
    menus: [{ id: 1, name: '해물파전', price: 12000 }, { id: 2, name: '두부김치', price: 10000 }, { id: 3, name: '계란말이', price: 8000 }],
  };
  const CACHE_TTL = 5 * 60_000, IN_PROGRESS_TTL = 60_000, COMPLETED_TTL = 180_000;

  function createBackend({ emit = () => {}, wait = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), txMs = 300 } = {}) {
    /* ── Redis ── */
    const str = new Map(); // key → { v, exp }
    const zsets = new Map(); // key → [{ m, score }] (score 오름차순)
    const alive = (k) => { const e = str.get(k); if (e && e.exp <= now()) str.delete(k); return str.get(k); };
    const redis = {
      setNX(k, v, ttl) { if (alive(k)) { emit('redis', `SET ${k} NX → nil (이미 있음)`); return false; } str.set(k, { v, exp: now() + ttl }); emit('redis', `SET ${k} NX EX ${ttl / 1000} → OK`); return true; },
      set(k, v, ttl) { str.set(k, { v, exp: now() + ttl }); emit('redis', `SET ${k} EX ${ttl / 1000}`); },
      get(k) { return alive(k)?.v ?? null; },
      del(k) { str.delete(k); emit('redis', `DEL ${k}`); },
      zaddNX(k, score, m) { const z = zsets.get(k) || zsets.set(k, []).get(k); if (z.some((e) => e.m === m)) { emit('redis', `ZADD ${k} NX ${m} → 0`); return 0; } z.push({ m, score }); z.sort((a, b) => a.score - b.score); emit('redis', `ZADD ${k} NX ${score} ${m} → 1`); return 1; },
      zrank(k, m) { const i = (zsets.get(k) || []).findIndex((e) => e.m === m); return i < 0 ? null : i; },
      zrem(k, m) { const z = zsets.get(k) || []; const i = z.findIndex((e) => e.m === m); if (i >= 0) z.splice(i, 1); emit('redis', `ZREM ${k} ${m} → ${i >= 0 ? 1 : 0}`); return i >= 0; },
      zincrby(k, inc, m) { const z = zsets.get(k) || zsets.set(k, []).get(k); const e = z.find((x) => x.m === m); if (e) e.score += inc; else z.push({ m, score: inc }); z.sort((a, b) => a.score - b.score); emit('redis', `ZINCRBY ${k} ${inc} ${m}`); },
      zrange(k) { return (zsets.get(k) || []).slice(); },
      keys(prefix) { return [...str.keys()].filter((k) => k.startsWith(prefix) && alive(k)).map((k) => ({ k, ...str.get(k) })); },
    };

    /* ── MySQL ── */
    const db = {
      reservations: [],
      menus: [
        { id: 1, name: '치즈김치전', price: 9000, soldOut: false, img: 'assets/nowait/menu/kimchijeon.jpg' },
        { id: 2, name: '어묵탕', price: 12000, soldOut: false, img: 'assets/nowait/menu/eomuk.jpg' },
        { id: 3, name: '떡볶이', price: 8000, soldOut: false, img: 'assets/nowait/menu/tteok.jpg' },
        { id: 4, name: '콘치즈', price: 7000, soldOut: false, img: 'assets/nowait/menu/corn.jpg' },
      ],
      menuQueries: 0, seq: 0, orders: [], orderSeq: 0,
    };
    const queueKey = `waiting:${STORE.id}`;

    /* ── user-api: 멱등 처리 ── */
    class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
    async function idempotent(scope, idemKey, request, action) {
      const key = `idempotency:${scope}:${idemKey}`, fp = JSON.stringify(request);
      if (!redis.setNX(key, fp + '::IN-PROGRESS', IN_PROGRESS_TTL)) {
        const saved = redis.get(key);
        if (saved == null) throw new HttpError(409, '처리 중인 요청');
        const [f, body] = saved.split('::');
        if (f !== fp) throw new HttpError(422, '같은 키, 다른 요청 본문');
        if (body === 'IN-PROGRESS') throw new HttpError(409, '처리 중인 요청');
        emit('user-api', '저장된 응답 그대로 반환 (로직 재실행 없음)');
        return JSON.parse(body);
      }
      let res;
      try { res = await action(); } catch (e) { redis.del(key); throw e; } // 실패한 요청은 같은 키로 다시 시도 가능
      redis.set(key, fp + '::' + JSON.stringify(res), COMPLETED_TTL); // action 이 돌아온 뒤 = 커밋 뒤
      return res;
    }

    /* ── user-api: 대기 ── */
    async function registerWaiting(userId, partySize, idemKey, { failCommit = false } = {}) {
      emit('http', `POST /v2/waiting/${STORE.code}  Idempotency-Key: ${idemKey.slice(0, 8)}`);
      return idempotent(`waiting:register:${userId}:${STORE.code}`, idemKey, { partySize }, async () => {
        emit('mysql', 'BEGIN · INSERT INTO reservation (status=WAITING)');
        await wait(txMs);
        if (failCommit) { emit('mysql', 'ROLLBACK (커밋 실패)'); throw new HttpError(500, '커밋 실패'); }
        const waitingNumber = `${STORE.id}-${String(++db.seq).padStart(4, '0')}`;
        db.reservations.push({ waitingNumber, userId, partySize, status: 'WAITING', name: '체험 손님', requestedAt: now() });
        emit('mysql', 'COMMIT');
        redis.zaddNX(queueKey, now(), String(userId)); // 커밋 뒤 이벤트 리스너
        return { waitingNumber, partySize };
      });
    }
    function cancelWaiting(userId) {
      emit('http', `DELETE /v2/waiting/${STORE.code}`);
      const r = active(userId);
      if (r) { r.status = 'CANCELLED'; emit('mysql', 'UPDATE reservation SET status=CANCELLED'); }
      redis.zrem(queueKey, String(userId));
    }
    const myRank = (userId) => redis.zrank(queueKey, String(userId));

    /* ── admin-api: 주점 소개글 · 공지 수정 ── */
    function toggleActive() { emit('http', `PATCH /admin/stores/toggle-active/${STORE.id}`); STORE.isActive = !STORE.isActive; return STORE.isActive; }
    function updateStore(patch) {
      emit('http', 'PATCH (admin) 주점 정보 수정');
      Object.assign(STORE, patch);
      emit('mysql', 'UPDATE stores SET description = ?, notice_title = ?, notice_content = ? · COMMIT');
    }
    /* ── admin-api: 호출 · 입장 · 취소 ── */
    const active = (m) => db.reservations.find((x) => String(x.userId) === String(m) && (x.status === 'WAITING' || x.status === 'CALLING'));
    function call(member) {
      const r = active(member);
      emit('http', `PATCH /reservations/admin/update/${STORE.id}/${r.waitingNumber}  {"status":"CALLING"}`);
      r.status = 'CALLING'; r.calledAt = now();
      emit('mysql', 'UPDATE reservation SET status=CALLING');
    }
    function adminCancel(member) {
      const r = active(member);
      emit('http', `PATCH /reservations/admin/update/${STORE.id}/${r.waitingNumber}  {"status":"CANCELLED"}`);
      r.status = 'CANCELLED';
      emit('mysql', 'UPDATE reservation SET status=CANCELLED');
      redis.zrem(queueKey, String(member));
    }
    function enter(member) {
      const first = member ? { m: String(member) } : redis.zrange(queueKey)[0];
      if (!first) return null;
      emit('http', 'PATCH (admin) 대기 상태 → 입장');
      const r = active(first.m);
      if (r) r.status = 'CONFIRMED';
      emit('mysql', 'UPDATE reservation SET status=CONFIRMED');
      redis.zrem(queueKey, first.m);
      return first.m;
    }

    /* ── user-api: 메뉴 캐시 (Caffeine) ── */
    const cache = new Map(); // key → { v, at }
    const stats = { hit: 0, miss: 0 };
    let subscribed = true;
    function getMenus() {
      const key = String(STORE.id), e = cache.get(key);
      if (e && now() - e.at < CACHE_TTL) { stats.hit++; emit('user-api', '메뉴 캐시 HIT (DB 조회 없음)'); return e.v; }
      stats.miss++; db.menuQueries++;
      emit('user-api', '메뉴 캐시 MISS');
      emit('mysql', 'SELECT … FROM menus JOIN menu_images WHERE store_id = ?');
      const v = db.menus.map((m) => ({ ...m }));
      cache.set(key, { v, at: now() });
      return v;
    }
    /* ── admin-api: 품절 토글 → 커밋 뒤 PUBLISH ── */
    function toggleSoldOut(menuId) {
      const m = db.menus.find((x) => x.id === menuId);
      m.soldOut = !m.soldOut;
      emit('http', `PATCH (admin) 메뉴 ${m.name} 품절=${m.soldOut}`);
      emit('mysql', 'UPDATE menus SET is_sold_out = ? · COMMIT');
      emit('redis', `PUBLISH cache:menus invalidate:${STORE.id} → 구독자 ${subscribed ? 1 : 0}`);
      if (subscribed) { cache.delete(String(STORE.id)); emit('user-api', '무효화 메시지 수신 → 로컬 캐시에서 해당 주점 키 삭제'); }
      else emit('user-api', '구독 연결이 끊겨 무효화 메시지 유실 (Pub/Sub 은 Fire-and-Forget, 재전송 없음)');
      return m.soldOut;
    }
    function setSubscribed(on) {
      subscribed = on;
      if (on) { cache.clear(); emit('user-api', '재구독 성공 → 로컬 캐시 전체 비움 (방어적 캐시 클리어)'); }
      else emit('user-api', 'Redis Pub/Sub 연결 끊김');
    }

    /* ── user-api: 테이블 주문 (OrderService.createOrder 와 같은 순서) ── */
    const signatureOf = (tableId, items) => { // 실제 코드는 MD5. 여기서는 같은 입력을 짧은 해시로
      const raw = `${STORE.code}-${tableId}-` + items.slice().sort((a, b) => a.menuId - b.menuId).map((i) => `${i.menuId}:${i.quantity}`).join(',');
      let h = 2166136261;
      for (const c of raw) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16).padStart(8, '0');
    };
    async function createOrder(tableId, depositorName, items, totalPrice) {
      emit('http', `POST /v1/stores/${STORE.code}/tables/${tableId}/orders`);
      if (!items.length) throw new HttpError(400, 'order002 주문 항목이 비어 있음');
      if (!depositorName.trim()) throw new HttpError(400, 'order001 입금자명 없음');
      const signature = signatureOf(tableId, items);
      emit('user-api', `장바구니 signature ${signature} = 해시(주점-테이블-메뉴:수량)`);
      emit('mysql', 'SELECT EXISTS(… WHERE signature = ? AND created_at > 2초 전)');
      if (db.orders.some((o) => o.signature === signature && now() - o.createdAt < 2000)) throw new HttpError(400, 'order003 2초 내 같은 장바구니 중복 주문');
      emit('mysql', 'BEGIN · INSERT INTO user_order (status=WAITING_FOR_PAYMENT)');
      await wait(txMs);
      emit('mysql', 'SELECT … FROM menus WHERE id IN (…)  ← 캐시를 거치지 않고 DB 에서 품절 재확인');
      const lines = items.map((i) => ({ ...i, ...db.menus.find((m) => m.id === i.menuId) }));
      const sold = lines.find((l) => l.soldOut);
      if (sold) { emit('mysql', 'ROLLBACK (앞서 INSERT 한 주문 포함)'); throw new HttpError(409, `menu012 ${sold.name} 품절`); }
      const order = { id: ++db.orderSeq, tableId, depositorName, totalPrice, signature, status: 'WAITING_FOR_PAYMENT', createdAt: now(), items: lines.map((l) => ({ menuId: l.menuId, name: l.name, quantity: l.quantity, price: l.price })) };
      db.orders.push(order);
      emit('mysql', 'INSERT INTO order_item … · COMMIT');
      return order;
    }
    /* ── admin-api: 주문 상태 (UserOrder.isValidTransition) ── */
    const NEXT = { WAITING_FOR_PAYMENT: ['COOKING', 'CANCELLED'], COOKING: ['COOKED', 'CANCELLED'], COOKED: ['COOKING', 'CANCELLED'], CANCELLED: [] };
    const popularKey = () => { const d = new Date(now()); return `popular:${STORE.id}:${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
    function updateOrderStatus(orderId, status) {
      emit('http', `PATCH /admin/orders/status/${orderId}  {"orderStatus":"${status}"}`);
      const o = db.orders.find((x) => x.id === orderId);
      if (!NEXT[o.status].includes(status)) throw new HttpError(0, `order009 ${o.status} → ${status} 는 허용되지 않는 상태 전이`);
      o.status = status;
      emit('mysql', `UPDATE user_order SET status = ${status} · COMMIT`);
      if (status === 'COOKED') { // 커밋 뒤 CookingCompleteEvent → 인기 메뉴 집계
        emit('admin-api', '커밋 후 조리 완료 이벤트 → 인기 메뉴 집계');
        o.items.forEach((i) => redis.zincrby(popularKey(), i.quantity, i.name));
      }
    }

    // 예시 대기 팀
    [[101, 2], [102, 4], [103, 3]].forEach(([u, p], i) => { db.reservations.push({ waitingNumber: `${STORE.id}-${String(++db.seq).padStart(4, '0')}`, userId: u, partySize: p, status: 'WAITING', name: '손님 ' + 'ABC'[i], requestedAt: now() - (3 - i) * 4 * 60_000 }); (zsets.get(queueKey) || zsets.set(queueKey, []).get(queueKey)).push({ m: String(u), score: now() - (3 - i) * 60_000 }); });

    return { STORE, OTHER, redis, db, stats, queueKey, registerWaiting, cancelWaiting, myRank, enter, call, adminCancel, updateStore, toggleActive, active, createOrder, updateOrderStatus, popularKey, getMenus, toggleSoldOut, setSubscribed, isSubscribed: () => subscribed, HttpError };
  }

  if (typeof document === 'undefined') {
    const assert = require('assert');
    (async () => {
      const b = createBackend({ txMs: 20 });
      // 같은 키 동시 10건 → 1건 실행, 9건 409
      const rs = await Promise.allSettled(Array.from({ length: 10 }, () => b.registerWaiting(1, 2, 'key-a')));
      assert.strictEqual(rs.filter((r) => r.status === 'fulfilled').length, 1);
      assert.strictEqual(rs.filter((r) => r.status === 'rejected' && r.reason.status === 409).length, 9);
      assert.strictEqual(b.db.reservations.filter((r) => r.userId === 1).length, 1);
      assert.strictEqual(b.myRank(1), 3);
      // 완료 뒤 같은 키 재시도 → 저장된 응답, 다시 실행하지 않음
      const again = await b.registerWaiting(1, 2, 'key-a');
      assert.strictEqual(again.waitingNumber, rs.find((r) => r.status === 'fulfilled').value.waitingNumber);
      assert.strictEqual(b.db.reservations.filter((r) => r.userId === 1).length, 1);
      // 같은 키, 다른 본문 → 422
      await assert.rejects(b.registerWaiting(1, 5, 'key-a'), (e) => e.status === 422);
      // 커밋 실패 → 키가 풀려 바로 재시도 가능
      await assert.rejects(b.registerWaiting(2, 2, 'key-b', { failCommit: true }), (e) => e.status === 500);
      assert.ok((await b.registerWaiting(2, 2, 'key-b')).waitingNumber);
      // 입장 처리 → 순번 당겨짐
      b.enter();
      assert.strictEqual(b.myRank(1), 2);
      // 호출 → 호출 중 상태에서도 입장 처리, 운영자 취소는 대기열에서 빠짐
      b.call(102); assert.strictEqual(b.active(102).status, 'CALLING');
      b.enter(102); assert.strictEqual(b.myRank(1), 1);
      b.adminCancel(103); assert.strictEqual(b.myRank(1), 0);
      // 캐시: 100번 조회에 DB 1번, 품절 토글 뒤 바로 반영
      for (let i = 0; i < 100; i++) b.getMenus();
      assert.strictEqual(b.db.menuQueries, 1);
      b.toggleSoldOut(1);
      assert.strictEqual(b.getMenus()[0].soldOut, true);
      // 연결이 끊긴 동안의 무효화는 놓치고, 재구독하면 전체를 비워 수습
      b.setSubscribed(false);
      b.toggleSoldOut(1);
      assert.strictEqual(b.getMenus()[0].soldOut, true, '끊긴 동안은 옛 값');
      b.setSubscribed(true);
      assert.strictEqual(b.getMenus()[0].soldOut, false);
      // 테이블 주문: 2초 안의 같은 장바구니는 거절, 품절은 DB 값으로 재확인해 409, 상태 전이 검증, 조리 완료 때 인기 메뉴 집계
      const items = [{ menuId: 2, quantity: 2 }];
      const o1 = await b.createOrder(5, '체험', items, 24000);
      await assert.rejects(b.createOrder(5, '체험', items, 24000), (e) => e.status === 400);
      b.setSubscribed(false); b.toggleSoldOut(3); // 캐시는 옛 값, DB 는 품절
      assert.strictEqual(b.getMenus()[2].soldOut, false);
      await assert.rejects(b.createOrder(5, '체험', [{ menuId: 3, quantity: 1 }], 8000), (e) => e.status === 409);
      assert.strictEqual(b.db.orders.length, 1);
      assert.throws(() => b.updateOrderStatus(o1.id, 'COOKED'), /order009/);
      b.updateOrderStatus(o1.id, 'COOKING'); b.updateOrderStatus(o1.id, 'COOKED');
      assert.deepStrictEqual(b.redis.zrange(b.popularKey()).map((e) => [e.m, e.score]), [['어묵탕', 2]]);
      console.log('OK');
    })();
    return;
  }

  window.NoWaitBackend = createBackend;
})();
