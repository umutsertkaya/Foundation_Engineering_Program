import type { Topic } from "./types";

export const topic: Topic = {
  id: "earth_pressure",
  title: { tr: "Yanal toprak basıncı ve istinat duvarı kontrolleri", en: "Lateral earth pressure and retaining wall checks" },
  summary: {
    tr: "Rankine, Coulomb, Mononobe-Okabe ve sayısal kama yöntemleri; sürşarj, eğimli zemin, kayma dişi ve duvar devrilme, kayma, taşıma ve global stabilite kontrolleri.",
    en: "Rankine, Coulomb, Mononobe-Okabe and trial-wedge methods; surcharge, sloping ground, tension crack and wall stability checks.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/earth_pressure/coefficients.py",
    "geotek/engine/earth_pressure/distribution.py",
    "geotek/engine/earth_pressure/wedge.py",
    "geotek/engine/earth_pressure/log_spiral.py",
    "geotek/engine/stresses.py",
    "geotek/engine/limit_state.py",
    "geotek/engine/walls/base.py",
    "geotek/engine/walls/walls.py",
    "geotek/engine/walls/global_stability.py",
    "geotek/config/design_codes/asd.yaml",
    "geotek/core/models/walls.py",
  ],
  sources: [
    "Rankine, W.J.M. (1857). On the stability of loose earth. Phil. Trans. Royal Society.",
    "Coulomb, C.A. (1776). Essai sur une application des règles de maximis et minimis.",
    "Mononobe, N. & Matsuo, H. (1929); Okabe, S. (1926). Earth pressure during earthquakes.",
    "Seed, H.B. & Whitman, R.V. (1970). Design of earth retaining structures for dynamic loads.",
    "Das, B.M. Principles of Foundation Engineering, Ch. 7 (toprak basıncı).",
    "FHWA GEC-3 (FHWA-NHI-11-032), sismik toprak basinci: kodun atif yaptigi kaynak; bolum numarasi dogrulanamadi.",
    "TBDY 2018, Denklem 16.22, 16.24b ve Tablo 16.7; EN 1998-5 Ek E (kodun atıf yaptığı maddeler).",
    "Bishop, A.W. (1955). The use of the slip circle in the stability analysis of slopes (global stabilite).",
  ],
  blocks: [
    { type: "h", text: { tr: "1. Neyi hesaplıyoruz", en: "1. What is computed" } },
    {
      type: "p",
      text: {
        tr: "Bir istinat duvarının arkasındaki zemin, duvara yanal bir basınç uygular. GeoTek bu basıncı katmanlı bir profil üzerinde, bir düşey düzlem boyunca dağıtılmış olarak hesaplar ve sonra duvarın devrilme, kayma, taşıma ve genel (global) stabilitesini kontrol eder. Basınç katsayısı K, yöntem ve zemin özelliğine göre seçilir.",
        en: "GeoTek computes lateral pressure on a vertical plane through a layered profile, then checks overturning, sliding, bearing and global stability.",
      },
    },
    { type: "h", text: { tr: "2. Rankine yöntemi (düşey düzlem, β = 0 ve β > 0)", en: "2. Rankine method (vertical plane)" } },
    {
      type: "formula",
      expr: "K_a = tan²(45° − φ/2)   (β = 0)\nK_p = tan²(45° + φ/2)   (β = 0)",
      caption: { tr: "Yatay zemin için Rankine katsayıları" },
    },
    {
      type: "formula",
      expr: "K_a = cos β · (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ))\nK_p = cos β · (cos β + √(cos²β − cos²φ)) / (cos β − √(cos²β − cos²φ))",
      caption: { tr: "Eğimli dolgu (β ≤ φ) için kodun kullandığı kapalı biçim" },
      where: [{ tr: "β > φ ise kod hata verir (Rankine için β ≤ φ zorunlu)." }],
    },
    {
      type: "formula",
      expr: "σ'_h = K_h (σ'_v + q) − 2 c' √K   (aktif, en az 0)\nσ'_h = K_h (σ'_v + q) + 2 c' √K   (pasif)\nσ'_h = K_0 (σ'_v + q),  K_0 = 1 − sin φ'   (sükunet, Jaky)",
      caption: { tr: "Katman başına yatay efektif basınç; kod sükunet için yalnız yatay dolguda çalışır" },
      where: [
        { tr: "σ'_v: efektif düşey gerilme (stresses.py, su tablasına göre); q: sürşarj" },
        { tr: "Toplam yatay basınç = σ'_h + u (hidrostatik boşluk suyu basıncı)" },
      ],
    },
    { type: "h", text: { tr: "3. Coulomb ve kayma yüzeyi", en: "3. Coulomb and the sliding surface" } },
    {
      type: "formula",
      expr: "K_a = cos²(φ − θ) / [cos²θ · cos(δ + θ) · (1 + √( sin(φ + δ) sin(φ − β) / (cos(δ + θ) cos(θ − β)) ))²]",
      caption: { tr: "Coulomb aktif katsayısı (kod: coulomb_ka)" },
      where: [
        { tr: "δ: duvar–zemin arayüz sürtünmesi; θ: duvar yüzünün düşeyden eğimi (pozitif ise yüzün üstü zeminin üzerine taşacak şekilde, zeminden uzağa eğimlidir; kod işaret kuralı coefficients.py başlığında); β: dolgu eğimi (pozitif yukarı, duvardan uzağa)" },
        { tr: "Yatay bileşen K·cos(δ + θ) ile çarpılarak yatay basınç elde edilir; kuvvet δ kadar eğiktir." },
      ],
    },
    {
      type: "formula",
      expr: "K_p = cos²(φ + θ) / [cos²θ · cos(δ − θ) · (1 − √( sin(φ + δ) sin(φ + β) / (cos(δ − θ) cos(β − θ)) ))²]",
      caption: { tr: "Coulomb pasif katsayısı (düzlem yüzey)" },
    },
    {
      type: "p",
      text: {
        tr: "Düzlem kayma yüzeyi varsayımı tipik sürtünmeli dolgularda kabul edilebilirdir. Pasif tarafta δ > φ/2 ise Coulomb pasif basıncı aşırı büyük çıkar (kod uyarı verir); bu durumda kod log-spiral (log_spiral.py) çözümünü kullanabilir ama yalnız yatay dolgu, pasif durum için tanımlıdır.",
        en: "Planar Coulomb passive pressure is unconservative for δ > φ/2.",
      },
    },
    { type: "h", text: { tr: "4. Sürşarj, eğimli zemin ve sayısal kama", en: "4. Surcharge, sloping ground and the trial wedge" } },
    {
      type: "p",
      text: {
        tr: "Düşey sürşarj q, kamanın ağırlığına q·(x_g − x_a) olarak eklenir; sürşarj kaynaklı yatay itki duvar yüksekliğinin yarısında (H/2) uygulanır. Eğimli dolgu, eğimli duvar yüzü ve sürşarj birlikte, wedge.py içinde planar bir kayma düzlemi boyunca tarama (720 nokta) ve sınırlı bir skaler minimizasyonla çözülür. Sonuç P [kN/m] ve K = P / (½γH²(1 − k_v)) değeridir; kritik düzlem açısı rho ölçülür.",
        en: "The trial wedge searches planar failure planes for the maximum active force.",
      },
    },
    {
      type: "formula",
      expr: "P = ½ γ H² K_a   (aktif, tek katman yaklaşımı)\nSürşarj kaynaklı itki: P_q = K_a · q · H (duvar yüksekliğinin yarısında uygulanır)",
      caption: { tr: "Basit basınç bileşenleri; kod sürşarj bileşenini ayrı kuvvet olarak ekler (LS)" },
    },
    { type: "h", text: { tr: "5. Sismik basınç (Mononobe-Okabe ve TBDY)", en: "5. Seismic pressure (Mononobe-Okabe and TBDY)" } },
    {
      type: "formula",
      expr: "ψ = atan( k_h / (1 − k_v) )\nK_AE = cos²(φ − θ − ψ) / [cos ψ · cos²θ · cos(δ + θ + ψ) · (1 + √( sin(φ + δ) sin(φ − β − ψ) / (cos(δ + θ + ψ) cos(β − θ)) ))²]\nP_AE = ½ γ H² (1 − k_v) K_AE",
      caption: { tr: "Mononobe-Okabe aktif; kodda mononobe_okabe_kae" },
      where: [
        { tr: "Çözüm yalnız φ − β − ψ ≥ 0 iken vardır; aksi halde kod hata verir ve genelleştirilmiş kama (trial wedge) gerekir." },
      ],
    },
    {
      type: "p",
      text: {
        tr: "β > φ − ψ olduğunda kod, TBDY 2018 Denklem 16.24b (EN 1998-5 E.3 ile uyumlu) biçimini kullanır: K_AE = cos²(φ − θ − ψ) / [cos ψ cos²θ cos(δ + θ + ψ)], β'dan bağımsızdır ve cos(δ + θ + ψ) > 0 gerektirir. Bu yol yalnız steep_seismic seçeneğiyle açılır ve uyarı üretir.",
        en: "TBDY 16.24b is used for steep backfill only when steep_seismic is set.",
      },
    },
    {
      type: "formula",
      expr: "k_h = 0.4 S_DS / r,   k_v = 0.5 k_h   (TBDY 2018 Denk. 16.22; r: Tablo 16.7 duvar hareketi)\nk_h = F_pga · PGA · f   (GEC-3 yaklaşımı; f = 0.5 ya da 1.0)",
      caption: { tr: "Sismik katsayılar; hangi yöntemin seçildiği kullanıcı girdisine bağlıdır" },
    },
    {
      type: "p",
      text: {
        tr: "Kod ayrıca Seed-Whitman artış ΔK_AE ≈ 0.75 k_h (dinamik artış, yaklaşık 0.6H yüksekliğinde) fonksiyonunu içerir; duvar yük modeli (walls) TBDY için artış yüksekliğini 0.5H olarak ayarlamanıza izin verir. Hangi yolun hangi duvar akışında kullanıldığını kod akışından doğrulayın.",
        en: "Seed-Whitman increment is provided as a helper; the wall model uses seismic_increment_height.",
      },
    },
    { type: "h", text: { tr: "6. Katman dağılımı ve diyagram", en: "6. Layered distribution and diagram" } },
    {
      type: "p",
      text: {
        tr: "Basınç diyagramı, katman sınırları, su tablası, çekme çatlağı derinliği ve minimum EFP kırılmaları olan noktalarda değerlendirilir; yatay kuvvet ve merkez derinliği bu düğümler üzerinden tam (piecewise-lineer) olarak integre edilir. Aktif durumda negatif efektif basınç bölgesi (çekme çatlağı) sıfırlanır ve uyarı verilir.",
        en: "Pressure is piecewise linear; resultant and centroid are integrated exactly.",
      },
    },
    {
      type: "example",
      title: { tr: "Örnek 1: Rankine aktif (φ = 30°, c = 0, β = 0)", en: "Example 1: Rankine active" },
      text: {
        tr: "K_a = tan²(30°) = 0.333; γ = 18 kN/m³, H = 4 m, q = 0. Taban basıncı σ_h = 0.333 · 18 · 4 ≈ 24.0 kPa; yatay kuvvet P = ½ · 24.0 · 4 = 48.0 kN/m; etkime noktası H/3 = 1.33 m. Coulomb ile δ = 0, θ = 0, β = 0 girildiğinde aynı K_a = 0.333 çıkar (elle doğrulandı).",
        en: "Ka = 0.333, P = 48 kN/m at 1.33 m.",
      },
    },
    {
      type: "example",
      title: { tr: "Örnek 2: Çekme çatlağı (c' = 10 kPa, φ = 20°, γ = 18)", en: "Example 2: Tension crack" },
      text: {
        tr: "K_a = tan²(35°) ≈ 0.490, √K ≈ 0.700. σ_h = 0.490 · 18 · z − 2 · 10 · 0.700 = 8.82 z − 14.0. Negatif bölge z < 14.0/8.82 ≈ 1.59 m; kod bu bölgeyi sıfırlar ve 'çekme çatlağı' uyarısı verir.",
        en: "Tension crack depth about 1.59 m.",
      },
    },
    {
    type: "figure",
    id: "ep-active-passive",
    caption: {
      tr: "Aktif ve pasif durum: duvar zeminden uzaklaşırsa arkadaki zemin aktif kamaya (45° + φ′/2), zemine doğru itilirse pasif kamaya (45° − φ′/2) geçer; σa = K_a·σ′v, σp = K_p·σ′v.",
      en: "Active and passive states: when the wall moves away the retained soil forms an active wedge (45° + φ′/2); when pushed into the soil it forms a passive wedge (45° − φ′/2); σa = K_a·σ′v, σp = K_p·σ′v.",
    },
  },
    { type: "h", text: { tr: "7. İstinat duvarı kontrolleri (ASD)", en: "7. Retaining wall checks (ASD)" } },
    {
      type: "formula",
      expr: "FS_ot = M_R / M_O  (devrilme)\nFS_sl = (ΣV · tan δ_b + c_a · B') / ΣH  (kayma; pasif direnç yalnız use_passive ile)\ne = B/2 − x_R;  e/B ≤ 1/6 (zemin, statik)\nFS_b = Q_ult / ΣV  (taşıma)",
      caption: { tr: "Duvar kontrolleri (base.py, evaluate_checks)" },
      where: [
        { tr: "M_R ve M_O: toe (ön uç) etrafında düşey ve yatay bileşenlerin momentleri (kNm/m)" },
        { tr: "Taşıma kontrolünde e > B/6 ise q_min = 0 ve üçgen basınç dağılımı kullanılır; |e| ≥ B/2 durumunda kontrol başarısızdır." },
      ],
    },
    {
      type: "example",
      title: { tr: "Örnek 3: Kayma kontrolü", en: "Example 3: Sliding check" },
      text: {
        tr: "ΣV = 100 kN/m, δ_b = 25° (tan25° = 0.466), c_a = 0, ΣH = 30 kN/m. FS_sl = 100 · 0.466 / 30 = 1.55 ≥ 1.5 (ASD statik, sliding). Pasif direnç ve taban sürtünmesi için tasarım kararını mühendis verir.",
        en: "FS_sl = 1.55 vs ASD 1.5.",
      },
    },
    {
    type: "figure",
    id: "wall-stability-checks",
    caption: {
      tr: "Gravite duvarının üç temel kontrolü: devrilme, kayma ve taban basıncı.",
      en: "The three basic gravity-wall checks: overturning, sliding and base pressure.",
    },
  },
    {
      type: "p",
      text: {
        tr: "Global stabilite: Bishop daireleri taban altından geçecek biçimde aranır; dolgu ve temel bantları ASD için karakteristik ağırlıkla çalışır. ASD gereksinimi statik 1.5, sismik 1.1 olarak asd.yaml'da tanımlıdır; kısmi faktörlü kodlarda (EC7, TBDY) aynı kontrol gamma_R ile yapılır.",
        en: "Global stability uses Bishop circles below the base.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Uyarılar: (1) ASD katsayıları asd.yaml'da 'secondary' veya 'unverified' işaretlidir; devrilme 2.0 değeri doğrudan kaynaklı değildir, mühendis onayı şarttır. (2) Pasif kayma direnci varsayılan olarak kapalıdır ve kullanıldığında indirgeme 0.5'tir. (3) Sayısal kama 720 noktalı taramadır; sonuç yaklaşıktır. (4) Drenajsız sismik toprak basıncı uygulanmamıştır. (5) Mononobe-Okabe, φ − β − ψ < 0 iken çözümsüzdür. (6) Global stabilitede yapı ağırlıkları dışında dolgu dilimleri karakteristik ağırlıkla çalışır; DA1-C1 faktörleme ve düşey ivme modellenmez. (7) Duvar yüzü sürtünme açısı δ'nın kullanıcı girdisi ya da varsayılanı nasıl türetildiği, kod akışından ayrıca doğrulanmalıdır.",
        en: "ASD factors are secondary/unverified; passive reduction 0.5; trial wedge is approximate.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu içerik eğitim amaçlıdır. Hesap formülü ve katsayıları değişirse el hesabı, regresyon ve iki bağımsız inceleme gerekir; bu modülün çıktısı tek başına tasarım onayı yerine geçmez.",
        en: "Educational content only; not a design approval.",
      },
    },
  ],
};
