# -*- coding: utf-8 -*-
import concurrent.futures, json, time, urllib.request
from pathlib import Path
from generate import ROOT, TOPICS, MODEL, POLICY, valid

def review(slug,info,key):
    topic=info[0];total=POLICY['counts'][slug];path=ROOT/'src/data'/f'{slug}.json';state=ROOT/(f'.review-{slug}-{POLICY["hardwareRevision"]}.local.json' if slug=='hardware' else f'.review-{slug}.local.json')
    while True:
        data=json.loads(path.read_text()) if path.exists() else []
        if len(data)==total: break
        time.sleep(15)
    done=set(json.loads(state.read_text())) if state.exists() else set()
    for start in range(0,total,20):
        batch=[q for q in data[start:start+20] if q['id'] not in done]
        if not batch:continue
        body={'model':MODEL,'thinking':{'type':'enabled'},'reasoning_effort':'high','max_tokens':24000,'response_format':{'type':'json_object'},'messages':[{'role':'system','content':'你是严格的计算机技术题目审校者。审查所有题目的事实错误、正确项数量、歧义和缺失前提。尤其检查单选是否有多个合理答案，C的实现定义条件，Python对象模型，调度算法在线离线差异。对有问题的题目给出完整修正版，保留id和题型；没问题不输出。不要仅为文风改写。修正版每题4个选项，单选仅1个正确项，多选2或3个正确项。解析不要使用选项字母引用，直接解释机制。只输出JSON {"corrections":[{"id":"原id","type":"single或multiple","question":"题干","options":[{"text":"选项","correct":true}],"explanation":"解析"}]}。'},{'role':'user','content':('出题对象：'+POLICY['audience']+'。'+(POLICY['hardwareScope'] if slug=='hardware' else '')+'审核以下题目，发现超出范围也必须修正：'+json.dumps(batch,ensure_ascii=False))}]}
        for attempt in range(4):
            try:
                req=urllib.request.Request('https://api.deepseek.com/chat/completions',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
                with urllib.request.urlopen(req,timeout=240) as res:payload=json.load(res)
                choice=payload['choices'][0]
                if choice['finish_reason']!='stop':raise RuntimeError('审校输出未完成')
                corrections=json.loads(choice['message']['content'])['corrections'];lookup={q['id']:q for q in batch}
                if not isinstance(corrections,list):raise RuntimeError('审校格式不正确')
                for q in corrections:
                    if q.get('id') not in lookup or not valid(q):raise RuntimeError('修正题目无效')
                    if slug=='hardware':
                        import re
                        if any(re.search(pattern,json.dumps(q,ensure_ascii=False),re.I) for pattern in POLICY['hardwareForbiddenPatterns']):raise RuntimeError('硬件题超出算法工程师范围')
                for q in corrections:
                    old=lookup[q['id']];old.update({k:q[k] for k in ['type','question','options','explanation']})
                tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(path);done.update(q['id'] for q in batch);state.write_text(json.dumps(sorted(done)))
                print(f'REVIEW {topic}: {len(done)}/{total}, corrected {len(corrections)}',flush=True);break
            except Exception as e:
                print(f'REVIEW {topic}: retry {attempt+1} ({type(e).__name__})',flush=True)
                if attempt==3:raise RuntimeError(topic+' review failed') from None
                time.sleep(3)
    return topic
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--topic',choices=TOPICS);args=parser.parse_args()
    key=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if '=' in line)['DEEPSEEK_API_KEY'].strip()
    with concurrent.futures.ThreadPoolExecutor(max_workers=9) as pool:
        futures=[pool.submit(review,slug,info,key) for slug,info in TOPICS.items() if not args.topic or slug==args.topic]
        for f in concurrent.futures.as_completed(futures):print('REVIEW COMPLETE',f.result(),flush=True)
