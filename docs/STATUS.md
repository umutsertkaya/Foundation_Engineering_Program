# GeoTek — güncel durum ve tek iş sırası

Son güncelleme: 2026-10-20 (sistem kontrolü ve temizlik). Bu sayfa **tek güncel durum kaynağıdır**;
ayrıntılı geçmiş Git günlüğünde ve birleşmiş PR'lardadır. Son kontrol raporu: [sistem kontrolü](qa/sistem-kontrolu.md).

## Aktif iş

Compact veya devir öncesi yalnız bu üç satır güncellenir (kural: [WORKFLOW](WORKFLOW.md#bağlam-ve-compact-kuralı)).

- Biten: 2026-10-20 sistem kontrolü ve temizlik (hedef adım 1): ~50 bulgu, motor/API/rapor/web düzeltmeleri, PySide6 `geotek/ui` + `geotek/plotting` kaldırıldı, eski arşiv/kartlar silindi. Kanıt: [qa/sistem-kontrolu.md](qa/sistem-kontrolu.md).
- Sıradaki: hedef adım 2 (modüler yapı ve yeni modül eklenebilirliği), ardından adım 3 [K1](tasks/K1.md) exe üretimi.
- Açık karar: yok. CPT γ alt sınırı (R&C 2010, 12 kN/m³) ve `predrill_depth` dışlama Umut onayıyla, profilsiz CPT q_t ≤ 0 için en yakın γ koordinatör kararıyla uygulandı (2026-10-20).

## Koddan doğrulanan durum

| Alan | Şu an |
|---|---|
| Çekirdek | Başlangıç, kütüphane, proje/oturum, modül keşfi, işler, katsayılar ve birleşik i18n API. |
| Veri | `.gtk` şeması 1.3; eski sürüm göçleri, yapı zemin kopyası, stale/hash kontrolleri. NaN/Infinity içeren dosya reddedilir. |
| Zemin | CPT/SPT işleme, otomatik katmanlama, parametre aday/seçim/onay, sınıflandırma (SBTn + USCS) web akışı. |
| Duvar | Katmanlı motor, öner/kontrol, iş takibi/iptal, analiz seçenekleri, sonuç kartları, SVG kesit. |
| Sıvılaşma | Motor/API, iş takibi, kayıtlı sonuç, GS ve CSR/CRR grafikleri, ayrıntı tablosu. |
| Palplanş | Motor/API, oluşturma, tasarım işi, sonuç paneli, çevrilebilir uyarı/varsayım kodları. |
| Rapor | docx (`POST /api/m/report/docx`); PDF ve grafik yok. |
| Paket | `geotek/launcher.py` (API + `web/dist`, tarayıcıyı açar), `tools/build_exe.ps1` ve `.github/workflows/build-exe.yml` (windows-latest, PyInstaller, artifact `GeoTek-windows-exe`). Arayüz yalnız web; PySide6 yolu kaldırıldı. |

Kabul kanıtı: gerçek API uçtan uca [T10-kabul](qa/T10-kabul.md) (61 adım), görsel [T11-gorsel](qa/T11-gorsel.md) (128 ekran).

## İş sırası

| Sıra | Kart | Kapsam |
|---|---|---|
| 1 | Hedef adım 2 | Modüler yapı doğrulaması: `tools/new_module.py`, [MODULE_GUIDE](MODULE_GUIDE.md), exe sonrası modül ekleme. |
| 2 | [K1](tasks/K1.md) | Yerel başlatıcı + exe (hedef adım 3). |
| Açık | [T9b](tasks/T9b-PILE-SOIL.md) | Palplanş zemin Y2/Y4, mühendislik kararı bekliyor. |
| Açık | [T10b](tasks/T10b-POLISH.md) | Sıvılaşma/rapor cilası, duvar varsayımlarının TR/EN kodları. |
| Açık | [T12](tasks/T12-MATERIAL-FACTORS.md) | Kullanılmayan katsayılar (malzeme γ, kaya eksantrisitesi), S4. |

Paralel çalışmada en çok iki bağımsız yazıcı. Ortak dosya ihtiyacı varsa şef önce sözleşmeyi netleştirir.

## Onaylar ve mühendislik sınırları

- Tarihsel kayıtta P1, E4/kapı 2 ve yapı Y1/Y2 onaylı. Bunları yeniden açma.
- Görsel kapı 3 (F1/zemin) ve kapı 4 (F3/F4) için açık insan kabul kaydı yok; T11 görsel kontrolü Claude
  incelemesidir. Umut'un 2026-10-20 hedef planı (kontrol → modülerlik → exe) bu kapıların yerine geçti
  (koordinatör kaydı); kodun main'e birleşmesi insan kabulünün yerine geçmez.
- Paketleme öncesi kullanıcı onayı: Umut'un hedef planının 3. adımı exe üretimini istiyor.
- Su altı deprem, ±kv zarfı, uplift moment ve YASS taşıma gücü kararları için
  [E4 formül kaydı](contracts/E4_FORMULAS.md) ve [araştırma](research/submerged_seismic_thrust.md).
- `delta_base` önerisi gerçek `phi_cv` alanı bulunmadığından `phi_cv_assumed_equal_phi_eff` uyarısı taşır.
- LS extreme_I 0.50 proje varsayımıdır; duvar sonucunda görünür varsayım + uyarı (`wall.ls_extreme_i`).
- Yönetmelik kaynak doğrulama açıkları: [katsayı doğrulama listesi](katsayi_dogrulama.md).
  Eski notta okunamadığı belirtilen KDYY belgelerinin doğrulandığını varsayma.

## T3a-FIX etki notu (2026-10-20)

`youd2001.py` CPT yolu Youd 2001 metnine hizalandı: Q'da net qc, ara üs 0.7 (eski 0.75), Kc yalnız Ic'ye bağlı (F<0.5 kısayolu kaldırıldı). qc1N brüt qc ile kalır. SPT değişmedi.
Etki (σv=100, σ'v=60 kPa, bağımsız denklem hesabı; FS = CRR·MSF·Kσ/CSR olduğundan FS, CRR7.5 ile aynı oranda değişir):
kum (qc 10000) CRR 0.276→0.276 (0%); siltli kum (4000/60) 0.154→0.157 (+2%); kil (800) değişmez; Ic≈2.56 ara bölge (900/5) 0.084→0.087 (+3%); düşük-F siltli kum (2000/5, F<0.5) 0.071→0.085 (+18%, kısayol kalktığı için Kc 1→1.62). Etki yalnız Ic>1.64 ara/siltli CPT katmanlarında; temiz kum değişmez.
Test 2026-10-20: tam pytest 1688 geçti/1 atlandı; discrepancy 16 geçti; gen_code_map --check 0. Andrus-Stokoe üssü (madde 5) doğrulanmadı, kod değişmedi.
Not (T3a-FIX inceleme): Kc'deki F<0.5 kısayolu R&W 1998'de vardı, Youd 2001 Eq.19'da yok; çevre PDF metni doğrulanmadı, koordinatör kararıyla silinmiş kalır. Ic tanımsız (net qc<=0, fs<=0, σ'v<=0) noktalar NaN -> INVALID + uyarı; fs=0 artık "clay_like" değil INVALID (2026-10-20 sistem kontrolüyle BI2014 yolunda da: `normalise_iterative` fs<=0 noktayı I_c tanımsız sayar). Ic>2.6 noktalar mevcut sözleşmeyle CLAY_LIKE (FS atanmaz). σ'v>Pa için n=0.7 ara dalı ızgara taramasında ulaşılamadı (yalnız n=0.5/1).

## Youd 2001 makale kontrolü (2026-10-20, salt okuma, kod değişmedi)
Kaynak: Umut'un cihazındaki tam metin md dönüşümü (`docs/research/Youd.et.al.LiquefactionEvaluation.2001.ASCE.md`; telifli, git dışı, `.gitignore`). Denklemler dönüşümde çoğunlukla okunamıyor (Eq. 23/25/26 yok, Eq. 19 bozuk).
- F<0.5% / Kc=1.0 kısayolu: makalede **yok** ("0.5 %" ifadesi geçmiyor). Kc yalnız Ic'ye bağlı (md satır 306-314, Robertson & Wride 1998'e atıf); kısayol R&W 1998'e aittir. `youd2001.py` `kc_factor` (Ic<=1.64 -> 1.0, aksi halde polinom) makaleyle uyumlu; eski "doğrulanmadı" notu kapandı.
- MSF: makale tek üs önermez, aralık verir (md 498-500): M<7.5 için alt sınır Idriss (Tablo 3 sütun 3, Eq. 23), üst sınır Andrus-Stokoe (sütun 7, Eq. 26); M>7.5 için Idriss kullanılmalı (Eq. 25). Üslerin sayısal değerleri (−2.56 / −3.3) md'de okunamadı, PDF'ten doğrulanabilir. Kod: varsayılan `idriss`, `andrus_stokoe` (M/7.5)^-3.3; NCEER'in bilinen formülleriyle uyumlu.
- Koordinatör kararı: M>7.5'te `andrus_stokoe` engellenmez (Idriss'ten düşük, tutucu); seçilirse `liquefaction.warning.msf_andrus_stokoe_high_magnitude` uyarısı (TR/EN, testli) çıkar. Formül değişmedi.

