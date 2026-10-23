# HS-D — Kaynak örnekleri regresyon testleri ve denetim raporu

**Durum:** HS-A ve HS-C birleştikten sonra. Tasarım: Opus. Uygulayıcı yalnız bu kartı kodlar.
Kaynaklar (Umut'un verdiği ders notları, Keleşoğlu, İÜ-C Temel Müh. 2): *Gravity Wall / Anchored Wall* çözümlü
örnekleri, *Arazi Deneyleri*, *Yanal Toprak Basıncı*. Kaynak telifli; depoya yalnız sayılar ve formüller girer.

Yeni dosya `tests/unit/test_source_examples.py`. Her test docstring'inde kaynak ve slayt numarası. Beklenen
değerler aşağıda **elle** hesaplanmıştır; tolerans belirtilmedikçe 0.5 % bağıl.

## D1. Konsol duvar, Problem 1 (slayt 2–12)
Geometri `CantileverGeometry(stem_height=5.6, stem_top=0.4, stem_bottom=0.4, toe=0.0, heel=4.1, base_thickness=0.4)`,
`Backfill(gamma=18, phi=30, delta=0)`, `FoundationSoil(phi=35, gamma=19, delta_base=atan(0.76·tan35°))`,
`WallSettings(concrete_unit_weight=25)`, `WallLoads(surcharge=10)`. Statik:
W1 (topuk zemini) 413.28 @2.45, W2 (gövde) 56.0 @0.20, W3 (taban) 45.0 @2.25; P1 (sürşarj) 20.0 @3.0, P2 108.0 @2.0;
M_R = 1125.0, M_O = 276.0, FS_devrilme = 4.076 (≥ 2.0), ΣV (sürşarj hariç) 514.3, FS_kayma = 2.138 (≥ 1.5).
Taşıma gücü kaynakla **karşılaştırılmaz** (kaynak tam B ve q_max kullanır, program Meyerhof B′); testte yalnız
e = 0.599 m doğrulanır ve farkın gerekçesi docstring'de.
Deprem (SDS=1.0, r=1.5): kh = 0.2667, kv = 0.1333 (TBDY 16.22). Kaynak Ka,t = 0.578 (θ = 17.1°, δ=0, β=0, ψ=90°):
`mononobe_okabe_kae(phi=30, kh=0.2667, kv=0.1333)` = 0.578 (1e-3 mutlak). Sürşarj artışı kolu 4.0 m, zemin artışı
kolu 3.0 m (HS-C). Kaynağın sismik FS'leri (1.97, 1.23) **karşılaştırılmaz**: program duvar ve topuk üstü zemin
ataletini ve P_AE'deki (1 − kv) çarpanını alır (AASHTO/GEC-3, EN 1998-5 E); docstring'de yaz.

## D2. Ankrajlı fore kazık perdesi, Problem 3 (slayt 26–37)
H = 9.0, γ = 17, φ = 28, q = 10; ankrajlar 2.1, 4.5, 6.9 m (H1=2.1, H2=H3=2.4, H4=2.1).
Ka = tan²(45−14) = 0.36103; pE = 0.65·Ka·γ·H²/(H − H1/3 − H4/3) = 42.44; ps = Ka·q = 3.610.
Not: kaynak paydada 0.33·H1 yuvarlaması kullanır (pE = 42.44); program tam 1/3 alır (pE = 42.519). Test programın
tam değerini ister: `apparent_envelope(...)` → p_max − ps = 42.519, ps = 3.610.
Tributary yöntem (`_hinge_model(env, [2.1, 4.5, 6.9, 9.0], "tributary")`) kaynağın FHWA Şekil 39 formülleriyle
özdeştir: T_H1 = (2/3·H1 + H2/2)·pE + (H1 + H2/2)·ps; T_H2 = (H2/2 + H3/2)·(pE + ps);
T_H3 = (H3/2 + 23/48·H4)·pE + (H3/2 + H4/2)·ps; R = 3/16·H4·pE + H4/2·ps.
Tam 1/3 ile: 122.46, 110.71, 101.93, 20.53 kN/m (kaynak 0.33 ile 122.26, 110.52, 101.76, 20.50; fark %0.2, yalnız
yuvarlama). Test: program değerleri = formüllerin tam değerleri (1e-3 bağıl) ve kaynak değerlerine %0.3 içinde.
Ankraj tasarım yükü DL = T_H·sA/cos15°, sA = 1.8: 227.8, 206.0, 189.6 kN. Kök boyu: `design_anchor` ile
design = 230 kN, τ = 250 kPa, d = 0.13 m, FS = 2.5 → L_b,calc = 230·2.5/(250·π·0.13) = 5.63 m.
Moment: kaynak FHWA yaklaşık formülleri (M1 = 13/54·H1²·pE + H1²/2·ps = 53.02; ara açıklık pL²/10) kullanır,
program basit mesnetli açıklık moment diyagramını hesaplar (daha büyük, güvenli taraf); test programın
M_max ≥ 53.02 olduğunu doğrular, eşitlik aramaz.

## D3. SPT (Arazi Deneyleri slayt 22–26)
N = 20, ER = 60 → C_E = 1; çubuk 5 m → C_R = 0.85; Ø100 mm → C_B = 1.0; standart numune alıcı C_S = 1.0 → N60 = 17.0.
σ'v = 80 kPa → C_N = √(101.325/80) = 1.1254 (≤ 1.7) → (N1)60 = 19.13. Çubuk 3.5 m → C_R = 0.75 (HS-A A3.1).
σ'v = 20 kPa → C_N sınırı 1.7.

## D4. CPT (slayt 45–59)
qc = 5000, u2 = 300, a = 0.8, fs = 50, σv0 = 200, u0 = 100, σ'v0 = 100 (kPa):
qt = qc + u2(1−a) = 5060; Rf = fs/qt·100 = 0.988 %; Qt (= Qt1) = (qt−σv0)/σ'v0 = 48.6; Fr = fs/(qt−σv0)·100 = 1.0288 %;
Bq = (u2−u0)/(qt−σv0) = 0.04115; Robertson (1990) Ic (Qt ile) = √((3.47−log 48.6)² + (log 1.0288 + 1.22)²) = 2.1677.
Program Ic'yi Qtn ile (Robertson 2009, yinelemeli) hesaplar; test `soil_behaviour_index(48.6, 1.0288)` = 2.1677 ve
`process_cpt` Qtn sonucu için n yakınsamasını (n = 0.381·Ic + 0.05·σ'v/Pa − 0.15) doğrular.

## D5. Yanal toprak basıncı (Yanal Toprak Basıncı slayt 5–31)
- Rankine: φ=30 → Ka = 1/3, Kp = 3.
- Kohezyonlu aktif: γ = 18, φ = 20, c = 10, H = 6: Ka = 0.4903, zc = 2c/(γ√Ka) = 1.587 m;
  σa(H) = Ka·γH − 2c√Ka = 52.95 − 14.00 = 38.95 kPa; çatlak sonrası Pa = ½·σa(H)·(H − zc) = 85.94 kN/m.
  `lateral_pressure(..., method="rankine", state="active")` + `resultant` ile aynı (çekme bölgesi sıfır).
- Pasif kohezyonlu: Pp = ½γH²Kp + 2cH√Kp (φ=20 → Kp = 2.0396): γ=18, c=10, H=6 → 660.83 + 171.38 = 832.21.
- Coulomb (Das Tablo 12.5 deseni): φ = 30, δ = 20, α = 0, i = 0 → Ka = 0.2973; Kp (δ=0) = 3.0.
- K0: Jaky φ=30 → 0.5; Mayne-Kulhawy OCR=4 → 0.5·4^0.5 = 1.0 (HS-A A3.6 adayları).
- Sükûnet basıncı örneği (HS-C C2 testleriyle aynı sayılar, burada tekrar edilmez).

## D6. Denetim raporu `docs/qa/hesap-sistemi-denetimi.md`
Opus'un verdiği içerik (aşağıdaki başlıklar; metni kart sahibi sağlar, uygulayıcı dosyayı oluşturur ve testlerin
gerçek sonuçlarını tabloya yazar): bulgular B1–B3 ve ek bulgular, kararlar, kaynakla karşılaştırma tablosu (D1–D5
sonuçları), bilinçli farklar, eklenmeyen kaynak öğeleri ve gerekçeleri.

## Kabul
`python -m pytest tests/unit/test_source_examples.py -q` ve tam paket; `gen_code_map --check` 0.
