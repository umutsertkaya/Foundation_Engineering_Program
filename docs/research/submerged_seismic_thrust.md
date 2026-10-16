# Seismic active earth thrust with retained soil below the groundwater table

Research note, compiled 2026-10-16. Scope: Turkish practice (TBDY 2018, Kazi Destek Yapilari mevzuati) against EN 1998-5 Annex E and US practice.
Convention used below: "[SAYS]" = read directly in the primary source; "[INFER]" = my reading or extrapolation; "[NOT VERIFIED]" = could not be read.

---------------------------------------------------------------------

## 0. Bottom line

1. TBDY 2018 Section 16.12 (retaining structures) already contains a submerged-backfill rule set. It is a near copy of EN 1998-5:2004 Annex E, with the same three cases (water below wall base / dynamically impervious / dynamically pervious) and the same permeability threshold of 5x10^-4 m/s. A Turkish engineer therefore does not need to import EC8 or Matsuzawa-type formulas to be code-compliant. TBDY Denk. (16.26a-c) is the governing formulation.
2. Two differences from EC8 were found (section 3.3): the pervious-case numerator unit weight, and the treatment of liquefaction safety factor / free water in front of the wall.
3. Neither TBDY nor EC8 gives a rule for PARTIAL submergence (water table somewhere within the retained height). That has to be handled by engineering judgement and flagged.
4. The "Kazi Destek Yapilari" regulation and its annex exist, but I could not read the annex or the Tasarim El Kitabi text (files too large for the fetch tool or certificate error). I cannot say what, if anything, they add on water below the table. Treat as an open item. See section 2.

---------------------------------------------------------------------

## 1. TBDY 2018, Section 16.12 (checked: primary text)

**Document.** Turkiye Bina Deprem Yonetmeligi (TBDY-2018), published in Resmi Gazete 18 March 2018, mukerrer, No. 30364. Annex text read from the Resmi Gazete PDF: https://www.resmigazete.gov.tr/eskiler/2018/03/20180318M1-2-1.pdf (416 pages; Section 16.12 is on printed pages 354-357, PDF pages 375-378). Companion: AFAD hosts a copy at https://www.afad.gov.tr/kurumlar/afad.gov.tr/2309/files/TBDY_2018.pdf (listed in search results, not opened). I did not check whether any later amendment changed Section 16.12; the Resmi Gazete 2018 text is what was read.

Title of 16.12: "Deprem Etkisi Altinda Dayanma Yapilarinin Tasarimi Icin Kurallar".

### 1.1 What the text says [SAYS]

