/* 선착순 쿠폰 시뮬레이션.
   녹화된 애니메이션이 아니라, 요청마다 읽기·쓰기 단계를 가상 시간(ms) 위에서 실제로 끼워 넣어 실행합니다.
   초과 지급·갱신 손실·메시지 유실은 그 끼어들기에서 그대로 생기고, 실행할 때마다 결과가 조금씩 다릅니다.
   - 동시성 제어(data.js 첫 번째 사례의 목록 그대로): READ COMMITTED·REPEATABLE READ / SERIALIZABLE / 낙관적 락 / 비관적 락 / SCARD+SADD / MULTI·EXEC / WATCH / Lua
   - write-behind: Pub/Sub / Redis Streams (도중에 Consumer 를 강제 종료)
   ponytail: 지연 시간은 손으로 맞춘 모델 값. 락을 쥐는 6.5ms 만 레포 EC2 실측(docs/learning/08).
   Pub/Sub 강제 종료 시점은 레포 실측 유실 범위(952~967건)에 들어오도록 잡은 구간에서 무작위. 실측 수치는 fact 문구에만 있음.
   비관적 락의 다음 차례는 InnoDB 의 CATS 를 '기다리는 10건 중 무작위'로 단순화. 응답 시간은 DB 확정 단계를 빼서 실측과 비교할 수 없어 화면에 내지 않음.
   자체 점검: `node sim.js` */
