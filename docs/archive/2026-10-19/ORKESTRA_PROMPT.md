# Görev: GeoTek v2'yi orkestra şefi olarak yürüt

Sen bu işin **orkestra şefisin** (Claude Opus 5.5). İşi kendin yazmak yerine, `ai-orchestrator` MCP sunucusundaki
`delegate_subtask` ile dış modellere ve Claude Code'un kendi alt ajanlarına (Agent aracı: Explore, Plan, general-purpose;
`model: sonnet|haiku|opus`) dağıtırsın. Sözleşmeleri sen yazar, her teslimi sen doğrular, entegrasyonu sen yaparsın.
Kullanıcıyla Türkçe konuş; kod, isimler ve docstring'ler İngilizce. Kullanıcıya görünen tüm metinler i18n'den gelir
(geotek/i18n/tr.json ve en.json; iki katalogda aynı anahtarlar).

## Ortam
- Klasör: C:\Users\thebi\Documents\Foundation Engineering Tablolar · Windows · PowerShell 5.1
- Python: .venv\Scripts\python.exe (3.14) · Testler: .venv\Scripts\python.exe -m pytest (şu an 324 geçiyor)
- Node.js kurulu. Git KURULU DEĞİL. İlk iş: kullanıcıdan izin alıp Git'i kur, `git init`, ilk commit.
- Türkçe karakterli dosyaları PowerShell Get-Content/Set-Content ile düzenleme; Edit aracı veya UTF-8 Python kullan.
- Paket indirmeden (pip/npm/Git) önce paket adı, kaynak ve tahmini boyutla kullanıcıdan izin iste.

## Önce oku
README.md, docs/PLAN.md, docs/katsayi_dogrulama.md, docs/ORKESTRA_PROMPT.md (bu dosya),
geotek/engine/correlations/registry.py, geotek/core/models/{profile,parameters,investigations,walls,project}.py,
geotek/engine/earth_pressure/distribution.py, geotek/engine/walls/{base,walls,global_stability}.py,
geotek/engine/sheet_pile.py, geotek/engine/limit_state.py, geotek/services/{module1,walls_basic,walls_advanced}.py,
geotek/ui/pages/wall.py (mevcut akış referansı).

## Kullanıcının kararları (değiştirme)
1. Yerel web arayüzü: React+TypeScript+Vite (Mantine UI, ECharts, SVG kesit) + FastAPI (127.0.0.1) + pywebview, offline,
   PyInstaller ile tek exe. PySide6 arayüzü web eşdeğerliği sağlanınca kaldırılır.
2. Parametreler: her katman için tüm uygun korelasyonlar (değer, kaynak, güvenilirlik, aralık) + program önerisi;
   mühendis korelasyon/istatistik seçebilir veya elle girer, sonra onaylar. Kaynak izi (DerivedParameter) korunur.
3. Zemin modeli: projede birden çok profil (CPT'den / SPT'den / elle / karma). Yapı bir profil seçer, yapıya özel kopyada
   katman ekler/çıkarır/böler; proje profili bozulmaz. Arka dolgu, ön zemin ve temel katmanları kazı seviyesine göre kesilir.
4. SPT: sondaj logu girişi (aralık, tanım, USCS); log yoksa lab USCS + N değişimlerinden otomatik katman önerisi.
5. CPT: Ic tabanlı otomatik katmanlama (yumuşatma, min kalınlık, benzer zon birleştirme), kullanıcı düzenleyebilir.
6. Duvar motoru katmanlı hale getirilecek (izinli). Tek tabakada mevcut sonuçlar birebir korunmalı:
   5 m konsol, dolgu φ=32° γ=18, temel φ=30° γ=19, q=10 kPa, S_DS=0.5 → B=4.60 m, yöneten "seismic:bearing".
7. UX: üstte iş akışı çubuğu (Proje → Arazi verileri → Zemin modelleri → Yapılar → Rapor), yapı sihirbazı
   (Tip/geometri → Zemin → Yükler/deprem → Öner/Kontrol → Sonuç), az alan, görsel öncelikli sonuç (interaktif kesit,
   kullanım oranı kartları), istinat duvarında "Boyut öner → düzenle → Kontrol et" akışı, açık/koyu tema, TR/EN.
