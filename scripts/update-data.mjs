import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT = resolve(ROOT, 'data/events.json');
const UPCOMING_EVENTS_URL = 'https://partner.steamgames.com/doc/marketing/upcoming_events';
const FEATURED_URL = 'https://store.steampowered.com/api/featuredcategories/?cc=kr&l=koreana';
const APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails?cc=kr&l=koreana&appids=';
const FETCH_OPTIONS = { headers: { 'user-agent': 'steam-sale-calendar/1.0 (GitHub Actions; low-frequency public data collector)', accept: 'text/html,application/json' } };
const MONTHS = Object.fromEntries(['january','february','march','april','may','june','july','august','september','october','november','december'].map((m, i) => [m, i]));

const clean = (value) => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
async function fetchText(url) { const response = await fetch(url, FETCH_OPTIONS); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.text(); }
function toDate(year, monthName, day) { return `${year}-${String(MONTHS[monthName.toLowerCase()] + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function parseRange(text) {
  const range = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*(?:[-–—]|to)\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2})(?:,?\s*(20\d{2}))?/i);
  if (!range) return null; const year = Number(range[5] || new Date().getUTCFullYear()); const endMonth = range[3] || range[1];
  const start = toDate(year, range[1], Number(range[2])); let end = toDate(year, endMonth, Number(range[4])); if (end < start && !range[5]) end = toDate(year + 1, endMonth, Number(range[4]));
  return { startDate: start, endDate: end };
}
function classify(title) { const t = title.toLowerCase(); if (t.includes('strategy')) return ['전략', '시뮬레이션']; if (t.includes('rpg')) return ['RPG', '어드벤처']; if (t.includes('shooter')) return ['액션', '인디']; if (t.includes('sport')) return ['스포츠', '레이싱']; if (t.includes('next fest')) return ['인디', '어드벤처']; return ['액션', '인디']; }
function extractEvents(html) {
  const blocks = html.match(/<(?:h[1-6]|strong|b)[^>]*>[\s\S]{0,240}?<\/(?:h[1-6]|strong|b)>[\s\S]{0,900}/gi) || [];
  const found = new Map();
  for (const block of blocks) { const text = clean(block); if (!/steam/i.test(text)) continue; const range = parseRange(text); if (!range) continue; const title = (text.match(/^(.*?Steam[^.\n]{0,100}?)(?=\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d)/i)?.[1] || text.slice(0, 100)).trim(); if (title.length < 5) continue; const id = `${range.startDate}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`; found.set(id, { id, title, ...range, description: 'Steam 공식 Upcoming Events 페이지에서 수집한 행사입니다.', genres: classify(title), sourceUrl: UPCOMING_EVENTS_URL }); }
  return [...found.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}
function candidateIds(featured) { const ids = []; for (const category of Object.values(featured)) for (const item of category?.items || []) { const id = Number(item.id || String(item.url || '').match(/\/app\/(\d+)/)?.[1]); if (id && !ids.includes(id)) ids.push(id); } return ids.slice(0, 50); }
async function collectGames() {
  const featured = JSON.parse(await fetchText(FEATURED_URL)); const ids = candidateIds(featured); const games = [];
  for (let i = 0; i < ids.length; i += 20) { const details = JSON.parse(await fetchText(APPDETAILS_URL + ids.slice(i, i + 20).join(','))); for (const [appId, result] of Object.entries(details)) { const app = result?.success && result.data; if (!app?.is_free && app?.type === 'game') games.push({ appId: Number(appId), name: app.name, image: app.header_image, genres: (app.genres || []).map((g) => g.description), price: app.price_overview ? { currency: app.price_overview.currency, final: app.price_overview.final, discountPercent: app.price_overview.discount_percent } : null }); } }
  return games;
}
function attachGames(events, games) { return events.map((event) => ({ ...event, gameGroups: event.genres.map((genre) => ({ genre, games: games.filter((game) => game.genres.some((value) => value.toLowerCase().includes(genre.toLowerCase()))).sort((a, b) => (b.price?.discountPercent || 0) - (a.price?.discountPercent || 0)).slice(0, 5) })) })); }
async function previousData() { try { return JSON.parse(await readFile(OUTPUT, 'utf8')); } catch { return { events: [] }; } }
async function main() {
  const old = await previousData(); let events; let games = [];
  try { events = extractEvents(await fetchText(UPCOMING_EVENTS_URL)); if (!events.length) throw new Error('No event ranges found in official page'); games = await collectGames(); } catch (error) { console.warn(`Collection failed; preserving last valid data: ${error.message}`); events = old.events || []; }
  const data = { schemaVersion: 1, generatedAt: new Date().toISOString(), source: { upcomingEvents: UPCOMING_EVENTS_URL, store: FEATURED_URL }, events: games.length ? attachGames(events, games) : events };
  await mkdir(dirname(OUTPUT), { recursive: true }); const temporary = `${OUTPUT}.tmp`; await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`); await rename(temporary, OUTPUT); console.log(`Wrote ${data.events.length} events.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
