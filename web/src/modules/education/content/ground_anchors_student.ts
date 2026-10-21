import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Ankraj nedir ve neden kullanılır", en: "1. What a ground anchor is and why it is used" } },
  {
    type: "p",
    text: {
      tr: "Derin bir kazıda duvarı yalnızca kendi ağırlığı ya da kazı tabanındaki pasif zemin direnci ile tutmak çoğu zaman yetmez. Bu durumda duvarın arkasındaki zemine bir çelik tendon yerleştirilir ve tendonun bir ucu duvara bağlanır; öbür ucu zeminin derinlerinde, kayma yüzeyinin dışındaki sağlam bir bölgede sabitlenir. Ankraj, bu sayede duvara gelen yatay yükü zeminin içine taşır. Sezgi için bir gerilmiş ip düşünün: halatın bir ucu bir kazığa, öbür ucu yere çakılmış bir çivide tutunur ve ip yük altında uzayarak yükü taşır. Ankraj da benzer biçimde çalışır, fakat yük, zeminde bir hacmin sürtünmesiyle (kök bölgesinde) yerleşir.",
      en: "A ground anchor pulls the wall back by fixing a tendon in sound ground behind the failure surface.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bir ankrajın üç ana parçası vardır. Serbest boy, tendonun zemin ile hiç temas etmediği kısımdır; yük bu kısımda sadece tendon ekseni boyunca iletilir ve kayma yüzeyinin ötesine ulaşmak için gereklidir. Kök boyu (bağlanma boyu), tendonun enjeksiyon harcıyla zemine kenetlendiği kısımdır ve yükü zemine aktaran bölge burasıdır. Kafa (baş), tendonun duvara ya da kılavuz kirişe bağlandığı ve kilitlendiği uçtur. Serbest boy ile kök boyu arasındaki ayrım, bu konunun tamamının temelidir: kayma yüzeyinin içinde kalan uzunluk kaymaya karşı tutamaz, ancak kayma yüzeyinin dışında kalan uzunluk tutabilir.",
      en: "Free length, bond length and head.",
    },
  },
  {
    type: "figure",
    id: "gan-wedge-geometry",
    caption: {
      tr: "Tek ankrajlı kazı kesiti. Kayma yüzeyi duvar tabanından 45° + φ′/2 açıyla yükselir. Serbest boy, yüzey içindeki L_kama ile ötesindeki χ'den oluşur; enjeksiyonlu kök boyu tümüyle kamanın dışındadır. z_h ankraj başının derinliği, α ankraj eğimidir.",
      en: "Single-anchor excavation section. The failure plane rises from the wall base at 45° + φ′/2. The free length is L_wedge (inside the wedge) plus χ (beyond it); the grouted bond length lies entirely outside the wedge. z_h is the anchor head depth and α the anchor inclination.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Ankraj neden her zaman en iyi çözüm değildir? Kazı yakınında komşu bina, altyapı ya da mülkiyet sınırı varsa tendonun zemine girmesi için yer bulunamayabilir. Ayrıca kök bölgesinin sağlam zeminde olması gerekir; yumuşak kil ya da organik zeminde tutma kapasitesi düşük kalır. Bu konu, kazıdan sonra oluşacak çökmeleri ya da komşu yapılardaki etkiyi hesaplamaz. Program yalnızca tek bir ankrajın tasarımını yapar: yük, serbest boy, kök boyu, tendon ve deneme yükü. Duvarın bütün dengesi, taban kabarması ve genel (dış) stabilite ayrı bir hesap konusudur.",
      en: "Limits: one anchor only; no settlement or external stability.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Sınır: GeoTek'in ankraj hesabı tek bir ankrajın iç tasarımıdır. Kranz ya da genel stabilite (ankrajın arkasından geçen büyük kayma yüzeyi) bu modülde hesaplanmaz; her sonuçta bu eksiklik uyarı olarak gösterilir. Güvenlik için bu kontrolün ayrıca yapılması gerekir.",
      en: "External (general) stability is not computed here.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Ankraj yükü: yatay yükten eksenel yüke", en: "2. Anchor load: from horizontal load to axial load" } },
  {
    type: "p",
    text: {
      tr: "Duvarın birim genişliği başına taşınması gereken yatay yük T_h [kN/m] genellikle önceki bölümlerde (görünür basınç zarfı ya da serbest zemin desteği) hesaplanmış bir değerdir. Her ankraj bu yükün bir kısmını taşır: ankrajlar arası yatay aralık s [m] kadar bir şerit yükünü taşır, dolayısıyla tek ankrajın yatay yükü T_h · s [kN] olur. Ankraj eğikse bu yatay bileşen tendon ekseni boyunca bir eksenel yüke dönüşür. Eğim α, ankrajın yatayla yaptığı açıdır ve 10° ile 45° arasında kalması önerilir. Eğim arttıkça aynı yatay yük için tendonda daha büyük eksenel yük oluşur; bu yüzden tasarım eksenel yükü T = T_h · s / cos α ile bulunur.",
      en: "Anchor load along the axis: T = T_h s / cos alpha.",
    },
  },
  {
    type: "formula",
    expr: "T = T_h · s / cos α   ,   T_v = T · sin α",
    caption: {
      tr: "T: tasarım eksenel yükü [kN] (tendon ekseni boyunca); T_h: duvar başına yatay yük [kN/m]; s: yatay aralık [m]; α: ankraj eğimi [°]. T_v: ankrajın düşey bileşeni [kN]; duvarın eksenel yüküne eklenir.",
      en: "Design axial load and vertical component.",
    },
    where: [
      { tr: "Birimler: kN/m × m = kN; cos ve sin birimsiz. Sonuç kN cinsindendir." },
      { tr: "Program girdi olarak T_h·s veya doğrudan eksenel yük kabul eder; ikisi aynı anda verilemez." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Kontrol edilmesi gereken iki şey vardır. İlki, T_v'nin toplamının (ΣT_v, kN/m) duvarın düşey yük taşıma kapasitesini ve kazı zemininin desteğini aşmamasıdır; program bu toplamı bir uyarı olarak raporlar ama duvar kesitini ayrıca kontrol etmez. İkincisi, yatay aralığın s çok küçük olmamasıdır: aralık 1,2 m'den azsa program uyarı verir, çünkü komşu ankrajların kök bölgeleri birbirini etkiler. Bu iki kontrol, tek ankraj hesabının yanında her zaman bakılması gereken koşullardır ve program bunları sessizce düzeltmez.",
      en: "Check total vertical load and spacing.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: GEC-4 alt ankrajı, eksenel yük ve düşey bileşen", en: "Example 1: lower anchor, axial and vertical load" },
    given: [
      { tr: "H = 10 m (kazı yüksekliği)", en: "H = 10 m" },
      { tr: "T_h = 172 kN/m, s = 2,5 m", en: "T_h = 172 kN/m, s = 2.5 m" },
      { tr: "α = 15°", en: "alpha = 15 deg" },
      { tr: "φ′ = 33°, z_h = 6,25 m, q_u = 100 kN/m, FS = 2,0 (GEC-4 Örnek 1 alt ankrajı)", en: "phi' = 33 deg, z_h = 6.25 m, q_u = 100 kN/m, FS = 2.0" },
    ],
    steps: [
      { label: { tr: "Yatay yük (bir ankraj)", en: "Horizontal load per anchor" }, expr: "T_h · s = 172 × 2,5", result: "430 kN" },
      { label: { tr: "Eksenel tasarım yükü", en: "Design axial load" }, expr: "T = 430 / cos 15° = 430 / 0,96593", result: "445,17 kN" },
      { label: { tr: "Düşey bileşen", en: "Vertical component" }, expr: "T_v = 445,17 × sin 15° = 445,17 × 0,25882", result: "115,22 kN" },
      { label: { tr: "Kilitleme yükü (örnek girdi: oran 1,0)", en: "Lock-off load (example input ratio 1.0)" }, expr: "P_kilit = 1,0 × 445,17", result: "445,17 kN" },
      { label: { tr: "Deneme yükü", en: "Test load" }, expr: "P_deneme = 1,33 × 445,17", result: "592,07 kN" },
    ],
    program: {
      input: "H = 10 m, z_h = 6.25 m, α = 15 deg, φ = 33 deg, T_h = 172 kN/m, s = 2.5 m, q_u = 100 kN/m, FS = 2.0, lock-off = 1.0, strand",
      output: "design_load = 445.169 kN; vertical_load_per_anchor = 115.218 kN; lock_off = 445.169 kN; test_load = 592.074 kN",
      note: {
        tr: "Program elle hesapla aynı değerleri verdi (fark yok). Kilitleme oranı 1,0 bu örnek için seçilmiş bir girdidir; oran kullanıcı girdisidir ve projede gerekçesiyle yazılmalıdır.",
        en: "Same values by hand and by program. The lock-off ratio 1.0 is an example input, not a code value.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Kama geometrisi ve serbest boy", en: "3. Failure wedge geometry and free length" } },
  {
    type: "p",
    text: {
      tr: "Serbest boyun ne kadar olması gerektiğini anlamak için kayma yüzeyinin nerede olduğunu bilmek gerekir. Kazı tabanının köşesinden başlayan kayma yüzeyi, kohezyonsuz zeminde yaklaşık 45° + φ′/2 açısıyla yukarı çıkar; Rankine teorisindeki aktif kamanın yüzeyi budur. Bu yüzey, ankraj ekseni ile bir noktada kesişir ve kesişimden ankraj kafasına kadar olan mesafe kama uzunluğu L_kama olur. Kama uzunluğu kadar serbest boy, kayma yüzeyi içindeki tendonu zemine kenetlemeyi engeller; bu uzunluk ankrajın kök bölgesini yüzeyin dışına taşır. Tek bir φ′ kullanıldığı için bu geometri katmanlı zemin ya da eğimli arazi için bir yaklaşımdır.",
      en: "Wedge surface at 45 + phi/2 from the excavation corner.",
    },
  },
  {
    type: "formula",
    expr: "k = tan(45° − φ′/2) ;   x = (H + e − z_h) · k / (1 + k · tan α) ;   L_kama = x / cos α",
    caption: {
      tr: "x: kazı tabanından kama yüzeyine yatay mesafe (ankraj ekseninde), L_kama: kama yüzeyinden ankraj kafasına kadar tendon boyu [m]. e: kama başlangıcının taban altı derinliği (köşe için 0).",
      en: "Wedge distance x along the anchor line and wedge length.",
    },
    where: [
      { tr: "H − z_h: kafa derinliğinin üstündeki yükseklik [m]; kafa tabanın üstünde olmak zorundadır (z_h < H)." },
      { tr: "Dikkat: k = tan(45° − φ′/2) formülde yalnız geometri için kullanılır; yüzey açısı 45° + φ′/2 ile çelişmez, çünkü ikisi komşu açılardır." },
    ],
  },
  {
    type: "formula",
    expr: "χ_eksen = χ / sin(45° + φ′/2 + α) ;   L_serbest = max( L_kama + χ_eksen ;  L_min )",
    caption: {
      tr: "χ: kama ötesi temizlik (kayma yüzeyine dik ölçülür); varsayılan max(1,5 m; 0,2 H). L_min: tendon türüne göre en az serbest boy (halat 4,5 m, çubuk 3 m).",
      en: "Clearance normal to the surface, converted to the anchor axis; minimum free length.",
    },
    where: [
      { tr: "χ, kayma yüzeyine dik olduğu için ankraj ekseni boyunca bileşen sin(45° + φ′/2 + α) ile bölünerek bulunur. Yatay bölmek ya da eksene paralel eklemek yanlıştır (aşağıdaki hatalara bakın)." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Serbest boy iki sınırın büyüğüdür: geometrik kama artı ötesi kalınlık, ve tendon türüne göre sabit en küçük değer. Düşük ankrajlarda kama kısa olduğu için minimum değer belirleyici olur; yüksek ankrajlarda ise kama uzun olduğu için geometri belirler. Programın bu ayrımı hangi sınırın yönettiğini (wedge ya da minimum) sonuçta gösterdiğini not edin; bu bilgi, tasarımda hangi girdinin sonucu değiştireceğini anlamak için önemlidir. Ayrıca düşük kafa derinliği, kama ötesi kalınlığı sınırlayan bir üst sınır koymaz; kafa çok sığsa örtü kontrolü (bölüm 5) devreye girer.",
      en: "Free length is the larger of the wedge plus clearance and the minimum.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: aynı ankraj, iki kafa derinliği", en: "Example 2: same anchor at two head depths" },
    given: [
      { tr: "H = 10 m, e = 0, α = 15°, φ′ = 33°, χ = max(1,5; 0,2·10) = 2,0 m", en: "H = 10 m, alpha = 15 deg, phi' = 33 deg, chi = 2.0 m" },
      { tr: "Durum A: z_h = 6,25 m (alt ankraj); Durum B: z_h = 2,5 m (üst ankraj)", en: "Case A: z_h = 6.25 m; case B: z_h = 2.5 m" },
    ],
    steps: [
      { label: { tr: "k = tan(45° − 16,5°)", en: "k" }, expr: "k = tan 28,5° = 0,54296", result: "0,54296" },
      { label: { tr: "A: yükseklik farkı ve x", en: "A: rise and x" }, expr: "x = (10 − 6,25) × 0,54296 / (1 + 0,54296 × tan 15°) = 2,0361 / 1,14548", result: "1,7775 m" },
      { label: { tr: "A: kama uzunluğu", en: "A: wedge length" }, expr: "L_kama = 1,7775 / cos 15° = 1,7775 / 0,96593", result: "1,840 m" },
      { label: { tr: "χ ankraj ekseni boyunca", en: "chi along axis" }, expr: "χ_eksen = 2,0 / sin(76,5°) = 2,0 / 0,97237", result: "2,0568 m" },
      { label: { tr: "A: gerekli serbest boy ve sonuç", en: "A: required free length" }, expr: "L_gerekli = 1,840 + 2,057 = 3,897 < 4,5 → L_serbest = 4,5 m (minimum belirleyici)", result: "4,50 m" },
      { label: { tr: "B: x ve kama uzunluğu (yükseklik 7,5 m)", en: "B: x and wedge length" }, expr: "x = 7,5 × 0,54296 / 1,14548 = 3,5550 m ;  L_kama = 3,5550 / 0,96593", result: "3,680 m" },
      { label: { tr: "B: gerekli serbest boy", en: "B: required free length" }, expr: "L_gerekli = 3,680 + 2,057 = 5,737 > 4,5 → kama belirleyici", result: "5,74 m" },
    ],
    program: {
      input: "Ayni girdi, z_h = 6.25 m ve z_h = 2.5 m, FS = 2.0, q_u = 100 kN/m, strand, phi = 33 deg, alpha = 15 deg",
      output: "A: wedge_distance = 1.7775, wedge_length = 1.8402, free_length = 4.5 (minimum); B: wedge_distance = 3.5550, wedge_length = 3.6804, free_length = 5.7372 (wedge)",
      note: {
        tr: "Elle hesap ve program aynı serbest boyları verdi. Kafa derinliği sığlaştıkça serbest boyun büyüdüğüne dikkat edin: kama yüzeyi yukarı doğru uzanır ve tendon daha uzun bir kısmı kayma bölgesinin dışında olmalıdır.",
        en: "Hand and program agree on both free lengths.",
      },
    },
  },
  {
    type: "figure",
    id: "gan-free-bond-zones",
    caption: {
      tr: "Tendon boyunca bölgeler: serbest boy (L_kama + χ) ve enjeksiyonla zemine kenetlenen kök boyu. Yük yalnız kök boyunda q_u ile zemine aktarılır; serbest boy en az 4,5 m olmalıdır. L_kama / χ ayrımı şematiktir.",
      en: "Zones along the tendon: the free length (L_wedge + χ) and the bond length grouted into the soil. Load transfers to the soil only along the bond length at q_u; the free length must be at least 4.5 m. The L_wedge / χ split is schematic.",
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Kök boyu: taşıma kapasitesi ve güvenlik sayısı", en: "4. Bond length: bond capacity and safety factor" } },
  {
    type: "p",
    text: {
      tr: "Kök bölgesinde ankrajın yükü zemine enjeksiyon harcı ile iletilir. Bu iletimin sınırı, birim uzunluk başına taşınabilen yük q_u [kN/m] ile gösterilir; bu değer bir kum ya da kaya laboratuvar ya da arazi deneyinden (yük transfer deneyi) ya da tablolardan gelir. Kök boyu arttıkça toplam kapasite artar, ama çok uzun kök boyu da kök kayması dışında bir sorunu gündeme getirir ve GEC-4 bu nedenle tipik üst sınırlar verir. Güvenlik sayısı FS, bu son kapasiteyi tasarım yüküne bölen bir emniyet payıdır: FS ile birlikte yük T'nin kökte taşınması gereken değeri T · FS'dir. Burada önemli nokta, FS'nin program tarafından varsayılmamasıdır; değer kullanıcı girdisidir ve bulunmazsa hesap durur.",
      en: "Bond capacity q_u per metre; FS applied to the load.",
    },
  },
  {
    type: "formula",
    expr: "L_kök = max( T · FS / q_u ;  L_kök,min )   ,   q_u = π · d_h · τ_ult",
    caption: {
      tr: "L_kök: kök boyu [m]; T: tasarım yükü [kN]; FS: güvenlik sayısı; q_u: birim uzunluk başına kök kapasitesi [kN/m]; τ_ult: enjeksiyon-zemin arayüzünde son kayma gerilmesi [kPa]; d_h: sondaj (delik) çapı [m].",
      en: "Bond length from load times FS over q_u; q_u from bond stress and hole diameter.",
    },
    where: [
      { tr: "Birimler: kN × 1 / (kN/m) = m. τ_ult kPa, d_h m; π · d_h · τ_ult [kN/m]." },
      { tr: "q_u doğrudan girilebilir ya da τ_ult ve d_h'den hesaplanabilir; ikisi birlikte verilirse program reddeder." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Kök boyunun minimum değerleri de vardır. GEC-4 Ek E 3B'ye göre zeminde en az 4,5 m kök boyu öngörülür; kayada halat tendonda 4,5 m, çubukta 3 m alınır. Bu minimumlar, hesaplanan kök boyu çok kısa çıksa bile yerleştirmenin güvenilir olmasını sağlar. Program bu minimumu kullanır ve belirleyici olduğunda sonuç ekranında 'minimum' olarak işaretler. Minimumu kendi isteğinize göre düşürmek mümkündür, ama bu durumda program GEC-4'ün altında kalındığını bir uyarıyla bildirir. Kayada güvenlik sayısı da zeminden farklıdır: program kaya için FS önerisini 3,0, zemin için 2,0 olarak tablolardan okur.",
      en: "Minimum bond length and safety factor guidance.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: kök boyu, zemin ve kaya karşılaştırması", en: "Example 3: bond length in soil and in rock" },
    given: [
      { tr: "T = 445,17 kN (Örnek 1), FS = 2,0, q_u = 100 kN/m (zemin)", en: "T = 445.17 kN, FS = 2.0, q_u = 100 kN/m (soil)" },
      { tr: "Kaya varyantı: q_u = 730 kN/m, FS = 3,0 (kaya önerisi)", en: "Rock variant: q_u = 730 kN/m, FS = 3.0" },
    ],
    steps: [
      { label: { tr: "Zemin: hesaplanan kök boyu", en: "Soil: calculated bond length" }, expr: "L_kök = 445,17 × 2,0 / 100 = 8,903", result: "8,90 m" },
      { label: { tr: "Zemin: minimum (4,5 m) ile karşılaştırma", en: "Soil: compare with minimum" }, expr: "8,90 > 4,5 → hesap belirleyici", result: "8,90 m" },
      { label: { tr: "Zemin: ankraj kapasitesi", en: "Soil: allowable capacity" }, expr: "Q = q_u · L_kök / FS = 100 × 8,903 / 2,0", result: "445,17 kN (= T)" },
      { label: { tr: "Kaya: hesaplanan kök boyu", en: "Rock: calculated bond length" }, expr: "L_kök = 445,17 × 3,0 / 730 = 1,829", result: "1,83 m" },
      { label: { tr: "Kaya: minimum belirleyici", en: "Rock: minimum governs" }, expr: "1,83 < 4,5 (halat) → L_kök = 4,5 m", result: "4,50 m (minimum)" },
    ],
    program: {
      input: "Ornek 1 girdisi; (a) zemin q_u = 100, FS = 2.0; (b) kaya ground = rock, q_u = 730, FS = 3.0",
      output: "(a) bond_length_calculated = 8.9034, bond_length = 8.9034 (calculated); (b) bond_length_calculated = 1.8295, bond_length = 4.5 (minimum)",
      note: {
        tr: "Program iki sonucu da elle hesapla aynı verdi. Kaya varyantında hesaplanan 1,83 m minimumun altında kaldığı için kök boyu 4,5 m olarak raporlanır; bu, kaya sondajında gerçek kapasitenin yüksek olmasına rağmen yerleştirme güvenliği için yapılan bir sınırdır.",
        en: "Both match; in rock the minimum governs.",
      },
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat: q_u ve FS sayıları bir kaynağa dayanmalıdır. Program bu değerleri varsaymaz ve bir 'transfer yükü kaynaksız' uyarısı verir. Laboratuvar, arazi deneyi ya da tablo kaynağını 'transfer_load_ref' alanına yazmak, raporda izlenebilirlik sağlar.",
      en: "The transfer load must carry a reference.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Tendon seçimi, yük sınırları ve örtü", en: "5. Tendon selection, load limits and cover" } },
  {
    type: "p",
    text: {
      tr: "Tendon, ankrajın çelik kısmıdır ve iki türü vardır: çoklu halat (strand) ve çubuk (bar). Her biri belirli bir SMTS değerine sahiptir; SMTS, tendonun belirlenmiş minimum çekme dayanımıdır [kN]. GEC-4 tasarımda üç yük sınırı koyar: tasarım yükü T en fazla 0,60 SMTS, kilitleme yükü en fazla 0,70 SMTS ve deneme yükü en fazla 0,80 SMTS olmalıdır. Bu sınırların amacı, çeliğin akma sınırına yaklaşmadan kalıcı deformasyonu önlemektir. Deneme yükü, ankraj kurulduktan sonra uygulanan ve tasarım yükünden yüksek olan bir yüktür; program bunu varsayılan 1,33 · T olarak alır.",
      en: "Tendon limits: design 0.60 SMTS, lock-off 0.70 SMTS, test 0.80 SMTS.",
    },
  },
  {
    type: "formula",
    expr: "T ≤ 0,60 · SMTS ;   P_kilit ≤ 0,70 · SMTS ;   P_deneme = 1,33 · T ≤ 0,80 · SMTS",
    caption: {
      tr: "GEC-4 bölüm 5.3.8 tendon sınırları. Halat sayısı, üç sınırın hepsini sağlayan en küçük tam sayıdır; çubukta bu kontrolü sağlayan en küçük kütüphane çubuğu seçilir.",
      en: "GEC-4 section 5.3.8 tendon limits; strand count is the smallest integer meeting all three.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Halat sayısı, en sık hata yapılan konudur. Kütüphanedeki 15 mm, Gr 270 halatın SMTS'i yaklaşık 260,7 kN'dır; program bunu tendon tablosundan okur ve kaynağı sonuçta gösterir. Her üç sınır için gereken halat sayısı ayrı ayrı hesaplanır ve en büyüğü seçilir; kullanıcı daha fazla halat isterse program bunu kabul eder, ama daha az girerse hata verir. Örtü kontrolü ise ayrı bir koşuldur: kök merkezinin üstünde en az 4,5 m zemin bulunmalıdır. Kök merkezinin derinliği, kafa derinliği ile serbest boyun eğimli bileşeninin ve kök boyunun yarısının toplamıdır: z_merkez = z_h + (L_serbest + L_kök/2) · sin α. Bu kontrol kayada atlanır ve not olarak gösterilir.",
      en: "Strand count and cover check.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: halat sayısı ve örtü kontrolü", en: "Example 4: strand count and cover check" },
    given: [
      { tr: "T = 445,17 kN, P_kilit = 445,17 kN, P_deneme = 592,07 kN", en: "T = 445.17 kN, lock-off 445.17 kN, test 592.07 kN" },
      { tr: "Halat SMTS ≈ 260,7 kN (tek halat)", en: "One strand SMTS = 260.7 kN" },
    ],
    steps: [
      { label: { tr: "2 halat: toplam SMTS", en: "Two strands: total SMTS" }, expr: "SMTS = 2 × 260,7 = 521,4 kN", result: "521,4 kN" },
      { label: { tr: "2 halat: tasarım sınırı", en: "Two strands: design limit" }, expr: "0,60 × 521,4 = 312,8 kN < 445,17 → yetmez", result: "2 halat yetersiz" },
      { label: { tr: "3 halat: toplam SMTS ve sınırlar", en: "Three strands: total SMTS and limits" }, expr: "SMTS = 782,1 kN ; 0,60 × 782,1 = 469,3 ≥ 445,17 ✓ ; 0,70 × 782,1 = 547,5 ≥ 445,17 ✓ ; 0,80 × 782,1 = 625,7 ≥ 592,07 ✓", result: "3 halat yeterli" },
      { label: { tr: "3 halat: kullanım oranları", en: "Three strands: utilisation" }, expr: "T / SMTS = 445,17 / 782,1 = 0,569 ; P_deneme / SMTS = 592,07 / 782,1 = 0,757", result: "0,57 ve 0,76" },
      { label: { tr: "Örtü: kök merkezi derinliği (z_h = 6,25 m, L_serbest = 4,5, L_kök = 8,903)", en: "Cover: bond centre depth" }, expr: "z = 6,25 + (4,5 + 8,903/2) × sin 15° = 6,25 + 8,952 × 0,25882", result: "8,57 m ≥ 4,5 m ✓" },
    ],
    program: {
      input: "Ornek 1 girdisi; tendon: strand, 15 mm Gr 270 (kutuphane), otomatik halat sayisi",
      output: "count = 3, smts_total = 782.1 kN, design_utilisation = 0.5692, test_utilisation = 0.7570; checks: tendon_design 445.17 <= 469.26 ok; tendon_lock_off 445.17 <= 547.47 ok; tendon_test 592.07 <= 625.68 ok; overburden 4.5 <= 8.57 ok",
      note: {
        tr: "Elle hesap ve program aynı halat sayısını (3) ve aynı kullanım oranlarını verdi. Program, kaynağa atıfsız bir transfer yükü girildiği için bir uyarı da gösterir; bu, Örnek 3'teki uyarıyla aynı konudur.",
        en: "Same count and utilisation; a transfer-load reference warning is also shown.",
      },
    },
  },
  {
    type: "figure",
    id: "gan-tendon-limits",
    caption: {
      tr: "Tendon yük sınırları SMTS oranı olarak: tasarım yükü ≤ 0,60, kilitleme yükü ≤ 0,70, deneme yükü ≤ 0,80; 1,00'ın ötesi kopma bölgesidir.",
      en: "Tendon load limits as fractions of SMTS: design load ≤ 0.60, lock-off load ≤ 0.70, test load ≤ 0.80; beyond 1.00 is the rupture zone.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Örtü kontrolünün arkasında yatan fikir, ankrajın tamamen yüzeye yakın bir zeminde kalmamasıdır: yüzeye yakın zeminde kayma ve yukarı kalkma riski artar ve kök bölgesinin sağlam zemine oturduğundan emin olunamaz. GEC-4 bu nedenle kök merkezi üstünde en az 4,5 m zemin ister. Programda bu değer 'min_overburden' ile girilebilir ama GEC-4 değerinin altına düşürülürse uyarı verilir. Kaya ankrajlarında bu kontrol yapılmaz çünkü kaya örtüsünün kayma riski zemindekinden farklıdır; yine de kayada bu boşluğun ayrıca değerlendirilmesi gerekir. Tendon seçiminde son söz, yük sınırlarının yanında bu örtü kontrolünün de sağlanmasıdır.",
      en: "Cover: 4.5 m over the bond centre in soil.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Hesabın sınırları ve dikkat edilmesi gerekenler", en: "6. Limits of the calculation and what to watch" } },
  {
    type: "p",
    text: {
      tr: "Bu konunun sonucunu okurken hangi şeylerin hesaplanmadığını bilmek, sonucu kullanmaktan daha önemlidir. Program kama geometrisini tek bir φ′ ile düz bir çizgi olarak hesaplar; katmanlı zemin, kil ya da yüzey sürşarjı varsa bu geometri yaklaşıktır ve uyarı verilir. Kafa, eğim ve kök boyu girdileri uygun aralıkta değilse (örneğin eğim 10°–45° dışında) program uyarır ama hesabı durdurmaz. Güvenlik sayısı, transfer yükü ve kilitleme oranı varsayılmadığı için girilmesi zorunludur; eksikse hesap durur ve eksik alanları listeler. Bu yaklaşımın amacı sessiz varsayımı önlemektir.",
      en: "Stop on missing inputs; no silent assumptions.",
    },
  },
  {
    type: "assumptions",
    title: { tr: "Programın kabul ettikleri ve hesaplamadıkları", en: "What the program assumes and does not compute" },
    items: [
      { tr: "Düz arazi, düşey duvar; kama yüzeyi kazı köşesinden 45° + φ′/2 açısıyla çıkar.", en: "Level ground, vertical wall, wedge from the corner at 45 + phi'/2." },
      { tr: "Kama ötesi χ varsayılan max(1,5 m; 0,2 H) ile alınır ve varsayım olarak gösterilir.", en: "Chi defaults to max(1.5 m, 0.2 H) and is shown as an assumption." },
      { tr: "Kaya ve zemin için aynı kama formülü kullanılır; örtü kontrolü yalnız zeminde yapılır.", en: "Same wedge formula for soil and rock; cover check in soil only." },
      { tr: "Hesaplanmaz: dış (genel) stabilite, Kranz, kazı tabanı kabarması (ankrajlı iksa bölümünde ayrıca), kazı yakınındaki yapıların oturması.", en: "Not computed: external stability, Kranz, settlement of adjacent structures." },
    ],
  },
  {
    type: "mistakes",
    items: [
      { tr: "Kayma yüzeyine dik ölçülen χ'yi ankraj ekseni boyunca doğrudan eklemek. φ′ = 0 ve α = 15° için bu %13 eksik sonuç verir; doğrusu χ / sin(45° + φ′/2 + α) = 2 / sin 60° = 2,309 m'dir." },
      { tr: "Serbest boy ile toplam boyu karıştırmak. Toplam uzunluk L_toplam = L_serbest + L_kök'tür (Örnek 1'de 4,5 + 8,90 = 13,40 m)." },
      { tr: "Kök boyunu FS olmadan q_u'ya bölmek; kapasite q_u · L_kök / FS olarak tanımlanır, tasarım yükü T · FS ile karşılaştırılır." },
      { tr: "Kayada 4,5 m minimum kök boyunu unutmak. Hesaplanan 1,83 m gibi kısa bir değer tek başına yeterli sayılmaz." },
      { tr: "2 halatı yeterli saymak. 2 halatın 0,60 SMTS sınırı 313 kN'dır; 445 kN tasarım yükünü karşılayamaz. Halat sayısı üç sınırın en büyüğünden belirlenir." },
      { tr: "Deneme yükünü tasarım yükü ile aynı sanmak. P_deneme = 1,33 · T'dir ve 0,80 SMTS sınırına göre kontrol edilir." },
      { tr: "Kilitleme oranını varsayılan 1,0 gibi kabul etmek. Oran kullanıcı girdisidir; program bunu varsaymaz ve gerekçesi projede yazılmalıdır." },
      { tr: "Düşey bileşen T_v'yi unutmak. Duvarın eksenel yüküne eklenir ve ΣT_v (kN/m) toplamı kontrol edilmelidir." },
      { tr: "Program sonucunun dış stabiliteyi kapsadığını varsaymak. Kranz ve genel stabilite bu modülde yoktur; her sonuçta uyarı görünür." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "T_h = 120 kN/m, s = 2,0 m, α = 20° için tasarım yükü T ve düşey bileşen T_v kaç kN'dır? (iki basamak)", en: "T_h = 120 kN/m, s = 2.0 m, alpha = 20 deg: T and T_v?" },
        a: { tr: "T = 240 / cos 20° = 240 / 0,93969 = 255,39 kN; T_v = 255,39 × sin 20° = 255,39 × 0,34202 = 87,35 kN.", en: "T = 255.39 kN, T_v = 87.35 kN." },
      },
      {
        q: { tr: "φ′ = 30° için k = tan(45° − φ′/2) değerini bulun (dört basamak).", en: "k = tan(45 - phi'/2) for phi' = 30 deg." },
        a: { tr: "k = tan 30° = 0,5774.", en: "k = 0.5774." },
      },
      {
        q: { tr: "H = 8 m, e = 0, z_h = 2 m, α = 0° (yatay ankraj), φ′ = 30° ise kama uzunluğu L_kama kaçtır?", en: "H = 8 m, e = 0, z_h = 2 m, alpha = 0, phi' = 30 deg: wedge length?" },
        a: { tr: "x = (8 − 2) × 0,5774 / (1 + 0) = 3,464 m; α = 0 olduğu için L_kama = x / cos 0 = 3,464 m.", en: "L_wedge = 3.464 m." },
      },
      {
        q: { tr: "Örnek 2'deki (A) durumda serbest boy neden 4,5 m çıkar, kama mı yoksa minimum mu belirleyicidir?", en: "Why is the free length 4.5 m in case A?" },
        a: { tr: "Gerekli boy 1,840 + 2,057 = 3,897 m'dir ve bu 4,5 m minimumundan küçüktür; minimum belirleyicidir.", en: "Minimum governs: 3.897 m < 4.5 m." },
      },
      {
        q: { tr: "φ′ = 0, α = 15°, χ = 2 m için χ'nin ankraj ekseni boyunca bileşeni nedir? (dört basamak)", en: "phi' = 0, alpha = 15, chi = 2 m: component along the axis?" },
        a: { tr: "2 / sin(45° + 0 + 15°) = 2 / sin 60° = 2 / 0,86603 = 2,3094 m.", en: "2.3094 m." },
      },
      {
        q: { tr: "T = 300 kN, FS = 2,0, q_u = 100 kN/m (zemin). Kök boyu kaç metredir ve minimum belirleyici mi?", en: "T = 300 kN, FS = 2.0, q_u = 100 kN/m (soil). Bond length? Which governs?" },
        a: { tr: "L_kök = 300 × 2 / 100 = 6,0 m; 6,0 > 4,5 olduğundan hesap belirleyicidir.", en: "6.0 m, calculated governs." },
      },
      {
        q: { tr: "Tasarım yükü 445,17 kN, tek halat SMTS 260,7 kN ise 0,60 sınırına göre kaç halat gerekir? (ipucu: 0,60 × n × 260,7 ≥ 445,17)", en: "Design 445.17 kN, one strand 260.7 kN: how many strands for the 0.60 limit?" },
        a: { tr: "n ≥ 445,17 / (0,60 × 260,7) = 445,17 / 156,42 = 2,85; en küçük tam sayı n = 3.", en: "n = 3." },
      },
      {
        q: { tr: "H = 8 m, z_h = 2 m, α = 10°, L_serbest = 6 m, L_kök = 6 m ise kök merkezi derinliği ve 4,5 m örtü kontrolü sonucu nedir?", en: "H = 8, z_h = 2, alpha = 10, free 6 m, bond 6 m: bond centre depth and cover check?" },
        a: { tr: "z = 2 + (6 + 3) × sin 10° = 2 + 9 × 0,17365 = 3,56 m; 3,56 < 4,5 → örtü kontrolü sağlanmaz.", en: "3.56 m < 4.5 m: fails the cover check." },
      },
      {
        q: { tr: "Kaya varyantında (q_u = 730, FS = 3,0, T = 445,17) hesaplanan kök boyu 1,83 m iken halat için sonuç neden 4,5 m olur?", en: "Rock: calculated 1.83 m, why 4.5 m for strand?" },
        a: { tr: "Kaya halat tendonunda GEC-4 minimum kök boyu 4,5 m'dir; hesaplanan değer bunun altında kaldığı için minimum belirleyici olur.", en: "The strand minimum in rock is 4.5 m." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Ankraj", en: "Ground anchor" }, def: { tr: "Duvara gelen yatay yükü zemin içinde sabitlenmiş bir tendonla geri taşıyan eleman." } },
      { term: { tr: "Serbest boy", en: "Free length" }, def: { tr: "Tendonun zeminle enjeksiyonla kenetlenmediği, yükü yalnız eksen boyunca ileten kısım [m]." } },
      { term: { tr: "Kök boyu (bağlanma boyu)", en: "Bond length" }, def: { tr: "Tendonun enjeksiyon harcıyla zemine kenetlendiği ve yükü zemine aktardığı kısım [m]." } },
      { term: { tr: "Kama (kayma kaması)", en: "Failure wedge" }, def: { tr: "Kazı köşesinden 45° + φ′/2 açısıyla çıkan kayma yüzeyinin sınırladığı zemin bölgesi." } },
      { term: { tr: "Kama ötesi kalınlık (χ)", en: "Beyond-wedge clearance" }, def: { tr: "Kama yüzeyinin arkasında kök bölgesinin güvenle yerleşmesi için bırakılan, yüzeye dik ölçülen kalınlık [m]." } },
      { term: { tr: "Ankraj eğimi (α)", en: "Anchor inclination" }, def: { tr: "Tendon ekseninin yatayla yaptığı açı [°]; önerilen aralık 10° ile 45° arasıdır." } },
      { term: { tr: "Yatay aralık (s)", en: "Horizontal spacing" }, def: { tr: "Komşu ankrajlar arasındaki yatay mesafe [m]; tek ankrajın taşıdığı şerit genişliğini belirler." } },
      { term: { tr: "Tasarım yükü (T)", en: "Design load" }, def: { tr: "Tendon ekseni boyunca etkiyen eksenel yük [kN]: T = T_h · s / cos α." } },
      { term: { tr: "Düşey bileşen (T_v)", en: "Vertical component" }, def: { tr: "Ankraj yükünün düşey bileşeni [kN]: T · sin α; duvarın eksenel yüküne eklenir." } },
      { term: { tr: "Güvenlik sayısı (FS, ankraj)", en: "Anchor safety factor" }, def: { tr: "Kök kapasitesinin tasarım yüküne oranı; zemin için 2,0, kaya için 3,0 tablolarda önerilir ve kullanıcı girdisidir." } },
      { term: { tr: "Birim kök kapasitesi (q_u)", en: "Ultimate transfer load" }, def: { tr: "Kök boyunun birim uzunluğu başına taşınabilen son yük [kN/m]." } },
      { term: { tr: "Son kayma gerilmesi (τ_ult)", en: "Ultimate bond stress" }, def: { tr: "Enjeksiyon ile zemin arayüzündeki son kayma gerilmesi [kPa]; q_u = π · d_h · τ_ult ile q_u'ya çevrilir." } },
      { term: { tr: "Sondaj çapı (d_h)", en: "Hole diameter" }, def: { tr: "Kök bölgesinin açıldığı sondaj çapı [m]; kök kapasitesinde doğrudan etkilidir." } },
      { term: { tr: "SMTS", en: "SMTS" }, def: { tr: "Tendonun belirlenmiş minimum çekme dayanımı [kN]; tendon sınırları bu değerin oranlarıdır." } },
      { term: { tr: "Halat (strand)", en: "Strand" }, def: { tr: "Birden çok çelik telin bükülmesiyle oluşan tendon; tablodaki 15 mm Gr 270 halatın SMTS'i yaklaşık 260,7 kN'dır." } },
      { term: { tr: "Çubuk (bar)", en: "Bar" }, def: { tr: "Tek parça yüksek mukavemetli çelik tendon; minimum serbest boyu halattan kısadır (3 m)." } },
      { term: { tr: "Kilitleme yükü", en: "Lock-off load" }, def: { tr: "Ankraj kurulup kafa kilitlendikten sonra tendonda bırakılan yük [kN]; oranı kullanıcı girdisidir." } },
      { term: { tr: "Deneme yükü", en: "Test load" }, def: { tr: "Ankrajın davranışını doğrulamak için tasarım yükünden yüksek uygulanan yük [kN]; varsayılan 1,33 · T." } },
      { term: { tr: "Örtü (overburden)", en: "Overburden" }, def: { tr: "Kök merkezinin üstündeki zemin kalınlığı [m]; zeminde en az 4,5 m istenir." } },
      { term: { tr: "Kök merkezi derinliği", en: "Bond centre depth" }, def: { tr: "z = z_h + (L_serbest + L_kök / 2) · sin α [m]; örtü kontrolünde kullanılır." } },
      { term: { tr: "GEC-4", en: "GEC-4" }, def: { tr: "FHWA'nın ankraj ve ankrajlı sistemler için tasarım el kitabı; programın dayandığı kaynak." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Sabatini, P.J., Pass, D.G., Bachus, R.C. (1999). Ground Anchors and Anchored Systems. FHWA-IF-99-015 (GEC-4). Bölüm 5.3.2-5.3.8, Ek E 3B ve Tablo 6, 8, 9, 10 kodun atıf yaptığı yerlerdir; bu metin bölüm numaralarını kod kaynaklarından aldı, tam metni yeniden okumadım.",
      "EN 1537 (Ankrajlar): kısmi güvenlik katsayıları; kodda uygulanmaz ve bu metinde sayısal karşılaştırma yapılmadı (doğrulanamadı).",
      "Caltrans Trenching and Shoring Manual (2025), bölüm 8 ve 10: GEC-4'ü izleyen ikincil kaynak (doğrulanamadı).",
      "Proje içi: docs/qa/ankraj-muhendislik-kontrolu.md. Bu dosya GEC-4 el hesabı regresyonlarını ve iki bağımsız incelemenin bulgularını içerir.",
    ],
  },
];
