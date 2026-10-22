from common import *
with sync_playwright() as p:
 c,page=launch(p)
 for method in ['Boulanger','Youd']:
  goto(page,'/m/liquefaction');page.get_by_role('textbox',name='Yöntem',exact=True).click();print('methods',page.get_by_role('option').all_text_contents());page.get_by_role('option',name=method,exact=False).click()
  for label,val in [('En büyük yer ivmesi a_max (g)',.4),('Moment büyüklüğü Mw',7.5),('Hedef GS',1.1),('İnce dane katsayısı (c_FC)',0),('Ic sınır değeri',2.6),('Varsayılan FC (%) (isteğe bağlı)',5),('Deprem anı YASS derinliği (m) (isteğe bağlı)',3)]:fill(page,label,val)
  shot(page,'23-liquefaction-'+method+'-filled')
  page.get_by_role('button',name='Analizi çalıştır',exact=True).click();page.wait_for_timeout(1200);shot(page,'24-liquefaction-'+method+'-result');print(page.url);print(page.locator('body').inner_text()[:6000])
  print('buttons',page.get_by_role('button').all_text_contents())
 c.close()
