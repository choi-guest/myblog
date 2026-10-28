// 마크다운 → HTML 변환기. 외부 의존성이 없고 DOM에 접근하지 않는 순수 함수다.
// 원문은 항상 HTML 이스케이프한 뒤 변환하므로 글 안의 HTML 태그는 글자 그대로 보인다.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const UNESCAPES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

const RE = {
  fence: /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/,
  heading: /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}>/,
  list: /^( *)([-*+]|\d{1,9}[.)])(?:( +)(.*))?$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/,
};

const ESCAPABLE = /\\([\\`*_{}[\]()#+\-.!~|>])/g;
const TOKEN = /\u0000(\d+)\u0000/g;

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function unescapeHtml(text) {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => UNESCAPES[name]);
}

// http(s), mailto, 상대 경로, #만 허용한다.
// 브라우저는 URL 속 공백·제어문자를 무시하므로("java\tscript:") 지운 뒤 검사한다.
function safeUrl(url) {
  const compact = url.replace(/[\u0000- \u007f]/g, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(compact) && !/^(https?|mailto):/i.test(compact)) return '#';
  return url;
}

export function parse(markdown) {
  const ctx = { headings: [], ids: new Set() };
  const lines = String(markdown).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return { html: parseBlocks(lines, ctx), headings: ctx.headings };
}

// ---------- 블록 ----------

function parseBlocks(lines, ctx) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    let m;

    if (!line.trim()) {
      i++;
      continue;
    }

    if ((m = line.match(RE.fence))) {
      const fence = m[1];
      const body = [];
      i++;
      while (i < lines.length && !isFenceClose(lines[i], fence)) body.push(lines[i++]);
      i++; // 닫는 펜스
      const cls = m[2] ? ` class="language-${escapeHtml(m[2])}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    if ((m = line.match(RE.heading))) {
      out.push(heading(m[1].length, m[2] || '', ctx));
      i++;
      continue;
    }

    if (RE.hr.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && RE.quote.test(lines[i])) body.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      out.push(`<blockquote>\n${parseBlocks(body, ctx)}\n</blockquote>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const result = parseTable(lines, i);
      out.push(result.html);
      i = result.next;
      continue;
    }

    if (RE.list.test(line)) {
      const result = parseList(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) para.push(lines[i++]);
    out.push(`<p>${inline(para.map(trimStart).join('\n'))}</p>`);
  }

  return out.join('\n');
}

// 문단 도중에 새 블록이 시작되는지. 순서 목록은 1로 시작할 때만 문단을 끊는다.
function startsBlock(lines, i) {
  const line = lines[i];
  const m = line.match(RE.list);
  if (m && m[4] && (!/^\d/.test(m[2]) || parseInt(m[2], 10) === 1)) return true;
  return RE.fence.test(line) || RE.heading.test(line) || RE.hr.test(line) || RE.quote.test(line) || isTableStart(lines, i);
}

function isFenceClose(line, fence) {
  const t = line.trim();
  return t.length >= fence.length && t === fence[0].repeat(t.length);
}

function heading(level, raw, ctx) {
  const html = inline(raw);
  const text = unescapeHtml(html.replace(/<[^>]*>/g, '')).trim();
  const id = uniqueId(slugify(text), ctx.ids);
  ctx.headings.push({ level, id, text });
  return `<h${level} id="${escapeHtml(id)}">${html}</h${level}>`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
}

function uniqueId(base, used) {
  let id = base;
  let n = 1;
  while (used.has(id)) id = `${base}-${++n}`;
  used.add(id);
  return id;
}

// ---------- 표 ----------

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function isTableStart(lines, i) {
  const head = lines[i];
  const sep = lines[i + 1];
  if (sep === undefined || !head.includes('|') || !sep.includes('|') || !RE.tableSep.test(sep)) return false;
  return splitRow(head).length === splitRow(sep).length;
}

function parseTable(lines, start) {
  const header = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    if (c.startsWith(':')) return 'left';
    return '';
  });
  const cell = (tag, text, k) => {
    const style = aligns[k] ? ` style="text-align:${aligns[k]}"` : '';
    return `<${tag}${style}>${inline(text.replace(/\\\|/g, '|'))}</${tag}>`; // 코드 안의 \|도 | 로
  };

  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
    const cells = splitRow(lines[i++]);
    rows.push(`<tr>${header.map((_, k) => cell('td', cells[k] || '', k)).join('')}</tr>`);
  }

  const thead = `<thead><tr>${header.map((text, k) => cell('th', text, k)).join('')}</tr></thead>`;
  const tbody = rows.length ? `<tbody>\n${rows.join('\n')}\n</tbody>` : '';
  return { html: `<div class="table-wrap"><table>\n${thead}\n${tbody}\n</table></div>`, next: i };
}

// ---------- 목록 ----------

const leading = (line) => line.match(/^ */)[0].length;
const trimStart = (line) => line.replace(/^\s+/, '');

function parseList(lines, start, ctx) {
  const first = lines[start].match(RE.list);
  const indent = first[1].length;
  const ordered = /^\d/.test(first[2]);
  const delim = first[2].slice(-1);
  const items = [];
  let loose = false;
  let i = start;

  // 같은 목록의 다음 항목인지: 들여쓰기·종류·기호가 모두 같아야 한다
  const sibling = (line) => {
    const m = !RE.hr.test(line) && line.match(RE.list);
    return m && m[1].length === indent && /^\d/.test(m[2]) === ordered && m[2].slice(-1) === delim ? m : null;
  };

  while (i < lines.length) {
    const m = sibling(lines[i]);
    if (!m) break;

    const spaces = m[3] ? m[3].length : 1;
    const contentIndent = indent + m[2].length + (spaces > 4 ? 1 : spaces);
    const body = [m[4] || ''];
    i++;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        let j = i;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && leading(lines[j]) > indent) {
          // 빈 줄 뒤에 들여쓴 내용이 이어지면 같은 항목
          while (i < j) body.push(lines[i++].trim());
          loose = true;
          continue;
        }
        if (j < lines.length && sibling(lines[j])) loose = true;
        i = j;
        break;
      }

      if (leading(line) > indent) {
        body.push(line.slice(Math.min(leading(line), contentIndent)));
        i++;
      } else if (RE.list.test(line)) {
        break;
      } else if (body[body.length - 1].trim() && !startsBlock(lines, i)) {
        body.push(line.trim()); // 들여쓰지 않은 문단 연속 줄
        i++;
      } else {
        break;
      }
    }

    items.push(body);
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNum = parseInt(first[2], 10);
  const attr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  const html = items.map((body) => listItem(body, loose, ctx)).join('\n');
  return { html: `<${tag}${attr}>\n${html}\n</${tag}>`, next: i };
}

function listItem(lines, loose, ctx) {
  let body = lines;
  let task = '';
  const t = body[0].match(/^\[([ xX])\]\s+/);
  if (t) {
    task = `<input type="checkbox" disabled${t[1] === ' ' ? '' : ' checked'}> `;
    body = [body[0].slice(t[0].length), ...body.slice(1)];
  }

  let html;
  if (loose) {
    html = parseBlocks(body, ctx);
  } else {
    // 촘촘한 목록: 첫 문단은 <p> 없이 인라인으로 넣는다
    let k = 0;
    while (k < body.length && body[k].trim() && !(k > 0 && startsBlock(body, k))) k++;
    html = inline(body.slice(0, k).map(trimStart).join('\n'));
    if (k < body.length) html += `\n${parseBlocks(body.slice(k), ctx)}`;
  }

  if (task) html = html.startsWith('<p>') ? `<p>${task}${html.slice(3)}` : task + html;
  return `<li${task ? ' class="task"' : ''}>${html}</li>`;
}

// ---------- 인라인 ----------

// 변환이 끝난 조각은 자리표시자로 빼 두어 이후 규칙이 다시 건드리지 못하게 한다.
function inline(text) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  const restore = (s) => s.replace(TOKEN, (_, n) => restore(stash[n]));

  let s = text.replace(/\u0000/g, '');
  s = s.replace(/\\`/g, () => keep('`')); // \` 는 코드 구간보다 먼저 처리해야 한다
  s = s.replace(/(`+)(.+?)\1/g, (_, __, code) => keep(`<code>${escapeHtml(code.trim())}</code>`));
  s = s.replace(ESCAPABLE, (_, ch) => keep(escapeHtml(ch)));
  s = escapeHtml(s);

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const altText = restore(alt).replace(/<[^>]*>/g, '');
    return keep(`<img src="${safeUrl(restore(src))}" alt="${altText}" loading="lazy">`);
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => keep(link(safeUrl(restore(href)), emphasis(label))));
  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, url) => keep(link(url, url)));

  s = emphasis(s);
  s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');
  return restore(s);
}

function link(href, label) {
  const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${href}"${external}>${label}</a>`;
}

function emphasis(s) {
  return s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
}
