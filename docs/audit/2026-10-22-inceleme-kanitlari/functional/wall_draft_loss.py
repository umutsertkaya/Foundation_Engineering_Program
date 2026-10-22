from common import *
wid=(OUT/'wall-url.txt').read_text().split('/s/')[1]
api('POST','/api/project/save')
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/walls/s/'+wid);page.get_by_role('button',name='Yükler/deprem',exact=True).click();before=page.get_by_label('Sürşarj q',exact=True).input_value();fill(page,'Sürşarj q',20)
 page.get_by_role('button',name='Kaydet',exact=True).click();page.wait_for_timeout(400);shot(page,'49-wall-global-save-local-draft');server=api('GET','/api/structures/'+wid).json()['inputs']['surcharge'];page.reload();page.wait_for_timeout(700);page.get_by_role('button',name='Yükler/deprem',exact=True).click();after=page.get_by_label('Sürşarj q',exact=True).input_value();shot(page,'50-wall-global-save-reload-lost')
 (OUT/'wall-draft-loss.json').write_text(json.dumps({'before':before,'typed':20,'server_after_global_save':server,'ui_after_reload':after},indent=2));print('DRAFT',before,20,server,after);c.close()
