# T10b — T1 ve T8a inceleme artıkları (arayüz/rapor cilası)

Hesap formülü/katsayı değişmez. Biten maddeler (TR "GS" terimi, sıvılaşma uyarı kodları, GS ekseni üst
sınırı, boş veride referans çizgisi yok, rapor dosya adı, profil adı, NaN/stale/sayısal rapor testleri)
2026-10-20 sistem kontrolünde kapandı (`docs/qa/sistem-kontrolu.md`). Kalanlar:

## T1 sıvılaşma sonuç sayfası
- `SoundingDetail.tsx`: "marginal" sınıfı ve hedef GS referans çizgisi.
- Sayı biçimi `Intl.NumberFormat(i18n.language)`, özet/ayrıntı tablosu ondalık sayısı aynı; özet tabloya caption.
- Testler: EN render, yalnız `errors`, failed/cancelled, marginal/bilinmeyen durum.

## T8a rapor servisi (`geotek/services/report.py`)
- Ayarlar tablosunda `gwt_seismic`/`default_fc` None iken "-" yerine hesapta kullanılan profil değerini "(profil)" etiketiyle yaz; `c_fc` ve `ic_cutoff` satırlarını ekle.
- Sınıflandırma bölümü rapor anında yeniden hesaplanıyor: ya modül docstring'i ve arayüzde "türetilmiş" de, ya sonucu sakla + hash denetimi.
- Geometri anahtarları ham İngilizce, birimsiz; kontrol tablosunda birim; kontrol/durum adları (`static`, `overturning`) çevrilmeli.
- Duvar varsayım ve uyarı metinleri (`services/walls_basic.py`, `services/structures.py`) yalnız Türkçe; EN rapor/arayüz için kod + TR/EN anahtar sözleşmesi (palplanştaki `code/params` gibi).
- `no_result` ve `stale` birlikte seçilirse tek 409'da ikisini de döndür (`details.no_result`, `details.stale`).

Kabul: ilgili pytest + Vitest, typecheck, `gen_code_map --check` 0; STATUS'ta kısa kanıt.

## Farklı motor incelemesi artıkları
- T4: EH at-rest 1.35 YAML'a eklenmedi (açık madde, `docs/katsayi_dogrulama.md`); ASD kaya devrilme 1.5 ayrı alan olarak yok.
