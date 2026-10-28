// 글 맨 위의 --- … --- 블록을 읽는다.
// 전체 YAML이 아니라 `key: value`, `[a, b]` 배열, 따옴표 문자열만 지원한다.

export function splitFrontmatter(text) {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = src.match(/^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/);
  if (!m) return { meta: {}, body: src };

  const meta = {};
  for (const line of (m[1] || '').split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) meta[kv[1]] = parseValue(kv[2].trim());
  }
  return { meta, body: src.slice(m[0].length) };
}

function parseValue(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map((item) => unquote(item.trim())).filter(Boolean);
  }
  return unquote(value);
}

function unquote(value) {
  const m = value.match(/^(["'])(.*)\1$/);
  return m ? m[2] : value;
}
