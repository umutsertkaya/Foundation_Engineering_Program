# GeoTek modül geliştirme rehberi

## Modül nedir?

Modül, belirli bir mühendislik aracının backend ve web giriş noktalarını,
menüsünü, çevirilerini ve özel durumunu bir arada tutan kaynak paketidir.
`soil`, `liquefaction`, `walls` ve `sheet_pile` mevcut örneklerdir.
Hesap motoru ve ortak servisler `geotek/engine` ve `geotek/services` içinde kalır;
modül bunları ince bir API ve ekran katmanıyla kullanır.
Yeni modül eklemek için merkezi bir import listesine satır eklenmez.

## Dizin yapısı

```text
geotek/modules/<id>/
  __init__.py                 # MANIFEST
  api.py                      # router factory
  i18n/
    tr.json
    en.json
web/src/modules/<id>/
  manifest.ts                 # manifest
  Root.tsx                    # relative routes
  pages/
    HomePage.tsx
  api.ts                      # HTTP client wrappers
  mock.ts                     # mock handler export
  __tests__/
    <id>.test.tsx
```

Gerektiğinde modül içine `schemas.py`, `types.ts`, bileşenler ve durum
modelleri eklenebilir. Başka modülün iç dosyalarına bağımlılık kurulmaz.
Kimlik, iki tarafta da klasör adıyla aynı ve `^[a-z][a-z0-9_]*$` biçimindedir.
Çekirdek, uygulama ve ortak altyapı adları modül kimliği olarak kullanılmaz.

## Backend sözleşmesi

`geotek/core/modules.py` içindeki `ModuleManifest`, değiştirilemez bir dataclass'tır.
Modülün `__init__.py` dosyası `MANIFEST` adında bu türden bir nesne sunar.

| Alan | Anlamı |
|---|---|
| `id` | Klasörle aynı modül kimliği. |
| `version` | Boş olmayan modül sürümü. |
| `title_key`, `description_key` | `<id>.` ile başlayan çeviri anahtarları. |
| `icon` | Simgenin metin adı. |
| `order` | Tamsayı menü sırası; eşitlikte `id` sıralanır. |
| `router` | Yeni bir `APIRouter` üreten fonksiyon veya `None`. |
| `state_model` | Modüle özel Pydantic durum modeli veya `None`. |
| `state_version` | Durum şema sürümü; en az 1. |
| `state_migrations` | Kaynak sürümü `n` için `n → n+1` dönüşümleri. |
| `consumes` | Okunan çekirdek kaynaklarının bildirimleri. |
| `structure_kinds` | Modülün kullandığı yapı türleri. |
| `design_code_dirs` | Modüle ait ek yönetmelik dizinleri. |

`consumes`, örneğin `core.soil_profiles` veya `core.structures:sheet_pile`
değerlerini içerir; erişim izni veren bir mekanizma değildir.
`state_version`, modülün `version` alanından bağımsızdır.

`geotek/api/registry.py` paketleri keşfeder, manifest türünü ve kimliğini doğrular.
Sonuçları önbelleğe alır; testlerde gerektiğinde `clear_cache()` kullanılır.
Donmuş uygulamada paket taraması boşsa `geotek/modules/_index.py` kullanılır.
Bu dosya `tools/gen_module_index.py` tarafından üretilir; elle düzenlenmez.

## Web sözleşmesi

`web/src/shared/moduleTypes.ts`, gerçek `WebModuleManifest` sözleşmesidir.
`manifest.ts`, `manifest` adında bu türden bir nesne dışa aktarır.

| Alan | Anlamı |
|---|---|
| `id`, `version` | Backend kimliği ve modül sürümüyle uyumlu değerler. |
| `titleKey`, `descriptionKey` | Modülün çeviri anahtarları. |
| `icon` | `size` alabilen React simge bileşeni. |
| `order` | Backend ile aynı menü sırası. |
| `Root` | Modülün göreli rotalarını içeren React bileşeni. |
| `nav` | `NavItem[]` yan menü tanımları. |

`NavItem.path`, `/m/<id>` altındaki göreli yoldur; `""` ana sayfayı belirtir.
`labelKey` çeviri anahtarıdır. `icon` ve tam eşleşme için `end` isteğe bağlıdır.
`matchPrefixes`, alt sayfalarda da ilgili menü öğesinin etkin kalmasını sağlar.
`Root`, `Routes` ve göreli `Route` tanımlarını barındırır.
Genel kabuk, proje gereksinimi ve ana menüye dönüş uygulama katmanındadır.

`web/src/app/moduleRegistry.ts`, `../modules/*/manifest.ts` glob'u ile keşfeder.
Klasör ve `manifest.id` uyuşmazsa modül atlanır.
Mevcut sözleşmede mock tanımı web manifest'inin alanı değildir.

## Bağımlılık sınırları

