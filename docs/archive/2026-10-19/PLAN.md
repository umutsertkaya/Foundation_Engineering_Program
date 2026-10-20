# GeoTek Suite — Aşama 1: Teorik Çerçeve, Literatür Doğrulaması ve Yazılım Mimarisi

## 0. Bağlam

Amaç: SPT/CPT arazi verisinden zemin profili, mühendislik parametreleri ve sıvılaşma tahkikini üreten (Modül 1) ve bu profili doğrudan kullanarak istinat yapılarını tasarlayan (Modül 2), modüler, test edilebilir, GUI'li bir Python yazılımı. Bu belge **kod içermez**; onay sonrası Faz 0 ile başlanacaktır.

Temel tasarım ilkeleri:
1. **İzlenebilirlik:** Her türetilmiş parametre; değer + birim + yöntem + kaynak + geçerlilik kontrolü + uyarılar ile saklanır (hesap raporu denetlenebilir olmalı).
2. **Motor–arayüz ayrımı:** Hesap motoru GUI'den bağımsız saf Python paketidir; ileride web arayüzü eklenebilir.
3. **İç birim sistemi SI:** kN, m, kPa, kN/m³, derece. Birim dönüşümü yalnızca I/O ve UI sınırında.
4. **Doğrulanabilirlik:** Her yöntem, yayımlanmış çözümlü örneklerle (golden test) karşılaştırılarak kabul edilir.

### Referans düzeltmeleri (önemli)
- **FHWA GEC-010 = Drilled Shafts (FHWA-NHI-10-016)**; sismik toprak basıncı ile ilgili değildir. Mononobe-Okabe ve sismik istinat yapısı yaklaşımı için doğru kaynak **FHWA GEC-3 (FHWA-NHI-11-032, 2011) "LRFD Seismic Analysis and Design of Transportation Geotechnical Features"** ve **NCHRP Report 611 (2008)**'dir. Planı buna göre kurguladım.
- "Seed & Idriss basitleştirilmiş yöntemi" pratikte **Youd et al. (2001) NCEER/NSF konsensüs güncellemesi** olarak uygulanacaktır (SPT: Seed et al. 1985 tabanlı eğri; CPT: Robertson & Wride 1998).
- İlgili diğer FHWA belgeleri: FHWA-NHI-06-088/089 (Soils & Foundations Ref. Manual, Vol. I-II), GEC-5 (FHWA-IF-02-034, Evaluation of Soil and Rock Properties), GEC-6 (FHWA-IF-02-054, Shallow Foundations), GEC-4 (FHWA-IF-99-015, Ground Anchors & Anchored Systems — ankrajlı palplanş için).
- Türkiye uygulaması için **TBDY 2018 Bölüm 16** (zemin sıvılaşması ve istinat yapıları sismik yükleri) seçenek olarak eklenecek; örn. PGA ≈ 0.4·S_DS·g kabulü.

> **Dürüstlük notu:** Aşağıdaki formüller literatür bilgimden derlenmiştir. Faz 0'da her biri orijinal kaynakla satır satır karşılaştırılacak ve çözümlü örneklerle test edilecektir; "⚠ doğrula" işaretli olanlar katsayı/kaynak atfı açısından özellikle kontrol edilecektir.

---

## 1. Literatür ve Standart Doğrulaması

### 1.1 SPT Düzeltmeleri (Youd et al. 2001; Skempton 1986)

