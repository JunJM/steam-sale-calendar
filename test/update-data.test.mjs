import test from 'node:test';
import assert from 'node:assert/strict';

test('event JSON has the public static-site schema', async () => {
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
  assert.equal(data.schemaVersion, 1);
  assert.ok(Array.isArray(data.events));
  assert.ok(data.source.upcomingEvents.startsWith('https://'));
});
