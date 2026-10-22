"""Run from repository root: PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/review.py"""
import json, math
from pathlib import Path
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq
from geotek.core.models import SoilLayer,SoilProfile,GroundwaterCondition,DesignParameters
from geotek.core.models.project import Project,ProjectMeta
from geotek.core.models.investigations import Borehole,SPTRecord,Investigations
from geotek.core.models.structures import StructureSoilModel,SheetPileStructure
from geotek.core.models.anchors import AnchorLevel,AnchoredWallAnalysisInputs,AnchorDesignInputs,TendonSpec
from geotek.core.models.walls import GravityGeometry,Backfill,FoundationSoil,WallLoads,WallSettings
from geotek.engine.stresses import vertical_stresses
from geotek.engine.insitu import spt
from geotek.engine.liquefaction.common import liquefaction_potential_index,lpi_category
from geotek.engine.liquefaction.youd2001 import crr75_spt
from geotek.engine.earth_pressure.coefficients import rankine_ka,rankine_kp
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.bearing import bearing_factors,bearing_capacity
from geotek.engine.stability import SoilBand,SlopeModel,bishop
from geotek.engine.sheet_pile import cantilever_sheet_pile
from geotek.engine.anchored_wall import run_analysis
from geotek.engine.anchors import design_anchor
from geotek.engine.walls.walls import analyze_gravity_wall
from geotek.engine.limit_state import verify_wall
from geotek.config.codes import FactorOverride
from geotek.services.parameters import refresh_profile
from geotek.services.structures import design_sheet_pile_structure
from geotek.io.tabular import import_cpt
OUT=Path(__file__).resolve().parent
checks=[]
def rec(name,actual,expected,atol=1e-7,note=''):
 a=np.asarray(actual,dtype=float);e=np.asarray(expected,dtype=float)
 checks.append(dict(name=name,actual=a.tolist(),expected=e.tolist(),pass_check=bool(np.allclose(a,e,rtol=1e-6,atol=atol,equal_nan=False)),note=note))
def prof(gwt=100,phi=30):
 return SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=gwt),layers=[SoilLayer(id='L',top=0,bottom=40,gamma=18,gamma_sat=20,design=DesignParameters(phi_eff=phi,c_eff=0))])
# Separate elementary nominal controls: block stress, SPT correction, CRR rational curve.
p=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=2),layers=[SoilLayer(id='L1',top=0,bottom=3,gamma=18,gamma_sat=20),SoilLayer(id='L2',top=3,bottom=12,gamma=19,gamma_sat=21)])
rec('A_nominal_stress_5m',vertical_stresses(p,5,2),[2*18+20+2*21,3*9.81,2*18+20+2*21-3*9.81])
rec('A_nominal_SPT_N60',spt.n60(20,72,1.05,1.2,.85),20*72/60*1.05*1.2*.85)
rec('A_nominal_CRR_Youd_N12',crr75_spt(12),1/22+12/135+50/165**2-.005)
# Independent exact LPI interval construction and groundwater intersection.
for z,gwt in [([1.5,2.5],1.4),([1,3],2.5),([5],4)]:
 z=np.asarray(z);n=len(z)
 if n==1: top,bot=np.array([0.]),z.copy()
 else:
  mids=(z[:-1]+z[1:])/2;top=np.r_[max(0,z[0]-(z[1]-z[0])/2),mids];bot=np.r_[mids,z[-1]+(z[-1]-z[-2])/2]
 if z[0]<=2: top[0]=0
 top=np.clip(np.maximum(top,gwt),0,20);bot=np.clip(bot,0,20);bot=np.maximum(bot,top)
 want=.5*np.sum(10*(bot-top)-.25*(bot**2-top**2))
 rec('A_LPI_GWT_'+str(z.tolist()),liquefaction_potential_index(z,[.5]*n,gwt),want)
