# HS-A — Zemin modülü backend: onay tabanı, γ/γsat, korelasyonlar

**Durum:** uygulanıyor (2026-10-23). Tasarım ve kararlar: Opus (konu sahibi). Uygulayıcı yalnız bu kartı kodlar;
kartta olmayan mühendislik kararı vermez, belirsizlikte durup sorar.
Plan: `/mnt/project-files/plan/2026-10-23-hesap-sistemi-yeniden-kurgu-plani.md`.
Kaynaklar: Keleşoğlu, *Arazi Deneyleri* (Erol & Çekinmez 2014; Bowles 1996 tabloları), *Yanal Toprak Basıncı* (Das).

Dil kuralı: kod/docstring İngilizce; kullanıcıya giden metin i18n anahtarı (TR + EN, `geotek/i18n/*.json`),
uyarılar `format_warning(code, **params)` biçiminde. Mevcut kod üslubuna uy.

---

## A1. Onay tabanı: parametre başına, seçilen yöntemin girdileriyle

Sorun: `services/parameters.py::basis_hash(layer, points)` katmandaki bütün noktaların bütün alanlarını özetliyor.
γ/γsat değişince σv, σ'v, C_N, (N1)60, Qtn, Ic değişir → γ onayı kendini ve katmandaki/alttaki bütün onayları düşürür.

### A1.1 Nokta alanlarının gruplanması (`services/parameters.py`)
Modül sabiti:
```python
STRESS_FIELDS = frozenset({"sigma_v", "sigma_v_eff", "u0", "C_N", "N1_60", "Qt1", "Qtn", "n", "Ic",
                           "Fr", "Bq", "SBTn", "FC", "converged", "gamma_point", "below_gwt", "N1_70"})
```
Bu alanlar profilin γ/γsat/YASS değerlerinden türer ("gerilme grubu"). Geri kalan alanlar ham veridir ("veri grubu").
Not: CPT `Fr`, `Bq`, `Ic`, `FC`, `SBTn` gerilmeye bağlıdır; `qt`, `Rf`, `qc`, `fs`, `u2` değildir.

### A1.2 Yeni fonksiyon `selection_basis`
```python
def selection_basis(layer: SoilLayer, key: DesignKey, selected: DerivedParameter, mode: SelectionMode,
                    points: list[dict[str, float]], lab: list[LabRecord]) -> str:
    """'<data_hash>.<stress_hash>' of exactly what the selected value depends on."""
```
Her iki parça `sha256(json.dumps(..., sort_keys=True, separators=(",", ":"), allow_nan=False))` (hex) ilk 32 karakter.
`data` sözlüğüne her zaman `{"top": float, "bottom": float}` girer. Seçime göre:

| Seçim | data parçası | stress parçası |
|---|---|---|
| `mode == "manual"` (δ_taban ve K0 hariç) | yalnız sınırlar | boş sözlük |
| Laboratuvar ölçümü `lab_<key>` | layer lab kayıtlarının `(depth, <key>)` çiftleri (sıralı) | boş |
| `PHASE_gamma_sat_lab` (A2) | `(depth, gamma, w, Gs)` dörtlüleri | boş |
| `lab_gamma_sat_below_gwt` (A2) | `(depth, gamma)` + in-situ YASS derinliği | boş |
| Registry korelasyonu `c` | her uygulanabilir noktada `{n: point[n] for n in c.inputs if n not in STRESS_FIELDS}` + `c.options` | aynı noktalarda `{n: point[n] for n in c.inputs if n in STRESS_FIELDS}` |
| `mean(a,b,...)` (combine) ve `statistic:*` | havuzdaki her yöntemin data parçalarının sıralı listesi | aynı şekilde stress parçaları |
| `TBDY2018_delta_base` ya da `key == "delta_base"` (her mod) | `{"phi_eff": <inputs_used["phi_eff"]>}` | boş |
| `JAKY_K0`, `MK1982_K0` ya da `key == "K0"` ve mod manual | `{"phi_eff": ..., "OCR": ...(varsa)}` | boş |
| `FHWA_GEC5_c_eff` | `{"rule": "granular"}` | boş |

"Uygulanabilir nokta": `registry.applicable(key, inputs)` o yöntemi döndürdüğü nokta (evaluate_candidates ile aynı
mantık; `gamma_layer` bağlamı artık kullanılmıyor, bkz. A2.6). Havuz yöntemleri: `DerivedParameter.based_on`
(A1.3) listesi. Bilinmeyen `method_id` → `ValueError` (sessiz geçme).

