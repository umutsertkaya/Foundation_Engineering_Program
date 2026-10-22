"""Read-only GeoTek B audit. All expected values computed independently below.
Run with /tmp/geotek-audit/venv/bin/python; production imports only supply actuals.
"""
import sys, math, json, pathlib, warnings
sys.path.insert(0, str(pathlib.Path.cwd()))
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq, minimize_scalar
from geotek.engine.earth_pressure import coefficients as ep
from geotek.engine.earth_pressure.distribution import lateral_pressure, resultant
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.earth_pressure.log_spiral import log_spiral_kp
from geotek.engine.bearing import bearing_factors, bearing_capacity
from geotek.engine.stability import SoilBand, SurfaceLoad, SlopeModel, bishop, search_critical_circle
from geotek.core.models import SoilLayer, SoilProfile, GroundwaterCondition, DesignParameters

OUT=[]
def record(name, actual, expected=None, unit='', tol=1e-9, **kw):
    row=dict(name=name,actual=actual,expected=expected,unit=unit,**kw)
    if expected is not None and isinstance(actual,(float,int)):
        row.update(error=actual-expected, normalized_error=abs(actual-expected)/max(abs(expected),1), pass_tolerance=abs(actual-expected)<=tol*(1+abs(expected)))
    OUT.append(row)
def probe(name, fn, expected='explicit rejection'):
    try:
        with warnings.catch_warnings(record=True) as ws:
            warnings.simplefilter('always'); a=fn()
        if hasattr(a,'q_ult'): a=dict(q_ult=a.q_ult,Q_ult=a.Q_ult)
        elif hasattr(a,'fs'): a=dict(fs=a.fs,xc=a.xc,yc=a.yc,R=a.radius)
        elif hasattr(a,'K'): a=dict(K=a.K,force=a.force,rho=a.rho)
        elif hasattr(a,'Kp'): a=dict(Kp=a.Kp)
        record(name,a,expectation=expected,warnings=[str(x.message) for x in ws])
    except Exception as exc: record(name,dict(error_type=type(exc).__name__,message=str(exc)),expectation=expected)

def rankine(phi,beta=0,active=True):
    # Principal stress circle, for inclined ground stress transformation.
    p,b=map(math.radians,(phi,beta)); C=math.cos(b)
    if beta==0: return (1-math.sin(p))/(1+math.sin(p)) if active else (1+math.sin(p))/(1-math.sin(p))
    root=math.sqrt(C*C-math.cos(p)**2)
    return C*(C-root)/(C+root) if active else C*(C+root)/(C-root)

def wedge_at(rho,H,gamma,phi,delta=0,theta=0,beta=0,q=0,kh=0,kv=0,active=True):
    # Intersect a ray from toe with y=H+(x+H tan(theta))*tan(beta).
    p,d,t,b,r=map(math.radians,(phi,delta,theta,beta,rho))
    xa=-H*math.tan(t); x=(H-xa*math.tan(b))/(math.tan(r)-math.tan(b))
    y=x*math.tan(r); A=H*(x+math.tan(t)*y)/2
    W=gamma*A+q*(x-xa)
    s=1 if active else -1
    # Force reaction direction angles: wall=t+s*delta; plane=90+rho-s*phi.
    aw=t+s*d; ar=math.pi/2+r-s*p
    det=math.sin(ar-aw)
    bx=s*kh*W; by=(1-kv)*W
    P=(bx*math.sin(ar)-by*math.cos(ar))/det
    R=(by*math.cos(aw)-bx*math.sin(aw))/det
    residual=np.array([P*math.cos(aw)+R*math.cos(ar)-bx,P*math.sin(aw)+R*math.sin(ar)-by])
    return P, float(np.linalg.norm(residual)/max(W,1))

def wedge_reference(**kw):
    active=kw.pop('active',True); beta=kw.get('beta',0); theta=kw.get('theta',0)
    sign=-1 if active else 1
    f=lambda r: sign*wedge_at(r,active=active,**kw)[0]
    # Passive reaction must remain compressive: det=sin(ar-aw)>0.
    upper=90+theta if active else min(90+theta,90-kw['phi']+theta-kw.get('delta',0))
    res=minimize_scalar(f,bounds=(max(beta,0)+1e-5,upper-1e-5),method='bounded',options={'xatol':1e-11})
    return -res.fun if active else res.fun, res.x

