import { loadManifest, formatDate, toTags, tagHref, postHref, el, tagList, notice } from './common.js';

const filterEl = document.querySelector('[data-tag-filter]');
const listEl = document.querySelector('[data-post-list]');
const siteTitle = document.title;
let posts = [];

const activeTag = () => new URLSearchParams(location.search).get('tag') || null;

function renderFilter(active) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of toTags(post.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  const chip = (label, tag, count) => el('a', {
    class: 'chip',
    href: tagHref(tag),
    'data-tag': tag || '',
    'aria-current': tag === active ? 'page' : null,
  }, label, el('span', { class: 'chip-count', text: String(count) }));

  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  filterEl.replaceChildren(chip('전체', null, posts.length), ...sorted.map(([tag, count]) => chip(`#${tag}`, tag, count)));
  filterEl.hidden = counts.size === 0;
}

function postItem(post) {
  return el('li', { class: 'post-item' },
    el('article', {},
      el('h2', { class: 'post-item-title' }, el('a', { href: postHref(post.slug), text: post.title || post.slug })),
      el('p', { class: 'post-meta' }, el('time', { datetime: post.date, text: formatDate(post.date) })),
      post.description ? el('p', { class: 'post-item-desc', text: post.description }) : null,
      tagList(toTags(post.tags))));
}

function render() {
  const active = activeTag();
  const visible = active ? posts.filter((post) => toTags(post.tags).includes(active)) : posts;

  document.title = active ? `#${active} · ${siteTitle}` : siteTitle;
  renderFilter(active);

  if (!visible.length) {
    const message = active ? `'${active}' 태그가 달린 글이 없습니다.` : '아직 글이 없습니다.';
    listEl.replaceChildren(el('li', { class: 'notice', text: message }));
    return;
  }
  listEl.replaceChildren(...visible.map(postItem));
}

// 태그 링크는 새로고침 없이 URL만 바꿔서 필터링한다. 공유·뒤로 가기는 그대로 동작한다.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-tag]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState(null, '', link.href);
  render();
});
window.addEventListener('popstate', render);

try {
  posts = await loadManifest();
  render();
} catch (err) {
  console.error(err);
  filterEl.hidden = true;
  listEl.replaceChildren(el('li', {}, notice('글 목록을 불러오지 못했습니다.')));
}
