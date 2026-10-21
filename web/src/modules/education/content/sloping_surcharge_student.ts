import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Eğimli arazi (β) ve program çıktısının anlamı", en: "1. Sloping ground (beta) and what the program output means" } },
  {
    type: "p",
    text: {
      tr: "Bir istinat duvarının arkasındaki zemin düz değilse, yani dolgu yüzeyi β açısıyla yükseliyorsa, duvara gelen basınç düz arazidekinden farklıdır. Gündelik bir benzetme: ayakta yığılmış bir kum tepesinin dibine yaslanan bir tahta, tepe eğimli olduğunda daha çok itilir. Eğim açısı β, dolgu yüzeyinin yatayla yaptığı açıdır ve arazi duvardan uzaklaştıkça yükseliyorsa pozitif alınır. Eğim arttıkça yanal basınç katsayısı K_a da artar; çünkü zemin yüzeyi, kayabilecek bir kütlenin üst sınırını yukarı taşır. Bu sezgi, eğimin neden tehlikeli olduğunu anlamanın başlangıcıdır.", en: "When the soil behind a retaining wall is not flat, i.e. the fill surface rises at angle β, the pressure on the wall differs from that on level ground. An everyday analogy: a board leaning against the foot of a sand heap is pushed harder when the heap is sloped. The slope angle β is the angle the fill surface makes with the horizontal, and it is taken as positive if the ground rises away from the wall. As the slope increases, the lateral pressure coefficient K_a also increases, because the soil surface raises the upper limit of a mass that could slide. This intuition is the starting point for understanding why slope is dangerous.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Rankine teorisinde β ≤ φ olmalıdır; aksi halde denge çözümü yoktur ve program hata verir (bkz. örnek 1). Program yatay bir duvar yüzü ve düzgün bir dolgu eğimi için K_a(β) = cos β (cos β − √(cos² β − cos² φ)) / (cos β + √(cos² β − cos² φ)) bağıntısını kullanır. Ancak lateral_pressure fonksiyonunun döndürdüğü force değeri toplam eğik bileşke değil, yatay bileşendir. Rankine için yatay bileşen P_h = P_a cos β'dır; bu, basıncın dolgu yüzeyine paralel yönde etki ettiği için oluşur. Bu nedenle β arttıkça toplam K_a artar, ama yatay bileşen yalnız kısmen artar. Sonucu okurken bu sözleşmeyi bilmek gerekir: 'force' bir yatay kuvvettir.", en: "In Rankine theory β ≤ φ must hold; otherwise there is no equilibrium solution and the program gives an error (see example 1). For a horizontal wall face and a uniform fill slope the program uses K_a(β) = cos β (cos β − √(cos² β − cos² φ)) / (cos β + √(cos² β − cos² φ)). However, the force value returned by the lateral_pressure function is not the total inclined resultant but the horizontal component. For Rankine the horizontal component is P_h = P_a cos β; this arises because the pressure acts parallel to the fill surface. Therefore as β increases the total K_a increases, but the horizontal component increases only partly. When reading the result, it is necessary to know this convention: 'force' is a horizontal force.",
    },
  },
  {
    type: "figure",
    id: "sur-beta-wedge",
    caption: {
      tr: "Eğimli dolgu (β) ve sürşarj (q) aktif kamaya birlikte yük ekler. Rankine eğimli dolgu katsayısı K_a(β), β ≤ φ′ için tanımlıdır: φ′ = 30° için β = 0°, 10°, 20° → 0,3333; 0,3495; 0,4142.",
      en: "Sloping backfill (β) and surcharge (q) both add load to the active wedge. The Rankine sloping-backfill coefficient K_a(β) exists for β ≤ φ′: for φ′ = 30°, β = 0°, 10°, 20° → 0.3333, 0.3495, 0.4142.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: β = 10°, φ = 30°, H = 6 m, γ = 18 kN/m³ (Rankine, yatay bileşen)", en: "Example 1: beta 10 deg, Rankine horizontal component" },
    given: [
      { tr: "Tek katmanlı dolgu: γ = 18 kN/m³, φ' = 30°, c = 0, yeraltı suyu derin (kuru)", en: "Single-layer fill: γ = 18 kN/m³, φ' = 30°, c = 0, groundwater deep (dry)" },
      { tr: "Duvar yüksekliği H = 6 m, düşey yüz, δ = 0, q = 0", en: "Wall height H = 6 m, vertical face, δ = 0, q = 0" },
    ],
    steps: [
      { label: { tr: "Ka (β = 0)", en: "Ka at beta 0" }, expr: "K_a = tan²(45° − φ/2) = tan²(30°)", result: "K_a = 0.3333" },
      { label: { tr: "Ka (β = 10°)", en: "Ka at beta 10" }, expr: "cos 10° = 0.9848; cos 30° = 0.8660; √(0.9698 − 0.7500) = 0.4688; K_a = 0.9848 (0.9848 − 0.4688) / (0.9848 + 0.4688)", result: "K_a = 0.3495" },
      { label: { tr: "Toplam P_a", en: "Total P_a" }, expr: "P_a = ½ γ H² K_a = ½ × 18 × 36 × 0.3495", result: "P_a = 113.26 kN/m (eğik)" },
      { label: { tr: "Yatay bileşen", en: "Horizontal component" }, expr: "P_h = P_a cos β = 113.26 × 0.9848", result: "P_h = 111.53 kN/m" },
      { label: { tr: "β = 0 ile kıyas", en: "Compare with beta 0" }, expr: "P_h(β=0) = ½ × 18 × 36 / 3", result: "108.00 kN/m" },
    ],
    program: {
      input: "lateral_pressure(profile[γ=18, φ=30, c=0], height=6, method='rankine', beta=10)",
      output: "force = 111.524 kN/m, z_resultant = 4.000 m (β=0: force = 108.000)",
      note: { tr: "El hesabı ile programın yatay bileşen sonucu (111.53 ↔ 111.52) yuvarlama farkıyla aynı. Basınç merkezi derinliği 4.0 m olarak değişmedi; bu, yalnız tekdüze dolgu için beklenen bir sonuçtur.", en: "The hand calculation and the program's horizontal component result (111.53 ↔ 111.52) agree within rounding difference. The depth of the pressure centre remained 4.0 m; this is an expected result only for uniform fill." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Program 'force' değerini toplam eğik basınç sanmak; bu yatay bileşendir, toplam P_a = force / cos β'dır.", en: "Taking the program's 'force' value as the total inclined pressure; this is the horizontal component, total P_a = force / cos β." },
      { tr: "Rankine'i β > φ için kullanmak; program 'Rankine requires beta <= phi' hatasını verir ve bu bir eksik değil, teorinin sınırıdır.", en: "Using Rankine for β > φ; the program gives the error 'Rankine requires beta <= phi', and this is not a deficiency but a limit of the theory." },
      { tr: "Eğimi yüzey açısı yerine dolgu içi yayılma açısı ile karıştırmak; β arazi yüzeyinin açısıdır.", en: "Confusing the slope with the spreading angle inside the fill; β is the angle of the ground surface." },
    ],
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Duvar-zemin sürtünmesi δ ve program sözleşmesi", en: "2. Wall friction delta and the program convention" } },
  {
    type: "p",
    text: {
      tr: "Duvar yüzü pürüzlüyse zemin, duvarı aşağı doğru kaydırmaya çalışan bir sürtünme kuvveti uygular ve basınç yüzeye tam dik değil, δ kadar eğik etki eder. Rankine teorisi bu sürtünmeyi yok sayar (δ = 0 kabul eder), Coulomb teorisi ise δ'yı hesaba katar. Ayrıntılı kama dengesi ep_student_b bölümünde anlatıldığından burada yalnız programın bu girdiyi nasıl kullandığına odaklanıyoruz. Program Coulomb yönteminde P_a'nın horizontal bileşenini verir: P_h = P_a cos δ (duvar yüzü dikey ise).", en: "If the wall face is rough, the soil exerts a friction force attempting to slide the wall downward, and the pressure acts inclined by δ rather than exactly perpendicular to the face. Rankine theory ignores this friction (assumes δ = 0), whereas Coulomb theory accounts for δ. Since the detailed wedge equilibrium is explained in the ep_student_b section, here we focus only on how the program uses this input. In Coulomb's method the program gives the horizontal component of P_a: P_h = P_a cos δ (if the wall face is vertical).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu sözleşmenin pratik sonucu şudur: δ = 15° için Rankine ile Coulomb sonuçları aynı değildir ve bu fark Rankine'in δ'yı görmemesinden değil, Coulomb'un yatay izdüşümü almasından gelir. Coulomb K_a, δ arttıkça azalır; bu da basıncı küçültür. Ancak yatay izdüşüm kuvveti yine küçültür. Yani δ'nın etkisini hem K_a hem de cos δ üzerinden okumak gerekir. Bu iki etkiyi ayırmadan sonuç yorumlanırsa 'sürtünme basıncı artırıyor' gibi yanlış bir sonuca varılabilir.", en: "The practical consequence of this convention is: for δ = 15° the Rankine and Coulomb results are not the same, and this difference comes not from Rankine ignoring δ but from Coulomb taking the horizontal projection. Coulomb K_a decreases as δ increases, which reduces the pressure. However, the horizontal projection also reduces the force. Thus the effect of δ must be read through both K_a and cos δ. If the results are interpreted without separating these two effects, one may wrongly conclude that 'friction increases the pressure'.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: Coulomb, δ = 15°, β = 0, φ = 30°, H = 6 m", en: "Example 2: Coulomb delta 15" },
    given: [
      { tr: "Örnek 1 ile aynı zemin ve duvar; δ = 15°, β = 0", en: "Same soil and wall as Example 1; δ = 15°, β = 0" },
    ],
    steps: [
      { label: { tr: "Coulomb K_a (δ = 15°)", en: "Coulomb Ka" }, expr: "K_a = cos²φ / [cos δ (1 + √(sin(φ+δ) sin φ / cos δ))²] = 0.75 / [0.9659 × (1 + 0.6050)²]", result: "K_a = 0.3014" },
      { label: { tr: "Toplam P_a", en: "Total P_a" }, expr: "P_a = ½ × 18 × 36 × 0.3014", result: "P_a = 97.66 kN/m" },
      { label: { tr: "Yatay bileşen", en: "Horizontal component" }, expr: "P_h = P_a cos δ = 97.66 × 0.9659", result: "P_h = 94.33 kN/m" },
      { label: { tr: "Rankine ile kıyas", en: "Compare with Rankine" }, expr: "Rankine δ'yı yok sayar: P_h = 108.00", result: "Fark = −13.67 kN/m" },
    ],
    program: {
      input: "lateral_pressure(profile, height=6, method='coulomb', delta=15)",
      output: "force = 94.331 kN/m, z_resultant = 4.000 m",
      note: { tr: "El hesabı ile programın sonucu uyumlu. Program Coulomb katsayısını (0.3014) yatay izdüşümle birlikte verir; 'force' değeri bu nedenle P_a değil P_h'dir.", en: "The hand calculation and the program's result agree. The program gives the Coulomb coefficient (0.3014) together with the horizontal projection; therefore the 'force' value is P_h, not P_a." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Rankine ve Coulomb sonuçlarını δ'nın tek başına etkisi sanmak; yatay izdüşümün (cos δ) etkisi de katılmalıdır.", en: "Considering the effect of δ alone on Rankine and Coulomb results; the effect of the horizontal projection (cos δ) must also be included." },
      { tr: "δ'yı φ'den büyük girmek; bu fiziksel olarak sınırda bir değerdir ve girdinin gerekçesi zemin raporunda aranmalıdır.", en: "Entering δ greater than φ; this is a physically borderline value, and the justification for the input should be sought in the ground report." },
      { tr: "Coulomb pasif basıncını δ > φ/2 ile kullanmak; kod belgesine göre bu durumda doğrusal Coulomb pasif katsayısı tutucu değildir ve log-spiral çözümü gerekir.", en: "Using the Coulomb passive pressure with δ > φ/2; according to the code documentation, in this case the linear Coulomb passive coefficient is not conservative and a log-spiral solution is required." },
    ],
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Sürşarj (yüzey yükü) ve iki temel seçeneği", en: "3. Surcharge and its two basis options" } },
  {
    type: "p",
    text: {
      tr: "Sürşarj, dolgu yüzeyindeki düzgün bir düşey yüktür: bir yol, bir depo ya da bir bina temeli gibi. q [kPa] olarak girilir ve derinlik boyunca yanal basınca K·q olarak katkı verir. Sürşarjın duvar üzerindeki etkisi, zemin ağırlığı gibi düşünülebilir: ağırlığı yüzeyde artırmak, tüm yükseklik boyunca basıncı yükseltir. Sürşarjın etkisi derinlikle sabittir, dolayısıyla toplam yanal kuvvet q·H·K kadar olur ve bileşkenin derinliği H/2'ye yaklaşır. Bu sezgi, sürşarj katkısının tek başına dağılımını kontrol etmek için iyi bir kontroldür.", en: "Surcharge is a uniform vertical load on the fill surface, such as a road, a depot or a building foundation. It is entered as q [kPa] and contributes to lateral pressure as K·q along the depth. The effect of surcharge on the wall can be thought of as soil weight: increasing the weight at the surface raises the pressure along the whole height. Since the surcharge effect is constant with depth, the total lateral force is q·H·K and the resultant's depth approaches H/2. This intuition is a good check for controlling the distribution of the surcharge contribution alone.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Eğimli arazide sürşarj iki şekilde tanımlanabilir ve program bu seçimi basis parametresiyle yapar. 'horizontal' (varsayılan): q zaten yatay izdüşüm başına verilmiş bir değerdir. 'inclined': q, eğimli yüzeye dik olarak ölçülen düşey yük yoğunluğudur; yatay izdüşüm başına değer q / cos β olur. Bu iki seçim β küçükken birbirine yakındır, β büyüdükçe fark artar. Hangi tanımın kullanılacağı, sürşarj değerinin nasıl ölçüldüğüne bağlıdır ve projede belirtilmelidir.", en: "On sloping ground the surcharge can be defined in two ways, and the program makes this choice with the basis parameter. 'horizontal' (default): q is already given as a value per horizontal projection. 'inclined': q is the vertical load intensity measured perpendicular to the inclined surface; the value per horizontal projection is q / cos β. These two choices are close when β is small; the difference grows as β increases. Which definition to use depends on how the surcharge value was measured, and it must be stated in the project.",
    },
  },
  {
    type: "figure",
    id: "sur-surcharge-basis",
    caption: {
      tr: "Sürşarjın iki tanımı: 'horizontal' (varsayılan) q'yu yatay izdüşüm başına, 'inclined' eğimli yüzey başına verir; ikincisinde yatay izdüşüm başına q_h = q / cos β olur (β = 10° için 1,015·q).",
      en: "The two surcharge bases: 'horizontal' (default) gives q per horizontal projection, 'inclined' gives it per inclined surface; in the second case q_h = q / cos β per horizontal projection (1.015·q for β = 10°).",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: sürşarj q = 10 kPa, β = 10°, yatay izdüşüm tanımı", en: "Example 3: surcharge 10 kPa with beta 10" },
    given: [
      { tr: "Örnek 1 ile aynı dolgu (φ = 30°, γ = 18, H = 6 m, δ = 0)", en: "Same fill as Example 1 (φ = 30°, γ = 18, H = 6 m, δ = 0)" },
      { tr: "Düzgün sürşarj q = 10 kPa (yatay izdüşüm başına, varsayılan)", en: "Uniform surcharge q = 10 kPa (per horizontal projection, default)" },
    ],
    steps: [
      { label: { tr: "Sürşarj katkısı (yatay)", en: "Surcharge contribution" }, expr: "q · H · K_a · cos β = 10 × 6 × 0.3495 × 0.9848", result: "20.65 kN/m" },
      { label: { tr: "Toplam yatay", en: "Total horizontal" }, expr: "P_h = 111.53 + 20.65", result: "P_h = 132.18 kN/m" },
      { label: { tr: "β = 0 ile kıyas", en: "Compare with beta 0" }, expr: "128.00 = 108.00 + 10 × 6 / 3", result: "fark = +4.18 kN/m (β)" },
      { label: { tr: "inclined seçeneği", en: "inclined option" }, expr: "q_h = q / cos β = 10 / 0.9848", result: "q_h = 10.15 kPa (yatay izdüşüm başına)" },
    ],
    program: {
      input: "lateral_pressure(profile, height=6, method='rankine', beta=10, surcharge=10)",
      output: "force = 132.177 kN/m (β=0 ve q=10 için 128.000); surcharge_per_horizontal(10, 10, 'inclined') = 10.154",
      note: { tr: "El hesabı (132.18) programla aynı. Sürşarjın yatay bileşeni q·H·K_a·cos β'ya göre hesaplandı; yani sürşarj da yatay izdüşüme indirgendi. 'inclined' değerleri bu sayfa dışında projede seçilmelidir.", en: "The hand calculation (132.18) agrees with the program. The horizontal component of the surcharge was calculated as q·H·K_a·cos β; that is, the surcharge was also reduced to the horizontal projection. 'Inclined' values must be chosen in the project outside this page." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Sürşarjı kN/m olarak girmek; q kPa (kN/m²) ile girilir, derinlik boyunca yatay kuvvet q·H·K'dır.", en: "Entering the surcharge in kN/m; q is entered in kPa (kN/m²), and the horizontal force along the depth is q·H·K." },
      { tr: "'horizontal' ve 'inclined' tanımlarını karıştırmak; 'inclined' seçeneğinde izdüşüm başına değer q / cos β olur (β = 10° için yaklaşık %1.5 fark, β büyüdükçe artar).", en: "Confusing the 'horizontal' and 'inclined' definitions; in the 'inclined' option the value per projection is q / cos β (approximately 1.5% difference for β = 10°, increasing as β grows)." },
      { tr: "Sürşarj katkısını yalnız H'ye bölüp dağılımı lineer sanmak; sürşarj basıncı yükseklikle sabittir, bileşke derinlik H/2'dir.", en: "Dividing the surcharge contribution only by H and assuming a linear distribution; surcharge pressure is constant with height, and the resultant depth is H/2." },
    ],
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Deprem: M-O, φ − β − ψ koşulu ve TBDY 16.24b", en: "4. Earthquake: M-O, the phi - beta - psi condition and TBDY 16.24b" } },
  {
    type: "p",
    text: {
      tr: "Deprem sırasında dolgu, yalancı-statik bir yatay ivme k_h (ve düşey k_v) ile yüklenir. Bu yüklemenin etkisi, dolgunun kendi açısını bir ψ kadar kaydırmak gibi düşünülebilir: ψ = atan(k_h / (1 − k_v)). Mononobe-Okabe (M-O) çözümü bu kaymış açıyla çalışır ve dengeye bir çözüm verebilmesi için φ − β − ψ ≥ 0 olmalıdır. Bu koşul sağlanmazsa M-O çözümü yoktur: dolgunun eğimi, sürtünme açısını ve deprem kaymasını birlikte aşar. Program bu durumda açık bir SlopeError verir ve yalnız kama (trial wedge) ile genelleştirilmiş denge çözümü önerir.", en: "During an earthquake the fill is loaded by a pseudo-static horizontal acceleration k_h (and vertical k_v). The effect of this loading can be thought of as shifting the fill's own angle by ψ: ψ = atan(k_h / (1 − k_v)). The Mononobe-Okabe (M-O) solution works with this shifted angle, and for it to give a solution, φ − β − ψ ≥ 0 must hold. If this condition is not met there is no M-O solution: the slope of the fill jointly exceeds the friction angle and the seismic shift. In this case the program gives an explicit SlopeError and suggests only the generalised equilibrium solution with a trial wedge.",
    },
  },
  {
    type: "p",
    text: {
      tr: "β, φ − ψ değerini aştığında TBDY 2018 Denklem 16.24b (EN 1998-5 E.3 ile aynı biçim) kullanılır; bu bağıntı β'dan bağımsızdır, duvar sürtünmesi δ'yı tutar ve kodda yalnız β > φ − ψ durumunda çağrılmalıdır. Fonksiyon kendisi β'ya bakmaz; çağıran kodun koşulu doğru uygulaması gerekir. Sınırda M-O ile tutarlı olması beklenir: φ = 30°, k_h = 0.2 için β = 18.69° civarında M-O 0.9275, TBDY 0.9332 verir; bu küçük fark, kaynak doğrulanana kadar sürekliliğin tam sağlandığı varsayılmamalıdır.", en: "When β exceeds φ − ψ, TBDY 2018 Equation 16.24b (same form as EN 1998-5 E.3) is used; this relation is independent of β, holds the wall friction δ, and should be called in code only for β > φ − ψ. The function itself does not check β; the calling code must apply the condition correctly. At the boundary M-O is expected to be consistent: for φ = 30°, k_h = 0.2 near β = 18.69° M-O gives 0.9275 and TBDY gives 0.9332; this small difference means that full continuity should not be assumed until the source is verified.",
    },
  },
  {
    type: "figure",
    id: "sur-beta-regions",
    caption: {
      tr: "Eğim açısı β ve deprem (φ′ = 30°, k_h = 0,2): β ≤ φ′ − ψ = 18,69° için Mononobe-Okabe geçerlidir; φ′ − ψ ile φ′ arasında TBDY 16.24b kullanılır; β > φ′ iken çözüm yoktur ve program hata verir.",
      en: "Slope angle β and earthquake (φ′ = 30°, k_h = 0.2): Mononobe-Okabe is valid for β ≤ φ′ − ψ = 18.69°; between φ′ − ψ and φ′ TBDY 16.24b is used; for β > φ′ there is no solution and the program stops with an error.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: φ = 30°, k_h = 0.2, β = 25° (M-O yok, TBDY 16.24b)", en: "Example 4: seismic beyond phi - psi" },
    given: [
      { tr: "φ = 30°, k_h = 0.2, k_v = 0, δ = 0, θ = 0 (düşey yüz)", en: "φ = 30°, k_h = 0.2, k_v = 0, δ = 0, θ = 0 (vertical face)" },
      { tr: "β = 25° (eğim, φ'den küçük ama φ − ψ'den büyük)", en: "β = 25° (slope less than φ but greater than φ − ψ)" },
    ],
    steps: [
      { label: { tr: "ψ", en: "psi" }, expr: "ψ = atan(0.2 / (1 − 0)) = 11.31°", result: "ψ = 11.31°" },
      { label: { tr: "M-O koşulu", en: "M-O condition" }, expr: "φ − β − ψ = 30 − 25 − 11.31 = −6.31°", result: "< 0: M-O çözümü yok" },
      { label: { tr: "TBDY 16.24b", en: "TBDY 16.24b" }, expr: "K_AE = cos²(φ − ψ) / (cos ψ · cos²θ · cos(δ + θ + ψ)) = cos²(18.69°) / cos²(11.31°) = 0.8974 / 0.9615", result: "K_AE = 0.9332" },
    ],
    program: {
      input: "mononobe_okabe_kae(phi=30, beta=25, kh=0.2) ve tbdy_kae_steep(phi=30, kh=0.2)",
      output: "mononobe_okabe_kae: SlopeError 'M-O has no solution: phi - beta - psi = -6.31 deg'; tbdy_kae_steep = 0.9332",
      note: { tr: "El hesabı TBDY değerini programla aynı verdi. Programın tbdy fonksiyonu β kontrolü yapmaz; β > φ − ψ koşulunun çağıran koda bağlı olduğuna dikkat edin.", en: "The hand calculation gave the same TBDY value as the program. The program's tbdy function does not check β; note that the condition β > φ − ψ depends on the calling code." },
    },
  },
  {
    type: "warn",
    text: {
      tr: "G9 incelemesinde (docs/qa/G9-muhendislik-incelemesi.md) β > φ − ψ bölgesinde iki yolun (temel kama yolu ile katmanlı TBDY 16.24b yolu) çok farklı sonuç verebildiği belirlendi ve bu konunun kararı kullanıcıya bırakıldı (B8). Bu bölgede sonuç tek bir yolla yazılmamalı; iki yolun da sonucu raporda karşılaştırılmalıdır.",
      en: "Two seismic paths can give very different results beyond phi - psi (G9 item B8).",
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "M-O'yu β > φ − ψ bölgesinde de çalıştırmak; program hata verir, bu hata bir sonuç değil uyarıdır.", en: "Running M-O in the β > φ − ψ region too; the program gives an error, and this error is a warning, not a result." },
      { tr: "TBDY 16.24b'yi β ≤ φ − ψ bölgesinde kullanmak; bu durumda M-O doğru çözümdür.", en: "Using TBDY 16.24b in the β ≤ φ − ψ region; in this case M-O is the correct solution." },
      { tr: "k_h ile PGA'yı karıştırmak; k_h, yönetmelikten gelen ve birimsiz bir yatay katsayıdır.", en: "Confusing k_h with PGA; k_h is a dimensionless horizontal coefficient taken from the regulation." },
      { tr: "Deprem artışının bileşkesini yalnız H'ye dağıtıp K_AE − K_A farkını yanlış yüksekliğe koymak; TBDY kuralı artışı yarı yükseklikte uygular.", en: "Distributing the resultant of the seismic increment only over H and placing the K_AE − K_A difference at the wrong height; TBDY applies the increment at half height." },
    ],
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Palplanş: β ve sürşarj moment dengesinde", en: "5. Sheet pile: beta and surcharge in the moment balance" } },
  {
    type: "p",
    text: {
      tr: "Palplanş bir duvar gibi davranır ama kazı tabanının altına (kazı kotu, dredge line) gömülü bir boy ile ayakta kalır. Yalnız konsol (cantilever) palplanşta, aktif basınçların kazı tabanı üstündeki momenti pasif direnç momenti ile dengelenir ve gömülü boy D bu dengeden çıkar. Program önce net basınç diyagramını (aktif eksi pasif) kurar, sonra kazı tabanı altında moment dengesini sağlayan derinliği D_0 olarak bulur. Tasarım derinliği D = (1 + depth_increase) D_0 olur; varsayılan depth_increase = 0.2'dir, yani tasarım derinliği %20 artırılır.", en: "A sheet pile behaves like a wall but stands with an embedded length below the excavation base (excavation level, dredge line). Only in a cantilever sheet pile is the moment of the active pressures above the excavation base balanced by the passive resistance moment, and the embedded length D comes out of this balance. The program first constructs the net pressure diagram (active minus passive), then finds the depth D_0 that satisfies moment equilibrium below the excavation base. The design depth is D = (1 + depth_increase) D_0; the default depth_increase = 0.2, i.e. the design depth is increased by 20%.",
    },
  },
  {
    type: "p",
    text: {
      tr: "β ve sürşarj palplanşta net basınca farklı şekilde girer. Eğimli arka dolgu (backfill_slope) aktif basıncı büyütür, bu da gömülü boyu artırır; sürşarj (surcharge) ise tüm yükseklik boyunca düzgün bir aktif katkı verir. Sürşarj net basınca derinlikten bağımsız sabit bir aktif katkı verir; bu nedenle M_max ve D_0 üzerindeki etkisi belirgindir. Bu etkiler, palplanşta duvardaki kadar sezgisel değildir; bu yüzden aşağıdaki el kontrolü ile programın aynı sonucu verdiğini görmek önemlidir.", en: "β and surcharge enter the net pressure of a sheet pile in different ways. The sloping backfill (backfill_slope) increases active pressure, which increases the embedded length; surcharge gives a uniform active contribution along the whole height. Surcharge gives a constant active contribution to the net pressure, independent of depth; therefore its effect on M_max and D_0 is significant. These effects are not as intuitive for a sheet pile as they are for a wall; therefore it is important to see that the program gives the same result as the hand check below.",
    },
  },
  {
    type: "figure",
    id: "sur-sheet-moment",
    caption: {
      tr: "Konsol palplanş net basınç, kesme ve moment diyagramı (H = 3 m örneği): V = 0 olan z = 4,50 m'de M_max = 60,75 kN·m/m.",
      en: "Net pressure, shear and moment diagrams of a cantilever sheet pile (H = 3 m example): M_max = 60.75 kN·m/m at z = 4.50 m where V = 0.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 5: konsol palplanş, H = 3 m, kuru, φ = 30°, γ = 18 kN/m³", en: "Example 5: cantilever sheet pile hand check" },
    given: [
      { tr: "Kazı yüksekliği H = 3 m (kazı tabanı üstü), dolgu kuru, β = 0, sürşarj yok", en: "Excavation height H = 3 m (above the excavation base), backfill dry, β = 0, no surcharge" },
      { tr: "K_a = 1/3 (aktif), K_p = 3 (pasif, Rankine)", en: "K_a = 1/3 (active), K_p = 3 (passive, Rankine)" },
      { tr: "Gömülü boy için moment dengesi: kazı tabanına göre moment sıfır", en: "For the embedded length, moment balance: moment about the excavation base is zero" },
    ],
    steps: [
      { label: { tr: "Net basınç (z > H)", en: "Net pressure" }, expr: "aktif σ_a = γ z K_a = 6z; pasif σ_p = γ (z − H) K_p = 54 (z − 3); net = 6z − 54(z − 3) (z > 3)", result: "net = 162 − 48z (z > 3)" },
      { label: { tr: "Moment dengesi", en: "Moment balance" }, expr: "toplam moment kazı tabanına göre sıfır: 8z³ − 81z² + 243z − 243 = 0", result: "kök z ≈ 5.778 m" },
      { label: { tr: "D_0", en: "D0" }, expr: "D_0 = z − H = 5.778 − 3", result: "D_0 = 2.778 m" },
      { label: { tr: "Tasarım derinliği", en: "Design depth" }, expr: "D = 1.2 × 2.778", result: "D = 3.333 m" },
      { label: { tr: "M_max", en: "M_max" }, expr: "kesme sıfır: F(z) = 24z² − 162z + 243 = 0 → z = 4.5 m; M_max = ∫₀^4.5 F(s) ds = 27.00 + 33.75", result: "M_max = 60.75 kNm/m (z = 4.5 m)" },
    ],
    program: {
      input: "cantilever_sheet_pile(profile[γ=18, φ=30, dry], H=3.0)",
      output: "D0 = 2.778 m, D = 3.333 m, M_max = 60.75 kNm/m at z = 4.5 m",
      note: { tr: "Elle çözülen moment dengesi (kök ≈ 5.778) ve M_max (60.75) programla birebir uyuyor. Programın toe_force değeri −108.16 döndürdü; işaret konvansiyonu kaynakta doğrulanmalı ve sonuç yorumunda işaretin ne anlama geldiği belirtilmeli.", en: "The hand-solved moment balance (root ≈ 5.778) and M_max (60.75) agree exactly with the program. The program's toe_force value returned −108.16; the sign convention should be verified in the source, and the meaning of the sign must be stated in the interpretation of the result." },
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 6: aynı palplanş, β = 10° ve q = 10 kPa sürşarj (program)", en: "Example 6: beta and surcharge on the sheet pile" },
    given: [
      { tr: "Örnek 5 ile aynı; β = 10° ve düzgün sürşarj q = 10 kPa ayrı ayrı", en: "Same as Example 5; β = 10° and uniform surcharge q = 10 kPa separately" },
    ],
    steps: [
      { label: { tr: "Dolgu eğimi (β = 10°)", en: "Backfill slope beta 10" }, expr: "aktif basınç K_a(β) = 0.3495 (örnek 1); moment dengesi aynı yöntemle", result: "D_0 = 2.836 m, M_max = 63.76 kNm/m (program)" },
      { label: { tr: "Sürşarj (q = 10 kPa)", en: "Surcharge 10 kPa" }, expr: "aktif katkı q K_a = 10 × 0.3333 = 3.33 kPa (tüm yükseklik boyunca)", result: "D_0 = 3.252 m, M_max = 96.55 kNm/m (program)" },
    ],
    program: {
      input: "cantilever_sheet_pile(profile, H=3.0, backfill_slope=10) ve (…, surcharge=10)",
      output: "β=10: D0 = 2.836, M_max = 63.76;  q=10: D0 = 3.252, M_max = 96.55",
      note: { tr: "Bu iki sonuç elle tam kontrol edilmedi; sürşarj etkisi (≈ %59 M_max artışı) tutarlı yönde ama büyüklüğü sayfa dışında bir doğrulama gerektirir. Sürşarj ve β değerlerini tasarımda ayrı ayrı rapor edin.", en: "These two results were not fully checked by hand; the surcharge effect (≈ 59% M_max increase) is consistent in direction, but its magnitude requires verification beyond this page. Report the surcharge and β values separately in the design." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Gömülü boyu D_0 ile tasarım derinliği D'yi karıştırmak; tasarımda D = 1.2 D_0 (varsayılan) kullanılır.", en: "Confusing embedded length D_0 with design depth D; in design D = 1.2 D_0 (default) is used." },
      { tr: "Palplanşta M_max'ı kazı tabanı üstünden değil üstten ölçmek; program z derinliğini üst kotan itibaren verir.", en: "Measuring M_max on the sheet pile from the top rather than from the excavation base; the program gives the depth z from the top level." },
      { tr: "Sürşarjın palplanş momentine küçük bir etki yaptığını varsaymak; örnek 6'da M_max %59 arttı.", en: "Assuming the surcharge has a small effect on the sheet pile moment; in example 6 M_max increased by 59%." },
      { tr: "Pasif basıncı kazı tabanı üstünde de katmak; pasif yalnız kazı tabanı altında etkir.", en: "Adding passive pressure above the excavation base as well; passive acts only below the excavation base." },
      { tr: "toe_force değerini (−108 gibi) yorumsuz bırakmak; işaret konvansiyonunu bilmeden kuvvet yönü yorumlanamaz.", en: "Leaving the toe_force value (like −108) uninterpreted; without knowing the sign convention the force direction cannot be interpreted." },
    ],
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Program sınırları ve açık sorular", en: "6. Program limits and open questions" } },
  {
    type: "p",
    text: {
      tr: "Bu konunun her hesabı, bir varsayımın sonucudur. Rankine ve Coulomb bağıntıları düzgün, yatay bir duvar ve düz bir dolgu için verilmiştir; kırılmış ya da sınırlı bir arkada, çok katmanlı ve eğimli bir dolguda sonuç değişir. Eğim ve sürşarj birlikte kullanıldığında program yalnız lineer toplamı verir; etkileşim (sürşarjın eğimli yüzeyde farklı izdüşümü gibi) ayrıca modellenmemiştir.", en: "Every calculation in this topic is the result of an assumption. Rankine and Coulomb relations are given for a uniform, horizontal wall and a flat fill; the result changes for a broken or confined backfill, or for a multi-layer and sloping fill. When slope and surcharge are used together the program gives only the linear sum; interaction (such as the different projection of the surcharge on an inclined surface) is not separately modelled.",
    },
  },
  {
    type: "p",
    text: {
      tr: "G9 incelemesi, bu konudaki bazı noktaları açık soru olarak işaretledi: drenajsız temel zemininde eğimli dolgu veya deprem varsa kayma dişi itkisi hesaplanamadığı için analiz açık hatayla durur (B13); palplanşta su altı zeminde TBDY eşdeğer k_h kullanılmıyor (B15); ve φ = 0 zeminde deprem pasif azaltımı kohezyon payını fazla etkileyebilir (B14). Bu noktalar kod tarafında korunmuş ya da kullanıcıya sorulmuştur; raporda bunları varsayım olarak yazmak gerekir.", en: "The G9 review flagged some points of this topic as open questions: if there is inclined fill or an earthquake on undrained foundation soil, the analysis stops with an explicit error because the shear key thrust cannot be computed (B13); in sheet piles in submerged soil the TBDY equivalent k_h is not used (B15); and in φ = 0 soil the seismic passive reduction may affect the cohesion allowance excessively (B14). These points have either been preserved in the code or referred to the user; in the report they must be written as assumptions.",
    },
  },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "β = 0, φ = 30° için Rankine K_a kaçtır?", en: "What is the Rankine K_a for β = 0, φ = 30°?" },
        a: { tr: "K_a = tan²(45° − 15°) = tan² 30° = 1/3 = 0.3333.", en: "K_a = tan²(45° − 15°) = tan² 30° = 1/3 = 0.3333." },
      },
      {
        q: { tr: "H = 6 m, γ = 18 kN/m³, β = 0, K_a = 1/3 ise toplam yatay kuvvet kaç kN/m'dir?", en: "H = 6 m, γ = 18 kN/m³, β = 0, K_a = 1/3: what is the total horizontal force in kN/m?" },
        a: { tr: "½ × 18 × 36 / 3 = 108 kN/m.", en: "½ × 18 × 36 / 3 = 108 kN/m." },
      },
      {
        q: { tr: "Aynı duvar için β = 10° iken Rankine yatay bileşeni kaç kN/m'dir (K_a = 0.3495)?", en: "For the same wall with β = 10°, what is the Rankine horizontal component in kN/m (K_a = 0.3495)?" },
        a: { tr: "P_a = ½ × 18 × 36 × 0.3495 = 113.26; P_h = 113.26 × cos 10° = 111.5 kN/m. Program: 111.524.", en: "P_a = ½ × 18 × 36 × 0.3495 = 113.26; P_h = 113.26 × cos 10° = 111.5 kN/m. Program: 111.524." },
      },
      {
        q: { tr: "φ = 30° ve β = 35° için Rankine çağrılırsa program ne yapar?", en: "What does the program do if Rankine is called for φ = 30° and β = 35°?" },
        a: { tr: "β > φ olduğu için hata verir: 'Rankine requires beta (35) <= phi (30)'.", en: "Since β > φ it gives an error: 'Rankine requires beta (35) <= phi (30)'." },
      },
      {
        q: { tr: "q = 10 kPa, H = 6 m, K_a = 1/3, β = 0 için sürşarjın yatay toplam kuvveti kaç kN/m'dir?", en: "For q = 10 kPa, H = 6 m, K_a = 1/3, β = 0: what is the total horizontal surcharge force in kN/m?" },
        a: { tr: "q H K_a = 10 × 6 / 3 = 20 kN/m.", en: "q H K_a = 10 × 6 / 3 = 20 kN/m." },
      },
      {
        q: { tr: "β = 10° için 'inclined' sürşarj tanımında yatay izdüşüm başına q_h kaçtır (q = 10 kPa)?", en: "For β = 10° in the 'inclined' surcharge definition, what is q_h per horizontal projection (q = 10 kPa)?" },
        a: { tr: "q_h = q / cos β = 10 / 0.9848 = 10.15 kPa. Program: 10.154.", en: "q_h = q / cos β = 10 / 0.9848 = 10.15 kPa. Program: 10.154." },
      },
      {
        q: { tr: "φ = 30° ve k_h = 0.2 için ψ kaç derecedir ve φ − ψ kaç derecedir?", en: "For φ = 30° and k_h = 0.2, what is ψ in degrees, and what is φ − ψ in degrees?" },
        a: { tr: "ψ = atan(0.2) = 11.31°; φ − ψ = 18.69°.", en: "ψ = atan(0.2) = 11.31°; φ − ψ = 18.69°." },
      },
      {
        q: { tr: "φ = 30°, k_h = 0.2, β = 25° için M-O çözümü var mıdır? Hangi bağıntı kullanılmalıdır?", en: "For φ = 30°, k_h = 0.2, β = 25°: is there an M-O solution, and which relation should be used?" },
        a: { tr: "Yoktur: φ − β − ψ = −6.31° < 0. TBDY 16.24b kullanılır, K_AE = 0.9332 (β'dan bağımsız).", en: "No: φ − β − ψ = −6.31° < 0. TBDY 16.24b is used, K_AE = 0.9332 (independent of β)." },
      },
      {
        q: { tr: "H = 3 m, K_a = 1/3, γ = 18 kN/m³, dolgu kuru iken kazı tabanı üstünde aktif basınç σ_a (z = H) kaç kPa'dır?", en: "H = 3 m, K_a = 1/3, γ = 18 kN/m³, dry fill: what is the active pressure σ_a (z = H) at the excavation base in kPa?" },
        a: { tr: "σ_a = γ H K_a = 18 × 3 / 3 = 18 kPa.", en: "σ_a = γ H K_a = 18 × 3 / 3 = 18 kPa." },
      },
      {
        q: { tr: "Konsol palplanşta D_0 = 2.778 m ise tasarım derinliği D kaçtır (depth_increase = 0.2)?", en: "If D_0 = 2.778 m for a cantilever sheet pile, what is the design depth D (depth_increase = 0.2)?" },
        a: { tr: "D = 1.2 × 2.778 = 3.333 m.", en: "D = 1.2 × 2.778 = 3.333 m." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "β (eğim açısı)", en: "β (slope angle)" }, def: { tr: "Dolgu yüzeyinin yatayla yaptığı açı; duvardan uzaklaştıkça yükseliyorsa pozitif.", en: "The angle the fill surface makes with the horizontal; positive if it rises away from the wall." } },
      { term: { tr: "δ (duvar sürtünmesi)", en: "δ (wall friction)" }, def: { tr: "Duvar yüzü ile zemin arasındaki sürtünme açısı; Coulomb'da basıncın yönünü etkiler.", en: "Friction angle between the wall face and the soil; affects the direction of pressure in Coulomb." } },
      { term: { tr: "θ (yüz eğimi)", en: "θ (face inclination)" }, def: { tr: "Duvar arka yüzünün düşeyle yaptığı açı.", en: "Angle of the back face of the wall with the vertical." } },
      { term: { tr: "K_a, K_p", en: "K_a, K_p" }, def: { tr: "Aktif ve pasif yanal basınç katsayıları; birimsiz.", en: "Active and passive lateral pressure coefficients; dimensionless." } },
      { term: { tr: "Rankine teorisi", en: "Rankine theory" }, def: { tr: "Düzgün arka yüz ve δ = 0 kabul eden denge çözümü; β ≤ φ koşulu vardır.", en: "Equilibrium solution assuming a smooth back face and δ = 0; has the condition β ≤ φ." } },
      { term: { tr: "Coulomb teorisi", en: "Coulomb theory" }, def: { tr: "Kayan kama dengesine dayanan ve δ'yı hesaba katan çözüm.", en: "Solution based on sliding wedge equilibrium that accounts for δ." } },
      { term: { tr: "Yatay bileşen (P_h)", en: "Horizontal component (P_h)" }, def: { tr: "Toplam eğik basıncın yatay izdüşümü; program force değerini bu biçimde verir.", en: "Horizontal projection of the total inclined pressure; the program gives the force value in this form." } },
      { term: { tr: "Sürşarj (q)", en: "Surcharge (q)" }, def: { tr: "Dolgu yüzeyine uygulanan düzgün düşey yük yoğunluğu [kPa].", en: "Uniform vertical load intensity applied to the fill surface [kPa]." } },
      { term: { tr: "horizontal / inclined basis", en: "horizontal / inclined basis" }, def: { tr: "Sürşarjın yatay izdüşüm başına (varsayılan) ya da eğimli yüzeye dik olarak tanımlanma seçeneği.", en: "Option to define the surcharge per horizontal projection (default) or perpendicular to the inclined surface." } },
      { term: { tr: "k_h, k_v", en: "k_h, k_v" }, def: { tr: "Yatay ve düşey yalancı-statik deprem katsayıları; birimsiz.", en: "Horizontal and vertical pseudo-static seismic coefficients; dimensionless." } },
      { term: { tr: "ψ (sismik açı)", en: "ψ (seismic angle)" }, def: { tr: "ψ = atan(k_h / (1 − k_v)); deprem yüklemesinin açıya eşdeğeri.", en: "ψ = atan(k_h / (1 − k_v)); the angle equivalent of the seismic loading." } },
      { term: { tr: "Mononobe-Okabe (M-O)", en: "Mononobe-Okabe (M-O)" }, def: { tr: "Deprem sırasındaki aktif basınç için kama çözümü; φ − β − ψ ≥ 0 koşulu ister.", en: "Wedge solution for active pressure during an earthquake; requires the condition φ − β − ψ ≥ 0." } },
      { term: { tr: "TBDY 16.24b", en: "TBDY 16.24b" }, def: { tr: "β > φ − ψ bölgesi için kullanılan, β'dan bağımsız deprem K_AE bağıntısı.", en: "Seismic K_AE relation independent of β, used for the region β > φ − ψ." } },
      { term: { tr: "Palplanş", en: "Sheet pile" }, def: { tr: "Zemine çakılan, gömülü boyu ile ayakta kalan ince duvar.", en: "A thin wall driven into the ground that stands by its embedded length." } },
      { term: { tr: "Kazı tabanı (dredge line)", en: "Excavation base (dredge line)" }, def: { tr: "Önde kazılan zeminin üst kotu; pasif direncin başladığı yer.", en: "Top level of the soil excavated on the front; where passive resistance begins." } },
      { term: { tr: "Net basınç", en: "Net pressure" }, def: { tr: "Aktif basınç eksi pasif basınç (ve su/sürşarj katkıları); moment dengesinin kaynağı.", en: "Active pressure minus passive pressure (and water/surcharge contributions); the source of moment balance." } },
      { term: { tr: "D_0 (gömülü boy)", en: "D_0 (embedded length)" }, def: { tr: "Moment dengesinin sağlandığı, kazı tabanı altındaki minimum boy.", en: "The minimum length below the excavation base at which moment balance is satisfied." } },
      { term: { tr: "D (tasarım boyu)", en: "D (design length)" }, def: { tr: "D_0 × (1 + depth_increase); varsayılan artış %20.", en: "D_0 × (1 + depth_increase); default increase 20%." } },
      { term: { tr: "M_max", en: "M_max" }, def: { tr: "Kesme kuvvetinin sıfır olduğu derinlikte oluşan en büyük moment [kNm/m].", en: "The largest moment, occurring at the depth where shear force is zero [kNm/m]." } },
      { term: { tr: "toe_force", en: "toe_force" }, def: { tr: "Programın döndürdüğü uç (toe) kuvveti; işareti kaynakta doğrulanmalı.", en: "Toe force returned by the program; its sign must be verified in the source." } },
      { term: { tr: "backfill_slope", en: "backfill_slope" }, def: { tr: "Palplanş hesabında arka dolgunun eğimi (β) girdisi.", en: "Input for the slope (β) of the backfill in sheet pile calculation." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Das, B.M. Principles of Foundation Engineering, istinat duvarı ve toprak basıncı bölümü - kodda atıf; bu oturumda açılamadı, bölüm numarası doğrulanmadı.",
      "FHWA GEC-3 (FHWA-NHI-11-032), Bölüm 11 - sismik toprak basıncı; kodda atıf; açılamadı.",
      "Mononobe, N. & Matsuo, H. (1929) ve Okabe, S. (1926) - M-O'nun orijinal çalışmaları; kodda atıf; doğrulanamadı.",
      "TBDY 2018 Denklem 16.24b ve 16.12.2.8 - yönetmelik maddeleri; kodda atıf; yönetmelik metni bu oturumda açılamadı.",
      "Ebeling, R.M. & Morrison, E.E. (1992/1993), Technical Report ITL-92-11 - palplanş deprem artışı; künye doğrulandı, içerik teyit edilmedi.",
      "docs/qa/G9-muhendislik-incelemesi.md (proje içi) - B1 ile B15 arasındaki açık sorular ve kararlar; bu metin bu belgeden okundu.",
    ],
  },
];
