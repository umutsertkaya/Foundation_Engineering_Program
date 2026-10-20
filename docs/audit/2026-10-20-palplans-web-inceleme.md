# Palplanş web teslimi — salt okuma incelemesi (T2)

Tarih: 2026-10-20 · Taban: `main` 394b5bb · Kapsam: F5-PILE teslimi (`998e937`, `76d2b4d`).
Kod değiştirilmedi; yalnız bu rapor yazıldı.

## Yöntem ve sınırlar

- İncelenen: `web/src/modules/sheet_pile/**` (sayfalar, bileşenler, `inputs.ts`, `mock.ts`, test dosyası),
  `geotek/modules/sheet_pile/{api.py,i18n}`, `geotek/engine/sheet_pile.py`, `geotek/api/{app.py,calculation_jobs.py,calculation_results.py,schemas.py}`,
  `geotek/services/structures.py` (`design_sheet_pile_structure`), `web/src/shared/api/types.ts`.
- Plan, uygulayıcı olarak Antigravity `gemini-4-argon` öngörüyordu. Bu konudan cihazdaki Claude Code oturumuna ve
  `ai-orchestrator`'a erişilemediği için inceleme doğrudan bu konuyu yürüten Claude tarafından, dosyalar okunarak yapıldı.
  Bağımsız ikinci göz yoktur; istenirse T9 öncesi gemini-4-argon ile ikinci geçiş yapılabilir.
- **Çalıştırılamadı:** Vitest, typecheck, pytest. Cihazdaki `node_modules` ve `.venv` Windows içindir, inceleme Linux ortamında yapıldı.
  STATUS'taki "21/21 geçti" kaydı doğrulanmadı. Bulgular koddan çıkarımdır; ölçüm değildir (özellikle B1).
- Hesap motoru (formüller) bu incelemenin kapsamı dışındadır; yalnız web'e giden sözleşme ve gösterim bakıldı.

## Özet

