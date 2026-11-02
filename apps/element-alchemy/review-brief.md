# Review 서브에이전트 지침

## 역할
Build 단계에서 만든 "원소 연금술" 웹앱을 검증하고 `apps/element-alchemy/review.md`를 작성한다. Build와 분리된 독립 검토자로서, 구현자의 보고를 믿지 말고 직접 확인한다.

## 수정 범위
- 새로 만드는 파일: `apps/element-alchemy/review.md` 하나만.
- 코드 파일은 **수정하지 않는다.** 문제를 찾으면 review.md에 적기만 한다(수정은 별도 단계에서 한다).
- 블로그 파일, `CLAUDE.md`, `.claude/`, spec.md·지침 파일 수정 금지. git 커밋 금지.
- 임시 스크립트는 스크래치 폴더에만 둔다.

## 검증 방법
1. **코드 검토**: spec.md 8장 체크리스트와 CLAUDE.md 규칙 기준으로 `apps/element-alchemy/`의 모든 코드를 읽는다. 버그, 규칙 위반, 보안 문제(innerHTML, 외부 의존), 2048 복제 요소를 찾는다.
2. **브라우저 검증**: 내장 브라우저 도구(`mcp__Claude_Browser__*`)를 쓴다.
   - `preview_start`에 `{ "name": "blog" }`로 서버를 띄우고(.claude/launch.json, 포트 8000), `http://localhost:8000/apps/element-alchemy/`로 이동한다.
   - 콘솔 오류 확인, 방향키·WASD·화면 버튼으로 실제 이동, 점수판·턴 수·다음 원소 갱신, 도감 갱신 확인.
   - 375px(mobile 프리셋)에서 가로 스크롤 여부(`document.documentElement.scrollWidth > innerWidth`), 768px 이상 두 열 레이아웃, 다크 모드(colorScheme: dark).
   - 대화상자 흐름은 가능하면 javascript_tool로 확인(디버깅·검사용으로만 사용, 코드 수정 금지).
   - 스크린샷을 찍어 시각 확인. 끝나면 resize_window preset "desktop"으로 되돌린다.
   - 브라우저 도구를 쓸 수 없으면 그 사실을 review.md에 적고 코드 검토 결과만 보고한다.
3. **로직 확인**: 필요하면 Node로 `js/game.js`를 import해 규칙을 직접 테스트한다(스크래치 폴더).

## review.md 형식 (한국어)
1. 요약: 통과/수정 필요 판정과 한두 줄 설명
2. 체크리스트 결과: spec.md 8장 항목별 ✅/❌/⚠️ + 근거
3. 발견한 문제: 심각도(높음/중간/낮음), 파일:줄, 재현 방법, 제안하는 수정
4. 확인하지 못한 항목과 이유

## 보고
review.md 경로, 판정, 심각도 높음·중간 문제 목록.