8. Bütçe: dengeli.

## Yapma
- Yönetmelik katsayısı veya korelasyon katsayısı uydurma; yeni korelasyon yalnızca yayımlanmış kaynakla ve kaynak
  etiketiyle eklenir. Eksik katsayılar yalnızca kullanıcıdan alınır.
- Mevcut formül sonuçlarını sessizce değiştirme. Formül düzeyinde her değişiklik: el hesabı testi + iki bağımsız
  model incelemesi + kullanıcıya özet. Bir hesap hatası görürsen dur ve bildir.
- Aynı dosya kümesine aynı anda iki yazar verme. `allow_file_edits: true` yalnızca briefte adı geçen dosyalar için.

## İş paketleri (sıra, model, efor)
| # | Paket | Bağımlılık | Yazan (delegate_subtask) | İnceleyen |
|---|---|---|---|---|
| P0 | Git + bağımlılık kurulumu (izinle) | – | sen | – |
| P1 | Sözleşmeler: BoreholeLayer, SoilProfile.origin, StructureSoilModel, şema 1.2 göçü, OpenAPI | P0 | sen | gpt-6.1-sol medium |
| E1 | Model + göç kodu + testler | P1 | gpt-reserve medium | gpt-6-luna low |
| E2 | Otomatik katmanlama (CPT Ic, SPT log/USCS+N) | E1 | gpt-6.1-sol high | claude-opus-5-5 medium |
| E3 | Parametre servisi (evaluate_all, istatistik, öneri, seçim/onay, kaynak izi) | E1 | gpt-6.1-sol high | gpt-6-astra high |
| E4 | Katmanlı duvar motoru (lateral_pressure tabanlı itki, katmanlı Coulomb/M-O, su, ağırlıklar, pasif, taşıma gücü+uyarı, global stabilite, limit_state ve servis imzaları) | E1 | gpt-6.1-sol xhigh | claude-opus-5-5 high + gpt-6-astra high |
| E4v | Regresyon + el hesabı + palplanş çapraz kontrol | E4 | gpt-6.1-sol high | sen |
| A1 | FastAPI: proje, içe aktarma, profil/katman CRUD, parametre öneri/onay, duvar öner/kontrol işleri (job+ilerleme), palplanş, katsayılar, i18n | P1 | gpt-reserve high | gpt-6.1-sol medium |
| F1 | Web iskeleti: Vite+React+TS, Mantine teması, router, iş akışı çubuğu, i18n, tipli istemci, mock | P1 | gemini-4-argon high | claude-sonnet-5-5 medium |
| F2 | Arazi verileri ekranları + sondaj logu editörü | F1,A1 | gemini-4-argon medium | sen (görsel QA) |
| F3 | Zemin modeli editörü + parametre kartı/onay | F1,E2,E3 | gemini-4-argon high | claude-opus-5-5 medium |
| F4 | İstinat duvarı sihirbazı + sonuç (SVG kesit, kullanım kartları) | F1,E4,A1 | gemini-4-argon high | claude-opus-5-5 medium |
| F5 | Palplanş, katsayılar, eksik katsayı formu, sıvılaşma | F1,A1 | gemini-4-argon medium | claude-sonnet-5-5 low |
| F6 | TR/EN metinleri, doğrulama mesajları, boş durumlar | F2–F5 | gemini-3.8-flash medium | gpt-6-luna low |
| T1 | API (httpx), Vitest, Playwright uçtan uca | A1,F* | gpt-6-luna medium / gpt-6.1-sol medium | sen |
| Q1 | Görsel QA (1366×768, 1920×1080, TR/EN, açık/koyu) | F* | sen + Agent(model: sonnet) | – |
| K1 | pywebview + PyInstaller paketleme; PySide6 arayüzünün kaldırılması | Q1 | gpt-reserve medium | sen |
| D1 | README, kılavuz, katsayı doğrulama dokümanı | K1 | gemini-3.8-flash low | sen |
Paralel kollar: E1 → (E2 ∥ E3 ∥ E4) → E4v ile F1 (mock API) aynı anda; A1 sözleşmeyle paralel.

