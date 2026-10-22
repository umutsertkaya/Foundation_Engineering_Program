"""Read-only engineering audit. Expected values use math/scipy, never engine helpers.
Run from checkout: PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/engineering-a/independent_audit.py
"""
from pathlib import Path
import ast, csv, dataclasses, datetime as dt, json, math, os, warnings
from types import SimpleNamespace
import numpy as np
from scipy.optimize import brentq
from geotek.core import units
from geotek.core.models.profile import SoilLayer, SoilProfile, GroundwaterCondition, LayeringSettings
from geotek.core.models.investigations import SPTRecord, Borehole, CPTSounding, Investigations, LabRecord
from geotek.core.models.project import Project, ProjectMeta
from geotek.engine.stresses import vertical_stresses
from geotek.engine.insitu import spt, cpt
from geotek.engine.classification import uscs, robertson as rob
from geotek.engine.correlations import REGISTRY, evaluate, applicable, combine
from geotek.engine.liquefaction import youd2001 as y, boulanger_idriss2014 as b
from geotek.engine.liquefaction import common as lc, analysis as la
from geotek.engine.layering import common as lay, proposal_to_layers
from geotek.engine.layering.cpt import cpt_layers
from geotek.engine.layering.spt import spt_uscs_n_layers, spt_log_layers
from geotek.services import parameters as ps
from geotek.io.tabular import import_cpt, import_spt

OUT = Path(os.environ.get('GEOTEK_AUDIT_OUT', '/tmp/geotek-audit/engineering-a'))
OUT.mkdir(parents=True,exist_ok=True)
ROOT = Path(os.environ.get('GEOTEK_REPO', Path.cwd()))
P, GW = 101.325, 9.81
checks, probes = [], []

def clean(v):
    if dataclasses.is_dataclass(v): return clean(dataclasses.asdict(v))
    if hasattr(v, 'model_dump'): return clean(v.model_dump())
    if isinstance(v, np.ndarray): return clean(v.tolist())
    if isinstance(v, np.generic): return clean(v.item())
    if isinstance(v, dict): return {str(k):clean(x) for k,x in v.items()}
    if isinstance(v, (list,tuple)): return [clean(x) for x in v]
    if isinstance(v, float) and not math.isfinite(v): return str(v)
    if isinstance(v, (dt.date,dt.datetime)): return str(v)
    return v

def ck(name, actual, expected, *, atol=1e-9, rtol=1e-9, note=''):
    try:
        ok = bool(np.allclose(actual, expected, atol=atol, rtol=rtol, equal_nan=True))
    except (TypeError, ValueError): ok = actual == expected
    checks.append(dict(name=name, status='PASS' if ok else 'FAIL', actual=clean(actual),
                       expected=clean(expected), atol=atol, rtol=rtol, note=note))

def probe(name, fn, expectation):
    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            val=fn()
        probes.append(dict(name=name, actual=clean(val), warnings=[str(w.message) for w in caught], expectation=expectation))
    except Exception as e:
        probes.append(dict(name=name, exception=type(e).__name__, message=str(e), expectation=expectation))

def scalar_ic(q, f):
    return math.hypot(3.47-math.log10(q), math.log10(f)+1.22)

def normal(qt,fs,sv,se):
    f=100*fs/(qt-sv)
    def vals(n):
        q=(qt-sv)/P*(P/se)**n
        ic=scalar_ic(q,f)
        return q,ic,max(0,min(1,.381*ic+.05*se/P-.15))
    n=brentq(lambda n:n-vals(n)[2],0,1,xtol=1e-14)
    q,ic,_=vals(n)
    return q,f,ic,n

def dn(fc): return math.exp(1.63+9.7/(fc+.01)-(15.7/(fc+.01))**2)
def dq(q,fc): return (11.9+q/14.6)*math.exp(1.63-9.7/(fc+2)-(15.7/(fc+2))**2)
def spt_fixed(n,se,fc):
    return brentq(lambda x:x-min(1.7,(P/se)**(.784-.0768*math.sqrt(min(x,46))))*n-dn(fc),0,10000,xtol=1e-12)
def cpt_fixed(qt,se,fc):
    def residual(x):
        q=min(1.7,(P/se)**(1.338-.249*max(21,min(x,254))**.264))*qt/P
        return x-q-dq(q,fc)
    return brentq(residual,0,10000,xtol=1e-12)
def yc(n): return 1/(34-n)+n/135+50/(10*n+45)**2-1/200 if n<30 else math.nan
def bc(n): return math.exp(n/14.1+(n/126)**2-(n/23.6)**3+(n/25.4)**4-2.8)
def bqc(q): return math.exp(q/113+(q/1000)**2-(q/140)**3+(q/137)**4-2.8)
def yfc(n,fc):
    a,bb=(0,1) if fc<=5 else (5,1.2) if fc>=35 else (math.exp(1.76-190/fc**2),.99+fc**1.5/1000)
    return a+bb*n

# Units: independently defined base factors, exact metric plus published rounded US customary.
factors={'m':1,'cm':.01,'mm':.001,'ft':.3048,'in':.0254,'kPa':1,'Pa':.001,'MPa':1000,
         'kgf/cm2':98.0665,'bar':100,'tsf':95.7605,'psf':.0478803,'psi':6.89476,'atm':101.325,
         'kN/m3':1,'pcf':.157087,'tf/m3':9.80665,'kN':1,'N':.001,'MN':1000,'tf':9.80665,'kip':4.44822}
for unit,f in factors.items():
    ck('units:'+unit,units.to_si([0,1,-2],unit),[0,f,-2*f])
probe('units dimension mismatch',lambda:units.convert(1,'m','MPa'),'UnitError')
probe('units unknown',lambda:units.to_si(1,'kN/m2'),'UnitError')

profile=SoilProfile(id='P',gwt=GroundwaterCondition(depth_insitu=2,depth_seismic=1),layers=[
    SoilLayer(id='L1',top=0,bottom=3,gamma=18,gamma_sat=20),
    SoilLayer(id='L2',top=3,bottom=12,gamma=19,gamma_sat=21)])
