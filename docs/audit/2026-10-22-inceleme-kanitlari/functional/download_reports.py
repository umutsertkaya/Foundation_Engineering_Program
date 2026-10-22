from common import *
from docx import Document
import zipfile,re,hashlib,csv,collections
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/report')
 for lang,name in [('tr','Raporu oluştur ve indir'),('en','Build and download report')]:
  if lang=='en':page.get_by_text('EN',exact=True).click();page.wait_for_timeout(700);print(page.locator('body').inner_text())
  with page.expect_download(timeout=60000) as info:
   page.get_by_role('button',name=name,exact=True).click()
  dl=info.value;dest=OUT/'docx'/f'qa-all-{lang}.docx';dl.save_as(str(dest));print('DOWNLOADED',lang,dl.suggested_filename,dest.stat().st_size)
  shot(page,'28-report-'+lang+'-downloaded')
 c.close()
