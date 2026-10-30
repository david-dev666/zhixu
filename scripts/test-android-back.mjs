import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const subscriptions = new Set();
let cleanup;
const platform = {OS:'android'};
const backHandler = {addEventListener(event, handler) {
 assert.equal(event,'hardwareBackPress');
 subscriptions.add(handler);
 return {remove(){subscriptions.delete(handler);}};
}};
const module = {exports:{}};
const code = ts.transpileModule(readFileSync(new URL('../src/useAndroidBack.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports:module.exports,module,require(name){
 if(name==='react')return {useEffect(effect){cleanup?.();cleanup=effect();}};
 if(name==='react-native')return {Platform:platform,BackHandler:backHandler};
 throw Error(name);
}});
const calls=[];
const navigate=p=>calls.push(p);
const render=page=>module.exports.useAndroidBack(page,navigate);
for(const page of ['quiz','review','settings']){
 render(page);assert.equal(subscriptions.size,1);
 const consumed=[...subscriptions][0]();assert.equal(consumed,true);assert.equal(calls.at(-1),'home');
 render('home');assert.equal(subscriptions.size,1);
 const before=calls.length;assert.equal([...subscriptions][0](),false);assert.equal(calls.length,before);
}
cleanup();assert.equal(subscriptions.size,0);cleanup=undefined;
platform.OS='web';render('quiz');assert.equal(subscriptions.size,0);
console.log('PASS: Android child pages return home, home delegates to system, listeners cleaned, web unaffected');
