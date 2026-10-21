import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Palplanş ne işe yarar ve iki temel tür", en: "1. What a sheet pile does and the two basic types" } },
  {
    type: "p",
    text: {
      tr: "Palplanş, ince ve uzun bir çelik (ya da bazen betonarme) perdedir; kazı yapılacağında zemini bir yanda tutmak için yere çakılır ya da titreşimle indirilir. Bir çukurun kenarını düşünün: kazı yapılmadan önce zemin dengededir, ama kazı tabanına inildiğinde yanındaki zemin çukura doğru hareket etmek ister. Palplanş bu hareketi durdurur, yani zeminin yaptığı yatay itkiyi taşır. Bu bölümde yalnızca bir metre uzunluktaki (birim genişlikteki) bir perdeye bakacağız; birimler kN/m ve kNm/m olarak yazılır. Program da aynı kabulle çalışır: her metre perde için kuvvet ve moment hesaplanır.", en: "Sheet piles are thin, long steel (or sometimes reinforced concrete) walls; where excavation is to be done, they are driven into the ground or lowered by vibration to hold back the soil on one side. Think of the edge of a pit: before excavation the soil is in equilibrium, but when the excavation base is reached, the adjacent soil tends to move toward the pit. The sheet pile stops this movement, that is, it carries the horizontal thrust exerted by the soil. In this section we look only at a wall of one metre length (per unit width); units are written as kN/m and kNm/m. The program works on the same assumption: force and moment are calculated for each metre of wall.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu modülde iki ayrı durum vardır. Konsol (serbest uçlu) palplanşta perdenin üst ucu serbesttir; herhangi bir destek yoktur, dengeyi yalnızca perdenin altındaki zeminin pasif direnci sağlar. Ankrajlı palplanşta ise perdenin üst bölgesine yerleştirilmiş tek bir ankraj, yatay kuvveti zemine ya da bir kirişe aktarır. Konsol perde daha kısa kazılarda, ankrajlı perde daha derin kazılarda kullanılır; ama seçim yalnızca yüksekliğe bağlı değildir, zemin, komşu yapılar ve ankraj yerleşim olanağı da belirleyicidir. Bu metinde konsol perdeyi (bölüm 2–6), ankrajlı perdeyi ise ayrı bir konuda ele alıyoruz.", en: "There are two distinct situations in this module. In a cantilever (free-head) sheet pile the top of the wall is free; there is no support, and equilibrium is provided only by the passive resistance of the soil below the wall. In an anchored sheet pile, a single anchor placed in the upper part of the wall transfers the horizontal force to the ground or to a beam. Cantilever walls are used for shallower excavations and anchored walls for deeper ones; but the choice does not depend on height alone: soil, neighbouring structures and the feasibility of anchor placement are also decisive. In this text we treat the cantilever wall (sections 2 to 6), and the anchored wall is covered in a separate topic.",
    },
  },
  {
    type: "figure",
    id: "spw-wall-types",
    caption: {
      tr: "Konsol palplanş (solda, yalnız gömme ile ayakta) ve tek ankrajlı palplanş (sağda, ankraj artı gömme). Kesikli mor çizgi perdenin şekil değiştirmesidir; kazı tabanından aşağısı gömme boyudur.",
      en: "Cantilever sheet pile (left, stands by embedment alone) and single-anchor sheet pile (right, anchor plus embedment). The dashed violet line is the deflected shape; the part below the dredge line is the embedment.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Derinlikleri nereden ölçtüğümüz önemlidir. Bu metinde ve programda z = 0, arka taraftaki zemin yüzeyidir; kazı tabanı (dredge line) z = H derinliğindedir ve perdenin gömülü kısmı H’den aşağı uzanır. Gömme derinliği D, kazı tabanının altında perdenin ne kadar zemine girdiğini gösterir. Toplam perde boyu H + D olur. Bu tanım, öğrencilerin en sık karıştırdığı noktalardan biridir: H, kazı yüksekliğidir, D değil. Bir palplanş hesabında 'gömme' sözü her zaman kazı tabanının altını kasteder.", en: "How we measure depth matters. In this text and in the program, z = 0 is the ground surface on the retained side; the excavation base (dredge line) lies at depth z = H and the embedded part of the wall extends below H. The embedment depth D shows how far the wall enters the soil below the excavation base. Total wall length is H + D. This definition is one of the points students most often confuse: H is the excavation height, not D. In a sheet pile calculation, the word 'embedment' always refers to the part below the excavation base.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Net basınç: aktif ve pasif zemin itkisi", en: "2. Net pressure: active and passive earth pressure" } },
  {
    type: "p",
    text: {
      tr: "Perdeye etki eden basınç iki parçadan oluşur. Arka tarafta (kazı tarafının karşısında), zemin perdeyi kazıya doğru iter; buna aktif basınç denir. Kazı tabanının altında ise perdenin öbür yüzünde zemin vardır ve bu zemin perdeye karşı direnç gösterir; buna pasif basınç denir. Aktif basınç, zeminin kendi ağırlığından ve yüzeydeki yüklerden gelir; pasif basınç ise zeminin sıkışmasına karşı gösterdiği dirençten gelir. Her iki basınç da derinlikle artar, çünkü üstteki zeminin ağırlığı daha fazladır. Bu nedenle bir palplanş hesabı, derinliğe bağlı bir basınç diyagramı ile başlar.", en: "The pressure acting on the wall has two parts. On the back side (opposite the excavation), the soil pushes the wall toward the excavation; this is called active pressure. Below the excavation base, on the other face of the wall, there is soil that resists the wall; this is called passive pressure. Active pressure comes from the soil's own weight and surface loads; passive pressure comes from the resistance of the soil to compression. Both pressures increase with depth, because the weight of the overlying soil grows. For this reason, a sheet pile calculation starts with a depth-dependent pressure diagram.",
    },
  },
  {
    type: "formula",
    expr: "K_a = tan²(45° − φ/2),    K_p = tan²(45° + φ/2)      (yatay yüzey, düz arka yüzey için)",
    caption: { tr: "Rankine aktif ve pasif katsayıları; φ arttıkça K_a azalır, K_p artar", en: "Rankine coefficients" },
    where: [
      { tr: "φ: efektif sürtünme açısı [°]; program bu iki katsayıyı tasarım parametresinden alır", en: "φ: effective friction angle [°]; the program takes these two coefficients from the design parameter" },
      { tr: "Eğimli arka yüzey ya da duvar sürtünmesi (δ) varsa program başka katsayılar kullanabilir; bu metin yatay yüzeyi anlatır", en: "If the retained surface is inclined or there is wall friction (δ), the program may use other coefficients; this text describes the horizontal surface" },
    ],
  },
  {
    type: "formula",
    expr: "p_aktif(z) = K_a·(σ'_v(z) + q) + γ_w·max(0, z − GWT)      (z ≥ 0)\np_pasif(z) = K_p·σ'_v(z − H) / GS + γ_w·max(0, z − max(GWT, H))      (z > H)\np_net(z) = p_aktif(z) − p_pasif(z)",
    caption: { tr: "Programın kullandığı basınç bağıntıları (yatay yüzey, durgun su). p_net pozitifse perde kazıya doğru iter", en: "Program pressure relations" },
    where: [
      { tr: "σ'_v: efektif düşey gerilme [kPa]; q: yüzey sürşarjı [kPa]; GWT: yeraltı suyu derinliği [m]", en: "σ'_v: effective vertical stress [kPa]; q: surface surcharge [kPa]; GWT: groundwater depth [m]" },
      { tr: "GS: pasif güvenlik sayısı (passive_factor); pasif basınç bu sayıya bölünür, bölüm 4", en: "GS: passive safety factor (passive_factor); passive pressure is divided by this number, see section 4" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Net basınç p_net, aktif ile pasifin farkıdır ve tek bir diyagram olarak okunur. Kazı tabanının üstünde (z < H) yalnızca aktif basınç vardır, net basınç pozitiftir ve perdeyi kazıya doğru iter. Kazı tabanının altında (z > H) pasif basınç da devreye girer; derinlik arttıkça pasif basınç aktif basıncı geçer ve net basınç işaret değiştirir. Net basıncın işaret değiştirdiği yer, perdenin 'dengeyi kurmak için' yeterince gömülmesi gereken yerin ilk ipucudur. Kazı tabanının üstünde perde çalışırken, altında ise zemin direnç gösterir.", en: "Net pressure p_net is the difference between active and passive pressure, and is read as a single diagram. Above the excavation base (z < H) only active pressure acts; net pressure is positive and pushes the wall toward the excavation. Below the excavation base (z > H) passive pressure also comes into play; as depth increases, passive pressure overtakes active pressure and net pressure changes sign. The point where net pressure changes sign is the first hint of where the wall must be embedded enough to reach equilibrium. While the wall works above the excavation base, the soil below it provides resistance.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: kuru kum, γ = 18 kN/m³, φ = 30°, H = 5 m", en: "Example 1: dry sand, gamma = 18, phi = 30, H = 5 m" },
    given: [
      { tr: "Kuru kum, γ = 18 kN/m³, φ = 30°, yeraltı suyu yok (program: GWT 100 m)", en: "Dry sand, γ = 18 kN/m³, φ = 30°, no groundwater (program: GWT 100 m)" },
      { tr: "Kazı yüksekliği H = 5 m; yüzey sürşarjı yok", en: "Excavation height H = 5 m; no surface surcharge" },
      { tr: "K_a = tan²(30°) = 1/3 = 0.3333; K_p = tan²(60°) = 3", en: "K_a = tan²(30°) = 1/3 = 0.3333; K_p = tan²(60°) = 3" },
    ],
    steps: [
      { label: { tr: "Yüzeyde aktif basınç (z = 0)", en: "Active pressure at surface" }, expr: "p_aktif(0) = K_a · 0 = 0", result: "0 kPa" },
      { label: { tr: "Kazı tabanında aktif basınç (z = 5)", en: "Active at dredge line" }, expr: "p_aktif(5) = K_a · γ · 5 = 0.3333 × 18 × 5", result: "30 kPa" },
      { label: { tr: "Kazı tabanının altında (z = 6, D'nin 1 m altı)", en: "Active at z = 6" }, expr: "p_aktif(6) = K_a · 18 · 6 = 0.3333 × 108", result: "36 kPa" },
      { label: { tr: "Aynı derinlikte pasif basınç (kazı tabanından 1 m aşağı)", en: "Passive 1 m below dredge line" }, expr: "p_pasif = K_p · γ · 1 = 3 × 18 × 1", result: "54 kPa" },
      { label: { tr: "Net basınç (z = 6)", en: "Net at z = 6" }, expr: "p_net(6) = 36 − 54", result: "−18 kPa (perdeyi kazıdan uzağa iter)" },
    ],
    program: {
      input: "net_pressure(profile: kuru kum γ 18, φ 30, bottom 40; H = 5; diğer parametreler varsayılan); z = 0, 2, 5.01, 6, 7.5 m noktalarında okunur",
      output: "z = 2: aktif 12.0, pasif 0.0, net 12.0 kPa; z = 6: aktif 36.0, pasif 54.0, net −18.0 kPa; z = 7.5: aktif 45.0, pasif 135.0, net −90.0 kPa",
      note: {
        tr: "Program z = 6 m için aktif 36 kPa, pasif 54 kPa ve net −18 kPa verir; el hesabıyla birebir aynıdır. Kazı tabanında (z = 5) pasif sıfırdan başlar; 5.01 m’de pasif 0.54 kPa’dır, yani pasif basınç kazı tabanının altında doğrusal artar.",
        en: "Program matches the hand values at z = 6 m.",
      },
    },
  },
  {
    type: "figure",
    id: "sp-net-diagram",
    caption: {
      tr: "Konsol palplanşta net basınç, kesme ve moment diyagramları (H = 3 m örneği). Net basınç aktif eksi pasiftir; kesme V = 0 olan derinlikte moment en büyüktür (M_max = 60,75 kN·m/m, z = 4,50 m).",
      en: "Net pressure, shear and moment diagrams of a cantilever sheet pile (H = 3 m example). The net pressure is active minus passive; the moment is largest where the shear is zero (M_max = 60.75 kN·m/m at z = 4.50 m).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Burada iki pratik ayrıntı önemlidir. Birincisi, aktif ve pasif basınçlar ile su basıncı ayrı ayrı hesaplanır ve toplanır; program, arka taraftaki su seviyesini tasarım GWT’sinden, öndeki su seviyesini ise kazı tabanı ile GWT’nin büyüğünden alır (ya da front_water_depth ile verilen değerden). İkincisi, programda sızma (seepage) modellenmez. Yani su basıncı durgun sudur ve suyun zemin içinde akmasından doğan ek kuvvet hesaba girmez. Bu, sığ ve geçirimsiz olmayan zeminlerde sonucu tutucu ya da gerçekle uyumsuz yapabilir; bu nedenle yeraltı suyu rejimi bir uzman tarafından kontrol edilmelidir.", en: "Two practical details are important here. First, active and passive pressures and water pressure are calculated separately and summed; the program takes the water level on the back side from the design GWT, and the water level on the front from the larger of the excavation base and GWT (or from the value given by front_water_depth). Second, seepage is not modelled in the program. That is, water pressure is hydrostatic and the additional force arising from water flowing through the soil is not included. This can make the result conservative or inconsistent with reality in shallow and non-impermeable soils; for this reason the groundwater regime should be checked by a specialist.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınır: net basınç yatay yüzey ve durgun su varsayımıyla çalışır. Program arka yüzey eğimi ve sürşarj gibi durumları da alabilir, ama bu metin yalnızca temel durumu anlatır. Eğimli arka yüzeyde c' değeri program tarafından yok sayılır ve bir uyarı verilir.",
      en: "Simplified pressures: horizontal surface and hydrostatic water; no seepage.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Blum yöntemi: momentler ve gömme derinliği D0", en: "3. Blum method: moments and theoretical embedment D0" } },
  {
    type: "p",
    text: {
      tr: "Konsol palplanşta perdenin altında zemin, perdeyi yerinden oynatmamak için bir pasif direnç üretir. Bu direncin tam dağılımı bilinmez, bu yüzden programın kullandığı Blum yöntemi bu kuvveti tek bir noktada toplar: perdenin ucunda (z = H + D0) yoğunlaşmış bir R kuvveti. Sezgi şöyledir: perde ucunda zemin 'bir mıhla' tutuluyormuş gibi düşünün; kazı tabanının üstündeki aktif itki perdeyi bir yöne döndürmek ister, perdenin altındaki zemin ise ucu karşı yönde iter. Denge için iki kuvvet, perdenin ucu etrafında momentler toplamı sıfır olacak şekilde uygulanmalıdır. Bu, D0’ı bulmanın temel mantığıdır.", en: "In a cantilever sheet pile, the soil below the wall produces passive resistance to keep the wall from moving. The exact distribution of this resistance is not known, so the Blum method used by the program gathers this force at a single point: a concentrated force R at the wall tip (z = H + D0). The intuition is this: imagine the soil at the wall tip holding it as if with a pin; the active thrust above the excavation base tries to rotate the wall in one direction, while the soil below the wall pushes the tip in the opposite direction. For equilibrium, two forces must be applied so that the sum of moments about the wall tip is zero. This is the basic logic for finding D0.",
    },
  },
  {
    type: "formula",
    expr: "Σ M_uç = ∫₀^(H+D0) p_net(z)·(H + D0 − z) dz = 0",
    caption: { tr: "Blum moment dengesi: tüm net basınçların perde ucuna göre momentleri toplamı sıfırdır", en: "Blum moment equilibrium" },
    where: [
      { tr: "D0: teorik gömme derinliği [m] (kazı tabanının altı); H + D0 toplam perde boyudur", en: "D0: theoretical embedment depth [m] (below the excavation base); H + D0 is the total wall length" },
      { tr: "(H + D0 − z): her basıncın perde ucuna olan düşey kolu [m]", en: "(H + D0 − z): vertical arm [m] of each pressure to the wall tip" },
    ],
  },
  {
    type: "formula",
    expr: "R = ∫₀^(H+D0) p_net(z) dz      (perde ucundaki yoğunlaşmış kuvvet)\nD = D0 × (1 + artış)      (konsol varsayılan artış = 0.20)",
    caption: { tr: "Yatay denge ile R; tasarım gömme derinliği D programın varsayılanı olan %20 artışla bulunur", en: "R and design embedment" },
    where: [
      { tr: "Program D0 ve R değerlerini verir; D, güvenlik için 1.2 × D0 olarak tasarım derinliğidir (depth_increase = 0.2)", en: "The program gives D0 and R values; for safety, D = 1.2 × D0 is the design embedment (depth_increase = 0.2)" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Momentler toplamını çözmek için kapalı bir yol vardır ama yalnızca basit durumlarda. Düz (yatay) bir zeminde, sürşarj ve su olmadığında, aktif basınç perde boyunca K_a·γ·z biçiminde, pasif basınç ise K_p·γ·(z − H) biçiminde doğrusal artar. Bu durumda moment denklemi bir üçüncü derece denklem halini alır ve D0 için şu ilişki çıkar: D0 / (H + D0) = (K_a / K_p)^(1/3). Bu oranın sezgisi açıktır: pasif direnç ne kadar güçlüyse (K_p büyükse) gerekli gömme o kadar küçük olur. Bu ilişki, bu bölümün ilk örneğinin temelidir.", en: "There is a closed-form route to solve the moment sum, but only for simple cases. On level (horizontal) ground, with no surcharge and no water, active pressure increases linearly along the wall as K_a·γ·z, and passive pressure as K_p·γ·(z − H). In this case the moment equation takes the form of a third-degree equation, and the relation for D0 is: D0 / (H + D0) = (K_a / K_p)^(1/3). The intuition of this ratio is clear: the stronger the passive resistance (larger K_p), the smaller the required embedment. This relation is the basis of the first example in this section.",
    },
  },
  {
    type: "derivation",
    title: { tr: "Kapalı çözüm: D0 için türetme (kuru, yatay yüzey, sürşarjsız)", en: "Closed form for D0" },
    steps: [
      { text: { tr: "Aktif basınç: p_a(z) = K_a·γ·z (z ≤ H + D0). Pasif basınç: p_p(z) = K_p·γ·(z − H) (z > H). Net: p_net = p_a − p_p.", en: "Active pressure: p_a(z) = K_a·γ·z (z ≤ H + D0). Passive pressure: p_p(z) = K_p·γ·(z − H) (z > H). Net: p_net = p_a − p_p." }, expr: "p_a = K_a·γ·z,  p_p = K_p·γ·(z − H)" },
      { text: { tr: "Perde ucuna göre moment: aktif resultante K_a·γ·(H+D0)²/2 kolu (H+D0)/3; pasif resultante K_p·γ·D0²/2 kolu D0/3. Denge: aktif moment = pasif moment.", en: "Moment about the wall tip: active resultant K_a·γ·(H+D0)²/2 with arm (H+D0)/3; passive resultant K_p·γ·D0²/2 with arm D0/3. Balance: active moment = passive moment." }, expr: "K_a·γ·(H+D0)³/6 = K_p·γ·D0³/6" },
      { text: { tr: "Her iki tarafı γ/6 ile sadeleştirip (H + D0)³ / D0³ oranını yazın.", en: "Cancel γ/6 on both sides and write the ratio (H + D0)³ / D0³." }, expr: "(H + D0)³ / D0³ = K_p / K_a" },
      { text: { tr: "Kübik kök alıp D0 için çözün (r = (K_a / K_p)^(1/3)):", en: "Take the cube root and solve for D0 (r = (K_a / K_p)^(1/3)):" }, expr: "D0 = H · r / (1 − r)" },
    ],
  },
  {
    type: "worked",
    title: { tr: "Örnek 2 (konsol, kapalı çözüm): Örnek 1 ile aynı zemin ve H = 5 m", en: "Example 2: cantilever closed form, same soil, H = 5 m" },
    given: [
      { tr: "Kuru kum, γ = 18 kN/m³, φ = 30°, H = 5 m, yüzey sürşarjı yok", en: "Dry sand, γ = 18 kN/m³, φ = 30°, H = 5 m, no surface surcharge" },
      { tr: "K_a = 1/3, K_p = 3 (Örnek 1 ile aynı)", en: "K_a = 1/3, K_p = 3 (same as Example 1)" },
      { tr: "Pasif güvenlik sayısı GS = 1 (passive_factor varsayılanı)", en: "Passive safety factor GS = 1 (passive_factor default)" },
    ],
    steps: [
      { label: { tr: "Oran r", en: "Ratio r" }, expr: "r = (K_a / K_p)^(1/3) = (1/9)^(1/3)", result: "r = 0.4807" },
      { label: { tr: "Teorik gömme D0", en: "Theoretical D0" }, expr: "D0 = H · r / (1 − r) = 5 × 0.4807 / 0.5193", result: "D0 = 4.63 m" },
      { label: { tr: "Tasarım gömme D", en: "Design D" }, expr: "D = 1.2 × D0 = 1.2 × 4.63", result: "D = 5.56 m (perde boyu H + D = 10.56 m)" },
      { label: { tr: "Perde ucundaki R (magnitüd)", en: "Toe force magnitude" }, expr: "|R| = ½·γ·[K_a(H+D0)² − K_p·D0²] = ½ × 18 × [(1/3)(9.63)² − 3 × 4.63²]", result: "|R| ≈ 300.4 kN/m (işaret: negatif, bölüm 3 notuna bakın)" },
    ],
    program: {
      input: "cantilever_sheet_pile(profile: kuru kum γ 18, φ 30, bottom 40; H = 5; varsayılanlar: depth_increase = 0.2)",
      output: "D0 = 4.6293 m; D = 5.5551 m; toe_force = −300.45 kN/m; M_max = 281.25 kNm/m; z_M_max = 7.50 m; uyarı yok",
      note: {
        tr: "El hesabı ile program aynı D0 değerini (4.629 m) verir. Dikkat: R programda negatif işaretle çıkar; bu, net basıncın toplamının perde ucu tarafında pasif yönde olduğunu gösterir. Sayısal değer mutlak olarak aynıdır.",
        en: "Hand and program agree on D0 = 4.63 m.",
      },
    },
  },
  {
    type: "figure",
    id: "sp-cantilever",
    caption: {
      tr: "Konsol palplanş (Blum yöntemi): kazı tabanının üstünde aktif, altında pasif basınç. Perde ucunda moment dengesi D₀'ı verir; tasarım derinliği D = 1,2·D₀'dır.",
      en: "Cantilever sheet pile (Blum method): active pressure above the dredge line and passive pressure below it. Moment equilibrium at the toe gives D₀; the design depth is D = 1.2·D₀.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu sonucu yorumlarken iki noktaya dikkat edin. Birincisi, D0 bir denge derinliğidir ama tasarım için doğrudan kullanılmaz; programın varsayılan artışı %20’dir (D = 1.2·D0). Bu artış, zemin parametrelerinin belirsizliği ve yerleştirme toleransları için bir tampon bırakır. İkincisi, R bir kuvvet olarak perde ucuna yoğunlaştırılmış bir temsildir; gerçekte pasif direnç perde boyunca yayılır. Bu yüzden R’nin yerini ve büyüklüğü kesin bir fiziksel gerçeklik değil, hesabın bir ifadesidir. Gerçek moment dağılımı ve perde ucu davranışı, bu basit modelden farklı olabilir.", en: "Keep two points in mind when interpreting this result. First, D0 is an equilibrium depth but is not used directly for design; the program's default increase is 20% (D = 1.2·D0). This increase leaves a buffer for uncertainty in soil parameters and placement tolerances. Second, R is a representation in which passive resistance is concentrated as a force at the wall tip; in reality passive resistance spreads along the wall. For this reason the position and magnitude of R are not a precise physical reality but an expression of the calculation. The real moment distribution and wall-tip behaviour may differ from this simple model.",
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Pasif güvenlik sayısı (GS) ve gömmenin artması", en: "4. Passive safety factor GS and the effect on embedment" } },
  {
    type: "p",
    text: {
      tr: "Pasif direnç, zemin hakkında en az bilinen ve en çok değişen büyüklüklerden biridir; sürtünme açısı küçük bir hata ile ciddi biçimde değişebilir ve kazı tabanının altındaki zeminin bir kısmı zamanla kazılabilir ya da sıyrılabilir. Bu belirsizliği karşılamak için pasif basınç, bir güvenlik sayısına bölünür. Programda bu sayı passive_factor (GS) ile verilir ve pasif basınç p_pasif / GS olarak alınır. GS = 1 varsayılanı, pasif direncin tamamının kullanıldığı anlamına gelir; birçok yönetmelikte bu sayı 1.5 ya da daha büyük alınır. Hangi değerin uygun olduğunu, yerel yönetmelik ve projenin güvenlik politikası belirler; bu metin bir değer önermez.", en: "Passive resistance is one of the least known and most variable quantities of the soil; the friction angle can change seriously with a small error, and part of the soil below the excavation base may be excavated or scoured over time. To cover this uncertainty, passive pressure is divided by a safety number. In the program this number is given as passive_factor (GS), and passive pressure is taken as p_passive / GS. The default GS = 1 means the full passive resistance is used; in many codes this number is taken as 1.5 or larger. The appropriate value is set by local regulations and the project's safety policy; this text does not suggest a value.",
    },
  },
  {
    type: "formula",
    expr: "p_pasif,tasarım = p_pasif / GS      (GS ≥ 1)",
    caption: { tr: "Pasif güvenlik sayısı: pasif basıncın tamamına değil, GS’e bölünmüşüne güvenilir", en: "Passive factor" },
  },
  {
    type: "p",
    text: {
      tr: "Bu bölümde sezgi çok önemlidir: GS, pasif direncin büyüklüğünü değiştirir; D0 ile K_p arasındaki ilişki r = (K_a/K_p)^(1/3) kübik köke bağlıdır, yani pasif katsayı yarıya indiğinde gerekli gömme küçük bir oranla değil, belirgin biçimde artar. Pasif direnç yarıya indiğinde, denge için perdenin daha derine girmesi gerekir ve bu artış küçük değildir. Örnek 3’te görüleceği gibi GS = 1.5 ile D0 yaklaşık %32 artar. Bu nedenle GS değerini seçmek, yalnızca bir 'emniyet katsayısı' koymak değil, gömme derinliğini ve dolayısıyla kazı maliyetini doğrudan etkileyen bir karardır.", en: "Intuition is very important in this section: GS changes the magnitude of passive resistance. The relation between D0 and K_p, r = (K_a/K_p)^(1/3), depends on a cube root, so when the passive coefficient halves, the required embedment does not increase by a small ratio but markedly. When passive resistance halves, the wall must embed deeper for equilibrium, and this increase is not small. As will be seen in Example 3, with GS = 1.5 D0 increases by about 32%. For this reason, choosing the GS value is not merely placing a 'safety coefficient'; it is a decision that directly affects embedment depth and therefore excavation cost.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: aynı zemin, H = 5 m, GS = 1.5", en: "Example 3: same soil, H = 5 m, GS = 1.5" },
    given: [
      { tr: "Örnek 1 ile aynı: kuru kum, γ = 18, φ = 30°, K_a = 1/3, K_p = 3", en: "Same as Example 1: dry sand, γ = 18, φ = 30°, K_a = 1/3, K_p = 3" },
      { tr: "Pasif güvenlik sayısı GS = 1.5; etkin pasif katsayısı K_p,tasarım = K_p / GS = 3 / 1.5 = 2", en: "Passive safety factor GS = 1.5; effective passive coefficient K_p,design = K_p / GS = 3 / 1.5 = 2" },
    ],
    steps: [
      { label: { tr: "Oran r (GS ile)", en: "Ratio r with GS" }, expr: "r = (K_a / (K_p/GS))^(1/3) = (0.3333 / 2)^(1/3) = (1/6)^(1/3)", result: "r = 0.5503" },
      { label: { tr: "Teorik gömme D0", en: "D0 with GS" }, expr: "D0 = 5 × 0.5503 / (1 − 0.5503) = 2.7516 / 0.4497", result: "D0 = 6.12 m (Örnek 2’de 4.63 m idi)" },
      { label: { tr: "Tasarım D", en: "Design D" }, expr: "D = 1.2 × 6.12", result: "D = 7.34 m" },
      { label: { tr: "Moment: z0 (kesme sıfır)", en: "Shear-zero depth" }, expr: "z0 = H·√K_p,t / (√K_p,t − √K_a) = 5 × √2 / (√2 − √(1/3))", result: "z0 = 8.45 m (kazı tabanından 3.45 m aşağı)" },
    ],
    program: {
      input: "cantilever_sheet_pile(profile: aynı; H = 5; passive_factor = 1.5)",
      output: "D0 = 6.1190 m; D = 7.3429 m; M_max = 356.97 kNm/m; z_M_max = 8.45 m; toe_force = −303.07 kN/m",
      note: {
        tr: "El hesabı D0 = 6.12 m ve z0 = 8.45 m değerlerini programla aynı verir. M_max değeri bölüm 5’teki formülle de doğrulanabilir (357.0 kNm/m). Dikkat: programın M_max değeri D0 üzerinden hesaplanır, tasarım D üzerinden değil.",
        en: "Same D0 and z0; M_max is computed on D0.",
      },
    },
  },
  {
    type: "figure",
    id: "sp-passive-factor",
    caption: {
      tr: "Pasif güvenlik sayısı etkisi: GS = 1 (tam pasif) ile GS = 1,5 (pasif / 1,5) karşılaştırılır; daha az pasif direnç daha derin gömme gerektirir (H = 5 m: D₀ = 4,63 m → 6,12 m). Çizim şematiktir.",
      en: "Effect of the passive safety factor: GS = 1 (full passive) versus GS = 1.5 (passive / 1.5); less passive resistance needs deeper embedment (H = 5 m: D₀ = 4.63 m → 6.12 m). The drawing is schematic.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Uygulamada şu bir kontrol listesi işe yarar: önce GS = 1 ile D0’ı bulun ve sonra GS’in etkisini ayrıca görün. Eğer tasarım yönetmeliği GS’i zorunlu kılıyorsa, D0 bu değere göre yeniden hesaplanmalıdır; yalnızca sonucun üstüne %20 eklemek, GS’in etkisini karşılamaz. Ayrıca GS ile birlikte artan moment, perde kesit seçimini de etkiler. Program bu iki sonucu aynı anda verir; ama hangi GS değerinin uygun olduğu bir karardır ve mühendisin sorumluluğundadır.", en: "In practice the following checklist works: first find D0 with GS = 1, then separately see the effect of GS. If the design regulation requires GS, D0 must be recalculated based on that value; merely adding 20% to the result does not account for the effect of GS. In addition, the moment increasing with GS also affects the choice of wall section. The program gives these two results at the same time; but which GS value is appropriate is a decision and is the responsibility of the engineer.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Maksimum moment ve kesit seçimi", en: "5. Maximum moment and section selection" } },
  {
    type: "p",
    text: {
      tr: "Perde dengede olsa da içinde eğilme momenti oluşur ve bu moment, perdenin kesitini belirler. Momenti bulmak için önce kesme kuvvetini bulmak gerekir: kesme V(z), üstteki net basıncın toplamıdır. Kesme sıfır olduğu noktada moment en büyük (ya da en küçük) değerine ulaşır. Konsol perdede bu nokta kazı tabanının altındadır; ankrajlı perdede ise ankraj kuvvetinden sonra başlar. Sezgi şudur: perde, net basıncın 'yük' gibi davrandığı bir kiriş gibidir; kesme sıfıra iner, moment de tepe yapar.", en: "Even when the wall is in equilibrium, a bending moment arises inside it, and this moment determines the wall section. To find the moment, first find the shear force: shear V(z) is the sum of the net pressure above. At the point where shear is zero, the moment reaches its largest (or smallest) value. In a cantilever wall this point lies below the excavation base; in an anchored wall it starts after the anchor force. The intuition is this: the wall is like a beam on which net pressure acts as a load; shear goes to zero and the moment peaks.",
    },
  },
  {
    type: "formula",
    expr: "V(z) = ∫₀^z p_net(s) ds,    M(z) = ∫₀^z V(s) ds      (konsol, kesme sıfır olduğu derinlikte M_max)",
    caption: { tr: "Kesme ve moment tanımları; M_max, V(z0) = 0 noktasındadır", en: "Shear and moment" },
    where: [
      { tr: "Program M_max değerini D0 üzerinden hesaplar; M_max [kNm/m] ve z_M_max [m] çıktı olarak verilir", en: "The program calculates M_max from D0; M_max [kNm/m] and z_M_max [m] are given as output" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Kapalı formda konsol perdede kesme sıfırı, kazı tabanının altında z0 = H·√K_p / (√K_p − √K_a) ile bulunur. Bu ifadenin sayısal sonucu Örnek 2’de 7.50 m (kazı tabanının 2.50 m altı) çıkar. Moment bu noktada M_max = γ·(K_a·z0³ − K_p·(z0 − H)³) / 6 olur. Birimler kN/m³ × m³ = kNm/m’dir; yani programdaki M_max değeri kNm/m cinsindendir. Bu değer, perdenin her metresinde taşınması gereken en büyük eğilme momentidir.", en: "For a cantilever wall in closed form, the zero-shear point is found below the excavation base at z0 = H·√K_p / (√K_p − √K_a). The numerical result of this expression is 7.50 m (2.50 m below the excavation base) in Example 2. At this point the moment is M_max = γ·(K_a·z0³ − K_p·(z0 − H)³) / 6. Units are kN/m³ × m³ = kNm/m; that is, the M_max value in the program is in kNm/m. This value is the largest bending moment that must be carried per metre of wall.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: M_max (konsol, GS = 1)", en: "Example 4: M_max for the cantilever (GS = 1)" },
    given: [
      { tr: "Örnek 2 ile aynı: γ = 18, K_a = 1/3, K_p = 3, H = 5 m", en: "Same as Example 2: γ = 18, K_a = 1/3, K_p = 3, H = 5 m" },
    ],
    steps: [
      { label: { tr: "Kesme sıfır derinliği", en: "Shear-zero depth" }, expr: "z0 = 5 × √3 / (√3 − √(1/3)) = 8.660 / 1.1547", result: "z0 = 7.50 m" },
      { label: { tr: "Küpler", en: "Cubes" }, expr: "z0³ = 421.875;  (z0 − H)³ = 2.5³ = 15.625", result: "—" },
      { label: { tr: "Moment", en: "Moment" }, expr: "M_max = 18 × [(1/3)(421.875) − 3 × 15.625] / 6 = 18 × (140.625 − 46.875) / 6", result: "M_max = 281.25 kNm/m" },
    ],
    program: {
      input: "cantilever_sheet_pile(profile: kuru kum γ 18, φ 30; H = 5; varsayılanlar)",
      output: "M_max = 281.25 kNm/m; z_M_max = 7.50 m",
      note: {
        tr: "El hesabı ile program bu noktada aynı değeri verir. Kesit seçimi için bu moment, izin verilen gerilme ile karşılaştırılır: program allowable_stress_mpa verildiğinde S = M_max / σ_izin (cm³/m) değerini de verir.",
        en: "Hand and program agree.",
      },
    },
  },
  {
    type: "figure",
    id: "spw-moment-diagram",
    caption: {
      tr: "Konsol palplanşta kesme V ve moment M diyagramları (H = 5 m, φ′ = 30°, D₀ = 4,63 m). Kesme z = 7,50 m'de sıfırdır ve moment orada en büyüktür (M_max = 281,25 kN·m/m).",
      en: "Shear V and moment M diagrams of a cantilever sheet pile (H = 5 m, φ′ = 30°, D₀ = 4.63 m). The shear is zero at z = 7.50 m, where the moment is largest (M_max = 281.25 kN·m/m).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kesit seçimi için program, M_max değerini izin verilen eğilme gerilmesine böler ve gereken kesit modülünü cm³/m cinsinden verir: S = M_max / σ_izin. Birimlere dikkat: 1 kNm = 10⁶ N·mm ve 1 MPa = 1 N/mm²; bu nedenle S (mm³/m) = 10⁶ / σ (MPa) ve 1 cm³ = 1000 mm³ olduğundan S (cm³/m) = 1000 × M (kNm/m) / σ (MPa). Programdaki dönüşüm bu orandır. Pratik olarak yönetmelikteki gerilme sınırı ve çelik sınıfı, hangi profilin seçileceğini belirler. Bu metin profil katalogu vermez; bu seçimi yapmak için üretici tablolarına bakın.", en: "For section selection, the program divides M_max by the allowable bending stress and gives the required section modulus in cm³/m: S = M_max / σ_allow. Pay attention to units: 1 kNm = 10⁶ N·mm and 1 MPa = 1 N/mm²; therefore S (mm³/m) = 10⁶ / σ (MPa), and since 1 cm³ = 1000 mm³, S (cm³/m) = 1000 × M (kNm/m) / σ (MPa). The program's conversion is this ratio. In practice, the stress limit of the regulation and the steel grade determine which profile is selected. This text does not give a profile catalogue; consult the manufacturers' tables for this choice.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Yöntemin sınırları ve yöntem farkları", en: "6. Limits of the method and method differences" } },
  {
    type: "p",
    text: {
      tr: "Blum yöntemi denge ilkesine dayanır ama bazı şeyleri bilerek basitleştirir. Pasif direnç tek bir noktaya toplanır, zemin sonlu bir perdenin ucunda 'serbest' kabul edilir ve sızma, zemin tabakalanması ve perde–zemin sürtünmesi (duvar sürtünmesi) ihmal edilir ya da sınırlı tutulur. Ders kitaplarında, pasif basıncın perde boyunca yayıldığı ve net basınç diyagramına dayanan başka yaklaşımlar da anlatılır; bu metin o yöntemi programla karşılaştırıp doğrulamadı, bu nedenle sonuçları burada verilmez. Farklı yöntemler aynı zemin için farklı D değerleri verebilir; bu nedenle programın hangi yöntemi kullandığını bilmek ve sonucu o yöntemle yorumlamak zorunludur. Bu metin, programın yaptığını anlatır; ders kitabı yönteminin sonucunu bu metinde hesaplamadık.", en: "The Blum method rests on the equilibrium principle but deliberately simplifies some things. Passive resistance is gathered at a single point, the soil is assumed free at the tip of a finite wall, and seepage, soil layering and wall–soil friction are neglected or kept limited. Textbooks also describe other approaches in which passive pressure spreads along the wall and is based on the net pressure diagram; this text has not compared that method with the program and verified it, so its results are not given here. Different methods can give different D values for the same soil; therefore it is essential to know which method the program uses and to interpret the result with that method. This text describes what the program does; we have not calculated the textbook method's result here.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat: 'Ders kitabındaki serbest uçlu çözüm' ile programdaki Blum (toplu R kuvveti) çözümü aynı sayısal sonucu vermez. Bir öğrenci kitap yöntemiyle hesap yapıp programın D değeriyle kıyaslarsa farkı bir hata sanabilir. Önce hangi yöntemin kullanıldığını yazın, sonra karşılaştırın. Programın D0 ve M_max değerleri bu metindeki formüllerle tutarlıdır.",
      en: "Textbook and Blum solutions differ; state the method before comparing numbers.",
    },
  },
  {
    type: "figure",
    id: "spw-method-compare",
    caption: {
      tr: "Pasif direncin gösterimi: Blum yönteminde ucun altındaki tüm direnç perde ucunda tek bir R kuvvetinde toplanır; gerçekte direnç yayılıdır. D = 1,2·D₀ artışı bu farkı telafi eder (kavramsal).",
      en: "How passive resistance is represented: in Blum's method all the resistance below the toe is lumped into a single force R at the toe; in reality it is distributed. The D = 1.2·D₀ increase covers the difference (conceptual).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu yöntemin uygulanabileceği durumlar da sınırlıdır. Perdenin ucunun serbest kabul edilmesi, ucu gerçekte sınırlı ya da tamamen ankastre olan durumlarda sonucu değiştirir; zemin tabakalanması varsa (örneğin kalın bir kil tabakası) tek bir φ ve γ ile yapılan hesap eksik kalabilir. Ayrıca kazı tabanında su akımı (sızma) varsa, pasif direnç azalabilir ya da kabarma riski doğabilir; bu, yalnızca bu hesapla yakalanamaz. Son olarak, bu metinde konsol perdenin enine ve kazık etkilerini, ankraj ve kiriş tasarımını ya da perdenin stabilite kontrollerini yapmadık. Bu kontroller ayrı hesap ve uzman onayı gerektirir.", en: "The applicability of this method is also limited. Assuming the wall tip is free changes the result where the tip is actually restrained or fully fixed; if there is soil layering (for example a thick clay layer), a calculation with a single φ and γ may be incomplete. Also, if there is water flow (seepage) at the excavation base, passive resistance may decrease or a risk of heave may arise; this cannot be captured by this calculation alone. Finally, this text does not cover transverse and pile effects of the cantilever wall, anchor and beam design, or the stability checks of the wall. These checks require separate calculation and expert approval.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Özetle, bu konudan çıkarılacak temel çerçeve şudur: net basınç, moment dengesi ile gömme derinliği bulunur; pasif güvenlik sayısı ve gömme artışı gömmeyi değiştirir; M_max ise kesit seçimini belirler. Her adımda hangi kabulün kullanıldığını yazmak, sonucu bir başkasına anlatabilmek için şarttır.", en: "In summary, the basic framework to take from this topic is: net pressure, through moment balance, gives the embedment depth; the passive safety factor and embedment increase change the embedment; and M_max determines the section selection. Writing down which assumption was used at each step is essential for being able to explain the result to someone else.",
    },
  },
  {
    type: "steps",
    title: { tr: "Konsol palplanş hesabının adımları", en: "Cantilever sheet pile steps" },
    items: [
      { tr: "Kazı yüksekliği H, zemin parametreleri (γ, φ, c), yeraltı suyu ve sürşarj tanımlanır.", en: "Define the excavation height H, soil parameters (γ, φ, c), groundwater and surcharge." },
      { tr: "Aktif ve pasif basınç diyagramları (K_a, K_p) çizilir; pasif, pasif güvenlik sayısı GS ile bölünür.", en: "Draw the active and passive pressure diagrams (K_a, K_p); divide the passive pressure by the passive safety factor GS." },
      { tr: "Net basınç p_net(z) hesaplanır; işaret değiştirdiği nokta (kazı tabanının altı) belirlenir.", en: "Calculate the net pressure p_net(z); determine the point where it changes sign (below the excavation base)." },
      { tr: "Perde ucuna göre moment dengesi çözülüp D0 bulunur; tasarım D = 1.2 × D0 (varsayılan) seçilir.", en: "Solve the moment balance about the wall tip to find D0; select the design D = 1.2 × D0 (default)." },
      { tr: "R (perde ucu kuvveti) ve kesme sıfır derinliği bulunur; M_max ve z_M_max hesaplanır.", en: "Find R (wall-tip force) and the zero-shear depth; calculate M_max and z_M_max." },
      { tr: "M_max, izin verilen gerilmeyle kıyaslanıp kesit modülü S = M_max / σ_izin bulunur.", en: "Compare M_max with the allowable stress and find the section modulus S = M_max / σ_allow." },
      { tr: "Yöntem, kabuller ve program sürümü rapora yazılır; uzman kontrolü yapılır.", en: "Record the method, assumptions and program version in the report; perform expert review." },
    ],
  },
  { type: "h", text: { tr: "Sık yapılan hatalar", en: "Common mistakes" } },
  {
    type: "mistakes",
    items: [
      { tr: "H ile D’yi karıştırmak: H kazı yüksekliğidir, perde boyu H + D’dir; yalnızca D kazı tabanının altındaki gömmedir.", en: "Confusing H with D: H is the excavation height, the wall length is H + D; only D is the embedment below the excavation base." },
      { tr: "Derinlikleri zemin yüzeyinden ölçmemek: z = 0 arka zemin yüzeyidir, kazı tabanı z = H’dır.", en: "Not measuring depths from the ground surface: z = 0 is the retained-side ground surface, and the excavation base is at z = H." },
      { tr: "Pasif güvenlik sayısını (GS) pasif basınca çarpmak; GS pasif basınca bölünür, bu nedenle GS arttıkça gömme artar.", en: "Multiplying passive pressure by GS: GS is divided into passive pressure, so as GS increases the embedment increases." },
      { tr: "Tasarım gömmesi D ile teorik D0’ı karıştırmak; moment dengesinden çıkan D0’dır, programın %20 artışlı D’si ayrıdır.", en: "Confusing design embedment D with theoretical D0: D0 comes from moment balance; the program's D with the 20% increase is separate." },
      { tr: "Perde ucu kuvveti R’nin işaretini yanlış yorumlamak; program R’yi negatif verirse bu, pasif yönün baskın olduğunu gösterir, hata değildir.", en: "Misreading the sign of the wall-tip force R: if the program gives R negative, this shows that the passive direction dominates; it is not an error." },
      { tr: "M_max’ı tasarım gömmesi D üzerinden hesaplanmış sanmak; program M_max değerini D0 üzerinden hesaplar.", en: "Assuming M_max is calculated over the design embedment D; the program calculates M_max over D0." },
      { tr: "Kesme sıfır noktasını kazı tabanında aramak; konsol perdede kesme sıfırı kazı tabanının altındadır (bu örnekte 2.50 m altı).", en: "Looking for the zero-shear point at the excavation base; for a cantilever wall the zero-shear point is below the excavation base (2.50 m below in this example)." },
      { tr: "Sayı birimlerini karıştırmak: basınç kPa, kuvvet kN/m, moment kNm/m, kesit modülü cm³/m.", en: "Mixing units: pressure in kPa, force in kN/m, moment in kNm/m, section modulus in cm³/m." },
      { tr: "Yöntemi belirtmeden ders kitabı sonucuyla programı karşılaştırmak; iki yöntem farklı D verebilir.", en: "Comparing the program with the textbook result without stating the method; two methods can give different D values." },
      { tr: "Sızma ve su akımını hesaba katılmış sanmak; program sızmayı modellemez, su durgun kabul edilir.", en: "Assuming seepage and water flow are taken into account; the program does not model seepage, and water is assumed still." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "K_a = 1/3 ve K_p = 3 için (kuru kum, φ = 30°) oranı r = (K_a/K_p)^(1/3) ve D0 / H oranını bulun (H = 5 m).", en: "Compute r and D0 for Ka=1/3, Kp=3, H=5." },
        a: { tr: "r = (1/9)^(1/3) ≈ 0.4807; D0 = H·r/(1 − r) = 5 × 0.4807 / 0.5193 ≈ 4.63 m.", en: "r = 0.4807; D0 = 4.63 m." },
      },
      {
        q: { tr: "Örnek 1 için tasarım gömme D kaç metredir (varsayılan artış 0.20)?", en: "Design embedment D for example 1 with default increase 0.2?" },
        a: { tr: "D = 1.2 × 4.63 ≈ 5.56 m; perde boyu H + D ≈ 10.56 m.", en: "D = 5.56 m." },
      },
      {
        q: { tr: "GS = 1.5 ile K_p,t = K_p / GS nedir (K_p = 3)?", en: "K_p,t for GS = 1.5 with K_p = 3?" },
        a: { tr: "K_p,t = 3 / 1.5 = 2.", en: "2." },
      },
      {
        q: { tr: "GS = 1.5 ile D0 kaç metre çıkar (H = 5, K_a = 1/3)?", en: "D0 for GS = 1.5, H = 5?" },
        a: { tr: "r = (1/3 / 2)^(1/3) = (1/6)^(1/3) ≈ 0.5503; D0 = 5 × 0.5503 / 0.4497 ≈ 6.12 m. Örnek 2’ye göre %32 artış.", en: "D0 = 6.12 m." },
      },
      {
        q: { tr: "Konsol perdede kesme sıfır derinliği z0 = H·√K_p / (√K_p − √K_a) ile bulunur. K_a = 1/3, K_p = 3, H = 5 için z0 kaçtır?", en: "z0 for Ka=1/3, Kp=3, H=5?" },
        a: { tr: "z0 = 5 × 1.7321 / (1.7321 − 0.5774) = 8.660 / 1.1547 ≈ 7.50 m (kazı tabanının 2.50 m altı).", en: "z0 = 7.50 m." },
      },
      {
        q: { tr: "Örnek 1 zemininde M_max = γ·(K_a·z0³ − K_p·(z0 − H)³)/6 formülünü kullanarak M_max değerini bulun.", en: "Compute M_max for example 1 using the formula." },
        a: { tr: "M_max = 18 × (421.875/3 − 3 × 15.625) / 6 = 18 × (140.625 − 46.875) / 6 = 281.25 kNm/m. Program da 281.25 verir.", en: "M_max = 281.25 kNm/m." },
      },
      {
        q: { tr: "Net basınç bir derinlikte negatifse bu ne anlama gelir?", en: "What does negative net pressure mean?" },
        a: { tr: "Pasif basınç aktif basıncı geçmiştir; o derinlikte zemin perdeyi kazıya doğru değil, kazı yönünün tersine iter. Kazı tabanının altında beklenen durumdur.", en: "Passive exceeds active there." },
      },
      {
        q: { tr: "Programda R negatif çıktığında bu bir hata mıdır?", en: "Is negative R an error?" },
        a: { tr: "Hayır. Negatif işaret, net basınç toplamının pasif yönde olduğunu gösterir; mutlak değer denge kuvvetinin büyüklüğüdür. Örnek 2’de |R| ≈ 300.4 kN/m.", en: "No; sign shows direction." },
      },
      {
        q: { tr: "Bir öğrenci D = 5.56 m için M_max’ı programdan okuyup kesit seçiyor. Ne yanlıştır?", en: "A student reads M_max for D = 5.56. What is wrong?" },
        a: { tr: "Program M_max’ı D0 üzerinden hesaplar. Tasarım derinliği D kullanılarak M_max değerinin doğrulanması gerekir; bu, mühendisin kontrolüdür.", en: "M_max is on D0, not D." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Palplanş", en: "Sheet pile" }, def: { tr: "Kazı kenarını tutmak için yere çakılan ya da indirilen ince uzun perde; hesap birim metre (kN/m, kNm/m) üzerinden yapılır.", en: "A thin, long wall driven into or lowered into the ground to hold the excavation edge; the calculation is done per unit metre (kN/m, kNm/m)." } },
      { term: { tr: "Konsol palplanş", en: "Cantilever sheet pile" }, def: { tr: "Üst ucu serbest, herhangi bir ankraj ya da iç destek olmayan palplanş; dengeyi yalnızca gömme kısmındaki pasif direnç sağlar.", en: "A sheet pile with a free top and no anchor or internal support; equilibrium is provided only by passive resistance in the embedded part." } },
      { term: { tr: "Kazı tabanı (dredge line)", en: "Dredge line" }, def: { tr: "Ön tarafta zeminin kazıldığı seviye; derinlik olarak z = H ile gösterilir.", en: "The level on the front side to which soil is excavated; expressed as depth z = H." } },
      { term: { tr: "Kazı yüksekliği (H)", en: "Retained height" }, def: { tr: "Arka zemin yüzeyi ile kazı tabanı arasındaki yükseklik [m].", en: "Height [m] between the back ground surface and the excavation base." } },
      { term: { tr: "Gömme derinliği (D)", en: "Embedment" }, def: { tr: "Kazı tabanının altında perdenin zemine giren kısmının boyu [m]; tasarım değeri D0’dan büyüktür.", en: "Length [m] of the part of the wall entering the soil below the excavation base; the design value is larger than D0." } },
      { term: { tr: "Teorik gömme (D0)", en: "Theoretical embedment" }, def: { tr: "Moment dengesinden çıkan gömme derinliği [m]; tasarım için artırılır.", en: "Embedment depth [m] found from moment balance; increased for design." } },
      { term: { tr: "Aktif basınç", en: "Active pressure" }, def: { tr: "Arka zeminin perdeyi kazıya doğru iten basıncı [kPa]; K_a·(σ'_v + q) + su basıncı.", en: "Pressure [kPa] of the back soil pushing the wall toward the excavation; K_a·(σ'_v + q) + water pressure." } },
      { term: { tr: "Pasif basınç", en: "Passive pressure" }, def: { tr: "Kazı tabanının altındaki zeminin perdeye karşı gösterdiği direnç [kPa]; K_p·σ'_v + su basıncı.", en: "Resistance [kPa] that the soil below the excavation base offers against the wall; K_p·σ'_v + water pressure." } },
      { term: { tr: "Net basınç (p_net)", en: "Net pressure" }, def: { tr: "Aktif basınç ile pasif basıncın farkı [kPa]; pozitif ise perdeyi kazıya doğru iter.", en: "Difference [kPa] between active and passive pressure; if positive, it pushes the wall toward the excavation." } },
      { term: { tr: "Rankine katsayıları (K_a, K_p)", en: "Rankine coefficients" }, def: { tr: "Yatay yüzey için aktif ve pasif yanal basınç katsayıları; K_a = tan²(45° − φ/2), K_p = tan²(45° + φ/2).", en: "Active and passive lateral earth pressure coefficients for a horizontal surface; K_a = tan²(45° − φ/2), K_p = tan²(45° + φ/2)." } },
      { term: { tr: "Pasif güvenlik sayısı (GS)", en: "Passive factor" }, def: { tr: "Pasif basıncın bölündüğü güvenlik sayısı; program passive_factor olarak alır, varsayılanı 1’dir.", en: "Safety factor by which passive pressure is divided; the program takes it as passive_factor, default 1." } },
      { term: { tr: "Blum yöntemi", en: "Blum method" }, def: { tr: "Pasif direnci perde ucunda tek bir kuvvet olarak temsil eden ve moment dengesiyle gömmeyi bulan yaklaşım.", en: "An approach that represents passive resistance as a single force at the wall tip and finds the embedment by moment balance." } },
      { term: { tr: "Perde ucu kuvveti (R)", en: "Toe force" }, def: { tr: "Net basınçların toplamı; Blum modelinde perde ucuna yoğunlaştırılmış denge kuvveti [kN/m]. Programda işareti yön bilgisi taşır.", en: "Sum of net pressures; in the Blum model, the equilibrium force concentrated at the wall tip [kN/m]. In the program its sign carries direction information." } },
      { term: { tr: "Kesme kuvveti (V)", en: "Shear force" }, def: { tr: "Bir derinliğin üstündeki net basınçların toplamı [kN/m]; sıfır olduğu yerde moment tepe yapar.", en: "Sum of net pressures above a depth [kN/m]; the moment peaks where this is zero." } },
      { term: { tr: "Eğilme momenti (M)", en: "Bending moment" }, def: { tr: "Perdede oluşan iç moment [kNm/m]; kesit seçiminde kullanılan en büyük değeri M_max’tır.", en: "Internal bending moment in the wall [kNm/m]; the largest value, used in section selection, is M_max." } },
      { term: { tr: "Kesit modülü (S)", en: "Section modulus" }, def: { tr: "Perde kesitinin eğilme direnci [cm³/m]; S = M_max / σ_izin ile bulunur.", en: "Bending resistance of the wall section [cm³/m]; found as S = M_max / σ_allow." } },
      { term: { tr: "Serbest zemin desteği", en: "Free earth support" }, def: { tr: "Perde ucunun dönebildiği (ucun sabitlenmediği) kabul; ankrajlı palplanşta kullanılır, bkz. ankraj konusu.", en: "Assumption that the wall top can rotate (not fixed); used for anchored sheet piles, see the anchor topic." } },
      { term: { tr: "Sürşarj (q)", en: "Surcharge" }, def: { tr: "Zemin yüzeyindeki dış yük [kPa]; aktif basınca K_a·q olarak eklenir.", en: "External load on the ground surface [kPa]; added to active pressure as K_a·q." } },
      { term: { tr: "Yeraltı suyu seviyesi (GWT)", en: "Groundwater table" }, def: { tr: "Boşluk suyu basıncının atmosfer basıncına eşit olduğu seviye; arka ve ön su basıncını belirler.", en: "Level at which pore water pressure equals atmospheric pressure; determines back and front water pressure." } },
      { term: { tr: "Batık birim ağırlık (γ')", en: "Submerged unit weight" }, def: { tr: "Su altındaki zeminin efektif birim ağırlığı [kN/m³]; γ' = γ_sat − γ_w.", en: "Effective unit weight of soil under water [kN/m³]; γ' = γ_sat − γ_w." } },
      { term: { tr: "Sızma (seepage)", en: "Seepage" }, def: { tr: "Suyun zemin içinde akması; bu programda modellenmez, su durgun kabul edilir.", en: "Flow of water through the soil; not modelled in this program, water is assumed still." } },
      { term: { tr: "Denge (moment dengesi)", en: "Equilibrium" }, def: { tr: "Perde ucuna göre momentlerin toplamının sıfır olması; D0’ı belirleyen ana koşul.", en: "Sum of moments about the wall tip being zero; the main condition that determines D0." } },
      { term: { tr: "Ankrajlı palplanş", en: "Anchored sheet pile" }, def: { tr: "Üst bölgesinde ankraj bulunan palplanş; ayrıntılı konu ankraj bölümündedir.", en: "Sheet pile with an anchor in its upper zone; the detailed topic is in the anchor section." } },
    ],
  },
  {
    type: "reading",
    items: [
      "USS Steel Sheet Piling Design Manual (United States Steel). Konsol ve ankrajlı palplanş yöntemleri; doğrulanmadı, bölüm ve sayfa bu metinde yazılmadı.",
      "USACE EM 1110-2-2504 (31 Mart 1994), Design of Sheet Pile Walls. Künye DTIC kaydından doğrulandı; pasif GS (Bölüm 5-2d, Tablo 5-1) Umut'un sağladığı metne göre kontrol edildi.",
      "Ebeling, R.M. ve Morrison, E.E. (1992/1993). The seismic design of waterfront retaining structures. Technical Report ITL-92-11, USAE WES (NCEL TR-939). Rapor künyesi DTIC kaydından doğrulandı; içerik ve bölüm teyit edilmedi.",
      "Das, B.M., Principles of Foundation Engineering, istinat yapıları ve palplanş bölümü; doğrulanmadı.",
      "ODTÜ İnşaat Mühendisliği CE366 ders notları (zemin mühendisliği ders çözümleri); doğrulanmadı.",
    ],
  },
];
