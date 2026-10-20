# GeoTek — ortak çalışma kuralları

Bu depo yerel geoteknik uygulamasıdır: Python hesap motoru + FastAPI + React/TypeScript.
Bu dosya Claude, Codex (`AGENTS.md`) ve Antigravity (`GEMINI.md`) için ortak kuraldır.
Orkestrasyon, model yönlendirme ve compact kuralı: [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Oturum başlangıcı

1. Bu dosyayı ve [docs/STATUS.md](docs/STATUS.md) dosyasını oku.
2. `git status --short` ve `git log -5 --oneline` ile durumu kontrol et.
3. Sana verilen **tek** görev kartını oku (`docs/tasks/`). Sadece kartın ilgili kodunu aç.
4. Şefsen [docs/WORKFLOW.md](docs/WORKFLOW.md) protokolünü kullan.
5. Yolunu bulamıyorsan [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); yeni modül için
   [docs/MODULE_GUIDE.md](docs/MODULE_GUIDE.md). Arşivi (`docs/archive/`) başlangıç bağlamına yükleme.

## Değişmez kurallar

- Kullanıcıyla Türkçe; kod/isimler/docstring İngilizce. UI metni TR/EN i18n anahtarından gelir.
- Katsayı veya kaynak uydurma. Eksik mühendislik girdisini açık göster; sessiz varsayım ekleme.
- Hesap formülü/katsayısı değişirse el hesabı/regresyon + iki bağımsız salt okuma incelemesi
  + kullanıcıya formül özeti gerekir. Hesap hatasını gizleme; etkilenen hesabı durdurup bildir.
- Profil kaynağını yapı düzenlerken değiştirme; yapıya özel kopya, onay ve stale/hash denetimlerini koru.
- Modüller birbirini import etmez. Ortak kod `core`, `services`, `shared` içinde kalır.
- Aynı dosyaya aynı anda tek yazar; aynı klasörde aynı anda tek yazıcı. Paralel yazıcı ayrı Git worktree kullanır.
- Kullanıcının mevcut değişikliklerini koru. Git reset/clean, worktree silme, push veya eski dalı
  yeniden birleştirme işlemlerini kullanıcı onayı olmadan yapma.
- Önceki onaylar ve açık onay kapıları STATUS'ta. Eski P0/P1/E4 işlerini yeniden başlatma.
- Mock ekran/test başarısı gerçek API ve mühendislik doğrulamasının yerine geçmez.
- `geotek/ui` eski PySide6 yoludur; web eşdeğerliği ve paketleme doğrulanmadan kaldırma.

## Komutlar (PowerShell, depo kökü)

```powershell
.\.venv\Scripts\python.exe tools/project.py status
.\.venv\Scripts\python.exe tools/project.py brief <KART>
.\.venv\Scripts\python.exe tools/project.py check quick
.\.venv\Scripts\python.exe tools/project.py check full
```

`check backend` yalnız Python paketini; `check web` typecheck, Vitest ve build'i çalıştırır.
Kontrol komutları paket kurmaz, Git'i değiştirmez. Uzun çıktılar `.project/logs/` içine gider.
Küçük değişiklikte ilgili testi çalıştır; bütün paketi entegrasyonda veya ortak sözleşme değişince çalıştır.
Windows sandbox engeli test hatası değildir; çalıştırılamayan kontrolü **çalıştırılamadı** diye yaz.

## Kod haritası (zorunlu, düşük bağlam)

Kodda yer ararken dosyaları baştan okuma; `geotek-codemap` MCP araçlarını kullan:

1. `code_map_target(goal="somut hedef")`: en fazla üç dosya, simge/satır, rota ve test konumu.
2. Yalnız gereken parça için `code_map_read(file=..., symbol=... | start_line=...)`.
   Varsayılan 40 satır / 3000 karakter; üst sınır 80 / 5000. Gerekirse sonraki aralığı iste.
3. Değişiklik etkisi için `code_map_impact`; ayrıntıda `code_map_file` / `code_map_route`.

MCP yoksa `rg` ile isim/rota bulup dar satır aralığı oku. `docs/CODE_MAP.md` büyük, üretilmiş
insan başvurusudur; okunmaz. Harita statik çıkarımdır; çalışma zamanı izi veya test kanıtı değildir.

**Güncel tutma:** kaynak dosya ekleyen, silen veya simge imzası değiştiren her yazıcı teslimden önce
`node tools/run_python.cjs tools/gen_code_map.py` çalıştırır; `--check` 0 dönmeden "tamam" denmez.

## Bitirme

Diff'i incele, gerekli testleri ve kart kabul koşullarını doğrula. Değişen dosyalar, davranış, gerçek
test sonucu ve açık bulgularla kısa rapor ver (en çok ~15 satır). Güncel durumu yalnız `docs/STATUS.md`'ye yaz.
Her test kaydında tarih, kapsam ve gerçek sonucu belirt; eski sayıyı güncel başarı diye kullanma.