for gw in [0,1,2,3,12,20]:
    for z in [0,1,2-1e-5,2,2+1e-5,3-1e-5,3,3+1e-5,10,12]:
        sv=sum(g*max(0,min(z,bot,gw)-top)+gs*max(0,min(z,bot)-max(top,gw))
               for top,bot,g,gs in [(0,3,18,20),(3,12,19,21)])
        u=GW*max(0,z-gw)
        ck(f'stresses:z={z},gwt={gw}',vertical_stresses(profile,z,gw),(sv,u,sv-u))
probe('stresses NaN depth',lambda:vertical_stresses(profile,float('nan'),2),'reject nonfinite depth')
probe('stresses NaN GWT',lambda:vertical_stresses(profile,5,float('nan')),'reject nonfinite GWT')
probe('stresses negative depth',lambda:vertical_stresses(profile,-1,2),'ProfileError')
probe('stresses beyond bottom',lambda:vertical_stresses(profile,13,2),'ProfileError')
ck('CPT log trapezoids',cpt.stresses_from_unit_weight([1,3,6],[18,20,22],2),([18,56,119],[0,9.81,39.24],[18,46.19,79.76]))

# SPT all factor boundaries and correction chain.
for L, expected in [(0, .75),(2.99999,.75),(3,.8),(3.99999,.8),(4,.85),(5.99999,.85),(6,.95),(9.99999,.95),(10,1),(30,1)]:
    ck('SPT rod '+str(L),spt.rod_length_factor(L),expected)
for d,expected in [(65,1),(115,1),(115.00001,1.05),(150,1.05),(150.00001,1.15),(200,1.15)]:
    ck('SPT diameter '+str(d),spt.borehole_diameter_factor(d),expected,note='Intermediate diameter step is an implementation assumption, not independently source-verified.')
for se in [1e-10,P/1.7**2-1e-5,P/1.7**2,P/1.7**2+1e-5,50,P,200]:
    ck('SPT CN '+str(se),spt.overburden_factor_liao_whitman(se),min(1.7,math.sqrt(P/se)))
ck('SPT N60',spt.n60(np.array([0,10,20]),72,1.05,1.2,np.array([.75,.85,1])),[0,12.852,30.24])
for name,fn in [('negative rod',lambda:spt.rod_length_factor(-2)),('NaN rod',lambda:spt.rod_length_factor(math.nan)),('oversize diameter',lambda:spt.borehole_diameter_factor(1000)),('NaN diameter',lambda:spt.borehole_diameter_factor(math.nan)),('unknown sampler',lambda:spt.sampler_factor('unknown')),('negative sigma',lambda:spt.overburden_factor_liao_whitman(-1)),('sigma zero',lambda:spt.overburden_factor_liao_whitman(0)),('shape mismatch',lambda:spt.n60([10,20],60,c_r=[1,2,3]))]:
    probe('SPT '+name,fn,'reject/flag invalid engineering domain; zero sigma normalization is undefined')
bh=Borehole(id='BH',spt=[SPTRecord(depth=2,n_field=20),SPTRecord(depth=5,n_field=12)])
sp=spt.process_borehole(bh,profile)
ck('process_borehole N60',sp.n60,[15,10.2])
ck('process_borehole sigma eff',sp.sigma_v_eff,[36,68.57])
ck('SPT dataframe length',len(sp.to_dataframe()),2)

# CPT correction, independent scalar root solutions, invalid masks and forced nonconvergence.
ck('qt correction',cpt.corrected_tip_resistance(np.array([1000,5000]),np.array([200,-50]),.8),[1040,4990])
ck('qt no u2',cpt.corrected_tip_resistance([1000],None,.8),[1000])
for qt,fs,sv,se in [(5000,50,100,80),(800,60,100,80),(10000,30,200,50),(2000,5,100,1e-5),(30000,20,300,280)]:
    exp=normal(qt,fs,sv,se)
    got=cpt.normalise_iterative(*[np.array([v]) for v in [qt,fs,sv,se]],tol=1e-13,max_iter=1000)
    ck(f'CPT independent root {qt,fs,sv,se}',np.array([v[0] for v in got[:4]]),exp)
    default=cpt.normalise_iterative(*[np.array([v]) for v in [qt,fs,sv,se]])
    n=default[3][0]; ic=default[2][0]
    ck(f'CPT default residual {qt,fs,sv,se}',abs(n-max(0,min(1,.381*ic+.05*se/P-.15))),0,atol=.001,rtol=0,note='Default stopping criterion is exponent change <0.001; residual checked independently.')
ck('CPT invalid masks',cpt.normalise_iterative(np.array([100,1000,1000]),np.array([10,0,10]),np.array([100,100,100]),np.array([50,50,0]))[0],[math.nan]*3)
ck('CPT forced nonconvergence',cpt.normalise_iterative(np.array([5000.]),np.array([50.]),np.array([100.]),np.array([80.]),max_iter=0)[4],[False])
probe('CPT normalization mismatched arrays',lambda:cpt.normalise_iterative(np.array([1000,2000]),np.array([10,20,30]),np.array([100,200]),np.array([80,150])),'ValueError')
cp=cpt.process_cpt(CPTSounding(id='C',depth=[1,3,5],qc=[5000,5000,5000],fs=[50,50,50]),profile)
ck('CPT process profile sigma',cp.sigma_v,[18,56,98])
ck('CPT dataframe rows',len(cp.to_dataframe()),3)

# USCS all decision boundaries, equality of coarse fractions, and grading bounds.
for fc,expected in [(4.99999,'SW'),(5,'SW-SC'),(12,'SW-SC'),(12.00001,'SC'),(49.99999,'SC'),(50,'CL')]:
    ck('USCS FC '+str(fc),uscs.classify(fines=fc,gravel=0,LL=35,PI=15,D10=1,D30=3,D60=6).symbol,expected)
for ll,expected in [(49.99999,'CL'),(50,'CH'),(50.00001,'CH')]:
    ck('USCS LL '+str(ll),uscs.classify(fines=80,LL=ll,PI=30).symbol,expected)
