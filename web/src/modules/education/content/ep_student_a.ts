import type { Block } from "./types";

export const partA: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Yanal toprak basıncı neden önemli", en: "1. Why lateral earth pressure matters" } },
  {
    type: "p",
    text: {
      tr: "Bir bodrum perdesini, bir iksayı ya da bir istinat duvarını düşünün. Duvarın bir yüzünde zemin vardır, öbür yüzünde boşluk ya da daha az zemin bulunur. Zemin, kendi ağırlığı nedeniyle yalnız aşağı doğru değil, yanlara da itme yapar; kum yığınının bir yana doğru yayılmaya çalışması gibi düşünülebilir. Duvar bu itmeyi taşımak zorundadır: ya kendi ağırlığıyla, ya zemine saplanan bir ankrajla, ya da kazı tarafındaki pasif zemin direnciyle. Mühendisin sorusu şudur: duvara toplam ne kadar yatay kuvvet gelir, bu kuvvet hangi yükseklikte etki eder ve duvar bu kuvveti devrilmeden ve kaymadan taşır mı? Bu sorunun cevabı, zeminin her derinlikteki yatay gerilmesini bilmekle başlar.", en: "Consider a basement wall, an excavation support or a retaining wall. One face of the wall is in contact with soil, while the other face has an open space or less soil. The soil pushes not only downward because of its own weight but also sideways; it can be thought of as a pile of sand trying to spread outward. The wall must carry this push: with its own weight, with an anchor fixed into the ground, or with the passive soil resistance on the excavation side. The engineer's question is this: how much total horizontal force reaches the wall, at what height does it act, and does the wall carry it without overturning or sliding? The answer begins with knowing the horizontal stress in the soil at every depth.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Gerilme (σ), bir kesit üzerindeki kuvvetin o kesitin alanına bölümüdür ve birimi kPa = kN/m² dir. Günlük bir örnek: bir kişi ayakkabısıyla yere basarsa ağırlığı taban alanına yayılır; aynı kişi kar kayakla durursa aynı ağırlık daha geniş bir alana dağılır ve basınç azalır. Zeminde yatay bir düzlemde, o derinliğin üstündeki tüm zemin ağırlığı düşey gerilmeyi oluşturur: σ_v = γ·z. Burada γ birim hacim ağırlığıdır [kN/m³], z yüzeyden derinliktir [m]. Birimleri kontrol edin: kN/m³ × m = kN/m² = kPa. Yani γ = 18 kN/m³ olan bir zeminde 5 m derinlikte σ_v = 18 × 5 = 90 kPa olur. Bu, toplam düşey gerilmedir.", en: "Stress (σ) is the force on a section divided by the area of that section, and its unit is kPa = kN/m². An everyday example: when a person stands on the ground in shoes, their weight spreads over the sole area; if the same person stands on skis, the same weight is spread over a wider area and the pressure drops. On a horizontal plane in soil, the whole weight of the soil above that depth produces the vertical stress: σ_v = γ·z. Here γ is the unit weight [kN/m³] and z is the depth below the surface [m]. Check the units: kN/m³ × m = kN/m² = kPa. So in soil with γ = 18 kN/m³, at a depth of 5 m, σ_v = 18 × 5 = 90 kPa. This is the total vertical stress.",
    },
  },
  {
    type: "figure",
    id: "ep-rankine-diagram",
    caption: {
      tr: "H = 5 m, γ = 18 kN/m³, φ′ = 30° ve q = 10 kPa için Rankine aktif basınç diyagramı: yüzeyde 3,33 kPa (sürşarj), tabanda 33,33 kPa. Kuvvet P₁ = 16,67 ve P₂ = 75,0 kN/m, toplam P_a = 91,67 kN/m; bileşke tabandan 1,82 m yukarıdadır.",
      en: "Rankine active pressure diagram for H = 5 m, γ = 18 kN/m³, φ′ = 30° and q = 10 kPa: 3.33 kPa at the surface (surcharge) and 33.33 kPa at the base. The forces are P₁ = 16.67 and P₂ = 75.0 kN/m, total P_a = 91.67 kN/m, acting 1.82 m above the base.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Toprak taneleri birbirine temas ederek yükü taşır. Bu temas kuvvetlerinin taşıdığı kısım etkin gerilme (σ') olarak adlandırılır; boşluktaki su basıncı u ise toplam gerilmenin bir kısmını taşır ama zemin tanelerinin birbirini itmesine katkı vermez. Terzaghi ilkesine göre σ'_v = σ_v − u. Yeraltı suyu seviyesinin altında hidrostatik basınç u = γ_w·(z − z_w) ile verilir; burada γ_w = 9.81 kN/m³ ve z_w su seviyesinin derinliğidir. Zeminin direncini ve deformasyonunu yöneten büyüklük efektif gerilmedir, bu yüzden yanal basınç hesabı efektif gerilme üzerinden yapılır ve su basıncı ayrıca eklenir. Efektif gerilmeyi toplam gerilmeden su basıncını çıkararak bulursunuz. Toplam ve efektif gerilmeyi karıştırmak, öğrencilerin en sık yaptığı hatalardan biridir.", en: "Soil grains carry the load by touching each other. The part of the load carried by these contact forces is called the effective stress (σ'). The water pressure u in the pore spaces carries part of the total stress, but it does not contribute to pressing the grains against each other. According to Terzaghi's principle, σ'_v = σ_v − u. Below the groundwater level the hydrostatic pressure is u = γ_w·(z − z_w), where γ_w = 9.81 kN/m³ and z_w is the depth of the water table. The quantity that governs the strength and deformation of the soil is the effective stress; therefore the lateral pressure is calculated from the effective stress, and the water pressure is added separately. You find the effective stress by subtracting the water pressure from the total stress. Confusing total and effective stress is one of the most common mistakes students make.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı: σ_v = γ·z ifadesi, yatay yüzeyli, homojen ya da tabaka tabaka sabit γ'lı bir zemin için geçerlidir. Sıkışma geçmişi (aşırı konsolidasyon, eski bir kazı, yüklenmiş ve kaldırılmış bir tabaka) ya da yerel yüzey yükleri bu basit ifadeyi değiştirebilir. GeoTek'in stresses.py dosyası, tabakalı γ değerleri ve tek bir yeraltı suyu seviyesi ile hidrostatik düşey gerilmeyi hesaplar; sıkışma geçmişini modellemez. Gerçek bir projede bu varsayımların her biri zemin raporuyla doğrulanmalıdır.", en: "Limit of the method: the expression σ_v = γ·z is valid for a horizontal ground surface with homogeneous soil, or with a constant γ in each layer. Stress history (overconsolidation, a previous excavation, a layer that was loaded and then unloaded) or local surface loads can change this simple expression. The stresses.py file in GeoTek computes the hydrostatic vertical stress with layered γ values and a single groundwater level; it does not model stress history. On a real project, each of these assumptions must be verified against the soil report.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Üç gerilme durumu: sükunet, aktif ve pasif", en: "2. Three stress states: at rest, active and passive" } },
  {
    type: "p",
    text: {
      tr: "Duvarın arkasındaki zemin üç durumdan birinde olabilir. Sükunet durumunda (at rest) duvar hiç hareket etmez; zemin olduğu gibi yerinde durur ve yatay gerilme σ'_h = K_0·σ'_v olur. K_0 = 1 − sin φ' (Jaky ampirik ilişkisi, normal konsolide zemin için) olup φ' = 30° için K_0 = 0.5 çıkar. Bu, yanlardan kısıtlanmış bir kutudaki malzemeye benzer. Duvar zeminden uzaklaşırsa yatay gerilme düşer, zemin 'gevşer' ve yanal basınç katsayısı K_a değerine iner; buna aktif durum denir. Duvar zemine doğru itilirse yatay gerilme artar, zemin sıkışır ve K_p değerine çıkar; buna pasif durum denir. Üç durumun birimi de birimsiz bir katsayıdır ve zemin özelliğinden (φ') ve duvarın yaptığı harekettan belirlenir.", en: "The soil behind the wall can be in one of three states. At rest (sükunet), the wall does not move at all; the soil stays where it is and the horizontal stress is σ'_h = K_0·σ'_v. K_0 = 1 − sin φ' (Jaky's empirical relation for normally consolidated soil), so for φ' = 30° we get K_0 = 0.5. This is like a material in a box that is restrained on its sides. If the wall moves away from the soil, the horizontal stress falls, the soil 'loosens' and the lateral pressure coefficient drops to K_a; this is the active state. If the wall is pushed into the soil, the horizontal stress rises, the soil is compressed and the coefficient reaches K_p; this is the passive state. All three coefficients are dimensionless and depend on the soil property (φ') and on the movement of the wall.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu üç durumun ne kadar hareketle oluştuğu pratikte belirleyicidir. Aktif duruma geçmek için duvarın genellikle küçük bir öteleme ya da dönme yapması yeterlidir; pasif duruma ulaşmak için ise çok daha büyük bir hareket gerekir. Literatürde kum ve kil için bu hareket oranları farklı verilir; kesin yüzdeler kaynağa ve zemin tipine göre değişir, bu yüzden bu metinde sayısal bir eşik vermiyoruz. Kaynak için Das, Principles of Foundation Engineering, Bölüm 7 (toprak basıncı) ile doğrulama yapın. Kilde deformasyon zamana bağlı ilerlediği için hareket uzun sürede tamamlanabilir; kumda ise hareket daha hızlı oluşur. Bu nedenle 'duvar hareket eder mi?' sorusu hesabın başında sorulmalıdır.", en: "How much movement is needed to reach each of these states is decisive in practice. To reach the active state the wall usually needs only a small translation or rotation; reaching the passive state needs much larger movement. The literature gives different movement ratios for sand and clay, and the exact percentages depend on the source and soil type, so this text does not give a numerical threshold. For the source, verify with Das, Principles of Foundation Engineering, Chapter 7 (lateral earth pressure). In clay, deformation develops over time, so the movement may take a long time to complete; in sand it happens more quickly. For this reason, the question 'does the wall move?' must be asked at the start of the calculation.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: K_0 = 1 − sin φ' yaklaşımı normal konsolide zeminler için kullanılır; aşırı konsolide killerde gerçek K_0 daha büyük olabilir. Program sükunet katsayısını yalnız yatay arazi (β = 0) için hesaplar; eğimli dolguda β > 0 ise sükunet durumu uygulanmaz ve kod hata verir. Bu nedenle yanal basınç hesabına başlamadan önce duvarın hareket varsayımı ve arazi geometrisi açıkça yazılmalıdır.", en: "Limits: the approximation K_0 = 1 − sin φ' is used for normally consolidated soils; in overconsolidated clays the real K_0 may be larger. The program calculates the at-rest coefficient only for horizontal ground (β = 0); if the backfill is sloping with β > 0, the at-rest state is not applied and the code raises an error. Therefore the wall movement assumption and the ground geometry must be stated explicitly before the lateral pressure calculation begins.",
    },
  },
  {
    type: "figure",
    id: "ep-states-movement",
    caption: {
      tr: "Yanal basınç katsayısı K ile duvar hareketi (şematik): hareket yokken K₀ = 0,50; duvar zeminden uzaklaşırsa K küçük bir harekette K_a = 0,33'e düşer; zemine doğru itilirse K ancak büyük hareketle K_p = 3,00'a ulaşır.",
      en: "Lateral pressure coefficient K versus wall movement (schematic): K₀ = 0.50 with no movement; as the wall moves away from the soil K falls to K_a = 0.33 after a small movement; pushed into the soil K reaches K_p = 3.00 only after a large movement.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Rankine teorisi: Mohr dairesi ve Ka, Kp türetimi", en: "3. Rankine theory: Mohr circle and derivation of Ka and Kp" } },
  {
    type: "p",
    text: {
      tr: "Rankine teorisi şu varsayımlarla çalışır: duvar yüzü düşey ve pürüzsüzdür (duvar-zemin sürtünmesi δ = 0), arazi yüzeyi yataydır (β = 0) ve zemin her yerde aynı anda kırılma durumundadır. Fiziksel sezgi: kum dolu bir kutunun yan duvarı dışarı açılırsa kum, eğik bir düzlem boyunca kaymaya başlar; Rankine bu kayma düzlemlerini ve gerilmeleri düşünür. Kırılma kriteri Mohr-Coulomb'dur: τ_f = c' + σ' tan φ'. Burada τ kayma gerilmesi [kPa], σ' efektif normal gerilme [kPa], c' efektif kohezyon [kPa], φ' efektif sürtünme açısıdır [°]. Her gerilme durumu bir Mohr dairesi ile gösterilir: merkez (σ_1 + σ_3)/2, yarıçap (σ_1 − σ_3)/2 dir ve kırılma zarfına teğet olduğu anda zemin kırılmak üzeredir. Birimler hep kPa'dır, bu nedenle daire üzerindeki her nokta da kPa cinsindendir.", en: "Rankine theory works with the following assumptions: the wall face is vertical and smooth (wall-soil friction δ = 0), the ground surface is horizontal (β = 0), and the soil is at failure everywhere at the same time. Physical intuition: if the side wall of a sand-filled box opens outward, the sand starts to slide along an inclined plane; Rankine considers these slip planes and the stresses on them. The failure criterion is Mohr-Coulomb: τ_f = c' + σ' tan φ'. Here τ is the shear stress [kPa], σ' is the effective normal stress [kPa], c' is the effective cohesion [kPa] and φ' is the effective friction angle [°]. Each stress state is shown by a Mohr circle with centre (σ_1 + σ_3)/2 and radius (σ_1 − σ_3)/2; when the circle touches the failure envelope the soil is about to fail. All units are kPa, so every point on the circle is also in kPa.",
    },
  },
  { type: "figure", id: "ep-mohr-rankine", caption: { tr: "Aynı düşey gerilme (σv = 100 kPa) için iki Mohr dairesi: küçük daire aktif, büyük daire pasif kırılmadır. İkisi de c′ = 0, φ = 30° zarfına teğettir; yatay gerilme 33,3 ile 300 kPa arasında kalır.", en: "Two Mohr circles for the same vertical stress (100 kPa): small = active, large = passive failure, both tangent to the c = 0, phi = 30 deg envelope." } },
  {
    type: "derivation",
    title: { tr: "Ka ve Kp türetimi (c' = 0 ve c' ≠ 0)", en: "Derivation of Ka and Kp (c' = 0 and c' ≠ 0)" },
    steps: [
      {
        text: { tr: "Büyük asal gerilmeyi σ_1, küçük asal gerilmeyi σ_3 alın. Aktif durumda düşey gerilme büyük asal gerilmedir, yatay gerilme azalarak küçük asal gerilmeye dönüşür.", en: "Take the major principal stress as σ_1 and the minor as σ_3. In the active state the vertical stress is the major principal stress." },
        expr: "σ_1 = σ_v ,   σ_3 = σ_h",
      },
      {
        text: { tr: "Dairenin merkezi x_0 = (σ_1 + σ_3)/2 ve yarıçapı R = (σ_1 − σ_3)/2 dir. Kırılma zarfı daireye teğet olduğu için merkezin zarfa uzaklığı R'ye eşittir; bu geometrik koşul sinφ' ile yazılır.", en: "Tangency of the envelope gives the geometric condition." },
        expr: "sin φ' = R / (x_0 + c' cot φ')",
      },
      {
        text: { tr: "Her iki tarafı (x_0 + c' cot φ') ile çarpıp x_0 ve R'yi yerine koyun. Her terim kPa cinsindendir.", en: "Multiply out and substitute the centre and radius." },
        expr: "sin φ' (σ_1 + σ_3) + 2c' cos φ' = σ_1 − σ_3",
      },
      {
        text: { tr: "σ_1 terimlerini bir tarafta toplayın.", en: "Collect the σ_1 terms." },
        expr: "σ_1 (1 − sin φ') = σ_3 (1 + sin φ') + 2c' cos φ'",
      },
      {
        text: { tr: "(1 + sin φ') ile bölün ve σ_3 = σ_h için çözün. Trigonometrik özdeşliklerle (1 − sin φ')/(1 + sin φ') = tan²(45° − φ'/2) ve cos φ'/(1 + sin φ') = tan(45° − φ'/2) = √K_a olduğu görülür.", en: "Divide and use the identities." },
        expr: "σ_h = K_a · σ_v − 2c' √K_a ,   K_a = tan²(45° − φ'/2)",
      },
      {
        text: { tr: "Pasif durumda rolleri değiştirin: yatay gerilme büyük asal gerilme olur (σ_1 = σ_h, σ_3 = σ_v). Aynı adımlar yanal basınç için verir:", en: "Passive: swap the roles of σ_h and σ_v." },
        expr: "σ_h = K_p · σ_v + 2c' √K_p ,   K_p = tan²(45° + φ'/2) = 1 / K_a",
      },
      {
        text: { tr: "Kontrol: c' = 0 ve φ' = 30° için K_a = 1/3 ≈ 0.3333 ve K_p = 3 çıkar; K_a · K_p = 1 olmalıdır. Sayı yanlışsa işaret ya da 45° ± φ'/2 seçimini kontrol edin.", en: "Check: φ' = 30 gives Ka = 1/3 and Kp = 3." },
        expr: "K_a · K_p = 1  (c' = 0)",
      },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Sonuç olarak Rankine, düşey gerilmeyi yatay gerilmeye çeviren bir katsayı verir. Derinlik arttıkça σ_v = γ·z doğrusal artar, dolayısıyla σ_h = K_a·γ·z de doğrusal artar; c' = 0 ve q = 0 iken diyagram bir üçgendir. Toplam itme kuvveti bu üçgenin alanıdır: P_a = ½ K_a γ H² [kN/m]. Üçgenin ağırlık merkezi tabandan H/3 yukarıdadır, bu nedenle devrilme momenti P_a·H/3 kadar hesaplanır. Birimler: K_a birimsiz, γ kN/m³, H m, yani P_a kN/m (metre başına kuvvet) olur. Bu, kPa (basınç) ile kN/m (kuvvet/uzunluk) arasındaki farkı akılda tutmanız için iyi bir kontroldür.", en: "In conclusion, Rankine gives a coefficient that converts vertical stress into horizontal stress. As depth increases, σ_v = γ·z increases linearly, so σ_h = K_a·γ·z also increases linearly; with c' = 0 and q = 0 the diagram is a triangle. The total thrust is the area of this triangle: P_a = ½ K_a γ H² [kN/m]. The centroid of the triangle lies H/3 above the base, so the overturning moment is P_a·H/3. Units: K_a is dimensionless, γ is in kN/m³ and H in m, so P_a is in kN/m (force per metre). This is a useful check for keeping in mind the difference between kPa (pressure) and kN/m (force per unit length).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı: Rankine duvar sürtünmesini sıfır kabul eder. Gerçekte duvar yüzeyi zeminle bir miktar sürtünür ve gerçek P_a biraz daha küçüktür; bu nedenle Rankine, pürüzsüz düşey duvar için pratik ve biraz muhafazakar bir yaklaşımdır. Sürtünme ve eğik duvar yüzü önemliyse Coulomb yöntemi gerekir. Programda Rankine, β ≤ φ' için eğimli arazi yüzeyini de hesaplar; β > φ' ise kod hata verir. Program ayrıca Rankine'de c' ve β birlikte varsa hata verir; c'nin atılmasına yalnız açıkça izin verildiğinde (slope_cohesion = 'ignore') ve bir uyarıyla devam eder.", en: "Limit of the method: Rankine assumes zero wall friction. In reality the wall face has some friction with the soil and the true P_a is slightly smaller; therefore Rankine is a practical and slightly conservative approach for a smooth vertical wall. If friction and an inclined wall face matter, the Coulomb method is needed. In the program, Rankine also computes a sloping ground surface for β ≤ φ'; if β > φ' the code raises an error. The program also raises an error when c' and β are both present in Rankine; c' may be dropped only when this is explicitly allowed (slope_cohesion = 'ignore'), and the calculation then continues with a warning.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: düşey duvar, kohezyonsuz zemin, sürşarjlı", en: "Example 1: vertical wall, cohesionless soil, with surcharge" },
    given: [
      { tr: "H = 5 m", en: "H = 5 m" },
      { tr: "γ = 18 kN/m³", en: "γ = 18 kN/m³" },
      { tr: "φ' = 30°, c' = 0", en: "φ' = 30°, c' = 0" },
      { tr: "q = 10 kPa (tekdüze sürşarj)", en: "q = 10 kPa (uniform surcharge)" },
      { tr: "Yatay dolgu, yeraltı suyu yok", en: "Horizontal backfill, no groundwater" },
    ],
    steps: [
      { label: { tr: "K_a", en: "K_a" }, expr: "K_a = tan²(45° − φ'/2) = tan²(30°)", result: "0.3333" },
      { label: { tr: "Üst (z = 0) düşey gerilme", en: "Top vertical stress" }, expr: "σ_v = γ·0 + q = 10", result: "10 kPa" },
      { label: { tr: "Üst yatay basınç", en: "Top lateral pressure" }, expr: "σ_h,üst = K_a · (γ·0 + q) = 0.3333 × 10", result: "3.333 kPa" },
      { label: { tr: "Taban (z = 5 m) düşey gerilme", en: "Base vertical stress" }, expr: "σ_v = γ·H + q = 18 × 5 + 10 = 100", result: "100 kPa" },
      { label: { tr: "Taban yatay basınç", en: "Base lateral pressure" }, expr: "σ_h,alt = K_a · 100 = 0.3333 × 100", result: "33.333 kPa" },
      { label: { tr: "Toplam kuvvet (yamuk alanı)", en: "Total force (trapezoid area)" }, expr: "P_a = ½ (σ_üst + σ_alt) · H = ½ (3.333 + 33.333) × 5", result: "91.667 kN/m" },
      { label: { tr: "Etki noktası (üstten)", en: "Point of action (from top)" }, expr: "z̄ = H (a + 2b) / [3 (a + b)] = 5 (3.333 + 66.667) / [3 × 36.667]", result: "3.182 m; tabandan 1.818 m" },
    ],
    program: {
      input: "H = 5 m, γ = 18 kN/m³ (γ_sat = 18), φ' = 30°, c' = 0, surcharge = 10 kPa, GWT yok (100 m), method = rankine, state = active",
      output: "K = 0.3333; σ_h(0) = 3.3333 kPa; σ_h(5) = 33.3333 kPa; Pa = 91.6667 kN/m; resultant z = 3.1818 m (üstten), 1.8182 m (tabandan); uyarı yok",
      note: {
        tr: "Program elle hesapla aynı sonucu verdi; fark yok. Program sürşarjı (q) düşey gerilmeye ekleyip K ile çarpar, dolayısıyla K·q bileşeni derinlikle sabit kalır.",
        en: "The program agrees with the hand calculation.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Kohezyonlu zemin: −2c√Ka, çekme çatlağı ve etkin basınç dağılımı", en: "4. Cohesive soil: the −2c√Ka term, tension crack and effective pressure distribution" } },
  {
    type: "p",
    text: {
      tr: "Kil gibi kohezyonlu zeminde taneler arasında çekim (c') vardır; bu, zeminin kendi kendini tutabilmesinin nedenidir. Duvar açısından bu ek direnç aktif durumda yanal basıncı azaltır: σ_h = K_a·σ_v − 2c'√K_a. Sezgi: kil bir yapıştırıcı gibi davranır ve duvarı zemin 'çeker' gibidir. Bu düşüş yüzeye yakın derinliklerde yanal gerilmeyi sıfırın altına, yani çekme bölgesine indirebilir. Gerçek zemin çekme gerilmesini taşıyamaz; yüzeyde kil kendiliğinden çatlar. Bu çatlağın derinliği z_0, yanal gerilmenin sıfır olduğu derinliktir ve q = 0 için z_0 = 2c'/(γ√K_a) ile verilir. Birimler: c' kPa, γ kN/m³, bu nedenle z_0 metre çıkar.", en: "In cohesive soil such as clay there is attraction between the grains (c'); this is why the soil can hold itself up. For the wall, this extra resistance reduces the lateral pressure in the active state: σ_h = K_a·σ_v − 2c'√K_a. Intuition: clay acts like glue, and it is as if the soil 'pulls' the wall. This reduction can push the lateral stress below zero near the surface, into a tension zone. Real soil cannot carry tensile stress, so the clay cracks at the surface. The depth of this crack, z_0, is the depth at which the lateral stress becomes zero; for q = 0 it is given by z_0 = 2c'/(γ√K_a). Units: c' is in kPa and γ in kN/m³, so z_0 comes out in metres.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Çatlak derinliğinin altında yanal basınç sıfırdan başlayıp doğrusal artar; etkin basınç dağılımı bir üçgendir ama tepesi yüzeyde değil, z_0 derinliğindedir. Toplam kuvvet P_a = ½ (H − z_0)·σ_h(H) ile hesaplanır ve etki noktası üçgenin ağırlık merkezidir: taban tarafından (H − z_0)/3 yukarıda. Eğer q > 0 ise z_0 = (2c'/√K_a − q)/γ olur; yani sürşarj çatlağı kısaltır. Uygulamada çatlağın suyla dolması yaygındır ve bu, ek bir su kuvveti yaratır: ½ γ_w z_0² [kN/m]. Bu ek kuvvet 'çatlak suyu' olarak anılır ve kohezyonlu duvar tasarımında önemlidir.", en: "Below the crack depth the lateral pressure starts from zero and increases linearly; the effective pressure distribution is a triangle whose apex is not at the surface but at depth z_0. The total force is P_a = ½ (H − z_0)·σ_h(H), and its line of action is the centroid of the triangle, (H − z_0)/3 above the base. If q > 0 then z_0 = (2c'/√K_a − q)/γ; in other words, the surcharge shortens the crack. In practice it is common for the crack to fill with water, and this produces an additional water force: ½ γ_w z_0² [kN/m]. This extra force is called 'crack water' and it is important in the design of cohesive walls.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: bu basit çatlak modeli, çekme bölgesinin hiç yük taşımadığını ve çatlağın açık kaldığını varsayar. Gerçekte çatlak kapanabilir, su ile dolabilir ya da zamanla genişleyebilir. Ayrıca kil için c' ve φ' değerleri drenajlı (efektif) analiz içindir; drenajsız kil (φ = 0, s_u) başka bir yaklaşımdır ve bu bölümün kapsamı dışındadır. GeoTek programında çekme bölgesinde basınç sıfıra eşitlenir ve bir uyarı verilir; çatlak suyu terimi kodda yer almaz, bu nedenle su dolu çatlak durumu ayrıca değerlendirilmelidir.", en: "Limits: this simple crack model assumes that the tension zone carries no load and that the crack stays open. In reality the crack may close, fill with water or widen over time. Also, the c' and φ' values for clay are for drained (effective) analysis; undrained clay (φ = 0, s_u) is a different approach and is outside the scope of this section. In the GeoTek program the pressure in the tension zone is set to zero and a warning is issued; the crack-water term is not in the code, so a water-filled crack must be evaluated separately.",
    },
  },
  {
    type: "figure",
    id: "ep-cohesive-crack",
    caption: {
      tr: "Kohezyonlu zeminde (c′ = 10 kPa, φ′ = 20°) aktif basınç: yüzeyden z₀ = 1,59 m'ye kadar çekme bölgesinde basınç sıfır sayılır; tabanda σh = 38,9 kPa, P_a = 85,9 kN/m.",
      en: "Active pressure in a cohesive soil (c′ = 10 kPa, φ′ = 20°): in the tension zone down to z₀ = 1.59 m the pressure is taken as zero; σh = 38.9 kPa at the base, P_a = 85.9 kN/m.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: kohezyonlu zemin, çekme çatlaklı", en: "Example 2: cohesive soil with tension crack" },
    given: [
      { tr: "H = 6 m", en: "H = 6 m" },
      { tr: "γ = 18 kN/m³", en: "γ = 18 kN/m³" },
      { tr: "φ' = 20°, c' = 10 kPa", en: "φ' = 20°, c' = 10 kPa" },
      { tr: "q = 0; yeraltı suyu yok; çatlak kuru kabul edilir", en: "q = 0; no groundwater; crack assumed dry" },
    ],
    steps: [
      { label: { tr: "K_a", en: "K_a" }, expr: "K_a = tan²(45° − 10°) = tan²(35°)", result: "0.4903 (√K_a = 0.7002)" },
      { label: { tr: "Çatlak derinliği", en: "Crack depth" }, expr: "z_0 = 2c' / (γ √K_a) = 20 / (18 × 0.7002)", result: "1.587 m" },
      { label: { tr: "Taban yatay basınç (z = 6 m)", en: "Base lateral pressure" }, expr: "σ_h = K_a γ H − 2c'√K_a = 0.4903 × 108 − 14.004", result: "38.947 kPa" },
      { label: { tr: "Toplam kuvvet (z_0 ile 6 m arası üçgen)", en: "Total force (triangle from z_0 to 6 m)" }, expr: "P_a = ½ (H − z_0) σ_h = ½ × 4.413 × 38.947", result: "85.94 kN/m" },
      { label: { tr: "Etki noktası", en: "Point of action" }, expr: "(H − z_0)/3 = 4.413/3", result: "1.471 m (tabandan); üstten 4.529 m" },
      { label: { tr: "Çatlak suyu ek kuvveti (yalnız kontrol için)", en: "Crack-water force (check only)" }, expr: "½ γ_w z_0² = ½ × 9.81 × 1.587²", result: "12.35 kN/m (programda yok)" },
    ],
    program: {
      input: "H = 6 m, γ = 18 kN/m³, φ' = 20°, c' = 10 kPa, q = 0, GWT yok (100 m), method = rankine, state = active",
      output: "K = 0.49029; σ'_h(0) = 0; σ'_h(1.5868) = 0; σ'_h(6) = 38.9472 kPa; Pa = 85.9404 kN/m; resultant z = 4.5289 m (üstten), 1.4711 m (tabandan); uyarı: 'Tension zone to 1.59 m set to zero (tension crack)'",
      note: {
        tr: "Elle ve program sonucu aynı (fark yok). Program çekme bölgesini sıfır basınçla kapatıyor ve bunu uyarıyla bildiriyor. Çatlağa su dolarsa ek ½ γ_w z_0² ≈ 12.35 kN/m kuvvet oluşur; program bu terimi eklemez, bu nedenle tasarımda ayrıca değerlendirilmelidir.",
        en: "Hand and program results agree; the crack-water force is not in the program.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Yeraltı suyu ve tabakalı zemin", en: "5. Groundwater and layered soil" } },
  {
    type: "p",
    text: {
      tr: "Su varsa iki ayrı etki vardır ve bunları birbirinden ayırmak gerekir. Birincisi zeminin kendi ağırlığıdır: su seviyesinin altında zemin kaldırma kuvveti nedeniyle hafifler; bu nedenle batık birim ağırlık γ' = γ_sat − γ_w kullanılır (birimi kN/m³). İkincisi boşluk suyunun hidrostatik basıncıdır: u = γ_w·(z − z_w) [kPa], ve bu basınç duvara ayrıca etki eder. Duvara etkiyen toplam yatay basınç şudur: σ_h,toplam = σ'_h + u. Sık hata: su basıncını da K ile çarpmak. Oysa u, K ile çarpılmaz, doğrudan eklenir; K yalnız efektif gerilme için geçerlidir.", en: "When water is present there are two separate effects that must be distinguished. The first is the soil's own weight: below the water level the soil becomes lighter because of buoyancy, so the submerged unit weight γ' = γ_sat − γ_w is used (unit kN/m³). The second is the hydrostatic pressure of the pore water: u = γ_w·(z − z_w) [kPa], and this pressure acts on the wall separately. The total horizontal pressure acting on the wall is σ_h,total = σ'_h + u. A common mistake is to multiply the water pressure by K as well. But u is not multiplied by K; it is added directly, and K applies only to the effective stress.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Tabakalı zeminde sürtünme açısı ve birim ağırlık tabakadan tabakaya değişir. Tabaka sınırında düşey toplam gerilim σ_v ve su basıncı u süreklidir: üstten gelen ağırlık aşağı taşınır, sıçramaz. Ancak K farklı olduğu için yatay efektif gerilme σ'_h sıçrar: aynı σ_v, farklı K, farklı σ'_h. Bu ayrım, grafiklerde en sık yanlış okunan noktadır. Program da her katman için kendi K ve c' değerini kullanır; bu nedenle sınırda diyagram iki farklı değerle biter ve yeni katman aynı derinlikten farklı bir değerle başlar. Su seviyesinde u sürekli kalır; σ_v'nin eğimi yukarıda γ, aşağıda γ_sat olur, efektif gerilmenin eğimi ise aşağıda γ' olur.", en: "In layered soil the friction angle and unit weight change from layer to layer. At a layer boundary the total vertical stress σ_v and the water pressure u are continuous: the weight from above is carried downward and does not jump. However, because K is different, the horizontal effective stress σ'_h jumps: the same σ_v with a different K gives a different σ'_h. This distinction is the most frequently misread point on the graphs. The program also uses its own K and c' for each layer, so at the boundary the diagram ends with one value and the new layer starts at the same depth with a different value. At the water level u stays continuous; the slope of σ_v is γ above and γ_sat below, while the slope of the effective stress below the water table is γ'.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı: tabakalar yatay ve homojen kabul edilir; mercekler ve eğimli tabaka sınırları ayrı tabaka olarak girilmediği sürece görmezden gelinir. Yeraltı suyu tek bir seviyede (GWT) kabul edilir; yağışla yükselme, kapiler zon ve sızma (akış) basıncı modellenmez. Sızma varsa hidrostatik varsayım yanıltıcıdır ve akım ağı ile ayrıca değerlendirilmelidir. Bu sınırların tümü, sonuç yorumlanırken açıkça yazılmalıdır.", en: "Limit of the method: layers are assumed horizontal and homogeneous; lenses and inclined layer boundaries are ignored unless they are entered as separate layers. The groundwater is assumed to be at a single level (GWT); rise due to rainfall, the capillary zone and seepage (flow) pressure are not modelled. If seepage is present, the hydrostatic assumption is misleading and must be evaluated with a flow net. All of these limits must be stated clearly when the result is interpreted.",
    },
  },
  {
    type: "figure",
    id: "ep-layered-water",
    caption: {
      tr: "İki katmanlı zeminde yanal basınç ve yeraltı suyu: katman sınırında K değiştiği için efektif yatay basınç sıçrar (18,0 → 22,8 kPa); su basıncı u ayrı eklenir.",
      en: "Lateral pressure in a two-layer soil with groundwater: the effective horizontal pressure jumps at the layer boundary because K changes (18.0 → 22.8 kPa); the water pressure u is added separately.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Sürşarj (yüzey yükü)", en: "6. Surcharge (surface load)" } },
  {
    type: "p",
    text: {
      tr: "Duvarın arkasındaki zemin yüzeyine uygulanan yük (bina temeli, yol trafiği, depo yükü) sürşarj olarak adlandırılır. Tekdüze yayılı yük q [kPa] ise bu yük düşey gerilmeye eklenir: σ_v = γ·z + q. Rankine ile yatay gerilmeye K_a·q olarak yansır. Önemli nokta: q derinlikle değişmez, dolayısıyla sürşarjdan gelen yanal basınç sabit bir dikdörtgen (K_a·q) olarak çizilir ve zemin ağırlığından gelen üçgenin üstüne eklenir. Toplam sürşarj kuvveti P_q = K_a·q·H [kN/m] ve etki noktası H/2 derinliktedir. Örnek: H = 5 m, q = 10 kPa ve K_a = 1/3 için K_a·q = 3.333 kPa sabit basınç, P_q = 16.67 kN/m ve bu kuvvetin etki noktası H/2 = 2.5 m (tabandan) olur.", en: "A load applied to the ground surface behind the wall (a building foundation, road traffic, a storage load) is called a surcharge. If the uniform distributed load is q [kPa], this load is added to the vertical stress: σ_v = γ·z + q. With Rankine it appears in the horizontal stress as K_a·q. Important point: q does not change with depth, so the lateral pressure from the surcharge is drawn as a constant rectangle (K_a·q) and is added on top of the triangle from the soil weight. The total surcharge force is P_q = K_a·q·H [kN/m] and its line of action is at depth H/2. Example: for H = 5 m, q = 10 kPa and K_a = 1/3, K_a·q = 3.333 kPa constant pressure, P_q = 16.67 kN/m, and its line of action is 2.5 m (H/2) from the base.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Şerit (sonsuz uzun) ya da çizgisel yük için sezgi şöyledir: yük duvara yakınsa yanal basınca etkisi büyük, uzaksa küçüktür ve etki derinlikle yayılarak zayıflar. Bu yayılma (Boussinesq ya da 2:1 yayılma gibi) bir yerleşim ve dağılım hesabı gerektirir. GeoTek'in earth_pressure modülünde bu hesap yoktur: distribution.py yalnız tekdüze bir surcharge değerini düşey gerilmeye ekler ve bunu tüm derinliklerde aynı şekilde uygular. stresses.py ise yalnız in-situ tabakalı gerilmeyi hesaplar. Bu nedenle şerit ya da çizgisel yük için ayrı bir analiz gerekir; eşdeğer tekdüze q kullanılacaksa bunun muhafazakarlığı açıkça yazılmalıdır. Eğik yüzeyde q, dik yük ise yatay izdüşüme çevrilir: q_h = q / cos β (programda surcharge_per_horizontal, basis = 'inclined').", en: "For a strip (infinitely long) or line load, the intuition is this: if the load is close to the wall its effect on the lateral pressure is large, and if it is far its effect is small; the effect weakens with depth as the load spreads. This spreading (for example Boussinesq or 2:1 spreading) requires a settlement and distribution calculation. GeoTek's earth_pressure module has no such calculation: distribution.py only adds a uniform surcharge value to the vertical stress and applies it at all depths in the same way, and stresses.py only computes the in-situ layered stress. Therefore a separate analysis is needed for a strip or line load; if an equivalent uniform q is used, its conservatism must be stated explicitly. On an inclined surface, if q is a vertical load it is converted to its horizontal projection: q_h = q / cos β (in the program surcharge_per_horizontal, basis = 'inclined').",
    },
  },
  

  // ------------------------------------------------------------------
  // 7 and 8
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "7. Sık yapılan hatalar", en: "7. Common mistakes" } },
  {
    type: "mistakes",
    items: [
      {
        tr: "Toplam ve efektif gerilmeyi karıştırmak: K ile çarpılan şeyin efektif σ'_v olması gerektiğini unutmak, sonra su basıncını da K ile çarpmak.",
        en: "Mixing total and effective stress; multiplying u by K.",
      },
      {
        tr: "Su altında γ yerine γ_sat ya da γ' karışıklığı: yeraltı suyunun altında batık birim ağırlık γ' = γ_sat − γ_w kullanılmalı; γ_sat kullanılıp ayrıca su basıncı eklenirse su iki kez sayılır.",
        en: "Using γ_sat with a separate water pressure double-counts the water.",
      },
      {
        tr: "Çekme bölgesini görmezden gelmek: kohezyonlu zeminde yüzeyde negatif yanal basınç çıkar; bunu diyagrama eksi olarak çizmek ya da z_0'ı hiç hesaplamamak yanlıştır. Çekme bölgesi sıfır kabul edilir.",
        en: "Plotting negative pressure in the tension zone instead of zeroing it.",
      },
      {
        tr: "Aktif ve pasifi karıştırmak: K_p = 3 (φ' = 30°) ile K_a = 1/3 arasında dokuz kat fark vardır. Aktif hesapta pasif katsayıyı kullanmak, duvarı olduğundan çok daha az zorlayan bir sonuç verir.",
        en: "Using Kp where Ka applies (or the reverse) changes the result by a factor of about nine at φ' = 30°.",
      },
      {
        tr: "Sükunet ile aktifi karıştırmak: duvar hareket etmiyorsa K_0 kullanılmalı; K_a, duvarın zemin yönünde yeterince hareket ettiği durumdur.",
        en: "Using K_a for a restrained wall that does not move.",
      },
      {
        tr: "Üçgenin etki noktasını H/2 almak: üçgen basınç diyagramının ağırlık merkezi tabandan H/3 yukarıdadır; H/2 kullanılırsa devrilme momenti yanlış çıkar.",
        en: "Placing the resultant of a triangle at H/2 instead of H/3 above the base.",
      },
      {
        tr: "Sürşarjı derinlikle azaltmak ya da q'yu doğrudan yatay basınca eklemek: q, düşey gerilmeye eklenir ve K ile çarpılır (K·q).",
        en: "Adding q to the lateral pressure without multiplying by K.",
      },
      {
        tr: "Tabaka sınırında yatay gerilmenin sürekli olduğunu sanmak: σ_v sürekli, ama K değiştiği için σ'_h sıçrar.",
        en: "Assuming the horizontal pressure is continuous across a layer boundary.",
      },
      {
        tr: "Birimleri karıştırmak: kPa basınç, kN/m kuvvet/uzunluk, kN/m³ birim ağırlık. P_a'nın birimi kN/m olmalı; kPa yazılırsa bir şey yanlıştır.",
        en: "Confusing kPa (pressure) with kN/m (force per metre).",
      },
    ],
  },
  { type: "h", text: { tr: "8. Kendinizi sınayın", en: "8. Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "φ' = 30° için K_a'yı hesaplayın (dört basamak).", en: "Compute K_a for φ' = 30° (four decimals)." },
        a: { tr: "K_a = tan²(45° − 15°) = tan²(30°) = (1/√3)² = 1/3 ≈ 0.3333.", en: "K_a = 1/3 ≈ 0.3333." },
      },
      {
        q: { tr: "φ' = 36° için K_a'yı hesaplayın (üç basamak).", en: "Compute K_a for φ' = 36° (three decimals)." },
        a: { tr: "K_a = tan²(45° − 18°) = tan²(27°) ≈ 0.5095² ≈ 0.260.", en: "K_a ≈ 0.260." },
      },
      {
        q: { tr: "Yeraltı suyu yok, c' = 0, φ' = 30°, γ = 17 kN/m³, H = 4 m, q = 0. Toplam P_a ve etki noktasını (tabandan) bulun.", en: "No groundwater, c' = 0, φ' = 30°, γ = 17 kN/m³, H = 4 m, q = 0. Find P_a and its height above the base." },
        a: { tr: "σ_h,alt = K_a·γ·H = (1/3)·17·4 = 22.67 kPa. P_a = ½ × 22.67 × 4 = 45.33 kN/m. Etki noktası H/3 = 1.333 m (tabandan).", en: "P_a = 45.33 kN/m at 1.333 m above the base." },
      },
      {
        q: { tr: "c' = 15 kPa, φ' = 20°, γ = 18 kN/m³, q = 0 için çekme çatlağı derinliği z_0 kaçtır?", en: "For c' = 15 kPa, φ' = 20°, γ = 18 kN/m³, q = 0, what is the crack depth z_0?" },
        a: { tr: "K_a = tan²35° = 0.4903, √K_a = 0.7002; z_0 = 2c'/(γ√K_a) = 30/(18 × 0.7002) ≈ 2.38 m.", en: "z_0 ≈ 2.38 m." },
      },
      {
        q: { tr: "Yukarıdaki (c' = 10, φ' = 20°, H = 6 m) örnekte çatlağa su dolarsa ek su kuvveti ne kadardır? (½ γ_w z_0² ile, γ_w = 9.81)", en: "In Example 2 (c' = 10, φ' = 20°, H = 6 m), what extra force comes from water filling the crack? Use ½ γ_w z_0² with γ_w = 9.81." },
        a: { tr: "z_0 = 1.587 m; ½ × 9.81 × 1.587² ≈ 12.35 kN/m. Program bu terimi eklemez.", en: "About 12.35 kN/m; the program does not include it." },
      },
      {
        q: { tr: "H = 3 m, φ' = 30°, q = 20 kPa (c' = 0, su yok) için sürşarjdan gelen P_q ve etki noktasını bulun.", en: "For H = 3 m, φ' = 30°, q = 20 kPa (c' = 0, no water), find P_q and its height above the base." },
        a: { tr: "K_a·q = (1/3)·20 = 6.667 kPa sabit; P_q = 6.667 × 3 = 20.0 kN/m; etki noktası H/2 = 1.5 m (tabandan).", en: "P_q = 20.0 kN/m at 1.5 m above the base." },
      },
      {
        q: { tr: "İki katmanlı zeminde katman sınırında hangi büyüklükler süreklidir, hangileri sıçrar?", en: "At a layer boundary, which quantities are continuous and which jump?" },
        a: { tr: "Sürekli: düşey toplam gerilme σ_v ve su basıncı u. Sıçrar: K ve dolayısıyla yatay efektif gerilme σ'_h (K farklıysa).", en: "σ_v and u are continuous; K and σ'_h jump." },
      },
      {
        q: { tr: "Neden pasif duruma ulaşmak için aktife göre çok daha büyük duvar hareketi gerekir?", en: "Why does reaching the passive state need much larger wall movement than the active state?" },
        a: { tr: "Pasif durumda zemin yanal olarak sıkıştırılır ve kayma düzlemleri zemin içinde tam mobilize olana kadar büyük bir deformasyon gerekir; K_p (= 3, φ' = 30°) K_a'dan çok daha büyüktür, yani zemin daha büyük bir direnç için kırılmanın son noktasına kadar zorlanmalıdır.", en: "Passive mobilisation needs large strain; K_p is much larger than K_a." },
      },
    ],
  },
];
