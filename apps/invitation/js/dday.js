// D-Day 계산과 달력 — DOM 없이 동작하는 순수 함수. 현재 시각은 인자로 받는다.

const KST_OFFSET = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// 한국 시간 기준 날짜 번호 (자정마다 1씩 증가)
function kstDayNumber(time) {
  return Math.floor((time + KST_OFFSET) / DAY);
}

// now, eventDate: Date
// 반환: { phase: 'before' | 'today' | 'after', days, remainingMs, parts: { days, hours, minutes, seconds } }
export function getDday(now, eventDate) {
  const diffDays = kstDayNumber(eventDate.getTime()) - kstDayNumber(now.getTime());
  const remainingMs = Math.max(0, eventDate.getTime() - now.getTime());
  const phase = diffDays > 0 ? 'before' : diffDays === 0 ? 'today' : 'after';
  return { phase, days: Math.abs(diffDays), remainingMs, parts: splitMs(remainingMs) };
}

export function splitMs(ms) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function ddayLabel(result) {
  if (result.phase === 'today') return 'D-Day';
  return result.phase === 'before' ? `D-${result.days}` : `D+${result.days}`;
}

// 한국 시간 기준 행사일의 연·월·일·요일·시·분
export function kstParts(date) {
  const k = new Date(date.getTime() + KST_OFFSET);
  return {
    year: k.getUTCFullYear(),
    month: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    weekday: k.getUTCDay(),
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
  };
}

// 달력 칸: 일요일 시작, 앞쪽 빈칸은 null
export function monthGrid(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array(firstWeekday).fill(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatEventDate(date) {
  const p = kstParts(date);
  const ampm = p.hour < 12 ? '오전' : '오후';
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minute = p.minute ? ` ${p.minute}분` : '';
  return `${p.year}년 ${p.month}월 ${p.day}일 ${WEEKDAYS[p.weekday]}요일 ${ampm} ${h12}시${minute}`;
}