for pi,expected in [(3.99999,'M'),(4,'CL-ML'),(7,'CL-ML'),(7.00001,'C')]: ck('USCS PI '+str(pi),uscs.fines_type(25,pi),expected)
for diff,expected in [(-1e-7,'M'),(0,'C'),(1e-7,'C')]: ck('USCS A line '+str(diff),uscs.fines_type(40,14.6+diff),expected)
for gravel,expected in [(49.99999,'SP'),(50,'SP'),(50.00001,'GP')]: ck('USCS G/S '+str(gravel),uscs.classify(fines=0,gravel=gravel,D10=1,D30=1,D60=2).symbol,expected)
for gravel,cu in [(0,6),(80,4)]:
    for delta in [-1e-5,0,1e-5]:
        for cc in [.99999,1,3,3.00001]:
            exp=('G' if gravel else 'S')+('W' if cu+delta>=cu and 1<=cc<=3 else 'P')
            d30=math.sqrt(cc*(cu+delta))
            if abs(d30*d30/(cu+delta)-cc)>0 and cc in (1,3):
                probes.append(dict(name=f'USCS floating boundary {gravel,cu+delta,cc}',actual=clean(uscs.classify(fines=0,gravel=gravel,D10=1,D30=d30,D60=cu+delta)),expectation='Input sqrt representation can differ from mathematical Cc boundary by machine epsilon; not an engineering defect.'))
            else:
                ck(f'USCS grading {gravel,cu+delta,cc}',uscs.classify(fines=0,gravel=gravel,D10=1,D30=d30,D60=cu+delta).symbol,exp)
ck('USCS exactly representable sand Cc1',uscs.classify(fines=0,gravel=0,D10=1,D30=3,D60=9).symbol,'SW')
ck('USCS exactly representable gravel Cc1',uscs.classify(fines=0,gravel=80,D10=1,D30=2,D60=4).symbol,'GW')
ck('USCS missing LL incomplete',uscs.classify(fines=70).complete,False)
ck('USCS missing gravel incomplete',uscs.classify(fines=3).complete,False)
for name,kw in [('negative FC',dict(fines=-1,gravel=1)),('sum >100',dict(fines=20,gravel=90,LL=30,PI=10)),('NaN FC',dict(fines=math.nan,gravel=0,LL=30,PI=10)),('zero D10',dict(fines=2,gravel=0,D10=0,D30=1,D60=2))]: probe('USCS '+name,lambda kw=kw:uscs.classify(**kw),'reject impossible input domain')
probe('USCS model permits impossible fraction sum',lambda:uscs.classify_lab_record(LabRecord(depth=1,FC=20,gravel=90,LL=30,PI=10)),'LabRecord should reject gravel+FC>100 before classification')

# SBTn all Ic/exceptional boundaries, inverse and undefined behavior.
for cutoff,lower,upper in [(1.31,7,6),(2.05,6,5),(2.6,5,4),(2.95,4,3),(3.6,3,2)]:
    for d,zone in [(-1e-8,lower),(0,upper),(1e-8,upper)]: ck('SBTn '+str(cutoff+d),rob.zone_from_ic(cutoff+d),zone)
for fr in [.1,.5,1,2,4.5,5]:
    boundary=12*math.exp(-1.4*fr)
    ck('SBTn sensitive below '+str(fr),rob.sbtn_zone(boundary*(1-1e-8),fr),1)
    ck('SBTn sensitive exact '+str(fr),rob.sbtn_zone(boundary,fr),int(rob.zone_from_ic(scalar_ic(boundary,fr))))
for fr in [1.5,1.50001,4.5,4.50001,5]:
    x=fr-1; q=1/(.005*x-.0003*x*x-.002)
    if q>0:
        ck('SBTn exceptional '+str(fr),rob.sbtn_zone(q*1.001,fr,include_zones_8_9=True),8 if 1.5<fr<=4.5 else 9 if fr>4.5 else int(rob.zone_from_ic(scalar_ic(q*1.001,fr))))
ck('Ic inverse',rob.qtn_from_ic(scalar_ic(50,1),1),50)
ck('Ic example label',rob.soil_behaviour_index(50,1),2.15,atol=.005,rtol=0)
ck('SBTn invalid NaN',rob.sbtn_zone(math.nan,1),0)
probe('SBTn infinity',lambda:rob.sbtn_zone(math.inf,1),'zone 0 (undefined), not a soil zone')

# Every registry ID: exact formula arithmetic, metadata and validity range edges.
spec={
 'RC2010_gamma_CPT':(dict(qt=10000,fs=50),lambda: max(12,GW*(.27*math.log10(.5)+.36*math.log10(10000/P)+1.236))),
 'Skempton1986_Dr_SPT':(dict(N1_60=15,Ic=2),lambda:100*math.sqrt(15/60)),
 'Mayne_sigp_CPT':(dict(qt=1000,sigma_v=100,Ic=3),lambda:.33*900),
 'BI2014_FC_CPT':(dict(Ic=2),lambda:23),
 'KM1990_phi_SPT':(dict(N60=20,sigma_v_eff=100,Ic=2),lambda:math.degrees(math.atan((20/(12.2+20.3*100/P))**.34))),
 'HU1996_phi_SPT':(dict(N1_60=20,Ic=2),lambda:40),
 'PHT1974_phi_SPT':(dict(N1_60=20,Ic=2),lambda:27.1+.3*20-.00054*400),
 'RC1983_phi_CPT':(dict(qc=10000,sigma_v_eff=100,Ic=2),lambda:math.degrees(math.atan((2+.29)/2.68))),
 'KM1990_phi_CPT':(dict(qt=10000,sigma_v_eff=100,Ic=2),lambda:17.6+11*math.log10((10000/P)/math.sqrt(100/P))),
 'TPM1996_phi_PI':(dict(PI=20),lambda:math.degrees(math.asin(.8-.094*math.log(20)))),
 'CPT_su_Nkt':(dict(qt=1000,sigma_v=100,Ic=3),lambda:900/14),
 'CPTu_su_Ndu':(dict(u2=450,u0=100,Ic=3),lambda:50),
 'Stroud1974_su_SPT':(dict(N60=10,Ic=3),lambda:44),
 'Hara1974_su_SPT':(dict(N60=10,Ic=3),lambda:29*10**.72),
 'KM1990_E_SPT':(dict(N60=10,Ic=2),lambda:10*P*10),
 'R2009_E_CPT':(dict(qt=10000,sigma_v=100,Ic=2),lambda:.015*10**(2.78)*9900),
}
ck('Registry inventory equality',sorted(REGISTRY),sorted(spec))
for cid,(inp,formula) in spec.items(): ck('registry nominal '+cid,evaluate(cid,inp).value,formula())
for cid,key,lo,hi in [('Skempton1986_Dr_SPT','Cd',55,65),('Mayne_sigp_CPT','k',.2,.5),('BI2014_FC_CPT','CFC',-.29,.29),('HU1996_phi_SPT','N1_60',3.5,30),('PHT1974_phi_SPT','N1_60',0,50),('KM1990_phi_SPT','N60',0,60),('TPM1996_phi_PI','PI',5,80),('CPT_su_Nkt','Nkt',10,20),('CPTu_su_Ndu','Ndu',4,10),('Stroud1974_su_SPT','f1',3.5,6.5),('KM1990_E_SPT','alpha',5,15)]:
    for val,good in [(lo-1e-6,False),(lo,True),(hi,True),(hi+1e-6,False)]:
        inp=spec[cid][0].copy(); opts={}
        (opts if key in REGISTRY[cid].options else inp)[key]=val
        try: actual_valid=evaluate(cid,inp,**opts).validity_ok
        except (TypeError, ValueError, ArithmeticError) as exc:
            actual_valid=False
            probes.append(dict(name=f'registry out-of-range exception {cid}:{key}={val}',exception=type(exc).__name__,message=str(exc),expectation='Out-of-domain rejection; service exception type compatibility requires review.'))
        ck(f'registry validity {cid}:{key}={val}',actual_valid,good)
