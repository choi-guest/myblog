# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

마크다운(`.md`) 파일로 작성한 글을 읽어 블로그 웹사이트로 보여주는 정적 사이트입니다.

- **프레임워크·라이브러리 없이** 순수 HTML, CSS, JavaScript(ES 모듈)만 사용합니다.
- npm, 번들러, 빌드 도구를 쓰지 않습니다. `package.json`을 만들지 마세요.
- 외부 CDN 스크립트(marked, highlight.js 등)도 쓰지 않습니다. 마크다운 파서는 직접 구현합니다.
- 디자인 목표: 깔끔하고 읽기 좋은 타이포그래피, 다크 모드 지원, 모바일 대응.

## 디렉터리 구조

```
myblog/
├── index.html          # 글 목록 페이지
├── post.html           # 글 상세 페이지 (post.html?slug=파일명)
├── css/
│   └── style.css       # 전체 스타일 (테마 변수, 레이아웃, 본문 타이포그래피)
├── js/
│   ├── markdown.js     # 마크다운 → HTML 파서 (외부 의존성 없음)
│   ├── frontmatter.js  # YAML 프론트매터 파싱
│   ├── common.js       # 공용 도우미 (매니페스트 로드, 날짜 포맷, el() 요소 생성기)
│   ├── theme.js        # 다크/라이트 모드 토글
│   ├── list.js         # 목록 페이지 로직
│   └── post.js         # 상세 페이지 로직
├── posts/
│   ├── index.json      # 글 목록 매니페스트
│   ├── images/         # 글에 쓰는 이미지
│   └── *.md            # 블로그 글
└── serve.mjs           # 로컬 미리보기 서버 (Node 기본 모듈만 사용)
```

## 실행 방법

브라우저는 `file://`에서 `fetch()`로 로컬 파일을 읽지 못하므로 반드시 로컬 서버로 엽니다.

```bash
node serve.mjs
```

Python이 있으면 `python -m http.server 8000`도 됩니다. 그다음 http://localhost:8000 에 접속합니다. 빌드 단계는 없습니다. 파일을 저장하고 새로고침하면 됩니다.

## 글 작성 규칙

### 1. 마크다운 파일

`posts/` 아래에 `영문-소문자-하이픈.md` 형식으로 저장합니다. 파일명(확장자 제외)이 곧 `slug`입니다.

```markdown
---
title: 글 제목
date: 2026-10-27
tags: [javascript, css]
description: 목록에 표시될 짧은 요약
---

본문 내용...
```

### 2. 매니페스트 등록

정적 사이트는 디렉터리 목록을 읽을 수 없으므로 새 글은 `posts/index.json`에 추가해야 합니다.

```json
[
  { "slug": "hello-world", "title": "글 제목", "date": "2026-10-27", "tags": ["javascript"], "description": "짧은 요약" }
]
```

목록은 `date` 기준 최신순으로 정렬해서 보여줍니다. 매니페스트와 프론트매터의 값이 다르면 상세 페이지에서는 프론트매터를 우선합니다.

### 3. 이미지와 링크 경로

본문은 `post.html`에서 그려지므로 상대 경로는 `.md` 파일이 아니라 사이트 루트 기준입니다.
이미지는 `![설명](posts/images/파일.png)`, 다른 글 링크는 `[제목](post.html?slug=다른-글)`처럼 씁니다.

`posts/markdown-guide.md`는 지원 문법을 모두 담은 테스트 페이지입니다. 파서를 고친 뒤에는 이 글이 그대로 잘 보이는지 확인합니다.

## 마크다운 파서 (`js/markdown.js`)

다음 문법을 지원해야 합니다.

- 제목 `#` ~ `######` (상세 페이지 목차용으로 `id` 자동 부여)
- 문단, 줄바꿈, 수평선 `---`
- **굵게**, *기울임*, ~~취소선~~, `인라인 코드`
- 링크 `[텍스트](url)`, 이미지 `![alt](src)`
- 순서 있는/없는 목록 (중첩 포함), 체크박스 `- [ ]`
- 인용문 `>`
- 코드 블록 ` ``` ` (언어 표기는 `class="language-xxx"`로만 남김)
- 표 (GFM 스타일)

구현 원칙:

- **보안**: 원문 텍스트는 반드시 HTML 이스케이프(`& < > " '`)한 뒤 변환합니다. 코드 블록 안의 내용은 마크다운으로 해석하지 않습니다. 링크 URL은 `javascript:` 등 위험한 스킴을 막습니다.
- 블록 단위 파싱 → 인라인 파싱의 2단계 구조로 작성합니다.
- `parse(markdownString)`은 `{ html, headings }`를 반환하는 순수 함수로 유지합니다 (DOM 접근 금지). `headings`는 목차용 `{ level, id, text }` 배열입니다.
- 변환이 끝난 인라인 조각(코드, 링크, 이미지)은 자리표시자로 빼 두었다가 마지막에 되돌립니다. 그래야 URL 속 `_`나 `*`가 강조로 바뀌지 않습니다.

