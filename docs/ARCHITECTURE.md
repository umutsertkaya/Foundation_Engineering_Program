# Mimari ve dosya haritası

Başlangıçta yalnız `CLAUDE.md`, `docs/STATUS.md` ve `docs/WORKFLOW.md` okunur.
Bu haritadan göreve ait satırı seçin; bütün motoru, planları veya testleri bağlama yüklemeyin.
Paket durumu ve sıradaki iş için tek kayıt `docs/STATUS.md` dosyasıdır.

## Katmanlar

| Alan | Sorumluluk ve giriş noktası |
|---|---|
| `geotek/core/models/` | Pydantic proje, profil, parametre ve yapı modelleri; `project.py`, `profile.py`, `parameters.py`, `structures.py`. |
| `geotek/engine/` | Arayüzden bağımsız mühendislik hesapları; SPT/CPT, katmanlama, korelasyon, sıvılaşma, basınç, duvar ve palplanş. |
| `geotek/services/` | Proje modellerini motorlara bağlayan iş akışları; `layering.py`, `parameters.py`, `structures.py`, `module1.py`, `walls_basic.py`, `walls_advanced.py`. |
| `geotek/modules/<id>/` | Modüle ait `MANIFEST`, API, özel DTO ve TR/EN katalogları. Kimlikler: `soil`, `liquefaction`, `walls`, `sheet_pile`. |
| `geotek/api/` | FastAPI kabuğu; `app.py` proje/yapı/kod rotaları, `library_routes.py` kütüphane, `session.py` açık proje, `jobs.py` işler. |
| `geotek/io/`, `geotek/library/` | `.gtk` okuma/yazma ve göçler; yerel proje kütüphanesi ve ayarlar. |
| `geotek/config/` | Kaynak ve doğrulama durumu taşıyan yönetmelik katsayıları; `design_codes/*.yaml`. |
| `web/src/app/` | Başlangıç, proje seçimi, modül menüsü/kabuğu ve proje bağlamı. |
| `web/src/modules/<id>/` | Modül rotaları, sayfaları, API istemcisi, mock ve testleri. |
| `web/src/shared/` | HTTP/DTO, ortak zemin editörleri, yapı zemini, iş takibi ve genel bileşenler. |
| `geotek/ui/`, `geotek/plotting/` | Mevcut PySide6 arayüzü ve çizimleri; web eşdeğerliği sağlanmadan kaldırılmaz. |

## İşe göre en küçük okuma kümesi

| İş | Önce oku | İlgili doğrulama |
|---|---|---|
| Zemin verisi/profil | `geotek/modules/soil/api.py`, `service.py`, ilgili `core/models/` dosyası; `web/src/modules/soil/pages/` | `tests/api/test_soil_api.py`, `web/src/modules/soil/__tests__/soil.test.tsx` |
| Otomatik katmanlama | `geotek/services/layering.py`, `geotek/engine/layering/`, `soil/components/LayeringModal.tsx` | `tests/unit/test_layering_*.py`, `soil/__tests__/soil_layering_params_*.test.*` |
| Parametre seçimi/onayı | `geotek/services/parameters.py`, `soil/pages/ParametersPage.tsx`, `soil/parameterState.ts` | `tests/unit/test_parameters_service.py`, `tests/api/test_soil_parameters_api.py`, `soil/__tests__/parameters_consistency.test.tsx` |
| Duvar akışı | `geotek/modules/walls/api.py`, `geotek/services/structures.py`, `walls/pages/WallWizardPage.tsx` | `tests/api/test_walls_api.py`, `tests/unit/test_structures_service.py`, `walls/__tests__/wall_wizard*.test.tsx` |
| Palplanş | `geotek/modules/sheet_pile/api.py`, `geotek/services/structures.py`, `sheet_pile/Root.tsx` ve `pages/` | `tests/api/test_sheet_pile_api.py`, `tests/unit/test_sheet_pile.py`, `sheet_pile/__tests__/sheet_pile.test.tsx` |
| Sıvılaşma | `geotek/modules/liquefaction/api.py`, `geotek/services/module1.py`, `liquefaction/pages/` | `tests/api/test_liquefaction_api.py`, `tests/unit/test_liquefaction_*.py`, `liquefaction/__tests__/liquefaction.test.tsx` |
| Kabuk/kütüphane | `geotek/api/library_routes.py`, `session.py`, `web/src/app/`, `shared/api/core.ts` | `tests/api/test_library*.py`, `tests/api/test_project_api.py`, `web/src/test/start_page.test.tsx`, `shell*.test.*` |
| Veri göçü/modül durumu | `geotek/core/models/project.py`, `geotek/core/module_state.py`, `geotek/io/project_io.py` | `tests/unit/test_project_io_13.py`, `test_migration_1_2.py`, `test_models_v2.py` |