for cid,inp in [('CPT_su_Nkt',dict(qt=50,sigma_v=100,Ic=3)),('CPTu_su_Ndu',dict(u2=50,u0=100,Ic=3)),('R2009_E_CPT',dict(qt=50,sigma_v=100,Ic=2)),('Mayne_sigp_CPT',dict(qt=50,sigma_v=100,Ic=3)),('RC1983_phi_CPT',dict(qc=10000,sigma_v_eff=-1,Ic=2)),('Skempton1986_Dr_SPT',dict(N1_60=120,Ic=2))]:
    probe('registry physical domain '+cid,lambda cid=cid,inp=inp:evaluate(cid,inp),'invalid flag or rejection for negative strength/stiffness/stress/density>100%')
probe('registry zero sigma CPT phi',lambda:evaluate('RC1983_phi_CPT',dict(qc=10000,sigma_v_eff=0,Ic=2)),'invalid or rejection')
probe('registry infinite sigma KM phi',lambda:evaluate('KM1990_phi_SPT',dict(N60=20,sigma_v_eff=math.inf,Ic=2)),'invalid or rejection')
probe('registry missing context sand',lambda:evaluate('HU1996_phi_SPT',dict(N1_60=20)),'unknown applicability should be qualified')

# Youd every rd/fines/CRR/kc/sigma/MSF boundary and both MSF variants.
for z in [0,5,9.15-1e-8,9.15,9.15+1e-8,23-1e-8,23,23+1e-8,30,30+1e-8]:
    exp=1-.00765*z if z<=9.15 else 1.174-.0267*z if z<=23 else .744-.008*z if z<=30 else math.nan
    ck('Youd rd '+str(z),y.stress_reduction(z),exp)
for fc in [0,5-1e-8,5,5+1e-8,10,35-1e-8,35,35+1e-8,100]: ck('Youd fines '+str(fc),y.fines_correction_spt(12,fc),yfc(12,fc))
for n in [0,12,29.99999,30,30.00001]: ck('Youd CRR SPT '+str(n),y.crr75_spt(n),yc(n))
for q in [0,49.99999,50,50.00001,159.99999,160,160.00001]:
    exp=(.833*q/1000+.05 if q<50 else 93*(q/1000)**3+.08) if q<160 else math.nan
    ck('Youd CRR CPT '+str(q),y.crr75_cpt(q),exp)
for ic in [1.64-1e-8,1.64,1.64+1e-8,2.36,2.6]: ck('Youd Kc '+str(ic),y.kc_factor(ic),1 if ic<=1.64 else -.403*ic**4+5.581*ic**3-21.63*ic**2+33.75*ic-17.88)
for m in [4,5.5,6.5,7.5,8.5,9.5]:
    ck('Youd MSF Idriss '+str(m),y.magnitude_scaling(m),10**2.24/m**2.56)
    ck('Youd MSF AS '+str(m),y.magnitude_scaling(m,variant='andrus_stokoe'),(m/7.5)**-3.3)
for se in [1e-10,P-1e-8,P,P+1e-8,200,400]:
    for f in [.6,.7,.8]: ck('Youd Ksigma '+str((se,f)),y.overburden_factor(se,f=f),1 if se<=P else (se/P)**(f-1))
rw_cases=[(5000,20,100,60),(1000,20,100,150),(1000,10,100,20),(10000,50,100,80),(500,5,100,20)]
for target_ic in [2.6-1e-7,2.6+1e-7]:
    qtarget=10**(3.47-math.sqrt(target_ic**2-1.22**2)); net=20*qtarget
    rw_cases.append((100+net,net*.01,100,20))
for qt,fs,sv,se in rw_cases:
    ff=100*fs/(qt-sv)
    v={nn:scalar_ic((qt-sv)/P*(P/se)**nn,ff) for nn in [1,.5,.7]}
    nn=1 if v[1]>2.6 else .5 if v[.5]<=2.6 else .7
    ck('Youd Ic branch '+str((qt,fs,sv,se)),y.robertson_wride_ic(qt,fs,sv,se),(v[nn],nn,ff))
    ic=v[nn]; kc=1 if ic<=1.64 else -.403*ic**4+5.581*ic**3-21.63*ic**2+33.75*ic-17.88
    qcs=min(1.7,(P/se)**nn)*qt/P*kc
    rr=y.cpt_resistance(qt,fs,sv,se)
    ck('Youd CPT resistance '+str((qt,fs,sv,se)),rr['resistance'],qcs)

