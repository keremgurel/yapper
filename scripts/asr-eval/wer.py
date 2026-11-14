import json,re,sys,glob,os
S=sys.argv[1]
def norm(t):
    t=re.sub(r"\[[^\]]*\]|\([^)]*\)"," ",t.lower())
    t=t.replace("’","'")
    t=re.sub(r"[^a-z0-9' ]"," ",t)
    return [w.strip("'") for w in t.split() if w.strip("'")]
def align(ref,hyp):
    n,m=len(ref),len(hyp)
    D=[[0]*(m+1) for _ in range(n+1)]
    for i in range(n+1): D[i][0]=i
    for j in range(m+1): D[0][j]=j
    for i in range(1,n+1):
        ri=ref[i-1]; Di=D[i]; Dp=D[i-1]
        for j in range(1,m+1):
            Di[j]=min(Dp[j-1]+(ri!=hyp[j-1]),Dp[j]+1,Di[j-1]+1)
    i,j=n,m; s=d=ins=0
    while i>0 or j>0:
        if i>0 and j>0 and D[i][j]==D[i-1][j-1]+(ref[i-1]!=hyp[j-1]):
            s+=ref[i-1]!=hyp[j-1]; i-=1;j-=1
        elif i>0 and D[i][j]==D[i-1][j]+1: d+=1;i-=1
        else: ins+=1;j-=1
    return s,d,ins
takes=['t3','t4','t5','ad1','ad2']
provs=['app','dg-nova3','dg-c120o30','dg-c60o10','dg-c60o2','dg-c30o2','dg-c15o2','sp-xai','sp-scribe']
texts={}
for t in takes:
    proj=json.load(open(f"{S}/fixtures/{t}.project.json"))
    texts[(t,'app')]=norm(" ".join(w['text'] for w in proj['words']))
    for p in provs[1:]:
        f=f"{S}/asr/{t}.{p}.json"
        if os.path.exists(f): texts[(t,p)]=norm(json.load(open(f))['text'])
for refname in ['sp-scribe']:
    print(f"\nReference = {refname}.  cells: WER% (dropped / added / changed words)")
    print("take  refwords | "+" | ".join(f"{p:>18}" for p in provs if p!=refname))
    tot={p:[0,0,0,0] for p in provs}
    for t in takes:
        ref=texts[(t,refname)]; row=[]
        for p in provs:
            if p==refname: continue
            s,d,i=align(ref,texts[(t,p)])
            tot[p][0]+=s;tot[p][1]+=d;tot[p][2]+=i;tot[p][3]+=len(ref)
            row.append(f"{100*(s+d+i)/len(ref):5.1f} ({d:3}/{i:3}/{s:3})")
        print(f"{t:5} {len(ref):7} | "+" | ".join(f"{c:>18}" for c in row))
    print("ALL           | "+" | ".join(f"{100*(tot[p][0]+tot[p][1]+tot[p][2])/tot[p][3]:5.1f} ({tot[p][1]:3}/{tot[p][2]:3}/{tot[p][0]:3})".rjust(18) for p in provs if p!=refname))