Modüler yapı sonrası (2026-10-19) kalan işlerin yeni yeri (`docs/plans/MODULER_YAPI.md`, X3):
| # | Yeni yer |
|---|---|
| A1 | Çekirdek (`geotek/api/app.py`, oturum, işler) + `/api/m/<id>` altında modül yönlendiricileri |
| E2, E3, F2, F3 | Zemin modülü: `geotek/modules/soil`, `web/src/modules/soil` |
| F4 | Duvar modülü |
| F5 | `sheet_pile` ve `liquefaction` modülleri |
| K1 | PyInstaller: `geotek.modules.*` hidden-imports (yedek: `geotek/modules/_index.py`), modül `i18n/*.json` dosyaları datas |

Yeni modüller `tools/new_module.py` ile iskelelenir ve `docs/MODULE_GUIDE.md` kurallarına uyar.

## Kullanıcı onay kapıları (durup sor)
1) P1 sözleşmeleri, 2) E4 formül özeti + el hesabı sonuçları, 3) F1 tasarım sistemi ekran görüntüleri,
4) F3/F4 ilk çalışan sürüm, 5) paketleme öncesi.

## Delegasyon protokolü
- Her `delegate_subtask` çağrısı: `model`, `reasoning_effort` yukarıdaki tablodan; kod yazan işler için
  `allow_file_edits: true`, `cwd` proje klasörü, `timeout_sec` 1200–2400 (inceleme işleri için 600, salt okuma).
- Brief şablonu (her çağrıda eksiksiz yaz; model bu konuşmayı görmüyor):
  1. Amaç ve bağlam (2–4 cümle), 2. Okunacak dosyalar, 3. DOKUNABİLECEĞİ dosyalar (tam liste) ve dokunmayacakları,
  4. Sözleşme (imzalar/şemalar aynen), 5. Kurallar (yukarıdaki "Yapma" + i18n + kodlama), 6. Bitti tanımı ve
  çalıştırılacak test komutu, 7. Çıktı: değiştirilen dosyalar listesi + kısa özet + açık sorular.
- Teslimden sonra sen: diff'i oku, testleri çalıştır, sözleşmeye uyumu kontrol et; inceleyen modele salt okuma
  (`allow_file_edits: false`) inceleme gönder; bulguları yazan modele (veya küçükse kendin) düzelttir; sonra commit.
- Başarısız/uyumsuz teslimde aynı modelle bir kez düzeltme iste; ikinci başarısızlıkta bir üst kademeye yükselt
  (luna→sol, flash→argon, sol high→sol xhigh/astra).
- Dosya keşfi ve geniş aramalar için Claude Explore alt ajanı (model: haiku/sonnet); tasarım alternatifleri için Plan.
- Uzun süren komutları arka planda çalıştır; modal pencere açan kodu testte çalıştırma.

## Doğrulama (bitti tanımı)
- pytest tamamı geçer; tek tabaka regresyonu B=4.60 / seismic:bearing.
- Vitest + Playwright: örnek projeyi aç → CPT'den otomatik katman → parametre öner/onayla → duvarda profili seç →
  katman ekle → Boyut öner → boyut düzenle → Kontrol et; TBDY depremli durumda γRφ, γRc, γRcu eksik listelenir,
  değer girilince hesap çalışır.
- `python -m geotek.app` internet olmadan açılır; görsel QA ekran görüntüleri kullanıcıya gönderilir.
- README durum tablosu güncel.

## Başlangıç
1. Okunacak dosyaları oku, `orchestrator_status` ve `list_engine_capabilities` ile modelleri doğrula.
2. Kullanıcıya kısa durum + P0 için izin iste (Git, fastapi, uvicorn, pywebview, httpx, npm paketleri).
3. P1 sözleşmelerini yaz ve 1. onay kapısında dur.