### A1.3 Model değişiklikleri (`core/models/parameters.py`)
- `DerivedParameter.based_on: list[str] = Field(default_factory=list)` — birleşik/istatistik değerin dayandığı
  yöntem kimlikleri. `registry.combine` ve `resolve` (statistic) bunu doldurur.
- `ParameterSelection` yeni alanlar:
  - `stale_reason: Literal["data_changed", "stress_changed", "dependency_changed", "method_upgraded"] | None = None`
  - `refreshed: DerivedParameter | None = None` — düşen bir onay için aynı mod/yöntemle güncel girdilerden
    yeniden çözülmüş değer (yalnız gösterim; onay değildir).
- `SoilProfile.content_hash` zaten `selections` hariç; değişmez.

### A1.4 `approve()` ve onay rotası
`approve(layer, keys, basis_by_key: dict[DesignKey, str], now)` imzasına geç: her anahtar kendi tabanını alır.
Rota (`modules/soil/api.py::approve_parameters`): `points = layer_points(project, profile, stored)`, `lab = _layer_lab(...)`;
her anahtar için önce `resolve` edilmiş seçim (approve içindeki ile aynı) üzerinden `selection_basis` hesaplanır.
Pratik yol: `approve` içine `points` ve `lab` geçir, tabanı orada `selection_basis` ile hesapla
(`approve(layer, keys, points, lab, now)`); dışarıdan hash geçirme. `_invalidate_delta_approval` kaldırılır;
δ ve K0 bağımlılığı A1.5 ile genel mekanizmaya taşınır. Ortak (`phi_eff` önce) sıralama korunur, K0 için de φ (ve OCR)
önce çözülür: sıralama anahtarı `("phi_eff", "OCR")` önce, sonra diğerleri.

### A1.5 `refresh_profile()`
Her onaylı seçim için güncel taban `selection_basis(layer, key, selection.selected, selection.mode, points, lab)`.
- Eşitse: onay korunur, `stale_reason=None`, `refreshed=None`.
- Değilse: `approved=False`; `stale_reason`:
  - δ_taban / K0: `"dependency_changed"`;
  - data parçası farklı: `"data_changed"`; yalnız stress parçası farklı: `"stress_changed"`.
  `refreshed` = `resolve(selection.model_copy(update={"candidates": güncel, "suggested": güncel}))).selected`;
  çözülemiyorsa (yöntem artık yok, `ValueError`) `None`.
- **Eski (tek parçalı, nokta içermeyen) taban göçü:** saklı `basis_hash` içinde `.` yoksa eski biçimdir. Eski
  `basis_hash(layer, legacy_points)` hesapla; `legacy_points` = noktalardan `gamma_point`, `below_gwt`, `N1_70`
  anahtarları çıkarılmış hâli (A2 ile eklenenler). Eşitse veri onaydan beri değişmemiştir → yeni tabanı yaz, onay
  korunur. Değilse `approved=False`, `stale_reason="method_upgraded"`.
- Onaylı olmayan ama daha önce düşmüş seçimlerde (`approved=False`, `selected` var, `basis_hash` var) de
  `stale_reason`/`refreshed` her yenilemede yeniden hesaplanır ki arayüz gösterebilsin. `basis_hash` hiç yoksa
  (hiç onaylanmamış) ikisi de `None`.
- Eski `basis_hash()` fonksiyonu yalnız göç için kalır; docstring'e "legacy" yaz.

### A1.6 `api.py::_keep_approvals_honest`
Değişmez (değer veya taban değişirse onay kalkar). Ek: tablo üzerinden γ/γsat elle değiştirildiğinde ilgili
seçim `mode="manual"`, `manual_value=<yeni değer>`, `selected=resolve(...)` olarak kaydedilir (onaysız). Böylece
tablo ve parametre paneli aynı değeri gösterir; iz kaybolmaz.

### A1.7 Toplu yeniden onay rotası
`POST /profiles/{id}/parameters/reapprove`, gövde `ReapproveRequest {items: list[{layer_id, key, expected_value}]}`.
Her öğe için: güncel `refreshed` değeri `expected_value` ile `math.isclose(rel_tol=1e-9, abs_tol=1e-12)` değilse
409 `reapprove_value_changed`; değilse seçimi aynı mod/yöntemle güncel adaylardan çözüp onaylar
(`approve` ile, tek tek değil katman başına toplu). Dönen: güncel `SoilProfile`. Otomatik onay yok; yalnız
listelenen öğeler. `operation_id="reapprove_parameters"`.