def factors(phi,method):
    # asinh(tan(phi)) identity and expm1 give a stable phi->0 reference.
    if phi==0: return 5.14,1.,0.
    t=math.tan(math.radians(phi)); logn=math.pi*t+2*math.asinh(t)
    nq=math.exp(logn); nc=math.expm1(logn)/t
    ng={'vesic':2*(nq+1)*t,'hansen':1.5*math.expm1(logn)*t,'meyerhof':math.expm1(logn)*math.tan(math.radians(1.4*phi))}[method]
    return nc,nq,ng

def profile(rows,gwt=50):
    return SoilProfile(id='audit',gwt=GroundwaterCondition(depth_insitu=gwt),layers=[SoilLayer(id=f'L{i}',top=t,bottom=b,gamma=g,gamma_sat=gs,design=DesignParameters(phi_eff=p,c_eff=c,su=su)) for i,(t,b,g,gs,p,c,su) in enumerate(rows)])

def distribution_ref(rows,H,gwt=50,q=0,top=0,state='active',undrained=False,min_efp=None):
    # Exact integration of independent piecewise affine vertical stress; quadrature
    # splits at every layer, water table, crack and floor crossing.
    def stresses(z):
        sv=0
        for t,b,g,gs,*_ in rows:
            sv+=g*max(0,min(z,b,gwt)-t)+gs*max(0,min(z,b)-max(t,gwt))
        return sv
    def pressure(z):
        row=next(r for r in rows if r[0]-1e-10<=z<=r[1]+1e-10)
        t,b,g,gs,p,c,su=row
        sv=stresses(z)-stresses(top)
        u=9.81*max(0,z-max(gwt,top))
        if undrained: k=1; vertical=sv+q; coh=su; u=0
        else: k=(1-math.sin(math.radians(p))) if state=='at_rest' else rankine(p,active=state=='active'); vertical=sv-u+q; coh=c
        ph=k*vertical+(-1 if state=='active' else 1 if state=='passive' else 0)*2*coh*math.sqrt(k)
        if state=='active': ph=max(ph,0,(min_efp or 0)*(z-top))
        return ph+u
    cuts=sorted(set([top,top+H]+[v for r in rows for v in r[:2] if top<v<top+H]+([gwt] if top<gwt<top+H else [])))
    F=M=0
    for a,b in zip(cuts,cuts[1:]):
        F+=quad(pressure,a,b,epsabs=1e-10,epsrel=1e-12,limit=200)[0]
        M+=quad(lambda z:(z-top)*pressure(z),a,b,epsabs=1e-10,epsrel=1e-12,limit=200)[0]
    return F,M/F if F else math.nan

def bishop_reference(surface,bands,xc,yc,R,n,water=None,kh=0,loads=(),exact_centroid=True):
    # Independent exact line-circle intersections; midpoint integration, independent
    # soil column mass/first moment, and root solve of global moment equilibrium.
    roots=[]
    for (xa,ya),(xb,yb) in zip(surface,surface[1:]):
        m=(yb-ya)/(xb-xa); intercept=ya-m*xa
        if abs(m)>1e4:
            # Near-vertical 1e-6 m wall steps make the quadratic ill-conditioned.
            lo,hi=max(xa,xc-R),min(xb,xc+R)
            def gap(x):return m*(x-xa)+ya-yc+math.sqrt(max(R*R-(x-xc)**2,0))
            if hi>lo and gap(lo)*gap(hi)<=0:roots.append(brentq(gap,lo,hi,xtol=1e-13))
            continue
        A=1+m*m; B=2*(m*(intercept-yc)-xc); C=xc*xc+(intercept-yc)**2-R*R
        disc=B*B-4*A*C
        if disc<0: continue
        for x in ((-B-math.sqrt(disc))/(2*A),(-B+math.sqrt(disc))/(2*A)):
            y=m*x+intercept
            if xa-1e-10<=x<=xb+1e-10 and y<=yc+1e-10: roots.append(x)
    roots=sorted(set(round(x,11) for x in roots))
    if len(roots)!=2: return dict(roots=roots)
    xa,xb=roots; dx=(xb-xa)/n; x=xa+(np.arange(n)+.5)*dx
    ybot=yc-np.sqrt(R*R-(x-xc)**2); ytop=np.interp(x,*zip(*surface))
    W=[]; yg=[]; c=[]; tp=[]
    bands=sorted(bands,reverse=True)
    for xx,lo,hi in zip(x,ybot,ytop):
        mass=moment=0; chosen=None
        for i,(top,g,cc,p) in enumerate(bands):
            lower=bands[i+1][0] if i+1<len(bands) else -math.inf
            upper=math.inf if i==0 else top
            a,b=max(lo,lower),min(hi,upper)
            if b>a: mass+=g*(b-a); moment+=g*(b*b-a*a)/2
            if lower<lo<=upper: chosen=cc,p
        for l,r,q1,q2 in loads:
            if l<=xx<=r:
                q=q1+(q2-q1)*(xx-l)/(r-l); mass+=q; moment+=q*hi
        W.append(mass*dx); yg.append(moment/mass if exact_centroid else (lo+hi)/2); c.append(chosen[0]); tp.append(math.tan(math.radians(chosen[1])))
    W=np.array(W); yg=np.array(yg); c=np.array(c); tp=np.array(tp)
    sn=(x-xc)/R; cs=np.sqrt(1-sn*sn); u=np.zeros(n) if water is None else 9.81*np.maximum(water-ybot,0)
    base=c*dx+np.maximum(W-u*dx,0)*tp
    drive=np.sum(W*sn+kh*W*(yc-yg)/R)
    def residual(F): return F*drive-np.sum(base/(cs+sn*tp/F))
    # Above all m_alpha singularities; seek the admissible positive root.
    fmin=max(1e-8,float(np.max(-sn*tp/cs))+1e-8)
    fs=brentq(residual,fmin,1000,xtol=1e-12)
    return dict(fs=fs,xa=xa,xb=xb,drive=drive,residual=abs(residual(fs))/max(abs(fs*drive),1),x=x.tolist(),weight=W.tolist())

