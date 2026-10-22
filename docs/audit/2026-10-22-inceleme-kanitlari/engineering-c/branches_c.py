"""Additional structural branches; run with PYTHONPATH=. from checkout root."""
import json,math,pathlib
import numpy as np
from scipy.optimize import brentq
from geotek.core.models import SoilProfile,SoilLayer,GroundwaterCondition,DesignParameters
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.anchors import AnchorDesignInputs,AnchorLevel,AnchoredWallAnalysisInputs,TendonSpec,WallSection
from geotek.core.models.walls import GravityGeometry,Backfill,FoundationSoil,WallLoads,WallSettings,ShearKey
from geotek.engine.anchors import design_anchor
from geotek.engine.anchored_wall import run_analysis,apparent_envelope,basal_heave
from geotek.engine.walls.walls import analyze_gravity_wall
from geotek.engine.sheet_pile import anchored_sheet_pile,cantilever_sheet_pile
from geotek.engine.limit_state import verify_wall,verify_wall_layered
from geotek.config.codes import FactorOverride

OUT=pathlib.Path(__file__).resolve().parent
data={}
def clean(x):
    if isinstance(x,np.generic): return clean(x.item())
    if hasattr(x,'model_dump'):return clean(x.model_dump())
    if isinstance(x,dict):return {k:clean(v) for k,v in x.items()}
    if isinstance(x,(list,tuple)):return [clean(v) for v in x]
    return x
def attempt(f):
    try:return dict(accepted=True,actual=clean(f()))
    except Exception as e:return dict(accepted=False,error=type(e).__name__,message=str(e)[:400])
def profile(su=None,phi=30,bottom=40,gwt=100):
    return SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=gwt),layers=[SoilLayer(id='S',top=0,bottom=bottom,gamma=17 if su else 18,gamma_sat=20,behaviour='undrained' if su is not None else 'drained',design=DesignParameters(phi_eff=phi,su=su))])
soil=StructureSoilModel(profile=profile())
base=dict(excavation_height=10,head_depth=2,inclination_deg=15,phi_deg=30,axial_load=445,
          safety_factor=2,ultimate_transfer_load=100,lock_off_ratio=.9,tendon=TendonSpec(type='strand'))
anchor={}
for name,kw in [('axial_strand',{}),('automatic_bar',dict(tendon=TendonSpec(type='bar'))),('custom_bar',dict(tendon=TendonSpec(type='bar',custom_smts_kn=1000,custom_area_mm2=900))),('rock_bar',dict(ground='rock',tendon=TendonSpec(type='bar'),ultimate_transfer_load=730)),('missing_required',dict(safety_factor=None,lock_off_ratio=None,ultimate_transfer_load=None)),('min_relax',dict(min_bond_length=1,min_free_length=1,test_factor=1.1))]:
    anchor[name]=attempt(lambda kw=kw:design_anchor(AnchorDesignInputs(**{**base,**kw})))
data['anchor_branches']=anchor
data['anchor_axial_expected']=dict(T=445,horizontal=445*math.cos(math.radians(15)),vertical=445*math.sin(math.radians(15)),test=445*1.33,lock=445*.9,
                                  bond=445*2/100,strand_count=3,automatic_bar_smts=835)

clay={}
for su in (80,34,33.999,30,136/5.14,15):
    p=profile(su)
    clay[str(su)]=attempt(lambda p=p,su=su:apparent_envelope(p,8,drainage='undrained',surcharge=0,stiff_coefficient=.3,anchors=[2,5],su_b=su,henkel_depth=4,service='temporary'))
data['clay_envelopes']=clay
data['clay_expected']=dict(stiff_p=.3*17*8,stiff_total=.3*17*8*(8-2/3-3/3),soft_p=.22*136,soft_total=.22*136*7,
    henkel15_ka=1-4*15/136+2*math.sqrt(2)*4/8*(1-5.14*15/136),
    henkel15_total=(1-4*15/136+2*math.sqrt(2)*4/8*(1-5.14*15/136))*136*7)
data['basal']=dict(
    shallow=attempt(lambda:basal_heave(profile(20),6,width=10,length=None,stiff_depth=None,surcharge=0,service='temporary',warns=[])),
    narrow=attempt(lambda:basal_heave(profile(30),10,width=2,length=None,stiff_depth=None,surcharge=0,service='temporary',warns=[])),
    stiff_layer=attempt(lambda:basal_heave(profile(60),8,width=10,length=20,stiff_depth=2,surcharge=0,service='permanent',warns=[])),
    short_profile=attempt(lambda:basal_heave(profile(20,bottom=8),6,width=10,length=None,stiff_depth=None,surcharge=0,service='temporary',warns=[])))

# Soldier pile ratio and SI section conversion, independent cubic equilibrium for toe.
lv=[AnchorLevel(depth=z,spacing=2.5,inclination_deg=20) for z in (1.5,4.5,7.5)]
soldier=run_analysis(AnchoredWallAnalysisInputs(excavation_height=10,soil=soil,levels=lv,passive_factor=1.5,
                      wall_type='soldier_pile',pile_spacing=3,passive_width=1.5,section=WallSection(allowable_stress_mpa=200,w_cm3=8000)))
