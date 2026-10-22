"""Independent structural audit. Run from repository root with PYTHONPATH=. python PATH.

Expected values use standalone analytic pressure integrals/elementary equilibrium;
production functions are called only for actual values. No repository files are written.
Source metadata is recorded as claims, not re-verified source text.
"""
from __future__ import annotations
import ast, dataclasses, json, math, pathlib, sys
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq, minimize_scalar
from geotek.core.models import SoilLayer, SoilProfile, DesignParameters, GroundwaterCondition
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.anchors import AnchorDesignInputs, TendonSpec, AnchorLevel, AnchoredWallAnalysisInputs
from geotek.core.models.walls import GravityGeometry, CantileverGeometry, Backfill, FoundationSoil, WallLoads, WallSettings, ShearKey
from geotek.config.codes import get_design_code, FactorOverride
from geotek.engine.sheet_pile import cantilever_sheet_pile, anchored_sheet_pile, net_pressure
from geotek.engine.anchored_wall import run_analysis, apparent_envelope, basal_heave
from geotek.engine.anchors import design_anchor
from geotek.engine.limit_state import verify_wall, design_sheet_pile, limit_state_cases
from geotek.engine.walls.walls import analyze_gravity_wall, analyze_cantilever_wall
from geotek.engine.walls.layered import wall_forces_layered
from geotek.services.structures import design_sheet_pile_structure
from geotek.core.models.structures import SheetPileStructure
from geotek.core.models.project import Project, ProjectMeta

OUT = pathlib.Path(__file__).resolve().parent
data = {}
def clean(x):
    if isinstance(x,np.generic): return clean(x.item())
    if dataclasses.is_dataclass(x): return clean(dataclasses.asdict(x))
    if hasattr(x, 'model_dump'): return clean(x.model_dump())
    if isinstance(x, np.ndarray): return x.tolist()
    if isinstance(x, dict): return {str(k):clean(v) for k,v in x.items()}
    if isinstance(x, (tuple,list)): return [clean(v) for v in x]
    if isinstance(x, float) and not math.isfinite(x): return str(x)
    return x
def attempt(f):
    try: return {'accepted':True, 'actual':clean(f())}
    except Exception as ex: return {'accepted':False,'error':type(ex).__name__,'message':str(ex)[:600]}
def prof(layers=None,gwt=100,bottom=40,phi=30,gamma=18,su=None):
    if layers is None:
        layers=[SoilLayer(id='S',top=0,bottom=bottom,gamma=gamma,gamma_sat=20,
                         behaviour='undrained' if su is not None else 'drained',
                         design=DesignParameters(phi_eff=phi,su=su))]
    return SoilProfile(id='independent-audit',gwt=GroundwaterCondition(depth_insitu=gwt),layers=layers)
def ka(phi): return math.tan(math.radians(45-phi/2))**2
def kp(phi): return 1/ka(phi)

# Piecewise linear dry/wet/layered stresses are integrated separately from program.
def independent_pressure(z,H,layers,gwt=100,fw=None,q=0,fs=1,ag=1,aq=1,wa=1,beta=0,inc=0,incbelow=0,psr=1):
    def sv(a,b):
        total=0.
        for top,bot,g,gs,p,c in layers:
            lo,hi=max(top,a),min(bot,b)
            if hi>lo:
                dry=max(0.,min(hi,gwt)-lo)
                wet=hi-lo-dry
                total+=g*dry+(gs-9.81)*wet
        return total
    lay=next(l for l in layers if l[0]-1e-10<=z<=l[1]+1e-10)
    phi,c=lay[4],lay[5]
    kab=ka(phi)
    if beta:
        cb,cp=math.cos(math.radians(beta)), math.cos(math.radians(phi))
        kab=cb*(cb-math.sqrt(cb*cb-cp*cp))/(cb+math.sqrt(cb*cb-cp*cp))*cb
        c=0
    a0=max(kab*sv(0,z)-2*c*math.sqrt(kab),0)
    a=max(kab*(sv(0,z)+q)-2*c*math.sqrt(kab),0)
    p=0. if z<=H else (kp(phi)*sv(H,z)+2*c*math.sqrt(kp(phi)))*psr/fs
    front=max(gwt,H) if fw is None else fw
    return ag*a0+aq*(a-a0)-p+wa*9.81*max(0,z-gwt)-9.81*max(0,z-front)+(inc if z<=H else incbelow*(sv(0,z)+q))