# Coefficients and nominal independent force equilibrium.
for p in (0,20,30,40):
    for b in (0,min(p,10),p):
        for active in (True,False):
            actual=(ep.rankine_ka if active else ep.rankine_kp)(p,b)
            record(f'rankine_{p}_{b}_{active}',actual,rankine(p,b,active))
for active in (True,False):
    for p,d,t,b,kh,kv in ((30,0,0,0,0,0),(35,10,5,8,0,0),(35,10,5,8,.12,.06)):
        ref,rho=wedge_reference(H=5,gamma=18,phi=p,delta=d,theta=t,beta=b,kh=kh,kv=kv,active=active)
        f=(ep.mononobe_okabe_kae if active else ep.mononobe_okabe_kpe) if kh else (ep.coulomb_ka if active else ep.coulomb_kp)
        coeff=f(p,d,t,b,kh,kv) if kh else f(p,d,t,b)
        record(f'closed_vs_equilibrium_{active}_{kh}_{t}',coeff,ref/(.5*18*25*(1-kv)),rho=rho)
        actual=trial_wedge(H=5,gamma=18,phi=p,delta=d,theta=t,beta=b,kh=kh,kv=kv,state='active' if active else 'passive')
        record(f'wedge_vs_independent_{active}_{kh}_{t}',actual.force,ref,'kN/m',tol=1e-8,residual=wedge_at(actual.rho,5,18,p,d,t,b,kh=kh,kv=kv,active=active)[1])

# Steep seismic asymptote: these mechanisms have increasing positive force without a bound.
for eps in (1,.1,.01,.001,.0001,.00001):
    force,res=wedge_at(25+eps,6,18,30,beta=25,kh=.2)
    record(f'unbounded_wedge_rho_minus_beta_{eps}',force,None,'kN/m',equilibrium_residual=res)
a=trial_wedge(H=6,gamma=18,phi=30,beta=25,kh=.2)
record('unbounded_wedge_production',a.force,None,'kN/m',rho=a.rho,K=a.K)
limit=30-math.degrees(math.atan(.2))
for offset in (-1e-6,0,1e-6):
    probe(f'MO_steep_boundary_{offset}',lambda off=offset:ep.mononobe_okabe_kae(30,beta=limit+off,kh=.2),expected='finite up to limit, reject above')
p,d,t,s=map(math.radians,(30,10,5,math.degrees(math.atan(.2))))
record('tbdy_boundary_formula',ep.tbdy_kae_steep(30,10,5,.2),math.cos(p-t-s)**2/(math.cos(s)*math.cos(t)**2*math.cos(d+t+s)))
record('seed_whitman',ep.seed_whitman_dkae(.2),.15)
record('tbdy_seismic',list(ep.tbdy_seismic_coefficients(1.0,2.)),[.2,.1])
record('seismic_coefficient',ep.seismic_coefficient(.4,1.2,.5),.24)
record('surcharge_conversion',ep.surcharge_per_horizontal(10,10,'inclined'),10/math.cos(math.radians(10)))

