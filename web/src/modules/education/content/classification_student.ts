import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Zemini neden sınıflandırırız", en: "1. Why we classify soil" } },
  {
    type: "p",
    text: {
      tr: "Bir market rafında benzer ürünler aynı yere konur ki aradığınızı hızla bulabilesiniz. Zemin mühendisliğinde sınıflandırmanın amacı da budur: birbirine benzeyen zeminleri aynı adla anarak, bir sondaj kuyusundan ya da CPT sondajından gelen çok sayıda ölçümü tek bir dile çevirmek. Raporda 'kumlu kil' yazmak yerine 'SC' ya da 'CL' gibi bir grup sembolü kullanmak, başka bir mühendisin aynı zemini aynı şekilde anlamasını sağlar. Sınıflandırma zemin davranışını hesaplamaz; yalnız hangi hesap yönteminin ve hangi tipik değer aralığının akla yatkın olduğunu gösterir. Bu yüzden bir sembol bir sonuç değil, bir başlangıç varsayımıdır.",
    },
  },
  
  {
    type: "p",
    text: {
      tr: "Bu konuda iki farklı yol anlatılır. Birincisi USCS (Birleşik Zemin Sınıflandırma Sistemi), laboratuvar deneyleriyle, yani elek analizi ve kıvam limitleriyle çalışır; sonuç SW, CL, MH gibi iki harfli bir gruptur. İkincisi Robertson'ın SBT yöntemidir: CPT'de ölçülen uç direnci (q_c), yan sürtünme (f_s) ve boşluk suyu basıncından (u_2) normalleştirilmiş parametreler üretir ve bir davranış bölgesi verir. Biri numune üzerinde, diğeri yerinde ölçümle çalışır; ikisi aynı zemini farklı gözlerle görür ve farklı sonuçlar verebilir. Hangisine güveneceğiniz, elinizdeki veriye ve yapının önemine bağlıdır.",
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
      tr: "Bir zeminin dane boyutu dağılımını anlamak için kuru numune bir elek serisinden geçirilir. Elek açıklığı küçüldükçe elekten geçen yüzde de azalır. USCS'de ana ayrım 0.075 mm'lik elek (No. 200) ile yapılır: bu elekte kalan tanelere kaba dane, geçen tanelere ince dane (silt ve kil) denir. Kaba daneler ayrıca 4.75 mm'lik elekte (No. 4) çakıl ve kum olarak ayrılır. Dane boyutu milimetre cinsinden verilir ve grafikte logaritmik eksende çizilir, çünkü bir çakıl ile bir kil tanesi arasındaki boyut farkı binlerce kat olabilir. Hidrometre deneyi 0.075 mm'nin altındaki ince daneleri de dağılım eğrisine ekler; ama USCS sınıfı ince dane yüzdesine ve kıvama bakar, hidrometre sonucunun tamamına değil.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Dağılım eğrisinden üç büyüklük okunur: D_10, D_30 ve D_60; bunlar kütlece yüzde 10, 30 ve 60'ının geçtiği dane çaplarıdır. Düzgünlük katsayısı C_u = D_60 / D_10, eğrilik (derecelenme) katsayısı C_c = D_30² / (D_10 · D_60) ile hesaplanır. İyi derecelenmiş bir zeminde C_u büyük olmalı ve C_c yaklaşık 1 ile 3 arasında kalmalıdır. Neredeyse tek boyutlu taneler (düzgün kum) C_u'yu küçük bırakır; çok sayıda boyutun karışması C_u'yu büyütür. USCS'de kum için C_u ≥ 6, çakıl için C_u ≥ 4 eşiği kullanılır ve GeoTek kodu da aynı eşikleri uygular. Bu eşikler ve C_c aralığı sonucun W mi P mi olacağını belirler.",
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
      { tr: "Çakıl = 0 %, ince dane (0.075 mm altı) = 10 %, kum = 90 %" },
      { tr: "D_10 = 0.10 mm, D_30 = 0.30 mm, D_60 = 0.70 mm" },
      { tr: "Kıvam (ince daneler için): LL = 35, PI = 15" },
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
      note: { tr: "Elle hesap programla aynı sonucu verdi. Sonuç yalnız D değerleri ve kıvam ölçümü doğruysa geçerlidir; 'SC' ve 'SW' birlikte yazılır, tek başına 'SW' yazılmaz." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "C_u'da D_60 ile D_10'u ters yazmak; doğru sonuçta C_u her zaman 1'den büyük çıkar." },
      { tr: "C_c'de D_30'u karesiz yazmak. Doğrusu C_c = D_30² / (D_10 · D_60)'tır." },
      { tr: "Elek sonuçlarını yüzde yerine gram olarak girip toplamı 100 yapmamak; kütle oranı yüzdeye çevrilmelidir." },
    ],
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Kıvam limitleri ve plastisite kartı", en: "3. Atterberg limits and the plasticity chart" } },
  {
    type: "p",
    text: {
      tr: "İnce daneli bir zemin su eklendikçe katı, yarı katı, plastik ve sıvı gibi davranır. Bu geçişleri ölçmek için Atterberg limitleri kullanılır. Sıvı limit LL, zeminin akmaya başladığı su muhtevasıdır (yüzde). Plastik limit PL, zeminin çatlamadan rulo yapılabildiği en düşük su muhtevasıdır. Plastisite indisi PI = LL − PL, zeminin plastik davranış aralığının genişliğidir. Kil hamuru benzetmesi yardımcı olur: çok az suyla ufalanır, çok suyla çamura döner, PI bu iki eşik arasındaki farktır. PI yüksekse zemin yapışkan ve sıkıştırılabilirdir; PI düşükse silt gibi davranır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Casagrande'nin plastisite kartında yatay eksen LL, düşey eksen PI'dır. Program iki çizgi kullanır: A-çizgisi PI = 0.73 (LL − 20) ve U-çizgisi PI = 0.9 (LL − 8). Doğal zeminlerin neredeyse tamamı U-çizgisinin altında kalır; bunun üstündeki bir nokta genellikle hatalı deneyi gösterir ve program bunu uyarı olarak işaretler. A-çizginin üstü kil, altı silt davranışına yakındır. Kodda ince dane sınıfı şöyle verilir: PI < 4 veya A-çizgisinin altındaysa M (silt); PI > 7 ve A-çizgisinin üstündeyse C (kil); arada kalan (4 ile 7 arası PI) bölge CL-ML'dir. Sayısal sınırları yine de kendi kaynağınızdan doğrulayın; bu metin kodun uyguladığı kuralı anlatır.",
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
      { tr: "İnce dane yüzdesi 60 % (çoğunluğu ince dane)" },
      { tr: "LL = 40, PI = 18" },
    ],
    steps: [
      { label: { tr: "A-çizgisi", en: "A-line" }, expr: "PI_A = 0.73 (40 − 20) = 14.6", result: "PI = 18 ≥ 14.6: A-çizgisinin üstü" },
      { label: { tr: "Plastisite sınıfı", en: "Plasticity class" }, expr: "PI = 18 > 7", result: "C (kil)" },
      { label: { tr: "LL < 50 mi?", en: "LL below 50?" }, expr: "LL = 40 < 50", result: "düşük plastisiteli: CL" },
    ],
    program: {
      input: "classify(fines=60, gravel=0, LL=40, PI=18)",
      output: "symbol = 'CL', complete = true, notes = ['Organic soils (OL/OH) not checked']",
      note: { tr: "Sonuç el hesabıyla aynı. Notta organik kontrolünün yapılmadığı yazıyor; bu bir eksik değil, programın kapsam sınırıdır." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "LL ve PI'yi karıştırmak: PI her zaman LL − PL'dir; PI'yi LL gibi okumak zemini yanlış bölgeye koyar." },
      { tr: "A-çizgisini PI = LL − 20 diye yazmak; katsayı 0.73'tür." },
      { tr: "LL = 50 sınırını unutmak. LL ≥ 50 ise CH/MH, LL < 50 ise CL/ML kullanılır." },
      { tr: "U-çizgisinin üstünde kalan bir deney sonucunu kabul etmek; bu genellikle hatalı deney ya da kayıt işaretidir." },
    ],
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. USCS karar akışı ve çift semboller", en: "4. USCS decision flow and dual symbols" } },
  {
    type: "p",
    text: {
      tr: "USCS karar akışı önce ince dane oranına bakar. İnce dane yüzdesi %50 veya üstündeyse zemin ince daneli kabul edilir ve sınıf yalnızca LL ve PI ile belirlenir: LL < 50 ise CL, ML veya CL-ML; LL ≥ 50 ise CH veya MH. Bu durumda çakıl-kum oranı sınıfı değiştirmez. İnce dane oranı %50'nin altındaysa zemin kaba daneli kabul edilir ve ilk harf G (çakıl) ya da S (kum) olur. Çakıl ile kum arasındaki seçim, kaba fraksiyonda çakılın kumdan fazla olup olmadığına bakar: çakıl daha fazlaysa G, değilse S.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kaba daneli zeminde ince dane yüzdesi üç bölgeye ayrılır. Yüzde 5'ten azsa yalnız dane dağılımı belirleyicidir ve ikinci harf W (iyi derecelenmiş) ya da P (kötü derecelenmiş) olur. Yüzde 12'den fazlaysa ince danelerin kıvamı belirleyicidir: ikinci harf M veya C olur; CL-ML bölgesindeki bir zemin ise SC-SM gibi bir çift sembol alır. Yüzde 5 ile 12 arasında kalan zeminler çift sembolle yazılır, örneğin SW-SC; bu, zeminin hem dane dağılımı hem ince dane davranışı açısından sınırda olduğunu gösterir. Kodda iki eksik veri durumu da vardır: çakıl oranı bilinmiyorsa sınıf kumu baskın kabul eder ve sonucu tamamlanmamış sayar; D değerleri yoksa zemini kötü derecelenmiş kabul eder. Bu varsayımlar notes alanında görünür.",
    },
  },
  
  {
    type: "steps",
    title: { tr: "USCS'yi elle sınıflandırma sırası", en: "Hand USCS sequence" },
    items: [
      { tr: "İnce dane yüzdesini elek sonucundan (0.075 mm altı) belirleyin. %50 ve üstüyse LL ve PI ile devam edin." },
      { tr: "Kaba daneliyse çakıl ile kum oranını karşılaştırın; büyük olan önek (G veya S) olur." },
      { tr: "İnce dane yüzdesine göre tek, çift veya kıvam sembolü seçin (<%5, %5-12, >%12)." },
      { tr: "C_u ve C_c'yi hesaplayıp W ya da P seçin. Eşikler: çakıl için C_u ≥ 4, kum için C_u ≥ 6; her ikisinde 1 ≤ C_c ≤ 3." },
      { tr: "Eksik veri varsa sonucu tamamlanmamış sayın ve yaptığınız varsayımı yazın." },
    ],
  },
  {
    type: "mistakes",
    items: [
      { tr: "Çakıl-kum seçimini tüm zemin üzerinden değil kaba fraksiyon üzerinden yapmamak; önek hangi fraksiyona göre belirlenir." },
      { tr: "%5 ile %12 arasındaki zemini tek sembolle yazmak; bu aralık için çift sembol zorunludur." },
      { tr: "Eksik C_u veya D değerlerini sessizce 'iyi derecelenmiş' kabul etmek; kod bunları 'kötü derecelenmiş' yapar ve sonucu tamamlanmamış sayar." },
      { tr: "Organik bir zemini (OL/OH) yalnız LL ve PI ile CL ya da MH olarak yazmak; fırınlanmış LL ölçümü gerekir." },
    ],
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. CPT ile davranış tipi: q_t, F_r, Q_tn, I_c", en: "5. CPT behaviour type: q_t, F_r, Q_tn, I_c" } },
  {
    type: "p",
    text: {
      tr: "CPT (konik penetrasyon deneyi), konik bir ucu sabit hızla zemine iterek üç ana ölçüm alır: uç direnci q_c, yan sürtünme f_s ve bazen uç arkasındaki boşluk suyu basıncı u_2. Ölçümler derinlikle birlikte kaydedilir ve zemin tipini sürekli bir profil olarak gösterir. Ancak q_c, derinlikle ve efektif gerilmeyle birlikte değişir: sığ bir yumuşak kil ile derin bir sıkı kum farklı q_c verir, ama bu yalnız gerilme farkından kaynaklanır. Robertson bu nedenle değerleri efektif gerilmeye göre normalleştirir ve zemin davranışını derinlikten bağımsız bir sayıyla anlatır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Düzeltilmiş uç direnci q_t = q_c + u_2 (1 − a) ile hesaplanır; a alan oranıdır ve u_2 ölçülmemişse q_t = q_c alınır. Sürtünme oranı F_r = f_s / (q_t − σ_v) × 100 ile yüzde olarak verilir; burada σ_v toplam düşey gerilmedir. Normalleştirilmiş uç direnci Q_tn = ((q_t − σ_v) / P_a) (P_a / σ'_v)^n ile tanımlanır, P_a = 101.325 kPa atmosfer basıncıdır. Üs n, Robertson (2009) bağıntısıyla n = 0.381 I_c + 0.05 (σ'_v / P_a) − 0.15 olarak verilir ve 0 ile 1 arasında sınırlanır. n ile I_c birbirine bağlı olduğundan program bunları iteratif olarak birlikte çözer.",
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
      tr: "I_c, zemin davranış indeksidir ve kodda şu sınırlarla bölgeye çevrilir: I_c < 1.31 ise bölge 7 (çakıllı kum), 1.31 ile 2.05 arası bölge 6 (kum), 2.05 ile 2.60 arası bölge 5 (kum karışımı), 2.60 ile 2.95 arası bölge 4 (silt karışımı), 2.95 ile 3.60 arası bölge 3 (kil), 3.60 üstü bölge 2 (organik kil) olur. Bölge 1 (hassas, ince daneli) ayrıca, Q_tn < 12 exp(−1.4 F_r) koşulu sağlandığında atanır. Program bölge 8 ve 9 için yazılmış sınırları varsayılan olarak kapalı tutar; bu sınırların kaynakta doğrulanması beklenir. I_c'nin 2.6 altı değerleri kum benzeri davranışı gösterir; bu eşik sıvılaşma modülünde ayrıca kullanılır, ama bu konunun konusu değildir.",
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
      { tr: "q_t = 5000 kPa, f_s = 50 kPa, σ_v = 100 kPa, σ'_v = 80 kPa (u_0 = 20 kPa)" },
      { tr: "Yalnız bu nokta için; u_2 ölçülmediği varsayılıyor, q_t = q_c kabul edilir" },
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
      note: { tr: "El hesabının ilk turu programın sonucuna yaklaşır; fark tur sayısı ve yuvarlamadan gelir. Program tolerans 1e-3 ile yakınsar." },
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: yumuşak kil, q_t = 800, f_s = 60 kPa", en: "Example 4: soft clay CPT" },
    given: [
      { tr: "q_t = 800 kPa, f_s = 60 kPa, σ_v = 100 kPa, σ'_v = 80 kPa" },
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
      note: { tr: "n tavanda kalmıştır. Bu durum yüksek I_c'li zeminlerde beklenir ve bölge 3 sonucunu değiştirmez." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Ham q_c değerini normalleştirme olmadan Q_tn yerine kullanmak; derinlikler arası kıyas yanlış olur." },
      { tr: "F_r'yi yüzde yerine oran olarak yazmak (1.02 ile 0.0102 karışıklığı); log F_r terimi yanlış çıkar." },
      { tr: "σ_v (toplam) ile σ'_v (efektif) değerlerini karıştırmak; F_r'de toplam, Q_tn ve n'de efektif gerilme kullanılır." },
      { tr: "I_c değerini bölge sınırında tam sayıya yuvarlamak; 2.60 ile 2.61 farklı bölgelerdir." },
      { tr: "Bölge 1 (hassas) kriterini hiç kontrol etmemek; Q_tn < 12 exp(−1.4 F_r) koşulu ayrıca bakılmalıdır." },
      { tr: "SBTn bölgesini kesin zemin sınıfı gibi okumak; bu bir davranış tipidir, USCS sembolü değildir." },
    ],
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Sınırlar ve eksik veri", en: "6. Limits and missing data" } },
  
  {
    type: "p",
    text: {
      tr: "Her sınıflandırma sonucu girdisi kadar güvenilirdir. Elek analizi yoksa ya da çakıl oranı ve D değerleri bilinmiyorsa USCS sembolü yine üretilebilir, ama bu sembol eksik veriye dayanır. GeoTek bu durumda sonucu tamamlanmamış (complete = false) işaretler ve varsayımı notlara yazar; bu bir hata değil, dürüst bir ara sonuçtur. Benzer şekilde bir CPT noktasında q_t ≤ σ_v, σ'_v ≤ 0 ya da f_s ≤ 0 ise I_c tanımsızdır; program bu noktayı NaN bırakır ve bölge 0 verir. Bölge 0'ı 'bilinmiyor' olarak okuyun, zemin tipi olarak değil.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Robertson bölgeleri kesin çizgiler değil, bir sınıflandırma haritasıdır. Sınır değerleri (1.31, 2.05, 2.60, 2.95, 3.60) grafikten yaklaşık okunmuş ve sonradan düzeltilmiş değerlerdir; kaynakta farklı revizyonlar bulunabilir. I_c yalnız normalleştirilmiş davranışı anlatır; sıkılık bu sınıflamada doğrudan yer almaz, yani gevşek ve sıkı kum aynı bölgeye düşebilir. Bu yüzden CPT sonucu, laboratuvar ya da SPT verisiyle çapraz kontrol edilmelidir.",
    },
  },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "D_10 = 0.20, D_30 = 0.50, D_60 = 2.00 mm ve ince dane %3 olan kumun C_u ve C_c değerleri nedir? Program ne döndürür?" },
        a: { tr: "C_u = 2.00 / 0.20 = 10; C_c = 0.50² / (0.20 × 2.00) = 0.625. C_c 1 ile 3 arasında değil; sınıf SP (kötü derecelenmiş kum). Program: SP." },
      },
      {
        q: { tr: "LL = 45, PI = 23 ve ince dane yüzdesi %70 olan zemin hangi USCS sınıfındadır?" },
        a: { tr: "PI_A = 0.73 (45 − 20) = 18.25; PI = 23 ≥ 18.25 ve PI > 7: kil. LL < 50: CL. Program: CL." },
      },
      {
        q: { tr: "Çakıl %40, ince dane %15, LL = 30, PI = 12 olan zemin hangi sınıftır? (D_10 = 0.05, D_30 = 0.30, D_60 = 1.00 mm)" },
        a: { tr: "Kum (%45) > çakıl (%40): önek S. İnce dane %15 > %12: kıvam belirleyici. PI_A = 0.73 × 10 = 7.3; PI = 12 üstünde ve > 7: C. Sonuç SC. Program: SC." },
      },
      {
        q: { tr: "Çakıl %65, ince dane %4, D_10 = 0.5, D_30 = 1.5, D_60 = 5.0 mm: sınıf nedir?" },
        a: { tr: "Çakıl > kum: G. İnce dane < %5: yalnız dane dağılımı. C_u = 10 ≥ 4; C_c = 1.5² / (0.5 × 5) = 0.9 (1'in altında, P). Sonuç GP. Program: GP." },
      },
      {
        q: { tr: "Kumda ince dane %8, LL = 30, PI = 9; D_10 = 0.10, D_30 = 0.20, D_60 = 0.50 mm. Sınıf nedir?" },
        a: { tr: "%8 çift sembol aralığında. PI_A = 7.3; PI = 9 üstünde ve > 7: C. C_u = 5 (< 6, P); C_c = 0.04 / 0.05 = 0.8 (P). Sonuç SP-SC. Program: SP-SC." },
      },
      {
        q: { tr: "Bir CPT noktasında I_c = 1.9 ise SBTn bölgesi kaçtır?" },
        a: { tr: "1.31 ≤ 1.9 < 2.05: bölge 6 (kum). Program: 6." },
      },
      {
        q: { tr: "I_c = 2.5 ve σ'_v = 100 kPa iken normalleştirme üssü n kaçtır? (n = 0.381 I_c + 0.05 σ'_v / P_a − 0.15)" },
        a: { tr: "n = 0.381 × 2.5 + 0.05 × (100 / 101.325) − 0.15 = 0.9525 + 0.0493 − 0.15 = 0.852. Program: 0.852." },
      },
      {
        q: { tr: "Bir CPT noktasında q_t = 1200, f_s = 15, σ_v = 90, σ'_v = 70 kPa ise F_r ve bölge nedir?" },
        a: { tr: "F_r = 15 / (1200 − 90) × 100 = 1.35 %. Program iterasyonu I_c = 2.66 bulur; 2.60 ile 2.95 arasında olduğu için bölge 4 (silt karışımı). Program: F_r 1.351, bölge 4." },
      },
      {
        q: { tr: "Çakıl oranı bilinmeden USCS sınıfı hesaplanırsa program 'complete' değerini ne yapar ve neden?" },
        a: { tr: "complete = false döner: çakıl bilinmediğinden kum baskın kabul edilir ve bu varsayım notlara yazılır." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Elek analizi" }, def: { tr: "Kuru zemin numunesinin elek serisinden geçirilerek dane boyutu dağılımının belirlenmesi." } },
      { term: { tr: "No. 200 eleği" }, def: { tr: "Açıklığı 0.075 mm olan elek; USCS'de kaba ve ince dane ayrımı için kullanılır." } },
      { term: { tr: "Çakıl ve kum" }, def: { tr: "USCS'de 4.75 mm eleğiyle ayrılan kaba daneli sınıflar: çakıl > 4.75 mm, kum 0.075 ile 4.75 mm arası." } },
      { term: { tr: "İnce dane" }, def: { tr: "0.075 mm'nin altındaki silt ve kil daneleri; yüzdesi USCS'de ana karar ölçütüdür." } },
      { term: { tr: "D_10, D_30, D_60" }, def: { tr: "Kütlece yüzde 10, 30 ve 60'ın geçtiği dane çapları [mm]." } },
      { term: { tr: "C_u (düzgünlük katsayısı)" }, def: { tr: "D_60 / D_10. Büyük değer geniş dane dağılımını gösterir." } },
      { term: { tr: "C_c (eğrilik katsayısı)" }, def: { tr: "D_30² / (D_10 · D_60). İyi derecelenme için yaklaşık 1 ile 3 arasında beklenir." } },
      { term: { tr: "İyi / kötü derecelenmiş (W / P)" }, def: { tr: "C_u ve C_c eşiklerini sağlayan (W) ya da sağlamayan (P) kaba zemin." } },
      { term: { tr: "Likit limit (LL)" }, def: { tr: "Zeminin akmaya başladığı su muhtevası (yüzde)." } },
      { term: { tr: "Plastik limit (PL)" }, def: { tr: "Zeminin çatlamadan rulo yapılabildiği en düşük su muhtevası (yüzde)." } },
      { term: { tr: "Plastisite indisi (PI)" }, def: { tr: "PI = LL − PL. Plastik davranış aralığının genişliği." } },
      { term: { tr: "A-çizgisi" }, def: { tr: "Plastisite kartında PI = 0.73 (LL − 20) ile verilen ayırıcı çizgi; üstü kil, altı silt davranışı." } },
      { term: { tr: "U-çizgisi" }, def: { tr: "Doğal zeminlerin üst sınırını veren PI = 0.9 (LL − 8) çizgisi; üstünde kalan deney şüphelidir." } },
      { term: { tr: "Çift sembol (örn. SW-SC)" }, def: { tr: "İnce dane yüzdesi %5 ile %12 arasında olan zeminde hem dane dağılımı hem kıvam sembolünün yazılması." } },
      { term: { tr: "CPT" }, def: { tr: "Konik penetrasyon deneyi: uç direnci, yan sürtünme ve boşluk suyu basıncının sürekli ölçümü." } },
      { term: { tr: "q_t" }, def: { tr: "Düzeltilmiş uç direnci: q_c + u_2 (1 − a) [kPa]." } },
      { term: { tr: "F_r (sürtünme oranı)" }, def: { tr: "f_s / (q_t − σ_v) × 100 [%]. Normalleştirilmiş sürtünme." } },
      { term: { tr: "Q_tn" }, def: { tr: "Efektif gerilmeye göre normalleştirilmiş uç direnci (boyutsuz)." } },
      { term: { tr: "I_c (davranış indeksi)" }, def: { tr: "Q_tn ve F_r'den hesaplanan, zemin davranışını bölgeye çeviren boyutsuz indeks." } },
      { term: { tr: "n (üs)" }, def: { tr: "Q_tn normalleştirmesindeki üs; I_c ve σ'_v ile iteratif hesaplanır, 0 ile 1 arasında sınırlanır." } },
      { term: { tr: "SBTn bölgesi" }, def: { tr: "Normalleştirilmiş davranış tipi (1 ile 9). Program 2 ile 7 arasını I_c ile, bölge 1'i ayrıca belirler." } },
      { term: { tr: "P_a" }, def: { tr: "Atmosfer basıncı, 101.325 kPa; normalleştirmede birim olarak kullanılır." } },
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
