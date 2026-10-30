import http from 'node:http';
import {readFileSync} from 'node:fs';
const key = readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n').find(x=>x.startsWith('DEEPSEEK_API_KEY='))?.slice(17).trim();
const origins=new Set(['http://localhost:8081','http://127.0.0.1:8081']);
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!origins.has(origin)){res.writeHead(403);res.end();return;}
 res.setHeader('Access-Control-Allow-Origin',origin||'http://localhost:8081');res.setHeader('Vary','Origin');res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url==='/status'&&req.method==='GET'){res.end(JSON.stringify({configured:!!key,model:'deepseek-flash'}));return;}
 if(req.url!=='/generate'||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
 try {let body=''; for await(const chunk of req){body+=chunk;if(body.length>10000)throw Error('请求太大');}const {topic}=JSON.parse(body);if(!['操作系统','计算机网络','C','Python','Agent','Harness 框架','Agent 项目调度','LLM','硬件'].includes(topic))throw Error('请选择领域');
 const result=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(180000),body:JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},max_tokens:8192,response_format:{type:'json_object'},messages:[{role:'system',content:'输出中文JSON：{"questions":[{"type":"single或multiple","question":"题干","options":[{"text":"选项","correct":true}],"explanation":"解析"}]}。生成10道严谨多样的技术选择题，每题4个选项。单选恰好1个正确，多选2到3个正确，解析解释关键机制，避免歧义和易变化的版本细节。'},{role:'user',content:`领域：${topic}`} ]})});
 if(!result.ok)throw Error(`DeepSeek 请求失败（${result.status}）`);const data=await result.json();if(data.choices?.[0]?.finish_reason!=='stop')throw Error('生成未完整结束，请重试');res.end(JSON.stringify(JSON.parse(data.choices[0].message.content)));
 }catch(e){res.writeHead(502);res.end(JSON.stringify({error:e.name==='TimeoutError'?'生成超时，请重试':e.message}));}
}).listen(8082,'127.0.0.1',()=>console.log('Local question service: http://127.0.0.1:8082'));
