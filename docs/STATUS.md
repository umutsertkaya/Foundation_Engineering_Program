# GeoTek — güncel durum ve tek iş sırası

Son denetim: 2026-10-19 (İstanbul). Kod tabanı: `main`, `f136542`.
Bu sayfa **tek güncel durum kaynağıdır**. Eski faz listeleri tarihsel kayıttır.
Test kanıtları: [denetim raporu](audit/2026-10-19-sadelestirme.md).

## Koddan doğrulanan durum

| Alan | Şu an |
|---|---|
| Çekirdek | Başlangıç, kütüphane, proje/oturum, modül keşfi, işler, katsayılar ve birleşik i18n API mevcut. |
| Veri | `.gtk` şeması 1.3; eski sürüm göçleri, yapı zemin kopyası ve stale/hash kontrolleri mevcut. |
| Zemin | CPT/SPT işleme, otomatik katmanlama, parametre aday/seçim/onay API'si ve web akışı mevcut. Sınıflandırma web sayfası yer tutucu. |
| Duvar | Katmanlı motor, yapı API'si, öner/kontrol, iş takibi/iptal, analiz seçenekleri, sonuç kartları ve SVG kesit mevcut. |
| Sıvılaşma | Motor + gerçek job API mevcut. Web formu var; `job_id` izlenmeden yer tutucu sonuca gidiliyor. |
| Palplanş | Motor + gerçek tasarım job API mevcut. Web yalnız liste/yer tutucu ayrıntı; mock design 501. |
| Rapor/paket | Web raporu yer tutucu. `geotek.app` başlatıcısı ve doğrulanmış tek exe henüz yok. |

Kanıt: zemin birleşmeleri `d3723db`, `b79add8`; duvar `e78d1e3`, `f136542`.
Eski devam metinlerindeki “A1/E2/E3/F3/F4 başlamadı” ve “i18n API 501” ifadeleri artık geçersiz.

## İş sırası

F5-LIQ ilk iki teslimi `fdd80b1` ile tamam (2026-10-20: job takibi/iptal/hata/erişilemiyor + genel mock job deposu;
typecheck, liquefaction Vitest 24/24, ilgili pytest 71 geçti). Kalan: tablo/grafik ayrıntısı, gerçek API smoke ve görsel QA → Q1.
Şimdi seçilecek görev: **[F5-PILE](tasks/F5-PILE.md)**.
Kalan paketler küçük teslimlere ayrılır; hepsini aynı oturumda planlama.

| Sıra | Kart | Kapsam / bağımlılık |
|---|---|---|
| 1 | [F5-LIQ](tasks/F5-LIQ.md) | Sıvılaşmada job takibi, iptal, sonuç. Mevcut API'yi kullan. |
| 2 | [F5-PILE](tasks/F5-PILE.md) | Palplanş oluşturma, tasarım job'u, sonuç; gerekirse iki ayrı teslim. |
| 3 | [Q1](tasks/Q1.md) | Gerçek API ile uçtan uca + görsel kontrol, kalan sınıflandırma/rapor kapsamını kesinleştir. |
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

Yalnız bu sayfayı güncelle: biten görev + kanıtı, sıradaki tek kart, açık karar ve test sonucu.
Aktif dosya sahipliği/süren MCP çağrısı varsa buraya kısa kayıt ekle; yoksa yeni tablo açma.
