import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Ankrajlı iksa nedir ve hangi soruya cevap verir", en: "1. What an anchored excavation wall is and what it answers" } },
  {
    type: "p",
    text: {
      tr: "Kentte bir bodrum kazısı yapılırken kazı çukurunun kenarı bir iksa ile tutulur. İksa, ince bir çelik sayaç (sheet pile) ya da H profilli kazık ve arasına yerleştirilen kaplamadan oluşabilir. Kazı derinleştikçe duvara gelen yatay yük artar; bu yükü duvarın altındaki pasif direnç ve duvarı geri çeken ankrajlar birlikte taşır. Mühendisin sorusu üç parçalıdır: her ankraja düşen yatay yük ne kadardır, duvarın içinde hangi moment ve kesme oluşur, ve duvar yeterince gömülmüş mü? Bu konu, kazıyı tek bir düzlemde (birim genişlik başına) ele alır ve bu üç soruyu cevaplar.",
      en: "Anchor loads, wall moment and embedment for one excavation section.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu hesabı neden Rankine üçgeniyle değil de 'görünür basınç zarfı' ile yaparız? Rankine, serbest bir duvarın hareketine göre basıncı hesaplar; oysa ankrajlı bir iksa, kazıdaki gerçek hareketle kısıtlıdır ve üst kısımda basınç çoğu zaman üçgen değil, yaklaşık dikdörtgen ya da yamuk biçimindedir. Bu zarflar, sahada ölçülen kuvvetlerden türetilen Peck (1969) tarzı ampirik yaklaşıma dayanır (kaynak doğrulanamadı). Zarf, duvara etkiyen toplam basıncı ve ankraj yüklerini dengeleyen bir 'görünür' dağılımdır; gerçek su ya da zemin basıncının birebir bir kopyası değildir. Bu yüzden zarf yöntemi, duvarın iç kuvvetlerini bulmak için kullanılır, zemin basıncını ölçmek için değil.",
      en: "The apparent envelope is empirical; it is not a measured soil pressure.",
    },
  },
  {
    type: "assumptions",
    title: { tr: "Kapsam ve durma koşulları", en: "Scope and stop conditions" },
    items: [
      { tr: "Düz arazi, düşey duvar; tek bir kazı yüksekliği H. Eğimli arazi (β > 0) yalnız tek ankraj seviyesinde desteklenir.", en: "Level ground, vertical face, one excavation height H; slope only with one anchor level." },
      { tr: "Kazı yüksekliği içinde tek tip zemin olmalıdır: kum ve kil birlikte olamaz; karışık profil hesabı durdurur.", en: "Uniform soil within H; mixed sand and clay stops the analysis." },
      { tr: "Kazı tabanının üstünde yeraltı suyu bulunamaz; zarf bu durumu kapsamaz.", en: "No groundwater above the excavation base." },
      { tr: "Kesit tasarımı yapılmaz: M ve V talepleri hesaplanır, kesit modülüne ve verilen gerilmeye göre kontrol edilir; EI kullanılmaz.", en: "No section design; demands are compared with the given section modulus and stress." },
      { tr: "Dış (genel) stabilite ve Kranz hesaplanmaz; her sonuçta zorunlu uyarı gösterilir.", en: "External stability is not computed; a warning is always shown." },
    ],
  },
  {
    type: "figure",
    id: "awl-sand-envelope",
    caption: {
      tr: "Kum için görünür basınç zarfı (kesit: derinlik aşağı doğru, basınç yatay eksende). Zarf bir yamuk olmalı: z = 0'da sıfır, z = 2/3·H1 (ilk ankraj H1 = 1,5 m için 1,0 m) noktasında p_max = 45 kPa, orta kısımda sabit 45 kPa, alt rampa z = H − 2/3·H_n+1 (son ankrajdan sonraki 2,5 m için 8,33 m) noktasında başlayıp z = H = 10 m'de sıfıra inmeli. Kenarda 'Toplam = 390 kN/m = 0,65 K_a γ H²' ve 'p_max = Toplam / (H − H1/3 − H_n+1/3)' yazmalı. Ankraj seviyeleri 1,5 / 4,5 / 7,5 m için kesikli yatay çizgilerle işaretlenmeli.",
      en: "Sand apparent envelope: trapezoid with p_max 45 kPa, ramps at 2/3 H1 and H minus 2/3 Hn+1, anchors at 1.5, 4.5, 7.5 m.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Kumda görünür basınç zarfı ve menteşe yöntemi", en: "2. Apparent envelope in sand and the hinge method" } },
  {
    type: "p",
    text: {
      tr: "Kumda zarfın toplam büyüklüğü, drenajlı aktif basıncın bir ampirik katsayısıdır: toplam P = 0,65 K_a γ H² [kN/m]. Burada K_a = tan²(45° − φ′/2) Rankine aktif katsayısıdır (φ′ = 30° için 0,3333), γ birim hacim ağırlığı [kN/m³] ve H kazı yüksekliğidir [m]. Birimler: kN/m³ × m² = kN/m, bu yüzden toplam bir kuvvettir ve duvarın birim uzunluğu için verilir. Zarfın şekli bir yamuktur: üstte ve altta sıfırdan artıp, orta kısımda sabit p_max değerinde kalır. Üst rampa 2/3·H1 ve alt rampa 2/3·H_n+1 uzunluğundadır; H1 ilk ankrajın derinliği, H_n+1 son ankrajdan kazı tabanına olan mesafedir. p_max, toplam P'nin bu yamuk alanına bölünmesiyle bulunur: p_max = P / (H − H1/3 − H_n+1/3).",
      en: "Total sand thrust 0.65 Ka gamma H squared; p_max is total over the trapezoid length.",
    },
  },
  {
    type: "formula",
    expr: "P = 0,65 · K_a · γ · H²   ;   p_max = P / (H − H_1/3 − H_n+1/3)",
    caption: {
      tr: "Kum görünür zarfı: P toplam [kN/m], p_max zarfın orta kısmındaki sabit ordinat [kPa]. H_1: ilk ankrajın derinliği; H_n+1: son ankrajın kazı tabanına olan mesafesi (tabana göre) [m].",
      en: "Sand envelope: total load and maximum ordinate.",
    },
    where: [
      { tr: "Kum için K_a: φ′ = 30° → K_a = 0,3333. Yanal basınç katsayısı K_0 ya da K_p burada kullanılmaz." },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Zarfı bulduktan sonra her ankraja düşen yatay yükü bulmak için iki yöntem vardır. Menteşe (hinge) yönteminde duvar, ankrajlar ve kazı tabanı arasında mafsallı bir kiriş gibi düşünülür: her açıklıkta moment sıfır olan (mafsal) noktalar varsayılır ve ankraj yükleri moment dengesinden çıkar. Katkı alanı (tributary) yönteminde ise her ankraj, kendi yükseklik komşuluğundaki zarf alanını taşır ve yük bu alanın toplamına eşittir. İki yöntemin farkı, ankrajlar arasında yük paylaşımının nasıl yapıldığındadır; toplamları aynı olmak zorundadır, yalnız dağılım değişir. Program varsayılan olarak menteşe yöntemini kullanır ve sonucu bu yöntemle raporlar.",
      en: "Hinge method: moment-zero points give anchor loads; tributary method: each anchor takes its area.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: kum, H = 10 m, üç ankraj, menteşe yöntemi", en: "Example 1: sand, H = 10 m, three anchors, hinge method" },
    given: [
      { tr: "H = 10 m, γ = 18 kN/m³, φ′ = 30°, c′ = 0, yeraltı suyu yok, sürşarj yok", en: "H = 10 m, gamma = 18 kN/m3, phi' = 30 deg, no water, no surcharge" },
      { tr: "Ankrajlar: H1 = 1,5 m, 4,5 m, 7,5 m; yatay aralık s = 2,5 m; pasif katsayı kesinlik bölen 1,5", en: "Anchors at 1.5, 4.5, 7.5 m; spacing 2.5 m; passive divisor 1.5" },
    ],
    steps: [
      { label: { tr: "K_a", en: "K_a" }, expr: "K_a = tan²(45° − 15°) = tan²(30°) = 0,3333", result: "0,3333" },
      { label: { tr: "Toplam kuvvet", en: "Total thrust" }, expr: "P = 0,65 × 0,3333 × 18 × 10² = 0,65 × 0,3333 × 1800 = 390", result: "390 kN/m" },
      { label: { tr: "Zarf ordinatı", en: "Envelope ordinate" }, expr: "p_max = 390 / (10 − 1,5/3 − 2,5/3) = 390 / (10 − 0,5 − 0,8333) = 390 / 8,6667", result: "45,0 kPa" },
      { label: { tr: "Menteşe yükleri (program ile aynı, toplam 390 kN/m)", en: "Hinge loads" }, expr: "T_1 = 120,625 ; T_2 = 126,875 ; T_3 = 115,417 kN/m", result: "Σ T = 362,917" },
      { label: { tr: "Tabana aktarılan kuvvet (R_B) ve kontrol", en: "Base reaction and check" }, expr: "R_B = 390 − 362,917 = 27,083 ; Σ T + R_B = 390 ✓", result: "27,08 kN/m" },
      { label: { tr: "Ankraj eksenel yükü (eğim 0°, aralık 2,5 m)", en: "Axial load per anchor" }, expr: "P_1 = 120,625 × 2,5 / cos 0° = 301,56 kN", result: "301,56 kN" },
    ],
    program: {
      input: "H = 10 m, levels 1.5 / 4.5 / 7.5 m, spacing 2.5 m, phi = 30, gamma = 18, GWT 100 m, surcharge = 0, passive_factor = 1.5, method = hinge",
      output: "method = apparent_hinge; p_max = 45.000; total = 390.000 kN/m; loads = 120.625 / 126.875 / 115.417 kN/m; R_B = 27.083 kN/m; axial = 301.562 / 317.188 / 288.542 kN; M_max = 274.05 kNm/m; V_max = 87.08 kN/m; gömülme (teorik) 6.797 m, kullanılan 8.156 m (D0 × 1,2)",
      note: {
        tr: "Program ve el hesabı aynı p_max, yük ve R_B değerlerini verdi. Toplam ve R_B tutarlılığını elle kontrol ettim. Tek tek menteşe yüklerinin türetimi için test dosyasındaki el hesabı yorumlarına (tests/unit/test_anchored_wall.py) bakılabilir; burada tüm adımları yeniden yazmadım. Program ayrıca 'dış stabilite kontrol edilmedi' ve 'toe_force_not_balanced' (değer 257,9) uyarılarını gösterir; birincisi bu modülün kapsam dışındaki bir eksikliktir, ikincisinin tam anlamını bu metinde açıklamadım.",
        en: "Program matches the hand values; external stability and the toe force residual are warned.",
      },
    },
  },
  {
    type: "p",
    text: {
      tr: "Menteşe yöntemi ile katkı alanı yöntemi arasındaki fark, bir ankrajın yükünün komşu iki ankraja nasıl paylaşıldığından gelir. Kum örneğinde katkı alanı yöntemi yük dağılımını 112,5 / 135,0 / 121,406 kN/m olarak verir ve tabanda R_B = 21,094 kN/m kalır. Dikkat edilmesi gereken nokta, iki yöntemin de toplamı 390 kN/m'ye dengelemesidir; yani biri diğerinden 'daha doğru' değildir, ama tasarım için hangi yöntemin seçildiği açıkça yazılmalıdır. Program bu seçimi bir girdi olarak alır ve sonucun başlığına yazar. Hangi yöntemin hangi ankrajda daha muhafazakâr olduğu geometriye ve girdiye bağlıdır; bu metin genel bir sıralama vermez, bu yüzden tasarımda iki sonuç da karşılaştırılmalıdır.",
      en: "Tributary gives 112.5 / 135.0 / 121.4 with R_B 21.1; both sum to 390 kN/m.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: aynı kum, katkı alanı yöntemi", en: "Example 2: same sand, tributary method" },
    given: [
      { tr: "Örnek 1 ile aynı girdi; yalnızca yük yöntemi = katkı alanı", en: "Same as example 1; load method = tributary" },
    ],
    steps: [
      { label: { tr: "Toplam zarf", en: "Total envelope" }, expr: "P = 390 kN/m (Örnek 1 ile aynı)", result: "390 kN/m" },
      { label: { tr: "Ankraj 1 katkı alanı", en: "Anchor 1 tributary" }, expr: "T_1 = 112,5 kN/m (alan birimi kN/m)", result: "112,50" },
      { label: { tr: "Ankraj 2 katkı alanı", en: "Anchor 2 tributary" }, expr: "T_2 = 135,0 kN/m", result: "135,00" },
      { label: { tr: "Ankraj 3 katkı alanı", en: "Anchor 3 tributary" }, expr: "T_3 = 121,406 kN/m", result: "121,41" },
      { label: { tr: "Tabana kalan", en: "Base reaction" }, expr: "R_B = 390 − (112,5 + 135,0 + 121,406) = 21,094", result: "21,09 kN/m" },
    ],
    program: {
      input: "Örnek 1 girdisi, load_method = tributary",
      output: "loads = 112.5 / 135.0 / 121.406 kN/m; base_reaction = 21.094 kN/m",
      note: {
        tr: "Program aynı yükleri verdi. Yöntem seçimi raporda açıkça yazılmalıdır; iki yöntem arasında karar verilmeden tek bir sonuç sunulmamalıdır.",
        en: "Same loads; the method must be stated in the report.",
      },
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Kilde zarf: yumuşak kil ve N_s", en: "3. Clay envelopes: soft clay and N_s" } },
  {
    type: "p",
    text: {
      tr: "Kilde drenajsız dayanım s_u ile birim ağırlık γ belirleyicidir; bu iki büyüklüğün oranı, kazı stabilitesinin ilk göstergesidir. Stabilite sayısı N_s = γH / s_u boyutsuzdur ve kazının ne kadar zor olduğunu anlatır: N_s küçükse kil sağlam kalır, büyükse kil kazı tabanında yükselme ya da akma eğilimi gösterir. Program N_s'ye göre üç rejim kullanır. N_s ≤ 4 olduğunda sert kil zarfı (bölüm 4), 4 < N_s < 5,14 olduğunda yumuşak kil zarfı, N_s ≥ 5,14 olduğunda ise Henkel bağıntısı kullanılır. Bu sınırlar sürekli bir geçiş değildir ama 4 ile 5,14 arasında ordinat kabaca sürekli olacak şekilde seçilmiştir.",
      en: "N_s = gamma H / s_u sets the clay regime.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yumuşak kil rejiminde (4 < N_s < 5,14) program sabit K_a = 0,22 kullanır ve ordinat p_max = K_a · γ · H olur. Zarfın şekli, ilk ankraja kadar doğrusal artan ve sonra sabit kalan bir yamuktur. Bu değer GEC-4 bölüm 5.2.6 (denk. 11–12) ile uyumlu olacak şekilde kodlanmıştır; ampirik bir değerdir ve kil türüne göre sonucu değiştirebilir. N_s ≥ 5,14 olan çok yumuşak killerde Henkel bağıntısı kullanılır: K_a = 1 − 4 s_u/(γH) + 2√2 (d/H)(1 − 5,14 s_u/(γH)). Burada d, kayma yüzeyinin taban altındaki derinliğidir ve girilmek zorundadır; girilmezse program hesabı durdurur. Henkel bağıntısı d'ye duyarlıdır, bu yüzden d'nin zemin raporundan gerekçelendirilmesi gerekir.",
      en: "Soft clay: Ka 0.22, p = Ka gamma H; very soft clay: Henkel with depth d.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: yumuşak kil, s_u = 30 kPa", en: "Example 3: soft clay, s_u = 30 kPa" },
    given: [
      { tr: "H = 8 m, γ = 17 kN/m³, s_u = 30 kPa, ankrajlar 2 m ve 5 m", en: "H = 8 m, gamma = 17, s_u = 30 kPa, anchors 2 and 5 m" },
    ],
    steps: [
      { label: { tr: "γH", en: "gamma H" }, expr: "γH = 17 × 8 = 136", result: "136 kPa" },
      { label: { tr: "Stabilite sayısı", en: "Stability number" }, expr: "N_s = 136 / 30 = 4,533", result: "4 < 4,533 < 5,14 → yumuşak kil" },
      { label: { tr: "K_a (sabit)", en: "K_a" }, expr: "K_a = 0,22", result: "0,22" },
      { label: { tr: "Ordinat", en: "Ordinate" }, expr: "p_max = 0,22 × 136 = 29,92", result: "29,92 kPa" },
      { label: { tr: "Toplam (zarf alanı; z = 0 → 2 m rampa, 2 → 8 m sabit)", en: "Total thrust" }, expr: "P = ½ × 2 × 29,92 + (8 − 2) × 29,92 = 29,92 + 179,52", result: "209,44 kN/m" },
    ],
    program: {
      input: "H = 8 m, γ = 17, drainage undrained, service temporary, s_u = 30, anchors at 2.0 and 5.0 m, stiff_coefficient = 0.3",
      output: "kind = soft_clay; N_s = 4.5333; K_a = 0.22; p_max = 29.92 kPa; zarf noktaları z = 0, 2, 8 m; toplam = 209.44 kN/m",
      note: {
        tr: "Elle ve program sonucu aynı. Bu örnekte yalnız zarfı verdim; aynı girdiyle tam analiz (run_analysis) bu kil için pasif direnç ile dengelenemeyen net basınç (no_embedment_resistance) nedeniyle durur. Yani yumuşak kilde zarf hesaplanabilir ama tam tasarım bu kolda tamamlanmaz; bu, programın sessiz bir sonuç yerine durduğu bir durumdur.",
        en: "Envelope matches; the full analysis stops for this soft clay (no embedment resistance).",
      },
    },
  },
  {
    type: "figure",
    id: "awl-clay-envelopes",
    caption: {
      tr: "Kil zarfları karşılaştırması (yatay eksen basınç kPa, düşey eksen derinlik m, yukarı pozitif aşağı). Üç ayrı panel ya da üst üste üç eğri: (a) yumuşak kil N_s = 4,53 için p = 29,92 kPa'da sabit ve z = 0 → 2 m rampasıyla başlayan zarf; (b) sert kil N_s ≤ 4 için p = 0,4 × 17 × 8 = 54,4 kPa'da, z = 0, 1,33, 6, 8 m noktalarındaki yamuk; (c) Henkel (N_s ≥ 5,14) ile d derinliği işaretli, p = K_a γH'nin büyük çıktığı bir örnek (K_a = 1,171, p ≈ 159 kPa). Her eğride N_s ve K_a değeri etiketlenmeli.",
      en: "Clay envelopes: soft (29.92 kPa), stiff (54.4 kPa), Henkel (Ka 1.171) with N_s labels.",
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Sert kil zarfı ve minimum toplam yük", en: "4. Stiff clay envelope and minimum total load" } },
  {
    type: "p",
    text: {
      tr: "Sert kilde (N_s ≤ 4) zarf ordinatı p = c · γ · H'dir; c, ampirik bir katsayıdır ve GEC-4'ün şeklinde 0,2 ile 0,4 arasında okunur. Program varsayılan olarak 0,3 kullanır ama bu değer kullanıcı tarafından değiştirilebilir ve sınırı dışarıda kalırsa girdi reddedilir. Sert kilde zarfın toplamı yalnızca p'ye bağlı değildir: ankraj seviyeleri arasındaki yamuk alanı P = p · (H − H1/3 − H_n+1/3) olarak hesaplanır. Ancak P çok küçük çıkarsa, yani duvara yeterli yük gelmiyorsa, program toplamı 3H²'ye yükseltir. Bu bir muhafazakârlık kuralıdır ve sonuçta bir varsayım olarak gösterilir; c = 0,4 durumunda doğal toplam zaten 3H²'nin üstünde kaldığı için bu kural uygulanmaz.",
      en: "Stiff clay: p = c gamma H with c in 0.2 to 0.4; total at least 3 H squared.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: sert kil, iki ankraj, c = 0,4 ve c = 0,2", en: "Example 4: stiff clay, two anchors, c = 0.4 and c = 0.2" },
    given: [
      { tr: "H = 8 m, γ = 17 kN/m³, s_u = 80 kPa (N_s = 136/80 = 1,70 ≤ 4 → sert)", en: "H = 8 m, gamma = 17, s_u = 80 kPa, N_s = 1.70" },
      { tr: "Ankrajlar 2 m ve 5 m; c = 0,4 ve c = 0,2 iki ayrı durum", en: "Anchors at 2 and 5 m; c = 0.4 and c = 0.2" },
    ],
    steps: [
      { label: { tr: "c = 0,4: ordinat", en: "c = 0.4: ordinate" }, expr: "p = 0,4 × 17 × 8 = 54,4", result: "54,4 kPa" },
      { label: { tr: "Zarf uzunluğu", en: "Envelope length" }, expr: "H − H1/3 − H_n+1/3 = 8 − 2/3 − 3/3 = 6,333", result: "6,333 m" },
      { label: { tr: "c = 0,4 toplam", en: "c = 0.4 total" }, expr: "P = 54,4 × 6,333 = 344,53 ≥ 3H² = 192", result: "344,53 kN/m" },
      { label: { tr: "c = 0,2: ordinat ve toplam", en: "c = 0.2: ordinate and total" }, expr: "p = 0,2 × 17 × 8 = 27,2 ; P = 27,2 × 6,333 = 172,27 < 192", result: "172,27 → 192 (3H²)" },
      { label: { tr: "c = 0,2: düzeltilmiş ordinat", en: "c = 0.2: corrected ordinate" }, expr: "p = 192 / 6,333 = 30,32", result: "30,32 kPa" },
    ],
    program: {
      input: "H = 8 m, s_u = 80, γ = 17, anchors 2 / 5 m, drainage undrained, service temporary, excavation width 10 m, passive_factor = 1.5; c = 0.4 ve c = 0.2 (stiff_clay_coefficient)",
      output: "c = 0.4: kind = stiff_clay, p_max = 54.4, total = 344.53, z = 0, 1.33, 6, 8; loads 171.595 / 133.649; base 39.289; c = 0.2: total = 192 (assumption stiff_clay_min_total_load), warning stiff_clay_low_total_load",
      note: {
        tr: "Elle ve program sonucu aynı. c = 0,2 durumunda program toplamı 3H²'ye çıkarır ve iki uyarı verir: bir varsayım (alt sınır uygulandı) ve bir uyarı (toplam düşüktü). Bu, sonucun bir kısmının muhafazakâr alt sınırdan geldiğini gösterir; rapor bu yüzden iki durumu da yazmalıdır.",
        en: "Matches; c = 0.2 is raised to 3H^2 and flagged.",
      },
    },
  },
  {
    type: "p",
    text: {
      tr: "Kalıcı yapılarda sert kil için ek bir koşul vardır: uzun dönem analiz, drenajlı sürtünme açısı φ′ ister. Program bu veri yoksa hesabı durdurur. Bunun nedeni, uzun dönemde kilin drenajlı davranış gösterebileceğinin kabul edilmesidir; drenajsız s_u ile yapılan bir kalıcı tasarım uzun dönemde güvensiz kalabilir. Geçici iş için drenajsız analiz kabul edilebilir ama 'geçici' statüsü ve kullanım süresi açıkça yazılmalıdır. Bu ayrım, sert killerde aynı kazıyı iki farklı süre için farklı biçimde değerlendirmenin nedenidir.",
      en: "Permanent stiff clay needs drained phi'.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Taban kabarması (kil kazı)", en: "5. Basal heave in clay excavations" } },
  {
    type: "p",
    text: {
      tr: "Kil kazılarında kazı tabanının altındaki kil, üstündeki toprak ağırlığı kaldırıldığında yukarı doğru kabarabilir. Bu olay taban kabarması olarak anılır ve kazının en tehlikeli göçme biçimlerinden biridir, çünkü duvar tek başına bunu önlemez. Kontrol, iki mekanizma için kayma dayanımı ile yük arasında bir güvenlik sayısı FS kurmaktır. Bunlardan biri, kazı tabanının altındaki kil kütlesinin genişliğine (B' = B/√2) bağlı derinlik etkisidir (denk. 37: FS = N_c · s_u / (γH + q)). Diğeri, kazı genişliğinin iki yanındaki kayma kuvvetlerinin dengesine dayanan yan kesme mekanizmasıdır (denk. 34–36). Program ikisini de hesaplar ve küçük olanı belirleyici alır.",
      en: "Two mechanisms; the smaller FS governs.",
    },
  },
  {
    type: "formula",
    expr: "FS = N_c · s_u / (γH + q)   (denk. 37, derinlik mekanizması)",
    caption: {
      tr: "N_c: taşıma faktörü (kazı şekline ve H/B oranına bağlı; Skempton tarzı bağıntı ve GEC-4 şekil 51c'den sayısallaştırılmış grafik, küçük olanı alınır). s_u: drenajsız kayma dayanımı [kPa]; γH: kazı tabanı üstündeki toprak basıncı [kPa]; q: yüzey sürşarjı [kPa].",
      en: "Basal heave FS, depth mechanism; N_c from chart or Skempton.",
    },
    where: [
      { tr: "Geçici işte FS ≥ 1,5, kalıcı işte FS ≥ 2,5 aranır (GEC-4 5.8.2.2). Program bu hedefleri girilen hizmet türüne göre kullanır; hedef karşılanmazsa kontrol satırı 'başarısız' olur." },
    ],
  },
  {
    type: "worked",
    title: { tr: "Örnek 5: taban kabarması, H = 6 m, B = 10 m, s_u = 20 kPa", en: "Example 5: basal heave, H = 6 m, B = 10 m, s_u = 20 kPa" },
    given: [
      { tr: "H = 6 m, B = 10 m, s_u = 20 kPa, γ = 17 kN/m³, q = 0, uzun kazı (L → ∞)", en: "H = 6, B = 10, s_u = 20, gamma = 17, q = 0, long excavation" },
    ],
    steps: [
      { label: { tr: "Etkin genişlik", en: "Effective width" }, expr: "B' = B / √2 = 10 / 1,4142 = 7,071 m", result: "7,071 m" },
      { label: { tr: "N_c (Skempton tarzı, H/B = 0,6)", en: "N_c" }, expr: "N_c = 5 × (1 + 0,2 × 0,6) = 5,6 (kodun ve testin kullandığı değer; bağıntının kaynak metnini doğrulayamadım)", result: "5,6" },
      { label: { tr: "Derinlik mekanizması (denk. 37)", en: "Depth mechanism" }, expr: "FS = 5,6 × 20 / (17 × 6 + 0) = 112 / 102", result: "1,098" },
      { label: { tr: "Yan kesme mekanizması (denk. 35, N_c = 5,0)", en: "Side-shear mechanism" }, expr: "FS = 5,0 × 20 / (102 − 20 × 6 / 7,071) = 100 / 85,03", result: "1,176" },
      { label: { tr: "Belirleyici ve karar", en: "Governing and decision" }, expr: "min(1,098 ; 1,176) = 1,098 < 1,5 (geçici) → yetersiz", result: "1,098 — başarısız" },
    ],
    program: {
      input: "H = 6, B = 10, s_u = 20, γ = 17, L yok (uzun), q = 0, service = temporary",
      output: "B' = 7.0711; N_c = 5.6; FS = 1.0980; hedef 1.5; ok = false",
      note: {
        tr: "Elle hesap ve program aynı sonucu verdi. Sonuç başarısızdır; bu bir tasarım önerisi değil, kazının ayrıca değerlendirilmesi gerektiğini gösteren bir bulgudur (örneğin kazı derinliği, duvar gömülmesi, zemin iyileştirme ya da kazı genişliği). Hangi çözümün seçileceği bu modülde hesaplanmaz.",
        en: "Hand and program agree; the check fails and needs a decision outside this module.",
      },
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 6: dar ve derin kazı, H = 10 m, B = 2 m, s_u = 30 kPa", en: "Example 6: narrow deep cut, H = 10 m, B = 2 m, s_u = 30 kPa" },
    given: [
      { tr: "H = 10 m, B = 2 m, s_u = 30 kPa, γ = 18 kN/m³", en: "H = 10, B = 2, s_u = 30, gamma = 18" },
    ],
    steps: [
      { label: { tr: "Taşıma faktörü (grafik, H/B = 5)", en: "N_c from chart" }, expr: "N_c ≈ 7,46 (Skempton 7,5 ile sınırlanmış grafik değeri)", result: "7,46" },
      { label: { tr: "Derinlik mekanizması (denk. 37)", en: "Depth mechanism" }, expr: "FS = 7,46 × 30 / (18 × 10) = 223,8 / 180", result: "1,2433" },
      { label: { tr: "Karar (geçici)", en: "Decision (temporary)" }, expr: "1,2433 < 1,5 → yetersiz", result: "başarısız" },
    ],
    program: {
      input: "H = 10, B = 2, s_u = 30, γ = 18, service temporary, uzun kazı",
      output: "N_c = 7.46; FS = 1.2433; ok = false",
      note: {
        tr: "Program aynı değerleri verdi. Bu örnekte yan kesme mekanizmasının payda terimi yükü neredeyse tamamen dengeler; bu yüzden belirleyici olan denk. 37'dir. N_c grafik değerinden (sayısallaştırılmış) alındığı için kaynak değerinin hassasiyeti sınırlıdır.",
        en: "Matches; N_c comes from a digitised chart.",
      },
    },
  },
  {
    type: "figure",
    id: "awl-basal-heave",
    caption: {
      tr: "Kil kazıda taban kabarması kesiti: kazı çukuru, yüzeyden kazı tabanına H = 6 m (ok), kazı genişliği B = 10 m (yatay ok), etkin genişlik B' = B/√2 = 7,07 m ayrıca kesikli çizgiyle işaretlenmeli. Tabanın altındaki kil bölgesinde kayma yüzeyi (yaklaşık yarım daire ya da kesikli eğri) ve 's_u = 20 kPa' etiketi bulunmalı. Sağ alt köşede 'FS = N_c s_u/(γH) = 1,098 < 1,5' yazan kutu, kırmızı işaretli olmalı.",
      en: "Basal heave section: H, B, B' = B/sqrt2, failure surface, FS 1.098 < 1.5 box.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Gömülme, moment ve kesme: program ne yapar", en: "6. Embedment, moment and shear: what the program does" } },
  {
    type: "p",
    text: {
      tr: "Zarf ve ankraj yükleri bulunduktan sonra duvarın gömülme derinliği hesaplanır. Duvar kazı tabanının altında bir miktar uzanır ve bu kısımda pasif zemin direnci, aktif basıncın bu bölgedeki kısmını dengeler. Program, taban tepkisi R_B ile pasif direncin denge koşulundan gömülme D_0'ı bulur; yani tabandaki zemin kuvveti, ankraj yüklerine ve zarf toplamına bağlıdır. Çok katmanlı durumda gömülme için program ayrıca bir D = D_0 (1 + artış) düzeltmesi uygular; bu artış çok seviyeli durumda varsayılan olarak 0,2'dir ve sonuç ekranında gösterilir. Pasif direnç, kazı tabanı altındaki pasif katsayı ile bölünerek azaltılır; bu bölen (passive_factor) kullanıcı girdisidir ve GEC-4 5.5.3 1,5 önerir ama bu değer program tarafından varsayılmaz.",
      en: "Embedment from base reaction; passive divisor is an input; depth increase 0.2 for several levels.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Momentler ve kesme, kiriş kabuğu olarak hesaplanan zarf ve ankraj yüklerinden çıkar. Program en büyük momenti M_max [kNm/m] ve en büyük kesmeyi V_max [kN/m] raporlar. Bu değerler, duvarın kesit modülüne ve verilen gerilmeye göre kontrol edilebilir; ancak program kesit tasarımı yapmaz ve EI değerini kullanmaz. Duvarın sapması ve ankraj gevşemesi bu modülde hesaplanmaz. Bu sınır, sonucu 'kesit yeterlidir' gibi okumamayı zorunlu kılar; yalnız talep ile verilen kapasite karşılaştırılır.",
      en: "M_max and V_max only; no section design and no deflection.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat: 'dış stabilite' ve 'Kranz' hesaplanmıyor. Ankrajlı iksanın arkasından geçen büyük kayma yüzeyi ve bütün sistemin genel stabilitesi bu modülde yoktur; her sonuçta zorunlu uyarı bunu hatırlatır. Ayrıca 'toe_force_not_balanced' uyarısı (örnekte değer 257,9) uç kuvvetinin tam dengelenmediğini bildirir; bu uyarının ayrıntısını bu metinde açıklamadım, sonucu yorumlarken kodu ve uyarı metnini birlikte okuyun.",
      en: "External stability is not computed; toe force residual is warned.",
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Kumda zarfı Rankine üçgeniyle hesaplamak. Ankrajlı iksada görünür zarf yamuktur; üçgen yük ankraj yüklerini yanlış dağıtır." },
      { tr: "Toplam kumda P = 0,65 K_a γ H² yerine tek üçgenlik K_a γ H²/2 yazmak. Katsayı ve alan farklıdır; 390 yerine 300 kN/m çıkar." },
      { tr: "Menteşe ve katkı alanı yöntemlerinden birini sonuç saymak ve seçimi yazmamak. İki yöntem farklı yük dağılımı verir; rapor hangisinin kullanıldığını belirtmelidir." },
      { tr: "Yumuşak killi zemine Rankine ya da kum zarfını uygulamak. N_s'ye göre kil rejimi seçilmeli, N_s hesaplanmalıdır." },
      { tr: "Henkel bağıntısında d derinliğini rastgele seçmek. d girilmezse program durur; girilen d, zemin raporuyla gerekçelendirilmelidir." },
      { tr: "Sert kilde c değerini 0,2–0,4 dışında seçmek; program aralık dışını reddeder." },
      { tr: "Sert kilde 3H² alt sınırını gözden kaçırmak. Hesaplanan toplam 3H²'nin altında kalırsa program bunu yükseltir ve bir varsayım olarak gösterir." },
      { tr: "Taban kabarmasında yalnız denk. 37'yi kontrol etmek. Yan kesme (denk. 34–36) mekanizması küçük FS verebilir; program küçük olanı alır." },
      { tr: "Geçici ve kalıcı hedefleri karıştırmak. Geçici için FS ≥ 1,5, kalıcı için FS ≥ 2,5; kalıcı sert kil için drenajlı φ′ gerekir." },
      { tr: "Program sonucunun dış stabiliteyi kapsadığını varsaymak. Kranz ve genel stabilite hesaplanmaz; uyarı her zaman görünür." },
      { tr: "EI değerinden sapma ya da kesit yeterliliği çıkarmak. Program kesit tasarımı yapmaz; yalnız M ve V taleplerini verir." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "H = 10 m, γ = 18 kN/m³, φ′ = 30° kumda toplam P'yi hesaplayın (0,65 K_a γ H² ile, K_a = 1/3).", en: "Sand, H = 10, gamma = 18, phi' = 30: total P with 0.65 Ka gamma H^2." },
        a: { tr: "P = 0,65 × 0,3333 × 18 × 100 = 390 kN/m.", en: "P = 390 kN/m." },
      },
      {
        q: { tr: "Yukarıdaki P = 390 kN/m, H1 = 1,5 m, H_n+1 = 2,5 m için p_max değerini bulun.", en: "With P = 390, H1 = 1.5, Hn+1 = 2.5, find p_max." },
        a: { tr: "p_max = 390 / (10 − 0,5 − 0,8333) = 390 / 8,6667 = 45,0 kPa.", en: "p_max = 45.0 kPa." },
      },
      {
        q: { tr: "Stabilite sayısı N_s = γH / s_u için γ = 17, H = 8, s_u = 30 değerlerini bulun ve hangi kil rejiminde olduğunu söyleyin.", en: "N_s for gamma = 17, H = 8, s_u = 30; which clay regime?" },
        a: { tr: "N_s = 136 / 30 = 4,533; 4 < N_s < 5,14 olduğu için yumuşak kil rejimi (K_a = 0,22).", en: "N_s = 4.533, soft clay regime." },
      },
      {
        q: { tr: "Yumuşak kil örneğinde (N_s = 4,533, K_a = 0,22, γH = 136) p_max kaç kPa'dır?", en: "Soft clay example: p_max?" },
        a: { tr: "p_max = 0,22 × 136 = 29,92 kPa.", en: "29.92 kPa." },
      },
      {
        q: { tr: "Sert kil, c = 0,3, γ = 17, H = 8, ankraj 2 ve 5 m. p ve toplamı bulun (zarf uzunluğu 6,333 m).", en: "Stiff clay c = 0.3, gamma = 17, H = 8, anchors 2 and 5: p and total." },
        a: { tr: "p = 0,3 × 17 × 8 = 40,8 kPa; P = 40,8 × 6,333 = 258,4 kN/m (3H² = 192'nin üstünde, yükseltme gerekmez).", en: "p = 40.8 kPa, P = 258.4 kN/m." },
      },
      {
        q: { tr: "Taban kabarmasında H = 6, B = 10, s_u = 20, γ = 17 için B' ve denk. 37 FS değerini bulun (N_c = 5,6).", en: "Basal heave H = 6, B = 10, s_u = 20, gamma = 17, N_c = 5.6: B' and FS (eq 37)." },
        a: { tr: "B' = 10/√2 = 7,071 m; FS = 5,6 × 20 / (17 × 6) = 112 / 102 = 1,098.", en: "B' = 7.071 m; FS = 1.098." },
      },
      {
        q: { tr: "Yukarıdaki taban kabarması FS = 1,098 geçici iş için yeterli mi? (hedef 1,5)", en: "Is FS = 1.098 enough for temporary works (target 1.5)?" },
        a: { tr: "Hayır; 1,098 < 1,5 olduğu için başarısız.", en: "No, it fails." },
      },
      {
        q: { tr: "Kalıcı yapıda sert kil için programın hangi girdiyi istediğini ve neden istediğini yazın.", en: "What does the program require for permanent stiff clay and why?" },
        a: { tr: "Drenajlı sürtünme açısı φ′ istenir; kil zamanla drenajlı davrandığı için uzun dönem güvenliği drenajsız s_u ile sağlanamaz.", en: "Drained phi' is required, because the long-term behaviour is drained." },
      },
      {
        q: { tr: "Örnek 1 (kum, menteşe) için R_B = 27,083 kN/m. Yük toplamı Σ T + R_B = 390 kontrolünü yapın.", en: "Example 1: check sum of hinge loads plus R_B = 390." },
        a: { tr: "120,625 + 126,875 + 115,417 + 27,083 = 390,000 ✓.", en: "Sum = 390.000 ✓." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Görünür basınç zarfı", en: "Apparent pressure envelope" }, def: { tr: "Ankraj kuvvetlerinden ampirik olarak türetilmiş, duvar iç kuvvetlerinde kullanılan yamuk/dikdörtgen yanal basınç dağılımı [kPa]." } },
      { term: { tr: "Menteşe yöntemi (hinge)", en: "Hinge method" }, def: { tr: "Açıklıklarda moment sıfır (mafsal) noktalarının varsayıldığı, ankraj yüklerinin moment dengesinden bulunduğu yöntem." } },
      { term: { tr: "Katkı alanı yöntemi (tributary)", en: "Tributary method" }, def: { tr: "Her ankrajın yükünün kendi komşuluğundaki zarf alanına eşit alındığı yük dağılımı yöntemi." } },
      { term: { tr: "Serbest zemin desteği", en: "Free earth support" }, def: { tr: "Tek seviyeli iksada duvarın alt ucunun serbest olarak zeminde dengelendiği ve kuvvetlerin Rankine ile bulunduğu yöntem." } },
      { term: { tr: "Ankraj seviyesi (H1, H_n+1)", en: "Anchor level" }, def: { tr: "Her ankrajın kazı tabanına göre konumu; ilk ankraj derinliği H1, son ankrajdan tabana H_n+1 [m]." } },
      { term: { tr: "Toplam yanal kuvvet (P)", en: "Total lateral force" }, def: { tr: "Zarf eğrisinin altında kalan alan; duvarın birim uzunluğu başına toplam yatay yük [kN/m]." } },
      { term: { tr: "Taban tepkisi (R_B)", en: "Base reaction" }, def: { tr: "Duvarın kazı tabanında zemine aktardığı yatay kuvvet [kN/m]; zarf toplamı eksi ankraj yükleri." } },
      { term: { tr: "Gömülme (D)", en: "Embedment" }, def: { tr: "Duvarın kazı tabanının altında uzandığı derinlik [m]; pasif dirençle dengelenir." } },
      { term: { tr: "Pasif katsayı böleni (passive_factor)", en: "Passive divisor" }, def: { tr: "Pasif direncin güvenlik için bölündüğü kullanıcı girdisi; GEC-4 önerisi 1,5." } },
      { term: { tr: "Kum zarfı katsayısı (0,65)", en: "Sand envelope factor (0.65)" }, def: { tr: "Kum görünür zarfında toplam yük formülündeki ampirik çarpan (P = 0,65 K_a γ H²)." } },
      { term: { tr: "Yumuşak kil", en: "Soft clay" }, def: { tr: "Stabilite sayısı 4 < N_s < 5,14 olan drenajsız kil; bu programda K_a = 0,22 ile zarf kullanır." } },
      { term: { tr: "Sert kil", en: "Stiff clay" }, def: { tr: "N_s ≤ 4 olan kil; zarf p = c γ H ile ve toplam 3H² alt sınırıyla hesaplanır." } },
      { term: { tr: "Stabilite sayısı (N_s)", en: "Stability number" }, def: { tr: "N_s = γH / s_u; kazının kil içindeki zorluğunu gösteren boyutsuz oran." } },
      { term: { tr: "Henkel bağıntısı", en: "Henkel relation" }, def: { tr: "Çok yumuşak kil için K_a'yı d (kayma yüzeyi derinliği) ile veren bağıntı; d girilmelidir." } },
      { term: { tr: "Drenajsız kayma dayanımı (s_u)", en: "Undrained shear strength" }, def: { tr: "Boşluk suyu boşalmadan kilin kayma dayanımı [kPa]." } },
      { term: { tr: "Taban kabarması (basal heave)", en: "Basal heave" }, def: { tr: "Kil kazı tabanının altındaki zeminin üstündeki yük kaldırıldığında yukarı kabarması." } },
      { term: { tr: "Etkin genişlik (B')", en: "Effective width" }, def: { tr: "Taban kabarması kontrolünde kullanılan genişlik: B' = B/√2 (veya sert tabaka derinliği) [m]." } },
      { term: { tr: "Taşıma faktörü (N_c)", en: "Bearing factor N_c" }, def: { tr: "Taban kabarması denkleminde s_u'nun çarpanı; kazı şekline ve H/B'ye bağlıdır." } },
      { term: { tr: "Yan kesme mekanizması", en: "Side-shear mechanism" }, def: { tr: "Kazı genişliğinin iki yanındaki kil kayma kuvvetlerinin dengesine dayanan taban kabarması mekanizması (denk. 34–36)." } },
      { term: { tr: "Uç kuvveti artığı", en: "Toe force residual" }, def: { tr: "Gömülme moment dengesiyle bulunduktan sonra kalan dengelenmemiş kuvvet; uyarı olarak gösterilir." } },
      { term: { tr: "Moment ve kesme talebi (M_max, V_max)", en: "Moment and shear demand" }, def: { tr: "Duvarın birim uzunluğu başına en büyük eğilme momenti [kNm/m] ve kesme kuvveti [kN/m]; kesit kontrolünün girdisidir." } },
      { term: { tr: "Dış stabilite", en: "External stability" }, def: { tr: "Ankrajlı iksanın arkasından geçen büyük kayma yüzeyinin kontrolü; bu modülde hesaplanmaz." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Sabatini, P.J., Pass, D.G., Bachus, R.C. (1999). Ground Anchors and Anchored Systems. FHWA-IF-99-015 (GEC-4): 5.2.4-5.2.6 (şekil 23, 24, 27, 28, 29), 5.3.3 (şekil 33-34), 5.5.3, 5.8.2.2 (denk. 34-37, şekil 51), 5.8.3. Bu metin bölüm numaralarını kod kaynaklarından aldı; tam metni yeniden okumadım.",
      "Terzaghi, K., Peck, R.B., Mesri, G. (1996). Soil Mechanics in Engineering Practice, 3. baskı: görünür zarf kavramı için. Doğrulanamadı; kodda GEC-4 üzerinden atıf yapılır.",
      "Skempton, A.W. (1951). The bearing capacity of clays: N_c için. Doğrulanamadı; kod, bağıntıyı ve Janbu ve arkadaşlarının (1956) grafiğini sayısallaştırarak kullanır.",
      "USACE EM 1110-2-2504 (Design of Sheet Pile Walls), serbest zemin desteği ve sayaç kesit kontrolü. Doğrulanamadı; kaynak olarak kodda anılır.",
      "Proje içi: docs/qa/ankraj-muhendislik-kontrolu.md (GEC-4 el hesabı regresyonları ve bağımsız incelemelerin bulguları).",
    ],
  },
];
