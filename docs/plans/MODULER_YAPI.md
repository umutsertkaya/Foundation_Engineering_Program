# GeoTek: Başlangıç ekranı → Ana menü → Takılabilir modüller

## Bağlam

Kapı 2 onaylandı. E4 chunk C, `5dee487` commit'iyle tamamlandı.

Kullanıcı programın yapısını değiştirmek istiyor:

- Açılışta proje açma/oluşturma ekranı gelecek.
- Proje açılınca araç modüllerini gösteren bir ana menü gelecek.
- Her modül aynı pencerede "ayrı bir program gibi" çalışacak.
- Modüller kaynakta paketçikler halinde duracak. Yeni modül eklemek için çekirdeğe dokunmak gerekmeyecek.

Zamanlama uygun. FastAPI katmanında `/health` dışındaki tüm uç noktalar hâlâ 501 taslağı. Web arayüzü yalnız mock ile çalışıyor. A1 ve F2–F5 henüz yazılmadı, bu yüzden doğrudan modüllerin içinde yazılacaklar.

### Kullanıcı kararları

| Konu | Karar |
|---|---|
| Proje saklama | Proje kütüphanesi `Belgeler\GeoTek Projeleri`. Ayarlardan değiştirilebilir. Her proje bir `.gtk` dosyası. İçe ve dışa aktarma var. |
| Modüller | 4 ayrı modül: **Zemin etüdü ve parametreler**, **Sıvılaşma**, **İstinat duvarı**, **Palplanş/iksa** |
| Menü | Yalnız hazır, kayıtlı modüller görünür. "Yakında" kutusu olmaz. |
| Modül açılışı | Aynı pencerede tam ekran. Kendi yan menüsü, başlığı ve "Ana menüye dön" düğmesi var. |
| Zemin → duvar verisi | Kopya + "güncel değil" uyarısı (mevcut `StructureSoilModel`, `is_stale`, resync) |
| Bağımsızlık | Duvar ve palplanş modülleri profil olmadan da çalışır; elle zemin girişi yapılabilir (`source_profile_id=None`). |
| Paketleme | Kaynak içi paketler ve otomatik keşif. PyInstaller tek exe ile uyumlu. |

## Mimari

### 1. Proje verisi: şema 1.2 → 1.3, düşük riskli yol

- Şu alanlar ortak çekirdekte kalır: `meta`, `site`, `investigations`, `soil_profiles`, `active_profile_id`, `structures`, `design_overrides`.
  - Bu verileri zemin modülü yazar, diğer modüller yalnız okur.
- Yeni alan `modules: dict[str, {"v": int, "data": {...}}]` modüle özel durumu tutar. Örnek: sihirbaz durumu, sıvılaşma ayarları.
  - Bilinmeyen modül bölümleri değişmeden geri yazılır. Bir modülü içermeyen bir exe, o modülün verisini silmez.
- `io/project_io.py` içine `_from_1_2` eklenir. 1.0, 1.1 ve 1.2 dosyaları zincirleme yüklenmeye devam eder.
- Yeni `core/module_state.py` dosyası `get_state` ve `set_state` fonksiyonlarını içerir. Modül durumunun kendi sürüm göçleri bu fonksiyonlarda çalışır.
- `module2_inputs` (eski) ve `geotek/ui` (PySide6) dokunulmadan kalır.

### 2. Python modül sözleşmesi: `geotek/core/modules.py`

```python
@dataclass(frozen=True)
class ModuleManifest:
    id: str; version: str; title_key: str; description_key: str; icon: str; order: int
    router: Callable[[], APIRouter] | None = None        # /api/m/<id>
    state_model: type[BaseModel] | None = None; state_version: int = 1
    state_migrations: Mapping[int, Callable[[dict], dict]] = {}
    consumes: tuple[str, ...] = ()        # "core.soil_profiles", "core.structures:retaining_wall"
    structure_kinds: tuple[str, ...] = ()
    design_code_dirs: tuple[Path, ...] = ()   # list_design_codes(extra_dirs)
# geotek/modules/<id>/__init__.py → MANIFEST = ModuleManifest(...)
```

- Keşif `geotek/api/registry.py` içinde yapılır.
  - Önce `pkgutil.iter_modules(geotek.modules.__path__)` denenir.
  - Donmuş exe'de bu boş dönerse `tools/gen_module_index.py` ile üretilen `geotek/modules/_index.py` kullanılır. Bu dosya eskiyse test hata verir.
  - Desen olarak `engine/correlations/registry.py` (dekoratör kaydı) referans alınır.
