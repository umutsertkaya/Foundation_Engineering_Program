from common import *
with sync_playwright() as p:
 c,page=launch(p)
 for anchored in [False,True]:
  goto(page,'/m/sheet_pile/new');page.get_by_label('Ad',exact=True).wait_for()
  fill(page,'Ad','QA '+('Ankrajlı' if anchored else 'Konsol')+' palplanş');fill(page,'Tutulan yükseklik H (m)',4);fill(page,'Sürşarj (kPa)',15);fill(page,'Arka zemin eğimi β (°)',10)
  if anchored:
   page.get_by_text('Tek ankrajlı',exact=True).click();fill(page,'Ankraj derinliği (m)',1)
  select(page,'Kaynak profil','QA Kum 0-40m')
  shot(page,'16-pile-'+str(anchored)+'-create-filled')
  page.get_by_role('button',name='Oluştur',exact=True).click();page.wait_for_url('**/s/*');page.wait_for_timeout(600)
  (OUT/('pile-anchored-url.txt' if anchored else 'pile-console-url.txt')).write_text(page.url)
  dump(page);shot(page,'17-pile-'+str(anchored)+'-detail')
  page.get_by_role('button',name='Tasarımı çalıştır',exact=True).click();page.wait_for_timeout(1800);dump(page);shot(page,'18-pile-'+str(anchored)+'-result')
 c.close()
