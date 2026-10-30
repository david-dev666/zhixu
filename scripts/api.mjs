import http from 'node:http';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {tutorPayload} from '../src/tutor.mjs';
const origins=new Set(['http://localhost:8081','http://127.0.0.1:8081']);
export function createApiServer({apiKey,fetchImpl=fetch}) {
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&!origins.has(origin)){res.writeHead(403);res.end();return;}
  res.setHeader('Access-Control-Allow-Origin',origin||'http://localhost:8081');res.setHeader('Vary','Origin');res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.url==='/status'&&req.method==='GET'){res.end(JSON.stringify({configured:!!apiKey,model:'deepseek-flash'}));return;}
  if(!['/generate','/chat'].includes(req.url)||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
  if(!apiKey){res.writeHead(503);res.end(JSON.stringify({error:'请先配置本地 DeepSeek API Key。'}));return;}
  let payload;
  try {
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>131072)throw Error('请求太大');}const data=JSON.parse(body);
   if(req.url==='/chat')payload=tutorPayload(data);
   else {const {topic}=data;if(!['操作系统','计算机网络','C','Python','Agent','Harness 框架','Agent 项目调度','LLM','硬件'].includes(topic))throw Error('请选择领域');payload={model:'deepseek-flash',thinking:{type:'disabled'},max_tokens:8192,response_format:{type:'json_object'},messages:[{role:'system',content:'输出中文JSON：{"questions":[{"type":"single或multiple","question":"题干","options":[{"text":"选项","correct":true}],"explanation":"解析"}]}。生成10道严谨多样的技术选择题，每题4个选项。单选恰好1个正确，多选2到3个正确，解析解释关键机制，避免歧义和易变化的版本细节。'},{role:'user',content:`领域：${topic}`}]};}
  } catch(e){res.writeHead(400);res.end(JSON.stringify({error:e instanceof SyntaxError?'请求格式不正确':e.message}));return;}
  const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),180000);res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  try {
   const result=await fetchImpl('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal:abort.signal,body:JSON.stringify(payload)});
   if(!result.ok)throw Error(`DeepSeek 请求失败（${result.status}）`);const data=await result.json();const choice=data.choices?.[0];
   if(choice?.finish_reason!=='stop')throw Error('回答未完整结束，请缩小问题后重试。');
   const text=choice.message?.content;if(typeof text!=='string'||!text.trim())throw Error('没有收到有效回答，请重试。');
   res.end(JSON.stringify(req.url==='/chat'?{answer:text.trim(),model:'deepseek-flash'}:JSON.parse(text)));
  }catch(e){if(!res.destroyed){res.writeHead(502);res.end(JSON.stringify({error:abort.signal.aborted?'请求已停止或超时，请重试。':e.message}));}}finally{clearTimeout(timeout);}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const key=readFileSync(new URL('../.env.local',import.meta.url),'utf8').split('\n').find(x=>x.startsWith('DEEPSEEK_API_KEY='))?.slice(17).trim();
 createApiServer({apiKey:key}).listen(8082,'127.0.0.1',()=>console.log('Local question service: http://127.0.0.1:8082'));
}
