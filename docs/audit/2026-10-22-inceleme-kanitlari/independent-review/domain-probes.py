import json,math,warnings
from pathlib import Path
from geotek.engine.classification.robertson import sbtn_zone
from geotek.engine.correlations import evaluate
from geotek.engine.liquefaction.youd2001 import fines_correction_spt
from geotek.engine.liquefaction.boulanger_idriss2014 import c_sigma
from geotek.engine.liquefaction.common import liquefaction_potential_index
from geotek.engine.insitu.cpt import process_cpt
from geotek.engine.liquefaction.analysis import analyze_cpt
from geotek.core.models import SoilProfile,SoilLayer,GroundwaterCondition
from geotek.core.models.investigations import CPTSounding
r={}
for name,fn in [('sbtn_infinity',lambda:sbtn_zone(math.inf,1)),('Youd_FC_nan',lambda:fines_correction_spt(10,math.nan)),('BI_Csigma_nan',lambda:c_sigma(math.nan,'SPT')),('KM_phi_infinite_sigma',lambda:evaluate('KM1990_phi_SPT',dict(N60=20,sigma_v_eff=math.inf,Ic=2)).model_dump()),('LPI_unsorted',lambda:liquefaction_potential_index([5,2],[.5,.5]))]:
 try:
  with warnings.catch_warnings(record=True) as wr:
   a=fn();r[name]=dict(actual=a.tolist() if hasattr(a,'tolist') else a,warnings=[str(x.message) for x in wr])
 except Exception as e:r[name]=dict(error=type(e).__name__,message=str(e))
p=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=0),layers=[SoilLayer(id='L',top=0,bottom=10,gamma=20,gamma_sat=20)])
a=process_cpt(CPTSounding(id='I',depth=[1,2],qc=[1,1],fs=[.1,.1]),p);b=analyze_cpt(a,p,amax_g=.25,mw=7.5)
r['invalid_pipeline_summary']=dict(status=b.status.tolist(),summary=b.summary())
from geotek.core.models.walls import GravityGeometry
from geotek.engine.sheet_pile import cantilever_sheet_pile
from geotek.core.models import DesignParameters
pp=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=100),layers=[SoilLayer(id='L',top=0,bottom=40,gamma=18,design=DesignParameters(phi_eff=30,c_eff=0))])
c=cantilever_sheet_pile(pp,5,depth_increase=-2,allowable_stress_mpa=math.nan)
r['C_low_level_pile_domain']=dict(D0=c.D0,D=c.D,section_modulus_cm3=str(c.section_modulus_cm3))
r['C_gravity_geometry_nonfinite']=dict(height_accepted=GravityGeometry(height=math.inf,base_width=4,top_width=1).height,embedment_above_height_accepted=GravityGeometry(height=6,base_width=4,top_width=1,embedment=7).embedment)
r['C_education_soft_clay_area']=dict(p=29.92,H=8,independent_area=.875*29.92*8,drawn_area=.75*29.92*8)
def clean(x):
 if isinstance(x,float) and not math.isfinite(x):return str(x)
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items()}
 if isinstance(x,list):return [clean(v) for v in x]
 return x
r=clean(r)
( Path(__file__).resolve().parent/'domain-probes.json').write_text(json.dumps(r,indent=2,allow_nan=False));print(json.dumps(r,indent=2,allow_nan=False))
