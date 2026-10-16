# Yeni oturum için devam prompt'u

Aşağıdaki metni yeni bir Claude Code oturumuna ilk mesaj olarak yapıştırın.

---

GeoTek v2'yi orkestra şefi olarak kaldığı yerden sürdür. Sıradaki iş **M1: zemin modülü**.

Önce şunları oku:
1. `docs/DEVAM_NOTLARI.md`: durum, onaylı kapılar, "Sıradaki iş: M1" adımları, açık konular, ortam notları.
2. `docs/plans/MODULER_YAPI.md`: modüler mimari ve iş parçaları tablosu (M1 → Y2 → M2–M5 → X1–X3).
3. `docs/contracts/CORE_SHELL_API.md` ve `docs/ORKESTRA_PROMPT.md`: delegasyon protokolü ve "Yapma" kuralları.

Durum:
- Dal `restructure/modules`. Main'e birleştirme X3'te yapılacak.
- Kapı 2 ve yapı kapısı Y1 onaylandı.
- 827 pytest, 69 web testi, typecheck ve build yeşil.

Çalışma kuralları:
- Git PATH'te değil; `C:\Program Files\Git\cmd\git.exe` kullan. Python: `.venv\Scripts\python.exe`.
- Delegasyonda `ai-orchestrator` MCP'yi kullanmayı ihmal etme:
  - gpt-6.1-sol: mantık ağırlıklı kod.
  - gemini-4-argon: yeni arayüz ekranları.
  - gemini-3.8-flash: metin taslakları. Bağlamı prompt'a göm; komut çalıştıramaz.
  - gpt-6-astra: salt okuma inceleme.
- Claude modelleri kendi Agent aracınla çalışır:
  - Sonnet: mekanik taşıma, test yazımı ve görsel QA. Testleri kendisi koşar.
  - Haiku: hafif işler.
  - Opus: kod incelemesi.
- Her delege taze oturumda, küçük parça halinde çalışsın; brief'ler dosyalara referans versin, raporlar kısa olsun. Aynı dosyaya aynı anda iki yazar verme.
- Her parçadan sonra pytest ve `npm --prefix web run typecheck|test|build` çalıştır, sonra commit at.
- M1 bitince bir Opus incelemesi ve bir Sonnet görsel QA yaptır. Ekran görüntülerini `docs/qa/soil_module/` altına al ve **yapı kapısı Y2**'de dur, kullanıcının onayını iste.
- Kullanıcıyla Türkçe konuş. Kod, isimler ve docstring'ler İngilizce. Kullanıcıya görünen metinler i18n anahtarlarından gelir; zemin modülü anahtarları `geotek/modules/soil/i18n/{tr,en}.json` içinde.
