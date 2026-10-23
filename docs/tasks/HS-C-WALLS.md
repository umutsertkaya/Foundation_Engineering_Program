# HS-C — Duvar tarafı: deprem sürşarj artışı 2H/3, sükûnet basıncı analizi, hızlı palplanşta γsat

**Durum:** uygulanıyor (2026-10-23). Tasarım ve kararlar: Opus. Uygulayıcı yalnız bu kartı kodlar.
Kaynaklar: Keleşoğlu *Gravity Wall / Anchored Wall* (TBDY 2018 dinamik itki dağılımı, slayt 7);
*Yanal Toprak Basıncı* (Das; Jaky 1944; Mayne & Kulhawy 1982; slayt 5–8).
Kod/docstring İngilizce, kullanıcı metni i18n (TR/EN). Hesap formülü değişikliğidir: elle hesap testi zorunlu.

## C1. Sürşarjın dinamik itki artışı 2H/3'te (formül değişikliği)
Kaynak (TBDY 2018, ders örneği slayt 7): zemin artışı P4 = 0.5·ΔKad·γ·H² **H/2**'de; sürşarj artışı
P3 = ΔKad·q0·H (üstte 2·ΔKad·q0 olan ters üçgen) **2H/3**'te (taban üstünden).
Program bütün artışı `loads.seismic_increment_height·H`'de uyguluyor.

### `engine/walls/base.py::earth_thrust_forces`
`p_ae` yanında `p_ae0 = trial_wedge(**common, q=0.0, kh=..., kv=...).force` hesapla.
- `"Seismic increment"` → `p_ae0 - p_soil`, yükseklik `loads.seismic_increment_height * H` (değişmez).
- Yeni `"Seismic increment (surcharge)"` → `(p_ae - p_total_static) - (p_ae0 - p_soil)`, yükseklik `2/3 * H`,
  tür `"EQ"`; yalnız `loads.surcharge > 0` ve büyüklük `abs(...) > 1e-12` ise eklenir.
- Uyarı (`p_ae < p_total_static`) korunur.
Toplam deprem artışı değişmez; yalnız sürşarj kısmının kolu değişir.

### `engine/walls/layered.py::_retained_pressures` / `_thrusts`
`dynamic0` = q=0 ile dinamik dağılım (su altı yolunda `_submerged_dynamic(profile, hv, loads, settings, 0.0, common, zero)`,
diğerinde `lateral_pressure(profile, hv, kh=..., kv=..., **common)`); `_retained_pressures` bunu da döndürür.
`_thrusts`: `"Seismic increment"` terimleri `[(dynamic0, 1.0), (zero, -1.0)]`, `y = seismic_increment_height*hv`;
`loads.surcharge` varsa `"Seismic increment (surcharge)"` terimleri `[(dynamic, 1), (static, -1), (dynamic0, -1), (zero, 1)]`,
`y = 2/3*hv`. Dinamik su itkisi (`dynamic_water`) değişmez.

### Kaynak gösterimi
`WallLoads.seismic_increment_height` docstring'ine ve ilgili rapor/sonuç kuvvet etiketlerine (i18n
`walls.force.seismic_increment_surcharge` TR "Deprem artışı (sürşarj)" / EN) ekle; varsayım listesine:
"Sürşarjın dinamik itki artışı 2H/3'te (TBDY 2018; ters üçgen dağılım)".

### Testler
- Ders Problem 1 (konsol, H=6 m, B=4.5, topuk 4.1, gövde 0.4, taban 0.4, γ=18, φ=30, δ=0, q=10, γc=25,
  SDS=1.0, r=1.5 → kh=0.2667, kv=0.1333): `"Seismic increment (surcharge)"` kolu 4.0 m (=2H/3), zemin artışı kolu 3.0 m;
  büyüklükler `trial_wedge` ile bağımsız hesaplanıp karşılaştırılır; toplam artış eski toplamla aynı (1e-9).
- Elle: Mononobe-Okabe δ=0, θ=0, β=0, φ=30, ψ=atan(kh/(1−kv)) ile K_AE; sürşarj artışı = q·H·((1−kv)·K_AE − Ka)
  (kv yukarı) — `trial_wedge` sonucu ile 1e-3 bağıl.
