# -*- coding: utf-8 -*-
import concurrent.futures, json, os, re, time, urllib.request, urllib.error
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MODEL = 'deepseek-flash'
POLICY = json.loads((ROOT/'src/bank-policy.json').read_text())
TOPICS = {
'os': ('操作系统', ['进程与线程','CPU调度','同步与互斥','死锁','虚拟内存','分页与TLB','文件系统','I/O与中断','系统调用','Linux实践']),
'network': ('计算机网络', ['分层与封装','以太网与ARP','IP与路由','TCP连接','TCP可靠性与拥塞','UDP与QUIC','DNS','HTTP与TLS','网络诊断','负载均衡与代理']),
'c': ('C', ['类型与转换','指针与数组','内存管理','字符串','结构体与对齐','预处理与编译链接','函数与作用域','未定义行为','文件I/O','并发与原子操作']),
'python': ('Python', ['对象与类型','容器与复杂度','函数与闭包','迭代器与生成器','异常与上下文管理','面向对象','装饰器与描述符','asyncio','线程与进程','测试与工程实践']),
'agent': ('Agent', ['工具调用','规划与执行循环','上下文管理','记忆与检索','结构化输出','错误恢复','权限与安全','评估与测试','多Agent协作','成本与可观测性']),
'harness': ('Harness 框架', ['运行循环设计','工具协议与适配','状态与检查点','上下文压缩','沙箱与权限','停止条件与预算','评测Harness','模型接口抽象','可观测性与回放','插件与扩展设计']),
'scheduling': ('Agent 项目调度', ['任务分解与DAG','依赖与拓扑排序','并发与资源限制','任务队列','重试与幂等','锁与冲突处理','检查点与恢复','取消与超时','进度与交付验收','多Agent协调']),
'llm': ('LLM', ['Transformer','注意力与位置编码','分词与嵌入','预训练','SFT与偏好优化','推理与采样','KV Cache','量化与部署','RAG与评测','MoE与分布式训练']),
'hardware': ('硬件', ['CPU流水线','缓存与一致性','内存与NUMA','GPU架构','显存与带宽','PCIe与互联','存储设备','功耗与散热','性能分析','模型训练硬件选型'])}

TOPICS['hardware'] = ('硬件', POLICY['hardwareSections'])

def valid(q):
    if not isinstance(q,dict) or q.get('type') not in ('single','multiple'): return False
    if not all(isinstance(q.get(k),str) and q[k].strip() for k in ('question','explanation')): return False
    opts=q.get('options')
    if not isinstance(opts,list) or not 4 <= len(opts) <= 6: return False
    if not all(isinstance(o,dict) and isinstance(o.get('text'),str) and o['text'].strip() and type(o.get('correct')) is bool for o in opts): return False
    if len(set(o['text'].strip() for o in opts)) != len(opts): return False
    n=sum(o['correct'] for o in opts)
    return n==1 if q['type']=='single' else 2<=n<len(opts)

def call(key, topic, section, count, avoid):
    body={'model':MODEL,'thinking':{'type':'disabled'},'max_tokens':12000,'response_format':{'type':'json_object'},'messages':[{'role':'system','content':'你是严谨的计算机技术考题作者。输出中文 JSON，格式 {"questions":[{"type":"single","question":"题干","options":[{"text":"选项","correct":true}],"explanation":"说明正确选项与关键误区"}]}。每题4个选项，单选恰好1个正确项，多选2或3个正确项。题目必须准确、无歧义、知识点多样，包含基础、应用、情境推理，约三分之一多选。C题明确标准与环境，Python题默认Python3；不考变化的版本号价格，框架题考机制不虚构API。不用所有选项均正确/均错误。题干不要加单选多选字样。解析60到140字。'},{'role':'user','content':f'出题对象：{POLICY["audience"]}。'+(POLICY['hardwareScope'] if topic=='硬件' else '以算法开发和软件工程实践为背景。')+f'领域：{topic}；子主题：{section}。生成 {count} 道不同题目，避免与这些题干重复：'+json.dumps(avoid,ensure_ascii=False)}]}
    req=urllib.request.Request('https://api.deepseek.com/chat/completions',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
    try:
        with urllib.request.urlopen(req,timeout=180) as res: payload=json.load(res)
    except urllib.error.HTTPError as e: raise RuntimeError('DeepSeek HTTP '+str(e.code)) from None
    message=payload['choices'][0]
    if message['finish_reason']!='stop': raise RuntimeError('输出未完整结束')
    return json.loads(message['message']['content']).get('questions',[]),payload.get('usage',{})

def generate_topic(slug, info, key):
    topic, sections=info; total=POLICY['counts'][slug]; quota=total//len(sections); target=ROOT/'src/data'/f'{slug}.json'; target.parent.mkdir(parents=True,exist_ok=True)
    records=json.loads(target.read_text()) if target.exists() else []
    for section in sections:
        failures=0
        while sum(q.get('section')==section for q in records)<quota:
            need=min(15,quota-sum(q.get('section')==section for q in records))
            try:
                raw,usage=call(key,topic,section,need,[q['question'] for q in records if q.get('section')==section])
                existing={re.sub(r'\W','',q['question']) for q in records}; added=0
                for q in raw:
                    if not valid(q): continue
                    if slug=='hardware' and any(re.search(pattern,json.dumps(q,ensure_ascii=False),re.I) for pattern in POLICY['hardwareForbiddenPatterns']):continue
                    fingerprint=re.sub(r'\W','',q['question'])
                    if fingerprint in existing: continue
                    existing.add(fingerprint)
                    q.update(id=f'{slug}-compute-v2-{len(records)+1:03}' if slug=='hardware' else f'{slug}-{len(records)+1:03}',tags=[topic],section=section)
                    if slug=='hardware': q['policyVersion']=POLICY['hardwareRevision']
                    records.append(q); added+=1
                    if added==need: break
                if not added: raise RuntimeError('无有效新题')
                tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n');tmp.replace(target)
                print(f'{topic}: {len(records)}/{total}',flush=True)
                failures=0
            except Exception as e:
                failures+=1;print(f'{topic}: retry {failures} ({type(e).__name__}: {e})',flush=True)
                if failures>=4: raise
                time.sleep(3*failures)
    return topic,len(records)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--topic',choices=TOPICS);args=parser.parse_args()
    env=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if '=' in line and not line.startswith('#'))
    key=env['DEEPSEEK_API_KEY'].strip()
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures=[pool.submit(generate_topic,slug,info,key) for slug,info in TOPICS.items() if not args.topic or slug==args.topic]
        for future in concurrent.futures.as_completed(futures): print('COMPLETE',future.result(),flush=True)
