import type { Topic } from "./types";

export const topic: Topic = {
  id: "liquefaction",
  title: {
    tr: "Sıvılaşma tetiklenmesi (SPT ve CPT)",
    en: "Liquefaction triggering (SPT and CPT)",
  },
  summary: {
    tr: "Programın Youd 2001 ve Boulanger-Idriss 2014 yöntemlerinde talep (CSR), direnç (CRR), güvenlik katsayısı ve LPI nasıl hesapladığını adım adım anlatır.",
    en: "Explains how the program computes demand (CSR), resistance (CRR), factor of safety and LPI with the Youd 2001 and Boulanger-Idriss 2014 methods.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/liquefaction/analysis.py",
    "geotek/engine/liquefaction/common.py",
    "geotek/engine/liquefaction/youd2001.py",
    "geotek/engine/liquefaction/boulanger_idriss2014.py",
    "geotek/engine/insitu/spt.py",
    "geotek/engine/insitu/cpt.py",
    "geotek/engine/correlations/physical.py",
    "geotek/engine/stresses.py",
  ],
  sources: [
    "Youd, T.L. vd. (2001). Liquefaction resistance of soils: summary report from the 1996 NCEER and 1998 NCEER/NSF workshops. J. Geotech. Geoenviron. Eng., 127(10), 817-833.",
    "Boulanger, R.W. & Idriss, I.M. (2014). CPT and SPT based liquefaction triggering procedures. Rapor UCD/CGM-14/01, UC Davis.",
    "Idriss, I.M. & Boulanger, R.W. (2008). Soil liquefaction during earthquakes. EERI MNO-12.",
    "Robertson, P.K. & Wride, C.E. (1998). Evaluating cyclic liquefaction potential using the cone penetration test. Can. Geotech. J., 35(3), 442-459.",
    "Seed, H.B. & Idriss, I.M. (1971). Simplified procedure for evaluating soil liquefaction potential. J. SMFE ASCE, 97(9).",
    "Liao, S.S.C. & Whitman, R.V. (1986). Overburden correction factors for SPT in sand. J. Geotech. Eng., 112(3).",
    "Iwasaki, T. vd. (1978; 1984). Liquefaction potential index (LPI) yaklaşımı ve tehlike kategorileri. Yıl ikincil kaynaktan; özgün makaleden doğrulanmadı.",
  ],
  blocks: [
    {
      type: "p",
      text: {
        tr: "Sıvılaşma tetiklenmesi, bir deprem sırasında doygun zeminde oluşan döngüsel gerilme talebinin (CSR) zeminin direncini (CRR) aşıp aşmadığını sorar. Programdaki ana ölçüt güvenlik katsayısıdır: FS = CRR / CSR. Aşağıdaki formüller ve katsayılar kaynak koddan okunmuştur.",
        en: "Triggering asks whether the cyclic stress demanded by an earthquake exceeds the soil's cyclic resistance. The governing ratio is FS = CRR / CSR.",
      },
    },
    { type: "h", text: { tr: "1. Talep: döngüsel gerilme oranı (CSR)", en: "1. Demand: cyclic stress ratio (CSR)" } },
    {
      type: "formula",
      expr: "CSR = 0,65 · (a_max / g) · (σv0 / σ'v0) · rd",
      caption: {
        tr: "Seed ve Idriss (1971) biçimi; 0,65 kodda sabit katsayıdır (common.cyclic_stress_ratio). a_max/g: 0 < a_max <= 2 g. σv0 toplam, σ'v0 efektif düşey gerilme, deprem anındaki su seviyesiyle hesaplanır.",
        en: "Seed and Idriss (1971) form; 0.65 is a fixed constant in the code. Stresses use the seismic water table.",
      },
    },
    {
      type: "formula",
      expr: "rd (Youd 2001): 1 - 0,00765 z (z <= 9,15 m); 1,174 - 0,0267 z (z <= 23 m); 0,744 - 0,008 z (z <= 30 m).   rd (BI2014): exp[α + β·M], α = -1,012 - 1,126 sin(z/11,73 + 5,133), β = 0,106 + 0,118 sin(z/11,28 + 5,142), z <= 34 m",
      caption: {
        tr: "Gerilme azaltma katsayısı. Youd eğrisi Mw'den bağımsızdır; 23-30 m dalı kodda Robertson & Wride (1998) uzantısıdır. BI2014 rd Mw'ye bağlıdır ve 34 m üstünde NaN döner.",
        en: "Stress reduction factor. Youd rd is independent of Mw; BI2014 depends on M.",
      },
      where: [{ tr: "z: derinlik [m]; M: moment magnitude (kod 4,0 - 9,5 kabul eder).", en: "z depth [m]; M moment magnitude." }],
    },
    {
      type: "assumptions",
      title: { tr: "Talep tarafındaki varsayımlar", en: "Demand-side assumptions" },
      items: [
        { tr: "σ'v0 deprem anındaki GWT ile hesaplanır (gwt_seismic; profilde yoksa profilin seismic GWT değeri), test anındaki GWT ile değil.", en: "Effective stress uses the seismic GWT, not the in-situ GWT." },
        { tr: "Boşluk suyu hidrostatik kabul edilir. Üstte su birikintisi (GWT < 0) desteklenmez.", en: "Hydrostatic pore pressure; ponded water not supported." },
        { tr: "Değerlendirme sınırları: Youd 30 m, BI2014 34 m. Sınırın altındaki noktalar hesaplanır.", en: "Evaluation limits: 30 m (Youd), 34 m (BI)." },
      ],
    },
    { type: "h", text: { tr: "2. Direnç: SPT ve CPT", en: "2. Resistance: SPT and CPT" } },
    {
      type: "p",
      text: {
        tr: "SPT için N önce N60 = N · (ER/60) · C_B · C_S · C_R ile düzeltilir; (N1)60 = C_N · N60 ve C_N = min[(Pa/σ'v0)^0,5 , 1,7] (Liao-Whitman). Youd yöntemi ince dane düzeltmesini doğrudan uygular; BI2014 ise (N1)60cs'yi iteratif çözer.",
        en: "SPT N is energy-corrected to N60, normalised to (N1)60 (Liao-Whitman, capped at 1.7). Youd applies the fines correction directly; BI2014 solves it iteratively.",
      },
    },
    {
      type: "formula",
      expr: "Youd 2001 SPT: (N1)60cs = α + β (N1)60, FC <= 5: α = 0, β = 1; 5 < FC < 35: α = exp(1,76 - 190/FC²), β = 0,99 + FC^1,5/1000; FC >= 35: α = 5, β = 1,2.   CRR7,5 = 1/(34 - N) + N/135 + 50/(10N + 45)² - 1/200, N = (N1)60cs < 30 (N >= 30: yoğun, CRR yok)",
      caption: {
        tr: "Youd 2001 SPT yolu (youd2001.py). FC kod içinde varsayılan almaz; kullanıcının açıkça girmesi gerekir. CPT yolunda Youd CRR7,5 = 0,833 q/1000 + 0,05 (q < 50) veya 93 (q/1000)³ + 0,08 (q >= 50), q = q_c1Ncs < 160.",
        en: "Youd 2001 SPT path; FC must be supplied. Youd CPT CRR7.5 uses q_c1Ncs below 160.",
      },
    },
    {
      type: "formula",
      expr: "BI2014 SPT: Δ(N1)60 = exp[1,63 + 9,7/(FC+0,01) - (15,7/(FC+0,01))²];  (N1)60cs = C_N · N60 + Δ;  C_N = min[(Pa/σ'v0)^m, 1,7], m = 0,784 - 0,0768 √min((N1)60cs, 46);  CRR7,5 = exp[N/14,1 + (N/126)² - (N/23,6)³ + (N/25,4)⁴ - 2,8]",
      caption: {
        tr: "BI2014 SPT (boulanger_idriss2014.py). C_N ve Δ birlikte iterasyonla çözülür (tol 1e-4, en fazla 50 adım). BI2014 CPT yolunda ise q_t ile m = 1,338 - 0,249 q_c1Ncs^0,264 (q_c1Ncs 21-254 aralığında kırpılır) kullanılır ve FC varsayılan olarak I_c'den gelir.",
        en: "BI2014 SPT iteration; the CPT path uses q_t and an iterative exponent m, with FC from I_c by default.",
      },
    },
    {
      type: "example",
      title: { tr: "Örnek: 5 m derinlik, Youd 2001 SPT", en: "Example: 5 m depth, Youd 2001 SPT" },
      text: {
        tr: "Veri: a_max/g = 0,25, M = 7,5, σv0 = 92,5 kPa, σ'v0 = 63,07 kPa, (N1)60 = 12, FC = 10 %. rd = 1 - 0,00765·5 = 0,962. CSR = 0,65 · 0,25 · (92,5/63,07) · 0,962 = 0,229. (N1)60cs = 0,869 + 1,022·12 = 13,13. CRR7,5 = 0,142. M = 7,5 için MSF ≈ 1 ve σ'v0 < Pa olduğundan K_σ = 1. FS = 0,142 / 0,229 = 0,62 < 1: sıvılaşabilir.",
        en: "Inputs: a_max/g 0.25, M 7.5, σ'v0 63.07 kPa, (N1)60 12, FC 10%. CSR 0.229, CRR 0.142, FS 0.62.",
      },
    },
    { type: "h", text: { tr: "3. Büyüklük ölçekleme ve yüksek gerilme", en: "3. Magnitude scaling and overburden" } },
    {
      type: "formula",
      expr: "MSF (Youd, varsayılan 'idriss'): 10^2,24 / M^2,56 (alternatif 'andrus_stokoe': (M/7,5)^-3,3).   MSF (BI2014) = 1 + (MSF_max - 1)(8,64·exp(-M/4) - 1,325), MSF_max = min(1,09 + (N1cs/31,5)², 2,2) SPT veya min(1,09 + (q_c1Ncs/180)³, 2,2) CPT",
      caption: {
        tr: "Büyüklük ölçekleme. Idriss varyantı NCEER aralığının alt sınırıdır.",
        en: "Magnitude scaling factors; the Idriss variant is the lower bound of the NCEER range.",
      },
    },
    {
      type: "formula",
      expr: "Youd: K_σ = (σ'v0/Pa)^(f-1) yalnız σ'v0 > Pa için, aksi halde 1 (f = 0,7; aralık 0,6-0,8).   BI2014: K_σ = 1 - C_σ ln(σ'v0/Pa) <= 1,1, C_σ = 1/(18,9 - 2,55√N) (SPT), 1/(37,3 - 8,27 q^0,264) (CPT), C_σ en fazla 0,3.   CRR = CRR7,5 · MSF · K_σ;  FS = CRR / CSR",
      caption: {
        tr: "Kapasite ve güvenlik katsayısı, kodda bu sırayla hesaplanır (analysis._demand_and_capacity).",
        en: "Capacity and FS in code order.",
      },
    },
    {
      type: "steps",
      title: { tr: "Nokta durumu: kodun öncelik sırası", en: "Point status: code precedence" },
      items: [
        { tr: "Kullanıcı dışlaması (excluded_by_user) en yüksek önceliktir.", en: "User exclusion first." },
        { tr: "z < GWT: above_gwt, FS yok.", en: "Above GWT: no FS." },
        { tr: "Yöntem derinlik sınırının altında: beyond_method_depth.", en: "Beyond method depth." },
        { tr: "PI >= 7 veya CPT'de I_c > 2,6: clay_like, FS yok; çevrimsel yumuşama ayrıca değerlendirilir.", en: "Clay-like (PI >= 7 or Ic > 2.6): no FS." },
        { tr: "Youd SPT (N1)60cs >= 30 veya CPT q_c1Ncs >= 160: non_liquefiable_dense.", en: "Dense: Youd Ncs >= 30 or qc1Ncs >= 160." },
        { tr: "σ'v0 <= 0 veya FS sonlu değil: invalid. Kalan noktalar: FS < 1 sıvılaşabilir; 1 <= FS < hedef (varsayılan 1,1) marjinal; FS >= hedef güvenli.", en: "Invalid; otherwise liquefiable, marginal or safe by FS and target (default 1.1)." },
      ],
    },
    {
      type: "formula",
      expr: "LPI = ∫(0 → 20 m) F(z) · w(z) dz,   F = 1 - FS (FS < 1 ise, değilse 0),   w(z) = 10 - 0,5 z",
      caption: {
        tr: "Iwasaki vd. LPI; kod her aralığı doğrusal ağırlığın tam integraliyle toplar, sonlu olmayan FS 0 sayılır. İlk test noktası 2 m veya daha sığsa ilk aralık yüzeye uzatılır (GWT biliniyorsa en fazla GWT derinliğine kadar); 2 m eşiği programın seçimidir, kaynaktan gelmez. Sınıflar: 0 çok düşük; <= 5 düşük; <= 15 yüksek; > 15 çok yüksek. Bu bir ön tarama göstergesidir.",
        en: "Iwasaki LPI; the code sums each interval with the exact integral of the linear weight, and non-finite FS counts as 0. If the first test point is at 2 m or shallower, the first interval is extended to the surface (at most to the GWT depth when known); the 2 m threshold is a program choice, not from a source. Categories: 0 very low, up to 5 low, up to 15 high, above 15 very high. This is a screening indicator.",
      },
    },
    { type: "figure", id: "liq-csr-crr", caption: { tr: "Derinliğe göre CSR ve CRR eğrileri ve FS = CRR/CSR ilişkisi.", en: "CSR and CRR versus depth and FS = CRR/CSR." } },
    {
      type: "warn",
      text: {
        tr: "Youd K_c (CPT) I_c = 1,64'te süreksizdir: polinom yaklaşık 0,996 verir, kod bunu 1 yerine kullanır; R&W 1998'deki K_c = 1 kısayolu kullanılmaz. Refüzal darbe sayıları alt sınırdır ve FS konservatiftir. BI2014 SPT yolunda yoğunluk maskesi kapalıdır; K_σ σ'v0 < Pa iken 1'i geçebilir (1,1 ile sınırlı). Basitleştirilmiş yöntem sığ ve doygun kumlar için tasarlanmıştır; 20 m altındaki sonuçlar kod tarafından uyarılır.",
        en: "Youd Kc discontinuity at Ic 1.64; refusal counts are lower bounds; BI SPT has no dense mask; BI K_sigma can exceed 1 below Pa; results below 20 m are less reliable.",
      },
    },
    { type: "figure", id: "liq-rd-depth", caption: { tr: "rd - derinlik: Youd 2001 (30 m'ye kadar) ve BI2014 için M = 6,5 / 7,5 / 8,5 (34 m'ye kadar).", en: "rd versus depth: Youd 2001 and BI2014 for M 6.5, 7.5 and 8.5." } },
    { type: "figure", id: "liq-fs-profile", caption: { tr: "Derinliğe göre FS profili ve nokta durumları (sıvılaşabilir, marjinal, güvenli, dışlanmış, kil benzeri, yoğun), LPI değeri ve tehlike kategorisi etiketiyle.", en: "FS-depth profile with status colours, LPI value and category label." } },
  ],
};
