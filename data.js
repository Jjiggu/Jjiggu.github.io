// 이력서·경력기술서 원문을 옮긴 데이터. 숫자·제목·사례 순서는 원문(2026-11 판)을 따릅니다.
// metrics: a(이전) → b(이후). bar 는 막대 비율용 숫자 [이전, 이후].
// solution 묶음의 pick: 'x' = 검토 후 제외, 'ok' = 선택. 표시가 없으면 단계(순서대로 한 일).
window.DATA = {
  name: 'Jihoon Kim', // 첫 화면에서는 이름 아래 성으로 두 줄
  role: 'Backend Engineer',
  line:
    '느린 쿼리와 락 경합을 감으로 넘기지 않고, 부하 테스트로 원인을 찾아 숫자로 확인합니다. (주)유닛블랙에서는 사내 챗봇의 검색 품질을 recall@5 0.92까지 올리고, 약 30분 걸리던 근로계약서 작업을 2분 이내로 줄였습니다. 교수 리뷰 앱 Gasip은 MAU 1,560명 규모로 15개월간 운영했습니다.',
  contact: [ // icon: main.js 의 ICONS
    { label: 'GitHub', icon: 'github', href: 'https://github.com/Jjiggu' },
    { label: 'LinkedIn', icon: 'linkedin', href: '' }, // ponytail: 주소를 받으면 채움. 비어 있으면 화면에 안 나옴
    { label: '이메일', icon: 'mail', href: 'mailto:zh1229@naver.com', text: 'zh1229@naver.com' },
  ],


  projects: [
    {
      id: 'unitblack',
      group: 'career',
      name: '(주)유닛블랙',
      kind: '프리랜서 계약직 · HR팀 AX 스쿼드 / GA',
      period: '2025.12 ~ 현재',
      headline: [ // 배열이면 Summary 에 카드가 그 수만큼 나옴 (본문 사례 순서와 같게)
        { b: '0.92', unit: 'recall@5', label: '문서 수집 로직 재설계로 사내 챗봇 검색 품질 개선', note: '골든셋 128건 기준, MRR 0.85' },
        { a: '약 30', b: '2', unit: '분 이내', label: '근로계약서 1건 작업 시간', note: '2주간 116건 체결, 누적 약 54시간 절감' },
      ],
      cases: [
        {
          title: '문서 수집 로직 재설계, Semantic Chunking 적용으로 사내 챗봇 검색 품질 개선',
          metrics: [
            { a: '505', b: '176', unit: '개', label: '청크 수 축소', bar: [505, 176] },
            { b: '0.92', unit: '', label: 'recall@5 · 골든셋 128건 기준' },
            { b: '0.85', unit: '', label: 'MRR · 골든셋 128건 기준' },
          ],
          problem: [
            '프로토타입 배포 후, 매뉴얼에 답이 있는 질문임에도 표현이 조금만 달라지면 답변 품질이 저하되는 문제 확인',
            '기존 Notion 문서 수집 로직에서 하위 페이지 본문이 누락되고, 상위 매뉴얼 경로 등 메타데이터가 보존되지 않음',
            '300~600자 Fixed-Size Chunking 방식이라 매뉴얼 문서를 의미 단위로 나눌 수 없어 맥락이 사라짐',
          ],
          solution: [
            {
              h: 'Notion 하위 블록 재귀 탐색 파싱 로직 재설계',
              items: [
                'Notion API가 반환하는 하위 블록을 재귀적으로 탐색하고, 하위 페이지의 본문을 원래 순서대로 수집하도록 파싱 로직 재설계',
                '‘상위 문서 → 인라인 블록 → 하위 문서 → 문서 내 제목’으로 이어지는 경로를 만들어 각 청크의 메타데이터로 저장',
              ],
            },
            {
              h: 'Semantic Chunking 적용',
              items: [
                'Kiwi 형태소 분석기를 사용해 매뉴얼을 문장 단위로 분리하고, 각 문장에 앞뒤 문장을 더해 세 문장으로 이루어진 Context Window 구성',
                'Context Window 간 Cosine Distance를 계산해 인접한 Context의 의미가 크게 달라지는 지점을 청크의 경계로 판단',
                '매뉴얼 문서의 제목은 첫 번째 본문 청크에 붙여 문서의 주제를 잃지 않도록 함',
              ],
            },
          ],
          result: ['청킹 방식을 재설계해 청크 수를 505개 → 176개로 축소, 골든셋 128건 기준 recall@5 0.92, MRR 0.85 달성'],
        },
        {
          title: '근로계약서 발송 자동화로 건당 작업 시간 93% 절감',
          metrics: [
            { a: '약 30', b: '2', unit: '분 이내', label: '근로계약서 1건 작업 시간', bar: [30, 2] },
            { a: '3', b: '1.96', unit: '일', label: '회수 기간 평균, 약 35% 단축', bar: [3, 1.96] },
            { b: '116', unit: '건', label: '2주간 체결' },
            { b: '54', unit: '시간', label: '누적 절감 (건당 약 28분 × 116건 환산)' },
          ],
          problem: [
            '연봉 협상 중 담당 인력 퇴사로 공백 발생, 급여 반영 일정은 변경 불가',
            '근로계약서 대면 서명 방식은 건당 30분 이상 소요되어, 연봉 협상 대상자의 계약을 기간 내에 모두 체결하기 어려운 상황',
          ],
          solution: [
            '인사 DB의 계약 정보를 근로계약서에 자동 입력하고, 담당자가 미리보기로 확인해 승인한 건만 발송하도록 자동화',
            '발송 요청에 레코드 ID를 search_code로 포함하고, 싸인오케이 외부 문서함을 조회해 같은 계약이 이미 존재하면 발송 차단',
            '발송 실패 시 최대 3회 재시도 로직 수행. 계약서 생성 전 앞선 시도로 생긴 계약서가 있는지 조회해 이중 발송 방지',
            '서명 누락 방지를 위해 미서명자에게 발송 3일 뒤와 만료 2일 전 Slack 리마인드 발송',
          ],
          result: [
            '근로계약서 회수 기간 평균 3일 → 1.96일, 자동화 도입 전 대비 약 35% 단축',
            '근로계약서 1건 작업 시간 약 30분 → 2분 이내로 줄어 2주간 116건 체결, 누적 약 54시간 절감',
            '리마인드 알림을 받은 32명 중 25명이 1시간 안에 서명',
          ],
        },
        {
          title: 'PII 마스킹 게이트를 적용해 외부 LLM 전송 과정의 개인정보 원문 노출 방지',
          metrics: [
            { b: '7', unit: '종', label: '마스킹 대상 개인정보 (주민번호, 카드, 전화, 사업자번호, 계좌, 이메일, 여권)' },
          ],
          problem: [
            'Slack으로 들어온 질문과 매뉴얼 청크가 원문 그대로 외부 LLM으로 전송되는 구조. 외부 LLM의 글로벌 교차 리전 호출로 인해 질문이 국외 리전에서 처리될 수 있어 개인정보의 의도치 않은 국외 반출 위험 존재',
          ],
          solution: [
            '챗봇 LLM 호출, Slack 전송, DB 기록 전에 사내 공용 마스킹 모듈 적용',
          ],
          result: [
            '사내 매뉴얼을 DB에 적재하기 전에 점검하여 마스킹 대상인 개인정보 7종(주민번호, 카드, 전화, 사업자번호, 계좌, 이메일, 여권)에 해당하는 원문 노출 방지',
          ],
        },
      ],
      more: [
        { title: 'RAG 기반 사내 챗봇 ‘블랙이’ 기획 · 설계 · 개발', text: 'Notion 내 매뉴얼 수집, 청킹, 키워드 랭킹 검색, LLM 답변 생성 RAG 파이프라인을 단독 구현해 Slack에 연동. HR팀으로 들어오던 업무요청 문의를 약 30% 줄였습니다.' },
        { title: '답변 모델 변경으로 비용 단가 1/20 수준으로 절감', text: '답변 모델을 Sonnet 5.5에서 Haiku 5.5로 변경해 답변 품질은 유지하면서 비용 단가를 1/20 수준으로 절감' },
      ],
    },
    {
      id: 'hecto',
      group: 'career',
      name: '(주)헥토큐앤엠',
      kind: '현장실습생 · QA Engineer / QA3팀',
      period: '2024.09 ~ 2024.12',
      points: [
        '기획서와 요구사항 명세서를 기반으로 기능 검증용 테스트 케이스를 설계하고, 매주 정기 배포 시 140~500건의 테스트 수행',
        '드시모네몰 상품, 주문, 결제, 정기 구독, 쿠폰, 이벤트 배너 기능을 검증하고, 변경된 정기 배송 정책이 적용되지 않은 사례 16건 발견 후 조치',
      ],
    },
    {
      id: 'coupon',
      group: 'project',
      name: '선착순 쿠폰 발급 시스템',
      kind: '개인 프로젝트',
      sub: '요청이 한 번에 몰리는 선착순 쿠폰 이벤트에서 정합성을 지키며 처리량을 높이는 구조를 단계별로 검증했습니다.',
      period: '2026.09 ~ 2026.10',
      facts: [['형태', '개인 프로젝트']],
      stack: ['Java 17', 'Spring Boot 3.4', 'Spring Data JPA', 'MySQL', 'Redis', 'AWS EC2', 'Docker Compose', 'JUnit 5', 'k6'],
      headline: { a: '140', b: '4,800', unit: 'TPS', label: '쿠폰 지급 최대 처리량', note: '140 → 1,800 → 4,800 TPS, 초과·중복 지급 0건' },
      demo: 'cover', // 표지 바로 뒤: 이벤트 버튼을 누르면 이어서 내 요청이 흘러가는 시뮬레이션
      // 표지: 프로젝트로 넘어갈 때 화면을 꽉 채우는 장면. crowd = 몰려드는 요청 / expand = 이미지가 화면 가득 펼쳐짐 / pan = 긴 이미지가 옆으로 흐름
      cover: {
        type: 'crowd', kicker: '선착순 쿠폰 발급 시스템',
        big: '재고 7,000장 / 최대 4,000 rps', small: '실제 쿠폰 이벤트 사례 (여기어때 네고왕 이벤트, 3,600+ TPS) 기준',
        // 스크롤을 더 내리면 나오는 이벤트 화면 (예전 첫 화면 게이트를 표지 안으로 옮김)
        gate: { tag: '선착순 쿠폰 이벤트 · 재고 7,000장', wait: '곧 이벤트가 시작됩니다', open: '이벤트가 시작됐습니다', btn: '쿠폰 발급받기', sent: '요청을 보냈습니다', again: '한 번 더 누르기', hint: '버튼을 누르면 요청이 Redis Streams를 거쳐 DB에 적재되는 과정을 볼 수 있습니다.' },
      },
      cases: [
        {
          title: 'Redis Streams 기반 write-behind 전략을 적용해 행 락 병목 해소',
          metrics: [{ a: '140', b: '1,800', unit: 'TPS', label: '쿠폰 지급 처리량', bar: [140, 1800] }],
          problem: [
            '쿠폰 지급 API 안에서 실제 쿠폰 지급(INSERT, issued_count UPDATE)까지 처리해 DB에 부하가 몰리고, 쿠폰 지급 처리량이 133~147 TPS에서 정체',
            'DB CPU 사용률은 24~28%로 낮았지만, InnoDB 락 지표 확인 결과 지급 4,800건 중 4,795건에서 쿠폰 행 락 대기가 발생해 CPU가 아닌 행 락이 병목임을 확인',
          ],
          solution: [
            {
              h: 'Redis Pub/Sub', pick: 'x',
              items: [
                'Redis Pub/Sub은 At-Most-Once이기 때문에 메시지 유실 가능성이 있어 적합하지 않다고 판단',
                'subscriber 프로세스를 SIGKILL로 종료하자 지급 접수 성공 응답(202)을 반환한 요청 1,000건 중 967건의 지급 메시지가 유실됨을 확인',
              ],
            },
            {
              h: 'write-behind 전략 (Redis Streams)', pick: 'ok',
              items: [
                'Redis Set의 쿠폰별 지급 회원 명단을 1차 Single Source of Truth로 사용',
                'Producer가 Stream에 메시지를 발행하고, Consumer가 최대 100건을 다중 행 INSERT로 묶어 DB에 적재',
                '쿠폰 행 UPDATE를 없애 행 락 경합 제거',
              ],
            },
            {
              h: '메시지 유실, 중복 대응',
              items: [
                {
                  h: 'DB 커밋 후 ACK 전 Consumer가 종료되는 상황 대응',
                  items: [
                    'ACK를 받지 못한 메시지는 PEL에 보관되고, 재시작한 Consumer가 PEL부터 읽어 재처리 수행',
                    'Exactly-Once Semantics를 목표로 (쿠폰 ID, 회원 ID) 조합을 멱등키로 사용하고, 해당 조합에 UNIQUE 제약을 적용해 쿠폰 중복 지급 방지',
                  ],
                },
                { h: 'Poison Message', items: ['3회 재시도에도 실패한 메시지는 DLQ로 격리'] },
                {
                  h: 'Reconciliation',
                  items: [
                    'DB 쿠폰 지급 이력과 Redis Set 명단을 비교해 DB에 빠진 지급 건(DLQ 격리 건 포함)을 적재하고, issued_count를 갱신해 eventual consistency 보장',
                  ],
                },
              ],
            },
          ],
          result: [
            '쿠폰 행 락 병목 지점을 제거해 쿠폰 지급 처리량 140 → 1,800 TPS',
            'EC2 App c7g.xlarge, DB c7g.large(MySQL, Redis 각 1 CPU), k6 c7g.large에서 rps를 단계적으로 올리며 30초씩 2회 테스트',
          ],
        },
        {
          title: '불필요한 트랜잭션 설정 쿼리 제거로 DB로 가는 쿼리 6개 → 1개 감소',
          metrics: [
            { a: '1,800', b: '4,800', unit: 'TPS', label: '최대 처리량', bar: [1800, 4800] },
            { a: '6', b: '1', unit: '개', label: '회원 확인 요청당 DB 쿼리 수', bar: [6, 1] },
            { a: '89~95', b: '37', unit: '%', label: '1,600 rps에서 DB CPU 사용률', bar: [95, 37] },
            { a: '6~9', b: '2', unit: 'ms', label: '1,600 rps에서 p95', bar: [9, 2] },
          ],
          problem: [
            'write-behind 적용 후 1,600 rps에서 DB CPU 사용률 89~95%, TPS 1,800',
            'performance_schema로 쿼리별 CPU 시간을 측정한 결과, 회원 확인 요청당 약 340µs 중 SELECT는 115µs, set_option과 COMMIT 쿼리가 약 225µs 차지',
            '원인은 의도하지 않은 Transactional 동작. existsById 호출에 SimpleJpaRepository의 클래스 레벨 @Transactional(readOnly = true)와 기본 propagation 속성 REQUIRED가 적용되어 DB 트랜잭션 시작. SELECT 1개 실행 시 set_option 쿼리 4개와 COMMIT 쿼리 1개가 추가로 실행됨을 확인',
          ],
          solution: [
            '회원 존재 여부를 확인하는 JPQL 커스텀 쿼리를 선언해 SimpleJpaRepository의 기본 트랜잭션 설정을 우회. JpaRepository 대신 Repository만 상속해 existsById 등 기본 메서드가 상속되지 않도록 구현',
            '@Transactional(readOnly = true, propagation = SUPPORTS)로 상위 트랜잭션이 없으면 트랜잭션 없이 실행한다는 의도 명시',
            'NEVER는 상위 트랜잭션이 있을 때 예외가 발생하고, NOT_SUPPORTED는 추가 커넥션을 사용할 수 있어 제외',
          ],
          result: [
            '회원 확인 요청당 DB로 가는 쿼리 6개 → 1개 감소',
            '1,600 rps에서 DB CPU 사용률 89~95% → 37%, p95 6~9ms → 2ms',
            '최대 처리량 1,800 → 4,800 TPS',
            '실제 쿠폰 이벤트 사례(여기어때 네고왕 이벤트, 3,600+ TPS)를 기준으로 재고 7,000장, 최대 4,000 rps, 10분 이벤트 시나리오를 구성 → 요청 약 123만 건에서 5xx 0건, 초과 지급 0건, 지급 성공 응답 7,000건 = DB 지급 7,000건, 재고 소진(오픈 6.0초) 약 1초 뒤 DB 적재 완료(7.1초, 1초 간격 샘플링)',
          ],
        },
        {
          title: '쿠폰 재고 정합성을 지키기 위한 동시성 제어 방법 9가지 비교 후 Lua Script 선택',
          metrics: [
            { a: '431~704', b: '1,667~3,125', unit: 'rps', label: '응답 처리량, 비관적 락 → Lua (로컬 k6, 재고 100장·요청 1,000건 3회)', bar: [704, 3125] },
            { b: '0', unit: '건', label: '초과/중복 지급 (테스트 3회 모두)' },
          ],
          problem: ['재고 정합성, 1인 1장, 선착순 처리를 보장하면서 높은 처리량을 확보할 수 있는 동시성 제어 방법 필요'],
          solution: [
            {
              h: 'DB 격리 수준 조정', pick: 'x',
              items: [
                {
                  h: 'READ COMMITTED, REPEATABLE READ',
                  items: ['재고 50장, 동시 요청 50건 테스트에서 성공 응답은 50건이었지만 실제 issued_count는 5~6. 여러 요청이 동일한 issued_count를 읽고 각각 +1한 값으로 갱신하면서 갱신 손실 발생'],
                },
                { h: 'SERIALIZABLE', items: ['S 락을 쥔 채 X 락으로 issued_count를 갱신하는 구조라 데드락 발생'] },
              ],
            },
            {
              h: 'DB 수준 락 방식', pick: 'x',
              items: [
                { h: '낙관적 락', items: ['재시도가 없으면 50건 중 6건만 지급되었으며, 재시도하면 선착순이 보장되지 않아 제외'] },
                { h: '비관적 락', items: ['락 대기로 인해 단순 조회 p95가 10ms → 444ms, CATS 알고리즘의 가중치에 따라 선착순이 보장되지 않음을 확인해 제외'] },
              ],
            },
            {
              h: 'Redis Set', pick: 'x',
              items: [
                'SCARD + SADD: 지급 수량을 확인하는 SCARD와 지급 대상을 등록하는 SADD 사이에 다른 요청의 명령이 실행되어 초과 지급 발생',
                'MULTI/EXEC(Redis Transaction): 명령을 묶어 실행할 수 있지만 실행 결과에 따른 조건 분기가 어려워 초과 지급 시 SREM으로 되돌리는 별도 롤백 로직이 필요하다고 판단해 제외',
                'WATCH: 충돌한 요청을 재처리하면서 선착순이 보장되지 않아 제외',
              ],
            },
            {
              h: 'Lua Script', pick: 'ok',
              items: [
                '선착순 기준을 Redis 처리 순서로 재정의',
                '중복 확인 → 재고 확인 → SADD를 하나의 Lua Script로 원자적으로 실행해 다른 요청의 개입을 차단. 별도 롤백 로직 없이 동시성 문제를 해결할 수 있다고 판단해 채택',
              ],
            },
          ],
          result: [
            '재고 100장, 요청 1,000건(로컬 k6, 3회)에서 응답 처리량이 비관적 락 431~704 rps에서 Lua Script 1,667~3,125 rps로 증가',
            '테스트 3회 모두 초과/중복 지급 0건, Redis 처리 순서 기준 선착순 100명 지급 확인',
          ],
        },
      ],
    },
    {
      id: 'nowait',
      group: 'project',
      name: 'NoWait',
      kind: '팀 프로젝트',
      sub: '축제 부스 원격 줄서기와 테이블 오더를 통한 음식 주문을 지원하고, 관리자에게 주문 접수, 입장 관리, 매출 통계 기능을 제공하는 서비스',
      period: '2025.06 ~ 2026.02',
      facts: [
        ['참여인력', '백엔드 2명 / 프론트엔드 3명 / 디자이너 1명'],
        ['담당', '백엔드 리드, 팀 빌딩 및 기획, AWS(EC2, RDS, Lambda, Route 53, S3) 인프라 구축, 멀티 모듈 아키텍처 설계 · 기여도 60%'],
      ],
      stack: ['Java 17', 'Spring Boot 3.5', 'Spring Data JPA', 'Querydsl', 'MySQL', 'Redis', 'AWS(EC2, RDS, S3, Lambda)', 'Docker', 'GitHub Actions', 'Prometheus', 'Grafana'],
      headline: { a: '59,808', b: '123', unit: '회', label: 'RDB로 향하는 메뉴 조회 쿼리 99.8% 감소', note: '1,000 rps - 60초 기준, 캐시 히트율 99.8%' },
      demo: true,
      accent: ['#ff7a45', '#b83705'], // 프로젝트 안의 강조색 [다크, 라이트]: NoWait 주황
      cover: { type: 'expand', img: 'assets/nowait/service.webp', w: 2400, h: 1350, bg: '#fff', alt: 'NoWait 서비스 화면 모음: 노웨잇 로고와 “기다림 없는 즐거운 축제” 문구, 부스 목록·메뉴·주문·송금·대기 등록 화면' },
      cases: [
        {
          title: 'Redis Pub/Sub 기반 캐시 무효화로 RDB로 향하는 메뉴 조회 쿼리 99.8% 감소',
          metrics: [
            { a: '59,808', b: '123', unit: '회', label: '메뉴 조회 쿼리 (1,000 rps - 60초 기준)', bar: [59808, 123] },
            { a: '57.6', b: '1.3', unit: 'ms', label: '2,000 rps에서 p95', bar: [57.6, 1.3] },
            { a: '99', b: '31', unit: '%', label: '2,000 rps에서 DB CPU 사용률', bar: [99, 31] },
            { b: '99.8', unit: '%', label: '캐시 히트율' },
          ],
          problem: [
            '메뉴 조회 요청마다 쿼리를 실행해 2,000 rps에서 DB CPU 사용률 99%까지 상승, p95 57.6ms',
            '메뉴 수정(Admin API)과 조회(User API)를 서로 다른 서버 인스턴스에서 처리하므로, 로컬 캐시만 사용하면 변경 사항이 전파되지 않아 품절된 메뉴가 판매 가능한 상태로 노출될 수 있음',
          ],
          solution: [
            {
              h: '글로벌 캐시', pick: 'x',
              items: [
                '모든 조회 요청이 Redis를 거치는 글로벌 캐시는 캐시 부하가 Redis로 집중돼 Redis 자체가 성능 병목 지점이 될 수 있음. 원격 줄서기도 같은 Redis에서 처리하고 있어, 메뉴 조회가 몰리면 원격 줄서기의 성능 및 안정성 저하로 이어질 수 있다고 판단해 제외',
              ],
            },
            {
              h: 'Redis Pub/Sub 기반 무효화', pick: 'ok',
              items: [
                '메뉴 변경 시 RDB 업데이트 완료 후 Redis Pub/Sub으로 캐시 무효화 메시지를 발행하고, 메시지를 받은 모든 인스턴스가 Caffeine 기반 로컬 캐시에서 해당 주점 키 삭제',
                'TTL을 5분으로 설정해 만료로 인한 캐시 미스를 줄이고, 무효화 메시지 발행 실패에 대비해 TTL 자체는 유지',
                'Pub/Sub은 Fire-and-Forget 방식이므로 연결이 끊긴 동안 무효화 메시지를 놓칠 수 있음. 재구독 성공 시 로컬 캐시 전체를 비워 누락된 무효화 메시지에 대응',
              ],
            },
            {
              h: '캐시 스탬피드 방지',
              items: ['TTL의 90%가 지나면 경과 비율이 높아질수록 갱신 확률을 높여 캐시를 미리 갱신(93% 경과 시 30%, 95% 50%, 98% 80%)'],
            },
          ],
          result: [
            '메뉴 조회 쿼리 59,808 → 123회로 99.8% 감소 (1,000 rps - 60초 기준), 캐시 히트율 99.8%',
            '2,000 rps에서 p95 57.6 → 1.3ms, DB CPU 사용률 99% → 31%',
          ],
        },
        {
          title: '원격 줄서기 멱등성 처리 과정의 Race Condition 및 커밋 순서 문제 해결',
          metrics: [
            { b: '1', unit: '건', label: '같은 키 동시 요청 10건 중 실행된 요청' },
            { b: '9', unit: '건', label: '409로 응답한 요청' },
          ],
          problem: [
            '키 조회(GET)와 저장(SET)이 별도 명령이라, 같은 키로 들어온 동시 요청들이 모두 키가 없는 것으로 조회되어 줄서기 중복 등록 발생 가능',
            '멱등 처리 로직이 트랜잭션 내부에서 실행되어 커밋 전에 성공 응답이 저장됨. 이후 커밋이 실패하더라도 재시도 시 저장된 성공 응답이 반환되는 문제 발생',
          ],
          solution: [
            '조회와 저장을 SET NX 한 번으로 합쳐 키 선점을 원자적으로 처리',
            '멱등 처리를 트랜잭션 밖으로 옮겨 커밋 후에만 응답 저장, 실패 시 키를 삭제해 바로 재시도 허용',
            '요청 처리 중 서버가 종료되어 키가 남는 상황에 대비해 TTL을 처리 중 상태는 1분, 완료 상태는 3분으로 구분',
          ],
          result: [
            '같은 키 동시 요청 테스트 결과 10건 중 1건만 원격 줄서기 등록 실행, 9건은 409',
            '커밋에 성공한 요청의 응답만 저장해 재요청 시 저장된 응답을 반환하고, 커밋에 실패한 요청은 재시도 시 다시 처리',
          ],
        },
        {
          title: 'S3 이벤트와 AWS Lambda를 활용해 이미지 리사이징을 백엔드 서버에서 분리',
          metrics: [{ b: '30', unit: '%', label: '서버 CPU 부하 감소' }],
          problem: [
            '사용자가 올리는 원본 이미지의 크기와 비율이 제각각이라 썸네일, 배너 등 용도별 리사이징 필요',
            '백엔드 서버에서 직접 리사이징하면 업로드 요청의 커넥션 유지 시간이 길어지고 CPU 사용량이 증가해 서버에 부담이 될 수 있음',
          ],
          solution: [
            '프로젝트 규모를 고려해 별도 서버 대신 AWS Lambda로 비동기 처리',
            'S3 원본 버킷의 객체 생성 이벤트를 Lambda로 전달, 리사이징한 이미지를 별도 버킷에 저장',
          ],
          result: ['리사이징 과정을 AWS Lambda로 옮겨 서버 CPU 부하 30% 감소'],
        },
      ],
      more: [
        { title: 'Lua Script로 대기 번호 발급과 대기열 등록을 원자적으로 처리', text: '원격 줄서기 대기 번호와 실제 대기 순서 정합성을 맞추기 위해 Lua Script로 중복 확인, 대기 번호 발급, Redis Sorted Set 등록을 원자적으로 처리. score는 Redis 서버 시각을 ms로 변환 후 대기열 최댓값보다 크게 설정해 순서 정합성 보장' },
        {
          title: 'Redis Replication / 영속화 설정으로 대기열 데이터 유실 위험 최소화',
          problem: [
            '원격 줄서기 데이터를 Redis Sorted Set에 저장해 인스턴스 장애 시 대기열 데이터 전체 유실 위험',
            'Redis 인스턴스 1대 운영, 웨이팅 데이터는 입장 호출, 입장 취소 전까지 Redis에만 저장돼 인스턴스 장애 시 복구 불가능',
          ],
          solution: ['Master 1대 - Replica 2대 Replication 구성', 'RDB와 AOF 영속화 옵션 하이브리드 설정'],
          result: ['Master 1대와 Replica 2대로 구성하고 Redis 영속화 옵션을 통해 데이터 유실 위험 최소화'],
        },
        {
          title: 'GitHub Actions 기반 CI/CD 자동화 파이프라인 구축',
          metric: '배포 시간 약 10분 → 1분 이내',
          problem: [
            '배포마다 AWS EC2에서 직접 git pull, application.yml 작성, 수동 빌드, JAR 실행을 반복해 실수가 잦고 10분 이상 소요',
            '환경 변수 설정과 빌드 명령 등 사람이 직접 처리하는 단계가 많음',
            '개발 환경과 운영 서버의 설정 차이로 로컬에서 정상이던 코드가 운영에서 실패',
          ],
          solution: [
            { h: 'Jenkins', pick: 'x', items: ['유연하지만 별도 서버 구축·관리가 필요해 보류'] },
            { h: 'Bamboo', pick: 'x', items: ['NoWait 팀은 Jira를 쓰지 않아 도입 효과가 작다고 판단'] },
            { h: 'GitHub Actions', pick: 'ok', items: ['클라우드 러너로 별도 서버 없이 자동화할 수 있고 YAML 워크플로로 관리하기 쉬워 선택'] },
            { h: 'Docker', pick: 'ok', items: ['변경 경로에 맞는 앱의 bootJar와 이미지를 빌드해 배포, 컨테이너로 실행 환경을 통일할 수 있어 선택'] },
          ],
          result: ['배포 시간 약 10분 → 1분 이내(90% 단축)', '환경 불일치와 수동 작업에서 생기던 오류 감소'],
        },
        { title: 'Discord 에러 알림으로 오류 대응 시간 5분 이내', metric: '평균 30분 이상 → 5분 이내', text: '오류마다 EC2에 직접 접속해 로그를 확인하느라 평균 30분 이상 걸리던 오류 파악을 전역 예외 처리에서 OpenFeign으로 API, 요청 정보, 스택 트레이스를 Discord 에러 알림 채널에 보내 오류 대응 시간 5분 이내로 단축' },
        { title: '송금 화면 진입 4단계 → 1단계', text: '와이어프레임 테스트에서 30명 중 23명이 불편하다고 답한 테이블 오더 송금 과정을 주점별 토스, 카카오페이, 네이버페이 송금 링크 저장으로 바꿔 송금 화면 진입 4단계 → 1단계 단축으로 사용자 경험 개선',
          compare: [ // 프론트엔드 레포(GTable/NoWait_FE)의 송금 화면. pay: 그 시점에 쓰는 송금 수단
            { tag: 'AS-IS', steps: '4단계', pay: 'direct', title: '계좌번호를 복사해 직접 이체', text: '안내된 계좌번호를 복사한 뒤 은행 앱을 따로 열어 이체해야 했습니다.' },
            { tag: 'TO-BE', steps: '1단계', pay: '토스', title: '저장된 송금 링크로 바로 이동', text: '이체하기를 누르면 주점이 저장해 둔 토스, 카카오페이, 네이버페이 송금 링크가 바로 열립니다.' },
          ] },
      ],
    },
    {
      id: 'gasip',
      group: 'project',
      name: 'Gasip',
      kind: '팀 프로젝트',
      sub: '가천대학교 교수님 익명 리뷰 커뮤니티 앱. 재학생이 교수님 강의 평가를 공유하고 자유롭게 리뷰를 작성합니다. 앱스토어에 출시하고 에브리타임으로 사용자를 모집해 15개월간 AWS EC2, RDS 기반 클라우드 환경에서 운영했습니다.',
      period: '2023.08 ~ 2025.03',
      facts: [
        ['참여인력', '백엔드 2명 / 프론트엔드 2명 / 디자이너 1명'],
        ['담당', '팀 빌딩, 기획 및 요구사항 정의, 서비스 운영, 리뷰 CRUD 구현 및 성능 최적화 · 기여도 40%'],
        ['운영', 'MAU 1,560명 · 앱스토어 평점 4.8점 · 출시 첫날 장애 이후 15개월간 Prod 심각도 High 이상 장애 0건'],
      ],
      stack: ['Java 17', 'Spring Boot 3.1', 'Spring Data JPA', 'Querydsl', 'MySQL', 'Redis', 'AWS(EC2, RDS, CodeDeploy)', 'GitHub Actions', 'nGrinder', 'k6'],
      headline: { a: '6,271', b: '0.90', unit: 'ms', label: '리뷰 목록 조회 SQL 실행 시간', note: '게시글 100만 건 부하 테스트, OFFSET 8,300 기준' },
      demo: true,
      accent: ['#4f9dff', '#0a5bd6'], // Gasip 파랑
      // 앱스토어 소개 화면 원본 해상도 그대로 (WebP 92%)
      cover: { type: 'pan', img: 'assets/gasip/app-screens.webp', w: 4666, h: 1400, bg: '#007aff', alt: 'Gasip 앱스토어 소개 화면 7장: 가천대학교 유일 교수님 전문 리뷰앱, 가천인들만의 커뮤니티, 교수님 리뷰 확인·작성, 정보 공유, 전체 리뷰 화면' },
      cases: [
        {
          title: '리뷰 목록 조회 SQL 실행 시간 6,271ms → 0.90ms',
          metrics: [
            { a: '6,271', b: '0.90', unit: 'ms', label: 'SQL 실행 시간 (OFFSET 8,300 기준)', bar: [6271, 0.9] },
            { a: '5.7', b: '0.90', unit: 'ms', label: 'SQL 실행 시간, 커버링 인덱스 → No-Offset (OFFSET 8,300 기준)', bar: [5.7, 0.9] },
            { a: '31', b: '211.8', unit: 'TPS', label: 'OFFSET 100,000 기준, 커버링 인덱스 → No-Offset (p95 152ms)', bar: [31, 211.8] },
            { a: '타임아웃', b: '205.8', unit: 'TPS', label: 'OFFSET 8,300 기준 (p95 156ms)' },
          ],
          problem: [
            '전교생 22,000명 중 80%가 피크 시간대 1시간 동안 리뷰 게시판을 각각 15회 조회한다고 가정하고, 목표 처리량을 75 TPS, p95 1,000ms 이하로 설정',
            '게시글 10건을 조회하려고 조건에 맞는 게시글 ID 73만 개(7.8MB)를 애플리케이션으로 모두 가져온 뒤, 147만 자짜리 IN 절에 담아 다시 조회. 힙 512MB, VU 5에서 OOM 발생',
            '인덱스 없는 OFFSET 조회로 요청마다 100만 행을 스캔하고 727,554행에 filesort를 수행해 SQL 실행 6.3초 소요',
            '디스크 기반 filesort로 쿼리가 지연돼 커넥션 풀이 고갈되고, 나머지 요청은 HikariCP 커넥션 타임아웃으로 실패해 VU 20에서 전체 요청 실패',
            '새 리뷰가 등록되면 다음 페이지에 이미 본 리뷰가 다시 나오는 중복 노출 문제를 사용자가 지적',
          ],
          solution: [
            { h: '쿼리 튜닝', items: ['후보 ID 조회에 쓰던 필터 조건을 메인 쿼리의 WHERE 절로 옮겨 DB가 필터링, 정렬, OFFSET까지 처리하고 10건만 반환하는 단일 쿼리로 통합. 100만 행 풀 테이블 스캔과 72만 행 filesort가 남아 0.5 TPS로 목표 미달'] },
            {
              h: '커버링 인덱스',
              items: [
                '정렬, 필터 컬럼으로 복합 인덱스를 만들고 ID 조회 쿼리가 테이블 접근 없이 커버링 인덱스만 읽도록 PK 10개 조회와 본문 조회를 분리. OFFSET 8,300에서는 147.6 TPS로 목표를 넘겼지만, OFFSET 100,000에서는 건너뛰는 행만큼 인덱스를 읽어 31 TPS로 목표 미달',
              ],
            },
            {
              h: 'No-Offset', pick: 'ok',
              items: ['게시판이 무한 스크롤 방식이어서 페이지 번호를 통한 이동이 불필요하므로 lastPostId 기반 No-Offset으로 전환. 페이지 조회 사이에 새 리뷰가 추가되더라도 이미 본 리뷰가 중복 노출되지 않도록 개선'],
            },
          ],
          result: [
            '테스트 환경: EC2 3대(DB c7g.large 2 vCPU, 앱 2코어), 게시글 100만 건, 페이지 크기 10, k6 VU 20, 45초 × 3회 중앙값',
            'OFFSET 8,300 기준 SQL 실행 시간 6,271 → 0.90ms, HikariCP 커넥션 타임아웃 → 205.8 TPS (p95 156ms)',
            'OFFSET 100,000 기준 TPS 31 → 211.8 (p95 152ms)',
            '새 리뷰가 등록돼도 이미 본 리뷰가 중복 노출되지 않아 사용자가 지적한 불편 해소',
          ],
        },
      ],
      more: [
        { title: '출시 첫날 장애 이후 stage 서버와 배포 워크플로 추가', metric: '15개월 심각도 High 이상 장애 0건', text: '출시 첫날 이메일 인증 장애로 가입 시도자 50명 이상 이탈. 재발 방지를 위해 운영 배포 전 변경 사항을 검증할 Stage 서버와 배포 워크플로우를 추가하고 ERROR 로그를 전달하는 Discord 알림 채널 구축. 15개월 동안 운영 환경에서 심각도 High 이상 장애 0건' },
      ],
    },
  ],

};

