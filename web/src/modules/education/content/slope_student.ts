import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Şev stabilitesi ve güvenlik sayısı", en: "1. Slope stability and the factor of safety" } },
  {
    type: "p",
    text: {
      tr: "Bir yamaç, bir kazı şevi ya da bir dolgu gövdesi kendi ağırlığı altında ayakta kalabiliyorsa stabildir; ayakta kalamıyorsa kütlesinin bir kısmı kayar. Gündelik bir benzetme için, ıslak kum yığınının kenarını düşünün: yığın dik durur ama ucuna bir dokunuş yetiyorsa çöker. Mühendis burada iki kuvveti karşılaştırır: kaymaya çalışan sürükleyici kuvvetler (ağırlığın kayma yönündeki bileşeni) ve kaymaya karşı koyan direnç (zeminin kayma dayanımı). Bu iki büyüklüğün oranı güvenlik sayısı FS'dir: FS = direnç / sürükleyici. FS = 1 sınır durumudur; FS < 1 göçme beklenir; FS > 1 ise bir miktar emniyet olduğu anlamına gelir.", en: "A slope, an excavation cut or an embankment body is stable if it can stay standing under its own weight; if it cannot, part of its mass slides. As an everyday analogy, think of the edge of a heap of wet sand: the heap stands steep, but a touch at its edge is enough to make it collapse. The engineer compares two forces here: the driving forces that try to slide (the component of weight in the sliding direction) and the resistance of the soil to sliding (its shear strength). The ratio of these two magnitudes is the factor of safety FS: FS = resistance / driving. FS = 1 is the limit state; FS < 1 means failure is expected; FS > 1 means there is some margin.",
    },
  },
  {
    type: "p",
    text: {
      tr: "FS'nin hangi değere ulaşması gerektiği yapıya, yüke, zemin deneyinin güvenilirliğine ve yönetmeliğe göre değişir; bu metin kabul edilebilir bir sayı vermez. Tek bir FS sayısı, kullanılan kayma yüzeyinin doğru olup olmadığına ve zemin parametrelerinin (c, φ, γ) doğru ölçülüp ölçülmediğine bağlıdır. Bu yüzden FS, bir 'güvenli' onayı değil, bir hesabın özetidir. Programın ürettiği her FS, hangi zemin değerleri ve hangi kayma dairesi için hesaplandığıyla birlikte okunmalıdır.", en: "The FS value that must be reached depends on the structure, the load, the reliability of the soil testing and the regulations; this text does not give an acceptable number. A single FS number depends on whether the slip surface used is correct and whether the soil parameters (c, φ, γ) were measured correctly. Therefore FS is not a 'safe' approval but a summary of a calculation. Every FS the program produces must be read together with the soil values and the slip circle for which it was computed.",
    },
  },
  {
    type: "figure",
    id: "slp-slip-circle",
    caption: {
      tr: "Dairesel kayma yüzeyi: merkez O, yarıçap R. Kayan kütle sola (şev ayağına) hareket eder; FS = direnç momenti / itici moment = (τ_f·L·R) / (W·d), burada L yay uzunluğu, W kütlenin ağırlığı, d ağırlığın O'ya göre yatay koludur.",
      en: "Circular slip surface: centre O, radius R. The sliding mass moves to the left (toward the toe); FS = resisting moment / driving moment = (τ_f·L·R) / (W·d), with L the arc length, W the weight of the mass and d the horizontal arm of the weight about O.",
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "FS'yi bir 'yüzde emniyet' gibi okumak; FS = 1.5 demek 50 % emniyet değil, direncin sürükleyiciye oranının 1.5 olduğu demektir.", en: "Reading FS as a 'percentage safety': FS = 1.5 does not mean 50 % safety; it means the ratio of the resistance to the driving force is 1.5." },
      { tr: "FS'yi tek bir kayma dairesi için verilen bir sayı sanıp, programın bulduğu kritik dairenin genel minimum olduğunu varsaymak; arama bir alt kümede yapılır.", en: "Taking the FS for a single slip circle as a number and assuming that the critical circle found by the program is the global minimum; the search is performed over a subset." },
    ],
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Dairesel kayma yüzeyi ve dilim yöntemi", en: "2. Circular slip surface and the slice method" } },
  {
    type: "p",
    text: {
      tr: "Kil ve zemin şevlerinde gerçek kayma yüzeyi çoğunlukla bir daireye benzer; bu nedenle klasik yaklaşım bir daire seçip onun dengesine bakmaktır. Dairenin altındaki kütle, dik kenarlı dilimlere (slice) bölünür. Her dilim, genişliği b, yüksekliği h, tabanının eğim açısı α ve ağırlığı W olan bir dikdörtgen prizma gibi düşünülür. Dilimin tabanında kayma direnci c·b (kohezyon) ve (W − u·b)·tanφ (sürtünme) kadar çıkar; burada u boşluk suyu basıncıdır. Dilim yöntemi, her dilimin dengesini ayrı ayrı kurup toplar; böylece zemin tabakalarının, su seviyesinin ve yüzey yüklerinin kayma dairesi boyunca değişimi hesaba girer.", en: "In clay and soil slopes, the actual slip surface often resembles a circle; therefore the classical approach is to choose a circle and check its equilibrium. The mass below the circle is divided into slices with vertical sides. Each slice is considered as a rectangular prism with width b, height h, base inclination α and weight W. At the base of the slice the shear resistance is c·b (cohesion) plus (W − u·b)·tanφ (friction), where u is the pore water pressure. The slice method sets up the equilibrium of each slice separately and sums them; thus the variation of the soil layers, the water level and the surface loads along the slip circle is taken into account.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Dilimlerin α açısı, merkezin dikey hizasından ölçülen taban eğimidir: merkezin solundaki dilimler negatif α, sağındakiler pozitif α ile çalışır (yani sin α = (x − x_c)/R). Bu işaret, Bishop formülünde sürükleyici ve direnç katkısını ayırır. Program sürükleyici kuvveti Σ W sin α ile hesaplar ve kütlenin −x yönüne hareket ettiğini kabul eder: yani kret sağda, toe solda olan bir kesit bu varsayımla uyumludur. Kesit ters yönlüyse (kret solda, toe sağda) kritik daire araması bunu tanır ve 'x koordinatlarını aynalayın' türünde açık bir hata verir; bu durumda yanlış bir FS döndürülmez (bkz. bölüm 6). Dilim sayısı n_slices varsayılan olarak 40'tır ve kayma yüzeyinin giriş ile çıkış noktası arasında eşit genişlikte bölünür.", en: "The angle α of a slice is the base inclination measured from the vertical through the centre: slices to the left of the centre have negative α and those to the right positive α (i.e. sin α = (x − x_c)/R). This sign separates the driving and resisting contributions in Bishop's formula. The program computes the driving force as Σ W sin α and assumes the mass moves in the −x direction: a section with the crest on the right and the toe on the left is consistent with this assumption. If the section is reversed (crest on the left, toe on the right), the critical-circle search recognises it and raises an explicit 'mirror the x coordinates' error instead of returning a wrong FS (see section 6). The number of slices n_slices is 40 by default and they are divided into equal widths between the entry and exit points of the slip surface.",
    },
  },
  {
    type: "figure",
    id: "slp-bishop-slice",
    caption: {
      tr: "Bishop yöntemi: kütle düşey dilimlere bölünür; seçili dilimde ağırlık W, taban normal kuvveti N′ ve mobilize kayma direnci S etkir. FS = Σ[(c′b + (W − ub) tanφ′) / m_α] / Σ[W sin α].",
      en: "Bishop's method: the mass is divided into vertical slices; on the selected slice the weight W, base normal force N′ and mobilised shear resistance S act. FS = Σ[(c′b + (W − ub) tanφ′) / m_α] / Σ[W sin α].",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: φ = 0 (drenajsız, c = 10 kPa), tek kayma dairesi, dilim sayısının etkisi", en: "Example 1: phi = 0, slice count effect" },
    given: [
      { tr: "Yamaç: toe (x = 0, y = 5), kret (x = 10, y = 10), sağ tarafta düz kret; katman γ = 18 kN/m³, c = 10 kPa, φ = 0", en: "Slope: toe (x = 0, y = 5), crest (x = 10, y = 10), flat crest on the right side; layer γ = 18 kN/m³, c = 10 kPa, φ = 0" },
      { tr: "Kritik daire (aramadan): merkez (5.25, 14.54), R = 17.99 m", en: "Critical circle (from the search, not hand-derived): centre (5.25, 14.54), R = 17.99 m" },
      { tr: "Dilim sayısı n = 4 (el hesabı için) ve n = 40 (programın varsayılanı)", en: "Number of slices n = 4 (for hand calculation) and n = 40 (the program default)" },
    ],
    steps: [
      { label: { tr: "Formül (φ = 0)", en: "Formula at phi = 0" }, expr: "tanφ = 0 olduğundan m_α = cos α; FS = Σ(c·b / cos α) / Σ(W sin α)", result: "FS = Σ c b / cos α ÷ Σ W sin α" },
      { label: { tr: "Dilim 1 (α = −38.4°)", en: "Slice 1" }, expr: "b = 8.163 m, W = 670.2 kN/m; cos α = 0.7839; W sin α = 670.2 × (−0.6212)", result: "c b / cos α = 104.1; W sin α = −416.3" },
      { label: { tr: "Dilim 2 (α = −9.6°)", en: "Slice 2" }, expr: "W = 1369.1; cos α = 0.9856; W sin α = 1369.1 × (−0.1670)", result: "c b / cos α = 82.8; W sin α = −228.6" },
      { label: { tr: "Dilim 3 (α = 16.7°)", en: "Slice 3" }, expr: "W = 1864.9; cos α = 0.9584; W sin α = 1864.9 × 0.2868", result: "c b / cos α = 85.2; W sin α = 534.9" },
      { label: { tr: "Dilim 4 (α = 47.8°)", en: "Slice 4" }, expr: "W = 1108.7; cos α = 0.6729; W sin α = 1108.7 × 0.7413", result: "c b / cos α = 121.3; W sin α = 821.9" },
      { label: { tr: "Toplam ve FS (n = 4)", en: "Totals and FS (n = 4)" }, expr: "Σ c b / cos α = 393.4; Σ W sin α = −416.3 − 228.6 + 534.9 + 821.9 = 711.9; FS = 393.4 / 711.9", result: "FS ≈ 0.553" },
    ],
    program: {
      input: "bishop(model, xc=5.2488, yc=14.5392, R=17.9867, n_slices=4) ve n_slices=40 aynı daire",
      output: "n = 4: FS = 0.5534;  n = 40: FS = 0.6325 (aramanın kritik dairesi); çıkış x ≈ −10.00 (sol düz zemin, y = 5), giriş x ≈ 22.65 (kret üstü düz zemin, y = 10)",
      note: { tr: "El hesabı (n = 4) programın n = 4 sonucunu doğruluyor. Dilim sayısı 4'ten 40'a çıkınca FS yaklaşık %14 arttı; yani kaba dilimleme FS'yi düşük çıkarır. Bu yüzden programın varsayılanı 40 dilimdir.", en: "The hand calculation (n = 4) confirms the program's n = 4 result. When the number of slices is increased from 4 to 40, the FS increased by about 14%; i.e., coarse slicing gives a lower FS. This is why the program default is 40 slices." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Dilim açısı α'nın işaretini karıştırmak; merkezin solundaki dilimler negatif α ile sürükleyici katkıyı azaltır.", en: "Confusing the sign of the slice angle α; slices to the left of the centre with negative α reduce the driving contribution." },
      { tr: "φ = 0 iken tanφ'yi sıfır yerine yanlışlıkla bir değer alıp kohezyonu ihmal etmek; drenajsız analizde direncin kaynağı c'dir.", en: "When φ = 0, taking tanφ as some value instead of zero by mistake and neglecting the cohesion; in an undrained analysis the source of resistance is c." },
      { tr: "Dilim genişliğini b yerine dairenin yay uzunluğu olarak almak; Bishop'ta b dilimin yatay genişliğidir.", en: "Taking the slice width b as the arc length of the circle; in Bishop's method b is the horizontal width of the slice." },
    ],
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Bishop basitleştirilmiş yöntemi: formül ve iterasyon", en: "3. Bishop simplified method: formula and iteration" } },
  {
    type: "p",
    text: {
      tr: "Bishop (1955), dilimler arasındaki teğetsel (kayma) kuvvetlerini ihmal ederek formülü basitleştirdi. Her dilim için düşey denge yazılır ve sonuç, tüm kayma dairesi için moment dengesinden çıkarılır. Bu nedenle çözüm moment dengesini tam sağlar, yatay kuvvet dengesini ise tam sağlamaz. Sonuçta FS, hem FS'ye bağlı hem de dilimlere bağlı bir ifadeye dönüşür: m_α = cos α + sin α · tanφ / FS. Bu nedenle FS'yi doğrudan yazamazsınız; bir başlangıç değeri (FS = 1) ile başlayıp tekrar eden bir hesapla çözersiniz.", en: "Bishop (1955) simplified the formula by neglecting the tangential (shear) forces between slices. Vertical equilibrium is written for each slice, and the result is obtained from moment equilibrium for the whole slip circle. Therefore the solution fully satisfies moment equilibrium but does not fully satisfy horizontal force equilibrium. As a result FS becomes an expression depending on both FS and the slices: m_α = cos α + sin α · tanφ / FS. Therefore you cannot write FS directly; you solve it by starting from an initial value (FS = 1) and repeating the calculation.",
    },
  },
  {
    type: "formula",
    expr: "FS = Σ [ (c·b + (W − u·b)·tanφ) / m_α ]  /  Σ [ W·sin α + k_h·W·(y_c − y_g)/R ]\nm_α = cos α + sin α · tanφ / FS",
    caption: { tr: "Bishop basitleştirilmiş FS (her iki toplam kayma dairesi üzerindeki tüm dilimlerde). Payda deprem katkısını k_h ile içerir.", en: "Bishop simplified factor of safety" },
    where: [
      { tr: "b: dilim genişliği [m]; W: dilim ağırlığı (birim uzunluk başına) [kN/m]; c: kohezyon [kPa]; φ: sürtünme açısı", en: "b: slice width [m]; W: slice weight (per unit length) [kN/m]; c: cohesion [kPa]; φ: friction angle" },
      { tr: "u: taban boşluk suyu basıncı [kPa]; y_c, R: daire merkezi ve yarıçapı; y_g: dilim ağırlık merkezinin kotu; k_h: yalancı-statik deprem katsayısı", en: "u: base pore water pressure [kPa]; y_c, R: centre and radius of the circle; y_g: elevation of the slice's centre of weight; k_h: pseudo-static seismic coefficient" },
    ],
  },
  {
    type: "steps",
    title: { tr: "Bishop iterasyonu (kod ile birebir aynı mantık)", en: "Bishop iteration" },
    items: [
      { tr: "Her dilim için α, b, W, c, φ ve u değerlerini daire geometrisinden hesaplayın. Kayma yüzeyi zemin tabakalarını kesiyorsa her dilimin tabanı kendi katmanının c ve φ'sini alır.", en: "For each slice compute α, b, W, c, φ and u from the circle geometry. If the slip surface cuts through soil layers, the base of each slice takes the c and φ of its own layer." },
      { tr: "FS'ye bir başlangıç değeri verin (kod FS = 1 ile başlar).", en: "Give FS an initial value (the code starts with FS = 1)." },
      { tr: "m_α = cos α + sin α·tanφ / FS hesaplayın. Kod, m_α ≤ 0 veya çıkış tarafındaki (α < 0) bir dilimde m_α < 0.2 çıkarsa bu daireyi kabul etmez.", en: "Compute m_α = cos α + sin α·tanφ / FS. The code does not accept the circle if m_α ≤ 0, or if m_α < 0.2 on a slice on the exit side (α < 0)." },
      { tr: "Yeni FS'yi formülle hesaplayın. |FS_yeni − FS| < 1e-6 olana kadar 2. ve 3. adımları tekrarlayın (en fazla 200 tur).", en: "Compute the new FS from the formula and repeat steps 2 and 3 until |FS_new − FS| < 1e-6 (at most 200 iterations)." },
      { tr: "Yakınsamadıysa veya sürükleyici toplam ≤ 0 ise daire geçersiz sayılır; program o daireyi arama dışı bırakır.", en: "If it does not converge, or the total driving force is ≤ 0, the circle is invalid; the program excludes that circle from the search." },
    ],
  },
  
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı, FS'nin ilk başta 1 alınmasıyla değil, m_α'nın FS'ye bağlılığıyla ilgilidir: FS küçüldükçe tanφ/FS terimi büyür ve m_α bazı dilimlerde sıfıra yaklaşabilir. Program bu durumda sayısal olarak anlamsız bir sonuç üretmek yerine daireyi reddeder. Bu nedenle sonucun iterasyon sayısı (iterations) ile birlikte okunması iyi bir alışkanlıktır: çok az tur ya da hiç yakınsamamış bir sonuç, zemin verisinin uç değerlerinde bir sorun olabileceğini gösterir.", en: "The limit of the method concerns the dependence of m_α on FS, not the starting value FS = 1: as FS decreases the tanφ/FS term grows, and m_α may approach zero on some slices. In this case the program rejects the circle rather than producing a numerically meaningless result. It is therefore good practice to read the result together with the number of iterations: a result with very few iterations, or no convergence at all, indicates that there may be a problem at the extreme values of the soil data.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: φ = 25°, c = 10 kPa, kritik daire (aramadan)", en: "Example 2: dry critical circle, phi 25" },
    given: [
      { tr: "Aynı yamaç, γ = 18 kN/m³, c = 10 kPa, φ = 25°, su yok, deprem yok", en: "The same slope, γ = 18 kN/m³, c = 10 kPa, φ = 25°, no water, no earthquake" },
      { tr: "Arama sınırları: merkez x ∈ [0, 20], y ∈ [10, 30]; teğet kotu ∈ [−5, 5]; ızgara 15 × 15 × 12, sonra Nelder-Mead", en: "Search limits: centre x ∈ [0, 20], y ∈ [10, 30]; tangent elevation ∈ [−5, 5]; grid 15 × 15 × 12, then Nelder-Mead" },
    ],
    steps: [
      { label: { tr: "Arama", en: "Search" }, expr: "ızgarada en düşük FS'li daire bulunur, sonra (x_c, y_c, R) üç değişkenli Nelder-Mead ile iyileştirilir", result: "kritik daire: x_c = 2.61, y_c = 14.89, R = 10.23 m" },
      { label: { tr: "Giriş/çıkış", en: "Entry and exit" }, expr: "daire, toe'un solundaki düz zemin çizgisini (y = 5) x_c − √(R² − (y_c − 5)²) = −10.00'da, kretin sağındaki düz zemin çizgisini (y = 10) x_c + √(R² − (y_c − 10)²) = 22.65'te keser", result: "x_çıkış ≈ −10.00, x_giriş ≈ 22.65" },
      { label: { tr: "Sonuç", en: "Result" }, expr: "FS minimum daire üzerinde", result: "FS = 2.163 (7 iterasyon)" },
    ],
    program: {
      input: "search_critical_circle(model, x_range=(0,20), y_range=(10,30), tangent_range=(-5,5)) with n_slices = 40",
      output: "FS = 2.1626, xc = 2.6121, yc = 14.8884, R = 10.2277, x_entry = 11.596, x_exit ≈ 0.000, iterations = 7",
      note: { tr: "Bu sonuç elle tam doğrulanmadı (40 dilim); dilim tabloları programın içinde tutulur. Dilim sayısını 20'ye indirince FS 2.160 çıkar; 4 dilimde 2.029 çıkar.", en: "This result was not fully verified by hand (40 slices); the slice tables are kept inside the program. Reducing the number of slices to 20 gives FS 2.160; with 4 slices it gives 2.029." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "FS'yi formülde doğrudan çözmeye çalışıp m_α'daki FS'yi sabit bırakmak; iterasyon gerekir.", en: "Trying to solve FS directly in the formula while keeping the FS in m_α fixed; iteration is required." },
      { tr: "Sürükleyici toplamın işaretini hatalı alıp FS'yi sonsuza yakın çıkarmak; yalnız pozitif sürükleyici olan daireler anlamlıdır.", en: "Taking the sign of the total driving force wrongly and getting an FS close to infinity; only circles with a positive driving force are meaningful." },
      { tr: "Dilim sayısını 4 gibi çok küçük seçmek; FS'nin dilim sayısına duyarlılığını bilmeden sonucu güvenilir saymak.", en: "Choosing too few slices, such as 4, and considering the result reliable without knowing the sensitivity of FS to the number of slices." },
    ],
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Su, yük, deprem ve kesit geometrisi", en: "4. Water, loads, seismic and section geometry" } },
  {
    type: "p",
    text: {
      tr: "Su, şevde iki şekilde etki eder: boşluk suyu basıncı u, kayma yüzeyindeki efektif gerilmeyi azaltarak direnci düşürür; ayrıca suyla dolu zeminin birim ağırlığı artar. Programda su seviyesi bir kot olarak girilir (water_level) ve u, bu kotun altında hidrostatik olarak u = γ_w·(h_w − y) ile hesaplanır. Suyun kotu yüzeyin üstündeyse yüzeyde su göleti olduğu varsayılır; program bu durumu modellemez ve yalnız su seviyesinin altındaki basıncı verir. Su seviyesini ‘derinlik’ gibi girmek en sık yapılan hatalardan biridir; bu alan kotun mutlak değeridir.", en: "Water acts on the slope in two ways: pore water pressure u reduces the strength by reducing the effective stress on the slip surface, and the unit weight of the saturated soil increases. In the program the water level is entered as an elevation (water_level), and u is computed hydrostatically below this elevation as u = γ_w·(h_w − y). If the elevation is above the ground surface, the program assumes there is ponded water on the surface; the program does not model this and only gives the pressure below the water level. Entering the water level as a 'depth' is one of the most common mistakes; this field is the absolute value of an elevation.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yüzey yükleri (SurfaceLoad), x1 ile x2 arasında q1'den q2'ye doğrusal değişen düşey basınçlar olarak girilir [kPa]; dilim ağırlığına kendi genişlikleriyle eklenir. Deprem yükü yalancı-statik yaklaşımla yapılır: k_h katsayısı dilim ağırlığına yatay bir kuvvet olarak eklenir ve direnç payına karşı sürükleyici katkı üretir. Bu yaklaşım kayma yüzeyinin toplam yatay ivmesini tek bir sabit ile temsil eder; sıvılaşma veya deprem sonrası dayanım kaybı burada yoktur. Program yalnız kayma yüzeyinin dairesel olduğu ve zeminin yatay tabakalara ayrıldığı durumda çalışır.", en: "Surface loads (SurfaceLoad) are entered as vertical pressures varying linearly from q1 to q2 between x1 and x2 [kPa]; they are added to the slice weight with their own widths. The earthquake load is applied by the pseudo-static approach: the k_h coefficient is added to the slice weight as a horizontal force and gives a driving contribution against the resistance. This approach represents the total horizontal acceleration of the slip surface with a single constant; liquefaction or post-earthquake strength loss is not included here. The program only works when the slip surface is circular and the soil is divided into horizontal layers.",
    },
  },
  {
    type: "figure",
    id: "slp-search-results",
    caption: {
      tr: "Merkez ızgarası: her merkez için en küçük FS'li daire bulunur; kırmızı nokta en küçük FS'li (kritik) dairenin merkezidir. Sayılar şematik FS değerleridir.",
      en: "Centre grid: for each centre the circle with the smallest FS is found; the red point is the centre of the critical circle. The numbers are schematic FS values.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: su seviyesi kretin hizasında (y = 10 m) ve deprem kh = 0.1", en: "Example 3: water at crest level and kh = 0.1" },
    given: [
      { tr: "Aynı yamaç, c = 10 kPa, φ = 25°, γ = 18 kN/m³", en: "The same slope, c = 10 kPa, φ = 25°, γ = 18 kN/m³" },
      { tr: "Varyant A: water_level = 10 (kretle aynı kot). Varyant B: kh = 0.1, su yok", en: "Variant A: water_level = 10 (same elevation as the crest). Variant B: kh = 0.1, no water" },
      { tr: "Arama aynı sınırlarla yapılır, dilim sayısı 40", en: "The search is performed with the same limits, number of slices 40" },
    ],
    steps: [
      { label: { tr: "Varyant A su basıncı", en: "Pore pressure A" }, expr: "u = γ_w (h_w − y) = 9.81 × (10 − 4) = 58.86 kPa (taban kotu y = 4 m için)", result: "dilim tabanındaki u, su kotuna göre hesaplanır" },
      { label: { tr: "Varyant A sonucu", en: "Result A" }, expr: "boşluk suyu nedeniyle (W − u·b) tanφ azalır, kritik daire sığlaşır", result: "FS = 0.911, R = 7.61 m" },
      { label: { tr: "Varyant B sonucu", en: "Result B" }, expr: "k_h W (y_c − y_g)/R sürükleyici katkısı eklenir", result: "FS = 1.744" },
    ],
    program: {
      input: "A: SlopeModel(..., water_level=10). B: SlopeModel(..., kh=0.1); search_critical_circle(...) her ikisi için",
      output: "A: FS = 0.9112, R = 7.614;  B: FS = 1.7440 (kh = 0.1)",
      note: { tr: "Varyant A'da su kotu kretle aynı olduğu için kesitin tamamı doygun kabul edilir; bu, gerçek bir yağmur ya da yükselmiş su sınırı senaryosudur, ortalama koşul değildir. Sonuçlar elle kontrol edilmedi.", en: "In variant A, since the water elevation is the same as the crest, the whole section is assumed saturated; this is a scenario of actual rainfall or a raised water boundary, not an average condition. The results were not checked by hand." },
    },
  },
  {
    type: "warn",
    text: {
      tr: "Kesit yönü: program kayan kütlenin −x yönünde hareket ettiğini kabul eder. Test amacıyla aynı yamacı aynalayıp toe'u sağa, kreti sola koyduğumuzda program hata vermedi ve FS ≈ 6 × 10^16 döndürdü. Bu, girdi kontrolünün bu durumu yakalamadığını gösterir. Kesiti çizmeden önce kret ve toe konumunu, sonra programın yakaladığı FS değerinin makul aralıkta olup olmadığını mutlaka kontrol edin.",
      en: "Reversed geometry is not rejected; FS becomes absurdly large (about 6e16).",
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Su seviyesini derinlik olarak girmek; water_level bir kottur (yüzeyin altındaki mesafe değil).", en: "Entering the water level as a depth; water_level is an elevation (not the distance below the surface)." },
      { tr: "Yüzey üstü su göleti varken FS'nin doğru olacağını varsaymak; program yalnız su seviyesinin altındaki basıncı verir.", en: "Assuming FS is correct when there is ponded water above the ground surface; the program only gives the pressure below the water level." },
      { tr: "Deprem katsayısı k_h ile PGA'yı karıştırmak; k_h boyutsuz bir yatay ivme oranıdır ve yönetmelik seçimine bağlıdır.", en: "Mixing up the seismic coefficient k_h with PGA; k_h is a dimensionless horizontal acceleration ratio and depends on the choice of regulation." },
      { tr: "Yük birimini kN/m² yerine kN/m olarak girmek; SurfaceLoad q değerleri kPa'dır.", en: "Entering the load unit as kN/m instead of kN/m²; SurfaceLoad q values are in kPa." },
      { tr: "Kesit yönünü kontrol etmeden çok büyük FS (örneğin 10'un çok üstü) sonucunu anlamlı kabul etmek; böyle bir değer önce geometriye bakılmasını gerektirir.", en: "Accepting a very large FS result (for example far above 10) as meaningful without checking the section geometry; such a value requires the geometry to be checked first." },
    ],
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Daire arama: ızgara, Nelder-Mead ve sınırlar", en: "5. Circle search: grid, Nelder-Mead and bounds" } },
  {
    type: "p",
    text: {
      tr: "Bir yamaçta sonsuz sayıda daire vardır; her biri farklı bir FS verir. Program bu dairelerin arasından en düşük FS'lisini arar. Önce x_c, y_c ve teğet kotu (y_t) için bir ızgara taranır; her ızgara noktasında R = y_c − y_t hesaplanır ve Bishop uygulanır. Sonra en iyi ızgara noktası Nelder-Mead yöntemiyle (x_c, y_c, R) üzerinde iyileştirilir; bu adımda teğet kotu aralığı yine sınırdadır. Bu iki aşama birlikte, ızgaraya takılmadan kritik dairenin yakınında bir minimum bulmayı amaçlar.", en: "A slope has infinitely many circles, each giving a different FS. The program searches among these circles for the one with the lowest FS. First a grid is scanned for x_c, y_c and the tangent elevation (y_t); at each grid point R = y_c − y_t is computed and Bishop is applied. Then the best grid point is refined with the Nelder-Mead method over (x_c, y_c, R); in this step the tangent elevation range is again bounded by its limits. Together these two stages aim to find a minimum near the critical circle without being trapped by the grid.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Aramanın sonucu, verilen arama sınırlarına bağlıdır. Eğer kritik daire sınırın dışındaysa program yalnız sınır içindeki en iyi daireyi verir ve bunu sessizce yapar. Bu nedenle sınırları kesitin genişliğine göre seçin ve sonuç dairesinin merkezinin sınıra çok yakın olup olmadığını kontrol edin. Ayrıca bir daire 'kabul edilemez' sayılırsa (ör. yay kesitin dışında kalıyorsa ya da m_α < 0.2 ise) arama onu atlar; hiçbir daire kabul edilmezse program açık bir hata verir.", en: "The result of the search depends on the given search limits. If the critical circle lies outside the limits, the program silently returns only the best circle within the limits. Therefore select the limits according to the width of the section, and check whether the centre of the result circle lies very close to a limit. Also, if a circle is considered 'unacceptable' (e.g. the arc lies outside the section or m_α < 0.2), the search skips it; if no circle is acceptable, the program raises an explicit error.",
    },
  },
  {
    type: "figure",
    id: "slp-search-bounds",
    caption: {
      tr: "Arama sınırları sonucu belirler: ızgara yalnız x_c, y_c sınırı içinde aranır. Kritik merkez sınıra yapışıksa gerçek kritik daire sınırın dışında olabilir; sınırı genişletip yeniden arayın.",
      en: "The search bounds control the result: the grid is searched only inside the x_c, y_c bounds. If the critical centre sits on a bound the true critical circle may lie outside; widen the bounds and search again.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: dilim sayısının kritik FS'ye etkisi (φ = 25°, kuru)", en: "Example 4: slice count sensitivity" },
    given: [
      { tr: "Aynı kuru yamaç ve aynı arama sınırları; yalnız n_slices değişir", en: "The same dry slope and the same search limits; only n_slices changes" },
    ],
    steps: [
      { label: { tr: "n = 4", en: "n = 4" }, expr: "kritik daire bulunur, kaba dilimleme", result: "FS = 2.029 (R = 10.63)" },
      { label: { tr: "n = 20", en: "n = 20" }, expr: "aynı arama", result: "FS = 2.160" },
      { label: { tr: "n = 40", en: "n = 40" }, expr: "varsayılan", result: "FS = 2.163 (R = 10.23)" },
    ],
    program: {
      input: "search_critical_circle(..., n_slices = 4 | 20 | 40)",
      output: "n=4: 2.0288;  n=20: 2.1595;  n=40: 2.1626",
      note: { tr: "Dilim sayısı 20'nin üstünde FS hızla yakınsıyor; 4 dilim yeterli değildir. Yakınsama, dilim sayısının sonucu nasıl etkilediğini görmek için yapılan bir sınama olup kesin bir hata tahmini değildir.", en: "Above 20 slices the FS converges quickly; 4 slices are not sufficient. The convergence is a test made to see how the number of slices affects the result, not an exact error estimate." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Arama sınırını kesitin dışına koyup kritik dairenin sınırda çıktığını fark etmemek.", en: "Placing the search limit outside the section and failing to notice that the critical circle lies at the boundary." },
      { tr: "Dilim sayısını hız için düşürüp FS'nin küçük çıktığını (tutucu yönde) yanlış okumak; burada düşük dilim sayısı FS'yi düşürdü ama bu her durumda geçerli bir kural değildir.", en: "Reading a lower FS (in the conservative direction) as a result of reducing the number of slices for speed; here a low number of slices lowered the FS, but this is not a valid rule in every case." },
      { tr: "Tek bir dairenin FS'sini ('fixed circle') kritik FS sanmak; kritik olan, aramanın bulduğu en düşük değerdir.", en: "Taking the FS of a single circle ('fixed circle') as the critical FS; the critical one is the lowest value found by the search." },
    ],
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Sınırlar ve dikkat noktaları", en: "6. Limits and cautions" } },
  {
    type: "figure",
    id: "slp-reversed-geometry",
    caption: {
      tr: "Ters yönlü geometri: program kayan kütlenin −x yönüne gittiğini varsayar (şev ayağı solda). Aynalı geometri bu varsayımla uyumsuzdur; program 'x koordinatlarını aynalayın' hatası verir.",
      en: "Reversed geometry: the program assumes the mass slides toward −x (toe on the left). A mirrored geometry conflicts with this assumption and the program raises a 'mirror the x coordinates' error.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu modül yalnız dairesel kayma yüzeyini kullanır. Gerçek bir zeminde kayma yüzeyi bir tabaka sınırı, zayıf bir ara katman ya da kaya yüzeyi boyunca gelişebilir; bu durumlarda dairesel arama sonucu kritik FS'yi fazla tahmin edebilir. Ayrıca Bishop yöntemi dilimler arası kayma kuvvetlerini ihmal eder; sonuç moment dengesini sağlar ama yatay kuvvet dengesini tam sağlamaz. Kuvvet dengesini de sağlayan Spencer ya da Morgenstern-Price yöntemleri ayrı değerlendirme gerektirir ve bu modülün kapsamı dışındadır.", en: "This module uses only the circular slip surface. In real ground the slip surface may develop along a layer boundary, a weak intermediate layer or a rock surface; in such cases the circular search result may overestimate the critical FS. Also, the Bishop method neglects interslice shear forces; the result satisfies moment equilibrium but does not fully satisfy horizontal force equilibrium. The Spencer or Morgenstern-Price methods, which also satisfy force equilibrium, require separate evaluation and are outside the scope of this module.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Program kesitin üzerindeki ponded su, çekme çatlağı, dinamik boşluk suyu artışı ve sıvılaşma etkilerini modellemez. Yalancı-statik deprem yaklaşımı sonucu sıvılaşma dayanım kaybını kapsamaz. Zemin parametreleri (c, φ, γ) girdi olarak verilir ve program bunları doğrulamaz; bu değerlerin zemin raporundan ve laboratuvar sonuçlarından gelmesi gerekir. Programın sonucu, yalnızca bu sınırlar içindeki bir hesabın sonucu olarak okunmalıdır.", en: "The program does not model ponded water on the section, tension cracks, dynamic pore pressure increase or liquefaction effects. The pseudo-static earthquake approach does not cover liquefaction strength loss. The soil parameters (c, φ, γ) are given as input and the program does not verify them; these values must come from the soil report and laboratory results. The program result should be read only as the result of a calculation within these limits.",
    },
  },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "Kayma direnci 150 kN/m ve sürükleyici kuvvet 100 kN/m ise FS kaçtır?", en: "If the resistance is 150 kN/m and the driving force is 100 kN/m, what is the FS?" },
        a: { tr: "FS = 150 / 100 = 1.5. Bu, %50 'emniyet' değil, direncin sürükleyiciye oranının 1.5 olduğu anlamına gelir.", en: "FS = 150 / 100 = 1.5. This does not mean 50% 'safety'; it means the ratio of the resistance to the driving force is 1.5." },
      },
      {
        q: { tr: "Bir dilim genişliği b = 2 m, yüksekliği h = 5 m ve γ = 18 kN/m³ ise dilim ağırlığı W (birim uzunluk başına) kaç kN/m'dir?", en: "For a slice of width b = 2 m, height h = 5 m and γ = 18 kN/m³, what is the slice weight W (per unit length) in kN/m?" },
        a: { tr: "W = γ · h · b = 18 × 5 × 2 = 180 kN/m.", en: "W = γ · h · b = 18 × 5 × 2 = 180 kN/m." },
      },
      {
        q: { tr: "Taban açısı α = 0 olan bir dilimde m_α değeri nedir?", en: "What is the value of m_α for a slice with base angle α = 0?" },
        a: { tr: "m_α = cos 0 + sin 0 · tanφ / FS = 1 + 0 = 1.", en: "m_α = cos 0 + sin 0 · tanφ / FS = 1 + 0 = 1." },
      },
      {
        q: { tr: "φ = 30°, FS = 1.0 iken α = 30° olan bir dilimde m_α kaçtır?", en: "For φ = 30° and FS = 1.0, what is m_α for a slice with α = 30°?" },
        a: { tr: "m_α = cos 30° + sin 30° · tan 30° / 1.0 = 0.8660 + 0.5 × 0.5774 = 1.1547.", en: "m_α = cos 30° + sin 30° · tan 30° / 1.0 = 0.8660 + 0.5 × 0.5774 = 1.1547." },
      },
      {
        q: { tr: "φ = 25° için tanφ değeri kaçtır?", en: "What is the value of tanφ for φ = 25°?" },
        a: { tr: "tan 25° = 0.4663.", en: "tan 25° = 0.4663." },
      },
      {
        q: { tr: "φ = 0 (drenajsız) bir analizde iki dilim için Σ c·b/cos α = 40 kN/m ve Σ W sin α = 25 kN/m ise Bishop FS kaçtır?", en: "In an analysis with φ = 0 (undrained), for two slices with Σ c·b/cos α = 40 kN/m and Σ W sin α = 25 kN/m, what is the Bishop FS?" },
        a: { tr: "tanφ = 0 olduğundan m_α = cos α ve FS = Σ(c b / cos α) / Σ(W sin α) = 40 / 25 = 1.6.", en: "Since tanφ = 0, m_α = cos α and FS = Σ(c b / cos α) / Σ(W sin α) = 40 / 25 = 1.6." },
      },
      {
        q: { tr: "Su seviyesi 10 m kotunda, dilim tabanı 4 m kotunda ise tabandaki boşluk suyu basıncı u kaç kPa'dır?", en: "If the water level is at elevation 10 m and the slice base is at elevation 4 m, what is the pore water pressure u at the base in kPa?" },
        a: { tr: "u = γ_w (h_w − y) = 9.81 × (10 − 4) = 58.86 kPa.", en: "u = γ_w (h_w − y) = 9.81 × (10 − 4) = 58.86 kPa." },
      },
      {
        q: { tr: "Bir dilim için W = 200 kN/m, k_h = 0.1, (y_c − y_g)/R = 0.5 ise deprem sürükleyici katkısı k_h W (y_c − y_g)/R kaç kN/m'dir?", en: "For a slice with W = 200 kN/m, k_h = 0.1 and (y_c − y_g)/R = 0.5, what is the seismic driving contribution k_h W (y_c − y_g)/R in kN/m?" },
        a: { tr: "0.1 × 200 × 0.5 = 10 kN/m.", en: "0.1 × 200 × 0.5 = 10 kN/m." },
      },
      {
        q: { tr: "Programda dilim sayısını 4'ten 40'a çıkarınca kritik FS neden değişir ve hangisi daha güvenilirdir?", en: "Why does the critical FS change when the number of slices in the program is increased from 4 to 40, and which is more reliable?" },
        a: { tr: "Kaba dilimleme kayma yüzeyini ve dilim ağırlıklarını kaba temsil eder; 4 dilimle FS 2.03, 40 dilimle 2.16 çıkar. Daha fazla dilim (40 varsayılan) sonucu daha iyi yakınsatır; ama her iki değer de aynı kritik dairenin farklı dilimlemeleridir.", en: "Coarse slicing represents the slip surface and the slice weights only roughly; with 4 slices FS is 2.03, and with 40 slices it is 2.16. More slices (40 by default) converge the result better; but both values are different slicings of the same critical circle." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Güvenlik sayısı (FS)", en: "Factor of safety (FS)" }, def: { tr: "Kayma direncinin sürükleyici kuvvete oranı. FS = 1 sınır durumudur.", en: "Ratio of the resisting strength along the slip to the driving force. FS = 1 is the limit state." } },
      { term: { tr: "Sürükleyici kuvvet", en: "Driving force" }, def: { tr: "Kayma yüzeyinde kütleyi kaydırmaya çalışan, ağırlığın yüzeye teğet bileşenleri.", en: "Tangential components of weight on the slip surface that try to move the mass." } },
      { term: { tr: "Kayma dairesi", en: "Slip circle" }, def: { tr: "Dairesel kabul edilen kayma yüzeyi; merkez (x_c, y_c) ve yarıçap R ile tanımlanır.", en: "Slip surface taken as circular; defined by the centre (x_c, y_c) and radius R." } },
      { term: { tr: "Dilim (slice)", en: "Slice" }, def: { tr: "Kayan kütlenin dikey kesitlerle ayrılmış parçası; genişlik b, yükseklik h, taban açısı α ve ağırlık W ile tanımlanır.", en: "A part of the sliding mass separated by vertical sections; defined by width b, height h, base angle α and weight W." } },
      { term: { tr: "Taban açısı (α)", en: "Base angle (α)" }, def: { tr: "Dilim tabanının yatayla yaptığı açı; sin α = (x − x_c)/R ile hesaplanır.", en: "Angle the slice base makes with the horizontal; computed as sin α = (x − x_c)/R." } },
      { term: { tr: "Kohezyon (c)", en: "Cohesion (c)" }, def: { tr: "Zeminin normal gerilmeden bağımsız kayma direnci bileşeni [kPa].", en: "The shear strength component of the soil that is independent of normal stress [kPa]." } },
      { term: { tr: "Sürtünme açısı (φ)", en: "Friction angle (φ)" }, def: { tr: "Normal gerilmeyle artan kayma direnci açısı [derece].", en: "Angle of shear resistance that increases with normal stress [degrees]." } },
      { term: { tr: "Boşluk suyu basıncı (u)", en: "Pore water pressure (u)" }, def: { tr: "Zemin boşluklarındaki su basıncı; hidrostatik olarak u = γ_w (h_w − y) ile verilir.", en: "Water pressure in the soil voids; given hydrostatically as u = γ_w (h_w − y)." } },
      { term: { tr: "Su seviyesi (water_level)", en: "Water level (water_level)" }, def: { tr: "Boşluk suyu basıncının sıfır olduğu kotun üstünde hidrostatik u'nun hesaplandığı kot.", en: "Elevation at which the pore water pressure is zero; the hydrostatic u is computed from this elevation." } },
      { term: { tr: "Bishop basitleştirilmiş yöntemi", en: "Bishop's simplified method" }, def: { tr: "Dilimler arası düşey kuvvetleri ihmal eden, moment dengesine dayanan FS yöntemi.", en: "FS method based on moment equilibrium that neglects vertical forces between slices." } },
      { term: { tr: "m_α", en: "m_α" }, def: { tr: "Bishop'ta cos α + sin α tanφ / FS. Payda olarak FS'ye bağlı, iterasyonla çözülür.", en: "In Bishop's method: cos α + sin α tanφ / FS. It depends on FS in the denominator and is solved by iteration." } },
      { term: { tr: "Kritik daire", en: "Critical circle" }, def: { tr: "Arama sonucunda en düşük FS'yi veren kayma dairesi.", en: "The slip circle giving the lowest FS in the search result." } },
      { term: { tr: "Izgara ve Nelder-Mead", en: "Grid and Nelder-Mead" }, def: { tr: "Program arama yöntemi: önce ızgara taraması, sonra (x_c, y_c, R) üzerinde Nelder-Mead iyileştirme.", en: "Search method of the program: first a grid scan, then refinement over (x_c, y_c, R) with Nelder-Mead." } },
      { term: { tr: "Yalancı-statik yaklaşım", en: "Pseudo-static approach" }, def: { tr: "Depremi sabit bir yatay ivme katsayısı k_h ile dilim ağırlığına eklenmiş yatay kuvvet olarak temsil eden yöntem.", en: "A method representing the earthquake as a horizontal force added to the slice weight with a constant horizontal acceleration coefficient k_h." } },
      { term: { tr: "k_h", en: "k_h" }, def: { tr: "Yatay deprem katsayısı; boyutsuz, yatay ivmenin yerçekimi ivmesine oranıdır.", en: "Horizontal seismic coefficient; dimensionless, the ratio of horizontal acceleration to gravitational acceleration." } },
      { term: { tr: "Yüzey yükü (SurfaceLoad)", en: "Surface load (SurfaceLoad)" }, def: { tr: "Yamaç yüzeyine x1 ile x2 arasında doğrusal değişen düşey basınç [kPa].", en: "Vertical pressure on the slope surface varying linearly between x1 and x2 [kPa]." } },
      { term: { tr: "Giriş ve çıkış noktası", en: "Entry and exit points" }, def: { tr: "Kayma dairesinin yüzeyle kesiştiği, sırasıyla kret ve toe tarafındaki x koordinatları.", en: "The x coordinates where the slip circle intersects the surface, on the crest side and the toe side respectively." } },
      { term: { tr: "Ters geometri", en: "Reverse geometry" }, def: { tr: "Kretin toe'un sağında kaldığı, programın −x yön varsayımıyla uyuşmayan kesit; sonuçlar anlamsız olabilir.", en: "A section in which the crest lies to the right of the toe, inconsistent with the program's −x direction assumption; results may be meaningless." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Bishop, A.W. (1955). The use of the slip circle in the stability analysis of slopes. Geotechnique 5(1) - kodun atıf yaptığı kaynak; bu oturumda açılamadı.",
      "Das, B.M. Principles of Foundation Engineering - şev stabilitesi bölümü; bölüm numarası doğrulanamadı.",
      "Spencer, E. (1967) ve Morgenstern & Price (1965) - kuvvet dengesini de sağlayan yöntemler için; bu metinde yalnız adları geçer, doğrulanamadı.",
    ],
  },
];
