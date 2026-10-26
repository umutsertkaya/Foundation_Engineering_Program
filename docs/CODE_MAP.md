# Kod haritası (bağımlılık şeması)

> **Üretilmiş dosya — elle düzenlemeyin.** `python tools/gen_code_map.py` ile yeniden üretin; `--check` günceli değilse 1 döner. Uygulama kodu çalıştırılmadan Python AST ve sınırlı TypeScript taraması yapılır. Bilinen modül keşfi ve literal Vite glob bağları ayrıca gösterilir.

Hata ararken: önce ilgili paketi şemada bul, sonra dosya tablosunda **Bağımlı olduğu** (aşağı yön) ve **Kullanan** (yukarı yön) sütunlarına bak. Hesap hatası genelde `engine/` → `services/` → `modules/<id>/api.py` → `api/` zincirinin birindedir; arayüz hatası `web/src/modules/<id>/pages` → `api.ts` → `shared/api/http.ts` zincirindedir.

Okuma: `a → b` = a, b'yi import eder. Sayılar paketler arası import kenarı adedidir.

Sınırlar: import grafiği tip/koşullu importları da içerir; çalışma zamanı çağrı grafiği veya mühendislik doğruluk kanıtı değildir. Test bağlantıları doğrudan importlara dayanır, kapsam ölçümü değildir. API eşleştirmesi sabit yollar, tam segment parametreleri ve basit literal URL yardımcılarıyla sınırlıdır; keyfi URL üreticileri, dış paketler, JSON katalogları ve yansıma çalıştırılmaz.

## 0. Modül keşfi

Bunlar import değil, `discovery` bağlarıdır. Paket diyagramlarındaki import sayısına eklenmez.

| Keşfeden | Keşfedilen |
|---|---|
| `geotek/api/registry.py` | `geotek/modules/anchored_wall/__init__.py` |
| `geotek/api/registry.py` | `geotek/modules/education/__init__.py` |
| `geotek/api/registry.py` | `geotek/modules/liquefaction/__init__.py` |
| `geotek/api/registry.py` | `geotek/modules/report/__init__.py` |
| `geotek/api/registry.py` | `geotek/modules/sheet_pile/__init__.py` |
| `geotek/api/registry.py` | `geotek/modules/soil/__init__.py` |
| `geotek/api/registry.py` | `geotek/modules/walls/__init__.py` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/anchored_wall/manifest.ts` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/education/manifest.ts` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/liquefaction/manifest.ts` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/report/manifest.ts` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/sheet_pile/manifest.ts` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/soil/manifest.ts` |
| `web/src/app/moduleRegistry.ts` | `web/src/modules/walls/manifest.ts` |
| `web/src/shared/api/mock/index.ts` | `web/src/modules/anchored_wall/mock.ts` |
| `web/src/shared/api/mock/index.ts` | `web/src/modules/liquefaction/mock.ts` |
| `web/src/shared/api/mock/index.ts` | `web/src/modules/report/mock.ts` |
| `web/src/shared/api/mock/index.ts` | `web/src/modules/sheet_pile/mock.ts` |
| `web/src/shared/api/mock/index.ts` | `web/src/modules/soil/mock.ts` |
| `web/src/shared/api/mock/index.ts` | `web/src/modules/walls/mock.ts` |

## 1. Backend (`geotek/`)

### Paket diyagramı

```mermaid
graph LR
  geotek["geotek"]
  geotek_api["geotek.api"]
  geotek_config["geotek.config"]
  geotek_core["geotek.core"]
  geotek_core_models["geotek.core.models"]
  geotek_engine["geotek.engine"]
  geotek_engine_anchor_tables["geotek.engine.anchor_tables"]
  geotek_engine_anchored_wall["geotek.engine.anchored_wall"]
  geotek_engine_anchors["geotek.engine.anchors"]
  geotek_engine_bearing["geotek.engine.bearing"]
  geotek_engine_classification["geotek.engine.classification"]
  geotek_engine_correlations["geotek.engine.correlations"]
  geotek_engine_earth_pressure["geotek.engine.earth_pressure"]
  geotek_engine_insitu["geotek.engine.insitu"]
  geotek_engine_lab["geotek.engine.lab"]
  geotek_engine_layering["geotek.engine.layering"]
  geotek_engine_limit_state["geotek.engine.limit_state"]
  geotek_engine_liquefaction["geotek.engine.liquefaction"]
  geotek_engine_sheet_pile["geotek.engine.sheet_pile"]
  geotek_engine_stability["geotek.engine.stability"]
  geotek_engine_stresses["geotek.engine.stresses"]
  geotek_engine_walls["geotek.engine.walls"]
  geotek_i18n["geotek.i18n"]
  geotek_io["geotek.io"]
  geotek_launcher["geotek.launcher"]
  geotek_library["geotek.library"]
  geotek_modules["geotek.modules"]
  geotek_modules_anchored_wall["geotek.modules.anchored_wall"]
  geotek_modules_education["geotek.modules.education"]
  geotek_modules_liquefaction["geotek.modules.liquefaction"]
  geotek_modules_report["geotek.modules.report"]
  geotek_modules_sheet_pile["geotek.modules.sheet_pile"]
  geotek_modules_soil["geotek.modules.soil"]
  geotek_modules_walls["geotek.modules.walls"]
  geotek_services["geotek.services"]
  geotek_api -->|2| geotek_config
  geotek_api -->|7| geotek_core
  geotek_api -->|8| geotek_core_models
  geotek_api -->|1| geotek_engine_limit_state
  geotek_api -->|1| geotek_i18n
  geotek_api -->|2| geotek_io
  geotek_api -->|3| geotek_library
  geotek_api -->|2| geotek_modules
  geotek_api -->|5| geotek_services
  geotek_config -->|1| geotek_core
  geotek_core -->|1| geotek_core_models
  geotek_core -->|1| geotek_services
  geotek_core_models -->|2| geotek_config
  geotek_core_models -->|4| geotek_core
  geotek_core_models -->|1| geotek_engine_stresses
  geotek_engine_anchored_wall -->|1| geotek_core
  geotek_engine_anchored_wall -->|2| geotek_core_models
  geotek_engine_anchored_wall -->|1| geotek_engine
  geotek_engine_anchored_wall -->|1| geotek_engine_anchors
  geotek_engine_anchored_wall -->|1| geotek_engine_earth_pressure
  geotek_engine_anchored_wall -->|1| geotek_engine_sheet_pile
  geotek_engine_anchors -->|1| geotek_core
  geotek_engine_anchors -->|1| geotek_core_models
  geotek_engine_anchors -->|1| geotek_engine
  geotek_engine_anchors -->|1| geotek_engine_anchor_tables
  geotek_engine_bearing -->|1| geotek_core
  geotek_engine_classification -->|1| geotek_core_models
  geotek_engine_correlations -->|6| geotek_core
  geotek_engine_correlations -->|1| geotek_core_models
  geotek_engine_earth_pressure -->|5| geotek_core
  geotek_engine_earth_pressure -->|1| geotek_core_models
  geotek_engine_insitu -->|5| geotek_core
  geotek_engine_insitu -->|4| geotek_core_models
  geotek_engine_insitu -->|1| geotek_engine_classification
  geotek_engine_insitu -->|1| geotek_engine_correlations
  geotek_engine_lab -->|5| geotek_core
  geotek_engine_layering -->|6| geotek_core
  geotek_engine_layering -->|7| geotek_core_models
  geotek_engine_layering -->|3| geotek_engine_classification
  geotek_engine_layering -->|3| geotek_engine_correlations
  geotek_engine_layering -->|3| geotek_engine_insitu
  geotek_engine_layering -->|1| geotek_engine_lab
  geotek_engine_limit_state -->|1| geotek_config
  geotek_engine_limit_state -->|1| geotek_core
  geotek_engine_limit_state -->|2| geotek_core_models
  geotek_engine_limit_state -->|1| geotek_engine_bearing
  geotek_engine_limit_state -->|1| geotek_engine_sheet_pile
  geotek_engine_limit_state -->|1| geotek_engine_stability
  geotek_engine_limit_state -->|4| geotek_engine_walls
  geotek_engine_limit_state -->|1| geotek_services
  geotek_engine_liquefaction -->|3| geotek_core
  geotek_engine_liquefaction -->|2| geotek_core_models
  geotek_engine_liquefaction -->|1| geotek_engine_classification
  geotek_engine_liquefaction -->|1| geotek_engine_correlations
  geotek_engine_liquefaction -->|3| geotek_engine_insitu
  geotek_engine_liquefaction -->|1| geotek_engine_stresses
  geotek_engine_sheet_pile -->|2| geotek_core
  geotek_engine_sheet_pile -->|1| geotek_core_models
  geotek_engine_sheet_pile -->|1| geotek_engine_earth_pressure
  geotek_engine_stability -->|2| geotek_core
  geotek_engine_stresses -->|2| geotek_core
  geotek_engine_stresses -->|1| geotek_core_models
  geotek_engine_walls -->|2| geotek_config
  geotek_engine_walls -->|5| geotek_core
  geotek_engine_walls -->|7| geotek_core_models
  geotek_engine_walls -->|2| geotek_engine_bearing
  geotek_engine_walls -->|4| geotek_engine_earth_pressure
  geotek_engine_walls -->|1| geotek_engine_sheet_pile
  geotek_engine_walls -->|2| geotek_engine_stability
  geotek_engine_walls -->|1| geotek_services
  geotek_io -->|8| geotek_core
  geotek_io -->|3| geotek_core_models
  geotek_io -->|1| geotek_engine_insitu
  geotek_io -->|3| geotek_engine_lab
  geotek_launcher -->|1| geotek_api
  geotek_library -->|1| geotek_core
  geotek_library -->|1| geotek_core_models
  geotek_library -->|1| geotek_io
  geotek_modules_anchored_wall -->|5| geotek_api
  geotek_modules_anchored_wall -->|6| geotek_core
  geotek_modules_anchored_wall -->|5| geotek_core_models
  geotek_modules_anchored_wall -->|1| geotek_engine
  geotek_modules_anchored_wall -->|1| geotek_engine_anchor_tables
  geotek_modules_anchored_wall -->|1| geotek_engine_anchored_wall
  geotek_modules_anchored_wall -->|1| geotek_engine_anchors
  geotek_modules_anchored_wall -->|1| geotek_i18n
  geotek_modules_anchored_wall -->|2| geotek_services
  geotek_modules_education -->|1| geotek_core
  geotek_modules_liquefaction -->|8| geotek_api
  geotek_modules_liquefaction -->|1| geotek_core
  geotek_modules_liquefaction -->|1| geotek_core_models
  geotek_modules_liquefaction -->|2| geotek_services
  geotek_modules_report -->|4| geotek_api
  geotek_modules_report -->|1| geotek_core
  geotek_modules_report -->|2| geotek_services
  geotek_modules_sheet_pile -->|5| geotek_api
  geotek_modules_sheet_pile -->|1| geotek_core
  geotek_modules_soil -->|6| geotek_api
  geotek_modules_soil -->|4| geotek_core
  geotek_modules_soil -->|9| geotek_core_models
  geotek_modules_soil -->|4| geotek_engine_classification
  geotek_modules_soil -->|1| geotek_engine_layering
  geotek_modules_soil -->|3| geotek_io
  geotek_modules_soil -->|5| geotek_services
  geotek_modules_walls -->|7| geotek_api
  geotek_modules_walls -->|2| geotek_core
  geotek_modules_walls -->|2| geotek_services
  geotek_services -->|1| geotek_api
  geotek_services -->|4| geotek_config
  geotek_services -->|13| geotek_core
  geotek_services -->|24| geotek_core_models
  geotek_services -->|6| geotek_engine_classification
  geotek_services -->|6| geotek_engine_correlations
  geotek_services -->|4| geotek_engine_earth_pressure
  geotek_services -->|5| geotek_engine_insitu
  geotek_services -->|1| geotek_engine_lab
  geotek_services -->|6| geotek_engine_layering
  geotek_services -->|2| geotek_engine_limit_state
  geotek_services -->|1| geotek_engine_liquefaction
  geotek_services -->|2| geotek_engine_sheet_pile
  geotek_services -->|2| geotek_engine_stability
  geotek_services -->|9| geotek_engine_walls
  geotek_services -->|1| geotek_i18n
```

### Paket bağımlılık tablosu

| Paket | Dosya | Bağımlı olduğu paketler |
|---|---:|---|
| `geotek` | 1 | — |
| `geotek.api` | 10 | `geotek.config`, `geotek.core`, `geotek.core.models`, `geotek.engine.limit_state`, `geotek.i18n`, `geotek.io`, `geotek.library`, `geotek.modules`, `geotek.services` |
| `geotek.config` | 2 | `geotek.core` |
| `geotek.core` | 7 | `geotek.core.models`, `geotek.services` |
| `geotek.core.models` | 8 | `geotek.config`, `geotek.core`, `geotek.engine.stresses` |
| `geotek.engine` | 1 | — |
| `geotek.engine.anchor_tables` | 1 | — |
| `geotek.engine.anchored_wall` | 1 | `geotek.core`, `geotek.core.models`, `geotek.engine`, `geotek.engine.anchors`, `geotek.engine.earth_pressure`, `geotek.engine.sheet_pile` |
| `geotek.engine.anchors` | 1 | `geotek.core`, `geotek.core.models`, `geotek.engine`, `geotek.engine.anchor_tables` |
| `geotek.engine.bearing` | 1 | `geotek.core` |
| `geotek.engine.classification` | 4 | `geotek.core.models` |
| `geotek.engine.correlations` | 7 | `geotek.core`, `geotek.core.models` |
| `geotek.engine.earth_pressure` | 5 | `geotek.core`, `geotek.core.models` |
| `geotek.engine.insitu` | 3 | `geotek.core`, `geotek.core.models`, `geotek.engine.classification`, `geotek.engine.correlations` |
| `geotek.engine.lab` | 5 | `geotek.core` |
| `geotek.engine.layering` | 6 | `geotek.core`, `geotek.core.models`, `geotek.engine.classification`, `geotek.engine.correlations`, `geotek.engine.insitu`, `geotek.engine.lab` |
| `geotek.engine.limit_state` | 1 | `geotek.config`, `geotek.core`, `geotek.core.models`, `geotek.engine.bearing`, `geotek.engine.sheet_pile`, `geotek.engine.stability`, `geotek.engine.walls`, `geotek.services` |
| `geotek.engine.liquefaction` | 5 | `geotek.core`, `geotek.core.models`, `geotek.engine.classification`, `geotek.engine.correlations`, `geotek.engine.insitu`, `geotek.engine.stresses` |
| `geotek.engine.sheet_pile` | 1 | `geotek.core`, `geotek.core.models`, `geotek.engine.earth_pressure` |
| `geotek.engine.stability` | 1 | `geotek.core` |
| `geotek.engine.stresses` | 1 | `geotek.core`, `geotek.core.models` |
| `geotek.engine.walls` | 5 | `geotek.config`, `geotek.core`, `geotek.core.models`, `geotek.engine.bearing`, `geotek.engine.earth_pressure`, `geotek.engine.sheet_pile`, `geotek.engine.stability`, `geotek.services` |
| `geotek.i18n` | 1 | — |
| `geotek.io` | 7 | `geotek.core`, `geotek.core.models`, `geotek.engine.insitu`, `geotek.engine.lab` |
| `geotek.launcher` | 1 | `geotek.api` |
| `geotek.library` | 3 | `geotek.core`, `geotek.core.models`, `geotek.io` |
| `geotek.modules` | 2 | — |
| `geotek.modules.anchored_wall` | 4 | `geotek.api`, `geotek.core`, `geotek.core.models`, `geotek.engine`, `geotek.engine.anchor_tables`, `geotek.engine.anchored_wall`, `geotek.engine.anchors`, `geotek.i18n`, `geotek.services` |
| `geotek.modules.education` | 1 | `geotek.core` |
| `geotek.modules.liquefaction` | 3 | `geotek.api`, `geotek.core`, `geotek.core.models`, `geotek.services` |
| `geotek.modules.report` | 3 | `geotek.api`, `geotek.core`, `geotek.services` |
| `geotek.modules.sheet_pile` | 2 | `geotek.api`, `geotek.core` |
| `geotek.modules.soil` | 4 | `geotek.api`, `geotek.core`, `geotek.core.models`, `geotek.engine.classification`, `geotek.engine.layering`, `geotek.io`, `geotek.services` |
| `geotek.modules.walls` | 3 | `geotek.api`, `geotek.core`, `geotek.services` |
| `geotek.services` | 11 | `geotek.api`, `geotek.config`, `geotek.core`, `geotek.core.models`, `geotek.engine.classification`, `geotek.engine.correlations`, `geotek.engine.earth_pressure`, `geotek.engine.insitu`, `geotek.engine.lab`, `geotek.engine.layering`, `geotek.engine.limit_state`, `geotek.engine.liquefaction`, `geotek.engine.sheet_pile`, `geotek.engine.stability`, `geotek.engine.walls`, `geotek.i18n` |

