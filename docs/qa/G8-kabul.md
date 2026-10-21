# G8 kabul notu — duvar, palplanş ve ankraj (hedef 2)

Tarih: 2026-10-21. Kapsam: G1, G2, G5, G6, G7 (birleşmiş) gerçek API ile uçtan uca kontrolü.
**Kayma dişi (G3 PR #21 birleşmedi, G4 başlamadı) bu kabulün dışındadır.**

## Yöntem

`docs/qa/g8_e2e.py`: pydantic modelleriyle `.gtk` proje dosyası üretir, gerçek FastAPI sunucusuna
(`geotek.launcher.build_app`, `web/dist` ile aynı süreçte, 127.0.0.1:8766) HTTP ile açtırır ve bütün hesapları
API işleri üzerinden sürer. Tarayıcı penceresi sürülmedi; web ekranları Vitest (mock) ve `npm run build` ile kontrol edildi
(gerçek API ile ekran elle gözle kontrol edilmedi). Üretilen rapor örnekleri: `docs/qa/g8/rapor_tr.docx`, `rapor_en.docx`.

## Geçen adımlar (script çıktısı: 0 FAIL)

| Alan | Kanıt |
|---|---|
| Duvar, eğim 10° + sürşarj 15 kPa, taban `horizontal` ve `inclined` | İki kontrol işi `done`; kuvvetler iki tabanda farklı |
| Palplanş, eğim 10° + sürşarj 15 kPa (konsol/yatay, ankrajlı/eğik) | İki tasarım işi `done`, kayıtlı sonuçta toplam boy > 0 |
| Ankraj tasarımı (GEC-4 Ek A Örnek 1 geometrisi) | 200; eksik FS/q_u/kilitleme → 422 `missing_inputs` |
| Ankrajlı duvar, tek seviye, β=5° + sürşarj + ankraj tasarımı | 200, `free_earth_single`, her seviyede tasarım |
| Ankrajlı duvar, 3 seviye, `?save=true` | 200, `apparent_hinge`, 3 seviye, kayıtlı durum güncel (stale değil) |
| 3 seviye + β>0 | 422 `calculation_stopped` (kodlu durdurma) |
| Rapor docx TR ve EN | 200; ham i18n anahtarı yok; `{kind}` yer tutucusu yok; ankraj bölümleri var |

## Bulunan ve düzeltilen hata

- `anchored_wall.assumption.apparent_envelope_empirical` içindeki `{kind}` zarf türü ham kimlikle (`sand`) yazılıyordu.
  Rapor (`modules/anchored_wall/report.py`) ve web (`Notices.tsx`) artık `anchored_wall.envelope.<tür>` çevirisini kullanır
  (TR: kum, yumuşak–orta kil, sert kil). Birim testi `tests/unit/test_module_report_hook.py`.

## Görünür varsayımlar — mühendislik doğrulaması gerekli

1. **G6 görünür basınç zarfları** (kum 0,65 Ka γH, yumuşak kil γH−4Su, sert kil 0,2–0,4 γH varsayılan 0,3, üst rampa 0,25H,
   menteşe/katkı alanı yöntemi) yalnız bir ders notu özetiyle karşılaştırıldı; **Peck/Terzaghi–Peck özgün şekilleriyle değil**.
   Raporda ve ekranda varsayım olarak görünür. Tasarımda kullanmadan önce kaynakla doğrulayın.
2. **Yumuşak kilde γH > 4Su**: taban altı gömülme dengelenemez; hesap durdurulur (bilinçli, tutucu).
3. Çok seviyeli zarf β>0, karışık katman, kazı içinde YASS ve kil+sürşarjda durdurulur; sürşarj kumda düzgün Ka·q eklenir.
4. Ankraj FS, q_u/τ_ult ve kilitleme oranı kodlanmış varsayılan değildir; kullanıcı girer (GEC-4 değerleri yalnız öneri).
5. Sürşarj tabanı: varsayılan yatay izdüşüm; `inclined` seçeneği q_h = q/cosβ.
6. Gözlem (G8 öncesi, bu kapsamda düzeltilmedi): proje dili TR iken hesaplanan duvar varsayımları (ör. ±kv zarfı) metin olarak
   kaydedildiği için EN raporda Türkçe kalır; T10b "duvar varsayımlarının TR/EN kodları" işiyle aynı konu.

## Bekleyen / kapsam dışı

- G3 kayma dişi arka uç (PR #21, `claude/project-thread-w829h6`): ana dalla çakışma, birleştirme izni bekliyor. G4 kayma dişi
  web/kesit/rapor G3'e bağlı, başlamadı.
- Kranz derin stabilite, aşamalı kazı, yaylı kiriş (beam-on-spring), sehim: kapsam dışı (EI saklanır, kullanılmaz).
- Betonarme/çelik kesit tasarımı yok; yalnız V, M talebi raporlanır.
- Windows'ta elle ekran kontrolü ve `tools/project.py check full` bu ortamda çalıştırılamadı.
