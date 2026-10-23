# Hesap sistemi denetimi (HS-D)

Bu dosya hesap sistemi yeniden kurgusunun (2026-10-23, HS-A..HS-D) denetim kaydıdır. Kaynak: Keleşoğlu, İÜ-C Temel Mühendisliği 2
ders notları (Gravity Wall / Anchored Wall, Arazi Deneyleri, Yanal Toprak Basıncı). Kaynak telifli olduğundan depoya yalnız sayılar
ve formüller girer. Tasarım belgesi: `plan/2026-10-23-hesap-sistemi-yeniden-kurgu-plani.md`; testler:
`tests/unit/test_source_examples.py`.

## Eklenmeyen korelasyonlar

### Bowles (1996): φ = 4.5·N70 + 20 ("in general")

HS-A3.3 kapsamında Shioi & Fukui (1982) bağıntıları (`SF1982_phi_roads_SPT`, `SF1982_phi_buildings_SPT`)
kayıt defterine eklendi; Bowles'ın aynı tablodaki genel bağıntısı **eklenmedi**.

Gerekçe: N70 > 5.6 için φ' > 45° verir (5.6 · 4.5 + 20 = 45.2°; N70 = 20 için 110°). Granüler zeminde
tasarım için fiziksel olmayan değerler üretir ve sınırlayan bir geçerlilik aralığı kaynakta verilmemiştir.
Sınır uydurmak (ör. kendi N70 üst değerimizi koymak) kural gereği mümkün değildir. Gerekirse kaynak
doğrulandıktan sonra geçerlilik aralığıyla birlikte eklenir.

### Bowles (1996): gravelly sand E = 1200·(N55 + 6)

Laboratuvar çakıl yüzdesi SPT noktasına bağlanmadığı için çakıllı kum ayrımı USCS ile yapılamaz.
Kum formülleri (500·(N55+15) vb.) daha düşük E verir, bu yüzden eklenmemesi güvenli taraftadır.

## Bulgular (B1–B3)

