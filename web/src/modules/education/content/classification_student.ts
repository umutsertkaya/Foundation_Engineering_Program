import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Zemini neden sınıflandırırız", en: "1. Why we classify soil" } },
  {
    type: "p",
    text: {
      tr: "Bir market rafında benzer ürünler aynı yere konur ki aradığınızı hızla bulabilesiniz. Zemin mühendisliğinde sınıflandırmanın amacı da budur: birbirine benzeyen zeminleri aynı adla anarak, bir sondaj kuyusundan ya da CPT sondajından gelen çok sayıda ölçümü tek bir dile çevirmek. Raporda 'kumlu kil' yazmak yerine 'SC' ya da 'CL' gibi bir grup sembolü kullanmak, başka bir mühendisin aynı zemini aynı şekilde anlamasını sağlar. Sınıflandırma zemin davranışını hesaplamaz; yalnız hangi hesap yönteminin ve hangi tipik değer aralığının akla yatkın olduğunu gösterir. Bu yüzden bir sembol bir sonuç değil, bir başlangıç varsayımıdır.", en: "Similar products are placed on the same shelf in a market so that you can find what you are looking for quickly. The purpose of classification in soil engineering is exactly this: to translate the many measurements from a boring or CPT sounding into a single language by naming similar soils the same way. Writing a group symbol such as 'SC' or 'CL' in a report, instead of 'sandy clay', lets another engineer understand the same soil in the same way. Classification does not compute soil behaviour; it only indicates which calculation method and which typical value range are plausible. That is why a symbol is not a result but a starting assumption.",
    },
  },
  
  {
    type: "p",
    text: {
      tr: "Bu konuda iki farklı yol anlatılır. Birincisi USCS (Birleşik Zemin Sınıflandırma Sistemi), laboratuvar deneyleriyle, yani elek analizi ve kıvam limitleriyle çalışır; sonuç SW, CL, MH gibi iki harfli bir gruptur. İkincisi Robertson'ın SBT yöntemidir: CPT'de ölçülen uç direnci (q_c), yan sürtünme (f_s) ve boşluk suyu basıncından (u_2) normalleştirilmiş parametreler üretir ve bir davranış bölgesi verir. Biri numune üzerinde, diğeri yerinde ölçümle çalışır; ikisi aynı zemini farklı gözlerle görür ve farklı sonuçlar verebilir. Hangisine güveneceğiniz, elinizdeki veriye ve yapının önemine bağlıdır.", en: "Two different approaches are described here. The first is USCS (Unified Soil Classification System), which works with laboratory tests, i.e. sieve analysis and consistency limits; the result is a two-letter group such as SW, CL or MH. The second is Robertson's SBT method: from the cone tip resistance (q_c), sleeve friction (f_s) and pore water pressure (u_2) measured in the CPT, it produces normalised parameters and gives a behaviour zone. One works on a sample, the other with in-situ measurement; both see the same soil through different eyes and may give different results. Which one you rely on depends on the data at hand and the importance of the structure.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınır: GeoTek programı zemin sınıfını yalnız girdi verisinden türetir. Organik zemin (OL, OH, Pt) için gerekli fırınlanmış kıvam limiti kullanılmadığından bu gruplar belirlenmez; 'kumlu', 'çakıllı' gibi sekonder sıfatlar da üretilmez. Sınıflandırma sonucu numune ve arazi gözlemiyle birlikte okunmalıdır.",
      en: "The program does not identify organic soils or secondary descriptors.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Dane boyutu dağılımı: elek analizi, C_u ve C_c", en: "2. Grain size distribution: sieve analysis, Cu and Cc" } },
  {
    type: "p",
    text: {
      tr: "Bir zeminin dane boyutu dağılımını anlamak için kuru numune bir elek serisinden geçirilir. Elek açıklığı küçüldükçe elekten geçen yüzde de azalır. USCS'de ana ayrım 0.075 mm'lik elek (No. 200) ile yapılır: bu elekte kalan tanelere kaba dane, geçen tanelere ince dane (silt ve kil) denir. Kaba daneler ayrıca 4.75 mm'lik elekte (No. 4) çakıl ve kum olarak ayrılır. Dane boyutu milimetre cinsinden verilir ve grafikte logaritmik eksende çizilir, çünkü bir çakıl ile bir kil tanesi arasındaki boyut farkı binlerce kat olabilir. Hidrometre deneyi 0.075 mm'nin altındaki ince daneleri de dağılım eğrisine ekler; ama USCS sınıfı ince dane yüzdesine ve kıvama bakar, hidrometre sonucunun tamamına değil.", en: "To understand the particle size distribution of a soil, a dry sample is passed through a series of sieves. As the sieve opening decreases, the percentage passing also decreases. In USCS the main split is made with the 0.075 mm sieve (No. 200): particles retained on it are called coarse grains, and those passing are fines (silt and clay). Coarse particles are further separated into gravel and sand on the 4.75 mm sieve (No. 4). Grain size is given in millimetres and plotted on a logarithmic axis, because the size difference between a gravel particle and a clay particle can be thousands of times. The hydrometer test adds the particles finer than 0.075 mm to the distribution curve; but the USCS class depends on the fines percentage and the consistency, not on the entire hydrometer result.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Dağılım eğrisinden üç büyüklük okunur: D_10, D_30 ve D_60; bunlar kütlece yüzde 10, 30 ve 60'ının geçtiği dane çaplarıdır. Düzgünlük katsayısı C_u = D_60 / D_10, eğrilik (derecelenme) katsayısı C_c = D_30² / (D_10 · D_60) ile hesaplanır. İyi derecelenmiş bir zeminde C_u büyük olmalı ve C_c yaklaşık 1 ile 3 arasında kalmalıdır. Neredeyse tek boyutlu taneler (düzgün kum) C_u'yu küçük bırakır; çok sayıda boyutun karışması C_u'yu büyütür. USCS'de kum için C_u ≥ 6, çakıl için C_u ≥ 4 eşiği kullanılır ve GeoTek kodu da aynı eşikleri uygular. Bu eşikler ve C_c aralığı sonucun W mi P mi olacağını belirler.", en: "Three sizes are read from the distribution curve: D_10, D_30 and D_60; these are the particle diameters at which 10, 30 and 60 percent by mass pass. The coefficient of uniformity C_u = D_60 / D_10 and the coefficient of curvature C_c = D_30² / (D_10 · D_60) are computed. A well-graded soil should have a large C_u and a C_c roughly between 1 and 3. Nearly uniform particles (uniform sand) keep C_u small; a mixture of many sizes increases C_u. USCS uses the thresholds C_u ≥ 6 for sand and C_u ≥ 4 for gravel, and the GeoTek code applies the same thresholds. These thresholds and the C_c range determine whether the result will be W or P.",
    },
  },
  {
    type: "figure",
    id: "cls-grading-curve",
    caption: {
      tr: "Dane boyutu dağılım eğrisi: yatay eksen logaritmik dane çapı, düşey eksen elekten geçen yüzde. D10, D30 ve D60 yüzde 10, 30 ve 60'a karşılık gelen çaplardır; No. 4 elek çakılı kumdan, No. 200 elek kumu ince daneden ayırır.",
      en: "Particle size distribution curve: logarithmic grain size on the horizontal axis, percent passing on the vertical. D10, D30 and D60 are the sizes at 10, 30 and 60 percent; the No. 4 sieve separates gravel from sand and the No. 200 sieve separates sand from fines.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: SW-SC (ince dane %10, iyi derecelenmiş kum, killi ince dane)", en: "Example 1: SW-SC" },
    given: [
      { tr: "Çakıl = 0 %, ince dane (0.075 mm altı) = 10 %, kum = 90 %", en: "Gravel = 0 %, fines (below 0.075 mm) = 10 %, sand = 90 %" },
      { tr: "D_10 = 0.10 mm, D_30 = 0.30 mm, D_60 = 0.70 mm", en: "D_10 = 0.10 mm, D_30 = 0.30 mm, D_60 = 0.70 mm" },
      { tr: "Kıvam (ince daneler için): LL = 35, PI = 15", en: "Consistency (for the fines): LL = 35, PI = 15" },
    ],
    steps: [
      { label: { tr: "Düzgünlük", en: "Uniformity" }, expr: "C_u = D_60 / D_10 = 0.70 / 0.10", result: "C_u = 7.0 (≥ 6, kum için yeterli)" },
      { label: { tr: "Eğrilik", en: "Curvature" }, expr: "C_c = D_30² / (D_10 · D_60) = 0.09 / (0.10 · 0.70)", result: "C_c = 1.29 (1 ile 3 arasında)" },
      { label: { tr: "Önek", en: "Prefix" }, expr: "kaba fraksiyonda çakıl 0 < kum", result: "S (kum)" },
      { label: { tr: "İnce dane sınıfı", en: "Fines class" }, expr: "A-çizgisi PI_A = 0.73 (35 − 20) = 10.95; PI = 15 ≥ 10.95 ve PI > 7", result: "C (killi)" },
      { label: { tr: "İnce dane yüzdesi", en: "Fines percentage" }, expr: "%5 < 10 ≤ %12: çift sembol", result: "SW-SC" },
    ],
    program: {
      input: "classify(fines=10, gravel=0, LL=35, PI=15, D10=0.1, D30=0.3, D60=0.7)",
      output: "symbol = 'SW-SC', complete = true, notes = []",
      note: { tr: "Elle hesap programla aynı sonucu verdi. Sonuç yalnız D değerleri ve kıvam ölçümü doğruysa geçerlidir; 'SC' ve 'SW' birlikte yazılır, tek başına 'SW' yazılmaz.", en: "The hand calculation gave the same result as the program. The result is valid only if the D values and the consistency measurement are correct; 'SC' and 'SW' are written together, and 'SW' is not written alone." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "C_u'da D_60 ile D_10'u ters yazmak; doğru sonuçta C_u her zaman 1'den büyük çıkar.", en: "Swapping D_60 and D_10 in C_u; with the correct order, C_u is always greater than 1." },
      { tr: "C_c'de D_30'u karesiz yazmak. Doğrusu C_c = D_30² / (D_10 · D_60)'tır.", en: "Writing D_30 without squaring in C_c. The correct form is C_c = D_30² / (D_10 · D_60)." },
      { tr: "Elek sonuçlarını yüzde yerine gram olarak girip toplamı 100 yapmamak; kütle oranı yüzdeye çevrilmelidir.", en: "Entering sieve results in grams instead of percentages and not making the total 100; the mass fractions must be converted to percentages." },
    ],
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Kıvam limitleri ve plastisite kartı", en: "3. Atterberg limits and the plasticity chart" } },
  {
    type: "p",
    text: {
      tr: "İnce daneli bir zemin su eklendikçe katı, yarı katı, plastik ve sıvı gibi davranır. Bu geçişleri ölçmek için Atterberg limitleri kullanılır. Sıvı limit LL, zeminin akmaya başladığı su muhtevasıdır (yüzde). Plastik limit PL, zeminin çatlamadan rulo yapılabildiği en düşük su muhtevasıdır. Plastisite indisi PI = LL − PL, zeminin plastik davranış aralığının genişliğidir. Kil hamuru benzetmesi yardımcı olur: çok az suyla ufalanır, çok suyla çamura döner, PI bu iki eşik arasındaki farktır. PI yüksekse zemin yapışkan ve sıkıştırılabilirdir; PI düşükse silt gibi davranır.", en: "A fine-grained soil behaves as a solid, semi-solid, plastic and liquid as water is added. Atterberg limits are used to measure these transitions. The liquid limit LL is the water content (in percent) at which the soil begins to flow. The plastic limit PL is the lowest water content at which the soil can be rolled into threads without cracking. The plasticity index PI = LL − PL is the width of the soil's plastic range. The clay-dough analogy helps: with too little water it crumbles, with too much water it turns into mud, and PI is the difference between these two thresholds. A high PI means the soil is sticky and compressible; a low PI means it behaves like silt.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Casagrande'nin plastisite kartında yatay eksen LL, düşey eksen PI'dır. Program iki çizgi kullanır: A-çizgisi PI = 0.73 (LL − 20) ve U-çizgisi PI = 0.9 (LL − 8). Doğal zeminlerin neredeyse tamamı U-çizgisinin altında kalır; bunun üstündeki bir nokta genellikle hatalı deneyi gösterir ve program bunu uyarı olarak işaretler. A-çizginin üstü kil, altı silt davranışına yakındır. Kodda ince dane sınıfı şöyle verilir: PI < 4 veya A-çizgisinin altındaysa M (silt); PI > 7 ve A-çizgisinin üstündeyse C (kil); arada kalan (4 ile 7 arası PI) bölge CL-ML'dir. Sayısal sınırları yine de kendi kaynağınızdan doğrulayın; bu metin kodun uyguladığı kuralı anlatır.", en: "On Casagrande's plasticity chart the horizontal axis is LL and the vertical axis is PI. The program uses two lines: the A-line PI = 0.73 (LL − 20) and the U-line PI = 0.9 (LL − 8). Almost all natural soils lie below the U-line; a point above it usually indicates an erroneous test, and the program flags it as a warning. Above the A-line the soil behaves like clay, below it like silt. In the code the fine-grained class is given as follows: if PI < 4 or the point is below the A-line, M (silt); if PI > 7 and the point is above the A-line, C (clay); the zone in between (PI between 4 and 7) is CL-ML. Nevertheless, verify the numerical limits against your own source; this text describes the rule the code applies.",
    },
  },
  {
    type: "figure",
    id: "cls-plasticity-chart",
    caption: {
      tr: "Casagrande plastisite kartı: A-çizgisi (PI = 0,73 (LL − 20)) ve U-çizgisi (PI = 0,9 (LL − 8)); LL = 50 çizgisi düşük ve yüksek plastisiteyi ayırır. Bölgeler CL, CH, ML/OL, MH/OH ve CL-ML olarak adlandırılır.",
      en: "Casagrande plasticity chart: the A-line (PI = 0.73 (LL − 20)) and U-line (PI = 0.9 (LL − 8)); the LL = 50 line separates low from high plasticity. Zones are CL, CH, ML/OL, MH/OH and CL-ML.",
    },
  },
  {
    type: "formula",
    expr: "PI = LL − PL\nA-çizgisi: PI_A(LL) = 0.73 (LL − 20)\nU-çizgisi: PI_U(LL) = 0.9 (LL − 8)",
    caption: { tr: "Kıvam limitleri ve program sınırları (su muhtevası yüzde olarak)", en: "Atterberg relations" },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: LL = 40, PI = 18, %60 ince dane (CL)", en: "Example 2: CL" },
    given: [
      { tr: "İnce dane yüzdesi 60 % (çoğunluğu ince dane)", en: "Fines percentage 60 % (the majority is fines)" },
      { tr: "LL = 40, PI = 18", en: "LL = 40, PI = 18" },
    ],
    steps: [
      { label: { tr: "A-çizgisi", en: "A-line" }, expr: "PI_A = 0.73 (40 − 20) = 14.6", result: "PI = 18 ≥ 14.6: A-çizgisinin üstü" },
      { label: { tr: "Plastisite sınıfı", en: "Plasticity class" }, expr: "PI = 18 > 7", result: "C (kil)" },
      { label: { tr: "LL < 50 mi?", en: "LL below 50?" }, expr: "LL = 40 < 50", result: "düşük plastisiteli: CL" },
    ],
    program: {
      input: "classify(fines=60, gravel=0, LL=40, PI=18)",
      output: "symbol = 'CL', complete = true, notes = ['Organic soils (OL/OH) not checked']",
      note: { tr: "Sonuç el hesabıyla aynı. Notta organik kontrolünün yapılmadığı yazıyor; bu bir eksik değil, programın kapsam sınırıdır.", en: "The result agrees with the hand calculation. The note says the organic check was not performed; this is not a deficiency but a scope limit of the program." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "LL ve PI'yi karıştırmak: PI her zaman LL − PL'dir; PI'yi LL gibi okumak zemini yanlış bölgeye koyar.", en: "Confusing LL and PI: PI is always LL − PL; reading PI as if it were LL places the soil in the wrong zone." },
      { tr: "A-çizgisini PI = LL − 20 diye yazmak; katsayı 0.73'tür.", en: "Writing the A-line as PI = LL − 20; the coefficient is 0.73." },
      { tr: "LL = 50 sınırını unutmak. LL ≥ 50 ise CH/MH, LL < 50 ise CL/ML kullanılır.", en: "Forgetting the LL = 50 boundary. If LL ≥ 50 use CH/MH; if LL < 50 use CL/ML." },
      { tr: "U-çizgisinin üstünde kalan bir deney sonucunu kabul etmek; bu genellikle hatalı deney ya da kayıt işaretidir.", en: "Accepting a test result that lies above the U-line; this is usually a sign of an erroneous test or a recording error." },
    ],
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. USCS karar akışı ve çift semboller", en: "4. USCS decision flow and dual symbols" } },
  {
    type: "p",
    text: {
      tr: "USCS karar akışı önce ince dane oranına bakar. İnce dane yüzdesi %50 veya üstündeyse zemin ince daneli kabul edilir ve sınıf yalnızca LL ve PI ile belirlenir: LL < 50 ise CL, ML veya CL-ML; LL ≥ 50 ise CH veya MH. Bu durumda çakıl-kum oranı sınıfı değiştirmez. İnce dane oranı %50'nin altındaysa zemin kaba daneli kabul edilir ve ilk harf G (çakıl) ya da S (kum) olur. Çakıl ile kum arasındaki seçim, kaba fraksiyonda çakılın kumdan fazla olup olmadığına bakar: çakıl daha fazlaysa G, değilse S.", en: "The USCS decision flow first looks at the fines fraction. If the fines percentage is 50 % or more, the soil is considered fine-grained and its class is determined only by LL and PI: CL, ML or CL-ML if LL < 50; CH or MH if LL ≥ 50. In this case the gravel-sand ratio does not change the class. If the fines fraction is below 50 %, the soil is considered coarse-grained and the first letter is G (gravel) or S (sand). The choice between gravel and sand depends on whether gravel is more than sand within the coarse fraction: G if gravel is greater, otherwise S.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kaba daneli zeminde ince dane yüzdesi üç bölgeye ayrılır. Yüzde 5'ten azsa yalnız dane dağılımı belirleyicidir ve ikinci harf W (iyi derecelenmiş) ya da P (kötü derecelenmiş) olur. Yüzde 12'den fazlaysa ince danelerin kıvamı belirleyicidir: ikinci harf M veya C olur; CL-ML bölgesindeki bir zemin ise SC-SM gibi bir çift sembol alır. Yüzde 5 ile 12 arasında kalan zeminler çift sembolle yazılır, örneğin SW-SC; bu, zeminin hem dane dağılımı hem ince dane davranışı açısından sınırda olduğunu gösterir. Kodda iki eksik veri durumu da vardır: çakıl oranı bilinmiyorsa sınıf kumu baskın kabul eder ve sonucu tamamlanmamış sayar; D değerleri yoksa zemini kötü derecelenmiş kabul eder. Bu varsayımlar notes alanında görünür.", en: "For coarse-grained soil the fines percentage is divided into three zones. Below 5 %, only the grain distribution determines the result and the second letter is W (well graded) or P (poorly graded). Above 12 %, the consistency of the fines determines it: the second letter becomes M or C, and a soil in the CL-ML zone receives a dual symbol such as SC-SM. Soils between 5 % and 12 % are written with a dual symbol, for example SW-SC; this indicates that the soil is at the boundary in terms of both grain distribution and fines behaviour. The code also handles two missing-data cases: if the gravel fraction is unknown, the class assumes the soil is sand-dominated and the result is treated as incomplete; if D values are missing, the soil is assumed to be poorly graded. These assumptions are visible in the notes field.",
    },
  },
  
  {
    type: "steps",
    title: { tr: "USCS'yi elle sınıflandırma sırası", en: "Hand USCS sequence" },
    items: [
      { tr: "İnce dane yüzdesini elek sonucundan (0.075 mm altı) belirleyin. %50 ve üstüyse LL ve PI ile devam edin.", en: "Determine the fines percentage from the sieve result (below 0.075 mm). If it is 50 % or more, continue with LL and PI." },
      { tr: "Kaba daneliyse çakıl ile kum oranını karşılaştırın; büyük olan önek (G veya S) olur.", en: "If the soil is coarse-grained, compare the gravel and sand fractions; the larger one becomes the prefix (G or S)." },
      { tr: "İnce dane yüzdesine göre tek, çift veya kıvam sembolü seçin (<%5, %5-12, >%12).", en: "Choose a single, dual or consistency symbol according to the fines percentage (<5 %, 5–12 %, >12 %)." },
      { tr: "C_u ve C_c'yi hesaplayıp W ya da P seçin. Eşikler: çakıl için C_u ≥ 4, kum için C_u ≥ 6; her ikisinde 1 ≤ C_c ≤ 3.", en: "Compute C_u and C_c and choose W or P. Thresholds: C_u ≥ 4 for gravel, C_u ≥ 6 for sand; in both cases 1 ≤ C_c ≤ 3." },
      { tr: "Eksik veri varsa sonucu tamamlanmamış sayın ve yaptığınız varsayımı yazın.", en: "If data are missing, treat the result as incomplete and write down the assumption you made." },
    ],
  },
  {
    type: "mistakes",
    items: [
      { tr: "Çakıl-kum seçimini tüm zemin üzerinden değil kaba fraksiyon üzerinden yapmamak; önek hangi fraksiyona göre belirlenir.", en: "Choosing gravel or sand based on the whole soil rather than the coarse fraction; the prefix is determined by the coarse fraction." },
      { tr: "%5 ile %12 arasındaki zemini tek sembolle yazmak; bu aralık için çift sembol zorunludur.", en: "Writing a soil with 5 % to 12 % fines as a single symbol; a dual symbol is mandatory for this range." },
      { tr: "Eksik C_u veya D değerlerini sessizce 'iyi derecelenmiş' kabul etmek; kod bunları 'kötü derecelenmiş' yapar ve sonucu tamamlanmamış sayar.", en: "Silently treating missing C_u or D values as 'well graded'; the code makes them 'poorly graded' and treats the result as incomplete." },
      { tr: "Organik bir zemini (OL/OH) yalnız LL ve PI ile CL ya da MH olarak yazmak; fırınlanmış LL ölçümü gerekir.", en: "Writing an organic soil (OL/OH) as CL or MH using only LL and PI; an oven-dried LL measurement is required." },
    ],
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. CPT ile davranış tipi: q_t, F_r, Q_tn, I_c", en: "5. CPT behaviour type: q_t, F_r, Q_tn, I_c" } },
  {
    type: "p",
    text: {
      tr: "CPT (konik penetrasyon deneyi), konik bir ucu sabit hızla zemine iterek üç ana ölçüm alır: uç direnci q_c, yan sürtünme f_s ve bazen uç arkasındaki boşluk suyu basıncı u_2. Ölçümler derinlikle birlikte kaydedilir ve zemin tipini sürekli bir profil olarak gösterir. Ancak q_c, derinlikle ve efektif gerilmeyle birlikte değişir: sığ bir yumuşak kil ile derin bir sıkı kum farklı q_c verir, ama bu yalnız gerilme farkından kaynaklanır. Robertson bu nedenle değerleri efektif gerilmeye göre normalleştirir ve zemin davranışını derinlikten bağımsız bir sayıyla anlatır.", en: "The CPT (cone penetration test) takes three main measurements by pushing a conical tip into the soil at a constant rate: tip resistance q_c, sleeve friction f_s and sometimes the pore pressure behind the tip u_2. The measurements are recorded with depth and show the soil type as a continuous profile. However, q_c varies with depth and with effective stress: a shallow soft clay and a deep dense sand give different q_c, but this arises only from the stress difference. Robertson therefore normalises the values to effective stress and describes soil behaviour with a number that is independent of depth.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Düzeltilmiş uç direnci q_t = q_c + u_2 (1 − a) ile hesaplanır; a alan oranıdır ve u_2 ölçülmemişse q_t = q_c alınır. Sürtünme oranı F_r = f_s / (q_t − σ_v) × 100 ile yüzde olarak verilir; burada σ_v toplam düşey gerilmedir. Normalleştirilmiş uç direnci Q_tn = ((q_t − σ_v) / P_a) (P_a / σ'_v)^n ile tanımlanır, P_a = 101.325 kPa atmosfer basıncıdır. Üs n, Robertson (2009) bağıntısıyla n = 0.381 I_c + 0.05 (σ'_v / P_a) − 0.15 olarak verilir ve 0 ile 1 arasında sınırlanır. n ile I_c birbirine bağlı olduğundan program bunları iteratif olarak birlikte çözer.", en: "The corrected tip resistance q_t = q_c + u_2 (1 − a) is computed; a is the area ratio, and if u_2 is not measured, q_t = q_c is taken. The friction ratio F_r = f_s / (q_t − σ_v) × 100 is given as a percentage, where σ_v is the total vertical stress. The normalised tip resistance Q_tn = ((q_t − σ_v) / P_a) (P_a / σ'_v)^n is defined, where P_a = 101.325 kPa is atmospheric pressure. The exponent n follows the Robertson (2009) relation n = 0.381 I_c + 0.05 (σ'_v / P_a) − 0.15 and is limited between 0 and 1. Since n and I_c depend on each other, the program solves them together iteratively.",
    },
  },
  {
    type: "formula",
    expr: "q_t = q_c + u_2 (1 − a)\nF_r = f_s / (q_t − σ_v) × 100   [%]\nQ_tn = ((q_t − σ_v) / P_a) (P_a / σ'_v)^n\nn = 0.381 I_c + 0.05 (σ'_v / P_a) − 0.15,   0 ≤ n ≤ 1\nI_c = √[(3.47 − log Q_tn)² + (log F_r + 1.22)²]",
    caption: { tr: "Robertson normalleştirme ve davranış indeksi. Birimler: q, σ, P_a kPa; F_r yüzde; I_c boyutsuzdur.", en: "Robertson normalisation" },
  },
  {
    type: "p",
    text: {
      tr: "I_c, zemin davranış indeksidir ve kodda şu sınırlarla bölgeye çevrilir: I_c < 1.31 ise bölge 7 (çakıllı kum), 1.31 ile 2.05 arası bölge 6 (kum), 2.05 ile 2.60 arası bölge 5 (kum karışımı), 2.60 ile 2.95 arası bölge 4 (silt karışımı), 2.95 ile 3.60 arası bölge 3 (kil), 3.60 üstü bölge 2 (organik kil) olur. Bölge 1 (hassas, ince daneli) ayrıca, Q_tn < 12 exp(−1.4 F_r) koşulu sağlandığında atanır. Program bölge 8 ve 9 için yazılmış sınırları varsayılan olarak kapalı tutar; bu sınırların kaynakta doğrulanması beklenir. I_c'nin 2.6 altı değerleri kum benzeri davranışı gösterir; bu eşik sıvılaşma modülünde ayrıca kullanılır, ama bu konunun konusu değildir.", en: "I_c is the soil behaviour index, and in the code it is converted to a zone with the following limits: I_c < 1.31 gives zone 7 (gravelly sand), 1.31 to 2.05 zone 6 (sand), 2.05 to 2.60 zone 5 (sand mixtures), 2.60 to 2.95 zone 4 (silt mixtures), 2.95 to 3.60 zone 3 (clay), and above 3.60 zone 2 (organic clay). Zone 1 (sensitive, fine-grained) is assigned when the condition Q_tn < 12 exp(−1.4 F_r) is met. The program keeps the limits written for zones 8 and 9 switched off by default; these limits are expected to be verified against the source. Values of I_c below 2.6 show sand-like behaviour; this threshold is also used in the liquefaction module, but that topic is not the subject here.",
    },
  },
  {
    type: "figure",
    id: "cls-robertson-chart",
    caption: {
      tr: "Robertson normalleştirilmiş davranış grafiği: yatay eksen F_r, düşey eksen Q_tn (ikisi de logaritmik). I_c = 1,31; 2,05; 2,60; 2,95 ve 3,60 eş-eğrileri zemin davranış bölgelerini ayırır; işaretli nokta örneği gösterir.",
      en: "Robertson normalised behaviour chart: F_r on the horizontal axis, Q_tn on the vertical (both logarithmic). The I_c = 1.31, 2.05, 2.60, 2.95 and 3.60 contours separate the soil behaviour zones; the marked point is the worked example.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: q_t = 5000, f_s = 50, σ_v = 100, σ'_v = 80 kPa", en: "Example 3: CPT point" },
    given: [
      { tr: "q_t = 5000 kPa, f_s = 50 kPa, σ_v = 100 kPa, σ'_v = 80 kPa (u_0 = 20 kPa)", en: "q_t = 5000 kPa, f_s = 50 kPa, σ_v = 100 kPa, σ'_v = 80 kPa (u_0 = 20 kPa)" },
      { tr: "Yalnız bu nokta için; u_2 ölçülmediği varsayılıyor, q_t = q_c kabul edilir", en: "For this point only; pore pressure u_2 is assumed not to be measured, so q_t = q_c is taken" },
    ],
    steps: [
      { label: { tr: "Sürtünme oranı", en: "Friction ratio" }, expr: "F_r = 50 / (5000 − 100) × 100 = 50 / 4900 × 100", result: "F_r = 1.020 %" },
      { label: { tr: "İlk tahmin n = 1", en: "First guess n = 1" }, expr: "Q_tn = (4900 / 101.325) (101.325 / 80)^1 = 48.36 × 1.2666", result: "Q_tn ≈ 61.3" },
      { label: { tr: "I_c (ilk tur)", en: "I_c first pass" }, expr: "I_c = √[(3.47 − 1.787)² + (0.009 + 1.22)²] = √[2.833 + 1.510]", result: "I_c ≈ 2.08" },
      { label: { tr: "n güncellemesi", en: "Update n" }, expr: "n = 0.381 × 2.08 + 0.05 × (80 / 101.325) − 0.15 = 0.793 + 0.039 − 0.150", result: "n ≈ 0.68" },
      { label: { tr: "Yakınsama", en: "Converged" }, expr: "n, tur tur değişip 0.693'te sabitlenir; bu noktada Q_tn ve I_c yeniden hesaplanır", result: "Q_tn ≈ 56.97, I_c ≈ 2.109" },
      { label: { tr: "Bölge", en: "Zone" }, expr: "2.05 ≤ I_c = 2.109 < 2.60", result: "bölge 5 (kum karışımı)" },
    ],
    program: {
      input: "normalise_iterative(qt=[5000], fs=[50], sigma_v=[100], sigma_v_eff=[80]); sbtn_zone(Qtn, Fr, Ic)",
      output: "Fr = 1.0204 %, Q_tn = 56.97, n = 0.6931, I_c = 2.1093, zone = 5, converged = true",
      note: { tr: "El hesabının ilk turu programın sonucuna yaklaşır; fark tur sayısı ve yuvarlamadan gelir. Program tolerans 1e-3 ile yakınsar.", en: "The first pass of the hand calculation approaches the program's result; the difference comes from the number of iterations and rounding. The program converges with a tolerance of 1e-3." },
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: yumuşak kil, q_t = 800, f_s = 60 kPa", en: "Example 4: soft clay CPT" },
    given: [
      { tr: "q_t = 800 kPa, f_s = 60 kPa, σ_v = 100 kPa, σ'_v = 80 kPa", en: "q_t = 800 kPa, f_s = 60 kPa, σ_v = 100 kPa, σ'_v = 80 kPa" },
    ],
    steps: [
      { label: { tr: "Sürtünme oranı", en: "Friction ratio" }, expr: "F_r = 60 / (800 − 100) × 100 = 60 / 700 × 100", result: "F_r = 8.57 %" },
      { label: { tr: "Q_tn", en: "Q_tn" }, expr: "Q_tn = (700 / 101.325) (101.325 / 80)^1 = 6.909 × 1.2666", result: "Q_tn ≈ 8.75" },
      { label: { tr: "n", en: "n" }, expr: "n = 0.381 I_c + 0.05 × 0.79 − 0.15, ilk tahminde I_c büyük çıkar; n 1.0 üst sınırına çarpar", result: "n = 1.00 (sınırlandı)" },
      { label: { tr: "I_c", en: "I_c" }, expr: "I_c = √[(3.47 − 0.942)² + (0.933 + 1.22)²] = √[6.39 + 4.64]", result: "I_c ≈ 3.32" },
      { label: { tr: "Bölge", en: "Zone" }, expr: "2.95 ≤ I_c = 3.32 < 3.60", result: "bölge 3 (kil)" },
    ],
    program: {
      input: "normalise_iterative(qt=[800], fs=[60], sigma_v=[100], sigma_v_eff=[80]); sbtn_zone",
      output: "Fr = 8.571 %, Q_tn = 8.75, n = 1.0, I_c = 3.3206, zone = 3, converged = true",
      note: { tr: "n tavanda kalmıştır. Bu durum yüksek I_c'li zeminlerde beklenir ve bölge 3 sonucunu değiştirmez.", en: "n stayed at the ceiling. This is expected for soils with high I_c and does not change the zone 3 result." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Ham q_c değerini normalleştirme olmadan Q_tn yerine kullanmak; derinlikler arası kıyas yanlış olur.", en: "Using the raw q_c value without normalisation in place of Q_tn; comparisons between depths then become wrong." },
      { tr: "F_r'yi yüzde yerine oran olarak yazmak (1.02 ile 0.0102 karışıklığı); log F_r terimi yanlış çıkar.", en: "Writing F_r as a ratio instead of a percentage (confusing 1.02 with 0.0102); the log F_r term then comes out wrong." },
      { tr: "σ_v (toplam) ile σ'_v (efektif) değerlerini karıştırmak; F_r'de toplam, Q_tn ve n'de efektif gerilme kullanılır.", en: "Mixing up σ_v (total) and σ'_v (effective); total stress is used in F_r, and effective stress in Q_tn and n." },
      { tr: "I_c değerini bölge sınırında tam sayıya yuvarlamak; 2.60 ile 2.61 farklı bölgelerdir.", en: "Rounding I_c to an integer at a zone boundary; 2.60 and 2.61 are different zones." },
      { tr: "Bölge 1 (hassas) kriterini hiç kontrol etmemek; Q_tn < 12 exp(−1.4 F_r) koşulu ayrıca bakılmalıdır.", en: "Never checking the zone 1 (sensitive) criterion; the condition Q_tn < 12 exp(−1.4 F_r) must be checked separately." },
      { tr: "SBTn bölgesini kesin zemin sınıfı gibi okumak; bu bir davranış tipidir, USCS sembolü değildir.", en: "Reading the SBTn zone as a definite soil class; it is a behaviour type, not a USCS symbol." },
    ],
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Sınırlar ve eksik veri", en: "6. Limits and missing data" } },
  
  {
    type: "p",
    text: {
      tr: "Her sınıflandırma sonucu girdisi kadar güvenilirdir. Elek analizi yoksa ya da çakıl oranı ve D değerleri bilinmiyorsa USCS sembolü yine üretilebilir, ama bu sembol eksik veriye dayanır. GeoTek bu durumda sonucu tamamlanmamış (complete = false) işaretler ve varsayımı notlara yazar; bu bir hata değil, dürüst bir ara sonuçtur. Benzer şekilde bir CPT noktasında q_t ≤ σ_v, σ'_v ≤ 0 ya da f_s ≤ 0 ise I_c tanımsızdır; program bu noktayı NaN bırakır ve bölge 0 verir. Bölge 0'ı 'bilinmiyor' olarak okuyun, zemin tipi olarak değil.", en: "Every classification result is only as reliable as its input. If there is no sieve analysis, or if the gravel fraction and D values are unknown, a USCS symbol can still be produced, but it rests on incomplete data. GeoTek marks the result as incomplete (complete = false) in this case and writes the assumption into the notes; this is not an error but an honest interim result. Similarly, at a CPT point where q_t ≤ σ_v, σ'_v ≤ 0 or f_s ≤ 0, I_c is undefined; the program leaves that point as NaN and returns zone 0. Read zone 0 as 'unknown', not as a soil type.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Robertson bölgeleri kesin çizgiler değil, bir sınıflandırma haritasıdır. Sınır değerleri (1.31, 2.05, 2.60, 2.95, 3.60) grafikten yaklaşık okunmuş ve sonradan düzeltilmiş değerlerdir; kaynakta farklı revizyonlar bulunabilir. I_c yalnız normalleştirilmiş davranışı anlatır; sıkılık bu sınıflamada doğrudan yer almaz, yani gevşek ve sıkı kum aynı bölgeye düşebilir. Bu yüzden CPT sonucu, laboratuvar ya da SPT verisiyle çapraz kontrol edilmelidir.", en: "Robertson's zones are not sharp lines but a classification map. The boundary values (1.31, 2.05, 2.60, 2.95, 3.60) were approximately read from the chart and later adjusted, and different revisions may exist in the literature. I_c describes only the normalised behaviour; density is not directly included in this classification, so loose and dense sand may fall into the same zone. For this reason, the CPT result should be cross-checked against laboratory or SPT data.",
    },
  },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "D_10 = 0.20, D_30 = 0.50, D_60 = 2.00 mm ve ince dane %3 olan kumun C_u ve C_c değerleri nedir? Program ne döndürür?", en: "What are C_u and C_c for a sand with D_10 = 0.20, D_30 = 0.50, D_60 = 2.00 mm and 3 % fines? What does the program return?" },
        a: { tr: "C_u = 2.00 / 0.20 = 10; C_c = 0.50² / (0.20 × 2.00) = 0.625. C_c 1 ile 3 arasında değil; sınıf SP (kötü derecelenmiş kum). Program: SP.", en: "C_u = 2.00 / 0.20 = 10; C_c = 0.50² / (0.20 × 2.00) = 0.625. C_c is not between 1 and 3; class SP (poorly graded sand). Program: SP." },
      },
      {
        q: { tr: "LL = 45, PI = 23 ve ince dane yüzdesi %70 olan zemin hangi USCS sınıfındadır?", en: "Which USCS class does a soil with LL = 45, PI = 23 and 70 % fines belong to?" },
        a: { tr: "PI_A = 0.73 (45 − 20) = 18.25; PI = 23 ≥ 18.25 ve PI > 7: kil. LL < 50: CL. Program: CL.", en: "PI_A = 0.73 (45 − 20) = 18.25; PI = 23 ≥ 18.25 and PI > 7: clay. LL < 50: CL. Program: CL." },
      },
      {
        q: { tr: "Çakıl %40, ince dane %15, LL = 30, PI = 12 olan zemin hangi sınıftır? (D_10 = 0.05, D_30 = 0.30, D_60 = 1.00 mm)", en: "What class is a soil with 40 % gravel, 15 % fines, LL = 30, PI = 12? (D_10 = 0.05, D_30 = 0.30, D_60 = 1.00 mm)" },
        a: { tr: "Kum (%45) > çakıl (%40): önek S. İnce dane %15 > %12: kıvam belirleyici. PI_A = 0.73 × 10 = 7.3; PI = 12 üstünde ve > 7: C. Sonuç SC. Program: SC.", en: "Sand (45 %) > gravel (40 %): prefix S. Fines 15 % > 12 %: consistency determines the class. PI_A = 0.73 × 10 = 7.3; PI = 12 is above it and > 7: C. Result SC. Program: SC." },
      },
      {
        q: { tr: "Çakıl %65, ince dane %4, D_10 = 0.5, D_30 = 1.5, D_60 = 5.0 mm: sınıf nedir?", en: "Gravel 65 %, fines 4 %, D_10 = 0.5, D_30 = 1.5, D_60 = 5.0 mm: what is the class?" },
        a: { tr: "Çakıl > kum: G. İnce dane < %5: yalnız dane dağılımı. C_u = 10 ≥ 4; C_c = 1.5² / (0.5 × 5) = 0.9 (1'in altında, P). Sonuç GP. Program: GP.", en: "Gravel > sand: G. Fines < 5 %: only grain distribution. C_u = 10 ≥ 4; C_c = 1.5² / (0.5 × 5) = 0.9 (below 1, P). Result GP. Program: GP." },
      },
      {
        q: { tr: "Kumda ince dane %8, LL = 30, PI = 9; D_10 = 0.10, D_30 = 0.20, D_60 = 0.50 mm. Sınıf nedir?", en: "In sand with 8 % fines, LL = 30, PI = 9; D_10 = 0.10, D_30 = 0.20, D_60 = 0.50 mm. What is the class?" },
        a: { tr: "%8 çift sembol aralığında. PI_A = 7.3; PI = 9 üstünde ve > 7: C. C_u = 5 (< 6, P); C_c = 0.04 / 0.05 = 0.8 (P). Sonuç SP-SC. Program: SP-SC.", en: "8 % is in the dual-symbol range. PI_A = 7.3; PI = 9 is above it and > 7: C. C_u = 5 (< 6, P); C_c = 0.04 / 0.05 = 0.8 (P). Result SP-SC. Program: SP-SC." },
      },
      {
        q: { tr: "Bir CPT noktasında I_c = 1.9 ise SBTn bölgesi kaçtır?", en: "For a CPT point with I_c = 1.9, what is the SBTn zone?" },
        a: { tr: "1.31 ≤ 1.9 < 2.05: bölge 6 (kum). Program: 6.", en: "1.31 ≤ 1.9 < 2.05: zone 6 (sand). Program: 6." },
      },
      {
        q: { tr: "I_c = 2.5 ve σ'_v = 100 kPa iken normalleştirme üssü n kaçtır? (n = 0.381 I_c + 0.05 σ'_v / P_a − 0.15)", en: "With I_c = 2.5 and σ'_v = 100 kPa, what is the normalisation exponent n? (n = 0.381 I_c + 0.05 σ'_v / P_a − 0.15)" },
        a: { tr: "n = 0.381 × 2.5 + 0.05 × (100 / 101.325) − 0.15 = 0.9525 + 0.0493 − 0.15 = 0.852. Program: 0.852.", en: "n = 0.381 × 2.5 + 0.05 × (100 / 101.325) − 0.15 = 0.9525 + 0.0493 − 0.15 = 0.852. Program: 0.852." },
      },
      {
        q: { tr: "Bir CPT noktasında q_t = 1200, f_s = 15, σ_v = 90, σ'_v = 70 kPa ise F_r ve bölge nedir?", en: "For a CPT point with q_t = 1200, f_s = 15, σ_v = 90, σ'_v = 70 kPa, what are F_r and the zone?" },
        a: { tr: "F_r = 15 / (1200 − 90) × 100 = 1.35 %. Program iterasyonu I_c = 2.66 bulur; 2.60 ile 2.95 arasında olduğu için bölge 4 (silt karışımı). Program: F_r 1.351, bölge 4.", en: "F_r = 15 / (1200 − 90) × 100 = 1.35 %. The program iteration finds I_c = 2.66; since it lies between 2.60 and 2.95, zone 4 (silt mixtures). Program: F_r 1.351, zone 4." },
      },
      {
        q: { tr: "Çakıl oranı bilinmeden USCS sınıfı hesaplanırsa program 'complete' değerini ne yapar ve neden?", en: "If the USCS class is computed without the gravel fraction, what does the program do with the 'complete' value, and why?" },
        a: { tr: "complete = false döner: çakıl bilinmediğinden kum baskın kabul edilir ve bu varsayım notlara yazılır.", en: "complete = false is returned: since the gravel fraction is unknown, the soil is assumed to be sand-dominated, and this assumption is written to the notes." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Elek analizi", en: "Sieve analysis" }, def: { tr: "Kuru zemin numunesinin elek serisinden geçirilerek dane boyutu dağılımının belirlenmesi.", en: "Determination of the grain size distribution by passing a dry soil sample through a series of sieves." } },
      { term: { tr: "No. 200 eleği", en: "No. 200 sieve" }, def: { tr: "Açıklığı 0.075 mm olan elek; USCS'de kaba ve ince dane ayrımı için kullanılır.", en: "A sieve with an opening of 0.075 mm; used in USCS to separate coarse and fine grains." } },
      { term: { tr: "Çakıl ve kum", en: "Gravel and sand" }, def: { tr: "USCS'de 4.75 mm eleğiyle ayrılan kaba daneli sınıflar: çakıl > 4.75 mm, kum 0.075 ile 4.75 mm arası.", en: "The coarse-grained classes separated by the 4.75 mm sieve in USCS: gravel > 4.75 mm, sand between 0.075 and 4.75 mm." } },
      { term: { tr: "İnce dane", en: "Fines" }, def: { tr: "0.075 mm'nin altındaki silt ve kil daneleri; yüzdesi USCS'de ana karar ölçütüdür.", en: "Silt and clay particles below 0.075 mm; their percentage is the main decision criterion in USCS." } },
      { term: { tr: "D_10, D_30, D_60", en: "D_10, D_30, D_60" }, def: { tr: "Kütlece yüzde 10, 30 ve 60'ın geçtiği dane çapları [mm].", en: "Particle diameters at which 10, 30 and 60 percent by mass pass [mm]." } },
      { term: { tr: "C_u (düzgünlük katsayısı)", en: "C_u (coefficient of uniformity)" }, def: { tr: "D_60 / D_10. Büyük değer geniş dane dağılımını gösterir.", en: "D_60 / D_10. A large value indicates a wide grain size distribution." } },
      { term: { tr: "C_c (eğrilik katsayısı)", en: "C_c (coefficient of curvature)" }, def: { tr: "D_30² / (D_10 · D_60). İyi derecelenme için yaklaşık 1 ile 3 arasında beklenir.", en: "D_30² / (D_10 · D_60). For good grading a value of about 1 to 3 is expected." } },
      { term: { tr: "İyi / kötü derecelenmiş (W / P)", en: "Well / poorly graded (W / P)" }, def: { tr: "C_u ve C_c eşiklerini sağlayan (W) ya da sağlamayan (P) kaba zemin.", en: "Coarse soil that satisfies (W) or does not satisfy (P) the C_u and C_c thresholds." } },
      { term: { tr: "Likit limit (LL)", en: "Liquid limit (LL)" }, def: { tr: "Zeminin akmaya başladığı su muhtevası (yüzde).", en: "The water content (in percent) at which the soil begins to flow." } },
      { term: { tr: "Plastik limit (PL)", en: "Plastic limit (PL)" }, def: { tr: "Zeminin çatlamadan rulo yapılabildiği en düşük su muhtevası (yüzde).", en: "The lowest water content (in percent) at which the soil can be rolled into threads without cracking." } },
      { term: { tr: "Plastisite indisi (PI)", en: "Plasticity index (PI)" }, def: { tr: "PI = LL − PL. Plastik davranış aralığının genişliği.", en: "PI = LL − PL. The width of the plastic range." } },
      { term: { tr: "A-çizgisi", en: "A-line" }, def: { tr: "Plastisite kartında PI = 0.73 (LL − 20) ile verilen ayırıcı çizgi; üstü kil, altı silt davranışı.", en: "The dividing line PI = 0.73 (LL − 20) on the plasticity chart; above it clay behaviour, below it silt behaviour." } },
      { term: { tr: "U-çizgisi", en: "U-line" }, def: { tr: "Doğal zeminlerin üst sınırını veren PI = 0.9 (LL − 8) çizgisi; üstünde kalan deney şüphelidir.", en: "The line PI = 0.9 (LL − 8) giving the upper limit of natural soils; a test lying above it is suspect." } },
      { term: { tr: "Çift sembol (örn. SW-SC)", en: "Dual symbol (e.g. SW-SC)" }, def: { tr: "İnce dane yüzdesi %5 ile %12 arasında olan zeminde hem dane dağılımı hem kıvam sembolünün yazılması.", en: "Writing both the grain distribution and consistency symbols for a soil with fines between 5 % and 12 %." } },
      { term: { tr: "CPT", en: "CPT" }, def: { tr: "Konik penetrasyon deneyi: uç direnci, yan sürtünme ve boşluk suyu basıncının sürekli ölçümü.", en: "Cone penetration test: continuous measurement of tip resistance, sleeve friction and pore water pressure." } },
      { term: { tr: "q_t", en: "q_t" }, def: { tr: "Düzeltilmiş uç direnci: q_c + u_2 (1 − a) [kPa].", en: "Corrected tip resistance: q_c + u_2 (1 − a) [kPa]." } },
      { term: { tr: "F_r (sürtünme oranı)", en: "F_r (friction ratio)" }, def: { tr: "f_s / (q_t − σ_v) × 100 [%]. Normalleştirilmiş sürtünme.", en: "f_s / (q_t − σ_v) × 100 [%]. Normalised friction." } },
      { term: { tr: "Q_tn", en: "Q_tn" }, def: { tr: "Efektif gerilmeye göre normalleştirilmiş uç direnci (boyutsuz).", en: "Tip resistance normalised to effective stress (dimensionless)." } },
      { term: { tr: "I_c (davranış indeksi)", en: "I_c (behaviour index)" }, def: { tr: "Q_tn ve F_r'den hesaplanan, zemin davranışını bölgeye çeviren boyutsuz indeks.", en: "The dimensionless index computed from Q_tn and F_r that converts soil behaviour to a zone." } },
      { term: { tr: "n (üs)", en: "n (exponent)" }, def: { tr: "Q_tn normalleştirmesindeki üs; I_c ve σ'_v ile iteratif hesaplanır, 0 ile 1 arasında sınırlanır.", en: "The exponent in the Q_tn normalisation; computed iteratively with I_c and σ'_v and limited between 0 and 1." } },
      { term: { tr: "SBTn bölgesi", en: "SBTn zone" }, def: { tr: "Normalleştirilmiş davranış tipi (1 ile 9). Program 2 ile 7 arasını I_c ile, bölge 1'i ayrıca belirler.", en: "Normalised soil behaviour type (1 to 9). The program determines zones 2 to 7 from I_c and zone 1 separately." } },
      { term: { tr: "P_a", en: "P_a" }, def: { tr: "Atmosfer basıncı, 101.325 kPa; normalleştirmede birim olarak kullanılır.", en: "Atmospheric pressure, 101.325 kPa; used as a unit in normalisation." } },
    ],
  },
  {
    type: "reading",
    items: [
      "ASTM D2487 (USCS) - bu oturumda açılamadı; sınıf sınırları ve çift sembol kuralları kendi kopyanızdan doğrulanmalı.",
      "Casagrande, A. (1948), plastisite kartı ve A-çizgisi - doğrulanamadı; 0.73 katsayısı bu metinde kod sabitinden alınmıştır.",
      "Robertson, P.K. (1990). Soil classification using the cone penetration test. Can. Geotech. J. 27(1) - kodda atıf; bu oturumda açılmadı.",
      "Robertson, P.K. (2009). Interpretation of cone penetration tests - a unified approach. Can. Geotech. J. 46(11) - n ve I_c bağıntıları için kodda atıf; bu oturumda açılmadı.",
      "Robertson, P.K. (2010). Soil behaviour type from the CPT: an update. 2nd Int. Symp. on CPT - bölge 8 ve 9 sınırları için kodda not; program bunları kapalı tutar.",
    ],
  },
];
