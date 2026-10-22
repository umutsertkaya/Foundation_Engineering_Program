"""Independent review of ENG-B-007..010 (finite representative subset for 007)."""
import json,math
from pathlib import Path
from geotek.engine.stability import SlopeModel,SoilBand,bishop,search_critical_circle
from geotek.engine.bearing import bearing_capacity,bearing_factors
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.earth_pressure.coefficients import rankine_ka
x,y,R=5.2488,14.5392,17.9867
surface=[(-30,5),(0,5),(10,10),(50,10)]
left=x-math.sqrt(R*R-(y-5)**2);right=x+math.sqrt(R*R-(y-10)**2)
model=SlopeModel(surface,layers=[SoilBand(10,18,10,0)])
a=bishop(model,x,y,R,n_slices=4);b=bishop(model,x,y,R,n_slices=40)
r={'B008':dict(independent_endpoints=[left,right],production_endpoints=[b.x_exit,b.x_entry],published_endpoints=[0,11.60],FS4=a.fs,FS40=b.fs)}
a=bearing_capacity(method='vesic',B=2,D=0,phi=0,c=10,gamma=18,q=0,V=100,H=30)
reverse=SlopeModel(surface=[(-30,10),(0,10),(10,5),(50,5)],layers=[SoilBand(10,18,10,25)])
try:
 z=search_critical_circle(reverse,x_range=(-10,20),y_range=(10,30),tangent_range=(-5,5),n_x=4,n_y=4,n_tangent=4);rev=dict(returned_FS=z.fs)
except Exception as e:rev=dict(error=type(e).__name__,message=str(e))
r['B009']=dict(Vesic_H=30,Asu=20,returned_q_ult=a.q_ult,returned_Q_ult=a.Q_ult,reverse=rev)
base=(230-140,428-448);shear=(102-140,457-448)
r['B010']=dict(base_screen_vector=base,shear_screen_vector=shear,dot_product=sum(a*b for a,b in zip(base,shear)),expected_resistance='toward right/up for a slice moving left/down')
r['B007']={}
for n,fn in [('bearing_factors_unknown_phi0',lambda:bearing_factors(0,'bad')),('bearing_negative_gamma',lambda:bearing_capacity(method='vesic',B=2,D=0,phi=30,c=0,gamma=-18,q=0).q_ult),('wedge_unknown_state',lambda:trial_wedge(H=5,gamma=18,phi=30,state='bad').K),('rankine_nan',lambda:rankine_ka(math.nan))]:
 try:
  z=fn();r['B007'][n]=str(z) if isinstance(z,float) and not math.isfinite(z) else z
 except Exception as e:r['B007'][n]=dict(error=type(e).__name__,message=str(e))
(Path(__file__).resolve().parent/'b-education.json').write_text(json.dumps(r,indent=2,allow_nan=False));print(json.dumps(r,indent=2,allow_nan=False))
