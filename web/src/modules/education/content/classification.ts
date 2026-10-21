import type { Topic } from "./types";

export const topic: Topic = {
  id: "classification",
  title: {
    tr: "Zemin sınıflandırması: USCS ve CPT (SBTn, I_c)",
    en: "Soil classification: USCS and CPT (SBTn, I_c)",
  },
  summary: {
    tr: "Programın USCS grup sembolünü laboratuvar verisinden, CPT tabanlı SBTn bölgesini ve I_c davranış indeksini nasıl hesapladığını ve ince dane yüzdesini I_c'den nasıl tahmin ettiğini anlatır.",
    en: "Explains how the program derives the USCS group symbol from lab data, the CPT SBTn zone and behaviour index I_c, and FC estimated from I_c.",
  },
  level: "intermediate",
  codeRefs: [
    "geotek/engine/classification/uscs.py",
    "geotek/engine/classification/uscs_names.py",
    "geotek/engine/classification/robertson.py",
    "geotek/engine/insitu/cpt.py",
    "geotek/engine/correlations/physical.py",
  ],
  sources: [
    "ASTM D2487: Standard Practice for Classification of Soils for Engineering Purposes (USCS).",
    "Casagrande, A. (1948). Classification and identification of soils. Trans. ASCE, 113.",
    "Robertson, P.K. (1990). Soil classification using the cone penetration test. Can. Geotech. J., 27(1).",
    "Robertson, P.K. (2009). Interpretation of cone penetration tests - a unified approach. Can. Geotech. J., 46(11).",
    "Robertson, P.K. (2010). Soil behaviour type from the CPT: an update. 2nd Int. Symp. on CPT, Huntington Beach.",
    "Robertson, P.K. & Cabal, K.L. (2010). Estimating soil unit weight from CPT. 2nd Int. Symp. on CPT.",
    "Boulanger, R.W. & Idriss, I.M. (2014). CPT and SPT based liquefaction triggering procedures. Rapor UCD/CGM-14/01 (I_c'den FC).",
  ],
  blocks: [
    {
      type: "p",
      text: {
        tr: "Sınıflandırma iki ayrı yoldan yapılır. Laboratuvar verisi varsa USCS (ASTM D2487) grup sembolü üretilir. CPT verisi varsa her nokta için normalize edilmiş davranış tipi (SBTn) bölgesi ve I_c indeksi hesaplanır. I_c ayrıca sıvılaşma analizinde ince dane yüzdesi (FC) tahmininde kullanılır. Bu sayfa yalnızca kodun yaptığını anlatır; kodun üretmediği ikincil tanımlayıcılar (ör. 'kumlu', 'çakıllı') burada yoktur.",
        en: "Two routes: USCS from lab data, and per-point SBTn zone and I_c from CPT. I_c also feeds FC estimation for liquefaction.",
      },
    },
    { type: "h", text: { tr: "1. USCS: ince dane ve plastisite", en: "1. USCS: fines and plasticity" } },
    {
      type: "formula",
      expr: "A-çizgisi: PI = 0,73 (LL - 20);   U-çizgisi: PI = 0,9 (LL - 8)",
      caption: {
        tr: "Casagrande plastisite diyagramı sınırları. Kod, PI > U-çizgisi durumunda 'verileri kontrol edin' notu ekler.",
        en: "Casagrande chart boundaries; code notes data check when PI is above the U-line.",
      },
      where: [
        { tr: "LL: likit limit [%]; PI: plastisite indeksi [%].", en: "LL liquid limit, PI plasticity index." },
      ],
    },
    {
      type: "formula",
      expr: "İnce dane sınıfı: PI < 4 veya A-çizgisinin altı → M (silt);  PI > 7 ve A-çizgisinin üstü → C (kil);  aradaki hatch bölge → CL-ML",
      caption: {
        tr: "uscs.fines_type. Kod sınır değerlerini kesin olarak bu şekilde uygular.",
        en: "uscs.fines_type classification of fines.",
      },
    },
    { type: "h", text: { tr: "2. USCS: iri dane (kum/çakıl) ve derecelenme", en: "2. USCS: coarse grains and grading" } },
    {
      type: "formula",
      expr: "Cu = D60 / D10;   Cc = D30² / (D10 · D60);   İyi derecelenmiş (W) ancak Cu >= Cu_min ve 1 <= Cc <= 3; Cu_min = 4 (çakıl G), 6 (kum S); aksi halde P (kötü)",
      caption: {
        tr: "Derecelenme kuralı. Önek G (çakıl) ise gravel > sand, değilse S (kum) seçilir.",
        en: "Grading rule with the G or S prefix chosen by the dominant fraction.",
      },
      where: [
        { tr: "Kum yüzdesi = 100 - çakıl - ince dane (kod hesaplar).", en: "Sand % = 100 - gravel - fines." },
      ],
    },
    {
      type: "steps",
      title: { tr: "Karar sırası (uscs.classify)", en: "Decision order in code" },
      items: [
        { tr: "FC >= 50 %: ince daneli. LL < 50 ise C→CL, M→ML, CL-ML→CL-ML; LL >= 50 ise A-çizgisinin üstünde CH, altında MH.", en: "Fines >= 50%: fine-grained, CL/ML/CL-ML if LL<50, CH/MH if LL>=50." },
        { tr: "FC < 5 %: temiz iri dane; sembol = G/S + W/P.", en: "Fines < 5%: clean coarse, G/S + W/P." },
        { tr: "5 % <= FC <= 12 %: çift sembol (örn. SW-SM, GP-GC). CL-ML sınıfı kodda C olarak kabul edilir.", en: "5-12% fines: dual symbol; CL-ML treated as C." },
        { tr: "12 % < FC < 50 %: G/S + C veya M; CL-ML ise SC-SM biçiminde.", en: "12-50% fines: GC/SM etc.; CL-ML gives SC-SM." },
      ],
    },
    {
      type: "example",
      title: { tr: "Örnek: SP-SC", en: "Example: SP-SC" },
      text: {
        tr: "FC = 8 %, çakıl = 20 %, LL = 35, PI = 12, D10 = 0,1, D30 = 0,5, D60 = 5 mm. Kum = 100 - 20 - 8 = 72 % > çakıl → önek S. Cu = 5/0,1 = 50, Cc = 0,5²/(0,1·5) = 0,5 (1 ile 3 dışında) → P. A-çizgisi = 0,73·15 = 10,95; PI = 12 ≥ 10,95 ve PI > 7 → C. Sonuç: SP-SC.",
        en: "FC 8%, gravel 20%, LL 35, PI 12, Cu 50, Cc 0.5, sand dominant. Result SP-SC.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Eksik veri varsayım gerektirir ve sonuç 'tam değil' işaretlenir: çakıl bilinmiyorsa kum kabul edilir; D10/D30/D60 yoksa 'kötü derecelenmiş' (P) varsayılır; ince dane plastisitesi yoksa 'silt' (M) varsayılır. Organik zeminler (OL/OH/Pt) için kurutulmuş LL gerekir ve kod bunları tanımlamaz. Bu varsayımlar açıkça notlarda yazılır.",
        en: "Missing data triggers stated assumptions and an incomplete flag; organic soils are not identified.",
      },
    },
    { type: "figure", id: "class-uscs-plasticity", caption: { tr: "Casagrande plastisite diyagramı: A ve U çizgileri, CL-ML bölgesi, C/M ayrımı; örnek noktalar (CL, ML, CH, MH).", en: "Plasticity chart with A and U lines, CL-ML hatch zone and sample points." } },
    { type: "h", text: { tr: "3. CPT: normalize değerler Q_tn, F_r ve I_c", en: "3. CPT: normalised Q_tn, F_r and I_c" } },
    {
      type: "formula",
      expr: "Q_tn = ((q_t - σv0) / Pa) · (Pa / σ'v0)^n;   F_r = f_s / (q_t - σv0) · 100 [%];   n = 0,381 I_c + 0,05 (σ'v0/Pa) - 0,15  (0 <= n <= 1)",
      caption: {
        tr: "Robertson (2009) normalize değerleri. Kod Q_tn, n ve I_c'yi birlikte iterasyonla çözer (tol 1e-3, en fazla 50 adım).",
        en: "Robertson (2009) normalised parameters; code solves Qtn, n and Ic jointly by iteration.",
      },
      where: [
        { tr: "q_t = q_c + u_2 (1 - a) (u_2 yoksa q_t = q_c; kod uyarı verir). a: alan oranı.", en: "q_t corrected tip resistance; a area ratio." },
      ],
    },
    {
      type: "formula",
      expr: "I_c = √[ (3,47 - log Q_tn)² + (log F_r + 1,22)² ]",
      caption: {
        tr: "Davranış indeksi (robertson.soil_behaviour_index). I_c < 2,6 kum benzeri, I_c > 2,6 kil benzeri (kodda clay_like eşiği).",
        en: "Soil behaviour index; below 2.6 sand-like, above 2.6 clay-like in code.",
      },
    },
    {
      type: "p",
      text: {
        tr: "Hesaplanan I_c'ye göre SBTn bölgesi, sınır değerleri (1,31; 2,05; 2,60; 2,95; 3,60) ile belirlenir: I_c < 1,31 bölge 7 (çakıllı kum); < 2,05 bölge 6 (kum); < 2,60 bölge 5 (kum karışımı); < 2,95 bölge 4 (silt karışımı); < 3,60 bölge 3 (kil); aksi halde bölge 2 (organik/kil). Bölge 1 (hassas) ise Q_tn < 12·exp(-1,4 F_r) koşuluyla atanır. Bölge 8 ve 9 kodda devre dışıdır: sınırları kaynaktan doğrulanmadığı için varsayılan olarak kapalıdır.",
        en: "I_c bounds: 1.31, 2.05, 2.60, 2.95, 3.60 map to zones 7 to 3, otherwise zone 2. Zone 1 by Qtn < 12 exp(-1.4 Fr). Zones 8-9 disabled by default.",
      },
    },
    {
      type: "example",
      title: { tr: "Örnek: Q_tn = 50, F_r = %1", en: "Example: Q_tn = 50, F_r = 1%" },
      text: {
        tr: "I_c = √[(3,47 - log 50)² + (log 1 + 1,22)²] = √[(3,47 - 1,699)² + (0 + 1,22)²] = √[3,1 + 1,49] ≈ 2,15. 2,05 ≤ 2,15 < 2,60 → bölge 5 (kum karışımı - siltli kum ile kumlu silt). Bölge 1 koşulu: 12·exp(-1,4) ≈ 2,96; Q_tn = 50 > 2,96, bu yüzden bölge 1 değil. Kod bu noktayı kum benzeri (I_c < 2,6) sayar.",
        en: "Ic about 2.15 gives zone 5 (sand mixtures), sand-like under the 2.6 threshold.",
      },
    },
    { type: "figure", id: "class-ic-chart", caption: { tr: "SBTn Q_tn - F_r diyagramı: I_c eş-eğrileri (1,31; 2,05; 2,60; 2,95; 3,60), bölge 1 sınırı ve bölge numaraları; örnek nokta Q_tn = 50, F_r = %1.", en: "SBTn Qtn-Fr chart with Ic contours, zone 1 boundary and sample point." } },
    { type: "h", text: { tr: "4. İnce dane yüzdesinin I_c'den tahmini", en: "4. Fines content estimated from I_c" } },
    {
      type: "formula",
      expr: "FC = 80 (I_c + C_FC) - 137,   0 <= FC <= 100 %;   C_FC varsayılan 0, kalibrasyon için ±0,29",
      caption: {
        tr: "Boulanger & Idriss (2014) ince dane ilişkisi (physical.fines_content_from_ic). Genel bir ilişkidir; yerel kalibrasyon önerilir.",
        en: "BI2014 fines relation; generic, site calibration recommended.",
      },
      where: [{ tr: "C_FC: yerel kalibrasyon düzeltmesi; kod ±0,29 aralığı dışını kabul etmez.", en: "C_FC site correction within ±0.29." }],
    },
    {
      type: "warn",
      text: {
        tr: "Q_tn ve I_c, q_t <= σv0 veya σ'v0 <= 0 olan noktalarda tanımsızdır: bu noktalar atlanır (NaN, bölge 0). Birim ağırlık CPT'den tahmin edilirken (Robertson & Cabal 2010) doğrudan laboratuvar birim ağırlığı yerine kullanılır; bu tahmin kaba bir yaklaşımdır. SBTn bölgeleri ve I_c tek bir CPT içindir; zemin cinsini kesin belirlemez, davranış sınıfı verir.",
        en: "Undefined points are skipped; CPT-based unit weight is an approximation; SBTn is a behaviour class, not a soil name.",
      },
    },
    { type: "figure", id: "class-fc-from-ic", caption: { tr: "FC - I_c ilişkisi: FC = 80(I_c) - 137 doğrusu, 0 ve 100 % kırpma sınırları ile.", en: "FC versus Ic line with clipping at 0 and 100 percent." } },
  ],
};