def independent_sheet(H,layers,anchor=None,**kw):
    breaks=sorted(set([0.,H]+[l[0] for l in layers]+[l[1] for l in layers]+[kw.get('gwt',100),kw.get('fw',100)]))
    pressure=lambda z: independent_pressure(z,H,layers,**kw)
    def integral(end, power=0):
        cuts=[0]+[b for b in breaks if 0<b<end]+[end]
        return sum(quad(lambda z:pressure(z)*z**power,a,b,epsabs=1e-8)[0] for a,b in zip(cuts,cuts[1:]))
    residual=(lambda t: t*integral(t)-integral(t,1)) if anchor is None else (lambda t: integral(t,1)-anchor*integral(t))
    grid=np.linspace(H+1e-5,layers[-1][1],500)
    toe=next(brentq(residual,a,b,xtol=1e-10) for a,b in zip(grid,grid[1:]) if residual(a)*residual(b)<0)
    force=integral(toe)
    def moment(z): return z*integral(z)-integral(z,1)-(force*max(z-anchor,0) if anchor is not None else 0)
    bounds=[0]+([anchor] if anchor is not None else [])+[H,toe]
    candidates=[(abs(moment(z)),z) for z in bounds]
    for a,b in zip(bounds,bounds[1:]):
        optimum=minimize_scalar(lambda z:-abs(moment(z)),bounds=(a,b),method='bounded')
        candidates.append((-optimum.fun,optimum.x))
    m,z=max(candidates)
    return dict(D0=toe-H,force=force,M_max=m,z_M_max=z,toe_moment=residual(toe))

layers=[(0,40,18,20,30,0)]
sheetcases=[('dry',{}),('water',{'gwt':1.2,'fw':5}),('surcharge',{'q':20}),('slope',{'beta':10,'q':20}),('seismic_uniform',{'inc':8,'incbelow':.12,'psr':.8}),('passive_fs',{'fs':1.5})]
sheetout=[]
for name,kw in sheetcases:
    for anchor in (None,1.0):
        expected=independent_sheet(5,layers,anchor,**kw)
        translation={'gwt':None,'fw':'front_water_depth','q':'surcharge','fs':'passive_factor','beta':'backfill_slope','inc':'seismic_increment','incbelow':'seismic_increment_below','psr':'passive_seismic_ratio'}
        call={translation[k]:v for k,v in kw.items() if translation[k] is not None}
        profile=prof(gwt=kw.get('gwt',100))
        r=cantilever_sheet_pile(profile,5,**call) if anchor is None else anchored_sheet_pile(profile,5,anchor,**call)
        actual={k:getattr(r,k) for k in ('D0','D','M_max','z_M_max')}
        actual['force']=r.toe_force if anchor is None else r.anchor_force
        sheetout.append(dict(case=name,support='cantilever' if anchor is None else 'anchor',inputs=kw,expected=expected,actual=actual,
                             abs_errors={k:abs(actual[k]-expected[k]) for k in ('D0','force','M_max','z_M_max')}))
lay=[(0,3,17,19,28,0),(3,40,19,21,36,0)]
pp=prof(layers=[SoilLayer(id=str(i),top=a,bottom=b,gamma=g,gamma_sat=gs,design=DesignParameters(phi_eff=p,c_eff=c)) for i,(a,b,g,gs,p,c) in enumerate(lay)])
for anchor in (None,1):
    e=independent_sheet(5,lay,anchor)
    r=cantilever_sheet_pile(pp,5) if anchor is None else anchored_sheet_pile(pp,5,anchor)
    sheetout.append(dict(case='layered',support=str(anchor),expected=e,actual=dict(D0=r.D0,force=r.toe_force if anchor is None else r.anchor_force,M_max=r.M_max)))
