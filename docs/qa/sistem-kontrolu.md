# Sistem kontrolü ve temizlik — 2026-10-20

Hedef planın 1. adımı. Kapsam: hesap motoru (`geotek/engine`), servisler, FastAPI, web, docx raporu,
YAML yapılandırma, testler; ardından ölü kod, eski belge ve yönerge temizliği.
Yöntem: motor, API/rapor ve web için üç ayrı salt okuma taraması (her bulgu küçük betikle yeniden üretildi),
düzeltmeler ve her gerçek hata için test, onaylı iki hesap değişikliği için iki bağımsız salt okuma incelemesi.

## 1. Düzeltilen hatalar

Her satır için test var (`tests/unit/test_system_check_engine.py`, `tests/api/test_system_check_api.py`,
`tests/api/test_report_api.py` ve ilgili web testleri). Önem: Y yüksek, O orta, D düşük.

### Motor

| Önem | Hata | Düzeltme |
|---|---|---|
| Y | fs = 0 CPT noktasında Fr = 0 → I_c = ∞ → BI2014 "clay_like" (sıvılaşmada güvensiz taraf) | `normalise_iterative` fs ≤ 0 noktayı I_c tanımsız sayar → `invalid` + uyarı |
| O | Profilsiz CPT'de q_t ≤ 0 noktanın γ'sı NaN; kümülatif σv tüm sondajda uyarısız NaN | En yakın geçerli γ + görünür uyarı `cpt_gamma_nearest` (karar: §3) |
| O | `CPTSounding` NaN/∞ kabul ediyordu; kullanıcı FC'si NaN olabiliyordu | Sonlu olmayan değer reddedilir |
| O | Vesic drenajsız: m·H ≥ A'·c·N_c iken i_c ≤ 0 → negatif q_ult; c = 0'da sıfıra bölme | `BearingFailureError` (Hansen ile aynı davranış) |
| O | Yukarıdaki ret duvar boyutlandırmasını tümden durduruyordu (2. inceleme buldu) | `size_structure` bu hatayı o genişliğin başarısızlığı sayar, daha geniş tabana geçer |
| D | BI2014: kullanıcı FC'si verilince I_c tanımsız noktada yine FS çıkıyordu | FS = NaN |
| D | Global stabilite bant süzgeci üstü (0, 1e-6] olan bandı atlıyordu | `b.top <= EPS` |
| D | Kısa kısmi katsayı yolu (`DA1`) `IndexError` | `GeoTekError` |
| D | Ankrajlı palplanşta ankraj çok aşağıdayken yanıltıcı ileti | "ankraj çok aşağıda" iletisi |
| D | SPT/CPT işleme uyarıları İngilizce serbest metindi ("record(s) at refusal" dahil) | Çevrilebilir kodlar: `insitu.warning.spt_refusal`, `spt_cn_out_of_range`, `cpt_no_u2`, `cpt_points_skipped`, `cpt_not_converged` |

### API ve servisler

| Önem | Hata | Düzeltme |
|---|---|---|
| Y | `PUT /api/project/site` S_DS = Infinity veya 10 kaydediyordu → proje bir daha açılamıyordu | `allow_inf_nan=False`, TBDY 0.4·S_DS ≤ 3 sınırı; `.gtk` yüklemede NaN/Infinity reddi, özet oturum değişmeden kurulur |
| Y | Zemin profili PUT'u onaylı tasarım değerinin sessizce değişmesine / sahte onaya izin veriyordu | `_keep_approvals_honest`: değişen veya sahte onay geri alınır |
| O | Zemin `commit()` Project nesnesini değiştirince iş/yükleme kimlik denetimleri sahte "stale" veriyordu | `session.generation` sayacı; tamamlamada güncel proje yeniden okunur |
| O | Yapı/profil adı parmak izindeydi → yeniden adlandırma sonucu eskitiyordu | Ad, yapı parmak izi, `content_hash` ve sıvılaşma özetinden çıkarıldı (eski sonuçlar bir kez stale görünür; güvenli yön) |
| O | Kaynak profil silinince yapılar sonsuza dek stale kalıyordu | Kullanımdaki profil silinemez: 409 `profile_in_use` (yapı adlarıyla) |
| O | EC7'de yaklaşım seçilmemişse sessizce DA1 | Görünür varsayım `wall.default_approach` / `sheet_pile.default_approach` |
| O | `material.gamma` override kabul edilip uygulanmıyordu | Sonuçta `wall.warning.override_not_applied` uyarısı; uygulama kararı [T12](../tasks/T12-MATERIAL-FACTORS.md) |
| D | Eksik hata anahtarları (`too_many_jobs`, `project_changed`, `design_conflict`, `import_io_error`, `no_save_target`) | TR/EN eklendi; `stale_structure` metni genelleştirildi |
| D | Verisiz sıvılaşma işi boş "tamam" dönüyordu | 422 `liquefaction_no_data` |

