import test from 'node:test';
import assert from 'node:assert/strict';
import {resultName, resultParent, placeholderIcon} from './resultPresentation.mjs';

test('uses real path names and preserves punctuation-only directory names', () => {
  assert.equal(resultName({name:'#',path:'E:\\documents\\报告',directory:true}), '报告');
  assert.equal(resultName({name:'#',path:'E:\\node_modules\\array\\#',directory:true}), '#');
  assert.equal(resultName({path:'E:\\资料\\目录\\',directory:true}), '目录');
  assert.equal(resultName({path:'C:\\',directory:true}), 'C:\\');
  assert.equal(resultName({name:'fallback.md',path:''}), 'fallback.md');
  assert.equal(resultParent({path:'E:\\资料\\report.md'}),'E:\\资料');
  assert.equal(resultParent({path:'C:\\report.md'}),'C:\\');
});

test('fallback icons are distinct self-contained file and folder SVGs', () => {
  assert.ok(placeholderIcon(true).startsWith('data:image/svg+xml,'));
  assert.notEqual(placeholderIcon(true),placeholderIcon(false));
});
