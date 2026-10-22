from common import *
from docx import Document
import zipfile,re,hashlib,csv
api('POST','/api/project/save')
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/report');page.get_by_role('button',name='Word raporu oluştur',exact=True).count();dump(page);shot(page,'27-report-tr-all-ready')
 print('build buttons',page.get_by_role('button').all_text_contents())
 c.close()