### Backend API rotaları

Modül rotaları `/api/m/<id>` altında bağlanır (`geotek/api/registry.py`); diğerleri `/api` altında.

Yer sütunu işleyicinin `def` satırıdır; çok satırlı dekoratörler AST ile okunur. Web sütunu eşleşen HTTP istemcisidir; sayfa çağıranları import grafiğinden izlenir.

| Metot | Yol | Yer | İşleyici | Web |
|---|---|---|---|---|
| GET | `/api/codes` | `geotek/api/app.py:368` | `list_codes` | `web/src/shared/api/client.ts` |
| GET | `/api/codes/{code_id}/factors` | `geotek/api/app.py:392` | `list_code_factors` | `web/src/shared/api/client.ts` |
| GET | `/api/codes/{code_id}/required` | `geotek/api/app.py:407` | `get_code_required_factors` | `web/src/shared/api/client.ts` |
| GET | `/api/data/profiles` | `geotek/api/app.py:194` | `list_project_profiles` | `web/src/shared/api/core.ts` |
| GET | `/api/health` | `geotek/api/app.py:50` | `get_health` | `web/src/shared/api/client.ts` |
| GET | `/api/i18n/{lang}` | `geotek/api/app.py:56` | `get_i18n` | `web/src/shared/api/client.ts` |
| DELETE | `/api/jobs/{job_id}` | `geotek/api/app.py:363` | `cancel_job` | `web/src/shared/api/client.ts` |
| GET | `/api/jobs/{job_id}` | `geotek/api/app.py:357` | `get_job` | `web/src/shared/api/client.ts` |
| GET | `/api/library` | `geotek/api/library_routes.py:137` | `list_library` | `web/src/shared/api/core.ts` |
| POST | `/api/library` | `geotek/api/library_routes.py:145` | `create_library_project` | `web/src/shared/api/core.ts` |
| POST | `/api/library/import` | `geotek/api/library_routes.py:176` | `import_library_project` | `web/src/shared/api/core.ts` |
| POST | `/api/library/upload` | `geotek/api/library_routes.py:193` | `upload_library_project` | — |
| DELETE | `/api/library/{file}` | `geotek/api/library_routes.py:276` | `delete_library_project` | `web/src/shared/api/core.ts` |
| GET | `/api/library/{file}/download` | `geotek/api/library_routes.py:217` | `download_library_project` | — |
| POST | `/api/library/{file}/duplicate` | `geotek/api/library_routes.py:238` | `duplicate_library_project` | `web/src/shared/api/core.ts` |
| POST | `/api/library/{file}/export` | `geotek/api/library_routes.py:263` | `export_library_project` | `web/src/shared/api/core.ts` |
| POST | `/api/library/{file}/open` | `geotek/api/library_routes.py:226` | `open_library_project` | `web/src/shared/api/core.ts` |
| POST | `/api/library/{file}/rename` | `geotek/api/library_routes.py:248` | `rename_library_project` | `web/src/shared/api/core.ts` |
| POST | `/api/m/anchored_wall/analysis/run` | `geotek/modules/anchored_wall/api.py:128` | `run_wall_analysis` | — |
| POST | `/api/m/anchored_wall/anchor/design` | `geotek/modules/anchored_wall/api.py:109` | `design_ground_anchor` | — |
| GET | `/api/m/anchored_wall/anchor/reference` | `geotek/modules/anchored_wall/api.py:169` | `anchor_reference` | — |
| GET | `/api/m/anchored_wall/soil/{profile_id}` | `geotek/modules/anchored_wall/api.py:156` | `soil_from_profile` | — |
| GET | `/api/m/anchored_wall/state` | `geotek/modules/anchored_wall/api.py:84` | `get_module_state` | — |
| PUT | `/api/m/anchored_wall/state` | `geotek/modules/anchored_wall/api.py:95` | `put_module_state` | — |
| GET | `/api/m/liquefaction/result` | `geotek/modules/liquefaction/api.py:93` | `get_liquefaction_result` | `web/src/modules/liquefaction/api.ts` |
| POST | `/api/m/liquefaction/run` | `geotek/modules/liquefaction/api.py:31` | `run_liquefaction` | `web/src/modules/liquefaction/api.ts` |
| POST | `/api/m/report/docx` | `geotek/modules/report/api.py:45` | `build_docx` | — |
| GET | `/api/m/report/sections` | `geotek/modules/report/api.py:32` | `list_sections` | `web/src/modules/report/api.ts` |
| POST | `/api/m/sheet_pile/structures/{id}/design` | `geotek/modules/sheet_pile/api.py:21` | `design_sheet_pile` | `web/src/modules/sheet_pile/api.ts` |
| POST | `/api/m/soil/boreholes` | `geotek/modules/soil/api.py:289` | `create_borehole` | `web/src/modules/soil/api.ts` |
| DELETE | `/api/m/soil/boreholes/{id}` | `geotek/modules/soil/api.py:310` | `delete_borehole` | `web/src/modules/soil/api.ts` |
| PUT | `/api/m/soil/boreholes/{id}` | `geotek/modules/soil/api.py:303` | `update_borehole` | `web/src/modules/soil/api.ts` |
| PUT | `/api/m/soil/boreholes/{id}/log` | `geotek/modules/soil/api.py:317` | `set_borehole_log` | — |
| GET | `/api/m/soil/boreholes/{id}/processed` | `geotek/modules/soil/api.py:444` | `get_processed_spt` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/boreholes/{id}/uscs` | `geotek/modules/soil/api.py:411` | `get_borehole_uscs` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/classification/sbtn/reference` | `geotek/modules/soil/api.py:360` | `get_sbtn_reference` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/classification/uscs` | `geotek/modules/soil/api.py:423` | `classify_uscs` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/classification/uscs/reference` | `geotek/modules/soil/api.py:431` | `get_uscs_reference` | `web/src/modules/soil/api.ts` |
| DELETE | `/api/m/soil/cpts/{id}` | `geotek/modules/soil/api.py:332` | `delete_cpt` | `web/src/modules/soil/api.ts` |
| PUT | `/api/m/soil/cpts/{id}` | `geotek/modules/soil/api.py:327` | `update_cpt` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/cpts/{id}/processed` | `geotek/modules/soil/api.py:339` | `get_processed_cpt` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/cpts/{id}/sbtn` | `geotek/modules/soil/api.py:394` | `get_cpt_sbtn` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/import/cpt` | `geotek/modules/soil/api.py:171` | `import_cpt` | — |
| POST | `/api/m/soil/import/spt` | `geotek/modules/soil/api.py:201` | `import_spt` | — |
| POST | `/api/m/soil/import/workbook/analyze` | `geotek/modules/soil/api.py:226` | `analyze_workbook_route` | — |
| POST | `/api/m/soil/import/workbook/check` | `geotek/modules/soil/api.py:241` | `check_workbook` | — |
| POST | `/api/m/soil/import/workbook/commit` | `geotek/modules/soil/api.py:258` | `commit_workbook` | — |
| GET | `/api/m/soil/investigations` | `geotek/modules/soil/api.py:161` | `list_investigations` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/layering/combined` | `geotek/modules/soil/api.py:483` | `propose_combined` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/layering/cpt/{cpt_id}` | `geotek/modules/soil/api.py:463` | `propose_cpt_layers` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/layering/spt/{borehole_id}` | `geotek/modules/soil/api.py:473` | `propose_spt_layers` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/profiles` | `geotek/modules/soil/api.py:503` | `list_profiles` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/profiles` | `geotek/modules/soil/api.py:512` | `create_profile` | `web/src/modules/soil/api.ts` |
| DELETE | `/api/m/soil/profiles/{id}` | `geotek/modules/soil/api.py:577` | `delete_profile` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/profiles/{id}` | `geotek/modules/soil/api.py:521` | `get_profile` | `web/src/modules/soil/api.ts` |
| PUT | `/api/m/soil/profiles/{id}` | `geotek/modules/soil/api.py:555` | `update_profile` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/profiles/{id}/layers/merge` | `geotek/modules/soil/api.py:607` | `merge_layers` | — |
| GET | `/api/m/soil/profiles/{id}/layers/{layer_id}/inventory` | `geotek/modules/soil/api.py:639` | `get_layer_inventory` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/profiles/{id}/layers/{layer_id}/parameters` | `geotek/modules/soil/api.py:625` | `list_layer_parameters` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/profiles/{id}/layers/{layer_id}/parameters/approve` | `geotek/modules/soil/api.py:677` | `approve_parameters` | `web/src/modules/soil/api.ts` |
| PUT | `/api/m/soil/profiles/{id}/layers/{layer_id}/parameters/{key}` | `geotek/modules/soil/api.py:654` | `update_parameter_selection` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/profiles/{id}/layers/{layer_id}/split` | `geotek/modules/soil/api.py:598` | `split_layer` | — |
| POST | `/api/m/soil/profiles/{id}/parameters/reapprove` | `geotek/modules/soil/api.py:704` | `reapprove_parameters` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/soil/profiles/{id}/parameters/suggest-all` | `geotek/modules/soil/api.py:744` | `suggest_all_parameters` | `web/src/modules/soil/api.ts` |
| GET | `/api/m/soil/profiles/{id}/readiness` | `geotek/modules/soil/api.py:730` | `get_profile_readiness` | `web/src/modules/soil/api.ts` |
| POST | `/api/m/walls/at-rest` | `geotek/modules/walls/api.py:60` | `analyze_at_rest` | `web/src/modules/walls/api.ts` |
| POST | `/api/m/walls/structures/{id}/check` | `geotek/modules/walls/api.py:55` | `check_wall` | `web/src/modules/walls/api.ts` |
| POST | `/api/m/walls/structures/{id}/required-factors` | `geotek/modules/walls/api.py:32` | `get_structure_required_factors` | `web/src/modules/walls/api.ts` |
| POST | `/api/m/walls/structures/{id}/size` | `geotek/modules/walls/api.py:47` | `size_wall` | `web/src/modules/walls/api.ts` |
| GET | `/api/m/walls/wall-types` | `geotek/modules/walls/api.py:23` | `list_wall_types` | `web/src/modules/walls/api.ts` |
| GET | `/api/modules` | `geotek/api/library_routes.py:95` | `list_modules` | `web/src/shared/api/core.ts` |
| GET | `/api/project` | `geotek/api/app.py:137` | `get_project` | `web/src/shared/api/client.ts` |
| PUT | `/api/project/active-profile` | `geotek/api/app.py:178` | `set_active_profile` | `web/src/shared/api/client.ts` |
| POST | `/api/project/close` | `geotek/api/app.py:130` | `close_project` | `web/src/shared/api/core.ts` |
| PUT | `/api/project/design-overrides/{code_id}` | `geotek/api/app.py:426` | `set_design_overrides` | `web/src/shared/api/client.ts` |
| PATCH | `/api/project/meta` | `geotek/api/app.py:144` | `update_project_meta` | `web/src/shared/api/client.ts` |
| POST | `/api/project/new` | `geotek/api/app.py:86` | `new_project` | `web/src/shared/api/client.ts` |
| POST | `/api/project/open` | `geotek/api/app.py:94` | `open_project` | `web/src/shared/api/client.ts`, `web/src/shared/api/core.ts` |
| POST | `/api/project/save` | `geotek/api/app.py:104` | `save_project_route` | `web/src/shared/api/client.ts`, `web/src/shared/api/core.ts` |
| PUT | `/api/project/site` | `geotek/api/app.py:163` | `set_project_site` | `web/src/shared/api/client.ts` |
| GET | `/api/session` | `geotek/api/library_routes.py:287` | `get_session_info` | `web/src/shared/api/core.ts` |
| GET | `/api/settings` | `geotek/api/library_routes.py:107` | `get_settings` | `web/src/shared/api/core.ts` |
| PUT | `/api/settings` | `geotek/api/library_routes.py:113` | `put_settings` | `web/src/shared/api/core.ts` |
| GET | `/api/structures` | `geotek/api/app.py:209` | `list_structures` | `web/src/shared/api/client.ts` |
| POST | `/api/structures` | `geotek/api/app.py:255` | `create_structure` | `web/src/shared/api/client.ts` |
| DELETE | `/api/structures/{id}` | `geotek/api/app.py:312` | `delete_structure` | `web/src/shared/api/client.ts` |
| GET | `/api/structures/{id}` | `geotek/api/app.py:286` | `get_structure` | `web/src/shared/api/client.ts` |
| PUT | `/api/structures/{id}` | `geotek/api/app.py:293` | `update_structure` | `web/src/shared/api/client.ts` |
| PUT | `/api/structures/{id}/soil` | `geotek/api/app.py:324` | `set_structure_soil` | `web/src/shared/api/client.ts` |
| POST | `/api/structures/{id}/soil/resync` | `geotek/api/app.py:338` | `resync_structure_soil` | `web/src/shared/api/client.ts` |

### Backend dosya tablosu

Test sütunu: o dosyayı doğrudan import eden `tests/` dosyaları (yoksa `—`).

#### `geotek`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `__init__.py` | 3 | — | — | `api/test_launcher.py`, `unit/test_config_i18n.py`, `unit/test_module1_service.py` |

