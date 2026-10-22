import json,time,traceback
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/geotek-audit/functional');BASE='http://127.0.0.1:8772'
client=httpx.Client(base_url=BASE,timeout=90)
def api(method,path,**kw):
 r=client.request(method,path,**kw)
 rec={'time':time.time(),'method':method,'url':path,'request':kw.get('json',str(kw.get('data',''))),'status':r.status_code}
 try:rec['response']=r.json()
 except:rec['response']={'bytes':len(r.content),'type':r.headers.get('content-type')}
 with (OUT/'api.jsonl').open('a') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
 print(method,path,r.status_code,r.text[:160] if 'json' in r.headers.get('content-type','') else len(r.content),flush=True)
 return r

def launch(p, width=1440,height=900):
 c=p.chromium.launch_persistent_context(str(OUT/'browser'),executable_path='/usr/bin/chromium',headless=True,viewport={'width':width,'height':height},args=['--no-sandbox'],accept_downloads=True)
 page=c.new_page();page.set_default_timeout(6000)
 def response(r):
  if '/api/' not in r.url:return
  rec={'time':time.time(),'source':'browser','url':r.url,'method':r.request.method,'status':r.status,'request':r.request.post_data}
  try:rec['response']=r.json()
  except:rec['response']={'type':r.headers.get('content-type')}
  with (OUT/'browser-network.jsonl').open('a') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
 page.on('response',response)
 page.on('pageerror',lambda e:(OUT/'page-errors.txt').open('a').write(str(e)+'\n'))
 return c,page

def goto(page,path):page.goto(BASE+path);page.wait_for_timeout(600)
def shot(page,name):
 page.screenshot(path=str(OUT/'screenshots'/f'{name}.png'),full_page=True)
 (OUT/f'{name}.txt').write_text(page.locator('body').inner_text())
 print('SHOT',name,page.url,flush=True)
def dump(page):
 print(page.locator('body').inner_text(),flush=True)
 print('INPUTS',page.locator('input').evaluate_all('(xs)=>xs.map(x=>({id:x.id,value:x.value,type:x.type,placeholder:x.placeholder,label:document.querySelector(`label[for="${x.id}"]`)?.textContent}))'),flush=True)
 print('BUTTONS',page.get_by_role('button').all_text_contents(),flush=True)
def fill(page,label,value):
 x=page.get_by_label(label,exact=True);x.fill(str(value));x.press('Tab')
def jobwait(jid):
 for i in range(500):
  j=api('GET',f'/api/jobs/{jid}').json()
  if j['status'] in ['done','failed','cancelled']:return j
  time.sleep(.08)
 return j
def select(page,label,option,exact=False):
 page.get_by_role('textbox',name=label,exact=True).click()
 page.get_by_role('option',name=option,exact=exact).click()
