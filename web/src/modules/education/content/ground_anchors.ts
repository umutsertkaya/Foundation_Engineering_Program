import type { Topic } from "./types";

export const topic: Topic = {
  id: "ground-anchors",
  title: {
    tr: "Zemin ankrajı tasarımı: serbest boy, kök boyu ve tendon",
    en: "Ground anchor design: free length, bond length and tendon",
  },
  summary: {
    tr: "Programın FHWA GEC-4 ile ankraj yükünü, kama geometrisine göre serbest boyu, kök boyunu, tendon sınırlarını ve deneme yükünü nasıl hesapladığını anlatır.",
    en: "How the program designs one ground anchor per FHWA GEC-4: anchor load, wedge-based free length, bond length, tendon limits and test load.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/anchors.py",
    "geotek/engine/anchor_tables.py",
    "geotek/core/models/anchors.py",
    "docs/qa/ankraj-muhendislik-kontrolu.md",
  ],
  sources: [
    "Sabatini, P.J., Pass, D.G., Bachus, R.C. (1999). Ground Anchors and Anchored Systems. FHWA Geotechnical Engineering Circular No. 4, FHWA-IF-99-015 (GEC-4). Bolumler: 5.3.2-5.3.8, Ek E 3B, Tablo 6, 8, 9, 10.",
    "EN 1537 (ankraj, kismi guvenlik katsayilari): kodda uygulanmaz; sayisal karsilastirma dogrulanamadi.",
    "Kod ici atif: anchors.py modul docstring'i ve anchor_tables.py (her tablo satiri GEC-4 tablo ve sayfa numarasiyla etiketli).",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Kapsam ve kaynak", en: "Scope and source" },
    },
    {
      type: "p",
      text: {
        tr: "Bu konu tek bir zemin ankrajının tasarımını anlatır. Yöntem FHWA GEC-4'e dayanır: ankraj yükü, kama yüzeyine göre serbest boy, kök boyu, tendon seçimi ve deneme/kilitleme yükleri. Program bu değerleri hesaplar ama güvenlik katsayısı, transfer yükü ve kilitleme oranı kendiliğinden varsayılmaz; bunlar girilmezse hesap durur ve eksik alanlar listelenir.",
        en: "This topic covers the design of one ground anchor per FHWA GEC-4: anchor load, free length from the wedge, bond length, tendon selection and the test and lock-off loads. The safety factor, transfer load and lock-off ratio are never assumed; if missing, the design stops and lists them.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Varsayımlar", en: "Assumptions" },
      items: [
        {
          tr: "Arazi düz, duvar düşeydir; kama yüzeyi kazı köşesinden 45° + φ′/2 açısıyla yatay zemine çıkar.",
          en: "Level ground and vertical wall; the failure surface rises from the excavation corner at 45 + phi'/2.",
        },
        {
          tr: "Kama geometrisi tek bir φ′ ile basit 45° + φ′/2 çizgisidir; katmanlı zemin, kil veya sürşarj için yaklaşıktır (bu uyarı anchored-wall analizinde verilir).",
          en: "The wedge is a simple line with one phi'; it is approximate for layered soil, clay or surcharge (the warning is shown in the anchored-wall analysis).",
        },
        {
          tr: "Kama ötesi kalınlık χ kullanıcı girdisidir; girilmezse max(1,5 m; 0,2 H) alınır ve varsayım olarak gösterilir.",
          en: "Beyond-wedge clearance chi is an input; if omitted, max(1.5 m, 0.2 H) is used and shown as an assumption.",
        },
        {
          tr: "Kama geometrisi zemin ve kaya için aynı formülü kullanır; örtü (overburden) kontrolü yalnızca zeminde yapılır, kayada bu kontrol atlanır ve not olarak gösterilir.",
          en: "The same wedge formula is used for soil and rock; the overburden check runs only for soil and is noted as skipped for rock.",
        },
      ],
    },
    {
      type: "h",
      text: { tr: "Ankraj yükü", en: "Anchor load" },
    },
    {
      type: "formula",
      expr: "T = T_h · s / cos α ,   T_h = q_h · s   (GEC-4 denk. 19-20)",
      caption: {
        tr: "Eksenel tasarım yükü. q_h: duvar başına yatay yük [kN/m] (ya da girilen eksenel yük, o durumda T_h = T cos α). s: yatay aralık [m], α: ankraj eğimi.",
        en: "Design axial load. q_h: horizontal load per metre; s: spacing; alpha: inclination.",
      },
    },
    {
      type: "formula",
      expr: "T_v = T · sin α   (GEC-4 denk. 21)",
      caption: {
        tr: "Düşey bileşen. Duvar eksenel yüküne eklenir; kod toplam ΣT_v'yi (kN/m ve eleman başına) uyarı olarak raporlar.",
        en: "Vertical component; the code reports the total as a warning (not a wall check).",
      },
    },
    {
      type: "h",
      text: { tr: "Kama, serbest boy ve kök boyu", en: "Wedge, free length and bond length" },
    },
    {
      type: "formula",
      expr: "k = tan(45° − φ′/2);   x = (H + e − z_h) · k / (1 + k · tan α);   L_kama = x / cos α",
      caption: {
        tr: "Kama yüzeyinin ankraj ekseni üzerindeki mesafesi. H: kazı yüksekliği, e: kama başlangıcının taban altı derinliği, z_h: ankraj başının derinliği.",
        en: "Distance along the anchor line to the failure surface. H: excavation height; e: wedge origin below the base; z_h: head depth.",
      },
      where: [
        { tr: "φ′: efektif içsel sürtünme açısı [°].", en: "phi': effective friction angle [deg]." },
        { tr: "α: ankraj eğimi (10°–45° aralığı önerilir; dışında uyarı).", en: "alpha: anchor inclination (10-45 deg recommended; outside gives a warning)." },
      ],
    },
    {
      type: "formula",
      expr: "χ_eksen = χ / sin(45° + φ′/2 + α)   ;   L_serbest = max( L_kama + χ_eksen ; L_min )",
      caption: {
        tr: "χ, kayma yüzeyine dik ölçülür (GEC-4 şekil 37a); ankraz ekseni boyunca bileşen sin(45° + φ′/2 + α) ile bölünerek bulunur. L_min: tendon türüne göre en az serbest boy.",
        en: "chi is normal to the failure surface, so along the anchor it is divided by sin(45 + phi'/2 + alpha). L_min is the minimum free length.",
      },
    },
    {
      type: "formula",
      expr: "L_kök = max( T · FS / q_u ; L_kök,min ) ,   q_u = π · d_h · τ_ult  (veya doğrudan q_u)",
      caption: {
        tr: "Kök boyu. FS: taşıma kuvveti üzerindeki güvenlik katsayısı; q_u: kök birim taşıma kuvveti [kN/m] (Tablo 6 veya 8 gibi tablolardan girilir); d_h: delik çapı.",
        en: "Bond length. FS is applied to the ultimate transfer load q_u [kN/m]; d_h: hole diameter.",
      },
    },
    {
      type: "steps",
      title: { tr: "Serbest boy ve kök boyu adımları", en: "Free length and bond length steps" },
      items: [
        {
          tr: "Ankraj yükünü T_h · s / cos α olarak bul; tendon sınırlarını bu yükle karşılaştır.",
          en: "Compute the anchor load T from T_h and spacing and inclination.",
        },
        {
          tr: "Kama mesafesini x ve L_kama değerini hesapla; χ'yi ankraj ekseni boyunca bileşene çevir.",
          en: "Compute the wedge length along the anchor and add chi along the axis.",
        },
        {
          tr: "Serbest boyu, tendon türüne göre en az 4,5 m (halat) veya 3 m (çubuk) ile sınırla.",
          en: "Take the larger of the wedge plus clearance and the minimum free length (4.5 m strand, 3 m bar).",
        },
        {
          tr: "Kök boyunu FS ve q_u ile hesapla; GEC-4 Ek E 3B'deki minimum kök boyunu (zeminde 4,5 m, kayada halat 4,5 m, çubuk 3 m) uygula.",
          en: "Bond length from T FS / q_u, not less than the GEC-4 minimum (soil 4.5 m; rock 4.5 m strand / 3 m bar).",
        },
      ],
    },
    {
      type: "example",
      title: { tr: "El hesabı: kama ötesi χ", en: "Hand check: clearance chi" },
      text: {
        tr: "φ′ = 0, α = 15°, χ = 2 m girdi. Ankraj ekseni boyunca bileşen: χ / sin(45° + 0 + 15°) = 2 / sin 60° = 2,309 m. Kod da aynı değeri verir (md raporu, φ = 0 regresyonu). Kama ötesi χ eksene dik değil de eksen boyunca eklenirse ~%13 eksik kalır (md bulgu 5).",
        en: "phi' = 0, alpha = 15 deg, chi = 2 m: along the axis 2 / sin 60 deg = 2.309 m, matching the QA regression.",
      },
    },
    {
      type: "h",
      text: { tr: "Tendon seçimi ve yük sınırları", en: "Tendon selection and load limits" },
    },
    {
      type: "formula",
      expr: "T_tasarım ≤ 0,60 · SMTS ;   T_kilit ≤ 0,70 · SMTS ;   T_deneme = 1,33 · T ≤ 0,80 · SMTS",
      caption: {
        tr: "GEC-4 bölüm 5.3.8 tendon sınırları. SMTS: tendonun belirlenmiş minimum çekme dayanımı [kN]. Deneme yükü varsayılan 1,33 çarpanıdır.",
        en: "GEC-4 section 5.3.8 tendon limits. SMTS: specified minimum tensile strength. Test factor default 1.33.",
      },
    },
    {
      type: "steps",
      title: { tr: "Tendon kuralları", en: "Tendon rules" },
      items: [
        {
          tr: "Halatta (strand) her üç sınır için gerekli adet ayrı ayrı bulunur; en büyüğü alınır. Kullanıcı adet verirse en az bu kadar olmalıdır.",
          en: "For strand, the count needed by each limit is computed; the largest governs. A user count must not be lower.",
        },
        {
          tr: "Çubukta (bar) kütüphanedeki en küçük çubuk, üç sınırı da sağlıyorsa seçilir; hiçbiri sağlamazsa hata verilir.",
          en: "For bar, the smallest library bar that meets all three limits is picked; otherwise an error is raised.",
        },
        {
          tr: "Tablo 10: 15 mm halat, SMTS 260,7 kN, 140 mm². Tablo 9: çubuklar (26–64 mm, sınıf 150/160). Her satır sayfa numarasıyla kaynaklıdır.",
          en: "Table 10 gives the 15 mm strand (260.7 kN, 140 mm2); Table 9 gives bars with their grades.",
        },
      ],
    },
    {
      type: "figure",
      id: "anchor-bond-free-length",
      caption: {
        tr: "Ankraj boyunca serbest boy ve kök boyu: kazı köşesinden çıkan kama yüzeyi (45° + φ′/2), kayma yüzeyine dik χ mesafesi, serbest boy ve kök bölgesi ile kök merkezi derinliği (göster: kesit, kama çizgisi, L_serbest ve L_kök etiketleri).",
        en: "Free length and bond length along the anchor: wedge surface, normal chi distance, free and bond zones with the bond centre depth.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu konu dış (genel) stabiliteyi, Kranz kontrolünü, ankraj-zemin kayma deneyini ve duvar yapısal tasarımını kapsamaz. Dış stabilite ayrı bir kontroldür; ankrajlı iksa tarafındaki uyarı için bkz. anchored-wall. Kök boyu, tablo değerleri ve FS önerileri ön tasarım içindir; kabul sınırı olarak kullanılmadan önce ayrıca doğrulanmalıdır.",
        en: "External stability, Kranz checks and proof testing are not covered. Presumptive table values and FS guidance are for preliminary design only.",
      },
    },
    {
      type: "figure",
      id: "anchor-tie-force",
      caption: {
        tr: "Ankraj kuvveti T: duvarın tek ankrajına gelen yatay bileşen ve eğimli eksenel yük (göster: ankraj başı, T ok yönü, α ve T_v bileşeni).",
        en: "Anchor force T with its horizontal and vertical components at the head.",
      },
    },
    {
      type: "steps",
      title: { tr: "Kullanıcı kontrol listesi", en: "User checklist" },
      items: [
        {
          tr: "FS, q_u (veya τ_ult ve d_h), kilitleme oranı ve transfer yükünün kaynağı belgelendi mi?",
          en: "Are FS, q_u (or tau_ult and d_h), lock-off ratio and the transfer load source documented?",
        },
        {
          tr: "Kök boyu, serbest boy ve tendon sayısı GEC-4 minimum ve sınırlarıyla uyumlu mu? Uyarılar kapatılmadan kabul edilmedi mi?",
          en: "Are bond length, free length and tendon count compliant with GEC-4 minimums, and are all warnings resolved?",
        },
        {
          tr: "Eğim 10°–45° aralığında mı; kama ile katmanlı zemin farkı değerlendirildi mi?",
          en: "Is the inclination within 10-45 deg, and was the layered-soil wedge limitation considered?",
        },
      ],
    },
    {
      type: "p",
      text: {
        tr: "Sonuç: serbest boy, kök boyu ve tendon ile birlikte kapasite ve deneme yükü listelenir. Ankrajlı iksanın iç kuvvetleri ve ankraj seviyelerinin yükü için bkz. anchored-wall konusu.",
        en: "The result lists free length, bond length, tendon and the capacity with test and lock-off loads. For wall-level anchor loads see the anchored-wall topic.",
      },
    },
  ],
};
