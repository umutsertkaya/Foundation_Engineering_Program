import type { Topic } from "./types";

export const topic: Topic = {
  id: "anchors",
  title: {
    tr: "Ankrajlı palplanş: serbest zemin desteği ve ankraj kuvveti",
    en: "Anchored sheet pile: free earth support and anchor force",
  },
  summary: {
    tr: "Programın tek seviyeli ankrajlı palplanş modeli: ankraj derinliği, moment dengesi, ankraj kuvveti ve birim ankraj yükü. Ankraj kapasitesi kontrolü bu modelde yoktur.",
    en: "The single-level anchored sheet pile model: anchor depth, moment balance, anchor force and load per anchor. Anchor capacity checks are not part of this model.",
  },
  level: "intermediate",
  codeRefs: [
    "geotek/engine/sheet_pile.py",
    "geotek/engine/limit_state.py",
    "geotek/services/structures.py",
    "geotek/services/walls_basic.py",
  ],
  sources: [
    "Serbest zemin destegi (free earth support) yontemi: USACE (1994), EM 1110-2-2504, Design of Sheet Pile Walls; sheet_pile.py docstring'i yontemi anar.",
    "Rankine, W.J.M. (1857). On the stability of loose earth. Phil. Trans. Royal Society.",
    "Ankraj kapasitesi icin bkz. ground-anchors konusu: Sabatini, P.J., Pass, D.G., Bachus, R.C. (1999). Ground Anchors and Anchored Systems. FHWA GEC-4, FHWA-IF-99-015.",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Kapsam: kodda ne var, ne yok", en: "Scope: what the code does and does not do" },
    },
    {
      type: "p",
      text: {
        tr: "Programdaki 'ankraj' hesabı, tek seviyeli bir ankrajı olan palplanşta serbest zemin desteği (free earth support) varsayımıyla gömülme, ankraj kuvveti ve maksimum momenti hesaplar. Ankraj bağlı noktasında yatay bir tekil kuvvettir. Ankrajın çekme kapasitesi, serbest boy, kök bölgesi (bond zone) veya kayma yüzeyi kontrolü bu modülde yoktur; ankraj tasarımı için bkz. ground-anchors, ankrajlı iksa için bkz. anchored-wall.",
        en: "The anchor calculation in the program covers a single-level anchored sheet pile with free earth support: embedment, anchor force and maximum moment. The anchor is a point horizontal force. Anchor pull-out capacity, free length, bond zone and global checks are not in this module.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Varsayımlar", en: "Assumptions" },
      items: [
        {
          tr: "Serbest zemin desteği: palplanş ucu serbest dönebilir (ankraj ve ucun arasında ankastre bağ yok).",
          en: "Free earth support: the pile toe is free to rotate; no fixity.",
        },
        {
          tr: "Ankraj derinliği z_a 0 ≤ z_a < H aralığında olmalıdır (üst kot ile kazı tabanı arasında).",
          en: "Anchor depth must satisfy 0 <= z_a < H.",
        },
        {
          tr: "Basınçlar sheet_pile.py'deki net basınç diyagramıyla aynıdır (Rankine, hidrostatik su, sızma yok).",
          en: "Pressures are the same net diagram as in the cantilever model.",
        },
        {
          tr: "Varsayılan gömülme artışı 0'dır: anchored_sheet_pile için depth_increase = 0,0 (konsoldaki %20 uygulanmaz).",
          en: "Default embedment increase is 0 for anchored walls (the 20 % cantilever rule is not used).",
        },
        {
          tr: "Ankraj kuvveti yatay ve düzlem kesit başına (kN/m) kabul edilir; birim ankraj yükü aralık ve eğim ile dönüştürülür.",
          en: "Anchor force is horizontal per metre of wall; per-anchor load is converted using spacing and inclination.",
        },
      ],
    },
    {
      type: "formula",
      expr: "∫₀^(H+D0) p_net(z)·(z − z_a) dz = 0",
      caption: {
        tr: "Ankraj noktasına göre moment dengesi (sheet_pile.py anchored_sheet_pile: moment_about_anchor = Fz − z_a·F). Kök derinliği, kazı tabanının altında aranır.",
        en: "Moment balance about the anchor point; the root is searched below the dredge line.",
      },
      where: [
        { tr: "z_a: ankraj derinliği (üst yüzeyden ölçülür).", en: "z_a: anchor depth measured from the top." },
        { tr: "D0 = (H + D0) − H: teorik gömülme.", en: "D0: theoretical embedment below the dredge line." },
      ],
    },
    {
      type: "formula",
      expr: "T = ∫₀^(H+D0) p_net(z) dz   (T > 0 olmalıdır)",
      caption: {
        tr: "Yatay denge ile ankraj kuvveti. Kod T ≤ 0 çıkarsa hata verir: 'Computed anchor force is not tensile'.",
        en: "Horizontal balance gives the anchor force T. The code raises an error when T <= 0.",
      },
    },
    {
      type: "formula",
      expr: "P_ankraj = T · s / cos θ",
      caption: {
        tr: "Tek ankraja düşen yük [kN]. s: ankraj aralığı [m]; θ: ankraj eğimi [derece]. Kod uyarı metni olarak bu değeri üretir.",
        en: "Load per anchor [kN]. s: spacing [m]; theta: inclination [deg]. The code reports this as a warning text.",
      },
    },
    {
      type: "steps",
      title: { tr: "Hesap adımları", en: "Calculation steps" },
      items: [
        {
          tr: "Net basınç diyagramını kazı tabanını da kapsayacak şekilde üret.",
          en: "Build the net diagram including the dredge line breakpoints.",
        },
        {
          tr: "Ankraj noktasına göre moment fonksiyonunu H'den sonra ilk işaret değişiminde brentq ile çöz; D0 = kök − H.",
          en: "Solve the anchor moment function below H; D0 = root minus H.",
        },
        {
          tr: "T = F(kök) değerini al; T ≤ 0 ise hata ver.",
          en: "Compute T at the root and error if not tensile.",
        },
        {
          tr: "Tasarım gömülmesi D = D0 (varsayılan artış 0). Profil alt sınırını aşarsa uyarı ekle.",
          en: "Design embedment D = D0 by default.",
        },
        {
          tr: "Kesme V(z) = F(z) − T·[z ≥ z_a] ve moment M(z) ile M_max'ı bul; M_max ve S = M_max/σ_izin hesapla.",
          en: "Shear is F(z) minus T for z >= z_a; moment and M_max follow.",
        },
      ],
    },
    {
      type: "example",
      title: { tr: "Elle doğrulanmış örnek", en: "Hand-checked example" },
      text: {
        tr: "Zemin ve basınç: palplanş örneğindeki gibi (γ = 18 kN/m³, φ = 30°, Ka = 1/3, Kp = 3, su yok). H = 3 m, z_a = 1,0 m. Net: z ≤ 3 için 6z; z > 3 için 18 − 48u (u = z − 3). Moment dengesi: 27 + 36D − 39D² − 16D³ = 0, kök D0 ≈ 1,08 m. T = 27 + 18D − 24D² ≈ 18,4 kN/m. Kesme sıfırı z ≈ 2,48 m'de; M_max ≈ 11,9 kNm/m (|M|, z ≈ 2,48 m). Kontrol: M(toe) ≈ 0.",
        en: "H = 3 m, z_a = 1.0 m, same sand. D0 = 1.08 m, T = 18.4 kN/m, M_max = 11.9 kNm/m at z = 2.48 m.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu örnek elle türetilmiştir ve kodun integrasyonuyla birkaç yüzde farklı olabilir. Yalnızca mekanizmayı göstermek içindir; ankraj kapasitesi kontrolü değildir.",
        en: "Hand calculation; the code may differ by a few percent. Shows the mechanism only, not anchor capacity.",
      },
    },
    {
      type: "figure",
      id: "anchor-tie-force",
      caption: {
        tr: "Tek seviyeli ankraj: ankraj noktası z_a, ankraj kuvveti T'nin yatay oku, net basınç diyagramı ve kazı tabanı altındaki D0 (göster: kesit, z = 0 üst yüzey, z_a ve H işaretli).",
        en: "Single-level anchor: anchor point z_a, anchor force T arrow, net diagram and D0 below the dredge line.",
      },
    },
    {
      type: "figure",
      id: "sp-anchored-moment",
      caption: {
        tr: "Ankrajlı palplanşta kesme ve moment diyagramları: ankraj noktasında kesme sıçraması (−T), sıfır kesme ve M_max konumu (göster: üç panel, işaretli kritik noktalar).",
        en: "Shear and moment diagrams for the anchored wall: jump of -T at the anchor, zero shear and M_max location.",
      },
    },
    {
      type: "p",
      text: {
        tr: "Ankraj kuvveti zarfı: limit_state.py ve structures.py tüm yük kombinasyonları üzerinden en büyük T'yi (anchor_force_design) raporlar. Her kombinasyon ayrı D0 ve T üretir; tasarım T'si bunların en büyüğüdür.",
        en: "Envelope: across all load combinations the program reports the largest T as anchor_force_design; each combination has its own D0 and T.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu modelde ankraj kapasitesi (kök boyu, serbest boy, tendon) kontrol edilmez. Bu kontroller ground-anchors konusundaki FHWA GEC-4 ankraj tasarımında yapılır. Ankrajlı iksa için bkz. anchored-wall konusu.",
        en: "This model does not check anchor capacity (bond length, free length, tendon). Those checks are in the ground-anchors topic (FHWA GEC-4). See anchored-wall for the retaining wall.",
      },
    },
    {
      type: "steps",
      title: { tr: "Kullanıcı kontrol listesi", en: "User checklist" },
      items: [
        {
          tr: "Ankraj derinliği ve aralığı (s), eğimi (θ) ve kuvvet birimi belgelendi mi?",
          en: "Are anchor depth, spacing and inclination documented with units?",
        },
        {
          tr: "T'nin işareti pozitif ve sonuç 'çekme' olarak yorumlandı mı?",
          en: "Is T positive and interpreted as tension?",
        },
        {
          tr: "Gömülme profil alt sınırını aşmıyor mu?",
          en: "Does the embedment stay within the profile?",
        },
      ],
    },
  ],
};
