# GeoTek v2: devam notları

Duraklatma tarihi: 2026-10-16, son commit `00fdba2`. Çalışma ağacı temiz; arka planda çalışan ajan ya da model yok.

Yönergeler:
- Orkestra yönergesi: `docs/ORKESTRA_PROMPT.md`.
- Sözleşmeler: `docs/contracts/P1_CONTRACTS.md`.
- Formüller: `docs/contracts/E4_FORMULAS.md`.

## Durum

| Paket | Durum |
|---|---|
| P0 Git + bağımlılıklar | Tamam |
| P1 sözleşmeler | Tamam, kullanıcı onayladı (kapı 1) |
| E1 model + göç 1.2 | Tamam |
| F1 web iskeleti | Tamam. Kapı 3 **onaylanmadı**; kullanıcı zemin yönetimini istedi, bkz. "Zemin arayüzü" |
| Zemin arayüzü (F3'ün öne çekilen kısmı) | Tamam: zemin kolonu ve desenler, katman editörü, profil ana-detay ekranı, duvar Zemin adımında bölgeli kesit. Ekran görüntüleri `docs/qa/soil/`. Kullanıcının görsel onayı bekleniyor |
| E4 katmanlı duvar motoru | Kod ve testler tamam (576 test geçiyor). Kapı 2 kararları uygulandı. **Chunk C bekliyor** (aşağıda) |
| E2, E3, A1, F2, F4–F6, T1, Q1, K1, D1 | Başlamadı |

## Kapı 2'de kullanıcının verdiği kararlar

1. Su altı dolguda deprem: TBDY 2018 Denk. 16.26/16.20 uygulandı; varsayılan "zarf", mühendise uyarı gösteriliyor. Kaynak: `docs/research/submerged_seismic_thrust.md`.
2. Tasarım seçimleri kullanıcının kontrolünde; varsayılan güvenli taraf. Örnek: `uplift_moment = "overturning"`.
3. Nγ için YASS geçiş düzeltmesi eklendi (Das). `gwt_bearing_correction = True`.
4. Kısmi katsayılı global stabilitede yük katsayıları uygulanıyor.

## Sıradaki iş: E4 chunk C

Yeniden gönderilecek; gpt-6.1-sol high, taze oturum. Codex aşağıdaki brief'le çalışıyordu, duraklatılırken durduruldu ve hiçbir dosyaya dokunmamıştı. İçerik:

1. **TBDY Denk. 16.24b dalı** (= EN 1998-5 E.3, β > φ' − θ). Yeni fonksiyon: `coefficients.tbdy_kae_steep`.
   - Yalnız katmanlı TBDY yolunda kullanılır; şu an motor bu durumda hata veriyor.
   - Bu dalda δ = 0 alınır; δ ≠ 0 girilmişse uyarı verilir.
   - Testler: sınırda (β = φ' − θ) iki dalın sürekliliği ve bağımsız hesaplanmış bir sayısal değer.
2. **±kv zarfı**: `WallSettings.kv_sign = "envelope" | "up" | "down"`, varsayılan "envelope".
   - Her kontrolde elverişsiz işaret alınır (TBDY 16.12.2.3).
   - Ölçüm: 5 m BASIC duvarda +kv ile B = 4.60, −kv ile B = 4.50. Zarf B = 4.60'ı korur.
   - Opus incelemesine göre su altı geçirimsiz örnekte (1+kv) itkiyi %20 artırıyor.
   - Eski `walls_basic` yolu değişmeyecek.
3. Su altı deprem dalına yalnız kh veya kv sıfırdan farklıysa girilecek (`layered.py` ~286).
4. Su altında zemin varken etkin r > 1 ise uyarı verilecek; r kullanıcı tarafından girilmiş olsa da.
5. Karışık permeabilite yaklaşımı "doğrulanmamış mühendislik yaklaşımı" olarak etiketlenecek; "güvenli" denmeyecek.
6. `E4_FORMULAS.md` §3 güncellenecek.

Sonrasında:
- tam pytest çalıştırılır;
- `tools/export_openapi.py` ve `npm --prefix web run gen:api` ile tipler yenilenir, typecheck yapılır;
- iki bağımsız inceleme yapılır: Claude Opus (kendi alt ajanı) ve gpt-6-astra;
- commit atılır;
- kullanıcıya kapı 2 kapanış özeti sunulur.

## Açık konular

- KDYY "Tasarım ve Uygulama Esasları" (16.07.2026 değişikliği) ve Tasarım El Kitabı (Temmuz 2023) okunamadı: dosyalar 10 MB'ı aşıyor ya da sertifika hatası veriyor. Kullanıcı PDF'leri yerel olarak sağlarsa incelenecek.
- Yeni motor seçenekleri arayüze bağlanacak (F4 duvar sihirbazı):
  - `uplift_moment`, `gwt_bearing_correction`, `submerged_seismic`, `kv_sign`
  - katman `permeability`
  - `passive_reduction` onayı
- Vite paket boyutu uyarısı (~685 kB): kod bölme ileride (K1 öncesi) yapılacak.
- `walls_basic` (eski PySide6 yolu) tek kv işareti kullanıyor. PySide6 kaldırılınca yapı servisine geçilecek.

## Ortam notları

- Git PATH'te değil: `& "C:\Program Files\Git\cmd\git.exe"`.
- Testler: `.venv\Scripts\python.exe -m pytest -q` (~2 dk), `npm --prefix web run test|typecheck|build`.
- Mock arayüz: `.claude/launch.json` → `web-mock` (port 5173).
- Codex ve Antigravity sandbox'ları Python/npm çalıştıramıyor; testleri orkestra çalıştırır. Antigravity'deki Opus kotası doldu. Claude modelleri kendi alt ajanlarımızla kullanılır.
- Uzun MCP çağrıları 1800 sn'de kesiliyor ama sunucuda devam edebiliyor. Yeni çağrıdan önce `git status` ve codex süreçleri kontrol edilmeli.