- **B1. Onay zinciri (kritik).** Onayın taban özeti (`basis_hash`) katmandaki bütün işlenmiş noktaları (σv, σ'v, u0, C_N, (N1)60, Qtn, Ic)
  tek özette topluyordu. Bu yüzden γ onayı kendi onayını da düşürüyor; üst katmandaki her γ değişikliği alttaki bütün onayları, parametre
  gerilmeye bağlı olmasa bile (CPT'den γ, laboratuvar, elle değer), geçersiz kılıyordu.
- **B2. Doygun birim hacim ağırlığı (kritik).** `SoilLayer` γsat girilmemişse sessizce γsat = γ yapıyordu; bu YASS altında σ'v'yi küçültür,
  C_N'i büyütüp (N1)60 ve φ'yi şişirir. γsat için aday da üretilmiyordu (laboratuvar faz bağıntısı yazılmış ama çağrılmıyor, CPT tahmini yalnız γ'ya gidiyordu).
- **B3. Deprem sürşarj artışı (orta).** Kaynak (TBDY 2018) sürşarj artışını 2H/3'te, zemin artışını H/2'de uygular; program tüm artışı H/2'de
  uyguluyordu. Devrilme ve gövde momenti güvensiz tarafta kalıyordu (örnekte ≈10 kNm/m).

## Kararlar (K1–K5)

- **K1. Bağımlılık katmanları:** (0) ham veri; (1) γ, γsat gerilme tabanı; (2) gerilmeye bağlı korelasyonlar ((N1)60, Qtn, Ic kullanan φ', Dr, su, E, OCR, K0, M, Vs/Gmax); (3) türetilmiş δ_taban.
- **K2. Onay tabanı parametre başınadır** ve yalnız seçilen yöntemin kullandığı girdilere bağlanır (elle değer: yalnız katman sınırı ve kaynak listesi;
  laboratuvar: ilgili ölçümler; korelasyon: kayıtlı girdiler nokta nokta; istatistik: havuzdaki adayların birleşimi). γ onayı kendini düşürmez; gerilmeye
  bağlı onaylar üst γ değişince gerçekten eskidiği için düşer.
- **K3. Düşen onay açıklanır:** neden ve eski → yeni değer gösterilir; "yeni değerle yeniden onayla" mühendisin açık eylemidir, otomatik onay yoktur (HS-B).
- **K4. γsat doğru kaynaklardan:** laboratuvar faz bağıntısı (Gs yoksa değer üretilmez), CPT Robertson & Cabal (2010) YASS altı; sessiz γsat = γ kaldırıldı,
  γsat eksikse gerilme gerektiren hesap durur ve "Katman X için γsat gerekli" der.
- **K5. Deprem sürşarj artışı:** dinamik artış ikiye ayrılır; zemin kısmı (q = 0 ile P_AE − P_A) H/2'de, sürşarj kısmı 2H/3'te.

## Bu turda düzeltilen ek bulgular

- Deprem sürşarj artışı kolu 2H/3 (`earth_thrust_forces`, tabakalı duvar yolu); su altı q = 0 sismik koşusu aynı dalı kullanır.
- Sükûnet basıncında sessiz Jaky varsayılanı kaldırıldı; onaylı ve bayat olmayan K0 gerekir.
- Hızlı palplanşta γsat sessiz varsayımı kaldırıldı.
- Global duraylılık dilimlerinde γsat yalnız YASS altında kullanılır.
- İnceleme düzeltmeleri: Stroud f1 monoton ve güvenli taraflı (PI < 20: 6,0; 20–30 doğrusal; > 30: 4,0), PI bilinmiyorsa 4,0;
  Shioi-Fukui iki biçim de, N′70 = N1_60·60/70; K0/δ adayları yalnız onaylı φ′/OCR'den üretilir ve onay geri çekilince bayatlar;
  değerlendirme USCS'si = kayıtlı değer, yoksa laboratuvar çoğunluğu.

## Kaynakla karşılaştırma (D1–D5)

Program değerleri `tests/unit/test_source_examples.py` koşusundan alınmıştır (2026-10-23).

| Test | Büyüklük | Kaynak | Program | Fark | Sonuç |
|---|---|---|---|---|---|
| D1 | M_R [kNm/m] | 1125,0 | 1124,99 | 0,0 % | uyar |
| D1 | M_O [kNm/m] | 276,0 | 276,00 | 0,0 % | uyar |
| D1 | FS devrilme | 4,076 | 4,076 | 0,0 % | uyar |
| D1 | ΣV (sürşarj hariç) [kN/m] | 514,3 | 514,28 | 0,0 % | uyar |
| D1 | FS kayma | 2,138 | 2,138 | 0,0 % | uyar |
| D1 | e [m] | 0,599 | 0,599 | 0,0 % | uyar |
| D1 | K_AE (kh 0,2667, kv 0,1333) | 0,578 | 0,5778 | 0,0002 | uyar |
| D1 | artış kolları [m] | 3,0 / 4,0 | 3,0 / 4,0 | 0 | uyar |
| D1 | taşıma gücü, sismik FS | – | – | – | karşılaştırılmadı (bilinçli fark) |
| D2 | pE [kPa] | 42,44 (0,33 H1) | 42,519 (1/3) | 0,2 % | uyar (yuvarlama) |
| D2 | p_s [kPa] | 3,610 | 3,610 | 0 | uyar |
| D2 | T_H1 / T_H2 / T_H3 / R [kN/m] | 122,26 / 110,52 / 101,76 / 20,50 | 122,46 / 110,71 / 101,93 / 20,53 | ≤ 0,2 % | uyar |
| D2 | ankraj tasarım yükü DL [kN] | 227,8 / 206,0 / 189,6 | 228,2 / 206,3 / 189,9 | ≤ 0,2 % | uyar |
| D2 | kök boyu L_b [m] | 5,63 | 5,63 | 0 | uyar |
| D2 | M_max [kNm/m] | 53,02 (FHWA yaklaşık) | 53,10 | +0,15 % | uyar (program ≥ kaynak) |
| D3 | N60 | 17,0 | 17,0 | 0 | uyar |
| D3 | C_N (σ'v = 80 kPa) | 1,1254 | 1,1254 | 0 | uyar |
| D3 | (N1)60 | 19,13 | 19,13 | 0 | uyar |
| D3 | C_R (3,5 m) / C_N sınırı | 0,75 / 1,7 | 0,75 / 1,7 | 0 | uyar |
| D4 | q_t / R_f / Q_t / F_r / B_q | 5060 / 0,988 / 48,6 / 1,0288 / 0,04115 | aynı | 0 | uyar |
| D4 | I_c (Robertson 1990, Q_t) | 2,1677 | 2,1677 (`soil_behaviour_index`) | 0 | uyar |
| D4 | I_c (program: Q_tn, yinelemeli) | – | 2,169 (n = 0,726, Q_tn = 48,4) | +0,06 % | karşılaştırılmadı, kendi içinde tutarlı |
| D5 | Rankine Ka / Kp (φ = 30) | 1/3 / 3 | 1/3 / 3 | 0 | uyar |
| D5 | Kohezyonlu aktif Pa [kN/m] | 85,94 | 85,94 | 0 | uyar |
| D5 | Kohezyonlu pasif Pp [kN/m] | 832,21 | 832,21 | 0 | uyar |
| D5 | Coulomb Ka (δ = 20) / Kp (δ = 0) | 0,2973 / 3,0 | 0,2973 / 3,0 | 0 | uyar |
| D5 | K0 Jaky / Mayne-Kulhawy (OCR = 4) | 0,5 / 1,0 | 0,5 / 1,0 | 0 | uyar |

Kartta elle hesaplanan hiçbir değer yeniden üretilemez çıkmadı. Tek not: kartın "program M_max kaynaktan büyüktür" ifadesi bu örnekte
yalnız zayıf anlamda doğrudur; ilk açıklığın konsol ucu momenti (M1) FHWA formülüyle aynı çıkar (tam 1/3 ile 53,10), kaynağın 53,02 değeri 0,33 yuvarlamasından gelir.

## Bilinçli farklar (program kaynaktan daha güvenli veya daha açık; değiştirilmedi)

- **Deprem FS:** program duvar ve topuk üstü zeminin atalet kuvvetini ve P_AE'deki (1 − kv) çarpanını hesaba katar (AASHTO/GEC-3, EN 1998-5 Ek E);
  ders örneği almaz. Örnekteki sismik FS'ler (1,97; 1,23) bu yüzden karşılaştırılmadı, programda daha düşük çıkar.
- **Taşıma gücü:** program Meyerhof etkin genişliği B′ ile hesaplar; kaynak tam B ve q_max ile karşılaştırır. Yalnız e doğrulandı.
- **Aktif zarf:** program tam 1/3 kullanır (pE = 42,519); kaynak 0,33 yuvarlar (42,44). Fark %0,2.
- **Ankraj duvar momenti:** kaynak FHWA yaklaşık formüllerini (M1, pL²/10) kullanır; program basit mesnetli açıklık moment diyagramını hesaplar
  (büyük veya eşit, güvenli taraf). Test yalnız M_max ≥ 53,02 ister.
- **C_N üst sınırı 1,7** (Youd 2001); kaynakta 2,0. 1,7 daha düşük (N1)60 ve φ′ verir (güvenli taraf).
- **Robertson I_c:** program Q_tn ile yinelemeli (Robertson 2009) hesaplar; kaynak Q_t ile (1990).

## Eklenmeyen kaynak öğeleri

Sığ temel taşıma gücü, kazık kapasitesi ve slaytlardaki PMT tasarımı mevcut program kapsamı dışındadır; kullanıcının kararına bırakıldı.
(Bowles φ = 4,5·N70 + 20 ve çakıllı kum E bağıntısı için bkz. yukarıdaki "Eklenmeyen korelasyonlar".)

## Test kaydı

- 2026-10-23, Linux bulut, `tests/unit/test_source_examples.py` (D1–D5, 9 test): 9 geçti. Tam paket (`pytest tests -q`): 2276 geçti / 2 atlandı (büyük/küçük harf duyarlı olmayan dosya sistemi testleri); `gen_code_map.py --check` 0. Web testleri çalıştırılmadı (bu PR yalnız Python testi ve belge ekler).
