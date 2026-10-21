import type { Topic } from "./types";

export const topic: Topic = {
  id: "shear-key",
  title: {
    tr: "İstinat duvarında kayma dişi",
    en: "Retaining wall shear key",
  },
  summary: {
    tr: "Kayma dişinin pasif direncini, diş ucu düzleminden kayma kontrolünü, diş bölgesindeki arka itkiyi ve deprem, su ile sürşarj etkilerini programın gerçekte uyguladığı biçimde anlatır.",
    en: "The shear key as implemented: passive resistance of the key, sliding check on the key-tip plane, the thrust on the key zone behind it, and seismic, water and surcharge effects.",
  },
  level: "advanced",
  codeRefs: [
    "geotek/engine/walls/base.py",
    "geotek/engine/walls/layered.py",
    "geotek/engine/walls/walls.py",
    "geotek/engine/limit_state.py",
    "geotek/services/walls_basic.py",
  ],
  sources: [
    "USACE EM 1110-2-2502 (29 Eylül 1989), Retaining and Flood Walls: kayma dişi ve çoklu kama kontrolü. Künye DTIC kaydından doğrulandı.",
    "Das, B.M., Principles of Foundation Engineering, taban dişi bölümü (D1 = D + diş derinliği ile pasif). HATIRLANAN; kitap bu incelemede açılamadı.",
    "ODTÜ CE366 Recitation 5 P1: diş pasifi örneği (P_p = 65D + 32.5D², FS_p = 2). Program bu örnekle bire bir uyumludur (K_p yuvarlaması farkı hariç).",
    "Mononobe-Okabe pasif ve aktif artımı ve TBDY 2018 Denk. 16.24b: kod içi uygulama; kaynak metinleri karşılaştırılmadı (TBDY madde metni açık kalem).",
  ],
  blocks: [
    {
      type: "h",
      text: { tr: "Kayma dişinin amacı", en: "Purpose of the shear key" },
    },
    {
      type: "p",
      text: {
        tr: "Kayma dişi, duvar tabanının altına uzanan kısa bir betonarme ya da beton perdedir. Temel zemininin kayma direnci yetmediğinde, diş tabanının altındaki zemin ile diş ön yüzündeki pasif direnç, kayma kuvvetini karşılamaya yardım eder. Program bu etkiyi iki ayrı kontrolde ele alır: taban yüzeyinden kayma ve diş ucundan geçen düzlemde kayma.",
        en: "A shear key is a short concrete projection below the wall base. Its passive resistance and the soil below its tip help resist sliding. The program checks sliding on the base surface and on a plane through the key tip.",
      },
    },
    {
      type: "assumptions",
      title: { tr: "Modelin varsayımları", en: "Model assumptions" },
      items: [
        {
          tr: "Diş, duvar tabanının altında düşey bir perde olarak modellenir; genişliği ve derinliği girdi olarak verilir.",
          en: "The key is a vertical wall below the base, with width and depth as inputs.",
        },
        {
          tr: "Diş ön yüzündeki pasif basınç, diş derinliği boyunca hesaplanır; ön dolgu varsa üstteki dolgunun örtüsü de dahil edilir.",
          en: "Passive pressure on the key front acts over its depth, including any soil cover on the front.",
        },
        {
          tr: "Diş bölgesindeki düşey zemin ağırlığı yalnızca diş ucu düzleminin itici kuvvetine girer; devrilme ve taşıma gücü kontrolüne girmez.",
          en: "Weight of the key zone enters only the sliding check on the key-tip plane, not overturning or bearing.",
        },
        {
          tr: "Kayma kontrolünde temel zemininin c′ değeri, diş ucu düzleminin arka itkisinde yok sayılır (tutucu).",
          en: "Cohesion c' is ignored in the key-zone thrust (conservative).",
        },
      ],
    },
    {
      type: "formula",
      expr: "P_p = ½ · K_p · γ · D²   (diş derinliği D boyunca)",
      caption: {
        tr: "Düzgün zemin için diş pasif direnci; ön yüzde yer altı su seviyesi ve örtü ayrıca eklenir.",
        en: "Passive resistance of the key for homogeneous soil; front water and cover are added separately.",
      },
      where: [
        {
          tr: "K_p: temel zemininin pasif katsayısı; γ: diş ön yüzündeki zeminin birim hacim ağırlığı; D: diş derinliği.",
          en: "K_p: passive coefficient of the foundation soil; gamma: unit weight at the key front; D: key depth.",
        },
      ],
    },
    {
      type: "formula",
      expr: "FS_diş-ucu = R_düzlem / (H_itici + ΔH_diş)",
      caption: {
        tr: "Diş ucu düzlemi kontrolünün özeti: diş bölgesi itkisi yalnızca bu düzlemin itici kuvvetine eklenir.",
        en: "Key-tip plane check summary: key-zone thrust is added only to this plane's driving force.",
      },
      where: [
        {
          tr: "ΔH_diş: diş bölgesi itkisi (LS, EQ, WA, su ve diş yanı ataleti dahil); taban yüzeyi kontrolünde kullanılmaz (kod davranışı). Yöneten FS, iki düzlemden küçük olanıdır.",
          en: "Key-zone thrust is not used in the base-surface check. The governing FS is the smaller of the two planes.",
        },
      ],
    },
    {
      type: "h",
      text: {
        tr: "Diş ucu düzlemi: arka itkinin kayma kontrolüne eklenmesi",
        en: "Key-tip plane: adding the thrust behind the key",
      },
    },
    {
      type: "p",
      text: {
        tr: "Diş ucundan geçen yatay düzlemde kayan blok, tabanın altından diş tabanına kadar uzanır. Arka taraftaki zemin bu bloğu diş tabanına kadar iter. Taban yüzeyinde yapılan kontrol bu itkiyi görmez; bu yüzden tabanda yeterli görünen bir duvar, diş ucu düzleminde daha düşük güvenlik verebilir.",
        en: "On a horizontal plane through the key tip, the sliding block extends below the base to the key bottom. Soil behind pushes that block toward the key bottom. A base-surface check misses this thrust, so the key-tip plane can govern.",
      },
    },
    {
      type: "figure",
      id: "shear-key-planes",
      caption: {
        tr: "Kayma dişi ve iki kayma düzlemi: taban yüzeyi ile diş ucu düzlemi, diş bölgesi itkisi, pasif direnç ve düşey ağırlıklar (göster: arka itki oku diş ucu düzleminden aşağıya kadar, pasif ok diş ön yüzünde).",
        en: "Shear key with the base plane and the key-tip plane, key-zone thrust, passive force and weights.",
      },
    },
    {
      type: "steps",
      title: {
        tr: "Diş ucu düzleminde kontrol adımları",
        en: "Steps for the key-tip plane check",
      },
      items: [
        {
          tr: "Topuk hattında düşey bir düzlem al; taban seviyesinden diş tabanına kadar uzanan bölgeyi ayır.",
          en: "Take a vertical line through the heel from base level down to the key bottom.",
        },
        {
          tr: "Bu bölgede katman bazında Coulomb K_a hesapla (δ = β, θ = 0) ve temel zemininin K_a'sını kullan.",
          en: "Compute layer-wise Coulomb K_a on that line (delta = beta, theta = 0), using the foundation soil.",
        },
        {
          tr: "Sürşarj, deprem artışı, arka su ve TBDY 16.20 dinamik su artışını ekle; önde hidrostatik artışı (WA) çıkar.",
          en: "Add surcharge, seismic increment, back water and TBDY 16.20 dynamic water; front hydrostatic increment is subtracted.",
        },
        {
          tr: "Diş yanı zeminin ataleti (depremde k_h·W) ve düşey zemin ağırlığını (depremde 1 − k_v ile çarpılmış) yalnız bu düzlemin itici kuvvetine ekle.",
          en: "Add key-side soil inertia (k_h W in seismic cases) and vertical soil weight (times 1 - k_v in seismic cases) to this plane only.",
        },
        {
          tr: "Diş ucu düzlemi direncini hesapla ve yöneten yüzeyin FS değerini raporla; taban ve diş ucu düzlemi sonuçlarından küçük olanı yönetir.",
          en: "Compute the resistance on the key-tip plane and report the governing FS as the smaller of the two surfaces.",
        },
      ],
    },
    {
      type: "example",
      title: {
        tr: "El örneği: H = 6 m, topukta 0,5 × 0,6 m diş",
        en: "Hand example: H = 6 m, 0.5 x 0.6 m key at the heel",
      },
      text: {
        tr: "φ_temel = 30° için K_a = 1/3. Diş ucu düzleminde ek itki: K_a·(118·0,6 + ½·18·0,6²) = (70,8 + 3,24)/3 = 24,68 kN/m. Taban yüzeyi kontrolü yalnız taban yüzeyine bakar. Diş ucu düzlemi FS'si 2,00 → 1,66 düşer ve yöneten yüzey taban yüzeyinden diş ucu düzlemine geçer. Kayma FS'si 1,85 → 1,66 olur. Bu rakamlar G9 incelemesindeki el hesabı ile aynıdır.",
        en: "For phi = 30 deg, K_a = 1/3. Extra key-tip thrust = 24.68 kN/m. Key-tip plane FS drops from 2.00 to 1.66 and governs; overall sliding FS drops from 1.85 to 1.66.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Bu tutucu bir yaklaşımdır: diş ucu düzleminde düşey bileşen ihmal edilir ve c′ sıfır alınır. Sonuç, kayma FS'sini taban kontrolünden daha düşük çıkarabilir; yönetici düzlemin hangisi olduğu rapordan okunmalıdır.",
        en: "This is conservative: the vertical component and c' are ignored. The governing plane should be read from the report.",
      },
    },
    {
      type: "h",
      text: { tr: "Deprem, su ve sürşarj", en: "Seismic, water and surcharge" },
    },
    {
      type: "p",
      text: {
        tr: "Sürşarj (LS) arka itkiye, deprem artışı (EQ) Mononobe-Okabe ile hesaplanır. β > φ′ − ψ ise TBDY 16.24b kullanılır; katmanlı yol ile aynı kural geçerlidir. Ön ayak ve diş pasifi depremde, M-O pasif oranı K_PE/K_P ile azaltılır. Örnek φ = 30°, k_h = 0,2, k_v = 0,1 için oran 0,775'tir (G9 raporu, B3).",
        en: "Surcharge (LS) is added to the back thrust; seismic increment (EQ) uses Mononobe-Okabe, with TBDY 16.24b when beta > phi' - psi. Front and key passive are reduced by K_PE/K_P in seismic cases.",
      },
    },
    {
      type: "warn",
      text: {
        tr: "Drenajsız temel zemininde eğimli dolgu veya deprem varsa diş bölgesi itkisi hesaplanamaz. Analiz açık hatayla durur; dişsiz duvar bu durumda çalışabilir. Bu bir görünür sınırdır, sessiz bir geçiş yoktur.",
        en: "Undrained foundation with sloping backfill or seismic loads stops the key-zone analysis with an explicit error.",
      },
    },
    {
      type: "figure",
      id: "wall-stability-checks",
      caption: {
        tr: "Duvar kontrolleri: kayma (taban ve diş ucu düzlemi), devrilme ve taşıma gücü; diş bölgesi itkisi yalnız kayma kontrolüne girer.",
        en: "Wall checks: sliding on base and key-tip plane, overturning and bearing; key-zone thrust enters only sliding.",
      },
    },
    {
      type: "p",
      text: {
        tr: "Diş derinliği taşıma gücü hesabında gömülme derinliğine eklenmez; bu yüzden taşıma gücü sonucu her durumda tutucu kalır. Kod bu değeri ayrıca görünür varsayım olarak raporlar.",
        en: "Key depth is not added to the embedment in the bearing capacity check, so bearing results stay conservative.",
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
          tr: "Diş genişliği ve derinliği yapısal tasarımla tutarlı mı? Diş V ve M talepleri betonarme tasarımı değildir.",
          en: "Are key width and depth consistent with structural design? Key V and M demands are not reinforced concrete design.",
        },
        {
          tr: "Pasif azaltma katsayısı (varsayılan 0,5) bilinçli seçildi mi? Kaynak örnekte FS_p = 2 kullanılır.",
          en: "Is the passive reduction factor (default 0.5) a deliberate choice? A reference example uses FS_p = 2.",
        },
        {
          tr: "Ön zemin kazı veya oyulmayla kalkabiliyorsa diş pasifinin örtüsü sıfır (D = 0 yönlendirmesi) girilmiş mi?",
          en: "If front soil can be removed, was the cover handled as zero?",
        },
        {
          tr: "Depremde kh ve kv değerlerinin kaynağı belgelendi mi?",
          en: "Are the kh and kv values documented with their source?",
        },
      ],
    },
    {
      type: "p",
      text: {
        tr: "Kaynak durumu: USACE EM 1110-2-2502 ve Das kitabı bu incelemede açılamadı (HATIRLANAN). Umut'tan istenecek kaynak listesi G9 raporunda yer alır; bu konu kaynaklara dayanan bir sayı üretmez.",
        en: "Source status: USACE EM 1110-2-2502 and Das were not accessible for this review (recalled only).",
      },
    },
  ],
};