| Büyüklük | Formül | Geçerlilik / Sınır |
|---|---|---|
| N60 | N60 = N · (ER/60) · C_B · C_S · C_R | ER ölçülmemişse güvenlik tokmağı ~60%, otomatik ~80% (kullanıcı girişi zorunlu alan) |
| C_R (tij boyu) | <3 m: 0.75; 3–4 m: 0.80; 4–6 m: 0.85; 6–10 m: 0.95; >10 m: 1.0 | Youd et al. 2001 Tablo |
| C_B (kuyu çapı) | 65–115 mm: 1.0; 150 mm: 1.05; 200 mm: 1.15 | |
| C_S (numune alıcı) | Standart: 1.0; liner'sız: 1.1–1.3 | |
| C_N (NCEER) | C_N = (Pa/σ'v0)^0.5 ≤ 1.7 (Liao & Whitman 1986) | σ'v0 < ~200 kPa için önerilmiş; Kayen 1992 alternatif |
| C_N (B&I 2014) | C_N = (Pa/σ'v0)^m ≤ 1.7, m = 0.784 − 0.0768·√((N1)60cs), (N1)60cs ≤ 46 | İteratif çözüm gerekir |
| (N1)60 | C_N · N60 | |

### 1.2 CPT İşlemleri ve Robertson Sınıflandırması

| Büyüklük | Formül | Not |
|---|---|---|
| Düzeltilmiş uç direnci | q_t = q_c + u2·(1 − a) | a: alan oranı (tip. 0.75–0.85); u2 yoksa q_t ≈ q_c (uyarı) |
| Normalize sürtünme | F_r = f_s / (q_t − σv0) · 100 | |
| Boşluk suyu oranı | B_q = (u2 − u0)/(q_t − σv0) | |
| Q_t1 (1990) | Q_t1 = (q_t − σv0)/σ'v0 | Robertson 1990 SBTn (n = 1) |
| Q_tn (2009) | Q_tn = [(q_t − σv0)/Pa]·(Pa/σ'v0)^n; n = 0.381·I_c + 0.05·(σ'v0/Pa) − 0.15 ≤ 1.0 | İteratif (I_c ↔ n) |
| I_c | I_c = √[(3.47 − log Q_tn)² + (log F_r + 1.22)²] | |
| SBTn bölgeleri (I_c) | <1.31: Z7 çakıllı-yoğun kum; 1.31–2.05: Z6 kum; 2.05–2.60: Z5 kum karışımı; 2.60–2.95: Z4 silt karışımı; 2.95–3.60: Z3 kil; >3.60: Z2 organik | Z1 (hassas), Z8–Z9 (çok katı/aşırı konsolide) I_c ile değil, Q_t–F_r grafiği sınırlarıyla belirlenir — poligon geometrisi kodlanacak ⚠ doğrula |
| Opsiyonel | Robertson (2016) CD/CC/TC davranış sınıflaması | Faz sonu genişletme |

SPT tarafında sınıflama: **USCS (ASTM D2487)** — dane dağılımı (F200, D10/D30/D60 → Cu, Cc) + Atterberg (LL, PL, PI; A-hattı PI = 0.73·(LL − 20), U-hattı PI = 0.9·(LL − 8)).

### 1.3 Ampirik Parametre Korelasyonları

Her korelasyon kayıt defterinde (registry) **girdi koşulu + geçerlilik aralığı + güvenilirlik derecesi (A/B/C)** ile tutulur; uygulanamayan durumda hesaplanmaz veya uyarıyla hesaplanır.

#### a) Kayma direnci açısı φ' (granüler zeminler)

| Kaynak | Formül | Geçerlilik |
|---|---|---|
| Kulhawy & Mayne (1990) [Schmertmann 1975 yaklaşığı] | φ' = tan⁻¹{[N60 / (12.2 + 20.3·σ'v0/Pa)]^0.34} | Temiz, çimentolanmamış kumlar; çakıllı zeminlerde N şişer |
| Hatanaka & Uchida (1996) | φ' = √(20·(N1)60) + 20 | Kumlar; yaklaşık 3.5 ≤ (N1)60 ≤ 30 ⚠ doğrula |
| Peck, Hanson & Thornburn (1974) — Wolff (1989) | φ' = 27.1 + 0.3·(N1)60 − 0.00054·(N1)60² | Kumlar; (N1)60 ≤ ~50 |
| FHWA GEC-5 / NHI-06-088 tablosu | (N1)60 aralığına göre φ' tablo değerleri | Ön tasarım/kontrol |
| Robertson & Campanella (1983) | tan φ' = (1/2.68)·[log(q_c/σ'v0) + 0.29] | Kuvars kumu, çimentosuz, I_c < 2.6 |
| Kulhawy & Mayne (1990) / Mayne (2007) | φ' = 17.6 + 11.0·log[(q_t/Pa)/(σ'v0/Pa)^0.5] | Temiz kum, I_c < ~2.05–2.6 |
| İnce daneli (NC kil, drenajlı) | sin φ' ≈ 0.8 − 0.094·ln(PI) (Terzaghi, Peck & Mesri 1996, Kenney 1959 verisi) | 5 ≤ PI ≤ 80 ⚠ doğrula |

#### b) Efektif kohezyon c'
- **SPT/CPT'den güvenilir c' korelasyonu literatürde yoktur.** FHWA (GEC-5) uzun-dönem tahkiklerde granüler zeminlerde c' = 0, NC killerde c' ≈ 0 kabulünü önerir; AK killerde c' laboratuvar (CD/CU triaksiyel) verisinden girilmelidir.
- Yazılım davranışı: varsayılan c' = 0; kullanıcı lab değeri girerse "kaynak: lab" olarak saklanır. Bu bilinçli bir tasarım kararıdır (sahte hassasiyet üretmemek).

#### c) Drenajsız kayma dayanımı s_u