# Distribution with layers, water, excavation, tension and pressure floor.
cases=[('dry',[(0,10,18,20,30,0,30)],6,50,10,0,'active',False,None),('water_layer_interface',[(0,3,18,20,30,0,30),(3,10,19,21,24,0,40)],6,3,0,0,'active',False,None),('water_inside_layer',[(0,3,18,20,30,0,30),(3,10,19,21,24,0,40)],7,1.2,13,0,'active',False,None),('cohesion',[(0,3,18,18,20,10,30),(3,10,18,18,20,10,30)],6,50,0,0,'active',False,None),('min_efp',[(0,10,18,18,20,10,30)],6,50,0,0,'active',False,5),('undrained',[(0,10,18,20,0,0,30)],6,1,0,0,'active',True,None),('excavated_passive',[(0,3,18,20,30,0,30),(3,10,19,21,24,0,40)],4,1,0,2,'passive',False,None),('at_rest',[(0,10,18,20,30,0,30)],6,2,0,0,'at_rest',False,None)]
for name,rows,H,gw,q,top,state,undrained,floor in cases:
    ref=distribution_ref(rows,H,gw,q,top,state,undrained,floor)
    a=lateral_pressure(profile(rows,gw),H,surcharge=q,top=top,state=state,drainage='undrained' if undrained else 'drained',min_efp=floor)
    record('distribution_'+name,a.force,ref[0],'kN/m'); record('centroid_'+name,a.z_resultant,ref[1],'m')
    record('component_sum_'+name,a.component('effective')[0]+a.component('water')[0],a.force,'kN/m')
mix=profile([(0,2,18,20,30,0,20),(2,10,18,20,0,0,20)],1)
mix.layers[1].behaviour='undrained'
def mix_pressure(z):
    sv=18*z if z<=1 else 18+20*(z-1)
    if z<2:
        u=9.81*max(z-1,0); return (sv-u+10)/3+u
    return max(sv+10+7-40,0)
mixref=quad(mix_pressure,0,6,points=[1,2],epsabs=1e-10)[0]
mixactual=lateral_pressure(mix,6,layerwise=True,surcharge=10,total_stress_surcharge=7)
record('distribution_mixed_drainage_total_stress_boundary',mixactual.force,mixref,'kN/m')
dry=profile([(0,10,18,20,30,10,20)])
probe('distribution_slope_cohesion_error',lambda:lateral_pressure(dry,6,beta=10))
a=lateral_pressure(dry,6,beta=10,slope_cohesion='ignore')
record('distribution_slope_cohesion_ignored',a.force,.5*18*36*rankine(30,10)*math.cos(math.radians(10)),'kN/m',warnings=a.warnings)
for undrained,opts in ((True,dict(beta=5)),(True,dict(method='coulomb',kh=.1)),(False,dict(state='at_rest',beta=5)),(False,dict(method='log_spiral',state='active'))):
    probe('distribution_unsupported_'+str(opts),lambda u=undrained,o=opts:lateral_pressure(dry,6,drainage='undrained' if u else 'drained',**o))
a=lateral_pressure(dry,6,method='coulomb',delta_ratio=.5)
ref,rho=wedge_reference(H=6,gamma=18,phi=30,delta=15)
record('distribution_delta_ratio',a.force,ref*math.cos(math.radians(15)),'kN/m')
wet=profile([(0,10,18,20,30,0,20)],2)
a=lateral_pressure(wet,6,method='coulomb',kh=.1,submerged_kh={'L0':.2})
Kdry=wedge_reference(H=1,gamma=2,phi=30,kh=.1)[0]
Kwet=wedge_reference(H=1,gamma=2,phi=30,kh=.2)[0]
expected=Kdry*(.5*18*4)+Kwet*(36*4+.5*(20-9.81)*16)+.5*9.81*16
record('distribution_submerged_kh',a.force,expected,'kN/m')
a=lateral_pressure(dry,6,method='coulomb',beta=25,kh=.2,steep_seismic=True)
s=math.atan(.2); steepK=math.cos(math.pi/6-s)**2/(math.cos(s)**2)
record('distribution_steep_TBDY_formula',a.force,.5*18*36*steepK,'kN/m',warnings=a.warnings)
rows=[(0,10,18,20,35,0,30)]
for theta,beta in ((10,15),(-10,15)):
    ref,rho=wedge_reference(H=6,gamma=18,phi=35,delta=10,theta=theta,beta=beta,q=20)
    a=lateral_pressure(profile(rows),6,method='coulomb',delta=10,theta=theta,beta=beta,surcharge=20)
    record(f'distribution_battered_surcharge_{theta}',a.force,ref*math.cos(math.radians(theta+10)),'kN/m',rho=rho)
