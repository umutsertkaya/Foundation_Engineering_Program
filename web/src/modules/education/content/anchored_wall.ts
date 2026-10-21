import type { Topic } from "./types";

export const topic: Topic = {
  id: "anchored-wall",
  title: {
    tr: "Ankrajlı iksa: görünür basınç zarfı, ankraj yükleri ve taban kabarması",
    en: "Anchored excavation wall: apparent pressure envelope, anchor loads and basal heave",
  },
  summary: {
    tr: "Programın FHWA GEC-4 bölüm 5 ile ankrajlı iksa iç kuvvetlerini nasıl bulduğunu anlatır: kum, sert kil ve yumuşak kil zarfları, menteşe ve katkı alanı yöntemleri, tek seviyede serbest zemin desteği ve kil kazıda taban kabarması.",
    en: "How the program computes anchored wall loads per FHWA GEC-4 chapter 5: sand, stiff and soft clay envelopes, hinge and tributary methods, single-level free earth support and basal heave in clay.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/anchored_wall.py",
    "geotek/engine/anchors.py",
    "geotek/engine/sheet_pile.py",
    "geotek/modules/anchored_wall",
    "docs/qa/ankraj-muhendislik-kontrolu.md",
  ],
  sources: [
    "FHWA GEC-4 (Sabatini, Pass, Bachus 1999, FHWA-IF-99-015): 5.2.4-5.2.6 (sekil 23, 24, 27, 28, 29), 5.3.3 (sekil 33-34), 5.5.3, 5.8.2.2 (denk. 34-37, sekil 51), 5.8.3.",
    "Terzaghi, K., Peck, R.B., Mesri, G. (1996). Soil Mechanics in Engineering Practice, 3. baski. Ozgun metne erisilemedi; kodda GEC-4 uzerinden atif yapilir.",
    "Skempton, A.W. (1951). The bearing capacity of clays. Nc icin; Janbu ve arkadaslari (1956) Nc grafigi kodda sayisallastirilmis olarak kullanilir.",
    "USS Steel Sheet Piling Design Manual; USACE EM 1110-2-2504 (serbest zemin destegi). Peck (1969) ozgun metni dogrulanamadi.",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Kapsam ve sınırlar", en: "Scope and limits" },
    },
    {
      type: "p",
      text: {
        tr: "Bu konu düz arazide, düşey duvarlı, bir veya birden çok ankraj seviyeli iksanın metre başına iç kuvvetlerini anlatır. Yöntem GEC-4 bölüm 5'in görünür (apparent) basınç zarfıdır; tek seviye için ayrıca serbest zemin desteği (free earth support) hesaplanır ve büyük olan ankraj yükü ile momenti yönetir. Dış stabilite (Kranz, şev) hesaplanmaz; bu konu sadece iç denge ve taban kabarması içindir.",
        en: "This topic covers the internal forces per metre of an anchored wall on level ground with a vertical face, for one or several anchor levels. The GEC-4 apparent pressure envelope is used; for a single level the free earth support is also computed and the larger anchor load and moment govern. External stability (Kranz, slope) is not computed.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Varsayımlar ve durma koşulları", en: "Assumptions and stop conditions" },
      items: [
        {
          tr: "Kazı yüksekliği H içinde tek tip zemin olmalıdır: kum ve kil katmanları birlikte olamaz; karışık profil durdurulur.",
          en: "Within H the soil must be uniform: sand and clay layers cannot be mixed; the analysis stops otherwise.",
        },
        {
          tr: "Kazı tabanının üstünde yeraltı suyu olamaz (zarf kapsamı dışı); kile yüzey sürşarjı zarfı yapılmaz, kum için sürşarj Ka·q eklenir.",
          en: "Groundwater above the base is outside the envelope; a surcharge on clay stops the analysis, on sand it adds Ka q.",
        },
        {
          tr: "Eğimli arazi ve birden çok ankraj seviyesi birlikte desteklenmez.",
          en: "Sloping ground with several anchor levels is not supported.",
        },
        {
          tr: "Tek seviyede hem serbest zemin desteği hem zarf hesaplanır; zarf yapılamazsa uyarı verilir.",
          en: "For one level both free earth support and the envelope are computed; if the envelope cannot apply, a warning is shown.",
        },
        {
          tr: "Kesit tasarımı yapılmaz: M ve V talepleri ile M/W verilen gerilmeye göre kontrol edilir; EI kullanılmaz.",
          en: "No section design: only V and M demands and M/W against the allowable stress; EI is not used.",
        },
      ],
    },
    {
      type: "h",
      text: { tr: "Kum: trapez zarf", en: "Sand: trapezoidal envelope" },
    },
    {
      type: "formula",
      expr: "p = 0,65 · Ka · γ · H² / (H − H1/3 − Hn+1/3)   ;   ek sürşarj: Ka · q",
      caption: {
        tr: "Kum zarfı (GEC-4 5.2.4, sekil 24). Toplam yük 0,65 Ka γ H² (kN/m). Zarf, sıfırdan 2/3 H1 derinliğine kadar doğrusal artar, tam değerde kalır, 2/3 Hn+1 yüksekliğinden tabanda sıfıra iner.",
        en: "Sand envelope (GEC-4 5.2.4, fig. 24). Total load 0.65 Ka gamma H^2; ramps from the top anchor and to the base.",
      },
      where: [
        { tr: "H1: üst ankraj derinliği; Hn+1: en alt ankrajın tabana yüksekliği.", en: "H1: depth of the top anchor; Hn+1: height of the lowest anchor above the base." },
        { tr: "Ka: Rankine aktif katsayısı, φ′ ağırlıklı ortalama ile; γ: ağırlıklı birim hacim ağırlığı.", en: "Ka: Rankine active coefficient from the weighted phi'; gamma: weighted unit weight." },
      ],
    },
    {
      type: "steps",
      title: { tr: "Kum zarfı adımları", en: "Sand envelope steps" },
      items: [
        {
          tr: "H1 ve Hn+1 ile trapez uzunluğunu L = H − H1/3 − Hn+1/3 hesapla.",
          en: "Compute the trapezoid length L = H - H1/3 - Hn+1/3.",
        },
        {
          tr: "Toplam yükü 0,65 Ka γ H² olarak bul; p = toplam / L.",
          en: "Compute the total load and divide by L to get the ordinate p.",
        },
        {
          tr: "Sürşarj varsa Ka·q'yu zarfın her noktasına ekle.",
          en: "If there is a surcharge, add Ka q to every ordinate.",
        },
      ],
    },
    {
      type: "example",
      title: { tr: "El hesabı: kum, 3 ankrajlı", en: "Hand check: sand, 3 anchors" },
      text: {
        tr: "H = 10 m, φ′ = 30° (Ka = 1/3), γ = 18 kN/m³, ankrajlar 1,5 / 4,5 / 7,5 m. H1 = 1,5 m, Hn+1 = 2,5 m; L = 10 − 0,5 − 0,833 = 8,667 m. Toplam = 0,65 · (1/3) · 18 · 100 = 390 kN/m; p = 390 / 8,667 = 45,0 kPa.",
        en: "H = 10 m, phi' = 30 deg, gamma = 18, anchors at 1.5, 4.5, 7.5 m: L = 8.667 m, total 390 kN/m, p = 45.0 kPa.",
      },
    },
    {
      type: "h",
      text: { tr: "Kil: sert ve yumuşak zarflar", en: "Clay: stiff and soft envelopes" },
    },
    {
      type: "formula",
      expr: "N_s = γ · H / S_u,b",
      caption: {
        tr: "Stabilite sayısı (denk. 9). S_u,b: kazı tabanının altındaki en düşük drenajsız kayma dayanımı (B′ derinliğine kadar). Ortalama S_u, zarfın ortalamasında kullanılır.",
        en: "Stability number; S_u,b is the lowest undrained strength below the base to depth B'.",
      },
    },
    {
      type: "steps",
      title: { tr: "Kil zarfı seçimi", en: "Clay envelope selection" },
      items: [
        {
          tr: "N_s ≤ 4 (sert kil): p = c · γ · H, c = 0,2–0,4 kullanıcı girdisi; toplam yük en az 3 H² kN/m alınır. Kalıcı yapıda ayrıca 0,65 Ka γ H² (tam sönümlü φ′) hesaplanır; büyük olan geçerlidir.",
          en: "N_s <= 4 (stiff): p = c gamma H with user c; total at least 3 H^2; permanent walls also check 0.65 Ka gamma H^2 with the drained phi'.",
        },
        {
          tr: "4 < N_s < 5,14: Ka = 0,22; p = Ka · γ · H; zarf sıfırdan 0,25 H'de tam değere ulaşır.",
          en: "4 < N_s < 5.14: Ka = 0.22, p = Ka gamma H, full from 0.25 H.",
        },
        {
          tr: "N_s ≥ 5,14 (yumuşak kil, Henkel): Ka = 1 − 4 S_u/(γH) + 2√2 (d/H) (1 − 5,14 S_u,b/(γH)); Ka en az 0,22. d girilmezse B′ alınır ve durum belirtilir.",
          en: "N_s >= 5.14 (soft, Henkel): Ka from eq. 12 with the failure depth d, floored at 0.22.",
        },
      ],
    },
    {
      type: "formula",
      expr: "Ka (Henkel) = 1 − 4·S_u/(γH) + 2√2·(d/H)·(1 − 5,14·S_u,b/(γH))",
      caption: {
        tr: "GEC-4 denk. 12. Yalnızca N_s ≥ 5,14 için. Sonucun 0,22'nin altında kalması durumunda Ka = 0,22 alınır.",
        en: "GEC-4 eq. 12, only for N_s >= 5.14; the result is floored at 0.22.",
      },
    },
    {
      type: "example",
      title: { tr: "El hesabı: yumuşak kil", en: "Hand check: soft clay" },
      text: {
        tr: "Kil zarfında N_s 4 ile 5,14 arasındaysa Ka = 0,22. S_u = 30 kPa için p = 0,22 · γH; kod γH = 136 kPa değeriyle p = 29,92 kPa verir. Henkel dalı için md regresyonu: S_u = 15, d = 4 m'de Ka = 1,17131.",
        en: "For 4 < N_s < 5.14, Ka = 0.22 and p = 0.22 gamma H; with gamma H = 136 kPa the QA check gives p = 29.92 kPa. Henkel regression: S_u = 15, d = 4 gives Ka = 1.17131.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Yumuşak kilde (N_s > 4) kazı tabanı altında pasif direnç hesabı yoktur: serbest zemin desteği ile gömülme hesabı bu durumda durur. Bu, programın kendi uyarısıdır; GEC-4 5.5.3 / Ek C yolu (0,2H gömülme, en alt ankrajdan konsol) uygulanmamıştır.",
        en: "For soft clay (N_s > 4) there is no passive resistance below the base in this model; the embedment stops and says so. The GEC-4 5.5.3 / Annex C path is not implemented.",
      },
    },
    {
      type: "h",
      text: { tr: "Trapez zarf ve ankraj yükleri", en: "Trapezoidal envelope and anchor loads" },
    },
    {
      type: "p",
      text: {
        tr: "Ankraj yükleri zarftan iki yöntemle bulunur. Menteşe yönteminde her ankrajın yanındaki bir mafsal (hinge) varsayılır ve her açıklıkta moment dengesinden ankraj tepkisi çıkar; katkı alanı (tributary) yönteminde her ankraj, kendi aralığındaki (orta noktalar arası) zarf alanını taşır. Kod her iki yöntemi de gösterebilir; zarf tek seviyede serbest zemin desteğiyle karşılaştırılır.",
        en: "Anchor loads come from the envelope with two methods. Hinge: each span is taken between hinges and moments give the reactions. Tributary: each anchor carries the envelope area between the midpoints of its neighbours.",
      },
    },
    {
      type: "figure",
      id: "anchored-wall-envelopes",
      caption: {
        tr: "Görünür basınç zarfı ve ankraj seviyeleri: kum trapezi (2/3 H1 ve 2/3 Hn+1 rampalar), kil için p = Ka γ H ve N_s'ye göre zarf, ankraj noktaları ve kazı tabanı (göster: kesit, her ankraj seviyesi, zarf ordinatları p(z)).",
        en: "Apparent envelope and anchor levels: sand trapezoid with ramps, clay envelope by N_s, anchor points and base (show section, anchor levels and p(z)).",
      },
    },
    {
      type: "example",
      title: { tr: "El hesabı: menteşe ve katkı alanı", en: "Hand check: hinge and tributary" },
      text: {
        tr: "Yukarıdaki kum örneği (p = 45,0 kPa) için menteşe yöntemi: 120,625 / 126,875 / 115,417 kN/m ankraj tepkileri, taban tepkisi R_B = 27,083 kN/m; toplam 390 kN/m. Katkı alanı yöntemi: 112,5 / 135 / 121,406 kN/m, R_B = 21,094 kN/m; toplam yine 390 kN/m. İki yöntem aynı zarfı paylaştırır ama dağılımları farklıdır.",
        en: "Same sand example: hinge reactions 120.6 / 126.9 / 115.4 kN/m, base 27.1; tributary 112.5 / 135.0 / 121.4, base 21.1; both total 390 kN/m.",
      },
    },
    {
      type: "h",
      text: { tr: "Tek seviye: serbest zemin desteği", en: "Single level: free earth support" },
    },
    {
      type: "p",
      text: {
        tr: "Tek seviyede program önce serbest zemin desteğini hesaplar (sheet_pile.py'deki anchored_sheet_pile ile aynı net basınç diyagramı, moment dengesi ankraj noktasına göre). Sonra GEC-4 zarfını ve menteşe yöntemini çalıştırır. Ankraj yükü ve maksimum moment için büyük olan değer kullanılır; hangisinin yönettiği varsayımlar listesinde yazar.",
        en: "For one level the program first runs free earth support (anchored_sheet_pile, moment about the anchor) and then the GEC-4 envelope with the hinge method. The larger anchor load and moment govern and the choice is listed.",
      },
    },
    {
      type: "example",
      title: { tr: "El hesabı: tek seviye kum", en: "Hand check: single level sand" },
      text: {
        tr: "Tek seviye kum H = 6 m: zarf p = 35,1 kPa ve ankraj yükü 115,05 kN/m. Sonuç max(serbest zemin desteği, 115,05 kN/m) olarak seçilir.",
        en: "Single-level sand H = 6 m: envelope p = 35.1 kPa and anchor load 115.05 kN/m; the result is max(free earth support, 115.05).",
      },
    },
    {
      type: "h",
      text: { tr: "Kil kazıda taban kabarması", en: "Basal heave in clay" },
    },
    {
      type: "formula",
      expr: "FS_1 = N_c · S_u,b / (γH + q − S_u·H/B′)   ;   FS_2 = N_c · S_u,b / (γH + q)",
      caption: {
        tr: "GEC-4 denk. 34–37. İki mekanizmanın küçük FS'si geçerlidir. FS_1 yan kesme etkisini S_u·H/B′ ile içerir; N_c'de derinlik kredisi yoktur (H/B = 0). FS_2 ise figür 51c'deki derinliğe bağlı N_c'yi kullanır.",
        en: "GEC-4 eq. 34-37. The smaller of the two FS governs. FS_1 counts side shear and uses N_c with no depth credit; FS_2 uses the depth-dependent N_c.",
      },
      where: [
        { tr: "B′ = B/√2 veya sert tabakanın derinliği D (hangisi küçükse).", en: "B' = B/sqrt(2) or the depth D to a stiff layer, whichever is smaller." },
        { tr: "q: kazı üstündeki sürşarj; B: kazı genişliği.", en: "q: surcharge; B: excavation width." },
      ],
    },
    {
      type: "formula",
      expr: "N_c = min( 5 (1 + 0,2 H/B) (1 + 0,2 B/L) ; N_c,şekil51c ) ,   H/B ≤ 2,5",
      caption: {
        tr: "Skempton N_c, grafik değeriyle sınırlı. Grafik (400 dpi'dan sayısallaştırılmış) B/L = 0, 0,5 ve 1 için verilmiştir; kodda grafik değeri üst sınır olarak uygulanır.",
        en: "Skempton N_c, capped by the digitised chart values for B/L = 0, 0.5, 1.",
      },
    },
    {
      type: "steps",
      title: { tr: "Taban kabarması adımları", en: "Basal heave steps" },
      items: [
        {
          tr: "B′ ve kazı tabanı altındaki S_u,b'yi bul; üst kısmın ağırlıklı γ ve S_u'sunu hesapla.",
          en: "Find B' and the lowest S_u below the base; compute the weighted gamma and S_u above.",
        },
        {
          tr: "N_c'yi hesapla; FS_1 ve FS_2'yi bul; küçük olanı al.",
          en: "Compute N_c and both FS; take the smaller.",
        },
        {
          tr: "Gerekli FS: geçici yapı 1,5, kalıcı yapı 2,5. Altındaysa uyarı verilir.",
          en: "Required FS: 1.5 for temporary, 2.5 for permanent; below this a warning is shown.",
        },
      ],
    },
    {
      type: "example",
      title: { tr: "El hesabı: taban kabarması", en: "Hand check: basal heave" },
      text: {
        tr: "H = 6 m, B = 10 m, S_u = 20 kPa: FS = 1,098 < 1,5, yani geçici yapı için de yetersiz (md regresyonu). B/L = 0,5 için N_c = 6,16. Dar ve derin kazıda (H = 10, B = 2, S_u = 30, γ = 18) N_c = 7,46 ve FS = 1,243.",
        en: "H = 6, B = 10, S_u = 20: FS = 1.098 < 1.5 (fails). B/L = 0.5 gives N_c = 6.16. Narrow deep cut H = 10, B = 2, S_u = 30, gamma = 18: N_c = 7.46, FS = 1.243.",
      },
    },
    {
      type: "figure",
      id: "anchored-wall-heave",
      caption: {
        tr: "Kil kazıda taban kabarması: kazı genişliği B, B′ derinliği ya da sert tabaka D, kazı tabanı altındaki S_u,b tabakası ve iki mekanizmanın özeti (göster: kazı kesiti, B ve B′ ölçüleri, S_u,b etiketi).",
        en: "Basal heave in clay: cut width B, depth B' or stiff layer D, lowest S_u below base and the two mechanisms (show section and dimensions).",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Dış stabilite hesaplanmaz; bu uyarı her sonuçta zorunludur (GEC-4 5.8.3, FS ≥ 1,3 önerisi). Ankraj arkasından ve içinden geçen kayma yüzeyleri ayrıca Bishop/şev modülüyle kontrol edilmelidir. Kranz yöntemi uygulanmaz.",
        en: "External stability is not computed; this warning is always shown (GEC-4 5.8.3, FS >= 1.3 suggested). Surfaces behind and through the anchors must be checked separately.",
      },
    },
    {
      type: "h",
      text: { tr: "Kalan sınırlar", en: "Remaining limits" },
    },
    {
      type: "steps",
      title: { tr: "Kullanıcı kontrol listesi", en: "User checklist" },
      items: [
        {
          tr: "Zemin tabakaları H içinde tek tipte mi; yeraltı suyu kazı tabanının altında mı?",
          en: "Is the soil uniform within H and the groundwater below the base?",
        },
        {
          tr: "Sert kilde c değeri ve kalıcı yapı için φ′ belgelendi mi?",
          en: "Are c for stiff clay and phi' for permanent walls documented?",
        },
        {
          tr: "Taban kabarması FS'si gerekli değerin üstünde mi; B ve yapı türü girildi mi?",
          en: "Is the basal heave FS above the required value, with B and service type entered?",
        },
        {
          tr: "Dış stabilite ayrıca kontrol edildi mi?",
          en: "Has external stability been checked separately?",
        },
      ],
    },
    {
      type: "p",
      text: {
        tr: "Sonuç: ankraj yükleri, maksimum moment ve kesme, gömülme ve kontrol satırları birlikte verilir. Her biri GEC-4 bölümüne ve kaynağa bağlanır. Ankraj tendonu ve serbest boyu için bkz. ground-anchors; kapasite hesabı bu konuda yapılmaz.",
        en: "The result gives anchor loads, maximum moment and shear, embedment and check rows, each tied to a GEC-4 section. Tendon and free length are in the ground-anchors topic; capacity is not checked here.",
      },
    },
  ],
};
