import json,math
from pathlib import Path
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.core.models.walls import GravityGeometry,Backfill,WallLoads
from geotek.engine.stability import SoilBand
rows=[]
for grid in (4,8,12):
 a,c=wall_global_stability(GravityGeometry(height=4,base_width=2.5,top_width=2.5),Backfill(gamma=18,phi=30),[SoilBand(0,18,30,20)],WallLoads(surcharge=10,kh=.1),grid=grid,seismic=True)
 rows.append(dict(grid=grid,fs=a.fs,heel_arc_height=a.yc-math.sqrt(a.radius**2-(2.5-a.xc)**2),circle=[a.xc,a.yc,a.radius]))
(Path(__file__).resolve().parent/'global-grid.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
