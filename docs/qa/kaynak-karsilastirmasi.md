# Kaynak karşılaştırması: duvar, palplanş, kayma dişi, ankraj (2026-10-21)

Umut'un `docs/research` klasörüne koyduğu kaynaklarla, [G9 raporu](G9-muhendislik-incelemesi.md) ve
[ankraj raporu](ankraj-muhendislik-kontrolu.md) içindeki "hatırlanan/doğrulanmadı" maddeler karşılaştırıldı.
Kaynak dosyaları telifli ve gitignored; bu rapor yalnız bölüm/denklem/tablo atfı ve kendi sayılarımı içerir.

## 1. Gelen ve eksik kaynaklar

| Gelen ve kullanılan | Not |
|---|---|
| USACE EM 1110-2-2502 (tam), EM 1110-2-2504 (tam) | Par. 3-8, 4-12, 4-16, 3-26, 5-2d, Tablo 5-1 okundu |
| EN 1997-1:2004 (tam) | Ek A Tablo A.1–A.4, A.12–A.14 okundu |
| ÇŞİDB Kazı Destek Yapıları Tasarım El Kitabı (KDYY, 452 s.) | Tablo 2.1 (Bölüm 9), P2, P9 örnekleri |
| Peck 1969, Henkel 1971 (Arup Journal), PTI Teknik Not 23, EN 1537 önizleme (15 s.), C760 özeti, EAU 2012 düzeltmeleri | Peck zarfı ve PTI yük sınırları karşılaştırıldı; EN 1537 önizlemesi ve C760 özeti sayısal kıyas için yetersiz |
| FHWA GEC-4 (önceki oturumda ağdan, tam) | Ankraj zarfları yeniden okundu |

Dosya adı "GEC-3 Retaining Walls" olsa da `FHWA-NHI-00-043` içeriği **MSE duvar** kılavuzudur; AASHTO direnç
katsayıları (bearing 0.55, pasif 0.50) bu dosyada yoktur.

**Hâlâ eksik** (Umut'a öneriler 5. bölümde): Das, Bowles, Coduto; TBDY 2018 Bölüm 16 metni (rehberde PDF'i Masaüstü
klasöründe görünüyor ama `docs/research` içinde değil); Terzaghi-Peck-Mesri 1996 (aynı durum); AASHTO LRFD Tablo 11.5.7-1;
EN 1998-5 Ek E; NAVFAC DM-7.02; Ebeling & Morrison 1992; EAU 2012 kitabı; BS 8081, CIRIA C580 tam metin, EN ISO 22477-5,
PTI DC35.1 tam metin, EN 1537 tam metin.

## 2. Karşılaştırma sonuçları