## 디자인 가이드

### 테마 (다크 모드)

- 모든 색상은 `:root`의 CSS 변수로만 정의하고, 컴포넌트에서 색상 값을 직접 쓰지 않습니다.
- 기본값은 시스템 설정(`prefers-color-scheme`)을 따르고, 헤더의 토글 버튼으로 수동 전환합니다.
- 수동 선택은 `<html data-theme="dark|light">`로 적용하고 `localStorage`에 저장합니다. `localStorage` 접근은 `try/catch`로 감쌉니다.
- 새로고침 시 깜빡임(FOUC)을 막기 위해 `<head>` 안 인라인 스크립트로 테마를 먼저 적용합니다.

```css
:root {
  --bg: #ffffff;
  --text: #1f2328;
  --text-muted: #656d76;
  --accent: #0969da;
  --border: #d0d7de;
  --code-bg: #f6f8fa;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* 다크 값 */ }
}
:root[data-theme="dark"] { /* 다크 값 (위와 동일) */ }
```

### 타이포그래피와 가독성

- 본문 폭은 `max-width: 720px` 내외(약 65~75자)로 제한합니다.
- 본문 `font-size: 17~18px`, `line-height: 1.7~1.8`.
- 폰트는 시스템 폰트 스택을 기본으로 하고 한글 가독성을 고려합니다.
  `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Segoe UI", sans-serif`
- 한글 줄바꿈: `word-break: keep-all; overflow-wrap: break-word;`
- 코드는 고정폭 폰트, 코드 블록은 가로 스크롤(`overflow-x: auto`)로 처리해 페이지 전체가 넓어지지 않게 합니다.
- 장식은 최소화하고 여백으로 구분합니다. 그림자·그라데이션 남용 금지.

### 반응형 (모바일)

- 모바일 우선(mobile-first)으로 작성하고, 넓은 화면은 `min-width` 미디어 쿼리로 확장합니다.
- 좌우 여백은 최소 16px, 어떤 화면에서도 가로 스크롤이 생기지 않아야 합니다.
- 이미지·표·코드 블록은 `max-width: 100%`. 표는 래퍼로 감싸 가로 스크롤.
- 터치 대상(버튼, 링크)은 최소 44×44px.
- 모든 HTML에 `<meta name="viewport" content="width=device-width, initial-scale=1">` 포함.

### 접근성

- 시맨틱 태그 사용: `<header>`, `<main>`, `<article>`, `<nav>`, `<footer>`.
- 텍스트 대비는 WCAG AA(4.5:1) 이상을 라이트/다크 양쪽에서 지킵니다.
- 테마 토글 버튼에 `aria-label`을 달고, 키보드 포커스 스타일(`:focus-visible`)을 유지합니다.
- `prefers-reduced-motion`을 존중해 전환 애니메이션을 줄입니다.

## 코딩 컨벤션

- JavaScript: ES 모듈(`<script type="module">`), `const`/`let`만 사용, 세미콜론 사용, 들여쓰기 2칸.
- 비동기는 `async/await` + `fetch`. 글을 못 불러오면 사용자에게 오류 메시지를 보여줍니다 (빈 화면 금지).
- `innerHTML`에는 파서가 생성한(이스케이프된) HTML만 넣습니다. 매니페스트·프론트매터 값은 `textContent`로 넣습니다.
- CSS: 클래스명은 소문자-하이픈(`post-list`, `post-meta`). `!important` 지양.
- 파일 인코딩은 UTF-8, HTML에 `<meta charset="utf-8">`과 `<html lang="ko">`.

## 작업 시 확인 사항

변경 후에는 다음을 확인합니다.

1. 로컬 서버에서 목록 → 상세 페이지 이동이 정상 동작하는지
2. 라이트/다크 모드 모두에서 색상과 대비가 자연스러운지
3. 모바일 폭(375px)에서 가로 스크롤 없이 읽히는지
4. 브라우저 콘솔에 오류가 없는지
