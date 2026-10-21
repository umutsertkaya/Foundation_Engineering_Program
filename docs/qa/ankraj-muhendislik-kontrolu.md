# Ankraj ve ankrajlı iksa: mühendislik kontrolü (2026-10-21)

Kapsam: `anchored_wall` modülü (PR #22 ankraj tasarımı, #23 analiz, #24 web/rapor). Yöntem: üç bağımsız
Opus salt okuma incelemesi (ankraj motoru, analiz motoru, web/rapor), bulguların birincil kaynağa karşı
kontrolü, düzeltme, ardından düzeltme farkının ayrı bir bağımsız incelemesi.

Birincil kaynak: **FHWA GEC-4**, Sabatini, Pass, Bachus (1999), *Ground Anchors and Anchored Systems*,
FHWA-IF-99-015 (tam metin, fhwa.dot.gov). İkincil karşılaştırma: Caltrans *Trenching and Shoring Manual*
(2025) böl. 8 ve 10 (FHWA'yı izler), Das (Peck 1969 özeti).

## Bulgular ve yapılanlar

| # | Ağırlık | Bulgu | Kaynak | Yapılan |
|---|---|---|---|---|
| 1 | Kritik | Yumuşak kil zarfı Ns biraz > 4 iken p ≈ 0 veriyordu (örn. γ=17, H=8, Su=33,5: 2 kPa; sert kil sınırında 40,8 kPa). | GEC-4 5.2.6, denk. 11–12, Şekil 29 | 4 < Ns < 5,14: Ka = 0,22; Ns ≥ 5,14: Henkel denk. 12 (d girilmezse B′); alt sınır 0,22. Ns = γH/Su,b (denk. 9, taban altı Su). |
| 2 | Kritik | Kilde taban kabarması kontrolü yoktu. | GEC-4 5.8.2.2, denk. 34–37, Şekil 51 | İki mekanizma, küçük FS: denk. 37 (Nc derinliğe bağlı) ve denk. 34–36 (yan kesme, Nc derinlik katkısız). Nc = min(Skempton 1951, Şekil 51c sayısallaştırılmış). Gereken FS 1,5 geçici / 2,5 kalıcı. Drenajsız analizde B ve yapı türü zorunlu. |
| 3 | Önemli | Kum ve sert kilde dikdörtgen Peck zarfı; GEC-4 ankrajlı duvar için trapez ister. 3 kademeli örnekte orta ankraj %24 düşük kalıyordu. | GEC-4 5.2.4–5.2.5, Şekil 24, 27; Tablo 5 | Trapez: p = toplam/(H − H1/3 − Hn+1/3), rampalar 2/3·H1 ve 2/3·Hn+1. Sert kilde toplam ≥ 3H² kN/m, ≤ 4H² uyarı, kalıcıda 0,65KaγH² (tam yumuşamış φ′) karşılaştırması. |
| 4 | Önemli | Tek seviyede yalnız serbest zemin desteği (Rankine üçgeni); GEC-4 tek seviye için de zarf verir. | GEC-4 Şekil 24a, 27a, 33 | Ankraj yükü ve moment için serbest zemin desteği ile GEC-4 zarfı + menteşe yönteminin büyüğü. |
| 5 | Önemli | Kama ötesi χ ankraj ekseni boyunca ekleniyordu; şekilde kayma yüzeyine dik. φ=0, α=15° için %13 eksik. | GEC-4 Şekil 37a | Eksen boyunca χ / sin(45 + φ′/2 + α). |
| 6 | Önemli | En küçük kök boyu yoktu (kayada 1,8 m kabul ediliyordu). | GEC-4 Ek E 3B (s. E-15), 5.3.6 s. 74 | Zeminde 4,5 m; kayada halat 4,5 m, bar 3 m (varsayım olarak gösterilir, daha küçüğü uyarı verir). |
| 7 | Önemli | Pasif güvenlik sayısı varsayılan 1,0 idi (sessiz varsayım). | GEC-4 5.5.3 (öneri 1,5) | Zorunlu girdi; öneri yalnız metinde. |
| 8 | Önemli | Seviye ankraj kontrolleri (kök boyu sınırı vb.) arayüzde ve raporda görünmüyordu. | — | Kontrol tablosuna seviye etiketiyle eklendi; uyarılar seviye etiketli. |
| 9 | Önemli | Profil kaynağı değişince sonuç "Güncel" görünüyordu; analiz hash'i ankraj motoru sürümünü içermiyordu. | — | Bayat durum profil değişikliğini de sayar; hash iki motor sürümünü içerir (ENGINE_VERSION 2). |
| 10 | Önemli | Dış (genel) stabilite / Kranz yok, bunu söyleyen uyarı da yoktu. | GEC-4 5.8.3 (FS ≥ 1,3) | Her sonuçta zorunlu uyarı. Hesap eklenmedi (aşağıda). |
| 11 | Orta | Düşey ankraj bileşeninin duvar eksenel yükü kontrol edilmiyordu, söylenmiyordu. | GEC-4 5.6 | Toplam ΣT_v (kN/m ve eleman başına) ile uyarı. |
| 12 | Orta | Kayada FS uyarı eşiği 2,0 kalıyordu; yatay aralık < 1,2 m kontrolü yoktu; kayada tipik kök sınırı 12 m idi. | GEC-4 s. 74, Şekil 37b | Kaya 3,0; aralık uyarısı; kaya tipik üst sınır 10 m. |
| 13 | Orta | Basit 45°+φ′/2 kaması katmanlı/kil/sürşarjda geçerli değil, belirtilmiyordu. | GEC-4 5.3.2 | Uyarı. |
| 14 | Orta | Uç kuvveti artığı mavi varsayım olarak gösteriliyordu. | GEC-4 5.5.3 | Sarı uyarı; gömülmenin GEC-4 kuvvet ölçütünden daha derin (güvenli) olduğu yazıldı. |
| 15 | Küçük | Rapor girdileri eksikti (FS, q_u, kilitleme, tendon, B, hizmet türü, kazık aralığı…); kaynak metni dikdörtgen zarfı GEC-4'e bağlıyordu; TR çeviri hatası ("anahtar çalışma"). | — | Rapor girdi satırları, kaynak listesi yönteme göre, metinler düzeltildi. |

Doğrulanan (değişmedi): GEC-4 denk. 19–21; kama geometrisi; 1,5 m / 0,2H büyüğü; en az serbest boy
4,5/3 m; tendon sınırları 0,6/0,7/0,8 SMTS; deneme yükü 1,33; Tablo 6, 8, 9, 10 değerleri; FS 2,0/3,0;
eğim 10–45°; 4,5 m örtü kök merkezi üstünde (s. 76); menteşe ve katkı alanı yöntemleri (el hesabı).

## El hesabı regresyonları (tests/unit)

- Kum, H=10, φ=30°, γ=18, ankrajlar 1,5/4,5/7,5 m: p = 390/8,667 = 45,0 kPa; menteşe 120,625 / 126,875 / 115,417, R_B 27,083; katkı alanı 112,5 / 135 / 121,406, R_B 21,094 (Caltrans denk. 8-2-6 ile ayrıca bulundu).
- Tek seviye kum H=6: p = 35,1 kPa, zarf ankraj yükü 115,05 kN/m; sonuç max(serbest zemin desteği, 115,05).
- Sert kil c=0,4: p=54,4, toplam 344,5; c=0,2: 3H² = 192'ye yükseltildi.
- Yumuşak kil Su=30: Ka 0,22, p 29,92; Su=15, d=4: Henkel Ka 1,17131.
- Taban kabarması H=6, B=10, Su=20: FS 1,098 (< 1,5); B/L=0,5: Nc 6,16; dar derin kazı H=10, B=2, Su=30, γ=18: Nc 7,46, FS 1,243.
- Ankraj: χ ekseni boyunca 2/sin 76,5° = 2,0568 m; φ=0: 2,3094 m; kaya q_u=730, FS 3: 1,83 m → 4,5 m.

Bağımsız inceleme bütün el hesaplarını yeniden hesapladı. Bulduğu kritik hata (dar derin kazıda FS = 99)
ve önemli bulgular (Nc'nin grafiği aşması, Henkel d'nin denetimsiz girilmesi, kısa profilin yalnız not olması)
bu PR'da düzeltildi.

## Test sonuçları (2026-10-21, bulut kapsayıcı, Linux)

- pytest tam paket: 1973 geçti, 2 atlandı (büyük/küçük harf duyarsız dosya sistemi testleri).
- Vitest: 38 dosya, 344 test geçti. `tsc --noEmit` temiz. `npm run build` başarılı.
- `docs/qa/g8_e2e.py` gerçek HTTP uçtan uca: 31 PASS, 0 FAIL.
- Kod haritası yeniden üretildi, `--check` 0.
- Tarayıcıda elle gezinme yapılmadı.

## Kalan varsayımlar ve sınırlar

- Dış stabilite ve Kranz hesaplanmıyor (zorunlu uyarı). Öneri: mevcut Bishop/şev motoruyla ankraj arkasından ve içinden geçen yüzeyler (GEC-4 Şekil 52).
- Yumuşak kilde (Ns > 4) taban altı pasif direnç yok; program durur. GEC-4 5.5.3/Ek C yolu (0,2H gömülme, en alt ankrajdan konsol, en alt ankraja +R) uygulanmadı, durma mesajında anlatılıyor.
- Gömülme uçta moment dengesiyle (GEC-4 kuvvet ölçütünden daha derin); uç kuvveti artığı uyarıyla gösterilir.
- Taban kabarmasında Nc grafiği 400 dpi taramadan sayısallaştırıldı ve Skempton ile alttan sınırlandı; denk. 37 çoğu durumda belirleyici, sert tabaka (denk. 36) faydası pratikte görünmez (güvenli taraf).
- Ns için taban altı en düşük Su kullanılıyor (GEC-4 ortalama der; güvenli taraf).
- Rapor sayıları TR metinde nokta ondalık kullanıyor; bazı TR terim tutarsızlıkları (menteşe/mafsal) duruyor.
- Peck (1969), Terzaghi-Peck-Mesri (1996), EN 1997-1 §8–9, EN 1537, EN ISO 22477-5, BS 8081, PTI DC35.1, CIRIA C580, EAU 2012, USACE EM 1110-2-2504 özgün metinlerine erişilemedi; bu PR GEC-4'e dayanır.
