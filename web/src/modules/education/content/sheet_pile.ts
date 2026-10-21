import type { Topic } from "./types";

export const topic: Topic = {
  id: "sheet-pile",
  title: {
    tr: "Palplanş: konsol gömülme ve moment hesabı",
    en: "Sheet pile walls: cantilever embedment and moment",
  },
  summary: {
    tr: "Programın tek sıra konsol palplanşta net basınç, Blum tipi denge, gömülme artışı ve maksimum momenti nasıl hesapladığı.",
    en: "How the program computes net pressure, Blum-type balance, embedment increase and maximum moment for a single-row cantilever sheet pile.",
  },
  level: "intermediate",
  codeRefs: [
    "geotek/engine/sheet_pile.py",
    "geotek/engine/earth_pressure/distribution.py",
    "geotek/engine/earth_pressure/coefficients.py",
    "geotek/engine/limit_state.py",
    "geotek/services/structures.py",
  ],
  sources: [
    "Rankine, W.J.M. (1857). On the stability of loose earth. Phil. Trans. Royal Society.",
    "Blum, H. (1931). Einspannungsverhaltnisse bei Bohlwerken. Berlin: Wilhelm Ernst & Sohn.",
    "U.S. Army Corps of Engineers (1994). Design of Sheet Pile Walls. Engineer Manual EM 1110-2-2504, Washington, D.C.",
    "Kodun atif yaptigi serbest zemin destegi (free earth support) yontemi: kod docstring'i; USS Steel Sheet Piling Design Manual surumu dogrulanamadi, atif verilmedi.",
    "Kod ici atif: TBDY 16.12.2.8 (sismik artis, sheet_pile.py docstring).",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Kapsam ve birim", en: "Scope and units" },
    },
    {
      type: "p",
      text: {
        tr: "Bu konu, programın tek sıralı konsol (serbest uçlu, ankrajsız) palplanşta gömülmeyi ve maksimum eğilme momentini nasıl bulduğunu anlatır. Hesap birim metre duvar içindir: kuvvetler kN/m, momentler kNm/m, gerilmeler kPa ve kesit modülü cm³/m cinsindendir. Derinlikler geri dolgu üst yüzeyinden (z = 0) ölçülür; kazı tabanı z = H seviyesindedir.",
        en: "This topic explains how the program finds embedment and maximum bending moment for a single-row cantilever sheet pile. Results are per metre of wall: forces in kN/m, moments in kNm/m, stresses in kPa, section modulus in cm3/m. Depths are measured from the retained ground surface (z = 0); the dredge line is at z = H.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Modelin varsayımları", en: "Model assumptions" },
      items: [
        {
          tr: "Duvar şerit (2B) kabulüyle çalışır; üç boyutlu etki, köşe ve bağlantı yoktur.",
          en: "The wall is treated as a 2D strip; no 3D, corner or connection effects.",
        },
        {
          tr: "Aktif ve pasif basınç Rankine ile hesaplanır (varsayılan yöntem); duvar-zemin sürtünmesi varsayılanda sıfırdır (active_delta = passive_delta = 0).",
          en: "Active and passive pressures use Rankine by default; wall-soil friction is zero by default.",
        },
        {
          tr: "Kazı tabanının üstündeki pasif basınç sıfırdır; pasif basınç yalnızca z > H için, kazı tabanından aşağı ölçülen düşey gerilmeyle hesaplanır.",
          en: "Passive pressure is zero above the dredge line and acts only for z > H, using the vertical stress measured below the dredge line.",
        },
        {
          tr: "Su hidrostatiktir. Geri tarafta tasarım su seviyesi (GWT) kullanılır; ön tarafta max(GWT, kazı tabanı) veya verilen front_water_depth alınır. Sızma (seepage) modellenmez.",
          en: "Water is hydrostatic. Behind the wall the design GWT is used; in front max(GWT, dredge line) or the given front_water_depth. Seepage is not modelled.",
        },
        {
          tr: "Konsol kazıkta toprak tepkisi, Blum yaklaşımında kazı tabanının altındaki tek bir R tekil kuvveti ile temsil edilir.",
          en: "In the cantilever case the soil reaction below the toe is replaced by a single concentrated force R (Blum approach).",
        },
      ],
    },
    {
      type: "h",
      text: { tr: "Basınç ve net diyagram", en: "Pressure and net diagram" },
    },
    {
      type: "formula",
      expr: "Ka = tan²(45° − φ/2),   Kp = tan²(45° + φ/2)   (yatay yüzey, β = 0, δ = 0)",
      caption: {
        tr: "Rankine katsayıları (coefficients.py: rankine_ka / rankine_kp, β = 0 durumu).",
        en: "Rankine coefficients (coefficients.py, beta = 0 branch).",
      },
      where: [
        { tr: "φ: tasarım efektif içsel sürtünme açısı (profil design parametresi).", en: "phi: design effective friction angle." },
      ],
    },
    {
      type: "formula",
      expr: "p_aktif(z) = Ka·(σ'v(z) + q) + γw·max(0, z − GWT)     (z ≥ 0)",
      caption: {
        tr: "Aktif toplam basınç: sürşarj q, Ka ile çarpılarak efektif düşey gerilmeye eklenir (surcharge sheet_pile için düşey gerilmeye eklenir, distribution.py).",
        en: "Active total pressure: surcharge q is added to the vertical stress before multiplication by Ka.",
      },
    },
    {
      type: "formula",
      expr: "p_pasif(z) = Kp·σ'v(z − H) / GS + γw·max(0, z − max(GWT, H))     (z > H)",
      caption: {
        tr: "Pasif toplam basınç; GS (passive_factor) pasif efektif basıncı böler, su kısmı bölünmez.",
        en: "Passive total pressure; GS (passive_factor) divides the effective passive part only, water is not divided.",
      },
      where: [
        { tr: "σ'v(z − H): kazı tabanının altındaki düşey efektif gerilme.", en: "Effective vertical stress below the dredge line." },
        { tr: "GS: pasif direnç güvenlik faktörü (passive_factor ≥ 1).", en: "GS: passive resistance factor (passive_factor >= 1)." },
      ],
    },
    {
      type: "formula",
      expr: "p_net(z) = p_aktif(z) − p_pasif(z)     (pozitif = duvarı kazıya doğru iter)",
      caption: {
        tr: "Net basınç. Kod, sıçramalı (kırılmalı) diyagramları yaklaşık 0,002 m adımla ve her kırılma noktasında sol/sağ limitleri ayrı alarak integre eder.",
        en: "Net pressure. The code integrates on a 0.002 m grid and treats each breakpoint with left and right limits.",
      },
    },
    {
      type: "formula",
      expr: "Σ M_toe = ∫₀^(H+D0) p_net(z)·(H + D0 − z) dz = 0",
      caption: {
        tr: "Kazı tabanının altında (z > H) kökü aranan moment dengesi; kod buna F(z)·z − ∫p_net·z dz olarak ulaşır (cantilever_sheet_pile, moment_about).",
        en: "Moment balance about the toe; the root is sought below the dredge line.",
      },
      where: [
        { tr: "D0: kazı tabanından kök derinliğine kadar teorik gömülme.", en: "D0: theoretical embedment from the dredge line to the root." },
      ],
    },
    {
      type: "formula",
      expr: "D = D0 × (1 + artış),   artış = 0,20 (varsayılan, konsol)",
      caption: {
        tr: "Tasarım gömülmesi. Konsolda varsayılan artış 0,20'dir (limit_state ve structures.py), kullanıcı değeri verilirse o kullanılır.",
        en: "Design embedment. Default increase for cantilevers is 0.20; a user value overrides it.",
      },
    },
    {
      type: "formula",
      expr: "R = F(H + D0) = ∫₀^(H+D0) p_net(z) dz",
      caption: {
        tr: "Blum toe kuvveti. Kod toe_force alanına F(toe) değerini yazar; işaret net diyagramın toplamıdır, büyüklük R'nin büyüklüğüdür.",
        en: "Blum toe force. The code stores F(toe) in toe_force; the sign follows the net diagram, the magnitude is R.",
      },
    },
    {
      type: "steps",
      title: { tr: "Hesap adımları (kod sırasıyla)", en: "Calculation steps (code order)" },
      items: [
        {
          tr: "Aktif ve pasif diyagramı, kazı tabanı kırılmalarıyla birlikte z = 0 … profil alt sınırı aralığında üret.",
          en: "Build active and passive diagrams with breakpoints at the dredge line and layer boundaries.",
        },
        {
          tr: "Net diyagramı oluştur (net = aktif − pasif/GS + su farkı).",
          en: "Form the net diagram.",
        },
        {
          tr: "H'den sonra ilk işaret değişimini (kök) bul; brentq ile 1e-6 m toleransla iyileştir. Kök yoksa profil yetersizdir hatası verilir.",
          en: "Find the first sign change below H and refine with brentq (tolerance 1e-6 m); no root is an error.",
        },
        {
          tr: "D = D0 × (1 + artış) hesapla; H + D profil alt sınırını aşıyorsa uyarı ekle.",
          en: "Compute D and warn if the embedment goes beyond the profile bottom.",
        },
        {
          tr: "Kesme kuvveti V(z) ve moment M(z) değerlerini toe'ya kadar kümülatif integrasyonla bul; |M|'nin maksimumu M_max ve konumu z_M_max'tır.",
          en: "Integrate shear and moment up to the toe; M_max is the largest |M| and z_M_max its depth.",
        },
        {
          tr: "Verilen izinli gerilmeden kesit modülünü S = M_max / σ_izin (kNm/m ÷ MPa × 1000) ile hesapla.",
          en: "Section modulus S = M_max / allowable stress, converted to cm3/m.",
        },
      ],
    },
    {
      type: "figure",
      id: "sp-cantilever",
      caption: {
        tr: "Konsol palplanş: geri ve ön tarafta aktif/pasif diyagram, kazı tabanı H, teorik D0 ve tasarım D, Blum tekil kuvveti R (göster: duvar kesiti, basınç oklar, z = 0 üst yüzey).",
        en: "Cantilever sheet pile: active and passive diagrams, dredge line H, D0 and design D, Blum toe force R.",
      },
    },
    {
      type: "example",
      title: { tr: "Elle doğrulanmış örnek", en: "Hand-checked example" },
      text: {
        tr: "Veriler: γ = 18 kN/m³, φ = 30°, su yok, sürşarj yok, GS = 1 (passive_factor = 1). Ka = 1/3, Kp = 3. Aktif: 6z (z ≥ 0). Pasif: 54·(z − H) (z > H). Kazı tabanı altında net: 6H − 48u (u = z − H). Moment dengesi toe'da: 8D³ − 9D² − 27D − 27 = 0, kök D0 ≈ 2,78 m. Tasarım D = 1,2 × 2,78 ≈ 3,33 m. Toe kuvveti |R| ≈ 108 kN/m. Sıfır kesme u = 1,5 m (z = 4,5 m) noktasında; M_max ≈ 60,8 kNm/m, z_M_max ≈ 4,5 m. Kontrol: M(toe) ≈ 0.",
        en: "Data: gamma = 18 kN/m3, phi = 30 deg, no water, no surcharge, GS = 1. Ka = 1/3, Kp = 3. Net below dredge line: 18 - 48u. Toe balance gives D0 = 2.78 m, D = 3.33 m, |R| = 108 kN/m, M_max = 60.8 kNm/m at z = 4.5 m.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu örnek el hesabıdır; kod trapez integrasyonla çalışır, sonuçlar birkaç yüzde farklı çıkabilir. Yalnızca modelin davranışını göstermek içindir, kabul kriteri değildir.",
        en: "This is a hand calculation; the code uses trapezoidal integration and may differ by a few percent. Illustrative only.",
      },
    },
    {
      type: "figure",
      id: "sp-net-diagram",
      caption: {
        tr: "Net basınç diyagramı: kazı tabanında (z = H) sıçrama, sıfır geçişi ve kazı altında negatif bölge; kesme ve moment eğrileri alt panelde (göster: z = 0..toe, sıfır kesme noktası işaretli).",
        en: "Net pressure diagram with the jump at the dredge line, zero crossing and the shear/moment panel below (mark the zero-shear depth).",
      },
    },
    {
      type: "p",
      text: {
        tr: "Sürşarj q, aktif tarafta düşey gerilmeye eklenip Ka ile çarpılır; ayrı bir yanal artış değildir. Eğimli geri dolgu, Rankine yönteminde yalnızca β ≤ φ için tanımlıdır (aksi durumda hata verilir). Palplanşta pasif tarafta sürtünme varsayılanı sıfırdır.",
        en: "Surcharge q adds to the vertical stress before Ka. A sloping backfill is valid for beta <= phi under Rankine; otherwise an error is raised.",
      },
    },
    {
      type: "formula",
      expr: "p_pasif,tasarım = p_pasif / GS      (GS = passive_factor)",
      caption: {
        tr: "Pasif direnç güvenlik faktörü. Tasarım kodunda GS, seçilen yönteme göre (EC7 γR,e veya LRFD φ, global FS) değişir; kod 1,0 altındaki GS'yi reddeder.",
        en: "Passive resistance factor. Its value depends on the design code; the engine rejects passive_factor < 1.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Kod, tasarım gömülmesi profil alt sınırını aşarsa 'Design embedment extends below the soil profile' uyarısı verir; sonuç yine de döner. Bu durumda profil derinleştirilmeden sonucu kullanmayın. Sızma, dinamik su ve ponded su modellenmez.",
        en: "If the design embedment goes below the profile bottom, a warning is returned but a result is still given. Do not use it without deepening the profile. Seepage and ponded water are not modelled.",
      },
    },
    {
      type: "figure",
      id: "sp-passive-factor",
      caption: {
        tr: "Pasif GS'nin etkisi: aynı profilde GS = 1 ve GS = 1,5 için pasif diyagramın değişimi ve D'nin artışı (göster: iki eğri karşılaştırmalı, etiketli).",
        en: "Effect of GS on the passive diagram and the required D (two labelled curves for GS = 1 and GS = 1.5).",
      },
    },
  ],
};
