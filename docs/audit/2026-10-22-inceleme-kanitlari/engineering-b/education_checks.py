"""Reproduce the small education text/figure checks from repository root."""
import sys,json,pathlib
sys.path.insert(0,str(pathlib.Path.cwd()))
from geotek.engine.bearing import bearing_capacity
r=bearing_capacity(method='vesic',B=2,D=0,phi=0,c=10,gamma=18,q=0,V=100,H=30)
data={'bearing_education_warning':{'input':dict(method='vesic',B=2,D=0,phi=0,c=10,gamma=18,q=0,V=100,H=30),'H_kN_per_m':30,'area_times_su_kN_per_m':20,'actual_q_ult_kPa':r.q_ult,'actual_Q_ult_kN_per_m':r.Q_ult,'education_claim':'bearing.ts:142 both Hansen and Vesic reject H>A su'},'bishop_figure_shear':{'base_screen_vector':[90,-20],'drawn_shear_screen_vector':[-38,9],'dot_product':-3600,'expected_resistance_direction':'toward upper right, opposing leftward/downward sliding'}}
pathlib.Path(__file__).with_name('education_checks.json').write_text(json.dumps(data,indent=2))
print(json.dumps(data,indent=2))