- i18n: `geotek/i18n._catalog` çekirdek kataloğu ve `geotek/modules/*/i18n/{tr,en}.json` parçalarını birleştirir.
  - Parça anahtarları `<id>.` ön ekiyle başlar.
  - Mevcut 599 anahtar yerinde kalır.
- Motor ve servis kodu (`engine/*`, `services/*`) **taşınmaz**. Modül paketleri bunları ince bir katmanla sarar.
  - Bu sayede 620 test ve B = 4.60 regresyonu güvende kalır.

### 3. Dizin yapısı

```
geotek/core/{modules.py, module_state.py}
geotek/library/{settings.py, service.py}          # %APPDATA%\GeoTek\settings.json; library_dir, language, recent[≤10]
geotek/api/{app.py, common.py, registry.py, session.py, library_routes.py, schemas.py(çekirdek DTO)}
geotek/modules/{soil, liquefaction, walls, sheet_pile}/{__init__.py, api.py, schemas.py, i18n/{tr,en}.json}
web/src/app/{App.tsx, main.tsx, i18n.ts, moduleRegistry.ts, ProjectProvider.tsx, RequireProject.tsx, ModuleShell.tsx,
             pages/{StartPage, LauncherPage, SettingsPage}.tsx}
web/src/shared/api/{http.ts, core.ts, types.ts, mock/{dispatcher.ts, core.ts, legacy.ts}}
web/src/shared/{soil/* (src/soil'den), structureSoil/*, components/*}
web/src/modules/<id>/{manifest.ts, Root.tsx, pages/, api.ts, types.ts, mock.ts, __tests__/}
```