Mock akışı ve temel sözleşme (girdi → tasarım job'u → sonuç DTO, birimler, eksik girdi listesi, kaynak profil korunumu)
kabul ölçütleriyle uyumlu görünüyor. Gerçek API ile kullanılabilirliği etkileyen iki yüksek, dört orta bulgu var.

| # | Önem | Bulgu |
|---|---|---|
| B1 | Yüksek | Sonuç tablosu binlerce satırı olduğu gibi çiziyor |
| B2 | Yüksek | Kaydedilmiş sonuç hiçbir yerde gösterilmiyor |
| B3 | Orta | Kaydet sonrası eski sonuç "güncel" gibi kalıyor, eski rozeti yenilenmiyor |
| B4 | Orta | Job bitince yazılmış ama kaydedilmemiş girdiler sessizce siliniyor |
| B5 | Orta | İstemci tarafında aralık denetimi yok; geçersiz girdi sunucudan 422 ile dönüyor |
| B6 | Orta | Uyarılar ve varsayımlar çevrilmeden, ham metin olarak gösteriliyor |
| B7 | Düşük | Ankrajlı sonuçta uygulanmayan "Uç kuvveti" kutusu "—" gösteriyor; tablo derinliği tasarım boyunu aşmıyor ama belirtilmiyor |
| B8 | Düşük | Anlık ağ hatası job izlemeyi kalıcı durduruyor |
| B9 | Düşük | Sayı biçimi dilden bağımsız (TR'de nokta); M_max mutlak değer, seri işaretli |
| B10 | Bilgi | Tasarım diyagramı (net basınç/kesme/moment–derinlik) yok |
| B11 | Bilgi | Arayüzde seçilemeyen girdiler: yaklaşım, analiz seviyesi, derinlik artışı, ankraj aralığı/eğimi, ön su seviyesi |

## Bulgular

### B1 — Sonuç tablosu binlerce satır (Yüksek)
- `geotek/engine/sheet_pile.py:36` entegrasyon adımı `DZ = 0.002 m`; `:117` ızgara bu adımla kurulur, kırılma noktaları çift eklenir.
  `_internal_forces` (`:~175`) seriyi `toe`'ya kadar keser, yani yaklaşık `toe / 0.002` nokta (örnek: 8 m için ~4000+) `z/shear/moment/net` olarak DTO'ya girer
  (`calculation_results.py:85-86`).
- `web/src/modules/sheet_pile/components/ResultPanel.tsx:29,103` bütün noktaları `Table.Tr` olarak çizer: seyreltme, sanallaştırma veya grafik yok.
  Mock yalnız 5 nokta ürettiği için testler bunu yakalamaz (`mock.ts`).
- Etki: gerçek sonuçta binlerce DOM satırı ve okunamayan tablo; aynı veri proje dosyasına da yazılır (`calculation_jobs.py`, `target.result = payload`).
- Öneri: web'de seri seyreltme (ör. kırılma noktaları + düzenli ~0.25 m) veya çizgi grafik; tam seri yalnız "dışa aktar"da.
  Backend DTO'yu değiştirmek gerekmez; değiştirilecekse ayrı karar (sözleşme).

### B2 — Kaydedilmiş sonuç gösterilmiyor (Yüksek)
- Liste/özet `has_result` rozetini `result_hash` üzerinden verir (`app.py:77`), ama `SheetPileDetailPage.tsx` sonucu yalnız URL'deki `?job=` ile
  (`:26`, `:240-243`) gösterir. `SheetPileStructure` TS tipinde `result` alanı yok (`web/src/shared/api/types.ts:~516`), sunucu ise `get_structure` ile döndürür.
- Etki: proje kaydedilip yeniden açıldığında veya sayfa değiştirilip dönüldüğünde "Sonuç var" rozeti görünür ama sonuç görülemez; kullanıcı yeniden hesaplamak zorunda.
  Job süresi dolmuşsa `sheet_pile.job.unavailable` ("yeniden çalıştırın") görünür.
- Öneri: `?job=` yoksa ve `structure.result` varsa `ResultPanel`'i saklı sonuçla göster; tipe `result?: SheetPileResultDTO | null` ekle.

### B3 — Kaydet sonrası eski sonuç/rozet (Orta)
- `save()` (`SheetPileDetailPage.tsx:104-117`) yalnız `structure`/`inputs` günceller; `summary` (stale/has_result) yenilenmez ve `?job=` korunur.
  Backend, değişen girdiyle `result_hash != fingerprint` olduğu için `stale=true` döndürecektir (`app.py:75-76`), ama sayfa bunu sonraki `load()`'a kadar görmez.
- Ayrıca `applyInputs` (`inputs.ts`) `...s` ile eski `result`/`result_hash` alanlarını PUT gövdesinde geri yollar; backend bunları tutar (`update_structure`), bu doğru, ama arayüzde eski sonuç uyarısız kalır.
- Öneri: `save()` sonunda özeti de yenile; stale iken sonucun üstünde "girdiler değişti, sonuç eski" bandı; yeni job'a kadar eski sonucu soluk göster.

### B4 — Job bitince girdi kaybı (Orta)
- `JobPanel` `done` olunca `onDone` → `load()` (`JobPanel.tsx:40`, `DetailPage:243`); `load()` her seferinde `setInputs(fromStructure(full))` (`:50`) çağırır.
  Job çalışırken form düzenlenebilir olduğu için, o sırada yazılan kaydedilmemiş değerler job bitince sessizce silinir.
- Öneri: `onDone` yalnız `summary`'yi yenilesin (girdi durumuna dokunmasın) veya job çalışırken formu kilitle.

### B5 — İstemci aralık denetimi yok (Orta)
- Sunucu sınırları: `retained_height` 0.5 < H ≤ 12, `anchor_depth` ≥ 0 ve < H, `sds` 0–3 (dışlayıcı), `allowable_stress_mpa` > 0
  (`schemas.py:250-257`, `structures.py:189-207`). `InputsForm.tsx` hepsinde `min={0}`; `has()` 0'ı geçerli sayar (`inputs.ts`), dolayısıyla `sds=0`,
  `allowable_stress=0`, `H=0.3`, `H=15` veya `anchor_depth ≥ H` istemciyi geçip sunucudan genel 422 ("Invalid structure") olarak döner.
- Öneri: `missingInputs`'a aralık anahtarları (`range:*`) ve TR/EN mesaj; gerçek mesajı `errors[].loc` ile alana bağla.

### B6 — Ham uyarı/varsayım metinleri (Orta)
- `ResultPanel` `result.warnings` ve `assumptions[].text` dizgilerini olduğu gibi basar (`:~117-139`).
  Kaynakları motor/servis metinleridir: karışık dil ("Katmanlı Rankine aktif/pasif…", "Design embedment extends below the soil profile",
  "Anchor load: … kN per anchor"). TR/EN geçişinde değişmez; tek ankraj başına yük bilgisi uyarı içine gömülü.
- Öneri: çevrilebilir uyarı kodu sözleşmesi (backend) veya web'de bilinen kalıplar için anahtar eşlemesi; ankraj başına yükü ayrı alan yap.
  Sözleşme değişikliği olduğu için Umut/şef kararı gerektirir.

### B7 — Alan uygunluğu ve tablo aralığı (Düşük)
- Ankrajlıda `toe_force` null olduğu halde "Uç kuvveti" kutusu "—" ile çizilir (`ResultPanel.tsx:71`); konsolda ankraj grubu gizli, bu simetri eksik.
- Seri `toe`'da (H + D₀) biter, `total_length` H + D'dir (konsolda D = 1.2·D₀); tablo bunu belirtmez.
  Kullanıcı son satırı tasarım ucu sanabilir. Tabloya/ grafiğe "teorik uç" notu.

### B8 — Job izleme hata toleransı (Düşük)
- `JobPanel.tsx:42-44`: 404 dışındaki her hata `setError` ile izlemeyi bitirir; yeniden deneme yok (yalnız ErrorAlert). Geçici ağ kesintisinde job arka planda
  sürerken arayüz ölür; sayfayı yenilemek `?job=` ile devam ettirir ama bu belirtilmez. Öneri: 2–3 kez yeniden dene, "tekrar dene" düğmesi.

### B9 — Sayı biçimi (Düşük)
- `fmt` `toFixed(2)` kullanır (`ResultPanel.tsx:7`); TR arayüzde ondalık nokta. `Intl.NumberFormat(i18n.language)` kullanılmalı.
- `M_max` mühendislik gereği mutlak değerdir (`_internal_forces`: `abs(moment[i])`), ama tablodaki `moment` serisi işaretlidir; etikette belirt.

### B10 — Diyagram yok (Bilgi)
- Kabul ölçütlerinde yok; ama sıvılaşma için planlanan (T1) derinlik grafiğiyle aynı bileşen kullanılabilir. Eski arayüzde palplanş figürü vardı (`geotek/plotting/figures.py`).
  B1'in doğal çözümü de budur.

### B11 — Arayüzde olmayan girdiler (Bilgi)
- `design_code`, `approach`, `analysis_level` oluşturma/güncellemede hiç gönderilmez (varsayılan: `asd`, `basic`). Hangi tasarım yolunun
  (`global_fs` / sınır durum) koşacağı `_settings` varsayılanına bağlıdır; arayüz sonuçta hangisinin kullanıldığını göstermez (yalnız varsayım metninde).
  Ayrıca `depth_increase`, ankraj aralığı/eğimi, `front_water_depth` motorda var, web'de yok. Karar gerektiren konu: bunlar eklenecek mi, yoksa sonuçta kullanılan yaklaşım mı gösterilecek?

## Olumlu / kabul ölçütleriyle uyumlu görülenler

- Birimler: M_max kNm/m, kuvvetler kN/m, kesit modülü cm³/m, ankraj/uç kuvveti doğru etiketli (`ResultPanel.tsx:62-75`); DTO ile birebir.
- Kaynak profil korunumu: `applyInputs` `soil`'e dokunmaz; `manualSoil` yalnız yeni yapıya yazar; test mevcut.
- Eksik girdi/φ' listesi açık ve TR/EN anahtarları eksiksiz (92 anahtar, tr–en farkı yok; dinamik `missing.*` ve `support.*` anahtarları mevcut).
- Mock sonuç `mock_result_not_a_calculation` ile açıkça işaretli.
- İptal, 404, 409 `stale_structure` yolları `JobPanel`/`ErrorAlert` ile ele alınmış; eksik katsayılar listesi gösteriliyor.
- Modül sınırı: dosyalar `walls` içe aktarmıyor (dosya listesinden doğrulandı; `boundaries` testi çalıştırılamadı).

## Test boşlukları (yazılması önerilen)

1. Gerçek boyutlu seri (≥3000 nokta) ile `ResultPanel` render süresi/satır sayısı (B1).
2. Kaydet → `stale` rozeti ve eski sonuç bandı (B3); saklı sonuçla ilk açılış (B2).
3. Job sürerken girdi düzenle → bitince değer korunur (B4).
4. Aralık dışı girdiler: H ≤ 0.5, H > 12, anchor_depth ≥ H, sds = 0, stress = 0 (B5).
5. Ankrajlı sonuçta "Uç kuvveti" gizli, konsolda ankraj grubu gizli (B7).

## T9 düzeltme kartı taslağı (şef `docs/tasks/` altına taşısın)

**T9-PILE-FIX — palplanş web düzeltmeleri.** Yazma alanı: `web/src/modules/sheet_pile/**`, `geotek/modules/sheet_pile/i18n/{tr,en}.json`, modül testleri.
Backend/sözleşme dosyalarına dokunma; B6 ve B11 sözleşme kararı beklediği için kart dışı.

- Küçük teslim 1 (S1–S2): B3, B4, B7, B8, B9 — özet yenileme, eski sonuç bandı, `onDone` yalnız özet, alan uygunluğu, yeniden deneme, yerel biçim.
- Küçük teslim 2 (S2): B2 saklı sonuç gösterimi (tipe `result?` ekle), B1 seri seyreltme veya grafik (T1'deki grafik bileşeni hazırsa onu kullan).
- Küçük teslim 3 (S1): B5 aralık denetimi + TR/EN mesajlar.
- Kabul: yukarıdaki 5 test; `npm.cmd --prefix web run test -- src/modules/sheet_pile/__tests__/sheet_pile.test.tsx src/test/boundaries.test.ts`, `typecheck`, sonra Q1'de gerçek API smoke.
- Kararlar (2026-10-20, orkestra şefi; Umut mühendislik kararlarını şefe devretti, kritik olmadıkça sorulmaz):
  - B6: **evet**, çevrilebilir uyarı kodu sözleşmesi. Motor/servis metin yerine kod + parametre döndürür, arayüz TR/EN çevirir;
    ankraj başına yük ayrı alan olur. Bu backend/sözleşme değişikliğidir (`schemas.py`, `calculation_results.py`, openapi): ayrı küçük teslim (S3),
    şef kartın yazma alanına ekler.
  - B11: tasarım yaklaşımı ve ek girdiler (`approach`, `analysis_level`; ikinci geçişe göre `depth_increase`, ankraj aralığı/eğimi, `front_water_depth`
    yapı modelinde henüz yok, o yüzden bu üçü için önce modele alan eklemek gerekir) arayüzde sunulur; alanlar motorun mevcut varsayılanlarıyla ön dolu,
    sessiz yeni varsayım yok; sonuçta kullanılan yaklaşım gösterilir.
  - Yeni katsayı/formül yok.
- İkinci geçiş (gemini-4-argon, `docs/audit/2026-10-20-palplans-web-inceleme-ikinci-gecis.md`): B1-B11 çürütülmedi. Yeni Y1-Y7'den şunlar karta girer:
  Y3 (manuel zeminli yapıda stale uyarısı "Kaynak profille eşitle" düğmesini gösteriyor, `SheetPileDetailPage.tsx:166-175`, 404 riski) ve
  Y7 (eşitleme kaydedilmemiş girdileri siliyor; eksik girdide Kaydet aktif ama sessiz no-op). Y1, Y2, Y4, Y5, Y6 yalnız Gemini bulgusu: T9 öncesi tekrar doğrulanır.
  Y2/Y4 (zemin düzenleme, drenajsız tabaka kilidi) mühendislik kararıdır: şef karar verir, kart kapsamına girmeden önce ayrıca ele alınır.
- Koşu kanıtı (ikinci geçiş, Windows): Vitest sheet_pile 13/13, typecheck, pytest -k sheet_pile 35 geçti; `boundaries.test.ts` koşulmadı.
