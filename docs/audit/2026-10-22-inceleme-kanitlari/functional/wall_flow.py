from common import *
with sync_playwright() as p:
 c,page=launch(p);page.goto((OUT/'wall-url.txt').read_text());page.wait_for_timeout(600)
 page.get_by_role('button',name='Zemin',exact=True).click();dump(page);shot(page,'05-wall-soil-copy')
 page.get_by_role('button',name='Yükler/deprem',exact=True).click();dump(page);shot(page,'06-wall-loads-missing-seismic')
 page.get_by_role('button',name='Öner/Kontrol',exact=True).click();page.get_by_role('button',name='Kontrol et',exact=True).click();page.wait_for_timeout(700);dump(page);shot(page,'07-wall-required-coefficients')
 c.close()
