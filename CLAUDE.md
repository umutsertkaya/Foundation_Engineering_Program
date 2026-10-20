# GeoTek — kısa çalışma talimatı

Bu depo yerel geoteknik uygulamasıdır: Python hesap motoru + FastAPI + React/TypeScript.
Şef için hedef çalışma profili Sonnet 5.5 / medium; mühendislik işleri küçük kapsamlarla delege edilir.
Model seçimi oturumda yapılır; bu dosya hesabın veya MCP sunucusunun ayarlarını değiştirmez.

## Oturum başlangıcı

1. Bu dosyayı ve [docs/STATUS.md](docs/STATUS.md) dosyasını oku.
2. `git status --short` ve `git log -5 --oneline` ile durumu kontrol et.
3. STATUS içindeki sıradaki **tek** görev kartını oku. Sadece kartın ilgili kodunu aç.
4. Delegasyon yapacaksan [docs/WORKFLOW.md](docs/WORKFLOW.md) protokolünü kullan.
5. Yolunu bulamıyorsan [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); yeni modül için
   [docs/MODULE_GUIDE.md](docs/MODULE_GUIDE.md). Arşivi başlangıç bağlamına yükleme.

## Değişmez kurallar

- Kullanıcıyla Türkçe; kod/isimler/docstring İngilizce. UI metni TR/EN i18n anahtarından gelir.
- Katsayı veya kaynak uydurma. Eksik mühendislik girdisini açık göster; sessiz varsayım ekleme.
- Hesap formülü/katsayısı değişirse el hesabı/regresyon + iki bağımsız salt okuma incelemesi
  + kullanıcıya formül özeti gerekir. Hesap hatasını gizleme; etkilenen hesabı durdurup bildir.
- Profil kaynağını yapı düzenlerken değiştirme; yapıya özel kopya, onay ve stale/hash denetimlerini koru.
- Modüller birbirini import etmez. Ortak kod `core`, `services`, `shared` içinde kalır.
- Aynı dosyaya aynı anda tek yazar. Şef ortak sözleşme ve entegrasyonun sahibidir.
- Kullanıcının mevcut değişikliklerini koru. Git reset/clean, worktree silme veya eski dalı
  yeniden birleştirme işlemlerini görev doğrulaması olmadan yapma.
- Önceki onaylar ve açık onaylar STATUS'ta. Eski P0/P1/E4 işlerini yeniden başlatma.
- Mock ekran/test başarısı gerçek API ve mühendislik doğrulamasının yerine geçmez.
- `geotek/ui` eski PySide6 yoludur; web eşdeğerliği ve paketleme doğrulanmadan kaldırma.

## Komutlar (PowerShell, depo kökü)

```powershell
.\.venv\Scripts\python.exe tools/project.py status
.\.venv\Scripts\python.exe tools/project.py brief F5-LIQ
.\.venv\Scripts\python.exe tools/project.py check quick
.\.venv\Scripts\python.exe tools/project.py check full
```

`check backend` yalnız Python paketini; `check web` typecheck, Vitest ve build'i çalıştırır.
Kontrol komutları paket kurmaz, Git'i değiştirmez. Uzun çıktılar `.project/logs/` içine gider.
Küçük değişiklikte ilgili testi çalıştır; bütün paketi entegrasyonda veya ortak sözleşme değişince çalıştır.
Windows sandbox engeli test hatası değildir; izinli çalıştırma yolunu kullan ve çalışmayan kontrolü açık yaz.

## Kod haritası

Amaç modelin düşük bağlamla hedef bulmasıdır. Varsayılan akış:

1. `code_map_target(goal="Türkçe veya İngilizce somut hedef")`: birkaç dosya, gerçek simge/satır,
   ilgili rota ve test konumu. Bu aşamada kaynak kodu okunmaz; tüm harita çıktısı istenmez.
2. Yalnız gereken dosya/simge için `code_map_read(file=..., symbol=...)` veya `start_line=...`;
   küçük satır/karakter sınırını koru. Aralığı gerektiğinde genişlet; dosyanın tümünü baştan okuma.
3. Değişiklik etkisi için gerektiğinde `code_map_impact`; ayrıntıda `code_map_file` / `code_map_route`.

İndeksleyici kodu yerelde tarar; modeli besleyen yanıt yalnız seçilen küçük kesittir.
MCP onayı/erişimi yoksa `rg` ile isim/rota bulup dar satır aralığı oku; bütün depoyu yükleme.
[docs/CODE_MAP.md](docs/CODE_MAP.md) büyük, üretilmiş başvuru belgesidir; başlangıçta okunmaz.
Yenileme: `node tools/run_python.cjs tools/gen_code_map.py`; `--check` eskiyse 1 döner.
İnsan incelemesi için yardımcı görünüm: `node tools/run_python.cjs tools/code_map_view.py` →
`http://127.0.0.1:8766`. Import/API ve bilinen keşif bağları çalışma zamanı çağrı izi değildir.

## Claude Code Projects

Projects koordinatörü yerel MCP'ye doğrudan erişmez; dosya/kod haritası işi mevcut klasöre
bağlı **yerel konuya** verilir. Yerel konu başlangıçta cwd/branch/commit/değişiklik durumunu
doğrular ve bu dosyayı okur. Projects memory yerel konuya otomatik yüklenmediğinden
kalıcı depo kuralını burada, güncel işi STATUS'ta tut. Aynı klasörde tek yazıcı kullan.
Kurulum ve yapıştırılacak talimat: [docs/CLAUDE_PROJECTS.md](docs/CLAUDE_PROJECTS.md).

## Bitirme

Diff'i incele, gerekli testleri ve görev kabul koşullarını doğrula. Yapılan/değişen/riskli noktaları
kısa raporla; yalnız `docs/STATUS.md` içindeki güncel durumu değiştir. Geçmiş prompt'lara yeni not ekleme.
Her test kaydında tarih, kapsam ve gerçek sonucu belirt; eski sayıyı güncel başarı diye kullanma.
