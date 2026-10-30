import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
const policy=JSON.parse(readFileSync(new URL('../src/bank-policy.json',import.meta.url),'utf8'));
const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/domain.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:module.exports,module});
const {topics,validQuestion}=module.exports;const all=[];const seen=new Set();
for(const t of topics){
 const count=policy.counts[t.id];const data=JSON.parse(readFileSync(new URL(`../src/data/${t.id}.json`,import.meta.url),'utf8'));
 assert.equal(data.length,count,t.name+' count');
 for(const q of data){
  assert.ok(validQuestion(q),t.name+' invalid question');assert.equal(q.tags[0],t.name);assert.ok(!seen.has(q.id),'duplicate id');seen.add(q.id);
  if(t.id==='hardware'){
   assert.equal(q.policyVersion,policy.hardwareRevision);assert.ok(policy.hardwareSections.includes(q.section));
   for(const pattern of policy.hardwareForbiddenPatterns)assert.ok(!new RegExp(pattern,'i').test(JSON.stringify(q)),'Out-of-scope hardware content');
  }
 }
 assert.equal(new Set(data.map(q=>q.question.replace(/\s|[\p{P}]/gu,''))).size,count,'duplicate question');assert.equal(new Set(data.map(q=>q.section)).size,10,'section coverage');
 for(const section of new Set(data.map(q=>q.section)))assert.equal(data.filter(q=>q.section===section).length,count/10,'section balance');
 all.push(...data);console.log(`${t.name}: ${count} questions, 10 sections, valid`);
}
assert.equal(all.length,Object.values(policy.counts).reduce((a,b)=>a+b,0));console.log(`PASS: ${all.length} questions`);