Web manifest'i `import.meta.glob('../modules/*/manifest.ts', {eager:true})` ile keşfedilir.

```ts
interface WebModuleManifest { id; version; titleKey; descriptionKey; icon; order;
  Root: LazyExoticComponent<ComponentType>; nav: NavItem[] | ((p) => NavItem[]);
  mock?: { prefix: string; handle: MockHandler } }
```

### 4. API yönlendirme

**Çekirdek (`/api`):**
- `health`, `i18n/{lang}`
- `project/{new, open, save, close, meta, site, active-profile, design-overrides/{code_id}}`
- `codes*`, `jobs*`
- `structures?kind=` ile soil/resync
- `modules`, `settings`
- `library` uç noktaları: listeleme, oluşturma, open, duplicate, rename, export, import, recent.
  - Silme `.trash` klasörüne taşır, kalıcı silme yoktur.
  - Yalnız kütüphane içindeki `.gtk` dosya adları kabul edilir. Yol geçişi (path traversal) engellenir.
- Salt okunur `data/profiles`, `data/investigations`

**Modüller (`/api/m/<id>`):**

| Modül | Uç noktalar |
|---|---|
| soil | import, boreholes, cpts, processed, layering, profiles, parameters |
| liquefaction | `run` |
| walls | `wall-types`, `structures/{id}/required-factors\|size\|check` |
| sheet_pile | `structures/{id}/design` |

Mevcut operationId'ler korunur. Yeni operationId'ler `<id>_` ön ekiyle başlar.

### 5. Ekran akışı

- **`/start`:**
  - "Yeni proje" bir modal açar: ad, numara, mühendis, dil, yönetmelik.
  - Kütüphane tablosu: aç, yeniden adlandır, çoğalt, dışa aktar, sil (onaylı).
  - İçe aktar, son projeler ve ayarlar (dişli simgesi).
- **`/launcher`:**
  - Proje başlığında meta ve saha deprem bilgileri (`site` çekirdekte, sıvılaşma ve duvar ortak kullanır).
  - Modül kutuları `order` sırasıyla gösterilir.
- **`/m/:id/*` → ModuleShell:**
  - Başlıkta modül adı, proje adı, Kaydet, TR/EN ve "Ana menüye dön" düğmesi.
  - Yan menü `nav`'dan gelir, içerik modülün `Root` bileşenidir.
- `RequireProject`: proje açık değilse `/start`'a yönlendirir.
- **İstinat modülü:**
  - `/m/walls` açılınca **WallTypePicker** (konsol, ağırlık, …) ve duvar listesi gösterilir.
  - Tip seçilince yapı oluşturulur ve `/m/walls/s/:sid/<adım>` sihirbazına gidilir.
- Mevcut WorkflowBar kaldırılır. ORKESTRA_PROMPT karar 7'deki iş akışı çubuğunun yerini bu yapı alır.

### 6. Sınır kuralları

- `tests/unit/test_module_boundaries.py` (AST): `modules/X`, `modules/Y`'yi ya da `geotek.ui`'yi içe aktaramaz. `geotek.modules`'u yalnız `api/registry.py` ve `tools/` içe aktarabilir.
- `web/src/test/boundaries.test.ts`:
  - Modüller birbirini içe aktaramaz.
  - `shared/` ve `app/`, `modules/`'u içe aktaramaz.
  - Üretim kodu mock'u içe aktaramaz (`StructureWizardPage` → `MOCK_CANTILEVER_5M` bağımlılığı kaldırılır).
- `tests/unit/test_module_manifests.py`:
  - Her manifest'te id, klasör adıyla aynıdır.
  - i18n'de tr/en eşliği, ön ek kuralı ve çekirdek katalogla çakışmama.
  - Backend modül kümesi web modül kümesiyle aynıdır.
  - `_index.py` güncel.
- `docs/MODULE_GUIDE.md` ve `tools/new_module.py <id>`: Python ve web modül iskeletini üretir.

## İş parçaları

Delegasyon kısaltmaları:
- **G** = gpt-6.1-sol high: sözleşme ve mantık ağırlıklı kod.
- **A** = gemini-4-argon high: yeni arayüz ekranları.
- **S** = Claude Sonnet alt ajanı (Agent aracı): mekanik taşıma ve yeniden adlandırma, test yazımı, görsel QA. Komut çalıştırabildiği için tsc, vitest ve pytest'i kendisi koşar ve kırılan import'ları kendisi düzeltir.
- **H** = Claude Haiku alt ajanı: fikstür ve index üretimi, dosya keşfi, sayım ve kontrol gibi hafif işler.
- **F** = gemini-3.8-flash medium (Antigravity): i18n metinleri (TR/EN), boş yer tutucu sayfalar, doküman taslakları.
- **O** = orkestra.

Her parça taze oturumda çalışır ve ≤ 25 dk sürer.
- Her parçadan sonra orkestra sırasıyla şunları çalıştırır: pytest, vitest, tsc, build.
- Aynı dosyaya aynı anda iki yazar verilmez. Seri tutulacak dosyalar: `app.py`, `test_contract.py`, `openapi.json`, `project.py`, `project_io.py`, çekirdek `tr/en.json`, `App.tsx`, `legacy.ts`.

| # | İş | Bağımlılık | Paralel |
|---|---|---|---|
| C0 | Dal `restructure/modules`, Kapı 2 onayının notlara işlenmesi, temel test koşusu, `tests/data/project_1_2.gtk` fikstürü (O + H) | – | – |
| C1 | Sözleşme ve keşif: `core/modules.py`, `api/registry.py`, `modules/__init__.py`, `gen_module_index.py` ve testler (G); `_index.py` üretimi (H) | C0 | C2, C3 |
| C2 | Şema 1.3: `project.py`, `project_io._from_1_2`, `core/module_state.py`, testler (G) | C0 | C1, C3 |
| C3 | Kütüphane ve ayarlar servisi `geotek/library/*` ile testler (tmp_path, APPDATA monkeypatch) (G) | C0 | C1, C2 |
| C4a | `api/common.py`. Zemin taslak uç noktaları `modules/soil`'a taşınır ve bağlanır (S, pytest'i kendisi koşar) | C1 | – |
| C4b | Sıvılaşma, duvar ve palplanş taslakları taşınır. `test_contract` güncellenir, openapi yeniden üretilir (S) | C4a | – |
| C5a | `api/session.py`. Gerçek project new/open/save/get/meta/site/close ve API testleri (G) | C2, C4b | – |
| C5b | `library_routes.py`: library, settings, modules, `data/*`. API testleri ve openapi (G + O) | C3, C5a | – |
| C6 | i18n parça birleştirme, 4 parça dosyası, yeni çekirdek anahtarlar (`start.*`, `launcher.*`, `settings.*`, `shell.*`); birleştirme kodu (G), TR/EN metinleri (F) | C4b | W1, W2 |
| W1 | Mekanik taşıma: `soil/` → `shared/soil`, `api/` → `shared/api` (`client.ts` → `http.ts` + `core.ts`), genel bileşenler → `shared/components` (S, tek yazar; tsc ve vitest'i kendisi koşar) | – | C serisi |
| W2 | Mock dispatcher `registerMockHandlers`. Eski monolit `legacy.ts` olarak yedek kalır. library/settings/modules mock'ları (G) | W1 | C serisi |
| W3a | `moduleRegistry`, `ProjectProvider`, `RequireProject`, `ModuleShell`, yeni rotalar. WorkflowBar silinir, testler güncellenir (G) | W2, C6 | – |
| W3b | StartPage ve SettingsPage (A) | W3a | W3c, W4 |
| W3c | LauncherPage (A) | W3a | W3b, W4 |
| W4 | 4 `manifest.ts` ve istemci yollarının `/api/m/<id>`'ye geçişi (S); boş Root/nav yer tutucu sayfaları (F) | W3a, C4b | W3b, W3c |

**Yapı Kapısı Y1 (kullanıcı onayı):**
- Mock ekran görüntüleri: başlangıç ekranı, yeni proje modalı, kütüphane, 4 kutulu menü, her modülün boş kabuğu.
- Gerçek backend dumanı testi: proje oluştur → `.gtk` dosyası kütüphanede görünür → projeyi yeniden aç.

| # | İş | Bağımlılık | Paralel |
|---|---|---|---|
| M1 | Zemin modülü: SiteDataPage ve SoilModelsPage `modules/soil/pages`'e taşınır. Zemin api, types ve mock dosyaları ile testler (S) | Y1 | – |

**Yapı Kapısı Y2:** zemin modülü mock'ta uçtan uca çalışıyor.

| # | İş | Bağımlılık | Paralel |
|---|---|---|---|
| M2 | İstinat: WallListPage, **WallTypePicker** ve WallWizardPage (taşıma). Mock bağımlılığı kesilir (S taşıma, A seçici). | Y2 | M4, M5 |
| M3 | Profilsiz elle zemin girişi. StructureSoilStep → `shared/structureSoil` (G) | M2 | M4, M5 |
| M4 | Palplanş modülü kabuk sayfaları ve mock (F; zorlanırsa A) | Y2 | M2, M5 |
| M5 | Sıvılaşma modülü: profil seçici (`data/*`), ayarlar, sonuç yer tutucusu, mock (A) | Y2 | M2, M4 |
| X1 | Sınır ve manifest testleri (S, testleri kendisi koşar) | M1–M5 | X2 |
| X2 | `docs/MODULE_GUIDE.md` taslağı (F); `tools/new_module.py` (S) | M1–M5 | X1 |
| X3 | `legacy.ts` ve yinelenen tipler temizlenir. ORKESTRA_PROMPT ve DEVAM_NOTLARI yol haritası yeniden hedeflenir: A1 → session + jobs, E2/E3/F2/F3 → soil, F4 → walls, F5 → sheet_pile ve liquefaction, K1 → hidden-imports ve datas. Ardından main'e birleştirme (O). | X1, X2 | – |

İnceleme:
- C1–C5 bittikten sonra: gpt-6-astra (salt okuma).
- W3/M parçalarından sonra: Opus alt ajanı (kod) ve Sonnet alt ajanı (görsel QA, ekran görüntüleri).
- Hafif kontroller (i18n anahtar eşliği, dosya sayımı, yol listeleri) Haiku alt ajanı ile yapılır.
- Gemini-3.8-flash çıktısı orkestra tarafından gözden geçirilir. Yeniden denemede bir kademe yükseltilir: flash → argon.

## Doğrulama

- Her parçadan sonra:
  - pytest tamamen yeşil, test sayısı 620'den düşmüyor. 5 m duvar B = 4.60 / seismic:bearing değişmiyor.
  - `test_contract` yeşil; openapi yeniden üretildiğinde byte düzeyinde aynı.
  - `npm --prefix web run test`, `typecheck` ve `build` yeşil.
- C2 sonrası: 1.0, 1.1 ve 1.2 fikstürleri yükleniyor. 1.3 olarak kaydediliyor; bilinmeyen modül bölümü korunuyor.
- C5b sonrası: TestClient ile geçici bir kütüphanede oluştur → listele → aç → yeniden adlandır → çoğalt → dışa aktar → çöpe sil akışı.
- W3/W4 sonrası:
  - `web-mock` önizlemesinde (port 5173) proje yokken `/m/*` → `/start` yönlendirmesi çalışıyor.
  - Menüde 4 kutu var. "Ana menüye dön" çalışıyor.
  - Ekran görüntüleri `docs/qa/shell/` altına alınıyor.
- K1 (ileride): donmuş exe'de `/api/modules` 4 modül döndürüyor.
