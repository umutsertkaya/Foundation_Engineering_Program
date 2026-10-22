"""Additional independent checks. Run with PYTHONPATH=. from repository root."""
import json,math
from pathlib import Path
import numpy as np
from scipy.optimize import brentq,minimize_scalar
from geotek.core.models import SoilLayer,SoilProfile,GroundwaterCondition,DesignParameters
from geotek.core.models.investigations import CPTSounding,LabRecord,Borehole,SPTRecord
from geotek.core.models.walls import GravityGeometry,Backfill,WallLoads
from geotek.engine.correlations import evaluate
from geotek.engine.insitu import cpt,spt
from geotek.engine.classification.uscs import classify_lab_record,fines_type
from geotek.engine.liquefaction.analysis import analyze_cpt
from geotek.engine.liquefaction.common import lpi_category,liquefaction_potential_index
from geotek.engine.earth_pressure.distribution import lateral_pressure,resultant
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.stability import SoilBand
from geotek.io.tabular import import_cpt
OUT=Path(__file__).resolve().parent
r={}
# Passive projection from wall basis n=(cos theta,sin theta), t=(-sin theta,cos theta).
# Passive P has direction cos(delta)n-sin(delta)t -> x=cos(delta-theta).
passive={}
for theta in (-10,10):
 t,d,p=map(math.radians,(theta,10,35));H=6;gam=18
 def force(rho):
  xa=-H*math.tan(t);xg=H/math.tan(rho);W=.5*gam*H*(xg-xa)
  return W*math.sin(rho+p)/math.cos(rho+p-t+d)
 lo=1e-6;hi=math.pi/2-p+t-d-1e-6
 opt=minimize_scalar(force,bounds=(lo,hi),method='bounded',options={'xatol':1e-13})
 expected=opt.fun*math.cos(d-t)
 profile=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=100),layers=[SoilLayer(id='L',top=0,bottom=40,gamma=18,design=DesignParameters(phi_eff=35,c_eff=0))])
 actual=lateral_pressure(profile,6,state='passive',method='coulomb',theta=theta,delta=10).force
 passive[str(theta)]=dict(actual=actual,independent_horizontal=expected,relative_error=actual/expected-1,critical_rho=math.degrees(opt.x))
r['B_passive_projection']=passive
# Wall global selected circle. Verify circle/each straight segment intersections analytically.
a,ch=wall_global_stability(GravityGeometry(height=4,base_width=2.5,top_width=2.5),Backfill(gamma=18,phi=30),[SoilBand(0,18,30,20)],WallLoads(surcharge=10,kh=.1),grid=4,seismic=True)
surface=[(-16,0),(-1e-6,0),(0,0),(2.5,0),(2.500001,4),(18.5,4)]
roots=[]
for (x1,y1),(x2,y2) in zip(surface,surface[1:]):
 m=(y2-y1)/(x2-x1);c=y1-m*x1
 aa=1+m*m;bb=2*(m*(c-a.yc)-a.xc);cc=a.xc*a.xc+(c-a.yc)**2-a.radius*a.radius
 disc=bb*bb-4*aa*cc
 if disc<0:continue
 # Stable polynomial roots; large-slope segment otherwise loses the tiny crossing.
 q=-.5*(bb+math.copysign(math.sqrt(disc),bb));rr=[q/aa,cc/q]
 for x in rr:
  if x1-1e-9<=x<=x2+1e-9 and m*x+c<=a.yc+1e-9:roots.append(x)
arc=lambda x:a.yc-math.sqrt(a.radius*a.radius-(x-a.xc)**2)
r['B_wall_global_gap']=dict(circle=[a.xc,a.yc,a.radius],reported_interval=[a.x_exit,a.x_entry],analytical_crossings=sorted(roots),arc_above_base_at_2_49=arc(2.49),arc_above_base_at_2_5=arc(2.5),fs=a.fs,required=ch.required,grid=4)
# Registry validity compared with physical sign, independent equations (not source validation).
rr={}
for cid,inp,expected in [('CPT_su_Nkt',dict(qt=50,sigma_v=100,Ic=3),(50-100)/14),('CPTu_su_Ndu',dict(u2=50,u0=100,Ic=3),(50-100)/7),('R2009_E_CPT',dict(qt=50,sigma_v=100,Ic=2),.015*10**(2*.55+1.68)*(50-100)),('Mayne_sigp_CPT',dict(qt=50,sigma_v=100,Ic=3),.33*(50-100)),('Skempton1986_Dr_SPT',dict(N1_60=120),100*math.sqrt(120/60))]:
 out=evaluate(cid,inp);rr[cid]=dict(actual=out.value,independent_arithmetic=expected,validity_ok=out.validity_ok,warnings=out.warnings)
