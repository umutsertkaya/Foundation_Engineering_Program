# 2026-10-22 mühendislik incelemesinin değerlendirmesi

**Tarih:** 22 Ekim 2026 · **Değerlendirilen rapor:** [2026-10-22-arayuz-islev-muhendislik-incelemesi.md](2026-10-22-arayuz-islev-muhendislik-incelemesi.md)
(GPT-6.1 ajanları, sürüm `b9392f9`) · **Değerlendirme sürümü:** `85c79d2` (main).

Her bulgu kodun ilgili satırına karşı ayrıca okundu. Önceki kararlar
([kaynak-karsilastirmasi](../qa/kaynak-karsilastirmasi.md), [G9](../qa/G9-muhendislik-incelemesi.md),
[ankraj](../qa/ankraj-muhendislik-kontrolu.md)) yeniden açılmadı. Kural: kaynak yöntemi izlenir; sadeleştirme yalnız
gösterilebilir şekilde güvenli taraftaysa ve görünür varsayım olarak kalır.

**Hüküm anahtarı:** **G** geçerli · **KG** kısmen geçerli (çekirdek gözlem doğru, etki/kapsam raporda büyütülmüş veya
çözüm farklı olmalı) · **GD** geçersiz / yanlış pozitif · **E** geçerli ama bu turda ertelendi.

## 1. Mühendislik bulguları (ENG)

