from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
rows=[
('ENG-A-001','Onay, doğrudan importer','review.py / A_import_unknown_qc_header','5000kPa yerine5e6kPa; qc_unit=kPa override5000 doğru. HTTP/UI qc_unit zorunlu olduğundan aynı UI birim bozulması gösterilmedi.'),
('ENG-A-002','Onay','results.json / clay_suggestions','Gerçek CL/undrained SPT projesinde phi37.186211355/E12766.95 ve validity_ok=True. Sorun öneri/uygulanabilirlik; otomatik tasarım onayı iddia edilmez.'),
('ENG-A-003','Onay, muhafazakâr yönde','results.json / A_LPI_GWT_*','z1.5/2.5,GWT1.4 için9 yerine7.12; single5/GWT4 için21.875/very_high yerine3.875/low. Kuru zon fazladan sayılıyor. Mevcut web DTO LPI taşımıyor.'),
('ENG-A-004','Onay, eğitim','results.json / A_edu_*','MSF çizimi iki adlandırılmış motor/metin denklemiyle uyuşmuyor. M5.5 beklenen2.21142/2.78295, çizilen1.68659/1.8.'),
('ENG-A-005','Onay, validity sözleşmesi','supplement.json / A_registry_physical_domain','Negatif su/E/sigma_p ve Dr141.42% doğru aritmetik ama valid=True. Sentetik/fiziksel tutarsız girişler; negatif su/E için son tasarım model onay koruması var.'),
('ENG-A-006','Onay, eksik girdi izi','supplement.json / A_partial_u2','Boş u2 ölçülmüş0 ile aynı saklanıyor; maske/uyarı alanı yok. q_t/Bq/u2 temelli adaylar etkilenebilir; belli bir bilinmeyen u2 değeri varsayılmadı.'),
('ENG-A-007','Onay, library summary','domain-probes.json / invalid_pipeline_summary','Gerçek CPT pipeline status=[invalid,invalid], minFS=null iken LPI0/very_low. Status sayımı ayrıca invalid bilgisini koruyor; HTTP DTO LPI taşımıyor.'),
('ENG-A-008','Onay, yüzey sınırında','supplement.json / A_CPT_unconverged','Default50iter ilk n=.882114475/Ic2.212836314; bağımsız Brent n=.786209501/Ic2.457110806. Warning var; finite FS ve liquefiable yine taşınıyor. z=.01m, normal saha genellemesi yok.'),
('ENG-A-009','Kısmen','supplement.json / A_oversize_borehole','Borehole1000mm kabul ve CB1.15 teyit. Açıklanan tablo aralığı dışında sessiz extrapolasyon kaydı onay; rod>30 için1 olması tek başına yanlış katsayı kanıtı değildir; unknown sampler normal modelce engellenir.'),
('ENG-A-010','Onay, ortak girdi modeli','supplement.json / A_lab_grain_sum','Gerçek LabRecord FC20+gravel90 kabul, kum−10 ve GC. Tekil0..100 sınırları toplam kontrolü sağlamıyor.'),
('ENG-A-011','Kısmen, anlatım tutarlılığı','supplement.json / A_education','Açıkça [1,3] verilen sorunun1.8 integrali doğru. Aynı örneğe referans verilirse motor/metindeki [0,3] katkısı2.775 ile interval sözleşmesi çelişiyor; aritmetik hata diye sunulmasın.'),
('ENG-A-012','Onay, statik şekil geometrisi','supplement.json / A_education','LL29/PI4.5 A-line6.57 altında M; CLML boyaması içinde. D10.075mm eğride8% ama etiket10%; FC35 Ncs30 eşiği N1=20.8333, evrenselx30 çizgisi yanıltıcı.'),
('ENG-A-013','Kısmen, temsilî guardlar','domain-probes.json','SBTn inf→2, FCNaN→17, CsigmaNaN→.3, infsigma phi0valid, unsortedLPI−24.75 bağımsız tekrarlandı. Bütün public fonksiyonlar/üst UI yolları tek tek koşulmadı; kütüphane sertleştirme kapsamı.'),
('ENG-B-001','Onay','results.json / wedge','Düz duvar skaler kuvvet dengesinde rho→beta+ için1967→1.7156e8kN/m artıyor. Production299682.4/rho25.0057296 sabitkesim. Sonsuz dolgu altında finite optimum yok.'),
('ENG-B-002','Onay','results.json / bishop','Üretimin aynı slice geometrisinde bağımsız kütle ve birinci moment+Brent ref1.211442108, actual1.222776980; homojen ref.982327581/actual.982327705 eşleşiyor. B analitik endpoint referans1.211304678 ile küçük fark geometri probundan; centroid kusuru sabit.'),
('ENG-B-003','Onay, genel dağılım','supplement.json / B_passive_projection','Pasif Pdir=cosδ n−sinδ t, yataycos(δ−θ). theta−10 actual2556.344875/ref2402.178415 +6.42%; theta+10−6.03%. Mevcut ön pasif UI çağırıcıları theta0 olduğundan tüm UI sonuçları etkileniyor denemez.'),
('ENG-B-004','Onay çekirdek; etki sınırlı','supplement.json / B_wall_global_gap; global-grid.json','Grid4 seçilen yay taban içinde0.00621m yukarı çıkıyor,4 gerçek crossing var ama tek interval dönüyor. Grid8/varsayılan12 aynı girdide bu gap yok. Geçerli alternatif globalFS ve emniyet yönü belirlenmedi; varsayılan UI hata örneği gibi sunulmasın.'),
('ENG-B-005','Onay, genel dağılım','supplement.json / B_battered_surcharge','Bağımsız kama alanı/yüzey yükü theta+10:165.297897/ref163.282373; theta−10:99.523180/ref100.857049. q düzeltmesi1/(1+tanθtanβ). Layered wall çağırıcısı ayrıca düzeltiyor; aynı UI wall hatası yok.'),
('ENG-B-006','Onay, patolojik sayısal sınır','results.json / B_Nc_near_zero','phi1e−16° Nc−127.222187 yerine pi+2=5.14159265. Exact0 dalı ve20/30/40° nominal üç yöntem bu genellemeye dahil değil.'),
('ENG-B-007','Kısmen, temsilî kütüphane probları','b-education.json / B007','Unknownmethod phi0 kabul; negatifgamma negatifcapacity; badstate pasifkama; RankineNaN teyit. Listedeki tüm kombinasyonlar bağımsız yeniden koşulmadı; üst Pydantic/UI güvenliği hakkında toplu sonuç yok.'),
('ENG-B-008','Onay, eğitim geometrisi','b-education.json / B008','Bağımsız yatay doğru/daire kökleri−9.999971762/22.653312066; metindeki0/11.60 başka geometri. n4/n40 üretim FS yaklaşık.55336/.63250; endpoint hatası motorFS hatası değildir.'),
('ENG-B-009','Onay, davranış metni','b-education.json / B009','Kendi ters slope araması mirror GeoTekError verdi. Vesic H30>A_su20 iken q21.4/Q42.8 döndü. Metin-kod farkı teyit; doğru normatif Vesic limitini birincil kaynaktan seçmedik.'),
('ENG-B-010','Onay, statik kuvvet yönü','b-education.json / B010','Taban ekran vektörü(90,−20), S(−38,9), skalerçarpım−3600. Etiket direnç ve kütle sola/aşağı kabulünde kuvvet ters; pixelrender değil kaynak koordinatı incelendi.'),
('ENG-C-001','Onay, kritik zarf eksikliği','results.json / static_envelope','Ayrı wetpressure quad+Brent statik D18.9085960725/M2399.835292; servis statik aynı. SDS.1 tekcase D8.039288389/M436.945004. Geçerli farklı design/seismic su profiliyle statik durum eksik. UI kanıtı root functional ajanının; fixture APIseed sınırı korunmalı.'),
('ENG-C-002','Onay; kaynak=knowledge/config','results.json / tbdy; layered-cap.json','Legacy actual sliding1.38694/allpassed vs.6cap.991736. Layered real-engine actual1.384545602/allpassed vs.990022317; ayrı V450.298347/H248.092670. Hem motor path teyit; canlı API/UI falsepass bu S4te koşulmadı. Orijinal TBDY PDF görülmedi.'),
('ENG-C-003','Onay, model/diyagram tutarlılığı','results.json / multi','Tributary ilan edilen reaksiyonlarla V2=−45, diagram−53.12499; hinge V2 dengeyi tutuyor. Tributary ampirik yüklerinin globalmoment artığı tek başına yöntemin geçersizliği değildir.'),
('ENG-C-004','Kısmen, sözleşme kesin','results.json / multi','vmax87.0833/81.09375 vs dönen dizimax257.9409/241.01559 teyit. Kod ilk tabanaltı shear sıfırından sonrasını bilerek dışlıyor ve toe_force_not_balanced uyarısı veriyor. Alan docstring largestwholewall ile çelişir; fiziksel altuçtalebi doğruluğu kaynak/model doğrulaması gerektirir.'),
('ENG-C-005','Onay, eğitim/motor farkı','domain-probes.json / C_education_soft_clay_area','SVG rampa+plateau+alt-rampa alan.75pH; motordaki üst-rampa+plateau.875pH. H8p29.92:179.52/209.44. Ns=gammaH/Su_b ve henkel_default=basal.b_eff kodu metinle farkı destekliyor; kaynakşekil doğrulanmadı.'),
('ENG-C-006','Onay, alt seviye domain','domain-probes.json / C_low_level_pile_domain','depthincrease−2 ile D−4.629270464; allowstressNaN ile sectionnan. Gravitygeometry infheight/embed7>height6 kabul. Normal SheetPileStructure depthincrease>=0 koruması var; bütün UI akışlarına erişim gösterilmedi.'),
]
assessment=dict(date='2026-10-22',checkout='b9392f9',role='Independent second engineering review',primary_sources_consulted=False,production_files_modified=False,findings=[dict(id=i,verdict=v,evidence=e,scope=n) for i,v,e,n in rows],artifacts=['review.py','results.json','supplement.py','supplement.json','domain-probes.py','domain-probes.json','b-education.py','b-education.json','layered-cap.py','layered-cap.json','global-grid.py','global-grid.json'])
(OUT/'adjudication.json').write_text(json.dumps(assessment,ensure_ascii=False,indent=2))
md='''# S4 bağımsız ikinci mühendislik incelemesi

2026-10-22 UTC · Checkout `b9392f9` · Üretim dosyalarına yazılmadı. A/B/C raporları ve kritik üretim kodları okunup ayrı hesaplarla yeniden değerlendirildi. Ana raporlardaki29 ENG kaydı aşağıda tek tek hükme bağlandı. Birinci ajanların dosyaları değiştirilmedi.

## Kanıt ve bağımsızlık

`review.py`35 sayısal karşılaştırma içerir:22 eşleşme,13 kasıtlı kusur-adayı farkı. Bu13 fark bir test suite başarısızlık sayısı veya13 ayrı hata değildir. `supplement.py`, `domain-probes.py`, `b-education.py`, `layered-cap.py` ve `global-grid.py` mevcut adayların bağımsız formül/denge ve kapsam kontrollerini tamamlar. Scriptler bekleneni üretim yardımcılarından türetmez; actual tarafında üretim fonksiyonlarını çağırır.

- Stres: iki katman ve su kesimi blok ağırlıklarından; SPT:20×72/60×1.05×1.2×.85; Youd CRR N12:rasyonel eğri ayrı hesaplandı. Üçü eşleşti.
- Rankine φ0/20/30/40 Mohr oranından; üç bearing yönteminin φ30 strip kapasitesi ayrı Nc/Nq/Ngamma ile eşleşti.
- Bishop: aynı üretim slice geometrisinde her tabakanın kütlesi ve γ∫y dy momenti ayrı toplandı; nonlinearFS Brent köküyle çözüldü. Homojen kontrol eşleşti, katmanlı kh örneği ayrıştı. Bu yöntem geometri hatasını centroid hatasına karıştırmaz. Tam analitik arayüz doğrulaması globalgap ayrı scriptindedir.
- Nominal gravity wall W/itki/moment temel dikdörtgen/üçgenlerden eşleşti. Kuru pile toe momentkökü ve maksimum moment ayrı `quad`+Brent ile eşleşti. Ankraj eksenel/düşey kuvvet, iki doğru kesişimi ve πdτ bond uzunluğu ayrı hesapla eşleşti.
- TBDY örneklerinde açık unity yük/malzeme girdileriyle R=Vtanδ/1.1 akışı yeniden hesaplandı.0.6 üst sınırı uygulandığında legacy ve layered kontrol kararının değiştiği sayısal olarak teyit edildi. Diğer tüm code-set birleşimleri bu ikinci incelemede bağımsız yeniden hesaplanmadı.

Birincil yayın/PDF bu ikinci incelemede okunmadı. Denklem/denge değerlendirmesi mühendislik bilgisine dayanır; kodun kaynak atfı, YAML `verified` etiketi veya yerel CSV adı özgün kaynağın tarafımızca doğrulandığı anlamına gelmez. Repo içi source/config tutarlılığı ile consult-source verification ayrıdır. Fullpytest/web/typecheck/build bu ajan tarafından yeniden çalıştırılmadı; root/runtime baseline kanıtı bağımsız mühendislik hesabının yerine kullanılmadı. Browser screenshotları bu ajan tarafından incelenmedi; functional ajanının gerçekUI+APIseed akışı onun kanıtıdır.

## Her ENG kaydı için hüküm

“Onay” belirtilen dar kapsamda yeniden üretimdir; evrensel geçerlilik veya mevzuat kaynak doğrulaması değildir. “Kısmen” çekirdek gözlem doğru olsa da geniş iddia, fiziksel yorum veya tüm örneklerin bağımsız yeniden koşulması sınırlıdır.

| ID | Hüküm | Kendi kanıtı | Kapsam / yön / sınır |
|---|---|---|---|
'''
for i,v,e,n in rows:md+=f'| {i} | {v} | `{e}` | {n} |\n'
md+='''
## Envanter ve test kapsamı

A raporunun128 public simge/16 registry satırı, B raporunun public yöntem+varyant tablosu ve C raporunun15Python dosyası/235class-function simgesi ile134code hücresi envanterdir. C235 sayısının tümü public sayısal yöntem değildir. Bu sayıları “hepsi bağımsız doğrulandı” diye kullanmak yanlış olur. A/B/C raporlarında sayısal(N/K-I), kod okuma(I/K-R), üretim replay(P) ve unrun(U/Açık) ayrımları bulunuyor; ana rapor bu işaretleri korumalı.

Bu ikinci incelemede özellikle açık kalanlar: tüm drenaj/katman/yük kombinasyonları, bütün ±kv ve hidrodinamik dalları, bütün EC7/AASHTO/TBDY hücrelerinin yeni bağımsız sayısal ve kaynak kontrolü, tüm anchor transfer/tendon satırlarının özgün tabloya transkripsiyonu, logspiral pole aramasının global minimum kanıtı, tüm şev arama uzayının continuum referansı ve bütün eğitim şekillerinin tarayıcı/piksel incelemesi. Nominal birkaç kontrolün eşleşmesi bunları kapatmaz.

## Önem ve genelleme düzeltmeleri

- ENG-C-001 gerçek kullanılan servis zarfına ait kritik tasarım eksikliğidir. Fixture APIseed ile farklı su durumları kurulmuş, gerçekUI üzerinden SDS temizlenip yeniden hesaplanmıştır; bütün fixture UI formundan kurulmuş denemez.
- ENG-C-002 iki motor yolunda geçme/kalma farkıdır; tablo0.6 değeri bu oturumda birincil kaynakla yeniden doğrulanmadı. CanlıAPI/UI allpass iddiası bu ikinci incelemede yoktur.
- ENG-B-004 grid4 örneği gerçek geometri kusurudur; aynı input grid12 varsayılanında gap üretilmedi. Mevcut kanıtla defaultUI riskini ve severityyi yüksekgenel etki diye büyütmek doğru olmaz.
- ENG-A-003 gösterilen örneklerde muhafazakâr aşırıLPI üretir. ENG-A-001 doğrudan importer override yokken oluşur; normal HTTP qcunit seçimi ayrı akıştır. ENG-B-003/B005 genel basınç fonksiyonundadır; θ0 kullanan veya q düzeltmesini yapan mevcut duvar çağırıcılarına genellenmez.
- ENG-A-011 sorusunda açık [1,3] için1.80 aritmetiği doğrudur; örnekler arası interval anlatımı kusurudur. ENG-C-004 özet/diyagram sözleşmesi kesin, fiziksel nihai kesme talebi yorumu koşulludur.
- U-line dikey parça ve sqrt/Cc makineepsilon adayı doğru biçimde geri çekilmiş. B pasif bağımsız optimizasyonunda negatif kuvvetli inadmissible dal ilk harness'te bulunmuştu; B bunu düzeltti. Geri çekilmiş harness çıktıları ürün kusuru olarak sayılmadı.

## Tekrar çalıştırma

Depo kökünden, bağımlılıklar kurulu Python ile:

```bash
PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/review.py
PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/supplement.py
PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/domain-probes.py
PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/b-education.py
PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/layered-cap.py
PYTHONPATH=. /tmp/geotek-audit/venv/bin/python /tmp/geotek-audit/independent-review/global-grid.py
```

Scriptler kendi bulundukları dizine çıktı yazar; repo kökü `PYTHONPATH=.` ile seçilir. Tüm scriptler başarıyla çalıştı. `results.json`, `supplement.json`, `domain-probes.json`, `b-education.json`, `layered-cap.json`, `global-grid.json` ve `adjudication.json` bulgu bazında makinece okunabilir kanıttır. Üretim Git değişikliği yapılmadı; root'un yetkili `docs/audit/` rapor/kanıt çıktıları korunmuştur.
'''
(OUT/'report.md').write_text(md)
print(f'{len(rows)} finding verdicts; report.md and adjudication.json written')
