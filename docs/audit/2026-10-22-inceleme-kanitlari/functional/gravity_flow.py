from common import *
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/walls/new');page.get_by_text('Ağırlık duvarı',exact=True).click();fill(page,'Duvar adı','QA Ağırlık sulu 5m');select(page,'Zemin profili','QA Sulu iki tabaka');page.get_by_role('button',name='Oluştur',exact=True).click();page.wait_for_url('**/s/*');page.wait_for_timeout(500);(OUT/'gravity-url.txt').write_text(page.url);shot(page,'25-gravity-wet-geometry')
 page.get_by_role('button',name='Yükler/deprem',exact=True).click();page.get_by_text('İleri',exact=True).click();fill(page,'S_DS',.5);fill(page,'Sürşarj q',15)
 page.get_by_role('button',name='Öner/Kontrol',exact=True).click();page.get_by_role('button',name='Kontrol et',exact=True).click();page.wait_for_timeout(1200);shot(page,'26-gravity-wet-result');print(page.locator('body').inner_text()[-3000:])
 page.get_by_role('button',name='Kaydet',exact=True).click();c.close()
# Remove first partially exercised duplicate created during locator development. No project data owned by user.
api('DELETE','/api/structures/f0821654-4d91-4b1f-8b57-83906483ec13')
structures=api('GET','/api/structures').json();print(structures)
for s in structures:
 if s['kind']=='retaining_wall':
  d=api('GET',f'/api/structures/{s["id"]}').json();(OUT/f'{s["id"]}.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
print(api('GET','/api/m/report/sections').text)
