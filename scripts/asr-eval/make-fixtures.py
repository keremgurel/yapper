import json,sys,os
S=sys.argv[1]
def spans(words,clips):
    keep=[]
    for i,w in enumerate(words):
        d=max(1e-6,w['end']-w['start'])
        ov=sum(max(0,min(w['end'],e)-max(w['start'],s)) for s,e in clips)
        if ov/d>=0.35: keep.append(i)
    out=[]
    for i in keep:
        if out and out[-1][1]==i-1: out[-1][1]=i
        else: out.append([i,i])
    return out
for t in ['t3','t4','t5','ad1','ad2']:
    p=json.load(open(f"{S}/fixtures/{t}.project.json"))
    srcs={'app':[{'text':w['text'],'start':w['start'],'end':w['end']} for w in p['words']]}
    for prov in sys.argv[2:]:
        f=f"{S}/asr/{t}.{prov}.json"
        if os.path.exists(f): srcs[prov]=[{'text':w['text'].strip(),'start':w['start'],'end':w['end']} for w in json.load(open(f))['words']]
    for name,words in srcs.items():
        ks=spans(words,p['clips'])
        json.dump({'source':f"{t}.{name}",'words':words,'keptSpans':ks,'clips':p['clips']},open(f"{S}/fixtures/{t}.{name}.json",'w'))
        kept=sum(b-a+1 for a,b in ks)
        print(f"{t}.{name}: {len(words)} words, keep {kept} ({100*(1-kept/len(words)):.0f}% deleted), {len(ks)} spans")