| Kaynak | Formül | Geçerlilik |
|---|---|---|
| CPT (genel) | s_u = (q_t − σv0)/N_kt; N_kt = 10–20 (ort. 14) | Kil (I_c > 2.6); N_kt yerel kalibrasyonla seçilmeli |
| CPTu | s_u = Δu2/N_Δu, N_Δu = 4–10 | Hassas killer |
| Stroud (1974) | s_u ≈ f1·N60, f1 ≈ 4.4 kPa (PI'ya bağlı 3.5–6.5) | Aşırı konsolide killer; düşük güvenilirlik (C) |
| Hara et al. (1974) | s_u = 29·N60^0.72 (kPa) | Düşük güvenilirlik (C) |

#### d) Elastisite modülü E

| Kaynak | Formül | Geçerlilik |
|---|---|---|
| Kulhawy & Mayne (1990) / GEC-6 | E/Pa = α·N60; α = 5 (siltli/ince daneli kum), 10 (temiz NC kum), 15 (temiz AK kum) | Kumlar, drenajlı |
| Robertson (2009) | E' = α_E·(q_t − σv0); α_E = 0.015·10^(0.55·I_c + 1.68) | Genç, çimentosuz silis kumları, ~%0.1 deformasyon |
| Duncan & Buchignani (1976) | E_u = K·s_u, K = 100–1500 (PI ve OCR'ye bağlı tablo) | Killer, drenajsız |

#### e) Birim hacim ağırlık γ

| Kaynak | Formül | Geçerlilik |
|---|---|---|
| Robertson & Cabal (2010) | γ/γ_w = 0.27·log R_f + 0.36·log(q_t/Pa) + 1.236 | CPT, genel; iteratif (σv0 γ'ya bağlı) |
| SPT | Tablosal tipik değerler (FHWA-NHI-06-088, NAVFAC DM-7.01) — zemin türü + N aralığı | SPT'den doğrudan güvenilir γ formülü yok |

#### f) Yardımcı parametreler (sıvılaşma ve tasarım için)
- Relatif sıkılık: Skempton (1986) D_r = √((N1)60 / C_d), C_d ≈ 60 (NC ince-orta kum); CPT için Kulhawy & Mayne (1990) / Jamiolkowski (2001).
- Ön konsolidasyon: σ'p ≈ k·(q_t − σv0), k = 0.33 (0.2–0.5) (Mayne).
- CPT'den ince dane oranı: FC = 80·(I_c + C_FC) − 137, 0 ≤ FC ≤ 100, C_FC = 0 (±0.29) (B&I 2014).

### 1.4 Sıvılaşma Analizi

#### Ortak gerilme talebi
CSR = 0.65 · (a_max/g) · (σv0/σ'v0) · r_d
- a_max: kullanıcı girişi veya TBDY 2018 (≈ 0.4·S_DS·g) seçeneği; M_w kullanıcı girişi.
- Toplam gerilme için deprem anındaki YASS; efektif gerilme için ayrı "tasarım YASS" desteklenir (inşaat sırası/kuraklık farkı).

#### Yöntem A — Youd et al. (2001) [NCEER; Seed & Idriss tabanlı]
- r_d (Liao & Whitman 1986): z ≤ 9.15 m: 1 − 0.00765·z; 9.15 < z ≤ 23 m: 1.174 − 0.0267·z. (Blake 1996 polinomu seçenek.)
- MSF = 10^2.24 / M_w^2.56 (Idriss; NCEER önerilen aralığın alt sınırı).
- K_σ = (σ'v0/Pa)^(f−1), f = 0.6–0.8 (D_r'ye bağlı); K_α = 1 (eğimsiz zemin).
- SPT ince dane düzeltmesi: (N1)60cs = α + β·(N1)60;
  FC ≤ 5%: α=0, β=1; 5 < FC < 35%: α = exp(1.76 − 190/FC²), β = 0.99 + FC^1.5/1000; FC ≥ 35%: α=5, β=1.2.
- CRR7.5 (SPT) = 1/(34 − N) + N/135 + 50/(10N + 45)² − 1/200, N = (N1)60cs < 30; **(N1)60cs ≥ 30 → sıvılaşmaz**.
- CPT (Robertson & Wride 1998): q_c1Ncs = K_c·q_c1N; K_c = 1 (I_c ≤ 1.64), aksi halde K_c = −0.403·I_c⁴ + 5.581·I_c³ − 21.63·I_c² + 33.75·I_c − 17.88;
  CRR7.5 = 0.833·(q_c1Ncs/1000) + 0.05 (q_c1Ncs < 50); 93·(q_c1Ncs/1000)³ + 0.08 (50 ≤ q_c1Ncs < 160); **≥160 → sıvılaşmaz**.

#### Yöntem B — Boulanger & Idriss (2014) [UCD/CGM-14/01]; 2008 monografı ile tutarlı
- r_d = exp[α(z) + β(z)·M]; α(z) = −1.012 − 1.126·sin(z/11.73 + 5.133); β(z) = 0.106 + 0.118·sin(z/11.28 + 5.142); z ≤ 34 m (z > 20 m'de belirsizlik artar → uyarı).
- SPT: (N1)60cs = (N1)60 + Δ(N1)60; Δ(N1)60 = exp[1.63 + 9.7/(FC+0.01) − (15.7/(FC+0.01))²].
- CPT: q_c1Ncs = q_c1N + Δq_c1N; Δq_c1N = (11.9 + q_c1N/14.6)·exp[1.63 − 9.7/(FC+2) − (15.7/(FC+2))²]; q_c1N = C_N·q_c/Pa, m = 1.338 − 0.249·(q_c1Ncs)^0.264 (21 ≤ q_c1Ncs ≤ 254) — iteratif.
- CRR(M=7.5, σ'=1 atm):
  - SPT: exp[(N1)60cs/14.1 + ((N1)60cs/126)² − ((N1)60cs/23.6)³ + ((N1)60cs/25.4)⁴ − 2.8]
  - CPT: exp[q_c1Ncs/113 + (q_c1Ncs/1000)² − (q_c1Ncs/140)³ + (q_c1Ncs/137)⁴ − 2.8]
- MSF = 1 + (MSF_max − 1)·[8.64·exp(−M/4) − 1.325]; MSF_max = 1.09 + ((N1)60cs/31.5)² ≤ 2.2 (SPT) veya 1.09 + (q_c1Ncs/180)³ ≤ 2.2 (CPT).
- K_σ = 1 − C_σ·ln(σ'v0/Pa) ≤ 1.1; C_σ = 1/(18.9 − 2.55·√((N1)60cs)) ≤ 0.3 (SPT) veya 1/(37.3 − 8.27·(q_c1Ncs)^0.264) ≤ 0.3 (CPT).
- CRR_M,σ' = CRR7.5,1 · MSF · K_σ; **FS_liq = CRR_M,σ' / CSR_M,σ'**.

#### Akış (her derinlik noktası için)
```
Girdi (SPT/CPT, YASS, a_max, M_w, FC/PI)
 → σv0, u0, σ'v0 profili (γ iteratif)
 → Duyarlılık filtresi:
     • YASS üstü → "Sıvılaşmaz (doygun değil)"
     • Kil-benzeri: I_c > 2.6 (CPT) veya PI ≥ 7 (B&I) → "Sıvılaşmaz – siklik yumuşama tahkiki önerilir"
     • Bray & Sancio (2006) kriteri (opsiyonel): PI < 12 ve w/LL > 0.85 → duyarlı; 12 ≤ PI < 18 ve w/LL > 0.8 → orta
     • Kullanıcı manuel "sıvılaşmaz" bayrağı (ör. kaya, kil kama)
 → Düzeltmeler ((N1)60cs veya q_c1Ncs; iteratif yakınsama, tol 1e-4, max 50)
 → CRR7.5 → MSF, K_σ → CRR_M,σ'
 → CSR (r_d) → FS
 → Sınıflama: FS < 1.0 sıvılaşır; 1.0–hedef FS (kullanıcı, tip. 1.1–1.3, TBDY: 1.1) marjinal; ≥ hedef güvenli
 → Opsiyonel çıktılar: LPI (Iwasaki 1978), LSN (van Ballegooy 2014), sıvılaşma sonrası oturma (Zhang et al. 2002 / Ishihara-Yoshimine 1992)
```

#### Sınır durumları / hata yönetimi
- (N1)60cs veya q_c1Ncs üst sınır aşımı → CRR kapatılır (FS = "N/L, sıvılaşmaz", sayısal sonsuz değil).
- İterasyon yakınsamazsa → nokta işaretlenir, sonuç üretilir ama "yakınsamadı" uyarısı.
- z > 20 m → "basitleştirilmiş yöntem geçerlilik sınırı" uyarısı; z > 34 m (B&I r_d) hesap dışı.
- FC verisi yok (SPT) → kullanıcı varsayımı zorunlu, raporda belirtilir; CPT'de FC(I_c) tahmini ve C_FC duyarlılığı.
- İnce tabaka/geçiş zonu (CPT, I_c'nin hızlı değiştiği bölgeler) → opsiyonel geçiş zonu tespiti ve filtre (Boulanger & DeJong 2018 yaklaşımı — ileri faz).
- σ'v0 ≤ 0 (artezyen vb.) → hata, hesap durdurulur.

### 1.5 İstinat Yapıları — Yanal Toprak Basınçları

| Yöntem | Formül | Geçerlilik / Not |
|---|---|---|
| Rankine (yatay dolgu, düşey arka yüz) | K_a = tan²(45 − φ'/2), K_p = tan²(45 + φ'/2); σ_h = K·σ'v − 2c'√K (+ u) | Sürtünmesiz duvar; eğimli dolgu için genel Rankine (β ≤ φ') |
| Coulomb | K_a = cos²(φ−θ) / {cos²θ·cos(δ+θ)·[1 + √(sin(φ+δ)·sin(φ−β) / (cos(δ+θ)·cos(θ−β)))]²} | β ≤ φ; δ ≤ (2/3)φ önerilir; **pasifte δ > φ/2 için Coulomb güvensiz** → log-spiral (Caquot-Kerisel / NAVFAC) kullanılır |
| Mononobe-Okabe (aktif) | ψ = tan⁻¹[k_h/(1 − k_v)]; K_AE = cos²(φ−θ−ψ) / {cosψ·cos²θ·cos(δ+θ+ψ)·[1 + √(sin(φ+δ)·sin(φ−β−ψ) / (cos(δ+θ+ψ)·cos(β−θ)))]²}; P_AE = ½γH²(1−k_v)K_AE | **φ − β − ψ ≥ 0 şartı**; aksi halde M-O çözümsüz → GEC-3'teki genelleştirilmiş limit denge (deneme kaması) yöntemine yönlendirme |
| Seed & Whitman (1970) | ΔK_AE ≈ (3/4)·k_h, ΔP_AE etki noktası ≈ 0.6H | Kontrol/basit yaklaşım |
| k_h seçimi (GEC-3/NCHRP 611) | k_h = α·k_max; k_max = A_s (=F_PGA·PGA); yer değiştirmeye izin veren duvarlar için 0.5·k_max (25–50 mm), yükseklik azaltma katsayısı α(H, zemin sınıfı) | k_v = 0 varsayılan |
| Kohezyonlu dolgu | Minimum eşdeğer akışkan basıncı (FHWA: σ_h ≥ 0.25·γ·z civarı / tip. 5 kN/m³·z) ve çekme çatlağı z_c = 2c'/(γ√K_a) | ⚠ doğrula |
| Sürşarj | Uniform q: Δσ_h = K·q; çizgi/şerit yük: Boussinesq-esaslı (Terzaghi düzeltmeli) | İleri faz |

Çok tabakalı profil: tabaka sınırlarında K değişir → basınç diyagramı parçalı lineer; su basıncı ayrı bileşen; drenajlı/drenajsız (kısa dönem s_u) durum seçimi.

### 1.6 Stabilite Tahkikleri

| Tahkik | Yöntem | Varsayılan min. FS (ASD) statik / sismik |
|---|---|---|
| Devrilme | ΣM_R / ΣM_O, ayak ucu etrafında; alternatif: eksantrisite kriteri e ≤ B/6 (zemin), B/4 (kaya) — AASHTO yaklaşımı | 2.0 / 1.5 |
| Kayma | (ΣV·tan δ_b + c_a·B' + P_p,kullanılabilir) / ΣH; pasif direnç azaltılmış veya ihmal (kullanıcı seçimi) | 1.5 / 1.1 |
| Taban basıncı | q_max,min = (ΣV/B)(1 ± 6e/B) (e ≤ B/6), aksi halde Meyerhof efektif genişlik q = ΣV/(B − 2e) | q_max ≤ q_all |
| Taşıma gücü | Meyerhof (1963), Hansen (1970), Vesic (1973/75): q_u = c'N_c s_c d_c i_c b_c g_c + q N_q (…) + ½γB'N_γ (…); N_q = e^(π tanφ)·tan²(45+φ/2), N_c = (N_q−1)cotφ; N_γ: Meyerhof (N_q−1)tan(1.4φ), Hansen 1.5(N_q−1)tanφ, Vesic 2(N_q+1)tanφ. **Eğik yük faktörleri (i) duvarlar için kritik.** Drenajsız: q_u = 5.14·s_u·(…)+q | 3.0 / 2.0 (ASD) |
| Toptan göçme | Bishop basitleştirilmiş (dairesel), grid + optimizasyon ile kritik daire; Fellenius kontrol; ileri fazda Spencer / Morgenstern-Price; sismik: psödo-statik k_h | 1.5 / 1.1 |
| Palplanş/iksa | Konsol: sabit uç (fixed earth support, Blum basitleştirmesi); tek ankrajlı: serbest uç (free earth support). Gömülme: K_p'ye FS (1.5–2.0) veya derinliğe %20–40 artırım (USS Steel Sheet Piling Manual, USACE EM 1110-2-2504). Çıktı: D, M_max, ankraj kuvveti, gerekli kesit modülü | Yöntem bazlı |

Tasarım felsefesi ayarlanabilir olacak: **ASD (global FS)** varsayılan; **AASHTO LRFD** ve **Eurocode 7 (DA1/DA2) / TBDY 2018** kısmi katsayı setleri konfigürasyon dosyasından (YAML) yüklenir.

Duvar tipine göre yaklaşım:
- **Ağırlık duvarı:** Coulomb (duvar arka yüzü üzerinde δ ≠ 0), M-O sismik; duvar ataleti k_h·W_duvar.
- **Betonarme konsol:** Topuk ucundan geçen sanal düşey düzlemde Rankine/Coulomb (δ = β); topuk üstü zemin ağırlığı stabiliteye dahil; gövde/ayak/topuk kesit tesirleri (M, V) betonarme boyutlandırma için çıktı (betonarme donatı hesabı Faz 8+ opsiyon).
- **Palplanş:** net basınç diyagramı, kök çözümü (scipy brentq) ile D; M_max kesme kuvvetinin sıfır olduğu noktada. İleri faz: Winkler yay modeli (yatak katsayısı).

---

## 2. Veri Mimarisi ve Modüller Arası Entegrasyon

Pydantic v2 modelleri (doğrulama + JSON serileştirme). Proje dosyası: `.gtk` = JSON (sürüm alanlı, ileriye dönük göç desteği).

```
Project
├── meta: ProjectMeta (ad, no, mühendis, tarih, şema_sürümü, birim_sistemi="SI")
├── site: SiteSeismic (koordinat, PGA, M_w, S_DS, S_D1, zemin sınıfı, kaynak: "TBDY"/"kullanıcı")
├── investigations
│   ├── boreholes: list[Borehole]
│   │     id, konum, kot, YASS_ölçülen, enerji_oranı, kuyu_çapı, numune_tipi
│   │     spt: list[SPTRecord(depth, N_field, N_refusal_flag, notes)]
│   │     lab: list[LabRecord(depth, w, LL, PL, PI, FC, D10..D60, γ, c', φ', s_u)]
│   └── cpts: list[CPTSounding]
│         id, konum, alan_oranı a, ön_delme_derinliği
│         data: dataframe-benzeri sütunlar (depth, qc, fs, u2) — numpy dizisi olarak tutulur
├── soil_profiles: list[SoilProfile]          ← Modül 1 çıktısı / Modül 2 girdisi
│     id, kaynak_sondajlar[]
│     gwt: GroundwaterCondition(depth_insitu, depth_design, depth_seismic, artezyen_basıncı?)
│     layers: list[SoilLayer]
│        id, top, bottom, (thickness = property)
│        description, uscs, sbtn_zone, behaviour ("drained"/"undrained")
│        γ, γ_sat
│        params: dict[ParamKey, DerivedParameter]   # phi_eff, c_eff, su, E, Dr, OCR, FC, PI, N1_60, qc1N...
│        design: DesignParameters (karakteristik φ', c', s_u, γ, E, δ_b — kullanıcı onaylı)
│        liquefiable: bool | None, residual_su?  (sıvılaşma sonrası dayanım, Modül 2'ye aktarılır)
│     methods:
│        stress_at(z) → (σv, u, σ'v)   # tabaka-entegre, YASS'a duyarlı
│        layer_at(z), sublayer(z1,z2), to_dataframe()
├── analyses
│   ├── corrections: dict[sounding_id, ProcessedProfile]  (N60, (N1)60, qt, Qtn, Fr, Ic, SBTn — derinlik dizileri)
│   ├── liquefaction: list[LiquefactionResult]
│   │     method ("Youd2001"/"BI2014"), girdiler (a_max, M_w, hedef FS, gwt)
│   │     rows: depth, CSR, CRR75, MSF, Kσ, CRR, FS, durum, uyarılar
│   │     summary: LPI, LSN, oturma, kritik zonlar
│   └── walls: list[WallDesign]
│         wall_type: GravityWall | CantileverWall | SheetPileWall  (discriminated union)
│         geometry (polygonal kesit), materials (γ_beton, f_ck...), loads (sürşarj, su farkı, sismik k_h,k_v)
│         profile_ref: SoilProfile.id + backfill_override (dolgu ayrı malzeme olabilir)
│         settings: earth_pressure_method, bearing_method, design_code (ASD/LRFD/EC7)
│         results: pressures, checks[CheckResult(name, demand, capacity, FS, required, pass, details)]
```

**DerivedParameter** (izlenebilirliğin çekirdeği):
```
value, unit, method_id ("KM1990_phi_SPT"), reference ("Kulhawy & Mayne 1990, EPRI EL-6800"),
source ("SPT"|"CPT"|"lab"|"user"), inputs_used{...}, validity_ok: bool, warnings[],
reliability ("A"|"B"|"C"), stats (birden çok korelasyon varsa min/ort/max), user_override: bool
```

**Entegrasyon akışı:** Modül 1 → `SoilProfile` (tabakalar + DesignParameters + GWT + sıvılaşma bayrağı) → Modül 2 bu nesneyi referansla alır; kullanıcı Modül 2'de tasarım parametresini değiştirirse profile değil `backfill_override`/duvar-özel kopya üzerinde değişir (kaynak profilin bütünlüğü korunur). Profil değişirse bağlı duvar analizleri "güncel değil" olarak işaretlenir (basit sürüm/hash kontrolü).

**Korelasyon kayıt defteri:** Her korelasyon; kimlik, kaynak, girdi tipleri, geçerlilik fonksiyonu ve hesap fonksiyonundan oluşan bir kayıt olarak `registry`'ye eklenir. UI uygulanabilir korelasyonları listeler, kullanıcı seçer veya "tümünü hesapla + istatistik" ile aralığı görür. Yeni korelasyon eklemek = tek dosyaya tek kayıt (genişletilebilirlik).

---

## 3. GUI ve Kütüphane Mimarisi

### 3.1 Çatı karşılaştırması

| Kriter | PySide6 / PyQt6 | CustomTkinter | Streamlit | Dash |
|---|---|---|---|---|
| Etkileşimli tablolar (binlerce CPT satırı) | Çok iyi (QTableView + model) | Zayıf | Orta | İyi (AG Grid/DataTable) |
| Kesit/duvar geometrisi interaktif düzenleme | Çok iyi (QGraphicsScene) | Zayıf | Zayıf | Orta (Plotly shapes) |
| Matplotlib gömme / rapor kalitesi grafik | Doğal (FigureCanvasQTAgg) | Mümkün | Statik görüntü | Plotly ağırlıklı |
| Durum yönetimi (çok adımlı proje) | Olgun (sinyal/slot, undo stack) | Basit | Her etkileşimde yeniden çalıştırma — karmaşık projede sorunlu | Callback grafiği, orta karmaşıklık |
| Çevrimdışı dağıtım (.exe) | PyInstaller/Nuitka ile mümkün | Kolay | Sunucu gerekir | Sunucu gerekir |
| Öğrenme/geliştirme hızı | Orta–yavaş | Hızlı | Çok hızlı | Orta |
| Lisans | **PySide6: LGPL** (ticari dağıtım serbest); PyQt6: GPL/ticari | MIT | Apache | MIT |

### 3.2 Öneri
**PySide6 + Matplotlib (+ opsiyonel pyqtgraph)** masaüstü uygulaması. Gerekçe: mühendislik yazılımının ihtiyaç duyduğu yoğun tablo girişi, interaktif kesit çizimi, undo/redo, çevrimdışı kullanım ve ticari dağıtım esnekliği. Matplotlib hem ekran hem rapor için aynı grafiği üretir (tutarlılık). Motor UI'den bağımsız olduğundan ileride **FastAPI + web** veya hızlı demo için **Streamlit** önyüzü eklenebilir.

### 3.3 Katmanlı mimari

```
geotek/
├── core/            # Saf veri: Pydantic modelleri, birimler, sabitler, hatalar
│   ├── models/      # project.py, profile.py, investigations.py, walls.py, results.py
│   └── units.py     # SI iç sistem, dönüşüm tabloları (UI sınırında kullanılır)
├── engine/          # Saf hesap (numpy/scipy), GUI bağımlılığı YOK
│   ├── insitu/          spt_corrections.py, cpt_processing.py
│   ├── classification/  robertson.py (1990, 2009 SBTn), uscs.py
│   ├── correlations/    registry.py, phi.py, su.py, modulus.py, unit_weight.py, density.py
│   ├── stresses.py      # σv, u, σ'v profili
│   ├── liquefaction/    common.py, youd2001.py, boulanger_idriss2014.py, indices.py (LPI/LSN)
│   ├── earth_pressure/  rankine.py, coulomb.py, mononobe_okabe.py, layered.py, surcharge.py
│   ├── bearing/         factors.py, meyerhof.py, hansen.py, vesic.py
│   ├── stability/       slices.py, bishop.py, search.py
│   └── walls/           base.py, gravity.py, cantilever.py, sheetpile.py
├── services/        # Orkestrasyon: Modül1Pipeline, WallDesignService, iterasyon kontrolü
├── io/              # CSV/Excel içe aktarma, GEF (CPT), AGS4 (opsiyonel), proje JSON kaydet/aç
├── reporting/       # python-docx hesap raporu (+PDF), Jinja2 şablonlar, figür üreticileri
├── config/          # Tasarım kodları kısmi katsayı setleri (YAML), varsayılanlar
└── ui/              # PySide6 (MVP/MVVM): views, presenters, widgets
    ├── widgets/     borehole_log.py, depth_plot.py, sbtn_chart.py, wall_section.py, slip_circle.py
    └── windows/     main_window.py, module1/, module2/
tests/
├── unit/            # formül bazlı
├── verification/    # yayımlanmış çözümlü örnekler (golden)
└── property/        # hypothesis: monotonluk, sınır davranışları
```

Kütüphaneler: numpy, scipy (optimize/root), pandas (tablo I/O), pydantic v2, matplotlib, PySide6, python-docx, openpyxl, PyYAML, pytest, hypothesis, ruff, mypy.

Görselleştirmeler: sondaj logu (tabaka renkleri/USCS deseni + SPT N), derinlik grafikleri (q_t, f_s, u2, I_c, SBTn, N60, (N1)60cs, CSR/CRR, FS — ortak derinlik ekseni), Robertson Q_tn–F_r grafiği üzerinde noktalar, duvar kesiti + basınç diyagramı, kritik kayma dairesi + dilimler.

---

## 4. Adım Adım Geliştirme Yol Haritası

| Faz | Kapsam | Teslim / Kabul kriteri |
|---|---|---|
| **0** | Literatür doğrulama (bu belgedeki ⚠ maddeler dahil, orijinal kaynaklarla), golden test vakalarının derlenmesi (B&I 2014 raporu örnekleri, Youd 2001, FHWA-NHI-06-088 örnek problemleri, Das *Principles of Foundation Engineering* duvar örnekleri), proje iskeleti, CI/test altyapısı | Doğrulanmış formül tablosu + test vakası veri seti |
| **1** | `core` veri modelleri, birimler, `SoilProfile` + gerilme hesabı, JSON kaydet/aç, CSV/Excel içe aktarma | Model + gerilme birim testleri geçer; örnek proje kaydedilip açılır |
| **2** | SPT düzeltmeleri, CPT işleme, Robertson 1990/2009 SBTn, USCS, korelasyon kayıt defteri + tüm korelasyonlar | Her formül için birim test + literatür örneğine ±%1 uyum |
| **3** | Sıvılaşma: Youd 2001 + B&I 2014 (SPT & CPT), duyarlılık filtreleri, LPI/LSN, (opsiyonel) oturma | B&I 2014 ve Youd 2001 örnekleriyle FS uyumu; sınır durumu testleri |
| **4** | Modül 1 GUI: veri giriş tabloları, sondaj logu, derinlik grafikleri, SBTn grafiği, tabakalandırma ve tasarım parametresi onay ekranı | Uçtan uca: CPT dosyası → profil → sıvılaşma grafiği |
| **5** | Yanal basınç motoru (Rankine, Coulomb, M-O, log-spiral pasif, çok tabaka, su, sürşarj) + taşıma gücü (Meyerhof/Hansen/Vesic) | Ders kitabı/FHWA örnekleriyle uyum |
| **6** | Ağırlık + konsol duvar: devrilme, kayma, eksantrisite, taban basıncı, taşıma gücü; Bishop global stabilite (dairesel arama) | Çözümlü örnekler + bağımsız elle hesap karşılaştırması |
| **7** | Palplanş: konsol (sabit uç) ve tek ankrajlı (serbest uç); M_max, ankraj kuvveti, kesit seçimi | USS/USACE örnekleriyle uyum |
| **8** | Modül 2 GUI: duvar tipi seçimi, parametrik kesit editörü, basınç diyagramı, kayma dairesi görselleştirme, Modül 1 profil bağlama; hesap raporu (docx/PDF) | Uçtan uca: profil → duvar tasarımı → rapor |
| **9** | Paketleme (PyInstaller/Nuitka), doğrulama el kitabı (verification manual), kullanıcı kılavuzu | Kurulabilir Windows sürümü |
| **İleri** | Spencer/M-P, Winkler palplanş, çok ankrajlı iksa, geçiş zonu filtresi, siklik yumuşama (killer), Robertson 2016, LRFD/EC7 tam kısmi katsayı setleri, web önyüzü | — |

## 5. Doğrulama Stratejisi
- **Birim testleri:** her formül, bilinen girdi/çıktı (literatürdeki tablo/örnek).
- **Doğrulama testleri:** yayımlanmış çözümlü örnekler (tolerans: ±%1 sayısal, eğrilerden okunan değerlerde ±%5).
- **Özellik testleri (hypothesis):** monotonluk (N artınca CRR artmalı, φ artınca K_a azalmalı), M-O k_h → 0 iken Coulomb'a yakınsama, sınır dışı girdilerde uyarı üretimi.
- **Çapraz kontrol:** mümkünse ticari yazılım çıktılarıyla (CLiq, GeoStudio SLOPE/W, GEO5) karşılaştırma — kullanıcı erişimine bağlı.
- Her fazın sonunda `pytest` tam geçiş + bir uçtan uca senaryo çalıştırılır.

## 6. Kullanıcı kararları (onaylandı)
1. GUI: **PySide6 masaüstü**.
2. Tasarım yaklaşımı: **ASD, TBDY 2018 / EC7 ve AASHTO LRFD'nin hepsi kullanıcı tarafından seçilebilir** (YAML katsayı setleri).
3. Dil: **İki dilli (TR/EN)**; kod ve docstring'ler İngilizce.
4. Veri formatı: **CSV / Excel**.
