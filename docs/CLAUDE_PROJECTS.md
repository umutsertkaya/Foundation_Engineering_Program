# GeoTek'i Claude Code Projects ile yürütme

2026-10-20'de görülen mevcut proje **Foundation Engineering Program**; yerel konusu
**Foundation Engineering Tablolar oturumu** F5/Q1 çalışmasını sürdürüyor. Bu rehber,
mevcut bağlantı ve işi koruyarak talimatları ortaklaştırır. Yeni proje veya aynı işi
yapan ikinci bir yazıcı açmak gerekmez.

## Roller ve güncel bilgi

| Yer | Görevi |
|---|---|
| Projects konuşması | Kullanıcının hedefini izler, küçük işleri sıraya koyar; çalışandan kısa hedef/konum sonucu ister, bütün depoyu veya harita belgesini okumaz. |
| Yerel çalışan konu/thread | Gerçek depoyu okur, MCP araçlarını kullanır, kodu değiştirir ve test eder. |
| Depodaki `CLAUDE.md` | Paylaşılan çalışma ve mühendislik kuralları. |
| Depodaki `docs/STATUS.md` | Güncel iş, kanıt, açık karar ve sıradaki tek kart. |
| `docs/tasks/` ve `docs/WORKFLOW.md` | İş sınırı, kabul koşulları, delegasyon ve inceleme. |

