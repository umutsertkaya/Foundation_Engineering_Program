# GeoTek v2: devam notları

Son güncelleme: 2026-10-17 (E4 chunk C tamamlandı). Arka planda çalışan ajan ya da model yok.

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
| E4 katmanlı duvar motoru | Tamam: chunk C dahil (620 pytest, 35 web testi, typecheck geçiyor). **Kapı 2 kapanışı kullanıcı onayı bekliyor** |
| E2, E3, A1, F2, F4–F6, T1, Q1, K1, D1 | Başlamadı |

## Kapı 2'de kullanıcının verdiği kararlar

1. Su altı dolguda deprem: TBDY 2018 Denk. 16.26/16.20 uygulandı; varsayılan "zarf", mühendise uyarı gösteriliyor. Kaynak: `docs/research/submerged_seismic_thrust.md`.
2. Tasarım seçimleri kullanıcının kontrolünde; varsayılan güvenli taraf. Örnek: `uplift_moment = "overturning"`.
3. Nγ için YASS geçiş düzeltmesi eklendi (Das). `gwt_bearing_correction = True`.
4. Kısmi katsayılı global stabilitede yük katsayıları uygulanıyor.

## E4 chunk C (tamamlandı, 2026-10-17)

1. TBDY Denk. 16.24b / EN 1998-5 E.3 dalı (`coefficients.tbdy_kae_steep`). Yalnız katmanlı duvar yolu `steep_seismic=True` ile kullanır, diğer çağıranlar hata vermeye devam eder.
   - **δ korunur.** Eski brief'teki "δ=0" kabulü yanlıştı. EN 1998-5 sayfa görüntüsünden doğrulandı: E.3 paydasında δ_d var. δ korunduğunda E.2 ile sınırda süreklilik sağlanır. δ=0 alınsaydı sınırda %8–9'luk, tutucu olmayan bir sıçrama oluşuyordu (Opus incelemesi).
   - cos(δ+θ+ψ) ≤ 0 olduğunda GeoTekError verilir (gpt-6-astra incelemesi).
   - Sınırdaki M-O kayan nokta hatası (sqrt(−3e-17)) giderildi.
2. ±kv zarfı: `WallSettings.kv_sign = envelope|up|down`, varsayılan envelope.
   - Her işaret için analiz tam olarak ayrı çalıştırılır. Her kontrolde düşük kapasite oranı seçilir (TBDY 16.12.2.3); global stabilite de dahildir.
   - Detay metninde "kv yukarı/aşağı" ön eki yer alır.
   - 5 m duvar: zarf ile B = 4.60, "down" ile B = 4.50.
3. Su altı deprem dalına yalnız kh veya kv ≠ 0 iken girilir.
4. Su altında dolgu varken r > 1 ise uyarı verilir.
5. Karışık geçirgenlik "doğrulanmamış mühendislik yaklaşımı" olarak etiketlendi.
6. `E4_FORMULAS.md` §3 güncellendi. OpenAPI ve web tipleri yenilendi.

İncelemeler: Claude Opus (alt ajan) ve gpt-6-astra. Bulgular düzeltildi; Opus'un yeniden kontrolü temiz.

## Açık konular

- KDYY "Tasarım ve Uygulama Esasları" (16.07.2026 değişikliği) ve Tasarım El Kitabı (Temmuz 2023) okunamadı: dosyalar 10 MB'ı aşıyor ya da sertifika hatası veriyor. Kullanıcı PDF'leri yerel olarak sağlarsa incelenecek.
- Yeni motor seçenekleri arayüze bağlanacak (F4 duvar sihirbazı):
  - `uplift_moment`, `gwt_bearing_correction`, `submerged_seismic`, `kv_sign`
  - katman `permeability`
  - `passive_reduction` onayı
- ±kv zarfında kontroller işaret bazında seçiliyor. Ancak analiz düzeyindeki kuvvetler, e, q_max ve bearing nesnesi, en kritik kontrolü yöneten işaretten geliyor. Hangi işaretin kullanıldığı yalnız detay ön ekinde görünüyor. Sorun kozmetik; rapor ve arayüz (F4) aşamasında netleştirilecek.
- Vite paket boyutu uyarısı (~685 kB): kod bölme ileride (K1 öncesi) yapılacak.
- `walls_basic` (eski PySide6 yolu) tek kv işareti kullanıyor. PySide6 kaldırılınca yapı servisine geçilecek.

## Ortam notları

- Git PATH'te değil: `& "C:\Program Files\Git\cmd\git.exe"`.
- Testler: `.venv\Scripts\python.exe -m pytest -q` (~2 dk), `npm --prefix web run test|typecheck|build`.
- Mock arayüz: `.claude/launch.json` → `web-mock` (port 5173).
- Codex ve Antigravity sandbox'ları Python/npm çalıştıramıyor; testleri orkestra çalıştırır. Antigravity'deki Opus kotası doldu. Claude modelleri kendi alt ajanlarımızla kullanılır.
- Uzun MCP çağrıları 1800 sn'de kesiliyor ama sunucuda devam edebiliyor. Yeni çağrıdan önce `git status` ve codex süreçleri kontrol edilmeli.