#### `geotek.api`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `api/__init__.py` | 1 | — | `api.app`, `api.calculation_jobs`, `api.calculation_results`, `api.common`, `api.jobs`, `api.library_routes` +5 | `api/test_anchored_wall_api.py`, `api/test_codes_api.py`, `api/test_contract.py` +7 |
| `api/app.py` | 506 | `api`, `api.common`, `api.jobs`, `api.library_routes`, `api.registry`, `api.schemas`, `api.session`, `config.codes`, `core.errors`, `core.models.project`, `core.models.structures`, `i18n`, `io.project_io`, `library`, `services.structures`, `services.walls_advanced` | `launcher` | `api/conftest.py`, `api/test_contract.py`, `api/test_jobs_api.py` +3 |
| `api/calculation_jobs.py` | 96 | `api`, `api.calculation_results`, `api.jobs`, `api.schemas`, `api.session`, `core.errors`, `services`, `services.structures` | `modules.anchored_wall.api`, `modules.liquefaction.api`, `modules.report.api`, `modules.sheet_pile.api`, `modules.walls.api` | — |
| `api/calculation_results.py` | 168 | `api`, `api.schemas`, `core.warning_codes`, `engine.limit_state`, `services.structures` | `api.calculation_jobs`, `modules.liquefaction.api` | `api/test_sheet_pile_api.py`, `unit/test_liquefaction_analysis.py`, `unit/test_shear_key.py` +1 |
| `api/common.py` | 63 | `api`, `api.schemas` | `api.app`, `api.library_routes`, `modules.anchored_wall.api`, `modules.liquefaction.api`, `modules.report.api`, `modules.sheet_pile.api` +2 | — |
| `api/jobs.py` | 226 | `api`, `api.schemas`, `api.session`, `core.errors` | `api.app`, `api.calculation_jobs`, `modules.anchored_wall.api`, `modules.liquefaction.api`, `modules.sheet_pile.api`, `modules.walls.api` | `api/test_jobs_api.py`, `unit/test_sheet_pile_slope.py`, `unit/test_t10c_messages.py` |
| `api/library_routes.py` | 289 | `api`, `api.common`, `api.registry`, `api.schemas`, `api.session`, `core.errors`, `core.models.project`, `library` | `api.app` | `api/test_library_hardening_api.py` |
| `api/registry.py` | 74 | `core.errors`, `core.modules`, `modules`, `modules._index` | `api.app`, `api.library_routes`, `services.report` | `api/test_anchored_wall_api.py`, `api/test_codes_api.py`, `unit/test_module_manifests.py` +2 |
| `api/schemas.py` | 653 | `config.codes`, `core.models.profile`, `core.models.project`, `core.models.structures`, `core.models.walls` | `api.app`, `api.calculation_jobs`, `api.calculation_results`, `api.common`, `api.jobs`, `api.library_routes` +10 | `api/test_contract.py`, `api/test_jobs_api.py`, `api/test_sheet_pile_api.py` +4 |
| `api/session.py` | 97 | `api`, `api.schemas`, `core.models.project`, `io.project_io`, `library` | `api.app`, `api.calculation_jobs`, `api.jobs`, `api.library_routes`, `modules.anchored_wall.api`, `modules.liquefaction.api` +4 | — |

#### `geotek.config`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `config/__init__.py` | 1 | — | — | `unit/test_limit_state.py` |
| `config/codes.py` | 251 | `core.errors` | `api.app`, `api.schemas`, `core.models.project`, `core.models.walls`, `engine.limit_state`, `engine.walls.base` +5 | `api/test_codes_api.py`, `api/test_contract.py`, `api/test_structures_api.py` +9 |

#### `geotek.core`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `core/__init__.py` | 1 | — | — | — |
| `core/constants.py` | 13 | — | `core.models.investigations`, `core.models.profile`, `core.models.structures`, `engine.correlations.physical`, `engine.correlations.state`, `engine.correlations.stiffness` +20 | `unit/test_earth_pressure.py`, `unit/test_layering_spt.py`, `unit/test_parameters_service.py` +9 |
| `core/errors.py` | 91 | `services.walls_advanced` | `api.app`, `api.calculation_jobs`, `api.jobs`, `api.library_routes`, `api.registry`, `config.codes` +34 | `api/test_jobs_api.py`, `unit/test_anchored_wall.py`, `unit/test_anchors.py` +29 |
| `core/module_state.py` | 54 | `core.errors`, `core.models.project` | `modules.anchored_wall.api`, `modules.anchored_wall.report` | `api/test_anchored_wall_api.py`, `unit/test_module_report_hook.py`, `unit/test_project_io_13.py` |
| `core/modules.py` | 76 | `core.errors` | `api.registry`, `modules.anchored_wall`, `modules.anchored_wall.report`, `modules.education`, `modules.liquefaction`, `modules.report` +3 | `unit/test_module_registry.py`, `unit/test_module_report_hook.py`, `unit/test_new_module.py` |
| `core/units.py` | 83 | `core.errors` | `io.tabular`, `io.workbook.build`, `io.workbook.detect` | `unit/test_units.py` |
| `core/warning_codes.py` | 48 | — | `api.calculation_results`, `engine.correlations.physical`, `engine.correlations.strength`, `engine.insitu.cpt`, `engine.insitu.spt`, `engine.lab.atterberg` +12 | `unit/test_cpt.py`, `unit/test_cpt_without_fs.py`, `unit/test_lab_engine.py` +4 |

#### `geotek.core.models`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `core/models/__init__.py` | 51 | `core.models.investigations`, `core.models.parameters`, `core.models.profile`, `core.models.project`, `core.models.structures` | — | `api/test_anchored_wall_api.py`, `conftest.py`, `unit/test_anchored_wall.py` +22 |
| `core/models/anchors.py` | 404 | `core.models.structures` | `engine.anchored_wall`, `engine.anchors`, `modules.anchored_wall`, `modules.anchored_wall.api`, `modules.anchored_wall.report`, `modules.anchored_wall.schemas` | `api/test_anchored_wall_api.py`, `unit/test_anchored_wall.py`, `unit/test_anchors.py` +2 |
| `core/models/investigations.py` | 202 | `core.constants` | `core.models`, `core.models.project`, `engine.classification.uscs`, `engine.insitu.cpt`, `engine.insitu.spt`, `engine.layering.combined` +8 | `api/test_liquefaction_api.py`, `api/test_report_api.py`, `unit/test_correlations_a3.py` +6 |
| `core/models/parameters.py` | 88 | — | `core.models`, `core.models.profile`, `engine.correlations.registry`, `modules.soil.api`, `modules.soil.schemas`, `modules.soil.service` +2 | `unit/test_correlations_a3.py`, `unit/test_hs_c_walls.py`, `unit/test_parameters_service.py` +2 |
| `core/models/profile.py` | 171 | `core.constants`, `core.errors`, `core.models.parameters`, `engine.stresses` | `api.schemas`, `core.models`, `core.models.project`, `core.models.structures`, `engine.anchored_wall`, `engine.earth_pressure.distribution` +25 | `api/job_helpers.py`, `api/test_report_api.py`, `api/test_system_check_api.py` +17 |
| `core/models/project.py` | 113 | `config.codes`, `core.models.investigations`, `core.models.profile`, `core.models.structures` | `api.app`, `api.library_routes`, `api.schemas`, `api.session`, `core.models`, `core.module_state` +11 | `api/job_helpers.py`, `api/test_anchored_wall_api.py`, `api/test_contract.py` +20 |
| `core/models/structures.py` | 228 | `core.constants`, `core.models.profile`, `core.models.walls` | `api.app`, `api.schemas`, `core.models`, `core.models.anchors`, `core.models.project`, `engine.walls.layered` +2 | `api/job_helpers.py`, `api/test_report_api.py`, `api/test_soil_api.py` +10 |
| `core/models/walls.py` | 172 | `config.codes` | `api.schemas`, `core.models.structures`, `engine.limit_state`, `engine.walls.base`, `engine.walls.global_stability`, `engine.walls.layered` +4 | `api/job_helpers.py`, `api/test_report_api.py`, `unit/test_hs_c_walls.py` +11 |

#### `geotek.engine`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/__init__.py` | 1 | — | `engine.anchored_wall`, `engine.anchors`, `modules.anchored_wall.api` | `unit/test_anchors.py`, `unit/test_module_report_hook.py`, `unit/test_structures_service.py` +1 |

#### `geotek.engine.anchor_tables`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/anchor_tables.py` | 108 | — | `engine.anchors`, `modules.anchored_wall.api` | `unit/test_anchors.py` |

#### `geotek.engine.anchored_wall`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/anchored_wall.py` | 607 | `core.errors`, `core.models.anchors`, `core.models.profile`, `engine`, `engine.anchors`, `engine.earth_pressure.coefficients`, `engine.sheet_pile` | `modules.anchored_wall.api` | `unit/test_anchored_wall.py`, `unit/test_module_report_hook.py`, `unit/test_source_examples.py` |

#### `geotek.engine.anchors`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/anchors.py` | 307 | `core.errors`, `core.models.anchors`, `engine`, `engine.anchor_tables` | `engine.anchored_wall`, `modules.anchored_wall.api` | `unit/test_anchors.py`, `unit/test_module_report_hook.py`, `unit/test_source_examples.py` |

#### `geotek.engine.bearing`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/bearing.py` | 187 | `core.errors` | `engine.limit_state`, `engine.walls.base`, `engine.walls.layered` | `unit/test_bearing.py`, `unit/test_system_check_engine.py`, `verification/test_bearing_textbook.py` |

#### `geotek.engine.classification`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/classification/__init__.py` | 1 | — | `modules.soil.api`, `services.report` | `api/test_soil_classification_api.py` |
| `engine/classification/robertson.py` | 94 | — | `engine.insitu.cpt`, `engine.layering.combined`, `engine.layering.cpt`, `engine.liquefaction.youd2001`, `modules.soil.api`, `services.report` | `api/test_soil_classification_api.py`, `unit/test_cpt.py`, `unit/test_layering_cpt.py` +2 |
| `engine/classification/uscs.py` | 132 | `core.models.investigations` | `engine.layering.combined`, `modules.soil.api`, `services.layering`, `services.parameters`, `services.report` | `api/test_soil_classification_api.py`, `unit/test_uscs.py` |
| `engine/classification/uscs_names.py` | 112 | — | `modules.soil.api`, `services.report` | `api/test_soil_classification_api.py` |

#### `geotek.engine.correlations`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/correlations/__init__.py` | 14 | `engine.correlations.physical`, `engine.correlations.registry`, `engine.correlations.state`, `engine.correlations.stiffness`, `engine.correlations.strength` | `services.parameter_plan`, `services.parameters` | `unit/test_correlations.py`, `unit/test_correlations_a3.py`, `unit/test_state_correlations.py` |
| `engine/correlations/checks.py` | 47 | — | `engine.correlations.physical`, `engine.correlations.state`, `engine.correlations.stiffness`, `engine.correlations.strength` | — |
| `engine/correlations/physical.py` | 123 | `core.constants`, `core.warning_codes`, `engine.correlations.checks`, `engine.correlations.registry` | `engine.correlations`, `engine.insitu.cpt`, `engine.layering.combined`, `engine.layering.cpt`, `engine.layering.unit_weight`, `engine.liquefaction.analysis` +2 | `unit/test_system_check_engine.py`, `verification/test_bi2014_case_histories.py` |
| `engine/correlations/registry.py` | 195 | `core.models.parameters` | `engine.correlations`, `engine.correlations.physical`, `engine.correlations.state`, `engine.correlations.stiffness`, `engine.correlations.strength`, `services.parameter_plan` +1 | `unit/test_correlations.py`, `unit/test_correlations_a3.py`, `unit/test_layering_cpt.py` +2 |
| `engine/correlations/state.py` | 100 | `core.constants`, `engine.correlations.checks`, `engine.correlations.registry` | `engine.correlations` | — |
| `engine/correlations/stiffness.py` | 179 | `core.constants`, `engine.correlations.checks`, `engine.correlations.registry` | `engine.correlations` | — |
| `engine/correlations/strength.py` | 238 | `core.constants`, `core.warning_codes`, `engine.correlations.checks`, `engine.correlations.registry` | `engine.correlations` | — |

#### `geotek.engine.earth_pressure`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/earth_pressure/__init__.py` | 0 | — | — | — |
| `engine/earth_pressure/coefficients.py` | 196 | `core.errors` | `engine.anchored_wall`, `engine.earth_pressure.distribution`, `engine.walls.base`, `services.structures`, `services.walls_basic` | `unit/test_anchored_wall.py`, `unit/test_earth_pressure.py`, `unit/test_earth_pressure_crosscheck.py` +12 |
| `engine/earth_pressure/distribution.py` | 294 | `core.constants`, `core.errors`, `core.models.profile`, `engine.earth_pressure.coefficients`, `engine.earth_pressure.log_spiral` | `engine.sheet_pile`, `engine.walls.base`, `engine.walls.layered`, `services.at_rest`, `services.structures` | `unit/test_earth_pressure.py`, `unit/test_hs_c_walls.py`, `unit/test_sheet_pile_slope.py` +3 |
| `engine/earth_pressure/log_spiral.py` | 110 | `core.errors` | `engine.earth_pressure.distribution` | `unit/test_earth_pressure.py`, `verification/test_earth_pressure_textbook.py` |
| `engine/earth_pressure/wedge.py` | 119 | `core.errors` | `engine.walls.base` | `unit/test_earth_pressure_crosscheck.py`, `unit/test_hs_c_walls.py`, `unit/test_sheet_pile_slope.py` +1 |

#### `geotek.engine.insitu`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/insitu/__init__.py` | 1 | — | — | — |
| `engine/insitu/cpt.py` | 224 | `core.constants`, `core.errors`, `core.models.investigations`, `core.models.profile`, `core.warning_codes`, `engine.classification.robertson`, `engine.correlations.physical` | `engine.layering.cpt`, `engine.liquefaction.analysis`, `engine.liquefaction.common`, `services.module1`, `services.parameters` | `api/test_soil_api.py`, `unit/test_cpt.py`, `unit/test_cpt_without_fs.py` +5 |
| `engine/insitu/spt.py` | 194 | `core.constants`, `core.models.investigations`, `core.models.profile`, `core.warning_codes` | `engine.layering.spt`, `engine.layering.unit_weight`, `engine.liquefaction.analysis`, `io.workbook.build`, `services.layering`, `services.module1` +1 | `api/test_soil_api.py`, `unit/test_correlations_a3.py`, `unit/test_io.py` +4 |

#### `geotek.engine.lab`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/lab/__init__.py` | 1 | — | — | — |
| `engine/lab/atterberg.py` | 112 | `core.warning_codes` | `io.workbook.build` | `unit/test_lab_engine.py` |
| `engine/lab/phase.py` | 60 | `core.constants`, `core.warning_codes` | `engine.layering.unit_weight`, `services.parameters` | `unit/test_lab_engine.py` |
| `engine/lab/sieve.py` | 136 | `core.warning_codes` | `io.workbook.build` | `unit/test_lab_engine.py` |
| `engine/lab/triaxial.py` | 181 | `core.warning_codes` | `io.workbook.build` | `unit/test_lab_engine.py` |

