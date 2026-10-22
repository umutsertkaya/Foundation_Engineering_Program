from common import *
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/walls/new');fill(page,'Duvar adı','QA Konsol 5m');page.get_by_role('button',name='Oluştur',exact=True).click();page.wait_for_timeout(800)
 (OUT/'wall-url.txt').write_text(page.url);dump(page);shot(page,'04-wall-wizard-geometry')
 print('steps',page.get_by_role('tab').all_text_contents())
 page.get_by_role('tab',name='4').count()
 print(page.locator('[role="tab"], [aria-label]').evaluate_all('(xs)=>xs.map(x=>({role:x.role,aria:x.getAttribute("aria-label"),text:x.textContent?.slice(0,100)}))'))
 c.close()