| ID | Hüküm | Kod denetimi ve gerekçe | Karar |
|---|---|---|---|
| ENG-C-001 | **G, kritik** | `services/structures.py` ASD (global_fs) dalı yalnız `seismic = sds is not None` ile **tek** `_sheet_case` çağırıyor; kısmi katsayı dalı statik+deprem döngüsü yapıyor. Tasarım ve deprem YASS farklıysa statik durum yönetebilir; zarf eksik, güvensiz. | Statik ve deprem ayrı çözülür; D, M, ankraj kuvveti için yöneten durum alınır ve raporlanır. |
| ENG-C-002 | **G** | `limit_state.verify_wall` ve `verify_wall_layered`: `delta_base` yoksa φ kullanılıyor. Temel yol (`walls_basic`, `layered.soil_from_basic`) ve `tbdy2018.yaml` (Tablo 16.3, durum: verified) tanδ ≤ 0,6 diyor. TBDY ile ileri yol tutarsız ve güvensiz. AASHTO (10.6.3.4, tanδ = tanφ_f) ve EC7 bu sınırı koymaz. | Yalnız TBDY kodunda ileri yolda tanδ_b = min(tanφ, 0,6) (veya kullanıcı δ_b'si ile min); varsayım satırı. |
| ENG-C-003 | **KG** | Tributary seçilince yalnız `reactions` değişiyor, kesme/moment menteşe modelinden. GEC-4 tributary yöntemi yükleri ampirik dağıtır; diyagramın başka modelden gelmesi kendi başına hata değil ama gizli. | Görünür not: "ankraj yükleri tributary, V/M diyagramı menteşe modeli". Hesap değişmez. |
| ENG-C-004 | **G (sözleşme)** | `anchored_wall.py` taban altı kesmesinde ilk sıfır geçişinden sonrası `v_max` aramasından çıkarılıyor; model alanı "Largest shear" diyor ve `v_max_member` bundan türüyor. Blum modelinde uç bölgesindeki kesme gerçek eleman talebidir. | `v_max` dönen diyagramın tamamının en büyüğü (güvenli taraf). `toe_force_not_balanced` uyarısı korunur. |
| ENG-C-005 | **G (eğitim)** | Eğitim şeklinde yumuşak kil zarfı tabanda sıfıra iniyor; motor `[0, p, p]`. Başlıktaki sayılar karışık örneklerden. Öğrenci metninde Ns/Su,b ve "d girilmezse durur" ifadeleri motorla çelişiyor. | Şekil ve metin motora uyarlanır. |
| ENG-C-006 | **KG** | `sheet_pile` alt seviye fonksiyonları negatif `depth_increase` ve NaN gerilmeyi kabul ediyor; `GravityGeometry` sonsuz/embedment>height kabul ediyor. Yapı modelleri ilk örneği engelliyor; UI'dan erişim gösterilmedi. | Ucuz koruma: girdi doğrulaması ekle. |
| ENG-B-001 | **KG** | `trial_wedge` alt sınır `β + 1e-4` kesimine yapışan optimumu sonlu döndürüyor. Örnek β = 25° > φ − ψ = 18,7°; koordinatör kararı bu durumda "dur" diyor. Yapı yolları M-O/TBDY ayrımını önceden yapıyor; etki genel API. | Aktif optimum alt sınıra yapışırsa açık `GeoTekError` (sınırsız kama). |
| ENG-B-002 | **G** | `stability.bishop`: `yg = (ybot+ytop)/2`; katmanlı kolonda birinci moment toplanmıyor, yüzey yükü kolon ortasına konuyor. Sismik + katmanlı örnekte FS 0,995 → 1,004 (karar değişiyor). | Kolon ağırlığının katman bazlı birinci momenti; yüzey yükünün kh kolu yüzey kotunda (yük kh'ye dahil kalır: güvenli taraf, görünür varsayım). |
| ENG-B-003 | **G (genel API)** | `distribution._layer_coefficients` Coulomb pasifte de `cos(δ+θ)` döndürüyor; `_wall_force` işaret kuralına göre pasif yatay bileşen `cos(δ−θ)`. Mevcut çağırıcılar θ = 0 kullandığı için UI sonuçları etkilenmiyor. | Pasifte `cos(δ−θ)`; test. |
| ENG-B-004 | **KG** | `_slip_interval` 600 noktalı tarama, yüzey kırık noktalarındaki dar çıkışları atlayabiliyor. Yalnız grid 4'te üretildi; varsayılan grid 12'de yok. | Yüzey kırık noktaları tarama dizisine eklenir; yayın aralık içinde yüzeyin üstüne çıktığı daire reddedilir. |
| ENG-B-005 | **KG** | Genel `distribution` API'si eğik yüz + eğimli zemin sürşarjını geometrik çarpansız uyguluyor; tek çağırıcı (`walls/layered.py`) çarpanı kendisi uyguluyor. Hata yok, sözleşme açık değil. | Docstring'e sözleşme notu. Hesap değişmez. |
| ENG-B-006 | **G (sayısal)** | `bearing.py` Nc = (Nq−1)/tanφ, φ ≲ 1e-8° için iptal hatası (−127). Pratik etki yok. | Küçük φ'de kararlı ifade veya φ = 0 dalına geçiş. |
| ENG-B-007 | **KG** | Genel motor API'lerinde enum/sonluluk/işaret denetimi eksik (bilinmeyen yöntem, `state='bad'`, negatif γ, NaN B). Üst Pydantic katmanı çoğunu engelliyor. | Temel enum ve sonluluk korumaları; kapsamlı sertleştirme yok. |
| ENG-B-008 | **G (eğitim)** | Öğrenci Bishop örneğinde giriş/çıkış başka daireye ait; FS doğru. | Uç noktaları düzelt. |
| ENG-B-009 | **G (eğitim)** | "Ters şevde program hata vermez" ifadesi PR #37 sonrası yanlış. Vesic H sınırı metni koddaki `mH ≥ A′suNc` ile uyuşmuyor. | Metin koda uyarlanır; Vesic sınırının kaynağı değiştirilmez. |
| ENG-B-010 | **G (eğitim)** | Bishop dilim şeklinde mobilize direnç oku kayma yönünde. | Ok yönü ters çevrilir. |
| ENG-A-001 | **G (doğrudan içe alma)** | `_header_unit` tanınmayan birimde `None` döndürüyor; varsayılan birime sessizce düşüyor. UI zorunlu birim seçtiği için arayüzde tekrar yok. | Başlıkta tanınmayan birim varsa açık hata. |
| ENG-A-002 | **G, E** | SPT noktalarına tabakanın USCS/davranış bilgisi geçmiyor; kil tabakasına kum φ/E bağıntıları geçerli öneriliyor. Onaysız tasarıma geçmiyor. | Ertelendi: aynı dosyalarda SPT/CPT parametre üretilmemesi sorunu üzerinde çalışılıyor. O iş birleşince yapılacak. |
| ENG-A-003 | **G** | `liquefaction_potential_index` yalnız ilk hücrenin üstünü GWT ile sınırlıyor; ilk nokta GWT altındayken hücre GWT üstüne taşabiliyor. Tek noktada [0, z] tamamı sayılıyor. Iwasaki'de su üstü F = 0. Önceki LPI düzeltmesiyle (kaynak-karsilastirmasi §3.1) çelişmez, onu tamamlar. | Bütün hücreler [GWT, 20 m] aralığına kırpılır. |
| ENG-A-004 | **G (eğitim)** | MSF şekli metindeki Youd (10^2,24/M^2,56) ve Andrus–Stokoe ((M/7,5)^−3,3) yerine başka denklemler çiziyor. | Şekil metin/motor denklemleriyle çizilir. |
| ENG-A-005 | **G** | Kayıt (`registry.evaluate`) negatif su/E/σp ve Dr > %100'ü geçerli işaretleyebiliyor. | Fiziksel alan denetimi: negatifse geçersiz, Dr > 100 uyarı. Bağıntılar değişmez. |
| ENG-A-006 | **G** | Eksik u2 hücreleri 0 ile dolduruluyor, iz kalmıyor. | Uyarı ve eksik nokta sayısı; u2 tabanlı adaylar o noktalarda dışlanır. |
| ENG-A-007 | **G** | Bütün FS NaN iken LPI = 0 / very_low. Hesaplanamayan (`invalid`) nokta ile kaynağa göre dışlanan nokta ayrılmıyor. | `invalid` nokta varsa LPI kategorisi "eksik kapsam" ile işaretlenir; tümü invalid ise LPI = None. |
| ENG-A-008 | **G (yüzey sınırı)** | Yakınsamayan CPT normalizasyonu uyarıyla birlikte sonlu FS ve "liquefiable" üretiyor. | Yakınsamayan noktalar `invalid`. |
| ENG-A-009 | **KG** | Sondaj çapı tablo dışı (örn. 1000 mm) için 1,15 sessiz. Rod > 30 m için 1,0 kaynakla uyumlu. | Tablo dışı çap için uyarı. |
| ENG-A-010 | **G** | `LabRecord` FC + çakıl toplamını denetlemiyor; negatif kum ile sınıflandırma. | FC + çakıl > 100 doğrulama hatası. |
| ENG-A-011 | **KG (eğitim)** | Soru [1, 3] aralığını dayatıyor, aritmetik doğru; aynı örneğe yapılan atıf motorla ([0, 3]) çelişiyor. | Metin tutarlı hale getirilir. |
| ENG-A-012 | **G (eğitim)** | D10 yardımcı çizgisi, CL-ML taraması ve FC'den bağımsız Ncs = 30 çizgisi yanıltıcı. | Şekiller düzeltilir. |
| ENG-A-013 | **KG** | Düşük seviye fonksiyonlarda sonluluk/sıralama sözleşmesi eksik. HTTP yolu koruyor. | Yalnız LPI sıralama ve NaN girdisi korunur; geniş sertleştirme ertelendi. |

## 2. İşlev bulguları (FUN)

| ID | Hüküm | Gerekçe | Karar |
|---|---|---|---|
| FUN-001 | **G, veri kaybı** | Duvar sihirbazı formu yalnız hesap öncesi PUT ediyor; üst Kaydet "Kaydedildi" deyip yük düzenlemesini atıyor. Palplanşta iki aynı adlı düğme var. | Yerel taslak dirty ise üst Kaydet önce yapıyı kaydeder (veya açıkça uyarır). Düğme adları ayrılır. |
| FUN-002 | **G** | ENG-C-001 ile aynı. | ENG-C-001. |
| FUN-003 | **G** | `SheetPileDetailPage` her stale durumunda kaynak profil uyarısını açıyor. | Kaynak uyarısı yalnız kaynak hash'i farklıysa çıkar. |
| FUN-004 | **G** | EN arayüz ve DOCX'te bazı uyarı/varsayım gövdeleri TR. | Kalan ham metinler i18n anahtarına taşınır (kapsam: duvar, palplanş, ankraj, rapor). |
| FUN-005 | **G** | Duvar sonuç kesiti `layerId` (UUID) basıyor. | Katman adı/özeti gösterilir. |
| FUN-006 | **G** | DOCX bölümünde yapının gerçek tasarım esası, analiz düzeyi, SDS ve su seviyeleri yok. | Duvar ve palplanş bölümüne yapı kodu, yaklaşım, analiz düzeyi, SDS, YASS satırları. Ankrajlı palplanşta ankraj başına yük, aralık, eğim. |
| FUN-007 | **G** | Palplanş arayüzü ön/arka tasarım/deprem YASS değerlerini göstermiyor. | Salt okunur su seviyesi özeti. |
| FUN-008 | **G** | Modül açıklaması LPI vaat ediyor; DTO, arayüz ve rapor LPI taşımıyor. | ENG-A-003/007 düzeltmesinden sonra LPI ve kategori DTO, sonuç ekranı ve rapora eklenir. |
| FUN-009 | **G** | "(cm³) (cm³/m)" çift birim etiketi. | Etiket düzeltilir. |
| FUN-010 | **KG, E** | 800 px'te grafik yazıları küçük. Masaüstü exe için düşük öncelik. | Ertelendi. |

## 3. Arayüz bulguları (UX)

| ID | Hüküm | Karar |
|---|---|---|
| UX-001 | KG: gerçek, ama uygulama masaüstü exe; 390 px hedef değil | **E** |
| UX-002 | G: profil satırı stale onayı "ONAYLI" gösteriyor | **E**: parametre/profil ekranı Exe arayüz işinde. Önce o iş birleşir. |
| UX-003 | G: γsat elle girişte birim `[-]` | **E**: aynı ekran |
| UX-004 | KG: zorunlu γ alanı yatay kaydırmada | **E** |
| UX-005 | G: SPT tabakalamada aktif profil bağımlılığı görünmüyor, ham 422 | **E**: SPT/CPT parametre işiyle aynı akış |
| UX-006 | KG: iki Kaydet'in kapsamı açıklanmıyor | FUN-001 ile birlikte düğme adları |
| UX-007 | G: yenilemede taslak kaybı | **E** |
| UX-008 | G: aşırı ondalık hassasiyet | **E**: LayeringModal aynı iş |
| UX-009 | G: TR ekranda İngilizce uyarılar | FUN-004 kapsamında kısmen |
| UX-010 | KG: tasarım tercihi | **E** |
| UX-011 | KG: tasarım tercihi | **E** |
| UX-012 | G: aynı adlı projeler ayırt edilemiyor | **E**: küçük, sonraki tur |
| UX-013 | G, düşük | **E** |

## 4. Uygulama planı ve doğrulama

1. **Hesap motoru:** ENG-B-001/002/003/004/005/006/007, ENG-C-006.
2. **Yapılar, ankraj, veri ve LPI:** ENG-C-001/002/003/004, ENG-A-001/003/005/006/007/008/009/010/013, FUN-008.
3. **Arayüz, rapor ve eğitim:** FUN-001/003/004/005/006/007/009, ENG-A-004/011/012, ENG-B-008/009/010, ENG-C-005.

Hesap değişiklikleri el hesabı/regresyon testi ve bağımsız salt okuma incelemesiyle doğrulanır. Sonuçlar aşağıdaki
bölüme eklenir.

## 5. Uygulama sonucu

_(Uygulama ve inceleme sonrası doldurulacak.)_
