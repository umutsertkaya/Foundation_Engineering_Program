import type { Block } from "./types";

export const student: Block[] = [
  // ------------------------------------------------------------------
  // 1
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "1. Şev stabilitesi ve güvenlik sayısı", en: "1. Slope stability and the factor of safety" } },
  {
    type: "p",
    text: {
      tr: "Bir yamaç, bir kazı şevi ya da bir dolgu gövdesi kendi ağırlığı altında ayakta kalabiliyorsa stabildir; ayakta kalamıyorsa kütlesinin bir kısmı kayar. Gündelik bir benzetme için, ıslak kum yığınının kenarını düşünün: yığın dik durur ama ucuna bir dokunuş yetiyorsa çöker. Mühendis burada iki kuvveti karşılaştırır: kaymaya çalışan sürükleyici kuvvetler (ağırlığın kayma yönündeki bileşeni) ve kaymaya karşı koyan direnç (zeminin kayma dayanımı). Bu iki büyüklüğün oranı güvenlik sayısı FS'dir: FS = direnç / sürükleyici. FS = 1 sınır durumudur; FS < 1 göçme beklenir; FS > 1 ise bir miktar emniyet olduğu anlamına gelir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "FS'nin hangi değere ulaşması gerektiği yapıya, yüke, zemin deneyinin güvenilirliğine ve yönetmeliğe göre değişir; bu metin kabul edilebilir bir sayı vermez. Tek bir FS sayısı, kullanılan kayma yüzeyinin doğru olup olmadığına ve zemin parametrelerinin (c, φ, γ) doğru ölçülüp ölçülmediğine bağlıdır. Bu yüzden FS, bir 'güvenli' onayı değil, bir hesabın özetidir. Programın ürettiği her FS, hangi zemin değerleri ve hangi kayma dairesi için hesaplandığıyla birlikte okunmalıdır.",
    },
  },
  {
    type: "figure",
    id: "slp-slip-circle",
    caption: {
      tr: "Dairesel kayma yüzeyi kesidi: bir yamaç (sağa doğru yükselen, toe solda, kret sağda) ve kesikli bir daire. Dairenin merkezi (x_c, y_c) noktası ve yarıçap R etiketli olsun. Daire, yüzeyle giriş (x_giriş, sağ tarafta kretin üstünde) ve çıkış (x_çıkış, toe'da) noktalarında kesişsin ve bu noktalar işaretlensin. Kayan kütlenin hareket yönü sol (−x) yönünde ok ile gösterilsin. Üst kısımda 'güvenlik sayısı FS = direnç / sürükleyici' kutusu bulunsun.",
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "FS'yi bir 'yüzde emniyet' gibi okumak; FS = 1.5 demek 50 % emniyet değil, direncin sürükleyiciye oranının 1.5 olduğu demektir." },
      { tr: "FS'yi tek bir kayma dairesi için verilen bir sayı sanıp, programın bulduğu kritik dairenin genel minimum olduğunu varsaymak; arama bir alt kümede yapılır." },
    ],
  },

  // ------------------------------------------------------------------
  // 2
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "2. Dairesel kayma yüzeyi ve dilim yöntemi", en: "2. Circular slip surface and the slice method" } },
  {
    type: "p",
    text: {
      tr: "Kil ve zemin şevlerinde gerçek kayma yüzeyi çoğunlukla bir daireye benzer; bu nedenle klasik yaklaşım bir daire seçip onun dengesine bakmaktır. Dairenin altındaki kütle, dik kenarlı dilimlere (slice) bölünür. Her dilim, genişliği b, yüksekliği h, tabanının eğim açısı α ve ağırlığı W olan bir dikdörtgen prizma gibi düşünülür. Dilimin tabanında kayma direnci c·b (kohezyon) ve (W − u·b)·tanφ (sürtünme) kadar çıkar; burada u boşluk suyu basıncıdır. Dilim yöntemi, her dilimin dengesini ayrı ayrı kurup toplar; böylece zemin tabakalarının, su seviyesinin ve yüzey yüklerinin kayma dairesi boyunca değişimi hesaba girer.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Dilimlerin α açısı, merkezin dikey hizasından ölçülen taban eğimidir: merkezin solundaki dilimler negatif α, sağındakiler pozitif α ile çalışır (yani sin α = (x − x_c)/R). Bu işaret, Bishop formülünde sürükleyici ve direnç katkısını ayırır. Program sürükleyici kuvveti Σ W sin α ile hesaplar ve kütlenin −x yönüne hareket ettiğini kabul eder: yani kret sağda, toe solda olan bir kesit bu varsayımla uyumludur. Bu sözleşme ters çevrildiğinde program hata vermez; yanlış bir FS döndürür (bkz. bölüm 4 uyarısı). Dilim sayısı n_slices varsayılan olarak 40'tır ve kayma yüzeyinin giriş ile çıkış noktası arasında eşit genişlikte bölünür.",
    },
  },
  {
    type: "figure",
    id: "slp-bishop-slice",
    caption: {
      tr: "Tek bir dilimin kuvvetleri (büyütülmüş ayrıntı): dairesel taban üzerinde bir dilim; dilimin genişliği b, yüksekliği h etiketli. Ağırlık W dikey ok, taban normal kuvveti N' (efektif) taban normaline dik ok, taban kayma direnci c·b ve sürtünme (N' tanφ) ayrı oklarla gösterilsin. Taban açısı α, merkezin dikeyiyle yapılan açı olarak yayılı yay üzerinde işaretlensin. Kenar kuvvetleri (E_sol, E_sağ, X_sol, X_sağ) Bishop'un basitleştirmesi gereği dikkate alınmadığını belirten kesikli çizgiyle gösterilsin.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 1: φ = 0 (drenajsız, c = 10 kPa), tek kayma dairesi, dilim sayısının etkisi", en: "Example 1: phi = 0, slice count effect" },
    given: [
      { tr: "Yamaç: toe (x = 0, y = 5), kret (x = 10, y = 10), sağ tarafta düz kret; katman γ = 18 kN/m³, c = 10 kPa, φ = 0" },
      { tr: "Kritik daire (aramadan): merkez (5.25, 14.54), R = 17.99 m" },
      { tr: "Dilim sayısı n = 4 (el hesabı için) ve n = 40 (programın varsayılanı)" },
    ],
    steps: [
      { label: { tr: "Formül (φ = 0)", en: "Formula at phi = 0" }, expr: "tanφ = 0 olduğundan m_α = cos α; FS = Σ(c·b / cos α) / Σ(W sin α)", result: "FS = Σ c b / cos α ÷ Σ W sin α" },
      { label: { tr: "Dilim 1 (α = −38.4°)", en: "Slice 1" }, expr: "b = 8.163 m, W = 670.2 kN/m; cos α = 0.7839; W sin α = 670.2 × (−0.6212)", result: "c b / cos α = 104.1; W sin α = −416.3" },
      { label: { tr: "Dilim 2 (α = −9.6°)", en: "Slice 2" }, expr: "W = 1369.1; cos α = 0.9856; W sin α = 1369.1 × (−0.1670)", result: "c b / cos α = 82.8; W sin α = −228.6" },
      { label: { tr: "Dilim 3 (α = 16.7°)", en: "Slice 3" }, expr: "W = 1864.9; cos α = 0.9584; W sin α = 1864.9 × 0.2868", result: "c b / cos α = 85.2; W sin α = 534.9" },
      { label: { tr: "Dilim 4 (α = 47.8°)", en: "Slice 4" }, expr: "W = 1108.7; cos α = 0.6729; W sin α = 1108.7 × 0.7413", result: "c b / cos α = 121.3; W sin α = 821.9" },
      { label: { tr: "Toplam ve FS (n = 4)", en: "Totals and FS (n = 4)" }, expr: "Σ c b / cos α = 393.4; Σ W sin α = −416.3 − 228.6 + 534.9 + 821.9 = 711.9; FS = 393.4 / 711.9", result: "FS ≈ 0.553" },
    ],
    program: {
      input: "bishop(model, xc=5.2488, yc=14.5392, R=17.9867, n_slices=4) ve n_slices=40 aynı daire",
      output: "n = 4: FS = 0.5534;  n = 40: FS = 0.6325 (aramanın kritik dairesi); giriş x = 11.60, çıkış x ≈ 0",
      note: { tr: "El hesabı (n = 4) programın n = 4 sonucunu doğruluyor. Dilim sayısı 4'ten 40'a çıkınca FS yaklaşık %14 arttı; yani kaba dilimleme FS'yi düşük çıkarır. Bu yüzden programın varsayılanı 40 dilimdir." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Dilim açısı α'nın işaretini karıştırmak; merkezin solundaki dilimler negatif α ile sürükleyici katkıyı azaltır." },
      { tr: "φ = 0 iken tanφ'yi sıfır yerine yanlışlıkla bir değer alıp kohezyonu ihmal etmek; drenajsız analizde direncin kaynağı c'dir." },
      { tr: "Dilim genişliğini b yerine dairenin yay uzunluğu olarak almak; Bishop'ta b dilimin yatay genişliğidir." },
    ],
  },

  // ------------------------------------------------------------------
  // 3
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "3. Bishop basitleştirilmiş yöntemi: formül ve iterasyon", en: "3. Bishop simplified method: formula and iteration" } },
  {
    type: "p",
    text: {
      tr: "Bishop (1955), dilimler arasındaki teğetsel (kayma) kuvvetlerini ihmal ederek formülü basitleştirdi. Her dilim için düşey denge yazılır ve sonuç, tüm kayma dairesi için moment dengesinden çıkarılır. Bu nedenle çözüm moment dengesini tam sağlar, yatay kuvvet dengesini ise tam sağlamaz. Sonuçta FS, hem FS'ye bağlı hem de dilimlere bağlı bir ifadeye dönüşür: m_α = cos α + sin α · tanφ / FS. Bu nedenle FS'yi doğrudan yazamazsınız; bir başlangıç değeri (FS = 1) ile başlayıp tekrar eden bir hesapla çözersiniz.",
    },
  },
  {
    type: "formula",
    expr: "FS = Σ [ (c·b + (W − u·b)·tanφ) / m_α ]  /  Σ [ W·sin α + k_h·W·(y_c − y_g)/R ]\nm_α = cos α + sin α · tanφ / FS",
    caption: { tr: "Bishop basitleştirilmiş FS (her iki toplam kayma dairesi üzerindeki tüm dilimlerde). Payda deprem katkısını k_h ile içerir.", en: "Bishop simplified factor of safety" },
    where: [
      { tr: "b: dilim genişliği [m]; W: dilim ağırlığı (birim uzunluk başına) [kN/m]; c: kohezyon [kPa]; φ: sürtünme açısı" },
      { tr: "u: taban boşluk suyu basıncı [kPa]; y_c, R: daire merkezi ve yarıçapı; y_g: dilim ağırlık merkezinin kotu; k_h: yalancı-statik deprem katsayısı" },
    ],
  },
  {
    type: "steps",
    title: { tr: "Bishop iterasyonu (kod ile birebir aynı mantık)", en: "Bishop iteration" },
    items: [
      { tr: "Her dilim için α, b, W, c, φ ve u değerlerini daire geometrisinden hesaplayın. Kayma yüzeyi zemin tabakalarını kesiyorsa her dilimin tabanı kendi katmanının c ve φ'sini alır." },
      { tr: "FS'ye bir başlangıç değeri verin (kod FS = 1 ile başlar)." },
      { tr: "m_α = cos α + sin α·tanφ / FS hesaplayın. Kod, m_α ≤ 0 veya çıkış tarafındaki (α < 0) bir dilimde m_α < 0.2 çıkarsa bu daireyi kabul etmez." },
      { tr: "Yeni FS'yi formülle hesaplayın. |FS_yeni − FS| < 1e-6 olana kadar 2. ve 3. adımları tekrarlayın (en fazla 200 tur)." },
      { tr: "Yakınsamadıysa veya sürükleyici toplam ≤ 0 ise daire geçersiz sayılır; program o daireyi arama dışı bırakır." },
    ],
  },
  {
    type: "figure",
    id: "slp-bishop-slice",
    caption: {
      tr: "Bölüm 2'deki dilim şeması ile aynı çizim, bu kez m_α annotasyonuyla: taban üzerinde bir dilimin yanında 'm_α = cos α + sin α tanφ / FS' yazsın ve 'FS başlangıç = 1' notu bulunsun. Şemanın sağ kenarında 'Fark < 10⁻⁶ ise FS sonucu; değilse m_α güncellenir' iterasyon döngüsü ok olarak gösterilsin. Çıkış tarafındaki (α < 0) bir dilimde m_α < 0.2 ise 'daire reddedilir' uyarısı kırmızıyla işaretlensin.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yöntemin sınırı, FS'nin ilk başta 1 alınmasıyla değil, m_α'nın FS'ye bağlılığıyla ilgilidir: FS küçüldükçe tanφ/FS terimi büyür ve m_α bazı dilimlerde sıfıra yaklaşabilir. Program bu durumda sayısal olarak anlamsız bir sonuç üretmek yerine daireyi reddeder. Bu nedenle sonucun iterasyon sayısı (iterations) ile birlikte okunması iyi bir alışkanlıktır: çok az tur ya da hiç yakınsamamış bir sonuç, zemin verisinin uç değerlerinde bir sorun olabileceğini gösterir.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 2: φ = 25°, c = 10 kPa, kritik daire (aramadan)", en: "Example 2: dry critical circle, phi 25" },
    given: [
      { tr: "Aynı yamaç, γ = 18 kN/m³, c = 10 kPa, φ = 25°, su yok, deprem yok" },
      { tr: "Arama sınırları: merkez x ∈ [0, 20], y ∈ [10, 30]; teğet kotu ∈ [−5, 5]; ızgara 15 × 15 × 12, sonra Nelder-Mead" },
    ],
    steps: [
      { label: { tr: "Arama", en: "Search" }, expr: "ızgarada en düşük FS'li daire bulunur, sonra (x_c, y_c, R) üç değişkenli Nelder-Mead ile iyileştirilir", result: "kritik daire: x_c = 2.61, y_c = 14.89, R = 10.23 m" },
      { label: { tr: "Giriş/çıkış", en: "Entry and exit" }, expr: "daire yüzeyle kretin sol kısmında (x ≈ 11.60) ve toe'da (x ≈ 0) kesişir", result: "x_giriş = 11.60, x_çıkış ≈ 0" },
      { label: { tr: "Sonuç", en: "Result" }, expr: "FS minimum daire üzerinde", result: "FS = 2.163 (7 iterasyon)" },
    ],
    program: {
      input: "search_critical_circle(model, x_range=(0,20), y_range=(10,30), tangent_range=(-5,5)) with n_slices = 40",
      output: "FS = 2.1626, xc = 2.6121, yc = 14.8884, R = 10.2277, x_entry = 11.596, x_exit ≈ 0.000, iterations = 7",
      note: { tr: "Bu sonuç elle tam doğrulanmadı (40 dilim); dilim tabloları programın içinde tutulur. Dilim sayısını 20'ye indirince FS 2.160 çıkar; 4 dilimde 2.029 çıkar." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "FS'yi formülde doğrudan çözmeye çalışıp m_α'daki FS'yi sabit bırakmak; iterasyon gerekir." },
      { tr: "Sürükleyici toplamın işaretini hatalı alıp FS'yi sonsuza yakın çıkarmak; yalnız pozitif sürükleyici olan daireler anlamlıdır." },
      { tr: "Dilim sayısını 4 gibi çok küçük seçmek; FS'nin dilim sayısına duyarlılığını bilmeden sonucu güvenilir saymak." },
    ],
  },

  // ------------------------------------------------------------------
  // 4
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "4. Su, yük, deprem ve kesit geometrisi", en: "4. Water, loads, seismic and section geometry" } },
  {
    type: "p",
    text: {
      tr: "Su, şevde iki şekilde etki eder: boşluk suyu basıncı u, kayma yüzeyindeki efektif gerilmeyi azaltarak direnci düşürür; ayrıca suyla dolu zeminin birim ağırlığı artar. Programda su seviyesi bir kot olarak girilir (water_level) ve u, bu kotun altında hidrostatik olarak u = γ_w·(h_w − y) ile hesaplanır. Suyun kotu yüzeyin üstündeyse yüzeyde su göleti olduğu varsayılır; program bu durumu modellemez ve yalnız su seviyesinin altındaki basıncı verir. Su seviyesini ‘derinlik’ gibi girmek en sık yapılan hatalardan biridir; bu alan kotun mutlak değeridir.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Yüzey yükleri (SurfaceLoad), x1 ile x2 arasında q1'den q2'ye doğrusal değişen düşey basınçlar olarak girilir [kPa]; dilim ağırlığına kendi genişlikleriyle eklenir. Deprem yükü yalancı-statik yaklaşımla yapılır: k_h katsayısı dilim ağırlığına yatay bir kuvvet olarak eklenir ve direnç payına karşı sürükleyici katkı üretir. Bu yaklaşım kayma yüzeyinin toplam yatay ivmesini tek bir sabit ile temsil eder; sıvılaşma veya deprem sonrası dayanım kaybı burada yoktur. Program yalnız kayma yüzeyinin dairesel olduğu ve zeminin yatay tabakalara ayrıldığı durumda çalışır.",
    },
  },
  {
    type: "figure",
    id: "slp-search-results",
    caption: {
      tr: "Kritik daire arama sonucu: kesitte bir yamaç, kırmızı çizgiyle en düşük FS'li daire ve diğer denenen dairelerin yalnız bir kısmı (açık gri) gösterilsin. Dairenin merkezi ve yarıçapı etiketli olsun. Küçük bir köşe kutusu 'su seviyesi: y = 10 m (kret) → FS = 0.911' ve 'kh = 0.1 → FS = 1.744' değerlerini göstersin. Yamacın sağındaki krete 'yük yok' notu düşülsün.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 3: su seviyesi kretin hizasında (y = 10 m) ve deprem kh = 0.1", en: "Example 3: water at crest level and kh = 0.1" },
    given: [
      { tr: "Aynı yamaç, c = 10 kPa, φ = 25°, γ = 18 kN/m³" },
      { tr: "Varyant A: water_level = 10 (kretle aynı kot). Varyant B: kh = 0.1, su yok" },
      { tr: "Arama aynı sınırlarla yapılır, dilim sayısı 40" },
    ],
    steps: [
      { label: { tr: "Varyant A su basıncı", en: "Pore pressure A" }, expr: "u = γ_w (h_w − y) = 9.81 × (10 − 4) = 58.86 kPa (taban kotu y = 4 m için)", result: "dilim tabanındaki u, su kotuna göre hesaplanır" },
      { label: { tr: "Varyant A sonucu", en: "Result A" }, expr: "boşluk suyu nedeniyle (W − u·b) tanφ azalır, kritik daire sığlaşır", result: "FS = 0.911, R = 7.61 m" },
      { label: { tr: "Varyant B sonucu", en: "Result B" }, expr: "k_h W (y_c − y_g)/R sürükleyici katkısı eklenir", result: "FS = 1.744" },
    ],
    program: {
      input: "A: SlopeModel(..., water_level=10). B: SlopeModel(..., kh=0.1); search_critical_circle(...) her ikisi için",
      output: "A: FS = 0.9112, R = 7.614;  B: FS = 1.7440 (kh = 0.1)",
      note: { tr: "Varyant A'da su kotu kretle aynı olduğu için kesitin tamamı doygun kabul edilir; bu, gerçek bir yağmur ya da yükselmiş su sınırı senaryosudur, ortalama koşul değildir. Sonuçlar elle kontrol edilmedi." },
    },
  },
  {
    type: "warn",
    text: {
      tr: "Kesit yönü: program kayan kütlenin −x yönünde hareket ettiğini kabul eder. Test amacıyla aynı yamacı aynalayıp toe'u sağa, kreti sola koyduğumuzda program hata vermedi ve FS ≈ 6 × 10^16 döndürdü. Bu, girdi kontrolünün bu durumu yakalamadığını gösterir. Kesiti çizmeden önce kret ve toe konumunu, sonra programın yakaladığı FS değerinin makul aralıkta olup olmadığını mutlaka kontrol edin.",
      en: "Reversed geometry is not rejected; FS becomes absurdly large (about 6e16).",
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Su seviyesini derinlik olarak girmek; water_level bir kottur (yüzeyin altındaki mesafe değil)." },
      { tr: "Yüzey üstü su göleti varken FS'nin doğru olacağını varsaymak; program yalnız su seviyesinin altındaki basıncı verir." },
      { tr: "Deprem katsayısı k_h ile PGA'yı karıştırmak; k_h boyutsuz bir yatay ivme oranıdır ve yönetmelik seçimine bağlıdır." },
      { tr: "Yük birimini kN/m² yerine kN/m olarak girmek; SurfaceLoad q değerleri kPa'dır." },
      { tr: "Kesit yönünü kontrol etmeden çok büyük FS (örneğin 10'un çok üstü) sonucunu anlamlı kabul etmek; böyle bir değer önce geometriye bakılmasını gerektirir." },
    ],
  },

  // ------------------------------------------------------------------
  // 5
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "5. Daire arama: ızgara, Nelder-Mead ve sınırlar", en: "5. Circle search: grid, Nelder-Mead and bounds" } },
  {
    type: "p",
    text: {
      tr: "Bir yamaçta sonsuz sayıda daire vardır; her biri farklı bir FS verir. Program bu dairelerin arasından en düşük FS'lisini arar. Önce x_c, y_c ve teğet kotu (y_t) için bir ızgara taranır; her ızgara noktasında R = y_c − y_t hesaplanır ve Bishop uygulanır. Sonra en iyi ızgara noktası Nelder-Mead yöntemiyle (x_c, y_c, R) üzerinde iyileştirilir; bu adımda teğet kotu aralığı yine sınırdadır. Bu iki aşama birlikte, ızgaraya takılmadan kritik dairenin yakınında bir minimum bulmayı amaçlar.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Aramanın sonucu, verilen arama sınırlarına bağlıdır. Eğer kritik daire sınırın dışındaysa program yalnız sınır içindeki en iyi daireyi verir ve bunu sessizce yapar. Bu nedenle sınırları kesitin genişliğine göre seçin ve sonuç dairesinin merkezinin sınıra çok yakın olup olmadığını kontrol edin. Ayrıca bir daire 'kabul edilemez' sayılırsa (ör. yay kesitin dışında kalıyorsa ya da m_α < 0.2 ise) arama onu atlar; hiçbir daire kabul edilmezse program açık bir hata verir.",
    },
  },
  {
    type: "figure",
    id: "slp-search-results",
    caption: {
      tr: "Bölüm 4'teki kritik daire şeklinin arama ayrıntısı: aynı yamaç üzerinde x_c ve y_c aralığını gösteren dikdörtgen (ızgara noktaları küçük noktalarla), teğet kotu sınırları (y_t alt ve üst) yatay kesikli çizgilerle. Sınırın dışında kalan bölgeler gri taranmış olsun. Kritik dairenin merkezi sınır içindeyse 'sınır içinde' etiketi, sınıra yakınsa 'sınıra dikkat' kırmızı notu.",
    },
  },
  {
    type: "worked",
    title: { tr: "Örnek 4: dilim sayısının kritik FS'ye etkisi (φ = 25°, kuru)", en: "Example 4: slice count sensitivity" },
    given: [
      { tr: "Aynı kuru yamaç ve aynı arama sınırları; yalnız n_slices değişir" },
    ],
    steps: [
      { label: { tr: "n = 4", en: "n = 4" }, expr: "kritik daire bulunur, kaba dilimleme", result: "FS = 2.029 (R = 10.63)" },
      { label: { tr: "n = 20", en: "n = 20" }, expr: "aynı arama", result: "FS = 2.160" },
      { label: { tr: "n = 40", en: "n = 40" }, expr: "varsayılan", result: "FS = 2.163 (R = 10.23)" },
    ],
    program: {
      input: "search_critical_circle(..., n_slices = 4 | 20 | 40)",
      output: "n=4: 2.0288;  n=20: 2.1595;  n=40: 2.1626",
      note: { tr: "Dilim sayısı 20'nin üstünde FS hızla yakınsıyor; 4 dilim yeterli değildir. Yakınsama, dilim sayısının sonucu nasıl etkilediğini görmek için yapılan bir sınama olup kesin bir hata tahmini değildir." },
    },
  },
  {
    type: "mistakes",
    items: [
      { tr: "Arama sınırını kesitin dışına koyup kritik dairenin sınırda çıktığını fark etmemek." },
      { tr: "Dilim sayısını hız için düşürüp FS'nin küçük çıktığını (tutucu yönde) yanlış okumak; burada düşük dilim sayısı FS'yi düşürdü ama bu her durumda geçerli bir kural değildir." },
      { tr: "Tek bir dairenin FS'sini ('fixed circle') kritik FS sanmak; kritik olan, aramanın bulduğu en düşük değerdir." },
    ],
  },

  // ------------------------------------------------------------------
  // 6
  // ------------------------------------------------------------------
  { type: "h", text: { tr: "6. Sınırlar ve dikkat noktaları", en: "6. Limits and cautions" } },
  {
    type: "figure",
    id: "slp-slip-circle",
    caption: {
      tr: "Bölüm 1'deki şeklin ek paneli, ters geometri: sağ tarafta aynı yamacın aynası (kret solda, toe sağda) çizilsin. Bu panelde kayan kütlenin hareket yönü sağa işaretlensin ve 'program −x varsayımı: uyumsuz; FS anlamsız (≈ 10^16)' uyarısı yazsın. Sol panel doğru kesidi (toe solda) göstersin.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Bu modül yalnız dairesel kayma yüzeyini kullanır. Gerçek bir zeminde kayma yüzeyi bir tabaka sınırı, zayıf bir ara katman ya da kaya yüzeyi boyunca gelişebilir; bu durumlarda dairesel arama sonucu kritik FS'yi fazla tahmin edebilir. Ayrıca Bishop yöntemi dilimler arası kayma kuvvetlerini ihmal eder; sonuç moment dengesini sağlar ama yatay kuvvet dengesini tam sağlamaz. Kuvvet dengesini de sağlayan Spencer ya da Morgenstern-Price yöntemleri ayrı değerlendirme gerektirir ve bu modülün kapsamı dışındadır.",
    },
  },
  {
    type: "p",
    text: {
      tr: "Program kesitin üzerindeki ponded su, çekme çatlağı, dinamik boşluk suyu artışı ve sıvılaşma etkilerini modellemez. Yalancı-statik deprem yaklaşımı sonucu sıvılaşma dayanım kaybını kapsamaz. Zemin parametreleri (c, φ, γ) girdi olarak verilir ve program bunları doğrulamaz; bu değerlerin zemin raporundan ve laboratuvar sonuçlarından gelmesi gerekir. Programın sonucu, yalnızca bu sınırlar içindeki bir hesabın sonucu olarak okunmalıdır.",
    },
  },
  {
    type: "quiz",
    items: [
      {
        q: { tr: "Kayma direnci 150 kN/m ve sürükleyici kuvvet 100 kN/m ise FS kaçtır?" },
        a: { tr: "FS = 150 / 100 = 1.5. Bu, %50 'emniyet' değil, direncin sürükleyiciye oranının 1.5 olduğu anlamına gelir." },
      },
      {
        q: { tr: "Bir dilim genişliği b = 2 m, yüksekliği h = 5 m ve γ = 18 kN/m³ ise dilim ağırlığı W (birim uzunluk başına) kaç kN/m'dir?" },
        a: { tr: "W = γ · h · b = 18 × 5 × 2 = 180 kN/m." },
      },
      {
        q: { tr: "Taban açısı α = 0 olan bir dilimde m_α değeri nedir?" },
        a: { tr: "m_α = cos 0 + sin 0 · tanφ / FS = 1 + 0 = 1." },
      },
      {
        q: { tr: "φ = 30°, FS = 1.0 iken α = 30° olan bir dilimde m_α kaçtır?" },
        a: { tr: "m_α = cos 30° + sin 30° · tan 30° / 1.0 = 0.8660 + 0.5 × 0.5774 = 1.1547." },
      },
      {
        q: { tr: "φ = 25° için tanφ değeri kaçtır?" },
        a: { tr: "tan 25° = 0.4663." },
      },
      {
        q: { tr: "φ = 0 (drenajsız) bir analizde iki dilim için Σ c·b/cos α = 40 kN/m ve Σ W sin α = 25 kN/m ise Bishop FS kaçtır?" },
        a: { tr: "tanφ = 0 olduğundan m_α = cos α ve FS = Σ(c b / cos α) / Σ(W sin α) = 40 / 25 = 1.6." },
      },
      {
        q: { tr: "Su seviyesi 10 m kotunda, dilim tabanı 4 m kotunda ise tabandaki boşluk suyu basıncı u kaç kPa'dır?" },
        a: { tr: "u = γ_w (h_w − y) = 9.81 × (10 − 4) = 58.86 kPa." },
      },
      {
        q: { tr: "Bir dilim için W = 200 kN/m, k_h = 0.1, (y_c − y_g)/R = 0.5 ise deprem sürükleyici katkısı k_h W (y_c − y_g)/R kaç kN/m'dir?" },
        a: { tr: "0.1 × 200 × 0.5 = 10 kN/m." },
      },
      {
        q: { tr: "Programda dilim sayısını 4'ten 40'a çıkarınca kritik FS neden değişir ve hangisi daha güvenilirdir?" },
        a: { tr: "Kaba dilimleme kayma yüzeyini ve dilim ağırlıklarını kaba temsil eder; 4 dilimle FS 2.03, 40 dilimle 2.16 çıkar. Daha fazla dilim (40 varsayılan) sonucu daha iyi yakınsatır; ama her iki değer de aynı kritik dairenin farklı dilimlemeleridir." },
      },
    ],
  },
  {
    type: "glossary",
    items: [
      { term: { tr: "Güvenlik sayısı (FS)" }, def: { tr: "Kayma direncinin sürükleyici kuvvete oranı. FS = 1 sınır durumudur." } },
      { term: { tr: "Sürükleyici kuvvet" }, def: { tr: "Kayma yüzeyinde kütleyi kaydırmaya çalışan, ağırlığın yüzeye teğet bileşenleri." } },
      { term: { tr: "Kayma dairesi" }, def: { tr: "Dairesel kabul edilen kayma yüzeyi; merkez (x_c, y_c) ve yarıçap R ile tanımlanır." } },
      { term: { tr: "Dilim (slice)" }, def: { tr: "Kayan kütlenin dikey kesitlerle ayrılmış parçası; genişlik b, yükseklik h, taban açısı α ve ağırlık W ile tanımlanır." } },
      { term: { tr: "Taban açısı (α)" }, def: { tr: "Dilim tabanının yatayla yaptığı açı; sin α = (x − x_c)/R ile hesaplanır." } },
      { term: { tr: "Kohezyon (c)" }, def: { tr: "Zeminin normal gerilmeden bağımsız kayma direnci bileşeni [kPa]." } },
      { term: { tr: "Sürtünme açısı (φ)" }, def: { tr: "Normal gerilmeyle artan kayma direnci açısı [derece]." } },
      { term: { tr: "Boşluk suyu basıncı (u)" }, def: { tr: "Zemin boşluklarındaki su basıncı; hidrostatik olarak u = γ_w (h_w − y) ile verilir." } },
      { term: { tr: "Su seviyesi (water_level)" }, def: { tr: "Boşluk suyu basıncının sıfır olduğu kotun üstünde hidrostatik u'nun hesaplandığı kot." } },
      { term: { tr: "Bishop basitleştirilmiş yöntemi" }, def: { tr: "Dilimler arası düşey kuvvetleri ihmal eden, moment dengesine dayanan FS yöntemi." } },
      { term: { tr: "m_α" }, def: { tr: "Bishop'ta cos α + sin α tanφ / FS. Payda olarak FS'ye bağlı, iterasyonla çözülür." } },
      { term: { tr: "Kritik daire" }, def: { tr: "Arama sonucunda en düşük FS'yi veren kayma dairesi." } },
      { term: { tr: "Izgara ve Nelder-Mead" }, def: { tr: "Program arama yöntemi: önce ızgara taraması, sonra (x_c, y_c, R) üzerinde Nelder-Mead iyileştirme." } },
      { term: { tr: "Yalancı-statik yaklaşım" }, def: { tr: "Depremi sabit bir yatay ivme katsayısı k_h ile dilim ağırlığına eklenmiş yatay kuvvet olarak temsil eden yöntem." } },
      { term: { tr: "k_h" }, def: { tr: "Yatay deprem katsayısı; boyutsuz, yatay ivmenin yerçekimi ivmesine oranıdır." } },
      { term: { tr: "Yüzey yükü (SurfaceLoad)" }, def: { tr: "Yamaç yüzeyine x1 ile x2 arasında doğrusal değişen düşey basınç [kPa]." } },
      { term: { tr: "Giriş ve çıkış noktası" }, def: { tr: "Kayma dairesinin yüzeyle kesiştiği, sırasıyla kret ve toe tarafındaki x koordinatları." } },
      { term: { tr: "Ters geometri" }, def: { tr: "Kretin toe'un sağında kaldığı, programın −x yön varsayımıyla uyuşmayan kesit; sonuçlar anlamsız olabilir." } },
    ],
  },
  {
    type: "reading",
    items: [
      "Bishop, A.W. (1955). The use of the slip circle in the stability analysis of slopes. Geotechnique 5(1) - kodun atıf yaptığı kaynak; bu oturumda açılamadı.",
      "Das, B.M. Principles of Foundation Engineering - şev stabilitesi bölümü; bölüm numarası doğrulanamadı.",
      "Spencer, E. (1967) ve Morgenstern & Price (1965) - kuvvet dengesini de sağlayan yöntemler için; bu metinde yalnız adları geçer, doğrulanamadı.",
    ],
  },
];
