# GeoTek düzenleme ve doğrulama raporu

Tarih: 2026-10-19 (İstanbul). Başlangıç: `main`, `f136542`; çalışma ağacı temizdi.
Amaç: Sonnet 5.5 / medium şefin tek küçük işi, güncel bilgi ve açık dosya sınırlarıyla yönetmesi.
Mühendislik motoru, formüller, veri şeması ve mevcut kullanıcı projeleri değiştirilmedi.

## Bulunan sorunlar

- ORKESTRA hâlâ “Git yok / 324 test / Opus şef” diyordu; Git ve çok daha ileri bir kod tabanı mevcuttu.
- DEVAM prompt'u birleşmiş A1/E2/E3 dallarını yeniden bitirmeyi istiyordu.
- DEVAM_NOTLARI aynı dosyada “başlamadı” ve “main'e birleşti” bilgilerini birlikte tutuyordu.
- Soil katmanlama/parametre ve i18n API'si, F3 ve F4 güncel kodda uygulanmıştı;
  başlangıç belgeleri hâlâ bunları yapılacak veya 501 gösteriyordu.
- Her parçada tam paket + iki üst model incelemesi, basit işlerle mühendislik değişikliklerini ayırmıyordu.
- Sınırsız Vitest işçileri test başlangıcını ağırlaştırıyordu; ilk tam koşuda bir 5 saniye timeout oluştu.
- React `act` uyarıları yüz binlerce karakterlik çıktılarla ajan bağlamını dolduruyordu.

## Teslim edilen düzen

| Dosya | Görevi |
|---|---|
| `CLAUDE.md` | Kısa otomatik proje talimatı; mühendislik kuralları ve başlangıç sırası. |
| `AGENTS.md` | Diğer kod ajanlarını aynı kurallara yönlendiren kısa giriş. |
| `docs/STATUS.md` | Tek güncel durum, tek iş sırası, açık onay ve test kaydı. |
| `docs/WORKFLOW.md` | Şef/uygulayıcı/inceleyici rolleri, dosya sahipliği, küçük brief ve kontrol düzeyi. |
| `docs/ARCHITECTURE.md` | Göreve göre en küçük dosya/test haritası; modül ve çekirdek sınırları. |
| `docs/tasks/` | F5-LIQ, F5-PILE, Q1, K1 kartları; kapsam, kabul ve gerçek API sınırları. |
| `tools/project.py` | Salt okuma durum/brief; kısa sonuçlu, loglu quick/backend/web/full kontrolleri. |
| `docs/DEVAM_PROMPT.md` | Yeni Claude oturumuna kopyalanacak kısa başlangıç. |

Eski giriş yolları kısa yönlendirmeler olarak korundu. Altı özgün belge
`docs/archive/2026-10-19/` içine baytları korunarak alındı; `manifest.json` SHA-256 kayıtlarını taşır.
Arşiv için `.gitattributes` metin normalizasyonu kapatıldı. Başlangıç Git içeriğiyle de karşılaştırıldı.
Sözleşme P1'in başına tarihsel bağlam notu eklendi; teknik içerik yerinde duruyor.

Eski devam prompt'unun istediği beş belge toplam **51.895 karakterdi**.
Yeni CLAUDE + STATUS + F5-LIQ toplam **10.227 karakter**; delegasyon protokolü dahil **15.088**.
Karşılaştırma karakter sayısıdır, token veya model hız testi değildir. Delegasyon dahil yaklaşık **%71 azalma**.

## Çalıştırılan kontroller

| Kontrol | Sonuç |
|---|---|
| Başlangıç tam pytest | **1523 geçti, 1 atlandı**, 373,18 sn. Atlanan test: Windows symlink kullanılamıyor. |
| Yeni komut aracı testleri | **20 geçti**; hata yayılımı, çalıştırma engeli, log, depo kökü, brief ve UTF-8. |
| İlk tam Vitest (önceki ayar) | 244 geçti, 1 zaman aşımı; 63,87 sn. |
| Eski başarısız web dosyası tek başına | 3/3 geçti; 5,03 sn toplam. |
| İki işçiyle tam Vitest | **245/245 geçti**, 26/26 dosya; 55,57 sn. |
| TypeScript | `npm.cmd --prefix web run typecheck` başarılı. |
| Production build | Başarılı; Vite 6546 modülü işledi, build 12,74 sn. |
| Yeni `status` ve `brief` gerçek CLI | Başarılı; ASCII üst ortamda bile Türkçe UTF-8 çıktısı kaynakla birebir eşleşti. |
| Yeni `check quick`, farklı cwd | **4/4 adım geçti**: indeks, 93 Python testi, typecheck, 14 web sınır testi. |
| Arşiv | 6/6 SHA-256 ve özgün Git içerik karşılaştırması geçti. |
| Aktif belge bağlantıları | 17 Markdown dosyasında 45 yerel bağlantı kontrol edildi; eksik hedef yok. |
| `git diff --check` | Temiz. |

Tam pytest başlangıçta toplandığından yeni aracın testleri ayrıca çalıştırıldı;
bu iki sonucu tek bir tam koşu sayısı gibi birleştirmiyoruz.
Python/esbuild normal sandbox'ta erişim engeline takıldı; izinli yerel tekrarlarla kontroller tamamlandı.
Çalıştırıcı bu durumu artık test hatasından ayrı **BLOCKED / NOT RUN** diye gösterir.

Vitest ayarında yalnız `minWorkers: 1`, `maxWorkers: 2` eklendi.
Test timeout'u yükseltilmedi, test veya ürün davranışı değiştirilmedi, uyarılar bastırılmadı.
İki koşu bu ortamda iyileşme gösterir; her makinede aynı süreyi garanti etmez.

## Bilinen açık noktalar

- React `act` uyarıları devam ediyor (sınırlı tam koşuda 574); `.project/logs/vitest-bounded.log` ~2,1 MB.
  Test temizliğinde bağlı bileşenler varken dil değiştirilmesi olası neden; bu düzenlemede test mantığı değiştirilmedi.
- Starlette/httpx deprecation uyarısı ve web ana paketinde 822 kB chunk uyarısı devam ediyor.
- 11 eski worktree listelendi; içlerindeki yerel değişiklikler denetlenmedi, alanlar silinmedi.
- F5, sınıflandırma/rapor kapsamı, açık görsel kabuller ve paketleme kalan iş olarak yazıldı.
- Sonnet ile gerçek bir yönetim oturumu veya canlı MCP model çağrısı başlatılmadı;
  Sonnet'in görev performansı ölçülmedi. Model seçimi ve global hesap/MCP ayarları değiştirilmedi.
- Görsel QA ve gerçek API uçtan uca ürün kabulü bu düzenlemede yeniden yapılmadı; Q1 kartı bunları açıkça ister.

Git commit/push yapılmadı; değişiklikler incelemeye açık çalışma ağacında.
