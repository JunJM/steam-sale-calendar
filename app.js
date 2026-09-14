const state = { date: new Date(), events: [], selectedId: null };
const $ = (selector) => document.querySelector(selector);
const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

function isoDay(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDay(value) { return new Date(`${value}T00:00:00`); }
function formatPeriod(event) { return `${dateFormat.format(parseDay(event.startDate))} ~ ${dateFormat.format(parseDay(event.endDate))}`; }
function eventOnDay(event, day) { const value = isoDay(day); return event.startDate <= value && value <= event.endDate; }

function renderCalendar() {
  const year = state.date.getFullYear(), month = state.date.getMonth();
  $('#month-title').textContent = `${year}년 ${month + 1}월`;
  const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
  const today = isoDay(new Date());
  $('#calendar').innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start); day.setDate(start.getDate() + index);
    const events = state.events.filter((event) => eventOnDay(event, day));
    const classes = ['day']; if (day.getMonth() !== month) classes.push('muted'); if (isoDay(day) === today) classes.push('today');
    const labels = events.map((event) => `<button class="event ${event.id === state.selectedId ? 'active' : ''}" data-event-id="${escapeHtml(event.id)}" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</button>`).join('');
    return `<div class="${classes.join(' ')}"><span class="day-number">${day.getDate()}</span>${labels}</div>`;
  }).join('');
  document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => selectEvent(button.dataset.eventId)));
}

function money(game) { if (!game.price) return '가격 정보 없음'; const currency = game.price.currency || 'KRW'; const current = new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(game.price.final / 100); return game.price.discountPercent ? `<span class="discount">-${game.price.discountPercent}%</span>${current}` : current; }
function selectEvent(id) {
  state.selectedId = id; const event = state.events.find((item) => item.id === id); if (!event) return;
  $('#detail').innerHTML = `<h2 class="event-title">${escapeHtml(event.title)}</h2><p class="period">${formatPeriod(event)}</p><p class="description">${escapeHtml(event.description || 'Steam 공식 예정 행사입니다. 할인 대상과 세부 내용은 행사 시작 시 Steam Store에서 확인할 수 있습니다.')}</p>${(event.gameGroups || []).map((group) => `<section class="genre"><h3>${escapeHtml(group.genre)} TOP 5</h3><p class="ranking-note">Steam Top Sellers 매출 순위 기준이며, 동률은 현재 할인율 순입니다.</p><div class="game-list">${group.games.length ? group.games.map((game, index) => { const rank = game.rank || index + 1; const url = `https://store.steampowered.com/app/${Number(game.appId)}/?l=koreana`; return `<article class="game"><span class="rank" aria-label="${rank}위">${rank}</span><a class="game-cover" href="${url}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(game.name)} Steam Store 열기"><img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy"></a><a class="game-name" href="${url}" target="_blank" rel="noreferrer">${escapeHtml(game.name)}</a><span class="price">${money(game)}</span></article>`; }).join('') : '<p class="no-games">다음 자동 갱신 후 이 주제의 TOP 게임이 표시됩니다.</p>'}</div></section>`).join('')}`;
  renderCalendar();
}
async function boot() {
  try { const response = await fetch('./data/events.json', { cache: 'no-store' }); const data = await response.json(); state.events = data.events || []; $('#updated').textContent = data.generatedAt ? `마지막 갱신: ${new Date(data.generatedAt).toLocaleString('ko-KR')}` : '갱신 대기 중'; } catch { $('#updated').textContent = '일정 데이터를 불러오지 못했습니다.'; }
  renderCalendar();
  const current = isoDay(new Date()); const nearest = state.events.find((event) => event.endDate >= current); if (nearest) selectEvent(nearest.id);
}
$('#previous').addEventListener('click', () => { state.date.setMonth(state.date.getMonth() - 1); renderCalendar(); });
$('#next').addEventListener('click', () => { state.date.setMonth(state.date.getMonth() + 1); renderCalendar(); });
boot();