#### `geotek.engine.layering`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/layering/__init__.py` | 43 | `core.models.profile`, `engine.layering.combined`, `engine.layering.common`, `engine.layering.cpt`, `engine.layering.spt`, `engine.layering.unit_weight` | `services.layering` | `unit/test_layering_conversion.py`, `unit/test_layering_cpt.py`, `unit/test_layering_spt.py` |
| `engine/layering/combined.py` | 223 | `core.models.investigations`, `core.models.profile`, `engine.classification.robertson`, `engine.classification.uscs`, `engine.correlations.physical`, `engine.layering.common`, `engine.layering.unit_weight` | `engine.layering`, `modules.soil.service`, `services.layering` | `unit/test_layering_combined.py` |
| `engine/layering/common.py` | 158 | `core.constants`, `core.models.profile`, `core.warning_codes` | `engine.layering`, `engine.layering.combined`, `engine.layering.cpt`, `engine.layering.spt`, `engine.layering.unit_weight`, `services.layering` +1 | `api/test_soil_parameters_api.py`, `unit/test_layering_combined.py`, `unit/test_layering_common.py` +4 |
| `engine/layering/cpt.py` | 194 | `core.constants`, `core.models.profile`, `engine.classification.robertson`, `engine.correlations.physical`, `engine.insitu.cpt`, `engine.layering.common` | `engine.layering` | — |
| `engine/layering/spt.py` | 231 | `core.constants`, `core.models.investigations`, `core.models.profile`, `engine.insitu.spt`, `engine.layering.common` | `engine.layering`, `services.layering` | — |
| `engine/layering/unit_weight.py` | 243 | `core.constants`, `core.warning_codes`, `engine.correlations.physical`, `engine.insitu.spt`, `engine.lab.phase`, `engine.layering.common` | `engine.layering`, `engine.layering.combined`, `services.layering` | `unit/test_layering_gamma.py` |

#### `geotek.engine.limit_state`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/limit_state.py` | 743 | `config.codes`, `core.errors`, `core.models.profile`, `core.models.walls`, `engine.bearing`, `engine.sheet_pile`, `engine.stability`, `engine.walls.base`, `engine.walls.global_stability`, `engine.walls.layered`, `engine.walls.walls`, `services.walls_advanced` | `api.calculation_results`, `services.structures`, `services.walls_advanced` | `unit/test_limit_state.py`, `unit/test_shear_key.py`, `unit/test_structures_service.py` +1 |

#### `geotek.engine.liquefaction`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/liquefaction/__init__.py` | 16 | `engine.liquefaction.analysis`, `engine.liquefaction.common` | `engine.liquefaction.analysis`, `services.module1` | `unit/test_liquefaction_analysis.py`, `unit/test_liquefaction_methods.py`, `unit/test_module1_service.py` +5 |
| `engine/liquefaction/analysis.py` | 229 | `core.models.profile`, `core.warning_codes`, `engine.correlations.physical`, `engine.insitu.cpt`, `engine.insitu.spt`, `engine.liquefaction`, `engine.liquefaction.boulanger_idriss2014`, `engine.liquefaction.common`, `engine.liquefaction.youd2001` | `engine.liquefaction` | `unit/test_liquefaction_analysis.py`, `unit/test_system_check_engine.py` |
| `engine/liquefaction/boulanger_idriss2014.py` | 143 | `core.constants` | `engine.liquefaction.analysis` | `unit/test_liquefaction_methods.py`, `verification/test_bi2014_case_histories.py` |
| `engine/liquefaction/common.py` | 213 | `core.models.profile`, `engine.insitu.cpt`, `engine.stresses` | `engine.liquefaction`, `engine.liquefaction.analysis` | `unit/test_liquefaction_analysis.py`, `unit/test_liquefaction_methods.py`, `unit/test_module1_service.py` +1 |
| `engine/liquefaction/youd2001.py` | 164 | `core.constants`, `engine.classification.robertson` | `engine.liquefaction.analysis` | `unit/test_liquefaction_methods.py`, `verification/test_youd2001_cpt.py`, `verification/test_youd2001_cpt_independent.py` +1 |

#### `geotek.engine.sheet_pile`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/sheet_pile.py` | 405 | `core.constants`, `core.errors`, `core.models.profile`, `engine.earth_pressure.distribution` | `engine.anchored_wall`, `engine.limit_state`, `engine.walls.layered`, `services.structures`, `services.walls_basic` | `api/test_contract.py`, `unit/test_anchored_wall.py`, `unit/test_limit_state.py` +7 |

#### `geotek.engine.stability`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/stability.py` | 275 | `core.constants`, `core.errors` | `engine.limit_state`, `engine.walls.global_stability`, `engine.walls.layered`, `services.walls_advanced`, `services.walls_basic` | `unit/test_limit_state.py`, `unit/test_shear_key.py`, `unit/test_stability.py` +6 |

#### `geotek.engine.stresses`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/stresses.py` | 62 | `core.constants`, `core.errors`, `core.models.profile` | `core.models.profile`, `engine.liquefaction.common` | — |

#### `geotek.engine.walls`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `engine/walls/__init__.py` | 0 | — | — | `unit/test_walls_layered.py` |
| `engine/walls/base.py` | 568 | `config.codes`, `core.errors`, `core.models.profile`, `core.models.walls`, `core.warning_codes`, `engine.bearing`, `engine.earth_pressure.coefficients`, `engine.earth_pressure.distribution`, `engine.earth_pressure.wedge` | `engine.limit_state`, `engine.walls.global_stability`, `engine.walls.layered`, `engine.walls.walls`, `services.structures`, `services.walls_advanced` +1 | `api/test_contract.py`, `unit/test_hs_c_walls.py`, `unit/test_shear_key.py` +2 |
| `engine/walls/global_stability.py` | 164 | `config.codes`, `core.models.walls`, `engine.stability`, `engine.walls.base`, `engine.walls.walls` | `engine.limit_state`, `services.structures`, `services.walls_advanced`, `services.walls_basic` | `unit/test_levels.py`, `unit/test_limit_state.py`, `unit/test_shear_key.py` +2 |
| `engine/walls/layered.py` | 682 | `core.constants`, `core.errors`, `core.models.profile`, `core.models.structures`, `core.models.walls`, `core.warning_codes`, `engine.bearing`, `engine.earth_pressure.distribution`, `engine.sheet_pile`, `engine.stability`, `engine.walls.base`, `engine.walls.walls`, `services.walls_basic` | `engine.limit_state`, `services.structures` | `api/job_helpers.py`, `unit/test_hs_c_walls.py`, `unit/test_shear_key.py` +4 |
| `engine/walls/walls.py` | 142 | `core.models.walls`, `engine.walls.base` | `engine.limit_state`, `engine.walls.global_stability`, `engine.walls.layered`, `services.walls_advanced`, `services.walls_basic` | `unit/test_levels.py`, `unit/test_limit_state.py`, `unit/test_shear_key.py` +3 |

#### `geotek.i18n`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `i18n/__init__.py` | 69 | — | `api.app`, `modules.anchored_wall.report`, `services.report` | `api/test_i18n_api.py`, `api/test_soil_parameters_api.py`, `unit/test_config_i18n.py` +6 |

#### `geotek.io`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `io/__init__.py` | 1 | — | `modules.soil.service` | `unit/test_library_hardening.py` |
| `io/project_io.py` | 113 | `core.errors`, `core.models.project` | `api.app`, `api.session`, `library.service` | `api/test_codes_api.py`, `api/test_project_api.py`, `api/test_soil_api.py` +13 |
| `io/tabular.py` | 185 | `core.errors`, `core.models.investigations`, `core.units` | `io.workbook.build`, `modules.soil.service` | `unit/test_io.py`, `unit/test_layering_cpt.py`, `unit/test_layering_spt.py` |
| `io/workbook/__init__.py` | 12 | `io.workbook.build`, `io.workbook.detect`, `io.workbook.schema` | `modules.soil.api` | `unit/test_workbook_import.py` |
| `io/workbook/build.py` | 450 | `core.errors`, `core.models.investigations`, `core.units`, `core.warning_codes`, `engine.insitu.spt`, `engine.lab.atterberg`, `engine.lab.sieve`, `engine.lab.triaxial`, `io.tabular`, `io.workbook.detect`, `io.workbook.schema` | `io.workbook` | — |
| `io/workbook/detect.py` | 588 | `core.errors`, `core.units`, `io.workbook.schema` | `io.workbook`, `io.workbook.build` | — |
| `io/workbook/schema.py` | 66 | — | `io.workbook`, `io.workbook.build`, `io.workbook.detect` | — |

#### `geotek.launcher`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `launcher.py` | 175 | `api.app` | — | `api/test_launcher.py`, `unit/test_launcher.py` |

#### `geotek.library`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `library/__init__.py` | 24 | `library.service`, `library.settings` | `api.app`, `api.library_routes`, `api.session` | `api/conftest.py`, `api/test_codes_api.py`, `api/test_library_api.py` +3 |
| `library/service.py` | 308 | `core.errors`, `core.models.project`, `io.project_io` | `library` | `unit/test_library.py`, `unit/test_library_hardening.py` |
| `library/settings.py` | 121 | — | `library` | `unit/test_library.py` |

#### `geotek.modules`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/__init__.py` | 4 | — | `api.registry` | `unit/test_module_registry.py` |
| `modules/_index.py` | 13 | — | `api.registry` | `unit/test_module_registry.py` |

#### `geotek.modules.anchored_wall`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/anchored_wall/__init__.py` | 23 | `core.models.anchors`, `core.modules`, `modules.anchored_wall.api`, `modules.anchored_wall.report` | — | — |
| `modules/anchored_wall/api.py` | 188 | `api.calculation_jobs`, `api.common`, `api.jobs`, `api.session`, `core.errors`, `core.models.anchors`, `core.models.structures`, `core.module_state`, `engine`, `engine.anchor_tables`, `engine.anchored_wall`, `engine.anchors`, `modules.anchored_wall.schemas` | `modules.anchored_wall`, `modules.anchored_wall.report` | — |
| `modules/anchored_wall/report.py` | 278 | `core.errors`, `core.models.anchors`, `core.module_state`, `core.modules`, `i18n`, `modules.anchored_wall.api`, `services`, `services.report_figures` | `modules.anchored_wall` | — |
| `modules/anchored_wall/schemas.py` | 63 | `api.schemas`, `core.models.anchors` | `modules.anchored_wall.api` | — |

#### `geotek.modules.education`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/education/__init__.py` | 15 | `core.modules` | — | — |

#### `geotek.modules.liquefaction`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/liquefaction/__init__.py` | 17 | `core.modules`, `modules.liquefaction.api` | — | — |
| `modules/liquefaction/api.py` | 108 | `api`, `api.calculation_jobs`, `api.calculation_results`, `api.common`, `api.jobs`, `api.schemas`, `api.session`, `core.models.project`, `modules.liquefaction.schemas`, `services`, `services.module1` | `modules.liquefaction` | — |
| `modules/liquefaction/schemas.py` | 32 | `api.schemas` | `modules.liquefaction.api` | — |

#### `geotek.modules.report`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/report/__init__.py` | 18 | `core.modules`, `modules.report.api` | — | — |
| `modules/report/api.py` | 63 | `api.calculation_jobs`, `api.common`, `api.session`, `modules.report.schemas`, `services`, `services.report` | `modules.report` | — |
| `modules/report/schemas.py` | 26 | `api.schemas` | `modules.report.api` | — |

#### `geotek.modules.sheet_pile`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/sheet_pile/__init__.py` | 18 | `core.modules`, `modules.sheet_pile.api` | — | — |
| `modules/sheet_pile/api.py` | 25 | `api`, `api.calculation_jobs`, `api.common`, `api.jobs`, `api.schemas` | `modules.sheet_pile` | — |

#### `geotek.modules.soil`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/soil/__init__.py` | 16 | `core.modules`, `modules.soil.api` | `modules.soil.api` | `api/test_soil_api.py`, `unit/test_selection_basis.py` |
| `modules/soil/api.py` | 750 | `api`, `api.common`, `api.schemas`, `api.session`, `core.errors`, `core.models.investigations`, `core.models.parameters`, `core.models.profile`, `engine.classification`, `engine.classification.robertson`, `engine.classification.uscs`, `engine.classification.uscs_names`, `io.workbook`, `modules.soil`, `modules.soil.schemas`, `modules.soil.service`, `services`, `services.layering`, `services.module1`, `services.parameter_plan`, `services.parameters` | `modules.soil` | — |
| `modules/soil/schemas.py` | 301 | `api.schemas`, `core.models.investigations`, `core.models.parameters`, `core.models.profile` | `modules.soil.api`, `modules.soil.service` | — |
| `modules/soil/service.py` | 344 | `api.session`, `core.constants`, `core.errors`, `core.models.parameters`, `core.models.profile`, `core.models.project`, `engine.layering.combined`, `io`, `io.tabular`, `modules.soil.schemas` | `modules.soil.api` | `api/test_soil_api.py`, `unit/test_selection_basis.py` |

#### `geotek.modules.walls`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/walls/__init__.py` | 18 | `core.modules`, `modules.walls.api` | — | — |
| `modules/walls/api.py` | 73 | `api`, `api.calculation_jobs`, `api.common`, `api.jobs`, `api.schemas`, `api.session`, `core.errors`, `modules.walls.schemas`, `services.at_rest`, `services.structures` | `modules.walls` | — |
| `modules/walls/schemas.py` | 45 | `api.schemas` | `modules.walls.api` | — |

#### `geotek.services`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `services/__init__.py` | 1 | — | `api.calculation_jobs`, `modules.anchored_wall.report`, `modules.liquefaction.api`, `modules.report.api`, `modules.soil.api`, `services.parameter_plan` +1 | `api/test_liquefaction_api.py`, `api/test_report_api.py`, `api/test_sheet_pile_api.py` +10 |
| `services/at_rest.py` | 104 | `core.errors`, `core.models.project`, `engine.earth_pressure.distribution`, `services.parameters` | `modules.walls.api` | `unit/test_hs_c_walls.py` |
| `services/layering.py` | 236 | `core.models.investigations`, `core.models.profile`, `core.models.project`, `engine.classification.uscs`, `engine.correlations.physical`, `engine.insitu.spt`, `engine.layering`, `engine.layering.combined`, `engine.layering.common`, `engine.layering.spt`, `engine.layering.unit_weight`, `services.module1` | `modules.soil.api` | `unit/test_layering_cpt.py`, `unit/test_layering_spt.py` |
| `services/module1.py` | 195 | `core.models.investigations`, `core.models.profile`, `core.models.project`, `core.warning_codes`, `engine.insitu.cpt`, `engine.insitu.spt`, `engine.liquefaction` | `modules.liquefaction.api`, `modules.soil.api`, `services.layering`, `services.report` | `api/test_liquefaction_api.py`, `unit/test_models_v2.py`, `unit/test_module1_service.py` |
| `services/parameter_plan.py` | 117 | `core.constants`, `core.models.parameters`, `core.models.profile`, `core.models.project`, `engine.correlations`, `engine.correlations.registry`, `services`, `services.parameters` | `modules.soil.api` | `unit/test_correlations_a3.py`, `unit/test_selection_basis.py` |
| `services/parameters.py` | 1108 | `core.constants`, `core.errors`, `core.models.investigations`, `core.models.parameters`, `core.models.profile`, `core.models.project`, `engine.classification.uscs`, `engine.correlations`, `engine.correlations.physical`, `engine.correlations.registry`, `engine.insitu.cpt`, `engine.insitu.spt`, `engine.lab.phase`, `engine.layering.common` | `modules.soil.api`, `services.at_rest`, `services.parameter_plan` | `unit/test_correlations_a3.py`, `unit/test_cpt_without_fs.py`, `unit/test_hs_c_walls.py` +3 |
| `services/report.py` | 862 | `api.registry`, `config.codes`, `core.errors`, `core.models.profile`, `core.models.project`, `core.warning_codes`, `engine.classification`, `engine.classification.robertson`, `engine.classification.uscs`, `engine.classification.uscs_names`, `i18n`, `services`, `services.module1`, `services.report_figures`, `services.structures` | `modules.report.api` | `api/test_report_api.py`, `unit/test_module_report_hook.py`, `unit/test_report_status_guard.py` +1 |
| `services/report_figures.py` | 315 | — | `modules.anchored_wall.report`, `services.report` | `api/test_report_api.py` |
| `services/structures.py` | 854 | `config.codes`, `core.errors`, `core.models.profile`, `core.models.project`, `core.models.structures`, `core.models.walls`, `core.warning_codes`, `engine.earth_pressure.coefficients`, `engine.earth_pressure.distribution`, `engine.limit_state`, `engine.sheet_pile`, `engine.walls.base`, `engine.walls.global_stability`, `engine.walls.layered`, `services.walls_advanced`, `services.walls_basic` | `api.app`, `api.calculation_jobs`, `api.calculation_results`, `modules.walls.api`, `services.report` | `api/test_sheet_pile_api.py`, `api/test_structures_api.py`, `api/test_walls_api.py` +5 |
| `services/walls_advanced.py` | 352 | `config.codes`, `core.constants`, `core.errors`, `core.models.profile`, `core.models.walls`, `engine.limit_state`, `engine.stability`, `engine.walls.base`, `engine.walls.global_stability`, `engine.walls.walls`, `services.walls_basic` | `api.app`, `core.errors`, `engine.limit_state`, `services.structures` | `api/test_codes_api.py`, `api/test_contract.py`, `api/test_jobs_api.py` +3 |
| `services/walls_basic.py` | 490 | `config.codes`, `core.constants`, `core.errors`, `core.models.profile`, `core.models.walls`, `engine.earth_pressure.coefficients`, `engine.sheet_pile`, `engine.stability`, `engine.walls.base`, `engine.walls.global_stability`, `engine.walls.walls` | `engine.walls.layered`, `services.structures`, `services.walls_advanced` | `api/job_helpers.py`, `api/test_contract.py`, `api/test_sheet_pile_api.py` +9 |