data['sheet_equilibrium']=sheetout

# Multi-anchor: independently reconstruct distributed pressure and point reactions.
H=10.; supports=[1.5,4.5,7.5,10.]
pmax=.65*(1/3)*18*H**2/(H-supports[0]/3-(H-supports[-2])/3)
def ep(z): return pmax*min(z/1.,1.,(H-z)/(5/3))
def eint(a,b,power=0): return quad(lambda z:ep(z)*z**power,a,b,points=[v for v in (1.,25/3) if a<v<b])[0]
multi={}
for method in ('hinge','tributary'):
    r=run_analysis(AnchoredWallAnalysisInputs(excavation_height=10,soil=StructureSoilModel(profile=prof()),
                   levels=[AnchorLevel(depth=z,spacing=2.5,inclination_deg=15) for z in supports[:-1]],passive_factor=1.5,load_method=method))
    reactions=[lv.horizontal_load_per_m for lv in r.levels]+[r.base_reaction]
    moment_residual=eint(0,H,1)-sum(z*f for z,f in zip(supports,reactions))
    shearchecks=[]
    for z in (2.,5.,8.,9.5):
        expected=eint(0,z)-sum(f for s,f in zip(supports,reactions) if s<=z)
        actual=float(np.interp(z,r.z,r.shear))
        shearchecks.append(dict(z=z,expected=expected,actual=actual,error=actual-expected))
    multi[method]=dict(reactions=reactions,total_pressure=eint(0,H),force_residual=eint(0,H)-sum(reactions),
                       moment_residual=moment_residual,shearchecks=shearchecks,m_max=r.m_max,v_max=r.v_max,
                       max_abs_returned_shear=max(abs(v) for v in r.shear),embedment=r.embedment,z=r.z,shear=r.shear,moment=r.moment,
                       warning_codes=[w.code for w in r.warnings])
data['multi_anchor']=multi

# Standalone anchor: solve line intersection and load conversion from independent geometry.
base=dict(excavation_height=10,head_depth=2,inclination_deg=20,phi_deg=30,horizontal_load_per_m=100,
          spacing=2.5,safety_factor=2,ultimate_bond_stress=150,hole_diameter=.15,lock_off_ratio=.9,tendon=TendonSpec(type='strand'))
r=design_anchor(AnchorDesignInputs(**base))
a,th=map(math.radians,(20,60))
x=(10-2)/(math.tan(th)+math.tan(a)); T=250/math.cos(a)
expected=dict(design_load=T,horizontal_load_per_anchor=250,vertical_load_per_anchor=T*math.sin(a),vertical_load_per_m=100*math.tan(a),
              wedge_distance=x,wedge_length=x/math.cos(a),free_length=max(x/math.cos(a)+2/math.sin(th+a),4.5),
              bond_length=max(T*2/(math.pi*.15*150),4.5),test_load=1.33*T,lock_off_load=.9*T,
              tendon_count=max(math.ceil(T/(.6*260.7)),math.ceil(.9*T/(.7*260.7)),math.ceil(1.33*T/(.8*260.7))))
data['anchor']=dict(expected=expected,actual=r.model_dump())

