// 테마 토글 버튼. 페이지를 그리기 전 첫 적용은 각 HTML <head>의 인라인 스크립트가 맡고,
// 아이콘 전환은 CSS가 맡는다. 여기서는 전환·저장과 버튼 라벨만 처리한다.

const KEY = 'theme';
const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const button = document.querySelector('.theme-toggle');

const current = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

function syncLabel() {
  const label = current() === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
  button.setAttribute('aria-label', label);
  button.title = label;
}

if (button) {
  syncLabel();
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // 저장소를 쓸 수 없으면 이번 방문 동안만 적용된다
    }
    syncLabel();
  });
  systemDark.addEventListener('change', syncLabel);
}
