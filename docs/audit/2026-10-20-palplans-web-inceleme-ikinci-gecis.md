# Palplanş web teslimi — bağımsız ikinci geçiş (salt okuma)

Tarih: 2026-10-20 · Taban: `main` 394b5bb · Kod değiştirilmedi; yalnız bu rapor yazıldı.

## Yöntem
- İnceleyen: Antigravity `gemini-4-argon` (medium, plan modu, salt okuma). Tam çıktı:
  `.project/logs/orchestrator/2026-10-20T14-44-58-269Z-agy-gemini-4-argon-medium.log`.
  (İlk deneme `delegate_subtask` ile MCP izni nedeniyle çıktı üretmedi; `ask_antigravity` ile tekrarlandı.)
- Claude, Gemini'nin yeni bulgularından Y3 ve Y7'yi `SheetPileDetailPage.tsx` üzerinde bizzat doğruladı; diğerleri (Y1, Y2, Y4–Y6)
  yalnız Gemini çıktısıdır, T9 öncesi tekrar doğrulanmalıdır.

## Çalıştırılan kontroller (Windows, depo kökü, 2026-10-20)
| Kontrol | Sonuç |
|---|---|
| `npm.cmd --prefix web run test -- src/modules/sheet_pile` | **Geçti**: 1 dosya, 13 test |
| `npm.cmd --prefix web run typecheck` (`tsc --noEmit`) | **Geçti**, hata çıktısı yok |
| `pytest -k "sheet_pile or sheetpile"` | **Geçti**: 35 geçti, 1551 seçilmedi |
| `src/test/boundaries.test.ts` | **Çalıştırılamadı** (bu geçişte koşulmadı) |

Not: STATUS'taki "21/21" kaydı bu 13 testle birebir eşleşmiyor (muhtemelen boundaries vb. dahil); karşılaştırma yapılmadı.

## Birinci rapor bulgularının doğrulanması
| # | Karar | Not (Gemini, dosya:satır) |
|---|---|---|
| B1 | DOĞRULANDI | `engine/sheet_pile.py:36` DZ=0.002; `services/structures.py:506-511` `np.arange(0, bottom, 0.002)`; `calculation_results.py:85-86`; `ResultPanel.tsx:29-34,103-110` tüm satırlar; `mock.ts:14` 5 nokta |
| B2 | DOĞRULANDI | `types.ts:513-528` `result` yok; `SheetPileDetailPage.tsx:27,240-245` yalnız `?job=` |
| B3 | DOĞRULANDI | `SheetPileDetailPage.tsx:104-117` `save()` summary'yi yenilemez (Claude da doğruladı); `app.py:74-76` |
| B4 | DOĞRULANDI | `JobPanel.tsx:40` → `load()` → `setInputs(fromStructure)`; form kilitlenmez |
| B5 | DOĞRULANDI | `schemas.py:250-258`, `structures.py:189-210`; `inputs.ts:55-77`, `InputsForm.tsx:40-81` yalnız `min={0}` |
| B6 | DOĞRULANDI + DÜZELTME | Karışık dil doğru (`structures.py:556,583-592`, `calculation_results.py:71-75`). **Düzeltme:** "Anchor load … kN per anchor" uyarısı `engine/sheet_pile.py:276-278` içinde; API servisi `_sheet_case` `anchored_sheet_pile`'ı çağırmadığı için bu uyarı API akışında üretilmiyor (Gemini iddiası; doğrulanmalı) |
| B7 | KISMEN | Boş "Uç kuvveti" kutusu (`ResultPanel.tsx:71`, `anchored` kontrolü yalnız `:80`) ve seri `toe=H+D0` (`engine/sheet_pile.py:189`) vs `total_length=H+1.2·D0` (`structures.py:543,558`) doğru. **Ek:** kısmi katsayılı tasarımda D0/D `governing_embedment`, seri `governing_moment` durumundan gelir (`calculation_results.py:67-70`); son `z` H+D0 ile bile örtüşmeyebilir |
| B8 | DOĞRULANDI | `JobPanel.tsx:41-45`; `:63` `ErrorAlert`'e `onRetry` verilmiyor (birinci rapor "yalnız ErrorAlert" demişti; tekrar dene düğmesi de yok) |
| B9 | DOĞRULANDI | `ResultPanel.tsx:7-9` `toFixed`; `engine/sheet_pile.py:194-196` |
| B10 | DOĞRULANDI | `ResultPanel.tsx:92-113` yalnız tablo |
| B11 | KISMEN | İki katman ayrışmalı: (1) `design_code/approach/analysis_level`, `gwt_front/gwt_retained` backend modelinde var (`schemas.py:255-258`, `structures.py:194-197,52-55`), web göndermiyor (`inputs.ts:111-125`); (2) `depth_increase`, `anchor_spacing/inclination`, `front_water_depth` yalnız saf motor fonksiyonlarında; `SheetPileStructure` modelinde ve `_sheet_case` içinde **yok** (`services/structures.py:543-546` sabit 0.2 / 0.0). Yani (2) web değil backend/sözleşme kararıdır |