# Wall nominal force/moment/FS, exact elementary blocks, no production geometry helper.
g=GravityGeometry(height=6,base_width=4,top_width=1)
bf=Backfill(gamma=18,phi=30,delta=0); fd=FoundationSoil(phi=30,gamma=18)
r=analyze_gravity_wall(g,bf,fd)
# Rectangle right strip (x=3..4) plus triangle (0,0),(3,0),(3,6).
W=6*1*24+.5*3*6*24; mx=6*24*3.5+216*2; E=.5*(1/3)*18*36
data['wall_nominal']=dict(inputs=dict(height=6,B=4,top=1,gamma=18,gamma_concrete=24,phi=30,delta=0),
    expected=dict(sum_v=W,sum_h=E,m_resisting=mx,m_overturning=E*2,eccentricity=2-(mx-E*2)/W,sliding=W*math.tan(math.pi/6)/E,overturning=mx/(E*2)),
    actual=dict(sum_v=r.sum_v,sum_h=r.sum_h,m_resisting=r.m_resisting,m_overturning=r.m_overturning,eccentricity=r.eccentricity,sliding=r.checks['sliding'].value,overturning=r.checks['overturning'].value))

# Cantilever elementary rectangle + trapezoid weights. Independent polygon sums.
def polyweight(points,gamma):
    xy=list(points)+[points[0]]
    cross=[a[0]*b[1]-b[0]*a[1] for a,b in zip(xy,xy[1:])]
    area=sum(cross)/2
    xc=sum((a[0]+b[0])*c for a,b,c in zip(xy,xy[1:],cross))/(6*area)
    return area*gamma,xc
cg=CantileverGeometry(stem_height=5.5,stem_top=.3,stem_bottom=.6,toe=1,heel=2,base_thickness=.5)
weights=[polyweight(points,gam) for points,gam in [([(0,0),(3.6,0),(3.6,.5),(0,.5)],24),
    ([(1,.5),(1.6,.5),(1.6,6),(1.3,6)],24), ([(1.6,.5),(3.6,.5),(3.6,6),(1.6,6)],18)]]
cr=analyze_cantilever_wall(cg,bf,fd)
data['cantilever_nominal']=dict(expected=dict(sum_v=sum(w for w,x in weights),m_resisting=sum(w*x for w,x in weights),sum_h=108,m_overturning=216),
    actual={k:getattr(cr,k) for k in ('sum_v','m_resisting','sum_h','m_overturning')})

# Layered gravity water forces, closed Coulomb coefficient with horizontal face.
wg=g.model_copy(update={'embedment':1})
wsoil=StructureSoilModel(profile=prof(gwt=2),gwt_front=GroundwaterCondition(depth_insitu=5))
wforces=wall_forces_layered(wg,wsoil,WallLoads(),WallSettings(use_passive=True),seismic=False)
d=math.radians(20); ph=math.radians(30)
k_total=math.cos(ph)**2/(math.cos(d)*(1+math.sqrt(math.sin(ph+d)*math.sin(ph)/math.cos(d)))**2)
sv=lambda z: 18*min(z,2)+(20-9.81)*max(z-2,0)
effint=quad(sv,0,6,points=[2])[0]
effarm=quad(lambda z:sv(z)*(6-z),0,6,points=[2])[0]/effint
data['layered_water_forces']=dict(inputs=dict(H=6,B=4,front_embedment=1,back_gwt=2,front_gwt=5),
    expected=dict(earth_fx=-k_total*math.cos(d)*effint,earth_fy=-k_total*math.sin(d)*effint,earth_y=effarm,
                  retained_water_fx=-.5*9.81*4**2,retained_water_y=4/3,front_water_fx=.5*9.81,front_water_fy=-.5*9.81*.5,front_water_y=1/3,
                  uplift=4*9.81*(1+4)/2,uplift_x=4*(1+2*4)/(3*(1+4)),passive=.5*3*(20-9.81)*1**2*.5),
    actual=[dict(name=f.name,fx=f.fx,fy=f.fy,x=f.x,y=f.y) for f in wforces.forces])

