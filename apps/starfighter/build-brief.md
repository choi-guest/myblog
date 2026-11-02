# Build 서브에이전트 지침

## 역할
승인된 계획서 `apps/starfighter/spec.md`대로 "스타파이터" 웹앱을 구현한다.

## 수정 범위
- 만들 파일 (spec.md 7장 파일 구조 그대로):
  - `apps/starfighter/index.html`, `apps/starfighter/style.css`
  - `apps/starfighter/js/` 아래: `config.js`, `formations.js`, `enemies.js`, `boss.js`, `collision.js`, `game.js`, `rng.js`, `render.js`, `hud.js`, `input.js`, `audio.js`, `storage.js`, `main.js`
  - `apps/starfighter/preview.svg`
- 위 목록 밖의 파일은 만들거나 고치지 않는다. `spec.md`, `plan-brief.md`, 이 지침 파일, 다른 앱 폴더, 블로그 파일, `CLAUDE.md`, `.claude/`는 수정 금지.
- git 커밋하지 않는다. 서버를 띄우지 않는다(브라우저 검증은 Review 단계가 한다).
- 임시 테스트 스크립트는 스크래치 폴더에만 둔다.

## 구현 기준
- spec.md의 규칙·10단계 난이도 표·점수·화면·조작·접근성·디자인 항목을 모두 반영한다. spec과 다르게 해야 할 이유가 생기면 임의로 바꾸지 말고 보고서에 적는다.
- **특정 기존 게임 복제 금지**: spec.md 1장 차별점 표와 금지 목록을 지킨다(포획 광선·쌍발 기체, 보너스 스테이지, 원작 적·기체 디자인, 효과음, 진입 궤적, 문구 사용 금지).
- 순수 HTML/CSS/JS(ES 모듈), Canvas 2D. 외부 라이브러리·CDN·이미지 파일 없이 코드로 그린다(preview.svg 제외).
- `game.js`와 규칙 모듈(config, formations, enemies, boss, collision, rng)은 DOM·window 접근 없는 순수 로직. 난수·시간 주입 가능.
- `innerHTML` 사용 금지. `textContent`와 요소 생성으로 그린다.
- `const`/`let`, 세미콜론, 2칸 들여쓰기, UTF-8.
- 색상은 `:root` CSS 변수로만 정의(Canvas 팔레트도 CSS 변수에서 읽기), 라이트/다크 모두 UI 텍스트 대비 4.5:1 이상.
- 모바일 우선, 375px에서 가로 스크롤 없음, 터치 대상 44×44px 이상, 게임 화면을 끌 때 페이지 스크롤 방지, `prefers-reduced-motion` 존중(화면 흔들림·번쩍임 줄이기).
- 탭이 숨겨지면 자동 일시정지. 프레임 간격이 크게 벌어져도 한 번에 너무 많이 진행하지 않게 상한을 둔다.
- `apps/starfighter/` 밖 파일에 의존하지 않는다(블로그로 돌아가는 단순 링크 `../../index.html`만 허용).

## 자체 점검 (서버 없이)
- 각 JS 파일에 `node --check`.
- Node에서 `game.js`를 import해 고정 시드로 단계별 시뮬레이션을 돌려 본다: 10단계 모두 웨이브 생성, 적 처치·점수·연쇄 배율, 피격·목숨·무적, 우두머리 등장과 격파, 단계 클리어/게임 오버, 적 탄 상한 준수. 단계가 오를수록 수치가 표대로 커지는지.

## 보고
한국어로: 만든 파일 목록, spec과 달라진 점(있다면), 자체 점검 결과, Review에서 특히 봐야 할 부분.
