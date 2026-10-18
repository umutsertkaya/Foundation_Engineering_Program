# Yeni oturum için devam prompt'u

Aşağıdaki metni yeni bir Claude Code oturumuna ilk mesaj olarak yapıştırın.

---

GeoTek v2'yi orkestra şefi olarak kaldığı yerden sürdür. Modüler yeniden yapılanma bitti (2026-10-19). Sıradaki iş: paralel worktree'lerdeki (`C:\Users\thebi\Documents\geotek-wt\`) `feat/a1-core`, `feat/a1-soil`, `feat/e2-layering` dallarını incelemek, düzeltmek ve birleştirmek; sonra A1 işleri, E3, F4/F5.

Önce şunları oku:
1. `docs/DEVAM_NOTLARI.md`: durum, onaylı kapılar, "Paralel çalışma", açık konular, ortam notları.
2. `docs/plans/MODULER_YAPI.md` ve `docs/MODULE_GUIDE.md`: modüler mimari; yeni modüller `tools/new_module.py` ile iskelelenir.
3. `docs/contracts/CORE_SHELL_API.md` ve `docs/ORKESTRA_PROMPT.md`: delegasyon protokolü, "Yapma" kuralları, yeniden hedeflenmiş yol haritası.

Durum:
- `restructure/modules`, `main`'e yerel olarak birleştiriliyor (push edilmedi).
- Kapı 2, Y1 ve Y2 onaylandı. Kapı 3 (F1 tasarımı) onaylanmadı; kullanıcının zemin ekranlarına görsel onayı bekleniyor.
- 874 pytest, 124 web testi; typecheck ve build yeşil.

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
- Her dal birleşmeden önce iki inceleme (gpt-6-astra salt okuma + Opus) ve tam testlerden geçer; birleşince `test_contract.py` IMPLEMENTED kümesi ve openapi/schema.d.ts güncellenir.
- Kullanıcıyla Türkçe konuş. Kod, isimler ve docstring'ler İngilizce. Kullanıcıya görünen metinler i18n anahtarlarından gelir; zemin modülü anahtarları `geotek/modules/soil/i18n/{tr,en}.json` içinde.