/* ───────── 레포에서 가져온 근거 자료 (evidence.js 가 그림) ─────────
   수치는 각 레포의 README·측정 원본 문서에서 그대로 옮겼습니다. 출처 링크를 항목마다 답니다. */
(() => {
  const P = Object.fromEntries(window.DATA.projects.map((p) => [p.id, p]));
  const CP = 'https://github.com/Jjiggu/CouponToyProject';

  // 사내 서비스라 레포 대신 실제 사용 화면 (이름 등은 원본에서 가림)
  P.unitblack.evidence = [
    {
      type: 'image', case: 1, label: '실제 화면',
      title: '근로계약서 자동화 사용 화면',
      desc: '계약마다 Slack 스레드 하나로 발송 → 근로자 서명 → 회사 서명 요청 → 체결 완료를 추적합니다. 오른쪽은 미서명자에게 가는 리마인드 DM입니다.',
      img: 'assets/unitblack/contract-slack-screens.webp', w: 2396, h: 985,
      alt: '블랙이가 보낸 Slack 스레드: 근로계약서 발송, 근로자 서명 완료, 회사 서명 요청, 체결 완료 메시지와 서명 기한을 알리는 리마인드 DM. 대상자 정보는 가려져 있음',
    },
    {
      type: 'image', case: 0, label: '실제 화면',
      title: '사내 챗봇 ‘블랙이’ 런칭 공지와 사용 예시',
      desc: '질문하면 Notion 규정을 근거로 답하고, 출처 문서와 최종 수정일을 함께 보여 줍니다. 틀렸거나 아쉬운 답변은 버튼으로 피드백을 받아 매뉴얼을 보강합니다.',
      img: 'assets/unitblack/chatbot-notice-usage.webp', w: 2400, h: 1008,
      alt: '왼쪽은 HR 챗봇 블랙이 런칭 공지, 오른쪽은 경조사 신청 절차를 물은 질문에 신청 과정, 준비 서류, 경조휴가 일수와 출처 문서 세 개, 피드백 버튼을 답한 Slack 화면',
    },
  ];

  P.coupon.repo = CP;
  P.coupon.evidence = [
    {
      type: 'line', case: 1,
      title: '9단계와 10단계의 rps별 MySQL CPU 사용률',
      desc: '같은 날·같은 인스턴스(2026-10-23). 9단계는 1,800 rps 에서 CPU 가 포화됐습니다. 10단계에서는 회원 확인의 트랜잭션 설정 쿼리를 제거해 4,800 rps 까지 처리했습니다. 동그라미는 두 회차 모두 조건을 만족한 최대 rps 입니다. 10단계의 2,000~4,500 은 탐색 1회 값이고 나머지는 2회 평균입니다. 5,400 에서는 처리 한계를 넘어 그리지 않았습니다.',
      src: { label: '10단계 EC2 측정 원본', url: CP + '/blob/HEAD/docs/learning/results/2026-10-23-stage10-ec2.md' },
      xLabel: '목표 rps', xUnit: 'rps', yUnit: '%', xRange: [1400, 5400], yMax: 100,
      xTicks: [1600, 2000, 2500, 3000, 3500, 4000, 4500, 4800, 5200], yTicks: [0, 25, 50, 75, 100],
      series: [
        { name: '9단계 write-behind', pts: [[1600, 92], [1800, 99.5], [1900, 100], [2000, 100]], mark: { x: 1800, label: '1,800' } },
        { name: '10단계 회원 확인 트랜잭션 제거', pts: [[1600, 37], [2000, 43], [2500, 52], [3000, 61], [3500, 71], [4000, 80], [4500, 89], [4600, 88.5], [4800, 91], [5000, 95.5], [5200, 99]], mark: { x: 4800, label: '4,800' } },
      ],
    },
    {
      type: 'bars', case: 1,
      title: '이벤트 오픈 후 10분간 분 단위 지표',
      desc: '2026-10-25, 10단계 방식 1회 실행. 보낸 요청은 더블클릭 58,715쌍을 포함해 1,230,712건입니다. 202 접수가 7,000건, 409 거절이 1,223,712건이었고 서버 오류는 0건이었습니다. 재고는 오픈 6.0초에 소진됐고 DB 적재는 7.1초에 끝났습니다. 둘 다 1초 간격 샘플링이라 ±1초 오차가 있습니다.',
      src: { label: '이벤트 시나리오 측정 원본', url: CP + '/blob/HEAD/docs/learning/results/2026-10-25-event-ec2.md' },
      xLabel: '분', xUnit: '분', contextLabel: '목표 rps',
      labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      context: ['0~4000', '4000~4000', '3129~4000', '2062~3111', '996~2044', '800~978', '800~800', '800~800', '800~800', '800~800', '800~800'],
      measures: [
        { name: '보낸 요청', unit: '건', values: [230840, 252106, 228766, 162196, 95272, 51350, 50314, 50517, 50520, 50420, 8411] },
        { name: '응답 p95', unit: 'ms', values: [4.9, 4.2, 3.2, 1.9, 1.4, 1.2, 1.2, 1.2, 1.1, 1.1, 1.1] },
        { name: 'MySQL CPU', unit: '%', values: [58, 62, 56, 39, 23, 13, 12, 13, 12, 13, 2] },
      ],
    },
  ];

  const GS = 'https://github.com/GASIP-PROJECT/gasip-backend';
  P.gasip.repo = GS;
})();

