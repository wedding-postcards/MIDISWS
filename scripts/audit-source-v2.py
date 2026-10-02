from pathlib import Path
import struct, json, re

root = Path(__file__).resolve().parents[2]
assets = root / 'references/version-4/Ассеты_референса'
hero = assets / 'Shopify_Hero'
for name in ['Shopify_Hero/EW26_Hero_251207v3_compressed-optimized.glb', 'Shopify_Finance/EW26_Finance_251208v2_compressed-optimized.glb']:
    path = assets / name
    if not path.exists(): continue
    data = path.read_bytes(); size = struct.unpack_from('<I',data,12)[0]
    g = json.loads(data[20:20+size])
    print('\nGLB', name)
    print('SKINS',json.dumps(g.get('skins'),ensure_ascii=False))
    for i,node in enumerate(g['nodes']):
        print(i, json.dumps(node,ensure_ascii=False))
    print('MATERIALS',json.dumps(g['materials'],ensure_ascii=False))
    print('MESHES',[(m.get('name'),[(p.get('attributes'),p.get('material')) for p in m['primitives']]) for m in g['meshes']])

for filename,tokens,length in [
 ('Effects-WhEp4HUr.js',['function hg','function dg','bloom'],2000),
 ('Butterflies-DLjrCfBq.js',['studio_small_09','sparkleSpeed','gl_PointCoord','function Pa'],2400),
 ('Background-CGKUhMwd.js',['new BloomEffect','mipmapBlur:true','new fl("InvertedSobel"','lenis','smoothWheel','lerp:','touchMultiplier'],1600),
]:
    s=(hero/filename).read_text(encoding='utf-8')
    for t in tokens:
        idx=s.find(t)
        print('\nSOURCE',filename,t,idx, '\n',s[max(0,idx-200):idx+length] if idx>=0 else '')

route=(root/'references/sidekick-transition-audit/(_locale).editions.winter2026-DhFtUF58.js').read_text(encoding='utf-8')
for t in ['lenis','smoothWheel','lerp:','duration:1','headline-1','narrative-1','function Tn','preloader','loading','Start for free']:
    ids=[m.start() for m in re.finditer(re.escape(t),route)]
    print('\nROUTE',t,ids[:8])
    for i in ids[:2]: print(route[max(0,i-600):i+1800])

desktop=Path.home()/'Desktop/МИДИС — сайт/Папка refernc Shopi'
html=next(desktop.glob('Shopify Editions*.html')).read_text(encoding='utf-8')
for token in ['<header','id="sidekick"','>Sidekick</','The AI-powered','data-lenis','preloader','Shopify Editions']:
    i=html.find(token)
    print('\nHTML',token,i,'\n', html[max(0,i-200):i+2600] if i>=0 else '')