# Each implemented partial code set is checked against independent equilibrium.
partial_checks=[]
for cid,approach,casespec in [
 ('ec7','DA1',[('DA1-C1',1.,1.35,1.,1.,1.0),('DA1-C2',1.25,1.,1.,1.,1.)]),
 ('ec7','DA2',[('DA2',1.,1.35,1.4,1.1,1.)]),
 ('ec7','DA3',[('DA3',1.25,1.,1.,1.,1.)]),
 ('aashto_lrfd',None,[('Strength I',1.,1.5,1/.75,1/.8,.9)])]:
    design=design_sheet_pile(prof(),5,code=cid,approach=approach)
    wall=verify_wall(g,bf,fd,settings=WallSettings(design_code=cid),approach=approach)
    for name,mf,ag,rp,rs,gfav in casespec:
        phi=math.degrees(math.atan(math.tan(math.radians(30))/mf))
        expected=independent_sheet(5,[(0,40,18,20,phi,0)],ag=ag,fs=rp)
        actual=design.cases[name]
        wa=next(w for w in wall if w.case==name)
        ew=.5*ka(phi)*18*36*ag
        slide=(360*gfav)*math.tan(math.radians(phi))/rs/ew
        partial_checks.append(dict(code=cid,approach=approach,combination=name,
           expected=expected,actual=dict(D0=actual.D0,M_max=actual.M_max),
           expected_wall_sliding=slide,actual_wall_sliding=wa.checks['sliding'].value))
data['partial_equilibrium']=partial_checks

# TBDY project supplies missing values explicitly; interface friction must respect its stated cap.
over={f'TBDY-static.{block}.{key}':FactorOverride(value=1,note='Audit explicit unity choice')
      for block,keys in [('load',['G_unfav','G_fav','Q_unfav']),('material',['tan_phi','c_eff','su'])] for key in keys}
sett=WallSettings(design_code='tbdy2018',factor_overrides=over)
rr=verify_wall(g,bf,FoundationSoil(phi=40,gamma=18),loads=WallLoads(surcharge=45),settings=sett)[0]
cap_rd=rr.sum_v*.6/1.1
data['tbdy_base_cap']=dict(actual_sliding=rr.checks['sliding'].value,expected_with_0_6_cap=cap_rd/rr.sum_h,
    actual_base_friction=math.tan(math.radians(40)),cap=.6,V=rr.sum_v,H=rr.sum_h,detail=rr.checks['sliding'].detail,
    checks={k:clean(v) for k,v in rr.checks.items()},passed=rr.passed)

# Service must retain the controlling static case even when SDS is present.
pwet=prof(gwt=0)
pwet.gwt=GroundwaterCondition(depth_insitu=0,depth_design=0,depth_seismic=100)
soilwet=StructureSoilModel(profile=pwet,gwt_front=GroundwaterCondition(depth_insitu=5,depth_design=5,depth_seismic=100))
st=SheetPileStructure(id='S',retained_height=5,soil=soilwet,sds=.1)
prj=Project(meta=ProjectMeta(name='Audit'),structures=[st])
seismic=design_sheet_pile_structure(prj,'S')
static_st=st.model_copy(update={'sds':None})
static=design_sheet_pile_structure(prj.model_copy(update={'structures':[static_st]}),'S')
static_independent=independent_sheet(5,layers,gwt=0,fw=5,fs=1.5)
data['asd_static_envelope']=dict(inputs=dict(H=5,gwt_design=0,gwt_seismic=100,front_design=5,front_seismic=100,SDS=.1),
    expected_static=static_independent,actual_static=dict(D=static.result.D,D0=static.result.D0,M=static.result.M_max),
    actual_with_sds=dict(D=seismic.result.D,D0=seismic.result.D0,M=seismic.result.M_max),
    ratio_D=seismic.result.D/static.result.D,ratio_M=seismic.result.M_max/static.result.M_max)

