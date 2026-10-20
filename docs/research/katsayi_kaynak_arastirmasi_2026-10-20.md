# Katsayı kaynak araştırması (T4) — 2026-10-20

YAML değerlerine dokunulmadı. Aşağıdakiler FHWA'nın resmi PDF'lerinden okunmuş satırlardır
(`www.fhwa.dot.gov`); AASHTO'nun kendi metni değil, FHWA'nın AASHTO'yu aktardığı tablolardır, bu yüzden **secondary**.

## 1. ASD — FHWA NHI-06-089 (Soils and Foundations Reference Manual, Vol. II, Aralık 2006)
Not: önceki belgede geçen NHI-06-088 Cilt I'dir ve istinat duvarı kriteri içermez (yalnız şev: gömme dolgu 1.25, kazı şevi 1.50, §6.10.3).
Duvar kriterleri Cilt II, Bölüm 10.5.5–10.5.6 ve Bölüm 8.4.6'dadır.

| YAML (asd.yaml) | Kaynak | Sonuç |
|---|---|---|
| sliding static 1.5 | §10.5.5 "Sliding: FS ≥ 1.5" (pasif yok sayılır; LS kayma için stabilize edici sayılmaz) | **secondary, eşleşir** |
| eccentricity soil static B/6 (0.1667), rock B/4 (0.25) | §10.5.5 "e ≤ B/6 zeminde, ≤ B/4 kayada" | **secondary, eşleşir** |
| overturning static 2.0 | §10.5.5: eksantrisite kriteri "yaklaşık 2.0 (zemin) / 1.5 (kaya)" devrilme güvenliğine denk; ayrı bir devrilme FS'si verilmez | **kısmen**: zemin için 2.0 uyar, kaya için 1.5 YAML'da yok (YAML tek değer tutuyor) |
| bearing static 3.0 | §8.4.6: tipik 2.5–3.5, köprü temelleri için 3.0 önerilir | **secondary, eşleşir** (önerilen değer) |
| global stability static 1.5 | §10.5.6: "en az 1.5 istenir" | **secondary, eşleşir** |
| tüm sismik değerler (1.5 / 1.1 / 2.0 / 1.1; B/4 zemin, 1/3 kaya) | bu kaynaklarda yok | **unverified** |
| sheet_pile_passive 1.5 / 1.1 | bu kaynaklarda yok | **unverified** |

## 2. AASHTO LRFD yük katsayıları — FHWA NHI-10-024 (GEC-11 Cilt I, Tablo 4-1, 4-2; AASHTO 2007'den)
| YAML | Kaynak | Sonuç |
|---|---|---|
| DC 1.25/0.90 | Tablo 4-2 | secondary, eşleşir |
| EH aktif 1.50/0.90 | Tablo 4-2 | secondary, eşleşir |
| EV (istinat duvarı) 1.35/1.00 | Tablo 4-2 | secondary, eşleşir |
| ES 1.50/0.75 | Tablo 4-2 | secondary, eşleşir |
| LS 1.75 (Strength I) | Tablo 4-1 (LL/LS sütunu) | secondary, eşleşir |
| EQ 1.00 (Extreme I) | Tablo 4-1 | secondary, eşleşir |
| LS extreme_I 0.50 | Tablo 4-1'de Extreme Event I için γEQ (proje özel), 0.50 ise Extreme Event II satırında | **belirsiz**: YAML'ın 0.50'si Extreme II değeriyle karışmış olabilir; Umut'a soru |
| EH at-rest 1.35 | bu kaynakta yok | unverified |

## 3. AASHTO direnç katsayıları ve eksantrisite — GEC-11 (MSE duvarlar için; Tablo 11.5.6-1 / 10.6.3.1.2a)
Bu değerler **MSE duvar** içindir, YAML'daki Tablo 11.5.7-1 (kalıcı istinat duvarları) için doğrudan kanıt değildir.
| Konu | GEC-11 | YAML | Yorum |
|---|---|---|---|
| Taşıma | 0.65 | 0.55 (gravite/yarı-gravite) | Farklı tablo; çelişki sayılmaz. 11.5.7-1 hâlâ doğrulanmadı |
| Kayma | 1.0 (zemin-zemin) | 0.80 / 0.90 (beton-kum) | Farklı koşul; doğrulanmadı |
| Toptan göçme | 0.75 (parametreler iyi, yapı taşımayan şev); 0.65 (sınırlı bilgi veya yapı taşıyan/içeren şev) | 0.75 / 0.65 | **secondary, eşleşir** (YAML'daki 0.65 "taşıyan yapı" koşuluna karşılık gelir) |
| Eksantrisite, Extreme Event I | orta 0.8 (e ≤ 0.4 B), EQ=0'da orta 2/3 | extreme soil 0.40 | **secondary, eşleşir** (0.40) |
| Eksantrisite, Strength (MSE) | zeminde orta yarı (0.25), kayada orta 3/4 (0.375) | 0.3333 / 0.45 (11.6.3.3, istinat duvarı) | MSE'ye özgü; YAML'ı çürütmez, doğrulamaz |

## 4. Hâlâ açık
- AASHTO Tablo 11.5.7-1 ve 11.6.3.3 ana metni: `dot.ca.gov` ve `highways.dot.gov` yanıt vermedi/HTML döndürdü (Caltrans PDF indirilemedi). Kayma 0.80/0.90, taşıma 0.55, pasif 0.50, palplanş pasif 0.75, extreme direnç katsayıları unverified.
- FHWA GEC-3 (NHI-11-032) bu ortamdan açılmadı.
- **TBDY γRφ, γRc:** kaynak metin (imo.org.tr, jmo.org.tr, istinatduvari.com) ağ ilkesi nedeniyle açılamadı; aramada değer çıkmadı. Önceki not_in_source sonucu geçerli.

## 5. Kararlar
1. LS extreme_I 0.50: **YAML'da kalır**, proje varsayımı olarak belgelendi (orkestra şefi kararı, 2026-10-20).
2. ASD overturning kaya 1.5 ayrı alanı: şema değişikliği, ayrı iş; şimdilik yapılmadı.
3. Antigravity (gemini-4-argon medium) incelemesi bekliyor; cihazdaki Claude Code oturumundan ai-orchestrator ile yapılacak.
