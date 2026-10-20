# T10 (Q1) uçtan uca kabul raporu — 2026-10-20

Kip: cihaz. Taban: `main` @ `edd4099`. Gerçek FastAPI (uvicorn, 127.0.0.1:8765, yalıtılmış ayar/kitaplık) + Vite
(5173, `/api` proxy) + Edge/Playwright ekran görüntüleri. Formül/katsayı değişmedi.

## 1. `tools/project.py check full` (gerçek sonuç)
- code-map, module-index: PASS.
- pytest: **1841 geçti, 1 atlandı (symlink), 1 BAŞARISIZ**: `tests/api/test_walls_api.py::test_five_metre_wall_regression_size_then_check_and_persist`
  (`POST /api/project/save` ile `.pytest_tmp` altına yazarken 400). Tek başına yeniden koşuldu: **geçti** (21 sn).
  Tam koşu 8,5 dk sürdü ve aynı anda uvicorn/Playwright/Vite çalışıyordu; ortam kaynaklı kesişen hata sanılıyor,
  ama tekrarlanamadığı için **kök neden doğrulanmadı** (açık gözlem).
- `check full` ilk hatada web adımlarını çalıştırmadı ("NOT RUN"); `check web` ayrıca koşuldu:
  typecheck PASS, Vitest **32 dosya / 299 test geçti**, build PASS.
- `gen_code_map.py --check` → 0.

## 2. Gerçek API uçtan uca (`docs/qa/t10_e2e.py`, 61 adım PASS, 0 FAIL; çıktı `docs/qa/t10/e2e-run.txt`)
Yeni proje → CPT (TR csv `;` `,`) + SPT içe aktarma → eksik YASS reddi (422) → CPT işleme → SBTn + referans →
USCS (tekil, geçersiz 422) → katmanlama önerisi → profil → parametre öner/seç/onayla → duvar öner (size) + kontrol,
palplanş tasarım, sıvılaşma (hepsi iş takibiyle `done`) → rapor docx **TR ve EN** (200; zip + `python-docx` ile açılıyor,
11 tablo; duvar/palplanş/sınıflandırma/sıvılaşma bölümleri dolu) → iş iptali (DELETE → `cancelled`), bilinmeyen iş 404 →
yanlış girdiler (duvar h=0, negatif palplanş, amax=9, bozuk CSV) 4xx → kaydet/kapat/aç: sonuç ve hash korunur, stale yok →
profilde φ' değişince yapılar **stale**, rapor 409 `stale_result`, sonuçsuz yapı 409 `no_result` → soil resync + yeniden kontrol → stale kalkar.
Eksik s_u (drenajsız katman): iş `failed` + açık hata (sessiz varsayım yok).
Docx örnekleri: `docs/qa/t10/T10-rapor-tr.docx`, `-en.docx`.

## 3. Ekranlar (T11 girdisi; görsel QA T11'in işi)
`docs/qa/t10/*.png`: 12 sayfa × 1366×768 ve 800 px (açık tema, TR). Tarayıcı konsolunda yalnız 1 adet 404 (muhtemelen favicon), JS hatası yok.
Koyu tema ve EN ekran görüntüleri alınmadı. Açık insan onayları (görsel kapı 3, F3/F4 kapı 4) hâlâ açık; bu rapor onay yerine geçmez.

## 4. Bulgular
**Düzeltildi (dal `fix/t10-report-section-labels`):** rapor sayfasında sınıflandırma ve sıvılaşma satırları boş etiketliydi
(sunucu `name=""` döndürüyor) → `report.section.<kind>` çevirisine geri düşüş + Vitest.
**Karta alındı** → [T10c-UI-LABELS](../tasks/T10c-UI-LABELS.md): (1) katman etiketleri UUID gösteriyor; (2) motor hata iletisi ham İngilizce + UUID;
(3) docx içinde çevrilmemiş İngilizce uyarılar (palplanş "Tension zone…", sıvılaşma "Default FC…"; T10b ile ilişkili);
(4) sıvılaşma sonuç sayfası kayıtlı sonucu yüklemiyor (sunucuda var, rapora giriyor); (5) SBTn bölge özetinde sıfır kalınlıklı satırlar (`1.40–1.40`);
(6) geçen duvarda "Belirleyici kontrol: -".
**Açık gözlem:** yukarıdaki tekrarlanamayan pytest hatası. T10b maddeleri (Antigravity/Codex incelemesi dahil) bu görevde ele alınmadı.
Not: φ'=25° ile duvar kontrolü başarısız ve taşıma gücü kullanım oranı 45 çıktı (e büyük → B' küçük); formül alanı, değerlendirilmedi.
