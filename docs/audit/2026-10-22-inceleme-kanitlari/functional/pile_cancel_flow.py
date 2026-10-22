from common import *
wid=(OUT/'wall-url.txt').read_text().split('/s/')[1];pid=(OUT/'pile-console-url.txt').read_text().split('/s/')[1]
occupiers=[]
try:
 for _ in range(2):occupiers.append(api('POST','/api/m/walls/structures/'+wid+'/size').json()['job_id'])
 with sync_playwright() as p:
  c,page=launch(p);goto(page,'/m/sheet_pile/s/'+pid)
  with page.expect_response(lambda r:r.request.method=='POST' and r.url.endswith('/design')) as info:page.get_by_role('button',name='Tasarımı çalıştır',exact=True).click()
  jid=info.value.json()['job_id'];print('PILE JOB',jid)
  page.get_by_role('button',name='İptal et',exact=True).click();page.wait_for_timeout(500);shot(page,'48-pile-queued-job-cancelled');j=api('GET','/api/jobs/'+jid).json();(OUT/'pile-cancel-job.json').write_text(json.dumps(j,ensure_ascii=False,indent=2));print(j);c.close()
finally:
 for jid in occupiers:api('DELETE','/api/jobs/'+jid)