# No possible soil assessment is distinguishable from nonliquefiable points at this layer.
rec('A_LPI_invalid_all_NaN',liquefaction_potential_index([1,2],[math.nan,math.nan],0),0,note='Arithmetic zero confirmed; interpretation requires statuses/completeness, not a formula-only assertion.')
# Known clay project produces sand-only parameter suggestions through the supported service.
cl=SoilLayer(id='cl',top=0,bottom=12,gamma=20,gamma_sat=21,uscs='CL',behaviour='undrained',source_ids=['BH'])
bh=Borehole(id='BH',spt=[SPTRecord(depth=2,n_field=20),SPTRecord(depth=5,n_field=12)])
pr=Project(meta=ProjectMeta(name='audit'),investigations=Investigations(boreholes=[bh]),soil_profiles=[SoilProfile(id='PC',gwt=GroundwaterCondition(depth_insitu=1),source_ids=['BH'],layers=[cl])])
r=refresh_profile(pr,'PC').layers[0]
clay_suggestions={k:dict(value=v.suggested.value,validity_ok=v.suggested.validity_ok,method=v.suggested.method_id) for k,v in r.selections.items() if k in ['phi_eff','E','su'] and v.suggested is not None}
f=OUT/'unknown.csv';f.write_text('depth(m),qc(kN/m2),fs(kPa)\n1,5000,50\n')
rec('A_import_unknown_qc_header',import_cpt(f,'I').qc,[5000],note='Direct import only; HTTP endpoint requires explicit qc_unit and overrides header.')
rec('A_import_explicit_kPa',import_cpt(f,'I',qc_unit='kPa').qc,[5000])
# Engineering education curve values, read from the TS expression, compared to engine definitions.
for M in (5.5,7.5,8.5):
 rec('A_edu_Idriss_'+str(M),min(1.8,6.9*math.exp(-M/4)-.058),10**2.24/M**2.56)
 rec('A_edu_AS_'+str(M),min(1.8,(M/7.5)**-2.56),(M/7.5)**-3.3)
# Rankine from Mohr circle principal-stress ratio; bearing from closed formula independently.
for phi in (0,20,30,40):
 ka=(1-math.sin(math.radians(phi)))/(1+math.sin(math.radians(phi)))
 rec('B_nominal_Rankine_'+str(phi),[rankine_ka(phi),rankine_kp(phi)],[ka,1/ka])
for m in ('meyerhof','hansen','vesic'):
 p=math.pi/6;nq=math.exp(math.pi*math.tan(p))*(1+math.sin(p))/(1-math.sin(p));nc=(nq-1)/math.tan(p)
 ng={'meyerhof':(nq-1)*math.tan(1.4*p),'hansen':1.5*(nq-1)*math.tan(p),'vesic':2*(nq+1)*math.tan(p)}[m]
 rec('B_nominal_bearing_'+m,bearing_capacity(method=m,B=2,D=0,phi=30,gamma=18,q=20,c=10).q_ult,10*nc+20*nq+18*ng)
rec('B_Nc_near_zero',bearing_factors(1e-16,'vesic')[0],math.pi+2,note='Pathological numeric boundary; exact zero branch works. Do not generalize to normal soils.')
# Vertical, smooth wall: explicit two-component force balance, no production plane-force helper.
w=trial_wedge(H=6,gamma=18,phi=30,beta=25,kh=.2)
def wedge(rho):
 r,b,p=map(math.radians,(rho,25,30));W=.5*18*6**2/(math.tan(r)-math.tan(b));return W*(.2+math.tan(r-p))
