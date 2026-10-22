from common import *
wid=(OUT/'wall-url.txt').read_text().split('/s/')[1]
before=api('GET','/api/structures/'+wid).json()
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/walls/s/'+wid);page.get_by_role('button',name='Öner/Kontrol',exact=True).click()
 with page.expect_response(lambda r:r.request.method=='POST' and r.url.endswith('/size')) as info:
  page.get_by_role('button',name='Boyut öner',exact=True).click()
 jid=info.value.json()['job_id']
 page.get_by_role('button',name='Hesabı iptal et',exact=True).click();page.wait_for_timeout(2500);shot(page,'47-wall-cancelled-real-job')
 j=api('GET','/api/jobs/'+jid).json();after=api('GET','/api/structures/'+wid).json()
 evidence={'job':j,'prior_result_hash':before['result_hash'],'after_result_hash':after['result_hash'],'prior_result_preserved':before['result']==after['result']}
 (OUT/'cancel-job.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2));print('CANCEL',j['status'],j.get('error'),'preserved',evidence['prior_result_preserved']);c.close()
