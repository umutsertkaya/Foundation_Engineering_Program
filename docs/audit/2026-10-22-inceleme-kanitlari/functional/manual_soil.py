from common import *
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/sheet_pile/new');page.get_by_text('Elle gir',exact=True).click();print(page.locator('input').evaluate_all('(xs)=>xs.map(x=>({aria:x.getAttribute("aria-label"),value:x.value,label:document.querySelector(`label[for="${x.id}"]`)?.textContent}))'))
 fill(page,'Ad','QA Elle girilen kuru palplanş');fill(page,'Tutulan yükseklik H (m)',4)
 fill(page,'Yeraltı suyu derinliği (m)',100)
 for label,val in [('Üst (m) 1',0),('Alt (m) 1',40),('γ (kN/m³) 1',18),("φ' (°) 1",30),("c' (kPa) 1",0)]:fill(page,label,val)
 shot(page,'51-pile-manual-soil-filled');page.get_by_role('button',name='Oluştur',exact=True).click();page.wait_for_url('**/s/*');page.wait_for_timeout(600);page.get_by_role('button',name='Tasarımı çalıştır',exact=True).click();page.wait_for_timeout(1100);shot(page,'52-pile-manual-soil-result');(OUT/'manual-pile-url.txt').write_text(page.url);print(page.locator('body').inner_text()[:1700]);c.close()
