import json,re,sys,glob,os,statistics as st
S=sys.argv[1]; pat=sys.argv[2]
def norm(ws): 
    t=re.sub(r"[^a-z0-9' ]"," "," ".join(ws).lower()); return t.split()
def ed(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        cur=[i]
        for j,y in enumerate(b,1): cur.append(min(prev[j-1]+(x!=y),prev[j]+1,cur[j-1]+1))
        prev=cur
    return prev[-1]
def keep_idx(answer,n):
    m=re.search(r"\{.*\}",answer or "",re.S)
    if not m: return None
    try: k=json.loads(m.group(0)).get("keep")
    except Exception: return None
    if not isinstance(k,list): return None
    idx=set()
    for sp in k:
        if isinstance(sp,list) and len(sp)==2 and all(isinstance(v,int) for v in sp):
            idx.update(range(max(0,sp[0]),min(n-1,sp[1])+1))
    return sorted(idx)
rows={}
for f in sorted(glob.glob(f"{S}/cut/{pat}")):
    name=os.path.basename(f).split(".",1)[1].rsplit(".jsonl",1)[0]
    fx=json.load(open(f"{S}/fixtures/{name}.json")); W=[w['text'] for w in fx['words']]
    human=norm([W[i] for a,b in fx['keptSpans'] for i in range(a,b+1)])
    for line in open(f):
        r=json.loads(line); key=(r['model'],r.get('variant','baseline'))
        d=rows.setdefault(key,{'n':0,'valid':0,'f1':[],'wrong':0,'left':0,'twer':[],'ms':[],'list':[],'settled':[],'out':[],'reason':[],'bytake':{}})
        d['n']+=1; d['ms'].append(r.get('elapsedMs',0))
        if r.get('listCostUsd') is not None: d['list'].append(r['listCostUsd'])
        if r.get('settledUsd') is not None: d['settled'].append(r['settledUsd'])
        d['out'].append(r['usage']['completion_tokens']); d['reason'].append(r['usage'].get('reasoning_tokens',0))
        if r.get('valid'):
            d['valid']+=1; d['f1'].append(r['f1']); d['wrong']+=r['wrongDeletions']; d['left']+=r['mistakesLeft']
            ki=keep_idx(r.get('answer'),len(W))
            if ki is not None:
                kept=norm([W[i] for i in ki]); d['twer'].append(ed(human,kept)/max(1,len(human)))
            d['bytake'].setdefault(name.split('.')[0],[]).append(r['f1'])
print(f"{'model':24} {'variant':10} runs valid  F1mean F1min  wrongDel leftIn keptTextErr  sec   out/reason tok  list$   paid$")
for (m,v),d in sorted(rows.items(), key=lambda kv:(-(kv[1]['valid']/kv[1]['n']), -(st.mean(kv[1]['f1']) if kv[1]['f1'] else 0))):
    f1=d['f1']
    print(f"{m:24} {v:10} {d['n']:3} {100*d['valid']/d['n']:4.0f}%  {st.mean(f1) if f1 else 0:.3f} {min(f1) if f1 else 0:.3f}  {d['wrong']:6} {d['left']:6}   {100*st.mean(d['twer']) if d['twer'] else 0:6.1f}%   {st.mean(d['ms'])/1000:5.1f}  {st.mean(d['out']):6.0f}/{st.mean(d['reason']):<6.0f} {st.mean(d['list']) if d['list'] else 0:.4f} {(('%.5f'%st.mean(d['settled'])) if d['settled'] else '   n/a')}")
