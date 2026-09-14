const state = { date: new Date(), events: [], selectedId: null };
const $ = (selector) => document.querySelector(selector);
const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

function isoDay(date) { return date.toISOString().slice(0, 10); }
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
    const labels = events.map((event) => `<button class="event ${event.id === state.selectedId ? 'active' : ''}" data-event-id="${event.id}" title="${event.title}">${event.title}</button>`).join('');
    return `<div class="${classes.join(' ')}"><span class="day-number">${day.getDate()}</span>${labels}</div>`;
  }).join('');
  document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => selectEvent(button.dataset.eventId)));
}

function money(game) { if (!game.price) return '가격 정보 없음'; const currency = game.price.currency || 'KRW'; const current = new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(game.price.final / 100); return game.price.discountPercent ? `<span class="discount">-${game.price.discountPercent}%</span>${current}` : current; }
function selectEvent(id) {
  state.selectedId = id; const event = state.events.find((item) => item.id === id); if (!event) return;
  $('#detail').innerHTML = `<h2 class="event-title">${event.title}</h2><p class="period">${formatPeriod(event)}</p><p class="description">${event.description || 'Steam 공식 예정 행사입니다. 할인 대상과 세부 내용은 행사 시작 시 Steam Store에서 확인할 수 있습니다.'}</p>${(event.gameGroups || []).map((group) => `<section class="genre"><h3>${group.genre} 대표 게임</h3><div class="game-list">${group.games.length ? group.games.map((game) => `<a class="game" href="https://store.steampowered.com/app/${game.appId}/?l=koreana" target="_blank" rel="noreferrer"><img src="${game.image}" alt="" loading="lazy"><span class="game-name">${game.name}</span><span class="price">${money(game)}</span></a>`).join('') : '<p class="no-games">현재 수집된 대표 게임이 없습니다.</p>'}</div></section>`).join('')}`;
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
