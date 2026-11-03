import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {buildSearchQuery} from './searchQuery.mjs';
import {resultName, resultParent, placeholderIcon} from './resultPresentation.mjs';

function harness() {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) {
      const classes = new Set(['#preview','#connection'].includes(selector) ? ['hidden'] : []);
      elements.set(selector, {
        value:'', innerHTML:'', textContent:'', style:{}, disabled:false,
        classList:{add:v=>classes.add(v), contains:v=>classes.has(v), toggle:v=>{if(classes.has(v)){classes.delete(v);return false;}classes.add(v);return true;}},
        replaceChildren(){this.innerHTML='';this.textContent='';}, focus(){}, setAttribute(){}, querySelectorAll:()=>[],
      });
    }
    return elements.get(selector);
  };
  const calls = [];
  const pending = [];
  let onReady, onSearch;
  const source = readFileSync(new URL('./app.mjs', import.meta.url),'utf8').replace(/^import[\s\S]*?from ["'][^"']+["'];\r?\n/gm,'');
  runInNewContext(source, {
    $:get, $$:()=>[], buildSearchQuery, resultName, resultParent, placeholderIcon,
    action:fn=>(...args)=>fn(...args), copy:()=>{}, status:value=>{get('#status').textContent=value;},
    ready:fn=>{onReady=fn;}, debounce:fn=>fn, escapeHtml:value=>String(value), formatBytes:value=>String(value),
    localStorage:{getItem:()=>null,setItem(){}},
    window:{mytools:{onSearch:fn=>{onSearch=fn;}}},
    call:(id,args)=>{calls.push(id);return new Promise(resolve=>pending.push({id,args,resolve}));},
    URL:{revokeObjectURL(){}},
  },{timeout:1000});
  return {get,calls,pending,ready:()=>onReady({hostSearch:true}),hostSearch:event=>onSearch(event)};
}

const flush = () => new Promise(setImmediate);
const reply = {entries:[{name:'report.txt',path:'C:\\report.txt',directory:false,size:3,modified:0}],total:1};

test('opening, refreshing and filtering a blank or whitespace-only query never searches', async () => {
  const h=harness();
  await h.ready();
  h.get('#query').value='   ';
  h.get('#query').oninput();
  await h.get('#refresh').onclick();
  h.get('#sort').onchange();
  h.get('#types').onclick({target:{closest:()=>({dataset:{type:'folder'}})}});
  h.hostSearch({query:' ',key:'Enter'});
  await flush();
  assert.deepEqual(h.calls,[]);
  assert.equal(h.get('#results').innerHTML,'');
  assert.equal(h.get('#count').textContent,'0 / 0');
  assert.equal(h.get('#open').disabled,true);
});

test('clearing during an in-flight query ignores its late results and cancels queued searches', async () => {
  const h=harness();
  await h.ready();
  h.get('#query').value='report';h.get('#query').oninput();
  assert.deepEqual(h.calls,['fs.globalsearch']);
  h.get('#query').value='other';h.get('#query').oninput();
  h.get('#query').value='';h.get('#query').oninput();
  h.pending[0].resolve(reply);await flush();
  assert.deepEqual(h.calls,['fs.globalsearch']);
  assert.equal(h.get('#results').innerHTML,'');
  assert.equal(h.get('#count').textContent,'0 / 0');
});

test('clearing removes shown results and rejects a late preview response', async () => {
  const h=harness();
  await h.ready();
  h.get('#query').value='report';h.get('#query').oninput();
  h.pending[0].resolve(reply);await flush();
  assert.ok(h.get('#results').innerHTML.includes('report.txt'));
  h.get('#preview-toggle').onclick();
  assert.equal(h.pending[1].id,'fs.searchpreview');
  h.hostSearch({query:''});
  h.pending[1].resolve({kind:'text',text:'old preview'});await flush();
  assert.equal(h.get('#preview').textContent,'');
  assert.equal(h.get('#preview').classList.contains('hidden'),true);
  assert.equal(h.get('#preview-toggle').disabled,true);
  assert.equal(h.get('#results').innerHTML,'');
});

test('clearing stops preview media and releases its source', async () => {
  const h=harness();
  await h.ready();
  const events=[];
  h.get('#preview').querySelectorAll=()=>[{pause:()=>events.push('pause'),removeAttribute:key=>events.push(key),load:()=>events.push('load')}];
  h.hostSearch({query:''});
  assert.deepEqual(events,['pause','src','load']);
});