for theta in (-10,10):
    ref,rho=wedge_reference(H=6,gamma=18,phi=35,delta=10,theta=theta,beta=0,active=False)
    a=lateral_pressure(profile(rows),6,state='passive',method='coulomb',delta=10,theta=theta)
    record(f'distribution_passive_projection_{theta}',a.force,ref*math.cos(math.radians(theta-10)),'kN/m',rho=rho)

# Bearing: independent factor identity, closed-form strip and square/inclined cases.
for method in ('meyerhof','hansen','vesic'):
    for p in (0,20,30,40,1e-8,1e-12,1e-16):
        actual=bearing_factors(p,method); expected=factors(p,method)
        for j,label in enumerate(('Nc','Nq','Ngamma')): record(f'bearing_factor_{method}_{p}_{label}',actual[j],expected[j])
    for p in (0,30):
        nc,nq,ng=factors(p,method)
        a=bearing_capacity(method=method,B=2,D=0,phi=p,gamma=18,q=20,c=10)
        record(f'bearing_strip_{method}_{p}',a.q_ult,10*nc+20*nq+18*ng,'kPa')
    nc,nq,ng=factors(30,method); p=math.pi/6; ratio=.5; k=.25
    if method=='meyerhof':
        kp=3; sc=1+.2*kp*ratio; sq=sg=1+.1*kp*ratio; dc=1+.2*math.sqrt(kp)*k; dq=dg=1+.1*math.sqrt(kp)*k
        th=math.degrees(math.atan(.2)); ic=iq=(1-th/90)**2; ig=(1-th/30)**2
    else:
        sc=1+nq/nc*ratio; sq=1+ratio*(math.sin(p) if method=='hansen' else math.tan(p)); sg=1-.4*ratio
        dq=1+2*math.tan(p)*(1-math.sin(p))**2*k; dg=1; dc=1+.4*k if method=='hansen' else 1+(dq-1)*nq/(nq-1)
        base=500+8*10/math.tan(p)
        if method=='hansen': iq=(1-.5*100/base)**5;ig=(1-.7*100/base)**5
        else: m=(2+ratio)/(1+ratio);iq=(1-100/base)**m;ig=(1-100/base)**(m+1)
        ic=(nq*iq-1)/(nq-1)
    expected=10*nc*sc*dc*ic+9*nq*sq*dq*iq+18*ng*sg*dg*ig
    a=bearing_capacity(method=method,B=2,L=4,D=.5,phi=30,gamma=18,q=9,c=10,V=500,H=100)
    record('bearing_rect_depth_inclination_'+method,a.q_ult,expected,'kPa')
    for eps in (1e-3,1e-9,0):
        probe(f'Bprime_{method}_{eps}',lambda e=eps,m=method:bearing_capacity(method=m,B=2,D=0,phi=30,gamma=18,q=0,e_B=1-e),expected='positive finite approaching zero; reject at Bprime=0')

# Bishop normalised equilibrium and 40/80/160 discretization.
surface=[(-30,0),(0,0),(20,10),(50,10)]; R=math.sqrt(250)
for p,water,kh in ((0,None,0),(20,None,0),(20,0,0),(20,None,.1)):
    bands=[(10,20,10,p)]
    model=SlopeModel(surface=surface,layers=[SoilBand(t,g,c,pp) for t,g,c,pp in bands],water_level=water,kh=kh)
    for n in (40,80,160):
        ref=bishop_reference(surface,bands,5,15,R,n,water=water,kh=kh)
        a=bishop(model,5,15,R,n_slices=n)
        if a is None: record(f'bishop_{p}_{water}_{kh}_{n}',None,reference=ref['fs']);continue
        record(f'bishop_{p}_{water}_{kh}_{n}',a.fs,ref['fs'],tol=2e-4,reference_residual=ref['residual'],endpoint_errors=[a.x_exit-ref['xa'],a.x_entry-ref['xb']])
        sl=a.slices; sn=np.sin(np.radians(sl['alpha']));cs=np.cos(np.radians(sl['alpha']));tp=np.tan(np.radians(sl['phi'])); yg=sl['y_base']+sl['height']/2
        drive=np.sum(sl['weight']*sn+kh*sl['weight']*(15-yg)/R)
        resist=np.sum((sl['c']*sl['width']+np.maximum(sl['weight']-sl['u']*sl['width'],0)*tp)/(cs+sn*tp/a.fs))
        record(f'bishop_normalized_residual_{p}_{water}_{kh}_{n}',abs(a.fs*drive-resist)/max(abs(a.fs*drive),1),0,tol=1e-6)
