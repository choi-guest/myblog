// 화면 연결: config 값을 채우고 D-Day·지도·버튼을 동작시킨다

import { CONFIG } from './config.js';
import { getDday, ddayLabel, kstParts, monthGrid, WEEKDAYS, formatEventDate } from './dday.js';
import { directionLinks, embedMapUrl, initMap } from './map.js';

const eventDate = new Date(CONFIG.eventDate);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fillText() {
  const { venue } = CONFIG;
  const values = {
    type: CONFIG.type,
    title: CONFIG.title,
    subtitle: CONFIG.subtitle,
    date: formatEventDate(eventDate),
    'venue-full': [venue.name, venue.hall].filter(Boolean).join(' '),
    address: venue.address,
    hosts: CONFIG.hosts,
  };
  $$('[data-field]').forEach((node) => {
    node.textContent = values[node.dataset.field] ?? '';
  });
  document.title = `${CONFIG.title} | 초대합니다`;

  const greeting = $('[data-greeting]');
  CONFIG.greeting.forEach((line) => greeting.appendChild(el('p', '', line)));

  if (CONFIG.coverImage) {
    $('[data-cover]').style.setProperty('--cover-image', `url("${CONFIG.coverImage}")`);
    $('[data-cover]').classList.add('has-image');
  }
}

// ---------- D-Day ----------
const ddayLabelEl = $('[data-dday-label]');
const ddayTextEl = $('[data-dday-text]');
const countdownEl = $('[data-countdown]');
const countEls = {};
$$('[data-count]').forEach((node) => { countEls[node.dataset.count] = node; });
let lastLabel = '';

function renderDday() {
  const result = getDday(new Date(), eventDate);
  const label = ddayLabel(result);
  // 낭독기가 매초 읽지 않도록 문구가 바뀔 때만 갱신
  if (label !== lastLabel) {
    ddayLabelEl.textContent = label;
    lastLabel = label;
  }

  let text;
  if (result.phase === 'before') text = `${result.days}일 남았습니다`;
  else if (result.phase === 'today') text = result.remainingMs > 0 ? '오늘입니다' : '오늘, 함께해 주셔서 감사합니다';
  else text = '행사가 끝났습니다';
  ddayTextEl.textContent = text;

  const showCount = result.remainingMs > 0;
  countdownEl.hidden = !showCount;
  if (showCount) {
    const { parts } = result;
    countEls.days.textContent = parts.days;
    countEls.hours.textContent = String(parts.hours).padStart(2, '0');
    countEls.minutes.textContent = String(parts.minutes).padStart(2, '0');
    countEls.seconds.textContent = String(parts.seconds).padStart(2, '0');
  }
}

function startDday() {
  renderDday();
  // 다음 정각 초에 맞춰 1초마다 갱신
  setTimeout(() => {
    renderDday();
    setInterval(renderDday, 1000);
  }, 1000 - (Date.now() % 1000));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderDday();
  });
}

// ---------- 달력 ----------
function renderCalendar() {
  const p = kstParts(eventDate);
  $('[data-calendar-title]').textContent = `${p.year}년 ${p.month}월`;
  const head = $('[data-calendar-head]');
  WEEKDAYS.forEach((w, i) => {
    const th = el('th', i === 0 ? 'sun' : i === 6 ? 'sat' : '', w);
    th.scope = 'col';
    head.appendChild(th);
  });
  const body = $('[data-calendar-body]');
  const cells = monthGrid(p.year, p.month);
  for (let i = 0; i < cells.length; i += 7) {
    const tr = el('tr');
    cells.slice(i, i + 7).forEach((day, j) => {
      const td = el('td', j === 0 ? 'sun' : j === 6 ? 'sat' : '');
      if (day) {
        const span = el('span', day === p.day ? 'day is-event' : 'day', String(day));
        if (day === p.day) span.setAttribute('aria-label', `${day}일 행사일`);
        td.appendChild(span);
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}

// ---------- 지도와 길찾기 ----------
async function setupMap() {
  const links = directionLinks(CONFIG.venue);
  $('[data-link="kakao"]').href = links.kakao;
  $('[data-link="naver"]').href = links.naver;

  const ok = await initMap($('[data-map]'), $('[data-map-toggle]'), CONFIG.venue, CONFIG.kakaoJsKey);
  if (!ok) {
    // 카카오 키가 없거나 실패: 키가 필요 없는 구글 지도를 넣는다
    $('[data-map]').hidden = true;
    const frame = el('iframe', 'map-embed');
    frame.src = embedMapUrl(CONFIG.venue);
    frame.title = `${CONFIG.venue.name} 위치 지도`;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    $('[data-map-fallback]').replaceChildren(frame);
    $('[data-map-fallback]').hidden = false;
  }
}

function renderTransport() {
  const dl = $('[data-transport]');
  CONFIG.transport.forEach((item) => {
    dl.appendChild(el('dt', '', item.label));
    dl.appendChild(el('dd', '', item.text));
  });
}

// ---------- 연락처 ----------
function renderContacts() {
  const list = $('[data-contacts]');
  const withPhone = CONFIG.contacts.filter((c) => c.phone);
  if (!withPhone.length) {
    $('[data-contact-section]').hidden = true;
    return;
  }
  withPhone.forEach((c) => {
    const li = el('li', 'contact');
    li.appendChild(el('span', 'contact-name', `${c.role} ${c.name}`));
    const tel = c.phone.replace(/[^0-9+]/g, '');
    const call = el('a', 'btn btn-small', '전화');
    call.href = `tel:${tel}`;
    call.setAttribute('aria-label', `${c.role} ${c.name}에게 전화`);
    const sms = el('a', 'btn btn-small', '문자');
    sms.href = `sms:${tel}`;
    sms.setAttribute('aria-label', `${c.role} ${c.name}에게 문자`);
    li.append(call, sms);
    list.appendChild(li);
  });
}

// ---------- 복사·공유 ----------
const toastEl = $('[data-toast]');
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2000);
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    // 복사가 막힌 환경: 직접 길게 눌러 복사할 수 있게 보여 준다
    window.prompt('아래 내용을 길게 눌러 복사해 주세요', text);
  }
}

function setupButtons() {
  $('[data-copy-address]').addEventListener('click', () => copyText(CONFIG.venue.address, '주소를 복사했습니다'));
  $('[data-copy-link]').addEventListener('click', () => copyText(location.href, '링크를 복사했습니다'));

  const shareBtn = $('[data-share]');
  if (navigator.share) {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', () => {
      navigator.share({ title: CONFIG.title, text: CONFIG.subtitle, url: location.href }).catch(() => {});
    });
  }
}

// ---------- 화면에 들어올 때 살짝 떠오르기 ----------
function setupReveal() {
  const items = $$('.reveal');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((node) => node.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((node) => io.observe(node));
}

// 떠오르기 효과는 스크립트가 실제로 돌 때만 켠다 (실패해도 본문이 보이도록 가장 먼저 처리)
document.documentElement.classList.add('js');
setupReveal();
fillText();
startDday();
renderCalendar();
renderTransport();
renderContacts();
setupButtons();
setupMap();