### Rapor (docx)

| Önem | Hata | Düzeltme |
|---|---|---|
| O | Ham profil kimliği, ham enum (duvar tipi, YASS durumu, destek, düzey, yöntem, katsayı durumu) | Profil adı (silinmişse "silinmiş profil"), çevrilmiş etiketler |
| O | `wall.ls_extreme_i` varsayım anahtarı eksik | TR/EN eklendi |
| D | Kontrol karakteri içeren metin 500 veriyordu | `_xml_safe` |
| D | Dosya adı Türkçe harfleri atıyordu | ASCII'ye katlanır ("Çözüm Şişli" → `Cozum_Sisli`) |

### Web

| Önem | Hata | Düzeltme |
|---|---|---|
| Y | Kaydedilmemiş değişiklik koruması hiç tetiklenmiyordu (kapat/değiştir veriyi sorusuz kaybediyordu) | Her yazma isteğinden sonra oturum yenilenir; kapat/aç/oluştur kirli durumu okur |
| Y | Duvar sihirbazı boş S_DS'yi 0.5, r'yi 1.5 sayıyordu (uydurma deprem girdisi) | Boş = null (deprem durumu yok); arka uç aralıkları gösterilir, dışındaysa çalıştırma engellenir |
| Y | Eksik katsayı formu her alanı 1.0 ile dolduruyordu (uydurma katsayı) | Alanlar boş; hepsi girilmeden kaydetmez |
| O | Tasarım kodu listesi elle yazılmıştı (`lrfd` ≠ `aashto_lrfd`) | Kodlar API'den |
| O | Kaydet/başlat hataları yutuluyordu; çift tık iki iş başlatıyordu | Hata gösterilir, düğmeler kilitlenir |
| O | `useJob` yarışları (başlatırken iptal, üst üste başlatma) | Başlatma sırası + en iyi çabayla iptal |
| O | Sihirbaz yeniden açılınca kayıtlı duvar sonucu görünmüyordu; palplanşta kayıt sonrası eski sonuç geri yazılıyordu | Kayıtlı sonuç + stale notu; iş bitince yapı yeniden okunur |
| O | Profil "Vazgeç" taslağa dönüyordu | Kayıtlı tabana döner |
| O | Ham profil kimliği (duvar zemin adımı, palplanş, profiller) | `useProfileName`, silinmiş profil etiketi |
| O | Sıvılaşma GS grafiğinde uç değer ekseni eziyordu; CSR/CRR aynı | GS ekseni 3'te kırpılır, kırpılan noktalar kenarda üçgen + tam değer ipucu + not; CSR/CRR üst sınırı max(1, 2×CSR) |
| D | Kayıtlı duvarda sürşarj yoksa 10 kPa gösteriliyordu (arka uç varsayılanı 0) | 0 kPa |
| D | Katalogda olmayan hata kodu ham `error.<code>` gösteriyordu; tanımsız kontrol değeri ∞ | Genel başlık; "—" |
| D | Mock palplanş PUT'u gerçek API'den farklı davranıyordu | Gövde yapıyı tümüyle değiştirir |

## 2. Onaylı hesap değişiklikleri (Umut onayı, 2026-10-20)