# BI2014 independent closed forms and root solve (default versus stringent tolerances).
for z in [0,5,20,34-1e-8,34,34+1e-8]:
    for m in [4,6.5,7.5,8.5,9.5]:
        exp=math.exp(-1.012-1.126*math.sin(z/11.73+5.133)+m*(.106+.118*math.sin(z/11.28+5.142))) if z<=34 else math.nan
        ck('BI rd '+str((z,m)),b.stress_reduction(z,m),exp)
for fc in [0,5,10,35,100]:
    ck('BI delta N '+str(fc),b.delta_n_fines(fc),dn(fc))
    ck('BI delta q '+str(fc),b.delta_qc1n_fines(80,fc),dq(80,fc))
ns=31.5*math.sqrt(2.2-1.09); qs=180*(2.2-1.09)**(1/3)
nc=((18.9-1/.3)/2.55)**2;qc=((37.3-1/.3)/8.27)**(1/.264)
for typ,rrs in [('SPT',[0,12,30,46,46.00001,100,ns-1e-6,ns,ns+1e-6,nc-1e-6,nc,nc+1e-6]),('CPT',[0,21,100,180,254,254.00001,500,qs-1e-6,qs,qs+1e-6,qc-1e-6,qc,qc+1e-6])]:
    for r in rrs:
        raw=1.09+(r/31.5)**2 if typ=='SPT' else 1.09+(r/180)**3
        ck('BI MSFmax '+str((typ,r)),b.msf_max(r,typ),min(raw,2.2))
        den=18.9-2.55*math.sqrt(r) if typ=='SPT' else 37.3-8.27*r**.264
        cs=min(1/den,.3) if den>0 else .3
        ck('BI Csigma '+str((typ,r)),b.c_sigma(r,typ),cs)
        for m in [6,7.5,9]: ck('BI MSF '+str((typ,r,m)),b.magnitude_scaling(m,r,typ),1+(min(raw,2.2)-1)*(8.64*math.exp(-m/4)-1.325))
        for se in [1e-10,P,400]: ck('BI Ksigma '+str((typ,r,se)),b.overburden_factor(se,r,typ),min(1-cs*math.log(se/P),1.1))
for n in [0,12,30,46]: ck('BI CRR SPT '+str(n),b.crr75_spt(n),bc(n))
for q in [0,21,100,254]: ck('BI CRR CPT '+str(q),b.crr75_cpt(q),bqc(q))
for n,se,fc in [(12,50,0),(20,150,10),(30,400,35),(1,.00001,100),(0,100,0)]:
    exp=spt_fixed(n,se,fc)
    ck('BI SPT root '+str((n,se,fc)),b.spt_resistance(n,999,fc,se,tol=1e-12,max_iter=1000)[0],exp)
    got=b.spt_resistance(n,999,fc,se)
    residual=got[0]-min(1.7,(P/se)**(.784-.0768*math.sqrt(min(got[0],46))))*n-dn(fc)
    ck('BI SPT default residual '+str((n,se,fc)),residual,0,atol=1e-4,rtol=0)
for qt,se,fc in [(5000,50,0),(10000,150,10),(1000,400,35),(1000,.00001,100)]:
    exp=cpt_fixed(qt,se,fc)
    ck('BI CPT root '+str((qt,se,fc)),b.cpt_resistance(qt,se,fc,2,tol=1e-12,max_iter=1000)['resistance'],exp)
    got=b.cpt_resistance(qt,se,fc,2)
    qq=min(1.7,(P/se)**(1.338-.249*max(21,min(got['resistance'],254))**.264))*qt/P
    ck('BI CPT default residual '+str((qt,se,fc)),got['resistance']-qq-dq(qq,fc),0,atol=1e-4,rtol=0)
ck('BI SPT forced nonconvergence',b.spt_resistance(np.array([12.]),np.array([12.]),10,50,max_iter=0)[3],[False])
ck('BI CPT forced nonconvergence',b.cpt_resistance(np.array([5000.]),50,10,2,max_iter=0)['converged'],[False])
for name,fn in [('Youd negative FC',lambda:y.fines_correction_spt(10,-5)),('Youd NaN FC',lambda:y.fines_correction_spt(10,math.nan)),('Youd negative depth',lambda:y.stress_reduction(-5)),('BI negative depth',lambda:b.stress_reduction(-5,7.5)),('BI NaN resistance Csigma',lambda:b.c_sigma(math.nan,'SPT')),('BI invalid type',lambda:b.magnitude_scaling(6,20,'unknown')),('BI sigma zero',lambda:b.spt_resistance(10,10,0,0)),('BI negative sigma',lambda:b.cpt_resistance(1000,-1,10,2))]: probe(name,fn,'reject invalid domain or preserve NaN explicitly')

