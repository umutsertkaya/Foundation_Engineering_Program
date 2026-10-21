import type { Block } from "./types";

/* Student layer, part B: Coulomb, sloping backfill, seismic earth pressure, wall checks, limits.
   Figure ids (drawn separately): ep-coulomb-wedge, ep-ka-phi, ep-seismic-wedge,
   wall-stability-checks, ep-wall-forces. Worked example numbers: Example 3 (gravity wall). */

export const partB: Block[] = [
  { type: "h", text: { tr: "7) Coulomb teorisi: kama dengesi", en: "7) Coulomb theory: wedge equilibrium" } },
  {
    type: "p",
    text: {
      tr: "Rankine çözümü duvar arkasındaki her noktanın gerilme durumuna bakar ve zemini sonsuz uzun bir yarı-uzay gibi kabul eder; duvar ile zemin arasında sürtünme yoktur. Gerçek bir istinat duvarında ise dolgu, duvarın arkasında üçgen bir blok (kama) halinde kayabilir. Bunu günlük bir benzetmeyle düşünün: bir kum yığınının yanına tahta bir levha koyup levhayı yavaşça ittiğinizde, kum tek bir eğik çizgi boyunca bir üçgen parçası halinde yüzeye çıkar. Bu parçanın eğimi kumun iç sürtünme açısına bağlıdır ve levha ile kum arasındaki sürtünme de parçanın hareketine karşı koyar. Coulomb (1776) bu fikri matematiğe dökmüştür: olası tüm kayma düzlemleri denenir ve duvara binen en büyük itkiyi veren düzlem aranır. Birimler şöyledir: φ iç sürtünme açısı, δ duvar-zemin sürtünme açısı, β dolgu yüzeyinin eğimi, hepsi derecedir. Yöntemin sınırı, kaymanın tek bir düz yüzey boyunca olduğu varsayımıdır; kohezyonlu veya tabakalı zeminlerde kayma yüzeyi eğri olabilir ve bu durumda sonuç farklı çıkar.", en: "The Rankine solution looks at the stress state of every point behind the wall and treats the soil as an infinitely long half-space; there is no friction between wall and soil. In a real retaining wall, however, the backfill can slide as a triangular block (wedge) behind the wall. Think of it this way: if you place a wooden board beside a pile of sand and push the board slowly, the sand comes up to the surface as a triangular piece along a single inclined line. The slope of this line depends on the internal friction angle of the sand, and the friction between the board and the sand resists the movement of the piece. Coulomb (1776) put this idea into mathematics: all possible slip planes are tried and the plane that gives the largest thrust on the wall is sought. The units are: φ the internal friction angle, δ the wall-soil friction angle and β the slope of the backfill surface, all in degrees. A limit of the method is the assumption that sliding occurs along a single plane; in cohesive or layered soils the sliding surface may be curved, and the result then differs.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kama dengesinde üç kuvvet vardır. W, kamanın kendi ağırlığıdır (kN/m) ve düşey aşağı yönlüdür. R, kayma düzlemi üzerindeki tepkidir; düzlemin normalinden φ kadar sapar, çünkü sürtünme direnci düzlem normaline göre φ açısıyla eğilir. P, duvarın kama üzerindeki destek kuvvetidir (kamanın duvara uyguladığı itkinin tepkisi); duvar yüzünün normalinden δ kadar sapar. Bu üç kuvvet kapalı bir üçgen oluşturmak zorundadır; bu üçgene kuvvet çokgeni denir. W'nin doğrultusu düşeydir, R'nin doğrultusu φ ile, P'nin doğrultusu δ ile belirlenir. Sinüs teoremi uygulanınca kayma düzlemi ρ açısı verildiğinde P bulunur. ρ, kayma düzleminin yatayla yaptığı açıdır ve en kötü durum için aranır. Kama alanı H yüksekliğinde ve düşey yüzlü bir duvar için ½·H²·cot ρ'dir; W = ½·γ·H²·cot ρ kN/m verir (γ birim ağırlık, kN/m³).", en: "In the wedge equilibrium there are three forces. W is the weight of the wedge itself (kN/m) and acts vertically downward. R is the reaction on the slip plane; it deviates from the normal to the plane by φ, because the frictional resistance is inclined by φ from the plane normal. P is the support force of the wall on the wedge (the reaction to the thrust the wedge exerts on the wall); it deviates from the normal to the wall face by δ. These three forces must form a closed triangle, called the force polygon. The direction of W is vertical, and the directions of R and P are fixed by φ and δ. Applying the sine rule gives P once the slip plane angle ρ is known. ρ is the angle the slip plane makes with the horizontal, and it is sought for the worst case. For a wall of height H with a vertical face, the wedge area is ½·H²·cot ρ, which gives W = ½·γ·H²·cot ρ kN/m (γ is the unit weight, kN/m³).",
    },
  },
  {
    type: "figure",
    id: "ep-coulomb-wedge",
    caption: {
      tr: "Coulomb kaması: düşey duvar, yatay dolgu ve topuktan çıkan ρ açılı kayma düzlemi. Kama üzerinde W, kayma düzlemi tepkisi R (normalden φ sapmalı) ve duvar tepkisi P_A (normalden δ sapmalı) dengededir; sağda kapalı kuvvet üçgeni.",
      en: "Coulomb wedge: vertical wall, horizontal backfill and a slip plane at angle ρ from the heel. On the wedge W, the slip-plane reaction R (deviating φ from the normal) and the wall reaction P_A (deviating δ from the normal) are in equilibrium; the closed force triangle is on the right.",
    },
  },
  {
    type: "formula",
    expr: "P(ρ) = W · sin(ρ − φ) / cos(ρ − φ − δ),   W = ½ · γ · H² · cot ρ",
    caption: { tr: "Kama kuvvet dengesi (β = 0, θ = 0)", en: "Wedge force balance (beta = 0, theta = 0)" },
    where: [
      { tr: "P: duvara binen itki [kN/m]; ρ: kayma düzleminin yatayla açısı [°]", en: "P: thrust on the wall [kN/m]; ρ: angle of the slip plane to the horizontal [°]" },
      { tr: "γ: dolgu birim ağırlığı [kN/m³]; H: duvar yüksekliği [m]; φ, δ: [°]", en: "γ: unit weight of the backfill [kN/m³]; H: wall height [m]; φ, δ: [°]" },
    ],
  },
  {
    type: "derivation",
    title: { tr: "Coulomb aktif katsayısının elde edilişi", en: "Derivation of the Coulomb active coefficient" },
    steps: [
      { text: { tr: "Kama ağırlığı: duvar yüzü ile kayma düzlemi arasındaki üçgenin alanı ½·H·(H·cot ρ) alınır.", en: "Wedge weight: the triangle between the wall face and the slip plane has area ½·H·(H·cot ρ)." }, expr: "W = ½ · γ · H² · cot ρ" },
      { text: { tr: "Kuvvet çokgeni: W düşeydir; R, düzlem normalinden φ, P duvar normalinden δ sapar. Sinüs teoremi ile P bulunur.", en: "Force polygon: W is vertical; R deviates from the plane normal by φ and P deviates from the wall normal by δ. P is found with the sine rule." }, expr: "P = W · sin(ρ − φ) / cos(ρ − φ − δ)" },
      { text: { tr: "P'yi ½·γ·H² cinsinden boyutsuz yazın; bu, kayma düzlemine bağlı bir K(ρ) verir.", en: "Write P in dimensionless form in terms of ½·γ·H²; this gives a K(ρ) that depends on the slip plane." }, expr: "K(ρ) = cot ρ · sin(ρ − φ) / cos(ρ − φ − δ)" },
      { text: { tr: "En kötü durum en büyük itkidir. Kritik ρ için dK/dρ = 0 alınır ve Ka = K(ρ_kritik) olur. Sayısal örnekte φ = 30°, δ = 20° için ρ_kritik ≈ 56° çıkar.", en: "The worst case is the largest thrust. dK/dρ = 0 is taken at the critical ρ, and Ka = K(ρ_critical). In the numerical example, for φ = 30° and δ = 20°, ρ_critical ≈ 56° is found." }, expr: "Ka = max over ρ of K(ρ)" },
      { text: { tr: "Türev alınıp sadeleştirildikten sonra (β = 0, θ = 0) kapalı form elde edilir (Coulomb 1776; Das, Ch. 7). Kontrol: δ = 0 koyulunca Ka = tan²(45° − φ/2), yani Rankine çıkar.", en: "After differentiating and simplifying (β = 0, θ = 0) a closed form is obtained (Coulomb 1776; Das, Ch. 7). Check: when δ = 0 is substituted, Ka = tan²(45° − φ/2), which is the Rankine value." }, expr: "Ka = cos²φ / [cos δ · (1 + √(sin(φ+δ) · sin φ / cos δ))²]" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Ka, zeminin ne kadar itki yaptığını gösteren boyutsuz bir katsayıdır; toplam itki Pa = ½·γ·H²·Ka kN/m'dir ve bu itki H/3 yüksekliğine yaklaşık olarak uygulanır. Ka arttıkça itki büyür, φ arttıkça Ka azalır. Duvar sürtünmesi δ arttıkça da Ka azalır, çünkü duvar yüzündeki sürtünme kamanın bir kısmını tutar. φ = 30° için δ = 0'da Ka = 0.333 (Rankine), δ = 20°'de Ka = 0.297 bulunur. Bu sayılar programın doğrulama çağrısıyla da eşleşir: aynı girdiyle δ = 0 koyunca program 48.00 kN/m verir. Figure ep-ka-phi bu ilişkiyi φ'ye karşı gösterir. Aynı şekilde sükûnet basıncı katsayısı K0 = 1 − sin φ (Jaky) ve pasif katsayı Kp da φ ile değişir; K0, duvarın hiç hareket etmediği durumdur ve Ka'dan büyüktür.", en: "Ka is a dimensionless coefficient that shows how much thrust the soil exerts. The total thrust is Pa = ½·γ·H²·Ka kN/m, and it acts at approximately H/3 height. As Ka increases the thrust grows; as φ increases Ka decreases. As the wall friction δ increases, Ka also decreases, because friction on the wall face holds back part of the wedge. For φ = 30°, Ka = 0.333 at δ = 0 (Rankine) and Ka = 0.297 at δ = 20°. These numbers also agree with the program's verification run: with δ = 0 the program gives 48.00 kN/m for the same input. Figure ep-ka-phi shows this relation against φ. Similarly, the at-rest coefficient K0 = 1 − sin φ (Jaky) and the passive coefficient Kp vary with φ; K0 applies when the wall does not move at all and is larger than Ka.",
    },
  },
  {
    type: "figure",
    id: "ep-ka-phi",
    caption: {
      tr: "K_a, K₀ ve K_p'nin φ′ ile değişimi: φ′ = 30° için K_a = 0,33, K₀ = 0,50, K_p = 3,00.",
      en: "K_a, K₀ and K_p versus φ′: for φ′ = 30°, K_a = 0.33, K₀ = 0.50, K_p = 3.00.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Rankine ve Coulomb arasındaki seçim, duvar yüzünün ve sürtünmenin durumuna bağlıdır. Rankine, düşey ve pürüzsüz bir yüz (δ = 0) ile yatay ya da β ≤ φ eğimli dolgu için kullanılabilir; yatay itkiyi genellikle biraz büyük verdiği için muhafazakârdır. Ancak sürtünmenin oluşturduğu düşey bileşeni hesaba katmadığı için devrilme ve taban basıncı kontrollerinde bu bileşenin katkısını göstermez. Coulomb ise gerçek duvar sürtünmesini (tipik olarak δ ≈ 2/3·φ) ve eğimli yüzü kullanır, ama δ yanlış seçilirse sonuç tehlikeli yönde kayabilir. Programda gravite duvarları Coulomb kama yöntemiyle, varsayılan δ = 2/3·φ ile hesaplanır. Konsol duvarlarda ise topuk ucundan düşey 'sanal arka yüz' çizilir ve δ = β alınır; bu, eğimli dolgu için Rankine eşdeğeridir. Dolayısıyla iki modül aynı zemin için farklı itki verebilir. Bu, hata değil bilinçli bir modelleme seçimidir ve sonuç raporunda belirtilmelidir.", en: "The choice between Rankine and Coulomb depends on the wall face and the friction. Rankine can be used for a vertical smooth face (δ = 0) with horizontal or sloping backfill with β ≤ φ; it is conservative because it usually gives a slightly larger horizontal thrust. However, since it does not include the vertical component produced by friction, it does not show that component's contribution in the overturning and base pressure checks. Coulomb uses the real wall friction (typically δ ≈ 2/3·φ) and the inclined face, but if δ is chosen wrongly the result can deviate in the unsafe direction. In the program, gravity walls are computed with the Coulomb wedge method and the default δ = 2/3·φ. For cantilever walls, a vertical 'virtual back face' is drawn from the heel tip and δ = β is taken; this is equivalent to Rankine for sloping backfill. Therefore the two modules can give different thrusts for the same soil. This is not an error but a deliberate modelling choice, and it must be stated in the result report.",
    },
  },
  { type: "h", text: { tr: "8) Eğimli dolgu ve sayısal kama / log-spiral yöntemi", en: "8) Sloping backfill and the numerical wedge / log-spiral methods" } },
  {
    type: "p",
    text: {
      tr: "Dolgu yüzeyi yataydan β kadar eğikse, zemin yüzeyine paralel bir itki oluşur ve Rankine katsayısı K_a = cos β · (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ)) biçimini alır. Bu formül yalnızca β ≤ φ için tanımlıdır; β > φ ise kayma yüzeyi zemin içinde oluşamaz ve denge yoktur. Yatay itki K_a·cos β·½·γ·H² bileşenidir. Eğimli dolgunun fiziksel sezgisi basittir: yüzey eğildikçe kamanın ağırlığı artar, dolayısıyla duvara daha fazla itki gelir. Eğim φ'ye yaklaştıkça bu artış hızlanır, çünkü kama neredeyse kendi kendini tutamaz hale gelir.", en: "If the backfill surface is inclined at β from the horizontal, a thrust parallel to the ground surface develops and the Rankine coefficient takes the form K_a = cos β · (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ)). This formula is defined only for β ≤ φ; if β > φ the slip surface cannot form in the soil and there is no equilibrium. The horizontal thrust is the component K_a·cos β·½·γ·H². The physical intuition for a sloping backfill is simple: as the surface tilts, the weight of the wedge increases and more thrust reaches the wall. As the slope approaches φ this increase accelerates, because the wedge becomes almost unable to hold itself.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kapalı formlar her kombinasyona uzanmaz. Bir duvarda aynı anda eğimli dolgu, eğik arka yüz (θ), yüzey sürşarjı (q) ve deprem varsa, her etkinin formülü ayrı ayrı bilinse bile bunları birleştiren tek bir kapalı form zahmetli ve hataya açıktır. Üstelik Mononobe-Okabe çözümü φ − β − ψ < 0 olduğunda hiç çözüm vermez (bölüm 9). Bu nedenle programda trial_wedge adlı sayısal bir yöntem kullanılır (geotek/engine/earth_pressure/wedge.py). Yöntem şöyle işler: topuk orijinde seçilir, verilen her ρ için kama alanı ve kama ağırlığı W = γ·alan + q·(kama üstü yatay uzunluk) hesaplanır, kuvvet dengesi çözülüp P(ρ) elde edilir. ρ açısı 720 eşit aralıklı nokta üzerinde taranır, en büyük P değeri yakın bir aralıkta sınırlı bir skaler optimizasyonla (minimize_scalar) iyileştirilir. Kabul edilemeyen kamalar (R < 0 veya kayma düzlemi duvarın dışına çıkıyorsa) atılır. Sonuç K = P / (½·γ·H²·(1 − kv)) biçiminde döner ve kapalı formlarla aynı sayıya yaklaşır (öz-sınama farkı yaklaşık %0.01).", en: "Closed forms do not extend to every combination. When a wall has a sloping backfill, an inclined back face (θ), a surface surcharge (q) and an earthquake all at once, a single closed form combining the formula for each effect, even when each one is known separately, is cumbersome and error-prone. Moreover, the Mononobe-Okabe solution gives no solution at all when φ − β − ψ < 0 (section 9). For this reason the program uses a numerical method called trial_wedge (geotek/engine/earth_pressure/wedge.py). The method works as follows: the heel is placed at the origin; for each given ρ the wedge area and wedge weight W = γ·area + q·(horizontal length of the wedge top) are calculated, and the force equilibrium is solved to obtain P(ρ). The angle ρ is scanned over 720 equally spaced points, and the largest P value is refined in a nearby interval by a bounded scalar optimisation (minimize_scalar). Unacceptable wedges (R < 0, or a slip plane leaving the wall) are discarded. The result is returned as K = P / (½·γ·H²·(1 − kv)) and approaches the same number as the closed forms (self-check difference about 0.01%).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sürşarj dikkatle yorumlanmalıdır. Eğimli bir yüzeyde q birimi, yüzey alanı başına düşey yük ise yatay izdüşüm başına değeri q / cos β olur (surcharge_per_horizontal, basis='inclined'). Yanlış birim seçimi itkiyi yaklaşık cos β oranında hatalı verir. Log-spiral yöntemi (geotek/engine/earth_pressure/log_spiral.py) ise yalnızca pasif direnç içindir. Terzaghi'nin logaritmik spiral kayma yüzeyini kullanır: yüzey topuktan başlayıp zemin yüzeyindeki bir kutup O etrafında döner ve momentlerin dengesinden en küçük pasif kuvvet bulunur. Düz kayma düzlemi kullanan Rankine ya da Coulomb pasif formüllerinde δ büyük olduğunda pasif direnç aşırı büyük çıkar; coulomb_kp fonksiyonu da δ > φ/2 için bunu açıkça uyarır. Log-spiral bu hatayı azaltır. Yöntemin sınırı, dik duvar ve yatay zemin varsayımıdır; sonuç Kp, H ve γ'dan bağımsızdır ve program yalnızca φ ve δ ≤ φ aralığında çalışır.", en: "The surcharge must be interpreted carefully. On an inclined surface, if q is a vertical load per unit surface area, its value per unit horizontal projection is q / cos β (surcharge_per_horizontal, basis='inclined'). Using the wrong unit gives a thrust that is in error by roughly the factor cos β. The log-spiral method (geotek/engine/earth_pressure/log_spiral.py) is used only for passive resistance. It uses Terzaghi's logarithmic spiral slip surface: the surface starts at the heel and rotates about a pole O on the ground surface, and the smallest passive force is found from moment equilibrium. With the Rankine or Coulomb passive formulas, which use a planar slip plane, the passive resistance becomes excessively large when δ is large; the coulomb_kp function explicitly warns about this for δ > φ/2. The log-spiral reduces this error. The limit of the method is the vertical wall and horizontal ground assumption; the result Kp is independent of H and γ, and the program works only for φ and δ ≤ φ.",
    },
  },
  
  { type: "h", text: { tr: "9) Deprem: yalancı-statik yaklaşım", en: "9) Earthquake: the pseudo-static approach" } },
  {
    type: "p",
    text: {
      tr: "Yalancı-statik yaklaşım, depremin zamanla değişen ivmesini sabit bir yatay ve düşey atalet kuvveti olarak temsil eder. Yatay katsayı kh (g'nin oranı, boyutsuz) kamanın ağırlığı W ile çarpılıp kh·W kadar bir kuvvet olarak, düşey katsayı kv ise ağırlığı (1 − kv)·W'ye indirgeyerek eklenir. Örneğin kh = 0.2 demek, deprem anında kamanın ağırlığının yüzde yirmisi kadar ek yatay kuvvet olması demektir. Bu kuvvetlerin bileşkesi ψ = atan(kh / (1 − kv)) kadar bir açıyla eğik yönde etki eder; ψ'ye sismik açı denir (seismic_angle). Yaklaşımın gücü, çözümü tek bir statik problem gibi yapabilmesidir; zayıflığı ise deprem titreşiminin gerçek zamandaki dinamiğini ve sönümü yok saymasıdır.", en: "The pseudo-static approach represents the time-varying acceleration of the earthquake as a constant horizontal and vertical inertia force. The horizontal coefficient kh (a dimensionless ratio to g) is multiplied by the wedge weight W, giving a force kh·W, while the vertical coefficient kv reduces the weight to (1 − kv)·W. For example, kh = 0.2 means that at the moment of the earthquake there is an additional horizontal force equal to twenty percent of the wedge's weight. The resultant of these forces acts at an angle ψ = atan(kh / (1 − kv)) from the vertical; ψ is called the seismic angle (seismic_angle). The strength of the approach is that it reduces the problem to a single static problem; its weakness is that it ignores the real-time dynamics and damping of the earthquake vibration.",
    },
  },
  {
    type: "formula",
    expr: "K_AE = cos²(φ − θ − ψ) / [cos ψ · cos²θ · cos(δ + θ + ψ) · (1 + √(sin(φ+δ)·sin(φ − β − ψ) / (cos(δ+θ+ψ)·cos(θ−β))))²]",
    caption: { tr: "Mononobe-Okabe aktif katsayısı (kodda mononobe_okabe_kae)", en: "Mononobe-Okabe active coefficient" },
    where: [
      { tr: "P_AE = ½·γ·H²·(1 − kv)·K_AE: toplam dinamik itki [kN/m]; ψ = atan(kh/(1 − kv))", en: "P_AE = ½·γ·H²·(1 − kv)·K_AE: total dynamic thrust [kN/m]; ψ = atan(kh/(1 − kv))" },
      { tr: "Çözüm varlığı için φ − β − ψ ≥ 0 gerekir; aksi halde kod SlopeError ile durur.", en: "A solution exists only if φ − β − ψ ≥ 0; otherwise the code stops with a SlopeError." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Mononobe-Okabe (M-O) çözümü Coulomb'un deprem uyarlamasıdır. Kama ağırlığı (1 − kv) ile azaltılır, ψ açısı kadar kayma yönü eğilir. Çözüm, dinamik itkinin statik itkiyle farkı olan ΔK_AE = K_AE − K_A üzerinden okunur: deprem artışı ΔP_AE = P_AE − P_A kN/m'dir. Çoğu pratik çalışmada bu artış Seed ve Whitman (1970) yaklaşımıyla ΔK_AE ≈ 0.75·kh olarak alınır ve yaklaşık 0.6·H yüksekliğinde uygulanır (kodda seismic_increment_height varsayılanı 0.6). Ayrıca, TBDY kurallarında dinamik artışın orta yükseklikte (0.5·H) uygulandığı bölümde yer alır; programda bu oran WallLoads ile ayarlanabilir. Dikkat edilmesi gereken: 0.6·H ve 0.5·H kabulleri farklı devirme momenti verir, bu yüzden yönetmelik ve yaklaşım açıkça belirtilmelidir.", en: "The Mononobe-Okabe (M-O) solution is the seismic adaptation of Coulomb's method. The wedge weight is reduced by (1 − kv) and the sliding direction is tilted by ψ. The solution is read through the seismic increment ΔK_AE = K_AE − K_A, the difference between the dynamic and static coefficients; the seismic increase in thrust is ΔP_AE = P_AE − P_A [kN/m]. In most practical work this increase is taken as ΔK_AE ≈ 0.75·kh following Seed and Whitman (1970) and applied at a height of about 0.6·H (seismic_increment_height, default 0.6 in the code). In addition, the TBDY rules apply the dynamic increase at mid-height (0.5·H); in the program this ratio can be set through WallLoads. Note that the 0.6·H and 0.5·H assumptions give different overturning moments, so the code and approach must be stated explicitly.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Türkiye'de TBDY 2018 yaklaşımı kh ve kv'yi tasarım ivmesinden türetir: kh = 0.4·S_DS / r ve kv = 0.5·kh (TBDY Denk. 16.22; kodda tbdy_seismic_coefficients). r katsayısı, duvarın izin verilen yer değiştirmesine göre seçilir: 120·S_DS mm yer değiştirmeye izin veren yapı için 2.0, 80·S_DS mm için 1.5, hiç yer değiştiremeyen ya da ankrajlı duvar için 1.0 (Tablo 16.7, koddaki açıklamaya göre). Çok büyük r kullanmak kh'yi küçültür ve güvenli olmayan bir sonuç verebilir; r ≤ 1 olması gereken durumlar yönetmelikte ayrıca belirtilmiştir.", en: "In Turkey, the TBDY 2018 approach derives kh and kv from the design acceleration: kh = 0.4·S_DS / r and kv = 0.5·kh (TBDY Eq. 16.22; tbdy_seismic_coefficients in the code). The coefficient r is chosen according to the allowable displacement of the wall: 2.0 for a structure that permits a displacement of 120·S_DS mm, 1.5 for 80·S_DS mm, and 1.0 for a wall that cannot displace at all or an anchored wall (Table 16.7, according to the explanation in the code). Using a very large r reduces kh and may give an unsafe result; the cases in which r ≤ 1 is required are specified separately in the regulation.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Dikkat: β > φ − ψ durumu özeldir. Bu koşulda M-O çözümü yoktur, çünkü kayma düzlemi zemin içinde oluşamaz. Programda bu durumda TBDY Denk. 16.24b (tbdy_kae_steep, EN 1998-5 E.3 ile aynı) kullanılır. Bu formül β'dan bağımsızdır, duvar sürtünmesi δ'yı korur ve β = φ − ψ'de M-O ile süreklidir. Ancak bu formül, sayısal kama yöntemiyle hesaplanan değerden çok farklı sonuç verebilir (G9 incelemesinde B8 olarak işaretlendi); bu yüzden yönetmelik formülü kullanılırken hangi yolun kullanıldığını rapora yazmak gerekir.", en: "Caution: the case β > φ − ψ is special. In this condition the M-O solution does not exist, because the slip plane cannot form within the soil. In the program, TBDY Eq. 16.24b (tbdy_kae_steep, the same as EN 1998-5 E.3) is used in this case. This formula is independent of β, keeps the wall friction δ, and is continuous with M-O at β = φ − ψ. However, it may give results quite different from the value computed by the numerical wedge method (flagged as B8 in the G9 review); therefore the report must state which route was used when the regulation formula is applied.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Pasif direnç de depremde azalır. Pasif tarafında zemin ancak deprem sırasında da yeterince sıkı kalırsa tam direnç verir; yalancı-statik yaklaşımda bu, (1 − kv)·K_PE / K_P oranıyla yapılır ve oran 1'i aşmaz (seismic_passive_ratio). Bu azaltmanın yapılmaması, G9 incelemesinde B3 olarak yüksek öncelikli bir hata olarak bulunmuştur ve düzeltilmiştir. Yalancı-statik yaklaşımın sınırları şunlardır: sismik yer değiştirme (duvarın kalıcı kayması) hesaplanmaz; zeminin sıvılaşması ayrı bir kontrol gerektirir; kh ve kv'nin seçimi yerel tehlike analizine dayanmalıdır ve doğrudan programın içinden gelmez.", en: "Passive resistance also decreases during an earthquake. On the passive side the soil gives full resistance only if it remains sufficiently dense during the earthquake; in the pseudo-static approach this is done with the ratio (1 − kv)·K_PE / K_P, which does not exceed 1 (seismic_passive_ratio). Failing to apply this reduction was found as a high-priority error (B3) in the G9 review, and it has been corrected. The limits of the pseudo-static approach are as follows: the seismic displacement (permanent sliding of the wall) is not calculated; liquefaction of the soil requires a separate check; and the choice of kh and kv must be based on a local hazard analysis and does not come directly from the program.",
    },
  },
  {
    type: "figure",
    id: "ep-seismic-wedge",
    caption: {
      tr: "Depremli Coulomb kaması: ağırlık W'ya yatay k_h·W eklenir ve kuvvet üçgeni buna göre değişir (R = 0,88 W, P_AE = 0,68 W; k_h = 0,20).",
      en: "Coulomb wedge with earthquake: the horizontal force k_h·W is added to the weight W and the force triangle changes accordingly (R = 0.88 W, P_AE = 0.68 W; k_h = 0.20).",
    },
  },
  { type: "h", text: { tr: "10) İstinat duvarı kontrolleri", en: "10) Retaining wall checks" } },
  {
    type: "p",
    text: {
      tr: "Güvenlik sayısı (FS), bir kontrolde toplam direncin toplam sürücü kuvvete (ya da momente) oranıdır. FS = 1.0 limit denge, FS > 1.0 güvenlik payıdır. Programda ASD (izin verilen gerilme) yaklaşımı kullanılır ve statik durum için gerekli değerler şöyledir: devrilme 2.0, kayma 1.5, taşıma 3.0, eksantrisite e/B ≤ 1/6. Bu değerler program çıktılarında 'gerekli' olarak yazılır; kendiniz kontrol edin. FS birimsizdir; momentler kNm/m, kuvvetler kN/m cinsindedir. Bir FS'nin 'geçmesi' kontrolün gerekli değeri aşması demektir; geçmemesi tasarımı değiştirmeniz gerektiği anlamına gelir.", en: "The factor of safety (FS) is the ratio of total resistance to total driving force (or moment) in a check. FS = 1.0 is limit equilibrium and FS > 1.0 is a safety margin. The program uses the ASD (allowable stress design) approach, and the required values for the static case are: overturning 2.0, sliding 1.5, bearing 3.0 and eccentricity e/B ≤ 1/6. These values are written as 'required' in the program output; check them yourself. FS is dimensionless; moments are in kNm/m and forces in kN/m. A check 'passing' means the computed value exceeds the required value; failing means the design must be changed.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kuvvet ve moment kollarını doğru yazmak kontrollerin çoğunun anahtarıdır. Program tüm momentleri ön-taban noktasına (origin) göre alır: moment = x·F_y − y·F_x (saat yönünün tersi pozitif). Duvar ağırlığı W, kesit ağırlık merkezinde (örneğimizde x = 1.25 m) etkir. Aktif itkinin yatay bileşeni yaklaşık H/3 yüksekliğinde etkir ve devrilme yaratır. Aktif itkinin düşey bileşeni (δ ile eğik) ise arka yüzde, topuk ucunda (x = B) etkir; aşağı yönlü olduğu için hem düşey yükü artırır hem de devrilmeye karşı moment katar. Bu katkıyı atlamak, devrilme FS'sini ve taban basıncını yanlış hesaplamanın en yaygın nedenlerinden biridir.", en: "Writing the force and moment arms correctly is the key to most of the checks. The program takes all moments about the front-base point (origin): moment = x·F_y − y·F_x (counterclockwise positive). The wall weight W acts at the centroid of the section (x = 1.25 m in our example). The horizontal component of the active thrust acts at about H/3 height and creates overturning. The vertical component of the active thrust (inclined by δ) acts on the back face at the heel tip (x = B); since it is directed downward, it both increases the vertical load and adds a moment that resists overturning. Omitting this contribution is one of the most common causes of miscalculating the overturning FS and the base pressure.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Devrilme kontrolünde M_O = Σ(yatay itki × yükseklik) ve M_R = Σ(düşey kuvvet × kol) alınır; FS_devrilme = M_R / M_O'dır. Kayma kontrolünde direnç R = ΣV·tan δ_b + c_a·B' (δ_b taban-zemin sürtünme açısı, varsayılan φ; c_a taban yapışması, B' efektif taban) ve FS_kayma = R / ΣH'dır. Pasif direnç varsayılanda kapalıdır (use_passive = False). Açıksa yalnızca azaltılmış (passive_reduction = 0.5) değeri alınır, çünkü pasif direnç zemin hareket ettiğinde oluşur; ön zemin kazılabilir, yıkanabilir veya gelecekte kaldırılabilir. Bu belirsizlik nedeniyle ön pasifin güvenilir bir kaynak olarak sayılması ancak saha koşullarıyla desteklenmelidir.", en: "In the overturning check M_O = Σ(horizontal thrust × height) and M_R = Σ(vertical force × arm) are taken, and FS_overturning = M_R / M_O. In the sliding check the resistance is R = ΣV·tan δ_b + c_a·B' (δ_b the base-soil friction angle, default φ; c_a the base adhesion; B' the effective base), and FS_sliding = R / ΣH. Passive resistance is off by default (use_passive = False). If it is on, only the reduced value (passive_reduction = 0.5) is used, because passive resistance develops only when the soil moves; the front soil may be excavated, washed away or removed in the future. Because of this uncertainty, counting the front passive resistance as a reliable source should only be done when it is supported by site conditions.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Eksantrisite ve taban basıncı, bileşke kuvvetin tabana nerede etki ettiğini söyler. x_r = (M_R − M_O) / ΣV ile bileşke tabanı ön-taban noktasından x_r'de keser; e = B/2 − x_r eksantrisitedir. |e| ≤ B/6 ise (orta üçte bir) taban boyunca basınç pozitiftir ve yamuk dağılım verilir: q_max = (ΣV/B)·(1 + 6e/B), q_min = (ΣV/B)·(1 − 6e/B). |e| > B/6 olduğunda taban kısmen çekmeye girer; bu durumda gerçek davranış değişir ve program q_max = 2ΣV / (3(B/2 − |e|)), q_min = 0 kullanır. Eksantrisite sınırı e/B ≤ 1/6 bu nedenle önemlidir; geçmiyorsa temel boyutunu değiştirmek gerekir.", en: "Eccentricity and base pressure tell us where the resultant force acts on the base. x_r = (M_R − M_O) / ΣV locates the resultant on the base measured from the front-base point; e = B/2 − x_r is the eccentricity. When |e| ≤ B/6 (middle third) the pressure along the base is positive and a trapezoidal distribution results: q_max = (ΣV/B)·(1 + 6e/B) and q_min = (ΣV/B)·(1 − 6e/B). When |e| > B/6 the base partly goes into tension; in this case the real behaviour changes and the program uses q_max = 2ΣV / (3(B/2 − |e|)) and q_min = 0. The eccentricity limit e/B ≤ 1/6 is therefore important; if it is not met, the footing dimension must be changed.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Taşıma gücü kontrolü, tabanın yükü güvenle taşıyıp taşıyamayacağını sorar. Program Vesic yöntemini (bearing_method varsayılanı) kullanır: q_ult = c·N_c·s·d·i + q·N_q·s·d·i + ½·γ·B'·N_γ·s·d·i. Burada B' = B − 2e efektif genişlik, N_c, N_q, N_γ taşıma faktörleri ve i eğik yük (H/V) düzeltmesidir. Şerit temel için şekil faktörleri 1'dir. Vesic için N_q = e^(π·tan φ)·tan²(45° + φ/2), N_c = (N_q − 1)/tan φ ve N_γ = 2·(N_q + 1)·tan φ; eğim faktörleri iq = (1 − H/V)^m ve iγ = (1 − H/V)^(m+1) (şerit için m = 2) olarak alınır. FS_taşıma = Q_ult / ΣV = (q_ult·B') / ΣV'dir. Zemin birim ağırlığı γ taban zemini için verilmelidir; verilmezse seçimi raporda açıkça yazılmalıdır.", en: "The bearing capacity check asks whether the base can carry the load safely. The program uses the Vesic method (default bearing_method): q_ult = c·N_c·s·d·i + q·N_q·s·d·i + ½·γ·B'·N_γ·s·d·i. Here B' = B − 2e is the effective width, N_c, N_q and N_γ are the bearing factors, and i is the inclined load (H/V) correction. For a strip footing the shape factors are 1. For Vesic, N_q = e^(π·tan φ)·tan²(45° + φ/2), N_c = (N_q − 1)/tan φ and N_γ = 2·(N_q + 1)·tan φ; the inclination factors are taken as iq = (1 − H/V)^m and iγ = (1 − H/V)^(m+1) (m = 2 for a strip). FS_bearing = Q_ult / ΣV = (q_ult·B') / ΣV. The unit weight γ of the base soil must be given; if it is not, the choice must be stated clearly in the report.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Global stabilite, duvar ve dolgu birlikte bir Bishop dairesel kayma yüzeyi boyunca kayabilir mi sorusunu sorar. Program (geotek/engine/walls/global_stability.py) duvar ve üzerindeki zemin ağırlığını temel genişliği üzerinde doğrusal bir taban basıncı olarak temsil eder; dolgu da kayan kütlenin bir parçasıdır ve dairesel yüzey tabanın altından geçmek zorundadır. Bu bir yaklaşımdır ve yalnızca temel altı kayma yüzeylerini tarar; kayma yüzeyinin duvarın içinden geçmesi gibi durumlar bu modelin dışındadır. Dolayısıyla bu kontrol, dış stabilite kontrollerinin yerine değil, onların yanında yorumlanmalıdır.", en: "Global stability asks whether the wall and the backfill together can slide along a circular Bishop slip surface. The program (geotek/engine/walls/global_stability.py) represents the wall and the soil weight above it as a linear base pressure across the footing width; the backfill is also part of the sliding mass, and the circular surface must pass beneath the base. This is an approximation that scans only slip surfaces below the footing; cases such as a slip surface passing through the wall are outside this model. This check must therefore be interpreted alongside the external stability checks, not in place of them.",
    },
  },
  {
    type: "figure",
    id: "wall-stability-checks",
    caption: {
      tr: "Gravite duvarının üç temel kontrolü: devrilme (FS = ΣM_R / ΣM_O), kayma (FS = ΣV·tan δ_b / ΣH) ve taban basıncı (q = ΣV/B·(1 ± 6e/B)).",
      en: "The three basic checks of a gravity wall: overturning (FS = ΣM_R / ΣM_O), sliding (FS = ΣV·tan δ_b / ΣH) and base pressure (q = ΣV/B·(1 ± 6e/B)).",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: gravite istinat duvarı dış stabilite kontrolü", en: "Example 3: gravity retaining wall external stability" },
    given: [
      { tr: "Duvar: H = 4 m, taban B = 2.5 m, üst genişlik 2.5 m, arka yüz düşey (geri çekme 0). Kesit dikdörtgen 2.5 × 4 m; basitleştirilmiş, yalnızca öğretim için.", en: "Wall: H = 4 m, base B = 2.5 m, top width 2.5 m, back face vertical (setback 0). The section is a 2.5 × 4 m rectangle; it is simplified and for teaching only." },
      { tr: "Beton γc = 24 kN/m³. Arka dolgu: γ = 18 kN/m³, φ = 30°, c = 0, q = 0, yatay (β = 0), duvar-zemin sürtünmesi δ = 20°.", en: "Concrete γc = 24 kN/m³. Backfill: γ = 18 kN/m³, φ = 30°, c = 0, q = 0, horizontal (β = 0), wall-soil friction δ = 20°." },
      { tr: "Taban zemini: φ_b = 30°, c_b = 0. Taban birim ağırlığı verilmediği için γ_taban = 18 kN/m³ varsayılmıştır (taşıma terimi buna bağlıdır).", en: "Base soil: φ_b = 30°, c_b = 0. Since no base unit weight was given, γ_base = 18 kN/m³ is assumed (the bearing term depends on it)." },
      { tr: "Ön pasif yok, su yok, deprem yok. Derinlik D = 0.", en: "No front passive resistance, no water, no earthquake. Embedment depth D = 0." },
    ],
    steps: [
      { label: { tr: "Duvar ağırlığı", en: "Wall weight" }, expr: "W = γc·B·H = 24 · 2.5 · 4", result: "240.00 kN/m; x = 1.25 m, y = 2.00 m" },
      { label: { tr: "Rankine Ka (δ = 0, düşey yüz)", en: "Rankine Ka (δ = 0, vertical face)" }, expr: "Ka = tan²(45° − φ/2) = tan²(30°) = 1/3", result: "0.3333" },
      { label: { tr: "Rankine itki", en: "Rankine thrust" }, expr: "Pa = ½·γ·H²·Ka = ½ · 18 · 16 · 0.3333", result: "48.00 kN/m, yatay; kol H/3 = 1.333 m" },
      { label: { tr: "Coulomb Ka (δ = 20°)", en: "Coulomb Ka (δ = 20°)" }, expr: "Ka = cos²30° / [cos20°·(1 + √(sin50°·sin30° / cos20°))²] = 0.75 / [0.9397 · (1 + 0.6385)²]", result: "0.2973" },
      { label: { tr: "Coulomb itki ve bileşenleri", en: "Coulomb thrust and components" }, expr: "Pa = ½ · 18 · 16 · 0.2973 = 42.81; Pa·cos20° (yatay), Pa·sin20° (düşey, aşağı)", result: "Pa = 42.81 kN/m; yatay 40.23 kN/m (kol 1.333 m); düşey 14.64 kN/m (kol 2.5 m)" },
      { label: { tr: "Devrilme momentleri (ön-taban noktasına göre)", en: "Overturning moments (about the front-base point)" }, expr: "M_O = 40.23 · 4/3;  M_R = 240 · 1.25 + 14.64 · 2.5 = 300.00 + 36.61", result: "M_O = 53.64 kNm/m; M_R = 336.61 kNm/m" },
      { label: { tr: "Devrilme FS", en: "Overturning FS" }, expr: "FS = M_R / M_O = 336.61 / 53.64", result: "6.275 (gerekli 2.0: geçer)" },
      { label: { tr: "Toplam kuvvetler", en: "Total forces" }, expr: "ΣV = 240 + 14.64;  ΣH = 40.23", result: "ΣV = 254.64 kN/m; ΣH = 40.23 kN/m" },
      { label: { tr: "Kayma FS", en: "Sliding FS" }, expr: "R = ΣV · tan 30° = 254.64 · 0.5774 = 147.03;  FS = 147.03 / 40.23", result: "3.654 (gerekli 1.5: geçer)" },
      { label: { tr: "Eksantrisite", en: "Eccentricity" }, expr: "x_r = (M_R − M_O)/ΣV = (336.61 − 53.64) / 254.64;  e = B/2 − x_r", result: "x_r = 1.111 m; e = 0.139 m; e/B = 0.0555 (≤ 1/6 = 0.1667: geçer)" },
      { label: { tr: "Taban basıncı", en: "Base pressure" }, expr: "(ΣV/B) = 254.64 / 2.5 = 101.86;  q_max,min = 101.86 · (1 ± 6·0.139/2.5)", result: "q_max = 135.8 kPa; q_min = 67.9 kPa (ikisi de pozitif: taban tamamen basınçta)" },
      { label: { tr: "Taşıma: efektif genişlik ve faktörler", en: "Bearing: effective width and factors" }, expr: "B' = B − 2e = 2.5 − 0.278 = 2.2225 m; N_q = 18.40, N_c = 30.14, N_γ = 2(N_q+1)tan30° = 22.40; şekil = 1 (şerit); H/V = 40.23/254.64 = 0.158; m = 2; iq = (1 − H/V)² = 0.7090; iγ = (1 − H/V)³ = 0.5970", result: "B' = 2.2225 m; iγ = 0.5970" },
      { label: { tr: "Taşıma kapasitesi", en: "Bearing capacity" }, expr: "q_ult = ½·γ·B'·N_γ·iγ = 0.5 · 18 · 2.2225 · 22.40 · 0.5970 (c = 0, q = 0)", result: "q_ult = 267.5 kPa; Q_ult = 267.5 · 2.2225 = 594.5 kN/m" },
      { label: { tr: "Taşıma FS", en: "Bearing FS" }, expr: "FS = Q_ult / ΣV = 594.5 / 254.64", result: "2.335 (gerekli 3.0: GEÇMEZ)" },
    ],
    program: {
      input: "trial_wedge(H=4, gamma=18, phi=30, delta=20, beta=0, theta=0); analyze_gravity_wall(GravityGeometry(height=4, base_width=2.5, top_width=2.5, back_offset=0), Backfill(gamma=18, phi=30, delta=20, slope=0), FoundationSoil(drainage='drained', phi=30, c=0, gamma=18, overburden=0), WallLoads(), WallSettings(), seismic=False); betik scratchpad'de, repoya yazılmadı",
      output: "trial_wedge: P = 42.813 kN/m, K = 0.29731, ρ_kritik = 55.98°. analyze_gravity_wall: ΣV = 254.643, ΣH = 40.231, M_R = 336.607, M_O = 53.642 kNm/m; devrilme FS = 6.2751 (gerekli 2.0); kayma FS = 3.6543 (gerekli 1.5); e = 0.13877 m, e/B = 0.0555 (gerekli ≤ 0.1667); q_max = 135.78, q_min = 67.93 kPa; q_ult = 267.50 kPa, Q_ult = 594.50 kN/m, taşıma FS = 2.3347 (gerekli 3.0): BAŞARISIZ. Uyarı listesi boş.",
      note: {
        tr: "Elle ve program aynı: Pa'nın yatay bileşeni (40.23), M_O (53.64), M_R (336.6), FS'ler, e ve q değerleri, q_ult ve Q_ult. Fark nedeni: elle 'Rankine' Pa = 48.00 kN/m (δ = 0) ile programın Coulomb-kama Pa'sı (δ = 20°, 42.81 kN/m) farklıdır. Program bunu bilinçli olarak yapar: gravite duvarı için δ = 2/3·φ = 20° varsayılanı vardır. Pa'nın düşey bileşeni (14.64 kN/m aşağı) hem ΣV'yi hem de M_R'yi artırır. Bu nedenle devrilme FS elle Rankine ile 4.69'dan (64.0 ve 300.0 kNm/m), programda 6.275'e çıkar. Doğrulama: programda δ = 0 koyulduğunda Pa tam olarak 48.00 kN/m verir; o durumda kayma FS 2.89, devrilme 4.69, e = 0.267 m (e/B = 0.107), taşıma FS 1.66 bulunur. Sonuç: taşıma kontrolü her iki durumda da geçmez; taban genişliği, taban zemini veya taşıma kapasitesi yeniden hesaplanmalıdır. Bu bir tasarım önerisi değil, sonucun yorumudur; B değişikliği bu örnekte hesaplanmadı.", en: "Hand and program agree: the horizontal component of Pa (40.23), M_O (53.64), M_R (336.6), the FS values, e and q values, q_ult and Q_ult. The difference comes from the hand Rankine value Pa = 48.00 kN/m (δ = 0) being different from the program's Coulomb wedge Pa (δ = 20°, 42.81 kN/m). The program does this deliberately: the default δ = 2/3·φ = 20° applies to gravity walls. The vertical component of Pa (14.64 kN/m downward) increases both ΣV and M_R, so the overturning FS rises from 4.69 (hand Rankine, 64.0 and 300.0 kNm/m) to 6.275 in the program. Check: when δ = 0 is set in the program, Pa comes out exactly as 48.00 kN/m; in that case the sliding FS is 2.89, the overturning FS 4.69, e = 0.267 m (e/B = 0.107) and the bearing FS 1.66. Conclusion: the bearing check fails in both cases, so the base width, base soil or bearing capacity must be recalculated. This is an interpretation of the result, not a design proposal; changes to B were not calculated in this example.",
      },
    },
  },
  { type: "p", text: { tr: "Bu örnekte iki mesaj vardır. Birincisi: Coulomb ile Rankine arasındaki fark modelleme seçimidir ve sonucu değiştirir; hangisinin kullanıldığı raporda yazılmalıdır. İkincisi: devrilme ve kayma kontrollerinin geçmesi taşıma kontrolünün geçeceği anlamına gelmez. Bu örnekte taşıma FS 2.33, 3.0 değerinin altındadır.", en: "This example carries two messages. The first is that the difference between Coulomb and Rankine is a modelling choice that changes the result; which one was used must be written in the report. The second is that passing the overturning and sliding checks does not mean the bearing check will pass. In this example the bearing FS is 2.33, below the required value of 3.0." } },
  { type: "h", text: { tr: "11) Programın sınırları ve dikkat noktaları", en: "11) Program limits and points of caution" } },
  {
    type: "p",
    text: {
      tr: "Kayma dişi (shear key) en önemli dikkat noktasıdır. G9 mühendislik incelemesinin B1 bulgusu (kritik, düzeltildi): diş ucundan geçen yatay kayma düzlemi, kayan bloğun tabanını diş tabanına kadar uzatır. Arka taraftaki zemin bu bloğu diş tabanına kadar iter. Eski sürümde bu itki taban seviyesinde kesiliyordu ve bu her durumda tutucu değildi. Örnek duvarda (H = 6 m, topukta 0.5 × 0.6 m diş, φ = 30°) ek itki K_a·(118·0.6 + ½·18·0.6²) = 24.68 kN/m çıktı; diş ucu düzlemi FS'si 2.00'den 1.66'ya ve kayma FS'si 1.85'ten 1.66'ya düştü. Düzeltmeyle itki diş derinliği boyunca katman bazında hesaplanır ve sürşarj, deprem artışı ve su etkisi dahil edilir.", en: "The shear key is the most important point of caution. Finding B1 of the G9 engineering review (critical, corrected): the horizontal sliding plane through the key tip extends the base of the sliding block down to the key base, and the backfill soil pushes this block down to the key base. In the old version this thrust was cut at base level, which was not conservative in every case. In the sample wall (H = 6 m, a 0.5 × 0.6 m key at the heel, φ = 30°) the additional thrust K_a·(118·0.6 + ½·18·0.6²) = 24.68 kN/m appeared; the FS of the key-tip plane fell from 2.00 to 1.66 and the sliding FS from 1.85 to 1.66. With the correction the thrust is computed layer by layer along the key depth, and the surcharge, the seismic increment and the water effect are included.",
    },
  },
  {
    type: "figure",
    id: "ep-wall-forces",
    caption: {
      tr: "Örnek gravite duvarı (2,5 × 4 m, γc = 24): W = 240 kN/m, P_a = 48 kN/m. M_R = 300, M_O = 64 kN·m/m, devrilme FS = 4,69.",
      en: "Example gravity wall (2.5 × 4 m, γc = 24): W = 240 kN/m, P_a = 48 kN/m. M_R = 300, M_O = 64 kN·m/m, overturning FS = 4.69.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sürşarj için iki nokta önemlidir. Birincisi, sürşarjın birimi (horizontal ya da inclined) doğru seçilmelidir; eğimli yüzeyde yanlış birim cos β oranında hata yapar. İkincisi, topuk üzerindeki sürşarjın stabilize edici olup olmadığı WallLoads.surcharge_resists ile belirlenir ve varsayılan olarak sayılmaz. Trafik gibi değişken yükler genellikle direnç olarak alınmaz; bu seçim raporda belirtilmelidir. Yüzey sürşarjı aktif itkiyi K·q·H·cos β·cos θ / cos(θ − β) kadar artırır ve bu artış itkinin H/2 yüksekliğinde uygulandığı kabul edilir.", en: "Two points about the surcharge are important. First, the unit of the surcharge (horizontal or inclined) must be chosen correctly; on an inclined surface a wrong unit gives an error of about cos β. Second, whether the surcharge on the heel is stabilising is determined by WallLoads.surcharge_resists, and by default it is not counted. Variable loads such as traffic are usually not taken as resisting; this choice must be stated in the report. A surface surcharge increases the active thrust by K·q·H·cos β·cos θ / cos(θ − β), and this increase is assumed to act at height H/2.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kısmi katsayılar (Avrupa EC7 ve AASHTO LRFD) limit_state.py dosyasında tanımlıdır ve kendi içinde ayrı bir doğrulama yolu sunar. Ancak walls/base.py içindeki evaluate_checks yalnızca küresel güvenlik sayısı (ASD) kodlarını kabul eder ve diğerlerinde hata verir. Bu nedenle duvar kontrollerinde hangi yaklaşımın kullanıldığı, programın çıktı başlığında ve kodda ayrıca kontrol edilmelidir. Kısmi katsayılı değerler ASD ile doğrudan karşılaştırılmamalıdır.", en: "Partial factors (European EC7 and AASHTO LRFD) are defined in limit_state.py and provide their own verification path. However, evaluate_checks in walls/base.py accepts only the global factor of safety (ASD) codes and raises an error for the others. Therefore the approach used in the wall checks must be verified in the program output header and in the code. Partial-factor values must not be compared directly with ASD values.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Diğer sınırlar: B8 (G9) β > φ − ψ durumunda kama yöntemi ile yönetmelik formülü arasındaki büyük fark hâlâ bir açık sorudur. B13: drenajsız temel, kayma dişi ve deprem birlikte olduğunda diş bölgesi itkisi hesaplanamadığı için analiz açık bir hatayla durur; bu durumda dişsiz duvar çalışır ama dişin etkisi görülmez. B3 ve B10 düzeltilmiştir, ama sonuçları değiştirdikleri için eski raporları yeniden kontrol edin. Her zaman girdiyi ve varsayımı açıkça yazın: taban γ, δ, c_a, kh, kv, r ve sürşarj birimi. Program bir hesap aracıdır; girdinin doğru olup olmadığını ve mühendislik yargısını yerine koymaz.", en: "Other limits: B8 (G9), the large difference between the wedge method and the regulation formula when β > φ − ψ, is still an open question. B13: when an undrained base, a shear key and an earthquake occur together, the analysis stops with an explicit error because the key-zone thrust cannot be computed; in that case the wall without a key works, but the effect of the key is not seen. B3 and B10 have been corrected, but since they changed the results, re-check old reports. Always state the inputs and assumptions explicitly: base γ, δ, c_a, kh, kv, r and the surcharge unit. The program is a calculation tool; it does not replace checking that the input is correct or the engineering judgement.",
    },
  },
  { type: "h", text: { tr: "Sık yapılan hatalar", en: "Common mistakes" } },
  {
    type: "mistakes",
    items: [
      { tr: "φ'yi derece yerine radyan olarak girmek ya da tan(φ) ile Ka = tan²(45 − φ/2) ifadesini karıştırmak. Ka'nın birimi yoktur ama açıların birimi bellidir; hesap makinesi modunu kontrol edin.", en: "Entering phi in radians, or mixing tan(phi) with Ka = tan²(45 − phi/2). Ka is dimensionless but the angles must be in degrees." },
      { tr: "Aktif itkinin kolunu H/2 almak. Düzgün (üçgen) yayılı basınçta bileşke H/3 yüksekliğindedir; H/2 yalnızca sürşarj dikdörtgen yük için geçerlidir.", en: "Taking the arm as H/2. For a triangular earth pressure the resultant acts at H/3; H/2 applies to a uniform surcharge part." },
      { tr: "δ > 0 iken düşey itki bileşenini (Pa·sin δ) devrilme ve taban basıncı hesabına katmamak. Bu bileşen topukta aşağı yönlüdür ve M_R'yi artırır.", en: "Ignoring the vertical component Pa·sin(delta) in overturning and base pressure. It acts downward at the heel and increases M_R." },
      { tr: "Taşıma kontrolünde q_ult ile FS'yi karıştırmak. FS = Q_ult / ΣV'dir; q_ult (kPa) ile Q_ult (kN/m) farklı birimlerdir ve taban genişliği ile çarpılmalıdır.", en: "Confusing q_ult with FS. FS = Q_ult / sum V, where Q_ult = q_ult times B', in kN/m." },
      { tr: "Eksantrisiteyi işaretsiz kullanmak ya da e = x_r − B/2 gibi ters yazmak. e = B/2 − x_r, ön-taban noktasına göre bileşkenin tabana göre konumudur; işaret tabanın hangi tarafına kaydığını gösterir.", en: "Using eccentricity without sign or reversing it as e = x_r − B/2. The sign shows which side of the base the resultant shifts toward." },
      { tr: "Taban basıncını e > B/6 durumunda da yamuk formülle hesaplamak. Bu durumda taban kısmen çeker; üçgen dağılım ve q_max = 2V/(3(B/2 − |e|)) kullanılmalıdır.", en: "Using the trapezoid formula when e > B/6. Then the base is partly in tension and a triangular distribution is required." },
      { tr: "β > φ − ψ olduğunda Mononobe-Okabe formülünü zorla kullanmak. Bu durumda çözüm yoktur; TBDY 16.24b veya sayısal kama kullanılmalı ve hangi yolun seçildiği yazılmalıdır.", en: "Forcing Mononobe-Okabe when beta > phi − psi. No solution exists there; use TBDY 16.24b or the numerical wedge and state the choice." },
      { tr: "Ön pasifi tam değerle devrilme ve kayma kontrollerine eklemek. Pasif direnç zemin deplasmanı gerektirir ve programda varsayılan olarak kapalı ve azaltılmıştır.", en: "Adding full front passive resistance to sliding and overturning. Passive resistance needs displacement and is off by default and reduced in the program." },
    ],
  },
  { type: "h", text: { tr: "Kendini sına", en: "Self-test" } },
  {
    type: "quiz",
    items: [
      { q: { tr: "φ = 30°, δ = 0 ve düşey pürüzsüz duvar için aktif katsayı Ka kaçtır?", en: "For φ = 30°, δ = 0 and a vertical smooth wall, what is the active coefficient Ka?" }, a: { tr: "Ka = tan²(30°) = 1/3 ≈ 0.333. Bu Rankine değeridir ve Coulomb'un δ = 0 haliyle aynıdır.", en: "Ka = tan²(30°) = 1/3 ≈ 0.333. This is the Rankine value and is the same as Coulomb with δ = 0." } },
      { q: { tr: "H = 5 m, γ = 18 kN/m³, Ka = 0.333 ise toplam Pa kaç kN/m'dir ve kolu nedir?", en: "If H = 5 m, γ = 18 kN/m³ and Ka = 0.333, what are the total Pa in kN/m and its arm?" }, a: { tr: "Pa = ½ · 18 · 25 · 0.333 = 75.0 kN/m; kol H/3 = 1.667 m (tabandan yukarı).", en: "Pa = ½ · 18 · 25 · 0.333 = 75.0 kN/m; the arm is H/3 = 1.667 m above the base." } },
      { q: { tr: "Aynı duvar için δ = 20° (Coulomb) kullanılırsa Pa neden daha küçük çıkar?", en: "For the same wall, if δ = 20° (Coulomb) is used, why is Pa smaller?" }, a: { tr: "Duvar sürtünmesi kamanın bir kısmını tutar ve Ka'yı azaltır (φ = 30° için 0.297). Yatay bileşen ayrıca cos20° ile çarpılır.", en: "Wall friction holds back part of the wedge and reduces Ka (0.297 for φ = 30°). The horizontal component is also multiplied by cos 20°." } },
      { q: { tr: "kh = 0.2 ve kv = 0 için sismik açı ψ kaçtır?", en: "For kh = 0.2 and kv = 0, what is the seismic angle ψ?" }, a: { tr: "ψ = atan(0.2 / 1) = atan(0.2) ≈ 11.31°.", en: "ψ = atan(0.2 / 1) = atan(0.2) ≈ 11.31°." } },
      { q: { tr: "Bir duvarda e/B = 0.10 ise taban basıncı nasıl dağılır?", en: "For a wall with e/B = 0.10, how is the base pressure distributed?" }, a: { tr: "e/B = 0.10 < 1/6 olduğundan bileşke orta üçte birdedir; taban tamamen basınçtadır ve yamuk dağılım verir (q_min > 0).", en: "Since e/B = 0.10 < 1/6, the resultant lies in the middle third; the whole base is in compression and gives a trapezoidal distribution (q_min > 0)." } },
      { q: { tr: "Devrilme FS 2.0'ın altına düşerse hangi değişiklikler düşünülebilir?", en: "If the overturning FS falls below 2.0, which changes can be considered?" }, a: { tr: "Duvar ağırlığını ve kolunu artırmak (taban genişliği, ön-taban kaydı) ya da itkiyi azaltmak (drenaj, dolgu seçimi). Bu bir tasarım yargısıdır; her değişiklik yeniden hesaplanmalıdır.", en: "Increase the wall weight and its arm (base width, front-base offset), or reduce the thrust (drainage, backfill selection). This is a design judgement; every change must be recalculated." } },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Aktif basınç", en: "Active earth pressure" }, def: { tr: "Duvar zeminden uzaklaşırken oluşan, zeminin duvara uyguladığı en küçük yatay itki.", en: "The smallest lateral thrust on a wall that moves away from the soil." } },
      { term: { tr: "Pasif basınç", en: "Passive earth pressure" }, def: { tr: "Duvar zemine doğru itilirken oluşan, zeminin direncinin en büyük değeri.", en: "The largest soil resistance when the wall is pushed into the soil." } },
      { term: { tr: "Sükûnet basıncı K0", en: "At-rest coefficient K0" }, def: { tr: "Duvar hiç hareket etmeden zeminin yatay gerilmesinin düşey gerilmeye oranı (K0 ≈ 1 − sin φ).", en: "Ratio of horizontal to vertical stress when the wall does not move (K0 ≈ 1 − sin phi)." } },
      { term: { tr: "İç sürtünme açısı φ", en: "Friction angle phi" }, def: { tr: "Zeminin kayma direncini veren açı (derece); kum için yüksek, kil için düşük.", en: "Angle giving the shear resistance of the soil, in degrees." } },
      { term: { tr: "Duvar sürtünme açısı δ", en: "Wall friction angle delta" }, def: { tr: "Duvar yüzü ile zemin arasındaki sürtünme açısı; genelde δ ≈ 2/3·φ alınır, pürüzsüz yüz için 0.", en: "Friction angle between the wall face and the soil; often taken as 2/3 phi, zero for a smooth face." } },
      { term: { tr: "Kama", en: "Sliding wedge" }, def: { tr: "Duvar arkasında kayma düzlemi ile duvar yüzü ve zemin yüzeyi arasında kalan üçgen blok.", en: "Triangular soil block between the wall, the failure plane and the ground surface." } },
      { term: { tr: "Kayma düzlemi (ρ)", en: "Failure plane (rho)" }, def: { tr: "Kamanın kopup kaydığı düz yüzey; yatayla yaptığı açı ρ en kötü durum için aranır.", en: "Plane along which the wedge slides; its angle rho to the horizontal is searched for the worst case." } },
      { term: { tr: "Kuvvet çokgeni", en: "Force polygon" }, def: { tr: "Denge halindeki üç kuvvetin (W, R, P) kapalı üçgen oluşturması; sinüs teoremiyle çözülür.", en: "Closed triangle of the three equilibrium forces (W, R, P), solved with the sine rule." } },
      { term: { tr: "Ka, Kp", en: "Ka, Kp" }, def: { tr: "Aktif ve pasif basınç katsayıları; boyutsuz, itki = ½·γ·H²·K biçiminde.", en: "Active and passive coefficients; dimensionless, thrust = ½ gamma H² K." } },
      { term: { tr: "Dolgu eğimi β", en: "Backfill slope beta" }, def: { tr: "Dolgu yüzeyinin yatayla yaptığı açı; Rankine için β ≤ φ.", en: "Angle of the backfill surface to the horizontal; Rankine needs beta ≤ phi." } },
      { term: { tr: "Yalancı-statik yaklaşım", en: "Pseudo-static approach" }, def: { tr: "Deprem etkisini sabit yatay ve düşey atalet kuvvetleri olarak temsil eden basitleştirme.", en: "Represents the earthquake as constant horizontal and vertical inertia forces." } },
      { term: { tr: "Yatay deprem katsayısı kh", en: "Horizontal seismic coefficient kh" }, def: { tr: "Yatay deprem ivmesinin g'ye oranı (boyutsuz); kamanın ağırlığı ile çarpılır.", en: "Horizontal seismic acceleration divided by g (dimensionless)." } },
      { term: { tr: "Sismik açı ψ", en: "Seismic angle psi" }, def: { tr: "ψ = atan(kh / (1 − kv)); deprem bileşkesinin düşeyle yaptığı açı.", en: "psi = atan(kh / (1 − kv)); the angle of the resultant seismic force from vertical." } },
      { term: { tr: "Mononobe-Okabe", en: "Mononobe-Okabe" }, def: { tr: "Deprem sırasında aktif ve pasif basınç için kapalı form; φ − β − ψ ≥ 0 gerektirir.", en: "Closed form for seismic active and passive pressure; requires phi − beta − psi ≥ 0." } },
      { term: { tr: "Sürşarj", en: "Surcharge" }, def: { tr: "Dolgu yüzeyine uygulanan düzgün yayılı düşey yük (kPa); itkiyi artırır.", en: "Uniform vertical load on the backfill surface (kPa); it increases the thrust." } },
      { term: { tr: "Güvenlik sayısı FS", en: "Factor of safety FS" }, def: { tr: "Toplam direncin toplam sürücü kuvvete (ya da momente) oranı; 1.0 limit denge, daha büyük değer güvenlik payıdır.", en: "Ratio of total resistance to total driving action; 1.0 is limit equilibrium." } },
      { term: { tr: "Eksantrisite e", en: "Eccentricity e" }, def: { tr: "Bileşke düşey kuvvetin taban merkezinden uzaklığı; e/B ≤ 1/6 ise taban tamamen basınçtadır.", en: "Distance of the resultant from the base centre; e/B ≤ 1/6 keeps the whole base in compression." } },
      { term: { tr: "Taşıma gücü q_ult", en: "Bearing capacity q_ult" }, def: { tr: "Tabanın taşıyabileceği en büyük basınç (kPa); Vesic, Meyerhof ve Hansen yöntemleri vardır.", en: "Largest bearing pressure the base can carry (kPa); Vesic, Meyerhof and Hansen methods exist." } },
      { term: { tr: "Efektif genişlik B'", en: "Effective width B'" }, def: { tr: "B − 2e; eksantrik yükte taşıma hesabında kullanılan etkin taban genişliği.", en: "B − 2e; the effective width used in bearing capacity with eccentric load." } },
      { term: { tr: "Bishop yöntemi", en: "Bishop method" }, def: { tr: "Dairesel kayma yüzeyini dilimlere bölerek global stabiliteyi hesaplayan yöntem.", en: "Circular slip surface divided into slices to compute global stability." } },
      { term: { tr: "Kayma dişi", en: "Shear key" }, def: { tr: "Taban altına beton ile uzatılmış dişli çıkıntı; kaymaya karşı direnç sağlar. Diş ucu düzlemi ve diş yanı zemin ayrıca kontrol edilir.", en: "Concrete projection under the base that resists sliding; the key tip plane is checked separately." } },
      { term: { tr: "ASD (izin verilen gerilme) yaklaşımı", en: "ASD (allowable stress design)" }, def: { tr: "Kontrolleri global güvenlik sayılarıyla yapan yaklaşım; programın varsayılan duvar yaklaşımıdır.", en: "Approach checking with global factors of safety; the program default for walls." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Das, B.M., Principles of Foundation Engineering (lateral earth pressure ve istinat duvarları bölümleri). Bu oturumda doğrulanmadı; baskı ve bölüm numarası kendi kaynağınızdan kontrol edin.",
      "Craig, R.F., Craig's Soil Mechanics (toprak basıncı ve istinat yapıları). Bu oturumda doğrulanmadı.",
      "Budhu, M., Soil Mechanics and Foundations (istinat duvarları ve Coulomb yaklaşımı). Bu oturumda doğrulanmadı.",
      "Coduto, D.P., Foundation Design: Principles and Practices (istinat duvarı kontrolleri). Bu oturumda doğrulanmadı.",
      "FHWA-NHI-11-032 (GEC-3), sismik toprak basıncı bölümü. Koddaki yorumda Ch. 11 olarak anılır; bölüm numarası ve içerik bu oturumda doğrulanmadı.",
      "TBDY 2018 (Türkiye Bina Deprem Yönetmeliği), istinat yapılarına deprem etkisi (16.12, 16.22, 16.24b). Madde numaraları koddaki açıklamalardan alındı; metin bu oturumda doğrulanmadı.",
    ],
  },
];
