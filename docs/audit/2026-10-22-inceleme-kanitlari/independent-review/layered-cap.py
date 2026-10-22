import json,math
from pathlib import Path
from geotek.core.models import SoilProfile,SoilLayer,GroundwaterCondition,DesignParameters
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.walls import GravityGeometry,WallLoads,WallSettings
from geotek.config.codes import FactorOverride
from geotek.engine.limit_state import verify_wall_layered
p=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=100),layers=[SoilLayer(id='L',top=0,bottom=40,gamma=18,gamma_sat=20,design=DesignParameters(phi_eff=40))])
soil=StructureSoilModel(profile=p,retained_fill=[SoilLayer(id='F',top=0,bottom=6,gamma=18,gamma_sat=20,design=DesignParameters(phi_eff=30))])
over={f'TBDY-static.{block}.{key}':FactorOverride(value=1,note='Independent review explicit unity choice') for block,keys in [('load',['G_unfav','G_fav','Q_unfav']),('material',['tan_phi','c_eff','su'])] for key in keys}
a=verify_wall_layered(GravityGeometry(height=6,base_width=4,top_width=1),soil,WallLoads(surcharge=94),WallSettings(design_code='tbdy2018',factor_overrides=over),seismic=False,approach=None)[0]
# Independent smooth geometry plus rough-wall active Coulomb force, phi30, delta20.
f=math.pi/6;d=math.pi/9;K=math.cos(f)**2/(math.cos(d)*(1+math.sqrt(math.sin(f+d)*math.sin(f)/math.cos(d)))**2)
h=K*math.cos(d)*(18*36/2+94*6);v=360+h*math.tan(d)
r=dict(actual=dict(V=a.sum_v,H=a.sum_h,sliding=a.checks['sliding'].value,passed=a.passed),independent=dict(V=v,H=h,sliding_capped=v*.6/1.1/h),source_basis='Repository metadata cap and knowledge; original TBDY not consulted by independent reviewer')
(Path(__file__).resolve().parent/'layered-cap.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
