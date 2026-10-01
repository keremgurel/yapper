#!/usr/bin/env python3
"""Read-only checks against rendered public pages. No indexing submissions.
Usage: python3 scripts/audit-marketing-seo.py http://localhost:3111
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen
from xml.etree import ElementTree

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.descriptions = []
        self.robots = []
        self.h1s = []
        self.title = ''
        self.jsonld = []
        self.links = []
        self.images = []
        self.active = None
        self.buffer = ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonicals.append(a.get('href'))
        if tag == 'meta' and a.get('name') == 'description': self.descriptions.append(a.get('content', ''))
        if tag == 'meta' and a.get('name') == 'robots': self.robots.append(a.get('content', ''))
        if tag == 'a': self.links.append(a.get('href', ''))
        if tag == 'img': self.images.append(a)
        if tag in ('title', 'h1') or (tag == 'script' and a.get('type') == 'application/ld+json'):
            self.active = tag
            self.buffer = ''

    def handle_data(self, data):
        if self.active: self.buffer += data

    def handle_endtag(self, tag):
        if tag != self.active: return
        if tag == 'title': self.title = self.buffer.strip()
        if tag == 'h1': self.h1s.append(self.buffer.strip())
        if tag == 'script': self.jsonld.append(json.loads(self.buffer))
        self.active = None

root = Path(__file__).resolve().parents[1]
slugs = re.findall(r'slug: "([^"]+)"', (root / 'src/data/marketing-features.ts').read_text())
routes = ['/', '/products', '/products/studio', '/products/train', '/features', '/training', '/pricing'] + ['/features/' + s for s in slugs]
base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3111').rstrip('/')
with urlopen(base + '/sitemap.xml', timeout=30) as response:
    tree = ElementTree.fromstring(response.read())
sitemap = [x.text for x in tree.findall('{*}url/{*}loc')]
assert len(sitemap) == len(set(sitemap)), 'Duplicate sitemap URLs'
assert not any('/studio/' in x for x in sitemap), 'Private workspace in sitemap'
seen_titles, seen_descriptions = set(), set()
for route in routes:
    with urlopen(base + route, timeout=30) as response:
        assert response.status == 200
        assert response.url.rstrip('/') == (base + route).rstrip('/'), f'Unexpected redirect: {route}'
        page = Page()
        page.feed(response.read().decode())
    canonical = 'https://ypr.app' + (route if route != '/' else '')
    assert page.canonicals == [canonical], (route, page.canonicals)
    assert canonical in sitemap, f'Missing from sitemap: {route}'
    assert len(page.h1s) == 1 and page.h1s[0], (route, page.h1s)
    assert page.title and page.title not in seen_titles, f'Missing/duplicate title: {route}'
    assert len(page.descriptions) == 1 and page.descriptions[0] and page.descriptions[0] not in seen_descriptions, f'Missing/duplicate description: {route}'
    assert all('noindex' not in r.lower() for r in page.robots), f'Public page noindex: {route}'
    assert all('alt' in i for i in page.images), f'Image missing alt: {route}'
    seen_titles.add(page.title)
    seen_descriptions.add(page.descriptions[0])
    if route == '/features':
        assert all('/features/' + s in page.links for s in slugs), 'Orphan feature in directory'
    print(f'PASS {route}: {page.title} ({len(page.title)} chars)')
print(f'PASS {len(routes)} public pages; {len(sitemap)} unique sitemap URLs. Does not establish search-engine indexation or rankings.')