- Modüller birbirini import etmez; backend ve web için aynı kural geçerlidir.
- Backend modülleri `geotek.ui` paketini import edemez (kaldırıldı; sınır testi geri dönüşü engeller).
- Backend keşfi `geotek/api/registry.py` üzerinden yapılır; araçlar keşif yapabilir.
- Web `shared/` ve `app/` kodu modül iç dosyalarını doğrudan import etmez.
- Uygulamanın manifest keşfi ve i18n glob'ları belirlenmiş entegrasyon noktalarıdır.
- Mock altyapısındaki modül mock glob'u da belirlenmiş bir istisnadır.
- Üretim modül kodu mock import etmez; modülün `mock.ts` dosyası istisnadır.
- Testler mock altyapısını kullanabilir; sayfalar ve API istemcileri kullanamaz.

Ortak davranış gerekiyorsa bunu uygun çekirdek veya `shared/` sözleşmesine taşıyın.
Bir modülün özel yardımcı fonksiyonunu başka modüle bağlamayın.
Sınırlar `test_module_boundaries.py` ve `boundaries.test.ts` ile denetlenir.

## Proje verisi

Ortak proje verisi çekirdek şemasında kalır; bu verinin sahibi `soil` modülüdür.
Planın ortak alanları `meta`, `site`, `investigations`, `soil_profiles`,
`active_profile_id`, `structures` ve `design_overrides` alanlarıdır.
Diğer modüller ortak veriyi tanımlı çekirdek okuma API'lerinden tüketir;
yazma ihtiyaçlarını sahiplik ve servis sözleşmesini koruyarak çözün.
Çekirdek proje ve oturum işlemlerini modülün özel durumuna kopyalamayın.

Modüle özel ayarlar `Project.modules[<id>]` altında tutulur:

```json
{"modules": {"example": {"v": 1, "data": {}}}}
```

`geotek/core/module_state.py` içindeki `get_state` ve `set_state` kullanılır.
`get_state`, kopya üzerinde göç uygular ve modeli doğrular; projeyi değiştirmez.
Bölüm yoksa modelin varsayılanlarını üretir; model buna uygun tasarlanmalıdır.
Daha yeni durum sürümü veya eksik bir göç adımı hata verir.
`set_state`, doğrulanmış modeli JSON biçiminde ilgili modül bölümüne yazar.
Bilinmeyen modül bölümleri korunur; topluca `modules` alanını sıfırlamayın.
Profil kopyasıyla çalışan yapılarda kaynak kimliği ve güncellik ilişkisini koruyun.
Elle zemin girişi destekleniyorsa kaynak profil zorunluluğu getirmeyin.

## API ve mock

Registry, router'ı `/api/m/<id>` altında bağlar; `api.py` bu ön eki tekrarlamaz.
Yeni `operation_id` değerleri `<id>_` ile başlar ve benzersiz olmalıdır.
Ortak hata sözleşmesi için `ERROR_RESPONSES` kullanılır.
Hazır olmayan hesaplama `not_implemented()` ile açıkça 501 döndürür.
İskelette `POST /run`, `JobRef` yanıt sözleşmesini ayırır; henüz iş başlatmaz.
Web `api.ts`, ortak `request` ile `/m/<id>/run` çağırır;
HTTP katmanı `/api` ön ekini ekler.

`mock.ts`, `export const mock = { prefix, handle }` sunar.
`prefix` değeri `/m/<id>` olur. Handler `{ status, data }` zarfı döndürür.
Desteklenmeyen yöntem veya yolda `NOT_HANDLED` döndürülür.
Tam yol eşleştirin; benzer ön ekli başka bir modülün isteğini sahiplenmeyin.
`shared/api/mock/index.ts`, `../../../modules/*/mock.ts` glob'u üzerinden
handler'ları `registerMockHandlers` ile otomatik kaydeder.
Dispatcher uzun ön ekleri önce dener; işlenmeyen istekler mevcut fallback'e geçer.
Sayfada mock verisi import etmek yerine HTTP istemcisini kullanın.

## Çeviri ve görünür metinler

Modül katalogları `geotek/modules/<id>/i18n/{tr,en}.json` içinde tutulur.
İki dosyanın anahtar kümeleri birebir aynı olmalıdır.
Her anahtar `<id>.` ile başlar; çekirdek katalog anahtarlarını yeniden tanımlamayın.
Başlık, açıklama, menü, yer tutucu ve kullanıcıya gösterilen tüm metinler i18n'den gelir.
React içinde örneğin `t("example.home.heading")` kullanın.
Değişkenler tek süslü parantezle yazılır: `{field}`; çift parantez kullanılmaz.
`web/src/app/i18n.ts`, backend modül kataloglarını glob ile birleştirir;
web altında ikinci bir katalog oluşturmayın.
JSON dosyalarını UTF-8 ve LF ile kaydedin.