# Independent full demand-capacity chain for 2 methods x SPT/CPT.
for method in ['youd2001','bi2014']:
    sr=la.analyze_spt(sp,profile,method=method,amax_g=.25,mw=6.5,fc=10)
    for i,z in enumerate(sp.depth):
        sv=18*min(z,1)+20*max(0,min(z,3)-1)+21*max(0,z-3)
        se=sv-GW*max(0,z-1)
        resistance=yfc(float(sp.n1_60[i]),10) if method=='youd2001' else spt_fixed(float(sp.n60[i]),float(sp.sigma_v_eff[i]),10)
        rd=(1-.00765*z) if method=='youd2001' else math.exp(-1.012-1.126*math.sin(z/11.73+5.133)+6.5*(.106+.118*math.sin(z/11.28+5.142)))
        crr=yc(resistance) if method=='youd2001' else bc(resistance)
        msf=10**2.24/6.5**2.56 if method=='youd2001' else 1+(min(1.09+(resistance/31.5)**2,2.2)-1)*(8.64*math.exp(-6.5/4)-1.325)
        ks=(1 if se<=P else (se/P)**-.3) if method=='youd2001' else min(1-min(1/(18.9-2.55*math.sqrt(resistance)),.3)*math.log(se/P),1.1)
        expected=crr*msf*ks/(.65*.25*sv/se*rd)
        ck(f'full SPT {method} z={z}',sr.fs[i],expected,atol=2e-5,rtol=2e-5,note='BI public analysis uses default 1e-4 iteration; tolerance propagated to FS.')
    cr=la.analyze_cpt(cp,profile,method=method,amax_g=.25,mw=6.5,fc=10)
    for i,z in enumerate(cp.depth):
        sv=18*min(z,1)+20*max(0,min(z,3)-1)+21*max(0,z-3)
        se=sv-GW*max(0,z-1)
        if method=='youd2001':
            oldsv=float(cp.sigma_v[i]); oldse=float(cp.sigma_v_eff[i]); qc=float(cp.qc[i]);fs=float(cp.fs[i])
            ff=100*fs/(qc-oldsv)
            vv={nn:scalar_ic((qc-oldsv)/P*(P/oldse)**nn,ff) for nn in [1,.5,.7]}
            nn=1 if vv[1]>2.6 else .5 if vv[.5]<=2.6 else .7; ic=vv[nn]
            kk=1 if ic<=1.64 else -.403*ic**4+5.581*ic**3-21.63*ic**2+33.75*ic-17.88
            rr=min(1.7,(P/oldse)**nn)*qc/P*kk
            crr=.833*rr/1000+.05 if rr<50 else 93*(rr/1000)**3+.08
            rd=1-.00765*z; msf=10**2.24/6.5**2.56;ks=1 if se<=P else (se/P)**-.3
        else:
            rr=cpt_fixed(float(cp.qt[i]),float(cp.sigma_v_eff[i]),10)
            crr=bqc(rr)
            rd=math.exp(-1.012-1.126*math.sin(z/11.73+5.133)+6.5*(.106+.118*math.sin(z/11.28+5.142)))
            msf=1+(min(1.09+(rr/180)**3,2.2)-1)*(8.64*math.exp(-6.5/4)-1.325)
            ks=min(1-min(1/(37.3-8.27*rr**.264),.3)*math.log(se/P),1.1)
        expected=crr*msf*ks/(.65*.25*sv/se*rd)
        ck(f'full CPT {method} z={z}',cr.fs[i],expected,atol=2e-5,rtol=2e-5,note='Default iterative tolerance propagated to FS; independent root resistance used.')

# CSV evidence: original tables not accessed. Independent equations versus retained rounded rows.
csv_results={}
for filename,kind in [('bi2014_table3_1_cpt.csv','CPT'),('ib2010_table3_1_spt.csv','SPT')]:
    rows=list(csv.DictReader((ROOT/'tests/verification/data'/filename).open()))
    refs=[];roots=[];actuals=[];rd_errors=[]
    for row in rows:
        se=float(row['se']);fc=float(row['FC']);z=float(row['z']);mw=float(row['M'])
        if kind=='CPT':
            qt=float(row['qcN'])*P
            expect=cpt_fixed(qt,se,fc)
            got=float(b.cpt_resistance(qt,se,fc,float(row['Ic']),tol=1e-12,max_iter=1000)['resistance'])
            ref=float(row['qc1Ncs'])
        else:
            nn=float(row['Nm'])*float(row['CB'])*float(row['CE'])*float(row['CR'])*float(row['CS'])
            expect=spt_fixed(nn,se,fc)
            got=float(b.spt_resistance(nn,999,fc,se,tol=1e-12,max_iter=1000)[0])
            ref=float(row['N1_60cs'])
        roots.append(expect); actuals.append(got); refs.append(ref)
        rrd=math.exp(-1.012-1.126*math.sin(z/11.73+5.133)+mw*(.106+.118*math.sin(z/11.28+5.142)))
        rd_errors.append(abs(rrd-float(row['rd'])))
    ck('CSV independent root arithmetic '+kind,actuals,roots)
    err=np.abs(np.array(roots)-refs)
    tol=np.minimum(1.5,.02*np.abs(refs)) if kind=='CPT' else np.maximum(1.5,.05*np.abs(refs))
    csv_results[kind]=dict(rows=len(rows),root_max_abs=float(np.max(np.abs(np.array(roots)-actuals))),rounded_reference_max_abs=float(max(err)),rounded_reference_failures=int((err>tol).sum()),reference_tolerance='both abs1.5 and rel2%' if kind=='CPT' else 'abs1.5 or rel5%; diagnostic only, existing verification uses documented outlier policy',rd_max_abs=max(rd_errors),rd_tolerance=.006,original_source_accessed=False)

# LPI integral with and without GWT. Expected clipping is independent per interval.
def lpi_expected(z,fs,gwt=None):
    if len(z)==1: top=[0]; bot=z[:]
    else:
        mid=[(a+b)/2 for a,b in zip(z,z[1:])]
        top=[max(0,z[0]-(z[1]-z[0])/2)]+mid
        bot=mid+[z[-1]+(z[-1]-z[-2])/2]
    if z[0]<=2: top[0]=0
    total=0
    for aa,bb,ff in zip(top,bot,fs):
        a=min(20,max(aa,0 if gwt is None else gwt)); bb=min(bb,20)
        if bb>a and math.isfinite(ff) and ff<1: total+=(1-ff)*(10*(bb-a)-.25*(bb*bb-a*a))
    return total
for z,ff,gw in [([2,4,6,8],[.9,.7,1.2,.8],None),([1.5,2.5],[.5,.5],1.4),([1,3],[math.nan,.5],2.5),([5],[.5],4),([19,21],[.5,.5],0)]:
    ck('LPI water clipping '+str((z,gw)),lc.liquefaction_potential_index(np.array(z),np.array(ff),gw),lpi_expected(z,ff,gw))