## Birinci raporda olmayan yeni bulgular
| # | Önem | Doğrulama | Bulgu |
|---|---|---|---|
| Y3 | Orta | **Claude doğruladı** | `SheetPileDetailPage.tsx:166-175` `summary.stale` iken her zaman "kaynak değişti / Kaynak profille eşitle" uyarısı ve düğmesi çıkar; `source` (`:146`) null (manuel zemin) olsa da. `stale` hesap sonrası girdi değişimiyle de oluşur (`app.py:74-76`). Düğme `resync_structure_soil` (`app.py:334-345`) → Gemini'ye göre 404 "Source profile not found". Öneri: düğmeyi `source !== null` ile sınırla, metni girdi/sonuç bayatlığını da kapsayacak şekilde ayır |
| Y7 | Düşük | **Claude kısmen doğruladı** | `resync()` (`:119-130`) `load()` çağırır → kaydedilmemiş form girdileri silinir (B4 ile aynı kök neden). "Kaydet" `disabled={!dirty \|\| busy}` (`:232`), `missingInputs` iken aktif ama `save()` `:105` erken dönüşüyle sessizce hiçbir şey yapmaz |
| Y1 | Yüksek (Gemini) | Gemini | Oluşturma sayfasında manuel zemin geometrisi denetlenmiyor: `bottom > retained_height`, ilk tabaka `top=0`, `bottom>top`, süreklilik (`profile.py:71,115-121`), `5<gamma<30` (`profile.py:57`) vs `SoilSourceForm.tsx:130` `min={0}`; `SheetPileCreatePage.tsx:22` yalnız `missingInputs`, `missingSoilInputs` yalnız detayda → 422. B5'in zemin tarafı; "Yüksek" önem tartışmalı (Orta öneririm) |
| Y2 | Orta | Gemini | Detayda YASS (`gwt.depth_*`) gösterilmiyor; zemin kopyası salt okunur, eksik `phi_eff` durumunda düzenleme yolu yok (`SheetPileDetailPage.tsx:180-213`, `app.py:317-328`) |
| Y4 | Orta | Gemini | `missingSoilInputs` (`inputs.ts:80-88`) `behaviour` ayrımı yapmadan `phi_eff==null` ise eksik sayar (`SheetPileDetailPage.tsx:197-211,235`); drenajsız (`su`) tabaka varsa hesap kilitlenir; tabloda `gamma_sat`/`su` yok. **Dikkat:** motorun drenajsızı gerçekten desteklediği doğrulanmalı (`services/structures.py:501-503,533-534`), mühendislik kararı gerektirir |
| Y5 | Düşük | Gemini | Mock sapması: `coreRoutes.ts:173-179` `pollJobState` yalnız `retaining_wall` için `result_hash` yazar; `isStructureStale` (`:33-37`) yalnız `source_hash`; `mock.ts:24` ankrajlıda `toe_force:50`. B2/B3/B7 testlerde bu yüzden maskelenir |
| Y6 | Düşük | Gemini | Liste kartında `has_result` rozeti yok, silme aksiyonu yok (`SheetPileListPage.tsx:80-90`; `DELETE` ucu var `app.py:305-314`) |

## Sonuç
Birinci raporun 11 bulgusunun hiçbiri çürütülmedi; B6, B7, B8, B11 ayrıntı/düzeltme aldı. B11(2) ve B6'nın ankraj uyarısı kısmı web değil backend/servis sınırına ait.
T9 kartına öneri: Y3 (resync yalnız kaynak varsa) ve Y7 küçük teslim 1'e, Y1 küçük teslim 3'e (B5) eklenebilir; Y2/Y4 karar gerektirir (zemin düzenleme, drenajsız destek). Y5 mock düzeltmesi B2/B3 testleri yazılmadan önce yapılmalı.
