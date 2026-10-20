# Tasarım katsayılarının doğrulama durumu

Ayrıntılı kayıtlar her kodun YAML dosyasındaki `verification` bloğundadır
(`geotek/config/design_codes/`). Durum kodları:
**verified** = resmi metin, **secondary** = resmi bir üçüncü tarafın aynen çoğalttığı tablo,
**unverified** = henüz kontrol edilmedi, **not_in_source** = standart katsayıyı tanımlıyor ama değer vermiyor.

## TBDY 2018 (Resmî Gazete 30364 mük., ek PDF)

| Konu | Değer | Durum | Madde |
|---|---|---|---|
| Taşıma gücü γRv / sürtünme γRh / pasif γRp | 1.4 / 1.1 / 1.4 | verified | Tablo 16.2 |
| Kaymada pasif katkısı | V ≤ R_th + 0.3 R_pt | verified | Denk. 16.9 |
| Devrilme γRdev | ≥ 1.3 (mühendis seçer) | verified | Denk. 16.21 |
| Toptan göçme γRk | ≥ 1.0 | verified | Denk. 16.27 |
| Deprem birleşimleri | G+Q+0.2S+E(H)+0.3E(Z); 0.9G+H+E(H)−0.3E(Z) | verified | Denk. 4.11–4.12 |
| k_h, k_v; dinamik itki noktası | 0.4 S_DS / r, 0.5 k_h; H/2 | verified | Denk. 16.22, Tablo 16.7, 16.12.2.8 |
| Taban tan δ üst sınırları | 0.6 / 0.4 / 0.5 / 0.5 | verified | Tablo 16.3 |
| Malzeme katsayıları γRφ, γRc | — | **not_in_source** | 16.0, 16.13.3 |
| Statik yük katsayıları | — | **not_in_source** | 16.7.3.1 (ilgili yönetmelikler) |

Statik birleşimler için TS 500'de 1.4G + 1.6Q + 1.6H ve 0.9G + 1.6H kullanıldığı yalnızca yazılım
forumlarında görüldü (TS 500 metni ile doğrulanmadı); ileri seviyede ipucu olarak gösterilir, varsayılan değildir.

Sonuç: TBDY ile analiz için proje mühendisi γRφ, γRc (ve statik durum için yük katsayılarını)
`tbdy2018.yaml`'ın bir kopyasında girmelidir; boş bırakılan katsayı kullanılmaya çalışılırsa
motor katsayının adını vererek durur.

## Eurocode 7 (EN 1997-1 Ek A)

Kaynak: JRC EUR 26227 EN, *Eurocode 7: Geotechnical Design – Worked examples* (Bond vd., 2013),
Tablo 3.2.2, 3.3.1–3.3.3, 4.3.2–4.3.3.

| Konu | Durum |
|---|---|
| A1/A2, M1/M2, R1/R2/R3 (istinat), γR,e şev | secondary — YAML ile birebir |
| EQU (1.1 / 0.9 / 1.5 / 0; tanφ' 1.25, c' 1.25, c_u 1.4, γ 1.0) | secondary — DSTU-N B EN 1997-1:2010 Ek A (EN 1997-1'in ulusal kabulü) |

Ulusal Ek değerleri farklı olabilir.

## AASHTO LRFD

AASHTO metninin kendisine erişilemedi. FHWA NHI-10-024 (GEC-11, AASHTO 2007'den aktarım, **secondary**) ile yük katsayıları
DC 1.25/0.90, EH 1.50/0.90, EV 1.35/1.00, ES 1.50/0.75, LS 1.75, EQ 1.00 ve toptan göçme 0.75/0.65 eşleşti;
Extreme Event I eksantrisite sınırı 0.40 B **unverified** (AASHTO 11.6.5'te sınır γEQ'ya bağlı; madde metniyle ve tablo numarasıyla, 11.5.6-1 / 11.5.7-1, doğrulanmadan eşleşti sayılmaz). Taşıma 0.55 ve pasif 0.50 önceki eyalet DOT özetlerine dayanır (secondary).
Kayma (0.80/0.90), palplanş pasif (0.75), Extreme direnç katsayıları, strength eksantrisite sınırları ve LS extreme_I 0.50
**unverified**.

`LS extreme_I = 0.50` bir tablo değeri değil, **proje varsayımıdır**: AASHTO Extreme Event I'de yaya/trafik yükü katsayısı γEQ'yu proje özel bırakır
(0.50, Extreme Event II satırındaki değerdir). Karar (2026-10-20, orkestra şefi): YAML'da 0.50 kalır. Ayrıntı: `docs/research/katsayi_kaynak_arastirmasi_2026-10-20.md`.

## ASD

FHWA NHI-06-089 (Vol. II, Aralık 2006) ile karşılaştırıldı (2026-10-20): statik kayma 1.5, eksantrisite B/6 (zemin) ve B/4 (kaya),
taşıma 3.0 (önerilen), toptan göçme 1.5 **secondary**; devrilme 2.0 eksantrisite kriterinden türetilmiş yaklaşık değerdir.
Sismik değerler ve palplanş pasif katsayısı **unverified**. Ayrıntı: `docs/research/katsayi_kaynak_arastirmasi_2026-10-20.md`.
