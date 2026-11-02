# Build 서브에이전트 지침

## 역할
승인된 계획서 `apps/element-alchemy/spec.md`대로 "원소 연금술" 웹앱을 구현한다.

## 수정 범위
- 만들 파일 (spec.md 6장 파일 구조 그대로):
  - `apps/element-alchemy/index.html`
  - `apps/element-alchemy/style.css`
  - `apps/element-alchemy/js/elements.js`, `game.js`, `render.js`, `input.js`, `storage.js`, `main.js`
  - `apps/element-alchemy/preview.svg`
- 위 목록 밖의 파일은 만들거나 고치지 않는다. 특히 `spec.md`, `plan-brief.md`, 이 지침 파일, 블로그 파일(index.html, post.html, css/, js/, posts/, sudoku/), `CLAUDE.md`, `.claude/`는 수정 금지.
- git 커밋하지 않는다. 서버를 띄우지 않는다(검증은 Review 단계가 한다).

## 구현 기준
- spec.md의 규칙·점수·화면·조작·접근성·디자인 항목을 모두 반영한다. spec과 다르게 해야 할 이유가 생기면 임의로 바꾸지 말고 보고서에 적는다.
- 2048의 판 크기·숫자 타일·색상·문구를 쓰지 않는다.
- 순수 HTML/CSS/JS(ES 모듈). 외부 라이브러리·CDN·package.json 없음.
- `game.js`는 DOM에 접근하지 않는 순수 로직. `createGame({ rng })`로 난수 주입.
- `innerHTML` 사용 금지. `textContent`와 요소 생성 함수로 그린다.
- `const`/`let`, 세미콜론, 2칸 들여쓰기, UTF-8.
- 색상은 `:root` CSS 변수로만 정의, 라이트/다크(prefers-color-scheme) 모두 대비 4.5:1 이상.
- 모바일 우선, 375px에서 가로 스크롤 없음, 터치 대상 44×44px 이상, `prefers-reduced-motion` 존중.
- `apps/element-alchemy/` 밖 파일에 의존하지 않는다(블로그로 돌아가는 단순 링크 `../../index.html`만 허용).

## 자체 점검 (서버 없이)
- 각 JS 파일에 `node --check`로 문법 오류가 없는지 확인한다.
- 가능하면 Node에서 `game.js`를 import해 고정 난수로 몇 턴 진행하는 간단한 확인 스크립트를 스크래치 폴더에서 실행해 본다(프로젝트 폴더에 남기지 않는다).

## 보고
한국어로: 만든 파일 목록, spec과 달라진 점(있다면), 자체 점검 결과, Review에서 특히 봐야 할 부분.