## 2. Web (`web/src/`)

### Klasör diyagramı (testler hariç)

```mermaid
graph LR
  _root_["(root)"]
  app["app"]
  modules_anchored_wall["modules/anchored_wall"]
  modules_education["modules/education"]
  modules_liquefaction["modules/liquefaction"]
  modules_report["modules/report"]
  modules_sheet_pile["modules/sheet_pile"]
  modules_soil["modules/soil"]
  modules_walls["modules/walls"]
  shared["shared"]
  app -->|39| shared
  modules_anchored_wall -->|1| app
  modules_anchored_wall -->|34| shared
  modules_education -->|6| shared
  modules_liquefaction -->|30| shared
  modules_report -->|11| shared
  modules_sheet_pile -->|1| app
  modules_sheet_pile -->|47| shared
  modules_soil -->|49| shared
  modules_walls -->|73| shared
```

| Klasör | Dosya | Bağımlı olduğu klasörler |
|---|---:|---|
| `(root)` | 1 | — |
| `app` | 15 | `shared` |
| `modules/anchored_wall` | 16 | `app`, `shared` |
| `modules/education` | 40 | `shared` |
| `modules/liquefaction` | 8 | `shared` |
| `modules/report` | 5 | `shared` |
| `modules/sheet_pile` | 15 | `app`, `shared` |
| `modules/soil` | 25 | `shared` |
| `modules/walls` | 23 | `shared` |
| `shared` | 53 | — |

### Web → backend çağrıları

`request("METHOD", "/yol")` çağrıları; yol `/api` önekiyle backend rotalarına denk gelir. `${…}` değişkenleri `{}` ile gösterilir.

| Dosya | Çağrılar |
|---|---|
| `app/AppChrome.tsx` | GET `/launcher`<br>POST `/launcher/shutdown` |
| `modules/liquefaction/api.ts` | POST `/m/liquefaction/run`<br>GET `/m/liquefaction/result` |
| `modules/report/api.ts` | POST `/m/report/run`<br>GET `/m/report/sections` |
| `modules/sheet_pile/api.ts` | POST `/m/sheet_pile/structures/{}/design` |
| `modules/soil/api.ts` | GET `/m/soil/investigations`<br>GET `/m/soil/cpts/{}/processed`<br>GET `/m/soil/boreholes/{}/processed`<br>POST `/m/soil/layering/cpt/{}`<br>POST `/m/soil/layering/spt/{}`<br>POST `/m/soil/layering/combined`<br>GET `/m/soil/profiles`<br>POST `/m/soil/profiles`<br>GET `/m/soil/profiles/{}`<br>PUT `/m/soil/profiles/{}`<br>DELETE `/m/soil/profiles/{}`<br>GET `/m/soil/profiles/{}/layers/{}/parameters`<br>PUT `/m/soil/profiles/{}/layers/{}/parameters/{}`<br>POST `/m/soil/profiles/{}/layers/{}/parameters/approve`<br>POST `/m/soil/profiles/{}/parameters/reapprove`<br>GET `/m/soil/profiles/{}/readiness`<br>POST `/m/soil/profiles/{}/parameters/suggest-all`<br>GET `/m/soil/classification/sbtn/reference`<br>GET `/m/soil/cpts/{}/sbtn`<br>GET `/m/soil/boreholes/{}/uscs`<br>POST `/m/soil/classification/uscs`<br>GET `/m/soil/classification/uscs/reference`<br>GET `/m/soil/profiles/{}/layers/{}/inventory`<br>DELETE `/m/soil/cpts/{}`<br>DELETE `/m/soil/boreholes/{}`<br>POST `/m/soil/boreholes`<br>PUT `/m/soil/boreholes/{}`<br>PUT `/m/soil/cpts/{}` |
| `modules/walls/api.ts` | GET `/m/walls/wall-types`<br>POST `/m/walls/structures/{}/required-factors`<br>POST `/m/walls/structures/{}/size`<br>POST `/m/walls/structures/{}/check`<br>POST `/m/walls/at-rest` |
| `shared/api/client.ts` | GET `/health`<br>GET `/i18n/{}`<br>POST `/project/new`<br>POST `/project/open`<br>POST `/project/save`<br>GET `/project`<br>PATCH `/project/meta`<br>PUT `/project/site`<br>PUT `/project/active-profile`<br>GET `/structures`<br>POST `/structures`<br>GET `/structures/{}`<br>PUT `/structures/{}`<br>DELETE `/structures/{}`<br>PUT `/structures/{}/soil`<br>POST `/structures/{}/soil/resync`<br>GET `/jobs/{}`<br>DELETE `/jobs/{}`<br>GET `/codes`<br>GET `/codes/{}/factors`<br>GET `/codes/{}/required`<br>PUT `/project/design-overrides/{}` |
| `shared/api/core.ts` | GET `/modules`<br>GET `/settings`<br>PUT `/settings`<br>GET `/library`<br>POST `/library`<br>POST `/library/{}/open`<br>POST `/library/{}/duplicate`<br>POST `/library/{}/rename`<br>POST `/library/{}/export`<br>DELETE `/library/{}`<br>POST `/library/import`<br>GET `/session`<br>POST `/project/save`<br>POST `/project/open`<br>POST `/project/save`<br>POST `/project/close`<br>GET `/data/profiles` |

### Web dosya tablosu

Testler yalnız **Kullanan** sütununda görünür; “Test” sütunu o dosyayı import eden test dosyalarıdır.

#### `(root)`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `vite-env.d.ts` | 9 | — | — | — |

#### `app`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `app/App.tsx` | 30 | `app/AppChrome.tsx`, `app/ModuleShell.tsx`, `app/ProjectProvider.tsx`, `app/RequireProject.tsx`, `app/moduleRegistry.ts`, `app/pages/LauncherPage.tsx`, `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx` | `app/main.tsx` | `test/shell.test.tsx`, `test/start_page.test.tsx` |
| `app/AppChrome.tsx` | 83 | `shared/api/core.ts`, `shared/api/http.ts` | `app/App.tsx` | `test/app_chrome.test.tsx` |
| `app/ModuleShell.tsx` | 123 | `app/ProjectProvider.tsx`, `app/ViewMenu.tsx`, `app/moduleRegistry.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/StatusChip.tsx`, `shared/hooks/usePreSaveHook.ts` | `app/App.tsx` | — |
| `app/ProjectProvider.tsx` | 133 | `shared/api/client.ts`, `shared/api/core.ts`, `shared/api/http.ts`, `shared/api/types.ts` | `app/App.tsx`, `app/ModuleShell.tsx`, `app/RequireProject.tsx`, `app/pages/LauncherPage.tsx`, `app/pages/StartPage.tsx` | `test/shell.test.tsx` |
| `app/RequireProject.tsx` | 13 | `app/ProjectProvider.tsx`, `shared/components/ErrorAlert.tsx` | `app/App.tsx` | — |
| `app/ThemeToggle.tsx` | 19 | — | `app/ViewMenu.tsx`, `app/pages/StartPage.tsx` | — |
| `app/ViewMenu.tsx` | 46 | `app/ThemeToggle.tsx`, `app/i18n.ts`, `shared/api/types.ts` | `app/ModuleShell.tsx`, `app/pages/LauncherPage.tsx` | — |
| `app/i18n.ts` | 60 | `shared/api/client.ts`, `shared/api/types.ts` | `app/ViewMenu.tsx`, `app/main.tsx`, `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/format.ts` +1 | `modules/anchored_wall/__tests__/anchored_wall.test.tsx`, `modules/education/__tests__/education.test.tsx`, `modules/liquefaction/__tests__/liquefaction.test.tsx` +32 |
| `app/launcherModel.ts` | 128 | `shared/api/types.ts`, `shared/components/StatusChip.tsx` | `app/pages/LauncherPage.tsx` | `test/launcher_model.test.ts` |
| `app/main.tsx` | 48 | `app/App.tsx`, `app/i18n.ts`, `app/theme.ts` | — | — |
| `app/moduleRegistry.ts` | 29 | `shared/moduleTypes.ts` | `app/App.tsx`, `app/ModuleShell.tsx`, `app/pages/LauncherPage.tsx` | `test/module_paths.test.ts`, `test/shell.test.tsx` |
| `app/pages/LauncherPage.tsx` | 593 | `app/ProjectProvider.tsx`, `app/ViewMenu.tsx`, `app/launcherModel.ts`, `app/moduleRegistry.ts`, `shared/api/client.ts`, `shared/api/launcher.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/StatusChip.tsx`, `shared/moduleTypes.ts` | `app/App.tsx` | — |
| `app/pages/SettingsPage.tsx` | 176 | `app/i18n.ts`, `shared/api/core.ts`, `shared/api/launcher.ts`, `shared/api/types.ts`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx` | `app/App.tsx` | — |
| `app/pages/StartPage.tsx` | 892 | `app/ProjectProvider.tsx`, `app/ThemeToggle.tsx`, `app/i18n.ts`, `shared/api/client.ts`, `shared/api/core.ts`, `shared/api/launcher.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx` | `app/App.tsx` | — |
| `app/theme.ts` | 54 | — | `app/main.tsx` | `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/liquefaction/__tests__/results.test.tsx`, `modules/sheet_pile/__tests__/sheet_pile.test.tsx` +25 |

#### `modules/anchored_wall`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/anchored_wall/Root.tsx` | 13 | `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | `modules/anchored_wall/manifest.ts` | — |
| `modules/anchored_wall/api.ts` | 35 | `modules/anchored_wall/types.ts`, `shared/api/http.ts` | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/components/AnalysisForm.tsx` | 307 | `modules/anchored_wall/api.ts`, `modules/anchored_wall/components/AnchorFields.tsx`, `modules/anchored_wall/components/NumField.tsx`, `modules/anchored_wall/format.ts`, `modules/anchored_wall/inputs.ts`, `modules/anchored_wall/types.ts`, `shared/api/core.ts`, `shared/api/types.ts`, `shared/components/CollapsibleSection.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/FieldNote.tsx`, `shared/components/SectionCard.tsx`, `shared/components/ToggleRow.tsx` | `modules/anchored_wall/pages/AnalysisPage.tsx` | — |
| `modules/anchored_wall/components/AnchorFields.tsx` | 210 | `modules/anchored_wall/components/NumField.tsx`, `modules/anchored_wall/format.ts`, `modules/anchored_wall/inputs.ts`, `modules/anchored_wall/types.ts` | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/components/MissingList.tsx` | 27 | — | `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/components/Notices.tsx` | 91 | `modules/anchored_wall/types.ts`, `shared/api/client.ts` | `modules/anchored_wall/components/ResultViews.tsx`, `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/components/NumField.tsx` | 19 | `modules/anchored_wall/inputs.ts` | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/components/AnchorFields.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/components/ResultViews.tsx` | 248 | `modules/anchored_wall/components/Notices.tsx`, `modules/anchored_wall/components/WallSection.tsx`, `modules/anchored_wall/format.ts`, `modules/anchored_wall/types.ts`, `shared/components/DisclosureRow.tsx`, `shared/components/KpiTile.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx` | `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/components/WallSection.tsx` | 135 | `modules/anchored_wall/format.ts`, `modules/anchored_wall/types.ts` | `modules/anchored_wall/components/ResultViews.tsx` | — |
| `modules/anchored_wall/format.ts` | 8 | `app/i18n.ts` | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/components/AnchorFields.tsx`, `modules/anchored_wall/components/ResultViews.tsx`, `modules/anchored_wall/components/WallSection.tsx` | — |
| `modules/anchored_wall/inputs.ts` | 370 | `modules/anchored_wall/types.ts` | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/components/AnchorFields.tsx`, `modules/anchored_wall/components/NumField.tsx`, `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` | — |
| `modules/anchored_wall/manifest.ts` | 18 | `modules/anchored_wall/Root.tsx`, `shared/moduleTypes.ts` | — | — |
| `modules/anchored_wall/mock.ts` | 214 | `modules/anchored_wall/types.ts`, `shared/api/mock/core.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/hash.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts` | — | `modules/anchored_wall/__tests__/anchored_wall.test.tsx` |
| `modules/anchored_wall/pages/AnalysisPage.tsx` | 134 | `modules/anchored_wall/api.ts`, `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/components/MissingList.tsx`, `modules/anchored_wall/components/Notices.tsx`, `modules/anchored_wall/components/ResultViews.tsx`, `modules/anchored_wall/inputs.ts`, `modules/anchored_wall/types.ts`, `shared/components/ActionBar.tsx`, `shared/components/DisclosureRow.tsx`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/StatusChip.tsx`, `shared/components/VerdictBanner.tsx` | `modules/anchored_wall/Root.tsx` | `modules/anchored_wall/__tests__/anchored_wall.test.tsx` |
| `modules/anchored_wall/pages/AnchorPage.tsx` | 159 | `modules/anchored_wall/api.ts`, `modules/anchored_wall/components/AnchorFields.tsx`, `modules/anchored_wall/components/MissingList.tsx`, `modules/anchored_wall/components/Notices.tsx`, `modules/anchored_wall/components/NumField.tsx`, `modules/anchored_wall/components/ResultViews.tsx`, `modules/anchored_wall/inputs.ts`, `modules/anchored_wall/types.ts`, `shared/components/ActionBar.tsx`, `shared/components/DisclosureRow.tsx`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/components/VerdictBanner.tsx` | `modules/anchored_wall/Root.tsx` | `modules/anchored_wall/__tests__/anchored_wall.test.tsx` |
| `modules/anchored_wall/types.ts` | 16 | — | `modules/anchored_wall/api.ts`, `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/components/AnchorFields.tsx`, `modules/anchored_wall/components/Notices.tsx`, `modules/anchored_wall/components/ResultViews.tsx` +5 | — |