| Madde | Kaynak | Sonuç |
|---|---|---|
| Pasif direnç azaltması 0.50 (kayma dişi, ayak) | EM 2502 par. 3-8b, 3-8c(4): devrilme, taşıma ve yapısal tasarımda ön taraf pasifi "kesinlikle karakteristik pasifin yarısını aşmamalı"; kayma kontrolü çok kamalı yöntemle, dayanıma FS uygulanarak | **Doğrulandı.** 0.50 kaynakla uyumlu; kayma için kullanımı FS = 1.5'te kamayla kıyaslanınca tutucu (φ = 30°: Kp 3.0 → 0.5 Kp = 1.5, kama Kp_e = 2.1) |
| B1 diş ucu düzleminde arka itki | EM 2502 par. 4-12g: itici kamalarla yapı kamasının ara yüzü topuktaki düşey düzlemdir ve yapı kamasının tabanına kadar iner; dişli yapıda taban diş ucudur | **Doğrulandı** (yöntem). Sayısal Das örneği hâlâ yok |
| B5 diş pasifinin ön zemin örtüsüyle hesabı | EM 2502 par. 3-8b: pasif yalnız zemin kaybolmayacaksa | Davranış uyarısı doğru; korundu |
| B3 duvar deprem pasifi (1−k_v)K_PE/K_P | EM 2502 par. 3-26b(4)(c), 3-26c: K_PE gerçek çözümü φ ≥ ψ − β ister; k_v > 0 için γ yerine (1−k_v)γ | **Doğrulandı** (yöntem) |
| B8 β > φ′ − ψ | EM 2502 par. 3-26b(4)(c): M-O kökünün gerçek olması için φ ≥ ψ + β; aksi hâlde çözüm yok, yani eğim kendi başına psödo-statik duraysız | Kama çözümünün sınırsız büyümesi kaynağın söylediğiyle uyumlu. TBDY 16.24b için metin yok; uyarı korunur. **Öneri:** bu bölgede ayrıca şev duraylılığı uyarısı |
| B7 katmanlı yolda çift pasif azaltımı | EM 2502 par. 3-8b (≤ ½ pasif) + EN 1997-1 Tablo A.13 / KDYY Tablo 2.1: γ_R;e = 1.40 | İkisi birlikte tutucu; kaynaklar çift azaltmayı yasaklamıyor. **Öneri: değiştirme** |
| B2 palplanşta gömülü boyda deprem artımı | KDYY P9 örneği (AASHTO 2010'a dayanır): artım duvar boyunca düzgün; "farklı yaklaşımlar mevcut" der. EM 2504 par. 4-6e deprem için Ebeling & Morrison'a yönlendirir (elde yok) | Gömülü boyda artımın hesaba girmesi doğru yönde. Dağılım KDYY örneğinden farklı (açık karar A2) |
| Palplanşta FS'in uygulanışı | EM 2504 par. 5-2d, Tablo 5-1: FS **tanφ ve c′'ye** uygulanır (kuvvete değil); perde duvarı olağan 1.50 (serbest drenajlı, S durumu), 2.00 (ince daneli, Q durumu); olağandışı 1.25/1.75; olağanüstü 1.10/1.50 | Program kuvveti FS'e bölüyordu: φ ≥ 35° için güvensiz (3. bölüm, düzeltildi). Sayılar 1.5 ve 1.1 serbest drenajlıda uyuyor; ince daneli Q durumunda 2.00 gerekir (açık karar A1) |
| Palplanş yapısal kuvvetler | EM 2504 par. 6-1: M ve T için FS = 1 ile yeniden hesap, birleşik FS'den kaçınılır | Program FS'li pasifle M ve T bulur: M_max, T büyük çıkar, **tutucu** (belgelenmeli) |
| Konsol D (Blum + %20) | EM 2504 par. 5-2f (net aktif geçiş noktasına kadar, sonra doğrusal; deneme-yanılma) | Kendi çözücümle (φ = 28–40°, H = 5, FS = 1.5): EM toplam derinlik 3.94–7.06 m; program tasarım D (D0 × 1.2) 4.24–8.30 m, yani %7–20 daha derin; D0 (teorik) EM'in %2–10 altında. %20 artırım ile **tutucu**, artırımsız (D0) sınırda |
| EC7 Ek A değerleri (ec7.yaml) | EN 1997-1 Tablo A.1–A.4, A.12–A.14 | **Hepsi birincil metinle doğrulandı**; YAML durumları "verified" yapıldı (tasarım yaklaşımı tanımları ikincil kaldı) |
| KDYY Tablo 2.1 (TY-2) | Bölüm 9: γ_G,dst 1.35; γ_Q,dst 1.50; γ_tanφ = γ_c′ = γ_su = γ_γ = 1.00; pasif zemin direnci γ_Re = 1.40; toptan göçme γ_Re = 1.10; ankraj γ_a = 1.10 | EC7 DA-2 ile aynı; `ec7.yaml` DA2 ile uyumlu. TBDY yaml'ındaki "γ_Rφ, γ_Rc not_in_source" KDYY'de 1.00 olarak verilmiş (yalnız KDYY için) |
| Tek taraflı pasif: TBDY 0.3 katkı | KDYY P2 örneği pasifi yalnız γ_Re ile böler | Farklı mekanizma, kıyas yapılamadı |
| Ankraj zarfı (sert kil) | Peck 1969 Şekil 30c: trapez, 0.2γH–0.4γH; GEC-4 5.2.5: toplam 3H²–6H², en az 3H² | Program GEC-4'ü izliyor; varsayılan 0.3 ve en az 3H². **Not:** Peck 1969, tek ön gerilmeli ankrajlı vakada ölçülen yükün 0.4γH'ı aştığını yazar; kullanıcı 0.4 seçerek tutucu davranabilir |
| Ankraj çelik sınırları | PTI TN-23: tasarım yükü ≤ 0.60 F_pu, deney yükü ≤ 0.80 F_pu; görünür uzama ≥ %80 teorik | Program sınırlarıyla uyumlu |
| AASHTO EH at-rest 1.35 | FHWA 11026 raporu Tablo 17 (AASHTO aktarımı): at-rest 1.35/0.90 | **İkincil doğrulandı** |
| AASHTO kayma 0.80/0.90 | Maryland DOT raporu (eski Tablo 10.5.5-1): CIP/kum 0.8, önüretimli/kum 0.9 | İkincil doğrulandı |
| AASHTO taşıma 0.55 ve pasif 0.50 | Hiçbir erişilebilir kaynakta bulunamadı | **Doğrulanamadı** (5. bölümde istek) |

## 3. Düzeltilenler (kodda)

1. **LPI ilk katman** (`liquefaction/common.py`, güvensiz): ilk test noktasının üstündeki kalınlık integrale girmiyordu;
   ağırlığı en yüksek (≈10) olan 0–0.75 m (SPT ilk nokta 1.5 m) atlanıyordu. İlk nokta ≤ 2 m ise aralığı yüzeye uzatıldı
   (GWT biliniyorsa GWT'ye kadar). Elle: derinlik [2, 4, 6], FS [0.5, NaN, 2] için 0.5 × ∫₀³(10 − 0.5z)dz = 13.875
   (önceden 9.0, GWT = 1 m iken 9.0 kalır). Etki: ilk nokta FS = 0.6 ise LPI +2.9.
2. **Palplanş pasif FS** (`sheet_pile.py`, `services/structures.py`, yalnız global-FS yolu): pasif basınç =
   min(kuvvet / FS, tanφ′/FS ve c′/FS ile hesaplanan pasif). φ ≤ 33° için sonuç değişmez (kuvvet bölme küçük);
   φ ≥ 35°'te EM 2504 değeri küçük kalır. Etki (H = 5 m, FS = 1.5, kuru kum): φ = 40°'de konsol D0 3.53 → 3.64 m (+%3.1),
   M_max 151.5 → 154.5; serbest zemin ankrajlı D0 1.33 → 1.38 (+%3.7), T 29.8 → 30.0; φ = 42°'de D0 +%4–5.
   Kısmi katsayı yolunda (EN 1997-1 γ_R;e, KDYY γ_Re) yalnız kuvvet bölünür; değişmedi.
3. **Şev duraylılığı, düz zemin** (`stability.py`): itici moment yuvarlama gürültüsü iken FS ≈ 1e16–1e17 dönüyordu;
   şimdi daire reddedilir, uygun daire yoksa açık hata.

Gözlemler: **Vesic φ = 0 d_c = 1 + 0.4k** Hansen (1970) ve Vesic (1973/75) değeridir; φ → 0 limiti 1 + 0.389k verir
(2/5.14); fark k ≤ 1 için ≤ %1.1, **değişmedi**. `tbdy_kae_steep` kendisi β almaz, tek çağrı noktası
(`distribution._layer_coefficients`) β > φ′ için önce `SlopeError` verir ve yalnız β ≤ φ′ ve β > φ′ − ψ iken çağırır:
koordinatör kararıyla uyumlu, **değişmedi**. `toe_force` işareti: değer, tabana kadar toplam net kuvvetin (kazı yönü pozitif)
değeridir; Blum karşı kuvveti bunun eksi işaretlisidir ve normal durumda negatif çıkar (testler −300.4 kN/m bekler).
Büyüklük doğru; arayüzde "uç kuvveti (karşı kuvvet) |R|" olarak mutlak değer ve açıklama gösterilmesi önerilir (kod değişmedi).

## 4. Doğrulama

İki bağımsız salt okuma incelemesi (Opus, medium): el hesapları ve kodlar geçti (palplanş φ = 40°'de D0 3.6401 m el = program; φ = 30°'de 6.1190 m, değişmedi; iki yöntemin eşitlendiği φ ≈ 35.2°, FS = 1.5). Düzeltilen bulgular: yeni varsayım metni arayüzde i18n anahtarından geldiği için `sheet_pile` ve `anchored_wall` çeviri dosyalarına eklendi; paragraf atıfları 5-2d/5-2f yapıldı. Notlar (değişmedi):
- LPI uzatma eşiği 2 m kaynaklı değil, **programın seçimi**; 2 m'de süreksizlik var (ilk nokta 2.0 m uzatılır, 2.01 m uzatılmaz). Tek test noktasında GWT üst sınırı uygulanmaz (eski davranış).
- Deprem pasif oranı M-O/Rankine, azaltılmamış φ ile hesaplanıp azaltılmış basınca uygulanıyor (φ = 40°, k_h = 0.2: 0.903 yerine 0.874, ≈ %3 güvensiz); Ebeling & Morrison elde olmadığından doğrulanamadı.
- `structures._sheet_case` yolunda φ > 35° için ayrı birim test yok; motor düzeyinde test var.
- Ters yönlü şev geometrisi (yüzey sağa doğru alçalıyor) `SlopeModel` tarafından denetlenmiyor; kh = 0'da anlamsız FS (10³–10⁸) dönebilir. Tek dahili çağıran (duvar global stabilitesi) doğru yönde kuruyor. **Açık öneri:** yön kontrolü veya uyarı (ayrı iş).
- EC7 A.3 (Q favourable) ve A.4 (M2 tanφ′) hücreleri OCR'da okunaksız; ASD sismik 1.1 = EM 2504 "olağanüstü" eşlemesi yorumdur.

## 5. Açık kararlar ve Umut'tan istenenler

**A1 (öneri: uygula).** İnce daneli (drenajsız, Q durumu) pasifte EM 2504 Tablo 5-1 FS = 2.00 (olağan) / 1.75 / 1.50 ister;
programın temel palplanş yolu ve `asd.yaml` hepsi için 1.5. Drenajsız katmanda pasif (σ_v + 2 s_u) / 1.5 verir. Öneri:
`asd.yaml`'a ince daneli için ayrı FS ve drenajsız katmanda EM yöntemi (yalnız s_u'ya FS, σ_v'ye değil) uygulansın.
**A2.** Palplanşta deprem artımı dağılımı: KDYY P9 örneği (AASHTO 2010) düzgün; program H üstünde düzgün, altında ΔK·σ_v.
Basit karşılaştırma (φ = 30°, H = 5, k_h = 0.2, k_v = 0.1): D0 6.83 m (program) / 7.45 m (artımı toe'ya kadar düzgün alırsak;
KDYY örneği artımı yalnız dönme noktasına kadar uygular, bu nedenle kesin bir kıyas değildir). Öneri: değiştirme, uyarı
metnine "KDYY P9 düzgün dağılım kullanır" ekle.
**A3.** ec7.yaml dışında sonuç almak için: AASHTO 11.5.7-1, TBDY 16.24b ve 16.26 metni (B8, B13–B15 için) hâlâ gerekli.

Umut'tan alternatif/ek kaynak istekleri (öncelik sırasıyla):
1. `Masaüstü\Geoteknik_Kaynaklar` içindeki **TBDY 2018 Bölüm 16** ve **Terzaghi-Peck-Mesri 1996** PDF'leri: yalnız ilgili
   sayfalar (TBDY 16.7–16.13 ve Denk. 16.24b, 16.26; TPM duvar/palplanş/payandalı kazı bölümleri) `docs/research` içine
   markdown olarak konsa yeter.
2. **AASHTO LRFD Tablo 11.5.7-1**: tek sayfa fotoğraf/PDF yeter. Alternatif: WSDOT Geotechnical Design Manual (M 46-03)
   istinat duvarı bölümü LRFD dayanım katsayılarını verir; Caltrans Bridge Design Specifications Bölüm 11 aynı tabloyu içerir.
3. **Ebeling & Morrison 1992 (ITL-92-11)**: USACE ERDC raporu, kamuya açık yayın; ERDC kütüphanesi veya DTIC'ten indirilebilir.
4. **Das (Principles of Foundation Engineering)**: yoksa alternatif olarak ODTÜ CE366 notları (kullanıldı), FHWA-NHI-06-089
   Cilt II (Soils and Foundations Reference Manual, kamuya açık) Bölüm 8 ve 10; Bowles ve Coduto için kitap şart değil,
   EM 2502/2504 ve FHWA kılavuzları yöntemleri zaten kapsıyor.
5. **NAVFAC DM-7.02** (kamu malı) ve **EN 1998-5 Ek E**: düşük öncelik.
6. BS 8081, CIRIA C580 tam metin, EN ISO 22477-5, PTI DC35.1 tam metin: ücretli; GEC-4 ve EC7 Bölüm 8 programın
   mevcut yöntemlerini kapsıyor, ankraj için ek olarak gerekmedikçe istenmiyor.
