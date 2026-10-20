# Sonnet şef için çalışma protokolü

Başlangıç: `CLAUDE.md` → `STATUS.md` → **bir görev kartı**. Tüm planı her çağrıya ekleme.
Şef işi böler, dosya sahipliğini kontrol eder ve teslimi doğrular; bütün motoru zihninde taşımaz.

## Roller

| Rol | İş | Bağlam |
|---|---|---|
| Şef (Sonnet medium) | Kart seçimi, küçük sözleşme, dosya sahipliği, entegrasyon, durum güncellemesi | Başlangıç belgeleri + aktif kart |
| Uygulayıcı | Karttaki tek modül/özellik | Kart + belirtilen dosyalar ve imzalar |
| İnceleyici | Hata, sözleşme, regresyon incelemesi; salt okuma | Diff + test kanıtı + gereken kaynak |

MCP için `orchestrator_status` / `list_engine_capabilities` ile o oturumdaki araçları doğrula.
Model adını ve eforunu bu envanterden seç; eski prompt'taki model adını kopyalama.
Mantık/servis için kod ajanı; arayüz için UI ajanı; kritik inceleme için bağımsız güçlü model kullan.
Basit metin/dizin işi küçük modelle yapılabilir. Şefin basit bir düzeltmeyi doğrudan yapması serbesttir.
Bu depoda yeni model servisi veya bağımlılık kurulmaz; mevcut MCP/Agent araçları kullanılır.

## Bir iş döngüsü

1. Canlı Git durumuna bak. Kullanıcının dosyalarıyla devam eden başka iş var mı belirle.
2. Kartı tek test edilebilir teslim boyutuna indir. Bir çağrıda tercihen 1–5 üretim dosyası;
   daha geniş işte önce küçük teslimlerin sınırını çiz.
   Yer bulmak için önce `code_map_target` kullan; ardından gereken simgenin küçük aralığını
   `code_map_read` ile oku. Büyük CODE_MAP belgesini veya tüm dosyaları brief'e ekleme.
3. Yazılabilecek dosyaları **açık liste** olarak brief'e koy. Karttaki dizinler yalnız izin sınırıdır.
   İki yazıcının listeleri kesişiyorsa işleri sırala. Ortak tip/API değişikliğini önce şef netleştirir.
4. Delege et; `allow_file_edits: true` yalnız uygulayıcıda, incelemede `false`.
   Araç alan adları farklıysa gerçek araç şemasına uy; olmayan parametre uydurma.
5. Teslimi diff üzerinden incele; bildirilen testin gerçekten çalıştığını gör.
6. İlgili test → gereken inceleme → entegrasyon kontrolü. Başarılı ve değişmemiş paketi tekrar tekrar koşturma.
7. STATUS'ta tamamlananı ve sonraki kartı yaz; kullanıcıya kısa kanıt/risk raporu ver.

En çok iki eşzamanlı yazıcı. Mühendislik formülü gibi ortak bağımlılığı olan işi seri yürüt.
MCP zaman aşımı işi durdurmuş olmayabilir: yeni yazıcı başlatmadan önce çağrı/süreç/diff durumunu kontrol et.
Bir başarısız teslimde somut bulguyla bir düzeltme turu iste. Aynı hata sürerse kapsamı küçült veya
inceleyiciyi güçlendir; aynı geniş prompt'u tekrar gönderme.

## Kopyalanabilir brief

```text
Görev: <kart kimliği> / <bu teslimin somut amacı>
cwd: <git worktree list ile doğrulanan depo>
Oku: CLAUDE.md + docs/tasks/<kart>.md + <en çok ilgili birkaç dosya>
Yazabileceğin dosyalar: <tek tek yollar; dizin jokeri değil>
Sözleşme: <mevcut imza/DTO/route; değişecekse önceden kabul edilen biçim>
Korunacaklar: formül/katsayı, profil kaynağı, onay/stale, modül sınırı, TR/EN
Kabul: <gözlenebilir davranışlar + hata/iptal/stale koşulları>
Test: <tam komutlar ve gereken çalışma dizini>
Çıktı: değişen dosyalar; davranış özeti; test sonucu; açık bulgu (toplam kısa rapor)
Kapsam dışında dosya gerekirse yazmadan bildir; bağımsız kalan kısmı tamamla.
```

## Kontrol ve inceleme düzeyi

| Değişiklik | Gerekli kontrol |
|---|---|
| Belge / mekanik yerel düzeltme | Diff, bağlantı/yol ve ilgili araç kontrolü; gereksiz tam test yok |
| Bir modülün UI/servis davranışı | İlgili testler + salt okuma inceleme; UI'da typecheck |
| Ortak DTO/API/çekirdek, birleşme veya paket teslimi | `check full`; API değiştiyse sözleşme/tip üretimi |
| Hesap formülü/katsayı/yöntem | El hesabı + regresyon + iki bağımsız inceleme + kullanıcıya özet |

`check quick` yalnız sınır/manifest ve tip kontrolü için hızlı elemedir; tüm motor doğrulaması değildir.
`check full` modül indeksini denetler, pytest, typecheck, Vitest, build çalıştırır.
Kod haritasının güncelliği `check quick` ve `check full` içinde denetlenir; kaynak dosya eklenince
`tools/gen_code_map.py` ile belgeyi yenile. Canlı görünüm ve MCP sorgusu kaynaktan yeniden hesaplanır.
Çıktı `.project/logs/` içinde; başarısız adım ve çalışmayan adımlar ayrı raporlanır.
Sandbox/çalıştırıcı hatasında test “başarısız” veya “geçti” yazma; **çalıştırılamadı** de.
Görsel QA: gerçek ekran, TR/EN, açık/koyu, dar/geniş; mock ve gerçek API kanıtını ayrı belirt.

## Sözleşme ve devir

- Güncel HTTP gerçeği kod + `tests/api/test_contract.py` + üretilmiş OpenAPI'dir.
  `P1_CONTRACTS.md` ilk tasarım kaydıdır; 1.3 şema veya modül rotasını 1.2'ye geri çevirme.
- API değişiminde `.\.venv\Scripts\python.exe tools/export_openapi.py`, ardından
  `npm.cmd --prefix web run gen:api`; diff'i ve sözleşme testini kontrol et.
- `web/src/shared/api/types.ts` elle tutulan DTO aynasıdır; API değişiminde ayrıca uyumunu kontrol et.
- Yeni modül: `tools/new_module.py` ve `MODULE_GUIDE.md`. Üretilmiş indeks/tip elle düzenlenmez.
- Aktif görev ve sonuç STATUS'a; teknik kural değişikliği ilgili tek rehbere yazılır.
  Arşiv, geçmiş kararın kanıtıdır ve aktif komut listesi değildir.
- Commit/push, model/hesap ayarı, paket kurulumu gibi işlemlerde kullanıcının mevcut yetkisini esas al.
  Bu düzenleme otomatik commit/push veya global ayar değişikliği yapmaz.
