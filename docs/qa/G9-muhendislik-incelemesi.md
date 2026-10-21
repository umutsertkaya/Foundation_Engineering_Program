# G9 Mühendislik incelemesi: duvar, palplanş, kayma dişi (2026-10-21)

Kapsam: istinat duvarında eğimli zemin ve sürşarj (PR #19/#20 ve önceki Coulomb/M-O yolu), palplanşta
β ve sürşarj (PR #19/#20), kayma dişi (PR #21, bu dala taşındı). Ankraj modülü ayrı incelemededir.
İnceleme 04:21'de üç Opus alt ajanla başladı; ajanlar kullanım limitine takıldı ve Umut'un 07:34
talimatıyla durduruldu. Bulgular aşağıda bu konunun kendi sayısal kontrolleriyle (medium efor) çıkarıldı.

Sınıflama: **KRİTİK** = normal kullanımda tutucu olmayan sonuç; **YÜKSEK** = makul bir durumda yanlış veya
sessiz varsayım; **ORTA** = tutucu ama belgesiz / tutarsız; **DÜŞÜK** = biçimsel.
Kaynak durumu: **DOĞRULANDI** (kaynak metni/sayısı bu incelemede görüldü), **HATIRLANAN** (kaynak bu
incelemede açılamadı), **ERİŞİLEMEDİ** (Umut'tan istenecek, liste sonda).

## Bulgular ve yapılanlar

| ID | Önem | Konu | Durum |
|---|---|---|---|
| B1 | KRİTİK (birleşmemiş kod) | Kayma dişi, diş ucundan geçen düzlem: diş derinliği boyunca arka aktif itki, su, deprem artışı ve diş yanı zeminin ataleti yoktu | Düzeltildi |
| B2 | YÜKSEK (main) | Palplanş deprem: M-O aktif artımı yalnız kazı yüksekliğinde; gömülü boyda yoktu | Düzeltildi |
| B3 | YÜKSEK (main) | Duvar deprem: ön ayak pasifi (ve diş pasifi) statik K_p ile; K_PE azaltımı yoktu | Düzeltildi |
| B4 | ORTA | Diş pasifinde diş bölgesi için ön dolgu γ kullanılıyordu (temel zemini γ yerine), temel yol | Düzeltildi |
| B5 | ORTA | Diş pasifi "pasif direnç" kapalıyken de ön zemin örtüsüyle sayılıyor | Kaynakla korundu, görünür varsayım ve D = 0 yönlendirmesi |
| B6 | — | Diş derinliği taşıma gücü gömülmesine eklenmiyor | Her durumda tutucu; korundu |
| B7 | ORTA | Katmanlı kısmi katsayı yolunda pasif hem 0.5 ile hem γ_R,e ile azaltılıyor; basit yolda yalnız γ_R,e | Tutucu tutarsızlık; değiştirilmedi |
| B8 | ORTA | β > φ′ − ψ: temel yol (kama) çok büyük itki verir, katmanlı yol TBDY Denk. 16.24b kullanır; sonuçlar çok farklı | Yönetmelik formülü; değiştirilmedi, Umut'a soru |
| B9 | DÜŞÜK | Palplanşta drenajsız pasif tarafında ön su göleti toplam gerilme sürşarjı olarak eklenmiyor (duvarda ekleniyor) | Tutucu; değiştirilmedi |
| B10 | YÜKSEK (main) | Temel palplanş servisinde deprem artımı kazı yüksekliğinde sürşarj payını (ΔK·q·H) içermiyordu; yapı yolu içeriyordu (β 8°, q 20: M_max %13 düşük) | Düzeltildi |
| B11 | YÜKSEK (bu dalda, inceleme buldu) | Katmanlı kısmi katsayı yolunda su taban ile diş ucu arasındaysa WA katsayısı istenmeden hesap çöküyordu | Düzeltildi: WA katsayısı açıkça istenir |
| B12 | DÜŞÜK (bu dalda) | Kısmi katsayı yolunda taban yüzeyi itici kuvveti ≤ 0 iken diş ucu düzlemi atlanabiliyordu | Düzeltildi: yöneten yüzeyin R_d ve E_d'si raporlanır |
| B13 | ORTA | Drenajsız temel + kayma dişi + deprem (veya eğimli dolgu): diş bölgesi itkisi hesaplanamadığı için analiz açık hatayla durur (dişsiz duvar çalışır) | Görünür varsayım; Umut'a soru |
| B14 | DÜŞÜK | φ = 0 zeminde deprem pasif oranı (1 − k_v) tüm σ_v + 2s_u terimine uygulanır; kohezyon payını fazla, ağırlık payını az azaltır | Görünür varsayım; değiştirilmedi |
| B15 | DÜŞÜK | Palplanşta kazı tabanı altındaki su altı zeminde TBDY 16.26 eşdeğer k_h kullanılmıyor (duvarda kullanılıyor) | Değiştirilmedi; Umut'a soru |

### B1 — Kayma dişi: diş ucu düzleminde arka itki (KRİTİK, PR #21'de)

Diş ucundan geçen yatay kayma düzleminde, kayan blok tabanın altına diş tabanına kadar uzar. Arka taraftaki
zemin bu bloğu diş tabanına kadar iter; PR #21 itkiyi taban seviyesinde kesiyordu. Bu her durumda tutucu
değildir. Örnek duvar (H = 6 m, topukta 0.5 × 0.6 m diş, φ_temel = 30°): ek itki
K_a·(118·0.6 + ½·18·0.6²) = (70.8 + 3.24)/3 = **24.68 kN/m**; diş ucu düzlemi FS **2.00 → 1.66**, yöneten yüzey
taban yüzeyinden diş ucu düzlemine geçti, kayma FS **1.85 → 1.66**.

Düzeltme (`geotek/engine/walls/base.py::key_zone_thrust_basic`, `layered.py::_key_zone_forces`):
- Topuk hattında düşey düzlemde, taban seviyesinden diş tabanına kadar katman bazında Coulomb K (δ = β,
  θ = 0; Rankine-β ile özdeş), temel zemininin K_a'sı; c′ Coulomb çözümünde yok sayılır (tutucu).
- Sürşarj (LS), deprem artışı (EQ, M-O; β > φ − ψ ise TBDY 16.24b, katmanlı yolla aynı), arka su ve TBDY 16.20
  dinamik su artışı (katmanlı), önde hidrostatik artış (WA), diş yanı zeminin ataleti k_h·W (EQ).
- Düşey zemin ağırlığı depremde (1 − k_v) ile çarpılır.
- Bu kuvvetler yalnız diş ucu düzleminin itici kuvvetine eklenir; devrilme ve taşıma gücüne girmez.
  Kısmi katsayı yolunda aynı yük türü katsayılarıyla (EH, LS, EQ, WA) çarpılır.
- Drenajsız temel zemininde eğimli dolgu veya deprem varsa diş bölgesi itkisi hesaplanamaz; analiz açık
  hata ile durur (sessiz geçiş yok).

Kaynak: USACE EM 1110-2-2502 (çoklu kama, kayma düzlemi diş ucundan; itici kama düzleme kadar) — HATIRLANAN,
ERİŞİLEMEDİ. Das, *Principles of Foundation Engineering*, taban dişi bölümü (D₁ = D + diş derinliği ile pasif) —
HATIRLANAN. ODTÜ CE366 Recitation 5 P1 yalnız taban yüzeyini kontrol eder ve itkiyi uzatmaz; bu nedenle
taban yüzeyi yolu o örnekle aynıdır, diş ucu düzlemi ek ve daha güvenli bir kontroldür.

### B2 — Palplanş: M-O artımı kazı tabanı altında (YÜKSEK, main)

Önceki uygulama ΔP_AE'yi yalnız kazı yüksekliği H boyunca düzgün yayıyordu (TBDY 16.12.2.8); kazı tabanı
altında aktif tarafta deprem artımı yoktu, pasif ise K_PE/K_P ile azaltılıyordu. Ebeling & Morrison (1992)
gömülü perdelerde M-O aktif ve pasif basınçları gömülü boy dahil uygular. Etki (φ = 30°, H = 5 m, FS_p = 1.5):

| k_h | Konsol D₀ | Konsol M_max | Ankrajlı D₀ | Ankrajlı M_max | Ankraj T |
|---|---|---|---|---|---|
| 0.1 | +7 % | +10 % | +10 % | +12 % | +5 % |
| 0.2 | +18 % | +30 % | +28 % | +36 % | +15 % |
| 0.3 | +45 % | +84 % | +66 % | +105 % | +37 % |

Düzeltme: `engine/sheet_pile.py::net_pressure(seismic_increment_below=ΔK_h)` (temel servis, ΔK_h·(σ′v + q))
ve `services/structures.py::_sheet_case` (katman bazında M-O − Rankine-β, ≥ 0). Kazı tabanı üstünde mevcut
H/2 düzgün dağılım korunur. Ankraj modülü `net_pressure`'u deprem artımı olmadan çağırır; etkilenmez.
Kaynak: Ebeling & Morrison (1992) — HATIRLANAN, ERİŞİLEMEDİ. "Kazı Destek Yapıları Tasarım ve Uygulama
Esasları" bu konuda farklı bir kural koyuyorsa Umut'un sağlayacağı metinle yeniden değerlendirilecek.

### B3 — Duvar deprem pasifi (YÜKSEK, main)

Ön ayak pasifi depremde de statik Rankine K_p ile alınıyordu. Palplanş yolu zaten (1 − k_v)K_PE/K_P ≤ 1 oranını
kullanıyordu. Duvarda (temel, katmanlı, kısmi katsayı yolları) ayak ve diş pasifi aynı oranla çarpılır
(drenajsız katmanda φ = 0). φ = 30°, k_h = 0.2, k_v = 0.1: oran **0.775**. Diş için verilen yapısal talep V, M
statik azaltılmamış pasifle kalır (daha büyük, tutucu). Kaynak: M-O pasif (mevcut `mononobe_okabe_kpe`),
palplanş yolu ile aynı kural; AASHTO LRFD 11.6.5, EN 1998-5 Ek E — HATIRLANAN.

### B4 — Diş bölgesinde birim hacim ağırlık (ORTA)

Temel yolda diş ön yüzündeki düşey gerilme tüm derinlik için ön dolgu γ'sı ile hesaplanıyordu. Şimdi
σ_v = γ_ön·D + γ_temel·(z − D). Katmanlı yol profili kullandığı için zaten doğruydu.

### B5 — Diş pasifi ve "pasif direnç" ayarı (ORTA, korundu)

ODTÜ CE366 Recitation 5 P1 (yayımlanmış ders çözümü) ön dolgunun pasifini yok sayarken diş pasifini 1 m ön
dolgu örtüsüyle (σ_v = 20 kPa) hesaplar: P_p = 65D + 32.5D², FS_p = 2. Program aynı formülü verir
(K_p = 3.2546 ile 159.6 kN/m, yayımlanan 159.4; fark K_p yuvarlaması). Davranış korundu; varsayım metni ön
zemin kazı veya oyulmayla kalkabiliyorsa D = 0 girilmesini söylüyor (D = 0 ile P_p = ½K_pγd², testli).

### B6 — Taşıma gücünde diş derinliği (tutucu, korundu)

Diş derinliği gömülmeye eklenmezse q·N_q terimi ve derinlik katsayıları küçük kalır; taşıma gücü her
durumda daha küçük çıkar. Görünür varsayım olarak duruyor.

### B7 — Katmanlı kısmi katsayı yolunda çift pasif azaltımı (ORTA, değiştirilmedi)

`verify_wall_layered` pasifi `settings.passive_reduction` (0.5) ile azaltılmış kuvvetten alıp ayrıca γ_R,e ile
böler; `verify_wall` (temel) azaltmayı 1.0 alır. Katmanlı sonuç daha tutucu. Davranışı değiştirmek mevcut
sonuçları değiştireceği için karar Umut'a bırakıldı.

### B8 — β > φ′ − ψ durumunda iki yol (ORTA, soru)

Kama çözümü bu bölgede sınırsız büyür (φ = 25°, β = 25°, k_h = 0.3: kama K'sı TBDY 16.24b'nin ~2900 katı);
bu, eğimin kendisinin psödo-statik olarak duraysız olduğunu gösterir. Katmanlı yol TBDY 16.24b ile devam eder
ve uyarı verir. Yönetmelik formülü olduğu için değiştirilmedi; öneri: bu durumda ayrıca şev duraylılığı
uyarısı. Umut'un TBDY 16.24 metniyle teyidi istenecek.

### Bağımsız incelemeler (2026-10-21, iki Opus alt ajan, salt okuma)

İnceleme 1 kendi türetmeleriyle 24.68 kN/m, FS 1.8461 / 1.6579, K_PE oranı 0.7752 ve palplanş Blum
D₀ = 9.7018 m, M_max = 788.84 değerlerini bağımsız buldu (program 1e-7 içinde aynı); key=None statik
sonuçların HEAD ile aynı olduğunu doğruladı. B11, B12, B13, B14, B15 bu incelemeden geldi.
İnceleme 2 kendi kurduğu durumlarda (uçta diş, β = 10°, q = 15, φ = 28°, c = 5; ±k_v; farklı su seviyeli katmanlı
yol) motorla 3–4 anlamlı basamak uyum buldu; B10'u buldu.

## Doğru bulunan yöntemler (kanıtla)

- Rankine eğimli dolgu K_a = cosβ(cosβ − √(cos²β − cos²φ))/(cosβ + √…), bileşke yüzeye paralel; yatay bileşen
  K_a·cosβ (`distribution.py`) — Das bağıntısıyla aynı (HATIRLANAN). Coulomb δ = β, θ = 0 ile özdeş (fark 7e-16).
- Deneme kaması ↔ Coulomb ve M-O kapalı formları: φ 25–40, β 0–25, θ −10–20, δ/φ 0–1, k_h 0–0.3, ±k_v,
  q 0/20 ile 9216 durumda en büyük fark **%0.011**. Sürşarj kapalı formu K·q·H·cosβ·cosθ/cos(θ − β) aynı
  aralıkta %0.011 içinde.
- Eğimli yüzey alanı başına sürşarj q_h = q/cosβ (geometri).
- Konsol duvarda topuk ucundan sanal düşey düzlem (δ = β): kısa topukta eğik Coulomb düzlemine (δ = φ) göre
  yatay itki %0–12 büyük, V/P_h küçük; kayma için her durumda tutucu (12 durum).
- Palplanş, Das kum konsol örneği (L₁ = 2, L₂ = 3, γ = 15.9, γ′ = 9.52, φ = 32°): Das tam yöntem D = 5.403 m,
  M_max = 209.58 kNm/m; program Blum D₀ = 5.007 m, M_max = **209.58** (aynı), bağımsız Blum D₀ = 5.007. Hizmet
  katmanı FS_p = 1.5 ve %20 artırım ile D = 7.88 m (Das önerisi 1.2–1.3 × 5.403 = 6.5–7.0 m), tutucu.
- Das ankrajlı serbest zemin örneği: D = 2.010 m, F = 32.86 kN/m; program aynı.
- Das kil konsol örneği (c = 47 kPa): Das tam yöntem D = 1.864 m; program Blum D₀ = 2.014 m (+%8, tutucu).
- Kayma dişi pasifi: ODTÜ CE366 P1 ile bire bir (B5).

## Değişen dosyalar

`geotek/engine/walls/base.py`, `walls.py`, `layered.py`, `geotek/engine/limit_state.py`,
`geotek/engine/sheet_pile.py`, `geotek/services/walls_basic.py`, `geotek/services/structures.py`,
rapor ve palplanş i18n varsayım metinleri, `tests/unit/test_shear_key.py`,
`tests/unit/test_sheet_pile_seismic_embedded.py`. API şeması değişmedi.

## Kalan varsayımlar (görünür)

- Pasif azaltma 0.5 mühendis seçimi; ODTÜ örneğindeki FS_p = 2 ile aynı. Diş V, M talebi verilir, betonarme
  tasarımı yok.
- Diş bölgesi itkisinde düşey bileşen ihmal (diş ucu düzleminde sürtünmeyi azaltır, tutucu); c′ yok sayılır.
- Diş ucu düzleminde kaldırma: diş yanı zeminin etkin ağırlığı ve diş batmazlığı; ön/arka su farkının diş
  boyunca kaldırmaya etkisi basitleştirildi (uyarı `walls.warning.shear_key_water` sürüyor).
- Palplanşta kazı tabanı üstünde deprem artımı H boyunca düzgün (TBDY 16.12.2.8 yorumu).

## Umut'tan istenecek kaynaklar (erişilemedi)

1. Das, B. M., *Principles of Foundation Engineering* (7., 8. veya 9. baskı): istinat duvarı kayma kontrolü ve
   "base key" bölümü ile varsa çözümlü örneği; palplanş bölümü (kum ve kil konsol, ankrajlı örnekler).
2. Bowles, J. E., *Foundation Analysis and Design*, 5. baskı, Bölüm 12–13 (duvar kayma dişi, palplanş).
3. Coduto, D. P., *Foundation Design: Principles and Practices*, 2. baskı, istinat yapıları bölümü.
4. USACE EM 1110-2-2502 (1989), *Retaining and Flood Walls*, Bölüm 4 (kayma, diş, çoklu kama).
5. USACE EM 1110-2-2504 (1994), *Design of Sheet Pile Walls*.
6. Ebeling, R. M. & Morrison, E. E. (1992), *The Seismic Design of Waterfront Retaining Structures*, USACE
   Technical Report ITL-92-11 (NCEL TR-939).
7. TBDY 2018, Bölüm 16 (özellikle 16.10–16.12 ve Denk. 16.24b).
8. Kazı Destek Yapıları Tasarım ve Uygulama Esasları (16.07.2026 değişikliği), deprem itkisi hükümleri.
9. AASHTO LRFD Bridge Design Specifications (9. baskı), 10.6.3.4, 11.6.3.5, 11.6.5.
10. EN 1998-5:2004 Ek E; NAVFAC DM-7.02 (1986) Bölüm 3; FHWA GEC-3 (NHI-11-032).
