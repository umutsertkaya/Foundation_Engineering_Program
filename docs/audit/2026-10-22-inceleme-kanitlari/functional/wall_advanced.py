from common import *
with sync_playwright() as p:
 c,page=launch(p);page.goto((OUT/'wall-url.txt').read_text());page.wait_for_timeout(600)
 page.get_by_role('button',name='Yükler/deprem',exact=True).click()
 page.get_by_text('İleri',exact=True).click();fill(page,'S_DS',.5);fill(page,'Sürşarj q',15)
 page.get_by_role('textbox',name='Kod',exact=True).click();print('codes',page.get_by_role('option').all_text_contents());page.get_by_role('option',name='TBDY',exact=False).click()
 page.get_by_role('button',name='Öner/Kontrol',exact=True).click();page.get_by_role('button',name='Kontrol et',exact=True).click();page.wait_for_timeout(500);dump(page);shot(page,'08-wall-missing-factor-block')
 print('dialogs',page.get_by_role('dialog').count())
 if page.get_by_role('dialog').count():
  print('dialogbuttons',page.get_by_role('dialog').get_by_role('button').all_text_contents());page.keyboard.press('Escape')
 page.get_by_role('button',name='Yükler/deprem',exact=True).click();page.get_by_role('textbox',name='Kod',exact=True).click();page.get_by_role('option',name='ASD — Global güvenlik sayısı',exact=True).click()
 page.get_by_role('button',name='Tip/geometri',exact=True).click();fill(page,'Eğim β',10);page.get_by_text('Kayma dişi',exact=True).click();dump(page)
 page.get_by_role('button',name='Öner/Kontrol',exact=True).click();page.get_by_role('button',name='Kontrol et',exact=True).click();page.wait_for_timeout(1800);dump(page);shot(page,'09-wall-advanced-check')
 page.get_by_role('button',name='Sonuç',exact=True).click();page.wait_for_timeout(200);shot(page,'10-wall-advanced-result');print(page.locator('body').inner_text()[-2500:])
 page.get_by_role('button',name='Öner/Kontrol',exact=True).click();page.get_by_role('button',name='Boyut öner',exact=True).click();page.wait_for_timeout(1200);shot(page,'11-wall-size-job');dump(page)
 page.get_by_role('button',name='Kaydet',exact=True).click();c.close()
