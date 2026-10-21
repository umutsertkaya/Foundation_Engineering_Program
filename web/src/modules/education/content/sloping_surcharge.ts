import type { Topic } from "./types";

export const topic: Topic = {
  id: "sloping-surcharge",
  title: {
    tr: "Eğimli zemin (β) ve sürşarj",
    en: "Sloping backfill (beta) and surcharge",
  },
  summary: {
    tr: "Programın eğimli dolgu (β) için Rankine ve Coulomb katsayılarını, Mononobe-Okabe deprem artışını, β > φ′ − ψ durumunda TBDY 16.24b'yi, sürşarj yayılışını ve palplanşta bu etkilerin uygulanışını anlatır.",
    en: "The program's sloping backfill (beta) with Rankine and Coulomb coefficients, Mononobe-Okabe seismic increment, TBDY 16.24b for beta > phi' - psi, surcharge distribution, and their use in sheet piles.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/earth_pressure/coefficients.py",
    "geotek/engine/earth_pressure/distribution.py",
    "geotek/engine/earth_pressure/wedge.py",
    "geotek/engine/sheet_pile.py",
    "geotek/engine/walls/walls.py",
    "geotek/engine/walls/layered.py",
    "geotek/services/structures.py",
  ],
  sources: [
    "Rankine (1857) ve Coulomb (1776) eğimli dolgu katsayıları: kod kapalı formları Das (HATIRLANAN, kitap bu incelemede açılamadı).",
    "Mononobe-Okabe (1929) deprem artışı: kaynak bu incelemede kontrol edilmedi. Ebeling & Morrison (1992/1993), Technical Report ITL-92-11: künye doğrulandı, içerik teyit edilmedi.",
    "TBDY 2018, Denk. 16.24b (β > φ′ − ψ) ve Bölüm 16.12.2.8: madde numaraları kodda anıldığı gibidir, yönetmelik metni ile karşılaştırılmadı (açık kalem). Palplanş deprem dağılımı için KDYY Tasarım El Kitabı esas alındı.",
    "EN 1998-5:2004 Ek E, Denk. E.3: TBDY 16.24b ile karşılaştırma için. ERİŞİLEMEDİ.",
    "Das, B.M., sürşarj ve palplanş örnekleri. HATIRLANAN; kitap bu incelemede açılamadı.",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Model ve kapsam", en: "Model and scope" },
    },
    {
      type: "p",
      text: {
        tr: "Bu konu, arka dolgunun yüzeyi yatay değilken (β > 0) basıncın nasıl hesaplandığını anlatır. Dolgu yatay tabakalardan oluşur; eğim tüm kesit boyunca sabit kabul edilir. Sürşarj ise yüzeyde yayılı yük olarak verilir ve basınç diyagramına eklenir.",
        en: "This topic covers earth pressure when the backfill surface is inclined (beta > 0). The backfill is layered, the slope is constant along the section, and surface surcharge is added to the pressure diagram.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Varsayımlar", en: "Assumptions" },
      items: [
        {
          tr: "Eğim β sabittir ve dolgu yüzeyi düzdür; ondülasyon ve kademeli yüzey yoktur.",
          en: "Beta is constant and the surface is planar.",
        },
        {
          tr: "Duvar-zemin sürtünme açısı δ = β (θ = 0) kabul edilir; Coulomb ile Rankine-β bu durumda aynı sonucu verir.",
          en: "Wall friction delta = beta with theta = 0; Coulomb and Rankine-beta then give the same result.",
        },
        {
          tr: "Deprem artışı pseudo-statiktir (k_h, k_v); Mononobe-Okabe kapalı formu kullanılır.",
          en: "Seismic increment is pseudo-static (k_h, k_v) using the Mononobe-Okabe closed form.",
        },
        {
          tr: "Eğimli yüzeydeki yayılı sürşarj q, yatay izdüşümü başına q/cos β olarak alınır (yüzey alanı başına değer).",
          en: "A surcharge q on the sloped surface is taken per unit surface area; its horizontal projection gives q/cos beta.",
        },
      ],
    },
    {
      type: "formula",
      expr: "K_a = cos β · (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ))",
      caption: {
        tr: "Rankine-β aktif katsayısı; bileşke yüzeye paraleldir. Yatay bileşen K_a·cos β'dır.",
        en: "Rankine-beta active coefficient, parallel to the surface. Horizontal component is K_a cos beta.",
      },
      where: [
        {
          tr: "φ: dolgunun içsel sürtünme açısı; β: dolgu yüzey eğimi. β = 0 için K_a = (1 − sin φ)/(1 + sin φ) olur.",
          en: "phi: friction angle; beta: surface slope. For beta = 0 it reduces to the classic Rankine value.",
        },
      ],
    },
    {
      type: "example",
      title: {
        tr: "Doğrulanmış sayılar: φ = 30°",
        en: "Verified numbers: phi = 30 deg",
      },
      text: {
        tr: "Rankine-β K_a (φ = 30°): β = 0° için 0,33333; β = 10° için 0,34952 (yatay bileşen 0,34421); β = 20° için 0,41421 (yatay bileşen 0,38923). Bu değerler formülle hesaplanarak doğrulanmıştır. Sürşarj q = 20 kPa, β = 10° için yatay sürşarj q/cos β = 20,31 kPa'dır.",
        en: "Rankine-beta K_a for phi = 30 deg: beta 0 -> 0.33333, beta 10 -> 0.34952 (horizontal 0.34421), beta 20 -> 0.41421 (horizontal 0.38923). Surcharge q = 20 kPa at beta = 10 deg gives 20.31 kPa per horizontal metre.",
      },
    },
    {
      type: "h",
      text: { tr: "Deprem artışı (Mononobe-Okabe)", en: "Seismic increment (Mononobe-Okabe)" },
    },
    {
      type: "p",
      text: {
        tr: "Deprem etkisinde toplam aktif katsayı, Mononobe-Okabe ile statik değerin üstüne ΔK ekler. Program bu artışı yalnız deprem kuvvetine eklenen kısım olarak tutar. β > φ′ − ψ olduğunda kama çözümü duraysız büyür; bu durumda program TBDY Denklem 16.24b'yi kullanır ve bunu uyarı olarak raporlar.",
        en: "Under seismic action, Mononobe-Okabe adds an increment to the static coefficient. When beta > phi' - psi, the wedge solution grows without bound, so the program switches to TBDY 16.24b and reports a warning.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "β > φ′ − ψ bölgesinde iki yol çok farklı sonuç verebilir: temel yol kama çözümünü, katmanlı yol TBDY 16.24b'yi kullanır. Örnek (φ = 25°, β = 25°, k_h = 0,3) kama K'sının TBDY 16.24b'nin yaklaşık 2900 katı çıktığını gösterir. Bu, eğimin psödo-statik olarak duraysız olabileceğine işarettir; ayrıca şev duraylılığı kontrolü gerekir.",
        en: "For beta > phi' - psi the basic wedge path and the layered TBDY 16.24b path give very different values. This signals that the slope itself may be pseudo-statically unstable.",
      },
    },
    {
      type: "figure",
      id: "ep-active-passive",
      caption: {
        tr: "Aktif ve pasif basınç ilişkisi: eğimli dolgu için aktif yanal basınç dağılımı ve deprem artışı (göster: eğim β ve sürşarj q ile birlikte basınç diyagramı).",
        en: "Active and passive earth pressure: sloping-backfill active distribution with seismic increment.",
      },
    },
    {
      type: "h",
      text: { tr: "Sürşarj yayılışı", en: "Surcharge distribution" },
    },
    {
      type: "p",
      text: {
        tr: "Yüzeydeki sürşarj, dolgunun aktif katsayısı K ile yanal basınca eklenir. Toplam sürşarj kuvveti kapalı formla hesaplanır; bu form deneme kaması çözümüyle, taranan aralıkta yaklaşık %0,01 içinde uyumludur (G9 raporu).",
        en: "Surcharge is added to the lateral pressure through the active coefficient K. The total surcharge force uses a closed form that agrees with a trial-wedge solution to about 0.01 percent in the tested range.",
      },
    },
    {
      type: "formula",
      expr: "P_sürşarj = K · q · H · cos β · cos θ / cos(θ − β)",
      caption: {
        tr: "Eğimli dolgu üzerindeki düzgün sürşarjın toplam yatay kuvvet kapalı formu (kod ile karşılaştırılmış aralık: φ 25–40, β 0–25, θ −10–20).",
        en: "Closed form of the total horizontal surcharge force on sloped backfill, checked over phi 25-40, beta 0-25, theta -10 to 20.",
      },
      where: [
        {
          tr: "q: yüzey alanı başına sürşarj [kPa]; H: duvar yüksekliği [m]; θ: duvar-dolgu hattının eğimi (kod varsayılanında 0).",
          en: "q: surcharge per unit surface area; H: height; theta: wall back inclination (zero in the default case).",
        },
      ],
    },
    {
      type: "figure",
      id: "slope-surcharge-wedge",
      caption: {
        tr: "Eğimli dolgu ve sürşarj: yüzey eğimi β, yayılı sürşarj q, deneme kaması ve aktif basınç bileşenleri (göster: kama sınırı, q/cos β ve yatay sürşarj oku).",
        en: "Sloping backfill and surcharge: surface slope beta, uniform surcharge q, trial wedge and active components.",
      },
    },
    {
      type: "h",
      text: { tr: "Palplanşta β ve sürşarj", en: "Beta and surcharge in sheet piles" },
    },
    {
      type: "p",
      text: {
        tr: "Palplanş modülü, aktif tarafta net basınç diyagramını hesaplarken β ve sürşarjı katman bazında uygular. Deprem artışı KDYY el kitabı dağılımına göre verilir: ΔK_ad = (1 − k_v)·K_AE − K_A olmak üzere, perde ucuna kadar düzgün ½·ΔK_ad·σ′v(uç) ve sürşarj için yüzeyde 2·q·ΔK_ad'den uçta 0'a azalan üçgen bir pay. Uç derinliği artımı etkilediği için program uç derinliğini sabit nokta yinelemesiyle bulur. Artımın uçtan aşağıda etkisi yoktur.",
        en: "The sheet pile net pressure applies beta and surcharge layer by layer. The seismic increment follows the KDYY handbook distribution: with delta K_ad = (1 - k_v)·K_AE - K_A, a uniform part 1/2·delta K_ad·sigma'v(toe) down to the toe plus, for surcharge, a triangle from 2·q·delta K_ad at the surface to 0 at the toe. Because the toe depth affects the increment, the program finds the toe by fixed-point iteration. Below the toe the increment is zero.",
      },
    },
    {
      type: "figure",
      id: "sp-seismic-kdyy",
      caption: {
        tr: "Palplanşta deprem artışının KDYY dağılımı: turuncu düzgün pay uç derinliğine kadar sürer, kırmızı üçgen sürşarj payıdır ve uçta sıfıra iner.",
        en: "KDYY distribution of the seismic increment on a sheet pile: the orange uniform part runs to the toe; the red triangle is the surcharge share and falls to zero at the toe.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Eski uygulama artımı kazı yüksekliği üstünde düzgün, altında ΔK·σ′v olarak veriyordu; KDYY dağılımına göre güvensizdi (φ = 32°, k_h = 0,2 örneğinde konsol D0 8,37 → 9,30 m, M_max 624 → 974 kNm/m). Düzeltildi (PR #36); eski sonuçlarla fark beklenir. ΔK_ad, KDYY örneğiyle birebir doğrulanmadı (TBDY 16.12.2.4 metni elde yok).",
        en: "The earlier code applied the increment uniformly above the dredge line and as delta K·sigma'v below it, which was unsafe relative to the KDYY distribution (phi = 32 deg, k_h = 0.2: cantilever D0 8.37 to 9.30 m, M_max 624 to 974 kNm/m). Corrected (PR 36); expect differences from old results. Delta K_ad was not matched one-to-one against the KDYY worked example (TBDY 16.12.2.4 text unavailable).",
      },
    },
    {
      type: "steps",
      title: {
        tr: "Kullanıcı kontrol listesi",
        en: "User checklist",
      },
      items: [
        {
          tr: "Dolgu eğimi β ve dolgu φ′ değerleri aynı zemin profilinde mi? β > φ′ − ψ ise uyarıyı ve TBDY 16.24b sonucunu incele.",
          en: "Are beta and phi' consistent with the same profile? If beta > phi' - psi, review the warning and the TBDY 16.24b result.",
        },
        {
          tr: "Sürşarj q yüzey alanı başına mı yatay izdüşüm başına mı verildi? Program q/cos β dönüşümünü yapar.",
          en: "Is the surcharge given per surface area or per horizontal projection? The program applies q/cos beta.",
        },
        {
          tr: "Deprem kh/kv değerleri ve kaynağı belgelendi mi?",
          en: "Are the kh and kv values documented with their source?",
        },
      ],
    },
    {
      type: "p",
      text: {
        tr: "Kaynak durumu: Mononobe-Okabe, Ebeling & Morrison ve TBDY 16.24b bu incelemede erişilemedi (HATIRLANAN veya ERİŞİLEMEDİ). Bu konu yalnızca kodun uyguladığı yolu anlatır; yönetmelik metni teyit edilmeden kesin bir kabul sınırı vermez.",
        en: "Source status: Mononobe-Okabe, Ebeling & Morrison and TBDY 16.24b were not accessible in this review. This topic describes the code path only and gives no acceptance limit.",
      },
    },
  ],
};
