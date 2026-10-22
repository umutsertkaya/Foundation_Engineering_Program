from common import *
from copy import deepcopy
profiles=json.loads((OUT/'seed-profiles.json').read_text());pid=profiles[0]['id'];wid=(OUT/'wall-url.txt').read_text().split('/s/')[1];spid=(OUT/'pile-console-url.txt').read_text().split('/s/')[1]
api('POST','/api/project/save')
base_profile=api('GET','/api/m/soil/profiles/'+pid).json();base_struct=api('GET','/api/structures/'+spid).json()
changed=deepcopy(base_profile);changed['layers'][0]['gamma']=18.1
api('PUT','/api/m/soil/profiles/'+pid,json=changed)
post_struct=api('GET','/api/structures/'+spid).json()
evidence={'structure_copy_unchanged_before_resync':post_struct['soil']==base_struct['soil'],'source_gamma_before':base_profile['layers'][0]['gamma'],'source_gamma_after':changed['layers'][0]['gamma'],'structure_gamma_before_resync':post_struct['soil']['profile']['layers'][0]['gamma']}
print('COPY',evidence)
api('GET','/api/structures');api('GET','/api/m/anchored_wall/state');api('GET','/api/m/liquefaction/result');api('GET','/api/m/report/sections')
api('POST','/api/m/report/docx',json={'sections':['structure:'+spid,'anchored_wall:analysis','liquefaction'],'language':'tr'})
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/sheet_pile/s/'+spid);shot(page,'40-source-edited-stale-pile')
 page.get_by_role('button',name='Kaynak profille eşitle',exact=True).click();page.wait_for_timeout(500);shot(page,'41-source-resynced-pile')
 after=api('GET','/api/structures/'+spid).json();evidence.update(structure_gamma_after_resync=after['soil']['profile']['layers'][0]['gamma'],result_after_resync=after['result'],result_hash_after_resync=after['result_hash'])
 goto(page,'/m/anchored_wall');shot(page,'42-anchor-source-stale');goto(page,'/m/liquefaction/results');shot(page,'43-liquefaction-source-stale');goto(page,'/m/report');shot(page,'44-report-stale-disabled');print(page.locator('body').inner_text())
 c.close()
# Restore the prior saved QA state; source mutation and resync above were intentionally not saved to disk.
api('POST','/api/project/open',json={'path':str(OUT/'library/qa-islev-geotek.gtk')})
reopened=api('GET','/api/structures/'+spid).json();evidence.update(restored_gamma=reopened['soil']['profile']['layers'][0]['gamma'],roundtrip_result_equal=reopened['result']==base_struct['result'],roundtrip_result_hash_equal=reopened['result_hash']==base_struct['result_hash'])
(OUT/'lifecycle.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2));print('LIFECYCLE',evidence)
# A browser-started real slow sizing job, followed by reopening the same saved project.
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/walls/s/'+wid);page.get_by_role('button',name='Öner/Kontrol',exact=True).click()
 with page.expect_response(lambda r:r.request.method=='POST' and r.url.endswith('/size')) as info:
  page.get_by_role('button',name='Boyut öner',exact=True).click()
 ref=info.value.json();jid=ref['job_id'];print('DISCARD JOB',jid);shot(page,'45-wall-size-before-project-reopen')
 api('POST','/api/project/open',json={'path':str(OUT/'library/qa-islev-geotek.gtk')})
 for i in range(100):
  j=client.get('/api/jobs/'+jid).json()
  if j['status'] in ['failed','cancelled','done']:break
  page.wait_for_timeout(300)
 api('GET','/api/jobs/'+jid);page.wait_for_timeout(600);shot(page,'46-wall-job-discarded-after-reopen');print(j)
 (OUT/'discard-job.json').write_text(json.dumps(j,ensure_ascii=False,indent=2));c.close()
