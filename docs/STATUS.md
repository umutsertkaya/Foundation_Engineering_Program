# GeoTek — güncel durum ve tek iş sırası

Yönetim/harita denetimi: 2026-10-20 (İstanbul). Son ürün commit'i `76d2b4d`; yönerge tabanı `ec89486` (`main`).
Bu sayfa **tek güncel durum kaynağıdır**. Eski faz listeleri tarihsel kayıttır.
Test kanıtları: [denetim raporu](audit/2026-10-19-sadelestirme.md).

## Aktif iş

Compact veya devir öncesi yalnız bu üç satır güncellenir (kural: [WORKFLOW](WORKFLOW.md#bağlam-ve-compact-kuralı)).

- Biten: 2026-10-20 orkestrasyon kurulumu: ai-orchestrator 2.1.0 bağlı, Codex (gpt-6-luna) ve Antigravity (gemini-3.8-flash) bağlantı testi OK, codemap --check temiz (820c084).
- Sıradaki: proje eksiklerinin tespiti ve sıfırdan plan; işler bağımsız kartlara bölünecek.
- Kararlar (2026-10-20, şef): rapor önce docx, PDF sonra; sınıflandırma Robertson SBTn + USCS; geotek/ui paketleme sonrası kaldırılır; eski 11 worktree ve birleşmiş eski dallar silinir. Plan: Projects ortak klasörü plan/2026-10-20-yeni-plan.md. Açık karar: yok.
- T8a biten (2026-10-20, claude/project-thread-da5oef, PR bekliyor): `geotek/services/report.py` + modül `report` (`GET /api/m/report/sections`, `POST /api/m/report/docx`); duvar, palplanş, sıvılaşma, zemin profili, proje bilgisi; eski/sonuçsuz bölüm 409 ile reddedilir. Hesap formülü değişmedi. Testler: `tests/api/test_report_api.py` 10 geçti; tüm paket 1720 geçti (2026-10-20). Grafik/PDF ve web sayfası (T8b) yok; sınıflandırma bölümü (SBTn bölgeleri + USCS) eklendi. Uygulama Claude ile yapıldı (ai-orchestrator bağlanamadı), Antigravity incelemesi yapılmadı.
- T8b biten (2026-10-20, claude/project-thread-dbnnye, PR #4): rapor web sayfası `web/src/modules/report/pages/HomePage.tsx` (bölüm seç, docx oluştur ve indir; 409/422 ret nedeni bölüm adlarıyla gösterilir). `request_blob` (shared/api/http.ts) eklendi; eski `pages/ReportPage.tsx` ve `web.report.*` anahtarları kaldırıldı. Codex gpt-6-luna medium incelemesi: 2 bulgu, 1 gerçek (indirme URL'si hemen iptal ediliyordu, 10 sn gecikmeyle düzeltildi), 1 yanlış (`report.title` anahtarı mevcut). Testler (2026-10-20): pytest tüm paket 1740 geçti, 1 atlandı; web `tsc` temiz, Vitest 272 geçti, `npm run build` yeşil. Uygulama Claude ile yapıldı.
- T3c biten (2026-10-20): Bishop ve palplanş (USS/USACE) literatür/elle doğrulama testleri `tests/verification/test_bishop_*.py`, `test_sheet_pile_*.py` (12 test geçti; motor formülü değişmedi).
- T3c kanıt: Opus bağımsız incelemesi; Michalowski (2002) N=0.181 (β=45°), φ=0 daire ve palplanş sayıları motordan bağımsız yeniden üretildi.
- T3c açık: tutmayan test yok; tolerans gerekçeleri test docstring'lerinde.
- T7a biten (2026-10-20): zemin sinifl. API (SBTn referans/CPT noktalari, USCS) main'e birlesti; tests/api 616 gecti, -k classif/contract/soil 408 gecti, gen_code_map --check temiz.
- T7a kanit: kod + test + inceleme tamam; web sinif. sayfasi hala yer tutucu (sonraki kart).
- T7a acik: web typecheck calistirilmadi (T7b'de kosuldu, temiz).
- T7b biten (2026-10-20): sinif. sayfasi (`web/src/modules/soil/pages/ClassificationPage.tsx`): CPT Robertson SBTn grafigi (log-log SVG, Ic konturlari, bolge 1 siniri), bolge ozeti, USCS tablosu, plastisite grafigi (A/U cizgisi negatif kisimlari kirpilir), tek ornek siniflandirma formu, simge tablosu; TR/EN anahtarlari `soil.cls.*`.
- T7b kanit: typecheck temiz, web Vitest 269/269 (classification.test.tsx 11), `npm run build` basarili, ilgili pytest (i18n, manifest, contract) 141 gecti, gen_code_map --check 0. Gercek API/gorsel kabul Q1'de; Codex gpt-6-luna incelemesi yapilamadi (ai-orchestrator bulutta baglanmadi).
- T7b acik: OL/OH/Pt motorda yok (sayfada belirtildi); mock siniflandirma demo verisidir.

- T9 biten (2026-10-20, dal feat/t9-pile-fix): palplanş web düzeltmeleri B1-B9, B11, Y1, Y3, Y5, Y7; B6 çevrilebilir uyarı/varsayım kodu sözleşmesi (warning_items, assumption code/params, anchor_force_per_anchor); modele depth_increase, anchor_spacing, anchor_inclination, front_water_depth (varsayılanda sonuçlar aynı; formül/katsayı yok). Test: pytest 1775 geçti 1 atlandı; web 289/289, typecheck, build, gen_code_map --check 0. Salt okuma Opus incelemesi: motor değişmedi, varsayılanlar aynı.
- T9 açık: (a) eski palplanş yapılar yeni alanlar parmak izini değiştirdiği için bir kez 'stale' görünür; kabul edildi (2026-10-20); (b) 'Tension zone to X m' uyarısı artık gerçek derinliği yazar (yalnız mesaj değeri, hesap aynı; pytest 1776 geçti, 1 atlandı); (c) Y2/Y4 Dalga 3 sonrası, karar bekliyor: [T9b-PILE-SOIL](tasks/T9b-PILE-SOIL.md); (d) gerçek API ile görsel/uçtan uca kabul Q1'de.

## Koddan doğrulanan durum

| Alan | Şu an |
|---|---|
| Çekirdek | Başlangıç, kütüphane, proje/oturum, modül keşfi, işler, katsayılar ve birleşik i18n API mevcut. |
| Veri | `.gtk` şeması 1.3; eski sürüm göçleri, yapı zemin kopyası ve stale/hash kontrolleri mevcut. |
| Zemin | CPT/SPT işleme, otomatik katmanlama, parametre aday/seçim/onay API'si ve web akışı mevcut. Sınıflandırma web sayfası (SBTn grafiği, USCS tablosu) mevcut; gerçek API/görsel kabul Q1'de. |
| Duvar | Katmanlı motor, yapı API'si, öner/kontrol, iş takibi/iptal, analiz seçenekleri, sonuç kartları ve SVG kesit mevcut. |
| Sıvılaşma | Motor/API ve web job takibi, iptal/hata/erişilemiyor, sonuç özeti mevcut (`fdd80b1`). Grafik/tablo ayrıntısı ve gerçek API/görsel kabul Q1'de. |
| Palplanş | Motor/API ve oluşturma, tasarım job takibi, sonuç paneli ile mock create/job mevcut (`998e937`). Bağımsız inceleme ve gerçek API/görsel kabul bekliyor. |
| Rapor/paket | Web raporu yer tutucu. `geotek.app` başlatıcısı ve doğrulanmış tek exe henüz yok. |

Kanıt: zemin birleşmeleri `d3723db`, `b79add8`; duvar `e78d1e3`, `f136542`.
Eski devam metinlerindeki “A1/E2/E3/F3/F4 başlamadı” ve “i18n API 501” ifadeleri artık geçersiz.

## İş sırası

F5-LIQ ilk iki teslimi `fdd80b1` ile tamam (2026-10-20: job takibi/iptal/hata/erişilemiyor + genel mock job deposu;
typecheck, liquefaction Vitest 24/24, ilgili pytest 71 geçti). Kalan: tablo/grafik ayrıntısı, gerçek API smoke ve görsel QA → Q1.
F5-PILE tamam (2026-10-20: yapı oluşturma/girdi, tasarım job'u, sonuç paneli, mock sheet_pile create/job; typecheck, sheet_pile+boundaries Vitest 21/21, walls+liquefaction Vitest geçti). Salt okuma incelemesi yapılmadı.
Şimdi seçilecek görev: **[Q1](tasks/Q1.md)**.
Kalan paketler küçük teslimlere ayrılır; hepsini aynı oturumda planlama.

| Sıra | Kart | Kapsam / bağımlılık |
|---|---|---|
| Tamamlanan teslim | [F5-LIQ](tasks/F5-LIQ.md) | Job/sonuç ilk teslimleri tamam; yeniden başlatma. Kalan kabul Q1'de. |
| Tamamlanan teslim | [F5-PILE](tasks/F5-PILE.md) | Oluşturma/job/sonuç ilk teslimi tamam; inceleme ve kabul Q1'de. |
| Sıradaki | [Q1](tasks/Q1.md) | Gerçek API ile uçtan uca + görsel kontrol, kalan sınıflandırma/rapor kapsamını kesinleştir. |
| 4 | [K1](tasks/K1.md) | Onaydan sonra yerel başlatıcı, paketleme ve kullanım belgesi. |

Öncelik kullanıcı tarafından değiştirilebilir. Paralel çalışmada en çok iki bağımsız yazıcı;
bu sırada ilk tercih tek aktif görevdir. Ortak dosya ihtiyacı varsa şef önce sözleşmeyi netleştirir.

## Onaylar ve mühendislik sınırları

- Tarihsel kayıtta P1, E4/kapı 2 ve yapı Y1/Y2 onaylı. Bunları yeniden açma.
- F1/zemin ilk görsel kapısı 3 için onay kaydı hâlâ açık; daha yeni F3/F4 ekranları onay kanıtı sayılmaz.
  Uygulama çalışmasına devam edilebilir; kullanıcıya sunulacak Q1 tesliminde bu açık onayı göster.
- F3/F4 ilk çalışan sürüm için eski kapı 4 korunur; açık kullanıcı kabul kaydı bulunmadığından
  onaylandı sayılmaz. Kodun main'e birleşmesi insan kabulünün yerine geçmez.
- Paketleme öncesi kullanıcı onayı korunur. Kart hazırlanması/teknik inceleme için yeni onay gerekmez.
- Su altı deprem, ±kv zarfı, uplift moment ve YASS taşıma gücü kararları için
  [E4 formül kaydı](contracts/E4_FORMULAS.md) ve [araştırma](research/submerged_seismic_thrust.md).
- `delta_base` önerisi gerçek `phi_cv` alanı bulunmadığından `phi_cv_assumed_equal_phi_eff` uyarısı taşır.
- Yönetmelik kaynak doğrulama açıkları: [katsayı doğrulama listesi](katsayi_dogrulama.md).
  Eski notta okunamadığı belirtilen KDYY belgelerinin doğrulandığını varsayma.

## Son doğrulama (2026-10-19)

- Mevcut Python paketi: **1523 geçti, 1 atlandı** (Windows symlink kullanılamıyor).
- Yeni proje komutu testleri: **20/20 geçti** (ayrı hedefli koşu).
- Web: **245/245 geçti**; typecheck ve production build başarılı.
- Yeni `check quick`: başka bir klasörden **4/4 adım geçti**; 93 Python ve 14 web sınır testi dahil.
- İlk sınırsız web koşusunda 1 zaman aşımı vardı; `maxWorkers: 2` ile tam paket geçti.
- React `act` uyarıları, Starlette deprecation ve 822 kB web chunk uyarısı devam ediyor.
  Uyarılar saklanmadı; log/ayrıntı denetim raporunda. Bu uyarılar yeni özellik görevinden ayrı ele alınır.

Görsel QA ve gerçek API uçtan uca kontrolü bu düzenlemenin teslim koşulu değildir; Q1'de yapılacak.

## Çalışma alanları

2026-10-19 denetiminde `git branch --no-merged` boştu; eski görev dalları main'e birleşmiş durumda.
`git worktree list` hâlâ `Documents/geotek-wt/` altında 11 çalışma alanı gösteriyor.
Bu alanların yerel değişiklikleri kontrol edilmedi; silinmedi. Yeni işe eski brief'le devam etme.
Her oturumda `tools/project.py status` ile canlı Git durumunu gör; tarihsel yolu zorunlu kabul etme.

## Sonraki oturuma devir

Claude Code Projects aktarımı: [CLAUDE_PROJECTS.md](CLAUDE_PROJECTS.md).
Koordinatör talimatı: [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md).
Model için kod bulma sırası: `code_map_target` → gerekli simgenin `code_map_read` kesiti;
büyük CODE_MAP belgesi varsayılan bağlam değildir. `geotek-codemap` Codex ve Antigravity MCP ayarlarına
eklendi (2026-10-20). ai-orchestrator ve geotek-codemap depo .mcp.json ve .claude/settings.json ile kayıtlı ve onaylı; Codex ve Antigravity'de geotek-codemap etkin (2026-10-20, 820c084). Projects talimat alanına yükleme henüz yapılmadı.
Kanıt: [2026-10-20 araç denetimi](audit/2026-10-20-projects-codemap.md).
`http://127.0.0.1:8766` görünümü insan incelemesine yardımcıdır; ürün geliştirme
konusu ayrı çalışıyor olabilir. Bu denetim ürünün Q1 işlerini tamamlandı olarak işaretlemez.

Yalnız bu sayfayı güncelle: biten görev + kanıtı, sıradaki tek kart, açık karar ve test sonucu.
Aktif dosya sahipliği/süren MCP çağrısı varsa buraya kısa kayıt ekle; yoksa yeni tablo açma.

## T3a-FIX etki notu (2026-10-20)

`youd2001.py` CPT yolu Youd 2001 metnine hizalandı: Q'da net qc, ara üs 0.7 (eski 0.75), Kc yalnız Ic'ye bağlı (F<0.5 kısayolu kaldırıldı). qc1N brüt qc ile kalır. SPT değişmedi.
Etki (σv=100, σ'v=60 kPa, bağımsız denklem hesabı; FS = CRR·MSF·Kσ/CSR olduğundan FS, CRR7.5 ile aynı oranda değişir):
kum (qc 10000) CRR 0.276→0.276 (0%); siltli kum (4000/60) 0.154→0.157 (+2%); kil (800) değişmez; Ic≈2.56 ara bölge (900/5) 0.084→0.087 (+3%); düşük-F siltli kum (2000/5, F<0.5) 0.071→0.085 (+18%, kısayol kalktığı için Kc 1→1.62). Etki yalnız Ic>1.64 ara/siltli CPT katmanlarında; temiz kum değişmez.
Test 2026-10-20: tam pytest 1688 geçti/1 atlandı; discrepancy 16 geçti; gen_code_map --check 0. Andrus-Stokoe üssü (madde 5) doğrulanmadı, kod değişmedi.
Not (T3a-FIX inceleme): Kc'deki F<0.5 kısayolu R&W 1998'de vardı, Youd 2001 Eq.19'da yok; çevre PDF metni doğrulanmadı, koordinatör kararıyla silinmiş kalır. Ic tanımsız (net qc<=0, fs<=0, σ'v<=0) noktalar NaN -> INVALID + uyarı; fs=0 artık "clay_like" değil INVALID. Ic>2.6 noktalar mevcut sözleşmeyle CLAY_LIKE (FS atanmaz). σ'v>Pa için n=0.7 ara dalı ızgara taramasında ulaşılamadı (yalnız n=0.5/1).
