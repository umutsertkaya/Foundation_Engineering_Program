from common import *
profiles=[]
for name,gwt,layers in [('QA Kum 0-40m (kaynak test)',100,[{'id':'S1','top':0,'bottom':40,'gamma':18,'gamma_sat':20,'design':{'phi_eff':30,'c_eff':0}}]),('QA Sulu iki tabaka',2,[{'id':'S1','top':0,'bottom':6,'gamma':18,'gamma_sat':20,'design':{'phi_eff':30,'c_eff':0}},{'id':'S2','top':6,'bottom':40,'gamma':19,'gamma_sat':21,'design':{'phi_eff':32,'c_eff':0}}])]:
 r=api('POST','/api/m/soil/profiles',json={'name':name,'origin':'manual','source_ids':[],'gwt':{'depth_insitu':gwt},'layers':layers});r.raise_for_status();profiles.append(r.json())
api('PUT','/api/project/active-profile',json={'profile_id':profiles[0]['id']})
examples=Path('/workspace/Foundation_Engineering_Program/examples')
for typ,idkey,idv in [('cpt','sounding_id','QA-CPT'),('spt','borehole_id','QA-SPT')]:
 data={idkey:idv}
 if typ=='cpt':data.update(qc_unit='MPa',delimiter=';',decimal=',')
 r=api('POST',f'/api/m/soil/import/{typ}',data=data,files={'file':(f'ornek_{typ}.csv',(examples/f'ornek_{typ}.csv').read_bytes(),'text/csv')});r.raise_for_status()
inv=api('GET','/api/m/soil/investigations').json()
for key,route in [('cpts','cpts'),('boreholes','boreholes')]:
 for v in inv[key]:
  v['gwt_depth']=3;api('PUT',f'/api/m/soil/{route}/{v["id"]}',json=v)
(OUT/'seed-profiles.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2))
api('POST','/api/project/save')
with sync_playwright() as p:
 c,page=launch(p);goto(page,'/m/walls/new');dump(page);shot(page,'03-wall-picker-copied-profile');c.close()
