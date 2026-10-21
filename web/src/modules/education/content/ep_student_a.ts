import type { Block } from "./types";

export const partA: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Yanal toprak basıncı neden önemli", en: "1. Why lateral earth pressure matters" } },
  {
    type: "p",
    text: {
      tr: "Bir bodrum perdesini, bir iksayı ya da bir istinat duvarını düşünün. Duvarın bir yüzünde zemin vardır, öbür yüzünde boşluk ya da daha az zemin bulunur. Zemin, kendi ağırlığı nedeniyle yalnız aşağı doğru değil, yanlara da itme yapar; kum yığınının bir yana doğru yayılmaya çalışması gibi düşünülebilir. Duvar bu itmeyi taşımak zorundadır: ya kendi ağırlığıyla, ya zemine saplanan bir ankrajla, ya da kazı tarafındaki pasif zemin direnciyle. Mühendisin sorusu şudur: duvara toplam ne kadar yatay kuvvet gelir, bu kuvvet hangi yükseklikte etki eder ve duvar bu kuvveti devrilmeden ve kaymadan taşır mı? Bu sorunun cevabı, zeminin her derinlikteki yatay gerilmesini bilmekle başlar.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Gerilme (σ), bir kesit üzerindeki kuvvetin o kesitin alanına bölümüdür ve birimi kPa = kN/m² dir. Günlük bir örnek: bir kişi ayakkabısıyla yere basarsa ağırlığı taban alanına yayılır; aynı kişi kar kayakla durursa aynı ağırlık daha geniş bir alana dağılır ve basınç azalır. Zeminde yatay bir düzlemde, o derinliğin üstündeki tüm zemin ağırlığı düşey gerilmeyi oluşturur: σ_v = γ·z. Burada γ birim hacim ağırlığıdır [kN/m³], z yüzeyden derinliktir [m]. Birimleri kontrol edin: kN/m³ × m = kN/m² = kPa. Yani γ = 18 kN/m³ olan bir zeminde 5 m derinlikte σ_v = 18 × 5 = 90 kPa olur. Bu, toplam düşey gerilmedir.",
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
      tr: "Toprak taneleri birbirine temas ederek yükü taşır. Bu temas kuvvetlerinin taşıdığı kısım etkin gerilme (σ') olarak adlandırılır; boşluktaki su basıncı u ise toplam gerilmenin bir kısmını taşır ama zemin tanelerinin birbirini itmesine katkı vermez. Terzaghi ilkesine göre σ'_v = σ_v − u. Yeraltı suyu seviyesinin altında hidrostatik basınç u = γ_w·(z − z_w) ile verilir; burada γ_w = 9.81 kN/m³ ve z_w su seviyesinin derinliğidir. Zeminin direncini ve deformasyonunu yöneten büyüklük efektif gerilmedir, bu yüzden yanal basınç hesabı efektif gerilme üzerinden yapılır ve su basıncı ayrıca eklenir. Efektif gerilmeyi toplam gerilmeden su basıncını çıkararak bulursunuz. Toplam ve efektif gerilmeyi karıştırmak, öğrencilerin en sık yaptığı hatalardan biridir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı: σ_v = γ·z ifadesi, yatay yüzeyli, homojen ya da tabaka tabaka sabit γ'lı bir zemin için geçerlidir. Sıkışma geçmişi (aşırı konsolidasyon, eski bir kazı, yüklenmiş ve kaldırılmış bir tabaka) ya da yerel yüzey yükleri bu basit ifadeyi değiştirebilir. GeoTek'in stresses.py dosyası, tabakalı γ değerleri ve tek bir yeraltı suyu seviyesi ile hidrostatik düşey gerilmeyi hesaplar; sıkışma geçmişini modellemez. Gerçek bir projede bu varsayımların her biri zemin raporuyla doğrulanmalıdır.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Üç gerilme durumu: sükunet, aktif ve pasif", en: "2. Three stress states: at rest, active and passive" } },
  {
    type: "p",
    text: {
      tr: "Duvarın arkasındaki zemin üç durumdan birinde olabilir. Sükunet durumunda (at rest) duvar hiç hareket etmez; zemin olduğu gibi yerinde durur ve yatay gerilme σ'_h = K_0·σ'_v olur. K_0 = 1 − sin φ' (Jaky ampirik ilişkisi, normal konsolide zemin için) olup φ' = 30° için K_0 = 0.5 çıkar. Bu, yanlardan kısıtlanmış bir kutudaki malzemeye benzer. Duvar zeminden uzaklaşırsa yatay gerilme düşer, zemin 'gevşer' ve yanal basınç katsayısı K_a değerine iner; buna aktif durum denir. Duvar zemine doğru itilirse yatay gerilme artar, zemin sıkışır ve K_p değerine çıkar; buna pasif durum denir. Üç durumun birimi de birimsiz bir katsayıdır ve zemin özelliğinden (φ') ve duvarın yaptığı harekettan belirlenir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu üç durumun ne kadar hareketle oluştuğu pratikte belirleyicidir. Aktif duruma geçmek için duvarın genellikle küçük bir öteleme ya da dönme yapması yeterlidir; pasif duruma ulaşmak için ise çok daha büyük bir hareket gerekir. Literatürde kum ve kil için bu hareket oranları farklı verilir; kesin yüzdeler kaynağa ve zemin tipine göre değişir, bu yüzden bu metinde sayısal bir eşik vermiyoruz. Kaynak için Das, Principles of Foundation Engineering, Bölüm 7 (toprak basıncı) ile doğrulama yapın. Kilde deformasyon zamana bağlı ilerlediği için hareket uzun sürede tamamlanabilir; kumda ise hareket daha hızlı oluşur. Bu nedenle 'duvar hareket eder mi?' sorusu hesabın başında sorulmalıdır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: K_0 = 1 − sin φ' yaklaşımı normal konsolide zeminler için kullanılır; aşırı konsolide killerde gerçek K_0 daha büyük olabilir. Program sükunet katsayısını yalnız yatay arazi (β = 0) için hesaplar; eğimli dolguda β > 0 ise sükunet durumu uygulanmaz ve kod hata verir. Bu nedenle yanal basınç hesabına başlamadan önce duvarın hareket varsayımı ve arazi geometrisi açıkça yazılmalıdır.",
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
      tr: "Rankine teorisi şu varsayımlarla çalışır: duvar yüzü düşey ve pürüzsüzdür (duvar-zemin sürtünmesi δ = 0), arazi yüzeyi yataydır (β = 0) ve zemin her yerde aynı anda kırılma durumundadır. Fiziksel sezgi: kum dolu bir kutunun yan duvarı dışarı açılırsa kum, eğik bir düzlem boyunca kaymaya başlar; Rankine bu kayma düzlemlerini ve gerilmeleri düşünür. Kırılma kriteri Mohr-Coulomb'dur: τ_f = c' + σ' tan φ'. Burada τ kayma gerilmesi [kPa], σ' efektif normal gerilme [kPa], c' efektif kohezyon [kPa], φ' efektif sürtünme açısıdır [°]. Her gerilme durumu bir Mohr dairesi ile gösterilir: merkez (σ_1 + σ_3)/2, yarıçap (σ_1 − σ_3)/2 dir ve kırılma zarfına teğet olduğu anda zemin kırılmak üzeredir. Birimler hep kPa'dır, bu nedenle daire üzerindeki her nokta da kPa cinsindendir.",
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
      tr: "Sonuç olarak Rankine, düşey gerilmeyi yatay gerilmeye çeviren bir katsayı verir. Derinlik arttıkça σ_v = γ·z doğrusal artar, dolayısıyla σ_h = K_a·γ·z de doğrusal artar; c' = 0 ve q = 0 iken diyagram bir üçgendir. Toplam itme kuvveti bu üçgenin alanıdır: P_a = ½ K_a γ H² [kN/m]. Üçgenin ağırlık merkezi tabandan H/3 yukarıdadır, bu nedenle devrilme momenti P_a·H/3 kadar hesaplanır. Birimler: K_a birimsiz, γ kN/m³, H m, yani P_a kN/m (metre başına kuvvet) olur. Bu, kPa (basınç) ile kN/m (kuvvet/uzunluk) arasındaki farkı akılda tutmanız için iyi bir kontroldür.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı: Rankine duvar sürtünmesini sıfır kabul eder. Gerçekte duvar yüzeyi zeminle bir miktar sürtünür ve gerçek P_a biraz daha küçüktür; bu nedenle Rankine, pürüzsüz düşey duvar için pratik ve biraz muhafazakar bir yaklaşımdır. Sürtünme ve eğik duvar yüzü önemliyse Coulomb yöntemi gerekir. Programda Rankine, β ≤ φ' için eğimli arazi yüzeyini de hesaplar; β > φ' ise kod hata verir. Program ayrıca Rankine'de c' ve β birlikte varsa hata verir; c'nin atılmasına yalnız açıkça izin verildiğinde (slope_cohesion = 'ignore') ve bir uyarıyla devam eder.",
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
      tr: "Kil gibi kohezyonlu zeminde taneler arasında çekim (c') vardır; bu, zeminin kendi kendini tutabilmesinin nedenidir. Duvar açısından bu ek direnç aktif durumda yanal basıncı azaltır: σ_h = K_a·σ_v − 2c'√K_a. Sezgi: kil bir yapıştırıcı gibi davranır ve duvarı zemin 'çeker' gibidir. Bu düşüş yüzeye yakın derinliklerde yanal gerilmeyi sıfırın altına, yani çekme bölgesine indirebilir. Gerçek zemin çekme gerilmesini taşıyamaz; yüzeyde kil kendiliğinden çatlar. Bu çatlağın derinliği z_0, yanal gerilmenin sıfır olduğu derinliktir ve q = 0 için z_0 = 2c'/(γ√K_a) ile verilir. Birimler: c' kPa, γ kN/m³, bu nedenle z_0 metre çıkar.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Çatlak derinliğinin altında yanal basınç sıfırdan başlayıp doğrusal artar; etkin basınç dağılımı bir üçgendir ama tepesi yüzeyde değil, z_0 derinliğindedir. Toplam kuvvet P_a = ½ (H − z_0)·σ_h(H) ile hesaplanır ve etki noktası üçgenin ağırlık merkezidir: taban tarafından (H − z_0)/3 yukarıda. Eğer q > 0 ise z_0 = (2c'/√K_a − q)/γ olur; yani sürşarj çatlağı kısaltır. Uygulamada çatlağın suyla dolması yaygındır ve bu, ek bir su kuvveti yaratır: ½ γ_w z_0² [kN/m]. Bu ek kuvvet 'çatlak suyu' olarak anılır ve kohezyonlu duvar tasarımında önemlidir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: bu basit çatlak modeli, çekme bölgesinin hiç yük taşımadığını ve çatlağın açık kaldığını varsayar. Gerçekte çatlak kapanabilir, su ile dolabilir ya da zamanla genişleyebilir. Ayrıca kil için c' ve φ' değerleri drenajlı (efektif) analiz içindir; drenajsız kil (φ = 0, s_u) başka bir yaklaşımdır ve bu bölümün kapsamı dışındadır. GeoTek programında çekme bölgesinde basınç sıfıra eşitlenir ve bir uyarı verilir; çatlak suyu terimi kodda yer almaz, bu nedenle su dolu çatlak durumu ayrıca değerlendirilmelidir.",
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
      tr: "Su varsa iki ayrı etki vardır ve bunları birbirinden ayırmak gerekir. Birincisi zeminin kendi ağırlığıdır: su seviyesinin altında zemin kaldırma kuvveti nedeniyle hafifler; bu nedenle batık birim ağırlık γ' = γ_sat − γ_w kullanılır (birimi kN/m³). İkincisi boşluk suyunun hidrostatik basıncıdır: u = γ_w·(z − z_w) [kPa], ve bu basınç duvara ayrıca etki eder. Duvara etkiyen toplam yatay basınç şudur: σ_h,toplam = σ'_h + u. Sık hata: su basıncını da K ile çarpmak. Oysa u, K ile çarpılmaz, doğrudan eklenir; K yalnız efektif gerilme için geçerlidir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Tabakalı zeminde sürtünme açısı ve birim ağırlık tabakadan tabakaya değişir. Tabaka sınırında düşey toplam gerilim σ_v ve su basıncı u süreklidir: üstten gelen ağırlık aşağı taşınır, sıçramaz. Ancak K farklı olduğu için yatay efektif gerilme σ'_h sıçrar: aynı σ_v, farklı K, farklı σ'_h. Bu ayrım, grafiklerde en sık yanlış okunan noktadır. Program da her katman için kendi K ve c' değerini kullanır; bu nedenle sınırda diyagram iki farklı değerle biter ve yeni katman aynı derinlikten farklı bir değerle başlar. Su seviyesinde u sürekli kalır; σ_v'nin eğimi yukarıda γ, aşağıda γ_sat olur, efektif gerilmenin eğimi ise aşağıda γ' olur.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı: tabakalar yatay ve homojen kabul edilir; mercekler ve eğimli tabaka sınırları ayrı tabaka olarak girilmediği sürece görmezden gelinir. Yeraltı suyu tek bir seviyede (GWT) kabul edilir; yağışla yükselme, kapiler zon ve sızma (akış) basıncı modellenmez. Sızma varsa hidrostatik varsayım yanıltıcıdır ve akım ağı ile ayrıca değerlendirilmelidir. Bu sınırların tümü, sonuç yorumlanırken açıkça yazılmalıdır.",
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
      tr: "Duvarın arkasındaki zemin yüzeyine uygulanan yük (bina temeli, yol trafiği, depo yükü) sürşarj olarak adlandırılır. Tekdüze yayılı yük q [kPa] ise bu yük düşey gerilmeye eklenir: σ_v = γ·z + q. Rankine ile yatay gerilmeye K_a·q olarak yansır. Önemli nokta: q derinlikle değişmez, dolayısıyla sürşarjdan gelen yanal basınç sabit bir dikdörtgen (K_a·q) olarak çizilir ve zemin ağırlığından gelen üçgenin üstüne eklenir. Toplam sürşarj kuvveti P_q = K_a·q·H [kN/m] ve etki noktası H/2 derinliktedir. Örnek: H = 5 m, q = 10 kPa ve K_a = 1/3 için K_a·q = 3.333 kPa sabit basınç, P_q = 16.67 kN/m ve bu kuvvetin etki noktası H/2 = 2.5 m (tabandan) olur.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Şerit (sonsuz uzun) ya da çizgisel yük için sezgi şöyledir: yük duvara yakınsa yanal basınca etkisi büyük, uzaksa küçüktür ve etki derinlikle yayılarak zayıflar. Bu yayılma (Boussinesq ya da 2:1 yayılma gibi) bir yerleşim ve dağılım hesabı gerektirir. GeoTek'in earth_pressure modülünde bu hesap yoktur: distribution.py yalnız tekdüze bir surcharge değerini düşey gerilmeye ekler ve bunu tüm derinliklerde aynı şekilde uygular. stresses.py ise yalnız in-situ tabakalı gerilmeyi hesaplar. Bu nedenle şerit ya da çizgisel yük için ayrı bir analiz gerekir; eşdeğer tekdüze q kullanılacaksa bunun muhafazakarlığı açıkça yazılmalıdır. Eğik yüzeyde q, dik yük ise yatay izdüşüme çevrilir: q_h = q / cos β (programda surcharge_per_horizontal, basis = 'inclined').",
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
