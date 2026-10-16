# P1 — GeoTek v2 sözleşmeleri

Durum: **taslak, 1. onay kapısında**. Kod tarafındaki tanımlar bağlayıcıdır; bu belge onların anlamını,
kurallarını ve sonraki paketlerin (E1–E4, A1, F1) uyacağı imzaları verir. Bağımsız inceleme (gpt-6.1-sol)
bulguları işlenmiştir.

| Sözleşme | Dosya |
|---|---|
| Sondaj logu | `geotek/core/models/investigations.py` → `BoreholeLayer`, `Borehole.log`, `USCS_SYMBOLS` |
| Parametre seçimi/onayı | `geotek/core/models/parameters.py` → `ParameterSelection`, `DesignKey`, `SelectionMode`, `Statistic` |
| Profil kökeni, katmanlama ayarı | `geotek/core/models/profile.py` → `SoilProfile.origin`, `.layering`, `LayeringSettings`, `SoilLayer.selections`, `SoilLayer.source_ids` |
| Yapı ve yapıya özel zemin | `geotek/core/models/structures.py` → `StructureSoilModel`, `RetainingWallStructure`, `SheetPileStructure`, `Structure`, `SoilZones` |
| Proje | `geotek/core/models/project.py` → `Project.structures`, `Project.active_profile_id`, `active_profile()`, `structure()` |
| HTTP API | `geotek/api/schemas.py`, `geotek/api/app.py` (50 uç, gövdeler 501), `docs/contracts/openapi.json` (`tools/export_openapi.py`; `tests/api/test_contract.py` sapmayı yakalar) |

## 1. Temel kararlar

1. **Yapı koordinatı.** Yapıda derinlik z, duvar arkasındaki tutulan zemin yüzeyinden aşağı doğru ölçülür.
   Duvar tabanı z = `height`, ön zemin z = `height − D`, palplanşta kazı tabanı z = `retained_height`. Yapı
   kopyası (`StructureSoilModel.profile`) bu çerçevededir; kullanıcı kopyada katman ekler/siler/böler,
   proje profili değişmez.
2. **Kesme.** `StructureSoilModel.zones(front_depth, base_depth)` → arka dolgu `[0, taban]` (tutulan taraf),
   ön zemin `[ön zemin, taban]`, temel `[taban, profil sonu]`. Profil tabanın (palplanşta kazı tabanının)
   **altına** uzanmalıdır; aksi halde hata. Motor ön taraf için `lateral_pressure(..., top=front_depth)`
   kullanır (kazılan örtü yükü düşülür).
3. **Arka dolgu farkı.** `retained_fill` yalnız tutulan tarafta profilin yerine geçer (z = 0'dan başlar,
   kesintisiz, kimlikleri benzersiz); ön taraf ve temel her zaman `profile`'ı kullanır. `retained_profile()`
   ikisini birleştirip `SoilProfile` olarak doğrular.
4. **Su.** `gwt_retained` / `gwt_front` (yapı çerçevesinde; None = `profile.gwt`). `retained_profile()` arka
   suyu, `front_profile()` ön suyu taşır. Taban altındaki boşluk suyu basıncı ön ve arka su yükü arasında
   doğrusal kabul edilir (sızma analizi yok; raporda varsayım olarak yazılır).
5. **Gömülme otoritesi.** Geometri varken `geometry.embedment` geçerlidir; `embedment` alanı doluysa ona eşit
   olmalıdır. `embedment < height`. `front_depth` özelliği z = H − D verir.
6. **Bayatlık.**
   - Yapı kaynağı `source_profile_id` + `source_hash`; `is_stale(source)` proje profili değişince ya da
     silinince True.
   - `SoilProfile.content_hash()` yalnız mühendislik içeriğini kapsar (sınırlar, γ, `design`, YASS…); aday
     listeleri (`params`) ve seçim kayıtları (`selections`) hariç. Aday yenilemek yapıları bayatlatmaz;
     onay `design`/γ'yı değiştirdiği için bayatlatır.
   - Sonuç: yapıda `result_hash` = SHA-256(yapı JSON'u, `result_hash` hariç + tasarım kodu id'si +
     o kodun `design_overrides` değerleri).
   - Parametre onayı: `ParameterSelection.basis_hash` = katman sınırları + katmandaki girdi noktaları;
     uyuşmazsa onay bayattır, arayüz yeniden onay ister.
7. **Parametre akışı.** `candidates` her uygulanabilir korelasyon için katman temsili değer (`stats` = katmandaki
   derinlik noktalarına göre dağılım). `suggested` program önerisi. Mühendis korelasyon (`method_id`),
   istatistik (`statistic`) veya elle değer seçer; `mean_minus_k_sd` için **k yalnız kullanıcıdan**
   (doğrulayıcı zorlar). Öneriler asla otomatik onaylanmaz. Yalnız onaylı seçimler yazılır: φ', c', s_u, E,
   δ_b → `SoilLayer.design`; γ, γ_sat → `SoilLayer.gamma`/`gamma_sat`. Onaylı seçim `selected`, `approved_at`,
   `basis_hash` olmadan geçersiz; `selections` anahtarı `parameter` ile aynı olmalı. Modül 2 yalnız `design`
   ve γ okur.