for l,cat in [(0,'very_low'),(1e-8,'low'),(5,'low'),(5.00001,'high'),(15,'high'),(15.00001,'very_high')]: ck('LPI category '+str(l),lc.lpi_category(l),cat)
statuses,fsout=lc.assign_status(depth=np.array([0,35,5,5,5,5,5,5,5]),gwt_depth=1,sigma_v_eff=np.ones(9),fs=np.array([.5,.5,.5,.5,math.nan,.99999,1,1.09999,1.1]),target_fs=1.1,max_depth=30,clay_like=np.array([False,False,True,False,False,False,False,False,False]),dense=np.array([False,False,False,True,False,False,False,False,False]))
ck('status all branches',statuses.tolist(),['above_gwt','beyond_method_depth','clay_like','non_liquefiable_dense','invalid','liquefiable','marginal','marginal','safe'])
ck('status null FS for excluded classes',fsout[:5],[math.nan]*5)
ck('status explicit exclude wins',lc.assign_status(depth=[0],gwt_depth=1,sigma_v_eff=[0],fs=[math.nan],target_fs=1.1,max_depth=30,clay_like=[True],dense=[True],exclude=[True])[0].tolist(),['excluded_by_user'])
probe('LPI invalid all NaN',lambda:(lc.liquefaction_potential_index(np.array([2,4]),[math.nan,math.nan]),lc.lpi_category(lc.liquefaction_potential_index(np.array([2,4]),[math.nan,math.nan]))),'incomplete assessment, not unconditional very_low')
probe('LPI unsorted depth',lambda:lc.liquefaction_potential_index(np.array([5,2]),[.5,.5]),'reject unsorted depth')
probe('analysis NaN target',lambda:la.analyze_spt(sp,profile,amax_g=.25,mw=7.5,fc=10,target_fs=math.nan).status,'reject nonfinite target')
probe('analysis FC above100',lambda:la.analyze_spt(sp,profile,amax_g=.25,mw=7.5,fc=200).fc,'reject FC>100')
probe('analysis infinite PI',lambda:la.analyze_spt(sp,profile,amax_g=.25,mw=7.5,fc=10,pi=math.inf).status,'reject nonfinite PI other than explicit unknown NaN')

# Layering simple independent geometry, strict split threshold and data domain guards.
simple=SimpleNamespace(borehole_id='X',depth=np.array([1.,2.,3.]),n60=np.array([10.,15.,30.]),refusal=np.array([False]*3),warnings=[])
settings=LayeringSettings(method='spt_uscs_n',min_thickness=.1,n_change_ratio=.5)
pl=spt_uscs_n_layers(simple,['SP']*3,settings)
ck('SPT layering strict change',[(l.top,l.bottom,l.n60_mean) for l in pl.layers],[(0,2.5,12.5),(2.5,3,30)])
logbh=Borehole(id='X',spt=[],log=[dict(top=1,bottom=2,uscs='SP'),dict(top=3,bottom=4,uscs='CL')])
logsimple=SimpleNamespace(borehole_id='X',depth=np.array([2.,3.,4.]),n60=np.array([10.,20.,40.]),refusal=np.array([False,False,True]),warnings=[])
logpl=spt_log_layers(logbh,logsimple,LayeringSettings(method='spt_log'))
ck('SPT log gap and bottom',[(l.top,l.bottom,l.n60_mean) for l in logpl.layers],[(0,3,10),(3,4,20)])
cpsimple=SimpleNamespace(sounding_id='C',depth=np.array([1.,2.,3.,4.]),Ic=np.array([2.,2.,3.,3.]),qt=np.array([5000.]*4),fs=np.array([50.]*4),zone=np.array([6,6,3,3]),warnings=[])
cpl=cpt_layers(cpsimple,LayeringSettings(method='cpt_ic',smoothing_window=.1,min_thickness=.1,merge_ic_tol=0))
ck('CPT layering independent midpoint geometry',[(l.top,l.bottom,l.ic_mean) for l in cpl.layers],[(0,2.5,2),(2.5,4,3)])
ck('CPT layering physical behavior',[l.behaviour for l in cpl.layers],['drained','undrained'])
converted=proposal_to_layers(cpl,id_prefix='L')
ck('CPT proposal saturation convention',converted[0].gamma_sat,converted[0].gamma)
ck('CPT proposal no auto phi',converted[0].design.phi_eff,None)
cpsensitive=SimpleNamespace(sounding_id='S',depth=np.array([1.,1.1,1.2]),Ic=np.array([2.,3.,2.]),qt=np.array([5000.]*3),fs=np.array([50.]*3),zone=np.array([6,1,6]),warnings=[])
sens=cpt_layers(cpsensitive,LayeringSettings(method='cpt_ic',smoothing_window=2,min_thickness=1,merge_ic_tol=10))
ck('CPT layering sensitive barrier',[l.sbtn_zone for l in sens.layers],[6,1,6])
ck('Layering unsorted alignment',lay.sample_arrays([3,1,2],[30,10,20])[:2],([1,2,3],[10,20,30]))
for z,v in [([1,1],[2,3]),([-1,1],[2,3]),([1,math.nan],[2,3]),([1,2],[3]),([[1,2]],[[3,4]])]: probe('Layering reject '+str((z,v)),lambda z=z,v=v:lay.sample_arrays(z,v),'ValueError')
probe('CPT log unsorted',lambda:cpt.stresses_from_unit_weight([3,1],[20,20],0),'reject unsorted integration depths')
clay=SoilLayer(id='clay',top=0,bottom=12,gamma=20,gamma_sat=21,uscs='CL',behaviour='undrained',source_ids=['BH'])
proj=Project(meta=ProjectMeta(name='audit'),investigations=Investigations(boreholes=[bh]),soil_profiles=[SoilProfile(id='PC',gwt=GroundwaterCondition(depth_insitu=1),source_ids=['BH'],layers=[clay])])
ref=ps.refresh_profile(proj,'PC').layers[0]
probes.append(dict(name='CL layer sand method suggestion',actual=clean({k:v.suggested for k,v in ref.selections.items() if k in ['phi_eff','E','su']}),expectation='Known CL layer should not treat sand-only correlations as valid or average them into phi/E suggestions.'))
shallow=SoilProfile(id='shallow',gwt=GroundwaterCondition(depth_insitu=0),layers=[SoilLayer(id='L',top=0,bottom=1,gamma=20,gamma_sat=20)])
nc=cpt.process_cpt(CPTSounding(id='NC',depth=[.01,.02,.03],qc=[10]*3,fs=[.1]*3),shallow)
ncr=la.analyze_cpt(nc,shallow,amax_g=.25,mw=7.5)
probes.append(dict(name='CPT unconverged classification propagated to FS',actual=clean(dict(Ic=nc.Ic,n=nc.n,converged=nc.converged,FS=ncr.fs,status=ncr.status,warnings=ncr.warnings)),expected_independent_first_point=normal(10,.1,.2,.1019),expectation='Nonconverged point retains finite Ic/FC/FS; warning exists, but no invalid status.'))

