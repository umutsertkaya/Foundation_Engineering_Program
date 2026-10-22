from common import *
with sync_playwright() as p:
 c,page=launch(p)
 for path,name in [('/m/sheet_pile/new','12-pile-create-empty'),('/m/anchored_wall','13-anchor-analysis-empty'),('/m/anchored_wall/anchor','14-anchor-design-empty'),('/m/liquefaction','15-liquefaction-empty')]:
  goto(page,path);print('\nURL',page.url);dump(page);shot(page,name)
 c.close()