rec('B_wedge_force_balance_at_production_rho',w.force,wedge(w.rho),atol=1e-4)
wedge_asymptote={str(eps):wedge(25+eps) for eps in (1,.1,.01,.001,.0001,.00001)}
# Bishop: independently integrate soil mass and first moment on the returned geometric slices,
# solve nonlinear moment equilibrium by Brent; also run independent fixed [0,20] geometry nominal.
surface=[(-30,0),(0,0),(20,10),(50,10)];R=math.sqrt(250)
bishop_results={}
for kind,bands in [('uniform',[(10,20,10,20)]),('layered',[(10,10,10,20),(3,30,10,20)])]:
 model=SlopeModel(surface=surface,layers=[SoilBand(*b) for b in bands],kh=.2)
 a=bishop(model,5,15,R,n_slices=160);s=a.slices
 x=np.asarray(s['x']);lo=np.asarray(s['y_base']);hi=lo+np.asarray(s['height']);dx=np.asarray(s['width']);mass=np.zeros_like(x);first=np.zeros_like(x)
 for i,(top,g,c,p) in enumerate(bands):
  lower=bands[i+1][0] if i+1<len(bands) else -math.inf;upper=math.inf if i==0 else top
  aa=np.maximum(lo,lower);bb=np.minimum(hi,upper);dh=np.maximum(bb-aa,0)
  mass+=g*dh;first+=g*dh*(aa+bb)/2
 W=mass*dx;centroid=first/mass;sn=(x-5)/R;cs=np.sqrt(1-sn**2);tp=np.tan(np.radians(s['phi']));base=np.asarray(s['c'])*dx+W*tp
 drive=np.sum(W*sn+.2*W*(15-centroid)/R)
 residual=lambda F:F*drive-np.sum(base/(cs+sn*tp/F))
 fmin=max(1e-6,np.max(-sn*tp/cs)+1e-6);ref=brentq(residual,fmin,100)
 rec('B_Bishop_'+kind,a.fs,ref,atol=2e-6)
 bishop_results[kind]=dict(actual=a.fs,reference=ref,relative_error=(a.fs/ref-1),reference_equilibrium_residual=residual(ref))
# Nominal wall equilibrium from separate rectangle and triangle concrete blocks.
g=GravityGeometry(height=6,base_width=4,top_width=1);bf=Backfill(gamma=18,phi=30,delta=0);fd=FoundationSoil(phi=30,gamma=18)
a=analyze_gravity_wall(g,bf,fd);W=6*24+9*24;mr=6*24*3.5+9*24*2;E=.5*18*36/3
rec('C_nominal_wall_equilibrium',[a.sum_v,a.sum_h,a.m_resisting,a.m_overturning,a.checks['sliding'].value],[W,E,mr,E*2,W*math.tan(math.pi/6)/E])
over={f'TBDY-static.{block}.{key}':FactorOverride(value=1,note='Audit explicit unity choice') for block,keys in [('load',['G_unfav','G_fav','Q_unfav']),('material',['tan_phi','c_eff','su'])] for key in keys}
a=verify_wall(g,bf,FoundationSoil(phi=40,gamma=18),loads=WallLoads(surcharge=45),settings=WallSettings(design_code='tbdy2018',factor_overrides=over))[0]
rec('C_TBDY_base_friction_cap',a.checks['sliding'].value,360*.6/1.1/198)
tbdy=dict(actual_passed=a.passed,sliding=a.checks['sliding'].value,capped_sliding=360*.6/1.1/198,note='Cap read from repository code metadata; no original TBDY consulted by this reviewer.')
# Dry sheet pile: p(z)=6z above H and 6z-36(z-H) below H; equilibrium about toe.
H=5
def dry_p(z):return 6*z-36*max(0,z-H)
def force(t):return quad(dry_p,0,t,points=[H] if t>H else None)[0]
def mom(t):return quad(lambda z:dry_p(z)*(t-z),0,t,points=[H] if t>H else None)[0]
toe=brentq(mom,H+1,30);zm=brentq(force,H+1,toe);mm=abs(mom(zm))
a=cantilever_sheet_pile(prof(),H,passive_factor=1.5)
rec('C_nominal_pile_equilibrium',[a.D0,a.M_max],[toe-H,mm],atol=1e-3)
# Anchor force projection, grout bond cylinder and wedge intersection independently.
ai=AnchorDesignInputs(excavation_height=10,head_depth=2,inclination_deg=20,phi_deg=30,horizontal_load_per_m=100,spacing=2.5,safety_factor=2,ultimate_bond_stress=150,hole_diameter=.15,lock_off_ratio=.9,tendon=TendonSpec(type='strand'))
a=design_anchor(ai);alpha=math.radians(20);axial=250/math.cos(alpha);x=8/(math.tan(math.pi/3)+math.tan(alpha))
rec('C_nominal_anchor',[a.design_load,a.vertical_load_per_m,a.wedge_length,a.bond_length],[axial,100*math.tan(alpha),x/math.cos(alpha),axial*2/(math.pi*.15*150)])
# Multi-anchor pressure area is 0.65 Ka gamma H^2. Exact trapezoidal pressure.
supports=[1.5,4.5,7.5,10];pmax=390/(10-.5-2.5/3)
def pp(z):return pmax*min(z/1,1,(10-z)/(5/3))
def pint(z,power=0):return quad(lambda t:pp(t)*t**power,0,z,points=[v for v in [1,25/3] if v<z])[0]
multi={}
for method in ('hinge','tributary'):
 a=run_analysis(AnchoredWallAnalysisInputs(excavation_height=10,soil=StructureSoilModel(profile=prof()),levels=[AnchorLevel(depth=z,spacing=2.5,inclination_deg=15) for z in supports[:-1]],passive_factor=1.5,load_method=method))
 reactions=[lv.horizontal_load_per_m for lv in a.levels]+[a.base_reaction]
 expected_v=pint(2)-reactions[0];actual_v=float(np.interp(2,a.z,a.shear));moment_residual=pint(10,1)-sum(z*f for z,f in zip(supports,reactions))
 rec('C_multi_'+method+'_force',sum(reactions),390)
 rec('C_multi_'+method+'_shear_z2',actual_v,expected_v,atol=1e-3)
 multi[method]=dict(reactions=reactions,moment_residual=moment_residual,actual_v2=actual_v,expected_v2=expected_v,v_max=a.v_max,max_abs_returned_shear=max(abs(v) for v in a.shear))