# Code-set numerical cells and claimed provenance, including null and unused fields.
inventory={}
for cid in ('asd','ec7','tbdy2018','aashto_lrfd'):
    code=get_design_code(cid); rows=[]
    paths=[]
    for block,table in [('safety',code.safety_factors),('load',code.load_factors),('resistance',code.resistance_factors),('eccentricity',code.eccentricity_limits)]:
        for group,cols in table.items():
            paths.extend((f'{block}.{group}.{key}',value) for key,value in cols.items())
    for c in code.combinations:
        for block,table in [('load',c.load_factors),('material',c.material_factors),('resistance',c.resistance_factors)]:
            paths.extend((f'{c.id}.{block}.{key}',value) for key,value in table.items())
        rows.append(dict(path=f'{c.id}.passive_participation',value=c.passive_participation,source_claim=code.reference,review='knowledge only, not primary source verified'))
    for path,value in paths:
        rows.append(dict(path=path,value=value,source_claim=code.source_of(path).model_dump(),review='inventory; no current primary-source verification'))
    inventory[cid]=dict(status_claim=code.status,cells=rows,approaches=code.approaches,
                         nominal_call=attempt(lambda:limit_state_cases(cid)),seismic_call=attempt(lambda:limit_state_cases(cid,seismic=True)))
data['code_inventory']=inventory

# Boundaries and invalid inputs, preserving error vs successful result distinctions.
boundaries={}
for field in ('excavation_height','head_depth','inclination_deg','phi_deg','horizontal_load_per_m','spacing','safety_factor','ultimate_bond_stress','hole_diameter','lock_off_ratio'):
    for value in (0,-1,float('nan'),float('inf')):
        boundaries[f'anchor.{field}.{value}']=attempt(lambda field=field,value=value: AnchorDesignInputs(**{**base,field:value}))
for field,values in [('height',(0,-1,float('nan'),float('inf'))),('embedment',(7,float('inf'))),('base_width',(float('inf'),))]:
    for value in values:
        boundaries[f'gravity.{field}.{value}']=attempt(lambda field=field,value=value: GravityGeometry(**{'height':6,'base_width':4,'top_width':1,field:value}))
for name,kw in [('increase_negative',{'depth_increase':-2}),('fs_nan',{'passive_factor':float('nan')}),('q_inf',{'surcharge':float('inf')}),('stress_nan',{'allowable_stress_mpa':float('nan')})]:
    boundaries[f'sheet.{name}']=attempt(lambda kw=kw:dict(D0=(v:=cantilever_sheet_pile(prof(),5,**kw)).D0,D=v.D,W=v.section_modulus_cm3))
boundaries['anchor.level_at_zero']=attempt(lambda:run_analysis(AnchoredWallAnalysisInputs(excavation_height=10,soil=StructureSoilModel(profile=prof()),levels=[AnchorLevel(depth=0,spacing=2.5),AnchorLevel(depth=6,spacing=2.5)],passive_factor=1.5)).envelope)
data['boundaries']=boundaries

# Education independently recomputed numbers and identified draw geometry.
data['education']=dict(
    sheet_H3=independent_sheet(3,layers),anchor_H3_z1=independent_sheet(3,layers,1),
    soft_clay_H8=dict(p=.22*17*8,total=.22*17*8*7),
    soft_clay_draw=dict(expected_area=29.92*8*.875,actual_draw_area_ratio=.75,expected_area_ratio=.875,
                        actual_draw_if_H8=29.92*8*.75,description='spDraw.tsx soft clay triangle-down over last quarter conflicts with envelope plateau to base'),
    shear_key_extra_thrust=(118*.6+.5*18*.6**2)/3,
    anchor_clearance_phi0=2/math.sin(math.radians(60)),
    basal_H6_B10_su20=5.6*20/(17*6),basal_H10_B2_su30=7.46*30/(18*10))

(OUT/'results.json').write_text(json.dumps(clean(data),indent=2,ensure_ascii=False,allow_nan=False))
print(json.dumps({'result_file':str(OUT/'results.json'),'sheet_cases':len(sheetout),'code_cells':{k:len(v['cells']) for k,v in inventory.items()},
                  'multi_moment_residuals':{k:v['moment_residual'] for k,v in multi.items()},'tbdy':data['tbdy_base_cap']},indent=2))