Tablodaki `soil/`, `walls/`, `sheet_pile/`, `liquefaction/` kısa yolları `web/src/modules/` altındadır.
Jokerler dosya gruplarını gösterir; pytest'e tek tek dosya yolları veya dizin verin, kabuk genişletmesine güvenmeyin.

## Uygulanan yüzey ve açık ekranlar

Zemin API'si, katmanlama/parametre servisleri ve bunların web ekranları mevcuttur;
eski E2/E3/F3 görevlerini sıfırdan başlatmayın. F4 duvar sihirbazı, boyut önerisi,
kontrol, iş takibi ve sonuç görünümü uygulanmıştır; kabul kanıtı `STATUS.md` içindedir.
F5 tarafında sıvılaşma formu işi başlatır fakat `ResultsPage.tsx` yer tutucudur ve
form henüz işi takip etmez. Palplanş listesi vardır; ayrıntı/oluşturma/sonuç akışı
eksiktir. Palplanş tasarım **backend'i uygulanmıştır**, web mock tasarımı 501 döndürür.
Zemin `classification` rotası da yer tutucudur. `web/src/pages/ReportPage.tsx`
yer tutucu bir dosyadır; mevcut `app/App.tsx` içinde rapor rotası bağlı değildir.
Mock yanıtları motorun çalıştığını veya mühendislik sonucunun doğrulandığını kanıtlamaz.

## Sınırlar ve hassas noktalar

- Modüller birbirini import etmez. Ortak davranış `core/`, `services/` veya web `shared/` içindedir.
- Keşif: `geotek/api/registry.py` ve `web/src/app/moduleRegistry.ts`; yeni merkezi import listesi oluşturmayın.
- Proje ortak alanları çekirdektedir; modüle özel veri `Project.modules[id]` içindedir.
  Bilinmeyen modül bölümleri korunur; `module2_inputs` eski arayüz için hâlâ tutulur.
- Yapı zemin kopyası, kaynak profil hash'i, parametre onay izi ve sonuç hash'i korunur.
  `services/structures.py` ile `api/calculation_jobs.py` değişiklikleri bu kuralları etkiler.
- İşler proje kopyasıyla çalışır; kilitler, iptal ve değişmiş girdiye sonuç yazmama kuralları
  `api/jobs.py` / `calculation_jobs.py` içindedir. Bunları basitlik adına kaldırmayın.
- Büyük `WallWizardPage.tsx` ve `StructureSoilSection.tsx` dosyalarını yalnız görev gerektirirse açın;
  ilgisiz parçalama veya toplu yeniden adlandırmayı ayrı iş olarak ele alın.

## Sözleşmeler, sürümler ve üretim dosyaları

`.gtk` veri şeması **1.3** (`core/models/project.py`), HTTP API **0.2.0**
(`api/app.py`), modül manifest sürümleri **0.1.0**'dır; farklı amaçları vardır.
Güncel imza ve davranışta kod + ilgili test + üretilmiş OpenAPI birlikte esas alınır;
çelişkiyi kaydedin, eski metne uydurmak için çalışan kodu geri çevirmeyin.
`contracts/P1_CONTRACTS.md` tarihsel taslaktır; eski 1.2/501 bilgileri güncel durum değildir.
`contracts/CORE_SHELL_API.md` kabuk/iş anlamlarını, `contracts/E4_FORMULAS.md`
mühendislik varsayımlarını açıklar; tüm projeyi başlatmak için okunmaz.
Formül işinde E4 ve `katsayi_dogrulama.md` kaynaklarını ilgili testlerle inceleyin;
formül/katsayı değişikliği bağımsız el hesabı ve iki ayrı inceleme gerektirir.

Üretilmiş dosyaları elle düzenlemeyin:

```powershell
.venv\Scripts\python.exe tools/gen_module_index.py         # geotek/modules/_index.py
.venv\Scripts\python.exe tools/export_openapi.py           # docs/contracts/openapi.json
npm --prefix web run gen:api                               # shared/api/schema.d.ts
```

`shared/api/types.ts` henüz elle tutulan DTO aynasıdır; şema değişirse uyumunu ayrıca kontrol edin.
Yeni modül için `docs/MODULE_GUIDE.md` ve `tools/new_module.py` kullanılır.

## Kısa kontrol komutları

Komutlar repo kökünde çalışır; test seçimini göreve göre daraltın.

```powershell
.venv\Scripts\python.exe tools/gen_module_index.py --check
.venv\Scripts\python.exe -m pytest -q tests/unit/test_module_boundaries.py tests/unit/test_module_manifests.py tests/unit/test_module_registry.py tests/unit/test_project_io_13.py
.venv\Scripts\python.exe -m pytest -q tests/api/test_contract.py
npm --prefix web run test -- src/test/boundaries.test.ts src/test/module_paths.test.ts
npm --prefix web run typecheck
npm --prefix web run build
```

Tam kontrol ve çalışma düzeni `docs/WORKFLOW.md`; en son çalıştırma kanıtı `docs/STATUS.md` içindedir.