record('bishop_phi0_continuous_reference',bishop_reference(surface,[(10,20,10,0)],5,15,R,100000)['fs'],3*math.pi/20,tol=1e-9)
for name,bands,loads in [('layered',[(10,10,10,20),(3,30,10,20)],()),('surface_load',[(10,20,10,20)],[(0,20,40,40)])]:
    model=SlopeModel(surface=surface,layers=[SoilBand(*b) for b in bands],kh=.2,loads=[SurfaceLoad(*l) for l in loads])
    for n in (40,80,160):
        ref=bishop_reference(surface,bands,5,15,R,n,kh=.2,loads=loads)
        old=bishop_reference(surface,bands,5,15,R,n,kh=.2,loads=loads,exact_centroid=False)
        a=bishop(model,5,15,R,n_slices=n)
        record(f'bishop_seismic_centroid_{name}_{n}',a.fs if a else None,ref['fs'],tol=2e-4,uniform_midheight_reference=old['fs'])

# Analytic log-spiral geometry: quadrature of Green's area / first-moment integrals.
# This avoids the production polygon and its N_SPIRAL=400 discretisation.
def spiral_reference(phi,delta):
    p,d=map(math.radians,(phi,delta)); a=math.pi/4-p/2
    def force(pole):
        start=math.atan2(-1,-pole); end=-a
        if end<start: return math.inf
        rb=math.hypot(pole,1); tp=math.tan(p)
        def geo(t):
            rr=rb*math.exp((t-start)*tp)
            x=pole+rr*math.cos(t); y=rr*math.sin(t)
            xp=rr*(tp*math.cos(t)-math.sin(t)); yp=rr*(tp*math.sin(t)+math.cos(t))
            return x,y,xp,yp
        X,Y,*_=geo(end); h=-Y
        area=.5*(quad(lambda t:geo(t)[0]*geo(t)[3]-geo(t)[1]*geo(t)[2],start,end,epsabs=1e-11)[0]+X*h)
        xmass=.5*(quad(lambda t:geo(t)[0]**2*geo(t)[3],start,end,epsabs=1e-11)[0]+X*X*h)
        weight_moment=-(xmass-pole*area)
        rankine_moment=-h**3*rankine(phi,active=False)/3
        unit_moment=2*math.cos(d)/3+pole*math.sin(d)
        P=-(weight_moment+rankine_moment)/unit_moment
        return P if P>0 else math.inf
    low=-1/math.tan(a)
    xs=np.linspace(low,low+6,1000); vals=np.array([force(x) for x in xs]); i=int(np.argmin(vals))
    r=minimize_scalar(force,bounds=(xs[max(i-1,0)],xs[min(i+1,len(xs)-1)]),method='bounded',options={'xatol':1e-11})
    return 2*r.fun,r.x
for p,d in ((20,0),(30,0),(40,0),(30,10),(30,30),(40,40)):
    ref,pole=spiral_reference(p,d); a=log_spiral_kp(p,d)
    record(f'logspiral_quadrature_{p}_{d}',a.Kp,ref,tol=1e-4,reference_pole=pole,production_pole=a.pole_x)
    record(f'logspiral_horizontal_{p}_{d}',a.Kp_horizontal,ref*math.cos(math.radians(d)),tol=1e-4)
record('logspiral_scale',log_spiral_kp(32,20,H=7,gamma=19).Kp,spiral_reference(32,20)[0],tol=1e-4)

# Threshold crossing from the independently computed moment centroid, not production FS.
def threshold_ref(cc): return bishop_reference(surface,[(10,10,cc,20),(3,30,cc,20)],5,15,R,160,kh=.2)['fs']-.995
cc=brentq(threshold_ref,.1,10)
threshold_model=SlopeModel(surface,[SoilBand(10,10,cc,20),SoilBand(3,30,cc,20)],kh=.2)
record('bishop_layered_FS_threshold',bishop(threshold_model,5,15,R,n_slices=160).fs,.995,cohesion_kPa=cc)

# Wall wrapper: capture its materialised model without modifying source, verify the
# footprint resultant/moment and independently solve its selected circle.
from unittest.mock import patch
from geotek.engine.walls import global_stability as wallgs
from geotek.core.models.walls import GravityGeometry, Backfill, WallLoads
captured={}; original_search=wallgs.search_critical_circle
def capture_search(model,**kw):
    captured['model']=model; captured['search']=kw
    return original_search(model,**kw)
with patch.object(wallgs,'search_critical_circle',capture_search):
    wall_result,wall_check=wallgs.wall_global_stability(GravityGeometry(height=4,base_width=2.5,top_width=2.5),Backfill(gamma=18,phi=30),[SoilBand(0,18,30,20)],WallLoads(surcharge=10,kh=.1),grid=4,seismic=True)