## Son doğrulama

- 2026-10-20, sistem kontrolü dalı (Linux bulut): tam pytest 1869 geçti / 2 atlandı; `tsc --noEmit` temiz;
  Vitest 37 dosya / 337 test geçti; `npm run build` başarılı; `gen_code_map.py --check` 0.
  Windows `tools/project.py check full` bu ortamda çalıştırılamadı.
- 2026-10-20, modüler yapı kontrolü dalı (Linux bulut, kip: cloud): modül manifest'ine rapor bölümü kancası
  (`report_entries`/`report_writer`) ve `tools/pyinstaller_modules.py` (exe için hidden-import/add-data listesi) eklendi;
  rehber güncellendi. Tam pytest 1874 geçti / 2 atlandı; `tsc --noEmit` temiz; Vitest 37 dosya / 337 test geçti;
  `npm run build` başarılı; `gen_code_map.py --check` 0. Formül/katsayı değişmedi. Sıradaki: exe derlemesi (adım 3).

Her kayıt tarih, kapsam ve gerçek sonuç taşır; eski sayı güncel başarı diye kullanılmaz.

## Çalışma alanları ve devir

- Ortak kaynak GitHub `main`; cihaz klasörü ve bulut kapsayıcıları çalışma kopyasıdır ([CLOUD_MODE](CLOUD_MODE.md)).
- Cihazdaki eski `Documents/geotek-wt/` worktree'lerinin silinmesi kararlaştırıldı; uygulandığı bu oturumdan doğrulanamadı.
- Claude Code Projects: [CLAUDE_PROJECTS.md](CLAUDE_PROJECTS.md), talimat [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md).
- Kod bulma: `code_map_target` → `code_map_read`; büyük CODE_MAP belgesi varsayılan bağlam değildir.
  Araç kurulum kanıtı: [2026-10-20 araç denetimi](audit/2026-10-20-projects-codemap.md).

Yalnız bu sayfayı güncelle: biten görev + kanıtı, sıradaki kart, açık karar ve test sonucu.
- 2026-10-20 (hedef adım 3): yerel başlatıcı + exe derleme hattı eklendi. Test: `tests/unit` 1031 geçti + `test_launcher.py`; Linux'ta PyInstaller denemesi: exe `/api/health`, `/api/modules` ve arayüzü sundu. Windows exe'si GitHub Actions'ta derlenir (çalıştırma kontrolü yapılmadı, istenmedi).
