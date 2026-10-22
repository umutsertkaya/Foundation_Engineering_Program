from common import *
soil={'profile':{'id':'QA-envelope','layers':[{'id':'S','top':0,'bottom':40,'gamma':18,'gamma_sat':20,'behaviour':'drained','design':{'phi_eff':30}}],'gwt':{'depth_insitu':0,'depth_design':0,'depth_seismic':100}},'gwt_front':{'depth_insitu':5,'depth_design':5,'depth_seismic':100},'source_profile_id':None}
r=api('POST','/api/structures',json={'kind':'sheet_pile','name':'QA C ASD static-envelope regression','retained_height':5,'sds':.1,'soil':soil});r.raise_for_status();sid=r.json()['id'];(OUT/'envelope-id.txt').write_text(sid)
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/sheet_pile/s/'+sid);page.get_by_role('button',name='Gelişmiş girdiler',exact=True).click();page.wait_for_timeout(200);shot(page,'37-envelope-seismic-inputs-ui')
 page.get_by_role('button',name='Tasarımı çalıştır',exact=True).click();page.wait_for_timeout(1600);shot(page,'38-envelope-seismic-result-ui');d=api('GET','/api/structures/'+sid).json();(OUT/'envelope-seismic.json').write_text(json.dumps(d,ensure_ascii=False,indent=2));print('SEISMIC',d['result']['D'],d['result']['M_max'])
 fill(page,'S_DS (isteğe bağlı)','');page.get_by_role('button',name='Kaydet',exact=True).last.click();page.wait_for_timeout(400);page.get_by_role('button',name='Tasarımı çalıştır',exact=True).click();page.wait_for_timeout(1600);shot(page,'39-envelope-static-result-ui');d=api('GET','/api/structures/'+sid).json();(OUT/'envelope-static.json').write_text(json.dumps(d,ensure_ascii=False,indent=2));print('STATIC',d['result']['D'],d['result']['M_max'])
 c.close()
