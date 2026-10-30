import {readFileSync,writeFileSync,chmodSync} from 'node:fs';
const envUrl=new URL('../.env.local',import.meta.url);
const publicBuild=process.argv.includes('--public');
let key='';
try {if(!publicBuild) key=readFileSync(envUrl,'utf8').split('\n').find(line=>line.startsWith('DEEPSEEK_API_KEY='))?.slice(17).trim()||'';}catch(e){if(e.code!=='ENOENT')throw e;}
const target=new URL('../src/embedded-key.local.ts',import.meta.url);
writeFileSync(target,`export const EMBEDDED_API_KEY = ${JSON.stringify(key)};\n`,{mode:0o600});
chmodSync(target,0o600);
console.log(key?'Local Android key configured.':'Local Android key is empty; configure it in app settings.');
