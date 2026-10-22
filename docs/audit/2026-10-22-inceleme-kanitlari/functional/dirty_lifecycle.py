from common import *
# Restore TR + light using UI. Test unsaved local input versus the global Save button.
api('POST','/api/project/save')
with sync_playwright() as p:
 c,page=launch(p);page.goto((OUT/'pile-console-url.txt').read_text());page.wait_for_timeout(700)
 page.get_by_text('TR',exact=True).click();page.get_by_role('button',name='Tema değiştir',exact=True).click();page.wait_for_timeout(300)
 fill(page,'Sürşarj (kPa)',20)
 shot(page,'33-pile-local-dirty-before-save')
 print('run enabled?',page.get_by_role('button',name='Tasarımı çalıştır',exact=True).is_enabled())
 page.get_by_role('button',name='Kaydet',exact=True).first.click();page.wait_for_timeout(500)
 shot(page,'34-pile-global-save-local-draft')
 print('q UI',page.get_by_label('Sürşarj (kPa)',exact=True).input_value(),'dirty label',page.get_by_text('Kaydedilmemiş değişiklikler var; hesap için önce kaydedin.',exact=True).count())
 sid=page.url.split('/s/')[1].split('?')[0];print('q API',api('GET',f'/api/structures/{sid}').json()['surcharge'])
 page.reload();page.wait_for_timeout(700);print('q after reload',page.get_by_label('Sürşarj (kPa)',exact=True).input_value());shot(page,'35-pile-global-save-reload-lost')
 # Actual local Save after another edit; then result stale is expected and report must refuse.
 fill(page,'Sürşarj (kPa)',20);page.get_by_role('button',name='Kaydet',exact=True).last.click();page.wait_for_timeout(500);shot(page,'36-pile-saved-input-stale');print(page.locator('body').inner_text()[:2200])
 api('POST','/api/m/report/docx',json={'sections':['structure:'+sid],'language':'tr'})
 # Restore test fixture input through local Save and re-run via browser.
 fill(page,'Sürşarj (kPa)',15);page.get_by_role('button',name='Kaydet',exact=True).last.click();page.wait_for_timeout(300);page.get_by_role('button',name='Tasarımı çalıştır',exact=True).click();page.wait_for_timeout(1000)
 c.close()