#### `modules/education`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/education/Root.tsx` | 15 | `modules/education/pages/GalleryPage.tsx`, `modules/education/pages/HomePage.tsx`, `modules/education/pages/TopicPage.tsx` | `modules/education/manifest.ts` | `modules/education/__tests__/education.test.tsx` |
| `modules/education/content/anchored_wall.ts` | 305 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/anchored_wall_student.ts` | 409 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/anchors.ts` | 181 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/anchors_student.ts` | 369 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/bearing.ts` | 162 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/bearing_student.ts` | 563 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/classification.ts` | 151 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/classification_student.ts` | 360 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/earth_pressure.ts` | 207 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/ep_student_a.ts` | 347 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/ep_student_b.ts` | 313 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/ground_anchors.ts` | 220 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/ground_anchors_student.ts` | 414 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/index.ts` | 43 | `modules/education/content/anchored_wall.ts`, `modules/education/content/anchored_wall_student.ts`, `modules/education/content/anchors.ts`, `modules/education/content/anchors_student.ts`, `modules/education/content/bearing.ts`, `modules/education/content/bearing_student.ts`, `modules/education/content/classification.ts`, `modules/education/content/classification_student.ts`, `modules/education/content/earth_pressure.ts`, `modules/education/content/ep_student_a.ts`, `modules/education/content/ep_student_b.ts`, `modules/education/content/ground_anchors.ts`, `modules/education/content/ground_anchors_student.ts`, `modules/education/content/liquefaction.ts`, `modules/education/content/liquefaction_student.ts`, `modules/education/content/shear_key.ts`, `modules/education/content/shear_key_student.ts`, `modules/education/content/sheet_pile.ts`, `modules/education/content/sheet_pile_student.ts`, `modules/education/content/slope.ts`, `modules/education/content/slope_student.ts`, `modules/education/content/sloping_surcharge.ts`, `modules/education/content/sloping_surcharge_student.ts`, `modules/education/content/types.ts` | `modules/education/pages/HomePage.tsx`, `modules/education/pages/TopicPage.tsx` | `modules/education/__tests__/education.test.tsx`, `modules/education/__tests__/math.test.tsx` |
| `modules/education/content/liquefaction.ts` | 148 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/liquefaction_student.ts` | 476 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/shear_key.ts` | 224 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/shear_key_student.ts` | 401 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/sheet_pile.ts` | 228 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/sheet_pile_student.ts` | 459 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/slope.ts` | 187 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/slope_student.ts` | 362 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/sloping_surcharge.ts` | 203 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/sloping_surcharge_student.ts` | 381 | `modules/education/content/types.ts` | `modules/education/content/index.ts` | — |
| `modules/education/content/types.ts` | 43 | — | `modules/education/content/anchored_wall.ts`, `modules/education/content/anchored_wall_student.ts`, `modules/education/content/anchors.ts`, `modules/education/content/anchors_student.ts`, `modules/education/content/bearing.ts` +20 | `modules/education/__tests__/math.test.tsx` |
| `modules/education/figures/bearDraw.tsx` | 398 | `modules/education/figures/kit.tsx` | `modules/education/figures/index.tsx` | — |
| `modules/education/figures/epDraw.tsx` | 311 | `modules/education/figures/kit.tsx` | `modules/education/figures/index.tsx` | — |
| `modules/education/figures/extraDraw.tsx` | 481 | `modules/education/figures/kit.tsx` | `modules/education/figures/index.tsx` | — |
| `modules/education/figures/extraDraw2.tsx` | 248 | `modules/education/figures/kit.tsx` | `modules/education/figures/index.tsx` | — |
| `modules/education/figures/index.tsx` | 51 | `modules/education/figures/bearDraw.tsx`, `modules/education/figures/epDraw.tsx`, `modules/education/figures/extraDraw.tsx`, `modules/education/figures/extraDraw2.tsx`, `modules/education/figures/spDraw.tsx` | `modules/education/pages/GalleryPage.tsx`, `modules/education/pages/TopicPage.tsx` | `modules/education/__tests__/education.test.tsx` |
| `modules/education/figures/kit.tsx` | 207 | `modules/education/figures/labels.ts` | `modules/education/figures/bearDraw.tsx`, `modules/education/figures/epDraw.tsx`, `modules/education/figures/extraDraw.tsx`, `modules/education/figures/extraDraw2.tsx`, `modules/education/figures/spDraw.tsx` | — |
| `modules/education/figures/labels.ts` | 207 | — | `modules/education/figures/kit.tsx` | — |
| `modules/education/figures/spDraw.tsx` | 412 | `modules/education/figures/kit.tsx` | `modules/education/figures/index.tsx` | — |
| `modules/education/manifest.ts` | 14 | `modules/education/Root.tsx`, `shared/moduleTypes.ts` | — | — |
| `modules/education/math/Formula.tsx` | 40 | `modules/education/math/toTex.ts` | `modules/education/pages/TopicPage.tsx` | — |
| `modules/education/math/toTex.ts` | 88 | — | `modules/education/math/Formula.tsx` | `modules/education/__tests__/math.test.tsx` |
| `modules/education/pages/GalleryPage.tsx` | 20 | `modules/education/figures/index.tsx`, `shared/components/PageHeader.tsx` | `modules/education/Root.tsx` | — |
| `modules/education/pages/HomePage.tsx` | 26 | `modules/education/content/index.ts`, `shared/components/PageHeader.tsx`, `shared/components/StatusChip.tsx` | `modules/education/Root.tsx` | — |
| `modules/education/pages/TopicPage.tsx` | 172 | `modules/education/content/index.ts`, `modules/education/content/types.ts`, `modules/education/figures/index.tsx`, `modules/education/math/Formula.tsx`, `shared/components/PageHeader.tsx`, `shared/components/StatusChip.tsx` | `modules/education/Root.tsx` | — |

#### `modules/liquefaction`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/liquefaction/Root.tsx` | 13 | `modules/liquefaction/pages/AnalysisPage.tsx`, `modules/liquefaction/pages/ResultsPage.tsx` | `modules/liquefaction/manifest.ts` | `modules/liquefaction/__tests__/liquefaction.test.tsx` |
| `modules/liquefaction/api.ts` | 13 | `shared/api/http.ts`, `shared/api/types.ts` | `modules/liquefaction/pages/AnalysisPage.tsx`, `modules/liquefaction/pages/ResultsPage.tsx` | `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/liquefaction/__tests__/results.test.tsx`, `test/module_paths.test.ts` |
| `modules/liquefaction/components/DepthChart.tsx` | 113 | — | `modules/liquefaction/components/SoundingDetail.tsx` | `modules/liquefaction/__tests__/results.test.tsx` |
| `modules/liquefaction/components/SoundingDetail.tsx` | 98 | `modules/liquefaction/components/DepthChart.tsx`, `shared/api/types.ts`, `shared/components/CollapsibleSection.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/hooks/useWarningText.ts` | `modules/liquefaction/pages/ResultsPage.tsx` | — |
| `modules/liquefaction/manifest.ts` | 18 | `modules/liquefaction/Root.tsx`, `shared/moduleTypes.ts` | — | — |
| `modules/liquefaction/mock.ts` | 92 | `shared/api/mock/core.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts` | — | — |
| `modules/liquefaction/pages/AnalysisPage.tsx` | 385 | `modules/liquefaction/api.ts`, `shared/api/client.ts`, `shared/api/core.ts`, `shared/api/types.ts`, `shared/components/ActionBar.tsx`, `shared/components/CollapsibleSection.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/FieldNote.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx` | `modules/liquefaction/Root.tsx` | `modules/liquefaction/__tests__/liquefaction.test.tsx` |
| `modules/liquefaction/pages/ResultsPage.tsx` | 397 | `modules/liquefaction/api.ts`, `modules/liquefaction/components/SoundingDetail.tsx`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/KpiTile.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/components/VerdictBanner.tsx` | `modules/liquefaction/Root.tsx` | `modules/liquefaction/__tests__/results.test.tsx` |

#### `modules/report`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/report/Root.tsx` | 11 | `modules/report/pages/HomePage.tsx` | `modules/report/manifest.ts` | — |
| `modules/report/api.ts` | 18 | `shared/api/http.ts`, `shared/api/types.ts` | `modules/report/pages/HomePage.tsx` | `modules/report/__tests__/report.test.tsx` |
| `modules/report/manifest.ts` | 15 | `modules/report/Root.tsx`, `shared/moduleTypes.ts` | — | — |
| `modules/report/mock.ts` | 53 | `shared/api/mock/dispatcher.ts` | — | — |
| `modules/report/pages/HomePage.tsx` | 167 | `modules/report/api.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx` | `modules/report/Root.tsx` | `modules/report/__tests__/report.test.tsx` |

#### `modules/sheet_pile`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/sheet_pile/Root.tsx` | 15 | `modules/sheet_pile/pages/SheetPileCreatePage.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx`, `modules/sheet_pile/pages/SheetPileListPage.tsx` | `modules/sheet_pile/manifest.ts` | `modules/sheet_pile/__tests__/sheet_pile.test.tsx` |
| `modules/sheet_pile/api.ts` | 6 | `shared/api/http.ts`, `shared/api/types.ts` | `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | — |
| `modules/sheet_pile/components/InputsForm.tsx` | 142 | `modules/sheet_pile/inputs.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/CollapsibleSection.tsx`, `shared/components/SectionCard.tsx` | `modules/sheet_pile/pages/SheetPileCreatePage.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | — |
| `modules/sheet_pile/components/JobPanel.tsx` | 102 | `modules/sheet_pile/components/ResultPanel.tsx`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/ErrorAlert.tsx` | `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | — |
| `modules/sheet_pile/components/MissingList.tsx` | 32 | — | `modules/sheet_pile/pages/SheetPileCreatePage.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | — |
| `modules/sheet_pile/components/PileDiagrams.tsx` | 93 | `modules/sheet_pile/series.ts` | `modules/sheet_pile/components/ResultPanel.tsx` | — |
| `modules/sheet_pile/components/ResultPanel.tsx` | 180 | `app/i18n.ts`, `modules/sheet_pile/components/PileDiagrams.tsx`, `modules/sheet_pile/series.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/DisclosureRow.tsx`, `shared/components/KpiTile.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx` | `modules/sheet_pile/components/JobPanel.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | `modules/sheet_pile/__tests__/result-contract.test.tsx`, `modules/sheet_pile/__tests__/sheet_pile.test.tsx` |
| `modules/sheet_pile/components/SoilSourceForm.tsx` | 188 | `modules/sheet_pile/inputs.ts`, `shared/api/core.ts`, `shared/api/types.ts`, `shared/components/ErrorAlert.tsx` | `modules/sheet_pile/pages/SheetPileCreatePage.tsx` | — |
| `modules/sheet_pile/inputs.ts` | 218 | `shared/api/types.ts` | `modules/sheet_pile/components/InputsForm.tsx`, `modules/sheet_pile/components/SoilSourceForm.tsx`, `modules/sheet_pile/pages/SheetPileCreatePage.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | `modules/sheet_pile/__tests__/inputs.test.ts` |
| `modules/sheet_pile/manifest.ts` | 17 | `modules/sheet_pile/Root.tsx`, `shared/moduleTypes.ts` | — | `modules/sheet_pile/__tests__/sheet_pile.test.tsx` |
| `modules/sheet_pile/mock.ts` | 70 | `shared/api/mock/core.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts` | — | — |
| `modules/sheet_pile/pages/SheetPileCreatePage.tsx` | 63 | `modules/sheet_pile/components/InputsForm.tsx`, `modules/sheet_pile/components/MissingList.tsx`, `modules/sheet_pile/components/SoilSourceForm.tsx`, `modules/sheet_pile/inputs.ts`, `shared/api/client.ts`, `shared/components/ActionBar.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx` | `modules/sheet_pile/Root.tsx` | — |
| `modules/sheet_pile/pages/SheetPileDetailPage.tsx` | 365 | `modules/sheet_pile/api.ts`, `modules/sheet_pile/components/InputsForm.tsx`, `modules/sheet_pile/components/JobPanel.tsx`, `modules/sheet_pile/components/MissingList.tsx`, `modules/sheet_pile/components/ResultPanel.tsx`, `modules/sheet_pile/inputs.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/ActionBar.tsx`, `shared/components/CollapsibleSection.tsx`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/components/VerdictBanner.tsx`, `shared/hooks/usePreSaveHook.ts`, `shared/hooks/useProfileName.ts` | `modules/sheet_pile/Root.tsx` | — |
| `modules/sheet_pile/pages/SheetPileListPage.tsx` | 88 | `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/StatusChip.tsx` | `modules/sheet_pile/Root.tsx` | — |
| `modules/sheet_pile/series.ts` | 62 | — | `modules/sheet_pile/components/PileDiagrams.tsx`, `modules/sheet_pile/components/ResultPanel.tsx` | `modules/sheet_pile/__tests__/series.test.ts` |

