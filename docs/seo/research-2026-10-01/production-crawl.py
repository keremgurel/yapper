import sys,re,json,urllib.request
from html.parser import HTMLParser
from xml.etree import ElementTree
base=sys.argv[1].rstrip('/')
extra=['/privacy','/terms','/tools','/training/freestyle-speech','/training?mode=interview-prep','/training?mode=research-and-explain','/products/studio/pricing','/products/train/pricing','/products/train/ai-feedback','/style-guide','/history','/progress','/studio-access']
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.c=[];s.d=[];s.r=[];s.h1=[];s.h2=[];s.t='';s.ld=[];s.a=None;s.b='';s.links=set()
    def handle_starttag(s,tag,attrs):
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical': s.c.append(a.get('href'))
        if tag=='meta' and a.get('name')=='description': s.d.append(a.get('content',''))
        if tag=='meta' and a.get('name')=='robots': s.r.append(a.get('content',''))
        if tag=='a' and a.get('href','').startswith('/'): s.links.add(a['href'].split('#')[0])
        if tag in('title','h1','h2') or (tag=='script' and a.get('type')=='application/ld+json'): s.a=tag;s.b=''
    def handle_data(s,d):
        if s.a: s.b+=d
    def handle_endtag(s,tag):
        if tag!=s.a: return
        v=' '.join(s.b.split())
        if tag=='title': s.t=v
        elif tag=='h1': s.h1.append(v)
        elif tag=='h2': s.h2.append(v)
        else:
            try:
                j=json.loads(s.b); g=j.get('@graph',[j]) if isinstance(j,dict) else j
                s.ld+= [str(x.get('@type')) for x in g]
            except Exception as e: s.ld.append('INVALID')
        s.a=None
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
op=urllib.request.build_opener(NoRedirect)
def get(u):
    try:
        r=op.open(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 audit'}),timeout=40); return r.status,r.read().decode('utf8','ignore'),r.headers
    except urllib.error.HTTPError as e: return e.code,'',e.headers
st,xml,_=get(base+'/sitemap.xml')
tree=ElementTree.fromstring(xml)
sm=[(u.find('{*}loc').text,(u.find('{*}lastmod').text if u.find('{*}lastmod') is not None else None)) for u in tree.findall('{*}url')]
paths=[re.sub(r'^https?://[^/]+','',l) or '/' for l,_ in sm]
rows=[]
for p in paths+[e for e in extra if e not in paths]:
    st,html,h=get(base+p)
    pg=P(); pg.feed(html)
    rows.append(dict(path=p,status=st,location=h.get('location'),title=pg.t,desc=(pg.d[0] if pg.d else None),canonical=pg.c,robots=pg.r,h1=pg.h1,h2=pg.h2[:12],ld=pg.ld,in_sitemap=p in paths,links=sorted(pg.links),xrobots=h.get('x-robots-tag')))
json.dump(dict(sitemap=sm,rows=rows),open(sys.argv[2],'w'),indent=1)
print(len(sm),'sitemap urls; lastmod present:',sum(1 for _,m in sm if m))
for r in rows:
    if r['path'].startswith('/blog/'): continue
    print(f"{r['status']} {r['path']:42} canon={[c.replace('https://ypr.app','') or '/' for c in r['canonical']]} robots={r['robots']} h1={r['h1']} | {r['title']}" + (f" -> {r['location']}" if r['location'] else ''))