wm=captured['model']; wloads=[(ld.x1,ld.x2,ld.q1,ld.q2) for ld in wm.loads]
wr=bishop_reference(wm.surface,[(b.top,b.gamma,b.c,b.phi) for b in wm.layers],wall_result.xc,wall_result.yc,wall_result.radius,40,kh=wm.kh,loads=wloads)
record('wall_global_selected_circle',wall_result.fs,wr.get('fs'),tol=2e-3,search_domain=captured['search'],circle=[wall_result.xc,wall_result.yc,wall_result.radius],required=wall_check.required,reference_roots=wr.get('roots'),reported_endpoints=[wall_result.x_exit,wall_result.x_entry],reference='independent intersection solver rejects disconnected intervals; search optimum unproved')
record('wall_global_arc_above_base',wall_result.yc-math.sqrt(wall_result.radius**2-(2.49-wall_result.xc)**2),None,'m',expectation='arc <=0 throughout base [0,2.5]')
foot=wm.loads[0]; length=foot.x2-foot.x1
record('wall_footprint_total',length*(foot.q1+foot.q2)/2,240,'kN/m')
record('wall_footprint_moment',length/6*(foot.q1*(2*foot.x1+foot.x2)+foot.q2*(foot.x1+2*foot.x2)),300,'kNm/m')
for weights in ([(100,.2)],[(100,1.8)],[(100,1.)]):
    floads=wallgs._footprint_load(weights,2)
    F=M=0
    for l in floads:
        z=l.x2-l.x1; F+=z*(l.q1+l.q2)/2
        M+=z/6*(l.q1*(2*l.x1+l.x2)+l.q2*(l.x1+2*l.x2))
    record(f'footprint_force_{weights[0][1]}',F,100,'kN/m');record(f'footprint_moment_{weights[0][1]}',M,100*weights[0][1],'kNm/m')

# Education examples: exact stated coordinates and formula arithmetic.
edu_surface=[(-30,5),(0,5),(10,10),(50,10)]
em=SlopeModel(edu_surface,[SoilBand(10,18,10,0)])
for n in (4,40,80,160):
    a=bishop(em,5.2488,14.5392,17.9867,n_slices=n)
    ref=bishop_reference(edu_surface,[(10,18,10,0)],5.2488,14.5392,17.9867,n)
    record(f'education_slope_example1_{n}',a.fs,ref['fs'],tol=2e-4,production_endpoints=[a.x_exit,a.x_entry],independent_endpoints=[ref['xa'],ref['xb']],published_endpoints=[0,11.6])
for n in (4,20,40):
    a=search_critical_circle(SlopeModel(edu_surface,[SoilBand(10,18,10,25)]),x_range=(0,20),y_range=(10,30),tangent_range=(-5,5),n_slices=n)
    ref=bishop_reference(edu_surface,[(10,18,10,25)],a.xc,a.yc,a.radius,n)
    record(f'education_slope_search_{n}',a.fs,ref.get('fs'),tol=2e-3,circle=[a.xc,a.yc,a.radius],published={4:2.0288,20:2.1595,40:2.1626}[n])
for what,opts in [('water',dict(water_level=10)),('kh',dict(kh=.1))]:
    model=SlopeModel(edu_surface,[SoilBand(10,18,10,25)],**opts)
    a=search_critical_circle(model,x_range=(0,20),y_range=(10,30),tangent_range=(-5,5))
    record('education_slope_'+what,a.fs,None,published=.9112 if what=='water' else 1.7440,circle=[a.xc,a.yc,a.radius])
nc,nq,ng=factors(30,'vesic'); dq=1+.25*math.tan(math.pi/6)
record('education_bearing_example1',bearing_capacity(method='vesic',B=2,D=1,phi=30,gamma=18,q=18).q_ult,18*nq*dq+18*ng,'kPa',published=782.27)
record('education_bearing_example2',bearing_capacity(method='vesic',B=2,D=1,phi=0,c=50,gamma=18,q=18).q_ult,50*5.14*1.2+18,'kPa',published=326.40)
record('education_rankine_example',lateral_pressure(profile([(0,10,18,20,30,0,30)]),5,surcharge=10).z_resultant,(10/3*5*2.5+(.5*30*5)*(10/3))/(10/3*5+.5*30*5),'m',published=3.1818)
for b in (0,10,20):record(f'figure_sloping_beta_{b}',rankine(30,b),None,published={0:.3333,10:.3495,20:.4142}[b])