# Static wet p(z): Ka[gamma_sat-gamma_w]z + gamma_w*z minus front dry Rankine passive.
pw=prof(0);pw.gwt=GroundwaterCondition(depth_insitu=0,depth_design=0,depth_seismic=100)
soil=StructureSoilModel(profile=pw,gwt_front=GroundwaterCondition(depth_insitu=5,depth_design=5,depth_seismic=100))
st=SheetPileStructure(id='S',retained_height=5,soil=soil,sds=.1);pr=Project(meta=ProjectMeta(name='Audit'),structures=[st])
a=design_sheet_pile_structure(pr,'S').result
b=design_sheet_pile_structure(pr.model_copy(update={'structures':[st.model_copy(update={'sds':None})]}),'S').result
# Below dredge front uses moist gamma18 to its water table at5 then saturated effective20-9.81.
def wet_p(z):return (20-9.81)*z/3+9.81*min(z,5)-2*(20-9.81)*max(0,z-5)
def wet_f(t):return quad(wet_p,0,t,points=[5] if t>5 else None)[0]
def wet_m(t):return quad(lambda z:wet_p(z)*(t-z),0,t,points=[5] if t>5 else None)[0]
wet_toe=brentq(wet_m,6,39);wet_zm=brentq(wet_f,6,wet_toe);wet_mm=abs(wet_m(wet_zm))
rec('C_wet_static_service_vs_independent',[b.D0,b.M_max],[wet_toe-5,wet_mm],atol=2e-3)
static_envelope=dict(static_D=b.D,static_M=b.M_max,sds_D=a.D,sds_M=a.M_max,independent_static_D=(wet_toe-5)*1.2,independent_static_M=wet_mm)
result=dict(checks=checks,summary=dict(total=len(checks),passed=sum(c['pass_check'] for c in checks),differing=sum(not c['pass_check'] for c in checks)),clay_suggestions=clay_suggestions,wedge=dict(production_force=w.force,rho=w.rho,unbounded_reference=wedge_asymptote),bishop=bishop_results,tbdy=tbdy,multi=multi,static_envelope=static_envelope)
(OUT/'results.json').write_text(json.dumps(result,indent=2))
print(json.dumps({**result,'checks':[c for c in checks if not c['pass_check']]},indent=2))