(() => {
  const STRATS = {
    rc: { group: 0, set: 'DB 격리 수준 조정', name: 'READ COMMITTED · REPEATABLE READ', store: 'MySQL', gate: '쿠폰 행을 읽고 +1', rec: 'issued_count', stock: 50, n: 50, spread: 8, slow: 300,
      fact: '재고 50장, 동시 요청 50건 테스트에서 성공 응답은 50건이었지만 실제 issued_count는 5~6' },
    serializable: { group: 0, set: 'DB 격리 수준 조정', name: 'SERIALIZABLE', store: 'MySQL', gate: 'S 락으로 읽고 X 락으로 갱신', rec: 'issued_count', stock: 50, n: 50, spread: 8, slow: 300,
      fact: 'S 락을 쥔 채 X 락으로 issued_count를 갱신하는 구조라 데드락 발생' },
    optimistic: { group: 0, set: 'DB 수준 락', name: '낙관적 락', store: 'MySQL', gate: 'version 이 같을 때만 갱신', rec: 'issued_count', stock: 50, n: 50, spread: 8, slow: 300,
      fact: 'Retry가 없으면 50건 중 6건만 지급, Retry하면 선착순이 보장되지 않아 제외' },
    pessimistic: { group: 0, set: 'DB 수준 락', name: '비관적 락', store: 'MySQL', gate: '쿠폰 행 락', rec: 'issued_count', stock: 100, n: 1000, spread: 150, slow: 3,
      fact: '락 대기로 단순 조회 p95가 10ms → 444ms, 응답 처리량 431~704 rps' },
    scard: { group: 0, set: 'Redis Set', name: 'SCARD + SADD', store: 'Redis', gate: '커맨드 3번 개별 실행', rec: 'Redis Set 크기', stock: 100, n: 1000, spread: 150, slow: 16,
      fact: 'SCARD와 SADD 사이에 다른 요청의 커맨드가 끼어들어 초과 지급이 발생해 제외' },
    multi: { group: 0, set: 'Redis Set', name: 'MULTI/EXEC', store: 'Redis', gate: 'MULTI/EXEC 로 묶어 실행', rec: 'Redis Set 크기', stock: 100, n: 1000, spread: 150, slow: 16,
      fact: '커맨드를 묶어 실행할 뿐 결과로 분기하지 못해, 초과 시 SREM으로 되돌리는 별도 Rollback 로직이 필요해 제외' },
    watch: { group: 0, set: 'Redis Set', name: 'WATCH', store: 'Redis', gate: 'WATCH 후 MULTI/EXEC', rec: 'Redis Set 크기', stock: 100, n: 1000, spread: 150, slow: 12,
      fact: '충돌한 요청을 재처리하면서 선착순이 보장되지 않아 제외' },
    lua: { group: 0, set: 'Lua Script', name: 'Lua Script', store: 'Redis', gate: '스크립트 1번', rec: 'Redis Set 크기', stock: 100, n: 1000, spread: 150, slow: 16,
      fact: '테스트 3회 모두 초과/중복 지급 0건, 응답 처리량 1,667~3,125 rps' },
    pubsub: { group: 1, set: 'write-behind', name: 'Pub/Sub', store: 'Redis', gate: 'Lua 후 PUBLISH', queue: '구독자 메모리 큐', stock: 1000, n: 1500, spread: 150, slow: 8, killAt: 220, restartAfter: 260,
      fact: 'subscriber 프로세스를 SIGKILL로 종료하자 지급 접수 성공 응답(202)을 받은 1,000건 중 967건이 유실' },
    stream: { group: 1, set: 'write-behind', name: 'Redis Streams', store: 'Redis', gate: 'Lua 한 번: XADD, SADD', queue: 'Stream', stock: 1000, n: 1500, spread: 150, slow: 40, killAt: 90, restartAfter: 36,
      fact: 'ACK를 받지 못한 메시지는 PEL에 보관되고, 재시작한 Consumer가 PEL부터 읽어 재처리. (쿠폰 ID, 회원 ID) UNIQUE 제약으로 쿠폰 중복 지급 방지' },
  };
  const AUTO = ['pessimistic', 'scard', 'lua', 'pubsub', 'stream'];

  /* ───────── 모델 (화면과 무관, node 에서도 실행됨) ───────── */
  // 같은 씨앗이면 같은 실행이 나오는 난수 (방문자의 요청을 미리 골라 두려고 씀)
  const seeded = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // 방문자의 요청 하나를 고름. 같은 씨앗으로 미리 돌려 보고 방식마다 보여 줄 장면이 생기는 요청을 고름
  // - Streams: 강제 종료 순간 Consumer 가 들고 있던(PEL) 요청 → 다시 처리돼 DB 에 저장됨
  // - Pub/Sub: 202 를 받고 메모리 큐에 있다가 사라지는 요청
  // - 나머지: 재고 안쪽 순번으로 일찍 도착한 요청 (먼저 와도 받는지 보려고)
  function pickMe(key, seed) {
    const S = STRATS[key];
    if (key === 'stream') { const s = createSim(key, seeded(seed)); s.advance(S.killAt - 0.01); const pel = s.q.pel; return pel.length ? pel[Math.floor(pel.length / 2)].id : 1; }
    if (key === 'pubsub') { const s = createSim(key, seeded(seed)); s.advance(Infinity); const lost = s.reqs.filter((r) => r.lost); return lost.length ? lost[lost.length >> 1].id : 1; }
    return 1 + Math.floor(seeded(seed ^ 0x5bd1e995)() * Math.max(1, Math.floor(S.stock * 0.6)));
  }

  function createSim(key, rand = Math.random, meId = 0) {
    const S = STRATS[key], isAsync = S.group === 1;
    const st = { now: 0, recorded: 0, version: 0, success: 0, done: 0, sold: 0, fail: 0, stored: 0, lost: 0, redelivered: 0, rollbacks: 0, retries: 0, dl: null, alive: true, firstBad: null, sys: 0 };
    const trace = []; // { t, id, kind: read|write|lock|eval|sys, text, bad }
    const tr = (r, kind, text, bad) => { trace.push({ t: st.now, id: r ? r.id : 0, kind, text, bad }); if (kind === 'sys') st.sys++; if (bad && st.firstBad == null) st.firstBad = trace.length - 1; };
    const heap = [];
    const at = (t, fn) => { let i = heap.push({ t, fn }) - 1; for (let p; i && heap[(p = (i - 1) >> 1)].t > heap[i].t; i = p) [heap[p], heap[i]] = [heap[i], heap[p]]; };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; for (let i = 0, c; (c = 2 * i + 1) < heap.length; i = c) { if (c + 1 < heap.length && heap[c + 1].t < heap[c].t) c++; if (heap[i].t <= heap[c].t) break; [heap[i], heap[c]] = [heap[c], heap[i]]; } }
      return top;
    };
    const lat = () => 0.3 + rand() * 0.3; // 앱 → 저장소 왕복
    const gap = () => 1.2 + rand() * 0.6; // 읽은 뒤 쓰기까지 앱에서 보내는 시간
    const finish = (r, res) => { r.res = res; r.end = st.now; st.done++; if (res === 'ok') r.rank = st.success++; else if (res === 'soldout') r.k = st.sold++; else r.k = st.fail++; };

    const lockQ = [];
    let locked = false;
    const pump = () => {
      if (locked || !lockQ.length) return;
      const r = lockQ.splice(Math.floor(rand() * Math.min(10, lockQ.length)), 1)[0]; // 커넥션 풀 10개가 행 락을 기다리고, 그중 다음 차례는 도착 순서와 무관
      r.qi = -1; locked = true;
      const ok = st.recorded < S.stock;
      tr(r, 'lock', '쿠폰 행 락 획득');
      at(st.now + (ok ? 6.5 : 2), () => { // 락을 쥐는 시간: 지급 한 건 약 6.5ms 는 레포 EC2 실측
        if (ok) st.recorded++;
        tr(r, 'write', ok ? `UPDATE issued_count = ${st.recorded} · COMMIT → 락 해제` : '재고 없음 · COMMIT → 락 해제');
        finish(r, ok ? 'ok' : 'soldout');
        locked = false; pump();
      });
    };
    let redisFree = 0; // Redis 는 단일 스레드: 명령이 한 줄로 실행됨
    const redis = (dur, fn) => { redisFree = Math.max(st.now, redisFree) + dur; at(redisFree, fn); };

    /* ── DB 에 옮겨 적는 Consumer (Pub/Sub · Streams) ── */
    const memQ = [], stream = [], pel = [];
    let busy = false, cur = null; // cur: Pub/Sub 구독자가 지금 처리 중인 한 건
    const work = () => {
      if (!st.alive || busy) return;
      if (key === 'pubsub') {
        const r = memQ.shift();
        if (!r) return;
        busy = true; cur = r;
        at(st.now + 6.5, () => { if (!st.alive || cur !== r) return; busy = false; cur = null; r.stored = true; st.stored++; work(); }); // 한 건씩 INSERT + 쿠폰 행 갱신
      } else {
        const fromPel = pel.length > 0, batch = fromPel ? pel.slice() : stream.splice(0, 100);
        if (!batch.length) return;
        if (!fromPel) pel.push(...batch);
        busy = true;
        tr(null, 'eval', fromPel ? `XREADGROUP … 0 → 내 PEL ${batch.length}건 재처리` : `XREADGROUP COUNT 100 … > → ${batch.length}건`);
        at(st.now + 14, () => { // 다중 행 INSERT, 쿠폰 행 UPDATE 없음
          if (!st.alive) return;
          let fresh = 0;
          batch.forEach((r) => { if (!r.stored) { r.stored = true; st.stored++; fresh++; } }); // 이미 들어간 건 UNIQUE 로 걸러짐
          if (fromPel) st.redelivered += batch.length;
          tr(null, 'write', `INSERT ${fresh}행${batch.length - fresh ? ` (중복 ${batch.length - fresh}행은 UNIQUE 로 무시)` : ''} · COMMIT`);
          at(st.now + 2, () => { if (!st.alive) return; pel.splice(0, pel.length); tr(null, 'eval', `XACK ${batch.length}건`); busy = false; work(); });
        });
      }
    };
    const enqueue = (r) => { if (key === 'pubsub') { if (st.alive) memQ.push(r); else { r.lost = true; st.lost++; } } else stream.push(r); work(); };
    if (isAsync) {
      const killAt = key === 'pubsub' ? 215 + rand() * 95 : S.killAt;
      at(killAt, () => {
        st.alive = false; busy = false;
        if (key === 'pubsub') { [...(cur ? [cur] : []), ...memQ.splice(0)].forEach((r) => { r.lost = true; st.lost++; }); cur = null; tr(null, 'sys', `SIGKILL · 구독자 메모리 큐의 ${st.lost}건이 프로세스와 함께 유실됨`, true); }
        else { st.meInPel = pel.some((r) => r.me); tr(null, 'sys', `SIGKILL · 처리 중이던 ${pel.length}건은 ACK 전이라 PEL 에 남음`, true); }
      });
      at(killAt + S.restartAfter, () => {
        st.alive = true; st.restarted = true;
        tr(null, 'sys', key === 'pubsub' ? '재시작 · Pub/Sub 은 놓친 메시지를 재전달하지 않음' : `재시작 · 같은 Consumer 이름으로 PEL ${pel.length}건부터 재처리`);
        work();
      });
    }

    const reserve = (r) => { // Lua: 중복 → 재고 → (XADD) → SADD 가 한 번에
      if (st.recorded < S.stock) { st.recorded++; tr(r, 'eval', `EVAL [SISMEMBER · SCARD · ${key === 'stream' ? 'XADD · ' : ''}SADD] → ${st.recorded}번째`); finish(r, 'ok'); return true; }
      tr(r, 'eval', 'EVAL [SISMEMBER · SCARD] → 매진');
      finish(r, 'soldout'); return false;
    };
    // SERIALIZABLE: 읽을 때 S 락, 갱신할 때 X 락. 둘 이상이 S 락을 쥔 채 X 락을 요청하면 데드락 → 나중에 요청한 쪽을 롤백
    // ponytail: InnoDB 의 희생자 선택(변경량 기준)은 '나중에 X 락을 요청한 쪽'으로 단순화. X 락 대기가 있으면 새 S 락 요청은 그 뒤에 줄 섬.
    const sHold = new Set(), sWait = [], xWait = [];
    const grantX = () => {
      const w = xWait[0];
      if (!w || sHold.size !== 1) return;
      xWait.shift(); sHold.delete(w); st.recorded++;
      tr(w, 'write', `X 락 획득 · UPDATE issued_count = ${st.recorded} · COMMIT`);
      finish(w, 'ok');
      sWait.splice(0).forEach(sRead);
    };
    const sRead = (r) => {
      sHold.add(r);
      const c = st.recorded;
      tr(r, 'read', `SELECT issued_count → ${c} · S 락 획득`);
      at(st.now + gap(), () => {
        if (c >= S.stock) { sHold.delete(r); finish(r, 'soldout'); return grantX(); }
        if (xWait.length) { st.dl ||= [xWait[0].id, r.id]; sHold.delete(r); tr(r, 'lock', 'X 락 요청 → Deadlock found · ROLLBACK', true); finish(r, 'fail'); }
        else { xWait.push(r); if (sHold.size > 1) tr(r, 'lock', 'X 락 대기 (다른 트랜잭션이 S 락 점유)'); }
        grantX();
      });
    };
    const flows = {
      serializable: (r) => at(st.now + lat(), () => (xWait.length ? sWait.push(r) : sRead(r))),
      // MULTI/EXEC: 묶어서 실행은 되지만 SCARD 결과로 분기하지 못함 → 넣고 나서 넘쳤으면 SREM 으로 되돌림
      multi: (r) => redis(0.05, () => {
        const n = ++st.recorded;
        if (n <= S.stock) { tr(r, 'eval', `MULTI · SADD · SCARD · EXEC → Set 크기 ${n}`); return finish(r, 'ok'); }
        tr(r, 'eval', `MULTI · SADD · SCARD · EXEC → Set 크기 ${n} (재고 초과)`, true);
        at(st.now + gap(), () => redis(0.02, () => { st.recorded--; st.rollbacks++; tr(r, 'write', `SREM 으로 Rollback → Set 크기 ${st.recorded}`); finish(r, 'soldout'); }));
      }),
      // WATCH: 읽은 뒤 Set 이 바뀌었으면 EXEC 가 nil → 처음부터 재시도. 재시도하는 동안 뒤에 온 요청이 먼저 받음
      watch: (r) => redis(0.004, () => {
        const n = st.recorded, v = st.version;
        if (!r.retry) tr(r, 'read', `WATCH · SCARD → ${n}`);
        at(st.now + gap(), () => redis(0.008, () => {
          if (n >= S.stock) return finish(r, 'soldout');
          if (st.version === v) { st.recorded++; st.version++; tr(r, 'write', `MULTI · SADD · EXEC → Set 크기 ${st.recorded}${r.retry ? ` (재시도 ${r.retry}회 후)` : ''}`); return finish(r, 'ok'); }
          r.retry = (r.retry || 0) + 1; st.retries++;
          if (r.retry === 1) tr(r, 'write', 'EXEC → nil (WATCH 한 키가 변경됨) → 재시도', true); // 기록은 첫 재시도만
          flows.watch(r);
        }));
      }),
      // 읽은 값에 +1 해서 덮어씀 → 동시에 읽은 요청끼리 갱신 손실
      rc: (r) => at(st.now + lat(), () => {
        const c = st.recorded;
        tr(r, 'read', `SELECT issued_count → ${c}`);
        at(st.now + gap(), () => {
          if (c >= S.stock) return finish(r, 'soldout');
          const lostUpdate = st.recorded !== c;
          st.recorded = c + 1;
          tr(r, 'write', `UPDATE issued_count = ${c + 1}`, lostUpdate);
          finish(r, 'ok');
        });
      }),
      // 읽을 때의 version 이 그대로일 때만 갱신, 재시도 없음
      optimistic: (r) => at(st.now + lat(), () => {
        const c = st.recorded, v = st.version;
        tr(r, 'read', `SELECT → issued_count ${c}, version ${v}`);
        at(st.now + gap(), () => {
          if (c >= S.stock) return finish(r, 'soldout');
          if (st.version === v) { st.recorded++; st.version++; tr(r, 'write', `UPDATE … WHERE version = ${v} → 1행`); finish(r, 'ok'); }
          else { tr(r, 'write', `UPDATE … WHERE version = ${v} → 0행`, true); finish(r, 'fail'); }
        });
      }),
      pessimistic: (r) => { if (locked) tr(r, 'lock', '락 대기 (앞 요청이 끝날 때까지)', true); lockQ.push(r); pump(); },
      // 수량 확인과 추가가 별도 명령 → 그 사이에 다른 요청이 끼어듦
      scard: (r) => redis(0.02, () => {
        const n = st.recorded;
        tr(r, 'read', `SISMEMBER → 0 · SCARD → ${n}`);
        at(st.now + gap(), () => redis(0.02, () => {
          if (n >= S.stock) return finish(r, 'soldout');
          st.recorded++;
          tr(r, 'write', `SADD → Set 크기 ${st.recorded}`, st.recorded > S.stock);
          finish(r, 'ok');
        }));
      }),
      lua: (r) => redis(0.05, () => reserve(r)),
      pubsub: (r) => redis(0.05, () => { if (reserve(r)) enqueue(r); }),
      stream: (r) => redis(0.05, () => { if (reserve(r)) enqueue(r); }),
    };

    const reqs = Array.from({ length: S.n }, () => ({ t: rand() * S.spread })).sort((a, b) => a.t - b.t);
    reqs.forEach((r, i) => { r.id = i + 1; if (r.id === meId) r.me = true; at(r.t, () => { r.start = st.now; flows[key](r); }); });
    const finished = () => st.done === S.n && (!isAsync || (st.restarted && st.stored + st.lost === st.success && stream.length + pel.length === 0));

    return {
      S, st, reqs, lockQ, trace, isAsync, finished, me: reqs.find((r) => r.me),
      q: { stream, pel, memQ, cur: () => cur },
      queued: () => (key === 'pubsub' ? memQ.length : stream.length + pel.length),
      advance(to) { while (heap.length && heap[0].t <= to) { const e = pop(); st.now = e.t; e.fn(); } },
      p95() { const w = reqs.filter((r) => r.res).map((r) => r.end - r.start).sort((a, b) => a - b); return w.length ? w[Math.floor((w.length - 1) * 0.95)] : 0; },
    };
  }

  if (typeof document === 'undefined') {
    const assert = require('assert');
    const out = {};
    for (const k of Object.keys(STRATS)) {
      for (let i = 0; i < 20; i++) {
        const s = createSim(k);
        s.advance(Infinity);
        const { st, S } = s;
        assert.ok(s.finished(), k + ': 끝까지 처리');
        if (k === 'lua' || k === 'pessimistic') assert.ok(st.recorded === S.stock && st.success === S.stock && st.sold === S.n - S.stock, k + ': 정확히 재고만큼');
        if (k === 'scard') assert.ok(st.recorded > S.stock, 'scard: 초과 지급');
        if (k === 'serializable') assert.ok(st.success >= 1 && st.success < S.stock && st.recorded === st.success && st.fail === S.n - st.success && st.dl, 'serializable: 데드락으로 일부만 지급');
        if (k === 'multi') assert.ok(st.recorded === S.stock && st.success === S.stock && st.rollbacks === S.n - S.stock, 'multi: 초과분을 SREM 으로 되돌림');
        if (k === 'watch') assert.ok(st.recorded === S.stock && st.success === S.stock && st.retries > 0 && s.reqs.some((r) => r.res === 'ok' && r.id > S.stock), 'watch: 재시도로 선착순이 깨짐');
        if (k === 'rc') assert.ok(st.success === S.n && st.recorded < st.success, 'rc: 갱신 손실');
        if (k === 'optimistic') assert.ok(st.success < S.stock && st.success === st.recorded && st.fail === S.n - st.success, 'optimistic: 일부만 지급');
        if (k === 'pubsub') assert.ok(st.success === 1000 && st.sold === 500 && st.lost > 900 && st.stored + st.lost === 1000, 'pubsub: 강제 종료로 대부분 유실');
        if (k === 'stream') assert.ok(st.success === 1000 && st.sold === 500 && st.stored === 1000 && st.lost === 0 && st.redelivered > 0, 'stream: 유실 0, PEL 재처리');
        if (k !== 'lua') assert.ok(st.firstBad != null, k + ': 문제 순간이 기록됨');
        (out[k] ||= []).push(s.isAsync ? `접수 ${st.success}/적재 ${st.stored}/유실 ${st.lost}` : `${st.success}/${st.recorded}`);
      }
    }
    { // 방문자의 요청: 강제 종료 때 PEL 에 있었고, 끝에는 DB 에 저장됨
      const id = pickMe('stream', 7), s = createSim('stream', seeded(7), id);
      s.advance(Infinity);
      assert.ok(s.me && s.me.id === id && s.st.meInPel && s.me.stored && !s.me.lost, 'me: PEL 을 거쳐 저장');
      const id2 = pickMe('pubsub', 7), s2 = createSim('pubsub', seeded(7), id2);
      s2.advance(Infinity);
      assert.ok(s2.me && s2.me.res === 'ok' && s2.me.lost, 'me: Pub/Sub 에서 202 받고 사라짐');
      for (const k of Object.keys(STRATS)) { const m = createSim(k, seeded(3), pickMe(k, 3)); m.advance(Infinity); assert.ok(m.me && m.me.res, k + ': 내 요청이 결과를 받음'); }
    }
    for (const k in out) console.log(k.padEnd(12), out[k].slice(0, 5).join('  '));
    console.log('OK');
    return;
  }

  /* ───────── 화면 ───────── */
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => n.toLocaleString('en-US');
  const C = {};
  const readTheme = () => { const v = getComputedStyle(document.documentElement), g = (n) => v.getPropertyValue(n).trim(); Object.assign(C, { ink: g('--ink'), mute: g('--mute'), sun: g('--sun'), coral: g('--coral'), blue: g('--dot'), bg: g('--navy') }); C.line = C.ink + '33'; C.faint = C.ink + '29'; };
  readTheme();
  addEventListener('themechange', () => { readTheme(); if (sim) draw(0); });
  const cv = $('#sim'), ctx = cv.getContext('2d');
  const el = { tabs: $('#sim-tabs'), stats: $('#sim-stats'), verdict: $('#sim-verdict'), fact: $('#sim-fact'), scen: $('#sim-scen'), trace: $('#sim-trace') };
  const motion = window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (motion && window.ScrambleTextPlugin) gsap.registerPlugin(ScrambleTextPlugin);
  let W = 0, H = 0, key = AUTO[0], sim, dots = [], t0 = 0, last = 0, running = false, auto = false, visible = true, hiddenAt = 0, timer = 0, raf = 0, cardSig = '', pulse = 0, dds = [], doneAt = 0;

  el.tabs.innerHTML = [...new Set(Object.values(STRATS).map((s) => s.set))].map((label) => `<div class="dock__group"><span>${label}</span>${Object.entries(STRATS).filter(([, s]) => s.set === label).map(([k, s]) => `<button type="button" data-k="${k}" aria-pressed="false">${s.name}</button>`).join('')}</div>`).join('');
  el.tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; auto = false; run(b.dataset.k, true); });
  $('#sim-again').addEventListener('click', () => { auto = false; run(key, true); });

  function resize() {
    const dpr = document.documentElement.classList.contains('lite') ? 1 : Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (sim) draw(0);
  }

  const statDefs = () => (sim.isAsync
    ? [['접수 응답 (202)', () => fmt(sim.st.success)], ['매진 응답', () => fmt(sim.st.sold)], ['DB 에 적재', () => fmt(sim.st.stored)], ['유실', () => fmt(sim.st.lost)], [sim.S.queue === 'Stream' ? 'Stream 미처리' : `${sim.S.queue}`, () => fmt(sim.queued())]]
    : [['도착한 요청', () => fmt(dots.reduce((n, d) => n + (d.r.start != null), 0))], ['성공 응답', () => fmt(sim.st.success)], [sim.S.rec, () => `${sim.st.recorded} / ${sim.S.stock}`], ['매진·실패 응답', () => fmt(sim.st.sold + sim.st.fail)]]);
  function head() {
    const S = sim.S;
    [...el.tabs.querySelectorAll('button')].forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === key));
    el.scen.textContent = sim.isAsync ? `재고 ${fmt(S.stock)}장 · 요청 ${fmt(S.n)}건 · 도중에 Consumer 강제 종료` : `재고 ${S.stock}장 · 요청 ${fmt(S.n)}건`;
    el.fact.textContent = S.fact;
    el.stats.innerHTML = statDefs().map(([l]) => `<div><dt>${l}</dt><dd class="num">0</dd></div>`).join('');
    dds = [...el.stats.querySelectorAll('dd')];
    el.trace.hidden = true; cardSig = '';
  }

  // mine: 방문자가 직접 누른 실행이면 그 요청 하나를 '내 요청'(노란 고리)으로 표시. 자동 재생에는 없음
  function run(k, mine = false) {
    clearTimeout(timer);
    key = k;
    const seed = (Math.random() * 1e9) | 0;
    sim = createSim(k, seeded(seed), mine ? pickMe(k, seed) : 0);
    dots = sim.reqs.map((r) => ({ r, lane: Math.random(), jit: Math.random(), x: 0, y: 0, a: 0, born: false }));
    t0 = last = hiddenAt = performance.now(); // 화면 밖에서 시작하면 보이는 순간부터 흐르게
    running = true;
    head();
    if (motion) gsap.killTweensOf(el.verdict);
    el.verdict.textContent = '실행 중';
    el.verdict.removeAttribute('aria-label'); // 지난 실행의 판정이 읽히지 않게
    el.verdict.dataset.tone = '';
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  function verdict() {
    const { st, S } = sim;
    let text, tone = 'bad';
    const me = sim.me;
    if (key === 'pubsub') { text = `강제 종료 시점에 구독자 메모리 큐의 ${fmt(st.lost)}건이 유실됐습니다. 접수 응답은 ${fmt(st.success)}건인데 DB 에는 ${fmt(st.stored)}건이 적재됐습니다.`; if (me?.lost) text = `내 요청은 접수 응답(202)을 받았지만 구독자 메모리 큐에서 유실돼 DB 에 적재되지 않았습니다. ` + text; }
    else if (key === 'stream' && sim.me) { text = `내 요청은 ${fmt(sim.me.rank + 1)}번째로 접수됐습니다. 처리 도중 Consumer 가 강제 종료됐지만 PEL 에 남아 재처리됐고 DB 에 적재됐습니다. 접수 ${fmt(st.success)}건 = DB ${fmt(st.stored)}건, 유실 0건.`; tone = 'good'; }
    else if (key === 'stream') { text = `강제 종료 뒤 PEL ${fmt(st.redelivered)}건부터 재처리했습니다. 접수 ${fmt(st.success)}건 = DB ${fmt(st.stored)}건, 유실 0건.`; tone = 'good'; }
    else if (st.recorded > S.stock) text = `Redis Set 이 재고를 ${st.recorded - S.stock}건 넘겨 초과 지급이 발생했습니다. 레포 실측에서는 뒤의 DB 조건부 UPDATE 가 막아 DB 최종 지급은 ${S.stock}장이었습니다.`;
    else if (st.success > st.recorded) text = `갱신 손실이 일어났습니다. 성공 응답은 ${st.success}건인데 ${S.rec}는 ${st.recorded}입니다.`;
    else if (key === 'serializable') text = `${st.success}건만 지급됐고 나머지 ${st.fail}건은 데드락으로 롤백됐습니다.`;
    else if (key === 'multi') { text = `수량은 맞지만 재고를 넘긴 ${fmt(st.rollbacks)}건을 SREM 으로 되돌리는 별도 Rollback 로직이 필요했습니다.`; tone = 'slow'; }
    else if (key === 'watch') { text = `수량은 맞지만 EXEC 실패로 ${fmt(st.retries)}회 재시도했고 먼저 도착한 ${S.stock}명 중 ${sim.reqs.filter((r) => r.res === 'ok' && r.id <= S.stock).length}명만 받았습니다. 선착순이 보장되지 않습니다.`; tone = 'slow'; }
    else if (st.recorded < S.stock) text = `재고가 남았는데 ${st.success}건만 지급됐습니다. 나머지 ${S.n - st.success}건은 충돌로 실패했습니다.`;
    else if (key === 'pessimistic') { text = `수량은 맞지만 한 건씩 직렬로 처리되고 먼저 도착한 ${S.stock}명 중 ${sim.reqs.filter((r) => r.res === 'ok' && r.id <= S.stock).length}명만 받았습니다. 선착순이 보장되지 않습니다.`; tone = 'slow'; }
    else { text = `초과·중복 지급은 0건이고 Redis 가 먼저 처리한 ${S.stock}명에게만 지급됐습니다.`; tone = 'good'; }
    if (me && !sim.isAsync) text = `${fmt(me.id)}번째로 도착한 내 요청은 ${me.res === 'ok' ? '성공 응답을 받았습니다' : me.res === 'soldout' ? '매진 응답을 받았습니다' : key === 'serializable' ? '데드락으로 롤백됐습니다' : '충돌로 실패했습니다'}. ` + text;
    el.verdict.dataset.tone = tone;
    el.verdict.setAttribute('aria-label', text);
    if (motion && window.ScrambleTextPlugin) gsap.to(el.verdict, { duration: 0.9, scrambleText: { text, chars: '01', speed: 0.6 } });
    else el.verdict.textContent = text;
  }

  /* ── "중간에 끼어들면" 카드: 이번 실행의 기록에서 실제 순서를 뽑아 보여 줌 ── */
  function card() {
    const { trace, st, S } = sim;
    const row = (e, lane, bad) => ({ lane, text: e.text, bad: bad ?? e.bad });
    if (sim.isAsync) {
      const sys = trace.filter((e) => e.kind === 'sys');
      if (!sys.length) return null;
      const after = key === 'stream' ? trace.slice(trace.indexOf(sys.at(-1)) + 1).filter((e) => e.id === 0).slice(0, 3) : [];
      return { title: 'Consumer 를 강제 종료하면', rows: [...sys, ...after].map((e) => row(e, null)), note: key === 'stream' ? 'DB 커밋 후에만 ACK 하므로 Consumer 가 다운돼도 메시지가 PEL 에 남아 재처리됩니다. 실제 Stream 은 읽은 메시지도 삭제되지 않습니다. 화면의 Stream 칸에는 아직 읽지 않은 메시지만 그렸습니다.' : '메시지를 저장하지 않는 At-Most-Once 방식이라 구독자가 종료되면 메시지도 함께 유실됩니다.' };
    }
    if (key === 'lua') {
      const lastOk = trace.findLast((e) => e.text.includes('번째')), sold = trace.find((e) => e.text.endsWith('매진'));
      if (!sold) return null;
      return { title: '원자적 실행', rows: [{ lane: null, text: `요청 #${lastOk.id}  ${lastOk.text}` }, { lane: null, text: `요청 #${sold.id}  ${sold.text}` }], note: '중복 확인·재고 확인·SADD 가 스크립트 하나로 원자적으로 실행됩니다. 재고가 소진되면 바로 매진으로 응답합니다.' };
    }
    if (key === 'pessimistic') {
      const ev = trace.slice(0, 60), a = ev.find((e) => e.text.includes('획득')), w = ev.filter((e) => e.text.startsWith('락 대기')), rel = ev.find((e) => e.kind === 'write');
      if (!rel || !w.length) return null;
      const next = ev.find((e) => e.text.includes('획득') && e.t >= rel.t && e !== a);
      return { title: '락을 획득한 1건씩 처리', rows: [{ lane: null, text: `요청 #${a.id}  ${a.text}` }, { lane: null, text: `요청 #${w[0].id} 외 여러 건  락 대기`, bad: true }, { lane: null, text: `요청 #${rel.id}  ${rel.text}` }, next && { lane: null, text: `요청 #${next.id}  ${next.text}` }].filter(Boolean), note: '락을 점유하는 6.5ms 동안 나머지 요청은 대기합니다. InnoDB 는 다음 차례를 도착 순서가 아니라 CATS 가중치로 정해서 선착순이 보장되지 않습니다. 여기서는 기다리는 10건 중 무작위로 고르도록 단순화했습니다. 실제로는 커넥션 풀 크기만큼만 행 락을 기다리고 나머지는 커넥션을 기다립니다.' };
    }
    if (st.firstBad == null) return null;
    if (key === 'serializable') {
      const [a, b] = st.dl, ev = trace.slice(0, st.firstBad + 1).filter((e) => e.id === a || e.id === b);
      return { title: '동시성 이슈 재현', lanes: [`요청 #${a}`, `요청 #${b}`], rows: ev.map((e) => row(e, e.id === a ? 0 : 1)), note: '둘 다 S 락을 점유한 채 X 락을 요청해 서로의 S 락이 해제되기를 기다립니다. InnoDB 가 데드락을 감지해 한쪽을 롤백합니다. 여기서는 나중에 X 락을 요청한 쪽을 롤백하도록 단순화했습니다.' };
    }
    if (key === 'multi') {
      const over = trace[st.firstBad], back = trace.find((e) => e.id === over.id && e.kind === 'write');
      return { title: '별도 Rollback 로직', rows: [over, back].filter(Boolean).map((e) => ({ lane: null, text: `요청 #${e.id}  ${e.text}`, bad: e.bad })), note: 'EXEC 결과를 받은 뒤에야 재고 초과를 알 수 있어, 애플리케이션이 SREM 으로 직접 되돌려야 합니다.' };
    }
    const bad = trace[st.firstBad], X = bad.id;
    const iRead = trace.findLastIndex((e, i) => i < st.firstBad && e.id === X && e.kind === 'read');
    const between = trace.slice(iRead, st.firstBad + 1);
    const Y = between.find((e) => e.kind === 'write' && e.id !== X)?.id;
    const yRead = Y && trace.findLast((e) => e.id === Y && e.kind === 'read');
    const rows = [...(yRead && trace.indexOf(yRead) < iRead ? [yRead] : []), ...between.filter((e) => e.id === X || e.id === Y)].map((e) => row(e, e.id === X ? 0 : 1, e === bad));
    const note = { rc: '둘 다 같은 값을 읽고 +1 해서 두 번 지급됐는데 수량은 한 번만 늘었습니다.', optimistic: '읽은 뒤에 다른 요청이 먼저 갱신해 version 이 달라졌고 재시도가 없어 그대로 실패합니다.', watch: 'WATCH 이후 다른 요청이 먼저 Set 을 변경해 EXEC 가 nil 을 반환했습니다. 재시도하는 동안 뒤에 도착한 요청이 먼저 지급받을 수 있습니다.', scard: `여러 요청이 SCARD 로 재고가 남았다고 확인한 뒤 SADD 해서 Set 크기가 ${S.stock}을 넘겼습니다.` }[key];
    return { title: '동시성 이슈 재현', lanes: [`요청 #${X}`, Y ? `요청 #${Y}` : ''], rows, note };
  }
  function drawCard() {
    const sig = `${key}|${sim.st.firstBad}|${sim.st.sys}|${sim.st.sold > 0}|${sim.finished()}`;
    if (sig === cardSig) return;
    cardSig = sig;
    const c = card();
    if (!c) return;
    const wasHidden = el.trace.hidden;
    el.trace.hidden = false;
    el.trace.replaceChildren();
    const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    el.trace.append(h('p', 'trace__title', c.title));
    if (c.lanes) { const hd = h('div', 'trace__lanes'); hd.append(h('span', null, c.lanes[0]), h('span', null, c.lanes[1])); el.trace.append(hd); }
    const ol = h('ol', c.lanes ? 'is-lanes' : '');
    c.rows.forEach((r) => ol.append(h('li', (r.bad ? 'is-bad ' : '') + (r.lane === 1 ? 'is-b' : r.lane === 0 ? 'is-a' : ''), r.text)));
    el.trace.append(ol, h('p', 'trace__note', c.note));
    pulse = performance.now();
    if (motion) gsap.from(wasHidden ? [el.trace, ...ol.children] : [...ol.children], { opacity: 0, y: 10, duration: 0.45, stagger: 0.09, ease: 'power3.out', overwrite: true });
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (running) {
      sim.advance((now - t0) / sim.S.slow);
      if (sim.finished()) {
        running = false; doneAt = now;
        verdict();
        if (auto) timer = setTimeout(() => auto && visible && run(AUTO[(AUTO.indexOf(key) + 1) % AUTO.length]), 4200);
      }
    }
    const defs = statDefs();
    dds.forEach((dd, i) => { const v = defs[i][1](); if (dd.textContent !== v) dd.textContent = v; }); // 바뀐 숫자만 다시 씀
    drawCard();
    draw(dt);
    // 끝나고 점이 자리 잡은 뒤(3초)에는 그리기를 멈춤. 다음 실행(run)·테마 변경·크기 변경이 다시 그림. '내 요청' 고리는 계속 움직여야 해서 예외
    if (visible && (running || now - doneAt < 3000 || sim.me)) raf = requestAnimationFrame(frame);
  }

  /* ── 캔버스: 요청 → 저장소 → 결과 칸 ── */
  const box = (x, y, w, h, stroke, dash) => { ctx.strokeStyle = stroke; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke(); ctx.setLineDash([]); };
  const label = (t, x, y, color = C.mute, align = 'left', weight = 600) => { ctx.font = `${weight} ${W < 640 ? 11 : 13}px Pretendard, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, y); ctx.textAlign = 'left'; };
  function draw(dt) {
    const { st, S } = sim, small = W < 640, wide = wideMq.matches;
    const left = wide ? Math.min(W * 0.27, 350) : 0; // 넓은 화면에서는 왼쪽을 "중간에 끼어들면" 카드 자리로 비움
    const span = W - left, x0 = left + span * 0.03, gx = left + span * (sim.isAsync ? 0.13 : small ? 0.4 : 0.3);
    const cols = S.stock > 100 ? 40 : 10, rows = S.stock / cols;
    const cell = Math.min((span * (S.stock > 100 ? 0.33 : small ? 0.34 : 0.24)) / cols, (H * 0.7) / rows, 26);
    const gX = left + span * (sim.isAsync ? 0.65 : small ? 0.6 : 0.46), gY = (H - rows * cell) / 2 + 12;
    const gateW = small ? 64 : 96, gateH = H * 0.62, gateY = (H - gateH) / 2 + 10;
    const trayX = gX + cols * cell + (small ? 12 : 48), trayW = W - trayX - 4, trays = !sim.isAsync && trayW >= 64;
    const tc = 5, tCols = Math.max(1, Math.floor((trayW - 12) / tc)), trayH = H * 0.36;
    const k = 1 - Math.exp(-dt * (sim.isAsync ? 16 : 9)), perRow = small ? 24 : 44, step = (gx - gateW / 2 - x0 - 24) / perRow;
    const granted = Math.min(st.recorded, S.stock);

    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    label('요청', x0, 4);
    box(gx - gateW / 2, gateY, gateW, gateH, C.line);
    label(S.store, gx, gateY + 10, C.ink, 'center', 700);
    if (!small) label(S.gate, gx, gateY + gateH + 8, C.mute, 'center');
    label(sim.isAsync ? `DB · coupon_issues  ${fmt(st.stored)} / ${fmt(S.stock)}행` : `쿠폰 ${S.stock}장`, gX, gY - 24, sim.isAsync && st.stored ? C.sun : C.mute);
    ctx.strokeStyle = C.faint;
    if (cell >= 5) { ctx.beginPath(); for (let i = 0; i < S.stock; i++) ctx.rect(gX + (i % cols) * cell + 1, gY + Math.floor(i / cols) * cell + 1, cell - 2, cell - 2); ctx.stroke(); } // 칸 전체를 한 번에

    if (trays) { // 버려진 요청이 어디로 가는지: 매진 응답 칸 · 충돌 실패 칸
      [['매진 응답', st.sold, C.mute, 0], ['충돌 실패', st.fail, C.coral, 1]].forEach(([name, n, col, i]) => {
        const y = 26 + i * (trayH + 34);
        box(trayX, y, trayW, trayH, n ? col : C.line, n ? null : [3, 5]);
        label(name, trayX, y - 20, n ? col : C.mute);
        label(fmt(n) + '건', trayX + trayW, y - 20, n ? C.ink : C.mute, 'right', 700);
      });
    } else if (!sim.isAsync && (st.sold || st.fail)) label(`매진 응답 ${fmt(st.sold)}건${st.fail ? ` · 충돌 실패 ${fmt(st.fail)}건` : ''}`, gX, gY + rows * cell + 8);

    // DB 에 옮겨 적기: Redis → Stream → Consumer → DB 를 메시지가 실제로 거쳐 감
    const A = sim.isAsync && (() => {
      const cy = H / 2 + 10, bw = small ? 44 : 84, sx = left + span * 0.31, cx = left + span * 0.49, cw = small ? 60 : 116, ch = gateH * 0.66, cTop = cy - ch / 2;
      return { cy, bw, sx, cx, cw, ch, cTop, sCols: Math.max(1, Math.floor((bw - 14) / 4)), cCols: Math.max(1, Math.floor((cw - 16) / 4)), lostY: cTop + ch + 30 };
    })();
    if (A) {
      const { q } = sim, isStream = key === 'stream', inCons = isStream ? q.pel.length : q.memQ.length + (q.cur() ? 1 : 0);
      const arrow = (x1, x2, y, text, dash) => { ctx.strokeStyle = C.line; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - 6 * Math.sign(x2 - x1), y - 4); ctx.lineTo(x2 - 6 * Math.sign(x2 - x1), y + 4); ctx.fillStyle = C.mute; ctx.fill(); if (!small) label(text, (x1 + x2) / 2, y - 18, C.mute, 'center'); };
      // Stream: 메시지가 쌓여 남는 곳. Pub/Sub 에는 이 자리가 없음
      box(A.sx - A.bw / 2, gateY, A.bw, gateH, isStream ? C.blue : C.line, isStream ? null : [3, 5]);
      label(isStream ? 'Stream' : '저장 없음', A.sx, gateY + 10, isStream ? C.ink : C.mute, 'center', 700);
      if (isStream) label(`아직 안 읽음 ${fmt(q.stream.length)}건`, A.sx, gateY + gateH + 8, q.stream.length ? C.ink : C.mute, 'center');
      // Consumer
      box(A.cx - A.cw / 2, A.cTop, A.cw, A.ch, st.alive ? C.sun : C.coral, st.alive ? null : [4, 4]);
      label(st.alive ? (isStream ? 'Consumer' : '구독자') : 'SIGKILL', A.cx, A.cTop + 8, st.alive ? C.sun : C.coral, 'center', 700);
      label(isStream ? `ACK 대기 (PEL) ${fmt(inCons)}건` : `메모리 큐 ${fmt(inCons)}건`, A.cx, A.cTop - 22, inCons ? C.ink : C.mute, 'center');
      // 명령 흐름
      if (isStream) { arrow(gx + gateW / 2 + 4, A.sx - A.bw / 2 - 4, A.cy - 30, 'XADD'); arrow(A.sx + A.bw / 2 + 4, A.cx - A.cw / 2 - 4, A.cy - 30, 'XREADGROUP'); arrow(A.cx - A.cw / 2 - 4, A.sx + A.bw / 2 + 4, A.cy + 40, 'XACK', [3, 4]); }
      else arrow(gx + gateW / 2 + 4, A.cx - A.cw / 2 - 4, A.cy - 30, 'PUBLISH');
      arrow(A.cx + A.cw / 2 + 4, gX - 6, A.cy - 30, 'INSERT');
      if (!isStream) label(`유실 ${fmt(st.lost)}건`, A.cx, A.lostY - 22, st.lost ? C.coral : C.mute, 'center', 700);
      // 메시지가 지금 어디에 있는지
      q.stream.forEach((r, i) => { r.loc = 's'; r.li = i; });
      q.pel.forEach((r, i) => { r.loc = 'c'; r.li = i; });
      q.memQ.forEach((r, i) => { r.loc = 'c'; r.li = i + 1; });
      if (q.cur()) { q.cur().loc = 'c'; q.cur().li = 0; }
    }

    sim.lockQ.forEach((r, i) => (r.qi = i));
    if (key === 'pessimistic' && sim.lockQ.length) label(`락 대기 ${fmt(sim.lockQ.length)}건`, small ? x0 : x0 + 40, small ? 24 : H / 2 - 70, C.coral);
    let over = 0;
    const buckets = new Map(); // 색·투명도가 같은 점끼리 모아 한 번에 칠함 (점마다 fill 하면 요청 수만큼 그리기 호출)
    for (const d of dots) {
      const r = d.r;
      if (r.start == null) continue;
      if (!d.born) { d.born = true; d.x = x0; d.y = 30 + (H - 50) * d.lane; }
      let tx, ty, col = C.blue, rad = small ? 1.6 : 2.2, ta = 0.9;
      if (!r.res) {
        if (r.qi >= 0) { const row = Math.floor(r.qi / perRow); tx = gx - gateW / 2 - 10 - (r.qi % perRow) * step; ty = H / 2 + 10 + (row % 2 ? 1 : -1) * Math.ceil(row / 2) * (small ? 5 : 7); }
        else if (r.qi === -1) { tx = gx; ty = H / 2 + 10; col = C.ink; rad *= 1.7; }
        else { tx = gx - d.jit * gateW * 0.4; ty = H / 2 + 10 + (d.lane - 0.5) * gateH * 0.7; }
      } else if (A && r.res === 'ok' && r.lost) { // 프로세스와 함께 사라진 메시지
        tx = A.cx - A.cw / 2 + 8 + (r.rank % A.cCols) * 4; ty = A.lostY + (Math.floor(r.rank / A.cCols) % Math.max(1, Math.floor((H - A.lostY - 6) / 4))) * 4;
        col = C.coral; rad = 1.4; ta = 0.8;
      } else if (A && r.res === 'ok' && !r.stored) { // Stream 에 쌓여 있거나 Consumer 가 들고 있는 메시지
        const inS = r.loc === 's', cols2 = inS ? A.sCols : A.cCols, x1 = inS ? A.sx - A.bw / 2 + 8 : A.cx - A.cw / 2 + 9, y1 = inS ? gateY + 32 : A.cTop + 30, maxRows = Math.max(1, Math.floor(((inS ? gateH : A.ch) - 40) / 4));
        tx = x1 + (r.li % cols2) * 4; ty = y1 + (Math.floor(r.li / cols2) % maxRows) * 4;
        col = inS ? C.blue : C.ink; rad = 1.4;
      } else if (r.res === 'ok') {
        const inStock = r.rank < S.stock, colI = inStock ? r.rank % cols : cols + 0.6 + Math.floor((r.rank - S.stock) / rows), rowI = inStock ? Math.floor(r.rank / cols) : (r.rank - S.stock) % rows;
        tx = gX + (colI + 0.5) * cell; ty = gY + (rowI + 0.5) * cell;
        rad = Math.max(cell * 0.3, 1.6);
        if (sim.isAsync) col = C.sun;
        else col = r.rank < granted ? C.sun : C.coral; // 기록된 수량 밖의 성공 응답 = 정합성 위반
        if (!inStock) over++;
      } else if (trays) {
        const i = r.res === 'fail' ? 1 : 0;
        tx = trayX + 8 + (r.k % tCols) * tc; ty = 26 + i * (trayH + 34) + 8 + (Math.floor(r.k / tCols) % Math.max(1, Math.floor((trayH - 12) / tc))) * tc;
        col = i ? C.coral : C.mute; rad = 1.6; ta = 0.85;
      } else { tx = gx + 30 + d.jit * 30; ty = H + 30; col = r.res === 'fail' ? C.coral : C.mute; ta = 0; }
      d.x += (tx - d.x) * k; d.y += (ty - d.y) * k; d.a += (ta - d.a) * k;
      if (d.a < 0.02) continue;
      const bk = col + '|' + Math.round(d.a * 10);
      let b = buckets.get(bk);
      if (!b) buckets.set(bk, (b = []));
      b.push(d.x, d.y, rad);
    }
    for (const [bk, b] of buckets) {
      const [col, a] = bk.split('|');
      ctx.globalAlpha = a / 10; ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < b.length; i += 3) { ctx.moveTo(b[i] + b[i + 2], b[i + 1]); ctx.arc(b[i], b[i + 1], b[i + 2], 0, 6.283); }
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    const meDot = sim.me && dots[sim.me.id - 1];
    if (meDot?.born) { // 방문자가 누른 요청
      ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(meDot.x, meDot.y, 4, 0, 6.283); ctx.fill();
      ctx.strokeStyle = C.sun; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(meDot.x, meDot.y, 10 + 3 * Math.sin(performance.now() / 160), 0, 6.283); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = `700 ${W < 640 ? 11 : 13}px Pretendard, sans-serif`;
      const tw = ctx.measureText('내 요청').width; // 점이 빽빽한 칸 위에서도 읽히게 바탕을 깖
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.roundRect(meDot.x + 14, meDot.y - 24, tw + 14, 22, 6); ctx.fill();
      ctx.strokeStyle = C.sun; ctx.stroke();
      label('내 요청', meDot.x + 21, meDot.y - 20, C.sun, 'left', 700);
    }
    if (over) label(`${key === 'scard' ? '초과 지급' : '초과'} ${over}`, gX + (cols + 0.6) * cell, gY - 24, C.coral, 'left', 700);
    // 문제를 일으킨 요청에 표시
    if (st.firstBad != null && !sim.isAsync && key !== 'pessimistic' && performance.now() - pulse < 2600) {
      const bad = sim.trace[st.firstBad], d = dots[bad.id - 1];
      if (d?.born) { ctx.strokeStyle = C.coral; ctx.beginPath(); ctx.arc(d.x, d.y, 9 + 4 * Math.sin(performance.now() / 120), 0, 6.283); ctx.stroke(); label('#' + bad.id, d.x + 14, d.y - 7, C.coral, 'left', 700); }
    }
  }

  const wideMq = matchMedia('(min-width: 1000px)');
  resize();
  addEventListener('litechange', resize);
  new ResizeObserver(resize).observe(cv); // dock 높이가 바뀌어도 캔버스 버퍼를 다시 맞춤
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) { hiddenAt = performance.now(); return; }
    const away = performance.now() - hiddenAt;
    t0 += away; last += away; // 화면 밖에 있던 시간은 흐르지 않은 것으로
    if (auto && !running) run(AUTO[(AUTO.indexOf(key) + 1) % AUTO.length]);
    else if (!raf) raf = requestAnimationFrame(frame);
  }).observe(cv);

  // 처음에는 멈춘 상태로 그려 두고, main.js 가 로딩이 끝나면 start() 를 부름
  sim = createSim(key);
  head();
  el.verdict.textContent = '방식을 누르면 실행됩니다.';
  draw(0);
  // start: 화면에 들어오면 자동으로 방식을 돌려 봄 / play: 방문자가 직접 누른 실행(자동 재생이 덮어쓰지 않게)
  let touched = false;
  window.Sim = { start() { if (touched) return; auto = true; run(key); }, play(k) { touched = true; auto = false; run(k, true); } };
})();
