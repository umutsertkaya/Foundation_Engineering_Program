import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Sıvılaşma nedir", en: "1. What is liquefaction" } },
  {
    type: "p",
    text: {
      tr: "Sıvılaşma, boşlukları tamamen su dolu (doygun) gevşek ya da orta sıkılıktaki bir kum veya silt zeminin, deprem gibi tekrarlı kayma yükleri altında sanki sıvıymış gibi davranmasıdır. Bir kum torbasını düşünün: içindeki taneler birbirine temas ederek yükü taşır ve torba sağlam durur. Torba sallanır ve taneler arasındaki boşluktaki su basıncı artarsa, tanelerin birbirine bastırdığı temas kuvveti azalır. Bu temas kuvvetinin taşıdığı kısma etkin gerilme denir ve σ' ile gösterilir [kPa]. Toplam gerilme σ, boşluk suyu basıncı u [kPa] ve etkin gerilme arasında σ' = σ − u ilişkisi vardır. Zeminin kayma direnci etkin gerilmeye bağlıdır: τ_f = c' + σ' tan φ'. Deprem sırasında u arttıkça σ' küçülür ve direnç düşer. Eğer u, toplam gerilmeye neredeyse eşit olursa σ' sıfıra yaklaşır ve zemin bir çorba gibi davranır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu durumun sahadaki sonuçları iki ana biçimde görülür. Eğimli arazide sıvılaşmış tabaka üzerindeki kaymaya dayanıklı kabuk, yerçekimi etkisiyle birkaç metre yanlamasına kayabilir; buna yanal yayılma denir. Eğim çok dikse ya da tabaka çok gevşekse zemin tamamen akabilir; buna akma (flow failure) denir. Düz arazide ise daha yaygın hasar; oturma, kum kaynaması (yüzeye fışkıran kum ve su), temel kaybı ve bina eğilmesi biçiminde görülür. Kum kaynaması, yüksek boşluk suyu basıncının zeminin içinden yüzeye çıkış yolu bulmasının işaretidir. Hasar, sıvılaşmış tabakanın kalınlığına, derinliğine ve tekrarlı yükün süresine bağlıdır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Hangi zeminlerin riskli olduğu üç özellikle belirlenir. Birincisi doygunluktur: yeraltı suyu seviyesi yüzeye yakın olmalıdır, çünkü kuru ya da kapiler üstü zemindeki boşluklar su ile dolu değildir. İkincisi gevşekliktir: sıkılık düşük olan kum, sarsıntıda tanelerini sıkıştırıp hacim azaltmaya daha yatkındır ve bu da boşluk suyu basıncını yükseltir. Üçüncüsü tane yapısıdır: temiz ya da az ince daneli kum ve siltler tipik adaylardır; plastik ince daneli (kil benzeri) zeminler ise genellikle sıvılaşmak yerine çevrimsel yumuşama gösterir. Programda bu ayrım PI ≥ 7 (ya da CPT'de I_c > 2,6) kuralıyla yapılır ve bu tür noktalar 'kil benzeri' olarak işaretlenir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Tarihsel depremlerde sıvılaşmanın sayısız örneği görülmüştür; 1964 Niigata depremi bu konunun klasik örneklerinden biridir. Ancak bu tür gözlemler, tek bir zeminde hangi koşulda sıvılaşacağını söylemez; bunun için bir tetiklenme (triggering) analizi gerekir. Bu analiz üç soruya cevap verir: deprem talebi ne kadar büyük, zeminin direnci ne kadar, ve ikisinin oranı birden küçük mü? Bu metindeki ana fikir budur ve sonraki bölümlerde her soru ayrıca açılır. Bu bölümdeki kavramsal anlatım, kaynakların genel tanımlarına dayanır; formüller ve katsayılar ise bundan sonraki bölümlerde programın kodundan okunur.",
    },
  },
  {
    type: "figure",
    id: "liq-mechanism",
    caption: {
      tr: "Üç aşamalı şema, tek bir doygun kum elemanı için. (I) Sakin durum: taneler birbirine temas eder, σ' büyük ve u küçüktür; oklar tanelerin temas kuvvetini gösterir. (II) Deprem sırasında: tekrarlı kayma ile taneler birbirinden biraz uzaklaşır ve boşluk suyu basıncı u artar; ok uzunluklarındaki temas kuvveti azalır ve u çubuğu toplam gerilmeye doğru büyür. (III) Sıvılaşma anı: u ≈ σ, σ' ≈ 0; taneler birbirine değmez ve su içinde yüzer gibi görünür. Her aşamanın altında σ = σ' + u bağıntısı ve çubukların değerleri (σ, u, σ') yazılmalıdır. Şemada toplam gerilmenin sabit kaldığı, u ile σ' arasındaki paylaşımın değiştiği gösterilmelidir.",
      en: "Three-stage schematic for one saturated sand element: (I) at rest, grains touch, sigma' large, u small; (II) during shaking, grains separate, u rises toward sigma; (III) at liquefaction, sigma' approximately 0. Bars show sigma, u and sigma' with sigma = sigma' + u in each stage.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sıvılaşmanın sınırı: bu bölüm yalnız sığ ve doygun kumlar için basitleştirilmiş bir yaklaşımı anlatır. Kohezyonlu zeminler, çok sıkı kumlar, sızma akımı, ve su birikintisi (yer üstünde su) ayrı değerlendirilmelidir. GeoTek'in bu modülü de yalnız tek bir yeraltı suyu seviyesi (sismik GWT) ve hidrostatik boşluk suyu varsayar. Bu varsayımların her biri gerçek sahada zemin raporuyla doğrulanmalıdır.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Talep: basit sürtünme sezgisi, CSR ve rd", en: "2. Demand: simple shear intuition, CSR and rd" } },
  {
    type: "p",
    text: {
      tr: "Bir depremde zemin yatay olarak titrer. Yüzeyde bir kitabı üstündeki yatay kuvvetle ittiğinizde kitap ile masa arasında bir kesme (kayma) gerilmesi oluşur. Zeminde de aynı şey olur: derinlikteki bir elemanın üstündeki ağır zemin kütlesi, yatay ivmeyle titreştiğinde elemanın içinde bir kayma gerilmesi oluşur. Bu gerilmenin büyüklüğü iki şeye bağlıdır: ivmenin ne kadar büyük olduğuna ve üstteki ağırlığın ne kadar olduğuna. Ağırlık düşey gerilme σ_v ile ölçülür [kPa], ivme ise yerçekimi ivmesinin oranı a_max/g olarak yazılır (birimsiz). Oranın birimsiz olması önemlidir: a_max/g = 0,25 demek, zeminin yatay olarak yerçekiminin dörtte biri kadar ivmelendiği anlamına gelir.",
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
      tr: "Gerilme azaltma katsayısı r_d, derinlikle değişen bir sayıdır ve yüzeyde 1'e yakın, derinlikte daha küçüktür. Youd (2001) yönteminde r_d yalnız derinliğe bağlıdır ve iki çizgi ile verilir: z ≤ 9,15 m için 1 − 0,00765 z, 9,15 < z ≤ 23 m için 1,174 − 0,0267 z. Bu, 5 m'de yaklaşık 0,962, 10 m'de yaklaşık 0,907 eder. Boulanger ve Idriss (2014) yönteminde r_d hem derinliğe hem deprem büyüklüğüne (M) bağlıdır; aynı derinlikte büyük depremde r_d daha küçüktür (kodla 5 m için M = 7,5'te 0,961 çıkar). Youd eğrisi 30 m'ye kadar, BI2014 eğrisi 34 m'ye kadar tanımlıdır; bu sınırların üstünde kod NaN döndürür ve nokta değerlendirilmez.",
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
      tr: "Derinliğe karşı r_d eğrileri: Youd 2001 (0-30 m) tek bir çizgi olarak ve BI2014 (0-34 m) M = 6,5, 7,5 ve 8,5 için üç ayrı eğri olarak çizilmelidir. Youd eğrisi dört bölümlü ve sürekli olmalıdır; 9,15 m ve 23 m dönüm noktaları işaretlenmelidir. BI2014 eğrileri büyüklükle yukarı kayar, yani büyük depremde aynı derinlikte r_d daha küçüktür.",
      en: "r_d versus depth for Youd 2001 (0-30 m) and BI2014 (0-34 m) at M 6.5, 7.5 and 8.5; Youd breakpoints at 9.15 and 23 m marked.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar: CSR formülü, zeminin yatay olarak homojen bir tabaka gibi davrandığı ve kayma gerilmesinin tabaka boyunca basit biçimde değiştiği varsayımına dayanır. Derin, yumuşak ya da topografik olarak karmaşık bir sahada bu yaklaşım yetersiz kalabilir. Ayrıca CSR, a_max/g için 0 ile 2 arasında sınırlandırılmıştır; programa bu aralık dışı bir değer girilirse hata verir. Deprem büyüklüğü (M) için kod 4,0 ile 9,5 arasını kabul eder. Bu kabullerin dışındaki durumlarda kendi kaynaklı analiz gerekir.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Direnç: SPT ve CPT'den CRR", en: "3. Resistance: CRR from SPT and CPT" } },
  {
    type: "p",
    text: {
      tr: "Direnç, zeminin tekrarlı kayma altında sıvılaşmadan dayanabildiği döngüsel gerilme oranıdır (CRR). Doğrudan laboratuvarda ölçmek zor olduğu için sahada yapılan iki standart deneyden dolaylı olarak tahmin edilir: SPT (standart penetrasyon, darbe sayısı N) ve CPT (konik penetrasyon, uç direnci q_c ve yan sürtünme f_s). İki deneyde de ölçülen sayı, zeminin yoğunluğunun ve gerilme durumunun bir yansımasıdır; ama ham değer doğrudan karşılaştırılamaz. Bu nedenle önce deneyin enerjisi, ekipmanı ve derinliği için düzeltme yapılır, sonra bu düzeltilmiş değer tipik bir sıvılaşma eğrisine taşınır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "SPT için ilk adım enerji ve ekipman düzeltmesidir. Standart şiş (N) darbe sayısı, düşen tokmağın enerji oranına (ER, %) göre 60'a normalize edilir: N60 = N · (ER/60) · C_B · C_S · C_R. Burada C_B kuyu çapı, C_S örnekleyici (liner'lı ya da liner'sız) ve C_R çubuk uzunluğu düzeltmesidir; program C_R değerini 3 m altında 0,75, 3-4 m arasında 0,80, 4-6 m arasında 0,85, 6-10 m arasında 0,95, 10 m üstünde 1,00 alır. Sonra etkin gerilmeye göre normalize edilir: (N1)60 = C_N · N60 ve C_N = min[√(Pa/σ'_v0), 1,7] (Liao ve Whitman). Pa = 101,325 kPa atmosfer basıncıdır. Böylece her derinlikteki sayı, 1 atm ve 60 % enerji referansına çevrilmiş olur.",
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
      tr: "İnce dane (FC, yüzde) etkisi, aynı (N1)60 değerinde bile direnci değiştirir. Youd (2001) yönteminde (N1)60cs = α + β (N1)60 düzeltmesi kullanılır: FC ≤ 5 için α = 0 ve β = 1; 5 < FC < 35 için α = exp(1,76 − 190/FC²) ve β = 0,99 + FC^1,5/1000; FC ≥ 35 için α = 5 ve β = 1,2. Örneğin FC = 10 % için α ≈ 0,869, β ≈ 1,022 olur; (N1)60 = 12 ise (N1)60cs ≈ 13,13 çıkar. Bu düzeltme, ince dane artınca zeminin direncini artırmak gibi görünür, ama bu sezgi sınırlıdır ve FC'nin ölçümü ya da kestirimi belirsizdir. Programda Youd yolunda FC her zaman açıkça verilmelidir; varsayılan değer yoktur.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Youd 2001 yolunda CRR, M = 7,5 ve 1 atm için (N1)60cs'nin bir fonksiyonudur: CRR7,5 = 1/(34 − N) + N/135 + 50/(10N + 45)² − 1/200, N = (N1)60cs < 30. Eşiğin üstünde (N ≥ 30) zemin çok yoğun kabul edilir ve sıvılaşmaz; kod bu noktaya CRR atamaz ve durumunu 'yoğun' (non_liquefiable_dense) olarak işaretler. Boulanger ve Idriss (2014) SPT yolunda ise (N1)60cs'yi C_N ile Δ(N1)60 terimlerini birlikte ve yinelemeli olarak çözer; CRR7,5 = exp[N/14,1 + (N/126)² − (N/23,6)³ + (N/25,4)⁴ − 2,8] ile verilir. Bu iki yöntemin ayrı çizgileri olduğu için, aynı (N1)60cs için sonuçlar çok yakın ama aynı değildir (aşağıdaki 3. bölüm figürüne bakın).",
    },
  },
  {
    type: "figure",
    id: "liq-spt-correlation",
    caption: {
      tr: "Yatay eksen (N1)60, dikey eksen CRR7,5. Üç eğri çizilmelidir: FC = 5 %, 15 % ve 35 % için Youd 2001 (N1)60cs = α + β (N1)60 dönüşümünden sonra CRR7,5 eğrisi. Eğriler, aynı (N1)60 için FC arttıkça yukarı (ve sola) kaydığını göstermelidir. Üstteki kesikli çizgi (N1)60cs = 30 yoğun sınırını işaretlemelidir; bu sınırın ötesinde eğri yerine 'yoğun' etiketi okunmalıdır. Eksen değerleri kavramsal ölçektir ve tabloda verilen sayısal örneği (FC = 10 %, (N1)60 = 12 → CRR7,5 ≈ 0,142) noktası olarak işaretlenmelidir.",
      en: "CRR7.5 versus (N1)60 for FC 5, 15 and 35 percent through the Youd (N1)60cs transform; dashed line at (N1)60cs = 30 marks the dense limit; example point (12, 0.142) at FC 10 percent.",
    },
  },
  {
    type: "p",
    text: {
      tr: "CPT yolunda ise sıralama farklıdır. Ölçülen uç direnci q_c, düşey gerilmeyi çıkararak net değere dönüştürülür ve q_c1N = C_q · q_c/Pa ile 1 atm'e normalize edilir (C_q = min[(Pa/σ'_v0)^n, 1,7]; n zemin tipine bağlı bir üsdür). Normalizasyonda ve sınıflandırmada kullanılan davranış indeksi I_c, Q ve F büyüklüklerinden hesaplanır: I_c = √((3,47 − log Q)² + (log F + 1,22)²). I_c, zemini kumdan kile doğru bir sürekli sınıflandırma ölçeğinde konumlandırır; programda I_c > 2,6 olan nokta kil benzeri sayılır. Youd yolunda q_c1Ncs = K_c · q_c1N ve K_c, I_c'nin polinomudur (I_c ≤ 1,64 için 1); BI2014 yolunda ise q_t ve FC (varsayılan olarak I_c'den tahmin edilir) kullanılır. CRR7,5 (Robertson ve Wride 1998) için programdaki Youd yolu şöyledir: q < 50 için 0,833 q/1000 + 0,05; q ≥ 50 için 93 (q/1000)³ + 0,08; q ≥ 160 yoğun kabul edilir.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Refüzal (SPT'de darbe sayısının çok büyük olması, örneğin 50 darbede sadece az ilerleme) değerleri alt sınır kabul edilir. Gerçek N bu değerden büyüktür, bu yüzden FS muhafazakâr (düşük) çıkar ve bu sonuç yorumlanırken dikkate alınmalıdır.",
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
      tr: "CRR7,5, bir M = 7,5 depreminin çevrim sayısına göre tanımlanır. Büyük bir deprem daha uzun süre ve daha çok tekrarlı yük üretir; bu nedenle aynı CSR, büyük depremde daha fazla sayıda çevrimle eşdeğer olur ve zemin için daha zordur. Küçük depremde tersi geçerlidir. Bu fark büyüklük ölçekleme faktörü (MSF) ile düzeltilir: CRR = CRR7,5 · MSF · K_σ. Sezgisel olarak MSF, 'bu deprem, M = 7,5 depremi kadar tehlikeli mi, değil mi?' sorusunun sayısal cevabıdır. M = 7,5'te MSF ≈ 1; M küçüldükçe MSF büyür, M büyüdükçe MSF küçülür. Youd 2001'in varsayılan (idriss) eğrisi MSF = 10^2,24 / M^2,56 biçimindedir ve N'den bağımsızdır.",
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
      tr: "Yatay eksen M (5,0 - 8,5), dikey eksen MSF (0,5 - 2,0 arası). Üç eğri gösterilmelidir: Youd idriss (sürekli), andrus_stokoe (kesikli) ve M = 7,5'te MSF = 1 noktası işaretli yatay referans. Idriss eğrisi M = 6,5'te yaklaşık 1,44, M = 8,5'te yaklaşık 0,73 vermelidir. Andrus-Stokoe eğrisi M < 7,5 için idriss'ten yüksek, M > 7,5 için düşük olmalıdır; kod bu fark için M > 7,5'te uyarı verir.",
      en: "MSF versus M from 5.0 to 8.5: Youd idriss (solid), Andrus-Stokoe (dashed), reference point at M 7.5 with MSF 1; idriss gives about 1.44 at M 6.5 and 0.73 at M 8.5.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Üst yük düzeltmesi K_σ ise düşey etkin gerilmenin büyüklüğünü hesaba katar. Derinlerde zemin tanelerinin üstündeki yük büyüktür, bu nedenle zemin kayma sırasında daha az genleşme (dilatasyon) yapar ve tanelerinin birbirini kilitlemesi azalır. Sonuç olarak aynı CSR'de sıvılaşma daha kolay olur. Youd yönteminde K_σ = (σ'_v0 / Pa)^(f − 1) yalnız σ'_v0 > Pa iken uygulanır, f = 0,7 varsayılan değerdir (0,6-0,8 aralığında). Örneğin σ'_v0 = 200 kPa için K_σ ≈ 0,815'tir; bu, CRR'nin bu derinlikte yüzde 18 civarında azaldığı anlamına gelir. Boulanger ve Idriss (2014) yönteminde K_σ = 1 − C_σ ln(σ'_v0/Pa) biçimindedir ve 1,1 ile sınırlıdır; bu yöntem σ'_v0 < Pa iken K_σ'yı 1'in üstüne çıkarabilir.",
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
      tr: "Sınırlar: MSF ve K_σ, kaynaklardaki deneysel veri setlerine dayanan ampirik eğrilerdir. MSF, M'nin 7,5 civarında olmasına göre tasarlanmıştır; çok büyük ya da çok küçük depremlerde eğrinin son kısmı daha az güvenilirdir. Youd'un K_σ'sı f = 0,6-0,8 aralığında ayarlanmalıdır ve programda bu aralığın dışında hata verilir. Ayrıca MSF ve K_σ'nın tek başına hesaba katamadığı etkiler (uzun periyotlu sarsıntı, tabakalı sahada ivme yükselişi) vardır.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Güvenlik katsayısı (FS) ve LPI", en: "5. Factor of safety (FS) and LPI" } },
  {
    type: "p",
    text: {
      tr: "Güvenlik katsayısı, direncin talebe oranıdır: FS = CRR / CSR. FS > 1 ise direnç talepten büyüktür ve zemin sıvılaşmaz; FS < 1 ise sıvılaşma beklenir. Bu sayı birimsizdir ve bir tasarım kararı değil, bir göstergedir. Programda hedef FS (varsayılan 1,1) kullanılır: FS < 1 'sıvılaşabilir', 1 ≤ FS < hedef 'marjinal' ve FS ≥ hedef 'güvenli' olarak sınıflandırılır. Marjinal bölge, küçük bir girdi belirsizliğinin sonucu tersine çevirebileceği bölgedir; bu nedenle yalnız FS < 1 bakmak yanıltıcı olabilir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Her nokta için program önce bir durum atar ve FS yalnız uygun noktalarda hesaplanır. Öncelik sırası şöyledir: kullanıcının dışlaması en yüksek öncelikli; sonra z < GWT (yeraltı suyu üstü, doygun değil, 'above_gwt'); sonra yöntemin derinlik sınırı; sonra kil benzeri (PI ≥ 7 ya da I_c > 2,6); sonra yoğun (Youd N ≥ 30 ya da q_c1Ncs ≥ 160); en son geçersiz (σ'_v0 ≤ 0 ya da FS sonlu değil). Bu sıra önemlidir: yeraltı suyu üstündeki bir noktanın FS'si yoktur, çünkü o nokta sıvılaşacak kadar doygun değildir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sıvılaşma potansiyel indeksi LPI (Iwasaki ve arkadaşları), bir sahayı tek bir sayıyla özetlemek için kullanılır. Fikir şudur: sığ ve FS'si düşük tabakalar, derin olanlardan daha büyük hasara yol açar, çünkü yüzeye daha yakındır. Bu nedenle her noktanın (1 − FS) değeri 0-20 m arasında bir ağırlıkla çarpılır: LPI = ∫₀²⁰ F(z) · w(z) dz, F = 1 − FS (FS < 1 ise, değilse 0), w(z) = 10 − 0,5 z. Ağırlık yüzeyde 10, 20 m'de 0'dır. Sonuç, boyutsuz bir sayıdır ve tehlike kategorisi şöyledir: LPI = 0 çok düşük; ≤ 5 düşük; ≤ 15 yüksek; > 15 çok yüksek. LPI bir ön tarama göstergesidir; bir tasarım değeri değildir.",
    },
  },
  {
    type: "formula",
    expr: "LPI = ∫₀²⁰ F(z) · w(z) dz,   F = 1 − FS (FS < 1),  0 (aksi halde),   w(z) = 10 − 0,5 z",
    caption: {
      tr: "Iwasaki LPI. Programda integral, her test noktası için 'tributary' (paylaşılan) aralıklarla toplanır: her nokta, komşu noktaların ortasına kadar uzanan bir aralığı temsil eder ve aralığın ağırlıklı integrali doğrudan hesaplanır (kodda w'nin tam integrali: 10 (b − a) − 0,25 (b² − a²)).",
      en: "Iwasaki LPI as implemented: tributary intervals with the exact integral of w.",
    },
  },
  {
    type: "figure",
    id: "liq-lpi-weight",
    caption: {
      tr: "Yatay eksen w(z) (0-10), dikey eksen derinlik z (0-20 m, aşağı doğru artan, yüzey üstte). Çizgi w(z) = 10 − 0,5 z'yi göstermelidir: yüzeyde 10, 20 m'de 0. Eğrinin altındaki alan, z = 0-20 m için w'nin integralidir ve yatay şerit ya da gölgelendirme ile işaretlenmelidir. Dört test noktası için (z = 2, 4, 6, 8 m) her biri kendi 'paylaşılan' aralığı ile ayrı bir renkte gösterilmeli (1-3, 3-5, 5-7, 7-9 m); aralık sınırları ve her aralığın w-integrali (18, 16, 14, 12) etiketlenmelidir. 0-1 m aralığı boş bırakılır; bu, kodun davranışıdır ve figürde not olarak yazılmalıdır.",
      en: "w(z) = 10 - 0.5z versus depth (0-20 m), with the four tributary intervals (1-3, 3-5, 5-7, 7-9 m) shaded and their integrals 18, 16, 14, 12 labelled; the 0-1 m zone is not counted.",
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
      { label: { tr: "Paylaşılan aralıklar (orta noktalara göre)", en: "Tributary intervals" }, expr: "[1, 3], [3, 5], [5, 7], [7, 9] m  (ilk aralık 2 − 1 = 1 m'den başlar)", result: "4 aralık" },
      { label: { tr: "F = 1 − FS", en: "F = 1 - FS" }, expr: "F = 0,1 ; 0,3 ; 0 (FS ≥ 1) ; 0,2", result: "0,1 / 0,3 / 0 / 0,2" },
      { label: { tr: "w-integrali: ∫(10 − 0,5z) dz = 10 (b − a) − 0,25 (b² − a²)", en: "Integral of w" }, expr: "[1,3]: 20 − 0,25·8 = 18;  [3,5]: 20 − 0,25·16 = 16;  [5,7]: 20 − 0,25·24 = 14;  [7,9]: 20 − 0,25·32 = 12", result: "18 / 16 / 14 / 12" },
      { label: { tr: "Her aralığın F × w katkısı", en: "Contribution per interval" }, expr: "0,1·18 + 0,3·16 + 0·14 + 0,2·12 = 1,8 + 4,8 + 0 + 2,4", result: "9,0" },
      { label: { tr: "LPI ve kategori", en: "LPI and category" }, expr: "LPI = 9,0 ; 5 < 9,0 ≤ 15", result: "yüksek (high)" },
    ],
    program: {
      input: "Test derinlikleri [2, 4, 6, 8] m; FS = [0,9; 0,7; 1,2; 0,8]; w(z) = 10 − 0,5 z; LPI fonksiyonu: liquefaction_potential_index(depth, fs) (common.py)",
      output: "LPI = 9.0; kategori: high; paylaşılan aralıklar [1,3], [3,5], [5,7], [7,9] m",
      note: {
        tr: "Elle hesap ile program sonucu aynıdır (fark yok). Dikkat: programda 0-1 m aralığı LPI'ya girmez, çünkü ilk aralığın üst sınırı z_1 − Δz/2 = 1 m'den başlar. Bu, kodun gözlemlenen davranışıdır; ilk test derinliği yüzeye daha yakınsa ilk aralık daha da büyür ve bu kısım dahil edilir. Sığ tabakanın önemi düşünülüyorsa ilk test noktası yüzeye yakın bir derinlikte alınmalıdır.",
        en: "Hand and program agree. The 0-1 m zone is not counted because the first interval starts at z1 - dz/2.",
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
      tr: "İki yöntem aynı fiziksel fikri (talep ve direnç oranı) kullanır, ama birçok katsayısı ve normalizasyonu farklıdır. Youd 2001, NCEER çalıştayının özeti olarak geniş bir kullanım görmüş, çok sayıda saha verisine dayanan sade bir yöntemdir. Boulanger ve Idriss 2014 ise daha sonraki veri setlerini ve SPT ile CPT'yi tutarlı bir çerçevede birleştiren, iç içe (yinelemeli) çözülen daha karmaşık bir yöntemdir. Hangi yöntemin kullanılacağı kararı, projenin şartnamesine ve tasarım kurumunun tercihine bağlıdır; bu metin hangisinin 'doğru' olduğunu söylemez.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Farkların en önemlileri şunlardır. r_d: Youd yalnız derinliğe bağlıdır ve 30 m'de biter; BI2014 M'ye bağlıdır ve 34 m'ye kadar tanımlıdır. Aynı 5 m'de Youd 0,962 verir; BI2014 M = 7,5'te 0,961, M = 6,5'te 0,932 ve M = 8,5'te 0,990 verir. MSF: Youd (idriss) N'den bağımsızdır; BI2014'te MSF_max, (N1)60cs ile artar ve 2,2'ye kadar çıkar. K_σ: Youd yalnız σ'_v0 > Pa için uygulanır ve ≤ 1'dir; BI2014'te C_σ direnç ile değişir ve K_σ 1,1 ile sınırlıdır. Yoğunluk sınırı: Youd N ≥ 30 noktasını 'yoğun' sayar; BI2014 SPT yolunda bu maske kapalıdır. CPT: Youd q_c ve K_c kullanır; BI2014 q_t ve FC kullanır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Programın davranışı: analiz fonksiyonlarında varsayılan yöntem bi2014'tür; yalnız youd2001 açıkça seçildiğinde Youd yolu çalışır. Bu, sonucu etkileyen bir seçimdir ve raporda yöntem adıyla birlikte yazılmalıdır. Aynı (N1)60cs = 13,13 değeri için CRR7,5 değerleri Youd eğrisinde 0,142 ve BI2014 eğrisinde 0,141 çıkar; bu, iki eğrinin bu bölgede çok yakın olduğunu gösterir. Ancak aynı sahadaki FS'yi karşılaştırmak için iki yöntemi de tam olarak aynı girdiyle (N, ER, FC, σ'_v0, M) çalıştırmak gerekir; (N1)60cs bile iki yöntemde farklı yoldan hesaplanır.",
    },
  },
  {
    type: "figure",
    id: "liq-csr-crr",
    caption: {
      tr: "Derinliğe karşı CSR ve CRR eğrileri (aynı sahada). Youd ve BI2014 CRR'ları için iki ayrı çizgi, CSR için tek bir çizgi çizilmelidir. Her derinlikte FS = CRR / CSR ilişkisi, CRR ve CSR çizgilerinin kesişimi ile okunabilmelidir. FS = 1 çizgisi işaretlenmeli, bu çizginin altında kalan derinlikler sıvılaşabilir bölge olarak gölgelenmelidir.",
      en: "CSR and CRR versus depth for Youd and BI2014 on the same site; FS = 1 line and liquefiable zone shaded.",
    },
  },

  // ------------------------------------------------------------------
  // 7
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "7. Programın sınırları", en: "7. Limits of the program" } },
  {
    type: "p",
    text: {
      tr: "Basitleştirilmiş yöntem, sınırlı bir deneysel veri setine dayanır ve bu nedenle her sınırı açıkça bilmek gerekir. Kodda bazı noktalar bilerek dışlanır: GWT üstündeki noktalar (doygun değil), yöntemin derinlik sınırının altındaki noktalar (Youd 30 m, BI2014 34 m), kil benzeri noktalar (PI ≥ 7 ya da I_c > 2,6) ve yoğun noktalar (Youd N ≥ 30, CPT q_c1Ncs ≥ 160). Bunların hiçbiri için FS hesaplanmaz; dolayısıyla LPI bu noktaları sıfır katkıyla alır. Bu, kil benzeri zeminler sıvılaşmaz anlamına gelmez; yalnız bu yöntemin kapsamında değildir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Derinlik ve kalibrasyon sınırları da önemlidir. Kod, 20 m'den sonraki sonuçların daha az güvenilir olduğunu uyarır; basitleştirilmiş yöntem sığ ve doygun kumlar için tasarlanmıştır. Ayrıca yöntem sahada tek bir tabaka ve tek bir GWT varsaydığı için; sızma akımı, kapiler zon, ve yağışla değişen su seviyesi modellenmez. Youd yolunda CPT için K_c, I_c = 1,64 eşiğinde süreksizdir: altında 1, üstünde polinom (I_c = 1,65'te yaklaşık 1,003) kullanılır; R&W (1998) düşük sürtünme oranı kısayolu (K_c = 1) bu kodda kullanılmaz. Bu, küçük bir sıçramadır ama tabakalı sahada dikkatle okunmalıdır.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "BI2014 SPT yolunda yoğunluk maskesi kapalıdır: yoğun (N1)60cs değerleri de FS'ye girer. K_σ, σ'_v0 < Pa iken 1'i geçebilir (1,1 ile sınırlı). Bu nedenle yüzeye yakın gevşek noktalarda sonuç, Youd'a göre daha muhafazakâr ya da daha az muhafazakâr çıkabilir; iki yöntem birlikte kontrol edilmelidir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Son olarak, sonuç bir tasarım kararı değildir. Programın verdiği FS ve LPI değerleri, zemin raporundaki verilerin doğruluğuna, a_max ve M'nin seçimine ve bu bölümde sayılan varsayımların kabul edilebilirliğine bağlıdır. Sıvılaşma değerlendirmesi, sahadan alınmış örnekler ve gerekiyorsa daha ayrıntılı (dinamik) analizlerle desteklenmelidir. Mühendis, programın hangi noktayı neden dışladığını ve hangi girdinin açıkça varsayıldığını raporda yazmalıdır.",
    },
  },

  {
    type: "figure",
    id: "liq-fs-profile",
    caption: {
      tr: "Derinliğe göre FS profili: yatay eksen FS (0-2), dikey eksen derinlik (0-20 m, yüzey üstte). Her nokta durumuna göre renklendirilmelidir: sıvılaşabilir (FS < 1), marjinal (1 ≤ FS < 1,1), güvenli (FS ≥ 1,1), ve FS'si olmayan durumlar (GWT üstü, kil benzeri, yoğun, dışlanmış) ayrı bir işaretle gösterilmelidir. Grafiğin köşesinde LPI değeri (örnek için 9,0) ve tehlike kategorisi (yüksek) yazılmalıdır. FS = 1 ve FS = 1,1 yatay referans çizgileri işaretlenmelidir.",
      en: "FS versus depth with status colours (liquefiable, marginal, safe, and no-FS statuses), LPI value and category label; reference lines at FS 1 and 1.1.",
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
      { tr: "LPI'yı 0-20 m tam integrali sanmak ya da 0-1 m aralığını dahil edilmiş varsaymak: programda paylaşılan aralıklar kullanılır ve ilk aralık z_1 − Δz/2'den başlar.", en: "Assuming LPI includes 0-1 m." },
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
        q: { tr: "Dört noktalı LPI örneğinde (FS = 0,9; 0,7; 1,2; 0,8) ilk noktanın (z = 2 m, FS = 0,9) katkısını (iki basamak) hesaplayın. Aralığı [1, 3] m'dir.", en: "In the four-point LPI example, compute the contribution of the first point (z = 2 m, FS = 0.9). Its interval is [1, 3] m." },
        a: { tr: "F = 0,1; ∫[1,3](10 − 0,5 z) dz = 20 − 0,25·8 = 18; katkı = 0,1 · 18 = 1,80.", en: "Contribution = 1.80." },
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
