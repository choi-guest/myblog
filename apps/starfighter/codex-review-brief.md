# Codex 리뷰 지침 – 스타파이터

## 목적
`apps/starfighter/`의 코드를 ChatGPT(Codex) 관점에서 독립적으로 리뷰하고, 결과를 `apps/starfighter/chatgpt-review.md`에 작성한다.

## 참고 자료
- `apps/starfighter/review.md`: Claude가 작성한 기존 리뷰. 이미 지적된 내용은 반복하지 않는다. 기존 지적 중 아직 고쳐지지 않았거나 판단이 틀렸다고 보는 항목이 있으면 근거와 함께 따로 적는다.
- `apps/starfighter/spec.md`: 요구사항.
- `apps/starfighter/fix-brief.md`: 기존 리뷰 이후 수정 내역.

## 리뷰 대상
`apps/starfighter/index.html`, `style.css`, `js/*.js`

## 중점
- 버그와 논리 오류(상태 전이, 충돌 판정, 타이머·dt 처리, 메모리·리스너 누수, 재시작·일시정지 시 상태 초기화)
- 모바일·터치 입력, 화면 크기 변화, 접근성
- localStorage 예외 처리, 보안(innerHTML 등)
- 성능(프레임마다 할당, 불필요한 재계산)
- spec 불일치

## 작성 형식 (chatgpt-review.md, 한국어)
1. 요약: 전체 판정과 핵심 문제
2. 발견한 문제 목록. 문제마다 다음을 적는다.
   - 심각도(높음/중간/낮음)
   - 위치(`파일:줄`)
   - 문제 설명과 재현 조건
   - 수정 제안
3. 기존 review.md와 의견이 다른 항목(있으면)

## 수정 범위 (엄수)
- 새로 만들 수 있는 파일은 `apps/starfighter/chatgpt-review.md` 하나뿐이다.
- 다른 파일은 절대 수정·삭제·생성하지 않는다. 코드는 고치지 말고 리뷰만 한다.
- git 명령으로 커밋, 브랜치 변경, 되돌리기를 하지 않는다.
- 필요하면 `node`로 모듈을 import해서 로직을 시험해도 된다. 단, 임시 파일은 프로젝트 폴더 밖에 만든다.

## 인코딩 주의 (Windows PowerShell 5.1)
- 모든 파일은 UTF-8이다. `Get-Content`를 쓸 때는 반드시 `-Encoding UTF8`을 붙인다. 그렇지 않으면 한글이 깨진다.
- 리뷰 파일은 apply_patch 같은 파일 편집 도구로 UTF-8로 작성한다. PowerShell 리디렉션(`>`)이나 `Set-Content`로 쓰지 않는다.