### A1.8 Testler (`tests/unit/test_parameters_service.py` + `tests/api/...soil...`)
1. Planla yeniden üretilen senaryo (`examples/ornek_excel_proje.gtk`): katman 1 φ ve γ, katman 2 γ RC2010 ile onaylı;
   katman 1 γ elle 19.5 onaylanınca: katman 1 γ **onaylı kalır**, katman 2 γ (RC2010, girdisi qt/fs) **onaylı kalır**,
   katman 1 φ (CPT, σ'v kullanır) `stress_changed` ile düşer, `refreshed` dolu ve eski değerden farklı.
2. Elle girilmiş φ onayı: SPT N değiştirilince onaylı kalır; katman sınırı değişince düşer (mevcut reset_interval).
3. Lab ölçümü onayı γ değişince düşmez; lab değeri değişince `data_changed`.
4. İstatistik (`mean`) onayı: havuzdaki bir yöntemin ham girdisi değişince `data_changed`.
5. δ_taban onayı φ değişince `dependency_changed` (mevcut testler yeni koda uyarlanır, davranış korunur).
6. Eski biçimli onay: veri değişmemişse göç edip onaylı kalır; değişmişse `method_upgraded`.
7. `reapprove`: beklenen değer tutmazsa 409; tutarsa onaylanır ve taban yeni.

---

## A2. Birim hacim ağırlıkları (γ, γsat)

### A2.1 Sessiz γsat = γ kaldırılır
`core/models/profile.py::SoilLayer._check` içinden `if self.gamma_sat is None: self.gamma_sat = self.gamma` silinir.
`gamma_sat` `None` kalabilir. Eski dosyalarda kayıtlı değerler olduğu gibi okunur (göç yok).

### A2.2 Gerilme hesabı
`engine/stresses.py::vertical_stresses`: su altı bir segmentte `layer.gamma_sat is None` ise
`LayerDesignError(layer, "gamma_sat_missing")` (core/errors.py `_TEXT`'e `"gamma_sat_missing": "saturated unit
weight gamma_sat not set (layer lies below the groundwater table)"` ekle; i18n `layer_gamma_sat_missing` TR/EN).
YASS üstündeki katmanlarda `None` sorun değildir.

Aynı kural: `services/walls_advanced.py` (satır ~148, ~173, ~177), `engine/walls/layered.py` (~70) — `gamma_sat`
kullanılmadan önce `None` ise aynı hata. `services/report.py` `None` için "—" yazar (mevcut `_fmt` kontrol et).
`web`: `gamma_sat` zaten opsiyonel; boş bırakılabilir (HS-B).

### A2.3 `layer_points`
- Her noktaya `gamma_point` (o derinlikte gerilmede kullanılan birim hacim ağırlığı: in-situ YASS üstünde
  `layer.gamma`, altında `layer.gamma_sat`; `None` ise eklenmez) ve `below_gwt` (1.0/0.0, in-situ YASS'a göre,
  `depth > gwt + DEPTH_TOL`) eklenir. Lab noktalarına da `below_gwt` eklenir.
- `process_borehole`/`process_cpt` `LayerDesignError` (gamma_sat_missing) verirse: SPT için `N`, `N60`, `C_R`,
  `C_B`, `C_S`, `energy_ratio`, `refusal`, `depth` (gerilmesiz alanlar) ile; CPT için `depth, qc, qt, fs, u2, Rf,
  area_ratio` ile nokta üret (gerilme grubu yok). Bunun için `engine/insitu/spt.py` içinde gerilmesiz kısmı ayrı bir
  fonksiyona ayır: `equipment_corrections(borehole, rod_stickup, no_liner_factor) -> (depth, n_field, refusal, c_r,
  c_b, c_s, er, n60, warnings)`; `process_borehole` bunu kullansın (davranış aynı kalır). CPT için
  `corrected_tip_resistance` ve `Rf = fs/qt*100` doğrudan.
- `layer_points` dönüşü değişmez (liste); eksik γsat bilgisini envanter verir (A2.7).

### A2.4 γ ve γsat adayları (`evaluate_candidates`, `suggest`)
`gamma` anahtarı:
- Lab ölçümü `lab_gamma`: yalnız `below_gwt == 0` olan numuneler (YASS üstü nem durumundaki γ). Hiç yoksa aday yok.
- `RC2010_gamma_CPT`: mevcut hâli (tüm noktalar; yerinde toplam birim hacim ağırlığı tahmini).

`gamma_sat` anahtarı (yeni adaylar):
- `PHASE_gamma_sat_lab` (source `"lab"`, reliability `"A"`): `γ`, `w`, `Gs` olan her numune için
  `engine/lab/phase.py::phase_relations(gamma=..., w_percent=..., Gs=...)` → `gamma_sat`. Uyarıları (`void_ratio_invalid`,
  `saturation_over_100`) adayın `warnings`'ine; geçersiz e → o numune atlanır. Değer: numune ortalaması, `stats` yayılım.
  Referans: "Faz bağıntıları: γd = γ/(1+w), e = Gs·γw/γd − 1, γsat = (Gs+e)·γw/(1+e)". Bu bir ölçüm türevidir:
  `_is_lab_measurement` bunu ölçüm saymalı (registry'de değil, `source=="lab"` → zaten ölçüm sayılıyor; doğrula).
- `lab_gamma_sat_below_gwt` (source `"lab"`, reliability `"B"`): `below_gwt == 1` numunelerin ölçülmüş `γ` değeri
  (yerinde doygun kabul). Uyarı kodu `parameters.warning.gamma_below_gwt_assumed_saturated` her zaman eklenir
  (S = 1 kabulü görünür olsun).
- `RC2010_gamma_sat_CPT`: registry'ye yeni kayıt, aynı formül (`unit_weight_robertson_cabal`), `parameter="gamma_sat"`,
  `inputs=("qt", "fs", "below_gwt")`, fonksiyon `below_gwt` girdisini kullanmaz ama `check` `below_gwt != 1` ise
  uygulanamaz sayılmalı. Daha temiz yol: `registry.applicable` yerine `evaluate_candidates` içinde `key=="gamma_sat"`
  ve yöntem `RC2010_gamma_sat_CPT` için `below_gwt != 1` noktaları atla. Fonksiyon imzası `(qt, fs)`; `inputs=("qt","fs")`,
  atlama `evaluate_candidates` içinde. Referans: Robertson & Cabal (2010), validity: "In-situ total unit weight;
  points below the in-situ groundwater table only".
- `suggest()`: ölçümler önce (mevcut kural: `measured[0]`). Sıra: `PHASE_gamma_sat_lab` > `lab_gamma_sat_below_gwt` >
  korelasyon. `measured` listesini bu önceliğe göre sırala.

### A2.5 CPT katmanlama (`engine/layering/cpt.py`) ve proposal
`Layer` (layering/common.py) `gamma_sat_suggested: float | None = None` alanı ekle. `cpt_layers` imzasına
`gwt_depth: float | None` (in-situ). Katman başına RC2010 tahminleri `depth <= gwt` (üst) ve `depth > gwt` (alt)
diye ayrılır:
- `gamma_suggested` = üst noktaların ortalaması; üst nokta yoksa tüm noktaların ortalaması **ve**
  `interval_warning(warnings, "gamma_above_gwt_from_below", top, end)` (YASS üstü γ için CPT verisi yok; değer YASS
  altı tahmininden alındı, tasarım YASS'ı düşükse mühendis kontrol etmeli).
- `gamma_sat_suggested` = alt noktaların ortalaması; alt nokta yoksa `None`.
`gwt_depth` `services/layering.py` / `module1.py` çağıranlarından sondajın veya profilin in-situ YASS'ından geçirilir;
yoksa `None` → eski davranış (hepsi γ, γsat None).
`proposal_to_layers` ve `modules/soil/service.py::materialise`: `gamma_sat` = `gamma_sat_suggested`.
DTO `LayeringProposal` katmanına `gamma_sat_suggested` ekle (schemas). i18n anahtarları ekle.

### A2.6 Gmax yoğunluğu
`HU2007_Gmax_*_SPT` girdisi `gamma_layer` → `gamma_point` (noktadaki yerinde birim hacim ağırlığı; YASS altında
γsat). `evaluate_candidates` içindeki `gamma_layer` enjeksiyonu ve parametresi kaldırılır; `refresh_profile`
çağrısı güncellenir. Validity metni: "rho from the in-situ unit weight at the point (gamma above, gamma_sat below
the groundwater table)".

### A2.7 Katman birleştirme (`modules/soil/service.py::merge`)
γ veya γsat farklıysa birleşik değer kalınlık ağırlıklı ortalama (birleşik katman tabanındaki toplam σv'yi korur):
`(γ1·t1 + γ2·t2)/(t1+t2)`; γsat'ta biri `None` ise sonuç `None`. Her iki durumda uyarı:
`"Unit weight {key} differs between merged layers; thickness-weighted value {value} written, approval required."`
ve ilgili seçim onaysız (`reset_interval` zaten). Eşitse dokunma.

### A2.8 Envanter ve hazırlık
`parameter_plan.layer_inventory` dönüşüne `stress_issue: str | None` ("gamma_sat_missing" / None) ekle
(`LayerInventory` DTO). Yeni fonksiyon `profile_readiness(project, profile) -> list[dict]`: katman başına
`{layer_id, gamma_approved: bool, gamma_sat_approved: bool, gamma_sat_missing_below_gwt: bool,
gamma_sat_equals_gamma_unapproved: bool, stale_keys: [...]}`; rota `GET /profiles/{id}/readiness`
(`operation_id="get_profile_readiness"`). `gamma_sat_equals_gamma_unapproved`: γsat == γ ve γsat seçimi onaysız
(eski dosyalardaki sessiz varsayımı görünür kılar).

### A2.9 γ makullük denetimi (Bowles 1996, Tablo 3-4)
Granüler katmanlarda (layer_context `"sand"`) SPT noktalarından N'70 = (N1)60·60/70 ortalaması ile tablo sınıfları:
N'70 aralıkları — fine/medium/coarse satırlarının birleşimi:
very loose ≤ 6 → γ 11–16; loose 3–9 → 14–18; medium 7–25 → 17–20; dense 16–45 → 17–22; very dense > 40 → 20–23 kN/m³.
N'70'in düştüğü tüm sınıfların γ aralıklarının birleşimi dışında kalan `gamma` adayına/seçimine
`parameters.warning.gamma_outside_bowles_range` (params: gamma, n70, low, high) uyarısı eklenir. Yalnız uyarı;
değer üretmez. Not: tablo ~6 m derinlik ve NC kum içindir; uyarı metninde belirt.

### A2.10 Testler
- γsat None + YASS altı → `LayerDesignError gamma_sat_missing`; YASS üstü katmanda None sorun değil.
- Faz bağıntısı adayı: γ=19, w=25 %, Gs=2.70 → γd=15.2, e=2.70·9.81/15.2−1=0.7426, γsat=(2.70+0.7426)·9.81/1.7426=19.38 (elle; testte
  `GAMMA_W` sabitiyle aynı formülle karşılaştır, 1e-9).
- RC2010 γsat yalnız YASS altı noktalardan; CPT katmanlamada γ/γsat ayrımı ve uyarı.
- Birleştirmede kalınlık ağırlıklı γ ve uyarı.
- Gmax YASS altında γsat ile.
- Eksik γsat ile parametre ekranı çalışır (gerilmesiz adaylar gelir), envanter `stress_issue` döner.

---

## A3. Korelasyon düzeltmeleri ve kaynaktaki eksik korelasyonlar

Registry'ye (`engine/correlations/registry.py::Correlation`) `uscs: frozenset[str] | None = None` alanı ve
`register(..., uscs=...)` parametresi ekle. `applicable(parameter, inputs, source=None, uscs=None)`: korelasyonun
`uscs` kümesi varsa yalnız katman USCS sembolü (`context.uscs`, büyük harf, boşluksuz) kümedeyse uygulanır;
katman USCS'i yoksa uygulanmaz. `evaluate_candidates`'e `uscs: str | None` parametresi; `refresh_profile` `context.uscs`
geçirir. `parameter_plan` envanterinde bu yöntemler için `missing_inputs` içine `"uscs"` yaz (USCS yok ya da uymuyor).
Tüm yeni kayıtlar `verified=False` kalır (registry varsayılanı). Her yeni kayıt için elle hesap testi.

### A3.1 C_R 3–4 m = 0.75 (formül değişikliği)
`engine/insitu/spt.py::rod_length_factor`: `<3 m 0.75; 3–4 m 0.75; 4–6 m 0.85; 6–10 m 0.95; 10–30 m 1.0`.
Kaynak: Skempton (1986) ve TBDY 2018 Tablo 16B.1 (0.75); Youd et al. (2001) 0.80 verir. Daha düşük değer N60 ve
(N1)60'ı düşürür → φ', Dr ve CRR için güvenli taraf. Docstring'e bu gerekçeyi yaz. İlgili testleri güncelle
(`test_spt*`, sıvılaşma regresyonları: değişen sayıları yeniden hesapla; testi kapatma/atlama yok).

### A3.2 Stroud f1 PI'ya göre (formül seçeneği değişikliği)
`Stroud1974_su_SPT`: `f1` artık noktadaki `PI`'ya göre seçilir (kaynak: Stroud 1974, Erol & Çekinmez 2014 Bağ. 1.19):
PI < 20 → 6.0 (6–7 aralığının alt sınırı); 20 ≤ PI ≤ 30 → 4.0 (4–5 alt sınırı); PI > 30 → 4.2. PI bilinmiyorsa
4.2 (eğrinin alt zarfı) ve `correlation.warning.stroud_f1_pi_unknown` uyarısı. Uygulama: `inputs=("N60",)`,
opsiyon `f1` kaldırılır; fonksiyon `su_stroud(N60, PI=None)` değil — registry girdileri zorunlu olduğundan iki kayıt:
`Stroud1974_su_SPT` (inputs `("N60","PI")`, f1 PI'dan) ve `Stroud1974_su_SPT_noPI` (inputs `("N60",)`, f1=4.2, uyarı her zaman).
İkincisi yalnız noktada PI yokken aday olur (`evaluate_candidates`: `PI` varsa noPI kaydını atla). SPT noktasına PI
gelmez (lab ayrı nokta); bu yüzden PI katman lab ortalamasından noktaya bağlam olarak eklenir: `refresh_profile`
katmanın lab PI ortalamasını (varsa) her SPT noktasının girdisine `PI` olarak koyar **yalnız değerlendirme bağlamında**
(noktaların kendisine değil; taban için korelasyonun data parçasına PI değeri girer — A1.2 tablo kuralı zaten girdiden alır).
Validity: "Insensitive overconsolidated clays; f1 from PI after Stroud (1974): lower bound of each PI band".

### A3.3 Yeni φ' korelasyonları (Bowles 1996 Eq. 3-5, Shioi & Fukui 1982)
- `SF1982_phi_roads_SPT`: φ' = √(18·N'70) + 15, N'70 = (N1)60 · 60/70. inputs `("N1_60",)`. validity: "Japanese
  Railway Standards, roads and bridges; sands". check `sand_like`.
- `SF1982_phi_buildings_SPT`: φ' = 0.36·N70 + 27, N70 = N60 · 60/70. inputs `("N60",)`. validity: "buildings; sands".
- Bowles'taki `φ = 4.5·N70 + 20 (in general)` **eklenmez**: N70 > 5.6 için φ' > 45° verir, fiziksel değildir.
  Bunu `docs/qa/hesap-sistemi-denetimi.md`'ye (HS-D) gerekçesiyle yaz.

### A3.4 Sowers (1979) su — plastisiteye göre (Erol & Çekinmez Bağ. 1.17)
- `Sowers1979_su_high_SPT` su = 12.5·N60, uscs `{"CH","MH"}`
- `Sowers1979_su_medium_SPT` su = 7.5·N60, uscs `{"CL"}`
- `Sowers1979_su_low_SPT` su = 3.75·N60, uscs `{"ML","CL-ML","SC-SM","SM","SC"}` — kaynak "düşük plastisiteli kil
  (SC-ML)" der; bu küme kaynak etiketinin USCS karşılığıdır.
check `clay_like`, reliability "C", referans "Sowers (1979), as given by Erol & Çekinmez (2014) Eq. 1.17".

### A3.5 Elastisite modülü — FHWA (2002a) ve Bowles (1996)
N55 = N60·60/55.
- `FHWA2002_E_silt_SPT` E = 400·(N1)60 [kPa], uscs `{"ML","SM","SC-SM","CL-ML"}`
- `FHWA2002_E_sand_SPT` E = 700·(N1)60, uscs `{"SP","SW","SP-SM","SW-SM"}` (iri kum 1000 değeri USCS ile ayrılamadığı
  için kullanılmaz; 700 daha düşük → güvenli taraf; validity'de yaz)
- `FHWA2002_E_gravel_SPT` E = 1200·(N1)60, uscs `{"GW","GP","GW-GM","GP-GM"}`
- `Bowles1996_E_sand_SPT` E = 500·(N55+15), uscs kum kümesi, yalnız `below_gwt == 0` noktaları
- `Bowles1996_E_sand_sat_SPT` E = 250·(N55+15), uscs kum kümesi, yalnız `below_gwt == 1`
- `Bowles1996_E_clayey_sand_SPT` E = 320·(N55+15), uscs `{"SC"}`
- `Bowles1996_E_silt_SPT` E = 300·(N55+6), uscs `{"ML","CL-ML"}`
- NC kum alternatifleri (aynı kum kümesi, yalnız YASS üstü): `Bowles1996_E_sand_sqrt_SPT` 7000·√N55,
  `Bowles1996_E_sand_lin_SPT` 6000·N55, `Bowles1996_E_sand_ln_SPT` 15000·ln(N55) (15000–22000 aralığının alt sınırı),
  `Bowles1996_E_sand_lin2_SPT` 2600·N55 (2600–2900 alt sınırı). N55 ≤ 1 için ln geçersiz → NaN (mevcut NaN yolu).
`below_gwt` filtresi: A2.4'teki gibi `evaluate_candidates` içinde yöntem kimliği eşlemesiyle (sözlük
`POINT_FILTERS = {"RC2010_gamma_sat_CPT": below, "Bowles1996_E_sand_sat_SPT": below, "Bowles1996_E_sand_SPT": above, ...}`).
check `sand_like` (silt/kil kayıtları için `clay_like` yok; sadece uscs filtresi).
Gravelly sand 1200·(N55+6) eklenmez (lab çakıl yüzdesi noktaya bağlanmıyor); kum formülleri daha düşük → güvenli.

### A3.6 K0 adayları (Das; Jaky 1944; Mayne & Kulhawy 1982)
`suggest`/aday üretimi, δ_taban gibi türetilmiş: φ' kaynağı `layer.design.phi_eff` (onaylı) yoksa φ seçiminin
önerisi (geçerliyse). OCR kaynağı `layer.design.OCR` (yalnız onaylı).
- `JAKY_K0`: K0 = 1 − sin φ' (NC). Her zaman (φ varsa) aday. inputs_used `{"phi_eff": φ}`.
- `MK1982_K0`: K0 = (1 − sin φ')·OCR^(sin φ'). Yalnız onaylı OCR varsa. inputs_used `{"phi_eff", "OCR"}`.
Bunlar `selection.candidates`'e eklenir (registry dışı, source `"combined"`, reliability `"B"`), `validity_ok=True`.
Öneri sırası: ölçüm yok → MK varsa MK, yoksa Jaky (kil katmanında KM1990_K0_CPT geçerliyse registry birleşimi
mevcut kurala göre önce gelir; türetilmişler yalnız registry adayı yokken öneri olur). K0 > 5 → geçersiz (UPPER_BOUNDS).
`approve` içinde K0 seçimi türetilmiş yöntemse, onay anındaki φ/OCR `selected.inputs_used`'a yazılır (δ ile aynı desen).

### A3.7 SPT kıvam/sıkılık sınıfı (Clayton 1993, Erol & Çekinmez Tablo 1.7) — bilgi
Envantere `spt_class`: kum katmanında ortalama (N1)60 ile: 0–3 çok gevşek, 3–8 gevşek, 8–25 orta sıkı, 25–42 sıkı,
42–58 çok sıkı; kil katmanında ortalama N60 ile: 0–4 çok yumuşak, 4–8 yumuşak, 8–15 sıkı(firm), 15–30 katı,
30–60 çok katı, >60 sert. Sınır değer üst sınıfa. i18n anahtarları. Hesaba girmez.

---

## Kabul
- `python -m pytest tests -q` tamamı geçer (gerçek sonuç rapora); değişen sayısal testler elle hesapla gerekçelendirilir.
- `python tools/export_openapi.py` ardından `cd web && npm run gen:api`; `npm run typecheck` ve `npm test` (mevcut testler bozulmaz).
- `node tools/run_python.cjs tools/gen_code_map.py` ve `--check` 0.
- Diff yalnız bu kartın kapsamı.
