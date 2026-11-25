# Jjiggu.github.io

백엔드 개발자 김지훈의 포트폴리오 사이트입니다: https://jjiggu.github.io/

빌드 없는 정적 사이트입니다. 로컬에서는 `python3 -m http.server` 로 띄워 봅니다. 내용은 `data.js` 에 있습니다.

## 모션

주인공은 하나, 점(요청)의 흐름입니다. 사방에서 몰려온 점이 이름이 되고(첫 화면), 풀려서 본문 양옆을 따라 흐르다, Contact에서 다시 모입니다. 나머지 움직임은 그 흐름을 거드는 정도로만 둡니다.

| 파일 | 맡은 일 |
|---|---|
| `stream.js` | 요청 스트림: 이름을 만드는 점(WebGL), 본문 양옆 줄기(CSS 레이어) |
| `main.js` | 내용 그리기, 첫 화면 연출, 스크롤에 따른 등장과 고정 구간 |
| `fx.js` | 길잡이(메뉴, 목차), 이미지 크게 보기, 포인터에 대한 반응 |

모션 줄이기 설정에서는 움직임 없이 내용만 보이고, WebGL을 쓸 수 없으면 이름이 글자 그대로 보입니다.

## 쓴 오픈소스 (`vendor/`)

| 라이브러리 | 쓰는 곳 | 라이선스 |
|---|---|---|
| GSAP 3.15.1 (ScrollTrigger, SplitText, ScrambleText, DrawSVG, MotionPath, Flip, CustomEase, MorphSVG) | 타임라인, 스크롤 연동, 글자 나누기, 도형 변형 | GSAP Standard License (무료) |
| Lenis | 부드러운 스크롤 | MIT |
| Three.js r170 | 이름을 만드는 점 (Points + 셰이더) | MIT |
| Pretendard, Big Shoulders Display | 글꼴 | SIL OFL 1.1 |

모션은 공개된 에이전트 스킬의 지침을 참고해 설계했습니다: [greensock/gsap-skills](https://github.com/greensock/gsap-skills), [pbakaus/impeccable](https://github.com/pbakaus/impeccable), [MengTo/Skills](https://github.com/MengTo/Skills), [emilkowalski/skill](https://github.com/emilkowalski/skill), [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills).
