from pathlib import Path
import math,json,re
root=Path('/workspace/Foundation_Engineering_Program')
# Independent piecewise linear pressure primitives; no production calculation helper.
H=5.; eff=20.-9.81; a=eff/3+9.81; b=eff/3-2*eff; c=9.81*H+2*eff*H

def force(t):
 return a*H**2/2+b*(t*t-H*H)/2+c*(t-H)
def moment(t):
 return a*(t*H**2/2-H**3/3)+b*(t*(t*t-H*H)/2-(t**3-H**3)/3)+c*(t*(t-H)-(t*t-H*H)/2)
def bisect(f,lo,hi):
 for _ in range(120):
  mid=(lo+hi)/2
  if f(lo)*f(mid)<=0: hi=mid
  else: lo=mid
 return (lo+hi)/2
toe=bisect(moment,6,39); zm=bisect(force,6,toe)
checks={'C001_polynomial':{'D0':toe-H,'D':(toe-H)*1.2,'M':moment(zm),'z_M':zm},'C002_legacy':{'uncapped':360*math.tan(math.radians(40))/1.1/198,'capped':360*.6/1.1/198},'C002_layered':{'uncapped':450.298347312*math.tan(math.radians(40))/1.1/248.092670254,'capped':450.298347312*.6/1.1/248.092670254},'A003_LPI':{'two_point_reference':.5*(10*(3-1.4)-.25*(3**2-1.4**2)),'single_reference':.5*(10*(5-4)-.25*(5**2-4**2))}}
assert abs(checks['C001_polynomial']['D']-18.9085960725)<1e-8
assert abs(checks['C001_polynomial']['M']-2399.83529217)<1e-7
assert abs(checks['A003_LPI']['two_point_reference']-7.12)<1e-12
assert abs(checks['A003_LPI']['single_reference']-3.875)<1e-12
links=[]; table=[]; counts={}
for path in sorted((root/'docs/audit').glob('2026-10-22-*.md')):
 text=path.read_text(); lines=text.splitlines(); expected=None
 for i,line in enumerate(lines,1):
  for label,target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)',line):
   if target.startswith(('http:','https:','#','mailto:')): continue
   dest=path.parent/target.split('#')[0]
   if not dest.exists(): links.append({'file':path.name,'line':i,'target':target})
  if line.startswith('|'):
   n=len(re.split(r'(?<!\\)\|',line))-2
   if expected is None: expected=n
   if n!=expected: table.append({'file':path.name,'line':i,'expected':expected,'actual':n})
  else: expected=None
 counts[path.name]={'lines':len(lines),'links':len(re.findall(r'\]\(',text)),'findings':re.findall(r'^### ((?:ENG-[ABC]|UX|FUN)-\d+)',text,re.M)}
result={'checks':checks,'broken_links':links,'table_anomalies':table,'document_counts':counts}
Path('/tmp/geotek-audit/final-review/checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