R=27.0833333333333; ka=1/3; kp=3; gamma=18; fs=1.5; ratio=.5; H=10
cubic=lambda d:R*d+.5*ka*gamma*H*d*d+(ka*gamma-kp*gamma*ratio/fs)*d**3/6
d0=brentq(cubic,.1,30)
data['soldier']=dict(actual=dict(D0=soldier.embedment_theoretical,D=soldier.embedment,m_member=soldier.m_max_member,m_per_m=soldier.m_max,
    v_member=soldier.v_max_member,v_per_m=soldier.v_max,W_cm3=soldier.required_section_modulus_cm3,levels=soldier.levels),
    expected=dict(D0=d0,D=1.2*d0,member_factor=3,section_multiplier_from_kNm_per_m_to_cm3_member=3*1000/200,
                  first_anchor_axial=120.625*2.5/math.cos(math.radians(20)),first_anchor_vertical_per_m=120.625*math.tan(math.radians(20))))

# Key: exact Rankine passive band and deep-plane resistance, all three positions.
keys={}
for position in ('toe','middle','heel'):
    geom=GravityGeometry(height=6,base_width=4,top_width=1,embedment=.6,key=ShearKey(position=position,width=.5,depth=.6))
    r=analyze_gravity_wall(geom,Backfill(gamma=18,phi=30,delta=0),FoundationSoil(phi=30,gamma=18),settings=WallSettings())
    keys[position]=dict(shear_key=clean(r.shear_key.__dict__),sum_v=r.sum_v,m_res=r.m_resisting,fs=r.checks['sliding'].value)
data['key']=dict(actual=keys,expected=dict(raw_passive=3*(18*.6*.6+.5*18*.6**2),used_passive=.5*3*(18*.6*.6+.5*18*.6**2),
    soil_beside_weight=18*(4-.5)*.6,key_weight=24*.5*.6,deep_extra_horizontal=(18*6*.6+.5*18*.6**2)/3))
dryg=GravityGeometry(height=6,base_width=4,top_width=1)
equa=next(r for r in verify_wall(dryg,Backfill(gamma=18,phi=30,delta=0),FoundationSoil(phi=30,gamma=18),settings=WallSettings(design_code='ec7')) if r.case=='EQU')
phid=math.atan(math.tan(math.pi/6)/1.25)
kad=math.tan(math.pi/4-phid/2)**2
data['ec7_equ']=dict(expected=.9*936/(1.1*.5*kad*18*36*2),actual=equa.checks['overturning'].value)

# Same cap issue on the structure service's layered engine, using independent Coulomb forces.
over={f'TBDY-static.{block}.{key}':FactorOverride(value=1,note='Audit explicit unity choice') for block,keys in [('load',['G_unfav','G_fav','Q_unfav']),('material',['tan_phi','c_eff','su'])] for key in keys}
layeredsoil=StructureSoilModel(profile=profile(phi=40),retained_fill=[SoilLayer(id='fill',top=0,bottom=6,gamma=18,gamma_sat=20,design=DesignParameters(phi_eff=30))])
actual=verify_wall_layered(dryg,layeredsoil,WallLoads(surcharge=94),WallSettings(design_code='tbdy2018',factor_overrides=over),seismic=False,approach=None)[0]
delta,phi=math.radians(20),math.radians(30)
K=math.cos(phi)**2/(math.cos(delta)*(1+math.sqrt(math.sin(phi+delta)*math.sin(phi)/math.cos(delta)))**2)
eh=K*math.cos(delta)*(.5*18*6**2+94*6)
ev=360+eh*math.tan(delta)
data['tbdy_layered_cap']=dict(inputs=dict(q=94,H=6,B=4,top=1,phi_fill=30,phi_foundation=40),
    expected=dict(V=ev,H=eh,sliding_cap=ev*.6/1.1/eh),
    actual=dict(V=actual.sum_v,H=actual.sum_h,sliding=actual.checks['sliding'].value,passed=actual.passed,
                check_passed={k:v.passed for k,v in actual.checks.items()}))

# Single-level envelope can govern a reported maximum while original FE diagram is retained.
single=[]
for H in (3,6,10):
    for depth in (.2*H,.4*H,.55*H):
        a=AnchoredWallAnalysisInputs(excavation_height=H,soil=soil,levels=[AnchorLevel(depth=depth,spacing=2.5)],passive_factor=1.5)
        result=attempt(lambda a=a:run_analysis(a))
        if result['accepted']:
            rr=result['actual']
            single.append(dict(H=H,depth=depth,m_max=rr['m_max'],diagram_mmax=max(abs(v) for v in rr['moment']),
                               v_max=rr['v_max'],diagram_vmax=max(abs(v) for v in rr['shear']),assumptions=rr['assumptions']))
        else:single.append(dict(H=H,depth=depth,error=result))
data['single_envelope_assembly']=single

stops={}
for name,kw in [('water_in_cut',dict(soil=StructureSoilModel(profile=profile(gwt=2)))),('slope_multi',dict(backfill_slope=10)),('undrained_without_basal',dict(soil=StructureSoilModel(profile=profile(30)),drainage='undrained')),('missing_passive',dict(passive_factor=None))]:
    original=dict(excavation_height=10,soil=soil,levels=lv,passive_factor=1.5)
    stops[name]=attempt(lambda kw=kw:run_analysis(AnchoredWallAnalysisInputs(**{**original,**kw})))
for za in (-1,5,4.9):
    stops[f'anchor_depth_{za}']=attempt(lambda za=za:dict(D0=anchored_sheet_pile(profile(),5,za).D0))
data['stops']=stops
(OUT/'branches.json').write_text(json.dumps(clean(data),indent=2,ensure_ascii=False,allow_nan=False))
print(json.dumps(dict(path=str(OUT/'branches.json'),anchor_branches=len(anchor),clay_cases=len(clay),single_cases=len(single),stop_cases=len(stops))))
