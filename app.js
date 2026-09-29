const state = { date: new Date(), events: [], selectedId: null, topGames: [], topGamesLoadFailed: false, rankingSource: '' };
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
    const labels = events.map((event) => { const firstDay = event.startDate === isoDay(day); const range = `${event.startDate.slice(5).replace('-', '/')}–${event.endDate.slice(5).replace('-', '/')}`; return `<button class="event ${firstDay ? '' : 'continues'} ${event.id === state.selectedId ? 'active' : ''}" data-event-id="${escapeHtml(event.id)}" title="${escapeHtml(event.title)} · ${range}">${firstDay ? `${escapeHtml(event.title)} · ${range}` : '할인 진행 중'}</button>`; }).join('');
    return `<div class="${classes.join(' ')}"><span class="day-number">${day.getDate()}</span>${labels}</div>`;
  }).join('');
  document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => selectEvent(button.dataset.eventId)));
}

function money(game) { if (!game.price) return '가격 정보 없음'; const currency = game.price.currency || 'KRW'; const current = new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(game.price.final / 100); return game.price.discountPercent ? `<span class="discount">-${game.price.discountPercent}%</span>${current}` : current; }
function renderTopGames() {
  if (state.topGamesLoadFailed) return '<p class="no-games failed">(불러오기 실패)</p>';
  if (!state.topGames.length) return '<p class="no-games">인기 게임 정보를 준비 중입니다.</p>';
  return state.topGames.map((game, index) => { const rank = game.rank || index + 1; const url = `https://store.steampowered.com/app/${Number(game.appId)}/?l=koreana`; return `<article class="game"><span class="rank" aria-label="${rank}위">${rank}</span><a class="game-cover" href="${url}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(game.name)} Steam Store 열기"><img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy"></a><a class="game-name" href="${url}" target="_blank" rel="noreferrer">${escapeHtml(game.name)}</a><span class="price">${money(game)}</span></article>`; }).join('');
}
function selectEvent(id) {
  state.selectedId = id; const event = state.events.find((item) => item.id === id); if (!event) return;
  const sourceNote = state.rankingSource === 'top-sellers' ? 'Steam 전 세계 판매 순위 기준' : 'Steam 공개 추천 목록 기준';
  $('#detail').innerHTML = `<section class="event-summary"><h2 class="event-title">${escapeHtml(event.title)}</h2><p class="period">${formatPeriod(event)}</p><p class="description">${escapeHtml(event.description || 'Steam 공식 예정 행사입니다. 할인 대상과 세부 내용은 행사 시작 시 Steam Store에서 확인할 수 있습니다.')}</p></section><section class="world-ranking"><div class="ranking-heading"><h3>전 세계 인기 게임 TOP 10</h3><p class="ranking-note">${sourceNote}</p></div><div class="game-list">${renderTopGames()}</div></section>`;
  renderCalendar();
}
async function boot() {
  try { const response = await fetch('./data/events.json', { cache: 'no-store' }); const data = await response.json(); state.events = data.events || []; state.topGames = data.topGames || []; state.topGamesLoadFailed = Boolean(data.topGamesLoadFailed); state.rankingSource = data.source?.rankingSource || ''; $('#updated').textContent = data.generatedAt ? `마지막 갱신: ${new Date(data.generatedAt).toLocaleString('ko-KR')}` : '갱신 대기 중'; } catch { $('#updated').textContent = '일정 데이터를 불러오지 못했습니다.'; }
  const current = isoDay(new Date()); const nearest = state.events.find((event) => event.endDate >= current); if (nearest) { state.date = parseDay(nearest.startDate); selectEvent(nearest.id); } else renderCalendar();
}
$('#previous').addEventListener('click', () => { state.date.setMonth(state.date.getMonth() - 1); renderCalendar(); });
$('#next').addEventListener('click', () => { state.date.setMonth(state.date.getMonth() + 1); renderCalendar(); });
boot();
