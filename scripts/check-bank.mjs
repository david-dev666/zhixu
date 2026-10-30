import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/domain.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:module.exports,module});
const {topics,validQuestion}=module.exports;const all=[];const seen=new Set();
for(const t of topics){const data=JSON.parse(readFileSync(new URL(`../src/data/${t.id}.json`,import.meta.url),'utf8'));assert.equal(data.length,300,t.name+' count');for(const q of data){assert.ok(validQuestion(q),t.name+' invalid question');assert.equal(q.tags[0],t.name);assert.ok(!seen.has(q.id),'duplicate id');seen.add(q.id);}assert.equal(new Set(data.map(q=>q.question.replace(/\s|[\p{P}]/gu,''))).size,300,'duplicate question');assert.equal(new Set(data.map(q=>q.section)).size,10,'section coverage');all.push(...data);console.log(`${t.name}: 300 questions, 10 sections, valid`);}
assert.equal(all.length,2700);console.log('PASS: 2700 questions');
