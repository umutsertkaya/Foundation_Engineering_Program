import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Sıvılaşma nedir", en: "1. What is liquefaction" } },
  {
    type: "p",
    text: {
      tr: "Sıvılaşma, boşlukları tamamen su dolu (doygun) gevşek ya da orta sıkılıktaki bir kum veya silt zeminin, deprem gibi tekrarlı kayma yükleri altında sanki sıvıymış gibi davranmasıdır. Bir kum torbasını düşünün: içindeki taneler birbirine temas ederek yükü taşır ve torba sağlam durur. Torba sallanır ve taneler arasındaki boşluktaki su basıncı artarsa, tanelerin birbirine bastırdığı temas kuvveti azalır. Bu temas kuvvetinin taşıdığı kısma etkin gerilme denir ve σ' ile gösterilir [kPa]. Toplam gerilme σ, boşluk suyu basıncı u [kPa] ve etkin gerilme arasında σ' = σ − u ilişkisi vardır. Zeminin kayma direnci etkin gerilmeye bağlıdır: τ_f = c' + σ' tan φ'. Deprem sırasında u arttıkça σ' küçülür ve direnç düşer. Eğer u, toplam gerilmeye neredeyse eşit olursa σ' sıfıra yaklaşır ve zemin bir çorba gibi davranır.", en: "Liquefaction is the behaviour in which a loose or medium-dense sand or silt whose voids are completely filled with water (saturated) acts like a liquid under repeated shear loads such as an earthquake. Think of a sandbag: the grains touch one another and carry the load, so the bag stays firm. When the bag is shaken and the water pressure in the spaces between the grains rises, the contact force with which the grains press against one another decreases. The part of the load carried by these contact forces is called the effective stress, written σ' [kPa]. The total stress σ, the pore water pressure u [kPa] and the effective stress are related by σ' = σ − u. The shear resistance of the soil depends on the effective stress: τ_f = c' + σ' tan φ'. During an earthquake, as u increases, σ' decreases and the resistance falls. If u comes almost equal to the total stress, σ' approaches zero and the soil behaves like a slurry.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu durumun sahadaki sonuçları iki ana biçimde görülür. Eğimli arazide sıvılaşmış tabaka üzerindeki kaymaya dayanıklı kabuk, yerçekimi etkisiyle birkaç metre yanlamasına kayabilir; buna yanal yayılma denir. Eğim çok dikse ya da tabaka çok gevşekse zemin tamamen akabilir; buna akma (flow failure) denir. Düz arazide ise daha yaygın hasar; oturma, kum kaynaması (yüzeye fışkıran kum ve su), temel kaybı ve bina eğilmesi biçiminde görülür. Kum kaynaması, yüksek boşluk suyu basıncının zeminin içinden yüzeye çıkış yolu bulmasının işaretidir. Hasar, sıvılaşmış tabakanın kalınlığına, derinliğine ve tekrarlı yükün süresine bağlıdır.", en: "The field consequences of this condition appear in two main forms. On sloping ground, a crust that stays intact above a liquefied layer may slide sideways by several metres under gravity; this is called lateral spreading. If the slope is very steep or the layer very loose, the soil may flow completely; this is called flow failure. On level ground the more common damage is settlement, sand boils (sand and water spouting to the surface), loss of bearing for foundations and tilting of buildings. A sand boil is a sign that high pore water pressure has found a path through the soil to the surface. The damage depends on the thickness and depth of the liquefied layer and on the duration of the cyclic load.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Hangi zeminlerin riskli olduğu üç özellikle belirlenir. Birincisi doygunluktur: yeraltı suyu seviyesi yüzeye yakın olmalıdır, çünkü kuru ya da kapiler üstü zemindeki boşluklar su ile dolu değildir. İkincisi gevşekliktir: sıkılık düşük olan kum, sarsıntıda tanelerini sıkıştırıp hacim azaltmaya daha yatkındır ve bu da boşluk suyu basıncını yükseltir. Üçüncüsü tane yapısıdır: temiz ya da az ince daneli kum ve siltler tipik adaylardır; plastik ince daneli (kil benzeri) zeminler ise genellikle sıvılaşmak yerine çevrimsel yumuşama gösterir. Programda bu ayrım PI ≥ 7 (ya da CPT'de I_c > 2,6) kuralıyla yapılır ve bu tür noktalar 'kil benzeri' olarak işaretlenir.", en: "Which soils are at risk is determined by three properties. The first is saturation: the groundwater level must be close to the surface, because the voids in dry or capillary-zone soil are not filled with water. The second is looseness: sand of low density tends to compact its grains and reduce its volume under shaking, which raises the pore water pressure. The third is grain structure: clean sands and silts with few fines are typical candidates, whereas plastic fine-grained (clay-like) soils usually show cyclic softening rather than liquefaction. In the program this distinction is made with the rule PI ≥ 7 (or I_c > 2.6 for CPT), and such points are marked as 'clay-like'.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Tarihsel depremlerde sıvılaşmanın sayısız örneği görülmüştür; 1964 Niigata depremi bu konunun klasik örneklerinden biridir. Ancak bu tür gözlemler, tek bir zeminde hangi koşulda sıvılaşacağını söylemez; bunun için bir tetiklenme (triggering) analizi gerekir. Bu analiz üç soruya cevap verir: deprem talebi ne kadar büyük, zeminin direnci ne kadar, ve ikisinin oranı birden küçük mü? Bu metindeki ana fikir budur ve sonraki bölümlerde her soru ayrıca açılır. Bu bölümdeki kavramsal anlatım, kaynakların genel tanımlarına dayanır; formüller ve katsayılar ise bundan sonraki bölümlerde programın kodundan okunur.", en: "Liquefaction has been observed in countless historical earthquakes; the 1964 Niigata earthquake is one of the classic examples. However, such observations do not tell us at what condition a particular soil will liquefy; that requires a triggering analysis. This analysis answers three questions: how large is the earthquake demand, how large is the resistance of the soil, and is the ratio of the two below one? This is the main idea of this text, and each question is taken up separately in the following sections. The conceptual explanation in this section is based on the general definitions in the sources; the formulas and coefficients are read in the later sections from the program code.",
    },
  },
  {
    type: "figure",
    id: "liq-mechanism",
    caption: {
      tr: "Doygun kum elemanının üç aşaması. (1) Sarsıntıdan önce taneler birbirine temas eder, boşluk suyu basıncı u hidrostatiktir. (2) Sarsıntıda u artar, temas gerilmesi azalır. (3) u toplam gerilmeye yaklaşır, σ′ = σ − u → 0 olur ve zemin sıvı gibi davranır. Sağdaki borular piezometredir.",
      en: "Three stages of a saturated sand element. (1) Before shaking the grains are in contact and the pore pressure u is hydrostatic. (2) During shaking u rises and the contact stress falls. (3) u approaches the total stress, so σ′ = σ − u → 0 and the soil behaves like a liquid. The tubes on the right are piezometers.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sıvılaşmanın sınırı: bu bölüm yalnız sığ ve doygun kumlar için basitleştirilmiş bir yaklaşımı anlatır. Kohezyonlu zeminler, çok sıkı kumlar, sızma akımı, ve su birikintisi (yer üstünde su) ayrı değerlendirilmelidir. GeoTek'in bu modülü de yalnız tek bir yeraltı suyu seviyesi (sismik GWT) ve hidrostatik boşluk suyu varsayar. Bu varsayımların her biri gerçek sahada zemin raporuyla doğrulanmalıdır.", en: "Limit of liquefaction: this section describes a simplified approach for shallow saturated sands only. Cohesive soils, very dense sands, seepage flow and standing water (water above the ground surface) must be evaluated separately. GeoTek's module also assumes only a single groundwater level (seismic GWT) and hydrostatic pore water. Each of these assumptions must be verified against the soil report for the real site.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Talep: basit sürtünme sezgisi, CSR ve rd", en: "2. Demand: simple shear intuition, CSR and rd" } },
  {
    type: "p",
    text: {
      tr: "Bir depremde zemin yatay olarak titrer. Yüzeyde bir kitabı üstündeki yatay kuvvetle ittiğinizde kitap ile masa arasında bir kesme (kayma) gerilmesi oluşur. Zeminde de aynı şey olur: derinlikteki bir elemanın üstündeki ağır zemin kütlesi, yatay ivmeyle titreştiğinde elemanın içinde bir kayma gerilmesi oluşur. Bu gerilmenin büyüklüğü iki şeye bağlıdır: ivmenin ne kadar büyük olduğuna ve üstteki ağırlığın ne kadar olduğuna. Ağırlık düşey gerilme σ_v ile ölçülür [kPa], ivme ise yerçekimi ivmesinin oranı a_max/g olarak yazılır (birimsiz). Oranın birimsiz olması önemlidir: a_max/g = 0,25 demek, zeminin yatay olarak yerçekiminin dörtte biri kadar ivmelendiği anlamına gelir.", en: "In an earthquake the ground vibrates horizontally. If you push a book on a table with a horizontal force, a shear stress develops between the book and the table. The same happens in the ground: when the heavy soil mass above an element at depth shakes with a horizontal acceleration, a shear stress develops inside the element. The size of this stress depends on two things: how large the acceleration is and how much weight lies above. The weight is measured by the vertical stress σ_v [kPa], and the acceleration is written as the ratio to gravitational acceleration, a_max/g (dimensionless). It is important that the ratio is dimensionless: a_max/g = 0.25 means that the soil accelerates horizontally by one quarter of gravity.",
    },
  },
  {
    type: "derivation",
    title: { tr: "Türetim: maksimum kayma gerilmesi ve CSR", en: "Derivation: peak shear stress and CSR" },
    steps: [
      {
        text: { tr: "Yatay ivmeden doğan atalet kuvveti, düşey gerilmenin yatay bileşeni gibi düşünülebilir: birim alan başına kuvvet (a_max/g) · σ_v kadardır. Bu, sonsuz bir zemin tabakasında yüzeye yakın varsayımla geçerlidir.", en: "Inertia per unit area: (a_max/g) times sigma_v." },
        expr: "τ ≈ (a_max / g) · σ_v",
      },
      {
        text: { tr: "Derinlik arttıkça üstteki zemin kütlesi tek bir blok gibi titremez; zemin biraz esner ve tepe ivmesi derinlikte azalır. Bu etkiyi gerilme azaltma katsayısı r_d ile hesaba katarız (0 < r_d ≤ 1 ve genellikle derinlikle azalır).", en: "Stress reduction with depth through r_d." },
        expr: "τ_max = (a_max / g) · σ_v · r_d",
      },
      {
        text: { tr: "Deprem kayması zamanla değişir; tepe değeri yalnız bir anda ulaşılır. Sismik kayma gerilmesinin etkili (eşdeğer) bir sabit genliği olarak bunun yaklaşık 0,65 katı alınır (Seed ve Idriss'in 1971 yaklaşımı). Bu 0,65, zemin fiziğinden türetilmiş bir sabit değil, deneysel bir eşdeğerlik faktörüdür.", en: "Equivalent average is about 0.65 of the peak." },
        expr: "τ_av ≈ 0,65 · τ_max",
      },
      {
        text: { tr: "Direnç de etkin gerilmeye bağlı olduğu için talep de etkin düşey gerilmeye oranlanır. Oran, birimsiz döngüsel gerilme oranıdır (CSR).", en: "Divide by the effective vertical stress." },
        expr: "CSR = τ_av / σ'_v0 = 0,65 · (a_max/g) · (σ_v0 / σ'_v0) · r_d",
      },
      {
        text: { tr: "Birim kontrolü: a_max/g birimsiz, σ_v/σ'_v birimsiz, r_d birimsiz; dolayısıyla CSR birimsizdir. Eğer sonucunuz birimli çıkıyorsa bir gerilmeyi kPa yerine kN/m² ya da kN/m olarak karıştırmışsınızdır.", en: "Unit check: CSR is dimensionless." },
      },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Gerilme azaltma katsayısı r_d, derinlikle değişen bir sayıdır ve yüzeyde 1'e yakın, derinlikte daha küçüktür. Youd (2001) yönteminde r_d yalnız derinliğe bağlıdır ve iki çizgi ile verilir: z ≤ 9,15 m için 1 − 0,00765 z, 9,15 < z ≤ 23 m için 1,174 − 0,0267 z. Bu, 5 m'de yaklaşık 0,962, 10 m'de yaklaşık 0,907 eder. Boulanger ve Idriss (2014) yönteminde r_d hem derinliğe hem deprem büyüklüğüne (M) bağlıdır; aynı derinlikte büyük depremde r_d daha küçüktür (kodla 5 m için M = 7,5'te 0,961 çıkar). Youd eğrisi 30 m'ye kadar, BI2014 eğrisi 34 m'ye kadar tanımlıdır; bu sınırların üstünde kod NaN döndürür ve nokta değerlendirilmez.", en: "The stress reduction coefficient r_d is a number that varies with depth; it is close to 1 at the surface and smaller at depth. In the Youd (2001) method r_d depends on depth only and is given by two lines: for z ≤ 9,15 m, 1 − 0,00765 z; for 9,15 < z ≤ 23 m, 1,174 − 0,0267 z. This gives about 0.962 at 5 m and about 0.907 at 10 m. In the Boulanger and Idriss (2014) method r_d depends on both depth and earthquake magnitude M; at the same depth r_d is smaller for a larger earthquake (the code gives 0.961 at 5 m for M = 7.5). The Youd curve is defined to 30 m and the BI2014 curve to 34 m; beyond these limits the code returns NaN and the point is not evaluated.",
    },
  },
  {
    type: "formula",
    expr: "r_d (Youd 2001) = 1 − 0,00765 z  (z ≤ 9,15 m);  1,174 − 0,0267 z  (z ≤ 23 m);  0,744 − 0,008 z  (z ≤ 30 m)",
    caption: {
      tr: "Youd 2001 r_d eğrisi. 23-30 m dalı programda Robertson ve Wride (1998) uzantısıdır; bu dal Youd'un orijinal eşitliğinin parçası değildir.",
      en: "Youd 2001 r_d. The 23-30 m branch is the Robertson and Wride (1998) extension.",
    },
    where: [{ tr: "z: derinlik [m]. r_d birimsizdir.", en: "z depth [m]." }],
  },
  {
    type: "figure",
    id: "liq-rd-depth",
    caption: {
      tr: "Gerilme azaltma katsayısı r_d derinlikle azalır. Mavi çizgi Youd vd. (2001) (0-30 m), kesikli çizgiler Boulanger-Idriss (2014) (M = 6,5; 7,5; 8,5). Aynı derinlikte büyük depremde r_d daha küçüktür.",
      en: "The stress reduction coefficient r_d decreases with depth. Blue: Youd et al. (2001), 0-30 m. Dashed: Boulanger-Idriss (2014) for M = 6.5, 7.5 and 8.5. At the same depth a larger earthquake gives a smaller r_d.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: CSR formülü, zeminin yatay olarak homojen bir tabaka gibi davrandığı ve kayma gerilmesinin tabaka boyunca basit biçimde değiştiği varsayımına dayanır. Derin, yumuşak ya da topografik olarak karmaşık bir sahada bu yaklaşım yetersiz kalabilir. Ayrıca CSR, a_max/g için 0 ile 2 arasında sınırlandırılmıştır; programa bu aralık dışı bir değer girilirse hata verir. Deprem büyüklüğü (M) için kod 4,0 ile 9,5 arasını kabul eder. Bu kabullerin dışındaki durumlarda kendi kaynaklı analiz gerekir.", en: "Limits: the CSR formula rests on the assumption that the soil behaves as a horizontally homogeneous layer and that the shear stress varies simply along the layer. On a deep, soft or topographically complex site this approach may be inadequate. In addition, CSR is restricted to a_max/g between 0 and 2; a value outside this range entered into the program raises an error. For earthquake magnitude M the code accepts 4.0 to 9.5. In cases outside these assumptions, a site-specific analysis is required.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Direnç: SPT ve CPT'den CRR", en: "3. Resistance: CRR from SPT and CPT" } },
  {
    type: "p",
    text: {
      tr: "Direnç, zeminin tekrarlı kayma altında sıvılaşmadan dayanabildiği döngüsel gerilme oranıdır (CRR). Doğrudan laboratuvarda ölçmek zor olduğu için sahada yapılan iki standart deneyden dolaylı olarak tahmin edilir: SPT (standart penetrasyon, darbe sayısı N) ve CPT (konik penetrasyon, uç direnci q_c ve yan sürtünme f_s). İki deneyde de ölçülen sayı, zeminin yoğunluğunun ve gerilme durumunun bir yansımasıdır; ama ham değer doğrudan karşılaştırılamaz. Bu nedenle önce deneyin enerjisi, ekipmanı ve derinliği için düzeltme yapılır, sonra bu düzeltilmiş değer tipik bir sıvılaşma eğrisine taşınır.", en: "Resistance is the cyclic stress ratio that the soil can withstand under repeated shear without liquefying (CRR). Since it is difficult to measure directly in the laboratory, it is estimated indirectly from two standard field tests: SPT (standard penetration test, blow count N) and CPT (cone penetration test, tip resistance q_c and sleeve friction f_s). In both tests the measured number reflects the density of the soil and its stress state, but the raw value cannot be compared directly. Therefore a correction is first applied for the energy, equipment and depth of the test, and then this corrected value is carried onto a typical liquefaction curve.",
    },
  },
  {
    type: "p",
    text: {
      tr: "SPT için ilk adım enerji ve ekipman düzeltmesidir. Standart şiş (N) darbe sayısı, düşen tokmağın enerji oranına (ER, %) göre 60'a normalize edilir: N60 = N · (ER/60) · C_B · C_S · C_R. Burada C_B kuyu çapı, C_S örnekleyici (liner'lı ya da liner'sız) ve C_R çubuk uzunluğu düzeltmesidir; program C_R değerini 3 m altında 0,75, 3-4 m arasında 0,80, 4-6 m arasında 0,85, 6-10 m arasında 0,95, 10 m üstünde 1,00 alır. Sonra etkin gerilmeye göre normalize edilir: (N1)60 = C_N · N60 ve C_N = min[√(Pa/σ'_v0), 1,7] (Liao ve Whitman). Pa = 101,325 kPa atmosfer basıncıdır. Böylece her derinlikteki sayı, 1 atm ve 60 % enerji referansına çevrilmiş olur.", en: "For SPT the first step is the energy and equipment correction. The standard penetration blow count N is normalised to 60% hammer energy by the energy ratio (ER, %): N60 = N · (ER/60) · C_B · C_S · C_R. Here C_B is the borehole diameter correction, C_S the sampler correction (with or without liner) and C_R the rod length correction. The program takes C_R as 0.75 below 3 m, 0.80 between 3 and 4 m, 0.85 between 4 and 6 m, 0.95 between 6 and 10 m, and 1.00 above 10 m. The value is then normalised to effective stress: (N1)60 = C_N · N60, with C_N = min[√(Pa/σ'_v0), 1,7] (Liao and Whitman). Pa = 101.325 kPa is atmospheric pressure. Thus the count at each depth is converted to a reference of 1 atm and 60% energy.",
    },
  },
  {
    type: "formula",
    expr: "N60 = N · (ER / 60) · C_B · C_S · C_R;   (N1)60 = C_N · N60;   C_N = min[√(Pa / σ'_v0), 1,7]",
    caption: {
      tr: "SPT normalizasyonu (spt.py). C_N'nin 1,7 ile kırpıldığı bölgede (yüzeye yakın, σ'_v0 < 35 kPa) C_N sabit kalır.",
      en: "SPT normalisation (spt.py). C_N is capped at 1.7 near the surface.",
    },
  },
  {
    type: "p",
    text: {
      tr: "İnce dane (FC, yüzde) etkisi, aynı (N1)60 değerinde bile direnci değiştirir. Youd (2001) yönteminde (N1)60cs = α + β (N1)60 düzeltmesi kullanılır: FC ≤ 5 için α = 0 ve β = 1; 5 < FC < 35 için α = exp(1,76 − 190/FC²) ve β = 0,99 + FC^1,5/1000; FC ≥ 35 için α = 5 ve β = 1,2. Örneğin FC = 10 % için α ≈ 0,869, β ≈ 1,022 olur; (N1)60 = 12 ise (N1)60cs ≈ 13,13 çıkar. Bu düzeltme, ince dane artınca zeminin direncini artırmak gibi görünür, ama bu sezgi sınırlıdır ve FC'nin ölçümü ya da kestirimi belirsizdir. Programda Youd yolunda FC her zaman açıkça verilmelidir; varsayılan değer yoktur.", en: "The effect of fines (FC, in percent) changes the resistance even at the same (N1)60 value. In the Youd (2001) method the fines correction (N1)60cs = α + β (N1)60 is used: for FC ≤ 5, α = 0 and β = 1; for 5 < FC < 35, α = exp(1,76 − 190/FC²) and β = 0,99 + FC^1,5/1000; for FC ≥ 35, α = 5 and β = 1,2. For example, for FC = 10 % we get α ≈ 0.869 and β ≈ 1.022; if (N1)60 = 12, then (N1)60cs ≈ 13.13. This correction makes the soil appear more resistant as fines increase, but this intuition is limited, and the measurement or estimate of FC is itself uncertain. In the program, FC must always be given explicitly on the Youd path; there is no default value.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Youd 2001 yolunda CRR, M = 7,5 ve 1 atm için (N1)60cs'nin bir fonksiyonudur: CRR7,5 = 1/(34 − N) + N/135 + 50/(10N + 45)² − 1/200, N = (N1)60cs < 30. Eşiğin üstünde (N ≥ 30) zemin çok yoğun kabul edilir ve sıvılaşmaz; kod bu noktaya CRR atamaz ve durumunu 'yoğun' (non_liquefiable_dense) olarak işaretler. Boulanger ve Idriss (2014) SPT yolunda ise (N1)60cs'yi C_N ile Δ(N1)60 terimlerini birlikte ve yinelemeli olarak çözer; CRR7,5 = exp[N/14,1 + (N/126)² − (N/23,6)³ + (N/25,4)⁴ − 2,8] ile verilir. Bu iki yöntemin ayrı çizgileri olduğu için, aynı (N1)60cs için sonuçlar çok yakın ama aynı değildir (aşağıdaki 3. bölüm figürüne bakın).", en: "On the Youd 2001 path, CRR for M = 7.5 and 1 atm is a function of (N1)60cs: CRR7.5 = 1/(34 − N) + N/135 + 50/(10N + 45)² − 1/200, with N = (N1)60cs < 30. Above the threshold (N ≥ 30) the soil is considered very dense and does not liquefy; the code does not assign a CRR at this point and marks its status as 'dense' (non_liquefiable_dense). On the Boulanger and Idriss (2014) SPT path, (N1)60cs is solved iteratively together with the C_N and Δ(N1)60 terms, and CRR7.5 = exp[N/14,1 + (N/126)² − (N/23,6)³ + (N/25,4)⁴ − 2,8]. Because the two methods have separate curves, the results for the same (N1)60cs are very close but not identical (see the section 3 figure below).",
    },
  },
  {
    type: "figure",
    id: "liq-spt-correlation",
    caption: {
      tr: "CRR7,5 ile düzeltilmiş (N1)60 ilişkisi. İnce dane oranı FC arttıkça aynı (N1)60 için direnç artar, eğri yukarı kayar. Renkli kesikli dikey çizgiler (N1)60cs = 30 yoğun sınırının her FC eğrisi için düştüğü (N1)60 değerini gösterir ((N1)60 = (30 − α)/β; FC ≤ %5 için sınır eksenin dışındadır); bunun ötesinde FS hesaplanmaz.",
      en: "CRR7.5 versus corrected (N1)60. A higher fines content FC raises the resistance for the same (N1)60, shifting the curve upward. The coloured dashed vertical lines mark where the dense limit (N1)60cs = 30 falls in (N1)60 for each FC curve ((N1)60 = (30 − α)/β; for FC ≤ 5 percent it lies outside the axis); beyond it no FS is computed.",
    },
  },
  {
    type: "p",
    text: {
      tr: "CPT yolunda ise sıralama farklıdır. Ölçülen uç direnci q_c, düşey gerilmeyi çıkararak net değere dönüştürülür ve q_c1N = C_q · q_c/Pa ile 1 atm'e normalize edilir (C_q = min[(Pa/σ'_v0)^n, 1,7]; n zemin tipine bağlı bir üsdür). Normalizasyonda ve sınıflandırmada kullanılan davranış indeksi I_c, Q ve F büyüklüklerinden hesaplanır: I_c = √((3,47 − log Q)² + (log F + 1,22)²). I_c, zemini kumdan kile doğru bir sürekli sınıflandırma ölçeğinde konumlandırır; programda I_c > 2,6 olan nokta kil benzeri sayılır. Youd yolunda q_c1Ncs = K_c · q_c1N ve K_c, I_c'nin polinomudur (I_c ≤ 1,64 için 1); BI2014 yolunda ise q_t ve FC (varsayılan olarak I_c'den tahmin edilir) kullanılır. CRR7,5 (Robertson ve Wride 1998) için programdaki Youd yolu şöyledir: q < 50 için 0,833 q/1000 + 0,05; q ≥ 50 için 93 (q/1000)³ + 0,08; q ≥ 160 yoğun kabul edilir.", en: "On the CPT path the sequence is different. The measured tip resistance q_c is converted to a net value by subtracting the vertical stress, and is normalised to 1 atm as q_c1N = C_q · q_c/Pa (C_q = min[(Pa/σ'_v0)^n, 1,7], where n is an exponent that depends on the soil type). The behaviour index I_c, used in normalisation and classification, is calculated from Q and F: I_c = √((3,47 − log Q)² + (log F + 1,22)²). I_c places the soil on a continuous classification scale from sand to clay; in the program a point with I_c > 2.6 is treated as clay-like. On the Youd path q_c1Ncs = K_c · q_c1N, where K_c is a polynomial in I_c (equal to 1 for I_c ≤ 1,64); on the BI2014 path q_t and FC (estimated from I_c by default) are used. For CRR7.5 (Robertson and Wride 1998), the Youd path in the program is: for q < 50, 0,833 q/1000 + 0,05; for q ≥ 50, 93 (q/1000)³ + 0,08; q ≥ 160 is treated as dense.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Refüzal (SPT'de darbe sayısının çok büyük olması, örneğin 50 darbede sadece az ilerleme) değerleri alt sınır kabul edilir. Gerçek N bu değerden büyüktür, bu yüzden FS muhafazakâr (düşük) çıkar ve bu sonuç yorumlanırken dikkate alınmalıdır.", en: "Refusal values (a very large blow count in SPT, for example only slight penetration after 50 blows) are taken as lower bounds. The true N is larger than this value, so the FS comes out conservatively low, and this must be taken into account when interpreting the result.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: 5 m derinlik, Youd 2001 SPT", en: "Example 1: 5 m depth, Youd 2001 SPT" },
    given: [
      { tr: "a_max/g = 0.25, M = 7.5", en: "a_max/g = 0.25, M = 7.5" },
      { tr: "z = 5 m; σ_v0 = 92.5 kPa; σ'_v0 = 63.07 kPa (deprem anı)", en: "z = 5 m; sigma_v0 = 92.5 kPa; sigma'_v0 = 63.07 kPa" },
      { tr: "(N1)60 = 12; FC = 10 %", en: "(N1)60 = 12; FC = 10 %" },
    ],
    steps: [
      { label: { tr: "r_d (Youd, z ≤ 9,15 m)", en: "r_d (Youd)" }, expr: "r_d = 1 − 0,00765 · 5 = 0,9618", result: "0.9618" },
      { label: { tr: "CSR", en: "CSR" }, expr: "CSR = 0,65 · 0,25 · (92,5 / 63,07) · 0,9618 = 0,2292", result: "0.229" },
      { label: { tr: "(N1)60cs", en: "(N1)60cs" }, expr: "α = exp(1,76 − 190/10²) = 0,8694;  β = 0,99 + 10^1,5/1000 = 1,0216;  (N1)60cs = 0,8694 + 1,0216 · 12 = 13,13", result: "13.13" },
      { label: { tr: "CRR7,5", en: "CRR7.5" }, expr: "1/(34 − 13,13) + 13,13/135 + 50/(10·13,13 + 45)² − 1/200 = 0,04792 + 0,09726 + 0,00161 − 0,00500 = 0,1418", result: "0.142" },
      { label: { tr: "MSF (M = 7,5)", en: "MSF (M = 7.5)" }, expr: "MSF = 10^2,24 / 7,5^2,56 = 0,9996 ≈ 1", result: "1.00" },
      { label: { tr: "K_σ (σ'_v0 = 63,07 < Pa = 101,3)", en: "K_sigma" }, expr: "σ'_v0 < Pa olduğundan K_σ = 1", result: "1.00" },
      { label: { tr: "CRR ve FS", en: "CRR and FS" }, expr: "CRR = 0,1418 · 1,00 · 1,00 = 0,142;  FS = CRR / CSR = 0,142 / 0,229 = 0,62", result: "FS = 0.62 < 1: sıvılaşabilir" },
    ],
    program: {
      input: "method = youd2001, a_max/g = 0.25, M = 7.5, z = 5 m, sigma_v0 = 92.5 kPa, sigma'_v0 = 63.07 kPa, (N1)60 = 12, FC = 10 % (youd.stress_reduction, youd.spt_resistance, youd.magnitude_scaling, youd.overburden_factor ve common.cyclic_stress_ratio fonksiyonları doğrudan çağrıldı)",
      output: "r_d = 0.96175; CSR = 0.22921; (N1)60cs = 13.1288; CRR7.5 = 0.14177; MSF = 0.99964; K_sigma = 1.0; CRR = 0.14172; FS = 0.6183; yoğun değil; uyarı yok",
      note: {
        tr: "Elle hesap ile program sonucu aynı (yuvarlama farkı dışında). Tam analyze_spt yolu SPTProcessed nesnesi gerektirdiği için bu örnekte çalıştırılmadı; yalnız Youd SPT formüllerinin çağrıldığı fonksiyonlar çalıştırıldı.",
        en: "Hand and program results agree within rounding; the full analyze_spt path was not run.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Deprem büyüklüğü (MSF) ve üst yük düzeltmesi (Kσ)", en: "4. Magnitude scaling (MSF) and overburden (K_sigma)" } },
  {
    type: "p",
    text: {
      tr: "CRR7,5, bir M = 7,5 depreminin çevrim sayısına göre tanımlanır. Büyük bir deprem daha uzun süre ve daha çok tekrarlı yük üretir; bu nedenle aynı CSR, büyük depremde daha fazla sayıda çevrimle eşdeğer olur ve zemin için daha zordur. Küçük depremde tersi geçerlidir. Bu fark büyüklük ölçekleme faktörü (MSF) ile düzeltilir: CRR = CRR7,5 · MSF · K_σ. Sezgisel olarak MSF, 'bu deprem, M = 7,5 depremi kadar tehlikeli mi, değil mi?' sorusunun sayısal cevabıdır. M = 7,5'te MSF ≈ 1; M küçüldükçe MSF büyür, M büyüdükçe MSF küçülür. Youd 2001'in varsayılan (idriss) eğrisi MSF = 10^2,24 / M^2,56 biçimindedir ve N'den bağımsızdır.", en: "CRR7.5 is defined in terms of the number of cycles of an M = 7.5 earthquake. A large earthquake produces a longer duration and more repeated loading; therefore the same CSR corresponds to a larger number of cycles in a large earthquake and is harder for the soil. For a small earthquake the opposite holds. This difference is corrected by the magnitude scaling factor (MSF): CRR = CRR7.5 · MSF · K_σ. Intuitively, MSF is the numerical answer to the question 'is this earthquake more or less dangerous than an M = 7.5 earthquake?' At M = 7.5, MSF ≈ 1; as M decreases, MSF increases, and as M increases, MSF decreases. The default (idriss) curve of Youd 2001 has the form MSF = 10^2,24 / M^2,56 and is independent of N.",
    },
  },
  {
    type: "formula",
    expr: "MSF (Youd, idriss) = 10^2,24 / M^2,56;   MSF (andrus_stokoe) = (M / 7,5)^-3,3;   MSF (BI2014) = 1 + (MSF_max − 1)(8,64 e^(−M/4) − 1,325)",
    caption: {
      tr: "Üç MSF tanımı. Youd'un idriss eğrisi NCEER aralığının alt sınırı, andrus_stokoe üst sınırıdır. BI2014 MSF'si MSF_max üzerinden (N1)60cs'ye bağlıdır ve 2,2 ile sınırlanır.",
      en: "Three MSF forms: Youd idriss (lower bound), Andrus-Stokoe (upper bound), BI2014 (depends on resistance).",
    },
  },
  {
    type: "figure",
    id: "liq-msf-curve",
    caption: {
      tr: "Deprem büyüklüğü ölçekleme faktörü MSF, M = 7,5'te 1'dir. Mavi: Youd (Idriss) 10^2,24 / M^2,56; kırmızı kesikli: Andrus-Stokoe (M/7,5)^−3,3. M < 7,5'te MSF > 1, M > 7,5'te MSF < 1 olur.",
      en: "Magnitude scaling factor MSF equals 1 at M = 7.5. Blue: Youd (Idriss) 10^2.24 / M^2.56; red dashed: Andrus-Stokoe (M/7.5)^−3.3. MSF > 1 for M < 7.5 and < 1 for M > 7.5.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Üst yük düzeltmesi K_σ ise düşey etkin gerilmenin büyüklüğünü hesaba katar. Derinlerde zemin tanelerinin üstündeki yük büyüktür, bu nedenle zemin kayma sırasında daha az genleşme (dilatasyon) yapar ve tanelerinin birbirini kilitlemesi azalır. Sonuç olarak aynı CSR'de sıvılaşma daha kolay olur. Youd yönteminde K_σ = (σ'_v0 / Pa)^(f − 1) yalnız σ'_v0 > Pa iken uygulanır, f = 0,7 varsayılan değerdir (0,6-0,8 aralığında). Örneğin σ'_v0 = 200 kPa için K_σ ≈ 0,815'tir; bu, CRR'nin bu derinlikte yüzde 18 civarında azaldığı anlamına gelir. Boulanger ve Idriss (2014) yönteminde K_σ = 1 − C_σ ln(σ'_v0/Pa) biçimindedir ve 1,1 ile sınırlıdır; bu yöntem σ'_v0 < Pa iken K_σ'yı 1'in üstüne çıkarabilir.", en: "The overburden correction K_σ accounts for the magnitude of the vertical effective stress. At depth the load on the soil grains is large, so during shear the soil dilates less and the interlocking of its grains decreases. As a result liquefaction becomes easier at the same CSR. In the Youd method K_σ = (σ'_v0 / Pa)^(f − 1) is applied only when σ'_v0 > Pa; f = 0.7 is the default value (within the range 0.6 to 0.8). For example, for σ'_v0 = 200 kPa, K_σ ≈ 0.815; this means the CRR at that depth is reduced by about 18 percent. In the Boulanger and Idriss (2014) method K_σ = 1 − C_σ ln(σ'_v0/Pa) and it is limited to 1.1; this method can raise K_σ above 1 when σ'_v0 < Pa.",
    },
  },
  {
    type: "formula",
    expr: "Youd: K_σ = (σ'_v0 / Pa)^(f − 1)  (σ'_v0 > Pa; aksi halde 1),  f = 0,7.   BI2014: K_σ = 1 − C_σ ln(σ'_v0 / Pa) ≤ 1,1",
    caption: {
      tr: "Üst yük düzeltmesi. Pa = 101,325 kPa. Youd'da K_σ en çok 1'dir; BI2014'te C_σ, N ya da q_c1N'e bağlı olduğu için K_σ'nın üst sınırı 1,1'dir.",
      en: "Overburden correction in both methods; Pa = 101.325 kPa.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: MSF ve K_σ, kaynaklardaki deneysel veri setlerine dayanan ampirik eğrilerdir. MSF, M'nin 7,5 civarında olmasına göre tasarlanmıştır; çok büyük ya da çok küçük depremlerde eğrinin son kısmı daha az güvenilirdir. Youd'un K_σ'sı f = 0,6-0,8 aralığında ayarlanmalıdır ve programda bu aralığın dışında hata verilir. Ayrıca MSF ve K_σ'nın tek başına hesaba katamadığı etkiler (uzun periyotlu sarsıntı, tabakalı sahada ivme yükselişi) vardır.", en: "Limits: MSF and K_σ are empirical curves based on the experimental data sets in the sources. MSF was designed around M ≈ 7.5; for very large or very small earthquakes the end parts of the curve are less reliable. Youd's K_σ must be adjusted with f in the range 0.6 to 0.8, and the program raises an error outside this range. In addition, there are effects that MSF and K_σ cannot account for on their own, such as long-period shaking and acceleration amplification in a layered site.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Güvenlik katsayısı (FS) ve LPI", en: "5. Factor of safety (FS) and LPI" } },
  {
    type: "p",
    text: {
      tr: "Güvenlik katsayısı, direncin talebe oranıdır: FS = CRR / CSR. FS > 1 ise direnç talepten büyüktür ve zemin sıvılaşmaz; FS < 1 ise sıvılaşma beklenir. Bu sayı birimsizdir ve bir tasarım kararı değil, bir göstergedir. Programda hedef FS (varsayılan 1,1) kullanılır: FS < 1 'sıvılaşabilir', 1 ≤ FS < hedef 'marjinal' ve FS ≥ hedef 'güvenli' olarak sınıflandırılır. Marjinal bölge, küçük bir girdi belirsizliğinin sonucu tersine çevirebileceği bölgedir; bu nedenle yalnız FS < 1 bakmak yanıltıcı olabilir.", en: "The factor of safety is the ratio of resistance to demand: FS = CRR / CSR. FS > 1 means the resistance is greater than the demand and the soil does not liquefy; FS < 1 means liquefaction is expected. This number is dimensionless and is an indicator, not a design decision. The program uses a target FS (default 1.1): FS < 1 is classified as 'liquefiable', 1 ≤ FS < target as 'marginal', and FS ≥ target as 'safe'. The marginal zone is where a small uncertainty in the input could reverse the result; therefore looking only at FS < 1 can be misleading.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Her nokta için program önce bir durum atar ve FS yalnız uygun noktalarda hesaplanır. Öncelik sırası şöyledir: kullanıcının dışlaması en yüksek öncelikli; sonra z < GWT (yeraltı suyu üstü, doygun değil, 'above_gwt'); sonra yöntemin derinlik sınırı; sonra kil benzeri (PI ≥ 7 ya da I_c > 2,6); sonra yoğun (Youd N ≥ 30 ya da q_c1Ncs ≥ 160); en son geçersiz (σ'_v0 ≤ 0 ya da FS sonlu değil). Bu sıra önemlidir: yeraltı suyu üstündeki bir noktanın FS'si yoktur, çünkü o nokta sıvılaşacak kadar doygun değildir.", en: "For each point the program first assigns a status, and FS is calculated only at suitable points. The priority order is: the user's exclusion has the highest priority; then z < GWT (above the groundwater table, not saturated, 'above_gwt'); then the depth limit of the method; then clay-like (PI ≥ 7 or I_c > 2.6); then dense (Youd N ≥ 30 or q_c1Ncs ≥ 160); and finally invalid (σ'_v0 ≤ 0 or FS not finite). This order matters: a point above the groundwater table has no FS, because it is not saturated enough to liquefy.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sıvılaşma potansiyel indeksi LPI (Iwasaki ve arkadaşları), bir sahayı tek bir sayıyla özetlemek için kullanılır. Fikir şudur: sığ ve FS'si düşük tabakalar, derin olanlardan daha büyük hasara yol açar, çünkü yüzeye daha yakındır. Bu nedenle her noktanın (1 − FS) değeri 0-20 m arasında bir ağırlıkla çarpılır: LPI = ∫₀²⁰ F(z) · w(z) dz, F = 1 − FS (FS < 1 ise, değilse 0), w(z) = 10 − 0,5 z. Ağırlık yüzeyde 10, 20 m'de 0'dır. Sonuç, boyutsuz bir sayıdır ve tehlike kategorisi şöyledir: LPI = 0 çok düşük; ≤ 5 düşük; ≤ 15 yüksek; > 15 çok yüksek. LPI bir ön tarama göstergesidir; bir tasarım değeri değildir.", en: "The liquefaction potential index LPI (Iwasaki et al.) is used to summarise a site with a single number. The idea is that shallow layers with low FS cause more damage than deeper ones, because they are closer to the surface. Therefore the value (1 − FS) of each point is multiplied by a weight over 0 to 20 m: LPI = ∫₀²⁰ F(z) · w(z) dz, with F = 1 − FS (when FS < 1, otherwise 0) and w(z) = 10 − 0,5 z. The weight is 10 at the surface and 0 at 20 m. The result is a dimensionless number, and the hazard categories are: LPI = 0 very low; ≤ 5 low; ≤ 15 high; > 15 very high. LPI is a preliminary screening indicator, not a design value.",
    },
  },
  {
    type: "formula",
    expr: "LPI = ∫₀²⁰ F(z) · w(z) dz,   F = 1 − FS (FS < 1),  0 (aksi halde),   w(z) = 10 − 0,5 z",
    caption: {
      tr: "Iwasaki LPI. Programda integral, her test noktası için 'tributary' (paylaşılan) aralıklarla toplanır: her nokta, komşu noktaların ortasına kadar uzanan bir aralığı temsil eder ve aralığın ağırlıklı integrali doğrudan hesaplanır (kodda w'nin tam integrali: 10 (b − a) − 0,25 (b² − a²)). İlk test noktası 2 m veya daha sığsa, ilk aralık yüzeye kadar uzatılır (yeraltı suyu derinliği biliniyorsa en fazla o derinliğe kadar), çünkü ağırlığı en yüksek olan üst tabakayı atlamak güvensiz tarafta kalırdı.",
      en: "Iwasaki LPI as implemented: each test point represents a tributary interval, and the weighted integral is computed exactly (the integral of w is 10 (b - a) - 0.25 (b^2 - a^2)). If the first test point is at 2 m or shallower, its interval is extended up to the ground surface (at most up to the groundwater depth when known), because dropping the heavily weighted top layer would be unsafe.",
    },
  },
  {
    type: "figure",
    id: "liq-lpi-weight",
    caption: {
      tr: "Ağırlık w(z) = 10 − 0,5 z, yüzeyde 10, 20 m'de 0. Örnek 2'nin dört paylaşılan aralığı (0-3, 3-5, 5-7, 7-9 m) çizgi ile eksen arasında gösterilir; turuncu aralıklarda FS < 1 olduğu için F = 1 − FS katkı verir, gri aralık (FS ≥ 1) katkı vermez. İlk aralık, ilk test noktası 2 m olduğu için yüzeye uzatılmıştır.",
      en: "Weight w(z) = 10 - 0.5 z: 10 at the surface, 0 at 20 m. The four tributary intervals of Example 2 (0-3, 3-5, 5-7, 7-9 m) are shaded between the line and the axis; orange intervals have FS < 1 and contribute F = 1 - FS, the grey interval (FS >= 1) does not. The first interval is extended to the surface because the first test point is at 2 m.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: dört nokta için LPI", en: "Example 2: LPI for four points" },
    given: [
      { tr: "Dört test noktası: z = 2, 4, 6, 8 m", en: "Four test points: z = 2, 4, 6, 8 m" },
      { tr: "FS: 0,9 (z = 2 m), 0,7 (z = 4 m), 1,2 (z = 6 m), 0,8 (z = 8 m)", en: "FS: 0.9, 0.7, 1.2, 0.8" },
      { tr: "w(z) = 10 − 0,5 z", en: "w(z) = 10 - 0.5 z" },
    ],
    steps: [
      { label: { tr: "Paylaşılan aralıklar (orta noktalara göre)", en: "Tributary intervals" }, expr: "[0, 3], [3, 5], [5, 7], [7, 9] m  (ilk nokta 2 m ≤ 2 m: ilk aralık yüzeye uzatılır)", result: "4 aralık" },
      { label: { tr: "F = 1 − FS", en: "F = 1 - FS" }, expr: "F = 0,1 ; 0,3 ; 0 (FS ≥ 1) ; 0,2", result: "0,1 / 0,3 / 0 / 0,2" },
      { label: { tr: "w-integrali: ∫(10 − 0,5z) dz = 10 (b − a) − 0,25 (b² − a²)", en: "Integral of w" }, expr: "[0,3]: 30 − 0,25·9 = 27,75;  [3,5]: 20 − 0,25·16 = 16;  [5,7]: 20 − 0,25·24 = 14;  [7,9]: 20 − 0,25·32 = 12", result: "27,75 / 16 / 14 / 12" },
      { label: { tr: "Her aralığın F × w katkısı", en: "Contribution per interval" }, expr: "0,1·27,75 + 0,3·16 + 0·14 + 0,2·12 = 2,775 + 4,8 + 0 + 2,4", result: "9,975" },
      { label: { tr: "LPI ve kategori", en: "LPI and category" }, expr: "LPI = 9,975 ; 5 < 9,975 ≤ 15", result: "yüksek (high)" },
    ],
    program: {
      input: "Test derinlikleri [2, 4, 6, 8] m; FS = [0,9; 0,7; 1,2; 0,8]; w(z) = 10 − 0,5 z; LPI fonksiyonu: liquefaction_potential_index(depth, fs) (common.py)",
      output: "LPI = 9.975; kategori: high; paylaşılan aralıklar [0,3], [3,5], [5,7], [7,9] m (ilk aralık yüzeye uzatılmış)",
      note: {
        tr: "Elle hesap ile program sonucu aynıdır (9,975). 2 m'deki ilk nokta, ilk aralığı z = 0'a kadar uzatır; bu düzeltmeden önce program 0-1 m'yi hiç saymıyor ve 9,0 veriyordu (güvensiz taraf). Uzatma eşiği (ilk nokta ≤ 2 m) kaynaktan gelmez, programın bir seçimidir; yeraltı suyu derinliği biliniyorsa uzatma o derinlikte durur, çünkü suyun üstündeki zemin sıvılaşabilir sayılmaz.",
        en: "Hand and program agree (9.975). The first point at 2 m extends the first interval to z = 0; before this correction the program skipped 0-1 m and returned 9.0 (unsafe side). The 2 m threshold is a program choice, not from a source; when the groundwater depth is known the extension stops there.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Youd 2001 ile Boulanger-Idriss 2014 farkları", en: "6. Youd 2001 versus Boulanger-Idriss 2014" } },
  {
    type: "p",
    text: {
      tr: "İki yöntem aynı fiziksel fikri (talep ve direnç oranı) kullanır, ama birçok katsayısı ve normalizasyonu farklıdır. Youd 2001, NCEER çalıştayının özeti olarak geniş bir kullanım görmüş, çok sayıda saha verisine dayanan sade bir yöntemdir. Boulanger ve Idriss 2014 ise daha sonraki veri setlerini ve SPT ile CPT'yi tutarlı bir çerçevede birleştiren, iç içe (yinelemeli) çözülen daha karmaşık bir yöntemdir. Hangi yöntemin kullanılacağı kararı, projenin şartnamesine ve tasarım kurumunun tercihine bağlıdır; bu metin hangisinin 'doğru' olduğunu söylemez.", en: "The two methods use the same physical idea (the ratio of demand to resistance), but many of their coefficients and normalisations differ. Youd 2001, a summary of the NCEER workshops, is a simple method that has seen wide use and rests on many field case histories. Boulanger and Idriss 2014 is a more complex method that combines later data sets and treats SPT and CPT within a consistent framework, solved iteratively (nested). Which method to use depends on the project specification and the preference of the design organisation; this text does not say which one is 'correct'.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Farkların en önemlileri şunlardır. r_d: Youd yalnız derinliğe bağlıdır ve 30 m'de biter; BI2014 M'ye bağlıdır ve 34 m'ye kadar tanımlıdır. Aynı 5 m'de Youd 0,962 verir; BI2014 M = 7,5'te 0,961, M = 6,5'te 0,932 ve M = 8,5'te 0,990 verir. MSF: Youd (idriss) N'den bağımsızdır; BI2014'te MSF_max, (N1)60cs ile artar ve 2,2'ye kadar çıkar. K_σ: Youd yalnız σ'_v0 > Pa için uygulanır ve ≤ 1'dir; BI2014'te C_σ direnç ile değişir ve K_σ 1,1 ile sınırlıdır. Yoğunluk sınırı: Youd N ≥ 30 noktasını 'yoğun' sayar; BI2014 SPT yolunda bu maske kapalıdır. CPT: Youd q_c ve K_c kullanır; BI2014 q_t ve FC kullanır.", en: "The most important differences are these. r_d: Youd depends on depth only and ends at 30 m; BI2014 depends on M and is defined to 34 m. At the same 5 m depth Youd gives 0.962, whereas BI2014 gives 0.961 at M = 7.5, 0.932 at M = 6.5 and 0.990 at M = 8.5. MSF: Youd (idriss) is independent of N; in BI2014 MSF_max rises with (N1)60cs and can reach 2.2. K_σ: Youd applies only for σ'_v0 > Pa and is at most 1; in BI2014 C_σ varies with resistance and K_σ is limited to 1.1. Density limit: Youd treats N ≥ 30 as 'dense'; on the BI2014 SPT path this mask is off. CPT: Youd uses q_c and K_c, whereas BI2014 uses q_t and FC.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Programın davranışı: analiz fonksiyonlarında varsayılan yöntem bi2014'tür; yalnız youd2001 açıkça seçildiğinde Youd yolu çalışır. Bu, sonucu etkileyen bir seçimdir ve raporda yöntem adıyla birlikte yazılmalıdır. Aynı (N1)60cs = 13,13 değeri için CRR7,5 değerleri Youd eğrisinde 0,142 ve BI2014 eğrisinde 0,141 çıkar; bu, iki eğrinin bu bölgede çok yakın olduğunu gösterir. Ancak aynı sahadaki FS'yi karşılaştırmak için iki yöntemi de tam olarak aynı girdiyle (N, ER, FC, σ'_v0, M) çalıştırmak gerekir; (N1)60cs bile iki yöntemde farklı yoldan hesaplanır.", en: "Program behaviour: in the analysis functions the default method is bi2014; the Youd path runs only when youd2001 is explicitly selected. This choice affects the result and must be written in the report together with the method name. For the same (N1)60cs = 13.13, CRR7.5 is 0.142 on the Youd curve and 0.141 on the BI2014 curve, which shows that the two curves are very close in this region. However, to compare the FS at the same site the two methods must be run with exactly the same input (N, ER, FC, σ'_v0, M); even (N1)60cs is calculated by a different route in each method.",
    },
  },
  {
    type: "figure",
    id: "liq-csr-crr",
    caption: {
      tr: "Aynı sahada derinliğe göre CSR (talep, kırmızı) ve CRR (direnç, mavi). CRR'nin CSR'nin altına düştüğü gölgeli bölge FS < 1, yani sıvılaşma beklenen derinliklerdir; sıkı kum tabakasında CRR yüksektir (şematik).",
      en: "CSR (demand, red) and CRR (resistance, blue) versus depth at one site. Where CRR falls below CSR (shaded) FS < 1 and liquefaction is expected; the dense sand layer has a high CRR (schematic).",
    },
  },

  // ------------------------------------------------------------------
  // 7
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "7. Programın sınırları", en: "7. Limits of the program" } },
  {
    type: "p",
    text: {
      tr: "Basitleştirilmiş yöntem, sınırlı bir deneysel veri setine dayanır ve bu nedenle her sınırı açıkça bilmek gerekir. Kodda bazı noktalar bilerek dışlanır: GWT üstündeki noktalar (doygun değil), yöntemin derinlik sınırının altındaki noktalar (Youd 30 m, BI2014 34 m), kil benzeri noktalar (PI ≥ 7 ya da I_c > 2,6) ve yoğun noktalar (Youd N ≥ 30, CPT q_c1Ncs ≥ 160). Bunların hiçbiri için FS hesaplanmaz; dolayısıyla LPI bu noktaları sıfır katkıyla alır. Bu, kil benzeri zeminler sıvılaşmaz anlamına gelmez; yalnız bu yöntemin kapsamında değildir.", en: "The simplified method rests on a limited experimental data set, so each of its limits must be known clearly. The code deliberately excludes some points: points above the GWT (not saturated), points below the depth limit of the method (Youd 30 m, BI2014 34 m), clay-like points (PI ≥ 7 or I_c > 2.6) and dense points (Youd N ≥ 30, CPT q_c1Ncs ≥ 160). FS is not calculated for any of these, so LPI takes these points with zero contribution. This does not mean that clay-like soils do not liquefy; it only means they lie outside the scope of this method.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Derinlik ve kalibrasyon sınırları da önemlidir. Kod, 20 m'den sonraki sonuçların daha az güvenilir olduğunu uyarır; basitleştirilmiş yöntem sığ ve doygun kumlar için tasarlanmıştır. Ayrıca yöntem sahada tek bir tabaka ve tek bir GWT varsaydığı için; sızma akımı, kapiler zon, ve yağışla değişen su seviyesi modellenmez. Youd yolunda CPT için K_c, I_c = 1,64 eşiğinde süreksizdir: altında 1, üstünde polinom (I_c = 1,65'te yaklaşık 1,003) kullanılır; R&W (1998) düşük sürtünme oranı kısayolu (K_c = 1) bu kodda kullanılmaz. Bu, küçük bir sıçramadır ama tabakalı sahada dikkatle okunmalıdır.", en: "Depth and calibration limits are also important. The code warns that results beyond 20 m are less reliable, because the simplified method was designed for shallow saturated sands. Also, since the method assumes a single layer and a single GWT, seepage flow, the capillary zone and a water level that changes with rainfall are not modelled. On the Youd CPT path K_c is discontinuous at the I_c = 1.64 threshold: below it 1 is used, above it the polynomial is used (about 1.003 at I_c = 1.65). The low friction-ratio shortcut of Robertson and Wride (1998) (K_c = 1) is not used in this code. This is a small jump, but it should be read carefully on layered sites.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "BI2014 SPT yolunda yoğunluk maskesi kapalıdır: yoğun (N1)60cs değerleri de FS'ye girer. K_σ, σ'_v0 < Pa iken 1'i geçebilir (1,1 ile sınırlı). Bu nedenle yüzeye yakın gevşek noktalarda sonuç, Youd'a göre daha muhafazakâr ya da daha az muhafazakâr çıkabilir; iki yöntem birlikte kontrol edilmelidir.", en: "On the BI2014 SPT path the density mask is off: dense (N1)60cs values also enter the FS. K_σ can exceed 1 when σ'_v0 < Pa (it is limited to 1.1). Therefore at loose points near the surface the result may be more or less conservative than Youd's; the two methods should be checked together.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Son olarak, sonuç bir tasarım kararı değildir. Programın verdiği FS ve LPI değerleri, zemin raporundaki verilerin doğruluğuna, a_max ve M'nin seçimine ve bu bölümde sayılan varsayımların kabul edilebilirliğine bağlıdır. Sıvılaşma değerlendirmesi, sahadan alınmış örnekler ve gerekiyorsa daha ayrıntılı (dinamik) analizlerle desteklenmelidir. Mühendis, programın hangi noktayı neden dışladığını ve hangi girdinin açıkça varsayıldığını raporda yazmalıdır.", en: "Finally, the result is not a design decision. The FS and LPI values produced by the program depend on the accuracy of the data in the soil report, on the choice of a_max and M, and on the acceptability of the assumptions listed in this section. A liquefaction assessment must be supported by samples taken from the site and, where necessary, by more detailed (dynamic) analyses. The engineer must state in the report which points the program excluded and why, and which inputs were explicitly assumed.",
    },
  },

  {
    type: "figure",
    id: "liq-fs-profile",
    caption: {
      tr: "Derinliğe göre FS profili (şematik). Kırmızı noktalar FS < 1 (sıvılaşabilir), turuncu marjinal, yeşil güvenli. Kırmızı kesikli çizgi FS = 1'dir; solundaki gölgeli bölge sıvılaşma bölgesidir.",
      en: "FS profile with depth (schematic). Red points have FS < 1 (liquefiable), orange are marginal, green are safe. The red dashed line is FS = 1; the shaded region to its left is the liquefaction zone.",
    },
  },

  // ------------------------------------------------------------------
  // Mistakes, quiz, glossary, reading
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "Sık yapılan hatalar", en: "Common mistakes" } },
  {
    type: "mistakes",
    items: [
      { tr: "Su altındaki zemin için γ_sat ile birlikte ayrıca su basıncı eklemek ve sonra σ' hesaplarken bunu iki kez saymak. Efektif gerilmede batık birim ağırlık ve toplam gerilmeden u çıkarılmalıdır.", en: "Double counting water in effective stress." },
      { tr: "CSR'de σ_v ile σ'_v0'ı karıştırmak: CSR'nin paydası etkin gerilmedir (σ'_v0), üst gerilme ise toplam gerilmedir (σ_v0).", en: "Using total stress in the denominator of CSR." },
      { tr: "a_max/g yerine a_max [m/s²] yazmak ya da g'yi 9,81 yerine 1 almak: CSR birimsizdir, ivme oranı olarak girilmelidir.", en: "Entering a_max in m/s^2 instead of a_max/g." },
      { tr: "M'yi 7,5 olarak sabit almak ve MSF'yi unutmak: büyük bir depremde CRR'yi MSF ile çarpmadan FS hesaplamak yanlış sonuç verir.", en: "Skipping MSF for a magnitude other than 7.5." },
      { tr: "Youd'da FC'yi girmemek ya da varsayılan bir değer kullanmak: program Youd SPT yolunda FC'yi kendiliğinden varsaymaz; FC açıkça girilmelidir.", en: "Leaving FC undefined in the Youd SPT path." },
      { tr: "N ≥ 30 (Youd) ya da q_c1Ncs ≥ 160 noktalarını sıvılaşmaz diye geçmek yerine FS'yi hesaplamaya çalışmak: bu noktalarda FS yoktur, 'yoğun' olarak işaretlenir.", en: "Trying to compute FS where the point is dense." },
      { tr: "LPI'yı her derinlikte sürekli ölçülmüş sanmak: LPI yalnız test noktalarından, her noktanın paylaşılan aralığıyla toplanır. İlk nokta 2 m'den derinse, noktanın üstündeki tabaka hesaba girmez; sığ tabakanın önemi varsa yüzeye yakın bir test noktası alın.", en: "Treating LPI as measured continuously: it is summed from the test points only. If the first point is deeper than 2 m, the layer above it is not counted; take a shallow test point if the top layer matters." },
      { tr: "FS < 1 olan tabakaları LPI'da hesaba katıp, FS'yi 1'den büyük ama hedef altında (marjinal) olanları ihmal etmek: marjinal bölge bir belirsizlik bandıdır ve sonucu tersine çevirebilir.", en: "Ignoring marginal FS between 1 and the target." },
      { tr: "Youd ve BI2014 sonuçlarını doğrudan karşılaştırmak, girdileri farklı olduğu halde: iki yöntemi aynı girdiyle çalıştırmadan fark yorumlanmamalıdır.", en: "Comparing methods with different inputs." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "a_max/g = 0,30, σ_v0 = 100 kPa, σ'_v0 = 60 kPa, r_d = 0,90 için CSR'yi hesaplayın (üç basamak).", en: "Compute CSR for a_max/g = 0.30, sigma_v0 = 100 kPa, sigma'_v0 = 60 kPa, r_d = 0.90 (three decimals)." },
        a: { tr: "CSR = 0,65 · 0,30 · (100/60) · 0,90 = 0,293.", en: "CSR = 0.293." },
      },
      {
        q: { tr: "5 m derinlikte Youd r_d değerini (dört basamak) hesaplayın. 10 m'de r_d kaçtır?", en: "Compute Youd r_d at 5 m (four decimals). What is r_d at 10 m?" },
        a: { tr: "r_d(5) = 1 − 0,00765 · 5 = 0,9618; r_d(10) = 1,174 − 0,0267 · 10 = 0,907.", en: "r_d(5) = 0.9618; r_d(10) = 0.907." },
      },
      {
        q: { tr: "M = 6,5 için Youd idriss MSF değerini (iki basamak) bulun.", en: "Find the Youd idriss MSF for M = 6.5 (two decimals)." },
        a: { tr: "MSF = 10^2,24 / 6,5^2,56 ≈ 1,44.", en: "MSF ≈ 1.44." },
      },
      {
        q: { tr: "σ'_v0 = 50 kPa için Liao-Whitman C_N değerini (dört basamak) hesaplayın. Bu değer 1,7 ile sınırlanır mı?", en: "Compute Liao-Whitman C_N for sigma'_v0 = 50 kPa (four decimals). Is it capped at 1.7?" },
        a: { tr: "C_N = √(101,325/50) = 1,4236; sınır 1,7'nin altındadır, sınırlanmaz.", en: "C_N = 1.4236; no cap needed." },
      },
      {
        q: { tr: "Youd 2001'de FC = 10 %, (N1)60 = 20 ise (N1)60cs'yi (iki basamak) bulun.", en: "Youd 2001: FC = 10 percent, (N1)60 = 20. Find (N1)60cs to two decimals." },
        a: { tr: "α = 0,8694, β = 1,0216; (N1)60cs = 0,8694 + 1,0216 · 20 = 21,30.", en: "(N1)60cs = 21.30." },
      },
      {
        q: { tr: "CSR = 0,20 ve CRR = 0,15 ise FS nedir? Hedef FS 1,1 ise sınıf nedir?", en: "If CSR = 0.20 and CRR = 0.15, what is FS? With target 1.1, what class?" },
        a: { tr: "FS = 0,15 / 0,20 = 0,75 < 1: sıvılaşabilir (liquefiable).", en: "FS = 0.75; liquefiable." },
      },
      {
        q: { tr: "Dört noktalı LPI örneğinde (FS = 0,9; 0,7; 1,2; 0,8) ilk noktanın (z = 2 m, FS = 0,9) katkısını (iki basamak) hesaplayın. İlk aralık yüzeye uzatıldığı için aralığı [0, 3] m'dir (yukarıdaki çözümlü örnekteki hücre tanımı).", en: "In the four-point LPI example, compute the contribution of the first point (z = 2 m, FS = 0.9). Its interval is [0, 3] m, because the first interval is extended to the surface (the cell definition of the worked example above)." },
        a: { tr: "F = 0,1; ∫[0,3](10 − 0,5 z) dz = 30 − 0,25·9 = 27,75; katkı = 0,1 · 27,75 = 2,775.", en: "F = 0.1; integral over [0, 3] = 30 - 0.25·9 = 27.75; contribution = 2.775." },
      },
      {
        q: { tr: "LPI = 9 ise tehlike kategorisi nedir?", en: "If LPI = 9, what is the hazard category?" },
        a: { tr: "5 < 9 ≤ 15: yüksek (high).", en: "High." },
      },
      {
        q: { tr: "Youd yolunda σ'_v0 = 200 kPa için K_σ (f = 0,7) değerini (üç basamak) bulun.", en: "Youd path: compute K_sigma for sigma'_v0 = 200 kPa with f = 0.7 (three decimals)." },
        a: { tr: "K_σ = (200/101,325)^(−0,3) = 0,815.", en: "K_sigma = 0.815." },
      },
      {
        q: { tr: "Neden programda z < GWT olan noktalara FS atanmaz?", en: "Why is no FS assigned to points with z < GWT?" },
        a: { tr: "Bu noktalar doygun değildir; boşluk suyu basıncı artışı yoktur ve tanelerin temas kuvveti kaybı beklenmez. Program bu noktaları 'above_gwt' olarak işaretler.", en: "They are not saturated, so no liquefaction is expected; status above_gwt." },
      },
    ],
  },
  { type: "h", text: { tr: "Kavram sözlüğü", en: "Glossary" } },
  {
    type: "glossary",
    items: [
      { term: { tr: "Sıvılaşma", en: "Liquefaction" }, def: { tr: "Doygun gevşek zeminin tekrarlı yük altında boşluk suyu basıncı artışıyla etkin gerilmesini kaybedip sıvı gibi davranması.", en: "Loss of effective stress in saturated soil under cyclic loading." } },
      { term: { tr: "Boşluk suyu basıncı (u)", en: "Pore water pressure (u)" }, def: { tr: "Zemin boşluklarındaki suyun basıncı [kPa]; hidrostatikte u = γ_w (z − z_w).", en: "Pressure of water in the soil voids [kPa]." } },
      { term: { tr: "Etkin gerilme (σ')", en: "Effective stress (sigma')" }, def: { tr: "Taneler arası temas kuvveti taşıyan gerilme: σ' = σ − u [kPa].", en: "Stress carried by grain contacts; sigma' = sigma - u." } },
      { term: { tr: "Toplam gerilme (σ)", en: "Total stress (sigma)" }, def: { tr: "Zemin kütlesinin birim ağırlığından gelen gerilme; σ_v = γ z [kPa].", en: "Total stress from the soil weight." } },
      { term: { tr: "Yeraltı suyu seviyesi (GWT)", en: "Groundwater table (GWT)" }, def: { tr: "Boşlukların suyla doyduğu üst sınır; programda deprem anı için sismik GWT ayrıca girilir.", en: "Top of the saturated zone; seismic GWT is used for demand." } },
      { term: { tr: "Döngüsel gerilme oranı (CSR)", en: "Cyclic stress ratio (CSR)" }, def: { tr: "Deprem talebinin birimsiz oranı: 0,65 (a_max/g) (σ_v/σ'_v) r_d.", en: "Dimensionless seismic demand." } },
      { term: { tr: "Döngüsel direnç oranı (CRR)", en: "Cyclic resistance ratio (CRR)" }, def: { tr: "Zeminin M = 7,5 ve 1 atm için dayanabildiği döngüsel gerilme oranı; SPT ya da CPT'den tahmin edilir.", en: "Resistance at M 7.5 and 1 atm." } },
      { term: { tr: "Gerilme azaltma katsayısı (r_d)", en: "Stress reduction factor (r_d)" }, def: { tr: "Derinlikle azalan, zeminin esnekliğinden doğan ivme azalmasını temsil eden birimsiz katsayı.", en: "Depth-dependent reduction of the peak acceleration effect." } },
      { term: { tr: "Güvenlik katsayısı (FS)", en: "Factor of safety (FS)" }, def: { tr: "FS = CRR / CSR; FS < 1 sıvılaşabilir.", en: "FS = CRR / CSR." } },
      { term: { tr: "Büyüklük ölçekleme faktörü (MSF)", en: "Magnitude scaling factor (MSF)" }, def: { tr: "M = 7,5'ten farklı depremler için CRR'yi düzelten faktör; M = 7,5'te yaklaşık 1.", en: "Adjusts CRR for magnitudes other than 7.5." } },
      { term: { tr: "Üst yük düzeltmesi (K_σ)", en: "Overburden correction (K_sigma)" }, def: { tr: "Yüksek etkin gerilmede CRR'yi azaltan düzeltme (Pa üstünde).", en: "Reduces CRR at high effective stress." } },
      { term: { tr: "Atmosfer basıncı (Pa)", en: "Atmospheric pressure (Pa)" }, def: { tr: "Normalizasyon referansı; 101,325 kPa.", en: "101.325 kPa reference." } },
      { term: { tr: "Standart penetrasyon darbe sayısı (N)", en: "SPT blow count (N)" }, def: { tr: "Standart örnekleyicinin belirli bir derinlikte belirli bir penetrasyona ulaşmak için gereken darbe sayısı.", en: "Blows per standard penetration." } },
      { term: { tr: "N60 ve (N1)60", en: "N60 and (N1)60" }, def: { tr: "N60: enerji oranı (ER) ve ekipman düzeltmeli N; (N1)60: 1 atm'e normalize edilmiş N60.", en: "Energy-corrected N and normalised N." } },
      { term: { tr: "İnce dane yüzdesi (FC)", en: "Fines content (FC)" }, def: { tr: "Eleme ile 0,075 mm'den küçük tanelerin yüzdesi; (N1)60cs düzeltmesinde kullanılır.", en: "Percentage of fines, used in fines correction." } },
      { term: { tr: "CPT uç direnci ve normalizasyon (q_c1N)", en: "CPT tip resistance normalised (q_c1N)" }, def: { tr: "Net q_c'nin 1 atm ve etkin gerilmeye normalize edilmiş biçimi; q_c1Ncs fines ve K_c düzeltmeli değerdir.", en: "Normalised cone resistance." } },
      { term: { tr: "Davranış indeksi (I_c)", en: "Soil behaviour index (I_c)" }, def: { tr: "CPT ölçümlerinden hesaplanan, zemini kum-kil ekseninde konumlandıran sürekli sınıflandırma sayısı.", en: "CPT-based soil classification index." } },
      { term: { tr: "Plastisite indisi (PI)", en: "Plasticity index (PI)" }, def: { tr: "Likit ve plastik limitler arası fark (%); PI ≥ 7 kil benzeri kabul edilir.", en: "Liquid limit minus plastic limit." } },
      { term: { tr: "Sıvılaşma potansiyel indeksi (LPI)", en: "Liquefaction potential index (LPI)" }, def: { tr: "0-20 m arasında (1 − FS) ile w(z) = 10 − 0,5 z ağırlığının integrali; tehlike kategorisi için kullanılır.", en: "Integrated index weighted toward the surface." } },
      { term: { tr: "Yanal yayılma", en: "Lateral spreading" }, def: { tr: "Eğimli arazide sıvılaşmış tabaka üstündeki kabuğun yerçekimiyle yanlamasına kayması.", en: "Downslope movement of a crust over a liquefied layer." } },
      { term: { tr: "Çevrimsel yumuşama", en: "Cyclic softening" }, def: { tr: "Kil benzeri zeminde tekrarlı yük altında rijitlik ve direncin azalması; programda ayrıca değerlendirilir, FS hesabı yapılmaz.", en: "Stiffness loss in clay-like soils under cyclic loading." } },
    ],
  },
  { type: "h", text: { tr: "Okuma önerileri", en: "Reading" } },
  {
    type: "reading",
    items: [
      "Youd, T.L. vd. (2001). Liquefaction resistance of soils: summary report from the 1996 NCEER and 1998 NCEER/NSF workshops. J. Geotech. Geoenviron. Eng., 127(10), 817-833. (Bu metin, programın Youd yolunun kaynağıdır; kaynak doğrulaması yapılmadı.)",
      "Boulanger, R.W. & Idriss, I.M. (2014). CPT and SPT based liquefaction triggering procedures. Rapor UCD/CGM-14/01, UC Davis. (BI2014 yolunun kaynağı; kaynak doğrulaması yapılmadı.)",
      "Idriss, I.M. & Boulanger, R.W. (2008). Soil liquefaction during earthquakes. EERI MNO-12. (Kavramsal arka plan; kaynak doğrulaması yapılmadı.)",
      "Seed, H.B. & Idriss, I.M. (1971). Simplified procedure for evaluating soil liquefaction potential. J. SMFE ASCE, 97(9). (CSR formülünün kökeni; kaynak doğrulaması yapılmadı.)",
      "Robertson, P.K. & Wride, C.E. (1998). Evaluating cyclic liquefaction potential using the cone penetration test. Can. Geotech. J., 35(3), 442-459. (CPT yolu ve r_d uzantısı; kaynak doğrulaması yapılmadı.)",
    ],
  },
];
