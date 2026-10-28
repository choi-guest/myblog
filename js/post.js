import { parse } from './markdown.js';
import { splitFrontmatter } from './frontmatter.js';
import { loadManifest, formatDate, toTags, postHref, el, tagList, notice } from './common.js';

const root = document.querySelector('[data-post]');
const sideToc = document.querySelector('[data-side-toc]');
const siteTitle = document.title;

const backLink = () => el('p', { class: 'back-link' }, el('a', { href: 'index.html', text: '← 글 목록으로' }));

// 한국어 기준 분당 약 500자
const readingMinutes = (text) => Math.max(1, Math.round(text.replace(/\s+/g, '').length / 500));

const tocList = (items) => el('ol', {}, items.map((h) => el('li', { class: `toc-h${h.level}` },
  el('a', { href: `#${encodeURIComponent(h.id)}`, 'data-id': h.id, text: h.text }))));

// 목차는 넓은 화면에서는 사이드바에, 좁은 화면에서는 본문 위 접이식으로 보인다 (CSS가 하나만 보여 준다)
function toc(headings) {
  const items = headings.filter((h) => h.level === 2 || h.level === 3);
  if (items.length < 3) return null;

  sideToc?.replaceChildren(
    el('p', { class: 'side-label', text: '목차' }),
    el('nav', { 'aria-label': '목차' }, tocList(items)));
  sideToc?.removeAttribute('hidden');

  return el('details', { class: 'toc' },
    el('summary', { text: '목차' }),
    el('nav', { 'aria-label': '목차' }, tocList(items)));
}

// 스크롤 위치에 맞춰 사이드바 목차의 현재 항목을 표시한다
function trackActiveHeading(prose) {
  const links = new Map([...(sideToc?.querySelectorAll('a[data-id]') || [])].map((a) => [a.dataset.id, a]));
  if (!links.size) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a) => a.removeAttribute('aria-current'));
      links.get(entry.target.id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '0px 0px -70% 0px' });
  prose.querySelectorAll('h2[id], h3[id]').forEach((h) => observer.observe(h));
}

// 목록은 최신순이므로 다음 칸이 더 오래된 글이다.
function postNav(slug, posts) {
  const i = posts.findIndex((post) => post.slug === slug);
  if (i === -1) return null;
  const older = posts[i + 1];
  const newer = posts[i - 1];
  if (!older && !newer) return null;

  const link = (post, label, cls) => el('a', { class: `post-nav-link ${cls}`, href: postHref(post.slug) },
    el('span', { class: 'post-nav-label', text: label }),
    el('span', { class: 'post-nav-title', text: post.title || post.slug }));

  return el('nav', { class: 'post-nav', 'aria-label': '이전 글과 다음 글' },
    older ? link(older, '← 이전 글', 'prev') : null,
    newer ? link(newer, '다음 글 →', 'next') : null);
}

function render(info, body, posts) {
  const title = info.title || info.slug;
  const { html, headings } = parse(body);

  document.title = `${title} · ${siteTitle}`;
  if (info.description) document.querySelector('meta[name="description"]')?.setAttribute('content', info.description);

  const prose = el('div', { class: 'prose' });
  prose.innerHTML = html; // parse()가 원문을 이스케이프해 만든 HTML

  root.replaceChildren(
    el('header', { class: 'post-header' },
      el('h1', { class: 'post-title', text: title }),
      el('p', { class: 'post-meta' },
        info.date ? el('time', { datetime: info.date, text: formatDate(info.date) }) : null,
        el('span', { text: `${readingMinutes(body)}분 읽기` })),
      tagList(toTags(info.tags))),
    toc(headings),
    prose,
    postNav(info.slug, posts),
    backLink());
  trackActiveHeading(prose);

  // 본문이 비동기로 그려졌으므로 주소의 #앵커 위치로 직접 이동한다
  if (location.hash) {
    try {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    } catch {
      // 잘못된 인코딩의 해시는 무시한다
    }
  }
}

function showNotFound() {
  document.title = `글을 찾을 수 없습니다 · ${siteTitle}`;
  root.replaceChildren(el('div', { class: 'notice' },
    el('h1', { text: '글을 찾을 수 없습니다' }),
    el('p', { text: '주소가 잘못되었거나 글이 삭제되었습니다.' }),
    backLink()));
}

async function main() {
  const slug = new URLSearchParams(location.search).get('slug') || '';
  if (!/^[a-z0-9-]+$/.test(slug)) return showNotFound();

  try {
    const [res, posts] = await Promise.all([
      fetch(`posts/${slug}.md`, { cache: 'no-cache' }),
      loadManifest().catch(() => []),
    ]);
    if (res.status === 404) return showNotFound();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { meta, body } = splitFrontmatter(await res.text());
    const entry = posts.find((post) => post.slug === slug) || {};
    render({ ...entry, ...meta, slug }, body, posts); // 프론트매터가 매니페스트보다 우선
  } catch (err) {
    console.error(err);
    root.replaceChildren(notice('글을 불러오지 못했습니다.'), backLink());
  }
}

main();