8. **Sondaj logu.** Aralıklar arası boşluğa izin var (karotsuz/loglanmamış), çakışma yok. USCS, ASTM D2487
   grup sembolü (çift semboller dahil) olarak doğrulanır.
9. **Aktif profil.** `module1.active_profile()` → `Project.active_profile()` (seçili yoksa ilk profil).

## 2. E1 — model, göç, testler (gpt-reserve medium)

- `SCHEMA_VERSION = "1.2"`, `project_io._MIGRATIONS["1.1"] = _from_1_1`:
  `soil_profiles[*].origin` = `source_ids` boşsa `"manual"`; yalnız CPT id'leri → `"cpt"`; yalnız sondaj →
  `"spt"`; ikisi → `"mixed"`. `structures = []`, `active_profile_id = None`. `module2_inputs` olduğu gibi
  kalır (PySide6 kaldırılınca silinir; otomatik yapıya çevrilmez).
- `geotek/services/module1.py`: `active_profile(project)` → `project.active_profile()` (imza aynı).
- Testler: `examples/ornek_proje.gtk` (1.1) göçle yüklenir, kaydet→yükle eşit; `BoreholeLayer` doğrulamaları;
  `StructureSoilModel` (`zones`, `retained_profile`, `front_profile`, `is_stale`, dolgu kimlik çakışması,
  kapsama hataları); `ParameterSelection` değişmezleri; `content_hash`'in `selections`'tan etkilenmemesi;
  yapı/aktif profil referans kontrolleri; gömülme tutarlılığı.
- `examples/make_example.py` 1.2 örnek üretir: bir sondaj logu ve bir istinat duvarı yapısı eklenir.

## 3. E2 — otomatik katmanlama (gpt-6.1-sol high)

`geotek/engine/layering.py` (UI bağımsız):

```python
@dataclass
class LayerProposal:            # API: ProposedLayer
    top: float; bottom: float; description: str; uscs: str | None; sbtn_zone: int | None
    ic_mean: float | None; n60_mean: float | None; gamma_suggested: float | None
    behaviour: Literal["drained", "undrained"]

@dataclass
class LayeringResult:           # API: LayeringProposal
    source_id: str; settings: LayeringSettings; layers: list[LayerProposal]; warnings: list[str]

def layer_cpt(processed: CPTProcessed, settings: LayeringSettings) -> LayeringResult
def layer_spt(borehole: Borehole, processed: SPTProcessed | None, settings: LayeringSettings) -> LayeringResult
def proposal_to_layers(result: LayeringResult, *, id_prefix: str,
                       gamma: dict[int, tuple[float, float | None]] | None = None) -> list[SoilLayer]
```

- CPT: Ic `smoothing_window` hareketli ortalama → Robertson SBTn zon sınırları (kodda mevcut) → `min_thickness`
  altı zonları komşuya kat → komşu zonlarda |ΔIc| < `merge_ic_tol` ise birleştir. `gamma_suggested` = RC2010
  korelasyonunun katman ortalaması (kayıtlı korelasyon). `behaviour` = Ic > 2.6 ise undrained.
- SPT: `borehole.log` doluysa aralıklar loga göre; log boşlukları üstteki katmana katılır ve uyarı olarak
  listelenir. Log yoksa lab USCS (`classify_lab_record`) değişimleri ve `n_change_ratio`'yu aşan N60
  değişimleri sınır olur. SPT'den γ için güvenilir formül yok → `gamma_suggested = None`.