# Invalid and unsupported API data, with actual outcomes retained instead of assertions.
for name,fn in [
 ('rankine_nan',lambda:ep.rankine_ka(float('nan'))),('rankine_negative_phi',lambda:ep.rankine_ka(-20)),('rankine_negative_steep_beta',lambda:ep.rankine_ka(30,-40)),
 ('coulomb_delta_exceeds_phi',lambda:ep.coulomb_ka(30,50)),('coulomb_inf',lambda:ep.coulomb_ka(30,float('inf'))),
 ('seismic_negative_kh',lambda:ep.seismic_angle(-.2)),('seismic_kv1',lambda:ep.seismic_angle(.2,1)),('seed_negative',lambda:ep.seed_whitman_dkae(-.2)),
 ('surcharge_bad_basis_beta0',lambda:ep.surcharge_per_horizontal(10,0,'bad')),('tbdy_nan',lambda:ep.tbdy_seismic_coefficients(float('nan'),2)),
 ('wedge_bad_state',lambda:trial_wedge(H=5,gamma=18,phi=30,state='bad')),('wedge_kv1',lambda:trial_wedge(H=5,gamma=18,phi=30,kv=1)),('wedge_negative_phi',lambda:trial_wedge(H=5,gamma=18,phi=-20)),('wedge_n0',lambda:trial_wedge(H=5,gamma=18,phi=30,n_grid=0)),
 ('logspiral_H_negative',lambda:log_spiral_kp(30,10,H=-1)),('logspiral_gamma_negative',lambda:log_spiral_kp(30,10,gamma=-18)),
 ('bearing_nan_B',lambda:bearing_capacity(method='vesic',B=float('nan'),D=0,phi=30,gamma=18,q=0)),('bearing_negative_gamma',lambda:bearing_capacity(method='vesic',B=2,D=0,phi=30,gamma=-18,q=0)),('bearing_negative_c',lambda:bearing_capacity(method='vesic',B=2,D=0,phi=30,gamma=18,q=0,c=-10)),
 ('bearing_negative_H',lambda:bearing_capacity(method='vesic',B=2,D=0,phi=30,gamma=18,q=0,V=400,H=-80)),('bearing_overlarge_H',lambda:bearing_capacity(method='vesic',B=2,D=0,phi=30,gamma=18,q=0,c=10,V=100,H=1000)),('bearing_unknown_method_phi0',lambda:bearing_factors(0,'bad')),
 ('resultant_descending_z',lambda:resultant([1,0],[10,10])),('resultant_mismatched',lambda:resultant([0,1,2],[1,2])),('resultant_nan',lambda:resultant([0,1],[float('nan'),2])),
 ('resultant_zero_sigma',lambda:resultant([0,1],[0,0])),
 ('slope_surface_empty',lambda:SlopeModel([], [SoilBand(10,18)])),('slope_nan',lambda:SlopeModel([(0,float('nan')),(10,10)],[SoilBand(10,18)])),('slope_negative_gamma',lambda:SlopeModel(surface,[SoilBand(10,-18)]))]: probe(name,fn,expected='force=0; centroid undefined NaN' if name=='resultant_zero_sigma' else 'explicit rejection')
model=SlopeModel(surface,[SoilBand(10,20,c=10,phi=20)])
for name,opts in [('n0',dict(n_slices=0)),('negative_radius',dict()),('no_convergence',dict(max_iter=0)),('nan_center',dict()),('inf_center',dict())]:
    rr=-R if name=='negative_radius' else R; xc=float('nan') if name=='nan_center' else float('inf') if name=='inf_center' else 5
    probe('bishop_'+name,lambda rr=rr,xc=xc,opts=opts:bishop(model,xc,15,rr,**opts),expected='explicit rejection or None')

def encode(value):
    if isinstance(value,np.generic): return value.item()
    if isinstance(value,np.ndarray): return value.tolist()
    return repr(value)
def clean(value):
    if isinstance(value,np.generic):value=value.item()
    if isinstance(value,float) and not math.isfinite(value):return str(value)
    if isinstance(value,dict):return {k:clean(v) for k,v in value.items()}
    if isinstance(value,(tuple,list)):return [clean(v) for v in value]
    if isinstance(value,np.ndarray):return clean(value.tolist())
    return value
path=pathlib.Path(__file__).with_name('results.json')
path.write_text(json.dumps(clean(OUT),indent=2,allow_nan=False,default=encode))
print(json.dumps(dict(rows=len(OUT),failed_comparisons=[r for r in OUT if r.get('pass_tolerance') == False]),indent=2,default=encode))
