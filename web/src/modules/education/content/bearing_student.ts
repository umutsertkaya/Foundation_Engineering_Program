import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Temel nedir, yük nasıl aktarılır, göçme biçimleri", en: "1. What a foundation is, how load is transferred, failure modes" } },
  {
    type: "p",
    text: {
      tr: "Bir binanın kolonları, duvarları ve döşemeleri topladığı yükü en sonunda zemine bırakır. Temel, bu yükü zemine yayan yapısal elemandır; sığ temel genellikle yüzeye yakın, genişliğine göre kısa derinlikte yerleşen (ayak, şerit ya da radye) temeldir. Sezgisel bir benzetme için kar ayakkabısını düşünün: ağırlığınız aynı olsa da geniş taban, karın içine daha az batmanızı sağlar. Temel genişliği B arttıkça yük daha geniş bir alana yayılır ve zeminin birim alana düşen yükü azalır. Ama genişlik her zaman yeterli değildir; zemin, yük belli bir sınırı aşarsa kayarak ya da ezilerek göçer. Taşıma gücü problemi, bu sınırın ne olduğunu ve ne kadar emniyet bırakmamız gerektiğini sorar.",
      en: "A foundation spreads the building load into the soil.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Temelin zemine yaptığı basınç q ile gösterilir ve birimi kPa = kN/m²'dir. Şerit temelde (uzunluğu çok büyük, her metre için aynı kesit) yük birim uzunluk başına kN/m olarak verilir; bu durumda kapasite de kN/m çıkar. Sığ temelin tabanı, yüzeyden derinlik D kadar aşağıdadır ve D ile B arasındaki oran D/B, derinliğin göreli büyüklüğünü söyler. Genel bir kural olarak D/B küçükse temel sığ kabul edilir; bu sınır kaynaktan kaynağa biraz değişir, bu yüzden kesin bir eşik vermiyoruz ve Das'ın sığ/derin temel tanımına bakmanızı öneririz. GeoTek'in bu konudaki hesabı sığ temel içindir; kazıklı ya da derin temel bu modülün kapsamı dışındadır.", en: "The pressure the footing exerts on the soil, q, is in kPa = kN/m². For a strip footing (very long, same section along its length) the load is given per unit length in kN/m, and the capacity then also comes out in kN/m. The base of a shallow footing lies at depth D below the surface, and the ratio D/B indicates the relative size of the depth. As a general rule, a footing with a small D/B is considered shallow; this boundary varies somewhat from source to source, so we do not give a precise threshold, and we recommend checking Das's definition of shallow and deep foundations. GeoTek's calculation here is for shallow foundations; piled or deep foundations are outside the scope of this module.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Taşıma gücü (q_ult), zeminin kırılmadan taşıyabileceği en büyük temel basıncıdır. Bu değer bir 'son' değerdir: zemin bu basınçta ani bir göçme yaşar ve temel ciddi biçimde oturur ya da devrilir. Gündelik hayattaki karşılığı, bir kayanın yüzeyine ağırlık koyup yavaşça artırmaktır; bir noktada yüzey aniden içe ya da yana çöker. Mühendislikte bu son değeri doğrudan kullanmayız, bir emniyet sayısına bölerek izin verilebilir basınç q_all üretiriz (bölüm 8). Yani tasarım, zeminin sınırına hiç yaklaşmamayı hedefler. Kapasite her zaman zemin özelliklerine (φ, c, γ), temel boyutlarına (B, D) ve yüke (eğim, eksantrisite) bağlıdır; hiçbiri tek başına yeterli değildir.", en: "Bearing capacity (q_ult) is the greatest footing pressure the soil can carry without failing. This value is an 'ultimate' value: at this pressure the soil fails suddenly and the footing settles or tilts severely. In everyday terms, it is like placing weight on a rock surface and gradually increasing it; at some point the surface suddenly caves in or pushes sideways. In engineering we do not use this ultimate value directly; we divide it by a factor of safety to get the allowable pressure q_all (section 8). In other words, design aims to stay well away from the limit of the soil. Capacity always depends on the soil properties (φ, c, γ), the footing dimensions (B, D) and the load (inclination, eccentricity); none of these alone is sufficient.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Zemin üç farklı biçimde göçebilir ve Terzaghi bu ayrımı klasik hale getirmiştir. Genel kayma (general shear) göçmesinde temel altındaki zemin, tabanın iki yanında yüzeye kadar uzanan bir kayma yüzeyi oluşturur; sonuçta temelin yanındaki zemin kabarır ve göçme ani, tam ve tek taraflıdır. Bu biçim sıkı kumda ve katı killerde görülür. Lokal kayma (local shear) göçmesinde kayma yüzeyleri yüzeye kadar tamamlanmaz, zemin ezilir ve oturma büyür; kabarma zayıf ya da hiç yoktur ve göçme daha yavaştır. Delme kayması (punching shear) göçmesinde temel, altındaki zemine düşey olarak 'delinir' gibi batar; yanlardaki yüzeyler kabarmaz, yalnızca temelin altındaki bir hacim düşey yönde kayar. Bu biçim gevşek kumda ve yumuşak killerde görülür.",
      en: "General, local and punching shear failure.",
    },
  },
  {
    type: "figure",
    id: "bear-failure-wedge",
    caption: {
      tr: "Genel kayma göçmesi. Temel altında aktif kama (I), yanlarında radyal bölge (II) ve pasif kama (III) birlikte hareket eder, yüzeyde kabarma oluşur. Sağdaki yük-oturma eğrisinde yoğun zeminde belirgin bir tepe (q_u) görülür; gevşek zeminde tepe yoktur (yerel kayma).",
      en: "General shear failure. An active wedge (I) under the footing, radial zones (II) beside it and passive wedges (III) move together and the surface heaves. In the load-settlement curve dense soil shows a clear peak (q_u); loose soil has none (local shear).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu üç biçim, kapasite hesabında doğrudan kullanılan bir sınıflandırma değildir ama ne tür bir hesabın hangi durumda anlamlı olduğunu seçmenize yardım eder. Genel kayma varsayımına dayanan Terzaghi ve Vesic bağıntıları, sıkı zeminlerde iyi sonuç verir; gevşek ya da yumuşak zeminde göçme lokal ya da delme biçiminde olduğu için aynı bağıntılar muhafazakâr ya da eksik kalabilir. Bu yüzden laboratuvar ya da arazi deneyinden elde edilen φ ve c değerinin hangi zemin durumuna ait olduğu önemlidir. Uygulamada mühendis, göçme biçimi konusunda zemin raporunu ve arazi gözlemini değerlendirir. Program bu seçimi kendisi yapmaz; girdi olarak aldığı φ ve c değerlerini kabul eder.", en: "These three modes are not a classification used directly in the capacity calculation, but they help you choose which kind of calculation is meaningful in which situation. The Terzaghi and Vesic equations, which assume general shear, give good results in dense soils; in loose or soft soils, because failure is local or punching, the same equations may be conservative or insufficient. That is why it matters which soil condition the φ and c values from laboratory or field tests belong to. In practice, the engineer assesses the failure mode from the soil report and field observation. The program does not make this choice itself; it accepts the φ and c values given as input.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınır: GeoTek'in bu modülü tek bir göçme biçimi seçmez; genel kayma varsayımıyla yazılmış bağıntıları uygular. Gevşek kum ya da yumuşak killi zeminde yalnızca bu sonuca bakmak, lokal ya da delme kaymasını göz ardı etmek anlamına gelir. Bu durumda zemin raporu ve ayrı bir değerlendirme gerekir.",
      en: "The program applies general-shear equations; it does not select a failure mode.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Terzaghi'nin mekanizması ve q_ult formülünün üç terimi", en: "2. Terzaghi's mechanism and the three terms of q_ult" } },
  {
    type: "p",
    text: {
      tr: "Terzaghi (1943), şerit temel altında oluşan kırılma bölgelerini bir zihinsel model olarak tarif etti. Temel tabanının hemen altında, tabanla φ açısı yapan üçgen bir aktif kama oluşur; bu kama temelle birlikte aşağı iter. Kamanın iki yanında, logaritmik spiral biçimli radyal bir bölge uzanır ve en dışta yüzeye doğru yükselen pasif Rankine kamaları yer alır. Her bölgenin zemine yaptığı direnç farklıdır, ama toplam kapasite bu üç bölgenin direnç katkılarının toplamıdır. Bu sezgi, formülün neden birkaç terimden oluştuğunu anlamanın anahtarıdır. Mekanizmanın ayrıntılı geometrisi Terzaghi'nin kendi kitabında ve Das'ın sığ temel bölümünde verilir; bu metinde yalnızca sonucun mantığını alıyoruz.",
      en: "Terzaghi's failure zones: active wedge, radial zone, passive wedge.",
    },
  },
  {
    type: "figure",
    id: "bear-terzaghi-zones",
    caption: {
      tr: "Terzaghi göçme bölgeleri (şerit temel kesiti): I temel altındaki aktif kama, II radyal bölge, III pasif kama. Taban seviyesinin üstündeki zemin q = γ·D'lik bir yük gibi etkir.",
      en: "Terzaghi failure zones (strip footing section): I active wedge under the footing, II radial zone, III passive wedge. The soil above the footing level acts as a surcharge q = γ·D.",
    },
  },
  {
    type: "formula",
    expr: "q_ult = c·N_c + q·N_q + ½·γ·B·N_γ      (şerit temel, Terzaghi biçimi)",
    caption: { tr: "Terzaghi'nin şerit temel için genel bağıntısı; GeoTek bu biçimi genelleştirerek kullanır", en: "Terzaghi's strip footing equation" },
    where: [
      { tr: "c: kohezyon [kPa]; q: temel tabanı seviyesindeki efektif üstyük [kPa]; γ: taban altındaki birim hacim ağırlığı [kN/m³]", en: "c: cohesion [kPa]; q: effective overburden at the footing base level [kPa]; γ: unit weight below the base [kN/m³]" },
      { tr: "B: temel genişliği [m]; N_c, N_q, N_γ: boyutsuz taşıma faktörleri (φ'nin fonksiyonu)", en: "B: footing width [m]; N_c, N_q, N_γ: dimensionless bearing capacity factors (functions of φ')" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Birinci terim c·N_c, zeminin kohezyonundan gelir. Kil gibi taneleri birbirine yapıştıran bir zeminde, kayma yüzeyi boyunca kohezyon kadar bir direnç vardır ve bu direnç, kayma yüzeyinin uzunluğuyla orantılıdır. Kohezyon kPa cinsindendir, dolayısıyla c·N_c de kPa çıkar. Kohezyonsuz kumda bu terim sıfırdır; kum tanelerinin kayma direnci yalnızca sürtünmeye ve ağırlığa dayanır. Bu nedenle c'nin kumda sıfır olması bir tasarım hatası değil, zeminin fiziksel bir sonucudur. Eğer zemin kil değil de killi bir kum ise, kohezyonu sıfır alıp kalan iki terimle çalışmak yanlış olmaz.",
      en: "The cohesion term.",
    },
  },
  {
    type: "p",
    text: {
      tr: "İkinci terim q·N_q, temel tabanının üstündeki zemin ağırlığının, kayma yüzeyinin üst kısmına uyguladığı yanal direnç ile ilgilidir. Sezgi şöyledir: temel D kadar gömülüyse, kayma yüzeyi bu D'lik zemin ağırlığını yukarı iterek kaldırmak zorundadır. Bu yan üstyük, kayma yüzeyinin her iki yanındaki zemini bastırır ve kapasiteyi artırır. Formüldeki q, temel tabanı seviyesindeki efektif üstyüktür; kumda ve killerde bu terim genellikle en büyük katkıyı verir, çünkü N_q, φ arttıkça hızla büyür. q'nun birimi kPa'dır ve N_q boyutsuzdur. Yeraltı suyu varsa q, su seviyesinin üstündeki toplam ağırlık ile altındaki efektif ağırlığın toplamıdır; bunu hesaplamak su modülünün işidir.",
      en: "The overburden term.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Üçüncü terim ½·γ·B·N_γ, temelin altındaki zeminin kendi ağırlığından gelir ve genişlikle orantılıdır. Kayma yüzeyinin altındaki zemin bir kama gibi aşağı itilir ve kamanın ağırlığı kayma direncine katkı verir; kama ne kadar geniş olursa bu katkı o kadar büyük olur. Bu yüzden genişlik B terimi çarpan olarak görünür. Yarım (½) katsayısı, kamanın geometrisinden gelir; kaynak olarak bunu Terzaghi ve Vesic'in türetiminde görebilirsiniz, biz burada sadece sonuç olarak kullanıyoruz. Üç terimin birimi de kPa'dır (γ·B kPa'dır çünkü γ kN/m³ ve B m'dir), bu yüzden toplam q_ult tek bir kPa değeri verir.",
      en: "The unit weight term.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Üç terimin neden birlikte toplandığını bir cümleyle söylemek gerekirse: zemin üç kaynaktan direnç gösterir, kohezyondan, üstündeki yükten ve kendi ağırlığından; her biri farklı bir zemin özelliğine ve farklı bir geometriye bağlıdır. Bu üç kaynağın her birini bir faktörle (N_c, N_q, N_γ) çarpmak, sürtünme açısının bu üç katkı üzerindeki farklı etkisini yakalamanın yoludur. Kohezyonsuz kumda ilk terim sıfır, killi zeminde ilk terim baskın olabilir. Bu düşünce, sonraki bölümlerdeki her faktörün neden orada olduğunu anlamanıza yardım eder.", en: "To state in one sentence why the three terms are added: the soil resists from three sources (cohesion, overburden and its own weight), and each depends on a different soil property and a different geometry. Multiplying each of these sources by a factor (N_c, N_q, N_γ) is the way to capture the different effect of the friction angle on these three contributions. In cohesionless sand the first term is zero; in clayey soil the first term can dominate. This reasoning helps you understand why each factor in the later sections is there.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat: Terzaghi'nin özgün N değerleri, bu metindeki Prandtl–Reissner ve Vesic değerleriyle aynı değildir. Örneğin Terzaghi'nin tablosunda φ = 30° için N_q yaklaşık 22.5 ve N_γ yaklaşık 19.7 olarak verilir; bu değerleri kendi kaynağınızdan doğrulayın. GeoTek programı Terzaghi'nin tablosunu kullanmaz; bölüm 3'te gösterilen Prandtl–Reissner tabanlı N_q ve N_c ile yöntemine göre N_γ kullanır.",
      en: "Terzaghi's original N values differ from the Prandtl-Reissner based values used here; verify against the source.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. N_q, N_c, N_γ nereden gelir", en: "3. Where N_q, N_c and N_γ come from" } },
  {
    type: "p",
    text: {
      tr: "Taşıma faktörleri, kayma yüzeyinin geometrisinden ve zeminin kırılma kriterinden türetilir. Prandtl (1921), sonsuz uzun bir şerit altında kohezyonsuz olmayan bir zeminin plastik kırılma bölgesini çözdü; Reissner (1924) bunu üstyük (q) etkisi için genişletti. Sonuç, sürtünme açısı φ'nin bir fonksiyonu olan N_q ve N_c değerleridir. Bu bağıntılar kendi başına kapalı formda verilir ve φ'nin küçük değerlerinde yavaş, büyük değerlerinde çok hızlı arttığı için dikkatle okunmalıdır. Hesabımızda φ derece cinsinden girilir, ama formüldeki tan ve üstel fonksiyonlar radyan ile çalışır; birimleri karıştırmak bu aşamada en sık yapılan hatadır.",
      en: "Prandtl and Reissner give Nq and Nc from the failure geometry.",
    },
  },
  {
    type: "formula",
    expr: "N_q = e^(π·tan φ) · tan²(45° + φ/2)\nN_c = (N_q − 1) / tan φ",
    caption: { tr: "Prandtl–Reissner taşıma faktörleri (kodda φ > 0 için bu formüller kullanılır; φ = 0 için N_c = 5.14, N_q = 1)", en: "Prandtl-Reissner factors" },
    where: [
      { tr: "φ derece cinsinden girilir; formüldeki tan, e^(…) ve tan² fonksiyonları için φ radyana çevrilerek hesaplanır", en: "φ is entered in degrees; for the tan, e^(…) and tan² functions in the formula, φ is converted to radians before computing" },
      { tr: "Program φ için 0 ≤ φ < 50° aralığını kabul eder; bu sınırın dışında hata verir", en: "The program accepts φ in the range 0 ≤ φ < 50°; outside this limit it raises an error" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Sayısal bir his edinmek için: φ = 30° için N_q = e^(π·0.5774)·tan²(60°) = e^(1.8138)·3 ≈ 18.40 bulunur. Aynı φ için N_c = (18.40 − 1)/0.5774 ≈ 30.14 çıkar. Görüldüğü gibi N_q, φ = 0'da 1 iken 30°'de 18'in üzerine çıkar; φ = 45°'ye yaklaştıkça bu değer yüzlerle ifade edilecek kadar büyür. Bu artış, sürtünmeli zeminlerin ne kadar güçlü olabileceğini gösterir, ama aynı zamanda φ'deki küçük bir hatanın kapasiteyi ciddi biçimde değiştirebileceği anlamına gelir. Mühendis için φ'nin güvenilir bir değer olup olmadığını zemin raporundan sorgulamak zorunludur.",
      en: "Nq at 30 deg is about 18.4.",
    },
  },
  {
    type: "figure",
    id: "bear-factor-trend",
    caption: {
      tr: "N_c, N_q ve Vesic N_γ faktörlerinin φ′ ile değişimi (logaritmik dikey eksen). Faktörler φ′ arttıkça hızla büyür; φ′ = 30° için N_c = 30,1, N_q = 18,4, N_γ = 22,4.",
      en: "Variation of N_c, N_q and Vesic N_γ with φ′ (logarithmic vertical axis). The factors grow rapidly with φ′; for φ′ = 30°, N_c = 30.1, N_q = 18.4, N_γ = 22.4.",
    },
  },
  {
    type: "p",
    text: {
      tr: "N_γ ise en çok tartışılan faktördür, çünkü üç yöntemde farklı biçimlerde yazılmıştır. Meyerhof (1963) N_γ = (N_q − 1)·tan(1.4φ) kullandı. Hansen (1970) N_γ = 1.5·(N_q − 1)·tan φ önerdi. Vesic (1973) ise N_γ = 2·(N_q + 1)·tan φ biçimini kullandı. Bu üç ifade aynı φ'de farklı N_γ değerleri verir; φ = 30° için Vesic yaklaşık 22.40, Hansen yaklaşık 15.07 ve Meyerhof yaklaşık 15.67 çıkar. Bu fark, γ·B terimi büyük olduğunda toplam kapasiteyi belirgin biçimde değiştirir: örnek 1'de Vesic ile Hansen arasında yaklaşık 130 kPa (yaklaşık yüzde 17) fark çıkar. Yani yöntem seçimi, bir detay değil, sonucu belirleyen bir karardır.",
      en: "N_gamma differs between Meyerhof, Hansen and Vesic.",
    },
  },
  {
    type: "formula",
    expr: "Meyerhof:  N_γ = (N_q − 1) · tan(1.4 φ)\nHansen:    N_γ = 1.5 · (N_q − 1) · tan φ\nVesic:     N_γ = 2 · (N_q + 1) · tan φ",
    caption: { tr: "Üç yöntemin N_γ ifadeleri; GeoTek varsayılanı Vesic'tir", en: "N_gamma by method" },
  },
  {
    type: "figure",
    id: "bear-factor-tables",
    caption: {
      tr: "Seçili φ′ değerleri için N_c, N_q ve üç yönteme göre N_γ (Vesic, Hansen, Meyerhof). Altta faktör formülleri verilmiştir.",
      en: "N_c, N_q and N_γ for three methods (Vesic, Hansen, Meyerhof) at selected φ′ values. The factor formulas are given below the table.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: Prandtl–Reissner N_q ve N_c, sığ temelde kayma yüzeyinin tam geliştiği genel kayma varsayımına dayanır. Bu nedenle bölüm 1'de anlatılan lokal ve delme kayması durumlarında bu değerler kapasiteyi fazla tahmin edebilir. Ayrıca N_γ'nın üç biçiminin de kaynaktan kaynağa farklı yorumlandığını bilin; bu metindeki ifadeler kodun kullandığı biçimlerdir ve kaynaklarınızdaki tablolarla kontrol edilmelidir. Hansen ve Vesic'in N_γ'larında φ'nin 0 olduğu uç durumda değerler sıfıra iner; bunu bölüm 7'de ayrıca ele alacağız.", en: "Limits: the Prandtl–Reissner N_q and N_c rely on the general shear assumption, in which the shear surface fully develops under the shallow footing. Therefore, in the local and punching shear situations described in section 1, these values may overestimate the capacity. Also note that the three forms of N_γ are interpreted differently across sources; the expressions in this text are the forms the code uses and should be checked against your own source tables. For the Hansen and Vesic N_γ, the values drop to zero in the extreme case where φ is 0; we address this separately in section 7.",
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Şekil, derinlik ve eğim faktörleri", en: "4. Shape, depth and inclination factors" } },
  {
    type: "p",
    text: {
      tr: "Gerçek bir temel her zaman şerit değildir; dikdörtgen ya da kare olabilir ve üstündeki yük her zaman dik olmayabilir. Bu durumlar için taşıma faktörlerinin yanına üç düzeltme çarpanı konur: şekil (s), derinlik (d) ve eğim (i) faktörleri. Şekil faktörü, temelin köşelerinin ve kenarlarının kayma yüzeyini nasıl değiştirdiğini anlatır; dikdörtgenin uzunluk/genişlik oranı B/L ile ifade edilir ve şerit için B/L = 0 alınır. Derinlik faktörü, temelin ne kadar gömülü olduğunu, yani üstteki zeminin yan direncinin ne kadar devreye girdiğini anlatır. Eğim faktörü, yükün dikeyle yaptığı açıyı, yani yatay bileşen H'nin dikey V'ye oranını kullanır.", en: "A real footing is not always a strip; it may be rectangular or square, and the load above it is not always vertical. For these cases, three correction factors are added to the bearing factors: shape (s), depth (d) and inclination (i) factors. The shape factor describes how the corners and edges of the footing change the shear surface; for a rectangle it is expressed by the ratio B/L, and for a strip B/L = 0. The depth factor describes how deeply the footing is embedded, i.e. how much the lateral resistance of the overlying soil is mobilised. The inclination factor uses the ratio of the horizontal component H to the vertical V, which relates to the angle the load makes with the vertical.",
    },
  },
  {
    type: "formula",
    expr: "Vesic:   s_q = 1 + (B'/L') tan φ,   s_γ = max(0.6, 1 − 0.4·B'/L'),   s_c = 1 + (N_q/N_c)·(B'/L')\nHansen:  s_q = 1 + (B'/L') sin φ   (s_c, s_γ diğerleriyle aynı)",
    caption: { tr: "Şekil faktörleri; şerit temelde (B'/L' = 0) hepsi 1 olur", en: "Shape factors" },
  },
  {
    type: "p",
    text: {
      tr: "Bu ifadeleri okurken dikkat edilmesi gereken iki nokta var. Birincisi, şekil faktörleri B'/L' oranına bağlıdır ve B' her zaman L'den küçük olmalıdır; kod bu sıralamayı kendisi yapar. İkincisi, Vesic'in s_γ ifadesi 0.6 alt sınırına sahiptir ve bu sınır, çok dar dikdörtgenlerde faktörün aşırı küçülmesini engeller. Örnek olarak B = 2 m ve L = 4 m bir dikdörtgen temel için (B/L = 0.5) ve φ = 30° için Vesic s_γ = 1 − 0.4·0.5 = 0.8, s_q = 1 + 0.5·0.5774 ≈ 1.289 çıkar. Bu, şerit temelle (s = 1) kıyaslandığında kapasiteyi bir miktar değiştirir ama sonucu tek başına belirlemez.",
      en: "Shape factor example for a rectangle.",
    },
  },
  {
    type: "formula",
    expr: "k = D/B   (D/B ≤ 1 ise);   k = atan(D/B)   (D/B > 1 ise, radyan)\nVesic:   d_q = 1 + 2·tan φ·(1 − sin φ)²·k,   d_γ = 1,   d_c = d_q − (1 − d_q)/(N_c·tan φ)\nHansen:  d_c = 1 + 0.4·k",
    caption: { tr: "Derinlik faktörleri; kodda k tanımı bu biçimdedir. Derinlik oranında B gerçek genişliktir, B' değildir", en: "Depth factors" },
  },
  {
    type: "p",
    text: {
      tr: "Derinlik faktörü, temelin gömülü derinliğinin yan direnci nasıl artırdığını anlatır. D/B = 0 (yüzey temeli) için d = 1 olur ve üstyük katkısı sadece q·N_q'dan gelir. D/B arttıkça d_q ve d_c yükselir, çünkü temelin yanındaki zemin kayma yüzeyine daha fazla karşı koyar. Vesic'in d_q ifadesinde küçük bir sürtünme etkisi vardır; φ = 0'da tan φ sıfır olduğu için d_q = 1 kalır. Derinlik oranı hesabında temel genişliği olarak gerçek B alınır; eksantrisite ile azaltılmış B' bu oranda kullanılmaz. Bu, öğrencilerin sık karıştırdığı bir noktadır.",
      en: "Depth factors use the real width B, not the effective width.",
    },
  },
  {
    type: "formula",
    expr: "Vesic:   m = (2 + B'/L') / (1 + B'/L'),   i_q = (1 − H/(V + A'·c·cot φ))^m,   i_γ = (1 − H/(V + A'·c·cot φ))^(m+1)\nHansen:  i_q = (1 − 0.5·H/(V + A'·c·cot φ))^α1,   i_γ = (1 − 0.7·H/(V + A'·c·cot φ))^α2",
    caption: { tr: "Eğik yük faktörleri; H > 0 ise V > 0 zorunludur. Hansen'de α1 ve α2 kullanıcı seçeneğidir (varsayılan 5)", en: "Inclination factors" },
  },
  {
    type: "p",
    text: {
      tr: "Eğik yük, yükün yatay bileşeni H olduğunda kayma yüzeyine ek bir kesme kuvveti ekler ve kapasiteyi azaltır. Eğim faktörleri bu azalmayı 0 ile 1 arasında bir çarpanla ifade eder. Payda V + A'·c·cot φ, düşey yükle kohezyonun katkısının toplamıdır; yani H'nin V'ye oranı ne kadar büyükse, faktör o kadar küçülür. H = 0 olduğunda tüm eğim faktörleri 1 olur ve bu durumda bu bölüm yok sayılabilir. Pratikte uyarı: H > 0 ise kod V > 0 ister; düşey yükü olmayan bir eğik yük fiziksel olarak bu bağıntıyla çözülemez ve program hata verir.",
      en: "Inclined load reduces capacity; V must be positive if H > 0.",
    },
  },
  {
    type: "formula",
    expr: "Meyerhof:  s_c = 1 + 0.2·K_p·B'/L',   d_c = 1 + 0.2·√K_p·D/B,   K_p = tan²(45° + φ/2)\nMeyerhof (φ > 10°):  s_q = s_γ = 1 + 0.1·K_p·B'/L',   d_q = d_γ = 1 + 0.1·√K_p·D/B\nMeyerhof eğim:  i_c = i_q = (1 − θ/90°)²,   i_γ = (1 − θ/φ)²,   θ = atan(H/V)",
    caption: { tr: "Meyerhof faktörleri; kod φ ≤ 10° için s_q, d_q, s_γ, d_γ değerlerini 1 alır", en: "Meyerhof factors" },
  },
  {
    type: "p",
    text: {
      tr: "Meyerhof'un ifadeleri, Vesic ve Hansen'den daha basit bir yapıya sahiptir ve K_p = tan²(45° + φ/2) pasif basınç katsayısını içerir. Bu, Meyerhof'un derinlik ve şekil etkisini pasif direnç mantığıyla bağladığını gösterir. Ancak φ ≤ 10° için kod s_q, d_q, s_γ, d_γ'yi 1 alır; bu, kodun bu yöntemde uyguladığı bir kuraldır ve kaynağında nasıl gerekçelendirildiği doğrulanmalıdır. θ eğim açısıdır ve yalnızca H > 0 olduğunda sıfırdan farklıdır. Meyerhof'un derinlik faktörü D/B > 1 için ekstrapolasyon olduğundan kod bunun için uyarı üretir.",
      en: "Meyerhof uses Kp in shape and depth factors.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: φ = 30°, c = 0, B = 2 m, D = 1 m (Vesic, şerit)", en: "Example 1: phi = 30 deg, c = 0, B = 2 m, D = 1 m (Vesic, strip)" },
    given: [
      { tr: "Şerit temel, B = 2 m, D = 1 m", en: "Strip footing, B = 2 m, D = 1 m" },
      { tr: "φ = 30°, c = 0 (kohezyonsuz kum)", en: "φ = 30°, c = 0 (cohesionless sand)" },
      { tr: "γ = 18 kN/m³; q = γ·D = 18 × 1 = 18 kPa", en: "γ = 18 kN/m³; q = γ·D = 18 × 1 = 18 kPa" },
      { tr: "Yük yok (H = 0, e = 0), yöntem Vesic", en: "No load (H = 0, e = 0), method Vesic" },
    ],
    steps: [
      { label: { tr: "Taşıma faktörleri", en: "Bearing factors" }, expr: "N_q = e^(π·0.5774)·tan²(60°) = 6.134 × 3", result: "N_q = 18.40; N_c = 30.14" },
      { label: { tr: "Vesic N_γ", en: "Vesic N_gamma" }, expr: "N_γ = 2 (N_q + 1) tan 30° = 2 × 19.40 × 0.5774", result: "N_γ = 22.40" },
      { label: { tr: "Derinlik oranı ve d_q", en: "Depth ratio and d_q" }, expr: "k = D/B = 1/2 = 0.5;  d_q = 1 + 2 × 0.5774 × (1 − 0.5)² × 0.5", result: "d_q = 1.144" },
      { label: { tr: "q terimi", en: "q term" }, expr: "q·N_q·d_q = 18 × 18.40 × 1.144", result: "379.0 kPa" },
      { label: { tr: "γ terimi (şerit: s_γ = d_γ = i_γ = 1)", en: "gamma term (strip)" }, expr: "½·γ·B·N_γ = ½ × 18 × 2 × 22.40", result: "403.2 kPa" },
      { label: { tr: "c terimi", en: "c term" }, expr: "c·N_c = 0", result: "0 kPa" },
      { label: { tr: "Toplam q_ult ve Q_ult", en: "Total q_ult and Q_ult" }, expr: "q_ult = 0 + 379.0 + 403.2;   Q_ult = q_ult × B = 782.2 × 2", result: "q_ult ≈ 782 kPa; Q_ult ≈ 1564.5 kN/m" },
    ],
    program: {
      input: "method = vesic, B = 2, D = 1, phi = 30, gamma = 18, q = 18, c = 0 (L yok: şerit, V/H/e yok)",
      output: "q_ult = 782.27 kPa; Q_ult = 1564.55 kN/m; N_c = 30.1396, N_q = 18.4011, N_γ = 22.4025; d_q = 1.1443, d_c = 1.1526; s = i = 1; uyarı yok",
      note: {
        tr: "Elle ve program sonucu aynıdır (fark, yuvarlamadan kaynaklanır). d_c = 1.1526 değeri hesaba girer ama c = 0 olduğu için sonucu etkilemez; bu, bir hesabın hangi terimlerinin sıfır olduğunu görmek için iyi bir egzersizdir.",
        en: "Program and hand calculation agree.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Eksantrik yük ve etkin genişlik B'", en: "5. Eccentric load and effective width B'" } },
  {
    type: "p",
    text: {
      tr: "Bir temelin üstündeki yük her zaman merkezde olmaz. Bir kolon, temelin tam ortasına değil, bir kenara yakın oturabilir; ya da bir istinat duvarının devrilme momenti yükün merkezini kaydırır. Yükün temel merkezinden olan uzaklığına eksantrisite e denir ve birimi metredir. Eksantrik yük, temel altında basıncı eşit dağıtmaz: yükün olduğu tarafta basınç artar, karşı tarafta azalır. Sezgisel bir benzetme, bir tahta sıranın bir ucuna oturmaktır: ağırlık o uca yakın durduğunda o ucun altındaki zemin daha fazla basınca maruz kalır.", en: "A load on a footing is not always central. A column may sit not at the exact centre of the footing but near one edge; or the overturning moment of a retaining wall shifts the resultant load. The distance of the load from the footing centre is called the eccentricity e, and its unit is metres. An eccentric load does not distribute pressure evenly under the footing: pressure increases on the side where the load acts and decreases on the opposite side. An intuitive analogy is a plank seesaw sitting on one end: when the weight is near one end, the soil under that end experiences more pressure.",
    },
  },
  {
    type: "derivation",
    title: { tr: "B' = B − 2e türetimi (Meyerhof etkin genişlik)", en: "Derivation of B' = B - 2e" },
    steps: [
      {
        text: { tr: "Toplam düşey yük V, temel merkezinden e kadar uzaktadır. Bu bileşke, temel altındaki basınç dağılımının ağırlık merkezine denk gelmelidir.", en: "The resultant V acts at distance e from the centre." },
        expr: "M = V · e",
      },
      {
        text: { tr: "Meyerhof yaklaşımında, tek tip basıncın yalnızca bir etkin genişlik B' üzerine dağıldığını ve bu alanın merkezinin yük ile çakıştığını varsayarız. Bu alanın yarı genişliği, merkezden en yakın kenara olan uzaklıktır: B/2 − e.", en: "The effective area is centred on the load." },
        expr: "B'/2 = B/2 − e",
      },
      {
        text: { tr: "İki tarafı ikiyle çarpın. Etkin genişlik, orijinal genişlikten iki kez eksantrisite çıkarılarak bulunur.", en: "Multiply by two." },
        expr: "B' = B − 2e",
      },
      {
        text: { tr: "Kontrol: e = 0 için B' = B, yani merkezi yükte etkin genişlik gerçek genişlikle aynıdır. e = B/2 olursa B' = 0 olur; bu nedenle kod, B' ≤ 0 durumunda hata verir.", en: "Check: e = 0 gives B' = B." },
        expr: "e = 0 → B' = B;   e = B/2 → B' = 0",
      },
    ],
  },
  {
    type: "figure",
    id: "bear-eccentric-width",
    caption: {
      tr: "Eksantrik yük: Q merkezden e kadar kaydığında taban basıncı yamuk olur (q_max, q_min). Taşıma gücü, yükün ortasında olduğu B′ = B − 2e genişlikli temel için hesaplanır.",
      en: "Eccentric load: when Q is offset by e from the centre the base pressure is trapezoidal (q_max, q_min). Bearing capacity is computed for a footing of width B′ = B − 2e centred under the load.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Eksantrisite, kapasitede iki yerde ortaya çıkar. Birincisi, kapasite formülündeki B (ve L) yerine B' (ve L') kullanılmasıdır; bu, γ·B'·N_γ terimini azaltır. İkincisi, şekil faktörleri de B'/L' oranına bağlandığı için dolaylı bir etki yaratır. Program bu iki etkiyi birlikte hesaplar. Eksantrisite ayrıca temel tabanı basıncının dağılımını değiştirir: B/6 sınırı içinde (|e| ≤ B/6) temel tabanının tamamı basınç altındadır ve q_max = V/B·(1 + 6e/B), q_min = V/B·(1 − 6e/B) ifadeleri geçerlidir.", en: "Eccentricity affects capacity in two places. First, B (and L) in the capacity formula are replaced by B' (and L'), which reduces the γ·B'·N_γ term. Second, since the shape factors depend on the ratio B'/L', it has an indirect effect. The program computes both effects together. Eccentricity also changes the distribution of pressure under the footing base: within the B/6 limit (|e| ≤ B/6) the entire footing base is under pressure, and the expressions q_max = V/B·(1 + 6e/B) and q_min = V/B·(1 − 6e/B) apply.",
    },
  },
  {
    type: "formula",
    expr: "q_max = (V/B)·(1 + 6e/B),   q_min = (V/B)·(1 − 6e/B)     (|e| ≤ B/6 için)",
    caption: { tr: "Basınç dağılımı; |e| > B/6 ise q_min = 0 olur ve dağılım üçgendir", en: "Eccentric pressure distribution" },
    where: [
      { tr: "V: düşey yük [kN/m] (şerit), B: gerçek genişlik [m], e: eksantrisite [m]", en: "V: vertical load [kN/m] (strip), B: actual width [m], e: eccentricity [m]" },
      { tr: "Birimler: V/B kPa, q_max ve q_min kPa", en: "Units: V/B in kPa; q_max and q_min in kPa" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Bu iki ifadenin karıştırılmaması önemlidir: q_max ve q_min temel tabanının gerçek basınç dağılımını anlatır ve B üzerinden hesaplanır, B' ise kapasite hesabında kullanılan etkin genişliktir. Bir temel taban basıncı kontrolünde, q_max'ın izin verilebilir basıncı aşmaması gerekir; kapasite kontrolünde ise Q_ult/B' ile çalışılır. İkisini aynı formülle yapmaya çalışmak sık görülen bir hatadır. Ayrıca |e| > B/6 durumunda q_min negatif çıkar, bu fiziksel olarak mümkün değildir (zemin çekme taşıyamaz); bu durumda temel tabanında bir kısım ayrılır ve dağılım üçgen olur.",
      en: "q_max/q_min for basic checks, B' for capacity.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınırlar: B' ≤ 0 olduğunda (yani e ≥ B/2) kod BearingFailureError ile durur; bu, temelin yükü tutamadığı anlamına gelir. |e| > B/6 durumunda q_min = 0 kabul edilir ve üçgen dağılım gerekir; bu durum kod tarafında ayrıca bir uyarı üretmez, yorumu kullanıcıya bırakılır.",
      en: "B' <= 0 raises an error; |e| > B/6 needs a triangular distribution.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Yeraltı suyu etkisi", en: "6. Groundwater effect" } },
  {
    type: "p",
    text: {
      tr: "Yeraltı suyu, taşıma gücünü iki yoldan etkiler. Birincisi, su seviyesinin altındaki zeminin birim ağırlığı kaldırma kuvveti nedeniyle azalır; bu yüzden kendi ağırlığından gelen terim, doğal birim ağırlık γ yerine batık birim ağırlık γ' = γ_sat − γ_w ile hesaplanır. İkincisi, su seviyesi temel tabanının üstünde ya da altında olmasına göre üstyük q'nun değeri değişir. Su seviyesi yüzeyde ise, taban seviyesindeki efektif üstyük q = γ'·D olur. Bu iki etkinin birlikte düşünülmesi gerekir; biri yalnız q'ya, diğeri yalnız γ terimine etki eder.", en: "Groundwater affects bearing capacity in two ways. First, the unit weight of the soil below the water table is reduced by buoyancy, so the term from its own weight is computed with the submerged unit weight γ' = γ_sat − γ_w instead of the natural unit weight γ. Second, the value of the overburden q changes depending on whether the water table is above or below the footing base. If the water table is at the surface, the effective overburden at the base level is q = γ'·D. These two effects must be considered together: one affects only q, the other only the γ term.",
    },
  },
  {
    type: "figure",
    id: "bear-water-cases",
    caption: {
      tr: "Yeraltı suyunun üç durumu: (1) temel tabanının üstünde, (2) D ile D+B arasında, (3) D+B'den derinde. Duruma göre q ve N_γ terimindeki birim hacim ağırlığı (γ′, γ_eff veya γ) değişir.",
      en: "Three groundwater cases: (1) above the footing base, (2) between D and D+B, (3) deeper than D+B. The unit weight in q and in the N_γ term (γ′, γ_eff or γ) changes accordingly.",
    },
  },
  {
    type: "formula",
    expr: "γ_eff = γ' + (d_w/B)·(γ − γ')     (su seviyesi taban altında d_w derinlikte ve d_w < B ise, yaklaşım)",
    caption: { tr: "Ara durum için yaklaşık ifade (Das); kullanmadan önce kaynakta doğrulayın", en: "Approximate water-table interpolation" },
    where: [
      { tr: "d_w: temel tabanından su seviyesine olan mesafe [m]; γ' = γ_sat − γ_w [kN/m³]", en: "d_w: distance from the footing base to the water table [m]; γ' = γ_sat − γ_w [kN/m³]" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Bu ara durum ifadesi, su seviyesi tabana çok yakın olduğunda kayma yüzeyinin altındaki zeminin bir kısmının suya doyduğu fikrine dayanır. d_w = B olduğunda γ_eff = γ olur ve su etkisi kalmaz; d_w = 0 olduğunda γ_eff = γ' olur. Burada bir sınır vardır: bu yaklaşım, kayma yüzeyinin geometrisini basitleştirir ve kesin değildir. GeoTek programı bu ara durumu kendisi hesaplamaz; su seviyesini, γ ve q değerlerini çağıran modül verir. Bu yüzden program çıktısını yorumlarken, girdi olarak hangi γ ve q'nun kullanıldığını kontrol etmek gerekir.",
      en: "The code does not handle the water table itself.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınır: taşıma modülü su tablasını kendisi işlemez; γ ve q girdilerini çağıran modül hazırlar. Su seviyesi değişirse, q ve γ girdilerinin de değiştirilmesi gerekir. Sızma (akım) etkisi, su seviyesi dışındaki basınç dağılımı ve sıkışma geçmişi bu hesabın kapsamı dışındadır.",
      en: "Water table handling belongs to the calling module.",
    },
  },

  // ------------------------------------------------------------------
  // 7
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "7. Drenajlı ve drenajsız durum (φ = 0)", en: "7. Drained and undrained cases (phi = 0)" } },
  {
    type: "p",
    text: {
      tr: "Kil gibi ince taneli zeminler, yük hızlı uygulandığında boşluk suyunu hemen dışarı veremez. Bu durumda zemin drenajsız (undrained) davranır, kayma direnci suyun basıncından bağımsız bir sabit s_u (veya c_u) ile ifade edilir ve φ = 0 kabul edilir. Sezgisel benzetme: ıslak bir süngeri hızla sıkmaya çalışmak, suyun dışarı çıkmasına izin vermez ve sünger sert gibi davranır. Uzun süre sonra su boşalır ve zemin drenajlı (efektif) davranır; bu durumda c' ve φ' kullanılır. Kısa dönem ve uzun dönem analizleri aynı zemin için farklı sonuçlar verebilir ve hangisinin kritik olduğunu inşaat aşamasına göre seçmek gerekir.",
      en: "Undrained short-term behaviour uses s_u with phi = 0.",
    },
  },
  {
    type: "p",
    text: {
      tr: "φ = 0 için kod N_c = 5.14, N_q = 1 ve N_γ = 0 kullanır. Bu, kohezyon terimi dışında yalnızca q'nun katkısının kaldığı bir kapasite verir: q_ult = 5.14·s_u·(faktörler) + q. Üstyük terimi N_q = 1 olduğu için yalnızca q'dur ve γ terimi N_γ = 0 olduğu için tamamen düşer. Hansen ve Vesic için φ = 0 kolu ayrıca tanımlanmıştır; Hansen'de kapasite 5.14·s_u·(1 + s'_c + d'_c − i'_c) + q ile yazılır. Eğik yük varsa Hansen'de i'_c, H > A'·s_u olduğunda hata verir; Vesic'te ise i_c = 1 − m·H/(5,14·A'·s_u) pozitif kalmalıdır (m·H ≥ 5,14·A'·s_u ise hata).",
      en: "phi = 0: Nc = 5.14, Nq = 1, Ngamma = 0.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: φ = 0, c_u = 50 kPa, B = 2 m, D = 1 m (şerit)", en: "Example 2: phi = 0, c_u = 50 kPa, B = 2 m, D = 1 m (strip)" },
    given: [
      { tr: "Şerit temel, B = 2 m, D = 1 m; φ = 0 (drenajsız killi zemin), c_u = s_u = 50 kPa", en: "Strip footing, B = 2 m, D = 1 m; φ = 0 (undrained clayey soil), c_u = s_u = 50 kPa" },
      { tr: "γ verilmedi; bu örnekte varsayım olarak γ = 18 kN/m³ alındı, bu yüzden q = γ·D = 18 kPa. Gerçek γ'yı zemin raporundan alın.", en: "γ was not given; for this example γ = 18 kN/m³ is assumed, so q = γ·D = 18 kPa. Take the actual γ from the soil report." },
      { tr: "Yük yok (H = 0, e = 0), yöntem Vesic", en: "No load (H = 0, e = 0), method Vesic" },
    ],
    steps: [
      { label: { tr: "Faktörler (φ = 0)", en: "Factors at phi = 0" }, expr: "N_c = 5.14,   N_q = 1,   N_γ = 0", result: "N_γ terimi düşer" },
      { label: { tr: "Derinlik oranı ve d_c", en: "Depth ratio and d_c" }, expr: "k = D/B = 0.5;  d_c = 1 + 0.4·k = 1 + 0.2", result: "d_c = 1.20 (bu sürümde kod kolu)" },
      { label: { tr: "Kohezyon terimi (şerit: s_c = i_c = 1)", en: "cohesion term" }, expr: "c·N_c·d_c = 50 × 5.14 × 1.20", result: "308.4 kPa" },
      { label: { tr: "Üstyük terimi", en: "overburden term" }, expr: "q·N_q = 18 × 1", result: "18.0 kPa" },
      { label: { tr: "Toplam q_ult ve Q_ult", en: "Total" }, expr: "q_ult = 308.4 + 18.0;   Q_ult = 326.4 × 2", result: "q_ult ≈ 326.4 kPa; Q_ult ≈ 652.8 kN/m" },
    ],
    program: {
      input: "method = vesic, B = 2, D = 1, phi = 0, c = 50, gamma = 18, q = 18 (γ varsayım), şerit, H = 0",
      output: "q_ult = 326.40 kPa; Q_ult = 652.80 kN/m; N_c = 5.14, N_q = 1, N_γ = 0; d_c = 1.2; s = i = 1; uyarı yok",
      note: {
        tr: "Elle ve program sonucu aynıdır. Aynı girdiyle Hansen de 326.40 verir; Meyerhof ise 300.7 kPa (Q = 601.4 kN/m) verir, çünkü Meyerhof'un φ = 0 derinlik faktörü d_c = 1 + 0.2·√K_p·D/B ile K_p = 1 olduğu için 1.1 çıkar. Üç yöntem arasındaki 26 kPa fark, aynı zeminin farklı yorumlarından gelir.",
        en: "Program agrees with hand calc; Meyerhof gives 300.7 kPa.",
      },
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat (kod incelemesi gerekli): Vesic'in φ = 0 kolunda kod d_c = 1 + 0.4·k kullanır. Genel Vesic ifadesi d_c = d_q − (1 − d_q)/(N_c·tan φ) biçimindedir ve φ → 0 limitinde 1 + 2k/N_c ≈ 1 + 0.39·k verir. Fark küçüktür (bu örnekte 1.20 ile yaklaşık 1.19), ama kodun yazarı bu kolu bilinçli mi seçti yoksa Hansen ifadesini mi kopyaladı, mühendis incelemesiyle doğrulanmalıdır. Bu metin bu farkı bir hata olarak değil, doğrulanması gereken bir nokta olarak sunar.",
      en: "Vesic phi=0 branch uses d_c = 1 + 0.4k; the general Vesic limit is about 1 + 0.39k. Needs engineering review.",
    },
  },

  // ------------------------------------------------------------------
  // 8
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "8. Güvenlik sayısı, izin verilebilir basınç ve program sınırları", en: "8. Factor of safety, allowable pressure and program limits" } },
  {
    type: "p",
    text: {
      tr: "Zemin kapasitesi, tasarım yükünü doğrudan taşımaz; belirsizlikler (zemin özelliklerinin değişkenliği, yük tahmini, yöntem farkı) için bir emniyet payı bırakılır. Bu payı ifade eden sayı, güvenlik sayısı FS'dir. İzin verilebilir basınç, son kapasitenin güvenlik sayısına bölünmesiyle elde edilir: q_all = q_ult / FS. Duvar ya da temel kontrolünde ise bileşke yüke bakılır: FS_b = Q_ult / V, burada V, temel altındaki toplam düşey yüktür. Her iki kontrol de aynı sayıya ulaşmalıdır; ama q_ult ve Q_ult'un birimleri farklıdır, bu nedenle birim tutarlılığı kontrol edilmelidir.", en: "Soil capacity does not directly carry the design load; a safety margin is left for uncertainties (variability of soil properties, load estimation, method differences). The number expressing this margin is the factor of safety FS. The allowable pressure is obtained by dividing the ultimate capacity by the factor of safety: q_all = q_ult / FS. In wall or footing checks the resultant load is considered: FS_b = Q_ult / V, where V is the total vertical load below the footing. Both checks should reach the same number, but q_ult and Q_ult have different units, so unit consistency must be checked.",
    },
  },
  {
    type: "steps",
    title: { tr: "Hesap adımları", en: "Calculation steps" },
    items: [
      { tr: "Temel boyutlarını (B, L), D, φ veya s_u, c, γ ve q değerlerini girin; yöntemi (Vesic varsayılan) seçin.", en: "Enter the footing dimensions (B, L), D, φ or s_u, c, γ and q; select the method (Vesic by default)." },
      { tr: "V, H ve eksantrisiteleri belirleyin; B' = B − 2|e_B| ve (dikdörtgen için) L' = L − 2|e_L| hesaplayın.", en: "Determine V, H and the eccentricities; compute B' = B − 2|e_B| and (for rectangles) L' = L − 2|e_L|." },
      { tr: "N_c, N_q, N_γ ve şekil, derinlik, eğim faktörlerini seçilen yönteme göre hesaplayın.", en: "Compute N_c, N_q, N_γ and the shape, depth and inclination factors according to the selected method." },
      { tr: "q_ult genel denklemle bulunur; Q_ult = q_ult × A' (şeritte A' = B') hesaplanır.", en: "q_ult is found from the general equation; Q_ult = q_ult × A' (for a strip, A' = B') is computed." },
      { tr: "FS_b = Q_ult / V ve izin verilebilir basınç q_all = q_ult / FS hesaplanır; FS değeri yönetmelik ve proje şartnamesinden alınır.", en: "FS_b = Q_ult / V and the allowable pressure q_all = q_ult / FS are computed; the FS value is taken from the regulation and project specification." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Örnek: Örnek 1'deki şerit temel için Q_ult ≈ 1564.5 kN/m olduğunu varsayalım ve üstündeki düşey yük V = 400 kN/m olsun. FS_b = 1564.5 / 400 ≈ 3.91 çıkar. Bu sayı, zeminin tasarım yükünün yaklaşık dört katını taşıyabileceğini gösterir. Ama bu sayının büyük ya da küçük olması tek başına güvenli ya da güvensiz anlamına gelmez; kullanılan φ'nin güvenilirliğine, yöntem seçimine ve yüklerin doğruluğuna bağlıdır. Bu nedenle FS, bir kabul ölçütü değil, bir yargı girdisidir.",
      en: "Example: FS_b = Q_ult / V.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Program sınırları ve uyarıları: (1) Meyerhof için D/B > 1 derinlik faktörleri ekstrapole edilir ve uyarı üretilir. (2) φ = 0'da Hansen'de H > A'·s_u ise, Vesic'te m·H ≥ 5,14·A'·s_u ise (m = (2 + B'/L')/(1 + B'/L')) hata verilir; iki yöntemin sınırı aynı değildir. (3) Hansen'in α1 ve α2 eğim üsleri kullanıcı seçeneğidir; varsayılan değerleri literatürle doğrulanmamıştır. (4) Taban eğimi ve zemin eğimi faktörleri yoktur ve 1 alınır. (5) Yük kombinasyonları ve su tablası düzeltmesi çağıran modüle aittir. (6) ASD'deki güvenlik sayıları (statik ve deprem) ikincil ve doğrulanmamış olarak işaretlidir; bu sayıları ders kitabı değeri gibi kabul etmeyin, mühendis onayı gerekir. (7) φ, 0 ile 50° dışında kabul edilmez.",
      en: "Limits: no base tilt or ground slope factors; ASD factors of safety are unverified.",
    },
  },
  { type: "h", text: { tr: "Sık yapılan hatalar", en: "Common mistakes" } },
  {
    type: "mistakes",
    items: [
      { tr: "Eksantrisiteyi unutup tam B üzerinden kapasite hesabı yapmak; kapasite formülünde B' kullanılmalıdır.", en: "Forgetting the eccentricity and calculating capacity over the full B; the capacity formula must use B'." },
      { tr: "Derinlik oranında D/B yerine D/B' yazmak; derinlik faktörü gerçek genişlikle hesaplanır.", en: "Writing D/B' instead of D/B in the depth ratio; the depth factor is computed with the actual width." },
      { tr: "Terzaghi'nin tablo değerleri ile Prandtl–Reissner ya da Vesic değerlerini karıştırmak; her yöntemin kendi N_γ ifadesi vardır.", en: "Mixing Terzaghi's table values with the Prandtl–Reissner or Vesic values; each method has its own N_γ expression." },
      { tr: "φ = 0'da N_c değerini φ'den hesaplamaya çalışmak; drenajsız durumda N_c = 5.14, N_q = 1 ve N_γ = 0 kullanılır.", en: "Trying to compute N_c from φ when φ = 0; in the undrained case N_c = 5.14, N_q = 1 and N_γ = 0 are used." },
      { tr: "Yeraltı suyu altında doğal γ kullanmak; bu durumda batık birim ağırlık γ' ile çalışılmalıdır.", en: "Using the natural γ below the groundwater table; in this case work with the submerged unit weight γ'." },
      { tr: "Şekil faktörlerinde B/L yerine L/B yazmak; oran her zaman B'/L' ile ve küçük olanı büyük olana bölerek kullanılır.", en: "Writing L/B instead of B/L in the shape factors; the ratio is always used as B'/L', with the smaller divided by the larger." },
      { tr: "Yüzeyde yük olan (H > 0) durumda V = 0 ile çalışmaya çalışmak; kod bunu fiziksel olarak tanımsız sayar ve hata verir.", en: "Trying to work with V = 0 when there is a load with H > 0; the code treats this as physically undefined and raises an error." },
      { tr: "q_ult (kPa) ile Q_ult (kN/m) arasında birim karışıklığı yapmak, özellikle FS_b = Q_ult / V hesabında.", en: "Confusing units between q_ult (kPa) and Q_ult (kN/m), especially in the FS_b = Q_ult / V calculation." },
      { tr: "Yöntem farkını önemsiz saymak: φ = 30°, B = 2, D = 1 örneğinde Vesic ile Hansen arasında yaklaşık 130 kPa fark vardır.", en: "Treating the method difference as negligible: in the example φ = 30°, B = 2, D = 1, there is roughly a 130 kPa difference between Vesic and Hansen." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "φ = 30° için Prandtl–Reissner N_q değerini hesaplayın (iki basamak).", en: "Compute N_q for phi = 30 deg (two decimals)." },
        a: { tr: "N_q = e^(π·tan30°)·tan²(60°) = e^(1.8138) × 3 ≈ 6.134 × 3 ≈ 18.40.", en: "N_q = 18.40." },
      },
      {
        q: { tr: "φ = 30° için N_c değerini bulun (N_q = 18.40 kullanın).", en: "Find N_c for phi = 30 deg using N_q = 18.40." },
        a: { tr: "N_c = (N_q − 1)/tan φ = 17.40 / 0.5774 ≈ 30.14.", en: "N_c = 30.14." },
      },
      {
        q: { tr: "φ = 30° için üç yöntemin N_γ değerlerini (Vesic, Hansen, Meyerhof) sırayla yazın.", en: "Give N_gamma for phi = 30 deg for Vesic, Hansen and Meyerhof." },
        a: { tr: "Vesic: 2 × 19.40 × 0.5774 ≈ 22.40; Hansen: 1.5 × 17.40 × 0.5774 ≈ 15.07; Meyerhof: 17.40 × tan(42°) ≈ 15.67.", en: "Vesic 22.40, Hansen 15.07, Meyerhof 15.67." },
      },
      {
        q: { tr: "B = 2 m, D = 1 m, φ = 30° için Vesic derinlik faktörü d_q'yu hesaplayın (dört basamak).", en: "Compute Vesic d_q for B = 2 m, D = 1 m, phi = 30 deg (four decimals)." },
        a: { tr: "k = D/B = 0.5; d_q = 1 + 2 × 0.5774 × (0.5)² × 0.5 = 1 + 0.1443 ≈ 1.1443.", en: "d_q = 1.1443." },
      },
      {
        q: { tr: "B = 2 m ve L = 4 m dikdörtgen temel, φ = 30°, Vesic. s_γ ve s_q değerlerini bulun.", en: "Rectangle B = 2 m, L = 4 m, phi = 30 deg, Vesic. Find s_gamma and s_q." },
        a: { tr: "B/L = 0.5; s_γ = 1 − 0.4 × 0.5 = 0.80; s_q = 1 + 0.5 × 0.5774 ≈ 1.289.", en: "s_gamma = 0.80, s_q = 1.289." },
      },
      {
        q: { tr: "B = 2 m, e = 0.3 m ise etkin genişlik B' kaçtır?", en: "For B = 2 m and e = 0.3 m, what is B'?" },
        a: { tr: "B' = B − 2e = 2 − 0.6 = 1.4 m.", en: "B' = 1.4 m." },
      },
      {
        q: { tr: "V = 400 kN/m, B = 2 m, e = 0.3 m için q_max ve q_min değerlerini bulun (|e| ≤ B/6 olduğunu kontrol edin).", en: "For V = 400 kN/m, B = 2 m, e = 0.3 m find q_max and q_min. Check e <= B/6 first." },
        a: { tr: "B/6 = 0.333 > 0.3, dolayısıyla formül geçerli. V/B = 200 kPa; 6e/B = 0.9; q_max = 200 × 1.9 = 380 kPa; q_min = 200 × 0.1 = 20 kPa.", en: "q_max = 380 kPa, q_min = 20 kPa." },
      },
      {
        q: { tr: "φ = 0, c_u = 50 kPa, B = 2 m, D = 1 m, γ = 18 kN/m³ şerit temel için q_ult kaçtır? (Vesic, kod kolu)", en: "phi = 0, c_u = 50 kPa, B = 2 m, D = 1 m, gamma = 18 kN/m3, strip. q_ult? (Vesic, code branch)" },
        a: { tr: "q_ult = 5.14 × 50 × 1.20 + 18 × 1 = 308.4 + 18 = 326.4 kPa; Q_ult = 652.8 kN/m. Program aynı değeri verir.", en: "q_ult = 326.4 kPa." },
      },
      {
        q: { tr: "Örnek 1'deki Q_ult = 1564.5 kN/m ve V = 400 kN/m ise FS_b kaçtır?", en: "With Q_ult = 1564.5 kN/m and V = 400 kN/m, what is FS_b?" },
        a: { tr: "FS_b = 1564.5 / 400 ≈ 3.91.", en: "FS_b = 3.91." },
      },
      {
        q: { tr: "Yeraltı suyu yüzeyde, γ_sat = 20 kN/m³ ise batık birim ağırlık γ' kaçtır?", en: "Water table at surface, gamma_sat = 20 kN/m3. What is gamma'?" },
        a: { tr: "γ' = γ_sat − γ_w = 20 − 9.81 = 10.19 kN/m³.", en: "gamma' = 10.19 kN/m3." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Sığ temel", en: "Shallow foundation" }, def: { tr: "Derinliği genişliğine göre küçük olan, genellikle yüzeye yakın yerleşen temel (ayak, şerit, radye).", en: "A footing whose depth is small relative to its width, usually placed near the surface (pad, strip, raft)." } },
      { term: { tr: "Taşıma gücü (q_ult)", en: "Ultimate bearing capacity" }, def: { tr: "Zeminin kırılmadan taşıyabileceği en büyük temel basıncı [kPa]. Son değerdir; tasarımda emniyet sayısına bölünür.", en: "The greatest footing pressure the soil can carry without failure [kPa]. It is an ultimate value; it is divided by a factor of safety in design." } },
      { term: { tr: "İzin verilebilir basınç (q_all)", en: "Allowable bearing pressure" }, def: { tr: "Taşıma gücünün emniyet sayısına bölünmesiyle elde edilen tasarım basıncı [kPa].", en: "The design pressure obtained by dividing the bearing capacity by the factor of safety [kPa]." } },
      { term: { tr: "Güvenlik sayısı (FS)", en: "Factor of safety" }, def: { tr: "Son kapasitenin tasarım yüküne oranı; belirsizlikler için bırakılan boşluk. Değeri yönetmelikten alınır.", en: "The ratio of the ultimate capacity to the design load; the margin left for uncertainties. Its value is taken from the regulation." } },
      { term: { tr: "Genel kayma", en: "General shear failure" }, def: { tr: "Kayma yüzeylerinin yüzeye kadar uzandığı, zeminin kabardığı ve göçmenin ani olduğu biçim; sıkı zeminde görülür.", en: "The mode in which shear surfaces extend to the surface, the soil heaves and failure is sudden; seen in dense soils." } },
      { term: { tr: "Lokal kayma", en: "Local shear failure" }, def: { tr: "Kayma yüzeylerinin yüzeye tam ulaşmadığı, zeminin ezilip oturduğu ve göçmenin yavaş olduğu biçim.", en: "The mode in which shear surfaces do not fully reach the surface; the soil is crushed and settles, and failure is slow." } },
      { term: { tr: "Delme kayması", en: "Punching shear failure" }, def: { tr: "Temelin altındaki zeminin düşey olarak batması; yanlarda kabarma yoktur. Gevşek kum ve yumuşak killerde görülür.", en: "The soil under the footing sinks vertically with no heave at the sides. Seen in loose sand and soft clays." } },
      { term: { tr: "Aktif kama", en: "Active wedge" }, def: { tr: "Terzaghi mekanizmasında temel tabanının hemen altında oluşan üçgen zemin bölgesi; temelle birlikte aşağı iter.", en: "In the Terzaghi mechanism, the triangular soil zone that forms directly below the footing base; it moves downward together with the footing." } },
      { term: { tr: "Kohezyon (c)", en: "Cohesion" }, def: { tr: "Tanelerin birbirine yapışmasından gelen kayma direnci bileşeni [kPa]; kumda sıfırdır.", en: "The component of shear resistance from particles sticking together [kPa]; zero in sand." } },
      { term: { tr: "Drenajsız kayma dayanımı (s_u, c_u)", en: "Undrained shear strength" }, def: { tr: "Kısa dönemde, boşluk suyu dışarı çıkamadığında killerin kayma dayanımı [kPa]; φ = 0 kabul edilir.", en: "The shear strength of clays in the short term, when pore water cannot escape [kPa]; φ = 0 is assumed." } },
      { term: { tr: "Sürtünme açısı (φ)", en: "Friction angle" }, def: { tr: "Zeminin kayma direncinin sürtünmeden gelen kısmını ifade eden açı [°].", en: "The angle representing the frictional part of the soil's shear resistance [°]." } },
      { term: { tr: "Efektif üstyük (q)", en: "Effective overburden" }, def: { tr: "Temel tabanı seviyesindeki efektif düşey gerilme [kPa]; yeraltı suyu varsa su payı düşülür.", en: "The effective vertical stress at the footing base level [kPa]; if groundwater is present, the water share is subtracted." } },
      { term: { tr: "Birim hacim ağırlık (γ)", en: "Unit weight" }, def: { tr: "Zeminin birim hacminin ağırlığı [kN/m³].", en: "The weight of soil per unit volume [kN/m³]." } },
      { term: { tr: "Batık birim ağırlık (γ')", en: "Submerged unit weight" }, def: { tr: "Su seviyesinin altındaki zeminin kaldırma kuvveti düşülmüş birim ağırlığı: γ' = γ_sat − γ_w [kN/m³].", en: "The unit weight of soil below the water table after subtracting the buoyant force: γ' = γ_sat − γ_w [kN/m³]." } },
      { term: { tr: "Taşıma faktörleri (N_c, N_q, N_γ)", en: "Bearing capacity factors" }, def: { tr: "Sürtünme açısına bağlı, kohezyon, üstyük ve birim ağırlık terimlerini kapasiteye çeviren boyutsuz katsayılar.", en: "Dimensionless coefficients, depending on the friction angle, that convert the cohesion, overburden and unit weight terms into capacity." } },
      { term: { tr: "Şekil faktörü (s)", en: "Shape factor" }, def: { tr: "Dikdörtgen temelin uzunluk/genişlik oranına bağlı düzeltme çarpanı; şeritte 1.", en: "A correction multiplier depending on the length/width ratio of a rectangular footing; equal to 1 for a strip." } },
      { term: { tr: "Derinlik faktörü (d)", en: "Depth factor" }, def: { tr: "Temelin gömülü derinliğinin yan dirençteki artışını anlatan çarpan; D/B oranına bağlıdır.", en: "A multiplier describing the increase in lateral resistance due to the embedment depth of the footing; depends on the D/B ratio." } },
      { term: { tr: "Eğim faktörü (i)", en: "Inclination factor" }, def: { tr: "Eğik yükün yatay bileşeninin kapasiteyi azaltmasını anlatan çarpan; 0–1 arasındadır.", en: "A multiplier describing how the horizontal component of an inclined load reduces capacity; between 0 and 1." } },
      { term: { tr: "Eksantrisite (e)", en: "Eccentricity" }, def: { tr: "Bileşke yükün temel merkezinden uzaklığı [m].", en: "The distance of the resultant load from the footing centre [m]." } },
      { term: { tr: "Etkin genişlik (B')", en: "Effective width" }, def: { tr: "Eksantrik yükte kapasite hesabında kullanılan genişlik: B' = B − 2e [m].", en: "The width used in the capacity calculation under an eccentric load: B' = B − 2e [m]." } },
      { term: { tr: "Yeraltı suyu seviyesi (GWT)", en: "Groundwater table" }, def: { tr: "Boşluk suyu basıncının atmosfer basıncına eşit olduğu seviye; γ ve q hesabını etkiler.", en: "The level at which pore water pressure equals atmospheric pressure; affects the calculation of γ and q." } },
      { term: { tr: "Drenajlı analiz", en: "Drained analysis" }, def: { tr: "Boşluk suyunun dışarı çıktığı, efektif gerilmelerle (c', φ') yapılan uzun dönem analizi.", en: "A long-term analysis carried out with effective stresses (c', φ'), in which pore water has been able to drain out." } },
      { term: { tr: "Çekirdek bölgesi (B/6 sınırı)", en: "Middle third (B/6 limit)" }, def: { tr: "Eksantrisitenin B/6 içinde olduğu bölge; bu bölgede temel tabanının tamamı basınç altındadır.", en: "The zone in which the eccentricity lies within B/6; in this zone the entire footing base is under pressure." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Terzaghi, K. (1943). Theoretical Soil Mechanics. John Wiley and Sons. (Göçme mekanizması ve özgün N değerleri; doğrulanmadı, bölüm/sayfa bu metinde yazılmadı.)",
      "Meyerhof, G.G. (1963). Some recent research on the bearing capacity of foundations. Canadian Geotechnical Journal, 1(1). (Meyerhof faktörleri; doğrulanmadı.)",
      "Hansen, J.B. (1970). A revised and extended formula for bearing capacity. Danish Geotechnical Institute, Bulletin 28. (Hansen faktörleri; doğrulanmadı.)",
      "Vesic, A.S. (1973). Analysis of ultimate loads of shallow foundations. JSMFD, ASCE, 99(SM1). (Vesic faktörleri; doğrulanmadı.)",
      "Das, B.M. Principles of Foundation Engineering, sığ temel taşıma gücü bölümü. (Yeraltı suyu ara durum yaklaşımı ve tanımlar için; doğrulanmadı.)",
      "Bowles, J.E. Foundation Analysis and Design, 5th ed. (Özet tablolar; kodun atıf yaptığı tablolar; doğrulanmadı.)",
    ],
  },
];
