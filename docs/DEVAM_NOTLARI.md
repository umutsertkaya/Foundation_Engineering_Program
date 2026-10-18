# GeoTek v2: devam notları

Son güncelleme: 2026-10-18. Kapı 2 ve yapı kapısı Y1 onaylandı. Modüler yeniden yapılanma `restructure/modules` dalında sürüyor. M1 ve Y2 tamam (Y2 onayı 2026-10-18). M2 ve **M3 tamam.** Sıradaki: M4 (palplanş) ve M5 (sıvılaşma), birbirinden bağımsız. Yeni oturum prompt'u: `docs/DEVAM_PROMPT.md`.

Yönergeler:
- Orkestra yönergesi: `docs/ORKESTRA_PROMPT.md`.
- Sözleşmeler: `docs/contracts/P1_CONTRACTS.md`.
- Formüller: `docs/contracts/E4_FORMULAS.md`.

## Durum

| Paket | Durum |
|---|---|
| P0 Git + bağımlılıklar | Tamam |
| P1 sözleşmeler | Tamam, kullanıcı onayladı (kapı 1) |
| E1 model + göç 1.2 | Tamam |
| F1 web iskeleti | Tamam. Kapı 3 **onaylanmadı**; kullanıcı zemin yönetimini istedi, bkz. "Zemin arayüzü" |
| Zemin arayüzü (F3'ün öne çekilen kısmı) | Tamam: zemin kolonu ve desenler, katman editörü, profil ana-detay ekranı, duvar Zemin adımında bölgeli kesit. Ekran görüntüleri `docs/qa/soil/`. Kullanıcının görsel onayı bekleniyor |
| E4 katmanlı duvar motoru | Tamam: chunk C dahil (620 pytest, 35 web testi, typecheck geçiyor). Kapı 2 kullanıcı tarafından onaylandı (2026-10-17) |
| Modüler yapı (başlangıç ekranı → ana menü → modüller) | C0–C6, W1–W4 tamam (`restructure/modules` dalı). Başlangıç/kütüphane, ana menü, 4 modül kabuğu, gerçek oturum+kütüphane API'si, şema 1.3, modül i18n parçaları. İncelemeler (gpt-6-astra backend, Opus web, Sonnet görsel QA) düzeltildi. 827 pytest, 69 web testi. Ekranlar `docs/qa/shell/`. Yapı kapısı Y1 onaylandı (2026-10-17). M1 tamam (2026-10-18): zemin sayfaları, `/m/soil` istemcisi, DTO'lar ve mock `web/src/modules/soil/` altında; Opus incelemesi (yalnız P3) düzeltildi; 75 web testi; ekranlar `docs/qa/soil_module/`. Y2 onaylandı. M2 tamam: `modules/walls` (WallListPage, WallTypePicker, WallWizardPage, api, mock); Opus incelemesi düzeltildi; 81 web testi; ekranlar `docs/qa/walls_module/`. M3 tamam: çekirdek `GET /api/data/profiles`, `no_soil_source` sözleşmesi (409; backend `POST /structures` A1'de), seçicide zemin kaynağı (profilden kopyala / elle gir); gpt-6-astra incelemesi düzeltildi; 91 web testi, 829 pytest; ekranlar `docs/qa/walls_manual_soil/`. Plan `docs/plans/MODULER_YAPI.md`, sözleşme `docs/contracts/CORE_SHELL_API.md` |
| E2, E3, A1, F2, F4–F6, T1, Q1, K1, D1 | Başlamadı |

## M1 sonrası açık noktalar

- Mock'ta `/m/soil/cpts/*/processed`, `boreholes/*/processed` ve `layering/*` hiç yoktu; 501 döner (E2/E3/A1 ile gelecek).
- M2 sonrası: sonuç ekranında ham kimlikler görünüyor (`seismic:bearing`, `ASD-static.resistance.overturning`) → i18n etiketleri F4'te.
- Sihirbaz adım çubuğu 800 px'de "Sonuç" etiketini kırpıyor (kozmetik).
- `ModuleShell` `matchPrefixes` vurgusunun render testi yok.
- Depoda satır sonları karışık (LF/CRLF); `.gitattributes` yok. X3'te ele alınabilir.
- Katman tablosu 800 px genişlikte yatay kayıyor (kozmetik).

## M1 (zemin modülü), tamamlandı

Plan: `docs/plans/MODULER_YAPI.md`, "İş parçaları" tablosu. Mevcut durum: `web/src/modules/soil/` içinde yalnız `manifest.ts` ve `Root.tsx` var; her yan menü öğesi bir yer tutucu `EmptyState` gösteriyor. Eski sayfalar hiçbir rotaya bağlı değil ve `web/src/pages/` altında duruyor.

1. Sayfaları taşı:
   - `web/src/pages/SiteDataPage.tsx` → `web/src/modules/soil/pages/SiteDataPage.tsx`; yan menüde `""` (Arazi verileri).
   - `web/src/pages/SoilModelsPage.tsx` → `web/src/modules/soil/pages/ProfilesPage.tsx`; yan menüde `profiles` (Zemin profilleri).
   - "Mühendislik parametreleri" ve "Sınıflandırma" şimdilik yer tutucu kalır. E2/E3 ile dolacak.
   - Taşırken `git mv` kullan.
2. Zemine ait istemci kodunu ayır:
   - `shared/api/client.ts` içindeki zemin sarmalayıcıları (`/m/soil/...`) → `modules/soil/api.ts`.
   - Zemine ait DTO'lar → `modules/soil/types.ts`. Duvar modülünün de kullandığı tipler (SoilProfile, SoilLayer vb.) `shared/api/types.ts` içinde kalır.
3. Zemin mock'unu ayır:
   - Legacy mock'taki zemin işleyicileri → `modules/soil/mock.ts`.
   - Kayıt `registerMockHandlers("/m/soil", …)` ile ve legacy'den önce yapılır.
   - Mock kaydı manifest'ten değil, `shared/api/mock` tarafındaki bir kayıt noktasından yapılır. Üretim paketine mock girmemeli (`http.ts` mock'u dinamik `import()` ile yüklüyor).
4. Testler: `web/src/test/soil.test.tsx` → `web/src/modules/soil/__tests__/`, importları güncelle.
5. Sınırlar:
   - `modules/soil` başka bir modülü içe aktarmaz.
   - `shared/` ve `app/`, `modules/`'u içe aktarmaz.
   - Duvarın zemin adımı `shared/structureSoil` ve `shared/soil` kullanmaya devam eder.
6. Doğrulama:
   - pytest (827+), `npm --prefix web run typecheck|test|build`.
   - `web-mock` önizlemesinde `/m/soil` ve `/m/soil/profiles` çalışıyor; profil oluştur, katman ekle, kaydet.
   - Ekran görüntüleri `docs/qa/soil_module/`.
7. Ardından **yapı kapısı Y2**: zemin modülü mock'ta uçtan uca çalışıyor; kullanıcıya ekran görüntüleriyle sunulur.

Y2'den sonra sırasıyla:
- M2: istinat duvarı. WallListPage, WallTypePicker (`GET /m/walls/wall-types`), WallWizardPage. `MOCK_CANTILEVER_5M` üretim bağımlılığı kesilir.
- M3: profilsiz elle zemin girişi.
- M4: palplanş.
- M5: sıvılaşma.
- X1: sınır ve manifest testleri.
- X2: `docs/MODULE_GUIDE.md` ve `tools/new_module.py`.
- X3: temizlik, yol haritasının yeniden hedeflenmesi, main'e birleştirme.

M2, M4 ve M5 paralel yürüyebilir; ortak dosyalara (`shared/api/client.ts`, legacy mock) dikkat edilmeli.

## Kapı 2'de kullanıcının verdiği kararlar

1. Su altı dolguda deprem: TBDY 2018 Denk. 16.26/16.20 uygulandı; varsayılan "zarf", mühendise uyarı gösteriliyor. Kaynak: `docs/research/submerged_seismic_thrust.md`.
2. Tasarım seçimleri kullanıcının kontrolünde; varsayılan güvenli taraf. Örnek: `uplift_moment = "overturning"`.
3. Nγ için YASS geçiş düzeltmesi eklendi (Das). `gwt_bearing_correction = True`.
4. Kısmi katsayılı global stabilitede yük katsayıları uygulanıyor.

## E4 chunk C (tamamlandı, 2026-10-17)

1. TBDY Denk. 16.24b / EN 1998-5 E.3 dalı (`coefficients.tbdy_kae_steep`). Yalnız katmanlı duvar yolu `steep_seismic=True` ile kullanır, diğer çağıranlar hata vermeye devam eder.
   - **δ korunur.** Eski brief'teki "δ=0" kabulü yanlıştı. EN 1998-5 sayfa görüntüsünden doğrulandı: E.3 paydasında δ_d var. δ korunduğunda E.2 ile sınırda süreklilik sağlanır. δ=0 alınsaydı sınırda %8–9'luk, tutucu olmayan bir sıçrama oluşuyordu (Opus incelemesi).
   - cos(δ+θ+ψ) ≤ 0 olduğunda GeoTekError verilir (gpt-6-astra incelemesi).
   - Sınırdaki M-O kayan nokta hatası (sqrt(−3e-17)) giderildi.
2. ±kv zarfı: `WallSettings.kv_sign = envelope|up|down`, varsayılan envelope.
   - Her işaret için analiz tam olarak ayrı çalıştırılır. Her kontrolde düşük kapasite oranı seçilir (TBDY 16.12.2.3); global stabilite de dahildir.
   - Detay metninde "kv yukarı/aşağı" ön eki yer alır.
   - 5 m duvar: zarf ile B = 4.60, "down" ile B = 4.50.
3. Su altı deprem dalına yalnız kh veya kv ≠ 0 iken girilir.
4. Su altında dolgu varken r > 1 ise uyarı verilir.
5. Karışık geçirgenlik "doğrulanmamış mühendislik yaklaşımı" olarak etiketlendi.
6. `E4_FORMULAS.md` §3 güncellendi. OpenAPI ve web tipleri yenilendi.

İncelemeler: Claude Opus (alt ajan) ve gpt-6-astra. Bulgular düzeltildi; Opus'un yeniden kontrolü temiz.

## Açık konular

- KDYY "Tasarım ve Uygulama Esasları" (16.07.2026 değişikliği) ve Tasarım El Kitabı (Temmuz 2023) okunamadı: dosyalar 10 MB'ı aşıyor ya da sertifika hatası veriyor. Kullanıcı PDF'leri yerel olarak sağlarsa incelenecek.
- Yeni motor seçenekleri arayüze bağlanacak (F4 duvar sihirbazı):
  - `uplift_moment`, `gwt_bearing_correction`, `submerged_seismic`, `kv_sign`
  - katman `permeability`
  - `passive_reduction` onayı
- ±kv zarfında kontroller işaret bazında seçiliyor. Ancak analiz düzeyindeki kuvvetler, e, q_max ve bearing nesnesi, en kritik kontrolü yöneten işaretten geliyor. Hangi işaretin kullanıldığı yalnız detay ön ekinde görünüyor. Sorun kozmetik; rapor ve arayüz (F4) aşamasında netleştirilecek.
- Backend `GET /api/i18n/{lang}` hâlâ 501 döndürüyor. Web paketlenmiş kataloğa düşüyor. A1'de uygulanmalı; çekirdek ve modül parçalarının birleşik kataloğu dönmeli.
- PyInstaller (K1): spec dosyasına `collect_submodules("geotek.modules")` hidden-imports olarak, `geotek/**/*.json|yaml` de datas olarak eklenmeli. Donmuş exe'de `/api/modules` 4 modül döndürmeli (`_index.py` yedeği).
- Eski PySide6 arayüzü (`geotek/ui`), `services/module1.py` ve `Project.module2_inputs` dokunulmadan kaldı.
- Vite paket boyutu uyarısı (~685 kB): kod bölme ileride (K1 öncesi) yapılacak.
- `walls_basic` (eski PySide6 yolu) tek kv işareti kullanıyor. PySide6 kaldırılınca yapı servisine geçilecek.

## Ortam notları

- Git PATH'te değil: `& "C:\Program Files\Git\cmd\git.exe"`.
- Testler: `.venv\Scripts\python.exe -m pytest -q` (~2 dk), `npm --prefix web run test|typecheck|build`.
- Mock arayüz: `.claude/launch.json` → `web-mock` (port 5173).
- Codex ve Antigravity sandbox'ları Python/npm çalıştıramıyor; testleri orkestra çalıştırır. Antigravity'deki Opus kotası doldu. Claude modelleri kendi alt ajanlarımızla kullanılır.
- Uzun MCP çağrıları 1800 sn'de kesiliyor ama sunucuda devam edebiliyor. Yeni çağrıdan önce `git status` ve codex süreçleri kontrol edilmeli.
