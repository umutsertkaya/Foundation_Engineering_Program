# Orkestrasyon protokolü

Başlangıç: `CLAUDE.md` → `STATUS.md` → **bir görev kartı**. Tüm planı her çağrıya ekleme.
Şef işi böler, motoru/modeli/eforu seçer, dosya sahipliğini kontrol eder ve teslimi doğrular.

## Katmanlar

| Katman | Nerede | İş |
|---|---|---|
| Koordinatör | Claude Projects ana konuşması | Kullanıcı hedefini izler; her bağımsız görev için ayrı konu (thread) açar. |
| Konu şefi | Projects konusu + cihazdaki Claude Code oturumu (Remote Control) | Tek kartı yürütür; yerel MCP'yi (`ai-orchestrator`, `geotek-codemap`) yalnız cihazdaki oturum çağırabilir. |
| Alt ajan | Codex / Antigravity: cihazdaki Claude Code oturumundan `ai-orchestrator` ile. Claude: Projects konusunun kendi içinde `Agent` aracıyla | Brief'teki tek teslimi yapar veya salt okuma inceler. |

Her bağımsız görev ayrı konudur. Aynı klasörde aynı anda tek yazıcı çalışır; paralel yazıcı
konuları `Documents/geotek-wt/<kart>` altında ayrı Git worktree kullanır.
**Claude alt ajan kuralı (Umut, 2026-10-20):** Claude modelleriyle yapılacak işler (uygulama, inceleme, araştırma)
cihazdaki Claude Code oturumunda değil, ilgili Projects konusunun içinde `Agent` aracıyla çalıştırılır.
Cihazdaki oturum yalnız Codex/Antigravity çağrıları (`ai-orchestrator`) ve cihaz zorunlu işler (Windows paketleme,
gerçek ekran, yerel worktree) içindir. Claude modelleri `ai-orchestrator` üzerinden çağrılmaz (sunucu reddeder).
Kural yeni başlayan konulara uygulanır; çalışan bir görevin yarısında yöntem değiştirilmez.

## Kipler

`docs/MODE`: `device` = yukarıdaki tablo olduğu gibi (MCP + Codex/Antigravity). `cloud` = MCP yok, Codex/Antigravity
çağrılmaz; tüm uygulama ve incelemeler Claude `Agent` alt ajanlarıyla yapılır (S0–S1 Haiku/Sonnet, S2–S3 Sonnet/Opus,
S4 iki bağımsız Claude incelemesi). Geçiş: `python3 tools/set_mode.py cloud|device`; ayrıntı [CLOUD_MODE.md](CLOUD_MODE.md).

## Model ve efor yönlendirmesi

Önce `orchestrator_status` / `list_engine_capabilities` ile envanteri doğrula (model çağırmaz).
Varsayılan, işi yapabilen **en ucuz** seviyedir. Tabloyu aşmak için gerekçe yaz.

| Seviye | Örnek iş | Uygulayıcı | Yedek | İnceleme |
|---|---|---|---|---|
| S0 mekanik | Belge, i18n anahtarı, yeniden adlandırma, tek dosya mekanik düzeltme | `gemini-3.8-flash` low | `gpt-6-luna` low | Şef diff'e bakar |
| S1 basit | Tek modülde küçük UI/servis değişikliği, test ekleme | `gpt-6-luna` medium | `gemini-3.8-flash` high | İlgili test |
| S2 orta | Bir modülde özellik, 2–5 dosya, hata ayıklama | `gpt-6.1-sol` medium | `gemini-4-argon` medium, Claude Sonnet | Farklı motordan salt okuma (`gemini-3.8-flash` high) |
| S3 zor | Ortak API/DTO, çok modüllü entegrasyon, zor hata | `gpt-6.1-sol` high | `gemini-4-argon` high, Claude Opus | Farklı motordan bağımsız inceleme (`gemini-4-argon` medium) |
| S4 kritik | Hesap formülü/katsayı/yöntem | `gpt-6-astra` high | Claude Opus high | **İki** bağımsız salt okuma: `gemini-4-argon` high + Claude Opus (`orchestrator_consensus` kullanılabilir) |
| Görsel QA | Gerçek ekran, TR/EN, açık/koyu, dar/geniş | Antigravity `gemini-4-argon` medium (tarayıcı) | Claude Code tarayıcı araçları | İnsan onayı kapısı STATUS'ta |
| Planlama/brief | Kart bölme, sözleşme taslağı | Konu şefi (Claude) | `gpt-6.1-sol` medium | — |

Yükseltme: bir başarısız turda aynı modelle eforu bir kademe artır; ikinci başarısızlıkta bir üst seviyeye geç.
`xhigh`/`max`/`ultra` yalnız bu yükseltmede veya S4'te. Aynı geniş prompt'u tekrar gönderme; kapsamı küçült.

## Bir iş döngüsü

