#!/usr/bin/env python3
"""Read-only checks against rendered public pages. Submits nothing.

Usage: python3 scripts/audit-marketing-seo.py http://localhost:3000

Checks every route in src/lib/seo/public-routes.json plus every blog post in
the sitemap: status, self-canonical, one H1, unique title and description,
indexability, parseable JSON-LD, sitemap coverage and lastmod, internal links
(no orphans, no links to redirects), the redirect table, practice-mode
canonicals, and that signed-in pages stay out of the index. A pass means the
pages are technically eligible. It says nothing about indexing or rankings.
"""
import json
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

SITE = 'https://ypr.app'
ROOT = Path(__file__).resolve().parents[1]
ROUTES = json.loads((ROOT / 'src/lib/seo/public-routes.json').read_text())
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000').rstrip('/')

# source -> the single hop it must make. A chain or a wrong target fails.
REDIRECTS = {
    '/studio': '/products/studio',
    '/products': '/',
    '/products/yapper': '/products/train',
    '/features/creator-feedback': '/products/train/ai-feedback',
    '/freestyle': '/freestyle-speech',
    '/training/freestyle-speech': '/freestyle-speech',
    '/random-topic-generator': '/training/random-topic-generator',
}
# practice mode -> canonical it must declare (None: must be noindex instead)
MODES = {
    'interview-prep': '/training/interview-prep',
    'random-topic-generator': '/training/random-topic-generator',
    'freestyle-speech': '/freestyle-speech',
    'research-and-explain': None,
    'not-a-mode': None,
}
PRIVATE = ['/progress', '/history', '/style-guide']
GATED = ['/studio/home', '/studio/editor']


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals, self.descriptions, self.robots = [], [], []
        self.h1s, self.jsonld, self.links, self.images = [], [], set(), []
        self.title, self.active, self.buffer = '', None, ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonicals.append(a.get('href'))
        if tag == 'meta' and a.get('name') == 'description': self.descriptions.append(a.get('content', ''))
        if tag == 'meta' and a.get('name') == 'robots': self.robots.append(a.get('content', ''))
        if tag == 'a' and (a.get('href') or '').startswith('/'):
            self.links.add(a['href'].split('#')[0].split('?')[0] or '/')
        if tag == 'img': self.images.append(a)
        if tag in ('title', 'h1') or (tag == 'script' and a.get('type') == 'application/ld+json'):
            self.active, self.buffer = tag, ''

    def handle_data(self, data):
        if self.active: self.buffer += data

    def handle_endtag(self, tag):
        if tag != self.active: return
        if tag == 'title': self.title = self.buffer.strip()
        if tag == 'h1': self.h1s.append(' '.join(self.buffer.split()))
        if tag == 'script': self.jsonld.append(json.loads(self.buffer))  # raises if invalid
        self.active = None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None


opener = urllib.request.build_opener(NoRedirect)


def fetch(path):
    try:
        r = opener.open(BASE + path, timeout=60)
        return r.status, r.read().decode(), r.headers
    except urllib.error.HTTPError as e:
        return e.code, '', e.headers


def parse(path):
    status, html, _ = fetch(path)
    assert status == 200, f'{path}: HTTP {status}'
    page = Page()
    page.feed(html)
    return page


def local(location):
    for origin in (BASE, SITE):
        if location.startswith(origin): location = location[len(origin):]
    return location.split('?')[0] or '/'


def canonical(path):
    return SITE + ('' if path == '/' else path)


failures = []
warnings = []


def check(ok, message):
    if not ok: failures.append(message)


status, xml, _ = fetch('/sitemap.xml')
assert status == 200, 'sitemap.xml unavailable'
entries = {u.find('{*}loc').text: u.find('{*}lastmod') for u in ElementTree.fromstring(xml).findall('{*}url')}
check(len(entries) == len(set(entries)), 'duplicate sitemap URLs')
blog = sorted(local(u) for u in entries if '/blog/' in u)
expected = {canonical(p) for p in ROUTES} | {canonical(p) for p in blog}
check(set(entries) == expected, f'sitemap differs from the route registry: {sorted(set(entries) ^ expected)}')
check(all(m is not None and m.text for m in entries.values()), 'sitemap URL without lastmod')
check(not any(local(u).startswith('/studio') or '?' in u for u in entries), 'private or parameter URL in sitemap')

titles, descriptions, inbound = {}, {}, {}
for path in list(ROUTES) + blog:
    page = parse(path)
    check(page.canonicals == [canonical(path)], f'{path}: canonical {page.canonicals}')
    check(len(page.h1s) == 1 and page.h1s[0], f'{path}: H1 {page.h1s}')
    check(bool(page.title) and page.title not in titles, f'{path}: missing or duplicate title (also {titles.get(page.title)})')
    # Long titles may be truncated in results. Advisory: a title that already
    # ranks is not rewritten to satisfy a character count.
    if len(page.title) > 65: warnings.append(f'{path}: title is {len(page.title)} characters')
    d = page.descriptions
    check(len(d) == 1 and d[0] and d[0] not in descriptions, f'{path}: missing or duplicate description')
    check(not d or len(d[0]) <= 200, f'{path}: description is {len(d[0]) if d else 0} characters')
    check(all('noindex' not in r.lower() for r in page.robots), f'{path}: public page is noindex')
    check(all('alt' in i for i in page.images), f'{path}: image without alt')
    titles[page.title] = path
    if d: descriptions[d[0]] = path
    for link in page.links:
        if link != path: inbound.setdefault(link, set()).add(path)
        check(link not in REDIRECTS, f'{path}: links to redirecting URL {link}')
    print(f'ok   {path}  [{ROUTES.get(path, {}).get("product", "train")}]  {page.title}')

for path in ROUTES:
    if path != '/':
        check(path in inbound, f'{path}: orphan, no internal link from another public page')

for source, target in REDIRECTS.items():
    status, _, headers = fetch(source)
    hop = local(headers.get('location') or '')
    check(status in (301, 308) and hop == target, f'redirect {source}: {status} -> {hop or "none"} (want {target})')
    check(fetch(target)[0] == 200, f'redirect {source}: destination {target} is not a 200')
    print(f'ok   {source} -> {target}')

for mode, want in MODES.items():
    page = parse(f'/training?mode={mode}')
    if want:
        check(page.canonicals == [canonical(want)], f'mode {mode}: canonical {page.canonicals}')
    else:
        check(any('noindex' in r.lower() for r in page.robots) and not page.canonicals, f'mode {mode}: should be noindex with no canonical')
    print(f'ok   /training?mode={mode} -> {want or "noindex"}')

for path in PRIVATE:
    page = parse(path)
    check(any('noindex' in r.lower() for r in page.robots), f'{path}: private page is indexable')
    check(not page.canonicals, f'{path}: noindex page declares canonical {page.canonicals}')
for path in GATED:
    status, _, headers = fetch(path)
    check(status in (302, 307, 401, 404), f'{path}: workspace answered {status} to a signed-out request')
status, robots, _ = fetch('/robots.txt')
check('Disallow: /studio/' in robots and 'Sitemap: ' in robots, 'robots.txt lost its workspace rule or sitemap')

if warnings:
    print('\n'.join(['', f'WARN {len(warnings)}'] + warnings))
if failures:
    print('\n'.join(['', f'FAIL {len(failures)}'] + failures))
    sys.exit(1)
print(f'\nPASS {len(ROUTES)} pages, {len(blog)} posts, {len(REDIRECTS)} redirects, {len(entries)} sitemap URLs.')
print('Technical eligibility only. Does not establish indexing or rankings.')
