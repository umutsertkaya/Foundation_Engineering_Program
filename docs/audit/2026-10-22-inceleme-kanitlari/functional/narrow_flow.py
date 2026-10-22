from common import *
with sync_playwright() as p:
 c,page=launch(p,800,900);goto(page,'/m/report')
 # Language is persisted from the actual EN report switch. Theme changes by visible UI control.
 page.get_by_role('button',name='Toggle theme',exact=True).click();page.wait_for_timeout(300)
 metrics=[]
 for path,name in [((OUT/'wall-url.txt').read_text().replace(BASE,''),'29-wall-en-dark-narrow'),((OUT/'pile-anchored-url.txt').read_text().replace(BASE,''),'30-pile-en-dark-narrow'),('/m/anchored_wall','31-anchor-en-dark-narrow'),('/m/liquefaction/results','32-liq-cpt-en-dark-narrow')]:
  goto(page,path);page.wait_for_timeout(700)
  if 'walls/' in path:page.get_by_role('button',name='Result',exact=True).click()
  if path.endswith('results'):select(page,'Select sounding','QA-CPT',exact=True)
  shot(page,name);page.screenshot(path=str(OUT/'screenshots'/f'{name}-viewport.png'))
  metrics.append({'url':page.url,'width':800,'metrics':page.evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth})')})
 print(metrics);(OUT/'narrow-metrics.json').write_text(json.dumps(metrics,indent=2));c.close()
