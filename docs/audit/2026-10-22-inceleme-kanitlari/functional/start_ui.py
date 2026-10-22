from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/geotek-audit/functional')
with sync_playwright() as p:
 c=p.chromium.launch_persistent_context(str(OUT/'browser'),executable_path='/usr/bin/chromium',headless=True,viewport={'width':1440,'height':900},args=['--no-sandbox'],accept_downloads=True)
 page=c.new_page();page.goto('http://127.0.0.1:8772');page.wait_for_timeout(500)
 page.get_by_role('button',name='Yeni proje',exact=True).click();print(page.locator('body').inner_text())
 print(page.locator('input').evaluate_all('(els)=>els.map(x=>({id:x.id,placeholder:x.placeholder,value:x.value}))'))
 page.get_by_label('Proje adı').fill('QA İŞLEV GeoTek')
 for label,value in [('Proje no','QA-FUN'),('Mühendis','QA denetimi — tasarım değildir')]:
  loc=page.get_by_label(label,exact=True)
  if loc.count():loc.fill(value)
 print(page.locator('button').all_text_contents())
 page.get_by_role('button',name='Oluştur',exact=True).click();page.wait_for_timeout(900)
 print(page.url);print(page.locator('body').inner_text())
 page.screenshot(path=str(OUT/'screenshots/02-project-created-ui.png'),full_page=True)
 c.close()
