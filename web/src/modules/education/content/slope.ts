import type { Topic } from "./types";

export const topic: Topic = {
  id: "slope-stability",
  title: {
    tr: "Şev stabilitesi: Bishop yöntemi",
    en: "Slope stability: Bishop method",
  },
  summary: {
    tr: "Programın dairesel kayma yüzeyleri için Bishop basitleştirilmiş yöntemini, tabakalı zemini, su ve yük etkisini ve kritik daireyi arama yöntemini anlatır.",
    en: "The Bishop simplified method for circular slip surfaces as implemented: layered soil, water, surface loads and the critical circle search.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/stability.py",
    "geotek/engine/walls/global_stability.py",
    "geotek/core/constants.py",
  ],
  sources: [
    "Bishop, A.W. (1955). The use of the slip circle in the stability analysis of slopes. Geotechnique 5(1).",
    "Kod ici atif: stability.py modul docstring'i (Bishop 1955, Geotechnique 5(1)).",
    "Pseudo-statik sismik yaklasim: kh agirlik carpani olarak uygulanir (stability.py); kh degerinin kaynagi kod disindadir.",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Model ve kapsam", en: "Model and scope" },
    },
    {
      type: "p",
      text: {
        tr: "Bu konu, programın dairesel kayma yüzeyi için kullandığı Bishop basitleştirilmiş yöntemini anlatır. Model, yüzeyi nokta listesiyle verilen iki boyutlu bir kesittir. Zemin yatay tabakalardan oluşur; her tabaka kendi üst kotundan bir alttaki tabakanın üst kotuna kadar uzanır.",
        en: "This topic explains the Bishop simplified method for circular slip surfaces. The model is a 2D section: the surface is a list of points and the soil is horizontal layers, each running from its top elevation down to the next layer top.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Varsayımlar", en: "Assumptions" },
      items: [
        {
          tr: "Kayma yüzeyi daire yayıdır; kayan kütle −x yönünde hareket eder.",
          en: "The slip surface is a circular arc; the sliding mass moves toward -x.",
        },
        {
          tr: "Kayma yüzeyi üzerinde Bishop'un dilim denge koşulu kullanılır (dilimler arası düşey kesme kuvvetleri ihmal edilir).",
          en: "Bishop's slice equilibrium is used: vertical interslice shear forces are neglected.",
        },
        {
          tr: "Su: yatay su seviyesi (water_level) altında hidrostatik boşluk suyu basıncı u = γw·(su seviyesi − taban kotu). Yüzeyin üstünde suyun birikmesi (ponded su) yoktur.",
          en: "Pore pressure is hydrostatic below a horizontal water level; no ponded water above the surface.",
        },
        {
          tr: "Yüzeydeki düşey yükler (SurfaceLoad) doğrusal değişen q(x) olarak dilim ağırlığına eklenir.",
          en: "Vertical surface loads vary linearly along x and add to the slice weight.",
        },
        {
          tr: "Sismik etki pseudo-statiktir: kh yalnızca dilim ağırlıklarına uygulanır; ek sismik basınç ve dinamik su yoktur.",
          en: "Seismic action is pseudo-static: kh multiplies the slice weights only.",
        },
      ],
    },
    {
      type: "formula",
      expr: "F = Σ[ (c·b + (W − u·b)·tanφ) / mα ]  /  Σ[ W·sinα + kh·W·(yc − yg)/R ]",
      caption: {
        tr: "Bishop basitleştirilmiş güvenlik sayısı (stability.py, satır 3). Pay ve paydadaki Σ tüm dilimler üzerinden alınır.",
        en: "Bishop simplified factor of safety, summed over all slices.",
      },
      where: [
        { tr: "c, φ: dilim tabanındaki tabakanın kohezyonu [kPa] ve içsel sürtünme açısı.", en: "c, phi: cohesion and friction angle of the layer at the slice base." },
        { tr: "b: dilim genişliği; W: dilim ağırlığı [kN/m]; u: dilim tabanındaki boşluk suyu basıncı [kPa].", en: "b: slice width; W: slice weight per metre; u: pore pressure at slice base." },
        { tr: "α: dilim tabanı eğimi; R: daire yarıçapı; yc: merkez kotu; yg: dilim ağırlık merkezinin kotu.", en: "alpha: base inclination; R: radius; yc: centre elevation; yg: slice centroid elevation." },
      ],
    },
    {
      type: "formula",
      expr: "mα = cos α + sin α · tanφ / F",
      caption: {
        tr: "Bishop'un m_α katsayısı. F ile çözüm gereklidir; kod bunu yinelemeli olarak çözer.",
        en: "Bishop m_alpha term; the equation for F is solved iteratively.",
      },
    },
    {
      type: "steps",
      title: { tr: "Tek daire için çözüm adımları", en: "Steps for one circle" },
      items: [
        {
          tr: "Merkez (xc, yc) ve yarıçap R ile daire ile yüzeyin kesiştiği giriş ve çıkış noktalarını bul; arcın yalnızca yüzeyin altında kaldığı en uzun aralık alınır.",
          en: "Find the entry and exit points where the circle meets the ground; use the longest run where the arc is below the surface.",
        },
        {
          tr: "Aralığı n_slices (varsayılan 40) eşit genişlikli dilime böl; her dilim için taban kotu, yüzey kotu, ağırlık ve α hesapla.",
          en: "Split the interval into n_slices (default 40) equal slices and compute base, top, weight and alpha.",
        },
        {
          tr: "F = 1 ile başla; her yinelemede yeni F'yi hesapla, |F_yeni − F| < 1e-6 olana kadar sürdür (en fazla 200 yineleme).",
          en: "Start from F = 1 and iterate until the change is below 1e-6 (max 200 iterations).",
        },
        {
          tr: "Çıkış tarafındaki (α < 0) bir dilimde mα < 0,2 çıkarsa daire reddedilir; mα ≤ 0 olan daire de reddedilir.",
          en: "Reject the circle if any m_alpha <= 0, or if an exit-side slice (alpha < 0) has m_alpha < 0.2.",
        },
      ],
    },
    {
      type: "example",
      title: { tr: "Elle doğrulanmış küçük örnek (φ = 0)", en: "Hand-checked small example (phi = 0)" },
      text: {
        tr: "Üç dilim, φ = 0, c = 30 kPa, b = 2 m. α = 30°, 10°, −10°; W = 200, 300, 150 kN/m; u = 0, kh = 0. Pay: c·Σ(b/cos α) = 30 · (2,309 + 2,031 + 2,031) ≈ 191,1. Payda: Σ W·sin α = 100 + 52,1 − 26,1 ≈ 126,0. F = 191,1 / 126,0 ≈ 1,52. φ = 0 için mα = cos α olduğundan yineleme tek adımda biter.",
        en: "Three slices, phi = 0, c = 30 kPa, b = 2 m, alpha = 30, 10, -10 deg, W = 200, 300, 150 kN/m. F = 191.1 / 126.0 = 1.52.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Örnek dilim tablosu el ile seçilmiştir; geometriden üretilmiş bir koşu değildir. Dilim sayısı ve geometri değiştiğinde sonuç değişir. Kabul edilebilir F hedefi bu konuda uydurulmaz; kod tarafında güvenlik faktörü tablosundan gelir.",
        en: "The slice table is hand-picked, not generated from a geometry. Acceptance factors are not set in this topic.",
      },
    },
    {
      type: "figure",
      id: "slope-bishop-slice",
      caption: {
        tr: "Dairesel kayma yüzeyi ve dilimler: merkez, yarıçap R, dilim tabanı α, su seviyesi ve yüzey yükü (göster: kayan kütle −x yönünde, dilim numaraları ve W etiketleri).",
        en: "Circular slip surface with slices: centre, radius R, base angle alpha, water level and surface load.",
      },
    },
    {
      type: "h",
      text: { tr: "Kritik daireyi arama", en: "Critical circle search" },
    },
    {
      type: "p",
      text: {
        tr: "Kod, ilk olarak merkez (xc), merkez kotu (yc) ve teğet kotu (yt, R = yc − yt) için bir ızgara tarar: varsayılan 15 × 15 × 12. En düşük F veren daire seçilir; sonra Nelder-Mead ile (xc, yc, R) iyileştirilir, teğet kotu aralığı içinde kalacak şekilde sınırlandırılır. Daire merkezi kot yüzeyin altındaysa veya arc model sınırında hâlâ yer altındaysa daire reddedilir.",
        en: "The code scans a grid of centres and tangent elevations (default 15 x 15 x 12), keeps the lowest F, then refines with Nelder-Mead within the tangent range. Circles whose arc is still below ground at the model boundary are rejected.",
      },
    },
    {
      type: "figure",
      id: "slope-search-domain",
      caption: {
        tr: "Kritik daire arama alanı: merkez ızgarası, teğet kotu aralığı ve iki kritik adayın karşılaştırılması (göster: ızgara noktaları, en düşük F'li daire vurgulu).",
        en: "Critical circle search domain: centre grid, tangent range and the best candidate highlighted.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Dairesel yöntem yalnızca tek bir daire için F üretir; kritik daire aramanın global minimumunu garanti etmez. Kayma yüzeyi düzlemsel veya bileşik ise (zayıf tabaka) bu model yetersiz kalabilir; sonuç ayrıca kontrol edilmelidir.",
        en: "A grid plus local refinement does not guarantee the global minimum. Planar or composite failure surfaces are outside this model.",
      },
    },
    {
      type: "p",
      text: {
        tr: "Sınırlar: çıkış tarafındaki (α < 0) dilimlerde m_α < 0,2 olan daireler reddedilir (kod sabiti M_ALPHA_MIN = 0,2); bu, paydanın kararsızlaşmasını önler. Kesişmeyen veya sıfır uzunluklu daireler sonuç üretmez.",
        en: "Limits: exit-side slices with m_alpha < 0.2 reject the circle (M_ALPHA_MIN); arcs with no valid intersection return no result.",
      },
    },
    {
      type: "steps",
      title: { tr: "Kullanıcı girdileri kontrol listesi", en: "User input checklist" },
      items: [
        {
          tr: "Tabaka kotları ve birim ağırlıkları (γ) yüzey kotuna göre tutarlı girilmiş mi?",
          en: "Are layer tops and unit weights consistent with the surface?",
        },
        {
          tr: "Su seviyesi zemin kesitinin içinde mi; ponded su gerekiyorsa modelin dışında mı?",
          en: "Is the water level inside the section, and is ponded water handled outside the model?",
        },
        {
          tr: "Sismik kh değeri hangi standarda göre üretildi ve kaynağı belgelendi mi?",
          en: "Is the kh value documented with its source standard?",
        },
      ],
    },
    {
      type: "p",
      text: {
        tr: "Sonuç, bir daire için F değeridir; bu değerin kabul sınırı değildir. F < 1 olan daire, modelde kaydığı anlamına gelir; sonuç sadece modelin varsayımları içinde yorumlanmalıdır.",
        en: "The output is the F value for one circle; it is not an acceptance limit. F < 1 means the modelled mass slides under these assumptions.",
      },
    },
  ],
};
