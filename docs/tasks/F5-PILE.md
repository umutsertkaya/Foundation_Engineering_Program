# F5-PILE — palplanş oluşturma, tasarım ve sonuç

Durum: ilk teslim tamam (`998e937`, `76d2b4d`); bağımsız inceleme, gerçek API ve görsel kabul Q1'de. Yeniden başlatma.
İki küçük teslim yap: (1) yapı oluşturma/girdi, (2) job takibi/sonuç. Her birini ayrı doğrula.

## Oku

- `web/src/modules/sheet_pile/{Root.tsx,api.ts,mock.ts,pages/SheetPileListPage.tsx,pages/SheetPileDetailPage.tsx}`
- `geotek/modules/sheet_pile/api.py`, `geotek/core/models/structures.py`
- `web/src/shared/api/{client.ts,types.ts}`, `web/src/shared/hooks/useJob.ts`
- `web/src/shared/api/mock/{store.ts,coreRoutes.ts}` (mevcut job sonucu duvara özel)
- `tests/api/test_sheet_pile_api.py`, `web/src/modules/sheet_pile/__tests__/sheet_pile.test.tsx`

Motor ve gerçek design job API zaten var. Web ayrıntı ekranı yer tutucu; mock design 501.
İlk teslimde gerçek StructureCreate/Structure ve SheetPile result sözleşmelerini dosyadan çıkar.
F5-LIQ sırasında ortak mock job sözleşmesi genişletildiyse onu kullan. Genişletilmediyse önce
şefin `shared/api/mock/store.ts`, `shared/api/mock/coreRoutes.ts` ve ilgili testleri açıkça
sahiplendiği küçük bir ortak teslim gerekir; yalnız modül mock'u ile polling tamamlanmaz.

## Yazma sınırı

`web/src/modules/sheet_pile/`, `geotek/modules/sheet_pile/i18n/{tr,en}.json` ve modül testleri.
Şef teslim başına tam dosya listesini yazar. Ortak zemin kartı gerekiyorsa önce ayrı küçük
teslimle `shared/`a çıkarılır; `modules/walls` özel dosyası içe aktarılmaz.
Backend sözleşmesi eksik çıkarsa şef bağımsız kapsam belirler; sessiz API değişikliği yapma.

## Kabul

- Projeden profil kopyalama veya elle zemin seçimi; kaynak profil korunur.
- Mevcut konsol/ankrajlı modelin gereken girdileri ve eksik katsayılar açık gösterilir.
- Gerçek tasarım job'u, ilerleme/iptal/hata ve tamamlanan sonuç görüntülenir.
- Sonuç mevcut DTO'nun gömülme, moment ve ankraj/kesit alanlarını doğru birimlerle gösterir.
- Mock job/sonuç akışı aynı sözleşmeyi kullanır; formül veya yeni katsayı eklenmez.
- TR/EN, bulunamayan yapı, eksik zemin, hata/iptal/stale ve kaynak profil korunumu doğrulanır.

```powershell
npm.cmd --prefix web run test -- src/modules/sheet_pile/__tests__/sheet_pile.test.tsx src/test/boundaries.test.ts
npm.cmd --prefix web run typecheck
.\.venv\Scripts\python.exe -m pytest -q tests/api/test_sheet_pile_api.py tests/unit/test_sheet_pile.py
```

Entegrasyonda `check full`; gerçek API smoke ve ekran kanıtını Q1'e devret.
