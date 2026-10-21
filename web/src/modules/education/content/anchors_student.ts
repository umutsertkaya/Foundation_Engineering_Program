import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Neden ankraj: konsol perdenin sınırı", en: "1. Why an anchor: the limit of a cantilever wall" } },
  {
    type: "p",
    text: {
      tr: "Bir önceki konuda konsol palplanşı gördük: üst ucu serbest perde, yalnızca gömme kısmındaki pasif direnç ile dengede kalır. Kazı derinleştikçe perdedeki moment hızla büyür, çünkü aktif basıncın toplam kuvveti ve kolu birlikte artar. Örneğin aynı zeminde (kuru kum, φ = 30°) H = 5 m kazı için konsol perdenin M_max değeri yaklaşık 281 kNm/m çıktı. Aynı kazıyı tek bir ankrajla desteklediğimizde, moment yaklaşık dörtte birine iner. Bunun nedeni, ankrajın yatay kuvvetin bir kısmını perdenin üst tarafından zemine aktarması ve momenti kolunu kısaltmasıdır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Ankraj, perdenin üst bölgesine yerleştirilmiş ve arkada sağlam bir zemine kadar uzanan bir çelik tendon ya da bir kablodur. Bu metinde yalnızca tek seviye ankrajlı palplanşı ele alıyoruz: perde boyunca tek bir ankraj noktası (z = z_a), kazı tabanının üstünde (z_a < H) yer alır. Ankrajın kendi tasarımı, yani çelik donatı, enjeksiyon ve sabitleme boyu, bu metnin kapsamı dışındadır; bu konu zemin ankrajları konusunda anlatılır. Burada ankrajı yalnızca perdeye uygulanan bir yatay kuvvet olarak ele alıyoruz.",
    },
  },
  {
    type: "figure",
    id: "anc-free-support",
    caption: {
      tr: "Serbest zemin desteği: ankraj noktasına göre moment dengesi P_a·l_a = P_p·l_p gömme derinliği D'yi, yatay denge T = P_a − P_p ankraj kuvvetini verir.",
      en: "Free earth support: moment equilibrium about the anchor, P_a·l_a = P_p·l_p, gives the embedment D and horizontal equilibrium, T = P_a − P_p, gives the anchor force.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Ankrajın yeri önemlidir. Ankraj yüzeyde (z_a = 0) olduğunda ankraj kuvveti küçük kalır ama moment büyür (aşağıda sayılarla görülecek); ankraj aşağı indikçe moment azalır, ancak ankraj kuvveti artar. Programda ankraj derinliği 0 ≤ z_a < H aralığında olmak zorundadır; ankraj kazı tabanının altına ya da perde dışına konamaz. Örnek 3’te ankrajın yerinin momenti nasıl değiştirdiğini sayılarla göreceğiz.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Serbest zemin desteği (free earth support)", en: "2. Free earth support" } },
  {
    type: "p",
    text: {
      tr: "Bir palplanşın alt ucu zemine ne kadar 'sabit' gömülü olduğuna bağlı olarak iki farklı biçimde davranabilir. Ucu zeminde sıkıca tutuluyorsa (sabit zemin desteği, fixed earth support), perdenin alt kısmında bir moment de oluşabilir ve ucun dönmesi engellenmiş olur. Ucu serbest ise (serbest zemin desteği, free earth support) perdenin alt ucu döner ve yalnızca bir yatay denge ile moment dengesi kurulur. Ankrajlı palplanşın standart hesabı, bu modüldeki programda serbest zemin desteğini kabul eder: ucun döndüğü, dolayısıyla alt uçta bir moment oluşmadığı varsayılır.",
    },
  },
  {
    type: "figure",
    id: "anc-free-vs-fixed",
    caption: {
      tr: "Serbest uç (sol) ve sabit uç (sağ) zemin desteği: serbest uçta perde ucu dönebilir ve M = 0'dır, sabit uçta uç momenti vardır ve gömme daha derindir. Program serbest uç yöntemini kullanır.",
      en: "Free earth (left) and fixed earth (right) support: with a free end the toe can rotate and M = 0; with a fixed end there is a toe moment and the embedment is deeper. The program uses the free earth method.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Serbest zemin desteği varsayımının iki sonucu vardır. Birincisi, perdenin ucunda moment sıfırdır; denge, ankrajın etrafında ve perde ucunda değil, ankraj noktasına göre alınan momentlerle kurulur. İkincisi, gömme derinliği D, sabit uca göre daha küçük çıkar; çünkü perde ucu dönebildiği için alt kısımda zemin daha az direnç üretmek zorundadır. Bu varsayım, gerçek zeminde perde ucunun tam olarak ne yaptığını bilmediğimiz için tutucu ya da gerçekçi olmayabilir; bu nedenle uygulamada gömme derinliğinin yönetmelik kurallarına göre artırılması ve zemin koşullarının uzman tarafından değerlendirilmesi gerekir.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınır: program ankrajlı perdede serbest zemin desteği varsayar. Sabit uç varsayımına göre hesap yapılması gerekiyorsa bu modül yetersizdir; sonuçları sabit uç ile karıştırmayın.",
      en: "The program assumes free earth support for anchored walls.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Ankraj noktasına göre moment dengesi ve D", en: "3. Moment equilibrium about the anchor and D" } },
  {
    type: "p",
    text: {
      tr: "Konsol perdede moment ucun etrafında alınıyordu. Ankrajlı perdede ise moment ankraj noktasının etrafında alınır, çünkü ankraj kuvveti T bu noktaya etki eder ve momentini sıfırlar. Dengenin koşulu, net basınçların ankrajdan olan momentlerinin toplamının sıfır olmasıdır. Net basınç p_net perdenin aktif ve pasif basınçlarının farkıdır (konu 2, palplanş). Bu denklemde bilinmeyen gömme derinliği D tek başına bulunur, çünkü ankraj kuvveti ayrı bir denklemle (yatay denge) hesaplanır.",
    },
  },
  {
    type: "formula",
    expr: "Σ M_ankraj = ∫₀^(H+D) p_net(z)·(z − z_a) dz = 0",
    caption: { tr: "Ankraj noktasına göre moment dengesi; D bu denklemin kökünden bulunur", en: "Anchor moment equilibrium" },
    where: [
      { tr: "z_a: ankraj derinliği [m] (yüzeyden); (z − z_a): her basıncın ankrajdan düşey kolu [m]" },
      { tr: "D0 bu denklemin kökü; program D = D0 yapar (ankrajlı palplanşta depth_increase varsayılanı 0)" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Kuru kum için bu denklem, sürşarj ve su olmadığında kapalı formda şöyle yazılır: K_a·γ·∫₀^(H+D) z(z − z_a) dz = K_p·γ·∫_H^(H+D) (z − H)(z − z_a) dz. Her iki integral polinomdur; bu yüzden denklem, D’ye göre üçüncü dereceden bir denklemdir ve kökü genellikle sayısal olarak (deneme yanılma ya da bir kök bulma yöntemi) bulunur. Öğrenci için en iyi yol, D’yi birkaç denemeyle sınırlamak ve artıkların (kalan momentin) işaret değişimini izlemektir. Program bu kökü brentq ile bulur ve sonucu 10⁻⁶ hassasiyetle verir.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: H = 5 m, z_a = 1 m, kuru kum (γ = 18, φ = 30°)", en: "Example 1: H = 5 m, anchor at 1 m, dry sand" },
    given: [
      { tr: "Kuru kum, γ = 18 kN/m³, φ = 30°: K_a = 1/3, K_p = 3, K_a·γ = 6, K_p·γ = 54 kN/m³" },
      { tr: "Kazı yüksekliği H = 5 m; ankraj derinliği z_a = 1 m; sürşarj yok" },
      { tr: "Denklem: f(D) = K_a·γ·[(H+D)³/3 − z_a(H+D)²/2] − K_p·γ·[D³/3 + (H − z_a)·D²/2] = 0" },
    ],
    steps: [
      { label: { tr: "Deneme 1: D = 1.0 m", en: "Trial 1: D = 1.0 m" }, expr: "f(1) = 6·[(6³)/3 − 1·(6²)/2] − 54·[1/3 + 4·1/2] = 6·54 − 54·2.333", result: "f = +198 kNm/m (pozitif, D küçük)" },
      { label: { tr: "Deneme 2: D = 2.0 m", en: "Trial 2: D = 2.0 m" }, expr: "f(2) = 6·[(7³)/3 − (7²)/2] − 54·[8/3 + 4·4/2] = 6 × 89.83 − 54 × 10.67", result: "f = −37 kNm/m (negatif, D büyük)" },
      { label: { tr: "Deneme 3: D = 1.9 m (kökün yakını)", en: "Trial 3: D = 1.9 m" }, expr: "f(1.9) = 6·[(6.9³)/3 − (6.9²)/2] − 54·[1.9³/3 + 4·1.9²/2] = 6 × 85.70 − 54 × 9.51", result: "f ≈ +0.8 kNm/m (≈ 0; küçük pozitif artık)" },
      { label: { tr: "Sonuç D0", en: "Result D0" }, expr: "f(1.9) ≈ +0.8 ve f(1.9023) ≈ 0 → D0 ≈ 1.902 m", result: "D0 = 1.90 m (tasarım = D0)" },
      { label: { tr: "Yatay denge: T", en: "Horizontal equilibrium: T" }, expr: "T = ½·K_a·γ·(H+D)² − ½·K_p·γ·D² = 3 × 6.902² − 27 × 1.902²", result: "T = 142.9 − 97.7 = 45.2 kN/m" },
    ],
    program: {
      input: "anchored_sheet_pile(profile: kuru kum γ 18, φ 30; H = 5; anchor_depth = 1.0; varsayılanlar)",
      output: "D0 = 1.9023 m; D = 1.9023 m; T (anchor_force) = 45.2166 kN/m; M_max = 71.86 kNm/m; z_M_max = 3.882 m; uyarı: 'Anchor load: 45.2 kN per anchor (spacing 1 m, inclination 0 deg)'",
      note: {
        tr: "El hesabındaki denemeler programın kökü (D0 = 1.902 m) ve T değeriyle aynı sonucu verir. Dikkat: programda depth_increase varsayılanı 0 olduğu için D = D0; konsol perdedeki 1.2 artışı burada yoktur.",
        en: "Hand and program agree; anchored default increase is 0.",
      },
    },
  },
  
  {
    type: "p",
    text: {
      tr: "Bu örnekte denemelerin ne kadar hızlı yakınsadığına dikkat edin: D = 1 m ve D = 2 m arasındaki işaret değişimi, kökün yerini kabaca gösterir ve iki-üç adımda 1.90 m’ye ulaşılır. Bu, sayısal kök bulmanın özünü verir: bir artık fonksiyon, işaret değiştirdiği aralığa daraltılır. Kökü bulunca yatay dengeyi kullanarak T’yi hesaplarız. Denge sırası hep aynıdır: önce D (moment), sonra T (yatay denge).",
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Ankraj kuvveti T ve birim başına ankraj yükü", en: "4. Anchor force T and load per anchor" } },
  {
    type: "p",
    text: {
      tr: "Yatay denge, perdenin tüm net basınçlarının toplamının sıfır olmasını ister: ankraj kuvveti T, net basıncın toplamını dengeler. Net basınç pozitifse (perdeyi kazıya doğru ittiğinde) ankraj kuvveti, perdeyi arkaya doğru çeker; programda T > 0 olmalıdır. Eğer hesaplanan T negatif çıkarsa, perdenin ankrajsız da dengede olabileceği anlamına gelir ve program bu durumda hata verir. Burada T, perdenin metresi başına kN/m cinsinden yatay kuvvettir.",
    },
  },
  {
    type: "formula",
    expr: "T = ∫₀^(H+D) p_net(z) dz      (T > 0 olmalıdır)\nP_ankraj = T · s / cos θ",
    caption: { tr: "Ankraj kuvveti (kN/m) ve tek bir ankrajın yükü (kN); s ankraj aralığı [m], θ eğim açısı [°]", en: "Anchor force and load per anchor" },
    where: [
      { tr: "s: ankrajların yatayda aralığı [m] (anchor_spacing); θ: ankrajın düşeyle yaptığı açı (anchor_inclination)" },
      { tr: "Program P_ankraj değerini ayrı bir uyarı satırı olarak verir; ankraj tasarımı için bu değer yetmez, ankraj konusuna bakın" },
    ],
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: Örnek 1 zemini ve ankraj, s = 2 m, θ = 15°", en: "Example 2: anchor spacing 2 m, inclination 15 deg" },
    given: [
      { tr: "Örnek 1’den: D0 = 1.902 m; T = 45.22 kN/m (birim perde metresi başına)" },
      { tr: "Ankraj aralığı s = 2 m (her 2 metrede bir ankraj); eğim θ = 15°" },
    ],
    steps: [
      { label: { tr: "Yatay kuvvet", en: "Horizontal force" }, expr: "T = 45.22 kN/m", result: "45.22 kN/m" },
      { label: { tr: "Tek ankraj yükü", en: "Load per anchor" }, expr: "P = T · s / cos θ = 45.22 × 2 / cos 15°", result: "P = 90.43 / 0.9659" },
      { label: { tr: "Sonuç", en: "Result" }, expr: "P ≈ 93.6 kN", result: "93.6 kN per anchor" },
    ],
    program: {
      input: "anchored_sheet_pile(profile: aynı; H = 5; anchor_depth = 1.0; anchor_spacing = 2.0; anchor_inclination = 15.0)",
      output: "uyarı: 'Anchor load: 93.6 kN per anchor (spacing 2 m, inclination 15 deg)'; T = 45.22 kN/m (değişmez)",
      note: {
        tr: "Program aralık ve eğim ile P’yi yeniden hesaplar; T ise yalnızca zemin ve geometriye bağlıdır, ankraj aralığına bağlı değildir. Bu, öğrencilerin sık karıştırdığı bir noktadır: T perde metresi başına, P tek ankraja düşen yüktür.",
        en: "T is per metre; P is per anchor.",
      },
    },
  },
  {
    type: "figure",
    id: "anchor-tie-force",
    caption: {
      tr: "Serbest zemin desteğinde ankraj kuvveti T = (M_a − M_p) / a ve yatay denge T = P_a − P_p. Ankraj yükü, ankraj aralığı s ve eğimi θ ile P = T·s / cos θ olur.",
      en: "Anchor force in free earth support, T = (M_a − M_p) / a, and horizontal equilibrium, T = P_a − P_p. The anchor load with spacing s and inclination θ is P = T·s / cos θ.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Ankraj aralığı ve eğimi, ankraj başına düşen gerçek yükü değiştirir ama perdenin iç momentlerini değiştirmez; çünkü moment, perde metresi başına T ile hesaplanır. Yani bir ankraj yükünü artırmak için aralığı açmak, perdenin momentini artırmaz, ama her ankrajın kendisini ve bağlantısını daha çok zorlar. Eğim θ arttıkça cos θ küçülür ve P büyür; bu nedenle eğim seçimi kuvvet büyüklüğünü doğrudan etkiler.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Kesme, moment ve M_max", en: "5. Shear, moment and M_max" } },
  {
    type: "p",
    text: {
      tr: "Ankrajlı perdede kesme ilk olarak ankraj noktasında bir sıçrama yapar: ankraj kuvveti perdenin kesmesini T kadar azaltır. Kesme, ankrajın altında tekrar artmaya başlar ve bir derinlikte (z0) sıfıra iner. Moment de bu noktada en büyük değerine ulaşır. Programda bu derinlik z_M_max olarak verilir ve kesme sıfır olduğu yerde moment tepe yapar. Konsol perdeden farkı şudur: konsolda kesme sıfırı kazı tabanının altında, ankrajlı perdede ise ankrajın altındaki aktif basınç bölgesinde oluşur.",
    },
  },
  {
    type: "formula",
    expr: "z0 = √(2T / (K_a·γ))      (kazı tabanının üstünde, z0 < H ise)\nM_max = T·(z0 − z_a) − K_a·γ·z0³ / 6",
    caption: { tr: "Ankrajlı perdede kesme sıfır derinliği ve maksimum moment (sürşarjsız, yatay yüzey, z0 < H)", en: "Anchored shear zero and M_max" },
    where: [
      { tr: "M_max [kNm/m]; bu eşitlik yalnızca aktif basınçların z0 derinliğine kadar uzandığı durumda geçerlidir" },
    ],
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: Örnek 1’in M_max değeri ve konsolla karşılaştırma", en: "Example 3: M_max for Example 1 and comparison with cantilever" },
    given: [
      { tr: "Örnek 1’den: T = 45.22 kN/m; z_a = 1 m; K_a·γ = 6 kN/m³" },
    ],
    steps: [
      { label: { tr: "Kesme sıfır derinliği", en: "Shear zero depth" }, expr: "z0 = √(2 × 45.22 / 6) = √15.07", result: "z0 = 3.88 m (kazı tabanının 1.12 m üstünde)" },
      { label: { tr: "Moment", en: "Moment" }, expr: "M_max = 45.22 × (3.88 − 1) − 6 × 3.88³ / 6 = 130.3 − 58.5", result: "M_max ≈ 71.8 kNm/m" },
      { label: { tr: "Konsol ile karşılaştırma", en: "Compare with cantilever" }, expr: "konsol M_max = 281.25 kNm/m (önceki konu, aynı H ve zemin)", result: "ankraj momenti yaklaşık %74 düşürdü" },
    ],
    program: {
      input: "anchored_sheet_pile(profile: aynı; H = 5; anchor_depth = 1.0); karşılaştırma için cantilever_sheet_pile(profile: aynı; H = 5)",
      output: "ankrajlı: M_max = 71.86 kNm/m, z_M_max = 3.882 m; konsol: M_max = 281.25 kNm/m",
      note: {
        tr: "El hesabı 71.8 kNm/m verir, program 71.86 kNm/m: fark z0’ın yuvarlanmasından gelir (3.88 yerine 3.882). Programın M_max değeri D0 üzerinden hesaplanır; ankraj için D = D0 olduğu için burada bu bir sorun değildir.",
        en: "Hand 71.8 vs program 71.86 from rounding z0.",
      },
    },
  },
  {
    type: "p",
    text: {
      tr: "Ankraj yerinin etkisine de bakın. Aynı zemin ve H = 5 m için ankraj yüzeyde (z_a = 0) olduğunda program D0 = 2.00 m, T = 38.7 kN/m ve M_max = 92.7 kNm/m verir; ankraj 2.5 m’de olduğunda ise D0 = 1.61 m, T = 61.1 kN/m ve M_max = 31.2 kNm/m verir. Yani ankrajı aşağı indirmek momenti büyük ölçüde azaltır, ama ankraj kuvvetini artırır. Bu bir denge sorunudur: moment ve ankraj kuvveti birbirine karşıt değişir ve seçim, kesit ile ankraj tasarımı arasında yapılır. Tek bir ankrajın yeri, bu nedenle hem moment hem ankraj kuvveti için bir optimizasyon sorusudur.",
    },
  },
  {
    type: "figure",
    id: "anc-shear-moment",
    caption: {
      tr: "Ankrajlı perdede kesme ve moment (z_a = 1 m, H = 5 m, D₀ = 1,90 m). Kesme ankraj noktasında T = 45,2 kN/m kadar sıçrar; |M| kesmenin sıfır olduğu z ≈ 3,88 m'de en büyüktür (≈ 72 kN·m/m) ve uçta M = 0'dır.",
      en: "Shear and moment of the anchored wall (z_a = 1 m, H = 5 m, D₀ = 1.90 m). The shear jumps by T = 45.2 kN/m at the anchor; |M| peaks at z ≈ 3.88 m where the shear is zero (≈ 72 kN·m/m) and M = 0 at the toe.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Sınırlar ve bu modülün kapsamı", en: "6. Limits and scope" } },
  {
    type: "p",
    text: {
      tr: "Bu modül tek seviye ankrajlı palplanşın denge hesabını yapar: gömme derinliği, ankraj kuvveti, kesme ve moment. Ankrajın kendisini tasarlamaz: ankraj uzunluğu, sabitleme boyu, çelik kapasitesi, kılıf ve enjeksiyon detayları bu modülde yer almaz; ankraj yükünün, ankrajın taşıyacağı kapasiteyle kıyaslanması ayrı bir kontroldür. Ankraj konusunda ayrıntılı bilgi için zemin ankrajları konusuna bakın. Ayrıca, bu konuda anlatılan denge yalnızca tek bir ankraj ve yatay bir yüzey için geçerlidir; birden fazla ankraj seviyesi, eğimli arka yüzey ya da kompleks zemin profilleri bu modülün kapsamında değildir.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat: ankraj kazı tabanının altına konamaz ve program 'ankraj çok alçak' hatası verir. Örneğin z_a = 4.9 m (kazı tabanına 0.1 m kala) için program 'ankraj serbest zemin desteği için çok alçak' hatasını verir: kazı tabanının üstündeki net basınç ankraj çevresinde devirici moment üretmez, yani ankrajı yükseltmek gerekir.",
      en: "Anchor too low: no overturning moment about the anchor; raise the anchor.",
    },
  },
  {
    type: "figure",
    id: "anc-position-effect",
    caption: {
      tr: "Ankraj yerinin etkisi (H = 5 m, φ′ = 30°): ankraj aşağı indikçe D₀ küçülür, T büyür. z_a = 4,9 m'de ankraj çok alçaktır ve program hata verir.",
      en: "Effect of the anchor level (H = 5 m, φ′ = 30°): the lower the anchor, the smaller D₀ and the larger T. At z_a = 4.9 m the anchor is too low and the program raises an error.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Son olarak, bu modülde yapılmayanları açıkça söyleyelim. Seepage (sızma) modellenmez; su durgun kabul edilir. Ankrajın çekme kuvveti, zemin ankraj yüzeyine göre ayrı bir stabilite kontrolü ile doğrulanmalıdır. Deprem ve sürşarj gibi ek yükler, ayrı parametrelerle girilebilir ama bu konu bu metinde ayrıntılı işlenmemiştir. Yönetmelik ve projenin güvenlik politikası, hangi gömme artışının ve hangi güvenlik sayısının kullanılacağını belirler; bu metin bir değer önermez.",
    },
  },
  {
    type: "steps",
    title: { tr: "Tek seviye ankrajlı palplanş hesabının adımları", en: "Single-anchored sheet pile steps" },
    items: [
      { tr: "Kazı yüksekliği H, ankraj derinliği z_a (0 ≤ z_a < H) ve zemin parametreleri girilir." },
      { tr: "Net basınç p_net(z) hesaplanır (palplanş konusundaki yöntemle)." },
      { tr: "Ankraj noktasına göre moment dengesi çözülüp D0 bulunur (serbest zemin desteği; deneme yanılma ya da kök bulma)." },
      { tr: "D = D0 alınır (programda ankraj için varsayılan artış 0)." },
      { tr: "Yatay denge ile T = ∫ p_net dz hesaplanır; T > 0 olmalıdır." },
      { tr: "Kesme sıfır derinliği z0 ve M_max bulunur; M_max ile kesit seçilir." },
      { tr: "Ankraj aralığı ve eğimi ile tek ankraj yükü P = T·s/cos θ hesaplanır; ankraj tasarımı ayrı yapılır." },
    ],
  },
  { type: "h", text: { tr: "Sık yapılan hatalar", en: "Common mistakes" } },
  {
    type: "mistakes",
    items: [
      { tr: "Ankraj momentini zemin yüzeyinden değil ucun etrafında almak; ankrajlı perdede moment ankraj noktasına göre alınır." },
      { tr: "T ile P’yi karıştırmak: T perde metresi başına (kN/m) yatay kuvvettir, P tek bir ankrajın yüküdür (kN)." },
      { tr: "Ankraj aralığını değiştirerek momenti değiştirmeye çalışmak; M_max perde metresi başına T ile hesaplanır, aralık yalnızca P’yi değiştirir." },
      { tr: "Ankraj yerini kazı tabanının altına koymak; program z_a < H ister ve daha alçak yerde hata verir." },
      { tr: "Serbest zemin desteği ile sabit uç varsayımını karıştırmak; program serbest uç varsayar." },
      { tr: "Konsoldaki 1.2 gömme artışını ankrajlı perdeye de uygulamak; programda ankraj için varsayılan artış 0’dır." },
      { tr: "Kesme sıfırını ankraj noktasında aramak; kesme ankrajda sıçrar ve sıfır, ankrajın altında bir derinliktedir." },
      { tr: "T negatif çıktığında programı hatalı saymak; T ≤ 0 ise perde ankrajsız da dengededir ve program bunu bildirir." },
      { tr: "Ankraj uzunluğunu ve çelik kapasitesini bu modülden doğrulanmış sanmak; bu modül ankraj tasarımı yapmaz." },
      { tr: "Ankraj kuvvetini, her metre perde için yatay T ile tek ankraj yükü P’nin aynı şey olduğunu sanmak." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "Serbest zemin desteğinde perde ucunda moment ne olur?", en: "What is the moment at the toe under free earth support?" },
        a: { tr: "Sıfırdır; perde ucu dönebildiği kabul edilir, bu yüzden moment dengesi ankraj noktasına göre kurulur.", en: "Zero." },
      },
      {
        q: { tr: "H = 5 m, z_a = 1 m için D = 1 m’de f(D) artığının işareti nedir (Örnek 1)?", en: "Sign of residual at D = 1 m for example 1?" },
        a: { tr: "Pozitif (f = +198 kNm/m); bu nedenle kök D = 1 m’den büyüktür.", en: "Positive." },
      },
      {
        q: { tr: "D = 2 m için f(2) ≈ −37 ise kök hangi aralıktadır?", en: "If f(2) ≈ -37, in which interval is the root?" },
        a: { tr: "f(1) > 0 ve f(2) < 0 olduğundan kök (1, 2) aralığındadır; deneme sonucu D0 ≈ 1.90 m.", en: "Between 1 and 2 m." },
      },
      {
        q: { tr: "Örnek 1’de T = 45.22 kN/m ise s = 2 m ve θ = 15° için tek ankraj yükü P kaç kN’dur?", en: "Given T = 45.22, s = 2 m and theta = 15 deg, what is P?" },
        a: { tr: "P = 45.22 × 2 / cos 15° = 90.43 / 0.9659 ≈ 93.6 kN.", en: "93.6 kN." },
      },
      {
        q: { tr: "Ankraj kuvveti T için kesme sıfır derinliği z0 = √(2T/(K_a·γ)) formülünde T = 45.22, K_a·γ = 6 alındığında z0 kaçtır?", en: "z0 for T = 45.22 and Ka gamma = 6?" },
        a: { tr: "z0 = √(90.44 / 6) = √15.07 ≈ 3.88 m.", en: "3.88 m." },
      },
      {
        q: { tr: "Örnek 1 için M_max = T·(z0 − z_a) − K_a·γ·z0³/6 formülünü uygulayın (z0 = 3.88, z_a = 1, T = 45.22).", en: "Compute M_max with z0 = 3.88, z_a = 1, T = 45.22." },
        a: { tr: "M_max = 45.22 × 2.88 − 6 × 58.5 / 6 = 130.2 − 58.5 ≈ 71.7 kNm/m (program 71.86; fark yuvarlamadan).", en: "About 71.8 kNm/m." },
      },
      {
        q: { tr: "Ankraj aralığı s artırılırsa perdedeki moment M_max değişir mi?", en: "If spacing s increases, does M_max change?" },
        a: { tr: "Hayır. Moment perde metresi başına T ile hesaplanır; aralık yalnızca tek ankraj yükü P’yi etkiler.", en: "No." },
      },
      {
        q: { tr: "Ankraj z_a = 0 (yüzeyde) iken program D0 = 2.00 m ve M_max = 92.7 kNm/m verir; z_a = 1 m için D0 = 1.90 m, M_max = 71.9 kNm/m. Hangisi momenti daha çok azaltır ve neden?", en: "Which anchor depth gives lower moment and why?" },
        a: { tr: "z_a = 1 m (M_max 71.9 < 92.7); ankraj aşağı indikçe moment kolu kısalır ve kesme sıfır olan derinlik sığlaşır. Ankraj kuvveti ise bu arada değişir (T 38.7 → 45.2).", en: "z_a = 1 m gives lower M_max." },
      },
      {
        q: { tr: "Programda T negatif çıkarsa ne yapılmalıdır?", en: "If T comes out negative, what should be done?" },
        a: { tr: "Program hata verir: perde ankrajsız dengede olabilir. Ankrajın gerekliliği yeniden değerlendirilmeli, geometri ya da zemin girdileri kontrol edilmelidir.", en: "Re-evaluate the need for an anchor." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Ankraj", en: "Anchor" }, def: { tr: "Perdenin üst bölgesinden arkadaki zemine uzanan ve yatay kuvveti aktaran eleman; bu modülde yalnızca bir yatay kuvvet olarak ele alınır." } },
      { term: { tr: "Tek seviye ankrajlı palplanş", en: "Single-anchored sheet pile" }, def: { tr: "Perde boyunca tek bir ankraj noktası olan ve serbest zemin desteği varsayılan palplanş." } },
      { term: { tr: "Serbest zemin desteği", en: "Free earth support" }, def: { tr: "Perde ucunun dönebildiği ve ucunda momentin sıfır kabul edildiği destek modeli." } },
      { term: { tr: "Sabit zemin desteği", en: "Fixed earth support" }, def: { tr: "Perde ucunun zeminde sıkıca tutulduğu ve ucunda moment oluşabildiği destek modeli; bu modülde kullanılmaz." } },
      { term: { tr: "Ankraj derinliği (z_a)", en: "Anchor depth" }, def: { tr: "Ankrajın yüzeyden derinliği [m]; 0 ≤ z_a < H aralığında olmalıdır." } },
      { term: { tr: "Ankraj kuvveti (T)", en: "Anchor force" }, def: { tr: "Yatay denge ile bulunan, perde metresi başına yatay kuvvet [kN/m]; T = ∫ p_net dz." } },
      { term: { tr: "Ankraj yükü (P)", en: "Load per anchor" }, def: { tr: "Tek bir ankrajın yükü [kN]; P = T·s / cos θ ile bulunur." } },
      { term: { tr: "Ankraj aralığı (s)", en: "Anchor spacing" }, def: { tr: "Ankrajların yatayda birbirine uzaklığı [m]." } },
      { term: { tr: "Ankraj eğimi (θ)", en: "Anchor inclination" }, def: { tr: "Ankrajın düşeyle yaptığı açı [°]; cos θ ile yük artar." } },
      { term: { tr: "Ankraja göre moment dengesi", en: "Moment equilibrium about anchor" }, def: { tr: "Net basınçların ankraj noktasından olan momentlerinin toplamının sıfır olması koşulu." } },
      { term: { tr: "Gömme derinliği (D0, D)", en: "Embedment depth" }, def: { tr: "Kazı tabanının altında perdenin gömülü boyu [m]; ankrajlı palplanşta D = D0 (varsayılan artış 0)." } },
      { term: { tr: "Net basınç (p_net)", en: "Net pressure" }, def: { tr: "Aktif ile pasif basınç arasındaki fark [kPa]; pozitif ise perdeyi kazıya doğru iter." } },
      { term: { tr: "Kesme kuvveti (V)", en: "Shear force" }, def: { tr: "Bir derinliğin üstündeki net basınçların toplamı; ankraj noktasında T kadar sıçrar." } },
      { term: { tr: "Kesme sıfır derinliği (z0)", en: "Shear-zero depth" }, def: { tr: "Kesmenin sıfır olduğu ve momentin en büyük olduğu derinlik [m]." } },
      { term: { tr: "Maksimum moment (M_max)", en: "Maximum moment" }, def: { tr: "Perdede oluşan en büyük eğilme momenti [kNm/m]; kesit seçimini belirler." } },
      { term: { tr: "Rankine aktif katsayısı (K_a)", en: "Active coefficient" }, def: { tr: "Yatay yüzey için aktif yanal basınç katsayısı; K_a = tan²(45° − φ/2)." } },
      { term: { tr: "Rankine pasif katsayısı (K_p)", en: "Passive coefficient" }, def: { tr: "Yatay yüzey için pasif yanal basınç katsayısı; K_p = tan²(45° + φ/2)." } },
      { term: { tr: "Kök bulma (brentq)", en: "Root finding" }, def: { tr: "Bir fonksiyonun işaret değiştirdiği aralığı daraltarak sıfırını bulan sayısal yöntem; programda D için kullanılır." } },
      { term: { tr: "Artık (residual)", en: "Residual" }, def: { tr: "Moment dengesinin sağlanmayan kısmı; deneme yanılmada sıfıra yaklaşılır." } },
      { term: { tr: "Yatay denge", en: "Horizontal equilibrium" }, def: { tr: "Tüm yatay kuvvetlerin toplamının sıfır olması; T’yi belirler." } },
      { term: { tr: "Sızma (seepage)", en: "Seepage" }, def: { tr: "Suyun zemin içinde akması; program bunu modellemez." } },
      { term: { tr: "Konsol palplanş", en: "Cantilever sheet pile" }, def: { tr: "Ankrajsız, üst ucu serbest palplanş; karşılaştırma için bu konuda kullanılır." } },
    ],
  },
  {
    type: "reading",
    items: [
      "USS Steel Sheet Piling Design Manual (United States Steel). Tek seviye ankrajlı palplanş ve serbest zemin desteği; doğrulanmadı, bölüm ve sayfa yazılmadı.",
      "USACE EM 1110-2-2504, Design of Sheet Pile Walls. Ankrajlı palplanş yöntemleri; doğrulanmadı.",
      "Das, B.M., Principles of Foundation Engineering, istinat ve palplanş bölümü; doğrulanmadı.",
    ],
  },
];
