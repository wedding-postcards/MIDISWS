import json, pathlib,struct
root=pathlib.Path(__file__).resolve().parents[2]
d=root/'references/version-4/Ассеты_референса/Shopify_Hero'
p=d/'EW26_Hero_251207v3_compressed-optimized.glb'
b=p.read_bytes();g=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
dataStart=20+struct.unpack_from('<I',b,12)[0]+8
buf=b[dataStart:]
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];c={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
 start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',c*4)
 return [list(struct.unpack_from('<'+'f'*c,buf,start+k*stride)) for k in range(a['count'])]
lines=[]
body_joints=set(g['skins'][2]['joints']+g['skins'][7]['joints'])
derived={'source':p.name,'duration':5,'tracks':{}}
for i,node in enumerate(g['nodes']):
 if 'mesh' in node:
  m=g['meshes'][node['mesh']];lines.append(f"NODE {i} {node.get('name')} skin={node.get('skin')} meshes={len(m['primitives'])} pos={node.get('translation')} rot={node.get('rotation')}")
for a in g.get('animations',[]):
 lines.append('ANIMATION '+str(a.get('name')))
 for c in a['channels']:
  node=g['nodes'][c['target']['node']];name=node.get('name','')
  if 'mesh' not in node and c['target']['node'] not in body_joints:continue
  s=a['samplers'][c['sampler']];times=accessor(s['input']);vals=accessor(s['output'])
  mins=[round(min(x[j] for x in vals),5) for j in range(len(vals[0]))];maxs=[round(max(x[j] for x in vals),5) for j in range(len(vals[0]))]
  lines.append(f"node={c['target']['node']} {name} {c['target']['path']} keys={len(times)} time={times[0]}..{times[-1]} min={mins} max={maxs} first={vals[0]} last={vals[-1]}")
  if c['target']['node'] in [190,180,91] and c['target']['path'] in ['rotation','translation']:
   derived['tracks'][str(c['target']['node'])+':'+c['target']['path']]={'times':[round(t[0],5) for t in times],'values':[[round(v,7) for v in value] for value in vals]}
t=json.loads((d/'HeroScene.theatre-project-state_15.json').read_text(encoding='utf-8'))
for sname,sheet in t['sheetsById'].items():
 lines.append('SHEET '+sname+' STATIC '+json.dumps(sheet.get('staticOverrides',{}),ensure_ascii=False))
 for obj,tracks in sheet.get('sequence',{}).get('tracksByObject',{}).items():
  for track in tracks['trackData'].values():
   lines.append('TRACK '+obj+' '+track.get('__debugName','')+' '+json.dumps([{k:v for k,v in f.items() if k in ['position','value','handles']} for f in track['keyframes']],ensure_ascii=False))
target=root/'сайт/qa/hero-motion-audit.txt';target.write_text('\n'.join(lines),encoding='utf-8')
derived['progress']=next(v['keyframes'] for v in t['sheetsById']['Scene']['sequence']['tracksByObject']['asset-1']['trackData'].values() if v.get('__debugName')=='asset-1:["animations","Scene","progress"]')
(root/'сайт/src/donor/hero-micro-motion.json').write_text(json.dumps(derived,separators=(',',':')),encoding='utf-8')
print('Hero motion audit: woman body',len(g['skins'][2]['joints']),'bones; man body',len(g['skins'][7]['joints']),'bones.')
print('Extracted',list(derived['tracks']), 'and exact Theatre progress.')
