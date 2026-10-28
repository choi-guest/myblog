// 목록·상세 페이지가 함께 쓰는 도우미

export async function loadManifest() {
  const res = await fetch('posts/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`posts/index.json을 불러오지 못했습니다 (HTTP ${res.status})`);
  const posts = await res.json();
  return posts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// "2026-10-27" → "2026.10.27". Date로 파싱하면 시간대에 따라 하루가 밀릴 수 있어 직접 나눈다.
export function formatDate(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : String(value ?? '');
}

export function toTags(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value ? [String(value)] : [];
}

export const tagHref = (tag) => (tag ? `index.html?${new URLSearchParams({ tag })}` : 'index.html');
export const postHref = (slug) => `post.html?${new URLSearchParams({ slug })}`;

// 요소 생성기. 문자열 자식과 text 속성은 모두 텍스트 노드로 들어가므로 HTML로 해석되지 않는다.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

export function tagList(tags) {
  if (!tags.length) return null;
  return el('ul', { class: 'tag-list' },
    tags.map((tag) => el('li', {}, el('a', { class: 'tag', href: tagHref(tag), 'data-tag': tag, text: `#${tag}` }))));
}

export function notice(message, ...extra) {
  const box = el('div', { class: 'notice', role: 'alert' }, el('p', { text: message }), ...extra);
  if (location.protocol === 'file:') {
    box.append(el('p', { class: 'notice-hint' },
      '파일을 직접 열면 글을 불러올 수 없습니다. 터미널에서 ',
      el('code', { text: 'python -m http.server 8000' }),
      ' 을 실행한 뒤 http://localhost:8000 으로 접속하세요.'));
  }
  return box;
}