**a. Robertson & Cabal (2010) birim hacim ağırlığı alt sınırı.**
γ = (0.27·log R_f + 0.36·log(q_t/p_a) + 1.236)·γ_w formülü ve katsayıları değişmedi; sonuç
`max(γ, 12 kN/m³)` ile sınırlandı. Sınır uygulanınca görünür uyarı: `insitu.warning.cpt_gamma_floor`,
`layering.warning.gamma_floor`, `correlation.warning.gamma_floor` (bu adayda `validity_ok = False`, yani
parametre önerisine girmez; katmanlama önerisi sınırlı ortalamayı kullanır). q_t ≤ 0 için NaN kalır.
El hesabı: q_t = 10 000, f_s = 50 → 18.37 (değişmez); q_t = 100, f_s = 0.1 → 9.46 → **12**;
q_t = 1, f_s = 1e-4 → negatif → **12**. Etkilenen aralık yalnız çok düşük q_t (R_f %1'de ≈ 93 kPa altı);
olağan kum ve kil değişmez.

**b. `predrill_depth` üstündeki okumalar dışlanır.** `depth < predrill_depth` okumalar işlenmez
(eşitlik tutulur), uyarı `insitu.warning.cpt_predrill_excluded`; hiç okuma kalmazsa açık hata.
Parametre adayları da aynı süzgeci kullanır.

İki bağımsız inceleme: ikisi de formül/el hesabını doğruladı, engelleyici bulgu yok (281 hedefli test geçti).
Ayrıntı: [katsayı doğrulama](../katsayi_dogrulama.md) "Korelasyon proje varsayımları".

**Sonuç değiştiren diğer düzeltmeler (katsayı değil, hata düzeltmesi):** fs = 0 noktası artık `invalid`
(eskiden clay_like); I_c tanımsız noktada kullanıcı FC'siyle FS artık NaN; profilsiz CPT'de q_t ≤ 0 noktası
en yakın γ'yı alır (eskiden tüm sondaj NaN). Sonuncusu yeni bir varsayım olduğu için koordinatör kararına
sunuldu; karar gelene kadar görünür uyarıyla korunuyor.

## 3. Açık bulgular (düzeltilmedi)

| Konu | Neden açık | Yer |
|---|---|---|
| Profilsiz CPT q_t ≤ 0 → en yakın γ varsayımı | Koordinatör kararı bekliyor | `geotek/engine/insitu/cpt.py` |
| Malzeme γ katsayısı, kaya eksantrisitesi, okunmayan YAML anahtarları | Katsayı/yöntem değişikliği (S4) | [T12](../tasks/T12-MATERIAL-FACTORS.md) |
| Duvar varsayım/uyarı metinleri yalnız Türkçe; raporda bazı ham kontrol adları | Geniş i18n işi | [T10b](../tasks/T10b-POLISH.md) |
| CSV içe aktarmada eksik u2 = 0 kabul edilir | Davranış değişikliği; CPT içe aktarma sözleşmesi | `geotek/io/tabular.py` |
| Palplanş zemin Y2/Y4 | Mühendislik kararı | [T9b](../tasks/T9b-PILE-SOIL.md) |
| Web: duvar girdilerinde birim etiketi yok; c' eksikken 0 görünüyor; tasarım temeli metni çevrilmemiş | Küçük UI cilası | T10b |
| Motor/yapılandırma serbest metinleri (taşıma gücü, katmanlı duvar TR iletileri, korelasyon kontrolleri) | Geniş i18n işi | T10b |
| `MODE = device` iken oturumlar bulutta; ai-orchestrator MCP bağlanamıyor | Ortam kararı | [CLOUD_MODE](../CLOUD_MODE.md) |
| ruff: 209 stil bulgusu (temel 265); pyflakes sınıfında yalnız pytest fixture yeniden tanımı | Kapı değil, ayrı temizlik | — |

## 4. Temizlik

Silindi: PySide6 `geotek/ui`, yalnız onun kullandığı `geotek/plotting`, `tests/ui`, `test_wall_plots.py`;
`gui` ekstrası; yalnız eski arayüzün kullandığı 238 i18n anahtarı ve `lpi.*`; `design_sheet_pile_advanced`,
`units_for`; ölü web dosyaları `ProjectPage.tsx`, `UtilisationCards.tsx`, `WallSection.tsx` ve anahtarları;
`docs/archive/`, `DEVAM_PROMPT.md`, biten kartlar (F5-LIQ, F5-PILE, Q1, T3a-FIX, T10c).
Güncellendi: CLAUDE.md, AGENTS.md, GEMINI.md, README, ARCHITECTURE, MODULE_GUIDE, CLOUD_MODE,
CLAUDE_PROJECTS, PROJECT_INSTRUCTIONS, WORKFLOW, K1, T10b, T10-kabul; kırık bağlantılar düzeltildi.

**Kullanımı belirsiz olduğu için tutuldu:**
- Tek katmanlı eski servisler `services/walls_basic.py`, `services/walls_advanced.py`,
  `engine/walls/walls.py`: yalnız testler, örnekler ve doğrulama karşılaştırmaları kullanıyor; kaldırmak
  regresyon referansını da kaldırır, ayrı karar.
- `Project.module2_inputs`: eski `.gtk` dosyalarında veri taşıyor; silinirse kayıtta sessizce düşer (göç kararı gerekir).
- `docs/qa/` ekran görüntüsü klasörleri (~20 MB, `t11` 13 MB): kabul kanıtı olarak bağlantılı.
- `docs/audit/` eski inceleme notları; web bağımlılıkları `echarts`, `echarts-for-react`, `@mantine/form` (kodda kullanım yok, kaldırma paket kilidini değiştirir).
- `tests/unit/test_module_boundaries.py` içindeki "modül `geotek.ui` içe aktarmaz" kuralı (geri dönüş koruması).

## 5. Doğrulama (2026-10-20, Linux bulut kapsayıcısı, birleşmiş dal)

| Kontrol | Sonuç |
|---|---|
| `pytest` (tam) | 1868 geçti, 2 atlandı (büyük/küçük harf duyarsız dosya sistemi testleri) |
| `tsc --noEmit` | temiz |
| Vitest | 37 dosya, 337 test geçti |
| `npm run build` | başarılı |
| `gen_code_map.py --check` | 0 |

Windows `tools/project.py check full` bu ortamda **çalıştırılamadı** (PowerShell/.venv yok); eşdeğer komutlar doğrudan çalıştırıldı.
