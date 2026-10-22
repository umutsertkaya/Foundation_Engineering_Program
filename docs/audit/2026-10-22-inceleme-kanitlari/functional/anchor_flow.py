from common import *
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/anchored_wall');page.get_by_label('Kazı yüksekliği H (m)',exact=True).wait_for()
 fill(page,'Kazı yüksekliği H (m)',10);fill(page,'Pasif direnç emniyet katsayısı',1.5)
 for _ in range(2):page.get_by_role('button',name='Ankraj seviyesi ekle',exact=True).click()
 for i,d in enumerate([1.5,4.5,7.5],1):
  fill(page,f'Derinlik (m) {i}',d);fill(page,f'Aralık (m) {i}',2.5)
 select(page,'Zemin profili','QA Kum 0-40m');page.get_by_role('button',name='Zemini yükle',exact=True).click();page.wait_for_timeout(300)
 shot(page,'19-anchor-multilevel-filled')
 page.get_by_role('button',name='Analizi çalıştır',exact=True).click();page.wait_for_timeout(1000);shot(page,'20-anchor-multilevel-result');print(page.locator('body').inner_text()[-6000:])
 goto(page,'/m/anchored_wall/anchor')
 for label,val in [('Kazı yüksekliği H (m)',10),('Ankraj başı derinliği (m)',6.25),('Zemin içsel sürtünme açısı φ′ (°)',33),('Yatay ankraj yükü T_h (kN/m)',172),('Ankraj aralığı s (m)',2.5),('Güvenlik sayısı FS (kök)',2),('Nihai yük aktarımı q_u (kN/m)',100),('Kilitleme yükü oranı (tasarım yüküne)',1),('Kök değerinin kaynağı','QA: tests/api/test_anchored_wall_api.py BODY')]:fill(page,label,val)
 shot(page,'21-anchor-design-filled')
 page.get_by_role('button',name='Ankrajı tasarla',exact=True).click();page.wait_for_timeout(800);shot(page,'22-anchor-design-result');print(page.locator('body').inner_text()[-5000:])
 page.get_by_role('button',name='Kaydet',exact=True).click();c.close()
