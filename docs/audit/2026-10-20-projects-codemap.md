# Projects ve düşük bağlamlı kod bulma

Tarih: 2026-10-20. Bu teslim mühendislik hesaplarını değiştirmez; modellerin hedef kodu
bulması, seçili parçayı okuması ve Projects'in yerel çalışanı doğru yönlendirmesi içindir.

## Ana kullanım

1. Model `code_map_target` ile Türkçe/İngilizce somut hedefi sorar.
2. Kısa yanıtta dosya, gerçek simge/satır, ilgili rota ve statik test bağlantısını görür.
3. Yalnız gerekli simgeyi/aralığı `code_map_read` ile okur; gerekiyorsa etki sorgusunu daraltır.

İndeksleyici yerel kaynak dosyalarını işler. Bu iç tarama modelin bağlamına bütün kodun
gönderilmesi değildir. Büyük Markdown haritası ve tarayıcı grafiği varsayılan ajan girdisi değildir.
Yöntem isim/konum/simge/rota eşleştirmesidir; kodun anlamını eksiksiz çözen veya davranışı
çalıştırarak kanıtlayan bir sistem olarak sunulmaz. Token sayısı için model çağrısı yapılmaz;
yanıtın karakteri ve alınan kaynak satırı doğrudan sınırlandırılır.

`code_map_target`: varsayılan 1800, üst sınır 3500 karakter; en fazla üç hedef.
`code_map_read`: varsayılan 40 satır / 3000 karakter, üst sınır 80 satır / 5000 karakter.
Eksik kalan aralık açıkça belirtilir. Bilinmeyen simgede tüm dosyaya geri dönülmez.
Diğer harita araçları da kısa yanıt sınırı kullanır.

## Gerçek protokol sorgu denemesi

MCP süreci Node başlatıcısından JSON-RPC ile açıldı; alt model çağrısı yapılmadı.

| Türkçe hedef | Bulunan gerçek giriş | Yanıt karakteri |
|---|---|---:|
| Palplanş oluşturma ekranını değiştir | `SheetPileCreatePage.tsx:13-66` | 862 |
| Zemin parametrelerini onaylama servisi | `services/parameters.py:333-363`, `approve` | 937 |
| Duvar boyut önerisi hesap akışı | `services/structures.py:434-471`, `size_structure` | 784 |
| Sıvılaşma sonucu ve iş iptali | `calculation_results.py:92-100`; ilk üçte `ResultsPage.tsx` | 820 |

Dört sorgu da beklenen hedef dosyasını içerdi. Yanıtta kaynak gövdesi yoktur.
İlk bileşenin 13–36 satırlarını ayrıca istemek **1108 karakter** üretti; 37–66 aralığı
kalan olarak açıkça işaretlendi. Ham ölçüm `.project/logs/codemap-query-benchmark.json` içinde.
Bu dört örnek genel anlam eşleştirme kalitesinin veya belirli bir modelin token tasarrufunun ölçümü değildir.

## Düzeltilen temel sorunlar

- Eski rota tarayıcısı çok satırlı dekoratörleri kaçırıyordu: 65 işlemin yalnız 36'sı görünüyordu.
  AST taraması güncel OpenAPI'deki 65 işlemi doğru handler konumuyla bulur.
- Frontend HTTP istemcisi ile backend handler dosyası ayrı adalar halinde kalıyordu;
  bilinen yöntem/yol eşleşmesiyle API kenarları eklendi.
- Modül manifestleri ve bilinen Vite glob keşfi ayrı ilişki türüyle gösterilir.
- Dosya ekleme/silme ve aynı zaman/boyutla değişen içerik artık önbelleği geçersiz kılar.
- Etki analizinde ulaşılan üretim dosyalarının test bağları da toplanır.
- STATUS'ta tamamlanmış F5 teslimlerinin hâlâ yer tutucu görünmesi düzeltildi.
- `check quick/full`, üretilmiş Markdown haritasının eski kaldığını denetler.
- Canlı ekleme/silme denemesinde düğüm sayısı 310 → 311 → 310 oldu; tarayıcı elle
  yenilenmeden eklemeyi gördü ve silinince önceki parmak izi geri geldi. Geçici test işareti kaldırıldı.

## Projects bağlantısı

Görülen proje `Foundation Engineering Program`; mevcut yerel konu çalışıyordu.
Kaynak kod, bağlı yerel konu ve depodaki CLAUDE/STATUS üzerinden yürütülür.
Koordinatör kısa görev ve kanıtla çalışır; yerel MCP sorgusunu yerel konu yapar.
[Resmî Projects işleyişi](https://code.claude.com/docs/en/claude-projects)

Yerel `claude mcp list` denetiminde `ai-orchestrator` bağlı, `geotek-codemap`
**Pending approval** çıktı. Yeni başlatıcıyla stdio JSON-RPC araç keşfi/rota/etki sorgusu
doğrudan başarılı oldu; bu sonuç, aktif Claude konusunun güven onayı verdiğini göstermez.
Bir kez yerel Claude oturumunda proje MCP onayı gerekir. Güven/hesap/izin ayarı değiştirilmedi.

Projects alanına aktarılacak kısa talimat `docs/PROJECT_INSTRUCTIONS.md` içindedir;
henüz uygulamanın Instructions alanına yüklenmedi. Adımlar `docs/CLAUDE_PROJECTS.md` içinde.
Library dosya yüklemesi canlı klasör senkronizasyonu değildir.
[Resmî yükleme davranışı](https://code.claude.com/docs/en/claude-projects#add-files-and-folders)

## Yardımcı görünüm

`node tools/run_python.cjs tools/code_map_view.py` → `http://127.0.0.1:8766/`.
Çevrimdışı HTML, dosya odağı ve import/API/keşif/test ayrımı; yaklaşık üç saniyede yenileme.
Bu görünüm insan içindir; modelin tüm görseli veya tüm JSON grafiğini okuması gerekmez.
Palplanş API'sinden web istemcisine bağlantı gerçek tarayıcıda görüldü;
ekran kanıtı `docs/qa/code_map/sheet-pile-api.jpg`.

## Doğrulama sınırı

| Kontrol | Sonuç |
|---|---|
| Hedef bulma, simge/aralık, önbellek, API bağları ve çıktı sınırları | 24/24 hedefli test geçti. |
| Proje komutu ve yerel harita HTTP sunucusu | 38/38 hedefli test geçti (20 komut + 18 HTTP). |
| Gerçek stdio MCP | 8 araç keşfedildi; dört Türkçe hedef + sınırlı kod okuma başarılı. |
| `gen_code_map.py --check` | Başarılı; üretilmiş belge güncel. |
| Canlı yenileme | Ekleme/silme ve tarayıcı otomatik güncellemesi doğrulandı; geçici işaret kaldırıldı. |
| Salt okuma kod incelemesi | Yanlış “indirect import” etiketi ve TS tipli imza aralığı bulundu/düzeltildi; yeniden incelemede engel kalmadı. |

Bu teslimde tam ürün kabulü veya canlı Sonnet/Projects iş performansı ölçülmez.
Mevcut Claude konusu ürün testlerine devam edebilir; o konuya ait ürün commit/testleri
bu araç değişikliklerinin başarısı olarak sayılmaz. Kod haritasındaki test ilişkisi
gerçek test kapsamı veya testin geçtiği anlamına gelmez.
