from pathlib import Path
import re, json
root=Path(__file__).resolve().parents[2]
hero=root/'references/version-4/Ассеты_референса/Shopify_Hero'
out=root/'сайт/src/donor'
out.mkdir(exist_ok=True)
s=(hero/'Butterflies-DLjrCfBq.js').read_text(encoding='utf-8')
start=s.index('const ca=`')
end=s.index('function',start)
(root/'сайт/qa/particles-source.txt').write_text(s[start:start+9800],encoding='utf-8')
print(s[start:start+4000])
b=(hero/'Background-CGKUhMwd.js').read_text(encoding='utf8')
for key in ['CrossFade','uFadeCenter','uProgress','uDarken']:
    i=b.find(key)
    print('\nFADE',key,i,b[max(0,i-300):i+600])
r=(root/'references/sidekick-transition-audit/(_locale).editions.winter2026-DhFtUF58.js').read_text(encoding='utf8')
print('\nLENIS',r[172200:174200])
for m in re.finditer('1\\.3\\.[0-9]+',r):print('VERSION',r[max(0,m.start()-70):m.start()+60])

# Export pristine shader strings with provenance; no dependencies executed.
for filename,source,var in [('dust.vert',s,'ca'),('dust.frag',s,'ua')]:
    match=re.search(r'(?:const |,)'+var+r'=`([\s\S]*?)`',source)
    if match:
        (out/filename).write_text(match.group(1),encoding='utf8')
        print('EXTRACTED',filename,len(match.group(1)))
for match in re.finditer(r'(?:const |,)(\w+)=`([^`]{400,})`',b):
    if 'uFadeCenter' in match.group(2) and 'void mainImage' in match.group(2):
        (out/'crossfade.original.frag').write_text(match.group(2),encoding='utf8')
        print('EXTRACTED FADE',match.group(1),len(match.group(2)))
