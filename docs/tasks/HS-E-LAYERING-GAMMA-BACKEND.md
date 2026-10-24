# HS-E — Otomatik γ/γsat önerisi ve SPT + CPT ortak katmanlama (arka uç)

**Durum:** uygulanacak (2026-10-24). Tasarım: Opus. Uygulayıcı yalnız bu kartı kodlar.
Kullanıcı kararı (Umut, 2026-10-24): korelasyon yalnız verdiği kaynaklardan; nemli/doygun ayrımı önemsiz, değer
değiştirilebilir. Kaynak: Keleşoğlu, *Foundation Engineering 2 – In-Situ Tests* slayt 28 (Bowles 1996 Tablo 3-4),
CPT için mevcut Robertson & Cabal (2010). Kil için kaynakta SPT–γ bağıntısı **yok** → SPT'den kil γ'sı önerilmez.
Kod/docstring İngilizce, kullanıcı metni i18n (TR/EN) anahtarı. Öneri hiçbir zaman onay değildir.

## E1. SPT katmanlaması profil istemez
`services/layering.py::propose_layers`: SPT için katman önerisi yalnız N60 kullanır (HS-A'dan beri gerilmesiz).
Aktif profil yoksa `process_investigations` hatası yerine `engine/insitu/spt.py::equipment_corrections` ile
`depth, n60, refusal` alınır ve `spt_uscs_n_layers` / `spt_log_layers` bunlarla çalışır (gerekirse küçük bir
`SPTProcessed` benzeri ara yapı ya da parametre). Profil varken davranış aynı kalır. Test: profilsiz projede SPT önerisi.

## E2. Birim hacim ağırlığı önerisi — yeni saf modül `engine/layering/unit_weight.py`
```python
@dataclass
class WeightSuggestion:
    gamma: float | None; gamma_source: str | None          # "lab" | "phase" | "cpt_rc2010" | "spt_bowles"
    gamma_sat: float | None; gamma_sat_source: str | None
    range: tuple[float, float] | None                       # Bowles range when the source is spt_bowles
def suggest_unit_weights(layers, *, gwt, lab, cpt_points, spt_points, supplied) -> tuple[list[WeightSuggestion], list[str]]
```
Girdiler: katman sınırları ve USCS; `lab` = (derinlik, γ, w, Gs) numuneleri; `cpt_points` = (derinlik, RC2010 γ);
`spt_points` = (derinlik, N60); `supplied` = kullanıcının girdiği {katman indeksi: (γ, γsat|None)}; `gwt` m (None = bilinmiyor).
Her katman için öncelik (ilk bulunan kazanır, kaynağı kaydedilir):
- **γ:** (1) katmandaki lab γ ölçümlerinin ortalaması → `lab`; (2) katmandaki YASS üstü CPT RC2010 noktalarının
  ortalaması (YASS yoksa bütün noktalar) → `cpt_rc2010`; (3) SPT Bowles → `spt_bowles`.
- **γsat:** (1) katmandaki w ve Gs'si olan numunelerden faz bağıntısı S = 1: e = w·Gs, γsat = (Gs + e)·γw/(1 + e)
  (`engine/lab/phase.py` kullanılır, yeniden yazılmaz), ortalama → `phase`; (2) lab γ ortalaması → `lab`;
  (3) YASS altı CPT noktaları ortalaması (yoksa bütün noktalar) → `cpt_rc2010`; (4) SPT Bowles → `spt_bowles`
  (Umut: nem ayrımı önemsiz; γsat = aynı tablo değeri).
- `supplied` varsa o katmanın değerleri kullanıcınındır (kaynak `user`), öneri hesaplanmaz.
- **SPT Bowles (yalnız iri daneli katman: USCS G* veya S*, ikili semboller ilk harfe göre):** her SPT noktasında
  N′70 = N60·(60/70)·C_N, C_N = min(√(Pa/σ′v), 1.7) (mevcut `overburden_factor_liao_whitman`). σ′v yukarıdan aşağı
  katman γ/γsat değerleriyle hesaplanır (YASS altında γsat − γw, YASS bilinmiyorsa kuru + uyarı
  `layering.warning.gwt_unknown_for_gamma`). Katman N′70 = noktaların ortalaması; aralık mevcut
  `services/parameters.py::BOWLES_GAMMA_CLASSES`/`_bowles_gamma_range` ile aynı tablo (bu tabloyu `engine` içine
  taşı ve servis oradan import etsin; modül kuralı: engine servisi import etmez). Öneri = aralığın ortası, `range` doldurulur.
  Sabit nokta: katmanın γ'sı 18.0 ile başlar, |Δγ| < 0.01 olana kadar (en çok 50 adım) yinelenir; sınır aşılırsa uyarı.
  Katman yukarıdan aşağı işlenir; üstteki bir katmanın γ'sı yoksa (öneri de, `supplied` da yok) alttaki SPT önerileri
  hesaplanmaz ve `layering.warning.gamma_above_missing` uyarısı verilir.
- İnce daneli ya da USCS'si bilinmeyen katmanda SPT önerisi yok; uyarı `layering.warning.spt_gamma_granular_only`.
Elle test (testte yaz): N60 = 15, tek katman SP 0–6 m, YASS yok, nokta 3 m: γ = 18 ile σ′v = 54, C_N = 1.3698,
N′70 = 15·60/70·1.3698 = 17.61 → sınıflar medium (7–25) ve dense (16–45) → aralık 17–22 → öneri 19.5; γ = 19.5 ile
σ′v = 58.5, C_N = 1.3161, N′70 = 16.92 → aynı aralık → yakınsadı, γ = 19.5.

## E3. Öneriler katmanlama sonucuna
`engine/layering/common.py::Layer` alanları: `gamma_source`, `gamma_sat_source`, `gamma_range` (hepsi None varsayılan);
`LayeringProposal` DTO'su ve OpenAPI aynı alanlarla. `propose_layers` her öneri sonrası `suggest_unit_weights`'i
çağırır; CPT yolunda RC2010 zaten var, lab varsa (aynı kimlikli sondaj yok; CPT tek başına) değişmez.
SPT yolu: lab = sondajın numuneleri, spt_points = N60, gwt = sondajın `gwt_depth`, yoksa aktif profilin insitu YASS'ı.
Rotalar (`propose_spt_layers`, `propose_cpt_layers`) gövdesine isteğe bağlı `supplied_gamma: {index: {gamma, gamma_sat}}`
eklenir (geriye uyumlu: yoksa boş). `proposal_to_layers` ve `materialise` mevcut sözleşmeyle çalışmaya devam eder.

## E4. Ortak katmanlama (yeni)
`LayeringSettings.method` değerine `"combined"` ekle. Yeni rota `POST /layering/combined`
(`operation_id="propose_combined_layers"`), gövde `{cpt_id, borehole_ids: [..], settings, supplied_gamma?}`.
Saf motor `engine/layering/combined.py::combined_layers(cpt_proposal, spt_proposals, cpt_points, labs, ..)`:
1. **Kot hizalama:** CPT ve sondajın ikisinde de `elevation` varsa sondaj derinliği CPT çerçevesine:
   d′ = d + (elev_cpt − elev_bh). Yoksa d′ = d ve uyarı `layering.warning.depth_not_aligned` (sondaj kimliğiyle).
2. **Mesafe:** iki kayıtta x, y varsa yatay mesafe hesaplanır ve sonuca `distances: {borehole_id: m}` yazılır.
   Eşik yok (uydurma eşik konmaz); arayüz gösterir, kullanıcı karar verir.
3. **Sınırlar:** CPT önerisinin sınırları + her sondaj önerisinin sınırları (hizalanmış). Aralarında
   `settings.min_thickness`'tan yakın olan sınırlar tek sınır olur, CPT'ninki tutulur. Her sınıra kaynak etiketi:
   `"cpt"`, `"borehole"`, `"both"` (sonuç katmanında `top_source`).
4. **Zemin türü:** katmandaki lab numunelerinin USCS çoğunluğu (eşitlikte en sığ; HS-A `evaluation_uscs` kuralıyla aynı)
   → yoksa katmanla en çok örtüşen sondaj önerisi katmanının USCS'i → yoksa CPT SBTn (USCS boş, `sbtn_zone` dolu).
5. **Çelişki:** CPT grubu katmandaki noktaların ortalama Ic'sinden: Ic < 2.05 → `coarse`, Ic > 2.60 → `fine`,
   arası `transitional`. USCS grubu: G*/S* → `coarse`, diğer → `fine`. `coarse` ↔ `fine` karşıtlığında
   `conflict = {"cpt": grup, "uscs": sembol, "ic_mean": değer}` yazılır; `transitional` çelişki sayılmaz.
   Çelişkili katman varken `materialise` 422 `layering_conflict_unresolved` döner; istemci çözümü
   `resolution: "uscs" | "cpt"` alanıyla gönderir (cpt seçilirse USCS boşaltılır, davranış Ic grubundan).
6. **Davranış:** iri daneli → drained, ince → undrained (mevcut kural), geçiş bölgesinde USCS'e göre.
7. **γ:** E2 bütün kaynaklarla (lab: bütün sondajların numuneleri, CPT RC2010 noktaları, SPT N60 noktaları).
`Proposal`'a `source_ids: list[str]` eklenir (tek kaynaklı önerilerde `[source_id]`); `materialise`
`proposal.source_ids`'in `payload.source_ids` içinde olmasını ister.

## Testler (el hesabıyla)
- E1 profilsiz SPT önerisi; E2 elle örnek (yukarıdaki 19.5), öncelik sırası (lab > phase > CPT > SPT),
  faz bağıntısı w = 0.30, Gs = 2.70 → e = 0.81, γsat = (2.70 + 0.81)·9.81/1.81 = 19.02; kil katmanında SPT önerisi yok;
  üst katman eksikse alt katman önerisi yok + uyarı; `supplied` önceliği.
- E4: kot hizalama (elev_cpt 100.0, elev_bh 99.0 → d′ = d + (100 − 99) = d + 1.0),
  sınır birleştirme (0.3 m < min_thickness 0.5 → tek sınır, CPT konumu), çelişki işaretlenir ve çözümsüz 422,
  çözüm sonrası profil oluşur, mesafe hesabı (3-4-5 üçgeni → 5.0 m).
- Mevcut katmanlama ve profil testleri geçer; değişen beklenen değer varsa gerekçesi testte.

## Kabul
`python -m pytest tests -q` tam; openapi export + `npm run gen:api`; `npm run typecheck`; `gen_code_map` + `--check` 0.