- Tabakalı yol için aynı problem tek tabaka profille: iki yolun kuvvet ve kolları eşleşir.
- Mevcut regresyonlarda değişen devrilme momentleri yeniden hesaplanır (testi atlama yok).

## C2. Sükûnet basıncı analizi (yeni, Das; kaynak slayt 5–8)
### Motor `engine/earth_pressure/distribution.py`
`at_rest` dalı: K0 = `layer.design.K0` (onaylı tasarım değeri). `None` ise `LayerDesignError(layer, "k0_missing")`
(`core/errors.py` `_TEXT`: `"k0_missing": "design K0 not set"`; i18n `layer_k0_missing`). Jaky varsayılanı
kaldırılır (K0 adayları zemin modülünde, HS-A A3.6). `at_rest` dalı drenajsız kontrolünden **önce** çalışır:
sükûnet basıncı efektif gerilme ile σ'h = K0·(σ'v + q), toplam σh = σ'h + u (drenajsız katmanda da), c' kullanılmaz,
eğimli dolguda mevcut hata korunur.

### Servis `services/at_rest.py` (yeni)
```python
class AtRestInput(BaseModel):
    profile_id: str
    height: float = Field(gt=0)          # wall height H [m], top at ground surface
    surcharge: float = Field(0.0, ge=0)  # uniform q [kPa]
    gwt_case: Literal["insitu", "design", "seismic"] = "design"

@dataclass
class AtRestResult:
    z: list[float]; sigma_h_eff: list[float]; u: list[float]; sigma_h: list[float]
    layers: list[dict]        # {layer_id, top, bottom, K0}
    components: list[dict]    # {name: "soil"|"surcharge"|"water", force kN/m, height above base m}
    total_force: float; total_height: float  # resultant and its height above the base
    warnings: list[str]
def at_rest_analysis(project, inp) -> AtRestResult
```
Bileşenler kaynakla aynı: P1 sürşarj (K0·q, dikdörtgen), P2 zemin (K0·σ'v), Pw su (γw·hw²/2); kollar dağılımın
momentinden (taban üstü). `lateral_pressure(profile, H, state="at_rest", surcharge=q, gwt_case=...)` ve mevcut
`resultant` yardımcıları kullanılır; sürşarj bileşeni = (q'lu − q'suz) fark.

### API ve web
`walls` modülüne `POST /walls/at-rest` (`operation_id="analyze_at_rest"`), gövde `AtRestInput`, dönüş DTO. Hatalar
mevcut `LayerDesignError` → 422 deseniyle (i18n mesaj kodu). Web: walls modülünde "Sükûnet basıncı" sekmesi/sayfası:
profil seçimi, H, q, YASS durumu; sonuç: basınç diyagramı (mevcut duvar diyagram bileşeni deseni), katman K0 tablosu,
bileşen tablosu (P, kol), toplam. Eksik K0'da "Katman X için K0 onaylanmalı (Zemin › Parametreler)" mesajı.

### Testler
- Kaynak slayt 7–8 deseni: tek katman φ=30 → K0 onaylı 0.5, γ=18, q=10, H=6, YASS yok: σ'h(0)=5, σ'h(6)=59;
  P1=30 kN/m @3 m, P2=162 kN/m @2 m, toplam 192.
- YASS 2 m, γsat=20: u(6)=39.24, Pw=78.48 @1.333 m; σ'h(6)=0.5·(10+36+4·10.19)=43.38 (γ'=20−9.81).
- K0 onaysız → 422 `layer_k0_missing`.

## C3. Hızlı palplanşta sessiz γsat = γ (`services/walls_basic.py`)
`BasicSheetPileInput`: `gwt_depth < retained_height + max(3·retained_height, 12)` (model derinliği içinde su) ve
`gamma_sat is None` → doğrulama hatası "gamma_sat required when the water table lies within the model depth".
`design_sheet_pile_basic`: `gamma_sat=inp.gamma_sat` (`or inp.gamma` kaldırılır). Web hızlı palplanş formunda γsat,
YASS girildiyse zorunlu (i18n hata metni). Test: YASS 3 m ve γsat yok → 422; γsat verilince çalışır.

## Kabul
`python -m pytest tests -q` tam; `cd web && npm run typecheck && npm test`; openapi export + `npm run gen:api`;
`gen_code_map` + `--check` 0. Değişen sayısal sonuçlar test açıklamasında elle hesapla gerekçelendirilir.
