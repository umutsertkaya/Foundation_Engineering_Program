# T10c — T10 kabul bulgularından arayüz/mesaj cilası

Kaynak: [T10 kabul raporu](../qa/T10-kabul.md). Hesap formülü/katsayı değişmez.

1. **Katman etiketi UUID gösteriyor.** Sunucu katman kimliklerini UUID verir; duvar kesiti
   (`wall-detail`), Parametreler sayfası (`ParametersPage.tsx:231`), `PermeabilityEditor`, `LayerEditor`
   etiketleri `layer.id` yazar. Yerine "üst–alt m" aralığı (+ varsa USCS/açıklama) kullan; `aria-label`
   ve test seçicilerini aynı anda güncelle.
2. **Motor hata iletileri ham İngilizce ve UUID içeriyor.** Örn. `Layer <uuid>: design s_u not set`
   (drenajsız katmanda onaylı s_u yokken duvar/palplanş işi). Çevrilebilir kod + `params` (katman
   üst/alt derinliği) sözleşmesi (T9 `warning_items` modeli gibi) ve TR/EN anahtarı.
3. **Rapor/uyarı metinleri çevrilmiyor.** TR docx içinde İngilizce satırlar: palplanş "Tension zone to …",
   sıvılaşma "Default FC = 5% used …". T10b maddesiyle birleştir.
4. **Sıvılaşma sonuçları sayfası kayıtlı sonucu yüklemiyor.** `/m/liquefaction/results` sayfası yeniden
   yüklenince/proje yeniden açılınca "Gösterilecek bir analiz yok" der; sonuç sunucuda var (rapor "güncel").
   Okuma uç noktası + sayfada yükleme gerekir (API sözleşmesi değişir: önce kısa brief).
5. **Sınıflandırma bölge özeti sıfır kalınlıklı satırlar üretiyor** (`1.40–1.40`, `3.65–3.65`, tek
   noktalı bölgeler; rapor tablosunda da görünür). Tek noktalı bölgeleri komşuya birleştir ya da en az
   kalınlık göster/belirt. Sınıflandırma kuralı değişmez; yalnız özetleme/görüntüleme.
6. **"Belirleyici kontrol" satırı geçen duvarda "-" yazar** (`governing` boş; yalnız başarısızlıkta dolar).
   Rapor etiketini "Başarısız kontroller" yap veya en yüksek kullanım oranlı kontrolü yaz.

Kabul: ilgili pytest + Vitest, typecheck, `gen_code_map --check` 0; STATUS'ta kısa kanıt.