- Profil z = 0'dan başlar; veri 0'dan başlamıyorsa ilk katman yukarı uzatılır ve uyarı yazılır.
- `proposal_to_layers`: `gamma_suggested` null olan her katman için (γ, γ_sat) `gamma` sözlüğünde (katman
  sırası → değer) verilmelidir; eksikse `ValueError` eksik katmanları sayar. A1 bunu 422 `validation` +
  eksik katman listesi olarak döner; F2/F3 formu bu alanları ister. (API: `ProfileCreate`'e
  `layer_gamma: dict[int, {gamma, gamma_sat}]` alanı A1'de eklenir ve openapi.json yeniden üretilir.)

## 4. E3 — parametre servisi (gpt-6.1-sol high)

`geotek/services/parameters.py`:

```python
def layer_points(project: Project, profile: SoilProfile, layer: SoilLayer) -> list[dict[str, float]]
    # depth-point inputs (N60, N1_60, qc, qt, fs, u2, u0, Ic, sigma_v, sigma_v_eff, PI, ...) from the
    # layer's source soundings and lab records inside [top, bottom)
def evaluate_candidates(points: list[dict[str, float]], key: DesignKey,
                        lab: list[LabRecord]) -> list[DerivedParameter]
    # one entry per applicable registry correlation (+ lab), value = mean over points, stats = spread
def suggest(candidates: list[DerivedParameter], key: DesignKey, layer: SoilLayer) -> DerivedParameter | None
def resolve(selection: ParameterSelection) -> ParameterSelection     # fills `selected`
def approve(layer: SoilLayer, keys: list[DesignKey], basis_hash: str, now: datetime) -> SoilLayer
def basis_hash(layer: SoilLayer, points: list[dict[str, float]]) -> str
def refresh_profile(project: Project, profile_id: str) -> SoilProfile  # candidates + suggestions, no approval
```

Öneri kuralları (yeni katsayı yok): lab değeri varsa o; yoksa geçerlilik aralığındaki adayların
`registry.combine` ortalaması. `c_eff`: korelasyon yok; lab yoksa öneri 0 **yalnız granüler katmanda**
(USCS G*/S* veya Ic < 2.6), etiket "FHWA GEC-5: granüler zeminde c' = 0"; ince daneli katmanda öneri yok.
`delta_base`: öneri `atan(min(tan φ', 0.6))`, etiket "TBDY 2018 Tablo 16.3 (yerinde dökme beton)". SPT'den γ
önerisi yok. Sınır/girdi değişince onaylar bayat işaretlenir; `design` değerleri yeniden onaya kadar korunur
ama yapılar bayat görünür.

## 5. E4 — katmanlı duvar motoru (gpt-6.1-sol xhigh)

Yeni modül `geotek/engine/walls/layered.py`; mevcut imzalar ve davranışlar korunur:

```python
def wall_forces_layered(geometry, soil: StructureSoilModel, loads: WallLoads, settings: WallSettings,
                        *, seismic: bool, backfill_slope: float = 0.0,
                        gwt_case: GwtCase = "design") -> WallForces
def foundation_from_structure(soil: StructureSoilModel, front_depth: float, base_depth: float, width: float,
                              gwt_case: GwtCase = "design") -> tuple[FoundationSoil, list[str]]
    # base-layer parameters; overburden = effective vertical stress at the base integrated from the FRONT
    # ground (front_profile(), excavated overburden removed), not from z = 0;
    # warning when a weaker layer lies within B below the base
def bands_from_structure(soil: StructureSoilModel, base_depth: float) -> tuple[list[SoilBand], list[SoilBand]]
    # (retained-side bands above the base, foundation bands below), elevation 0 = base
def analyze_wall_layered(geometry, soil, loads, settings, *, seismic: bool, backfill_slope: float = 0.0,
                         gwt_case: GwtCase = "design") -> WallAnalysis
def verify_wall_layered(geometry, soil, loads, settings, *, seismic: bool, approach: str | None,
                        backfill_slope: float = 0.0) -> list[WallAnalysis]          # limit_state
```

- **İtki:** `lateral_pressure(soil.retained_profile(), ...)` — katman başına Coulomb K, depremde katman başına
  M-O K_AE; su basıncı ayrı bileşen. Kuvvetler: EH zemin, LS sürşarj, EQ artım, **WA su**.
- **Sanal düzlem:** konsolda topuk ucundan düşey, yükseklik H + topuk·tanβ; ağırlık duvarında θ eğimli arka
  yüz. Derinlikler düzlemin tepesinden ölçülür, katman sınırları düzlem üzerindeki kotlara dönüştürülür
  (eğimli dolguda düzlemin tepesi z = 0'ın topuk·tanβ üstündedir; o kısım en üst katmana aittir). Kuvvet
  doğrultusu mevcut `earth_thrust_forces` ile aynı (δ+θ). E4 bunu `lateral_pressure`'a varsayılanı mevcut
  davranışı koruyan bir kwarg ekleyerek veya layered.py içinde yapar.
- **Su:** taban altında kaldırma = tabandaki u dağılımı × B (ön/arka yük farkında doğrusal); ön taraf ve temel
  `front_profile()` ile, arka taraf `retained_profile()` ile.
- **Yük tipleri:** `limit_state._factor_forces` bilinmeyen yük tipine sessizce 1.0 vermez → `GeoTekError`.
  WA katsayısı bir kodun YAML'ında yoksa `required_inputs` onu eksik katsayı olarak listeler, kullanıcıdan
  alınır (uydurulmaz). ASD'de global GS kullanıldığından yük katsayısı uygulanmaz.
- **Pasif:** `settings.use_passive` False ise hiç kullanılmaz (temel seviye: False). Açıksa ön taraf
  `lateral_pressure(front_profile(), D, top=front_depth, state="passive")` × `passive_reduction`.
- **Taşıma gücü:** taban katmanı parametreleri; B derinliğinde daha zayıf katman varsa uyarı (iki tabakalı
  taşıma gücü bu pakette yok).
- **Global stabilite:** `wall_global_stability(..., retained_bands=None)` kwarg'ı; None iken eski davranış birebir.
- **Tek tabaka eşdeğerliği (zorunlu regresyon):** `soil_from_basic(inp: BasicWallInput, D: float) ->
  StructureSoilModel`: profil = tek katman temel zemini (φ, c, γ, `delta_base = atan(min(tanφ, 0.6))`),
  z ∈ [0, H + max(3H, 10)]; `retained_fill` = [dolgu katmanı 0..H]; YASS profil altında. Temel seviye
  konvansiyonları aynen korunur: `WallLoads(seismic_increment_height=0.5)` (TBDY H/2; varsayılan 0.6 değil),
  k_h = 0.4·S_DS/r, k_v = 0.5·k_h, r = `TBDY_R["gravity_80sds_mm"]`, pasif kapalı, sürşarj dengeleyici değil,
  ASD + Vesic, ön zemin üstü dolgu ağırlığı dahil değil, D = max(0.6, ⌈H/10⌉), momentler ön ayak ucuna göre,
  örtü yükü = ön zemin γ·D (19·0.6 = 11.4 kPa). Bu modelle `size_structure` → B = **4.60 m**, yöneten
  **seismic:bearing**; her kontrol değeri `size_wall` ile göreli 1e-4 içinde. Tek tabaka/susuz/c = 0 durumda
  katmanlı itki `trial_wedge` ile eşit (göreli 1e-4).
- **Servis** `geotek/services/structures.py`:

```python
ProgressFn = Callable[[float, str], None]          # (0..1, i18n message key); may raise Cancelled
class MissingFactorsError(GeoTekError): missing: list[MissingFactor]
def required_factors(project: Project, structure_id: str) -> list[MissingFactor]
def size_structure(project: Project, structure_id: str, progress: ProgressFn | None = None) -> StructureWallResult
def check_structure(project: Project, structure_id: str, progress: ProgressFn | None = None) -> StructureWallResult
def design_sheet_pile_structure(project: Project, structure_id: str, progress=None) -> BasicSheetPileResult | SheetPileDesign
```

  `StructureWallResult` = `BasicWallResult` alanları + `pressures`, `result_hash`. Temel seviye: ASD + TBDY
  deprem; ileri seviye: seçili kod. Eksik katsayıda `MissingFactorsError` (API 422 `missing_factors`).
- E4 teslimi **2. onay kapısı**: formül özeti + el hesabı sonuçları + iki bağımsız inceleme.

## 6. A1 — FastAPI (gpt-reserve high)

- `geotek/api/app.py` 501 gövdeleri servislere bağlanır. Durum: bellekte tek açık proje (`ProjectStore`) + yol.
- İşler: süreç içi `ThreadPoolExecutor(max_workers=2)`; `progress` → `JobState.progress/message_key`; iptal
  bir sonraki ilerleme çağrısında `Cancelled` fırlatır.
- Hata eşlemesi: `ValidationError` → 422 `validation`; `KeyError` → 404 `not_found`; `MissingFactorsError` →
  422 `missing_factors`; `GeoTekError` → 400 `engine_error`.
- Yalnız `127.0.0.1`; üretimde `web/dist` statik olarak `/`'den sunulur.

## 7. F1 — web iskeleti (gemini-4-argon high)

- `web/`: Vite + React + TS, Mantine (açık/koyu), React Router, ECharts, i18next.
- Tipli istemci `docs/contracts/openapi.json`'dan `openapi-typescript` ile; mock aynı tiplerle (`VITE_API_MOCK=1`).
- Üst iş akışı çubuğu: Proje → Arazi verileri → Zemin modelleri → Yapılar → Rapor.
- Metinler `/api/i18n/{lang}`'den; yeni anahtarlar `web.*`, `job.step.*`, `error.*` ad alanlarında, `tr.json`
  ve `en.json`'a birlikte eklenir.

## 8. Onay kapısında sorulanlar

1. Su itkisi ayrı "WA" yük tipi; EC7/LRFD/TBDY YAML'larında WA katsayısı yoksa eksik katsayı olarak sizden
   istenecek.
2. Eski `module2_inputs` formu yeni yapıya otomatik çevrilmez; F4'te "eski girdiyi içe al" düğmesi.
3. İki tabakalı taşıma gücü bu sürümde yok, yalnız uyarı.
4. `passive_reduction = 0.5` mevcut kodda kaynaksız varsayılan; ileri seviyede pasif açılınca değer
   kullanıcıya gösterilip onaylatılacak.
