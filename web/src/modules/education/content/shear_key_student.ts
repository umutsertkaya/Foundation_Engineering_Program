import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Kayma sorunu ve kayma dişinin görevi", en: "1. The sliding problem and the role of a shear key" } },
  {
    type: "p",
    text: {
      tr: "Bir istinat duvarı, arkasındaki zeminin ittiği bir yapıdır ve bu itkinin büyük kısmı yatay olarak temele iner. Temel tabanı ile zemin arasında oluşan sürtünme, bu yatay itkiye karşı çıkan başlıca dirençtir: duvarın ağırlığı V, temel tabanı ile zemin arasındaki sürtünme açısı δ_b ile çarpılarak yatay bir direnç üretir. Kayma güvenliği, bu direncin yatay itkiye oranıdır: FS_kayma = (V·tan δ_b + direnç) / H_itici. Sezgi şudur: duvar ne kadar ağırlıklıysa ya da zemin ile temel arasındaki sürtünme ne kadar büyükse, duvarın yerinden kaymasına karşı durumu o kadar iyi olur. Ama bu tek başına yetmeyebilir; özellikle temel tabanı düşük sürtünmeli bir zemin üzerindeyse ya da duvar yüksekse, kayma güvenliği sınırda kalır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kayma dişi (shear key), temel tabanının altına uzanan kısa bir beton çıkıntıdır. Dişin görevi, duvarı zemin içine 'kenetlemek' ve kayma yüzeyini taban düzleminden daha derine taşımaktır. Diş yan yüzeyinde, dişin önündeki (kazı tarafındaki) zemin pasif direnç üretir ve bu direnç kayma güvenliğine katkı verir. Program kayma dişini temelin topuk (heel) bölgesinde ya da ön ayakta, genişlik ve derinlik olarak tanımlanmış bir eleman olarak modeller. Bu metinde referans duvarı, topukta 0.5 m genişlik ve 0.6 m derinlikli bir diş taşıyan 6 m yüksekliğinde bir konsol duvardır.",
    },
  },
  {
    type: "figure",
    id: "key-geometry",
    caption: {
      tr: "Kayma dişli konsol istinat duvarı, kesit. Duvar gövdesi, temel tabanı (kalınlık 0.7 m), topuk altında 0.5 m genişlik ve 0.6 m derinlikte diş (kesikli dolgu ile). Ölçüler etiketli: duvar yüksekliği 6.0 m (gövde 5.3 + taban 0.7), ön ayak 0.8 m, topuk 2.2 m, diş genişliği 0.5 m, diş derinliği 0.6 m, ön gömme D = 1.5 m. Ön tarafta kazı zemini ve arka tarafta dolgu ayrı renkle; arka dolgunun üst yüzeyinde 10 kPa sürşarj oku olsun.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Kayma dişinin neden işe yaradığını anlamak için şu soruyu sorun: duvar yatay olarak kayacaksa, hangi yüzeyden kayar? Diş yokken kayma, temel tabanı boyunca oluşur ve direnç yalnızca V·tan δ_b ile sınırlıdır. Diş varken ise kayma yüzeyi diş ucunun altından geçebilir; bu yüzeyde zemin hem diş yan yüzeyinden pasif direnç görür, hem de kayan bloğun ağırlığı artar. Ama aynı zamanda, diş ucu seviyesinde kayan blok daha derin olduğu için, arkadaki zemin bu bloğu diş tabanına kadar iter. Bu ikinci etki, kayma dişinin bir kazanç olmanın yanında bir yük de getirmesi demektir ve bu konuda bölüm 3’te en önemli nokta olarak ele alacağız.",
    },
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Diş pasifi: diş yüzündeki direnç", en: "2. Key passive resistance on the key face" } },
  {
    type: "p",
    text: {
      tr: "Dişin ön yüzüne etki eden pasif basınç, kazı tarafındaki zeminden gelir. Bu yüzeyde zemin, diş tabanından yukarı doğru gerilir ve ne kadar derine inilirse o kadar sıkışır; dolayısıyla pasif basınç derinlikle artar. Programın yaklaşımı, Rankine pasif katsayısı K_p ile düşey gerilmeyi birleştirir. Düşey gerilme, dişin üstündeki (ön) zeminin ağırlığını ve dişin içindeki temel zemininin ağırlığını birlikte taşır. Bu yüzden düşey gerilme iki parçalı yazılır: önce ön dolgu (γ_ön·D), sonra temel zemini (γ_temel·(z − D)). Bu ayrım, sık yapılan hatalardan birini önler: her derinlikte ön dolgunun birim ağırlığını kullanmak.",
    },
  },
  {
    type: "formula",
    expr: "σ_v(z) = γ_ön · D + γ_temel · (z − D)      (dişin ön yüzündeki düşey gerilme, D ≤ z ≤ D + d)\np_p(z) = K_p · σ_v(z) + 2c · √K_p      (drenajlı; φ = 0 ise K_p = 1 ve c = s_u)",
    caption: { tr: "Diş pasifi: ön dolgu γ_ön ile D derinliğine kadar, altında temel zemininin γ_temel'i ile düşey gerilme", en: "Key passive pressure" },
    where: [
      { tr: "D: ön gömme derinliği (temel tabanının altındaki ön zemin kalınlığı) [m]; d: diş derinliği [m]" },
      { tr: "γ_ön, γ_temel: ön dolgu ve temel zemininin birim hacim ağırlığı [kN/m³]; K_p = tan²(45° + φ/2)" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Dişin toplam pasif kuvveti, bu basıncın dişin yüzünde integrali alınarak bulunur. Program bu integrali bir kuvvet ve bir kol olarak verir; kol, temel tabanının altında ölçülür ve kuvvetin yüzeyde hangi yükseklikte etki ettiğini gösterir. Sonuçta dişin yapısal talebi (kuvvet ve moment) bu toplam kuvvet ile hesaplanır. Pasif kuvvetin yalnızca bir kısmına güvenilir: program pasif azaltma katsayısını (varsayılan 0.5, yani FS = 2) bu toplama uygular. Bu azaltma, zeminin pasif direnç özelliklerinin belirsizliği içindir ve kayma güvenliğinde kullanılan değer budur.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: diş pasifi, ODTÜ CE366 P1 ile karşılaştırma (1 m ön dolgu, D = 1.43 m diş)", en: "Example 1: key passive vs ODTU CE366 P1" },
    given: [
      { tr: "Ön dolgu: 1 m kalınlığında, γ = 20 kN/m³ (ön gömme D = 1.0 m); temel zemini: φ = 32°, γ = 20 kN/m³, c = 0" },
      { tr: "Diş genişliği 0.5 m, derinliği d = 1.43 m; K_p = tan²(45° + 16°) = 3.2546" },
      { tr: "Pasif azaltma: 0.5 (FS = 2 pasif üzerinde); yayımlanmış değer (ODTÜ P1): P_p = 65·D + 32.5·D² = 159.4 kN/m (K_p yuvarlanmış 3.25)" },
    ],
    steps: [
      { label: { tr: "Dişin üst ve alt yüzündeki σ_v", en: "sigma_v at top and bottom of key" }, expr: "σ_v(üst) = 20 × 1.0 = 20 kPa;  σ_v(alt) = 20 + 20 × 1.43 = 48.6 kPa", result: "20 → 48.6 kPa (doğrusal)" },
      { label: { tr: "Pasif kuvvet integrali", en: "Passive integral" }, expr: "P_p = K_p · γ · (d + d²/2)  [σ_v ortalaması (20 + 48.6)/2 ile d = 1.43 çarpımı]", result: "P_p = 3.2546 × 20 × (1.43 + 1.0225) = 3.2546 × 49.05" },
      { label: { tr: "Toplam pasif (tam)", en: "Full passive" }, expr: "P_p(tam) = 159.6 kN/m", result: "yayımlanmış 159.4 kN/m ile %0.14 fark (K_p yuvarlaması)" },
      { label: { tr: "Kayma hesabında kullanılan", en: "Used in sliding" }, expr: "P_p(kullanılan) = 0.5 × 159.6", result: "79.8 kN/m" },
    ],
    program: {
      input: "key_sliding_basic(geometry: heel değil, middle; key 0.5 × 1.43; embedment 1.0; foundation φ 32, γ 20; gamma_front 20; backfill φ 30, γ 18; surcharge 30 (pasif için etkisiz))",
      output: "ks.full = 159.63 kN/m; ks.passive.fx = 79.82 kN/m (azaltma 0.5)",
      note: {
        tr: "Program 159.6 kN/m verir; yayımlanmış 159.4 kN/m değeri K_p = 3.25 ile yuvarlanmış katsayıdan gelir. Program K_p’yi tam olarak 3.2546 alır, bu nedenle fark bir hata değildir.",
        en: "Program 159.63 kN/m; published 159.4 uses K_p = 3.25.",
      },
    },
  },
  {
    type: "figure",
    id: "key-passive-diagram",
    caption: {
      tr: "Diş ön yüzündeki pasif basınç diyagramı, Örnek 1 için: yatay eksende basınç (kPa), düşey eksende derinlik. Diyagram, temel tabanının altındaki ön gömme D = 1.0 m’den başlayıp d = 1.43 m aşağıya kadar uzanmalı; üstte σ_v = 20 kPa, altta σ_v = 48.6 kPa ile işaretlenmeli ve pasif basınç K_p·σ_v’nin doğrusal artışını göstermeli. Diyagramın altında 'toplam ≈ 159.6 kN/m' ve 'kullanılan (×0.5) ≈ 79.8 kN/m' etiketleri olsun. Ön dolgu kalınlığı 1.0 m, temel tabanı ve diş ayrıca işaretlensin.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu örnekte ön dolgunun pasif katkısına dikkat edin: diş derinliği 1.43 m olmasına rağmen pasif kuvvetin yarısından çoğu dolgunun ağırlığından (20 kPa üst değer) gelir. Bu, bir ön dolgu olduğu sürece dişin direncinin bir kısmını bu dolgunun varlığına bağladığını gösterir. Dolgu kazıyla ya da oyulmayla kaldırılabiliyorsa, bu katkı güvenilir değildir. Programda bu durum için ön gömme D = 0 girilir ve yalnızca yarım ½·K_p·γ·d² kalır (bkz. bölüm 5).",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Dikkat: 'pasif direnç' kapalı olsa bile diş pasifi, ön zemin örtüsüyle hesaplanmaya devam eder (ODTÜ P1 ile aynı davranış). Yani toe pasifini kapatmak diş pasifini sıfırlamaz. Ön zemin kaldırılabilir ya da oyulabiliyorsa D = 0 girmek gerekir.",
      en: "Turning off toe passive does not zero the key passive; set D = 0 if the front cover can be removed.",
    },
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Diş ucu düzlemi ve arka itki", en: "3. Key-tip plane and back thrust" } },
  {
    type: "p",
    text: {
      tr: "Kayma dişi varsa iki farklı kayma yüzeyi düşünmek gerekir. Birincisi, temel tabanı boyunca oluşan kayma yüzeyidir: bu yüzeyde direnç V·tan δ_b ve dişin pasifidir. İkincisi, diş ucundan geçen yatay düzlemdir: bu düzlemde kayan blok, temel tabanının altındaki zemini diş tabanına kadar kapsar. Bu blok, kazı tarafından pasif direnç görürken, arkadaki (dolgu tarafındaki) zemin tarafından da itilir. Yani diş ucu düzleminde, topuk hattında, taban seviyesinden diş tabanına kadar uzanan bir aktif itki kuvveti vardır ve bu kuvvet kaymayı artırır.",
    },
  },
  {
    type: "formula",
    expr: "FS_base = (V·tan δ_b + R_pasif) / H_itici\nFS_diş-ucu = (V_blok·tan φ + R_pasif) / (H_itici + ΔH_diş)      (ΔH_diş: diş bölgesi arka itkisi)",
    caption: { tr: "İki yüzey için kayma güvenliği; yönetici olan yüzey küçük olanıdır", en: "Two sliding surfaces" },
    where: [
      { tr: "V_blok: temel tabanının altındaki zemin kolonunun düşey yükü (dişin ağırlığı ve diş yanı zemin dahil) [kN/m]" },
      { tr: "ΔH_diş: taban seviyesinden diş tabanına kadar arka aktif itki (yatay bileşen) [kN/m]; yalnız diş ucu düzlemine eklenir" },
    ],
  },
  {
    type: "p",
    text: {
      tr: "Bu ek itkinin büyüklüğü, yalnızca diş bölgesinin yüksekliğine ve arkadaki zemin basıncına bağlıdır, ama küçük değildir. Hesap şöyle yapılır: topuk hattında düşey bir yüzey düşünün, taban seviyesinden diş tabanına (d) kadar olan bant için aktif katsayı K_a (temel zemininin, bu örnekte φ = 30°, β = 0 için 1/3) kullanılarak yatay basınç integrali alınır. Yani kuvvet, σ_v(taban) × d × K_a ve ½ × γ × d² × K_a toplamıdır. Program ayrıca dolgudaki sürşarj, deprem artışı ve su basıncını da bu bantta ekler; bu metinde yalnızca temel durumu (sürşarj) gösteriyoruz.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: referans duvar, diş ucu düzlemi için arka itki (H = 6 m, topukta 0.5 × 0.6 m diş)", en: "Example 2: reference wall, back thrust on the key-tip plane" },
    given: [
      { tr: "Arka dolgu: γ = 18 kN/m³, φ = 32°; 10 kPa sürşarj; taban seviyesinde toplam düşey gerilme σ_v = 18 × 6.0 + 10 = 118 kPa" },
      { tr: "Temel zemini: φ = 30° (K_a = tan²(30°) = 1/3 = 0.3333); diş derinliği d = 0.6 m; diş genişliği 0.5 m" },
      { tr: "Yöntem: β = 0, δ = β = 0, c′ ihmal (tutucu); yalnızca yatay bileşen kullanılır" },
    ],
    steps: [
      { label: { tr: "Bant üstündeki basınç (taban seviyesi)", en: "Pressure at base level" }, expr: "σ_h,üst = K_a · σ_v = 0.3333 × 118", result: "39.3 kPa" },
      { label: { tr: "Dişin yüksekliği boyunca integral", en: "Integral over key depth" }, expr: "ΔH = (118 × 0.6 + ½ × 18 × 0.6²) / 3 = (70.8 + 3.24) / 3", result: "ΔH = 24.68 kN/m" },
      { label: { tr: "Yönetici yüzeyin değişimi", en: "Change of governing surface" }, expr: "FS_diş-ucu = (V_blok·tan φ + R) / (H_itici + ΔH)", result: "itici kuvvet 118.0 → 142.7 kN/m (sayılar aşağıda)" },
    ],
    program: {
      input: "analyze_cantilever_wall(duvar: H 6.0, stem 5.3 (üst 0.3, alt 0.5), ön ayak 0.8, topuk 2.2, taban 0.7; key: heel, 0.5 × 0.6; D 1.5; dolgu φ 32 γ 18; sürşarj 10; temel φ 30 γ 18)",
      output: "key-tip plane FS = 1.6579; base-surface FS = 1.8461; governing = deep; uyarı: walls.warning.shear_key_bearing; program ara değeri 24.68 kN/m (test: ‘key zone thrust’)",
      note: {
        tr: "Program ΔH’yi 24.68 kN/m olarak hesaplar (el hesabıyla aynı). Kayma düzleminin diş ucuna geçmesi, bu itkinin eklenmesinden kaynaklanır. Bu sonucun önemi: diş ucu düzlemi olmadan (yalnız taban yüzeyi) yapılan hesap, FS = 2.00 verirdi; diş ucu düzlemi dahil edildiğinde FS = 1.66’ya düşer.",
        en: "Program key-zone thrust 24.68; FS drops from 2.00 to 1.66 with the key-tip plane.",
      },
    },
  },
  {
    type: "figure",
    id: "key-tip-plane",
    caption: {
      tr: "Diş ucu düzlemi ve arka itki kesiti, referans duvar. Kayan blok: temel tabanı ile diş tabanı arasındaki yatay düzlem (diş ucu düzlemi) ile sınırlanmış; topuk hattındaki düşey yüzeyde taban seviyesinden diş tabanına (0.6 m) kadar uzanan 'arka itki ΔH = 24.7 kN/m' oku, dolgu tarafında gösterilsin. Diş ucunun altında 'diş ucu düzlemi' etiketi ve diş yanındaki zemin için 'diş yanı zemin ağırlığı 32.4 kN' etiketi olsun.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu örnekte yönetici yüzeyin değiştiğine dikkat edin. Taban yüzeyi için FS = 1.85 çıkar; diş ucu düzlemi için FS = 1.66 çıkar; yani kayma güvenliği, diş ucu düzleminden kontrol edilir. Program her iki yüzeyi de hesaplar ve küçük olanı raporlar; burada 'yönetici' ifadesi bu küçük değeri belirtir. Mühendis için sonuç şudur: diş ekleyince kayma güvenliği iyileşir (1.56 → 1.66), ama arka itkinin etkisi eklenince bu iyileşme tamamen 'aynı yüzeyden' gelmez; hesap, iki yüzeyin ayrı ayrı kontrol edilmesini ister.",
    },
  },
  {
    type: "figure",
    id: "shear-key-planes",
    caption: {
      tr: "Kayma yüzeyleri karşılaştırması: aynı referans duvarda iki kontrol yüzeyi, taban yüzeyi (FS = 1.85) ve diş ucu düzlemi (FS = 1.66) etiketli; her yüzeyin üstünde ilgili kuvvetler (V tan δ_b, pasif, ΔH) okları ile gösterilsin. Yönetici yüzey kalın çizgiyle vurgulansın.",
    },
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Kayma güvenliği: diş olan ve olmayan duvar", en: "4. Sliding factor of safety with and without the key" } },
  {
    type: "p",
    text: {
      tr: "Diş olan ve olmayan duvarı yan yana koymak, dişin ne kadar kazandırdığını görmenin en iyi yoludur. Diş yoksa kayma, yalnızca temel tabanı boyunca kontrol edilir ve FS = V_0·tan δ_b / H_itici olur; burada V_0 dişin ağırlığını içermeyen toplam düşey yüktür. Diş varsa, dişin ağırlığı V’ye eklenir (V = V_0 + V_diş), dişin pasif kuvveti yatay dirence eklenir ve iki yüzey ayrı ayrı kontrol edilir. Bu bölümdeki en önemli sonuç: dişin kazancı, hem ağırlık hem pasif katkının toplamıdır, ama bu kazancın bir kısmı ΔH ile geri alınır.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: referans duvar, diş yok ve diş var (sayılar)", en: "Example 3: reference wall, no key and with key" },
    given: [
      { tr: "V_0 (diş yok) = 319.56 kN/m; diş ağırlığı V_diş = 24 × 0.5 × 0.6 = 7.2 kN/m; V = 326.76 kN/m" },
      { tr: "Taban sürtünmesi φ_temel = 30° (tan 30° = 0.5774); H_itici (taban seviyesi, sürşarjlı) = 118.0 kN/m" },
      { tr: "Diş pasifi: tam 58.32 kN/m, kullanılan 29.16 kN/m; diş yanı zemin ağırlığı 18 × 3.0 × 0.6 = 32.4 kN" },
    ],
    steps: [
      { label: { tr: "Diş yok", en: "No key" }, expr: "FS = 319.56 × 0.5774 / 118.0", result: "FS = 1.56" },
      { label: { tr: "Diş var, taban yüzeyi", en: "With key, base surface" }, expr: "FS_base = (326.76 × 0.5774 + 29.16) / 118.0 = 217.8 / 118.0", result: "FS_base = 1.85" },
      { label: { tr: "Diş var, diş ucu düzlemi", en: "With key, key-tip plane" }, expr: "FS_deep = ((326.76 + 32.4) × 0.5774 + 29.16) / (118.0 + 24.68) = 236.6 / 142.7", result: "FS_deep = 1.66 (yönetici)" },
      { label: { tr: "Dişsiz duvarda diş ucu etkisi çıkarılsa", en: "Without the key-zone thrust" }, expr: "FS = 236.6 / 118.0", result: "2.00 (kontrol amaçlı; gerçek değil)" },
    ],
    program: {
      input: "analyze_cantilever_wall (aynı referans duvar; key = None ve key = heel 0.5 × 0.6)",
      output: "key = None: sliding FS = 1.5637; key var: FS_base = 1.8461, FS_deep = 1.6579; governing = deep; key passive (kullanılan) = 29.16 kN/m; demand V = 58.32 kN/m, M = 18.47 kNm/m",
      note: {
        tr: "El hesabı ile program aynı değerleri verir (1.56, 1.85, 1.66). 'Dişsiz duvarda diş ucu etkisi çıkarılsa 2.00' değeri yalnızca kontrol içindir; dişli duvar için geçerli sonuç 1.66’dır.",
        en: "Hand and program agree: 1.56 / 1.85 / 1.66.",
      },
    },
  },
  {
    type: "figure",
    id: "wall-stability-checks",
    caption: {
      tr: "Kayma kontrol tablosu/çubuk grafiği: üç çubuk, 'diş yok' (FS 1.56), 'diş var, taban yüzeyi' (FS 1.85) ve 'diş var, diş ucu düzlemi' (FS 1.66); her çubuğun üstünde değer, altında yüzey adı yazsın. Yatay bir kesikli çizgi 'FS = 1.50' sınırını göstersin (bu bir örnek sınır çizgisidir, yönetmelik değeri değildir; etiketinde 'örnek' yazsın). En kısa çubuk olan yönetici yüzey işaretlensin.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu sayıların anlamı, tek bir hesaplanmış katsayıyı değil, hangi yüzeyin belirleyici olduğunu bilmektir. Yönetici yüzey değiştiğinde, diş boyutlarını değiştirmek ilk bakışta işe yarayabilir ama belirleyici yüzey başka bir yüzeye geçebilir. Bu nedenle diş boyutu seçimi, her iki yüzeyi aynı anda kontrol ederek yapılır. Ayrıca, kayma güvenliğinin hedef değeri (örneğin 1.5) yönetmelikten ve projenin güvenlik politikasından alınır; bu metin hedef bir değer önermez.",
    },
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Drenajsız zemin, deprem ve sınırlar", en: "5. Undrained soil, earthquake and limits" } },
  {
    type: "p",
    text: {
      tr: "Diş pasifinde zemin drenajlıysa Rankine K_p ve c′ kullanılır; drenajsızsa (φ = 0) pasif basınç, K_p = 1 ve s_u ile yazılır: p_p = σ_v + 2·s_u. Bu durumda pasif kuvvet, kohezyonun katkısını da içerir ama sürtünme katkısı yoktur. Ancak programda drenajsız temel zemininde, eğimli dolgu ya da deprem varsa, diş ucu düzlemindeki arka itki hesaplanamaz ve analiz açık bir hata ile durur. Bu, sessiz bir atlama değildir: program bu durumda diş bölgesi itkisini hesaplamaz ve bunu bildirir.",
    },
  },
  {
    type: "warn",
    text: {
      tr: "Program hatası (örnek): drenajsız temel zemininde deprem ile analiz yapılırsa program şu tür bir hata verir: 'Kayma dişi: diş derinliği boyunca arka aktif itki hesaplanamadı (drenajsız temel zemininde eğimli dolgu veya deprem desteklenmiyor)'. Bu durumda dişli duvarı bu programla hesaplayamazsınız; dişsiz duvar hesabı ya da uzman değerlendirmesi gerekir.",
      en: "Undrained base with seismic or sloping backfill stops with an explicit error; no silent fallback.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Depremde iki etki birlikte görülür. Birincisi, diş pasifi ve taban pasifi, Mononobe–Okabe pasif oranı ile azaltılır (sismik pasif oranı); bu, deprem sırasında pasif direncin düştüğü anlamına gelir. İkincisi, diş ucu düzleminde deprem artışı ve diş yanı zeminin ataleti (k_h·W) itici kuvvete eklenir. Ama yapısal talep (diş kesme kuvveti ve momenti) statik ve azaltılmamış pasifle kalır; bu, tutucu bir seçimdir çünkü diş daha büyük bir kuvvetle tasarlanmış olur. Bu iki ayrı kural, sonuçları yorumlarken karıştırılmamalıdır.",
    },
  },
  {
    type: "figure",
    id: "key-passive-diagram",
    caption: {
      tr: "Drenajlı ve deprem durumunda diş pasifi karşılaştırması: iki pasif diyagramı yan yana, biri statik (tam) ve biri sismik azaltılmış (kayma için kullanılan) olsun; alt kısımda 'yapısal talep: statik (azaltılmamış)' notu yazsın. Drenajsız durumda (φ = 0) diyagramın doğrusal bir yapıya sahip olduğu, σ_v yerine s_u ile çalıştığı etiketle belirtilsin.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Sınırlar için bir kısa liste: program yalnız basit (homojen temel zemini) yolda ve katmanlı yolda çalışır; katmanlı yolda su seviyeleri ayrı girilir ve diş bölgesinde ön ve arka su itkileri ayrıca eklenir. Program, ön zeminin kazılabilirliğini ya da erozyonunu bilmez; bu nedenle D = 0 girişi bir karar değil, mühendisin kabulüdür. Son olarak, kayma dişi tasarımı yalnızca kayma güvenliğini kontrol eder: devrilme, taşıma gücü ve yapısal kesit kontrolleri ayrı yapılmalıdır.",
    },
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. D = 0 varyantı ve kapanış", en: "6. The D = 0 variant and summary" } },
  {
    type: "p",
    text: {
      tr: "Önceki bölümde ön dolgunun pasif katkısının güvenilmez olduğunu söyledik. Bunu sayısal olarak görmek için Örnek 1’in dişini D = 0 ile tekrar hesaplayalım: artık yalnızca diş derinliğinin altındaki yarım ½·K_p·γ·d² kalır. Bu sonuç, ön dolgu ile birlikte kullanılan yaklaşımın ne kadar fazla pasif kuvvet sağladığını, ama bunun kaldırılabilir bir dolguya bağlı olduğunu gösterir. Program D = 0 için de aynı formülü kullanır ve sonucu test ederek doğrular.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: Örnek 1 ile aynı diş, ön dolgu kaldırılmış (D = 0)", en: "Example 4: same key, front cover removed (D = 0)" },
    given: [
      { tr: "Örnek 1 ile aynı diş (0.5 m genişlik, d = 1.43 m) ve temel zemini (φ = 32°, γ = 20 kN/m³)" },
      { tr: "Ön gömme D = 0 (ön dolgu yok; diş üstünden σ_v = 0 başlar)" },
    ],
    steps: [
      { label: { tr: "σ_v", en: "sigma_v" }, expr: "σ_v(üst) = 0;  σ_v(alt) = 20 × 1.43 = 28.6 kPa", result: "0 → 28.6 kPa" },
      { label: { tr: "Pasif integral", en: "Passive integral" }, expr: "P_p = ½ · K_p · γ · d² = ½ × 3.2546 × 20 × 1.43²", result: "P_p = 66.55 kN/m" },
      { label: { tr: "Kullanılan (×0.5)", en: "Used (×0.5)" }, expr: "0.5 × 66.55", result: "33.3 kN/m" },
    ],
    program: {
      input: "key_sliding_basic(geometry: embedment = 0.0; key 0.5 × 1.43; foundation φ 32, γ 20; gamma_front 20)",
      output: "ks.full = 66.55 kN/m (Örnek 1’in tam pasifi 159.63’ün yaklaşık %42’si)",
      note: {
        tr: "El hesabı ve program aynı değeri verir. Örnek 1 ile karşılaştırınca ön dolgunun katkısı (159.63 − 66.55 ≈ 93.1 kN/m) açıkça görülür; bu katkı ön dolgunun kaldırılmasıyla yok olur.",
        en: "Hand and program agree at 66.55 kN/m.",
      },
    },
  },
  {
    type: "p",
    text: {
      tr: "Özetle, kayma dişi üç katmanlı bir mantık taşır: diş ağırlığı ve pasif direnç kayma güvenliğini artırır; diş ucu düzleminde arka itki bu kazancı bir kısmını geri alır; ve ön dolgunun pasif katkısı, dolgunun kalıcılığına bağlıdır. Bu üç noktayı hesaplarken her seferinde iki yüzeyi, pasif kullanım oranını ve ön gömmeyi açıkça yazın.",
    },
  },
  {
    type: "steps",
    title: { tr: "Kayma dişli duvarda kayma kontrolü", en: "Sliding check with a shear key" },
    items: [
      { tr: "Duvar geometrisi, dişin konumu (topuk, orta ya da ön), genişlik ve derinlik girilir." },
      { tr: "Ön gömme D belirlenir; ön dolgu kalıcıysa D > 0, kaldırılabiliyorsa D = 0 alınır." },
      { tr: "Taban yüzeyi için V (diş ağırlığı dahil) ve tan δ_b ile direnç hesaplanır." },
      { tr: "Diş pasifi (tam ve kullanılan) hesaplanır; sismik ise azaltma oranı uygulanır." },
      { tr: "Diş ucu düzlemi için diş bölgesi arka itkisi ΔH eklenerek ikinci FS hesaplanır." },
      { tr: "Yönetici FS (küçük olan) raporlanır ve hedef değerle kıyaslanır." },
    ],
  },
  { type: "h", text: { tr: "Sık yapılan hatalar", en: "Common mistakes" } },
  {
    type: "mistakes",
    items: [
      { tr: "Diş ucu düzlemini yok saymak; diş ucundan geçen yüzeyde arka itki ΔH eklenmediğinde FS yanlış yüksek çıkar (referansta 2.00 yerine 1.66)." },
      { tr: "Diş pasifi hesabında her derinlikte ön dolgunun birim ağırlığını kullanmak; σ_v = γ_ön·D + γ_temel·(z − D) olmalıdır." },
      { tr: "Pasif kuvvetin tamamına güvenmek; program kayma için yalnız azaltılmış (varsayılan 0.5) değeri kullanır." },
      { tr: "Toe pasifini kapatıp diş pasifinin de sıfırlandığını sanmak; diş pasifi ön zemin örtüsüyle hesaplanmaya devam eder." },
      { tr: "Ön dolgu kaldırılabilirken D = 0 girmemek; bu durumda diş pasifi olduğundan büyük çıkar." },
      { tr: "Drenajsız temel zemininde deprem ya da eğimli dolguyla dişli duvarı hesaplamaya çalışmak; program açık hata verir." },
      { tr: "Yapısal talebi (V, M) azaltılmış pasifle hesaplamak; yapısal talep statik, azaltılmamış pasifle kalır." },
      { tr: "Diş genişliği ile derinliğini karıştırmak; genişlik duvar kesitinde yatay, derinlik ise temel tabanının altındaki düşey uzunluktur (bu örnekte 0.5 m genişlik, 0.6 m derinlik)." },
      { tr: "Yönetici yüzeyi raporlamamak; FS değerini yalnızca bir yüzeyden alıp diğerini atlamak." },
      { tr: "Arka itki için c′ kohezyonunu kullanmak; bu hesapta c′ tutuculuk için yok sayılır." },
    ],
  },
  { type: "h", text: { tr: "Kendinizi sınayın", en: "Check yourself" } },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "Dişin ön yüzünde σ_v(z) için formülü yazın (D = 1.0 m, γ_ön = 20, γ_temel = 20, z = 2.43 m).", en: "Write sigma_v(z) and evaluate at z = 2.43 m with D = 1.0." },
        a: { tr: "σ_v = γ_ön·D + γ_temel·(z − D) = 20 × 1.0 + 20 × 1.43 = 20 + 28.6 = 48.6 kPa.", en: "48.6 kPa." },
      },
      {
        q: { tr: "Örnek 1’de tam pasif kuvvet yaklaşık kaç kN/m ve kullanılan (×0.5) kaç kN/m’dir?", en: "Full and used passive for example 1?" },
        a: { tr: "Tam ≈ 159.6 kN/m; kullanılan ≈ 79.8 kN/m.", en: "159.6 and 79.8 kN/m." },
      },
      {
        q: { tr: "Örnek 2’de ΔH = (118 × 0.6 + ½ × 18 × 0.6²)/3 formülünde hangi kısım K_a’dır ve neden 3’e bölünür?", en: "In Delta H, where is Ka and why divide by 3?" },
        a: { tr: "Bölen 3, K_a = 1/3’tür (φ = 30°); σ_v ile d’nin çarpımı ve ½γd² terimi K_a ile çarpılır.", en: "Ka = 1/3." },
      },
      {
        q: { tr: "Referans duvarda diş yok, FS = 1.56 ise sayısal olarak nasıl bulunur?", en: "How is FS = 1.56 obtained without key?" },
        a: { tr: "FS = V_0·tan30° / H_itici = 319.56 × 0.5774 / 118.0 ≈ 1.56.", en: "1.56." },
      },
      {
        q: { tr: "Diş var, taban yüzeyi FS = 1.85, diş ucu düzlemi FS = 1.66 ise yönetici yüzey hangisidir ve kayma güvenliği hangi değer kabul edilir?", en: "Which surface governs and what FS is used?" },
        a: { tr: "Diş ucu düzlemi; FS = 1.66 (küçük olan) kabul edilir.", en: "Key-tip plane, FS 1.66." },
      },
      {
        q: { tr: "Örnek 4’te D = 0 ile diş pasifi tam kuvvet kaç kN/m çıkar ve bu, Örnek 1’e göre nasıl karşılaştırılır?", en: "Full passive with D = 0 and comparison with example 1?" },
        a: { tr: "≈ 66.55 kN/m; Örnek 1’in 159.6 kN/m değerinin yaklaşık %42’si. Fark ön dolgunun katkısıdır.", en: "66.55 kN/m, about 42 percent." },
      },
      {
        q: { tr: "Drenajsız temel zemininde (φ = 0) diş pasifinde K_p ve kohezyon nasıl alınır?", en: "Undrained key passive: K_p and cohesion?" },
        a: { tr: "K_p = 1 ve c = s_u alınır; pasif basınç p_p = σ_v + 2·s_u biçimindedir.", en: "K_p = 1, c = s_u." },
      },
      {
        q: { tr: "Program, drenajsız temel + deprem durumunda dişli duvarı hesaplarken ne yapar?", en: "What does the program do for undrained base with seismic?" },
        a: { tr: "Açık bir hata verir ve analizi durdurur; diş bölgesi itkisini sessizce sıfır almaz.", en: "Stops with explicit error." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Kayma dişi (shear key)", en: "Shear key" }, def: { tr: "Temel tabanının altına uzanan kısa beton çıkıntı; zemine kenetlenerek kayma direncini artırır." } },
      { term: { tr: "Kayma güvenliği (FS_kayma)", en: "Sliding factor of safety" }, def: { tr: "Yatay direncin yatay itkiye oranı; direnç V·tan δ_b ve pasif kuvvetten oluşur." } },
      { term: { tr: "Taban sürtünme açısı (δ_b)", en: "Base friction angle" }, def: { tr: "Temel tabanı ile zemin arasındaki sürtünme açısı [°]; V·tan δ_b direncini belirler." } },
      { term: { tr: "Diş ucu düzlemi", en: "Key-tip plane" }, def: { tr: "Diş ucundan geçen yatay kayma düzlemi; kayan blok taban seviyesinden diş tabanına kadar uzanır." } },
      { term: { tr: "Taban yüzeyi", en: "Base surface" }, def: { tr: "Temel tabanı boyunca oluşan kayma yüzeyi; dişin altından geçmez." } },
      { term: { tr: "Yönetici yüzey", en: "Governing surface" }, def: { tr: "Kayma güvenliğinin en küçük çıktığı kayma yüzeyi; program bu yüzeyin FS değerini raporlar." } },
      { term: { tr: "Diş pasifi", en: "Key passive resistance" }, def: { tr: "Dişin ön yüzündeki zeminin dişe karşı gösterdiği yatay direnç [kN/m]." } },
      { term: { tr: "Ön gömme derinliği (D)", en: "Front embedment" }, def: { tr: "Temel tabanının altındaki ön zemin kalınlığı [m]; D = 0 ise ön dolgu yoktur." } },
      { term: { tr: "Diş derinliği (d)", en: "Key depth" }, def: { tr: "Dişin temel tabanının altındaki uzunluğu [m]." } },
      { term: { tr: "Diş genişliği", en: "Key width" }, def: { tr: "Dişin duvar kesitindeki yatay genişliği [m]." } },
      { term: { tr: "Pasif azaltma katsayısı", en: "Passive reduction factor" }, def: { tr: "Pasif kuvvete uygulanan çarpan (varsayılan 0.5, yani FS = 2); kayma hesabında kullanılan değer budur." } },
      { term: { tr: "Rankine pasif katsayısı (K_p)", en: "Rankine passive coefficient" }, def: { tr: "K_p = tan²(45° + φ/2); pasif basınç katsayısı." } },
      { term: { tr: "Düşey gerilme (σ_v)", en: "Vertical stress" }, def: { tr: "Bir derinlikteki düşey efektif gerilme [kPa]; ön dolgu ve temel zemini için ayrı birikir." } },
      { term: { tr: "Arka aktif itki (ΔH)", en: "Back active thrust" }, def: { tr: "Diş ucu düzleminde topuk hattından uygulanan ek yatay itki [kN/m]; kaymayı artırır." } },
      { term: { tr: "Topuk hattı", en: "Heel line" }, def: { tr: "Topuğun arka kenarından geçen düşey çizgi; arka itki bu hatta hesaplanır." } },
      { term: { tr: "Sürşarj", en: "Surcharge" }, def: { tr: "Zemin yüzeyindeki dış yük [kPa]; arka aktif basıncı artırır." } },
      { term: { tr: "Drenajsız kayma dayanımı (s_u)", en: "Undrained shear strength" }, def: { tr: "Kısa dönemde killerin kayma dayanımı [kPa]; φ = 0 analizinde kullanılır." } },
      { term: { tr: "Kohezyon (c, c′)", en: "Cohesion" }, def: { tr: "Zeminin kayma direncinin sürtünmeden bağımsız kısmı [kPa]; arka itki hesabında c′ yok sayılır." } },
      { term: { tr: "Sismik pasif oranı", en: "Seismic passive ratio" }, def: { tr: "Mononobe–Okabe pasif basıncının statik basınca oranı; depremde pasif direnci azaltır." } },
      { term: { tr: "Yapısal talep", en: "Structural demand" }, def: { tr: "Dişin kendisinin taşıması gereken kuvvet ve moment; statik ve azaltılmamış pasifle hesaplanır." } },
      { term: { tr: "Kayan blok", en: "Sliding block" }, def: { tr: "Kayma yüzeyinin üstündeki duvar ve zemin kütlesi; yatay olarak hareket etmesi beklenen kısım." } },
      { term: { tr: "Yatay itki (H_itici)", en: "Driving force" }, def: { tr: "Duvarı kaydırmaya çalışan toplam yatay kuvvet [kN/m]." } },
      { term: { tr: "Düşey yük (V)", en: "Vertical load" }, def: { tr: "Duvar, zemin ve diş ağırlığının toplamı [kN/m]; sürtünme direncini belirler." } },
    ],
  },
  {
    type: "reading",
    items: [
      "USACE EM 1110-2-2502, Retaining and Flood Walls. Kayma dişi ve kayma yüzeyleri; doğrulanmadı, bölüm ve sayfa yazılmadı.",
      "Das, B.M., Principles of Foundation Engineering, sığ temel ve taban dişi bölümü; doğrulanmadı.",
      "ODTÜ İnşaat Mühendisliği CE366 Recitation 5, Problem 1 (ders çözümü): diş pasifi ve ön dolgu örneği; doğrulanmadı, bu metindeki karşılaştırma yayımlanmış değerle yapılmıştır.",
      "Mononobe–Okabe deprem basınç yaklaşımı; sismik pasif oranı için genel referans; doğrulanmadı.",
    ],
  },
];