Projects koordinatörünün connector erişimi yoktur. Yerel thread makinenin araç,
MCP ve ayarlarını kullanır; Projects instructions ile başlar, Projects memory
dosyaları yüklenmez. Dolayısıyla çalışan konu her başlangıçta depodaki giriş
belgelerini okumalıdır. Projects memory yerel STATUS'un kopyası yapılmamalıdır.
[Resmî Projects rehberi](https://code.claude.com/docs/en/claude-projects)

## Mevcut projeye uygulanacak aktarım

1. **Foundation Engineering Program** içinden **Project settings > Memory > Project instructions**
   alanını aç. [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md) dosyasının tamamını
   kopyalayıp alana yapıştır ve kaydet. Metin hazırdır; bu çalışma sırasında UI'a yüklenmedi.
2. **General** içinde Coordinator model/effort ile Thread model/effort ayrı seçilir;
   hedef koordinatör profili Sonnet / medium'dur. Bu rehber hesap ayarını değiştirmez.
3. Çalışan yerel konuya kod yazdırmadan önce aşağıdaki başlangıç mesajını Projects
   konuşmasına gönder. Devam eden F5/Q1 yazıcısını koru; doğrulanmadan yenisini açma.

Instructions değişikliği yeni thread'lere uygulanır; çalışan konuya yeni talimatın
özetini ayrıca iletmek gerekir. [Project settings davranışı](https://code.claude.com/docs/en/claude-projects#project-settings-reference)

```text
Foundation Engineering Program içindeki mevcut Foundation Engineering Tablolar oturumuyla
devam et; aynı klasörde ikinci yazıcı başlatma. Kaydettiğim Projects instructions'ı mevcut
konuya da ilet. Yerel çalışan önce CLAUDE.md, docs/STATUS.md ve seçili kartı okusun;
cwd, branch, HEAD, kirli dosyalar ve MCP araç sağlığını kısa raporlasın. MCP sağlık
denetiminde alt model çağırmasın. geotek-codemap güven onayı gerekiyorsa yerel Claude'da
bir kez tamamlanacağını bildirsin; aktif konuda araç erişimi doğrulanmadan var saymasın.
code_map_target ile hedefin en fazla üç ilgili dosya/sembol/route/test konumunu bulsun;
yalnız gereken yeri code_map_read ile sınırlı okusun. Devam eden işi
kesmeden kullanıcı hedefi kapsamında sıradaki küçük teslimi tamamlasın; gerçek test
kanıtı ve açık kararlarla kısa rapor versin. Eski planları yeniden başlatmasın.
```

Sonradan yeni yerel konu gerekirse Projects mesajındaki **+ > Work locally** ve mevcut
klasör kartı kullanılır. Klasör bağlantısı Desktop **Settings > Claude Code > Use this
computer from your phone and claude.ai** altında yönetilir. Bu mevcut bağlantının
eksik olduğu anlamına gelmez. [Yerel thread başlatma](https://code.claude.com/docs/en/claude-projects#run-a-thread-on-your-computer)

Yerel yürütme ve dosya erişimi bilgisayarda kalır; Remote Control için bilgisayar ve
Claude süreci açık olmalıdır. [Remote Control](https://code.claude.com/docs/en/remote-control)

## Az bağlamla hedefe ulaşma

Çalışma klasörü: `C:\Users\thebi\Documents\Foundation Engineering Tablolar`.

Grafiğin asıl amacı modelin bütün dosyaları okuyarak bağlam/token harcamasını
azaltmak ve onu görevin ilgili yerine götürmektir. Varsayılan çalışan akışı:

1. `code_map_target(goal=...)`: Türkçe veya İngilizce somut hedef ver. Kısa sonuçta
   en fazla üç dosya, sembol/satır aralığı, ilgili API rotası ve test konumu bulunur;
   kaynak kod taşınmaz. Koordinatöre bu kısa konum sonucu dönsün.
2. Yalnız gerekli parça için `code_map_read(file=..., symbol=...)` veya
   `code_map_read(file=..., start_line=...)` kullan; `max_lines <= 40`,
   `max_chars <= 3000`. Daha fazla kod gerekiyorsa gerekçeli sonraki parçayı iste.
3. Değişiklik etkisi ayrıca gerekli olduğunda `code_map_impact` kullan. Yardımcı
   arama/route/dosya araçları gerektiğinde kullanılır; hepsini her işte çağırma.

Araç adları ve argümanları aktif oturumdaki gerçek şemadan doğrulanır. İndeksleyici
kaynakları yerelde okuyup önbellekleyebilir; bu, bütün kaynakların model bağlamına
girdiği anlamına gelmez. Modele yalnız sınırlı araç sonucu ve istenen parça aktarılır.
Ölçülmüş token kazancı veya çalışma zamanı izleme iddiası yoktur.

Grafik import, API bağlantısı, modül keşfi ve test ilişkilerini koddan çıkarır.
Statik olarak çıkarılmış bağlar çalışma zamanı izi veya test başarı kanıtı değildir.
`docs/CODE_MAP.md` büyük bir insan referansıdır; başlangıçta veya normal hedef
aramasında tamamını modele okutma. Görsel görünüm de isteğe bağlı insan incelemesidir:

```powershell
.\.venv\Scripts\python.exe tools/code_map_view.py --port 8766
```

Tarayıcı: `http://127.0.0.1:8766`. Bu ekranı açmak ajan navigasyonunun ön koşulu değildir.

Son CLI envanterinde `ai-orchestrator` bağlı, `geotek-codemap` **Pending approval**
durumunda görüldü. `geotek-codemap` için kullanıcı yerel Claude oturumunda bir kez
proje MCP güven onayını vermelidir. Bu onay otomatik verilmedi; sonrasında aktif
çalışanın araç listesi ve `code_map_check` sonucu doğrulanır. CLI bağlantı durumu,
halen çalışan konuya yeni araçların yüklendiğini tek başına kanıtlamaz. Mevcut
yazıcıyı kesme; gerekiyorsa teslim sonrası taze yerel konuda doğrula.

MCP başlatıcısı, indeks ve kaynak önbelleği yereldir. Grafiğin güncellenmesi Library
senkronizasyonu değildir.

Library'ye klasör eklemek canlı bağlantı kurmaz: yükleme kopyadır; klasörün ilk 100
dosyası alınır, gizli dosyalar ve `node_modules` atlanır. Sonraki yerel değişiklikler
yeniden yükleme gerektirir. Kod deposunu Library kopyasından yönetme.
[Dosya/klasör yükleme sınırları](https://code.claude.com/docs/en/claude-projects#add-files-and-folders)

Bu aktarım global ayar, izin, hesap/MCP kimlik bilgisi veya proje talimatı yüklemesi
yapmaz. Açık insan onayları ve mühendislik inceleme sınırları STATUS'ta korunur.

## Takılmayı ayırt etme

| Belirti | Kontrol |
|---|---|
| Konu “komut çalışıyor” diyor | İlgili `.project/logs/` dosyası ilerliyor mu bak; tam Python paketi bu makinede yaklaşık altı dakika sürebilir. Aynı işi ikinci konuya başlatma. |
| Waiting on you / izin bekliyor | Konunun kendi kartını aç; Projects ana konuşmasına verilen izin, içteki araç izninin yerine geçmez. |
| Teslim bitti ama hedef sürüyor | Koordinatör kısa kanıtı alıp STATUS'taki sıradaki teslimi başlatsın; ilk teslimi tüm hedefin sonu saymasın. |
| MCP araçları yok | Yerel konu, proje MCP güven onayı ve gerçek araç listesini denetle. CLI `claude mcp list` kontrolü aktif konudaki erişimi tek başına kanıtlamaz. |
| Harita eski | `code_map_check` ile doğrula; hedef araması için MCP indeksini kullan. İnsan Markdown referansı gerektiğinde `node tools/run_python.cjs tools/gen_code_map.py` ile yenilenir. |

`.mcp.json` başlatıcısı mevcut Python'u Windows, Linux veya Git worktree kökünde bulur;
paket kurmaz. `.claude/launch.json` içindeki `geotek-codemap` önizlemesi 8766 portunu kullanır.
Yeni MCP yapılandırması ve Projects talimatı için mevcut çalışan konuyu kesme;
teslim bittikten sonra başlayan taze yerel konuda araç envanterini tekrar doğrula.