# I/O round trips are exact SI; invalid header/missing u2 observations remain visible.
(OUT/'si_cpt.csv').write_text('depth (cm),qc (MPa),fs (kPa),u2 (kPa)\n100,5,50,100\n200,4,40,\n')
imp=import_cpt(OUT/'si_cpt.csv','import',gwt_depth=0)
ck('IO metric conversion',imp.depth+imp.qc+imp.fs,[1,2,5000,4000,50,40])
probes.append(dict(name='IO partial missing u2',actual=clean(imp),expectation='Missing u2 must be disclosed; zero is an engineering assumption.'))
(OUT/'unknown_unit.csv').write_text('depth (m),qc (kN/m2),fs (kPa)\n1,5000,50\n')
probe('IO unknown header unit',lambda:import_cpt(OUT/'unknown_unit.csv','unknown',gwt_depth=0),'recognize kN/m2 as kPa or reject; do not silently multiply by1000')
(OUT/'spt.csv').write_text('depth (ft),N\n3.280839895,20\n6.56167979,50/12\n')
si=import_spt(OUT/'spt.csv','SI')
ck('IO SPT feet conversion',[v.depth for v in si.spt],[1,2],atol=1e-9)
ck('IO SPT refusal',[v.refusal for v in si.spt],[False,True])

# Education arithmetic and graph implementation checked independently.
for m in [5.5,6.5,7.5,8.5]:
    ck('EDU LiqMsfCurve Idriss '+str(m),min(1.8,6.9*math.exp(-m/4)-.058),10**2.24/m**2.56)
    ck('EDU LiqMsfCurve AS '+str(m),min(1.8,(m/7.5)**-2.56),(m/7.5)**-3.3)
ck('EDU LPI example',lpi_expected([2,4,6,8],[.9,.7,1.2,.8]),9.975)
ck('EDU quiz first interval contribution',.1*(10*3-.25*9),1.80,note='liquefaction_student.ts:421-422 uses old [1,3] cell despite Example2 extending to0.')
ck('EDU text Youd SPT ncs',yfc(12,10),13.13,atol=.005,rtol=0)
ck('EDU text Youd SPT CRR',yc(yfc(12,10)),.142,atol=.0005,rtol=0)
ck('EDU text CSR',.65*.25*92.5/63.07*(1-.00765*5),.229,atol=.0005,rtol=0)
ck('EDU classification worked1',uscs.classify(fines=10,gravel=0,LL=35,PI=15,D10=.1,D30=.3,D60=.7).symbol,'SW-SC')
ck('EDU classification worked2',uscs.classify(fines=60,gravel=0,LL=40,PI=18).symbol,'CL')
ck('EDU classification base example',uscs.classify(fines=8,gravel=20,LL=35,PI=12,D10=.1,D30=.5,D60=5).symbol,'SP-SC')
ck('EDU CPT normal example',[*normal(5000,50,100,80)],[56.97,1.0204,2.1093,.6931],atol=.005,rtol=0)
ck('EDU CPT clay example',[*normal(800,60,100,80)],[8.75,8.571,3.3206,1],atol=.005,rtol=0)
ck('EDU U-line plotted LL16 endpoint',7.2,.9*(16-8))
ck('EDU U-line plotted LL74.6 endpoint',60,.9*(74.6-8),atol=.1,rtol=0)
ck('EDU CLML shaded rectangle LL29 PI4.5',uscs.fines_type(29,4.5),'CL-ML',note='Rectangle includes point; engine/independent A-line(.73*9=6.57) places it in M. Figure overstates hatched region.')
ck('EDU grading D10 guide at .075',8,10,note='Graph curve explicitly gives8% at .075mm; D10 arrow nevertheless points there.')
ck('EDU SPT FC35 dense boundary x coordinate',(30-5)/1.2,30,note='Graph x axis is N1_60, vertical line at30 labeled Ncs30; FC35 threshold is20.8333 on plotted x axis.')

# Record exact public surface and claims; this is inventory, not assertion of primary-source verification.
files=[ROOT/'geotek/core/units.py',ROOT/'geotek/core/constants.py',ROOT/'geotek/engine/stresses.py']
for sub in ['insitu','classification','layering','correlations','liquefaction']: files+=list((ROOT/'geotek/engine'/sub).glob('*.py'))
files += [ROOT/'geotek/services'/f for f in ['parameters.py','layering.py','module1.py']]+[ROOT/'geotek/io/tabular.py']
inventory=[]
for file in files:
    tree=ast.parse(file.read_text())
    for node in tree.body:
        if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and not node.name.startswith('_'):
            if isinstance(node,ast.FunctionDef):
                inventory.append(dict(file=str(file.relative_to(ROOT)),symbol=node.name,line=node.lineno,end_line=node.end_lineno,docstring=ast.get_docstring(node),kind='function'))
            else:
                inventory.append(dict(file=str(file.relative_to(ROOT)),symbol=node.name,line=node.lineno,end_line=node.end_lineno,docstring=ast.get_docstring(node),kind='dataclass'))
                for child in node.body:
                    if isinstance(child,ast.FunctionDef) and not child.name.startswith('_'):
                        inventory.append(dict(file=str(file.relative_to(ROOT)),symbol=node.name+'.'+child.name,line=child.lineno,end_line=child.end_lineno,docstring=ast.get_docstring(child),kind='method'))
registry=[dict(id=x.id,parameter=x.parameter,unit=x.unit,source=x.source,inputs=x.inputs,reference=x.reference,reliability=x.reliability,validity=x.validity,options=x.options,verified_in_code=x.verified,review='knowledge-reviewed; arithmetic checked independently; original publication not accessed') for x in REGISTRY.values()]
result=dict(timestamp=str(dt.datetime.now(dt.timezone.utc)),checks=checks,probes=probes,inventory=inventory,registry=registry,csv_results=csv_results,summary=dict(total=len(checks),passed=sum(c['status']=='PASS' for c in checks),failed=sum(c['status']=='FAIL' for c in checks),probes=len(probes)))
(OUT/'results.json').write_text(json.dumps(clean(result),ensure_ascii=False,indent=2))
print(json.dumps(result['summary']))
for c in checks:
    if c['status']=='FAIL': print(json.dumps(c,ensure_ascii=False))
