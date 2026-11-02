import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchQuery } from './searchQuery.mjs';
test('Everything filters and inclusive date range', () => {
  assert.equal(buildSearchQuery({query:'report | notes',category:'file:',extension:'.md;txt',excluded:'node_modules;target',period:'custom',from:'2026-10-01',to:'2026-10-31'}),'file: <report | notes> ext:md;txt !"node_modules" !"target" dm:>=2026-10-01 dm:<2026-11-01');
  assert.throws(()=>buildSearchQuery({from:'2026-11-02',to:'2026-11-01'}));
  assert.throws(()=>buildSearchQuery({extension:'txt | exe'}));
  assert.equal(buildSearchQuery({period:'today'}),'dm:today');
});
