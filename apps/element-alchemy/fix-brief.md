# Build 수정 지침 (Review 1차 반영)

## 역할
`apps/element-alchemy/review.md` 3장에서 지적된 문제 1~8을 수정한다.

## 수정 범위
- 고칠 수 있는 파일: `apps/element-alchemy/index.html`, `style.css`, `js/*.js`
- 그 밖의 파일(review.md, spec.md, 지침 파일들, 블로그 파일, CLAUDE.md, .claude/)은 수정 금지. 커밋 금지. 서버를 띄우지 않는다.
- 임시 테스트 스크립트는 스크래치 폴더에만 둔다.

## 고칠 것
1. **[중간] 애니메이션 중 [새 게임] 시 이전 타일 잔존** — main.js에 게임 세대 번호를 두고 `runTurn`이 `await` 뒤 세대가 바뀌었으면 즉시 반환(판 그리기·대화상자·버퍼 처리 모두 중단). render.js도 진행 중 애니메이션 뒤에 오래된 state로 그리지 않게 한다. `nextId`는 게임마다 1로 되돌리지 않는다.
2. **[중간] 한글 입력 상태에서 WASD 미동작** — `event.code`(`KeyW/KeyA/KeyS/KeyD`, `ArrowUp` 등)로 판정. `isComposing`이거나 `key === 'Process'`여도 `code`로 처리.
3. **[낮음] "발견!," 구두점** — 안내 문장이 자연스럽게 읽히도록 정리.
4. **[낮음] 같은 aria-live 문장 반복** — 같은 문장이어도 스크린 리더가 다시 읽게 한다.
5. **[낮음] 대화상자 배경 색 하드코딩** — `:root` 변수(`--backdrop`)로 뺀다(라이트/다크 각각).
6. **[낮음] `100vw` + `overflow-x: hidden`** — 부모 기준 폭(`min(100%, 480px)` 등)으로 바꾸고 `overflow-x: hidden`을 제거해도 375px에서 가로 스크롤이 생기지 않게 한다.
7. **[낮음] 768px에서 좁은 도감** — 두 열 전환 기준을 900px 정도로 올리거나 좁은 구간에서 도감 배치를 조정.
8. **[낮음] `setBoard` 노출** — 테스트 전용임이 드러나는 이름으로 바꾼다(예: `_setBoardForTest`).

## 자체 점검
- `node --check`로 JS 문법 확인.
- 기존 로직 테스트(스크래치 폴더의 test-game.mjs 등)를 다시 돌려 규칙·점수가 그대로인지 확인.

## 보고
한국어로: 문제별 수정 내용(파일:줄), 자체 점검 결과, 고치지 못한 것과 이유.
