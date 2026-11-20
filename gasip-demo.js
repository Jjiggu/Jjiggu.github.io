/* Gasip 체험의 조회 모델: 게시글 100만 건 테이블에서 목록 10건을 읽는 세 가지 방식.
   - scan   : 인덱스 없는 OFFSET (전체 스캔 + filesort)
   - index  : 커버링 인덱스 + OFFSET (건너뛰는 만큼 인덱스를 읽음)
   - cursor : lastPostId 기반 No-Offset
   ponytail: 실제 DB 가 아니라 "몇 행을 읽는지"를 세는 모델. 행을 100만 개 만들지 않고 ID 에서 글을 계산해 냄.
   리뷰 내용·강의명은 예시 데이터. 자체 점검: `node gasip-demo.js` */
(() => {
  const LECT = ['자료구조', '운영체제', '데이터베이스', '컴퓨터네트워크', '알고리즘', '선형대수', '확률과통계', '소프트웨어공학'];
  const TEXT = [
    '과제는 많은데 피드백을 꼼꼼하게 해 주셔서 남는 게 많았어요.',
    '시험은 강의 자료에서 그대로 나옵니다. 출석은 매주 확인해요.',
    '설명이 빠른 편이라 예습을 하고 들어가는 걸 추천합니다.',
    '팀 프로젝트 비중이 커요. 조원을 잘 만나야 합니다.',
    '질문하면 수업 끝나고도 끝까지 답해 주십니다.',
    '중간고사 범위가 넓어요. 족보보다 연습문제를 푸는 게 낫습니다.',
    '실습 위주라 재밌었고 학점도 노력한 만큼 나왔어요.',
  ];
  const h = (id, n) => ((id * 2654435761) >>> 0) % n;

  function createBoard(total = 1_000_000, size = 10) {
    let maxId = total;
    const custom = new Map(); // 체험 중에 새로 쓴 글
    const post = (id) => ({ id, lecture: LECT[h(id, LECT.length)], prof: '교수 ' + 'ABCDEFGH'[h(id + 7, 8)], content: TEXT[h(id + 3, TEXT.length)], likes: h(id + 11, 40), comments: h(id + 5, 12), minutesAgo: (maxId - id) * 4 + 1, ...custom.get(id) });
    const range = (from, n) => Array.from({ length: Math.max(0, Math.min(n, from)) }, (_, i) => post(from - i));

    // cur: { page } (OFFSET 방식) 또는 { lastPostId } (No-Offset)
    function query(mode, cur = {}) {
      if (mode === 'cursor') {
        const last = cur.lastPostId ?? maxId + 1, got = range(last - 1, size + 1); // 한 건 더 읽어 hasNext 판별
        return {
          rows: got.slice(0, size), hasNext: got.length > size, examined: got.length, sorted: 0,
          sql: `SELECT … FROM board\nWHERE post_id < ${cur.lastPostId ?? '(처음)'} AND deleted = 0\nORDER BY post_id DESC\nLIMIT ${size + 1}`,
        };
      }
      const offset = (cur.page || 0) * size, rows = range(maxId - offset, size);
      return {
        rows, hasNext: maxId - offset - size > 0,
        examined: mode === 'scan' ? maxId : offset + rows.length, // 인덱스가 없으면 전부, 있으면 건너뛰는 만큼
        sorted: mode === 'scan' ? maxId : 0,
        sql: `SELECT … FROM board\nWHERE deleted = 0\nORDER BY ${mode === 'scan' ? 'reg_date' : 'post_id'} DESC\nLIMIT ${size} OFFSET ${offset.toLocaleString('en-US')}`,
      };
    }
    return { size, query, post, addPost: (data) => { maxId++; if (data) custom.set(maxId, data); return post(maxId); }, maxId: () => maxId };
  }

  if (typeof document === 'undefined') {
    const assert = require('assert');
    // OFFSET: 페이지 사이에 새 글이 들어오면 이미 본 글이 다시 나옴
    let b = createBoard();
    const p0 = b.query('index', { page: 0 });
    b.addPost();
    const p1 = b.query('index', { page: 1 });
    assert.strictEqual(p1.rows[0].id, p0.rows[9].id, 'OFFSET 중복 노출');
    assert.strictEqual(p1.examined, 20);
    // No-Offset: 중복 없음, 읽는 행은 항상 11
    b = createBoard();
    const c0 = b.query('cursor');
    b.addPost();
    const c1 = b.query('cursor', { lastPostId: c0.rows[9].id });
    assert.strictEqual(c1.rows[0].id, c0.rows[9].id - 1, 'No-Offset 은 이어서');
    assert.strictEqual(c1.examined, 11);
    // 깊은 위치: 건너뛰는 만큼 읽음 vs 그대로 11
    assert.strictEqual(b.query('index', { page: 10000 }).examined, 100010);
    assert.strictEqual(b.query('scan', { page: 10000 }).examined, b.maxId());
    assert.strictEqual(b.query('cursor', { lastPostId: b.maxId() - 100000 }).examined, 11);
    assert.strictEqual(b.query('index', { page: 10000 }).rows[0].id, b.query('cursor', { lastPostId: b.maxId() - 100000 + 1 }).rows[0].id);
    console.log('OK');
    return;
  }
  window.GasipBoard = createBoard;
})();