(() => {
  const P = Object.fromEntries(window.DATA.projects.map((p) => [p.id, p]));
  const NW = 'https://github.com/GTable/NoWait_BE_MultiModule';
  P.nowait.repo = NW;
  P.nowait.evidence = [
    {
      type: 'image', at: 'head',
      title: '시스템 구성',
      desc: 'user-api 와 admin-api 가 다른 인스턴스로 돌고 메뉴가 바뀌면 Redis Pub/Sub 으로 user-api 의 Caffeine 캐시를 무효화합니다. 대기열은 Redis Sorted Set 으로 만들었습니다. 이미지는 S3 원본 → Lambda → S3 리사이즈 순서로 처리합니다. 배포 흐름은 GitHub Actions → Docker Hub → compose pull 입니다.',
      src: { label: 'README · System Architecture', url: NW },
      img: 'assets/nowait/architecture.webp', w: 2880, h: 2140,
      alt: '손님과 주점 운영자가 웹을 거쳐 EC2 의 user-api, admin-api 로 요청하고, Redis Master 와 복제본 2대, RDS MySQL, S3 와 Lambda, Prometheus 와 Grafana, GitHub Actions 와 Docker Hub 배포 경로가 연결된 구성도',
    },
    {
      type: 'flow', case: 0, label: '동작 흐름',
      title: '메뉴가 변경되면 해당 주점 키만 무효화하는 로컬 캐시',
      desc: '메뉴 조회는 각 User API 인스턴스의 로컬 캐시(Caffeine)에서 응답하고, Redis Pub/Sub 은 캐시 무효화 메시지만 전파합니다. 점이 요청과 메시지입니다.',
      steps: [
        '메뉴 조회는 User API 인스턴스의 로컬 캐시에서 바로 응답합니다.',
        '운영자가 메뉴를 품절 처리하면 Admin API 가 DB 변경을 커밋합니다.',
        '커밋 후 Redis Pub/Sub 으로 캐시 무효화 메시지를 발행합니다.',
        '메시지를 구독한 모든 User API 인스턴스가 해당 주점 키만 로컬 캐시에서 삭제합니다.',
        '다음 조회 때 DB 에서 한 번 읽어 로컬 캐시에 다시 적재합니다.',
      ],
    },
    {
      type: 'line', case: 0,
      title: '캐시 전후의 rps별 MySQL CPU 사용량',
      desc: 'MySQL 을 1 CPU 로 제한한 EC2 에서 부하 단계마다 60초씩 측정했습니다. 캐시 전에는 2,000 rps 에서 CPU 가 포화됐고, 캐시 후에는 같은 rps 에서 0.31 코어였습니다. 동그라미는 p95 200ms 이내로 처리한 최대 rps 입니다.',
      src: { label: 'performance/menu-cache/03-cache.md', url: NW + '/blob/HEAD/performance/menu-cache/03-cache.md' },
      xLabel: '목표 rps', xUnit: 'rps', yUnit: '코어', xRange: [0, 6200], yMax: 1,
      xTicks: [200, 1000, 2000, 3000, 4000, 6000], yTicks: [0, 0.25, 0.5, 0.75, 1],
      series: [
        { name: '캐시 전 (JOIN + 인덱스)', pts: [[200, 0.11], [1000, 0.5], [2000, 0.99], [3000, 0.99], [4000, 0.99]], mark: { x: 2000, label: '2,000' } },
        { name: '캐시 후', pts: [[200, 0.04], [1000, 0.15], [2000, 0.31], [4000, 0.59], [6000, 0.88]], mark: { x: 4000, label: '4,000' } },
      ],
    },
  ];
})();