1. Canlı Git durumuna bak; aynı klasörde süren başka yazıcı var mı belirle.
2. Kartı tek test edilebilir teslime indir (tercihen 1–5 üretim dosyası). Seviyeyi tablodan seç.
3. Konumu `code_map_target` ile bul; brief'e yalnız dosya yolu/simge/satır aralığı koy, kodu yapıştırma.
4. Yazılabilecek dosyaları **açık liste** olarak ver. Listeler kesişiyorsa işleri sırala.
5. Delege et: uygulayıcıda `allow_file_edits: true`, incelemede `false`. Uzun brief'i dosyaya yazıp
   kısa prompt'ta o dosyayı okut (sunucu 24 000 karakter üstünü reddeder).
6. Teslimi diff üzerinden incele; bildirilen testin gerçekten çalıştığını gör.
   Alt ajan çıktısı 6000 karakterle kırpılır, tamamı `.project/logs/orchestrator/` içindedir; gerekmedikçe açma.
7. Kaynak eklendi/silindiyse kod haritasını yenile ve `--check` doğrula.
8. STATUS'ta biteni ve sonraki kartı yaz; kısa kanıt/risk raporu ver.

MCP zaman aşımında sunucu süreç ağacını sonlandırır; yine de yeni yazıcıdan önce `git status`/diff kontrol et.

## Bağlam ve compact kuralı

- Asıl karar ölçütü **mevcut adımın bitmesidir**: bir adımın ortasında compact yapılmaz.
- Adım bittiğinde bağlam yaklaşık **%30**'u geçtiyse compact yap. Teslim/kart bitince her durumda compact
  yap veya sonraki işi taze oturumda başlat.
- Compact öncesi STATUS "Aktif iş" bölümüne üç satır yaz: biten adım + kanıt, sıradaki adım, açık karar.
- Compact sonrası yalnız `CLAUDE.md`, STATUS "Aktif iş" ve aktif kart yeniden okunur.
- Codex alt ajanları `--ephemeral` çalışır; her çağrı taze bağlamla başlar, brief kendi kendine yetmelidir.

## Özerklik

Modeller izin/onay beklemeden sıradaki küçük teslime geçer. Yalnız şu durumlarda durup kullanıcıya sorulur:

- Mühendislik kararı veya formül/katsayı/yöntem değişikliği (formül özeti sunulur),
- STATUS'taki açık insan onay kapıları (görsel kapı 3, kapı 4, paketleme öncesi),
- Geri alınamayan işlem: push, silme, reset/clean, worktree kaldırma, global ayar değişikliği,
- Gerçekten netleştirilmesi gereken muğlaklık (makul varsayılan yoksa).

## Kopyalanabilir brief

```text
Görev: <kart> / <bu teslimin somut amacı>   Seviye: <S0–S4>
cwd: <git worktree list ile doğrulanan yol>
Oku: CLAUDE.md + docs/tasks/<kart>.md + code_map_target sonucu: <dosya:satır listesi>
Yazabileceğin dosyalar: <tek tek yollar>
Sözleşme: <mevcut imza/DTO/route; değişecekse kabul edilen biçim>
Korunacaklar: formül/katsayı, profil kaynağı, onay/stale, modül sınırı, TR/EN
Kabul: <gözlenebilir davranışlar + hata/iptal/stale koşulları>
Test: <tam komutlar ve çalışma dizini>
Çıktı: değişen dosyalar; davranış; gerçek test sonucu; açık bulgu (en çok 15 satır)
Kapsam dışında dosya gerekirse yazmadan bildir; bağımsız kalan kısmı tamamla.
```

## Kontrol ve inceleme düzeyi

| Değişiklik | Gerekli kontrol |
|---|---|
| Belge / mekanik yerel düzeltme | Diff, bağlantı/yol kontrolü; tam test yok |
| Bir modülün UI/servis davranışı | İlgili testler + salt okuma inceleme; UI'da typecheck |
| Ortak DTO/API/çekirdek, birleşme | `check full`; API değiştiyse sözleşme/tip üretimi |
| Hesap formülü/katsayı/yöntem | El hesabı + regresyon + iki bağımsız inceleme + kullanıcıya özet |

`check quick` sınır/manifest/tip ve kod haritası güncelliği için hızlı elemedir. `check full` modül indeksi,
pytest, typecheck, Vitest ve build çalıştırır. Başarılı ve değişmemiş paketi tekrar koşturma.
Görsel QA: gerçek ekran, TR/EN, açık/koyu, dar/geniş; mock ve gerçek API kanıtını ayrı belirt.

## Sözleşme ve devir

- Güncel HTTP gerçeği kod + `tests/api/test_contract.py` + üretilmiş OpenAPI'dir. `P1_CONTRACTS.md` ilk tasarım kaydıdır.
- API değişiminde `.\.venv\Scripts\python.exe tools/export_openapi.py`, ardından `npm.cmd --prefix web run gen:api`.
- `web/src/shared/api/types.ts` elle tutulan DTO aynasıdır; API değişiminde uyumunu kontrol et.
- Yeni modül: `tools/new_module.py` ve `MODULE_GUIDE.md`. Üretilmiş indeks/tip elle düzenlenmez.
- Aktif görev ve sonuç STATUS'a; teknik kural değişikliği ilgili tek rehbere yazılır. Arşiv aktif talimat değildir.
