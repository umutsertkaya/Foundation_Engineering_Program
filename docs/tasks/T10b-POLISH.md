# T10b — T1 ve T8a inceleme artıkları (arayüz/rapor cilası)

2026-10-20 Claude (Opus) salt okuma incelemelerinden kalanlar. Hesap formülü/katsayı değişmez.
Kapsam yalnız aşağıdaki maddeler; farklı motordan inceleme (Antigravity/Codex) ayrıca açık.

## T1 sıvılaşma sonuç sayfası
- TR terim birliği: "GS" ile "FS" (`tr.json` `liquefaction.results.min_fs` vs `fs`, grafik). Tek terim seç.
- Motor uyarıları (`engine/liquefaction/analysis.py`) İngilizce düz metin; çevrilebilir kod sözleşmesi (T9 `warning_items` modeli gibi) ve TR/EN anahtarlar.
- `DepthChart.tsx` FS ekseni üst sınırı açık uçlu; makul sabit sınır, aşan noktalar kenarda işaretli, gerçek değer tabloda.
- `SoundingDetail.tsx`: "marginal" sınıfı ve hedef GS referans çizgisi.
- Sayı biçimi `Intl.NumberFormat(i18n.language)`, özet/ayrıntı tablosu ondalık sayısı aynı; özet tabloya caption.
- Testler: EN render, yalnız `errors`, failed/cancelled, marginal/bilinmeyen durum, FS=1 noktasının referans çizgisiyle hizası.

## T8a rapor servisi (`geotek/services/report.py`)
- Ayarlar tablosunda `gwt_seismic`/`default_fc` None iken "-" yerine hesapta kullanılan profil değerini "(profil)" etiketiyle yaz; `c_fc` ve `ic_cutoff` satırlarını ekle; profil kimliği yanında adı.
- Sınıflandırma bölümü rapor anında yeniden hesaplanıyor: ya modül docstring'i ve arayüzde "türetilmiş" de, ya sonucu sakla + hash denetimi.
- Geometri anahtarları ham İngilizce, birimsiz; kontrol tablosunda birim.
- `no_result` ve `stale` birlikte seçilirse tek 409'da ikisini de döndür (`details.no_result`, `details.stale`).
- NaN/fingerprint hatası: `_structure_status` korumalı (bu PR ile yapıldı, `tests/unit/test_report_status_guard.py`); liquefaction hash dalı ve `GET /sections` / `POST /docx` için API düzeyinde 500 olmadığını da test et.
- Test boşlukları: kaynak profil değişince, `design_overrides` değişince, profil silinince stale; sheet pile stale; Türkçe karakterli/boş proje adıyla dosya adı; belgedeki sayısal değer/yuvarlama (M_max).

Kabul: ilgili pytest + Vitest, typecheck, `gen_code_map --check` 0; STATUS'ta kısa kanıt.
