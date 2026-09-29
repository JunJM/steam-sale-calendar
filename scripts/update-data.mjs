import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT = resolve(ROOT, 'data/events.json');
const STATIC_EVENTS = resolve(ROOT, 'data/events.static.json');
const UPCOMING_EVENTS_URL = 'https://partner.steamgames.com/doc/marketing/upcoming_events';
const TOP_SELLERS_URL = 'https://store.steampowered.com/charts/topselling/?l=english';
const FEATURED_URL = 'https://store.steampowered.com/api/featuredcategories/?l=english';
const APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails?appids=';
const FETCH_OPTIONS = { headers: { 'user-agent': 'steam-sale-calendar/1.0 (GitHub Actions; low-frequency public data collector)', accept: 'text/html,application/json' } };
const MONTHS = Object.fromEntries(['january','february','march','april','may','june','july','august','september','october','november','december'].map((m, i) => [m, i]));

const clean = (value) => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
async function fetchText(url) { const response = await fetch(url, FETCH_OPTIONS); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.text(); }
function appDetailsUrl(appIds) { return `${APPDETAILS_URL}${appIds.join(',')}&cc=kr&l=koreana`; }
function toDate(year, monthName, day) { return `${year}-${String(MONTHS[monthName.toLowerCase()] + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function parseRange(text) {
  const range = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*(?:[-–—]|to)\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2})(?:,?\s*(20\d{2}))?/i);
  if (!range) return null; const year = Number(range[5] || new Date().getUTCFullYear()); const endMonth = range[3] || range[1];
  const start = toDate(year, range[1], Number(range[2])); let end = toDate(year, endMonth, Number(range[4])); if (end < start && !range[5]) end = toDate(year + 1, endMonth, Number(range[4]));
  return { startDate: start, endDate: end };
}
function classify(title) { const t = title.toLowerCase(); if (t.includes('strategy')) return ['전략', '시뮬레이션']; if (t.includes('rpg')) return ['RPG', '어드벤처']; if (t.includes('shooter')) return ['액션', '인디']; if (t.includes('sport')) return ['스포츠', '레이싱']; if (t.includes('next fest')) return ['인디', '어드벤처']; return ['액션', '인디']; }
function eventTitle(block, text) {
  const heading = block.match(/^<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/i)?.[1];
  const tableTitle = text.match(/(?:^|\s)([^|]{3,80}?(?:Fest|Sale|Scream)[^|]{0,40}?)\s*\|\s*(?=(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d)/i)?.[1];
  const title = clean(tableTitle || heading || '');
  if (title.length < 3 || title.length > 90 || /running three times|is a multi-day|celebration where/i.test(title)) return null;
  return title;
}
export function extractEvents(html) {
  const blocks = html.match(/<(?:h[1-6]|strong|b)[^>]*>[\s\S]*?<\/(?:h[1-6]|strong|b)>[\s\S]*?(?=<(?:h[1-6]|strong|b)[^>]*>|$)/gi) || [];
  const found = new Map();
  for (const block of blocks) { const text = clean(block); if (!/steam/i.test(text)) continue; const range = parseRange(text); const title = eventTitle(block, text); if (!range || !title) continue; const id = `${range.startDate}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`; found.set(id, { id, title, ...range, description: 'Steam 공식 Upcoming Events 페이지에서 수집한 행사입니다.', genres: classify(title), sourceUrl: UPCOMING_EVENTS_URL }); }
  return [...found.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}
function topSellerCandidates(html) {
  const matches = html.matchAll(/href=["'](?:https?:\/\/store\.steampowered\.com)?\/app\/(\d+)(?:\/[^"']*)?["']/gi);
  const ids = [];
  for (const match of matches) { const appId = Number(match[1]); if (appId && !ids.includes(appId)) ids.push(appId); }
  if (ids.length < 20) throw new Error(`Top Sellers chart yielded only ${ids.length} app links`);
  return ids.slice(0, 10).map((appId, index) => ({ appId, topSellerRank: index + 1 }));
}
async function collectTopSellerGames() {
  const candidates = topSellerCandidates(await fetchText(TOP_SELLERS_URL)); const games = [];
  for (const candidate of candidates) {
    const details = JSON.parse(await fetchText(appDetailsUrl([candidate.appId])));
    const result = details[candidate.appId]; const app = result?.success && result.data;
    if (!app || app.type !== 'game') continue;
    const price = app.price_overview ? { currency: app.price_overview.currency, final: app.price_overview.final, discountPercent: app.price_overview.discount_percent } : null;
    games.push({ appId: candidate.appId, name: app.name, image: app.header_image, genres: (app.genres || []).map((g) => g.description), price, topSellerRank: candidate.topSellerRank });
  }
  if (!games.length) throw new Error('Top Sellers details yielded no games');
  return games;
}
async function collectFeaturedGames() {
  const featured = JSON.parse(await fetchText(FEATURED_URL)); const candidates = [];
  for (const category of Object.values(featured)) for (const item of category?.items || []) {
    const appId = Number(item.id || String(item.url || '').match(/\/app\/(\d+)/)?.[1]);
    if (!appId || candidates.some((candidate) => candidate.appId === appId)) continue;
    const price = Number.isFinite(item.final_price) ? { currency: item.currency || 'KRW', final: item.final_price, discountPercent: item.discount_percent || 0 } : null;
    candidates.push({ appId, name: item.name || `Steam 게임 ${appId}`, image: item.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`, genres: [], price, topSellerRank: 1000 + candidates.length + 1 });
  }
  if (!candidates.length) throw new Error('Store featured categories yielded no games');
  return candidates.slice(0, 50);
}
function rankGames(games, limit) { return games.slice().sort((a, b) => a.topSellerRank - b.topSellerRank || (b.price?.discountPercent || 0) - (a.price?.discountPercent || 0)).slice(0, limit).map((game, index) => ({ ...game, rank: index + 1 })); }
function cleanEvents(events) { return events.map(({ gameGroups, rankingGroups, ...event }) => event); }
async function readJson(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; } }
function validEvents(events) { return Array.isArray(events) && events.length >= 3 && events.every((event) => event.title.length <= 90 && !/running three times|multi-day celebration/i.test(event.title)); }
async function main() {
  const old = await readJson(OUTPUT, { events: [] }); const fallback = await readJson(STATIC_EVENTS, { events: [] }); let events = validEvents(old.events) ? old.events : fallback.events; let games = []; let rankingSource = 'top-sellers';
  try { const collected = extractEvents(await fetchText(UPCOMING_EVENTS_URL)); if (validEvents(collected)) events = collected; else console.warn('Event collection did not pass validation; retaining verified schedule.'); } catch (error) { console.warn(`Event collection failed; retaining verified schedule: ${error.message}`); }
  let gameLoadFailed = false;
  try { games = await collectTopSellerGames(); } catch (error) {
    console.warn(`Top Sellers collection failed; using Store featured fallback: ${error.message}`);
    try { games = await collectFeaturedGames(); rankingSource = 'store-featured-fallback'; } catch (fallbackError) { console.warn(`Store featured fallback failed: ${fallbackError.message}`); rankingSource = 'unavailable'; gameLoadFailed = true; }
  }
  const data = { schemaVersion: 2, generatedAt: new Date().toISOString(), source: { upcomingEvents: UPCOMING_EVENTS_URL, topSellers: TOP_SELLERS_URL, appDetails: APPDETAILS_URL, rankingSource }, topGames: gameLoadFailed ? [] : rankGames(games, 10), topGamesLoadFailed: gameLoadFailed, events: cleanEvents(events) };
  await mkdir(dirname(OUTPUT), { recursive: true }); const temporary = `${OUTPUT}.tmp`; await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`); await rename(temporary, OUTPUT); console.log(`Wrote ${data.events.length} events.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