- **16.12.2.1, Denk. (16.22):** kh = 0.4 S_DS / r and kv = 0.5 kh. The r values are in Tablo 16.7: 2.0 for gravity walls allowed up to 120 S_DS mm displacement, 1.5 for gravity walls allowed up to 80 S_DS mm, 1.0 for anchored walls and gravity walls allowed no displacement.
- **16.12.2.2:** where saturated soils may develop high excess pore pressure, r must not be taken larger than 1.
- **16.12.2.3, Denk. (16.23):** total (static + dynamic) thrust resultant is Pt = K(1 -/+ kv)(0.5 gamma* H^2 + q H) + Psu + dPsu. K is the total (static + dynamic) Mononobe-Okabe coefficient; Psu and dPsu are the resultant static and dynamic water forces.
- **16.12.2.4-16.12.2.5, Denk. (16.24a,b) and (16.25):** Mononobe-Okabe total active and passive coefficients containing theta.
- **16.12.2.6:** theta and gamma* depend on whether there is water behind the wall; values are given in 16.12.3.
- **16.12.2.7:** static case uses theta = 0; the dynamic coefficient is total minus static.
- **16.12.2.8-16.12.2.9:** dynamic resultant acts at mid-height of the wall (at the same point as the static force for walls free to rotate about the toe); thrust inclination at most (2/3)phi' for active.
- **16.12.3.1:** the intent is that drainage measures keep the retained soil from sitting below the water table; the drainage system must tolerate seismic displacement without losing function.
- **16.12.3.2, Denk. (16.26a-c):**
  - (a) Water level below the wall base: tan(theta) = kh/(1 -/+ kv), gamma* = gamma (natural unit weight), Psu = dPsu = 0.
  - (b) Water level above the wall base AND soil dynamically impervious, stated in the text as permeability coefficient smaller than 5x10^-4 m/s: tan(theta) = [gamma_d/(gamma_d - gamma_su)] x kh/(1 -/+ kv), gamma* = gamma_d - gamma_su, dPsu = 0. Here gamma_d is the saturated unit weight (TBDY's symbol; "suya doygun zemin birim hacim agirligi") and gamma_su is unit weight of water.
  - (c) Water level above the wall base AND soil dynamically pervious: tan(theta) = [gamma/(gamma_d - gamma_su)] x kh/(1 -/+ kv), gamma* = gamma_d - gamma_su. The added dynamic water force dPsu and its depth are taken from Denk. (16.20).
- **Denk. (16.20), in 16.11.3 (basement walls):** dPsu = (7/12)(0.4 S_DS) gamma_su d_su^2, acting at 0.6 d_su below the water surface; d_su is the water height against the wall. The distribution (16.19) is (7/8)(0.4 S_DS) gamma_su sqrt(z d_su). This is the Westergaard parabola.
- The plus/minus sign is to be chosen as the most unfavourable; the same sign for active and passive (slide text accompanying the equations).

Corroboration of the equation images: IMO/AFAD training deck "TBDY-2018 Kisim 16" (slides 84-91, https://ankara.imo.org.tr/Eklenti/8165,bolum16-02-08-2022-imo-ankarapdf.pdf) and IMO Ankara worked examples dated 26.01.2023 (https://ankara.imo.org.tr/Eklenti/8164,16-examples-imo-ankarapdf.pdf, slides 23-28 and 38-39). These are training material, not regulation. The worked example uses dPsu from (16.20) with S_DS = 0.75.

### 1.2 What I checked and did not find [SAYS / not found]

- Section 16.12 contains no rule for hydrodynamic pressure of free water standing in front of or outside the wall (the EC8 E.8 / 7.3.2.4 situation). Section 16.11.3 covers dynamic water in a partly dry basement wall only.
- No rule for partially submerged backfill (water table inside the retained height). Cases (b) and (c) are written for "water level above the wall base" and the formulas apply gamma_d - gamma_su as gamma* for the whole backfill height.
- No liquefaction safety factor requirement inside 16.12.2.2 (EC8 has one, see below). Liquefaction is dealt with in 16.6 and Ek 16B (not read in detail).
- No explicit permeability threshold for case (c); the pervious case is implied to be everything not covered by (b).

---------------------------------------------------------------------

## 2. "Kazi Destek Yapilari" (excavation support) regulation

### 2.1 Existence, title, dates [SAYS: via Resmi Gazete page and secondary summaries]

- **Kazi Destek Yapilari Hakkinda Yonetmelik**, issued by the Ministry of Environment, Urbanisation and Climate Change (Cevre, Sehircilik ve Iklim Degisikligi Bakanligi), Resmi Gazete 18 December 2022, No. 32047. Article 1 says it covers excavation support structures under both static loads and earthquake loads. Article 4 sends the technical rules to the annex "Kazi Destek Yapilari Tasarim ve Uygulama Esasları".
  - Text page: https://www.alomaliye.com/2022/12/18/kazi-destek-yapilari-hakkinda-yonetmelik/ ; mevzuat.gov.tr entry MevzuatNo=39898 (annex only as a zip).
- **Amendment of the annex:** "Kazi Destek Yapilari Hakkinda Yonetmelikte Degisiklik Yapilmasina Dair Yonetmelik", Resmi Gazete 16 July 2026, No. 33311. It replaces the whole annex "Tasarim ve Uygulama Esasları" with an attached version; effective on publication. Annex file: https://www.resmigazete.gov.tr/eskiler/2026/07/20260716-1-1.pdf (over 10 MB; not readable with my fetch tool). Secondary: https://legalbank.net/belge/kazi-destek-yapilari-hakkinda-yonetmelikte-degisiklik-yapilmasina-dair-yonetmelik/7031729
- **Kazi Destek Yapilari Yonetmeligi Tasarim El Kitabi**, July 2023 edition, published by the Ministry's Yapi Isleri Genel Mudurlugu; written by a working group of Istanbul Universitesi-Cerrahpasa geotechnical division (Kelesoglu, Oztoprak, Bozbey, Oser and others). Announcement dated 10 July 2023: https://yapiisleri.csb.gov.tr/kazi-destek-yapilari-yonetmeligi-tasarim-el-kitabi-yayimlanmistir-haber-283477 . File: https://webdosya.csb.gov.tr/db/yapiisleri/haberler/kddy-tasar-m-el-k-tab--temmuz-2023-20230710131330.pdf (certificate error on fetch). Mirror: https://imo.org.tr/Eklenti/8349,kddy-tasar-m-el-k-tab---temmuz-2023-20230710131330compressedpdf.pdf?0= (too large / server error on fetch). Per secondary summaries it contains 27 solved problems covering static, pseudo-static and dynamic loading, and time-history analysis under TBDY for deep excavations (KK-2 deeper than 15 m, all KK-3).

### 2.2 What it says about seismic earth pressure below the water table

**[NOT VERIFIED].** I could read only the regulation body (Articles 1-6), which contains no technical rule on earth pressure or water. I could not open either the 2022 annex, the 2026 replacement annex, or the Tasarim El Kitabi, so I cannot confirm or deny that they (a) refer to TBDY 16.12, (b) fix kh differently, or (c) add water rules. Search results (secondary) suggest the handbook has figures for active and passive seismic pressure envelopes and a pseudo-static method, which is consistent with a TBDY-based approach, but nothing on pore water was seen.
Because the annex was entirely replaced in July 2026 and the handbook dates from 2023, any handbook reading should be checked against the 2026 annex.
Action for whoever continues: obtain the three PDFs locally (these are public, large files) and search for: deprem, pseudo-statik, kh, yeraltı suyu, hidrodinamik, geçirimli, boşluk suyu.

---------------------------------------------------------------------

## 3. EN 1998-5:2004 (Eurocode 8, Part 5) (checked: primary text)

**Document.** EN 1998-5:2004 (E), "Design of structures for earthquake resistance - Part 5: Foundations, retaining structures and geotechnical aspects", copy read at https://www.phd.eng.br/wp-content/uploads/2014/11/en.1998.5.2004.pdf (47 pages).

### 3.1 What it says [SAYS]

- **7.3.2.2, Eq. (7.1)-(7.3), Table 7.1:** kh = alpha S / r; kv = +/-0.5 kh if avg/ag > 0.6, otherwise +/-0.33 kh. r = 2 (free gravity walls, up to 300 alpha S mm), 1.5 (up to 200 alpha S mm), 1 (flexural RC walls, anchored or braced walls, restrained basement walls, bridge abutments).
- **7.3.2.2(5):** in saturated cohesionless soils prone to high pore pressure, r must not exceed 1.0 and the liquefaction safety factor must not be below 2.
- **7.3.2.3(7)-(12):** for soil under the water table, distinguish dynamically pervious (water free to move relative to the skeleton) from dynamically impervious (essentially no drainage during the earthquake). For most common situations, and for coefficient of permeability below 5x10^-4 m/s, the pore water is not free to move, the shaking is essentially undrained and the soil may be treated as single phase. For the impervious condition, the usual provisions apply with a modified unit weight and modified kh (E.6, E.7). For pervious backfill, soil and water effects are uncoupled and hydrodynamic water pressure is added to hydrostatic pressure per E.7; it may act at 60 % of the saturated layer height below its top.
- **7.3.2.4 and E.8, Eq. (E.18):** free water against the outer face of the wall: q(z) = +/-(7/8) kh gamma_w sqrt(h z), with kh computed using r = 1; this is the Westergaard form.
- **Annex E (normative), E.1 (total force), E.4 (M-O coefficients):**
  - E.5 water table below the wall: gamma* = gamma; tan(theta) = kh/(1 -/+ kv); Ewd = 0.
  - E.6 dynamically impervious soil below the water table: gamma* = gamma - gamma_w; tan(theta) = [gamma/(gamma - gamma_w)] kh/(1 -/+ kv), with gamma the saturated unit weight; Ewd = 0 (Eq. E.12-E.14).
  - E.7 dynamically (highly) pervious soil below the water table: gamma* = gamma - gamma_w; tan(theta) = [gamma_d/(gamma - gamma_w)] kh/(1 -/+ kv), with gamma_d the DRY unit weight; Ewd = (7/12) kh gamma_w H'^2 where H' is the height of the water table above the wall base (Eq. E.15-E.17).
  - E.9: fully restrained rigid walls use an at-rest-type increment.

### 3.2 Note on the user's equation numbering
The numbering the question gives (E.6 impervious, E.7 pervious) matches EN 1998-5:2004 exactly. The prEN 1998-5 second generation (published as EN 1998-5:2024, with a prA1 amendment in public enquiry in 2026) may renumber and may revise these clauses; I could not access its text. [NOT VERIFIED]

### 3.3 TBDY versus EC8 (my comparison) [INFER where marked]

| Item | EN 1998-5:2004 | TBDY 2018 |
|---|---|---|
| kh | alpha S / r | 0.4 S_DS / r |
| kv | +/-0.5 kh or +/-0.33 kh | 0.5 kh (sign to be taken as unfavourable) |
| r with excess pore pressure | <= 1.0, and liquefaction FS >= 2 | <= 1.0 (no FS statement inside 16.12.2.2) |
| Impervious threshold | k < 5x10^-4 m/s | k < 5x10^-4 m/s (in case (b)) |
| Impervious tan(theta) | gamma_sat/(gamma_sat - gamma_w) kh/(1-/+kv) | same |
| gamma* | gamma - gamma_w | gamma_d(sat) - gamma_su, same |
| Pervious tan(theta) | numerator gamma_d = DRY unit weight | numerator gamma = "tabii" (natural) unit weight |
| Pervious water force | (7/12) kh gamma_w H'^2 | (7/12)(0.4 S_DS) gamma_su d_su^2, acts 0.6 d_su below water surface |
| Free water outside the wall | E.8 (7/8) kh gamma_w sqrt(hz), r = 1 | not in 16.12 |

[INFER] The TBDY pervious numerator "gamma" is probably a drafting variation. EC8 physically needs the dry unit weight (the solid skeleton's mass, since the pore water moves independently). Using TBDY's natural unit weight gives slightly larger theta, so it is conservative; the gamma versus gamma_d choice can change theta by a few degrees only. The TBDY water term uses 0.4 S_DS directly (equivalent to r = 1, no kv), consistent with EC8 E.8.

### 3.4 Illustration (my calculation; kh = 0.20, kv = 0.5kh, gamma_sat = 20, gamma_d = 16, gamma_w = 9.81 kN/m3, sign 1 - kv)
- Dry soil or water below wall base: theta about 12.5 deg.
- Impervious submerged: theta about 23.6 deg, gamma* = 10.19 kN/m3.
- Pervious submerged: theta about 19.2 deg, gamma* = 10.19 kN/m3, plus a dynamic water force of (7/12)(0.2)(9.81) H'^2 = 1.14 H'^2 kN/m.
The large rise in theta in the impervious case is what makes the submerged case governing in effective-weight terms, but the buoyant weight (gamma*) is small, so the thrust is not necessarily larger in absolute terms than the dry case; the static water pressure Psu is a separate and usually larger term.

---------------------------------------------------------------------

## 4. US practice (secondary access only)

- **Ebeling and Morrison (1992),** "The Seismic Design of Waterfront Retaining Structures", US Army Corps of Engineers Technical Report ITL-92-11 / NCEL TR-939 (DTIC ADA265707). Search summaries state it covers submergence, liquefaction potential, excess pore pressure, inertial and hydrodynamic forces, and that the Mononobe-Okabe method was modified for full or partial submergence by Matsuzawa et al. (1985) and Ebeling and Morrison. The document returned HTTP 403, so I did not read equations. [NOT VERIFIED]
- **AASHTO LRFD Bridge Design Specifications** (Section 11.6.5 and Appendix A11), **FHWA GEC-3 / NCHRP Report 611** (Anderson et al., 2008), **USACE EM 1110-2-2502** were not accessible in text form in this session. I make no claim about their wording. NCHRP 611 Volume 2 is where submerged-backfill rules are likely located. [NOT VERIFIED]
- A paper on seismic displacement of rigid walls (WCEE) paraphrases EC8: with impervious submerged backfill there is no hydrodynamic pressure from the backfill, consistent with Ewd = 0 above. Secondary literature repeats that partially submerged backfill is more complicated than the two limiting cases.

---------------------------------------------------------------------

## 5. Recommendation for a Turkish engineer and for software

### 5.1 Most defensible formulation
Use TBDY 16.12 as written, because it is the binding Turkish building code, and it is consistent with EC8 Annex E (the reference international practice). Concretely:

1. kh = 0.4 S_DS / r, kv = 0.5 kh (Denk. 16.22), r from Tablo 16.7. For excavation support walls that are anchored or propped and allow no displacement, r = 1.0. If saturated soil can build high excess pore pressure, r <= 1.0 regardless (16.12.2.2).
2. Water table below the wall base: theta = atan[kh/(1 -/+ kv)], gamma* = gamma, no water term.
3. Water table above the wall base, soil with k < 5x10^-4 m/s (clays, silts, silty and fine sands): treat as dynamically impervious: theta = atan[gamma_sat/(gamma_sat - gamma_w) x kh/(1 -/+ kv)], gamma* = gamma_sat - gamma_w, dPsu = 0. Static water pressure Psu still acts in Denk. (16.23).
4. Water table above the wall base, soil with k >= 5x10^-4 m/s (clean coarse sand, gravel, rockfill): treat as dynamically pervious: theta = atan[gamma_d(dry)/(gamma_sat - gamma_w) x kh/(1 -/+ kv)], gamma* = gamma_sat - gamma_w, plus dPsu = (7/12)(0.4 S_DS) gamma_w d_su^2 at 0.6 d_su below the water surface. Use the EC8 dry unit weight in the numerator (more physical) or the TBDY literal natural unit weight (slightly conservative); show which one was used.
5. Use the Denk. (16.24) coefficient with theta, subtract the static (theta = 0) coefficient to get the dynamic increment, apply the dynamic resultant at mid-height (flexible or tied-back walls) and keep wall friction delta <= (2/3) phi'.
6. Layers with differing permeability: classify each by its own k; if the layers disagree, take the case giving the higher total thrust.

### 5.2 Gaps the software should not hide
- Partial submergence: neither code covers it. Simple option [INFER, engineering judgement, not from a code]: apply the above formulas only when the whole retained height is below the water table, and for partial submergence either (i) use a layered / trial-wedge calculation with theta and gamma* varying by layer, or (ii) bound the result using the all-dry and all-submerged cases and show both.
- "Wall base" for embedded walls (diaphragm, pile, soldier pile): TBDY and EC8 refer to the wall base without defining it for embedded excavation walls. State which level was used (excavation level versus wall toe).
- Free water on the outer face (flooded excavation, adjacent water body): not in TBDY 16.12; EC8 E.8 gives the Westergaard parabola q(z) = (7/8) kh gamma_w sqrt(hz) with r = 1. If the user has such a case, the software should say it is using the EC8 rule as a supplement.
- Liquefaction or high excess pore pressure: r <= 1; EC8 also asks for a liquefaction safety factor of at least 2; TBDY 16.6 / Ek 16B for the check itself.
- Kazi Destek Yapilari annex and handbook: unread (section 2). The software documentation should not claim conformity with those documents until they have been read.

### 5.3 Suggested warning text for the software (English; Turkish equivalent to follow)
"Submerged backfill: the seismic thrust follows TBDY 2018 Denk. (16.26) (consistent with EN 1998-5 Annex E.5-E.7). Soil with k < 5x10^-4 m/s is treated as dynamically impervious (no hydrodynamic water force; inertia of the soil+water mass in the seismic angle). Soil with k >= 5x10^-4 m/s is treated as dynamically pervious (Westergaard-type dynamic water force added). Partially submerged backfill, free water outside the wall, and excess pore pressure/liquefaction are outside the code formulas and require engineering judgement; r is capped at 1.0 for soils that may build high pore pressure. Static water pressure must be added separately. Check the applicable Kazi Destek Yapilari Tasarim ve Uygulama Esaslari (amended 16.07.2026) for any additional requirement."

"Zemin su altindaysa deprem itkisi TBDY 2018 Denk.(16.26) ile (EN 1998-5 Ek E.5-E.7 ile uyumlu) hesaplanir. k < 5x10^-4 m/s olan zemin dinamik olarak geçirimsiz (hidrodinamik su kuvveti yok, birim agirlik ve sismik aci duzeltilir), k >= 5x10^-4 m/s olan zemin dinamik olarak geçirimli kabul edilir (Westergaard tipi ek dinamik su kuvveti eklenir). Kismen su altindaki dolgu, duvar disindaki serbest su ve asiri boşluk suyu basinci / sivilasma yönetmelik formullerinin disindadir, muhendislik yargisi gerektirir. Statik su basinci ayrica eklenmelidir."

---------------------------------------------------------------------

## 6. Source list (all URLs fetched or searched in this session)

- TBDY-2018 annex, Resmi Gazete 18.03.2018 M. No. 30364: https://www.resmigazete.gov.tr/eskiler/2018/03/20180318M1-2-1.pdf (read, Section 16.11-16.12)
- AFAD copy of TBDY 2018: https://www.afad.gov.tr/kurumlar/afad.gov.tr/2309/files/TBDY_2018.pdf (not opened)
- IMO Ankara TBDY Section 16 presentation: https://ankara.imo.org.tr/Eklenti/8165,bolum16-02-08-2022-imo-ankarapdf.pdf (read slides 84-91)
- IMO Ankara TBDY Section 16 worked examples, 26.01.2023: https://ankara.imo.org.tr/Eklenti/8164,16-examples-imo-ankarapdf.pdf (read)
- EN 1998-5:2004 copy: https://www.phd.eng.br/wp-content/uploads/2014/11/en.1998.5.2004.pdf (read, 7.3.2, Annex E)
- Kazi Destek Yapilari Hakkinda Yonetmelik (18.12.2022, No. 32047): https://www.alomaliye.com/2022/12/18/kazi-destek-yapilari-hakkinda-yonetmelik/ ; https://mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=39898&MevzuatTertip=5
- Amendment 16.07.2026, No. 33311: https://www.resmigazete.gov.tr/eskiler/2026/07/20260716-1.htm ; annex https://www.resmigazete.gov.tr/eskiler/2026/07/20260716-1-1.pdf (too large, unread) ; https://legalbank.net/belge/kazi-destek-yapilari-hakkinda-yonetmelikte-degisiklik-yapilmasina-dair-yonetmelik/7031729
- Tasarim El Kitabi (Temmuz 2023): https://yapiisleri.csb.gov.tr/kazi-destek-yapilari-yonetmeligi-tasarim-el-kitabi-yayimlanmistir-haber-283477 ; https://santiye.com.tr/tasarim-projelendirme-ve-imalat-asamalarini-iceren-kazi-destek-yapilari-yonetmeligi-tasarim-el-kitabi-yayimlandi (unread PDF)
- Ebeling and Morrison 1992, DTIC ADA265707: https://apps.dtic.mil/sti/pdfs/ADA265707.pdf (403, unread)
- WCEE paper on seismic displacements of rigid retaining walls (EC8 paraphrase): https://www.iitk.ac.in/nicee/wcee/article/0562.pdf (via search summary only)
- EN 1998-5:2024 (2nd generation) status: https://www.dinmedia.de/en/standard/din-en-1998-5/383387156 (status only)