#### `modules/soil`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/soil/Root.tsx` | 17 | `modules/soil/pages/ClassificationPage.tsx`, `modules/soil/pages/ParametersPage.tsx`, `modules/soil/pages/ProfilesPage.tsx`, `modules/soil/pages/SiteDataPage.tsx` | `modules/soil/manifest.ts` | — |
| `modules/soil/api.ts` | 230 | `modules/soil/types.ts`, `shared/api/http.ts`, `shared/api/types.ts` | `modules/soil/components/InvestigationEditor.tsx`, `modules/soil/components/LayerInventoryPanel.tsx`, `modules/soil/components/LayeringModal.tsx`, `modules/soil/components/WorkbookImportModal.tsx`, `modules/soil/pages/ClassificationPage.tsx` +3 | `modules/soil/__tests__/inventory_panel.test.tsx`, `modules/soil/__tests__/parameters_consistency.test.tsx`, `modules/soil/__tests__/soil.test.tsx` +3 |
| `modules/soil/classification/PlasticityChart.tsx` | 110 | `modules/soil/classification/geometry.ts`, `modules/soil/types.ts` | `modules/soil/pages/ClassificationPage.tsx` | `modules/soil/__tests__/classification.test.tsx` |
| `modules/soil/classification/SbtnChart.tsx` | 109 | `modules/soil/classification/geometry.ts`, `modules/soil/types.ts` | `modules/soil/pages/ClassificationPage.tsx` | `modules/soil/__tests__/classification.test.tsx` |
| `modules/soil/classification/geometry.ts` | 125 | — | `modules/soil/classification/PlasticityChart.tsx`, `modules/soil/classification/SbtnChart.tsx`, `modules/soil/pages/ClassificationPage.tsx` | `modules/soil/__tests__/classification.test.tsx` |
| `modules/soil/components/ErrorAlert.tsx` | 78 | `shared/api/client.ts`, `shared/api/errorMessage.ts` | `modules/soil/components/LayeringModal.tsx`, `modules/soil/pages/ClassificationPage.tsx`, `modules/soil/pages/ParametersPage.tsx` | `modules/soil/__tests__/source_link.test.tsx`, `test/error_alert.test.tsx` |
| `modules/soil/components/InvestigationEditor.tsx` | 216 | `modules/soil/api.ts`, `modules/soil/components/RecordTable.tsx`, `shared/api/types.ts`, `shared/components/ErrorAlert.tsx`, `shared/soil/uscs.ts` | `modules/soil/pages/SiteDataPage.tsx` | — |
| `modules/soil/components/LayerInventoryPanel.tsx` | 69 | `modules/soil/api.ts`, `modules/soil/types.ts` | `modules/soil/pages/ParametersPage.tsx` | `modules/soil/__tests__/inventory_panel.test.tsx` |
| `modules/soil/components/LayeringModal.tsx` | 650 | `modules/soil/api.ts`, `modules/soil/components/ErrorAlert.tsx`, `modules/soil/components/WarningList.tsx`, `modules/soil/latest.ts`, `modules/soil/types.ts`, `shared/api/types.ts` | `modules/soil/pages/ProfilesPage.tsx` | `modules/soil/__tests__/soil_layering_hsf.test.tsx`, `modules/soil/__tests__/soil_layering_params_ui.test.tsx` |
| `modules/soil/components/ParameterKeyCard.tsx` | 365 | `modules/soil/components/WarningList.tsx`, `modules/soil/parameterState.ts`, `modules/soil/units.ts`, `shared/api/types.ts` | `modules/soil/pages/ParametersPage.tsx` | `modules/soil/__tests__/parameters_no_data.test.tsx` |
| `modules/soil/components/RecordTable.tsx` | 107 | — | `modules/soil/components/InvestigationEditor.tsx` | — |
| `modules/soil/components/WarningList.tsx` | 19 | `modules/soil/useWarningText.ts` | `modules/soil/components/LayeringModal.tsx`, `modules/soil/components/ParameterKeyCard.tsx`, `modules/soil/components/WorkbookImportModal.tsx`, `modules/soil/pages/ClassificationPage.tsx` | — |
| `modules/soil/components/WorkbookImportModal.tsx` | 293 | `modules/soil/api.ts`, `modules/soil/components/WarningList.tsx`, `modules/soil/types.ts`, `shared/components/ErrorAlert.tsx` | `modules/soil/pages/SiteDataPage.tsx` | — |
| `modules/soil/latest.ts` | 21 | — | `modules/soil/components/LayeringModal.tsx`, `modules/soil/pages/ParametersPage.tsx` | `modules/soil/__tests__/parameters_consistency.test.tsx` |
| `modules/soil/manifest.ts` | 20 | `modules/soil/Root.tsx`, `shared/moduleTypes.ts` | — | — |
| `modules/soil/mock.ts` | 962 | `modules/soil/types.ts`, `shared/api/mock/data.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts`, `shared/soil/layerOps.ts` | — | `modules/soil/__tests__/soil_mock.test.ts` |
| `modules/soil/pages/ClassificationPage.tsx` | 470 | `modules/soil/api.ts`, `modules/soil/classification/PlasticityChart.tsx`, `modules/soil/classification/SbtnChart.tsx`, `modules/soil/classification/geometry.ts`, `modules/soil/components/ErrorAlert.tsx`, `modules/soil/components/WarningList.tsx`, `modules/soil/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/PageHeader.tsx` | `modules/soil/Root.tsx` | `modules/soil/__tests__/classification.test.tsx` |
| `modules/soil/pages/ParametersPage.tsx` | 527 | `modules/soil/api.ts`, `modules/soil/components/ErrorAlert.tsx`, `modules/soil/components/LayerInventoryPanel.tsx`, `modules/soil/components/ParameterKeyCard.tsx`, `modules/soil/latest.ts`, `modules/soil/parameterState.ts`, `modules/soil/types.ts`, `modules/soil/units.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/PageHeader.tsx`, `shared/hooks/useBeforeUnloadWarning.ts` | `modules/soil/Root.tsx` | `modules/soil/__tests__/parameters_consistency.test.tsx`, `modules/soil/__tests__/soil_layering_params_ui.test.tsx`, `modules/soil/__tests__/stale_reapprove.test.tsx` |
| `modules/soil/pages/ProfilesPage.tsx` | 522 | `modules/soil/api.ts`, `modules/soil/components/LayeringModal.tsx`, `modules/soil/types.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/components/VerdictBanner.tsx`, `shared/hooks/useBeforeUnloadWarning.ts`, `shared/hooks/useUndoable.ts`, `shared/soil/CommitInputs.tsx`, `shared/soil/GwtEditor.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/LayerLegend.tsx`, `shared/soil/SoilColumn.tsx`, `shared/soil/layerOps.ts`, `shared/soil/layerStatus.ts` | `modules/soil/Root.tsx` | `modules/soil/__tests__/soil.test.tsx` |
| `modules/soil/pages/SiteDataPage.tsx` | 407 | `modules/soil/api.ts`, `modules/soil/components/InvestigationEditor.tsx`, `modules/soil/components/WorkbookImportModal.tsx`, `modules/soil/types.ts`, `shared/api/client.ts`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx` | `modules/soil/Root.tsx` | `modules/soil/__tests__/site_import.test.tsx`, `modules/soil/__tests__/workbook_import.test.tsx` |
| `modules/soil/parameterState.ts` | 226 | `shared/api/types.ts` | `modules/soil/components/ParameterKeyCard.tsx`, `modules/soil/pages/ParametersPage.tsx` | `modules/soil/__tests__/parameterState.test.ts`, `modules/soil/__tests__/stale_reapprove.test.tsx` |
| `modules/soil/types.ts` | 158 | `shared/api/types.ts` | `modules/soil/api.ts`, `modules/soil/classification/PlasticityChart.tsx`, `modules/soil/classification/SbtnChart.tsx`, `modules/soil/components/LayerInventoryPanel.tsx`, `modules/soil/components/LayeringModal.tsx` +6 | `modules/soil/__tests__/classification.test.tsx`, `modules/soil/__tests__/inventory_panel.test.tsx` |
| `modules/soil/units.ts` | 30 | `shared/api/types.ts` | `modules/soil/components/ParameterKeyCard.tsx`, `modules/soil/pages/ParametersPage.tsx` | — |
| `modules/soil/useWarningText.ts` | 1 | `shared/hooks/useWarningText.ts` | `modules/soil/components/WarningList.tsx` | — |
| `modules/soil/warnings.ts` | 1 | `shared/warnings.ts` | — | `modules/soil/__tests__/warnings.test.ts` |

#### `modules/walls`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `modules/walls/Root.tsx` | 17 | `modules/walls/pages/AtRestPage.tsx`, `modules/walls/pages/WallListPage.tsx`, `modules/walls/pages/WallTypePicker.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/manifest.ts` | — |
| `modules/walls/api.ts` | 23 | `modules/walls/types.ts`, `shared/api/http.ts`, `shared/api/types.ts` | `modules/walls/pages/AtRestPage.tsx`, `modules/walls/pages/WallTypePicker.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/wall_wizard.test.tsx`, `test/app.test.tsx`, `test/module_paths.test.ts` +1 |
| `modules/walls/components/AnalysisOptionsForm.tsx` | 178 | `modules/walls/settings.ts`, `modules/walls/types.ts` | `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/analysis_options.test.tsx` |
| `modules/walls/components/AtRestDiagram.tsx` | 48 | `modules/walls/types.ts` | `modules/walls/pages/AtRestPage.tsx` | — |
| `modules/walls/components/DimensionField.tsx` | 48 | — | `modules/walls/pages/WallWizardPage.tsx` | — |
| `modules/walls/components/PermeabilityEditor.tsx` | 126 | `modules/walls/settings.ts`, `shared/api/types.ts`, `shared/soil/format.ts` | `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/permeability_editor.test.tsx` |
| `modules/walls/components/ShearKeyFields.tsx` | 65 | `shared/api/types.ts`, `shared/components/FieldNote.tsx` | `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/shear_key.test.tsx` |
| `modules/walls/components/ShearKeyResult.tsx` | 62 | `modules/walls/labels.ts`, `shared/api/types.ts` | `modules/walls/components/WallResultView.tsx` | `modules/walls/__tests__/shear_key.test.tsx` |
| `modules/walls/components/WallCheckCards.tsx` | 177 | `modules/walls/labels.ts`, `shared/api/types.ts`, `shared/utils/utilisation.ts` | `modules/walls/components/WallChecksTable.tsx`, `modules/walls/components/WallResultView.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/check_cards.test.tsx` |
| `modules/walls/components/WallChecksTable.tsx` | 130 | `modules/walls/components/WallCheckCards.tsx`, `modules/walls/labels.ts`, `shared/api/types.ts` | `modules/walls/components/WallResultView.tsx` | — |
| `modules/walls/components/WallCrossSection.tsx` | 285 | `modules/walls/components/sectionLayout.ts`, `shared/soil/SoilPatternDefs.tsx`, `shared/soil/axis.ts`, `shared/soil/format.ts`, `shared/soil/soilStyle.ts` | `modules/walls/components/WallResultView.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/wall_section.test.tsx` |
| `modules/walls/components/WallResultView.tsx` | 275 | `modules/walls/components/ShearKeyResult.tsx`, `modules/walls/components/WallCheckCards.tsx`, `modules/walls/components/WallChecksTable.tsx`, `modules/walls/components/WallCrossSection.tsx`, `modules/walls/labels.ts`, `shared/api/types.ts`, `shared/components/DisclosureRow.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/components/VerdictBanner.tsx`, `shared/hooks/useAssumptionText.ts`, `shared/hooks/useWarningText.ts` | `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/check_cards.test.tsx` |
| `modules/walls/components/WizardStepBar.tsx` | 80 | — | `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/step_bar.test.tsx` |
| `modules/walls/components/sectionLayout.ts` | 351 | `shared/api/types.ts`, `shared/soil/zones.ts` | `modules/walls/components/WallCrossSection.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/shear_key.test.tsx`, `modules/walls/__tests__/wall_section.test.tsx` |
| `modules/walls/labels.ts` | 153 | `shared/api/types.ts` | `modules/walls/components/ShearKeyResult.tsx`, `modules/walls/components/WallCheckCards.tsx`, `modules/walls/components/WallChecksTable.tsx`, `modules/walls/components/WallResultView.tsx` | `modules/walls/__tests__/labels.test.ts` |
| `modules/walls/manifest.ts` | 18 | `modules/walls/Root.tsx`, `shared/moduleTypes.ts` | — | `modules/walls/__tests__/wall_picker.test.tsx` |
| `modules/walls/mock.ts` | 298 | `modules/walls/settings.ts`, `modules/walls/types.ts`, `shared/api/mock/data.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts` | — | `modules/walls/__tests__/wall_wizard.test.tsx` |
| `modules/walls/pages/AtRestPage.tsx` | 170 | `modules/walls/api.ts`, `modules/walls/components/AtRestDiagram.tsx`, `modules/walls/types.ts`, `shared/api/core.ts`, `shared/api/types.ts`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx` | `modules/walls/Root.tsx` | `modules/walls/__tests__/at_rest_page.test.tsx` |
| `modules/walls/pages/WallListPage.tsx` | 92 | `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/EmptyState.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx` | `modules/walls/Root.tsx` | `modules/walls/__tests__/wall_picker.test.tsx` |
| `modules/walls/pages/WallTypePicker.tsx` | 383 | `modules/walls/api.ts`, `shared/api/client.ts`, `shared/api/core.ts`, `shared/api/types.ts`, `shared/components/ActionBar.tsx`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/soil/CommitInputs.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/layerOps.ts` | `modules/walls/Root.tsx` | `modules/walls/__tests__/wall_picker.test.tsx` |
| `modules/walls/pages/WallWizardPage.tsx` | 938 | `modules/walls/api.ts`, `modules/walls/components/AnalysisOptionsForm.tsx`, `modules/walls/components/DimensionField.tsx`, `modules/walls/components/PermeabilityEditor.tsx`, `modules/walls/components/ShearKeyFields.tsx`, `modules/walls/components/WallCheckCards.tsx`, `modules/walls/components/WallCrossSection.tsx`, `modules/walls/components/WallResultView.tsx`, `modules/walls/components/WizardStepBar.tsx`, `modules/walls/components/sectionLayout.ts`, `modules/walls/settings.ts`, `modules/walls/types.ts`, `shared/api/client.ts`, `shared/api/types.ts`, `shared/components/ActionBar.tsx`, `shared/components/CollapsibleSection.tsx`, `shared/components/EmptyState.tsx`, `shared/components/ErrorAlert.tsx`, `shared/components/FieldNote.tsx`, `shared/components/MissingFactorsForm.tsx`, `shared/components/PageHeader.tsx`, `shared/components/SectionCard.tsx`, `shared/components/StatusChip.tsx`, `shared/components/ToggleRow.tsx`, `shared/components/VerdictBanner.tsx`, `shared/hooks/useJob.ts`, `shared/hooks/usePreSaveHook.ts`, `shared/hooks/useUndoable.ts`, `shared/soil/layerOps.ts`, `shared/soil/zones.ts`, `shared/structureSoil/StructureSoilStep.tsx` | `modules/walls/Root.tsx` | `modules/walls/__tests__/wall_picker.test.tsx`, `modules/walls/__tests__/wall_wizard.test.tsx`, `modules/walls/__tests__/wall_wizard_flow.test.tsx` +1 |
| `modules/walls/settings.ts` | 70 | `modules/walls/types.ts`, `shared/api/types.ts`, `shared/soil/zones.ts` | `modules/walls/components/AnalysisOptionsForm.tsx`, `modules/walls/components/PermeabilityEditor.tsx`, `modules/walls/mock.ts`, `modules/walls/pages/WallWizardPage.tsx` | `modules/walls/__tests__/analysis_options.test.tsx`, `modules/walls/__tests__/permeability_editor.test.tsx`, `modules/walls/__tests__/settings.test.ts` |
| `modules/walls/types.ts` | 33 | `shared/api/types.ts` | `modules/walls/api.ts`, `modules/walls/components/AnalysisOptionsForm.tsx`, `modules/walls/components/AtRestDiagram.tsx`, `modules/walls/mock.ts`, `modules/walls/pages/AtRestPage.tsx` +2 | `modules/walls/__tests__/analysis_options.test.tsx`, `modules/walls/__tests__/wall_wizard_flow.test.tsx` |

#### `shared`

| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |
|---|---:|---|---|---|
| `shared/api/client.ts` | 136 | `shared/api/http.ts`, `shared/api/types.ts` | `app/ProjectProvider.tsx`, `app/i18n.ts`, `app/pages/LauncherPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/components/Notices.tsx` +19 | `modules/anchored_wall/__tests__/anchored_wall.test.tsx`, `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/liquefaction/__tests__/results.test.tsx` +25 |
| `shared/api/core.ts` | 92 | `shared/api/http.ts`, `shared/api/types.ts` | `app/AppChrome.tsx`, `app/ProjectProvider.tsx`, `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/components/AnalysisForm.tsx` +5 | `modules/liquefaction/__tests__/liquefaction.test.tsx`, `test/shell.test.tsx`, `test/shell_mock.test.ts` +1 |
| `shared/api/errorMessage.ts` | 32 | `shared/api/client.ts` | `modules/soil/components/ErrorAlert.tsx`, `shared/components/ErrorAlert.tsx` | `shared/api/errorMessage.test.ts`, `test/error_alert.test.tsx` |
| `shared/api/http.ts` | 243 | `shared/api/mock/index.ts`, `shared/api/types.ts` | `app/AppChrome.tsx`, `app/ProjectProvider.tsx`, `modules/anchored_wall/api.ts`, `modules/liquefaction/api.ts`, `modules/report/api.ts` +5 | `modules/walls/__tests__/wall_wizard_inputs.test.tsx`, `test/app_chrome.test.tsx`, `test/shell_mock.test.ts` |
| `shared/api/launcher.ts` | 25 | — | `app/pages/LauncherPage.tsx`, `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx` | — |
| `shared/api/mock/core.ts` | 244 | `shared/api/mock/data.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts` | `modules/anchored_wall/mock.ts`, `modules/liquefaction/mock.ts`, `modules/sheet_pile/mock.ts`, `shared/api/mock/index.ts` | `modules/anchored_wall/__tests__/anchored_wall.test.tsx`, `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/sheet_pile/__tests__/sheet_pile.test.tsx` |
| `shared/api/mock/coreRoutes.ts` | 515 | `shared/api/mock/data.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/hash.ts`, `shared/api/mock/store.ts`, `shared/api/types.ts`, `shared/soil/layerOps.ts` | `shared/api/mock/index.ts` | — |
| `shared/api/mock/data.ts` | 595 | `shared/api/types.ts` | `modules/soil/mock.ts`, `modules/walls/mock.ts`, `shared/api/mock/core.ts`, `shared/api/mock/coreRoutes.ts`, `shared/api/mock/store.ts` | — |
| `shared/api/mock/dispatcher.ts` | 28 | — | `modules/anchored_wall/mock.ts`, `modules/liquefaction/mock.ts`, `modules/report/mock.ts`, `modules/sheet_pile/mock.ts`, `modules/soil/mock.ts` +4 | `modules/walls/__tests__/wall_wizard.test.tsx` |
| `shared/api/mock/hash.ts` | 36 | `shared/api/types.ts` | `modules/anchored_wall/mock.ts`, `shared/api/mock/coreRoutes.ts`, `shared/api/mock/store.ts` | `modules/sheet_pile/__tests__/sheet_pile.test.tsx` |
| `shared/api/mock/index.ts` | 26 | `shared/api/mock/core.ts`, `shared/api/mock/coreRoutes.ts`, `shared/api/mock/dispatcher.ts`, `shared/api/mock/store.ts` | `shared/api/http.ts` | `modules/anchored_wall/__tests__/anchored_wall.test.tsx`, `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/sheet_pile/__tests__/sheet_pile.test.tsx` +19 |
| `shared/api/mock/store.ts` | 149 | `shared/api/mock/data.ts`, `shared/api/mock/hash.ts`, `shared/api/types.ts` | `modules/anchored_wall/mock.ts`, `modules/liquefaction/mock.ts`, `modules/sheet_pile/mock.ts`, `modules/soil/mock.ts`, `modules/walls/mock.ts` +3 | `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/sheet_pile/__tests__/sheet_pile.test.tsx`, `modules/soil/__tests__/soil_mock.test.ts` +4 |
| `shared/api/schema.d.ts` | 13564 | — | — | — |
| `shared/api/types.ts` | 864 | — | `app/ProjectProvider.tsx`, `app/ViewMenu.tsx`, `app/i18n.ts`, `app/launcherModel.ts`, `app/pages/LauncherPage.tsx` +68 | `modules/liquefaction/__tests__/liquefaction.test.tsx`, `modules/liquefaction/__tests__/results.test.tsx`, `modules/sheet_pile/__tests__/result-contract.test.tsx` +20 |
| `shared/components/ActionBar.tsx` | 33 | `shared/components/StatusChip.tsx` | `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx`, `modules/liquefaction/pages/AnalysisPage.tsx`, `modules/sheet_pile/pages/SheetPileCreatePage.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx` +2 | `test/shared_components.test.tsx` |
| `shared/components/CollapsibleSection.tsx` | 28 | — | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/liquefaction/components/SoundingDetail.tsx`, `modules/liquefaction/pages/AnalysisPage.tsx`, `modules/sheet_pile/components/InputsForm.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx` +1 | `test/shared_components.test.tsx` |
| `shared/components/DisclosureRow.tsx` | 53 | — | `modules/anchored_wall/components/ResultViews.tsx`, `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx`, `modules/sheet_pile/components/ResultPanel.tsx`, `modules/walls/components/WallResultView.tsx` | — |
| `shared/components/EmptyState.tsx` | 26 | — | `app/ModuleShell.tsx`, `app/pages/LauncherPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` +11 | — |
| `shared/components/ErrorAlert.tsx` | 36 | `shared/api/errorMessage.ts` | `app/ModuleShell.tsx`, `app/RequireProject.tsx`, `app/pages/LauncherPage.tsx`, `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx` +17 | `test/error_alert.test.tsx` |
| `shared/components/FieldNote.tsx` | 25 | — | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/liquefaction/pages/AnalysisPage.tsx`, `modules/walls/components/ShearKeyFields.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `test/shared_components.test.tsx` |
| `shared/components/KpiTile.tsx` | 25 | — | `modules/anchored_wall/components/ResultViews.tsx`, `modules/liquefaction/pages/ResultsPage.tsx`, `modules/sheet_pile/components/ResultPanel.tsx` | `test/shared_components.test.tsx` |
| `shared/components/MissingFactorsForm.tsx` | 116 | `shared/api/types.ts` | `modules/walls/pages/WallWizardPage.tsx` | `test/missing_factors_form.test.tsx` |
| `shared/components/PageHeader.tsx` | 39 | — | `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx`, `modules/education/pages/GalleryPage.tsx` +16 | `test/shared_components.test.tsx` |
| `shared/components/SectionCard.tsx` | 39 | — | `app/pages/SettingsPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/anchored_wall/components/ResultViews.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx` +15 | `test/shared_components.test.tsx` |
| `shared/components/StatusChip.tsx` | 53 | — | `app/ModuleShell.tsx`, `app/launcherModel.ts`, `app/pages/LauncherPage.tsx`, `app/pages/StartPage.tsx`, `modules/anchored_wall/components/ResultViews.tsx` +15 | `test/shared_components.test.tsx` |
| `shared/components/ToggleRow.tsx` | 18 | — | `modules/anchored_wall/components/AnalysisForm.tsx`, `modules/walls/pages/WallWizardPage.tsx` | — |
| `shared/components/VerdictBanner.tsx` | 40 | — | `modules/anchored_wall/pages/AnalysisPage.tsx`, `modules/anchored_wall/pages/AnchorPage.tsx`, `modules/liquefaction/pages/ResultsPage.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx`, `modules/soil/pages/ProfilesPage.tsx` +2 | `test/shared_components.test.tsx` |
| `shared/hooks/useAssumptionText.ts` | 31 | `shared/warnings.ts` | `modules/walls/components/WallResultView.tsx` | `test/assumption_text.test.tsx` |
| `shared/hooks/useBeforeUnloadWarning.ts` | 15 | — | `modules/soil/pages/ParametersPage.tsx`, `modules/soil/pages/ProfilesPage.tsx` | — |
| `shared/hooks/useJob.ts` | 191 | `shared/api/client.ts`, `shared/api/types.ts` | `modules/walls/pages/WallWizardPage.tsx` | `test/skeleton.test.tsx`, `test/use_job.test.tsx` |
| `shared/hooks/usePreSaveHook.ts` | 29 | — | `app/ModuleShell.tsx`, `modules/sheet_pile/pages/SheetPileDetailPage.tsx`, `modules/walls/pages/WallWizardPage.tsx` | `modules/sheet_pile/__tests__/sheet_pile.test.tsx`, `modules/walls/__tests__/wall_wizard_inputs.test.tsx`, `test/pre_save_hook.test.ts` |
| `shared/hooks/useProfileName.ts` | 38 | `shared/api/core.ts`, `shared/api/types.ts` | `modules/sheet_pile/pages/SheetPileDetailPage.tsx`, `shared/structureSoil/StructureSoilStep.tsx` | — |
| `shared/hooks/useUndoable.ts` | 85 | — | `modules/soil/pages/ProfilesPage.tsx`, `modules/walls/pages/WallWizardPage.tsx`, `shared/structureSoil/StructureSoilStep.tsx` | — |
| `shared/hooks/useWarningText.ts` | 13 | `shared/warnings.ts` | `modules/liquefaction/components/SoundingDetail.tsx`, `modules/soil/useWarningText.ts`, `modules/walls/components/WallResultView.tsx` | — |
| `shared/moduleTypes.ts` | 23 | — | `app/moduleRegistry.ts`, `app/pages/LauncherPage.tsx`, `modules/anchored_wall/manifest.ts`, `modules/education/manifest.ts`, `modules/liquefaction/manifest.ts` +4 | `test/shell.test.tsx` |
| `shared/soil/CommitInputs.tsx` | 154 | — | `modules/soil/pages/ProfilesPage.tsx`, `modules/walls/pages/WallTypePicker.tsx`, `shared/soil/GwtEditor.tsx`, `shared/soil/LayerEditor.tsx` | — |
| `shared/soil/GwtEditor.tsx` | 113 | `shared/api/types.ts`, `shared/soil/CommitInputs.tsx`, `shared/soil/GwtMarker.tsx`, `shared/soil/zones.ts` | `modules/soil/pages/ProfilesPage.tsx`, `shared/structureSoil/StructureSoilStep.tsx` | — |
| `shared/soil/GwtMarker.tsx` | 47 | `shared/soil/zones.ts` | `shared/soil/GwtEditor.tsx`, `shared/soil/LayerLegend.tsx`, `shared/soil/SoilColumn.tsx`, `shared/structureSoil/StructureSoilSection.tsx` | — |
| `shared/soil/LayerEditor.tsx` | 592 | `shared/api/types.ts`, `shared/soil/CommitInputs.tsx`, `shared/soil/SoilPatternDefs.tsx`, `shared/soil/format.ts`, `shared/soil/layerOps.ts`, `shared/soil/layerStatus.ts`, `shared/soil/soilStyle.ts`, `shared/soil/uscs.ts` | `modules/soil/pages/ProfilesPage.tsx`, `modules/walls/pages/WallTypePicker.tsx`, `shared/structureSoil/StructureSoilStep.tsx` | `modules/soil/__tests__/layer_gamma_sat.test.tsx` |
| `shared/soil/LayerLegend.tsx` | 49 | `shared/api/types.ts`, `shared/soil/GwtMarker.tsx`, `shared/soil/SoilPatternDefs.tsx`, `shared/soil/soilStyle.ts` | `modules/soil/pages/ProfilesPage.tsx`, `shared/structureSoil/StructureSoilStep.tsx` | — |
| `shared/soil/SoilColumn.tsx` | 243 | `shared/api/types.ts`, `shared/soil/GwtMarker.tsx`, `shared/soil/SoilPatternDefs.tsx`, `shared/soil/axis.ts`, `shared/soil/format.ts`, `shared/soil/soilStyle.ts`, `shared/soil/zones.ts` | `modules/soil/pages/ProfilesPage.tsx` | — |
| `shared/soil/SoilPatternDefs.tsx` | 156 | `shared/soil/soilStyle.ts` | `modules/walls/components/WallCrossSection.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/LayerLegend.tsx`, `shared/soil/SoilColumn.tsx`, `shared/structureSoil/StructureSoilSection.tsx` | — |
| `shared/soil/axis.ts` | 54 | — | `modules/walls/components/WallCrossSection.tsx`, `shared/soil/SoilColumn.tsx`, `shared/structureSoil/StructureSoilSection.tsx` | `modules/soil/__tests__/soil.test.tsx` |
| `shared/soil/format.ts` | 27 | `shared/api/types.ts` | `modules/walls/components/PermeabilityEditor.tsx`, `modules/walls/components/WallCrossSection.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/SoilColumn.tsx`, `shared/structureSoil/StructureSoilSection.tsx` | `shared/api/errorMessage.test.ts` |
| `shared/soil/layerOps.ts` | 442 | `shared/api/types.ts` | `modules/soil/mock.ts`, `modules/soil/pages/ProfilesPage.tsx`, `modules/walls/pages/WallTypePicker.tsx`, `modules/walls/pages/WallWizardPage.tsx`, `shared/api/mock/coreRoutes.ts` +3 | `modules/soil/__tests__/soil.test.tsx` |
| `shared/soil/layerStatus.ts` | 81 | `shared/api/types.ts` | `modules/soil/pages/ProfilesPage.tsx`, `shared/soil/LayerEditor.tsx` | `modules/soil/__tests__/soil.test.tsx` |
| `shared/soil/soilStyle.ts` | 185 | `shared/api/types.ts`, `shared/soil/uscs.ts` | `modules/walls/components/WallCrossSection.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/LayerLegend.tsx`, `shared/soil/SoilColumn.tsx`, `shared/soil/SoilPatternDefs.tsx` +1 | `modules/soil/__tests__/soil.test.tsx` |
| `shared/soil/uscs.ts` | 45 | — | `modules/soil/components/InvestigationEditor.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/soilStyle.ts` | — |
| `shared/soil/zones.ts` | 100 | `shared/api/types.ts`, `shared/soil/layerOps.ts` | `modules/walls/components/sectionLayout.ts`, `modules/walls/pages/WallWizardPage.tsx`, `modules/walls/settings.ts`, `shared/soil/GwtEditor.tsx`, `shared/soil/GwtMarker.tsx` +3 | `modules/soil/__tests__/soil.test.tsx` |
| `shared/structureSoil/StructureSoilSection.tsx` | 829 | `shared/api/types.ts`, `shared/soil/GwtMarker.tsx`, `shared/soil/SoilPatternDefs.tsx`, `shared/soil/axis.ts`, `shared/soil/format.ts`, `shared/soil/soilStyle.ts`, `shared/soil/zones.ts` | `shared/structureSoil/StructureSoilStep.tsx` | — |
| `shared/structureSoil/StructureSoilStep.tsx` | 434 | `shared/api/client.ts`, `shared/api/types.ts`, `shared/hooks/useProfileName.ts`, `shared/hooks/useUndoable.ts`, `shared/soil/GwtEditor.tsx`, `shared/soil/LayerEditor.tsx`, `shared/soil/LayerLegend.tsx`, `shared/soil/layerOps.ts`, `shared/soil/zones.ts`, `shared/structureSoil/StructureSoilSection.tsx` | `modules/walls/pages/WallWizardPage.tsx` | — |
| `shared/utils/utilisation.ts` | 21 | — | `modules/walls/components/WallCheckCards.tsx` | `test/app.test.tsx`, `test/skeleton.test.tsx` |
| `shared/warnings.ts` | 99 | — | `modules/soil/warnings.ts`, `shared/hooks/useAssumptionText.ts`, `shared/hooks/useWarningText.ts` | — |
