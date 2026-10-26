# Arayüz metin rehberi

Kapsam: `web/` arayüzündeki görünür metinler (`geotek/i18n`, `geotek/modules/*/i18n`). Anahtar adları sabittir;
TR ve EN katalogları aynı anahtarlara sahip olur. Ders içeriği, formül ve kaynak metni bu rehberin dışındadır.

## Yazım kuralları

1. Kısa, sade Türkçe. Bir cümle en çok yaklaşık 20 sözcük; noktalı virgül zinciri yok.
2. "Ne oldu → ne yapmalı" sırası: "Hesap durdu: YASS derinliği yok. Değeri girip yeniden çalıştırın."
3. "Program … yapmaz/atamaz" gibi özneli bahane yok; durumu ve çözümü yaz.
4. Görünür metinde iç sözcük yok: stale, mock, payload, envelope, hash, kaynak_stale. Karşılığı "Sonuç eski" gibi düz ifade.
5. Kısaltma ilk geçtiği yerde açılır: "Yeraltı suyu (YASS)", "Güvenlik sayısı (GS)". Sonra yalnız kısaltma.
6. Sayı, birim ve kaynak (ör. TBDY 16.12.2.3) metinde aynen kalır. Katsayı veya kaynak uydurulmaz.
7. Düğme fiildir: "Raporu hazırla", "Kaydet". Sayfa başına tek ana eylem.
8. Sayfa başlığının altında tek düz cümle (`PageHeader` `lead`) sayfanın ne işe yaradığını söyler.

## Terim sözlüğü

| Kullan | Kullanma |
|---|---|
| Zemin profili | soil model, profil kaynağı |
| Tasarım parametreleri | design params, seçili parametre |
| Yeraltı suyu (YASS) | GWT, su tablası |
| Güvenlik sayısı (GS) | FS, emniyet katsayısı (başlıkta) |
| Gömme boyu D | gömülme, embedment |
| Sonuç eski | stale, bayat, güncelliğini yitirmiş |
| Örnek veri modu | mock, sentetik |

## Alan durumları

- Zorunlu alanın altında amber "Gerekli" (`FieldNote kind="required"`).
- Hata kırmızı ve alanın hemen altında: ne yanlış, hangi aralık geçerli.
- Yardım gri tek satır; uzun açıklama `CollapsibleSection` içine gider.

## Üç uyarı düzeyi

| Düzey | Ne zaman | Ton |
|---|---|---|
| Bilgi | Sonucu değiştirmeyen not | `info` |
| Dikkat | Sonuç var ama kabul/eksik girdi mühendis kararı ister | `warn` |
| Hesap durdu | Hesap yapılamadı; neden ve çözüm yazılır | `bad` |

## Ortak bileşenler (`web/src/shared/components`)

- `PageHeader`: başlık, tek cümle, durum çipi, sağda eylemler, geri bağlantısı.
- `SectionCard`: numaralı/numarasız başlıklı beyaz kart; sayfa bölümü.
- `CollapsibleSection`: "Gelişmiş" gibi varsayılan kapalı bölüm.
- `DisclosureRow`: başlık + ipucu + sayaç çipi ile açılır satır.
- `StatusChip`: güncel / eski / eksik / hata / bilgi çipi; renk tek işaret değil, metin de söyler.
- `VerdictBanner`: sonuç hükmü (ok/warn/bad/info), başlık ve tek satır neden/yapılacak. Yalnız gerçek sonuçtan üretilir.
- `ActionBar`: eksik özeti ve tek ana eylemin durduğu alt çubuk.
- `FieldNote`: alanın altındaki Gerekli / hata / yardım satırı.
- `KpiTile`: etiket, tek sayı (mono yazı), birim ve alt satır.
- `ToggleRow`: anahtar, başlık ve ne değiştirdiğini söyleyen tek satır.
- `EmptyState`: boş liste için başlık, açıklama ve eylem.
- `ErrorAlert`: API hatasını çevrilmiş başlık ve ayrıntıyla gösterir; tekrar dene düğmesi.
- `MissingFactorsForm`: seçilen yönetmeliğin vermediği katsayıların girişi.

## Kontrol

Yeni metin eklerken TR/EN anahtar eşitliğini koru; uzun (> 90 karakter) veya yasak sözcük içeren değerleri gözden geçir.
