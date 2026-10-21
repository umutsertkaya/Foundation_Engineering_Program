import type { Block } from "./types";

/* Student layer, part B: Coulomb, sloping backfill, seismic earth pressure, wall checks, limits.
   Figure ids (drawn separately): ep-coulomb-wedge, ep-ka-phi, ep-seismic-wedge,
   wall-stability-checks, ep-wall-forces. Worked example numbers: Example 3 (gravity wall). */

export const partB: Block[] = [
  { type: "h", text: { tr: "7) Coulomb teorisi: kama dengesi", en: "7) Coulomb theory: wedge equilibrium" } },
  {
    type: "p",
    text: {
      tr: "Rankine çözümü duvar arkasındaki her noktanın gerilme durumuna bakar ve zemini sonsuz uzun bir yarı-uzay gibi kabul eder; duvar ile zemin arasında sürtünme yoktur. Gerçek bir istinat duvarında ise dolgu, duvarın arkasında üçgen bir blok (kama) halinde kayabilir. Bunu günlük bir benzetmeyle düşünün: bir kum yığınının yanına tahta bir levha koyup levhayı yavaşça ittiğinizde, kum tek bir eğik çizgi boyunca bir üçgen parçası halinde yüzeye çıkar. Bu parçanın eğimi kumun iç sürtünme açısına bağlıdır ve levha ile kum arasındaki sürtünme de parçanın hareketine karşı koyar. Coulomb (1776) bu fikri matematiğe dökmüştür: olası tüm kayma düzlemleri denenir ve duvara binen en büyük itkiyi veren düzlem aranır. Birimler şöyledir: φ iç sürtünme açısı, δ duvar-zemin sürtünme açısı, β dolgu yüzeyinin eğimi, hepsi derecedir. Yöntemin sınırı, kaymanın tek bir düz yüzey boyunca olduğu varsayımıdır; kohezyonlu veya tabakalı zeminlerde kayma yüzeyi eğri olabilir ve bu durumda sonuç farklı çıkar.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kama dengesinde üç kuvvet vardır. W, kamanın kendi ağırlığıdır (kN/m) ve düşey aşağı yönlüdür. R, kayma düzlemi üzerindeki tepkidir; düzlemin normalinden φ kadar sapar, çünkü sürtünme direnci düzlem normaline göre φ açısıyla eğilir. P, duvarın kama üzerindeki destek kuvvetidir (kamanın duvara uyguladığı itkinin tepkisi); duvar yüzünün normalinden δ kadar sapar. Bu üç kuvvet kapalı bir üçgen oluşturmak zorundadır; bu üçgene kuvvet çokgeni denir. W'nin doğrultusu düşeydir, R'nin doğrultusu φ ile, P'nin doğrultusu δ ile belirlenir. Sinüs teoremi uygulanınca kayma düzlemi ρ açısı verildiğinde P bulunur. ρ, kayma düzleminin yatayla yaptığı açıdır ve en kötü durum için aranır. Kama alanı H yüksekliğinde ve düşey yüzlü bir duvar için ½·H²·cot ρ'dir; W = ½·γ·H²·cot ρ kN/m verir (γ birim ağırlık, kN/m³).",
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
      { tr: "P: duvara binen itki [kN/m]; ρ: kayma düzleminin yatayla açısı [°]" },
      { tr: "γ: dolgu birim ağırlığı [kN/m³]; H: duvar yüksekliği [m]; φ, δ: [°]" },
    ],
  },
  {
    type: "derivation",
    title: { tr: "Coulomb aktif katsayısının elde edilişi", en: "Derivation of the Coulomb active coefficient" },
    steps: [
      { text: { tr: "Kama ağırlığı: duvar yüzü ile kayma düzlemi arasındaki üçgenin alanı ½·H·(H·cot ρ) alınır." }, expr: "W = ½ · γ · H² · cot ρ" },
      { text: { tr: "Kuvvet çokgeni: W düşeydir; R, düzlem normalinden φ, P duvar normalinden δ sapar. Sinüs teoremi ile P bulunur." }, expr: "P = W · sin(ρ − φ) / cos(ρ − φ − δ)" },
      { text: { tr: "P'yi ½·γ·H² cinsinden boyutsuz yazın; bu, kayma düzlemine bağlı bir K(ρ) verir." }, expr: "K(ρ) = cot ρ · sin(ρ − φ) / cos(ρ − φ − δ)" },
      { text: { tr: "En kötü durum en büyük itkidir. Kritik ρ için dK/dρ = 0 alınır ve Ka = K(ρ_kritik) olur. Sayısal örnekte φ = 30°, δ = 20° için ρ_kritik ≈ 56° çıkar." }, expr: "Ka = max over ρ of K(ρ)" },
      { text: { tr: "Türev alınıp sadeleştirildikten sonra (β = 0, θ = 0) kapalı form elde edilir (Coulomb 1776; Das, Ch. 7). Kontrol: δ = 0 koyulunca Ka = tan²(45° − φ/2), yani Rankine çıkar." }, expr: "Ka = cos²φ / [cos δ · (1 + √(sin(φ+δ) · sin φ / cos δ))²]" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Ka, zeminin ne kadar itki yaptığını gösteren boyutsuz bir katsayıdır; toplam itki Pa = ½·γ·H²·Ka kN/m'dir ve bu itki H/3 yüksekliğine yaklaşık olarak uygulanır. Ka arttıkça itki büyür, φ arttıkça Ka azalır. Duvar sürtünmesi δ arttıkça da Ka azalır, çünkü duvar yüzündeki sürtünme kamanın bir kısmını tutar. φ = 30° için δ = 0'da Ka = 0.333 (Rankine), δ = 20°'de Ka = 0.297 bulunur. Bu sayılar programın doğrulama çağrısıyla da eşleşir: aynı girdiyle δ = 0 koyunca program 48.00 kN/m verir. Figure ep-ka-phi bu ilişkiyi φ'ye karşı gösterir. Aynı şekilde sükûnet basıncı katsayısı K0 = 1 − sin φ (Jaky) ve pasif katsayı Kp da φ ile değişir; K0, duvarın hiç hareket etmediği durumdur ve Ka'dan büyüktür.",
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
      tr: "Rankine ve Coulomb arasındaki seçim, duvar yüzünün ve sürtünmenin durumuna bağlıdır. Rankine, düşey ve pürüzsüz bir yüz (δ = 0) ile yatay ya da β ≤ φ eğimli dolgu için kullanılabilir; yatay itkiyi genellikle biraz büyük verdiği için muhafazakârdır. Ancak sürtünmenin oluşturduğu düşey bileşeni hesaba katmadığı için devrilme ve taban basıncı kontrollerinde bu bileşenin katkısını göstermez. Coulomb ise gerçek duvar sürtünmesini (tipik olarak δ ≈ 2/3·φ) ve eğimli yüzü kullanır, ama δ yanlış seçilirse sonuç tehlikeli yönde kayabilir. Programda gravite duvarları Coulomb kama yöntemiyle, varsayılan δ = 2/3·φ ile hesaplanır. Konsol duvarlarda ise topuk ucundan düşey 'sanal arka yüz' çizilir ve δ = β alınır; bu, eğimli dolgu için Rankine eşdeğeridir. Dolayısıyla iki modül aynı zemin için farklı itki verebilir. Bu, hata değil bilinçli bir modelleme seçimidir ve sonuç raporunda belirtilmelidir.",
    },
  },
  { type: "h", text: { tr: "8) Eğimli dolgu ve sayısal kama / log-spiral yöntemi", en: "8) Sloping backfill and the numerical wedge / log-spiral methods" } },
  {
    type: "p",
    text: {
      tr: "Dolgu yüzeyi yataydan β kadar eğikse, zemin yüzeyine paralel bir itki oluşur ve Rankine katsayısı K_a = cos β · (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ)) biçimini alır. Bu formül yalnızca β ≤ φ için tanımlıdır; β > φ ise kayma yüzeyi zemin içinde oluşamaz ve denge yoktur. Yatay itki K_a·cos β·½·γ·H² bileşenidir. Eğimli dolgunun fiziksel sezgisi basittir: yüzey eğildikçe kamanın ağırlığı artar, dolayısıyla duvara daha fazla itki gelir. Eğim φ'ye yaklaştıkça bu artış hızlanır, çünkü kama neredeyse kendi kendini tutamaz hale gelir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kapalı formlar her kombinasyona uzanmaz. Bir duvarda aynı anda eğimli dolgu, eğik arka yüz (θ), yüzey sürşarjı (q) ve deprem varsa, her etkinin formülü ayrı ayrı bilinse bile bunları birleştiren tek bir kapalı form zahmetli ve hataya açıktır. Üstelik Mononobe-Okabe çözümü φ − β − ψ < 0 olduğunda hiç çözüm vermez (bölüm 9). Bu nedenle programda trial_wedge adlı sayısal bir yöntem kullanılır (geotek/engine/earth_pressure/wedge.py). Yöntem şöyle işler: topuk orijinde seçilir, verilen her ρ için kama alanı ve kama ağırlığı W = γ·alan + q·(kama üstü yatay uzunluk) hesaplanır, kuvvet dengesi çözülüp P(ρ) elde edilir. ρ açısı 720 eşit aralıklı nokta üzerinde taranır, en büyük P değeri yakın bir aralıkta sınırlı bir skaler optimizasyonla (minimize_scalar) iyileştirilir. Kabul edilemeyen kamalar (R < 0 veya kayma düzlemi duvarın dışına çıkıyorsa) atılır. Sonuç K = P / (½·γ·H²·(1 − kv)) biçiminde döner ve kapalı formlarla aynı sayıya yaklaşır (öz-sınama farkı yaklaşık %0.01).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sürşarj dikkatle yorumlanmalıdır. Eğimli bir yüzeyde q birimi, yüzey alanı başına düşey yük ise yatay izdüşüm başına değeri q / cos β olur (surcharge_per_horizontal, basis='inclined'). Yanlış birim seçimi itkiyi yaklaşık cos β oranında hatalı verir. Log-spiral yöntemi (geotek/engine/earth_pressure/log_spiral.py) ise yalnızca pasif direnç içindir. Terzaghi'nin logaritmik spiral kayma yüzeyini kullanır: yüzey topuktan başlayıp zemin yüzeyindeki bir kutup O etrafında döner ve momentlerin dengesinden en küçük pasif kuvvet bulunur. Düz kayma düzlemi kullanan Rankine ya da Coulomb pasif formüllerinde δ büyük olduğunda pasif direnç aşırı büyük çıkar; coulomb_kp fonksiyonu da δ > φ/2 için bunu açıkça uyarır. Log-spiral bu hatayı azaltır. Yöntemin sınırı, dik duvar ve yatay zemin varsayımıdır; sonuç Kp, H ve γ'dan bağımsızdır ve program yalnızca φ ve δ ≤ φ aralığında çalışır.",
    },
  },
  
  { type: "h", text: { tr: "9) Deprem: yalancı-statik yaklaşım", en: "9) Earthquake: the pseudo-static approach" } },
  {
    type: "p",
    text: {
      tr: "Yalancı-statik yaklaşım, depremin zamanla değişen ivmesini sabit bir yatay ve düşey atalet kuvveti olarak temsil eder. Yatay katsayı kh (g'nin oranı, boyutsuz) kamanın ağırlığı W ile çarpılıp kh·W kadar bir kuvvet olarak, düşey katsayı kv ise ağırlığı (1 − kv)·W'ye indirgeyerek eklenir. Örneğin kh = 0.2 demek, deprem anında kamanın ağırlığının yüzde yirmisi kadar ek yatay kuvvet olması demektir. Bu kuvvetlerin bileşkesi ψ = atan(kh / (1 − kv)) kadar bir açıyla eğik yönde etki eder; ψ'ye sismik açı denir (seismic_angle). Yaklaşımın gücü, çözümü tek bir statik problem gibi yapabilmesidir; zayıflığı ise deprem titreşiminin gerçek zamandaki dinamiğini ve sönümü yok saymasıdır.",
    },
  },
  {
    type: "formula",
    expr: "K_AE = cos²(φ − θ − ψ) / [cos ψ · cos²θ · cos(δ + θ + ψ) · (1 + √(sin(φ+δ)·sin(φ − β − ψ) / (cos(δ+θ+ψ)·cos(θ−β))))²]",
    caption: { tr: "Mononobe-Okabe aktif katsayısı (kodda mononobe_okabe_kae)", en: "Mononobe-Okabe active coefficient" },
    where: [
      { tr: "P_AE = ½·γ·H²·(1 − kv)·K_AE: toplam dinamik itki [kN/m]; ψ = atan(kh/(1 − kv))" },
      { tr: "Çözüm varlığı için φ − β − ψ ≥ 0 gerekir; aksi halde kod SlopeError ile durur." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Mononobe-Okabe (M-O) çözümü Coulomb'un deprem uyarlamasıdır. Kama ağırlığı (1 − kv) ile azaltılır, ψ açısı kadar kayma yönü eğilir. Çözüm, dinamik itkinin statik itkiyle farkı olan ΔK_AE = K_AE − K_A üzerinden okunur: deprem artışı ΔP_AE = P_AE − P_A kN/m'dir. Çoğu pratik çalışmada bu artış Seed ve Whitman (1970) yaklaşımıyla ΔK_AE ≈ 0.75·kh olarak alınır ve yaklaşık 0.6·H yüksekliğinde uygulanır (kodda seismic_increment_height varsayılanı 0.6). Ayrıca, TBDY kurallarında dinamik artışın orta yükseklikte (0.5·H) uygulandığı bölümde yer alır; programda bu oran WallLoads ile ayarlanabilir. Dikkat edilmesi gereken: 0.6·H ve 0.5·H kabulleri farklı devirme momenti verir, bu yüzden yönetmelik ve yaklaşım açıkça belirtilmelidir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Türkiye'de TBDY 2018 yaklaşımı kh ve kv'yi tasarım ivmesinden türetir: kh = 0.4·S_DS / r ve kv = 0.5·kh (TBDY Denk. 16.22; kodda tbdy_seismic_coefficients). r katsayısı, duvarın izin verilen yer değiştirmesine göre seçilir: 120·S_DS mm yer değiştirmeye izin veren yapı için 2.0, 80·S_DS mm için 1.5, hiç yer değiştiremeyen ya da ankrajlı duvar için 1.0 (Tablo 16.7, koddaki açıklamaya göre). Çok büyük r kullanmak kh'yi küçültür ve güvenli olmayan bir sonuç verebilir; r ≤ 1 olması gereken durumlar yönetmelikte ayrıca belirtilmiştir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Dikkat: β > φ − ψ durumu özeldir. Bu koşulda M-O çözümü yoktur, çünkü kayma düzlemi zemin içinde oluşamaz. Programda bu durumda TBDY Denk. 16.24b (tbdy_kae_steep, EN 1998-5 E.3 ile aynı) kullanılır. Bu formül β'dan bağımsızdır, duvar sürtünmesi δ'yı korur ve β = φ − ψ'de M-O ile süreklidir. Ancak bu formül, sayısal kama yöntemiyle hesaplanan değerden çok farklı sonuç verebilir (G9 incelemesinde B8 olarak işaretlendi); bu yüzden yönetmelik formülü kullanılırken hangi yolun kullanıldığını rapora yazmak gerekir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Pasif direnç de depremde azalır. Pasif tarafında zemin ancak deprem sırasında da yeterince sıkı kalırsa tam direnç verir; yalancı-statik yaklaşımda bu, (1 − kv)·K_PE / K_P oranıyla yapılır ve oran 1'i aşmaz (seismic_passive_ratio). Bu azaltmanın yapılmaması, G9 incelemesinde B3 olarak yüksek öncelikli bir hata olarak bulunmuştur ve düzeltilmiştir. Yalancı-statik yaklaşımın sınırları şunlardır: sismik yer değiştirme (duvarın kalıcı kayması) hesaplanmaz; zeminin sıvılaşması ayrı bir kontrol gerektirir; kh ve kv'nin seçimi yerel tehlike analizine dayanmalıdır ve doğrudan programın içinden gelmez.",
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
      tr: "Güvenlik sayısı (FS), bir kontrolde toplam direncin toplam sürücü kuvvete (ya da momente) oranıdır. FS = 1.0 limit denge, FS > 1.0 güvenlik payıdır. Programda ASD (izin verilen gerilme) yaklaşımı kullanılır ve statik durum için gerekli değerler şöyledir: devrilme 2.0, kayma 1.5, taşıma 3.0, eksantrisite e/B ≤ 1/6. Bu değerler program çıktılarında 'gerekli' olarak yazılır; kendiniz kontrol edin. FS birimsizdir; momentler kNm/m, kuvvetler kN/m cinsindedir. Bir FS'nin 'geçmesi' kontrolün gerekli değeri aşması demektir; geçmemesi tasarımı değiştirmeniz gerektiği anlamına gelir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kuvvet ve moment kollarını doğru yazmak kontrollerin çoğunun anahtarıdır. Program tüm momentleri ön-taban noktasına (origin) göre alır: moment = x·F_y − y·F_x (saat yönünün tersi pozitif). Duvar ağırlığı W, kesit ağırlık merkezinde (örneğimizde x = 1.25 m) etkir. Aktif itkinin yatay bileşeni yaklaşık H/3 yüksekliğinde etkir ve devrilme yaratır. Aktif itkinin düşey bileşeni (δ ile eğik) ise arka yüzde, topuk ucunda (x = B) etkir; aşağı yönlü olduğu için hem düşey yükü artırır hem de devrilmeye karşı moment katar. Bu katkıyı atlamak, devrilme FS'sini ve taban basıncını yanlış hesaplamanın en yaygın nedenlerinden biridir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Devrilme kontrolünde M_O = Σ(yatay itki × yükseklik) ve M_R = Σ(düşey kuvvet × kol) alınır; FS_devrilme = M_R / M_O'dır. Kayma kontrolünde direnç R = ΣV·tan δ_b + c_a·B' (δ_b taban-zemin sürtünme açısı, varsayılan φ; c_a taban yapışması, B' efektif taban) ve FS_kayma = R / ΣH'dır. Pasif direnç varsayılanda kapalıdır (use_passive = False). Açıksa yalnızca azaltılmış (passive_reduction = 0.5) değeri alınır, çünkü pasif direnç zemin hareket ettiğinde oluşur; ön zemin kazılabilir, yıkanabilir veya gelecekte kaldırılabilir. Bu belirsizlik nedeniyle ön pasifin güvenilir bir kaynak olarak sayılması ancak saha koşullarıyla desteklenmelidir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Eksantrisite ve taban basıncı, bileşke kuvvetin tabana nerede etki ettiğini söyler. x_r = (M_R − M_O) / ΣV ile bileşke tabanı ön-taban noktasından x_r'de keser; e = B/2 − x_r eksantrisitedir. |e| ≤ B/6 ise (orta üçte bir) taban boyunca basınç pozitiftir ve yamuk dağılım verilir: q_max = (ΣV/B)·(1 + 6e/B), q_min = (ΣV/B)·(1 − 6e/B). |e| > B/6 olduğunda taban kısmen çekmeye girer; bu durumda gerçek davranış değişir ve program q_max = 2ΣV / (3(B/2 − |e|)), q_min = 0 kullanır. Eksantrisite sınırı e/B ≤ 1/6 bu nedenle önemlidir; geçmiyorsa temel boyutunu değiştirmek gerekir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Taşıma gücü kontrolü, tabanın yükü güvenle taşıyıp taşıyamayacağını sorar. Program Vesic yöntemini (bearing_method varsayılanı) kullanır: q_ult = c·N_c·s·d·i + q·N_q·s·d·i + ½·γ·B'·N_γ·s·d·i. Burada B' = B − 2e efektif genişlik, N_c, N_q, N_γ taşıma faktörleri ve i eğik yük (H/V) düzeltmesidir. Şerit temel için şekil faktörleri 1'dir. Vesic için N_q = e^(π·tan φ)·tan²(45° + φ/2), N_c = (N_q − 1)/tan φ ve N_γ = 2·(N_q + 1)·tan φ; eğim faktörleri iq = (1 − H/V)^m ve iγ = (1 − H/V)^(m+1) (şerit için m = 2) olarak alınır. FS_taşıma = Q_ult / ΣV = (q_ult·B') / ΣV'dir. Zemin birim ağırlığı γ taban zemini için verilmelidir; verilmezse seçimi raporda açıkça yazılmalıdır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Global stabilite, duvar ve dolgu birlikte bir Bishop dairesel kayma yüzeyi boyunca kayabilir mi sorusunu sorar. Program (geotek/engine/walls/global_stability.py) duvar ve üzerindeki zemin ağırlığını temel genişliği üzerinde doğrusal bir taban basıncı olarak temsil eder; dolgu da kayan kütlenin bir parçasıdır ve dairesel yüzey tabanın altından geçmek zorundadır. Bu bir yaklaşımdır ve yalnızca temel altı kayma yüzeylerini tarar; kayma yüzeyinin duvarın içinden geçmesi gibi durumlar bu modelin dışındadır. Dolayısıyla bu kontrol, dış stabilite kontrollerinin yerine değil, onların yanında yorumlanmalıdır.",
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
      { tr: "Duvar: H = 4 m, taban B = 2.5 m, üst genişlik 2.5 m, arka yüz düşey (geri çekme 0). Kesit dikdörtgen 2.5 × 4 m; basitleştirilmiş, yalnızca öğretim için." },
      { tr: "Beton γc = 24 kN/m³. Arka dolgu: γ = 18 kN/m³, φ = 30°, c = 0, q = 0, yatay (β = 0), duvar-zemin sürtünmesi δ = 20°." },
      { tr: "Taban zemini: φ_b = 30°, c_b = 0. Taban birim ağırlığı verilmediği için γ_taban = 18 kN/m³ varsayılmıştır (taşıma terimi buna bağlıdır)." },
      { tr: "Ön pasif yok, su yok, deprem yok. Derinlik D = 0." },
    ],
    steps: [
      { label: { tr: "Duvar ağırlığı" }, expr: "W = γc·B·H = 24 · 2.5 · 4", result: "240.00 kN/m; x = 1.25 m, y = 2.00 m" },
      { label: { tr: "Rankine Ka (δ = 0, düşey yüz)" }, expr: "Ka = tan²(45° − φ/2) = tan²(30°) = 1/3", result: "0.3333" },
      { label: { tr: "Rankine itki" }, expr: "Pa = ½·γ·H²·Ka = ½ · 18 · 16 · 0.3333", result: "48.00 kN/m, yatay; kol H/3 = 1.333 m" },
      { label: { tr: "Coulomb Ka (δ = 20°)" }, expr: "Ka = cos²30° / [cos20°·(1 + √(sin50°·sin30° / cos20°))²] = 0.75 / [0.9397 · (1 + 0.6385)²]", result: "0.2973" },
      { label: { tr: "Coulomb itki ve bileşenleri" }, expr: "Pa = ½ · 18 · 16 · 0.2973 = 42.81; Pa·cos20° (yatay), Pa·sin20° (düşey, aşağı)", result: "Pa = 42.81 kN/m; yatay 40.23 kN/m (kol 1.333 m); düşey 14.64 kN/m (kol 2.5 m)" },
      { label: { tr: "Devrilme momentleri (ön-taban noktasına göre)" }, expr: "M_O = 40.23 · 4/3;  M_R = 240 · 1.25 + 14.64 · 2.5 = 300.00 + 36.61", result: "M_O = 53.64 kNm/m; M_R = 336.61 kNm/m" },
      { label: { tr: "Devrilme FS" }, expr: "FS = M_R / M_O = 336.61 / 53.64", result: "6.275 (gerekli 2.0: geçer)" },
      { label: { tr: "Toplam kuvvetler" }, expr: "ΣV = 240 + 14.64;  ΣH = 40.23", result: "ΣV = 254.64 kN/m; ΣH = 40.23 kN/m" },
      { label: { tr: "Kayma FS" }, expr: "R = ΣV · tan 30° = 254.64 · 0.5774 = 147.03;  FS = 147.03 / 40.23", result: "3.654 (gerekli 1.5: geçer)" },
      { label: { tr: "Eksantrisite" }, expr: "x_r = (M_R − M_O)/ΣV = (336.61 − 53.64) / 254.64;  e = B/2 − x_r", result: "x_r = 1.111 m; e = 0.139 m; e/B = 0.0555 (≤ 1/6 = 0.1667: geçer)" },
      { label: { tr: "Taban basıncı" }, expr: "(ΣV/B) = 254.64 / 2.5 = 101.86;  q_max,min = 101.86 · (1 ± 6·0.139/2.5)", result: "q_max = 135.8 kPa; q_min = 67.9 kPa (ikisi de pozitif: taban tamamen basınçta)" },
      { label: { tr: "Taşıma: efektif genişlik ve faktörler" }, expr: "B' = B − 2e = 2.5 − 0.278 = 2.2225 m; N_q = 18.40, N_c = 30.14, N_γ = 2(N_q+1)tan30° = 22.40; şekil = 1 (şerit); H/V = 40.23/254.64 = 0.158; m = 2; iq = (1 − H/V)² = 0.7090; iγ = (1 − H/V)³ = 0.5970", result: "B' = 2.2225 m; iγ = 0.5970" },
      { label: { tr: "Taşıma kapasitesi" }, expr: "q_ult = ½·γ·B'·N_γ·iγ = 0.5 · 18 · 2.2225 · 22.40 · 0.5970 (c = 0, q = 0)", result: "q_ult = 267.5 kPa; Q_ult = 267.5 · 2.2225 = 594.5 kN/m" },
      { label: { tr: "Taşıma FS" }, expr: "FS = Q_ult / ΣV = 594.5 / 254.64", result: "2.335 (gerekli 3.0: GEÇMEZ)" },
    ],
    program: {
      input: "trial_wedge(H=4, gamma=18, phi=30, delta=20, beta=0, theta=0); analyze_gravity_wall(GravityGeometry(height=4, base_width=2.5, top_width=2.5, back_offset=0), Backfill(gamma=18, phi=30, delta=20, slope=0), FoundationSoil(drainage='drained', phi=30, c=0, gamma=18, overburden=0), WallLoads(), WallSettings(), seismic=False); betik scratchpad'de, repoya yazılmadı",
      output: "trial_wedge: P = 42.813 kN/m, K = 0.29731, ρ_kritik = 55.98°. analyze_gravity_wall: ΣV = 254.643, ΣH = 40.231, M_R = 336.607, M_O = 53.642 kNm/m; devrilme FS = 6.2751 (gerekli 2.0); kayma FS = 3.6543 (gerekli 1.5); e = 0.13877 m, e/B = 0.0555 (gerekli ≤ 0.1667); q_max = 135.78, q_min = 67.93 kPa; q_ult = 267.50 kPa, Q_ult = 594.50 kN/m, taşıma FS = 2.3347 (gerekli 3.0): BAŞARISIZ. Uyarı listesi boş.",
      note: {
        tr: "Elle ve program aynı: Pa'nın yatay bileşeni (40.23), M_O (53.64), M_R (336.6), FS'ler, e ve q değerleri, q_ult ve Q_ult. Fark nedeni: elle 'Rankine' Pa = 48.00 kN/m (δ = 0) ile programın Coulomb-kama Pa'sı (δ = 20°, 42.81 kN/m) farklıdır. Program bunu bilinçli olarak yapar: gravite duvarı için δ = 2/3·φ = 20° varsayılanı vardır. Pa'nın düşey bileşeni (14.64 kN/m aşağı) hem ΣV'yi hem de M_R'yi artırır. Bu nedenle devrilme FS elle Rankine ile 4.69'dan (64.0 ve 300.0 kNm/m), programda 6.275'e çıkar. Doğrulama: programda δ = 0 koyulduğunda Pa tam olarak 48.00 kN/m verir; o durumda kayma FS 2.89, devrilme 4.69, e = 0.267 m (e/B = 0.107), taşıma FS 1.66 bulunur. Sonuç: taşıma kontrolü her iki durumda da geçmez; taban genişliği, taban zemini veya taşıma kapasitesi yeniden hesaplanmalıdır. Bu bir tasarım önerisi değil, sonucun yorumudur; B değişikliği bu örnekte hesaplanmadı.",
      },
    },
  },
  { type: "p", text: { tr: "Bu örnekte iki mesaj vardır. Birincisi: Coulomb ile Rankine arasındaki fark modelleme seçimidir ve sonucu değiştirir; hangisinin kullanıldığı raporda yazılmalıdır. İkincisi: devrilme ve kayma kontrollerinin geçmesi taşıma kontrolünün geçeceği anlamına gelmez. Bu örnekte taşıma FS 2.33, 3.0 değerinin altındadır." } },
  { type: "h", text: { tr: "11) Programın sınırları ve dikkat noktaları", en: "11) Program limits and points of caution" } },
  {
    type: "p",
    text: {
      tr: "Kayma dişi (shear key) en önemli dikkat noktasıdır. G9 mühendislik incelemesinin B1 bulgusu (kritik, düzeltildi): diş ucundan geçen yatay kayma düzlemi, kayan bloğun tabanını diş tabanına kadar uzatır. Arka taraftaki zemin bu bloğu diş tabanına kadar iter. Eski sürümde bu itki taban seviyesinde kesiliyordu ve bu her durumda tutucu değildi. Örnek duvarda (H = 6 m, topukta 0.5 × 0.6 m diş, φ = 30°) ek itki K_a·(118·0.6 + ½·18·0.6²) = 24.68 kN/m çıktı; diş ucu düzlemi FS'si 2.00'den 1.66'ya ve kayma FS'si 1.85'ten 1.66'ya düştü. Düzeltmeyle itki diş derinliği boyunca katman bazında hesaplanır ve sürşarj, deprem artışı ve su etkisi dahil edilir.",
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
      tr: "Sürşarj için iki nokta önemlidir. Birincisi, sürşarjın birimi (horizontal ya da inclined) doğru seçilmelidir; eğimli yüzeyde yanlış birim cos β oranında hata yapar. İkincisi, topuk üzerindeki sürşarjın stabilize edici olup olmadığı WallLoads.surcharge_resists ile belirlenir ve varsayılan olarak sayılmaz. Trafik gibi değişken yükler genellikle direnç olarak alınmaz; bu seçim raporda belirtilmelidir. Yüzey sürşarjı aktif itkiyi K·q·H·cos β·cos θ / cos(θ − β) kadar artırır ve bu artış itkinin H/2 yüksekliğinde uygulandığı kabul edilir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kısmi katsayılar (Avrupa EC7 ve AASHTO LRFD) limit_state.py dosyasında tanımlıdır ve kendi içinde ayrı bir doğrulama yolu sunar. Ancak walls/base.py içindeki evaluate_checks yalnızca küresel güvenlik sayısı (ASD) kodlarını kabul eder ve diğerlerinde hata verir. Bu nedenle duvar kontrollerinde hangi yaklaşımın kullanıldığı, programın çıktı başlığında ve kodda ayrıca kontrol edilmelidir. Kısmi katsayılı değerler ASD ile doğrudan karşılaştırılmamalıdır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Diğer sınırlar: B8 (G9) β > φ − ψ durumunda kama yöntemi ile yönetmelik formülü arasındaki büyük fark hâlâ bir açık sorudur. B13: drenajsız temel, kayma dişi ve deprem birlikte olduğunda diş bölgesi itkisi hesaplanamadığı için analiz açık bir hatayla durur; bu durumda dişsiz duvar çalışır ama dişin etkisi görülmez. B3 ve B10 düzeltilmiştir, ama sonuçları değiştirdikleri için eski raporları yeniden kontrol edin. Her zaman girdiyi ve varsayımı açıkça yazın: taban γ, δ, c_a, kh, kv, r ve sürşarj birimi. Program bir hesap aracıdır; girdinin doğru olup olmadığını ve mühendislik yargısını yerine koymaz.",
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
      { q: { tr: "φ = 30°, δ = 0 ve düşey pürüzsüz duvar için aktif katsayı Ka kaçtır?" }, a: { tr: "Ka = tan²(30°) = 1/3 ≈ 0.333. Bu Rankine değeridir ve Coulomb'un δ = 0 haliyle aynıdır." } },
      { q: { tr: "H = 5 m, γ = 18 kN/m³, Ka = 0.333 ise toplam Pa kaç kN/m'dir ve kolu nedir?" }, a: { tr: "Pa = ½ · 18 · 25 · 0.333 = 75.0 kN/m; kol H/3 = 1.667 m (tabandan yukarı)." } },
      { q: { tr: "Aynı duvar için δ = 20° (Coulomb) kullanılırsa Pa neden daha küçük çıkar?" }, a: { tr: "Duvar sürtünmesi kamanın bir kısmını tutar ve Ka'yı azaltır (φ = 30° için 0.297). Yatay bileşen ayrıca cos20° ile çarpılır." } },
      { q: { tr: "kh = 0.2 ve kv = 0 için sismik açı ψ kaçtır?" }, a: { tr: "ψ = atan(0.2 / 1) = atan(0.2) ≈ 11.31°." } },
      { q: { tr: "Bir duvarda e/B = 0.10 ise taban basıncı nasıl dağılır?" }, a: { tr: "e/B = 0.10 < 1/6 olduğundan bileşke orta üçte birdedir; taban tamamen basınçtadır ve yamuk dağılım verir (q_min > 0)." } },
      { q: { tr: "Devrilme FS 2.0'ın altına düşerse hangi değişiklikler düşünülebilir?" }, a: { tr: "Duvar ağırlığını ve kolunu artırmak (taban genişliği, ön-taban kaydı) ya da itkiyi azaltmak (drenaj, dolgu seçimi). Bu bir tasarım yargısıdır; her değişiklik yeniden hesaplanmalıdır." } },
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
