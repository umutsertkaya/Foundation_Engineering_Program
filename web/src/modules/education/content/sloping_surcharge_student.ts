import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Eğimli arazi (β) ve program çıktısının anlamı", en: "1. Sloping ground (beta) and what the program output means" } },
  {
    type: "p",
    text: {
      tr: "Bir istinat duvarının arkasındaki zemin düz değilse, yani dolgu yüzeyi β açısıyla yükseliyorsa, duvara gelen basınç düz arazidekinden farklıdır. Gündelik bir benzetme: ayakta yığılmış bir kum tepesinin dibine yaslanan bir tahta, tepe eğimli olduğunda daha çok itilir. Eğim açısı β, dolgu yüzeyinin yatayla yaptığı açıdır ve arazi duvardan uzaklaştıkça yükseliyorsa pozitif alınır. Eğim arttıkça yanal basınç katsayısı K_a da artar; çünkü zemin yüzeyi, kayabilecek bir kütlenin üst sınırını yukarı taşır. Bu sezgi, eğimin neden tehlikeli olduğunu anlamanın başlangıcıdır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Rankine teorisinde β ≤ φ olmalıdır; aksi halde denge çözümü yoktur ve program hata verir (bkz. örnek 1). Program yatay bir duvar yüzü ve düzgün bir dolgu eğimi için K_a(β) = cos β (cos β − √(cos² β − cos² φ)) / (cos β + √(cos² β − cos² φ)) bağıntısını kullanır. Ancak lateral_pressure fonksiyonunun döndürdüğü force değeri toplam eğik bileşke değil, yatay bileşendir. Rankine için yatay bileşen P_h = P_a cos β'dır; bu, basıncın dolgu yüzeyine paralel yönde etki ettiği için oluşur. Bu nedenle β arttıkça toplam K_a artar, ama yatay bileşen yalnız kısmen artar. Sonucu okurken bu sözleşmeyi bilmek gerekir: 'force' bir yatay kuvvettir.",
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
      { tr: "Tek katmanlı dolgu: γ = 18 kN/m³, φ' = 30°, c = 0, yeraltı suyu derin (kuru)" },
      { tr: "Duvar yüksekliği H = 6 m, düşey yüz, δ = 0, q = 0" },
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
      note: { tr: "El hesabı ile programın yatay bileşen sonucu (111.53 ↔ 111.52) yuvarlama farkıyla aynı. Basınç merkezi derinliği 4.0 m olarak değişmedi; bu, yalnız tekdüze dolgu için beklenen bir sonuçtur." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Program 'force' değerini toplam eğik basınç sanmak; bu yatay bileşendir, toplam P_a = force / cos β'dır." },
      { tr: "Rankine'i β > φ için kullanmak; program 'Rankine requires beta <= phi' hatasını verir ve bu bir eksik değil, teorinin sınırıdır." },
      { tr: "Eğimi yüzey açısı yerine dolgu içi yayılma açısı ile karıştırmak; β arazi yüzeyinin açısıdır." },
    ],
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Duvar-zemin sürtünmesi δ ve program sözleşmesi", en: "2. Wall friction delta and the program convention" } },
  {
    type: "p",
    text: {
      tr: "Duvar yüzü pürüzlüyse zemin, duvarı aşağı doğru kaydırmaya çalışan bir sürtünme kuvveti uygular ve basınç yüzeye tam dik değil, δ kadar eğik etki eder. Rankine teorisi bu sürtünmeyi yok sayar (δ = 0 kabul eder), Coulomb teorisi ise δ'yı hesaba katar. Ayrıntılı kama dengesi ep_student_b bölümünde anlatıldığından burada yalnız programın bu girdiyi nasıl kullandığına odaklanıyoruz. Program Coulomb yönteminde P_a'nın horizontal bileşenini verir: P_h = P_a cos δ (duvar yüzü dikey ise).",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu sözleşmenin pratik sonucu şudur: δ = 15° için Rankine ile Coulomb sonuçları aynı değildir ve bu fark Rankine'in δ'yı görmemesinden değil, Coulomb'un yatay izdüşümü almasından gelir. Coulomb K_a, δ arttıkça azalır; bu da basıncı küçültür. Ancak yatay izdüşüm kuvveti yine küçültür. Yani δ'nın etkisini hem K_a hem de cos δ üzerinden okumak gerekir. Bu iki etkiyi ayırmadan sonuç yorumlanırsa 'sürtünme basıncı artırıyor' gibi yanlış bir sonuca varılabilir.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: Coulomb, δ = 15°, β = 0, φ = 30°, H = 6 m", en: "Example 2: Coulomb delta 15" },
    given: [
      { tr: "Örnek 1 ile aynı zemin ve duvar; δ = 15°, β = 0" },
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
      note: { tr: "El hesabı ile programın sonucu uyumlu. Program Coulomb katsayısını (0.3014) yatay izdüşümle birlikte verir; 'force' değeri bu nedenle P_a değil P_h'dir." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Rankine ve Coulomb sonuçlarını δ'nın tek başına etkisi sanmak; yatay izdüşümün (cos δ) etkisi de katılmalıdır." },
      { tr: "δ'yı φ'den büyük girmek; bu fiziksel olarak sınırda bir değerdir ve girdinin gerekçesi zemin raporunda aranmalıdır." },
      { tr: "Coulomb pasif basıncını δ > φ/2 ile kullanmak; kod belgesine göre bu durumda doğrusal Coulomb pasif katsayısı tutucu değildir ve log-spiral çözümü gerekir." },
    ],
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Sürşarj (yüzey yükü) ve iki temel seçeneği", en: "3. Surcharge and its two basis options" } },
  {
    type: "p",
    text: {
      tr: "Sürşarj, dolgu yüzeyindeki düzgün bir düşey yüktür: bir yol, bir depo ya da bir bina temeli gibi. q [kPa] olarak girilir ve derinlik boyunca yanal basınca K·q olarak katkı verir. Sürşarjın duvar üzerindeki etkisi, zemin ağırlığı gibi düşünülebilir: ağırlığı yüzeyde artırmak, tüm yükseklik boyunca basıncı yükseltir. Sürşarjın etkisi derinlikle sabittir, dolayısıyla toplam yanal kuvvet q·H·K kadar olur ve bileşkenin derinliği H/2'ye yaklaşır. Bu sezgi, sürşarj katkısının tek başına dağılımını kontrol etmek için iyi bir kontroldür.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Eğimli arazide sürşarj iki şekilde tanımlanabilir ve program bu seçimi basis parametresiyle yapar. 'horizontal' (varsayılan): q zaten yatay izdüşüm başına verilmiş bir değerdir. 'inclined': q, eğimli yüzeye dik olarak ölçülen düşey yük yoğunluğudur; yatay izdüşüm başına değer q / cos β olur. Bu iki seçim β küçükken birbirine yakındır, β büyüdükçe fark artar. Hangi tanımın kullanılacağı, sürşarj değerinin nasıl ölçüldüğüne bağlıdır ve projede belirtilmelidir.",
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
      { tr: "Örnek 1 ile aynı dolgu (φ = 30°, γ = 18, H = 6 m, δ = 0)" },
      { tr: "Düzgün sürşarj q = 10 kPa (yatay izdüşüm başına, varsayılan)" },
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
      note: { tr: "El hesabı (132.18) programla aynı. Sürşarjın yatay bileşeni q·H·K_a·cos β'ya göre hesaplandı; yani sürşarj da yatay izdüşüme indirgendi. 'inclined' değerleri bu sayfa dışında projede seçilmelidir." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Sürşarjı kN/m olarak girmek; q kPa (kN/m²) ile girilir, derinlik boyunca yatay kuvvet q·H·K'dır." },
      { tr: "'horizontal' ve 'inclined' tanımlarını karıştırmak; 'inclined' seçeneğinde izdüşüm başına değer q / cos β olur (β = 10° için yaklaşık %1.5 fark, β büyüdükçe artar)." },
      { tr: "Sürşarj katkısını yalnız H'ye bölüp dağılımı lineer sanmak; sürşarj basıncı yükseklikle sabittir, bileşke derinlik H/2'dir." },
    ],
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Deprem: M-O, φ − β − ψ koşulu ve TBDY 16.24b", en: "4. Earthquake: M-O, the phi - beta - psi condition and TBDY 16.24b" } },
  {
    type: "p",
    text: {
      tr: "Deprem sırasında dolgu, yalancı-statik bir yatay ivme k_h (ve düşey k_v) ile yüklenir. Bu yüklemenin etkisi, dolgunun kendi açısını bir ψ kadar kaydırmak gibi düşünülebilir: ψ = atan(k_h / (1 − k_v)). Mononobe-Okabe (M-O) çözümü bu kaymış açıyla çalışır ve dengeye bir çözüm verebilmesi için φ − β − ψ ≥ 0 olmalıdır. Bu koşul sağlanmazsa M-O çözümü yoktur: dolgunun eğimi, sürtünme açısını ve deprem kaymasını birlikte aşar. Program bu durumda açık bir SlopeError verir ve yalnız kama (trial wedge) ile genelleştirilmiş denge çözümü önerir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "β, φ − ψ değerini aştığında TBDY 2018 Denklem 16.24b (EN 1998-5 E.3 ile aynı biçim) kullanılır; bu bağıntı β'dan bağımsızdır, duvar sürtünmesi δ'yı tutar ve kodda yalnız β > φ − ψ durumunda çağrılmalıdır. Fonksiyon kendisi β'ya bakmaz; çağıran kodun koşulu doğru uygulaması gerekir. Sınırda M-O ile tutarlı olması beklenir: φ = 30°, k_h = 0.2 için β = 18.69° civarında M-O 0.9275, TBDY 0.9332 verir; bu küçük fark, kaynak doğrulanana kadar sürekliliğin tam sağlandığı varsayılmamalıdır.",
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
      { tr: "φ = 30°, k_h = 0.2, k_v = 0, δ = 0, θ = 0 (düşey yüz)" },
      { tr: "β = 25° (eğim, φ'den küçük ama φ − ψ'den büyük)" },
    ],
    steps: [
      { label: { tr: "ψ", en: "psi" }, expr: "ψ = atan(0.2 / (1 − 0)) = 11.31°", result: "ψ = 11.31°" },
      { label: { tr: "M-O koşulu", en: "M-O condition" }, expr: "φ − β − ψ = 30 − 25 − 11.31 = −6.31°", result: "< 0: M-O çözümü yok" },
      { label: { tr: "TBDY 16.24b", en: "TBDY 16.24b" }, expr: "K_AE = cos²(φ − ψ) / (cos ψ · cos²θ · cos(δ + θ + ψ)) = cos²(18.69°) / cos²(11.31°) = 0.8974 / 0.9615", result: "K_AE = 0.9332" },
    ],
    program: {
      input: "mononobe_okabe_kae(phi=30, beta=25, kh=0.2) ve tbdy_kae_steep(phi=30, kh=0.2)",
      output: "mononobe_okabe_kae: SlopeError 'M-O has no solution: phi - beta - psi = -6.31 deg'; tbdy_kae_steep = 0.9332",
      note: { tr: "El hesabı TBDY değerini programla aynı verdi. Programın tbdy fonksiyonu β kontrolü yapmaz; β > φ − ψ koşulunun çağıran koda bağlı olduğuna dikkat edin." },
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
      { tr: "M-O'yu β > φ − ψ bölgesinde de çalıştırmak; program hata verir, bu hata bir sonuç değil uyarıdır." },
      { tr: "TBDY 16.24b'yi β ≤ φ − ψ bölgesinde kullanmak; bu durumda M-O doğru çözümdür." },
      { tr: "k_h ile PGA'yı karıştırmak; k_h, yönetmelikten gelen ve birimsiz bir yatay katsayıdır." },
      { tr: "Deprem artışının bileşkesini yalnız H'ye dağıtıp K_AE − K_A farkını yanlış yüksekliğe koymak; TBDY kuralı artışı yarı yükseklikte uygular." },
    ],
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Palplanş: β ve sürşarj moment dengesinde", en: "5. Sheet pile: beta and surcharge in the moment balance" } },
  {
    type: "p",
    text: {
      tr: "Palplanş bir duvar gibi davranır ama kazı tabanının altına (kazı kotu, dredge line) gömülü bir boy ile ayakta kalır. Yalnız konsol (cantilever) palplanşta, aktif basınçların kazı tabanı üstündeki momenti pasif direnç momenti ile dengelenir ve gömülü boy D bu dengeden çıkar. Program önce net basınç diyagramını (aktif eksi pasif) kurar, sonra kazı tabanı altında moment dengesini sağlayan derinliği D_0 olarak bulur. Tasarım derinliği D = (1 + depth_increase) D_0 olur; varsayılan depth_increase = 0.2'dir, yani tasarım derinliği %20 artırılır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "β ve sürşarj palplanşta net basınca farklı şekilde girer. Eğimli arka dolgu (backfill_slope) aktif basıncı büyütür, bu da gömülü boyu artırır; sürşarj (surcharge) ise tüm yükseklik boyunca düzgün bir aktif katkı verir. Sürşarj net basınca derinlikten bağımsız sabit bir aktif katkı verir; bu nedenle M_max ve D_0 üzerindeki etkisi belirgindir. Bu etkiler, palplanşta duvardaki kadar sezgisel değildir; bu yüzden aşağıdaki el kontrolü ile programın aynı sonucu verdiğini görmek önemlidir.",
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
      { tr: "Kazı yüksekliği H = 3 m (kazı tabanı üstü), dolgu kuru, β = 0, sürşarj yok" },
      { tr: "K_a = 1/3 (aktif), K_p = 3 (pasif, Rankine)" },
      { tr: "Gömülü boy için moment dengesi: kazı tabanına göre moment sıfır" },
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
      note: { tr: "Elle çözülen moment dengesi (kök ≈ 5.778) ve M_max (60.75) programla birebir uyuyor. Programın toe_force değeri −108.16 döndürdü; işaret konvansiyonu kaynakta doğrulanmalı ve sonuç yorumunda işaretin ne anlama geldiği belirtilmeli." },
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 6: aynı palplanş, β = 10° ve q = 10 kPa sürşarj (program)", en: "Example 6: beta and surcharge on the sheet pile" },
    given: [
      { tr: "Örnek 5 ile aynı; β = 10° ve düzgün sürşarj q = 10 kPa ayrı ayrı" },
    ],
    steps: [
      { label: { tr: "Dolgu eğimi (β = 10°)", en: "Backfill slope beta 10" }, expr: "aktif basınç K_a(β) = 0.3495 (örnek 1); moment dengesi aynı yöntemle", result: "D_0 = 2.836 m, M_max = 63.76 kNm/m (program)" },
      { label: { tr: "Sürşarj (q = 10 kPa)", en: "Surcharge 10 kPa" }, expr: "aktif katkı q K_a = 10 × 0.3333 = 3.33 kPa (tüm yükseklik boyunca)", result: "D_0 = 3.252 m, M_max = 96.55 kNm/m (program)" },
    ],
    program: {
      input: "cantilever_sheet_pile(profile, H=3.0, backfill_slope=10) ve (…, surcharge=10)",
      output: "β=10: D0 = 2.836, M_max = 63.76;  q=10: D0 = 3.252, M_max = 96.55",
      note: { tr: "Bu iki sonuç elle tam kontrol edilmedi; sürşarj etkisi (≈ %59 M_max artışı) tutarlı yönde ama büyüklüğü sayfa dışında bir doğrulama gerektirir. Sürşarj ve β değerlerini tasarımda ayrı ayrı rapor edin." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Gömülü boyu D_0 ile tasarım derinliği D'yi karıştırmak; tasarımda D = 1.2 D_0 (varsayılan) kullanılır." },
      { tr: "Palplanşta M_max'ı kazı tabanı üstünden değil üstten ölçmek; program z derinliğini üst kotan itibaren verir." },
      { tr: "Sürşarjın palplanş momentine küçük bir etki yaptığını varsaymak; örnek 6'da M_max %59 arttı." },
      { tr: "Pasif basıncı kazı tabanı üstünde de katmak; pasif yalnız kazı tabanı altında etkir." },
      { tr: "toe_force değerini (−108 gibi) yorumsuz bırakmak; işaret konvansiyonunu bilmeden kuvvet yönü yorumlanamaz." },
    ],
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Program sınırları ve açık sorular", en: "6. Program limits and open questions" } },
  {
    type: "p",
    text: {
      tr: "Bu konunun her hesabı, bir varsayımın sonucudur. Rankine ve Coulomb bağıntıları düzgün, yatay bir duvar ve düz bir dolgu için verilmiştir; kırılmış ya da sınırlı bir arkada, çok katmanlı ve eğimli bir dolguda sonuç değişir. Eğim ve sürşarj birlikte kullanıldığında program yalnız lineer toplamı verir; etkileşim (sürşarjın eğimli yüzeyde farklı izdüşümü gibi) ayrıca modellenmemiştir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "G9 incelemesi, bu konudaki bazı noktaları açık soru olarak işaretledi: drenajsız temel zemininde eğimli dolgu veya deprem varsa kayma dişi itkisi hesaplanamadığı için analiz açık hatayla durur (B13); palplanşta su altı zeminde TBDY eşdeğer k_h kullanılmıyor (B15); ve φ = 0 zeminde deprem pasif azaltımı kohezyon payını fazla etkileyebilir (B14). Bu noktalar kod tarafında korunmuş ya da kullanıcıya sorulmuştur; raporda bunları varsayım olarak yazmak gerekir.",
    },
  },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "β = 0, φ = 30° için Rankine K_a kaçtır?" },
        a: { tr: "K_a = tan²(45° − 15°) = tan² 30° = 1/3 = 0.3333." },
      },
      {
        q: { tr: "H = 6 m, γ = 18 kN/m³, β = 0, K_a = 1/3 ise toplam yatay kuvvet kaç kN/m'dir?" },
        a: { tr: "½ × 18 × 36 / 3 = 108 kN/m." },
      },
      {
        q: { tr: "Aynı duvar için β = 10° iken Rankine yatay bileşeni kaç kN/m'dir (K_a = 0.3495)?" },
        a: { tr: "P_a = ½ × 18 × 36 × 0.3495 = 113.26; P_h = 113.26 × cos 10° = 111.5 kN/m. Program: 111.524." },
      },
      {
        q: { tr: "φ = 30° ve β = 35° için Rankine çağrılırsa program ne yapar?" },
        a: { tr: "β > φ olduğu için hata verir: 'Rankine requires beta (35) <= phi (30)'." },
      },
      {
        q: { tr: "q = 10 kPa, H = 6 m, K_a = 1/3, β = 0 için sürşarjın yatay toplam kuvveti kaç kN/m'dir?" },
        a: { tr: "q H K_a = 10 × 6 / 3 = 20 kN/m." },
      },
      {
        q: { tr: "β = 10° için 'inclined' sürşarj tanımında yatay izdüşüm başına q_h kaçtır (q = 10 kPa)?" },
        a: { tr: "q_h = q / cos β = 10 / 0.9848 = 10.15 kPa. Program: 10.154." },
      },
      {
        q: { tr: "φ = 30° ve k_h = 0.2 için ψ kaç derecedir ve φ − ψ kaç derecedir?" },
        a: { tr: "ψ = atan(0.2) = 11.31°; φ − ψ = 18.69°." },
      },
      {
        q: { tr: "φ = 30°, k_h = 0.2, β = 25° için M-O çözümü var mıdır? Hangi bağıntı kullanılmalıdır?" },
        a: { tr: "Yoktur: φ − β − ψ = −6.31° < 0. TBDY 16.24b kullanılır, K_AE = 0.9332 (β'dan bağımsız)." },
      },
      {
        q: { tr: "H = 3 m, K_a = 1/3, γ = 18 kN/m³, dolgu kuru iken kazı tabanı üstünde aktif basınç σ_a (z = H) kaç kPa'dır?" },
        a: { tr: "σ_a = γ H K_a = 18 × 3 / 3 = 18 kPa." },
      },
      {
        q: { tr: "Konsol palplanşta D_0 = 2.778 m ise tasarım derinliği D kaçtır (depth_increase = 0.2)?" },
        a: { tr: "D = 1.2 × 2.778 = 3.333 m." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "β (eğim açısı)" }, def: { tr: "Dolgu yüzeyinin yatayla yaptığı açı; duvardan uzaklaştıkça yükseliyorsa pozitif." } },
      { term: { tr: "δ (duvar sürtünmesi)" }, def: { tr: "Duvar yüzü ile zemin arasındaki sürtünme açısı; Coulomb'da basıncın yönünü etkiler." } },
      { term: { tr: "θ (yüz eğimi)" }, def: { tr: "Duvar arka yüzünün düşeyle yaptığı açı." } },
      { term: { tr: "K_a, K_p" }, def: { tr: "Aktif ve pasif yanal basınç katsayıları; birimsiz." } },
      { term: { tr: "Rankine teorisi" }, def: { tr: "Düzgün arka yüz ve δ = 0 kabul eden denge çözümü; β ≤ φ koşulu vardır." } },
      { term: { tr: "Coulomb teorisi" }, def: { tr: "Kayan kama dengesine dayanan ve δ'yı hesaba katan çözüm." } },
      { term: { tr: "Yatay bileşen (P_h)" }, def: { tr: "Toplam eğik basıncın yatay izdüşümü; program force değerini bu biçimde verir." } },
      { term: { tr: "Sürşarj (q)" }, def: { tr: "Dolgu yüzeyine uygulanan düzgün düşey yük yoğunluğu [kPa]." } },
      { term: { tr: "horizontal / inclined basis" }, def: { tr: "Sürşarjın yatay izdüşüm başına (varsayılan) ya da eğimli yüzeye dik olarak tanımlanma seçeneği." } },
      { term: { tr: "k_h, k_v" }, def: { tr: "Yatay ve düşey yalancı-statik deprem katsayıları; birimsiz." } },
      { term: { tr: "ψ (sismik açı)" }, def: { tr: "ψ = atan(k_h / (1 − k_v)); deprem yüklemesinin açıya eşdeğeri." } },
      { term: { tr: "Mononobe-Okabe (M-O)" }, def: { tr: "Deprem sırasındaki aktif basınç için kama çözümü; φ − β − ψ ≥ 0 koşulu ister." } },
      { term: { tr: "TBDY 16.24b" }, def: { tr: "β > φ − ψ bölgesi için kullanılan, β'dan bağımsız deprem K_AE bağıntısı." } },
      { term: { tr: "Palplanş" }, def: { tr: "Zemine çakılan, gömülü boyu ile ayakta kalan ince duvar." } },
      { term: { tr: "Kazı tabanı (dredge line)" }, def: { tr: "Önde kazılan zeminin üst kotu; pasif direncin başladığı yer." } },
      { term: { tr: "Net basınç" }, def: { tr: "Aktif basınç eksi pasif basınç (ve su/sürşarj katkıları); moment dengesinin kaynağı." } },
      { term: { tr: "D_0 (gömülü boy)" }, def: { tr: "Moment dengesinin sağlandığı, kazı tabanı altındaki minimum boy." } },
      { term: { tr: "D (tasarım boyu)" }, def: { tr: "D_0 × (1 + depth_increase); varsayılan artış %20." } },
      { term: { tr: "M_max" }, def: { tr: "Kesme kuvvetinin sıfır olduğu derinlikte oluşan en büyük moment [kNm/m]." } },
      { term: { tr: "toe_force" }, def: { tr: "Programın döndürdüğü uç (toe) kuvveti; işareti kaynakta doğrulanmalı." } },
      { term: { tr: "backfill_slope" }, def: { tr: "Palplanş hesabında arka dolgunun eğimi (β) girdisi." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Das, B.M. Principles of Foundation Engineering, istinat duvarı ve toprak basıncı bölümü - kodda atıf; bu oturumda açılamadı, bölüm numarası doğrulanmadı.",
      "FHWA GEC-3 (FHWA-NHI-11-032), Bölüm 11 - sismik toprak basıncı; kodda atıf; açılamadı.",
      "Mononobe, N. & Matsuo, H. (1929) ve Okabe, S. (1926) - M-O'nun orijinal çalışmaları; kodda atıf; doğrulanamadı.",
      "TBDY 2018 Denklem 16.24b ve 16.12.2.8 - yönetmelik maddeleri; kodda atıf; yönetmelik metni bu oturumda açılamadı.",
      "Ebeling, R.M. & Morrison, E.E. (1992) - palplanş deprem artışı; G9 incelemesinde atıf; doğrulanamadı.",
      "docs/qa/G9-muhendislik-incelemesi.md (proje içi) - B1 ile B15 arasındaki açık sorular ve kararlar; bu metin bu belgeden okundu.",
    ],
  },
];
