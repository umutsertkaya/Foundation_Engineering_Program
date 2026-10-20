# F5-LIQ — sıvılaşmada gerçek iş ve sonuç akışı

Önkoşul: `CLAUDE.md`, `docs/STATUS.md`, `docs/WORKFLOW.md`. Görev henüz uygulanmadı.
İlk teslim için tercih: job kimliğini koru, ilerleme/iptal/hata göster, mevcut sonucu oku.
Grafik ve tablo ayrıntısı ayrı ikinci teslim olabilir; şef önce gerçek sonuç DTO'sunu inceler.

## Oku

- `web/src/modules/liquefaction/{api.ts,Root.tsx,pages/AnalysisPage.tsx,pages/ResultsPage.tsx,mock.ts}`
- `web/src/shared/hooks/useJob.ts`, `web/src/shared/api/{core.ts,types.ts}`
- `web/src/shared/api/mock/{store.ts,coreRoutes.ts}` (ortak mock job sınırlaması)
- `geotek/modules/liquefaction/api.py`, `geotek/api/{calculation_results.py,calculation_jobs.py}`
- `tests/api/test_liquefaction_api.py`, mevcut modül web testi.

Mevcut durum: `run_liquefaction` JobRef döndürür; AnalysisPage kimliği atıp boş sonuca gider.
Mevcut sonuç taşıması `GET /api/jobs/{job_id}` yanıtındaki `JobState.result` alanıdır;
başarı durumu `done`. Ayrı kalıcı sıvılaşma sonucu okuma rotası yoktur. Yenileme veya süresi
dolmuş işte açık “sonuç yok/erişilemiyor” durumu göster; yeni endpoint gerekiyorsa ayrı kapsam aç.
Mock yalnız sahte job_id üretir; mevcut job deposuna bağlı olduğuna güvenme.
Ortak mock job deposu/ilerletici şu an duvar sonucuna özeldir. Şef önce küçük bir sözleşme
teslimi açıp `shared/api/mock/store.ts`, `shared/api/mock/coreRoutes.ts` ve ilgili mock testlerinin
tam yazma listesini belirler; genel job sonucunu sıvılaşma DTO'suyla taşıyabilmelidir.
Bu teslim bitmeden yalnız modül mock'unu değiştirmek uçtan uca mock takibi sağlamaz.

## Yazma sınırı

`web/src/modules/liquefaction/`, bu modülün `geotek/modules/liquefaction/i18n/{tr,en}.json`
ve modül testleri. Şef her teslimde **tam dosya listesi** verir. Ortak hook/tip veya backend
değişikliği gerekiyorsa ayrı sözleşme teslimi aç; başka modülün özel kodunu import etme.

## Kabul

- Başlatılan job id korunur; queued/running/done/failed/cancelled durumları doğru gösterilir.
- İptal/hata sonrası sahte sonuç görünmez; tamamlanmış sonuç mevcut API'den okunur.
- Profil seçimi ve mühendislik girdilerinin açık girilmesi korunur; katsayı ekleme.
- Gerçek sonuç alanları/birimleri kullanılır. Boş sonuç, eksik profil ve yenileme davranışı test edilir.
- Mock tamamlanma/hata/iptal davranışı job API sözleşmesiyle uyumlu; mock başarı gerçek hesap değildir.
- TR/EN anahtarları eşleşir. İlgili Vitest + typecheck + gerçek API smoke kanıtı.

```powershell
npm.cmd --prefix web run test -- src/modules/liquefaction/__tests__/liquefaction.test.tsx
npm.cmd --prefix web run typecheck
.\.venv\Scripts\python.exe -m pytest -q tests/api/test_liquefaction_api.py tests/api/test_jobs_api.py
```

UI'da görsel kontrolü Q1'e kanıtla devret. Kabul tamamlanınca STATUS'ta sıradaki kartı değiştir.
