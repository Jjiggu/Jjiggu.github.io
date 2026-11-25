# Jjiggu.github.io

백엔드 개발자 김지훈의 포트폴리오 사이트입니다: https://jjiggu.github.io/

빌드 없는 정적 사이트입니다. 로컬에서는 `python3 -m http.server` 로 띄워 봅니다. 내용은 `data.js` 에 있습니다.

## 모션

첫 화면에서는 점이 모여 이름이 되고 그 주위를 점 몇 개가 떠다닙니다. Contact에서 이름을 그리던 점이 다시 모입니다. 본문을 읽는 구간에는 계속 움직이는 것을 두지 않습니다.

프로젝트의 이야기는 그 프로젝트로 들어가는 표지에서 합니다. 선착순 쿠폰 표지의 이벤트 화면은 열리면 남은 재고 7,000장이 실측 소진 시간(6.0초) 동안 줄어들고, 그 안에 누르면 접수(202)되어 Redis Streams → DB 적재 시뮬레이션으로 이어지며, 늦으면 매진(409)입니다.

| 파일 | 맡은 일 |
|---|---|
| `stream.js` | 이름을 그리는 점과 첫 화면에 떠다니는 점 (WebGL) |
| `main.js` | 내용 그리기, 첫 화면 연출, 스크롤에 따른 등장과 고정 구간 |
| `fx.js` | 길잡이(메뉴, 목차), 이미지 크게 보기, 포인터에 대한 반응 |

모션 줄이기 설정에서는 움직임 없이 내용만 보이고, WebGL을 쓸 수 없으면 이름이 글자 그대로 보입니다. 기본 테마는 라이트이고, 다크는 고른 방문자에게만 유지됩니다.

## 쓴 오픈소스 (`vendor/`)

| 라이브러리 | 쓰는 곳 | 라이선스 |
|---|---|---|
| GSAP 3.15.1 (ScrollTrigger, SplitText, ScrambleText, DrawSVG, MotionPath, Flip, CustomEase, MorphSVG) | 타임라인, 스크롤 연동, 글자 나누기, 도형 변형 | GSAP Standard License (무료) |
| Lenis | 부드러운 스크롤 | MIT |
| Three.js r170 | 이름을 만드는 점 (Points + 셰이더) | MIT |
| Pretendard, Big Shoulders Display | 글꼴 | SIL OFL 1.1 |

모션은 공개된 에이전트 스킬의 지침을 참고해 설계했습니다: [greensock/gsap-skills](https://github.com/greensock/gsap-skills), [pbakaus/impeccable](https://github.com/pbakaus/impeccable), [MengTo/Skills](https://github.com/MengTo/Skills), [emilkowalski/skill](https://github.com/emilkowalski/skill), [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills).