r['A_registry_physical_domain']=rr
# Partial missing u2 is converted to zero and no per-row mask survives the model.
f=OUT/'partial.csv';f.write_text('depth(m),qc(MPa),fs(kPa),u2(kPa)\n1,5,50,100\n2,4,40,\n')
a=import_cpt(f,'U')
r['A_partial_u2']=dict(u2=a.u2,available_model_fields=list(type(a).model_fields),qt_independent=[5000+100*.2,4000])
# Invalid joint lab percentages accepted by real Pydantic model.
a=LabRecord(depth=1,gravel=90,FC=20,LL=30,PI=10)
r['A_lab_grain_sum']=dict(accepted=a.model_dump(),classification=classify_lab_record(a).symbol,derived_sand=100-90-20)
bh=Borehole(id='B',borehole_diameter_mm=1000,spt=[SPTRecord(depth=2,n_field=20)])
r['A_oversize_borehole']=dict(accepted_diameter=bh.borehole_diameter_mm,cb=spt.borehole_diameter_factor(bh.borehole_diameter_mm),note='No source consultation by independent reviewer; range beyond code docstring is unsupported.')
# Positive, near-surface CPT case with default 50 iterations. Independent scalar n root.
p=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=0),layers=[SoilLayer(id='L',top=0,bottom=1,gamma=20,gamma_sat=20)])
a=cpt.process_cpt(CPTSounding(id='N',depth=[.01,.02,.03],qc=[10]*3,fs=[.1]*3),p);b=analyze_cpt(a,p,amax_g=.25,mw=7.5)
Pa=101.325;sv=.2;se=.2-.01*9.81;Fr=.1/(10-sv)*100
ic=lambda n:math.hypot(3.47-math.log10((10-sv)/Pa*(Pa/se)**n),math.log10(Fr)+1.22)
root=brentq(lambda n:n-max(0,min(1,.381*ic(n)+.05*se/Pa-.15)),0,1)
r['A_CPT_unconverged']=dict(Ic=a.Ic.tolist(),n=a.n.tolist(),converged=a.converged.tolist(),status=b.status.tolist(),FS=[float(x) if np.isfinite(x) else None for x in b.fs],warnings=b.warnings,independent_first_Ic=ic(root),independent_first_n=root)
r['A_invalid_LPI']=dict(lpi=liquefaction_potential_index([1,2],[math.nan,math.nan],0),category=lpi_category(liquefaction_potential_index([1,2],[math.nan,math.nan],0)))
# Education source coordinates, finite A-line geometry and changed interval quiz arithmetic.
r['A_education']=dict(quiz_first_interval=.1*(10*3-.25*3**2),quiz_text_old=1.8,CLML_point=dict(LL=29,PI=4.5,a_line=.73*9,classification=fines_type(29,4.5)),D10_guide=dict(diameter=.075,curve_percent=8,labeled_percent=10),FC35_Ncs30_threshold=(30-5)/1.2,plotted_boundary=30)
# Battered wall and inclined ground: derive wedge area and vertical surcharge separately.
active_q={}
for theta in (-10,10):
 t,d,p,b=map(math.radians,(theta,10,35,15));H=6;gamma=18;qload=20
 def active_force(rho):
  xa=-H*math.tan(t)
  xg=H*(1+math.tan(t)*math.tan(b))/(math.tan(rho)-math.tan(b))
  area=.5*H*(xg-xa)*(1+math.tan(t)*math.tan(b))
  W=gamma*area+qload*(xg-xa)
  return W*math.sin(rho-p)/math.cos(rho-p-t-d)
 opt=minimize_scalar(lambda rho:-active_force(rho),bounds=(p+1e-6,math.pi/2+t-1e-6),method='bounded',options={'xatol':1e-13})
 expected=-opt.fun*math.cos(t+d)
 profile=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=100),layers=[SoilLayer(id='L',top=0,bottom=40,gamma=18,design=DesignParameters(phi_eff=35,c_eff=0))])
 actual=lateral_pressure(profile,6,method='coulomb',theta=theta,beta=15,delta=10,surcharge=20).force
 active_q[str(theta)]=dict(actual=actual,independent_horizontal=expected,relative_error=actual/expected-1)
r['B_battered_surcharge']=active_q
(OUT/'supplement.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