## İskelet aracını kullanma

Repo kökünde, kurulu sanal ortamla çalıştırın:

```powershell
.venv\Scripts\python.exe tools/new_module.py example --title-tr "Örnek" --title-en "Example"
.venv\Scripts\python.exe tools/new_module.py example --order 50 --icon chart-bar
.venv\Scripts\python.exe tools/new_module.py example --root C:\Temp\module-preview
```

Örnekler alternatif çağrılardır; aynı kimliği ikinci kez üretmek reddedilir.
`--root` verilmezse araç dosyasının bulunduğu repo kökü kullanılır.
İki modül klasöründen biri bile varsa hiçbir dosya üzerine yazılmaz.
Geçersiz, ayrılmış ve çekirdek dosyalarıyla çakışan kimlikler reddedilir.
Varsayılan başlık kimliğin sözcüklere ayrılmış biçimidir; çeviriyi gözden geçirin.
Varsayılan sıra mevcut literal manifest sıralarının en büyüğü + 10, hiç yoksa 10'dur.
Hesaplanmış sıra ifadeleri çalıştırılmaz; açık `--order` verin veya literal kullanın.
`--icon`, kurulu Tabler paketindeki kebab-case addır; varsayılan `tool` kullanılır.
Örneğin `chart-bar`, `IconChartBar` bileşenine dönüşür; simgenin varlığını doğrulayın.
Gerçek repo köküne üretimde index aracı otomatik çalışır.
Özel kökte yalnız takip komutu yazdırılır; o kökte ayrıca çalıştırın.
Testler `scaffold(module_id, root, ...)` fonksiyonunu geçici dizinle çağırabilir.

## Rapor bölümü ekleme

Rapor servisini (`geotek/services/report.py`) düzenlemeden bölüm eklemek için manifest'e
`report_entries(project) -> [ReportEntry]` ve `report_writer(writer, project, entry_id)`
verilir; ikisi birlikte ya da hiç verilmez. `ReportEntry.id` `"<modül id>:"` ile başlar,
`status` `ready`, `stale` veya `no_result` olur. Bu bölümler raporda `kind="module"` görünür;
`name` boş bırakılmaz. Yerleşik bölümler (proje, zemin, yapılar, sınıflama, sıvılaşma) eskisi gibi kalır.

## Exe (PyInstaller) ve yeni modül

Donmuş uygulama paket dizinini tarayamaz; kayıt defteri `geotek/modules/_index.py` dosyasına döner.
`python tools/pyinstaller_modules.py` her modül paketi için `--hidden-import` ve i18n klasörleri için
`--add-data` satırlarını yazar; derleme adımı bu çıktıyı kullanırsa yeni modül için spec düzenlemek
gerekmez. `python tools/pyinstaller_modules.py --check` dizin eskiyse hata verir. Web tarafı Vite
glob'larıyla derlendiği için `web/dist` içinde yeni modül kendiliğinden bulunur.

## Bilinen sınırlar

- `JobKind` ve `StructureKind` (`geotek/api/schemas.py`, `web/src/shared/api/types.ts`) kapalı listelerdir:
  yeni bir arka plan iş türü ya da yapı türü için bu iki yer ve sözleşme yeniden üretilir.
- `web/src/test/module_paths.test.ts` içindeki sabit modül listesi elle güncellenir.

## Modül ekleme kontrol listesi

1. Kimlik, başlıklar, simge ve sıralamanın backend/web uyumunu inceleyin.
2. `python tools/gen_module_index.py` çalıştırın; `--check` ile güncelliği doğrulayın.
3. Rota eklendiyse `python tools/export_openapi.py` çalıştırın.
4. Ardından `npm --prefix web run gen:api` ile istemci tiplerini yenileyin.
5. `web/src/test/module_paths.test.ts` içindeki sabit modül ve sıra listesini güncelleyin.
6. TR/EN anahtar eşliğini, ön ekleri ve tek parantezli değişkenleri doğrulayın.
7. Yeni modülün sayfa, API ve mock davranış testlerini genişletin.
8. Manifest, sınır ve registry testleriyle birlikte Python testlerini çalıştırın.
9. `npm --prefix web run test`, `typecheck` ve `build` betiklerini çalıştırın.
10. Açık bir projede menü, modül ana sayfası ve dil değişimini gözle kontrol edin.

## Mühendislik doğruluğu

Katsayı veya zemin parametresi uydurulmaz; eksik veri açıkça bildirilir.
Kaynak, birim, yönetmelik sürümü ve geçerlilik koşulları izlenebilir olmalıdır.
Her formül değişikliği, bağımsız el hesabına dayanan bir regresyon testi gerektirir.
Formül değişiklikleri iki ayrı incelemeden geçmeden tamamlanmış sayılmaz.
Yer tutucunun 501 yanıtını sayısal mühendislik sonucu gibi göstermeyin.
