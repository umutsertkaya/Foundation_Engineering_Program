import type { Topic } from "./types";

export const topic: Topic = {
  id: "bearing",
  title: { tr: "Sığ temel taşıma gücü", en: "Shallow foundation bearing capacity" },
  summary: {
    tr: "GeoTek'in q_ult hesabının Meyerhof, Hansen ve Vesic yöntemleriyle nasıl yapıldığı, faktörler, eksantrisite ve sınırlar.",
    en: "How GeoTek computes q_ult with the Meyerhof, Hansen and Vesic methods: factors, eccentricity and limits.",
  },
  level: "intermediate",
  codeRefs: [
    "geotek/engine/bearing.py",
    "geotek/engine/walls/base.py",
    "geotek/engine/walls/layered.py",
    "geotek/config/design_codes/asd.yaml",
    "geotek/core/models/walls.py",
  ],
  sources: [
    "Meyerhof, G.G. (1963). Some recent research on the bearing capacity of foundations. Canadian Geotechnical Journal, 1(1).",
    "Hansen, J.B. (1970). A revised and extended formula for bearing capacity. Danish Geotechnical Institute, Bulletin 28.",
    "Vesic, A.S. (1973). Analysis of ultimate loads of shallow foundations. JSMFD, ASCE, 99(SM1); Vesic, A.S. (1975). Bearing capacity of shallow foundations, Foundation Engineering Handbook.",
    "Bowles, J.E. Foundation Analysis and Design, 5th ed., Tablo 4-1 ve 4-5 (kodun atıf yaptığı tablolar).",
    "Das, B.M. Principles of Foundation Engineering (sığ temel taşıma gücü bölümü).",
  ],
  blocks: [
    { type: "h", text: { tr: "1. Amaç ve genel bağıntı", en: "1. Purpose and general equation" } },
    {
      type: "p",
      text: {
        tr: "Sığ temel taşıma gücü, temelin zemine aktarabileceği en büyük düşey basıncı verir. GeoTek bu değeri üç klasik genel denklemle hesaplar; yöntem seçimi ASD ayarlarında yapılır (varsayılan Vesic). Temel tabanındaki efektif birim ağırlık ve efektif üstyük (q) ilgili kullanıcı girdileridir; su tablası etkisini çağıran modül hesaba katar.",
        en: "Shallow foundation bearing capacity gives the largest vertical pressure the footing can transfer to the soil. GeoTek computes it with three classical general equations; the method is chosen in the ASD settings (default Vesic).",
      },
    },
    {
      type: "formula",
      expr: "q_ult = c N_c s_c d_c i_c + q N_q s_q d_q i_q + 1/2 γ B' N_γ s_γ d_γ i_γ",
      caption: { tr: "Genel taşıma gücü denklemi (kodda aynı yapı üç yöntemde de kullanılır)", en: "General bearing capacity equation (the code uses the same structure for all three methods)" },
      where: [
        { tr: "c: zemin kohezyonu (drenajlı) veya drenajsız durumda s_u (φ = 0 alınır)", en: "c: soil cohesion (drained), or s_u in the undrained case (φ = 0 is taken)" },
        { tr: "q: temel tabanı seviyesindeki efektif üstyük, γ: taban altındaki efektif birim ağırlık", en: "q: effective overburden at the footing base level, γ: effective unit weight below the base" },
        { tr: "B': efektif genişlik; N, s, d, i sırasıyla taşıma, şekil, derinlik ve eğim faktörleridir", en: "B': effective width; N, s, d and i are the bearing, shape, depth and inclination factors, respectively" },
      ],
    },
    { type: "h", text: { tr: "2. Varsayımlar ve kapsam", en: "2. Assumptions and scope" } },
    {
      type: "assumptions",
      title: { tr: "Kod ne varsayar", en: "What the code assumes" },
      items: [
        { tr: "Yük, yatay bileşeni H olacak şekilde B kenarına paralel etkir (istinat duvarı temelleri için geçerli durum).", en: "The load acts parallel to the B edge with horizontal component H (the case applicable to retaining wall footings)." },
        { tr: "Taban eğimi (base tilt) ve zemin eğimi faktörleri dahil edilmez; bu faktörler 1 alınır.", en: "Base tilt and ground slope factors are not included; these factors are taken as 1." },
        { tr: "Eksantrik yük için efektif boyut B' = B − 2 e_B ve (dikdörtgen temelde) L' = L − 2 e_L kullanılır (Meyerhof).", en: "For an eccentric load the effective dimensions B' = B − 2 e_B and (for a rectangular footing) L' = L − 2 e_L are used (Meyerhof)." },
        { tr: "Şekil faktörü B'/L', derinlik faktörü D/B ile hesaplanır; B' ve L' küçük/büyük olarak yeniden sıralanır.", en: "The shape factor is computed from B'/L' and the depth factor from D/B; B' and L' are reordered as smaller and larger." },
        { tr: "Şerit temelde yükler birim genişlik başına (kN/m) verilir ve şekil faktörleri 1'e indirgenir (B'/L' = 0).", en: "For strip footings, loads are given per unit length (kN/m) and the shape factors reduce to 1 (B'/L' = 0)." },
        { tr: "Hansen eğim üssü α1 = α2 = 5 varsayılan kullanıcı seçeneğidir; başka değer girilebilir.", en: "The Hansen inclination exponent α1 = α2 = 5 is the default user option; other values may be entered." },
      ],
    },
    { type: "h", text: { tr: "3. Taşıma faktörleri", en: "3. Bearing capacity factors" } },
    {
      type: "formula",
      expr: "N_q = e^(π tan φ) · tan²(45° + φ/2)     N_c = (N_q − 1) / tan φ",
      caption: { tr: "Ortak taşıma faktörleri (Prandtl türü); φ derece cinsinden, 0 ≤ φ < 50°", en: "Common bearing capacity factors (Prandtl type); φ in degrees, 0 ≤ φ < 50°" },
    },
    {
      type: "formula",
      expr: "Meyerhof: N_γ = (N_q − 1) tan(1.4 φ)\nHansen:   N_γ = 1.5 (N_q − 1) tan φ\nVesic:    N_γ = 2 (N_q + 1) tan φ",
      caption: { tr: "N_γ farkı: üç yöntem yalnızca N_γ'da ayrılır", en: "N_γ difference: the three methods differ only in N_γ" },
    },
    {
      type: "p",
      text: {
        tr: "φ = 0 için kod N_c = 5.14, N_q = 1, N_γ = 0 değerlerini kullanır. Bu, drenajsız durumda q_ult'un kohezyon terimine indirgenmesidir; Hansen ve Vesic için ayrıca φ = 0 kolu vardır (aşağıdaki uyarıya bakın).",
        en: "For φ = 0 the code uses N_c = 5.14, N_q = 1, N_γ = 0.",
      },
    },
    { type: "h", text: { tr: "4. Şekil, derinlik ve eğim faktörleri", en: "4. Shape, depth and inclination factors" } },
    {
      type: "formula",
      expr: "Vesic: s_q = 1 + (B'/L') tan φ,   s_γ = max(0.6, 1 − 0.4 B'/L'),   s_c = 1 + (N_q/N_c)(B'/L')\nHansen: s_q = 1 + (B'/L') sin φ (diğerleri Vesic ile aynı)",
      caption: { tr: "Şekil faktörleri; şerit temelde hepsi 1", en: "Shape factors; all equal 1 for a strip footing" },
    },
    {
      type: "formula",
      expr: "k = D/B  (D/B ≤ 1 ise);  k = atan(D/B)  (D/B > 1 ise, radyan)\nVesic: d_q = 1 + 2 tan φ (1 − sin φ)² k,  d_γ = 1,  d_c = d_q − (1 − d_q)/(N_c tan φ)\nHansen: d_c = 1 + 0.4 k",
      caption: { tr: "Derinlik faktörleri (kodda k tanımı açıkça bu şekildedir)", en: "Depth factors (the code defines k explicitly in this way)" },
    },
    {
      type: "formula",
      expr: "Vesic: m = (2 + B'/L') / (1 + B'/L'),  i_q = (1 − H/(V + A' c cot φ))^m,  i_γ = (1 − H/(V + A' c cot φ))^(m+1)\nHansen: i_q = (1 − 0.5 H/(V + A' c cot φ))^α1,  i_γ = (1 − 0.7 H/(V + A' c cot φ))^α2",
      caption: { tr: "Eğik yük faktörleri; H > 0 ise V > 0 zorunludur", en: "Inclined load factors; V > 0 is required when H > 0" },
    },
    {
      type: "formula",
      expr: "Meyerhof: s_c = 1 + 0.2 K_p B'/L', d_c = 1 + 0.2 √K_p D/B, K_p = tan²(45° + φ/2)\nMeyerhof (φ > 10): s_q = s_γ = 1 + 0.1 K_p B'/L', d_q = d_γ = 1 + 0.1 √K_p D/B\nMeyerhof eğim: i_c = i_q = (1 − θ/90°)², i_γ = (1 − θ/φ)², θ = atan(H/V)",
      caption: { tr: "Meyerhof faktörleri (kod φ ≤ 10° için s_q, d_q, s_γ, d_γ = 1 alır)", en: "Meyerhof factors (for φ ≤ 10° the code takes s_q, d_q, s_γ, d_γ = 1)" },
    },
    { type: "h", text: { tr: "5. Eksantrisite ve kontrol", en: "5. Eccentricity and check" } },
    {
      type: "p",
      text: {
        tr: "Eksantrisite e_B, taşıma kapasitesinde efektif genişliği azaltır. Duvar kontrolünde kod, Q_ult'u düşey bileşen toplamına bölerek emniyet sayısı üretir: FS_b = Q_ult / ΣV. Basınç dağılımı için kodda B/6 sınırının içinde q_max = ΣV/B (1 + 6e/B), q_min = ΣV/B (1 − 6e/B) kullanılır; |e| > B/6 ise q_min = 0 ve q_max üçgen dağılımdan hesaplanır.",
        en: "Eccentricity reduces the effective width. The wall check gives FS_b = Q_ult / ΣV.",
      },
    },
    {
      type: "steps",
      title: { tr: "Hesap adımları", en: "Calculation steps" },
      items: [
        { tr: "Temel boyutlarını (B, L), D, φ, c veya s_u, γ, q girin; yöntemi seçin.", en: "Enter the footing dimensions (B, L), D, φ, c or s_u, γ and q; select the method." },
        { tr: "Yüklerden V, H ve eksantrisite e_B (ve varsa e_L) hesaplanır; B' = B − 2|e_B| bulunur.", en: "Compute V, H and the eccentricity e_B (and e_L if applicable) from the loads; B' = B − 2|e_B| is found." },
        { tr: "N_c, N_q, N_γ, şekil, derinlik ve eğim faktörleri seçilen yönteme göre hesaplanır.", en: "N_c, N_q, N_γ and the shape, depth and inclination factors are computed according to the selected method." },
        { tr: "q_ult genel denklemle bulunur; Q_ult = q_ult × A' (kN/m şeritte A' = B').", en: "q_ult is found from the general equation; Q_ult = q_ult × A' (for a strip in kN/m, A' = B')." },
        { tr: "FS_b = Q_ult / ΣV hesaplanır ve ASD gereksinimi ile karşılaştırılır.", en: "FS_b = Q_ult / ΣV is computed and compared with the ASD requirement." },
      ],
    },
    {
      type: "example",
      title: { tr: "Küçük sayısal örnek (Vesic, şerit temel)", en: "Small worked example (Vesic, strip footing)" },
      text: {
        tr: "Veri: φ = 30°, c = 0, B = 2 m, D = 1 m, γ = 18 kN/m³, q = 18 × 1 = 18 kPa, yük yok, şerit. N_q = e^(π·0.5774)·3 ≈ 18.40; N_c ≈ 30.14; N_γ = 2(18.40+1)(0.5774) ≈ 22.40. k = D/B = 0.5; d_q = 1 + 2(0.5774)(0.5)²(0.5) ≈ 1.144. q_ult = 18·18.40·1.144 + 0.5·18·2·22.40 ≈ 379 + 403 ≈ 782 kPa; Q_ult = 782 × 2 ≈ 1564 kN/m. Bu değerler elle doğrulanmıştır; kodun birebir çıktısı için aynı girdiyle test koşulmalıdır.",
        en: "Vesic, φ = 30°, B = 2 m, D = 1 m, γ = 18 kN/m³: q_ult ≈ 782 kPa.",
      },
    },
    {
    type: "figure",
    id: "bear-failure-wedge",
    caption: {
      tr: "Genel kayma göçmesi: aktif kama, radyal bölge ve pasif kama; sağda yoğun ve gevşek zeminin yük-oturma eğrileri.",
      en: "General shear failure: active wedge, radial zone and passive wedge; on the right the load-settlement curves of dense and loose soil.",
    },
  },
    {
    type: "figure",
    id: "bear-factor-trend",
    caption: {
      tr: "N_c, N_q ve Vesic N_γ'nın φ′ ile değişimi (logaritmik eksen).",
      en: "N_c, N_q and Vesic N_γ versus φ′ (logarithmic axis).",
    },
  },
    {
      type: "warn",
      text: {
        tr: "Sınırlar ve uyarılar: (1) Meyerhof için D/B > 1 derinlik faktörleri ekstrapole edilir ve uyarı üretilir. (2) φ = 0 için Hansen'de H > A'·s_u ise, Vesic'te m·H ≥ 5,14·A'·s_u ise (m = (2 + B'/L')/(1 + B'/L')) kod hata verir; Vesic koşulu Hansen'inkinden farklıdır. (3) Hansen eğim üssü α1, α2 kullanıcı seçeneğidir; varsayılanı literatürle doğrulanmamıştır. (4) Taban eğimi ve zemin eğimi faktörleri yoktur. (5) Yük kombinasyonları ve su tablası düzeltmesi çağıran modüle aittir. (6) ASD güvenlik sayısı bearing_capacity static = 3.0 ve seismic = 2.0 değerleri asd.yaml dosyasında 'secondary' ve 'unverified' olarak işaretlidir; mühendis onayı gerektirir.",
        en: "Limits: no base tilt or ground slope factors; ASD FS values are secondary/unverified.",
      },
    },
    { type: "h", text: { tr: "6. Duvarda kullanımı", en: "6. Use in retaining walls" } },
    {
      type: "p",
      text: {
        tr: "İstinat duvarı kontrolünde taşıma kontrolü, temel zemini için bu yöntemle FS_b = Q_ult / ΣV hesaplanır ve eşik değer ASD tablosundan alınır. Sığ temelde D, duvarın gömme derinliğidir; yüzey temelde D = 0 yaklaşımı yalnızca kullanıcı tarafından bilinçli olarak seçilmelidir.",
        en: "For walls, FS_b = Q_ult / ΣV is compared with the ASD bearing requirement.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu modülün çıktısı mühendislik hesabının yerine geçmez. Katsayılar literatürden ve kodun kendi tablolarından doğrulanmadan kullanılmamalıdır.",
        en: "Engineering judgement is required; this output does not replace verification.",
      },
    },
  ],
};
