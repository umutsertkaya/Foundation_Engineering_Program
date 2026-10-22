# GeoTek — arayüz, işlev ve mühendislik incelemesi

**Tarih:** 22 Ekim 2026 (UTC) · **İncelenen sürüm:** `b9392f9` · **Hedef kullanıcı:** geoteknik mühendisi ve uygulamaya yeni başlayan mühendis.

Bu çalışma gerçek React arayüzü, çalışan FastAPI uçları ve Python hesap motorunu birlikte inceler. Amaç; kullanıcı akışındaki engelleri, veri ve sonuç sözleşmelerini, hesap yöntemlerinin aritmetiğini, yöntem uygulanabilirliğini ve kaynak dayanağını ayrı ayrı görünür kılmaktır. Üretim kodu veya katsayı değiştirilmedi. Ayrı [kullanılabilirlik önerileri](2026-10-22-kullanilabilirlik-iyilestirme-onerileri.md) bu bulguların tasarıma nasıl çevrileceğini açıklar.

## Okuma anahtarı ve kapsam

- **P0:** hesap güvenilirliğini doğrudan tehdit eden, kullanımın durdurulmasını gerektiren yaygın ve doğrulanmış kusur. Bu rapor her yüksek riskli örneği otomatik P0 saymaz.
- **P1:** belirli koşullarda tasarım talebini/direncini veya veri bütünlüğünü önemli etkileyen kusur; öncelikli düzeltme ve hedefli regresyon gerekir.
- **P2:** işlev, yorumlanabilirlik veya sınırlı koşullu hesap/uygulanabilirlik kusuru; planlı düzeltme gerekir.
- **P3:** düşük pratik etkili sınır, eğitim ayrıntısı veya iyileştirme.

Önem, erişim kapsamından ve kanıt güveninden ayrıdır. **UI** gerçek tarayıcı etkileşimi; **HTTP** gerçek servis isteği/işi; **motor** doğrudan Python çağrısı; **statik** dar kod/şekil incelemesidir. Bir alt seviye girdinin kabul edilmesi, aynı girdinin UI doğrulamalarını geçtiğini kanıtlamaz. Her bulgunun ayrıntısında verilen girdiler önce kurulup ilgili tekrar scripti çalıştırılır; beklenen ve gözlenen değerler karşılaştırılır. Bütün motor bulguları için aşağıdaki kalıcı kanıt/tekrar komutları geçerlidir. Her paketin results.json dosyasında adı verilen probe veya karşılaştırma bulunur; ayrıntıdaki girdiler ve dar erişim kapsamı esas alınır.

**Aritmetik doğrulama**, **knowledge assessment** (bağımsız mühendislik bilgisi/denge) ve **birincil kaynak doğrulaması** farklı hükümlerdir. Özgün kitap/standart/PDF görülmeyen yöntemler burada standart tasdiki almaz. Test başarısı saha kalibrasyonu veya mevzuat onayı anlamına gelmez. Yöntem ve katsayı envanterlerinin ayrıntıları raporun sonundadır.

## Çalışan ortam ve mevcut testler

Python 3.12.14, Node 24.19.0, npm 11.9.0 ve Chromium 154 ile uygulamanın üretim web derlemesi çalıştırıldı. UX, işlev ve bağımsız kontrol için ayrı ayar/proje kütüphaneleriyle 8771/8772/8773 yerel portları kullanıldı. `/api/health`, HTML, altı JS/CSS kaynağı ve ayarlar isteği HTTP 200 döndü. Bunlar yerel inceleme adresleridir.

| 22.10.2026 kontrolü | Gerçek sonuç | Açıklama |
|---|---|---|
| Python mevcut test paketi | **2.025 geçti, 2 atlandı**, çıkış 0 | Atlamalar büyük/küçük harfe duyarsız dosya sistemi testleri; bir Starlette/httpx kullanım uyarısı |
| Web Vitest | **44 dosya, 371 test geçti**, çıkış 0 | Bazı React `act(...)` konsol uyarıları |
| TypeScript typecheck | Geçti | `tsc --noEmit` |
| Vite üretim build | Geçti | Mevcut 1.321,43 kB JS parçası için boyut tavsiyesi |

Yeni bağımsız hesap denetimlerindeki `FAIL`, `mismatch` veya probe kayıtları bu mevcut paketlerin başarısız olduğu anlamına gelmez. A paketinde 668 karşılaştırmanın 654'ü tolerans içinde, 14'ü dışındadır; 63 domain gözlemi ayrıca tutulur. B paketinde 208 sayısal karşılaştırmanın 188'i tolerans içinde, 20'si dışındadır; 65 gözlem ayrıca tutulur. Aynı kök neden birçok sayısal noktada tekrarlandığı için bu sayılar benzersiz ürün hatası sayısı değildir. Denetim scriptinin çıkış0 olması denetimin tamamlandığını gösterir. İkinci bağımsız `review.py`35 karşılaştırmanın22’sinde eşleşme,13’ünde beklenen kusur-adayı farkı kaydetti; ek domain/denge kontrolleriyle29 ENG kaydının hepsine dar kapsamlı hüküm verildi. Bu13 fark13 benzersiz hata değildir.

Kanıt: [Python test günlüğü](2026-10-22-inceleme-kanitlari/runtime/pytest.log), [web test günlüğü](2026-10-22-inceleme-kanitlari/runtime/web-test.log), [typecheck](2026-10-22-inceleme-kanitlari/runtime/web-typecheck.log), [build](2026-10-22-inceleme-kanitlari/runtime/npm-build.log).



## Öncelikli sonuçlar ve kapsam hükmü

Uygulama kuruldu, gerçek hesap işleri ve Word indirmeleri tamamlandı; buna rağmen mevcut testlerin kapsamadığı ürün ve mühendislik kusurları bulundu. Öncelik yalnız görsel düzen değildir: **ekranda görünen girdinin kalıcı kaydı, hesabın yük durumu zarfı, sonucun dayanağı ve raporun gerçek hesap kimliği** önce güvenilir olmalıdır.

| Öncelik | Bulgu | Sonuç ve erişim sınırı |
|---|---|---|
| P1 | **ENG-C-001 = FUN-002**: ASD palplanş statik durumu zarf dışında bırakıyor | Farklı tasarım/deprem su seviyeleri fixture'ında SDS eklemek D18,91→8,04m ve M2399,84→436,95kNm/m yapıyor. API seed ile kurulan geçerli yapı gerçek UI'dan çalıştırıldı; bütün fixture UI'dan kurulmuş değildir. Aynı kök neden bir kez sayılmalıdır. |
| P1 | **FUN-001; UX-006/007 ile ilişkili**: kayıt bildirimi ve yerel taslak ayrışıyor | Duvar ve palplanşta q15→20, üst Kaydet, yenileme sonrası15; bazı taslaklar uyarısız kayboluyor. Duvar yükünde yalnız düğme adını değiştirmek yeterli değildir; kayıt yolu da gerekir. |
| P1 | **FUN-006**: DOCX proje kodunu gerçek yapı hesabıyla ayırmıyor | Proje AASHTO/Basic, yapı ASD/İleri; bölüm kendi yöntemini ve bazı su/deprem girdilerini taşımıyor. 43 sayısal aktarımdaki doğruluk bu izlenebilirlik açığını kapatmıyor. |
| P1 | **UX-002/003**: çelişen onay durumu ve γsat birimi | Aynı φ bir yerde güncel değil, başka yerde ONAYLI; aday yokken γsat elle girişi boyutsuz etiketli. Yanlış birimde girilmiş onaylı değer veya backend stale atlatması kanıtlanmadı. |
| P1 | **ENG-C-002**: TBDY ileri duvar sürtünme sınırı | İki motor yolunda tanδ≤0,6 kuralı uygulandığında geçme/kalma değişiyor. Değer knowledge/config tutarlılığıyla değerlendirildi; özgün TBDY sayfası bu oturumda görülmedi. Canlı UI false-pass tekrarı yapılmadı. |
| P1 | **ENG-B-001/002**: sınırsız kama ve sismik Bishop kolu | İlki genel motor yolunda kesim açısına bağlı sonlu kuvvet; ikincisi katmanlı örnekte FS0,995 yerine1,00445. Homojen nominal kontroller geçiyor. |
| P1 | **ENG-A-002**: kil tabakasına kum bağıntıları geçerli öneriliyor | CL/drenajsız SPT örneğinde φ37,186°/E12766,95kPa önerisi valid; tasarım alanına otomatik mühendis onayı yok. |
| P1 erişim | **UX-001**: mobil profil/başlık örtüşmesi | Gerçek390px viewportta belge550px, detay formu yaklaşık94px; temel düzenleme eylemleri taşar. |
| P2 | **FUN-003/007/008; UX-005/008/010** | Stale nedeni yanlış, etkin su koşulları eksik, LPI vaat edilip sunulmuyor; tabakalama ve parametre kararları gizli bağımlılık/yoğunlukla zorlaşıyor. |
| P2/P3, dar kapsam | Diğer motor/öğretim/girdi bulguları | Genel Python API'si, patolojik sayısal sınır ve eğitim şekli ayrı değerlendirilmelidir; aşağıdaki kapsamlar bütün UI'ya genellenmez. |

Bu sınıflamada ENG-C-001 ciddi koşullu tasarım kusuru olduğu için **P1** seçildi; kaynak paketteki “P0/P1” belirsizliği kaldırıldı. ENG-B-004 **P2**: grid4'te somut geometrik aday kabul kusuru var; aynı girdinin grid8 ve varsayılan grid12 tekrarında boşluk yok, alternatif geçerli global FS ve emniyet yönü belirlenmedi. ENG-A-001 doğrudan importer için P1 birim bütünlüğü riskidir; zorunlu qc_unit override kullanan UI/HTTP aynı tekrar değildir. ENG-B-003 genel API'de P1 direnç riski, mevcut θ=0 ön pasif çağırıcılarında aynı sapma yoktur. ENG-B-006 P3 pratik/P2 sayısal sınırlıdır; ENG-C-006 P2/P3 düşük seviye sertleştirmedir. Diğer paketlerde “yüksek/orta/düşük” sırasıyla P1/P2/P3 olarak okunur; fiziksel model yorumu ile kesin sözleşme farkı ayrıca belirtilir.

Net benzersiz ürün hatası sayısı verilmedi: 29 ENG kaydı, 13 UX kaydı ve 10 FUN kaydı aynı hata sayısına toplanamaz. FUN-002 ve ENG-C-001 açık alias'tır; kayıt ve dil bulguları da ekran/katman düzeyinde ilişkili kayıtlardır. Geri çekilmiş makine epsilon, U-line uç parçası ve ilk harness'in kabul edilemez negatif pasif dalı ürün kusuru listesine katılmadı.

## Gerçek uygulama senaryoları

UX senaryoları veri girişi, profil ve eğitim yolunu; işlev senaryoları yapı analizi, sonuç, kayıt yaşam döngüsü ve raporu kapsar. “Geçti” aşağıdaki işlemin tamamlandığı anlamına gelir; hesap standardına uygunluğun tasdiki değildir.

### Proje, veri, profil ve parametre senaryoları


| ID | İşlem / veri | Sonuç | Kanıt |
|---|---|---|---|
| S01 | Boş proje kütüphanesini açma | Geçti; yeni proje ve içe alma görünür | 01-start-empty |
| S02 | `UX Araştırma 2026`, UX-001, Denetim Mühendisi ile proje oluşturma | Geçti; proje özeti açıldı | 02-new-project-dialog, 03-launcher-empty |
| S03 | Arazi/profil boş durumları ve yan gezinme | Geçti; boş durum mesajları doğru, işlem önerileri sınırlı | 04-soil-empty, 05-profiles-empty |
| S04 | Elle 0–10m profil: γ18, φ32°, c0, YASS2.5m; profil kaydet/aktif yap/proje kaydet | Geçti; iki kayıt katmanı anlaşılmıyor | 06-manual-profile, 07-manual-saved |
| S05 | Profil 1280×720 | İşlev var; tabaka formu kesitin altında, ilk ekranda yok | 08-profile-1280 |
| S06 | Profil 390×844 | Kaldı; sağ form çok dar, başlık bindiriyor, 550px taşma | 09-profile-mobile |
| S07 | CPT örnek şablonu gerçek indirme | Geçti | template-cpt.csv |
| S08 | `examples/ornek_cpt.csv`: 299 nokta, qcMPa, `;`, ondalık`,` | Geçti; içe alma ardından YASS düzenleyici açıldı | 10-cpt-import-dialog, 11-cpt-imported-editor |
| S09 | Aynı CPT'nin kPa/nokta/virgül-ayraç dönüşümü; `CPT-UX-kPa` | Geçti; 299 nokta,15m, YASS2.5m | cpt-kpa-dot.csv, 13-spt-dialog |
| S10 | `examples/ornek_spt.csv`: derinlik nokta, virgül ayraç | Geçti; 9 SPT kaydı | 14-spt-dot-imported |
| S11 | [spt-comma.csv](2026-10-22-inceleme-kanitlari/ux/spt-comma.csv): derinlik ondalık virgül, noktalı virgül ayraç | Geçti; 5 SPT kaydı,1.5/3/4.5/6/7.5m doğru okundu | 15-spt-comma-result |
| S12 | CPT otomatik katmanlama; önerileri incele, γ'ları açıkça seç, profil oluştur | Geçti;3 tabaka; öneri kendiliğinden onaylanmadı | 16-layering-cpt-dialog,17-cpt-proposal,18-cpt-profile-created |
| S13 | Aktif profil10m iken13.5m SPT'yi tabakalama | Kaldı;422, ham İngilizce aralık hatası | 19-spt-proposal, events.json |
| S14 | Aktif CPT profilini15m yapıp aynı SPT önerisi; γ18/19 elle, profil oluştur | Geçti;2 tabaka. Aktif profil bağımlılığı doğrulandı | 20-spt-proposal-active15,21-parameters-initial |
| S15 | Parametreleri yenile→φ önerisini seç→uygula→değerleri görerek onay | Geçti;φ40.022° onaylandı, diğerleri onaylanmadı | 22-params-viewport,23-param-approval-confirm,24-param-approved |
| S16 | γsat aday yok→Elle seç→20 yaz | Form açıldı; birim `[-]` hatalı | 27-gamma-sat-manual,28-gamma-sat-en-dark |
| S17 | Açık parametre taslağında TR→EN ve açık→koyu | Geçti;20 taslağı korundu | 28-parameter-draft-en-dark.json |
| S18 | Uygulanmamış parametre taslağını yenile | Kaldı;taslak uyarısız kayboldu | 28/29 metinleri, events.json (dialog yok) |
| S19 | CPT alan oranı0.8→0.75; parametre ekranına dön | Stale koruması geçti;φ BAYAT, Onayla kilitli | 29-param-stale |
| S20 | Aynı stale tabakayı profil ekranında gör | Kaldı;ONAYLI rozeti ile çelişiyor |46-stale-profile-row,stale-conflict-summary.json |
| S21 | USCS FC70,LL45,PI25 | Geçti;CL; sonuç açıklama/notları TR'de İngilizce |30-uscs-form,31-uscs-result |
| S22 | Eğitim sınıflandırma konusu öğrenci+mühendis sekmeleri | Geçti;içerik ve formüller var, uzun metin içinde yön bulmak zor |34b-education-student-viewport,35-education-engineer |
| S23 | Eğitim EN/koyu,mobil ve galeri | Açıldı;mobil üst başlık taşması;galeri iç QA kapsamı |36b-education-mobile-settled,37-education-en-dark,38-education-gallery |
| S24 | Proje kaydet/kapat,kütüphaneden çoğalt,dışa aktar,gerçek indir | Geçti |40-project-library,41-project-duplicated,42-project-export-dialog,43-project-exported |
| S25 | İndirilen gtk yeniden yükle,aç,3 profilin geldiğini kontrol et | Geçti;aynı adlı iki proje ayırt edilemiyor |44-project-reimported,45-project-reopened,live-profiles.json |
| S26 | Profil çoğalt,ad taslağı gir,dil+tema değiştir,yenile | Dil/tema korudu;yenileme taslağı ve seçili profili düşürdü |47-profile-copy,48-profile-refresh-draft |
| S27 | Katmanı3m'de böl,geri al,yinele,kaydet | Geçti;tablo satır sayısı5→4→5 (başlık dahil) |49-split-dialog.json,50-layer-split-saved.png |
| S28 | Böl açılınca odak;Tab;Escape;odaklı Böl'de Enter | Geçti;input odağı,Tab→İptal,Escape→açan Böl ikonuna dönüş,Enter işlemi yaptı |keyboard-checks.json |
| S29 | %200 CSS büyütme | Kaldı;çok dar profil detay alanı,scrollWidth1580;yerel zoom testi değil |39-profile-zoom200 |
| S30 | Eğitim/sıvılaşma MSF figürünü görünür açıp görüntüle | Açıldı;görsel kanıt mühendislik ajanına iletildi |51-education-msf.png |

Export ve gerçek indirme aynı119193byte; SHA256 `23d51bbd9bd75a209b87a41e619a14c06b3829f853f3b07c5c543ca67d7d1f2e`. Reimport UI üzerinden yapıldı; API ile veri uydurulmadı. İçe alınmış ilk projede sonradan yalnız incelemeye ait profil kopyası/bölme işlemi yapıldı.

**Başarılı akışların güçlü yanları:** CSV şablonu indirilebilir; MPa/kPa ve nokta/virgül açık seçilir; içe alma sonrası YASS istenir; öneri ile onay ayrılır; onaydan önce sayısal değer gösterilir; stale sonrası tekrar uygulama zorunlu; katman eylemleri adlandırılmış; Escape odak geri dönüşü çalışır; öğrenci anlatımı gerçek çözümlü örnekler içerir.

**Engellenen/başarısız akışlar:** mobil profil düzenleme, aktif profil derinliğiyle çakışan SPT tabakalama, γsat birimini öğrenme, ekranlar arası onay durumunu güvenle yorumlama ve yenilemede taslak koruma. Native %200zoom, ekran okuyucu, kontrast oranı ve bütün hesap modüllerinin UX'i bu görevin tamamlanmış testi değildir.



### QA girdilerinin kaynağı ve erişim kapsamı

- Yeni proje `QA İŞLEV GeoTek`, mühendis `QA denetimi — tasarım değildir`, gerçek UI ile oluşturuldu. Başlangıç proje kodu UI varsayılanı AASHTO LRFD'dir.
- İki **API seed** profil: homojen kum0–40m, γ18/γsat20 kN/m³, φ′30°, c′0kPa, YASS100m; iki tabaka 0–6/6–40m, γ18/19, γsat20/21, φ′30/32, c′0, YASS2m. Bunlar tasarım önerisi değil, açık QA girdileridir. `seed-profiles.json`, `seed.py` ve `api.jsonl` tam kayıttır.
- `examples/ornek_spt.csv` ve `examples/ornek_cpt.csv` **API seed import** edildi; her iki araştırmada YASS3m API ile tanımlandı. Sıvılaşma girdileri t10 fixture'ından: amax0.4g, Mw7.5, hedefGS1.1, cFC0, Ic2.6, varsayılanFC5%, depremYASS3m.
- Duvarlar ve normal konsol/ankrajlı palplanşlar gerçek UI ile oluşturuldu, profil kopyalama UI'dan seçildi. Ayrıca elle zemin girilen kuru palplanş gerçek UI ile oluşturulup hesaplandı (ek fixture).
- Üç seviyeli ankraj analizi UI'dan: H10m, seviyeler1.5/4.5/7.5m, aralık2.5m, pasifGS1.5 (GEC-4 açıklaması ve API test fixture'ı). Ayrı ankraj BODY fixture'ı UI'dan: H10, baş6.25, eğim15°, φ33°, yatay172kN/m, aralık2.5m, kökFS2, qu100kN/m, kilitleme1. Kaynak alanına açık QA/test dosyası adı yazıldı.
- İleri konsol: β10°, q15kPa, SDS0.5, kayma dişi0.5×0.5m; bunlar G8/ankraj test fixture ve programın açık kesit girdileridir. Eksik TBDY katsayıları doldurulmadı; 9 eksik katsayıyla 422 engeli doğrulandı, sonra ASD seçildi. Kullanıcı/mühendis onayı gerektiren pasif direnç seçeneği etkinleştirilmedi.
- FUN-002 karma su koşullu yapı **tamamen API seed** ile oluşturuldu. Ardından SDS değişimi, yerel Kaydet ve her iki hesap gerçek tarayıcıdan yapıldı. Tam fixture `envelope_flow.py`; su koşullarının tamamının UI'dan kurulabildiği iddia edilmiyor.
- Lifecycle için kaynakγ18→18.1 sadece test perturbasyonudur; raporların eskitilmesi/kopyanın korunması içindir. Mutasyonlar kaydedilmeden önceki QA dosyası yeniden açılıp normal durum geri getirildi.


### Yapı, hesap, sonuç, rapor ve yaşam döngüsü

| Akış | Sonuç | Kanıt |
|---|---|---|
| Yeni proje, yeni konsol ve ağırlık duvarı | Başarılı UI oluşturma | 02,03,04,25 ekranları; POST library/structures200 |
| Duvar 5 adım; zemin kaynağı, geometri, yük, hesap, sonuç | Geçişler çalışıyor; konsol kontrollü hesap ve boyut önerisi done | 05–11; terminal job kayıtları |
| TBDY ileri eksik katsayılar | Beklenen422 missing_factors,9 açık kaynaklı girdi; sessiz değer yok | 08, browser-network.jsonl |
| İleri duvar: SDS,eğim,sürşarj,diş, sulu ağırlık | Hesaplar done; uygunsuz tahkikler kırmızı gösteriliyor | 09,10,26; API yapı JSON'ları |
| Palplanş konsol/ankraj, projeden profil | UI create/design done; netbasınç,kesme,moment var | 16–18, API202→done |
| Palplanş elle zemin | UI create/design done | 51,52 |
| Palplanş dirty/save | Hesap düğmesi yerel dirty iken kapalı; üst Kaydet sorunu FUN-001 | 33–36 |
| 3 seviyeli ankraj ve ayrı ankraj tasarımı | Gerçek UI POST200; saklanan durum ve sonuçlar mevcut | 19–22 |
| BI2014 ve Youd2001, SPT+CPT | İki gerçek job done; iki araştırma da sonuçlu | 23,24, jobs-summary.json |
| Sıvılaşma SPT/CPT seçimi ve tablolar | UI'dan CPT seçildi; durumlar ve tam tablo mevcut | 24,32 |
| TR/EN, seçili11 bölüm DOCX | Gerçek browser indirme200; ZIP/XML/python-docx geçti | docx/qa-all-{tr,en}.docx |
| Kaydet→aynı projeyi aç→sonuç/hash | Sonuç ve hash birebir korundu | lifecycle.json |
| Kaynak profil değişimi→yapı kopyası | Kaynak18.1 olurken yapı18 kaldı; otomatik kaynak mutasyonu yok | lifecycle.json |
| UI kaynakla eşitle | Yapıγ18.1 oldu; önceki sonuç stale kaldı | 40,41,lifecycle.json |
| Eski rapor ve eski UI seçimleri | Beklenen409 stale_result; ilgili UI kutuları disabled | 43,44,api.jsonl |
| Çalışan iş sırasında proje yeniden açma | Failed, stale_structure,discarded=true; sonuç yayımlanmadı | 45,46,discard-job.json |
| Gerçek duvar job'unu UI'dan iptal | cancelled, resultnull; önceki geçerli sonuç korundu | 47,cancel-job.json |
| Gerçek palplanş queued job'unu UI'dan iptal | cancelled,progress0,resultnull | 48,pile-cancel-job.json |
| EN/koyu800×900 | Dört modül kullanıldı; document scrollWidth800 | 29–32,narrow-metrics.json |

Duvar iptal ekranı47, iptal isteği sonrası UI henüz işi sürüyor gösterirken yakalandı; terminal `cancelled` ve önceki sonucun korunması takip eden gerçek API yanıtıyla doğrulandı. Duvar UI'sının nihai iptal mesajı bu görüntüde doğrulandı diye sayılamaz.

Palplanş işi küçük veride çok hızlı bittiği için iptal testi iki gerçek uzun duvar boyutlandırma işiyle iki worker meşgul edilerek kuyruğa alındı. Kuyruktaki palplanş gerçek UI düğmesinden iptal edildi; yardımcı iki duvar işi sonra API'den iptal edildi. Motor veya ağ cevabı taklit edilmedi. Polling HTTP200 döner; proje değişimindeki409, iş hata semantiğinin `stale_structure` kodudur. HTTP202 başlatmanın kendisi başarısız değildir.



## Ayrıntılı arayüz ve işlev bulguları

### Veri/profil/parametre ve eğitim arayüzü

### UX-001 — P1 — Mobil başlık ve profil düzeni temel eylemleri örtüyor

**URL ve önkoşul:** `/m/soil/profiles`; en az bir profil; 390×844; TR/açık. Eğitimde de başlık taşması tekrarlanır.

**Girdi ve adımlar:** Elle profili kaydet; viewport'u 390×844 yap; üst kontrolleri, profil alanını ve buton kutularını incele.

**Beklenen / gözlenen:** Başlık yüksekliği içeriğe uymalı, profil seçimi ve form tek kolona geçmelidir. Gerçekte viewport 390px, document.scrollWidth 550px. Sabit 250px profil listesi sağ formu yaklaşık 94px'e sıkıştırıyor. Kontroller 100px başlığı aşıp sayfa başlığını örtüyor. `En alta katman ekle` kutusu x355–524, y1915–1941; yalnız ilk 35px'i görünür genişlik içinde. `Aktif yap` sağ kenarı 391px. Full-page PNG'nin 550px genişliği gerçek viewport değil, taşan belgedir. Eğitimde 700ms beklenmiş görüntüde de üst eylemler başlığı örtüyor.

**Kanıt:** `09-profile-mobile.png/json`, [36b-education-mobile-settled.png](2026-10-22-inceleme-kanitlari/ux/36b-education-mobile-settled.png). [39-profile-zoom200.png](2026-10-22-inceleme-kanitlari/ux/39-profile-zoom200.png) ayrıca CSS büyütme simülasyonudur.

**Kod:** `app/ModuleShell.tsx:51` sabit 100px başlık; `soil/pages/ProfilesPage.tsx:261` sabit 250px liste, `:355` nowrap.

**Etki / güven:** Mobil görüntüleme ve düzenleme ciddi ölçüde aksıyor; yüksek güven. Yanlış hesap sonucu iddiası yok.

### UX-002 — P1 — Aynı parametre bir ekranda BAYAT, profil tablosunda ONAYLI

**URL ve önkoşul:** `/m/soil/parameters` ve `/m/soil/profiles`; CPT profilinin ilk tabakasında φ onaylı.

**Girdi ve adımlar:** Arazi kaydında CPT-UX-MPa koni alan oranını 0.8→0.75 değiştir ve kaydet; parametrelere, sonra profile dön.

**Beklenen / gözlenen:** Bütün yüzeyler aynı onay ve güncellik durumunu göstermelidir. φ kartı BAYAT, eski 40.022° artık onaylı değil ve Onayla kapalı. Profil aynı tabakayı yeşil ONAYLI ve kesitte eski 40° gösteriyor. Profil UUID `a2a0ff79cab6471c9d3701e6ea6e12da`; tabaka `b5bba18300e942b280af754aef89431d`. GET profile içinde φ.approved=true; GET layer parameters içinde φ.approved=false; approved_at ikisinde de `2026-10-22T14:55:28.180311Z`.

**Kanıt:** [29-param-stale.png](2026-10-22-inceleme-kanitlari/ux/29-param-stale.png), [46-stale-profile-row.png](2026-10-22-inceleme-kanitlari/ux/46-stale-profile-row.png), [stale-conflict-summary.json](2026-10-22-inceleme-kanitlari/ux/stale-conflict-summary.json), [stale-profile-api.json](2026-10-22-inceleme-kanitlari/ux/stale-profile-api.json), [stale-parameters-api.json](2026-10-22-inceleme-kanitlari/ux/stale-parameters-api.json).

**Kod:** `shared/soil/LayerEditor.tsx:318`, `shared/soil/layerStatus.ts:49`, `soil/components/ParameterKeyCard.tsx:120`, `soil/parameterState.ts:11`.

**Etki / güven:** Mühendis eski onayı geçerli sanabilir; yüksek güven. Backend'in eski değerle hesap yaptırdığı bu UX çalışmasında kanıtlanmadı.

### UX-003 — P1 — γsat elle girişinde fiziksel birim yerine `[-]`

**URL ve önkoşul:** `/m/soil/parameters`; doygun birim ağırlık için aday bulunmuyor.

**Girdi ve adımlar:** γsat kartında Elle seç; 20 yaz; EN ve koyu temaya geç.

**Beklenen / gözlenen:** Doygun birim hacim ağırlık her durumda kN/m³ olarak etiketlenmelidir. Kart başlığında birim yok; TR `Değer [-]`, EN `Value [-]`. Diğer γ kartında kN/m³ var. Birim adaydan türetildiği için aday yokken kayboluyor.

**Kanıt:** `27-gamma-sat-manual.txt/json`, [28-gamma-sat-en-dark.png](2026-10-22-inceleme-kanitlari/ux/28-gamma-sat-en-dark.png).

**Kod:** `soil/components/ParameterKeyCard.tsx:121` birim türetme; `:276` unit||"-".

**Etki / güven:** Fiziksel girdi boyutsuz sunuluyor; yanlış birimde aktarma riski var. Yüksek güven; yanlış birimde değer bu çalışmada onaylanmadı.

### UX-004 — P2 — İlk elle profilin zorunlu γ alanı ilk görünümün dışında

**URL ve önkoşul:** `/m/soil/profiles`; yeni elle profil; 1440×900.

**Adımlar:** Elle boş profil oluştur; ilk tablo görünümünü incele; γ=18 girerek kaydet.

**Beklenen / gözlenen:** Zorunlu temel alanlar önce görünmeli, hata alanına gidilebilmelidir. İlk tabloda Kimlik/Üst/Alt/Tanım ve yapışkan işlemler görünürken γ yatay kaydırmanın içinde. `1 HATA` ve devre dışı Kaydet var; γ hatası metinle belirtiliyor ancak alanı açan bağlantı yok. Kaydedilince L1 yerine 32 karakter UUID inputları alan tüketiyor. 1280×720'de tablo kesitin altına iniyor; ilk ekrandan erişilemiyor.

**Kanıt:** [06-manual-profile.png](2026-10-22-inceleme-kanitlari/ux/06-manual-profile.png), [08-profile-1280.png](2026-10-22-inceleme-kanitlari/ux/08-profile-1280.png), [07-manual-saved.json](2026-10-22-inceleme-kanitlari/ux/07-manual-saved.json).

**Kod:** `shared/soil/LayerEditor.tsx:281`, `:440`; `soil/pages/ProfilesPage.tsx:469`.

**Etki / güven:** Yeni başlayan ilk profili tamamlamak için gizli alan arıyor; yüksek güven.

### UX-005 — P2 — Geçerli SPT dosyası görünmeyen aktif profil bağımlılığıyla duruyor

**URL ve önkoşul:** `/m/soil/profiles`; aktif elle profil 0–10m, BH-UX-dot kaydı 13.5m.

**Adımlar:** Yeni profil → SPT'den → Tabakaları öner; ardından 15m CPT profilini aktif yapıp aynı kaynakla tekrarla.

**Beklenen / gözlenen:** Kullanılan gerilme profili ve kapsamı açık seçilmelidir. İlk istekte gerçek 422: `Depth outside the profile (0 - 10.0 m)`. TR üst mesaj yalnız `Doğrulama hatası: girdi değerlerini kontrol edin.`. Ekranda sondaj/yöntem var; aktif profil bağımlılığı yok. 15m profil aktifken aynı SPT kaynağı başarılı.

**Kanıt:** `19-spt-proposal.png/txt`, [20-spt-proposal-active15.txt](2026-10-22-inceleme-kanitlari/ux/20-spt-proposal-active15.txt), [events.json](2026-10-22-inceleme-kanitlari/ux/events.json).

**Kod:** `soil/components/LayeringModal.tsx:187`, `:239`; `soil/components/ErrorAlert.tsx`; `shared/api/errorMessage.ts`.

**Etki / güven:** Kullanıcı doğru CSV'yi değiştirerek yanlış yerde çözüm arayabilir; yüksek güven.

### UX-006 — P2 — İki Kaydet işleminin kalıcılık sınırı açıklanmıyor

**URL ve adımlar:** Profilde γ/φ gir; profilin Kaydet düğmesine bas; üst duruma bak.

**Beklenen / gözlenen:** Oturuma uygulama ile .gtk dosyasına yazma ayrı isimlerle açıklanmalıdır. Aynı anda yeşil `Profil kaydedildi.` ve üstte `KAYDEDİLMEMİŞ DEĞİŞİKLİKLER` var; iki düğme de Kaydet. Davranışın iki aşamalı olması tek başına hata değil, kullanıcıya anlatılmaması sorundur.

**Kanıt:** [07-manual-saved.png](2026-10-22-inceleme-kanitlari/ux/07-manual-saved.png), [24-param-approved.json](2026-10-22-inceleme-kanitlari/ux/24-param-approved.json).

**Kod:** `soil/pages/ProfilesPage.tsx:432`, `:444`; `app/ModuleShell.tsx:66`; `ProjectProvider.tsx:87`.

**Etki / güven:** Dosyada neyin korunduğu konusunda yanlış güven; yüksek güven.

### UX-007 — P2 — Yenileme uygulanmamış taslağı uyarısız kaybettiriyor

**URL ve önkoşul:** Parametre γsat Elle=20 taslağı veya çoğaltılan profilde ad taslağı.

**Adımlar:** Taslak yaz; dil ve tema değiştir; sayfayı yenile.

**Beklenen / gözlenen:** Taslak geri yüklenmeli veya kaybolmadan önce uyarı olmalıdır. Dil/tema taslağı koruyor. Yenilemede γsat Elle inputu yok oluyor; profil adı taslağı kayboluyor, seçili kopya yerine aktif CPT profiline dönülüyor. Yakalanan dialog listesinde yenileme uyarısı yok. Yerel kaydedilmiş veri korunuyor; bulgu uygulanmamış taslak içindir.

**Kanıt:** [28-parameter-draft-en-dark.json](2026-10-22-inceleme-kanitlari/ux/28-parameter-draft-en-dark.json), [47-profile-copy.json](2026-10-22-inceleme-kanitlari/ux/47-profile-copy.json), [48-profile-refresh-draft.json](2026-10-22-inceleme-kanitlari/ux/48-profile-refresh-draft.json), [events.json](2026-10-22-inceleme-kanitlari/ux/events.json).

**Kod:** `ParameterKeyCard.tsx:111` yerel state; `ProfilesPage.tsx:103` yerel guard; `ParametersPage.tsx:46` dirtyKeys.

**Etki / güven:** Uzun form emeği kaybı; yüksek güven.

### UX-008 — P2 — Tabakalamada aşırı sayı hassasiyeti ve aşağıda kalan eylem

**URL ve adımlar:** CPT 299 nokta için otomatik Tabakaları öner; 1440×900.

**Beklenen / gözlenen:** Okunabilir sayılar, açık birimler ve erişilebilir oluşturma eylemi gerekir. `17.919418366190715 kullan`, Ic `1.9591580084795448`; tablo genişliyor, γ butonları kırpılıyor. Uzun uyarıların ardından profil adı/YASS ve oluşturma düğmesi ilk 900px'in altında. SPT N60 da `4.220000000000001` biçiminde.

**Kanıt:** [17-cpt-proposal.png](2026-10-22-inceleme-kanitlari/ux/17-cpt-proposal.png), [20-spt-proposal-active15.txt](2026-10-22-inceleme-kanitlari/ux/20-spt-proposal-active15.txt).

**Kod:** `LayeringModal.tsx:290`, `:320`, `:364`, `:407`.

**Etki / güven:** İnceleme yavaşlar, gerçekte olmayan hassasiyet izlenimi oluşur; yüksek güven.

### UX-009 — P2 — TR kritik uyarı ve açıklamalarda İngilizceye düşüyor

**URL ve adımlar:** Parametrelerde su adaylarını incele; USCS FC70/LL45/PI25 hesapla.

**Beklenen / gözlenen:** Eylem ve geçerlilik sınırları seçili dilde olmalıdır; kaynak künyeleri özgün dilde kalabilir. TR ekranda `I_c = ... correlation is for clay-like (undrained) soils`, `Organic soils (OL/OH) not checked` ve USCS açıklamaları İngilizce. EN'de δ kaynak açıklaması Türkçe. EN büyük harflerinde `SUGGESTİON/ACTİVE PROFİLE` görüldü.

**Kanıt:** [21-parameters-initial.txt](2026-10-22-inceleme-kanitlari/ux/21-parameters-initial.txt), [31-uscs-result.txt](2026-10-22-inceleme-kanitlari/ux/31-uscs-result.txt), [28-parameter-draft-en-dark.txt](2026-10-22-inceleme-kanitlari/ux/28-parameter-draft-en-dark.txt), [48-profile-refresh-draft.txt](2026-10-22-inceleme-kanitlari/ux/48-profile-refresh-draft.txt).

**Kod:** `ParameterKeyCard.tsx:97`, `ClassificationPage.tsx:415`, `useWarningText.ts`, `app/i18n.ts`.

**Etki / güven:** Yeni başlayan önemli sınırı kaçırabilir; yüksek güven.

### UX-010 — P2 — Parametre ekranı karar özeti yerine yöntem ve uyarı yüküyle açılıyor

**URL ve önkoşul:** CPT 3 tabakalı profil; ilk drenajlı tabaka.

**Adımlar:** Parametrelere gir; Hepsi için öner.

**Beklenen / gözlenen:** Tabaka derinliği/adı, gerekli parametreler, seçili değerler ve eksikler önce gelmelidir. Başlık yalnız UUID; 7 kart 3267px, mobil 4429px. Su kartında 28 farklı Ic uyarısı iki yöntemde tekrarlanıyor; hücreler kendi 160px scroll alanlarında. `mean(KM1990_phi_CPT,RC1983_phi_CPT)` iç kimliği ve A/B güvenilirlik harfleri açıklamasız. Onay modali tabakayı UUID ile tanımlıyor.

**Kanıt:** [22-params-viewport.png](2026-10-22-inceleme-kanitlari/ux/22-params-viewport.png), [25-parameters-1280.png](2026-10-22-inceleme-kanitlari/ux/25-parameters-1280.png), [26-parameters-mobile.json](2026-10-22-inceleme-kanitlari/ux/26-parameters-mobile.json), [23-param-approval-confirm.txt](2026-10-22-inceleme-kanitlari/ux/23-param-approval-confirm.txt).

**Kod:** `ParametersPage.tsx:255`, `:292`; `ParameterKeyCard.tsx:43`, `:60`, `:95`.

**Etki / güven:** Teknik ayrıntı temel kararı gömüyor; yüksek güven.

### UX-011 — P2 — Eğitimde uzun içerik içinde yön bulma eksik

**URL ve adımlar:** `/m/education/topic/classification`; öğrenci ve mühendis sekmelerini aç; alt başlıkları bul.

**Beklenen / gözlenen:** Öğrenme hedefi, önbilgi, içindekiler ve bağlamlı araca dönüş olmalıdır. Öğrenci tek akış 9326px, mühendis 4408px; sol menü yalnız Konular. Çözümlü örnekler ve kapsam sınırları yararlı; bölüm seçimi/okuma ilerlemesi/ilgili araca gidiş yok. Uzun formül satırları yatay kaydırma gerektiriyor.

**Kanıt:** [34-education-student.json](2026-10-22-inceleme-kanitlari/ux/34-education-student.json), [34b-education-student-viewport.png](2026-10-22-inceleme-kanitlari/ux/34b-education-student-viewport.png), [35-education-engineer.png](2026-10-22-inceleme-kanitlari/ux/35-education-engineer.png).

**Kod:** `education/pages/TopicPage.tsx:137`, `:155`.

**Etki / güven:** Öğrenci kaybolur, mühendis belirli kaynağa yavaş erişir; yüksek güven. İçerik doğruluğu ayrı mühendislik incelemesidir.

### UX-012 — P2 — Yeniden içe alınan aynı adlı projeler ayırt edilemiyor

**URL ve adımlar:** `/start`; projeyi indir, aynı .gtk'yi tekrar yükle; kütüphaneye ve Son projelere bak.

**Beklenen / gözlenen:** Dosya adı veya kopya bilgisi belirgin olmalıdır. İki `UX Araştırma 2026`, aynı no/mühendis; yalnız saat farklı. Son projelerde iki aynı düğme; üç noktanın aria adı da aynı. Dosya kimliği gösterilmiyor. Reimport başarılı; sorun seçimde kimliği anlayamamak.

**Kanıt:** `44-project-reimported.png/json`.

**Kod:** `app/pages/StartPage.tsx:430`, `:460`.

**Etki / güven:** Yanlış dosyayı açma veya dışa aktarma riski; yüksek güven.

### UX-013 — P3 — Kaydedildi bildirimi üst eylemi kapatıp tıklamayı yakalıyor

**URL ve adımlar:** Profil üst Kaydet → Ana menü → hemen Projeyi kapat.

**Beklenen / gözlenen:** Başarı bildirimi sonraki temel eylemi örtmemelidir. `Kaydedildi` toast'ı Projeyi kapat üstünde; iki ayrı 5s denemesinde pointer interception. İmleç üstündeyken zamanlayıcı durabiliyor; imleci uzağa taşıyıp 5500ms bekleyince kapatma başarılı.

**Kanıt:** [40a-toast-blocks-close.png](2026-10-22-inceleme-kanitlari/ux/40a-toast-blocks-close.png); tıklama araç izi; bu sırada başarısız API isteği yok.

**Kod:** `app/main.tsx:33` Notifications top-right; `ModuleShell.tsx:42` bildirim.

**Etki / güven:** Kısa akış duraklaması; yüksek güven. Kalıcı veri kaybı değil.

### Yapı ve rapor işlevleri

### FUN-001 — P1: Üst Kaydet başarılı bildirip ekrandaki duvar yükünü kaydetmiyor

- URL: `/m/walls/s/a447668f-d464-4064-a358-a1b262473d2b`; ayrıca `/m/sheet_pile/s/06bd9ef3-f4c0-439e-a209-d35c5a58944c`.
- Adımlar: kayıtlı q15→Yükler/deprem→q20 doldur→üst **Kaydet**→“Kaydedildi”→sayfayı yenile. Palplanşta da q15→20→üst Kaydet→yenile.
- Beklenen: Kaydet ekrandaki düzenlemeyi saklamalı veya açıkça saklanmayan yerel formu belirtip başarı mesajını buna göre sınırlandırmalı.
- Gözlenen: duvar q20 görünürken `/api/project/save`200 ve başarı bildirimi geliyor; `GET /api/structures/{id}` içinde q15 kalıyor; reload'da UI15 oluyor. Duvar yükler ekranında ayrı yerel Kaydet yok; form ancak hesap başlamadan PUT edilerek saklanıyor. Palplanşta iki aynı isimli Kaydet'ten üstteki yerel alanı saklamıyor; alttaki saklıyor. Düzenleme kaybı ve eski girdili raporu doğru sanma riski var.
- Kanıt: [49-wall-global-save-local-draft.png](2026-10-22-inceleme-kanitlari/functional/screenshots/49-wall-global-save-local-draft.png) (q20+Kaydedildi), [50-wall-global-save-reload-lost.png](2026-10-22-inceleme-kanitlari/functional/screenshots/50-wall-global-save-reload-lost.png); [wall-draft-loss.json](2026-10-22-inceleme-kanitlari/functional/wall-draft-loss.json); palplanş33/34/35. [requests.csv](2026-10-22-inceleme-kanitlari/functional/requests.csv) üst SavePOST200 ve takip eden GET200'ü buldurur. Script: [wall_draft_loss.py](2026-10-22-inceleme-kanitlari/functional/wall_draft_loss.py), [dirty_lifecycle.py](2026-10-22-inceleme-kanitlari/functional/dirty_lifecycle.py).
- Tekrarlanabilirlik: iki modülde bağımsız; duvar15→20→15 kesin doğrulandı. Kod: `web/src/modules/walls/pages/WallWizardPage.tsx:316`–350 sadece run öncesi sync; `web/src/modules/sheet_pile/pages/SheetPileDetailPage.tsx:136` yerel save, lokal `inputs`.
- Öneri: formdirty durumunu merkezi kaydet/çıkış akışına bağla; düğmeleri “Yapı girdilerini kaydet” ve “Proje dosyasını kaydet” diye ayırmak tek başına duvarın kaydetme eksikliğini çözmez.

### FUN-002 — P1/Kritik mühendislik: SDS eklendiğinde palplanş statik zarfı kayboluyor (C ile aynı bulgu)

- URL: `/m/sheet_pile/s/83f35366-c392-475f-9637-5f92f070e578`.
- Girdi: ASD,konsol,H5m,kum0–40m,γ18/γsat20,φ30°,q0,β0; retainedGWT=(0,0,100),frontGWT=(5,5,100) [arazi,tasarım,deprem]. API seed açıkça kaydedildi.
- Adımlar: SDS0.1 ile gerçek UI “Tasarımı çalıştır”; sonra aynı formdaki SDS'yi boşalt→alttaki Kaydet→yeniden Tasarımı çalıştır.
- Beklenen: deprem durumu eklemek statik tasarım gereksinimini zarf dışında bırakamamalı.
- Gözlenen: SDS0.1: D8.039288389m,M436.945004kNm/m; SDSboş: D18.908596121m,M2399.835231kNm/m. Tarayıcı her ikisini olağan “Sonuç var” olarak gösteriyor. C bağımsız statik M2399.835292 ve D18.908596 sonucunu elde etti. Bu UI/API aktarımında da gerçek, son kullanıcı tarafından çalıştırılabilir sonuçtur; **ENG-C-001** ayrıntısındaki bağımsız statik hesapla aynı kusuru doğrular.
- Kanıt: `envelope-{seismic,static}.json`, ekran37/38/39; gerçek design jobs `d51c00df-3ec8-4a96-b31c-30877379b45d` ve `0af99ba1-d0c0-4f2b-a0c2-5ad385b2fe0a`, POST202→done. Script [envelope_flow.py](2026-10-22-inceleme-kanitlari/functional/envelope_flow.py).
- Tekrarlanabilirlik: aynı yapıdaki iki ardışık gerçek run. Kod konumu C tarafından: `geotek/services/structures.py:746`; UI giriş/çıkış `sheet_pile/InputsForm.tsx:95`, `SheetPileDetailPage.tsx:169`, `ResultPanel.tsx:85`.

### FUN-003 — P2: Sadece sürşarj değişirken “Kaynak zemin değişti” uyarısı çıkıyor

- URL: normal konsol palplanş. Adımlar: q15→20→alttaki Kaydet; kaynak profili hiç değiştirme.
- Beklenen: sonuç girdisi değişti uyarısı; kaynak kopyası yalnız kaynak hash'i gerçekten farklıysa eski sayılmalı.
- Gözlenen: “BAYAT (ZEMİN DEĞİŞTİ)”, “Kaynak zemin profili güncel değil”, “Kaynak profil kopyalandıktan sonra değişti” ve “Kaynak profille eşitle” önerisi. Kaynak/kopyaγ18 ve φ30 olarak korunuyor. Daha sonra gerçek kaynak değişimi ve eşitleme testinde de genel sonuçstale, kaynakstale ile karışıyor.
- Etki: mühendis yanlış nedenle zemin eşitleyebilir; form değişimini düzeltmek için gereksiz ve olası özel kopya kaybına yönlendiriliyor. Backend eski raporu409 ile doğru reddediyor.
- Kanıt: [36-pile-saved-input-stale.png](2026-10-22-inceleme-kanitlari/functional/screenshots/36-pile-saved-input-stale.png), [dirty_lifecycle.py](2026-10-22-inceleme-kanitlari/functional/dirty_lifecycle.py), [api.jsonl](2026-10-22-inceleme-kanitlari/functional/api.jsonl.gz)de qPUT, ayrı kaynak perturbasyonu daha sonra. Tekrar: q değişimiyle deterministik. Kod: `SheetPileDetailPage.tsx:191`–205 `summary.stale && source` her türlü stale için kaynak uyarısını açıyor.

### FUN-004 — P2: EN sonuç ve DOCX'te mühendislik uyarılarının önemli bölümü Türkçe

- URL: `/m/walls/s/{id}` Sonuç, `/m/report`, EN seçili.
- Adımlar: EN'e geç→duvar sonuçları/uyarılarını aç→11 bölümü seçili raporu indir.
- Beklenen: seçilen dilde sonuç, koşul ve güvenlik uyarıları; kaynak eser adları özgün kalabilir.
- Gözlenen: EN wallUI'da ±kv uyarısı Türkçe; EN DOCX'te “Beton birim hacim ağırlığı…”, “Kısmen su altındaki dolgu…”, “Su altındaki dolgu…r>1…gerekçelendirilmelidir” gibi birçok **uyarı/varsayımın gövdesi** Türkçe. Yalnız kaynak künyesi değil. TRUI'da kart detayları `Bishop circle centre…`, `governing surface…` İngilizce. EN rapor seçiminde iki ankraj başlığı proje dili TR'de kalıyor.
- Etki: EN kullanıcısı geçerlilik sınırını okuyamıyor. SayısalTR/EN aktarımı doğru olması bu açığı kapatmıyor.
- Kanıt: [29-wall-en-dark-narrow-viewport.png](2026-10-22-inceleme-kanitlari/functional/screenshots/29-wall-en-dark-narrow-viewport.png), [28-report-en-downloaded.png](2026-10-22-inceleme-kanitlari/functional/screenshots/28-report-en-downloaded.png), [docx/qa-all-en.txt](2026-10-22-inceleme-kanitlari/functional/docx/qa-all-en.txt)/DOCX; script [download_reports.py](2026-10-22-inceleme-kanitlari/functional/download_reports.py). Tekrar her aynı raporda. Kod: `WallCheckCards.tsx:44,118` hamdetail; `WallResultView.tsx:133`; `HomePage.tsx:110` section.name; `geotek/modules/anchored_wall/report.py:34` proje dilinden sectionname; `geotek/modules/report/api.py:54` writer'e geçiş.

### FUN-005 — P3: Duvar sonuç kesitinde katman adları yerine UUID ve üst üste etiketler

- URL: konsol duvar Öner/Kontrol ve Sonuç.
- Beklenen: insanın tanıyacağı katman adı/zemin bilgisi, kesit dışına taşmayan etiketler.
- Gözlenen: `bec4ae2b3c0d490e9c8b20d2e5350403` gibi 32 karakter id sağda kesiliyor; ön zemin/temel boyut etiketleriyle çakışıyor. Geometri adımındaki ortak kesit “Kum,φ30,γ18” verirken sonuç görünümü UUID gösteriyor.
- Kanıt: 04 ile09/10 karşılaştırması; gerçek görsel inceleme yapıldı. Tekrar her otomatikid'li kopyada. Kod: `WallCrossSection.tsx:230` ve240 doğrudan `b.layerId` basıyor. Etki: sonuç kesiti okunurluğu ve doğru katmanı izleme zayıf.

### FUN-006 — P1: DOCX proje kodunu yazıyor, yapının gerçek kod/analiz düzeyini yazmıyor

- URL: `/m/report`; UI'da başlangıç AASHTO LRFD proje, yapılar ASD, duvarlar İleri.
- Beklenen: her duvar/palplanş bölümünde fiilen kullanılan kod, yaklaşım, analiz düzeyi ve ilgili deprem/su girdileri açık.
- Gözlenen: EN DOCX Table0 `Design code=AASHTO LRFD`, `Analysis level=Basic`, `SDS=-`; wallTable5/13 ve pileTable11/12 yapının kendi ASD kodunu/İleri düzeyini yazmıyor. Wall bölümü kh/kv içeriyor ama başlıktaki kodla ayrımı açıklamıyor. Palplanş UI “Tasarım esası=ASD” derken DOCX bölümünde bu satır yok; SDS ve ön/arka su seviyeleri de yok. Ankrajlı palplanşın per-anchor yükü UI54.36kN/ankraj; DOCX yalnız kN/m satırı ve ankraj aralığı/eğimi olmadan veriyor.
- Etki: rapor okuyucusu ASD hesabını başlıktaki AASHTO hesabı sanabilir; aynı sayısal sonucu yeniden üretmek için kritik yapı girdileri raporda yok.
- Kanıt: [docx/qa-all-en-tables.csv](2026-10-22-inceleme-kanitlari/functional/docx/qa-all-en-tables.csv) Table0,5,11,12,13; [docx/qa-all-tr.docx](2026-10-22-inceleme-kanitlari/functional/docx/qa-all-tr.docx); [18-pile-True-result.png](2026-10-22-inceleme-kanitlari/functional/screenshots/18-pile-True-result.png) tasarımesası ile karşılaştır; yapı GET JSON'ları. Tekrar indirilen TR ve EN'de. İlgili sınır: `geotek/modules/report/api.py:54`→`geotek.services.report.build_docx`; UI karşılaştırma `ResultPanel.tsx:70` ve79, `WallWizardPage.tsx:470`. DOCX üreticisinin iç uygulaması bu işlev testinde ayrıca incelenmedi; sonuç gerçek belge/API karşılaştırmasına dayanır.

### FUN-007 — P2: Palplanşta etkin su koşulları düzenlenemiyor veya görünmüyor

- URL: FUN-002 yapısı, gelişmiş girdiler açık.
- Beklenen: kullanılan retained/front arazi,tasarım,deprem su seviyeleri en az okunur olmalı; kopya ve özel su override'ları ayırt edilmeli.
- Gözlenen: UI yalnız tek `Ön su derinliği` alanı sunuyor; API'deki `gwt_front=(5,5,100)` ve retained`(0,0,100)` etkin olmasına rağmen ön su alanıboş, zemin tablosu yalnızγ/φ/c. GWT/γsat tablosu veya vaka özeti yok. Boş alan açıklaması “zemin profilindeki ön su” diyor; özel gwt_front koşulunu göstermiyor. Bu tam karma su fixture'ı UI'dan sıfırdan kuruldu diye sayılamaz.
- Kanıt: [37-envelope-seismic-inputs-ui.png](2026-10-22-inceleme-kanitlari/functional/screenshots/37-envelope-seismic-inputs-ui.png), [envelope-seismic.json](2026-10-22-inceleme-kanitlari/functional/envelope-seismic.json); [envelope_flow.py](2026-10-22-inceleme-kanitlari/functional/envelope_flow.py). Tekrarlanabilirlik: mevcut DTO API seed/import sonrası UI'ya açılınca. Kod: `sheet_pile/components/InputsForm.tsx:127`, `SoilSourceForm.tsx:88` tek manuelYASS; `SheetPileDetailPage.tsx:229` dar tablo. Etki: sonuç üzerinde büyük etkili su girdileri kullanıcıdan gizleniyor; ithal/önceden kaydedilmiş projeyi değerlendirmek zor.

### FUN-008 — P2/işlev açığı: Modül LPI vaat ediyor, sonuç sözleşmesi ve rapor göstermiyor

- URL: launcher sıvılaşma açıklaması; `/m/liquefaction/results`.
- Beklenen: “güvenlik sayısı ve LPI” açıklamasına uygun LPI çıktısı veya açık kapsam sınırı.
- Gözlenen: BI2014 ve Youd sonuçUI'sında minimumGS ve sıvılaşabilir sayı var, LPI yok; `LiquefactionResultDTO` yalnız per_sounding CSR/CRR/FS/status/warnings ve errors taşıyor. Seçili DOCX'in sıvılaşma bölümünde de LPI yok. Bu test motorun LPI matematiğine dair sonuç çıkarmaz; uçtan uca sunulmuyor.
- Kanıt: 02 launcher,24results, docxTable19; gerçek twojobs. Kod: `geotek/modules/liquefaction/i18n/tr.json:3`/en:3 vaat; `geotek/api/schemas.py:485`–503 sözleşme; `ResultsPage.tsx:156`–175 sunum. Deterministik.

### FUN-009 — P3: Ankrajlı analiz mukavemet momentinde birim etiketi tutarsız

- URL: `/m/anchored_wall` ve DOCX.
- Beklenen: sürekli palplanş analizinde gerekliW birimi cm³/m; tekil kazık varsa cm³/kazık net ayrılmalı.
- Gözlenen: UI kartı “Gerekli mukavemet momenti (cm³)”; reportTable20 “Required section modulus (cm³) (cm³/m)”. Bu QA'da değer boş olduğu için sayısal birim dönüşüm hatası kanıtlanmadı; etiket hatası kesindir.
- Kanıt:20/31, `qa-all-en-tables.csv`Table20. Kod: `geotek/modules/anchored_wall/i18n/{tr,en}.json:227`, `geotek/modules/anchored_wall/report.py:180` mevcutbirimli etikete başka birim ekliyor. Tekrarlanabilir.

### FUN-010 — P3: 800px ekranda yoğun grafik ve metin küçük kalıyor

- URL: EN/koyu wallresult,pile,anchored,liqCPT. Beklenen: çizim eksenleri ve önemli seçenek etiketleri okunabilir.
- Gözlenen: document yatay taşması yok (800→800); ancak240px sidebar açıkken içerik528px kalıyor, sıvılaşma iki grafiği yan yana daralarak SVG12px yazıyı yaklaşık5–6px ekrana indiriyor. Ankraj formu hâlâ3kolon; seçenekler kırpılıyor. Bilgi teknik olarak tabloda erişilebilir ama grafik görsel olarak işlevini kaybediyor.
- Kanıt:29–32 `-viewport.png`, [narrow-metrics.json](2026-10-22-inceleme-kanitlari/functional/narrow-metrics.json); gerçekten view_image ile incelendi. Kod: `liquefaction/components/DepthChart.tsx:55` sabit560viewbox, `SoundingDetail.tsx` iki grafiğin yerleşimi; `anchored_wall/components/AnalysisForm.tsx:67` sm3kolon. 800px screenshot; daha küçük mobil ekranlar çalıştırılmadı.



## DOCX sayısal/birim aktarım denetimi

11 bölüm seçili gerçek browser indirmesi: TR49,749B, EN49,870B. Her ikisi ZIP geçerli, `word/document.xml` açılıyor, python-docx163paragraf/25tablo. Tablo şekilleri aynı; **805 karşılıklı hücrede çıkarılan sayı dizilerinin tamamı eşit**. Bu, TR/EN sayı korunumu kontrolüdür; mühendislik doğruluğu değildir.

Ayrıca saklanan gerçek API sonuçlarıyla DOCX arasında **43 sayısal değer** gösterim hassasiyetinde karşılaştırıldı ve geçti: iki palplanş D0/D/toplamboy/M, iki duvarın20tahkik değeri, ankraj tasarımı3değer, çokseviyeliankraj6özet+6seviyeload. İzin verilen fark DOCX'teki son ondalığın yarısıdır; örneğin M323.989582→DOCX324.0kNm/m, D7.178067→7.18m. Bu yuvarlama veri bozulması değildir. API'deki negatif uçkuvveti UI/DOCX'te **mutlak değer** gösteriliyor; UI bunun kazı yönünde olduğunu açıklıyor. Sayı/birim tokenları[m],[kPa],[kN/m³],[kNm/m],[kN/m],[cm³/m],kN,° her iki raporda mevcut.

Kanıtlar: [docx-inspection.json](2026-10-22-inceleme-kanitlari/functional/docx-inspection.json), [docx-dto-comparison.json](2026-10-22-inceleme-kanitlari/functional/docx-dto-comparison.json), dilbaşına `*-tables.csv`, düztext, XML ve gerçek DOCX. Belge Word/LibreOffice içinde görsel olarak render edilmedi; yazı tipi, sayfa kırılması, baskı düzeni doğrulandı diye sayılamaz. Raporlar ağırlıklı tablo/metindir; ekran diyagramlarının Word'e görsel aktarımı bu turda bir gereksinim olarak doğrulanmadı.



## Mühendislik bulgularına bağımsız ikinci hüküm

### Her ENG kaydı için hüküm

“Onay” belirtilen dar kapsamda yeniden üretimdir; evrensel geçerlilik veya mevzuat kaynak doğrulaması değildir. “Kısmen” çekirdek gözlem doğru olsa da geniş iddia, fiziksel yorum veya tüm örneklerin bağımsız yeniden koşulması sınırlıdır.

| ID | Hüküm | Kendi kanıtı | Kapsam / yön / sınır |
|---|---|---|---|
| ENG-A-001 | Onay, doğrudan importer | `review.py / A_import_unknown_qc_header` | 5000kPa yerine5e6kPa; qc_unit=kPa override5000 doğru. HTTP/UI qc_unit zorunlu olduğundan aynı UI birim bozulması gösterilmedi. |
| ENG-A-002 | Onay | `results.json / clay_suggestions` | Gerçek CL/undrained SPT projesinde phi37.186211355/E12766.95 ve validity_ok=True. Sorun öneri/uygulanabilirlik; otomatik tasarım onayı iddia edilmez. |
| ENG-A-003 | Onay, muhafazakâr yönde | `results.json / A_LPI_GWT_*` | z1.5/2.5,GWT1.4 için9 yerine7.12; single5/GWT4 için21.875/very_high yerine3.875/low. Kuru zon fazladan sayılıyor. Mevcut web DTO LPI taşımıyor. |
| ENG-A-004 | Onay, eğitim | `results.json / A_edu_*` | MSF çizimi iki adlandırılmış motor/metin denklemiyle uyuşmuyor. M5.5 beklenen2.21142/2.78295, çizilen1.68659/1.8. |
| ENG-A-005 | Onay, validity sözleşmesi | `supplement.json / A_registry_physical_domain` | Negatif su/E/sigma_p ve Dr141.42% doğru aritmetik ama valid=True. Sentetik/fiziksel tutarsız girişler; negatif su/E için son tasarım model onay koruması var. |
| ENG-A-006 | Onay, eksik girdi izi | `supplement.json / A_partial_u2` | Boş u2 ölçülmüş0 ile aynı saklanıyor; maske/uyarı alanı yok. q_t/Bq/u2 temelli adaylar etkilenebilir; belli bir bilinmeyen u2 değeri varsayılmadı. |
| ENG-A-007 | Onay, library summary | `domain-probes.json / invalid_pipeline_summary` | Gerçek CPT pipeline status=[invalid,invalid], minFS=null iken LPI0/very_low. Status sayımı ayrıca invalid bilgisini koruyor; HTTP DTO LPI taşımıyor. |
| ENG-A-008 | Onay, yüzey sınırında | `supplement.json / A_CPT_unconverged` | Default50iter ilk n=.882114475/Ic2.212836314; bağımsız Brent n=.786209501/Ic2.457110806. Warning var; finite FS ve liquefiable yine taşınıyor. z=.01m, normal saha genellemesi yok. |
| ENG-A-009 | Kısmen | `supplement.json / A_oversize_borehole` | Borehole1000mm kabul ve CB1.15 teyit. Açıklanan tablo aralığı dışında sessiz extrapolasyon kaydı onay; rod>30 için1 olması tek başına yanlış katsayı kanıtı değildir; unknown sampler normal modelce engellenir. |
| ENG-A-010 | Onay, ortak girdi modeli | `supplement.json / A_lab_grain_sum` | Gerçek LabRecord FC20+gravel90 kabul, kum−10 ve GC. Tekil0..100 sınırları toplam kontrolü sağlamıyor. |
| ENG-A-011 | Kısmen, anlatım tutarlılığı | `supplement.json / A_education` | Açıkça [1,3] verilen sorunun1.8 integrali doğru. Aynı örneğe referans verilirse motor/metindeki [0,3] katkısı2.775 ile interval sözleşmesi çelişiyor; aritmetik hata diye sunulmasın. |
| ENG-A-012 | Onay, statik şekil geometrisi | `supplement.json / A_education` | LL29/PI4.5 A-line6.57 altında M; CLML boyaması içinde. D10.075mm eğride8% ama etiket10%; FC35 Ncs30 eşiği N1=20.8333, evrenselx30 çizgisi yanıltıcı. |
| ENG-A-013 | Kısmen, temsilî guardlar | [domain-probes.json](2026-10-22-inceleme-kanitlari/independent-review/domain-probes.json) | SBTn inf→2, FCNaN→17, CsigmaNaN→.3, infsigma phi0valid, unsortedLPI−24.75 bağımsız tekrarlandı. Bütün public fonksiyonlar/üst UI yolları tek tek koşulmadı; kütüphane sertleştirme kapsamı. |
| ENG-B-001 | Onay | `results.json / wedge` | Düz duvar skaler kuvvet dengesinde rho→beta+ için1967→1.7156e8kN/m artıyor. Production299682.4/rho25.0057296 sabitkesim. Sonsuz dolgu altında finite optimum yok. |
| ENG-B-002 | Onay | `results.json / bishop` | Üretimin aynı slice geometrisinde bağımsız kütle ve birinci moment+Brent ref1.211442108, actual1.222776980; homojen ref.982327581/actual.982327705 eşleşiyor. B analitik endpoint referans1.211304678 ile küçük fark geometri probundan; centroid kusuru sabit. |
| ENG-B-003 | Onay, genel dağılım | `supplement.json / B_passive_projection` | Pasif Pdir=cosδ n−sinδ t, yataycos(δ−θ). theta−10 actual2556.344875/ref2402.178415 +6.42%; theta+10−6.03%. Mevcut ön pasif UI çağırıcıları theta0 olduğundan tüm UI sonuçları etkileniyor denemez. |
| ENG-B-004 | Onay çekirdek; etki sınırlı | `supplement.json / B_wall_global_gap; global-grid.json` | Grid4 seçilen yay taban içinde0.00621m yukarı çıkıyor,4 gerçek crossing var ama tek interval dönüyor. Grid8/varsayılan12 aynı girdide bu gap yok. Geçerli alternatif globalFS ve emniyet yönü belirlenmedi; varsayılan UI hata örneği gibi sunulmasın. |
| ENG-B-005 | Onay, genel dağılım | `supplement.json / B_battered_surcharge` | Bağımsız kama alanı/yüzey yükü theta+10:165.297897/ref163.282373; theta−10:99.523180/ref100.857049. q düzeltmesi1/(1+tanθtanβ). Layered wall çağırıcısı ayrıca düzeltiyor; aynı UI wall hatası yok. |
| ENG-B-006 | Onay, patolojik sayısal sınır | `results.json / B_Nc_near_zero` | phi1e−16° Nc−127.222187 yerine pi+2=5.14159265. Exact0 dalı ve20/30/40° nominal üç yöntem bu genellemeye dahil değil. |
| ENG-B-007 | Kısmen, temsilî kütüphane probları | `b-education.json / B007` | Unknownmethod phi0 kabul; negatifgamma negatifcapacity; badstate pasifkama; RankineNaN teyit. Listedeki tüm kombinasyonlar bağımsız yeniden koşulmadı; üst Pydantic/UI güvenliği hakkında toplu sonuç yok. |
| ENG-B-008 | Onay, eğitim geometrisi | `b-education.json / B008` | Bağımsız yatay doğru/daire kökleri−9.999971762/22.653312066; metindeki0/11.60 başka geometri. n4/n40 üretim FS yaklaşık.55336/.63250; endpoint hatası motorFS hatası değildir. |
| ENG-B-009 | Onay, davranış metni | `b-education.json / B009` | Kendi ters slope araması mirror GeoTekError verdi. Vesic H30>A_su20 iken q21.4/Q42.8 döndü. Metin-kod farkı teyit; doğru normatif Vesic limitini birincil kaynaktan seçmedik. |
| ENG-B-010 | Onay, statik kuvvet yönü | `b-education.json / B010` | Taban ekran vektörü(90,−20), S(−38,9), skalerçarpım−3600. Etiket direnç ve kütle sola/aşağı kabulünde kuvvet ters; pixelrender değil kaynak koordinatı incelendi. |
| ENG-C-001 | Onay, kritik zarf eksikliği | `results.json / static_envelope` | Ayrı wetpressure quad+Brent statik D18.9085960725/M2399.835292; servis statik aynı. SDS.1 tekcase D8.039288389/M436.945004. Geçerli farklı design/seismic su profiliyle statik durum eksik. UI kanıtı root functional ajanının; fixture APIseed sınırı korunmalı. |
| ENG-C-002 | Onay; kaynak=knowledge/config | `results.json / tbdy; layered-cap.json` | Legacy actual sliding1.38694/allpassed vs.6cap.991736. Layered real-engine actual1.384545602/allpassed vs.990022317; ayrı V450.298347/H248.092670. Hem motor path teyit; canlı API/UI falsepass bu S4te koşulmadı. Orijinal TBDY PDF görülmedi. |
| ENG-C-003 | Onay, model/diyagram tutarlılığı | `results.json / multi` | Tributary ilan edilen reaksiyonlarla V2=−45, diagram−53.12499; hinge V2 dengeyi tutuyor. Tributary ampirik yüklerinin globalmoment artığı tek başına yöntemin geçersizliği değildir. |
| ENG-C-004 | Kısmen, sözleşme kesin | `results.json / multi` | vmax87.0833/81.09375 vs dönen dizimax257.9409/241.01559 teyit. Kod ilk tabanaltı shear sıfırından sonrasını bilerek dışlıyor ve toe_force_not_balanced uyarısı veriyor. Alan docstring largestwholewall ile çelişir; fiziksel altuçtalebi doğruluğu kaynak/model doğrulaması gerektirir. |
| ENG-C-005 | Onay, eğitim/motor farkı | `domain-probes.json / C_education_soft_clay_area` | SVG rampa+plateau+alt-rampa alan.75pH; motordaki üst-rampa+plateau.875pH. H8p29.92:179.52/209.44. Ns=gammaH/Su_b ve henkel_default=basal.b_eff kodu metinle farkı destekliyor; kaynakşekil doğrulanmadı. |
| ENG-C-006 | Onay, alt seviye domain | `domain-probes.json / C_low_level_pile_domain` | depthincrease−2 ile D−4.629270464; allowstressNaN ile sectionnan. Gravitygeometry infheight/embed7>height6 kabul. Normal SheetPileStructure depthincrease>=0 koruması var; bütün UI akışlarına erişim gösterilmedi. |



## Ayrıntılı mühendislik bulguları

### Zemin, deneyler ve sıvılaşma

### ENG-A-001 — Bilinmeyen CSV başlık birimi sessizce varsayılan birime düşüyor

**Önem yüksek; güven yüksek; sınıf IO/birim.** `geotek/io/tabular.py:_header_unit` satır47–48 bilinmeyen birim için None döndürüyor; `_column_si` satır92 bunun üzerine varsayılan qc=MPa seçiyor. Girdi: `depth (m),qc (kN/m2),fs (kPa)` ve `1,5000,50`. Beklenen qc=5000 kPa (kN/m²=kPa) veya desteklenmeyen birim hatası. Gerçek qc=5,000,000 kPa. Direnç girdisi 1000 kat büyüyor.

Tekrar: ortak komut; [results.json](2026-10-22-inceleme-kanitlari/engineering-a/results.json) → probe `IO unknown header unit`; girdi [unknown_unit.csv](2026-10-22-inceleme-kanitlari/engineering-a/unknown_unit.csv). Kapsam: doğrudan `import_cpt` çağrısında birim override verilmemesi. HTTP/UI yolu qc_unit değerini açık override ettiği için aynı tekrar bu yolun açık birim seçimi için iddia edilmez. Desteklenmeyen başlık birimini yok sayma davranışı doğrudan import sözleşmesinde yine gerçektir.

### ENG-A-002 — Bilinen CL/undrained tabakada kum φ/E korelasyonları geçerli öneriliyor

**Önem yüksek; güven yüksek; sınıf yöntem seçimi.** `correlations/checks.py:sand_like` satır14–17 Ic yoksa uyarı üretmiyor. `services/parameters.py:layer_points` SPT noktalarına tabakanın bilinen USCS/behaviour bağlamını vermiyor; `evaluate_candidates` satır177 ve `suggest` satır219–224 bunları valid kabul edip ortalıyor. Girdi: CL, undrained, 0–12m, gamma20/gamma_sat21 kN/m³, GWT1m, SPT N20@2m/N12@5m, ER60. `refresh_profile` gerçek önerileri: φ'=37.1862113554326° (HU/KM/PHT kum yöntemlerinin ortalaması), E=12766.95kPa (KM kum bağıntısı); `validity_ok=True`, uyarı yok. Beklenen: bilinen kil zeminle çelişen kum yöntemleri geçerli havuza alınmamalı veya açık uygulanabilirlik belirsizliği taşımalı. Tekrar: `CL layer sand method suggestion` probe. Mühendis onayı olmadan design alanına otomatik yazma yok; kusur öneri/geçerlilik hükmündedir.

### ENG-A-003 — LPI integrali kuru aralıkları da topluyor

**Önem orta; güven yüksek; sınıf aritmetik/entegrasyon.** `liquefaction/common.py:liquefaction_potential_index` satır82 ilk hücreyi `min(top,GWT)` ile ele alıyor; GWT zaten hücrenin içindeyse top'u GWT'ye yükseltmiyor. Sonraki hücrelerde GWT kırpması hiç yok. Tek numune için `tributary_thickness` satır61 hücreyi [0,z] yapıyor, ilk nokta >2m olsa dahi. Örnekler (LPI boyutsuz): z=[1.5,2.5]m, FS=[.5,.5], GWT1.4 → gerçek9, bağımsız [1.4,3] integrali7.12. z=[1,3], FS=[NaN,.5], GWT2.5 →8.5 yerine6.28125. z=[5], FS=.5, GWT4 →21.875/very_high yerine3.875/low. Aynı hücre tanımı ve su üstünün katkı vermemesi beklentisi kullanıldı; hücre modeli değiştirilmedi. Tekrar: `LPI water clipping` üç FAIL satırı. Mevcut web liquefaction DTO LPI taşımıyor; kusur engine LPI/summary ve bunu anlatan eğitim içeriğinde.

### ENG-A-004 — Eğitim MSF grafiği metinde yazan yöntemleri çizmiyor

**Önem orta; güven yüksek; sınıf eğitim/formül eşleşmesi.** `web/src/modules/education/figures/bearDraw.tsx:LiqMsfCurve` satır256–265; figure ID `liq-msf-curve`, grafik başlığı/aria `Magnitude scaling factor`, mavi legend `Idriss`, kırmızı kesikli `Andrus–Stokoe`. `liquefaction_student.ts` MSF bölümünde ve galeri kaydında gösterilir. Metin+motor Youd için 10^2.24/M^2.56 ve (M/7.5)^−3.3 kullanır. Figür bunun yerine min(1.8,6.9exp(−M/4)−.058) ve min(1.8,(M/7.5)^−2.56) kullanır. M6.5: beklenen1.441922129/1.603570626, çizilen1.300690559/1.442442936. M5.5: beklenen2.211421435/2.782949297, çizilen1.686593211/1.8. Y ekseni üst sınırının2 olması doğru eğrileri de keser. Motor formülü bu bulguda hatalı bulunmadı. Tekrar: `EDU LiqMsfCurve` satırları.

### ENG-A-005 — Fiziksel olarak geçersiz korelasyon çıktıları valid olabiliyor

**Önem orta; güven yüksek; sınıf geçerlilik.** `correlations/registry.py:evaluate` satır114–117 yalnız sonlu olmayan çıktıya genel uyarı ekliyor; fiziksel alan kontrolü her kayıt için bulunmuyor. Örnekler: CPT_su_Nkt(qt50,sigma_v100,Ic3,Nkt14) →−3.571428571kPa valid; CPTu_su_Ndu(u2=50,u0=100,Ic3,Ndu7) →−7.142857143kPa valid; Mayne_sigp_CPT aynı net dirençle−16.5kPa valid; R2009_E_CPT(qt50,sigma_v100,Ic2) →−451.9196896kPa valid; Skempton N1_60=120,Cd60 →Dr141.4213562% valid. Beklenen negatif su/E/σp veya fiziksel aralığı aşan Dr'nin geçerlilik uyarısıdır, bağıntıyı sessiz değiştirmek değildir. Tekrar: `registry physical domain ...`. Bu sentetik girdilerin bir kısmı tutarsız Ic bağlamı içerir; bunlar nominal saha sonuçları diye sunulmadı. Design onayı negatif su/E için model validasyonuna takılabilir; bu son savunma adayın yanlış valid damgasını düzeltmez.

### ENG-A-006 — Kısmen eksik u2, ölçülmüş sıfır gibi saklanıyor

**Önem orta; güven yüksek; sınıf eksik girdi/IO.** `io/tabular.py:import_cpt` satır120–122 u2 sütunundaki boşlukları0 ile doldurur; CPTSounding bu varsayımı taşıyan bir maske/uyarı alanı içermez. [si_cpt.csv](2026-10-22-inceleme-kanitlari/engineering-a/si_cpt.csv) ikinci satır u2 boştur; import u2=[100,0]kPa döndürür. Ardından process_cpt u2 sütunu var olduğu için `cpt_no_u2` uyarısı da üretmez. Beklenen eksiklik/varsayım izi veya açık ret/uygun dışlamadır. q_t=qc+u2(1−a), Bq ve u2 tabanlı su bundan etkilenebilir. Tekrar: `IO partial missing u2`. Eksikliği0 kabul etmenin aritmetiği değil, açıklanmayan mühendislik varsayımı bulgudur.

### ENG-A-007 — Bütün FS değerleri geçersizken LPI=0/very_low veriliyor

**Önem orta; güven yüksek; sınıf sonuç yeterliliği.** `common.py` satır85–88 bütün NaN FS'yi F=0 yapıyor; `LiquefactionResult.summary` satır160 LPI kategorisini yine yayımlıyor. z=[2,4]m ve FS=[NaN,NaN] →0/very_low. Kil/dense/above_gwt gibi gerçekten dışlanan noktayla hesaplanamayan `invalid` noktayı LPI toplamı ayırmıyor. Beklenen tümü geçersiz değerlendirmede bilinmeyen/eksik kapsam hükmü; kaynağa dayanarak sayısal alternatif LPI uydurulmadı. Tekrar: `LPI invalid all NaN`. Mevcut HTTP DTO LPI taşımadığı için kullanıcı ekranı hakkında iddia yok.

### ENG-A-008 — Yakınsamayan CPT normalizasyonu sonlu FS'ye taşınabiliyor

**Önem orta; güven yüksek; sınıf sayısal uygunluk.** `cpt.py:normalise_iterative` satır61–74 son iterasyon n/Ic'sini converged=False ile döndürür; process_cpt uyarı ekler. `analysis.py:analyze_cpt` yalnız Ic sonluluğunu arar, converged maskesini elemez. Yakın sıfır gerilme testi: gamma=gamma_sat20, GWT0, z=.01/.02/.03m, qc10kPa, fs.1kPa. İlk nokta gerçek n=.882114475,Ic2.212836314, converged=False; bağımsız kök n=.786209501,Ic2.457110806. FS=.29768132 ve liquefiable durumu yine döner. Uyarı vardır; sessiz gizleme iddiası yok. Beklenen mühendislik tüketicisinin yakınsama durumunu geçersiz/hesaplanamadı olarak yönetmesi veya onay kapısıdır. Bu örnek yöntemin yüzeye çok yakın uygulama sınırında olup olağan derinlikte hata genellemesi yapılmaz. Tekrar: `CPT unconverged classification propagated to FS`.

### ENG-A-009 — SPT ekipman tablosu dışına sessiz faktör atanıyor

**Önem düşük; güven yüksek; sınıf yöntem alanı.** `spt.py:borehole_diameter_factor` satır37–43 açıklanan65–115/150/200mm değerleri dışında örn1000mm için1.15 döndürüyor; Borehole modeli yalnız >0 sınırı koyuyor. `rod_length_factor` >30m için de1 ve negatif/NaN için75%/100% döndürebilir. Beklenen tablo kapsamı dışında uyarı/ret veya belgelenmiş mühendis seçimi; bu çalışma ara çaplar için doğru enterpolasyon katsayısı iddia etmez. `sampler_factor('unknown')`1.2 verir ancak normal Borehole Literal modeli bu stringi engeller. Tekrar: `SPT oversize diameter`, `SPT negative/NaN rod` probeları. Enerji ve standart ekipman nominal aritmetiği geçmiştir.

### ENG-A-010 — Toplamı %100'ü aşan tane fraksiyonları sınıflandırılıyor

**Önem orta; güven yüksek; sınıf girdi geçerliliği.** `core/models/investigations.py:LabRecord` FC ve gravel'i ayrı0–100 doğrular; toplam kontrolü yok. `uscs.py:classify` satır77 negatif kumu hesaplayıp sınıflandırabilir. `LabRecord(depth=1,FC=20,gravel=90,LL=30,PI=10)` kabul edilir ve GC/complete=True döner; kum=−10%. Beklenen tutarsız elek verisinin reddi/uyarısıdır. Tekrar: `USCS model permits impossible fraction sum`. Negatif FC ve NaN doğrudan fonksiyon probeları aynı ürün yolu hatası diye büyütülmedi; normal FC alan validasyonu onları engeller.

### ENG-A-011 — Eğitimde LPI alıştırması eski ilk hücreyi kullanıyor

**Önem düşük; güven yüksek; sınıf eğitim anlatım tutarlılığı.** `liquefaction_student.ts` satır421–422 dört noktalı örneğin ilk hücresini[1,3] sayıp katkı1.80 diyor; aynı dosya satır289–299 ve motor ilk nokta2m olduğu için[0,3] kullanıp katkı2.775 ve toplam9.975 verir. Beklenen aynı örnekte tutarlı hücre tanımıdır. Tekrar: `EDU quiz first interval contribution`. Soru [1,3] aralığını özellikle dayattığı için o kısıtlı integral1.80 aritmetik olarak doğrudur; tutarsızlık örneğe yapılan atıftır.

### ENG-A-012 — Diğer eğitim şekillerinde sayısal/eksen uyumsuzlukları

**Önem düşük; güven yüksek; sınıf eğitim çizimi.** `bearDraw.tsx:ClsGradingCurve` satır301–309 eğride .075mm noktasını%8 verirken D10 yardımcı çizgisi aynı x'te%10 gösterir. `ClassUscsPlasticity` satır333 CL-ML'yi dikdörtgen tarar: LL29,PI4.5 bu alanda boyanır ama A-line=6.57>PI olduğu için M'dir; hatched bölgenin A altındaki parçası hatalıdır. `LiqSptCorrelation` satır250 x ekseni N1_60 iken x30'a Ncs30 yoğun sınırı koyar; FC35 için eşdeğer sınır N1_60=(30−5)/1.2=20.833333'tür. Eğriler ilgili yerde zaten kesilir, çizgi yanlış evrensel eşik izlenimi verir. Tekrar: `EDU grading D10`, `EDU CLML shaded rectangle`, `EDU SPT FC35 dense boundary` satırları. U-line'ın LL16'daki dikey uç parçası bulgu değildir.

### ENG-A-013 — Bazı kamuya açık düşük seviye fonksiyonlarda sonluluk/şekil sözleşmesi eksik

**Önem düşük; güven yüksek; sınıf API sertleştirme; doğrudan library kapsamı.** Örnekler: SBTn(Q=inf,Fr1)→zone2; Youd fines(n=10,FC=NaN)→17 (yüksek FC dalı), BI c_sigma(NaN)→.3; registry KM_phi sigma_eff=inf→φ0 valid; LPI depth[5,2]→−24.75; analysis target_fs=NaN kabul edilir; doğrudan analyze_spt FC200 kabul eder. Beklenen tanımsız veriyi sonlu mühendislik hükmüne çevirmemek ve sıralama/alan şartını belirtmek. Karşı örnek: CPTSounding sonluluk+artan derinlik+uzunluk kontrolü yapar; layering.sample_arrays hizalama/sonluluk/sıralama kontrolü yapar; HTTP liquefaction endpoint DTO'su sonlu değerleri ve default_fc0–100/targetFS≥1 kontrol eder. Bu kontrollerin varlığı raporda korunmuştur. Tekrar: ilgili [results.json](2026-10-22-inceleme-kanitlari/engineering-a/results.json) probeları; tek ürün güvenlik açığı iddiası değildir.


### Basınç, taşıma ve stabilite

### ENG-B-001 — sınırsız aktif kama sonlu kritik kuvvet olarak dönüyor

- Yer: `geotek/engine/earth_pressure/wedge.py:86` `trial_wedge`, alt açı `max(beta,-π/2)+1e-4`; `:107` sonucu optimum gibi döndürür.
- Girdi: H=6 m, γ=18 kN/m³, φ=30°, β=25°, kh=0.2; δ=θ=q=kv=0, state=active, n_grid=720.
- Gerçek: P=299682.402023445 kN/m, K=924.9456852575463, ρ=25.0057295779513°. Bunun kaynağı tam olarak sabit `1e-4 rad` kesimidir.
- Beklenen: bu sınırsız dolgu geometrisinde sonlu aktif maksimum yok; geçerlilik/kararlılık hatası veya açık sınırsızlık tanısı gerekir. Bağımsız kuvvet dengesi ρ−β=0.01/0.001/0.0001/0.00001° için P=171813.9064 / 1715851.4837 / 17156227.0092 / 171559982.2293 kN/m verir; normalize kuvvet kalıntısı ≤3.1e-17. ρ→β+ iken alan ve kuvvet artar.
- Kanıt: [results.json](2026-10-22-inceleme-kanitlari/engineering-b/results.json) `unbounded_wedge_*`; komut: [reference_audit.py](2026-10-22-inceleme-kanitlari/engineering-b/reference_audit.py) yukarıda. **Önem yüksek, güven yüksek, etki:** temel kama yolunda fiziksel çözüm olmayan durumda sonlu ve kesim seçimine bağlı tasarım girdisi. TBDY kapalı formunun mevzuat uygunluğu bu bulgudan ayrı ve doğrulanmamıştır. Eğitim `SurBetaRegions` zaten sınırsızlığı söyler; üretim bu tanıyı uygulamıyor.

### ENG-B-002 — katmanlı/sürşarjlı sismik Bishop yanlış ağırlık merkezini kullanıyor

- Yer: `geotek/engine/stability.py:168` `yg=(ybot+ytop)/2`; `:175` bu değeri kh·W moment kolunda kullanır. Kolon ağırlığı katman bazında doğru toplanmasına rağmen birinci moment toplanmaz; yüzey yükü de kolon ortasına taşınır.
- Girdi: surface=[(-30,0),(0,0),(20,10),(50,10)] m, daire (xc,yc,R)=(5,15,√250) m; üst band top10 γ10, alt band top3 γ30 kN/m³; ikisi c10 kPa φ20°; kh=.2, su/yük yok.
- Beklenen/gerçek FS, n=40/80/160: 1.21135815/1.21124350/1.21130468 karşısında 1.22280601/1.22271754/1.22277698. ~%0.95 fazla FS çözünürlükle kaybolmuyor. Referans her katmanın γ∫y dy birinci momentini bağımsız toplar. Homojen γ20 üzerine q40 kPa yüzey yükünde n160 beklenen .93308927, gerçek .91582030; bu ikinci örnekte yön muhafazakârdır.
- Eşik: aynı katmanlı örnekte her iki band c=4.361017763120606 kPa bağımsız referansla seçildiğinde n160 beklenen FS=.995, gerçek FS=1.00445268357633; FS=1 karar tarafı değişir. Hiçbir kabul eşiği bu değerle normatif olarak önerilmez.
- Kanıt: `bishop_seismic_centroid_*`, `bishop_layered_FS_threshold`. **Önem yüksek, güven yüksek, etki:** sismik katmanlı şev, yüzey yükü ve bunları kullanan duvar global stabilite momentleri. Homojen, yüksüz statik/sismik nominal kontroller bu kusurdan etkilenmeden geçer. Dış yükün kh kapsamı ayrı modelleme kararıdır; yük kütle gibi kh'ye dahil edilecekse doğru kotu gerekir.

### ENG-B-003 — eğik yüzde pasif yatay kuvvet yanlış açıyla izdüşürülüyor

- Yer: `geotek/engine/earth_pressure/distribution.py:125`, `_layer_coefficients` Coulomb aktif/pasif için ortak `cos(delta+theta)` döndürüyor.
- Girdi: H6 m, γ18 kN/m³, φ35°, δ10°, θ−10°, β=q=0, drained passive Coulomb, profil 0–10 m, su50 m.
- Beklenen: pasif duvar reaksiyonu doğrultusunun yatay bileşeni cos(θ−δ), P_h=2402.17841475952 kN/m. Gerçek: cos(θ+δ) ile 2556.34487450850 kN/m, **%6.4178 fazla pasif direnç**. θ=+10° için beklenen1301.44949778734, gerçek1222.96248939629 kN/m (-%6.0307).
- Bağımsız doğrulama: `n_w cosδ − f sinδ` pasif reaksiyonunun x bileşeni cos(θ−δ); ayrı skaler kuvvet dengesi/optimizasyon aynı sonucu verir. Kanıt `distribution_passive_projection_*`.
- **Önem yüksek, güven yüksek, etki:** θ≠0 kabul eden genel basınç API'si. C ajanı mevcut duvar/diş/palplanş ön pasif çağrılarının θ=0 kullandığını teyit etti; bu çağrılarda iki kosinüs eşittir. Etkiyi mevcut bütün UI duvar sonuçlarına genellemek doğru değildir.

### ENG-B-004 — 600 noktalı kesişim taraması temel içindeki yeniden çıkışı atlıyor

- Yer: `geotek/engine/stability.py:118` `_slip_interval(n_probe=600)` ve `:157` endpoint tabanlı `entry_min`; `geotek/engine/walls/global_stability.py:151` tüm tabanı geçme koşulu.
- Girdi: GravityGeometry(height=4,base_width=2.5,top_width=2.5), Backfill(γ18,φ30), foundation=[SoilBand(top0,γ18,c30,φ20)], WallLoads(q10,kh.1), seismic=True,grid4. Oluşan yüzey=[(-16,0),(-1e-6,0),(0,0),(2.5,0),(2.500001,4),(18.5,4)].
- Gerçek: FS=1.82519505907512, daire (−.5234670960300066,6.026788142306907,6.732633208094283) m; bildirilen exit=-3.52449599464, entry=5.89680870734 m.
- Beklenen: bu daire tüm taban altında kalan tek bir kayma kütlesi değildir. Bağımsız gerçek kesişimler -3.5244960199964, 2.4775618279364, 2.50000000281, 5.8968506329409 m. Yay, taban [0,2.5] içinde x=2.47756'da yüzeye çıkar; x2.49'da ybase=+.00620960068 m, topukta +.01122527305 m > taban kotu0. Yaklaşık .02244 m genişlikteki boşluk probe tarafından atlanır. Bu yüzden `entry_min=2.5` kontrolü tek gerçek kütleyi seçerek sağlanmıyor.
- Kanıt: `wall_global_selected_circle` (bağımsız kök çözücü dört kök bulduğu için sahte tek FS referansı üretmeyi reddeder), `wall_global_arc_above_base`. **Önem P2 (dar kapsamlı), güven yüksek, etki:** doğrusal yüzey kırıkları/duvar basamaklarında kabul edilemez daire kabulü; bu örnekte fiziksel alternatif kritik FS veya sapmanın emniyet yönü belirlenmedi. “Dört kök vardır” tek başına hata değildir; somut ihlal taban içindeki pozitif yay yüksekliğidir.
- Erişim sınırı: bağımsız review ajanı aynı modeli grid8/grid12 ile de denedi; bu iki koşuda topuk yayı negatif kalır ve burada gösterilen ihlal oluşmaz. **Bulgudaki kesin repro grid4 public/custom API koşusudur; varsayılan grid12/UI örneğinin de aynı kusurlu daireyi seçtiği iddia edilmez.** Bağımsız tekrar: [grid4/8/12 karşılaştırması](2026-10-22-inceleme-kanitlari/independent-review/global-grid.json).

### ENG-B-005 — eğik yüz+eğimli zemin sürşarjı genel dağılım API'sinde geometrik çarpansız

- Yer: `distribution.py:247` `vertical=sve+surcharge`; `:260` K·vertical. H6 m, γ18, φ35°, δ10°, β15°, yatay izdüşüme göre q20 kPa, θ±10°, aktif Coulomb.
- Bağımsız kama geometrisinde q katkısı `1/(1+tanθ tanβ)=cosθ cosβ/cos(θ−β)` ile değişir. θ+10° beklenen P_h163.28237342529, gerçek165.29789679574 kN/m (+%1.2344); θ−10° beklenen100.85704936940, gerçek99.52318009190 kN/m (-%1.3225).
- Kanıt `distribution_battered_surcharge_*`. **Önem orta, güven yüksek; etki genel API.** C, `walls/layered.py` çağırıcısının q'yu ayrıca bu çarpanla düzelttiğini teyit etti; o yol için aynı hata iddia edilmiyor. θ=0 veya β=0 nominalinde çarpan1 ve kontroller geçer. Mevcut API sözleşmesi düzeltmenin çağırıcıya ait olduğunu açık söylemiyor.

### ENG-B-006 — φ→0 taşıma faktöründe çıkarma iptali ve negatif Nc

- Yer: `geotek/engine/bearing.py:34` Nq ve `:35` `(nq−1)/tanφ`; üç yöntemde ortak.
- φ=1e−8/1e−12/1e−16 derece için beklenen Nc=5.14159265590 /5.14159265359 /5.14159265359; gerçek5.14159182586 /5.15249858397 /−127.22218725854. Beklenen `expm1(πt+2asinh(t))/t` ile kararlı hesaplanır; exact φ=0 dalındaki 5.14 bilinçli yuvarlatma farklı ve burada hata olarak kullanılmıyor.
- Kanıt `bearing_factor_*_Nc`. **Önem düşük pratik/orta sayısal, güven yüksek, etki:** çok küçük pozitif φ ile negatif kohezyon taşıma katkısı; normal20/30/40° üç yöntem kontrolleri geçer.

### ENG-B-007 — public motor API'leri geçersiz girdiyi bazen mühendislik sonucu gibi döndürüyor

- Yerler: `bearing_capacity:88`, `bearing_factors:31`, `coefficients:52`, `wedge:84`, `SlopeModel.__post_init__:60`, `resultant:63`.
- Örnekler: B=NaN ile bearing q_ult/Q_ult=NaN; γ=−18,B2,φ30,q=D=0,Vesic ile q_ult=−403.24475288 kPa; H=−80,V400 aynı ayarda H=0 gibi q_ult403.24475288 (yük büyüklüğü sözleşmesine göre reddedilmeli; işaretli H desteklenecekse |H| simetrisi gerekir). φ30,c10,V100,H1000 için Vesic q_ult=−17.32050808 kPa; fiziksel kapasite yok tanısı yerine negatif kapasite döner. `bearing_factors(0,'bad')` unknown yöntemi kabul eder. `rankine_ka(NaN)` NaN; `trial_wedge(state='bad')` sessiz pasif K3/P675; yanlış surcharge basis beta0 iken kabul edilir. Boş/NaN/negatif γ'lı SlopeModel nesneleri kurulur. Azalan z dizisi resultant negatif kuvvet üretir; boyut uyuşmazlığı normalize alan hatası yerine NumPy ValueError, NaN dizisi NaN verir.
- Beklenen: desteklenen fiziksel/sonlu girdi sınırında açık reddetme; geçersiz state/method/basis için enum kontrolü. NaN/inf/sigma→0 ve geometriye ait ham sonuçlar [results.json](2026-10-22-inceleme-kanitlari/engineering-b/results.json) içinde ayrı kayıttır; bütün örnekler tek tek exception beklenen hipoteziyle korunmuştur, hiçbirisi geçerli sonuç sayılmamıştır.
- **Önem orta, güven yüksek, etki doğrudan Python API'leri.** Üst Pydantic/servis katmanları bazı girdileri önler; aynı kusurun bütün UI akışlarından erişilebilir olduğu kanıtlanmadı. gamma/c negatifliği, nonfinite ve yanlış enum aynı merkezi girdi sözleşmesi sınıfıdır.

### ENG-B-008 — öğrenci Bishop örneğinin bildirilen giriş/çıkışı başka daireye ait

- Yer: `web/src/modules/education/content/slope_student.ts:78`.
- Girdi: verilen yamaç toe(0,5),crest(10,10), düz uzantılar; daire(5.2488,14.5392,17.9867) m, γ18,c10,φ0. Metin n4 FS .5534, n40 .6325 ile birlikte exit≈0,entry11.60 diyor.
- Beklenen: bağımsız çizgi/daire kesişimi exit=−9.99997176201,entry22.65331206584 m. Üretim−9.99986997787/22.65296326642. FS değerleri örnekteki dört dilim ve bağımsız çözümle uyumludur: n4 .55336139, n40 .63252549. Hata özellikle endpoint açıklamasıdır.
- Kanıt `education_slope_example1_*`. **Önem orta eğitim, güven yüksek:** öğrenci yanlış daire geometrisiyle doğru FS'yi ilişkilendirir.

### ENG-B-009 — eğitimde güncel davranışla çelişen iki açık iddia

- `slope_student.ts:49` ters geometri için “program hata vermez yanlış FS döndürür” der. `search_critical_circle:237` uygun daire yokken ters eğimi tanıyıp açık mirror hatası verir; mevcut `test_stability.py:test_reversed_slope_gives_explicit_direction_error` da bunu bekler. B bu testi tekrar çalıştırmadı; iddia kaynak kod/test sözleşmesiyle çelişmektedir. Kompleks ters kesitlerin hepsi için yön algısının yeterliliği kanıtlanmadı.
- `bearing.ts:142` Hansen ve Vesic'in ikisinin de H>A′su sınırında durduğunu söyler. B2,φ0,c10,V100,H30,D=q0,Vesic için A′su20 kN/m olmasına rağmen motor q_ult21.4 kPa/Q_ult42.8 kN/m verir; Vesic'in gerçek guard'ı `mH>=A′suNc`dır (`bearing.py:139`). Bu belge-kod farkı kesindir; doğru fiziksel Vesic guard'ının özgün kaynakla seçimi açık kalır.
- Kanıt [education_checks.py](2026-10-22-inceleme-kanitlari/engineering-b/education_checks.py)/[education_checks.json](2026-10-22-inceleme-kanitlari/engineering-b/education_checks.json); ilgili kaynak satırları yukarıda. **Önem düşük/orta eğitim, güven yüksek.** Ayrıca doğrudan `coulomb_kp` için “uyarır” diyen öğrenci metni yanıltıcıdır: uyarı doğrudan fonksiyonda değil distribution çağrısında üretilir.

### ENG-B-010 — Bishop dilim şeklinin mobilize kayma direnci oku kayma yönünde

- Yer: `web/src/modules/education/figures/spDraw.tsx:213` `SlopeBishopSlice`, education IDs `slope-bishop-slice` ve `slp-bishop-slice`.
- Şekilde seçili dilim tabanı ekran vektörü (90,−20), yukarı/sağa yükselir. Kütle sola/aşağı kayarken dilim üzerine direnç sağa/yukarı olmalıdır. `S` oku (140,448)→(102,457), yani (−38,+9) çizilmiştir; tabanın sağa/yukarı doğrultusuyla skaler çarpım−3600. Mobilize direnç etiketiyle ters kuvvet öğretir.
- Kanıt [education_checks.json](2026-10-22-inceleme-kanitlari/engineering-b/education_checks.json) geometrik vektörleri ve kaynak çizimi; tarayıcı render/piksel testi yapılmadı. **Önem orta eğitim, güven yüksek** (kuvvetin dilim üzerine çizildiği etiket sözleşmesine göre). Hesap motorunu etkilemez.


### Yapılar ve yönetmelik akışı

### ENG-C-001 — ASD palplanşta SDS girilince yöneten statik durum kayboluyor

**Önem: yüksek (P1), güven: yüksek. Etki: gerekli gömülme ve moment büyük ölçüde eksik.**

- Simge/satır: `geotek/services/structures.py:745`, `design_sheet_pile_structure`, ASD dalı `seismic = structure.sds is not None` ile yalnız tek `_sheet_case` çağırır. Aynı fonksiyonun kısmi katsayı dalı statik+deprem döngüsü yapar (`:782`).
- Girdi: konsol palplanş; H=5 m; profil altı40 m; γ=18, γsat=20 kN/m³; φ′=30°; q=0; ön/arka drenajlı; ASD pasif FS1.5; geri YASS design0 / seismic100 m; ön YASS design5 / seismic100 m; SDS=0.1; gömülme artışı0.20.
- Bağımsız statik: p(z)=Ka σ′v,arka − Kp σ′v,ön/1.5 + uarka−uön. `∫p(z)(toe−z)dz=0` kökünden D0=15.7571633937 m; D=18.9085960725 m; Mmax=2399.83529217 kNm/m.
- Actual, SDS=0.1: D0=6.6994069909 m; **D=8.0392883891 m, Mmax=436.94500400 kNm/m**. Gömülme %57.48, moment %81.79 eksik.
- Actual, yalnız SDS kaldırılınca: D=18.9085961207 m, Mmax=2399.83523129 kNm/m; bağımsız statikle uyuşur. Fark kaynak katsayısından veya kök çözücüsünden değil, sonuç birleşiminden gelir.
- Kanıt: `results.json.asd_static_envelope`; yukarıdaki API/UI dosyaları. Repo kökünden [audit_c.py](2026-10-22-inceleme-kanitlari/engineering-c/audit_c.py) komutu tek başına yeniden üretir.
- İstenen davranış: ASD için statik ve deprem durumlarını ayrı hesaplayıp gömülme/moment/ankraj yükü için yönetenini saklamak ve raporlamak.

### ENG-C-002 — TBDY ileri duvarda tanδ üst sınırı aşılabiliyor; başarısız tasarım geçiyor

**Önem: yüksek (P1), güven: yüksek hesap / knowledge assessment; güncel birincil metin görülmedi.**

- Simge/satır: `geotek/engine/limit_state.py:257` ve `:519`, `verify_wall` / `verify_wall_layered`: δbase yoksa doğrudan φ kullanılıyor, `tanδ≤0.6` uygulanmıyor. `walls_advanced.py:135` profil aktarıcısı da sınır koymaz. Temel seviye `walls_basic.py:51,234` ve `walls/layered.py:35` aktarımı sınırı uygular. `config/design_codes/tbdy2018.yaml` kendi metadata'sında Tablo16.3 sınırını0.6 olarak bildirir.
- Girdi: H6 m, B4 m, üst1 m ağırlık duvarı; γc24; geri γ18, φ30°, δduvar=0; temel φ40°, aderans0; sürşarj45 kPa; TBDY-static. Eksik yük/malzeme katsayılarının her birine açık, etiketli1.0 kullanıcı override verildi; γRh=1.1.
- Kuvvetler: V=360 kN/m; H=198 kN/m. Actual R=360tan40°/1.1=274.614425 kN/m; **R/E=1.386941539**.
- Bağımsız beklenen, yerinde dökme beton sıkıştırılmış zemin için tablo üst sınırı kullanıldığında: R≤360×0.6/1.1=196.363636 kN/m; **R/E=0.991735537<1**. Direnç %39.85 yüksek.
- Actual eccentricity/sliding/overturning/bearing kontrollerinin tümü `passed=True`, duvar `passed=True`; bu örnek yalnız gösterim farkı değildir.
- Structure servisinin kullandığı **katmanlı motor yolu da** ayrıca sınandı (`branches.json.tbdy_layered_cap`): aynı duvar, temel profilindeφ40 ve üst6m retained-fillφ30; q94kPa. Bağımsız Coulomb kuvvetleri V450.298347312,H248.092670254kN/m ile tam uyuşuyor. Actual sliding1.384545602 ve tüm kontrollerTrue; tanδ≤0.6 uygulanınca beklenen0.990022317<1. Bu ek kontrol gerçek katmanlı motor yolunu kapsar; API/UI üzerinden false-pass üretildiği iddia edilmez.
- Kanıt: `results.json.tbdy_base_cap`, scriptin açık override listesi. [audit_c.py](2026-10-22-inceleme-kanitlari/engineering-c/audit_c.py) ile yeniden üretilir.
- Kaynak durumu: tablo değeri bu oturumda kaynak PDF'sinden doğrulanmadı; bağımsız geoteknik bilgi + konfigürasyondaki mevcut kural + basic yolun aynı sınırı tutarlı. Yeni kaynak doğrulaması iddia edilmez.

### ENG-C-003 — Tributary ankraj yükleri ile verilen kesme/moment diyagramları farklı modellerden

**Önem: orta (P2), güven: yüksek sonuç uyuşmazlığı.**

- Simge/satır: `geotek/engine/anchored_wall.py:314` `_hinge_model`; `:343` tributary seçilince yalnız `reactions` değiştirilir; `:348` hâlâ hinge kesme/moment dizileri döndürülür.
- Girdi: H10 m, γ18, φ30°, kuru kum, q0, ankrajlar1.5/4.5/7.5 m, pasifFS1.5, `load_method='tributary'`.
- Actual ankraj reaksiyonları112.5/135/121.40625 kN/m, taban21.09375; zarf45 kPa, toplam390 kN/m. Bunlarla z2 m'de kesme **∫p−ΣT=−45 kN/m** beklenirken dönen diyagram **−53.12499 kN/m** (hinge yükleriyle hesaplanan değer).
- Aynı uyuşmazlık z8 m'de −31.40625 beklenen / −25.416679 actual. İlan edilen tributary kuvvetlerinin toplam moment artığı−9.401041667 kNm/m; hinge örneği yaklaşık1e−8 ile dengede.
- **Yorum sınırı:** Tributary yönteminin ampirik tasarım yükü dağıtması tek başına yanlış değildir; global moment artığı bunu çürütmez. Kesin sorun, aynı sonucun reaksiyonlarını ve diyagramlarını farklı modellerden verirken ayrı tasarım modellerini açıkça ayırmamasıdır. Diyagram reaksiyonu kontrolü bu ayrımı kanıtlar.
- Kanıt: `results.json.multi_anchor` ve ayrı integral fonksiyonu `ep/eint`; [audit_c.py](2026-10-22-inceleme-kanitlari/engineering-c/audit_c.py).

### ENG-C-004 — Çok ankrajlı sonuçta `v_max` tüm duvar kesme dizisinin maksimumu değil

**Önem: orta/yüksek tasarım riski (P2), güven: yüksek sözleşme uyuşmazlığı / orta fiziksel model yorumu.**

- Simge/satır: `anchored_wall.py:554`–`:559`: taban altı kesmede ilk sıfır geçişinden sonraki değerler maksimum aramasından çıkartılır. `core/models/anchors.py:376` alanı “Largest shear per metre of wall” olarak tanımlar; `v_max_member` bu değerden türetilir.
- ENG-C-003 ile aynı nominal girdide hinge: **vmax87.083321 kN/m**, dönen kesme dizisinde **max|V|257.940919 kN/m**. Tributary:81.09375 /241.01559 kN/m. Sırasıyla %66.24 /%66.35 daha küçük özet.
- Artık uç kuvveti ayrıca `toe_force_not_balanced` uyarısıyla gösteriliyor. Bu uyarı ve kullanılan yaklaşık gömülme modeli bu oturumda “yok” sayılmadı. Ancak tüm duvar için maksimum diye yayımlanan alan, kendi diyagramıyla uyuşmaz ve üye başına kesme talebine aynen taşınır.
- Tam gömülme/alt uç tepkisi modelinin geçerliliği için birincil GEC4 metni görülmedi; bu kayıt saha güvenliği kesin hükmü yerine hesap sözleşmesi ve tasarım talebi riskidir.
- Kanıt: `results.json.multi_anchor.*.max_abs_returned_shear`; script ve model docstring'i.

### ENG-C-005 — Ankrajlı iksa eğitim şekli yumuşak kilin taban basıncını sıfıra indiriyor

**Önem: eğitimde orta (P2), güven: yüksek.**

- Simge/satır: `web/src/modules/education/figures/spDraw.tsx:373` `AnchoredWallEnvelopes`: soft-clay polygon son0.25H boyunca aşağı doğru sıfıra iner. Motor `anchored_wall.py:310` z=[0,0.25H,H], p=[0,p,p] ile tabana kadar sabit kalır.
- Bağımsız alan: üst0.25H rampa+sonra sabit basınç toplamı0.875pH; çizimde0.75pH. H8 m, p29.92 kPa için **209.44 yerine179.52 kN/m (%14.29 az alan)** öğretiyor.
- Aynı şeklin genel caption'ı `spDraw.tsx:382` tüm panelleri H10 /1.5-4.5-7.5 ankrajlar olarak tanıtırken kil29.92/54.4 kPa sayıları eğitimdeki H8, γ17 örneklerindendir; kum45 kPa H10 örneğidir.
- `anchored_wall_student.ts:132,139` ayrıca Ns'yi ortalama Su ile tanımlar ve Henkel'de Su,b ayrımını kaybeder; motor Ns için taban altındaki minimumSu,b kullanır. “d girilmezse durur” açıklaması da `run_analysis` için doğru değil; d, B′'ye varsayılır ve varsayım bildirilir. Standalone `apparent_envelope` d/default verilmediğinde durur.
- Kanıt: `results.json.education.soft_clay_draw`, `inventory.json.education`; kaynak şekli yeniden doğrulanmadı, eğitim-motor ve bağımsız alan karşılaştırmasıdır.

### ENG-C-006 — Alt seviye hesap API'lerinde negatif gömülme ve NaN kesit çıktısı kabul ediliyor

**Önem: düşük/orta (P2/P3), güven: yüksek; mevcut web yolu erişilebilirliği bu C incelemesinde gösterilmedi.**

- `sheet_pile.py:325` /`:381`: `depth_increase=-2` kabul edilip H5 kuru kum için D0=4.629270464 m, **D=−4.629270464 m** döner.
- `sheet_pile.py:278` `_section`: allowable_stress=NaN, `<=0` kontrolünü geçip **section_modulus_cm3=NaN** üretir.
- `core/models/walls.py:113` `GravityGeometry` finite-policy tanımlamaz; height=inf, base_width=inf, embedment=inf ve embedment7>height6 kabul edilir. `AnchorDesignInputs`/anchored-wall modelleri `allow_inf_nan=False` ile nonfinite değerleri doğru reddeder.
- Structure modelleri depth_increase≥0 ile mevcut form yolunda ilk örneği önler; bu ayrım korundu. Bütün UI yollarına ulaşılıyor iddiası yok.
- Kanıt: `results.json.boundaries`; [audit_c.py](2026-10-22-inceleme-kanitlari/engineering-c/audit_c.py).




## Denetim yöntemi, kaynak sınırı ve tekrar

Bağımsız beklenenler üretim fonksiyonlarının yardımcısını yeniden kullanarak oluşturulmadı. A: Python math ve Brent kökü; B: kuvvet/kama dengesi, kararlı logNq/expm1, katman birinci momenti ve Bishop Brent kökü; C: bağımsız efektif gerilme integrali, quad/Brent, kuvvet/moment dengesi, trigonometrik ankraj geometrisi. Üretim yalnız actual tarafında çağrıldı. Bağımsız ikinci inceleme aynı bulguları ayrı formül/dengeyle yeniden değerlendirdi; kısmi hükümlerin kapsamı yukarıdaki tabloda korunur.

**Bu oturumda yeni birincil yayın/standart/PDF sayfası doğrulanmadı.** Registry'deki atıflar, YAML `verified` metadatası, geçmiş research notları ve verification test adları özgün kaynak görülmüş kanıt değildir. Yerel BI2014 CPT233 ve SPT2010 226 satırlı veri tabloları/provenance açıklaması okundu; özgün PDF'ye karşı yeniden transkripsiyon yapılmadı. Nc digitized chart, ankraj tendon/transfer tabloları ve yönetmelik hücreleri envanterlendi; envanter taraması sayısal veya kaynak tasdiki değildir. Proje özelinde zemin belirsizliği, saha kalibrasyonu, mühendis onayının uygunluğu ve bütün kombinasyonlar bu çalışmayla kapanmaz.

Kapsam dışı veya sınırlı kalanlar: tüm permeability/±kv/hidrodinamik dalların bağımsız sayısal tekrarı; bütün EC7/AASHTO/TBDY hücrelerinin yeni kaynak kontrolü; bütün ankraj tablolarının özgün transkripsiyonu; global minimumun continuum kanıtı; tüm eğitim figürlerinin tarayıcı/piksel testi; gerçek Word/LibreOffice sayfa/baskı düzeni; ekran okuyucu ve WCAG tam uyumluluk. UX'te gerçek390px viewport ve klavye denemeleri vardır. `%200` kaydı **CSS zoom:2 simülasyonudur**, yerel tarayıcı zoom menüsüyle doğrulanmış test değildir. İşlev modülleri ayrıca800px EN/koyu kullanıldı; bütün modüllerin390px mobil testi yapılmadı.

### Sayısal toleranslar ve kanıt okuma

A nominal kapalı bağıntılarında rtol=atol=1e−9; sıkı iterasyonlarda motor toleransı1e−12/1e−13 ve1000 adım, bağımsız Brent köküne1e−9 karşılaştırması kullanıldı. Varsayılan CPT için n kalıntısı≤0,001, BI direnç kalıntısı≤1e−4 ayrıca izlendi; dış analiz yolu tolerans override almadığından FS karşılaştırması2e−5'tir. B kapalı bağıntılarında1e−9, kama optimizasyonunda1e−8, Bishop geometri karşılaştırmasında600 noktalı uç bulma farkına izin veren2e−4 ve normalize moment kalıntısında1e−6 kullanıldı. Log-spiral poligon/analitik integral en kötü bağıl farkı yaklaşık5,95e−7; geniş kontrol toleransı1e−4'tür. C palplanş bağımsız toe kökü farkları nominal örneklerde genellikle5,2e−7m'den küçüktür; bunlar kaynakta verilen sayılara yuvarlama ve nümerik yöntem farkından ayrı değerlendirilir. Eğitim ve DOCX sayıları son gösterilen basamağın yarısı toleransıyla karşılaştırıldı.

Tüm asıl sayısal kayıtlar: [A sonuçları](2026-10-22-inceleme-kanitlari/engineering-a/results.json), [B sonuçları](2026-10-22-inceleme-kanitlari/engineering-b/results.json), [C sonuçları](2026-10-22-inceleme-kanitlari/engineering-c/results.json), [bağımsız sonuçlar](2026-10-22-inceleme-kanitlari/independent-review/results.json), [bağımsız ekler](2026-10-22-inceleme-kanitlari/independent-review/supplement.json), [bulgu hükümleri](2026-10-22-inceleme-kanitlari/independent-review/adjudication.json). Bir bulgunun kanıtındaki `results.json.<probe>` ifadesi ilgili paket dosyasındaki anahtarı belirtir.

### Kalıcı kanıt ve komutlar

Ham functional ağ kayıtları kayıpsız `.jsonl.gz` olarak saklanır; `gzip -cd <dosya>` veya Python `gzip.open(path, "rt")` ile açılır. `compressed-log-index.json` özgün SHA256 bilgisini taşır.

Kanıt kökü [inceleme kanıtları](2026-10-22-inceleme-kanitlari/). JSON'lardaki NaN/Infinity gözlemleri strict JSON için aynı isimli **string** olarak saklanır; geçerli sayısal mühendislik sonucu değildir. Scriptlerin kendi çıktılarıyla kanıtı yeniden yazabileceğini dikkate alarak tekrarlar için kanıt klasörünün bir çalışma kopyası ve ayrı QA kütüphanesi kullanın. UI seed scriptleri ek QA proje/yapı üretir; kullanıcı projesinde çalıştırılmamalıdır.

Depo kökünden, bağımlılıkları kurulu Python ile örnek bağımsız tekrarlar:

```bash
# Depo kökünde; bağımlılıkları kurulu Python ortamı etkin olmalıdır.
geotek_recheck=$(mktemp -d /tmp/geotek-recheck.XXXXXX)
for geotek_package in engineering-a engineering-b engineering-c independent-review; do
  mkdir -p "$geotek_recheck/$geotek_package"
  for geotek_file in "docs/audit/2026-10-22-inceleme-kanitlari/$geotek_package/"*.py "docs/audit/2026-10-22-inceleme-kanitlari/$geotek_package/"*.csv; do
    if [ -f "$geotek_file" ]; then
      cp "$geotek_file" "$geotek_recheck/$geotek_package/"
    fi
  done
done
PYTHONPATH="$PWD" GEOTEK_REPO="$PWD" GEOTEK_AUDIT_OUT="$geotek_recheck/engineering-a" python "$geotek_recheck/engineering-a/independent_audit.py"
PYTHONPATH="$PWD" python "$geotek_recheck/engineering-b/reference_audit.py"
PYTHONPATH="$PWD" python "$geotek_recheck/engineering-b/education_checks.py"
PYTHONPATH="$PWD" python "$geotek_recheck/engineering-c/audit_c.py"
PYTHONPATH="$PWD" python "$geotek_recheck/engineering-c/branches_c.py"
PYTHONPATH="$PWD" python "$geotek_recheck/independent-review/review.py"
PYTHONPATH="$PWD" python "$geotek_recheck/independent-review/supplement.py"
```

Mevcut testlerin tekrarı:

```bash
python -m pytest --basetemp=/tmp/geotek-pytest -o cache_dir=/tmp/geotek-pytest-cache
npm --prefix web test
npm --prefix web run typecheck
npm --prefix web run build
```

Ortam kurulumu: `python -m venv --system-site-packages <venv>` ve aktif ortamda `python -m pip install -e '.[dev,web,report]'`; web için yazılabilir npm cache ile `npm --prefix web ci`. Kilit dosyası değiştirilmedi; TLS veya paket doğrulaması kapatılmadı. Canlı inceleme başlangıcı `GEOTEK_SETTINGS=<izole-settings.json> python -m uvicorn geotek.launcher:build_app --factory --host 127.0.0.1 --port <port>`; health ve gerçek iş istekleriyle hazır olma doğrulanmalıdır. Örnek tekrar komutları yalnız yeni geçici çalışma kopyasına çıktı yazar; depodaki arşiv kanıtlarını güncellemez. Bu komutlar iç doğrulama içindir; localhost kullanıcı önizleme bağlantısı değildir.


## Ek — engineering-a yöntem ve kapsam envanteri

## Yöntem inceleme özeti

Stresler: hidrostatik u=max(0,z−GWT)gamma_w, sigma'=sigma−u; katman+GWT kırılma noktalarında parça integrasyonu doğru. Gamma/gamma_sat farkı ve in-situ/seismic GWT ayrımı bağımsız tam zincirde denetlendi. gamma_sat=None→gamma mevcut model varsayımıdır; doygun birim ağırlığın ayrıca verilmediği profil kendiliğinden saha ölçümü sayılmaz. Ponded water desteklenmiyor. CPT gamma log integrali yüzeyden ilk numuneye ilk gamma'yı sabit, sonrasında trapez kabul eder; bu veri yorumlama seçimidir.

SPT: N60=N ER/60 CB CS CR, CN=min(sqrt(Pa/sigma'),1.7), refusal alt sınır+uyarı. CN'nin yüzeyde1.7 vermesi matematiksel üst limit uygulaması; sigma'<=0 fiziksel normalizasyonu ayrıca değerlendirilmelidir. Varsayılan rod_stickup0 bir kullanıcı ayarıdır.

CPT/SBTn: qt=qc+u2(1−a), Fr=100fs/(qt−sv), Qt1=(qt−sv)/se, Bq=(u2−u0)/(qt−sv); Qtn/n/Ic eşzamanlı çözümün bağımsız kökü tutarlı. Ic sınırları1.31/2.05/2.60/2.95/3.60 ve eşitlikte üst Ic bölgesine geçiş; zone1 ayrı öncelik;8/9varsayılan kapalı. n alt sınırı0 ve gamma minimum12/Rf minimum.01 proje/nümerik seçimleridir; özgün regresyonun aynen parçası diye sunulmadı. İnce dane FC=clip(80(Ic+CFC)−137,0,100).

USCS: FC5/12/50, LL50, PI4/7, A-line/U-line, G/S eşitlikteS, Cu4/6 ve1<=Cc<=3 bağımsız eşiklerde kontrol edildi. Organik OL/OH/PT tanıması otomatik yok, fine grained çıktıda not var. Cc için temsil edilebilir tam eşik ve iki yanı incelendi; bu sadece gerçek sayıdaki eşiklere sonlu basamaklı girdi verildiğinde beklenen sınıra dikkat gerektirir.

Layering: midpoint hücreleri yüzey0'dan son veri derinliğine gider; smoothing eşit numune ağırlıklı derinlik penceresi, min thickness en ince+üst eşitlik, benzerlik strict<; CPT lens/exceptional1/8/9 bariyeri; SPT corrected N mean ve strict relative change; log gap üst tabakaya uzatma+uyarı; refusal means dışlama; drainage yalnız Ic veya G/S önekinden geçici atama+uyarı. Bunlar jeolojik kaynak denklemi değil algoritma tercihidir. Nominal örnekler yeniden hesaplandı; bütün uyarı kombinasyonlarının yeni bağımsız testi yazılmadı.

Youd2001: rd ilk9.15m/23m ve RW uzantısı30m; SPT alpha/beta FC5/35, CRR Ncs<30; CPT n1/.5/.7 seçimleri, Kc1.64, CRR qcs50/160, CQcap1.7; her iki MSF ve Ksigma f.6–.8/Pa sınırları koddan ayrı formülle denetlendi. Kc düşükF kısayolu kaynak açık başlığıdır. BI2014: rd34m, m için Ncs46/qcs21–254 kırpması, CN1.7, deltaN/deltaq, CRR denklemleri, MSFmax2.2/Csigma.3/Ksigma1.1 sınırlarının iki yanı ve bağımsız kökler denetlendi. Analiz FS=CRR75*MSF*Ksigma/CSR; CSR=.65amax sv/se rd; in-situ direnç düzeltmesi ile seismic demand farklı stres kullanır. Bu ayrım nominal SPT+CPT×iki yöntem tam zincirinde doğrulandı.

LPI: ağırlığın hücre başına tam integrali aritmetik olarak doğru; su seviyesinin hücreye uygulanması ve geçersiz durumların yeterliliği bulgudur. 2m yüzey uzatma eşiği ve orta nokta hücreleri yayımlanmış sabit katsayı diye etiketlenmedi.

Eğitim: classification ve liquefaction temel+student içerikleri ile bunların bearDraw karşılıkları gözden geçirildi. USCS SW-SC/SP-SC/CL örnekleri, iki CPT iterasyon örneği, Youd5m örneği ve LPI9.975 örneği gösterilen yuvarlamayla uyumlu. rd/FC/Ic şekillerinin sayısal fonksiyonları motorla aynı formdadır. CSR/CRR mekanizma ve FS profili açıkça şematiktir; saha sonucu muamelesi yapılmadı. Ekran görüntüsü/piksel/gerçek tarayıcı düzeni bu ajan tarafından doğrulanmadı.

## Test ve kapsam sonucu

Son koşu: 668 karşılaştırma; 654 PASS, 14 FAIL/fark; 63 ayrı domain gözlemi. FAIL sayısı bulgu sayısı değildir: üç LPI ve yedi MSF noktası aynı kök nedenleri tekrarlar. Probe gözlemlerinin bazıları beklenen reddir, bazıları savunma eksikliğidir; probe sayısı başarısız test sayısı olarak kullanılamaz.

| Yerel CSV | Satır | Motor / bağımsız kök maks. mutlak fark | Yuvarlanmış referans farkı | Sonuç / sınır |
|---|---:|---:|---:|---|
| CPT | 233 | 3.27e-13 | 1.40765 | resistance için0aykırı; both abs1.5 and rel2% |
| SPT | 226 | 4.12e-13 | 0.649308 | resistance için0aykırı; abs1.5 or rel5%; diagnostic only, existing verification uses documented outlier policy |

CPT CSV rd en büyük mutlak fark0.005902713 <0.006. SPT CSV rd en büyük fark0.038744721 >0.006: yerel referans satırlarında ayrı yuvarlama/yöntem/çıkarım tutarsızlığı var; bu script bunu diagnostic olarak raporlar, otomatik tolerans genişletip PASS ilan etmez. Runtime ajanının mevcut verification suite sonuçları bu dosyadan ayrı teslimdir. Burada bütün pytest paketi tekrarlanmadı; test dosyalarının kapsamı okundu, yeni bağımsız kontroller geliştirildi.

İncelenen public yüzey AST ile128 simge (fonksiyon, dataclass ve public method) olarak envanterlendi. Sadece public yüzey sayısı; yöntemlerin kombinatoryal tüm girdilerinin eksiksiz test edildiği iddiası yok. Tam simge satırları aşağıda; docstring'ler results.json'da. Kaynak erişimi bütün satırlarda yukarıdaki knowledge/CSV sınırındadır.

## Registry matrisi — her ID ayrı satır

K = knowledge review; A = bağımsız nominal aritmetik; B = uygulanabilirlik/sınır kontrolü. Hepsi K+A; özgün yayın source-verified değildir.

| ID | Girdi / katsayılar | Birim / geçerlilik | Kaynak iddiası (kod) | İnceleme / açık konu |
|---|---|---|---|---|
| `RC2010_gamma_CPT` | qt, fs; serbest katsayı yok | kN/m3; General; less reliable in organic/very soft soils | Robertson & Cabal (2010), 2nd Int. Symp. on Cone Penetration Testing | K; A+B; Rf.01/gamma12 floor ve floor uyarısı incelendi;12 proje varsayımı. |
| `Skempton1986_Dr_SPT` | N1_60; Cd=60.0 | %; Normally consolidated fine-medium sands; C_d ~ 55-65 | Skempton (1986), Geotechnique 36(3) | K; A+B Cd55/65; Dr>100 geçerlilik ENG-A-005. |
| `Mayne_sigp_CPT` | qt, sigma_v; k=0.33 | kPa; Clays (I_c > 2.6); k = 0.2-0.5, default 0.33 | Mayne (2007), NCHRP Synthesis 368 | K; A+B k.2/.5 ve Ic; negatif net ENG-A-005. |
| `BI2014_FC_CPT` | Ic; CFC=0.0 | %; Generic; C_FC = 0 +/- 0.29 site-specific calibration recommended | Boulanger & Idriss (2014), Report UCD/CGM-14/01 | K; A+B CFC±.29, FC0/100 clipping. |
| `KM1990_E_SPT` | N60; alpha=10.0 | kPa; Sands, drained; alpha = 5 (silty sand), 10 (clean NC sand), 15 (clean OC sand) | Kulhawy & Mayne (1990); FHWA GEC-6 (FHWA-IF-02-054) | K; A+B alpha5/15; kum alanı ENG-A-002. |
| `R2009_E_CPT` | qt, sigma_v, Ic; serbest katsayı yok | kPa; Young, uncemented silica sands (I_c < 2.6); strain ~0.1% | Robertson (2009), Can. Geotech. J. 46(11) | K; A+B Ic; negatif E ENG-A-005; loading/strain saha uygunluğu knowledge. |
| `KM1990_phi_SPT` | N60, sigma_v_eff; serbest katsayı yok | deg; Clean, uncemented sands; gravel inflates N | Kulhawy & Mayne (1990), EPRI EL-6800 (after Schmertmann 1975) | K; A+B N60 0/60; bilinen kilde bağlam ENG-A-002, inf ENG-A-013. |
| `HU1996_phi_SPT` | N1_60; serbest katsayı yok | deg; Sands, approx. 3.5 <= (N1)60 <= 30 (range pending source verification) | Hatanaka & Uchida (1996), Soils and Foundations 36(4) | K; A+B N1_60 3.5/30; enerji normalizasyonu özgün kaynaktan doğrulanmadı. |
| `PHT1974_phi_SPT` | N1_60; serbest katsayı yok | deg; Sands, (N1)60 <= ~50 | Peck, Hanson & Thornburn (1974), fit by Wolff (1989) | K; A+B N1_60 0/50; özgün N tanımı doğrulanmadı. |
| `RC1983_phi_CPT` | qc, sigma_v_eff; serbest katsayı yok | deg; Uncemented, unaged quartz sands (I_c < 2.6) | Robertson & Campanella (1983), Can. Geotech. J. 20(4) | K; A+B Ic ve se→0/negatif; sigma0 scalar bölme hatası gözlendi. |
| `KM1990_phi_CPT` | qt, sigma_v_eff; serbest katsayı yok | deg; Clean sands (I_c < 2.6) | Kulhawy & Mayne (1990); Mayne (2007) NCHRP Synthesis 368 | K; A+B Ic; log ve sigma alanı knowledge incelendi. |
| `TPM1996_phi_PI` | PI; serbest katsayı yok | deg; Normally consolidated clays, 5 <= PI <= 80 (range pending verification) | Terzaghi, Peck & Mesri (1996), after Kenney (1959) (attribution pending verification) | K; A+B PI5/80; atıf+PI aralığı kodda da pending. |
| `CPT_su_Nkt` | qt, sigma_v; Nkt=14.0 | kPa; Clay-like soils (I_c > 2.6); N_kt 10-20, calibrate locally | Lunne, Robertson & Powell (1997); Robertson & Cabal (2015) CPT Guide | K; A+B Nkt10/20; negatif su ENG-A-005. |
| `CPTu_su_Ndu` | u2, u0; Ndu=7.0 | kPa; Soft, sensitive clays; N_du 4-10 | Lunne, Robertson & Powell (1997) | K; A+B Ndu4/10; negatif su ENG-A-005. |
| `Stroud1974_su_SPT` | N60; f1=4.4 | kPa; Insensitive overconsolidated clays; f1 = 3.5-6.5 kPa depending on PI | Stroud (1974), European Symp. on Penetration Testing | K; A+B f1 3.5/6.5; PI/sensitivite/saha kalibrasyonu açık. |
| `Hara1974_su_SPT` | N60; serbest katsayı yok | kPa; Clays; low reliability, use only for preliminary estimates | Hara et al. (1974), Soils and Foundations 14(3) | K; A+B Ic; katsayı/N enerji tanımı özgün kaynaktan doğrulanmadı. |

## Public yöntem matrisi

R = gövde/dal/özel durum kod incelemesi; N = bu scriptte ilgili hesap yolunun sayısal örneği; S = mevcut unit/verification kapsamı okundu, bu scriptte ayrı bütün dallar sayısal tekrar edilmedi. Veri taşıyıcıları formül sayılmaz. Aynı isimli yöntemler dosya ile ayırt edilir.

| Dosya:satır / simge | İnceleme durumu | Dal/geçerlilik/katsayı/kaynak özeti |
|---|---|---|
| `geotek/core/units.py:52` `dimension_of` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/core/units.py:59` `convert` | R+N | Convert a scalar or array between two units of the same dimension. |
| `geotek/core/units.py:75` `to_si` | R+N | Convert to the internal SI base unit of the unit's dimension. |
| `geotek/engine/stresses.py:16` `vertical_stresses` | R+N | Total stress, pore pressure and effective stress [kPa] at depth(s) z [m]. |
| `geotek/engine/insitu/spt.py:26` `rod_length_factor` | R+N | C_R by rod length [m] (Youd et al. 2001, Table 2). |
| `geotek/engine/insitu/spt.py:37` `borehole_diameter_factor` | R+N | C_B: 65-115 mm -> 1.0, 150 mm -> 1.05, 200 mm -> 1.15 (Youd et al. 2001). |
| `geotek/engine/insitu/spt.py:46` `sampler_factor` | R+N | C_S: 1.0 for a standard sampler; 1.1-1.3 for a sampler without liners. |
| `geotek/engine/insitu/spt.py:55` `n60` | R+N | N60 = N * (ER/60) * C_B * C_S * C_R. |
| `geotek/engine/insitu/spt.py:60` `overburden_factor_liao_whitman` | R+N | C_N = (Pa / sigma'_v0)^0.5 <= 1.7 (Liao & Whitman 1986; NCEER cap). |
| `geotek/engine/insitu/spt.py:70` `SPTProcessed` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. |
| `geotek/engine/insitu/spt.py:86` `SPTProcessed.to_dataframe` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/insitu/spt.py:94` `process_borehole` | R+N | Apply energy, equipment and overburden corrections to all SPT records. |
| `geotek/engine/insitu/cpt.py:34` `corrected_tip_resistance` | R+N | q_t = q_c + u2 (1 - a). Without u2, q_t = q_c. |
| `geotek/engine/insitu/cpt.py:42` `stress_exponent` | R+N | n = 0.381 I_c + 0.05 (sigma'_v0 / Pa) - 0.15, limited to <= 1.0 (Robertson 2009). |
| `geotek/engine/insitu/cpt.py:48` `normalise_iterative` | R+N | Solve Q_tn, n and I_c simultaneously (Robertson 2009). |
| `geotek/engine/insitu/cpt.py:77` `stresses_from_unit_weight` | R+N | Integrate a unit-weight log: sigma_v by trapezoids from the surface, hydrostatic u. |
| `geotek/engine/insitu/cpt.py:88` `CPTProcessed` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. |
| `geotek/engine/insitu/cpt.py:112` `CPTProcessed.to_dataframe` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/insitu/cpt.py:127` `process_cpt` | R+N | Process a CPT sounding. |
| `geotek/engine/classification/uscs_names.py:13` `USCSName` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. |
| `geotek/engine/classification/uscs.py:15` `USCSResult` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. |
| `geotek/engine/classification/uscs.py:22` `a_line` | R+N | A-line: PI = 0.73 (LL - 20). |
| `geotek/engine/classification/uscs.py:27` `u_line` | R+N | U-line (upper bound of natural soils): PI = 0.9 (LL - 8). |
| `geotek/engine/classification/uscs.py:32` `fines_type` | R+N | Plasticity class of fines: 'C', 'M' or 'CL-ML' (hatched zone). |
| `geotek/engine/classification/uscs.py:42` `classify` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/classification/uscs.py:112` `classify_lab_record` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/classification/robertson.py:33` `soil_behaviour_index` | R+N | I_c = sqrt((3.47 - log Qtn)^2 + (log Fr + 1.22)^2). |
| `geotek/engine/classification/robertson.py:41` `qtn_from_ic` | R+N | Invert I_c on the log10(Qtn) <= 3.47 branch; undefined points are NaN. |
| `geotek/engine/classification/robertson.py:48` `zone_1_boundary` | R+N | Return the existing sensitive-soil boundary Qtn = 12 exp(-1.4 Fr). |
| `geotek/engine/classification/robertson.py:54` `zone_from_ic` | R+N | Zones 2-7 from I_c (Robertson 2009/2010). NaN I_c gives zone 0 (undefined). |
| `geotek/engine/classification/robertson.py:65` `sbtn_zone` | R+N | SBTn zone 1-9 (0 where undefined). |
| `geotek/engine/classification/robertson.py:92` `is_sand_like` | R+N | Sand-like (drained, potentially liquefiable) behaviour for I_c < 2.6. |
| `geotek/engine/layering/__init__.py:14` `proposal_to_layers` | R+N | Convert a proposal without selecting or approving design parameters. |
| `geotek/engine/layering/spt.py:57` `spt_log_layers` | R+N | Preserve log layers, absorbing unlogged gaps into the layer above. |
| `geotek/engine/layering/spt.py:133` `spt_uscs_n_layers` | R+N | Split when the lab group changes or relative corrected N60 change exceeds settings. |
| `geotek/engine/layering/common.py:16` `Layer` | R; veri taşıyıcı | An unapproved interpretation; fields map directly to ProposedLayer. |
| `geotek/engine/layering/common.py:31` `Proposal` | R; veri taşıyıcı | Fields map directly to LayeringProposal without importing the HTTP package. |
| `geotek/engine/layering/common.py:41` `Segment` | R; veri taşıyıcı | Half-open sample indices; geometry comes from midpoint cell edges. |
| `geotek/engine/layering/common.py:48` `sample_arrays` | R+N | Validate aligned 1-D samples, stable-sort depths, and reject duplicate depths. |
| `geotek/engine/layering/common.py:64` `edges` | R+N | Start at ground surface, as SoilProfile requires; end at the last data depth. |
| `geotek/engine/layering/common.py:77` `mean` | R+N | Arithmetic mean of finite observations; missing observations are not zero. |
| `geotek/engine/layering/common.py:84` `interval_warning` | R+S | Append a warning using the shared format and named SI-depth context. |
| `geotek/engine/layering/common.py:90` `warn_no_data` | R+S | Flag extrapolation and gaps exceeding adjacent local sample spacing. |
| `geotek/engine/layering/common.py:116` `merge_thin` | R+S | Merge the thinnest eligible segment first (equal thickness: upper). |
| `geotek/engine/layering/common.py:141` `proposal` | R+S | Copy settings and deduplicate identical warning messages in occurrence order. |
| `geotek/engine/layering/cpt.py:27` `cpt_layers` | R+N | Propose layers from processed Ic; never mutate the input or approve values. |
| `geotek/engine/correlations/stiffness.py:19` `e_kulhawy_mayne_spt` | R+N | E / Pa = alpha N60. |
| `geotek/engine/correlations/stiffness.py:32` `e_robertson_cpt` | R+N | E' = alpha_E (q_t - sigma_v0), alpha_E = 0.015 * 10^(0.55 I_c + 1.68). |
| `geotek/engine/correlations/registry.py:29` `Correlation` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. |
| `geotek/engine/correlations/registry.py:49` `register` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/correlations/registry.py:75` `get` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/correlations/registry.py:82` `applicable` | R+N | Correlations for ``parameter`` whose required inputs are all available. |
| `geotek/engine/correlations/registry.py:99` `evaluate` | R+N | Evaluate one correlation at a point. Extra keys in ``inputs`` act as context for checks |
| `geotek/engine/correlations/registry.py:124` `evaluate_all` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/correlations/registry.py:130` `combine` | R+S | Mean of several correlation results, with min/mean/max spread. |
| `geotek/engine/correlations/checks.py:13` `sand_like` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/correlations/checks.py:20` `clay_like` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/correlations/checks.py:27` `in_range` | R+N | Warn when input or option ``name`` lies outside [low, high]. |
| `geotek/engine/correlations/checks.py:43` `all_of` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/correlations/strength.py:22` `phi_kulhawy_mayne_spt` | R+N | phi' = atan[(N60 / (12.2 + 20.3 sigma'_v0/Pa))^0.34]. |
| `geotek/engine/correlations/strength.py:35` `phi_hatanaka_uchida` | R+N | phi' = sqrt(20 (N1)60) + 20. |
| `geotek/engine/correlations/strength.py:48` `phi_peck_wolff` | R+N | phi' = 27.1 + 0.3 (N1)60 - 0.00054 (N1)60^2. |
| `geotek/engine/correlations/strength.py:64` `phi_robertson_campanella` | R+N | tan phi' = (1/2.68) [log(q_c / sigma'_v0) + 0.29]. |
| `geotek/engine/correlations/strength.py:77` `phi_kulhawy_mayne_cpt` | R+N | phi' = 17.6 + 11.0 log[(q_t/Pa) / (sigma'_v0/Pa)^0.5]. |
| `geotek/engine/correlations/strength.py:93` `phi_from_pi` | R+N | sin phi' = 0.8 - 0.094 ln(PI). |
| `geotek/engine/correlations/strength.py:110` `su_nkt` | R+N | s_u = (q_t - sigma_v0) / N_kt. |
| `geotek/engine/correlations/strength.py:124` `su_ndu` | R+N | s_u = (u2 - u0) / N_du. |
| `geotek/engine/correlations/strength.py:138` `su_stroud` | R+N | s_u = f1 N60. |
| `geotek/engine/correlations/strength.py:151` `su_hara` | R+N | s_u = 29 N60^0.72 [kPa]. |
| `geotek/engine/correlations/physical.py:29` `rc2010_below_floor` | R+N | True where the raw Robertson & Cabal estimate is finite and below GAMMA_MIN_RC2010. |
| `geotek/engine/correlations/physical.py:51` `unit_weight_robertson_cabal` | R+N | gamma / gamma_w = 0.27 log R_f + 0.36 log(q_t/Pa) + 1.236, R_f = f_s/q_t * 100 [%], |
| `geotek/engine/correlations/physical.py:67` `dr_skempton` | R+N | D_r = sqrt((N1)60 / C_d), in percent. |
| `geotek/engine/correlations/physical.py:81` `sigma_p_mayne` | R+N | sigma'_p = k (q_t - sigma_v0). |
| `geotek/engine/correlations/physical.py:95` `fines_content_from_ic` | R+N | FC = 80 (I_c + C_FC) - 137, limited to 0-100 %. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:27` `stress_reduction` | R+N | r_d = exp[alpha(z) + beta(z) M]; NaN below 34 m. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:35` `msf_max` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:41` `magnitude_scaling` | R+N | MSF = 1 + (MSF_max - 1)(8.64 exp(-M/4) - 1.325). |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:46` `c_sigma` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:57` `overburden_factor` | R+N | K_sigma = 1 - C_sigma ln(sigma'_v0 / Pa) <= 1.1. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:68` `delta_n_fines` | R+N | Delta(N1)60 = exp[1.63 + 9.7/(FC + 0.01) - (15.7/(FC + 0.01))^2]. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:74` `crr75_spt` | R+N | CRR(M=7.5, 1 atm) = exp[N/14.1 + (N/126)^2 - (N/23.6)^3 + (N/25.4)^4 - 2.8]. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:80` `spt_resistance` | R+N | Iterative (N1)60cs with C_N = (Pa/sigma')^m, m = 0.784 - 0.0768 sqrt((N1)60cs). |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:106` `delta_qc1n_fines` | R+N | Delta q_c1N = (11.9 + q_c1N/14.6) exp[1.63 - 9.7/(FC + 2) - (15.7/(FC + 2))^2]. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:112` `crr75_cpt` | R+N | CRR(M=7.5, 1 atm) = exp[q/113 + (q/1000)^2 - (q/140)^3 + (q/137)^4 - 2.8]. |
| `geotek/engine/liquefaction/boulanger_idriss2014.py:118` `cpt_resistance` | R+N | Iterative q_c1Ncs with m = 1.338 - 0.249 q_c1Ncs^0.264 (q_c1Ncs limited to 21-254). |
| `geotek/engine/liquefaction/common.py:34` `cyclic_stress_ratio` | R+N | CSR = 0.65 (a_max/g) (sigma_v0 / sigma'_v0) r_d (Seed & Idriss 1971). |
| `geotek/engine/liquefaction/common.py:40` `seismic_stresses` | R+N | Stresses at the time of the earthquake. |
| `geotek/engine/liquefaction/common.py:57` `tributary_thickness` | R+N | Top and bottom of the interval represented by each test point (midpoint rule). |
| `geotek/engine/liquefaction/common.py:68` `liquefaction_potential_index` | R+N | LPI = integral over 0-20 m of F(z) w(z) dz (Iwasaki et al. 1978). |
| `geotek/engine/liquefaction/common.py:91` `lpi_category` | R+N | Iwasaki et al. (1982) categories. |
| `geotek/engine/liquefaction/common.py:103` `LiquefactionResult` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. |
| `geotek/engine/liquefaction/common.py:132` `LiquefactionResult.resistance_name` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/liquefaction/common.py:136` `LiquefactionResult.lpi` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/liquefaction/common.py:139` `LiquefactionResult.to_dataframe` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/liquefaction/common.py:150` `LiquefactionResult.summary` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/engine/liquefaction/common.py:163` `assign_status` | R+N | Status per point. Order of precedence: excluded, above GWT, beyond depth, clay-like, |
| `geotek/engine/liquefaction/youd2001.py:28` `stress_reduction` | R+N | r_d from Youd et al. (2001), Eq. (2), through 23 m. |
| `geotek/engine/liquefaction/youd2001.py:42` `magnitude_scaling` | R+N | MSF. 'idriss': 10^2.24 / M^2.56 (lower bound of the NCEER range); |
| `geotek/engine/liquefaction/youd2001.py:54` `overburden_factor` | R+N | K_sigma = (sigma'_v0 / Pa)^(f - 1), applied only for sigma'_v0 > Pa (K_sigma <= 1). |
| `geotek/engine/liquefaction/youd2001.py:69` `fines_correction_spt` | R+N | (N1)60cs = alpha + beta (N1)60 (Idriss & Seed, in Youd et al. 2001 eqs. 6-7). |
| `geotek/engine/liquefaction/youd2001.py:78` `crr75_spt` | R+N | CRR7.5 = 1/(34 - N) + N/135 + 50/(10N + 45)^2 - 1/200, for N = (N1)60cs < 30. |
| `geotek/engine/liquefaction/youd2001.py:86` `spt_resistance` | R+N | Returns ((N1)60cs, CRR7.5, dense mask). (N1)60 uses the Liao & Whitman C_N. |
| `geotek/engine/liquefaction/youd2001.py:110` `robertson_wride_ic` | R+N | Iterative I_c following Youd et al. (2001), Eqs. (14)-(17). |
| `geotek/engine/liquefaction/youd2001.py:129` `kc_factor` | R+N | Grain characteristic correction K_c from Youd et al. (2001), Eq. (19). |
| `geotek/engine/liquefaction/youd2001.py:143` `crr75_cpt` | R+N | CRR7.5 from q_c1Ncs (Robertson & Wride 1998); NaN for q_c1Ncs >= 160. |
| `geotek/engine/liquefaction/youd2001.py:150` `cpt_resistance` | R+N | Returns dict with qc1Ncs, CRR7.5, Ic, Kc, dense and clay-like masks. |
| `geotek/engine/liquefaction/analysis.py:88` `analyze_spt` | R+N | SPT-based triggering. |
| `geotek/engine/liquefaction/analysis.py:156` `analyze_cpt` | R+N | CPT-based triggering. |
| `geotek/services/parameters.py:68` `layer_points` | R+N | Process this layer's sources in ``[top, bottom)`` using the supplied profile. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/parameters.py:157` `evaluate_candidates` | R+N | One mean and depth spread per registry method, plus measured lab values. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/parameters.py:215` `suggest` | R+N | Prefer measurements, otherwise combine valid registry candidates only. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/parameters.py:258` `resolve` | R+S | Resolve an explicit choice, revoking any previous approval on the copy. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/parameters.py:333` `approve` | R+S | Atomically resolve/approve requested choices and validate the resulting layer. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/parameters.py:373` `basis_hash` | R+S | SHA-256 of bounds and the input multiset; ordering/bookkeeping do not matter. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/parameters.py:383` `refresh_profile` | R+N | Return refreshed candidates and suggestions without modifying project/design. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/layering.py:13` `propose_layers` | R+S | Process using Module 1, then propose without modifying the project. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:29` `LiquefactionSettings` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:43` `Module1Results` | R; veri taşıyıcı | Alanlar ve taşınan birimler incelendi. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:52` `active_profile` | R+S | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:56` `spt_fc_pi` | R+S | FC and PI per SPT record from the nearest lab sample within ``LAB_MATCH_TOL``. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:85` `process_investigations` | R+S | Correct SPT records and normalise CPT soundings. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:114` `liquefaction_input_hash` | R+S | Hash the project inputs of a liquefaction run, including the profile selection. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:130` `liquefaction_result_state` | R+S | State of the liquefaction result stored in the project against its current inputs. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/services/module1.py:148` `run_liquefaction` | R+S | Process (if needed) and run the selected triggering method for every sounding. Sayısal yöntemler delegasyonla; onay/hash tüm durumları burada yeniden test edilmedi. |
| `geotek/io/tabular.py:51` `read_table` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |
| `geotek/io/tabular.py:72` `map_columns` | R+N | Return {canonical name: column header} for the required and found optional columns. |
| `geotek/io/tabular.py:97` `import_cpt` | R+N | Read a CPT(u) table; qc/fs/u2 are converted to kPa, depth to m. |
| `geotek/io/tabular.py:150` `import_spt` | R+N | Kayıt, doğrulama veya servis bağlantısı; yeni bir ampirik denklem yok. |

## İncelenmeyen / sınırlandırılmış işler

- Özgün yayınların madde/sayfa metni ve katsayıların tarihsel transkripsiyonu kaynak doğrulaması değildir; erişilmedi. Kod atıfları yalnız iddia olarak kaydedildi.
- 128publicsimgenin tüm kombinatoryal dalları için yeni test yok; servis hash/onay, rendering ve bütün uyarı kombinasyonlarında mevcut testler okundu. İlgili sayısal hesaplar N etiketleriyle ayrıldı.
- xls/xlsx yeni bağımsız dosyası üretilmedi; CSV/metric/US feet/refusal test edildi. Tüm ithal edilen dış dosyaların gerçek dünyadaki veri kalitesi genellenmedi.
- Gerçek tarayıcı ekranı/SVG piksel çıktısı incelenmedi; figürlerin kaynak fonksiyonları ve sayısal koordinatları incelendi. U-line dikey uç parçası ve sqrt makine epsilon adayı bulgu olarak temizlendi.
- Geoteknik belirsizliğin istatistiksel dağılımı, saha kalibrasyonu, tasarım güvenlik katsayılarının mevzuata uygun seçimi veya zemin parametresi mühendis onayının saha uygunluğu bu hesap kontrolünden çıkarsanamaz.
- Design code ve diğer taşıma/istinat/stabilite modülleri B/C ajanlarının kapsamıdır.

## Çıktı dosyaları

[independent_audit.py](2026-10-22-inceleme-kanitlari/engineering-a/independent_audit.py) (yeniden üretilebilir bağımsız denetim), [results.json](2026-10-22-inceleme-kanitlari/engineering-a/results.json) (bütün karşılaştırmalar, domain gözlemleri,128simge ve16registrykaydının metadata'sı), [run-output.txt](2026-10-22-inceleme-kanitlari/engineering-a/run-output.txt) (gerçek son koşu konsolu), `report.md` (bu rapor), [si_cpt.csv](2026-10-22-inceleme-kanitlari/engineering-a/si_cpt.csv), [unknown_unit.csv](2026-10-22-inceleme-kanitlari/engineering-a/unknown_unit.csv), [spt.csv](2026-10-22-inceleme-kanitlari/engineering-a/spt.csv) (en küçük IO tekrar girdileri).

## Ek — engineering-b yöntem ve kapsam envanteri

## Her public yöntem ve varyantın inceleme matrisi

Etiketler: **K-I** knowledge tabanlı bağımsız sayısal karşılaştırma; **K-R** knowledge/kod okuması, bağımsız sayısal doğrulama yok; **P** yalnız üretim replay; **Açık** çalıştırılmadı/doğrulanmadı. Hiçbir satır birincil source-verified değildir. Kesin tanımlar/imzalar/satırlar ve dosya SHA256'ları [inventory.json](2026-10-22-inceleme-kanitlari/engineering-b/inventory.json) içindedir.

| Public yöntem / varyant | Varsayım ve geçerlilik | Nominal kontrol | Sınır / açık durum |
|---|---|---|---|
| surcharge_per_horizontal horizontal/inclined | düşey q; alan temeli yatay/eğimli; inclined q/cosβ | K-I q10 β10 | beta0 yanlış basis kabulü B007; cosβ→0 ve sonlu q guard eksik K-R |
| rankine_ka β0/β≠0 | düşey düzlem, c=0 katsayı; eğik bileşke yüzeye paralel; β≤φ | K-I φ0/20/30/40, β0/10/φ | β=φ radikand0; negatif β'nin abs(β)>φ sınırı ve NaN B007 |
| rankine_kp β0/β≠0 | aynı geometri; pasif mobilizasyon | K-I aynı grid | φ0 Kp1; beta>phi reddi kodda; negatif büyük beta domain açık/ham error |
| coulomb_ka | düz kama, φ−β≥0, pozitif fiziksel kosinüsler | K-I bağımsız kuvvet dengesi, θ5 β8 δ10 | sonlu/delta≤phi/degenerate θ guard eksik B007 |
| coulomb_kp | düz kama; yüksek δ için aşırı pasif üst sınır | K-I compressive R/P domainli bağımsız pasif optimum | root≥1 reddi; δ>φ/2 yalnız dokümante; yatay izdüşüm B003 |
| seismic_angle | ψ=atan(kh/(1−kv)); kv<1 | K-I kh.2 | kv=1 açık hata; negatif kh/NaN sözleşmesi eksik |
| mononobe_okabe_kae | pseudo-static, φ−β−ψ≥0; total multiplier1−kv | K-I kuvvet dengesi kh.12 kv.06 | β→φ−ψ±1e−6 test; üstünde SlopeError; φ0/ψ0 limit okunup Rankine ile örtüşür |
| tbdy_kae_steep | cos(δ+θ+ψ)>0; β'dan bağımsız kapalı dal | K-I trigonometrik kapalı form, β-sınırındaki form | mevzuat dalının gerçek madde/girdi sınıfı Açık; B001 bunun alternatifi diye fiziksel doğrulanmaz |
| mononobe_okabe_kpe | pasif düz kama, arg≥0/root<1 | K-I bağımsız pasif denge kh.12 kv.06 | yüksek δ aşırı pasif bilinen sınırlama; tüm arg/kosinüs tekillikleri Açık |
| seed_whitman_dkae | yaklaşık ΔK=.75kh; ~.6H uygulama noktası çağırıcıda | K-I .2→.15 | negatif kh kabul; .6H uygunluk aralığı özgün kaynaktan Açık |
| tbdy_seismic_coefficients | kh=.4Sds/r,kv=.5kh; Sds,r>0 | K-I Sds1,r2→(.2,.1) | NaN kabul; r tablosu/yer değiştirme ve pore-pressure şartları source Açık |
| seismic_coefficient | kh=displacement_factor*Fpga*PGA | K-I .4,1.2,.5→.24 | factor(0,1] guard; PGA/Fpga/sonluluk K-R; yükseklik azaltması yok |
| PressureDistribution.component effective/water | kendi parça doğrusal diagramının kuvvet/moment integrali | K-I sekiz dağılımda F_eff+F_water=F | yanlış which suya düşer K-R; sıfır kuvvet centroid NaN tanımlı |
| resultant | sıralı eş uzunluklu z,p, jumps için aynı z yinelenebilir | K-I katman/su/crack/min-floor integralleri | azalan/mismatch/NaN diziler B007; genel negatif diagram sözleşmesi Açık |
| lateral_pressure aktif Rankine | drained c′; βc birlikte varsayılan hata/ignore uyarısı | K-I kuru/su/katman/crack/floor; β10 cignore | βφ geçerlilik guard; minEFp kesişimi bağımsız doğrulandı |
| lateral_pressure pasif Rankine / excavated top | başlangıçüstü overburden kaldırılır, su top altında resetlenir | K-I top2 H4 katman+su | GWT/katman arayüzü; negatif height/top guard; bütün ara katman boşlukları model katmanının görevi |
| lateral_pressure at_rest | Jaky NC K0=1−sinφ; yatay dolgu, cohesion yok | K-I kuru+su | eğik zemin reddi çalıştı; OCR/overconsolidation yok, Açık tasarım kapsamı |
| lateral_pressure Coulomb active/static/seismic | c′ uyarıyla yok sayılır; θ/kh/kv yalnız Coulomb | K-I delta_ratio=.5; submerged kh dry.1/wet.2; steep_TBDY | B005 θβq çarpanı; su inertiası dışarıda; δ_ratio domain guard Açık |
| lateral_pressure Coulomb passive | deprem pasif dağılım desteklenmiyor; δ>φ/2 uyarısı | K-I genel pasif katsayı+denge | B003 θ≠0 projeksiyon; θ0 mevcut duvar yolu uyumlu |
| lateral_pressure log_spiral | yalnız yatay zemin/pasif; c ignore; delta min(phi) | K-R adapter+K-I bağımsız log mekanizması | active/beta reddi çalıştı; delta>phi sessiz kırpma source/doğru API kararı Açık |
| lateral_pressure undrained/layerwise | total stress K1,su, su bileşeni0; su/deprem+slope unsupported | K-I saf total stress ve mixed-drainage/interface+total_stress_surcharge7 | undrained beta/seismic reddi çalıştı; tüm mix-state kombinasyonları Açık |
| trial_wedge active/passive/static/seismic/q | kohezyonsuz planar, q yatay alan, uniformsonsuz dolgu | K-I nominal bağımsız yön açıları/kuvvetler ve normalize residual | B001 üst eğim; invalid state B007; optimum global kanıtı yok |
| log_spiral_kp | 0<φ<60,0≤δ≤φ, dik yüz/yatay zemin; H,γ scale | K-I φ20/30/40 δ0/10/φ; analytic quadrature; H7γ19 scale | φ0 bilinçli reddedilir; invalid Hγ reddi mekanizma hatası; finite pole aralığı tüm φδ için global kanıt değil |
| bearing_factors Meyerhof/Hansen/Vesic | 0≤φ<50; Ng üç farklı ampirik ifade | K-I φ0/20/30/40 üç yöntem | B006 küçükφ; unknownmethodφ0 B007; φ50 guard okunup mevcut testlerde |
| bearing_capacity Meyerhof drained/φ0 | effective B′L′; depth gerçekB; H B yönünde; φ>10 sq/sg dalı | K-I stripφ0/30 ve rectangle+depth+inclination | B′→0+ ve0; φ10 eşikformu K-R; D/B>1 uyarı K-R; exponents yok |
| bearing_capacity Hansen drained | scNq/Nc,sq sinφ,sg; dc1+.4k; α1α2 varsayılan5 | K-I rectangle B2L4D.5 c10φ30V500H100 ve strip | α kullanıcı aralığı/özgünsource Açık; genel aşırıH negatif ic guard B007 |
| bearing_capacity Vesic drained | sq tanφ,m=(2+r)/(1+r); dc/dq ilişki | K-I aynı rectangle/strip/inclination | B′→0, negativeH, excessiveH B007; H yönü B/L swap sonrası yeniden yorumlanmıyor K-R |
| bearing_capacity Hansen/Vesic undrained | Nc5.14, Hansen additive, Vesic product; c=su | K-I φ0 yüzey strip; VesicD1 eğitim326.4 | H>0 alt dallar kod okundu, bağımsız ultimate capacity benchmark Açık; guard belge farkı B009 |
| SlopeModel.__post_init__ ve veri sınıfları | x strictly increasing; bands top descending; ilk/son band yukarı/aşağı uzar | K-R veri düzeni; K-I weight/band/load kullanım kontrolü | boş/nonfinite/neg gamma B007; tek nokta/çift band top guard eksik K-R |
| SlopeModel.descends_toward_positive_x | yalnız yüzey ilk-son kotu yönü | K-R ters eğim existing test sözleşmesi | karmaşık çok tepeli yüzeyin yönü Açık; bu özellik her olası ters local yüzeyi saptamaz |
| SlopeModel.surface_y | lineer enterpolasyon, uçta sabit uzatma np.interp | K-I bağımsız line-circle geometrisi içinde | yüzey kırığında adaptive integration yok; uniform probe B004 |
| SlopeModel.band_at | taban kotu hangi banddaysa cφ oradan | K-I iki katmanlı bağımsız solver+arayüz | duplicate top/NaN guard yok; tam sınır alt band kabul sözleşmesi K-R |
| SlopeModel.column_weight | γ katman kalınlıkları ayrı toplanır | K-I γ10/30 bağımsız kolon kütlesi | suya göre γ otomatik değişmez; kullanıcı γ gerekli; centroid B002 |
| SlopeModel.load_at | sınırlı aralıkta lineer q, çakışanlar toplanır | K-I q40 ve wall footprint integralleri | x1>x2 sessiz yok sayılır K-R; negatif/nonfinite load guard eksik |
| bishop sabit daire/statik | simplified Bishop; sadece moment ve dilim düşey dengesi, interslice shear0 | K-I φ0 closed FS=3π/20; φ20 kuru/su, n40/80/160 | normalize residual≤6.85e−8; None invalid/nonconverged; yatay dengeyi tam sağlamaz |
| bishop sismik/katman/yük | kh yatay inertia; water hydrostatic, negatif W−ub0'a kırpılır | K-I homojen seismic; layered+load B002 | FS≈1 yanlıştaraf B002; ponding/dynamic porewater/tensioncrack yok; doğrudan unsupported wet şartları reddedilmiyor |
| search_critical_circle grid/refine | n15×15×12 başlangıç, NelderMead refinement | K-I seçilen eğitim dairelerinin ayrı FS çözümü; P arama sayıları | global minimum kanıtı yok; refine yalnız tangent aralığında, x/y başlangıç aralığını korumaz K-R; B004 geometrik aday hatası |
| wall_global_stability gravity/cantilever | duvar+taşıdığı soil footprint'e çevrilir; earth thrust iç kuvvet; backfill üst/foundation alt; tangent<0 | K-I gravity weight240/moment300 ve üç footprint eksantrisitesi; gerçek global search B004 | cantilever, retained_bands strength/factors/footprint_factors tüm varyantlar K-R; bağımsız global continuum kıyas Açık; kv ve tasarımda slice unitweight factors yok (kodda açık) |

## Eğitim ve şekil kapsaması

[inventory.json](2026-10-22-inceleme-kanitlari/engineering-b/inventory.json) 9 içerik dosyasını, 32 formül bloğunu, 15 worked bloğunu, 34 şekil kullanımını/30 benzersiz ID'yi ve bütün ID→component eşleştirmesini listeler. Eşlenmeyen ID yok. İnceleme statik TS/TSX formül, sayılar, birimler ve şekil geometrisi incelemesidir; tarayıcıda bütün şekillerin render/screenshot/erişilebilirlik kontrolü yapılmadı. Şekil konumları schematic ise hassas piksel değerinden sayısal mühendislik sonucu çıkarılmadı.

| İçerik | Sayısal/şekil durumu | Açık/ilgili bulgu |
|---|---|---|
| earth_pressure.ts + ep_student_a.ts | Rankine Mohr circle φ30: σa33.333/σv100/σp300 ve teğetlik doğru; active surcharge H5γ18q10: P91.6667,z3.181818 bağımsız; cohesive c10φ20H6 crack1.5868/P85.9404 formülü uyumlu; layered water figura54→84.57kPa,+u29.43,φ24 K≈.423 sayıları kontrol edildi | aktif/pasif hareket eğrileri açıkça schematic; çatlak suyu örneği12.35 kN/m kodda yok diye açık; tüm katman geometrilerinin render kontrolü Açık |
| ep_student_b.ts | Coulomb/M-O/kama/logspiral açıklamaları ve nominal katsayılar bağımsız dengeyle kıyaslandı; gravity wall worked kuvvet/combination ayrıntısı C ajanının kapsamıdır | B001 açıklamada hâlâ 'genelleştirilmiş çözüm çalışır'; direct coulomb_kp uyarı iddiası B009; wall stability/current code factor mevzuat onayı Açık |
| bearing.ts + bearing_student.ts | Nc/Nq/Ng tablo formülleri bağımsız; φ30 değer30.14/18.40/22.40,15.07,15.67 basamak çözünürlüğünde doğru; B2D1Vesic q782.27247,Q1564.54494; undrained326.4/Q652.8 doğru; effective width/water-case diagramları doğru kapsam varsayımıyla okunur | B009 H guard; φ0 Vesic d_c limit1+2k/Nc ile exact0dal1+.4k farkı metinde açık 'doğrulanmalı' ve knowledge suggestion; hiçbirincil doğrulama yapılmadı. Lokal/delme için kapasitenin 'muhafazakâr olabilir' ifadesi fazla geneldir; source Açık |
| slope.ts + slope_student.ts | 3π/20 sabit daire independent; eğitimn4/20/40 arama replay2.0288319/2.1595363/2.1625821 ve seçilen daire FS independent; water.91116365/kh.1 1.74384437 üretimde yenidenüretildi (published1.7440 son basamak farkı), wet ponding model varsayımı açık | B002/B004/B008/B009/B010; wetexample yüzey üstü su içerir ama ponding kuvvetleri modellenmiyor: fiziksel benchmark olarak sunulamaz. Critical/global optimum kanıtı değil |
| sloping_surcharge.ts + sloping_surcharge_student.ts | φ30β0/10/20 Ka=.333333/.349520/.414205; q alan dönüşümü doğru; steepφ30β25kh.2 kapalı katsayı.93320508; ilgili figures `sur-beta-regions`, `sur-surcharge-basis` formülleri/birimleri uyumlu | TBDY/KDYY özgün dağılım ve mevzuat atıfları doğrulanmadı. Sheetpile D0/Mmax worked sayıları C ajanına ait; burada kaynaktan doğrulanmış sayılmadı. B001 temel/katmanlı yol ayrılığı örnek diye geçiyor |

Şekil grupları: ep-active-passive, ep-rankine-diagram, ep-states-movement, ep-mohr-rankine, ep-cohesive-crack, ep-layered-water, ep-coulomb-wedge, ep-ka-phi, ep-seismic-wedge; bear-failure-wedge, bear-terzaghi-zones, bear-factor-trend, bear-factor-tables, bear-eccentric-width, bear-water-cases; slp-slip-circle, slope-bishop-slice/slp-bishop-slice, slope-search-domain/slp-search-results, slp-search-bounds, slp-reversed-geometry; sur-beta-wedge/slope-surcharge-wedge, sur-surcharge-basis, sur-beta-regions statik incelendi. Paylaşılan wall-stability-checks, ep-wall-forces, sur-sheet-moment ve sp-seismic-kdyy için B formül/birim bağlamını okudu; duvar/palplanş sayısal şekil denetimi bu raporun **engineering-c yöntem ve kapsam envanteri** ile [C envanterinde](2026-10-22-inceleme-kanitlari/engineering-c/inventory.json) yer alır.

## Bilinen sınırlar ve knowledge önerileri — kesin kusur diye sınıflandırılmadı

- Coulomb/M-O düz pasif yüksek δ ile fazla direnç verebilir; log-spiral yalnız dik yüz/yatay zemin/kohezyonsuz durumda. Caquot-Kerisel6.4 civarı chart iddiası özgün grafik görülmediğinden source doğrulaması değildir.
- Jaky normal konsolide/horizontal K0, yüzey/temel eğimi faktörleri olmayan bearing, kullanıcı seçimi Hansen α1/α2, φ0 Vesic dal süreksizliği ve Meyerhof φ10 dalı birincil kaynakla onay bekler. Kaynaksız katsayı değiştirme önerilmedi.
- Bishop'ta circle/normal-force admissibility, Mα>.2, F1 başlangıcı nedeniyle bazı düşükFS dairelerin reddi, 600 nokta kök çözünürlüğü ve refinenin x/y dışına çıkması sonuç uzayını sınırlar. Bulunan daire global optimum kanıtı değildir; Spencer/Morgenstern-Price veya noncircular sliding uygulanmadı.
- Hydrostatic pore pressure dışı su, ponding, seepage, dynamic pore pressure, liquefaction, çekme çatlağı ve dış su yüzeyi kuvvetleri modele eklenmedi. Wet education örneği yalnız kod tekrarıdır. No-convergence max_iter0, NaN/inf circle, negativeR,n_slices0 denemeleri None/explicit error olarak ayrı kaydedildi; hepsi düzgün mühendislik girdi mesajıyla reddedilmiyor.
- Bağımsız bütün cantilever/retained-band/factor variantlarının tam global FS benchmark'ı, her katman/ara yüzün exhaustive taraması ve bütün education figürlerinin render'i yapılmadı. Existing verification testlerinin bu inceleme sırasında birincil kaynakları açılmadı. Bunlar tamamlanmış doğrulama olarak işaretlenmedi.

Dosyalar: [reference_audit.py](2026-10-22-inceleme-kanitlari/engineering-b/reference_audit.py), [results.json](2026-10-22-inceleme-kanitlari/engineering-b/results.json), [run.log](2026-10-22-inceleme-kanitlari/engineering-b/run.log), [inventory.py](2026-10-22-inceleme-kanitlari/engineering-b/inventory.py), [inventory.json](2026-10-22-inceleme-kanitlari/engineering-b/inventory.json), [education_checks.py](2026-10-22-inceleme-kanitlari/engineering-b/education_checks.py), [education_checks.json](2026-10-22-inceleme-kanitlari/engineering-b/education_checks.json), `report.md`. Yeni üretim/test davranışı yok; mevcut on kusur/açıklama kaydı ve yukarıdaki açık doğrulamalar raporlandı.

## Ek — engineering-c yöntem ve kapsam envanteri

## Yöntem / variant kapsam matrisi

Durumlar: **N** bağımsız nominal sayısal karşılaştırma; **B** sınır/ret durumu gerçekten çalıştırıldı; **I** kod/varsayım akışı incelendi; **U** bu oturumda bağımsız sayısal veya kaynak doğrulaması yapılmadı. **K** bağımsız mühendislik bilgisi/denge; **S0** birincil kaynak yeniden görülmedi. Tabloda N bulunması tüm parametre alanının doğrulandığı anlamına gelmez.

| Yöntem / variant | Durum ve kanıt | Varsayım, geçerlilik ve açık sınır | Kaynak değerlendirmesi |
|---|---|---|---|
| Ağırlık duvarı, ASD, kuru, dik arka yüz | N: V360,H108,MR936,MO216,FSslide1.924500897,FSot4.333333333 tam uyum | 2B birimmetre, efektif taban, drenajlı; beton yapı elemanı hesabı yok | K,S0 |
| Konsol duvarı, ASD, kuru, düz dolgu | N: V300.6,MR673.74,H108,MO216 tam uyum | Taban+gövde+topuk üstü zemin ağırlıkları; toe-soil opsiyonu I | K,S0 |
| Katmanlı duvar, geri/ön YASS farklı | N: Coulomb efektifFx−73.064409,Fy−26.593270; suarka78.48,ön4.905; uplift98.1kN/m,x2.4m; pasif7.6425; hepsi uyum | Hidrostatik; ön eğik yüz suFy−2.4525 ve x1/6 doğru; sızma yok | K,S0 |
| Katmanlı farklıγ/φ, duvar zemin ağırlığı/basıncı | I; iki katmanlı palplanş N; çok tabakalı duvar tam bağımsız kuvvet örneği U | Katman atlamaları ve kırılma integralleri gözden geçirildi; bearing temel altı tek tabakaya indirgenir ve zayıf alt tabaka uyarır | K,S0 |
| Eğik dolgu / sürşarj / geri yüz geometrisi | I: basic trial-wedge q; layered q/[1+tanθtanβ] düzeltmesi mevcut; palplanş β10°,q20 N | Aktif Coulomb/Rankine; eğimli durumda c′ düşürülmesi görünür; wedge/earth-pressure katsayıları B ajanı kapsamında | K,S0 |
| Deprem, ±kv ve su geçirgenlik dalları | I: structure wall her kontrol için ±kv zarfı yapıyor; dinamik su, pervious/impervious/envelope katsayı akışı okundu; tüm dalların bağımsız N doğrulaması U | Tekli legacy wall fonksiyonu signed yükü çağıranın vermesini bekler. Hidrodinamik/sıvılaşma kapsamı ayrı | K,S0 |
| Ön pasif, statik/deprem, ASD/kısmi | N: statik su örneği; I: KPE/KP≤1, katman bazlı minimum, factor uygulama | Pasif yalnız sliding; denge momenti/bearing'e katılmaz; hareket mobilizasyonu ayrıca gerek | K,S0 |
| Kayma dişi toe/middle/heel, kuru | N: raw29.16,used14.58 kN/m; soil beside37.8,keyW7.2,extraH22.68; FSbase2.097990915 /deep1.900878933,üç konum uyum | İki yatay kayma düzleminin küçüğü; yapı kesme/eğilme talebi rawpasif; diş moment/bearing etkisi yalnız ağırlık | K,S0 |
| Kayma dişi su/uplift ve katmanlı/deprem | I: key-bottom uplift,extraV,deep-only forces,WA/EQ ayrımı incelendi; tam bağımsız çok dallı N örneği U | Temel seviyesi uplift ve diş tabanı artımı çift sayılmaması akışı görüldü; nicel tam doğrulama iddia edilmedi | K,S0 |
| Konsol palplanş, Blum tipi toe moment dengesi | N: kuru/su/sürşarj/eğim/pasifFS/uniform deprem ve iki katman; D0 hataları genelde<5.2e−7m | Toe point counter-force; varsayılanD1.2D0; diziler teorik toe'ya kadar. Kesin kaynak modeli S0 | K,S0 |
| Tek ankraj palplanş, free-earth | N: aynı6 dal+katman; T, D0 bağımsız dengeyle uyum | 0≤za<H; çok düşük za,no positive overturning stops B. 0.002m gridde anchor sıçraması trapez integrali M'de≈0.045–0.110kNm/m küçük hata üretir | K,S0 |
| Palplanş shear/moment/section | N: kuru H5 konsol M281.25kNm/m,z7.5; W=M/σ×1000 cm³/m | Moment maksimum grid hassasiyeti; allowstressNaN ENG-C-006. Ayak artış derinliğinde yeniden kuvvet analizi yapılmıyor, yaklaşık Blum modeli | K,S0 |
| KDYY toe-dependent deprem artımı | I: fixed-point≤60iter,1mm convergence; ASD farklı suyla kontrol sorunu N ENG-C-001 | 0.5ΔKadσ′v(toe) uniform+2qΔKad(1−z/toe); φ-katsayıları B ajanı; bu dağılımın kaynak onayı U | K,S0 |
| Çok ankraj kum zarfı, hinge | N: P390,p45,T120.625/126.875/115.416667,RB27.083333 | Uniform drained type; φ veγ kalınlık ortalaması; su yukarıdaysa stop B | K,S0 |
| Çok ankraj tributary | N: T112.5/135/121.40625,RB21.09375; ENG-C-003 | Yük dağıtımı ampirik; V/M hinge ile karışıyor. Nonpositivehinge düzeyi stop/tributaryalternatif I | K,S0 |
| Tek ankraj iksa free-earth/zarf yük-moment zarfı | N: H3/6/10,za0.2H/0.4H/0.55H,9 örnek | BüyükT veM ayrı seçilir. Ör.H6,za3.3: Mdesign92.020477 /verilen FE diyagramımax55.280531; `moment_from_envelope` varsayımı var. Bu muhafazakâr seçim **kendi başına bug sayılmadı**; diyagram yalnız FE modeli | K,S0 |
| Soldier-pile genişlik/üye dönüşümü | N: passivewidth1.5,pilespacing3 ⇒ratio0.5,D015.85414069 (actual15.85414054); Mmember=3M/m; Wcm³=1000Mmember/200=19151.59993 | Ankraj aralığı2.5m ile kazık aralığı3m karıştırılmıyor; T=Ths/cos20°,Tv/m=Th tan20° uyum | K,S0 |
| Sert kil Ns≤4, coefficient0.2–0.4, min3H² ve permanent drained envelope | N: c0.3,H8,γ17 ⇒p40.8,P258.4; c0.2 minimum dalı I; permanent lookup I | Kalıcıda φ eksikse stop; düşük toplam4H² uyarısı; rejim değişiminde süreklilik garanti edilmiyor | K,S0 |
| Yumuşak kil 4<Ns<5.14 | N: p29.92,P209.44; Ns4+ sınırı çalıştı | Ns,Su,b ile; üst0.25H rampa ve tabana kadar sabit; kil sürşarjı stop I/B | K,S0 |
| Henkel Ns≥5.14 | N: H8,γ17,Su=Su,b15,d4 ⇒Ka1.17131; 0.22floorI | d varsayılanB′; taban altı net direncin yetersiz olduğu kilde gömülme stop; zemin boyunca aynı drenaj tipi gerek | K,S0 |
| Basal heave iki mekanizma / Nc | N: H6,B10,γ17,Su20 ⇒FS1.098039; dar H10,B2,γ17,Su30 ⇒FS1.316471; shallow stiff layer/finiteL/permanent çalıştı | Nc grafik hücreleri repository'den envanter; grafikten bağımsız tekrar sayısallaştırılmadı. Kısa profil yalnız uyarır; görünmeyen zayıf tabaka dışlanamaz | K,S0 |
| Ankraj wedge/free length/clearance | N: H10,zh2,φ30,α20 ⇒x3.816755577,Lw4.061706448,Lfree6.092559671 | Düz yüzey/dik duvar; χnormal=max(1.5,0.2H), ekseneχ/sin(θ+α); minstrand4.5/bar3m görünür | K,S0 |
| Ankraj kök, directqu / πdτ, soil/rock | N: T266.044443,FS2,d0.15,τ150 ⇒Lb7.527517903; directqu/rock/minrelax dalları B/N | KapasitequLb/FS; soilmin4.5,rockstrand4.5/bar3; uzun kök tipi üst değer uyarı; saha testleri ve kaya eklemi etkisi ayrıca | K,S0 |
| Tendon strand-auto/user/bar-auto/library/custom | N: strandT445 ⇒3adet; barauto835kN; custom1000kN; basic T266 ⇒2strand ve table-notlisted warning | design0.6/lock0.7/test0.8 SMTS; minimum1; test1.33T; eksik requiredinputs stop B; bütün kütüphane kapasite satırları kaynakta yeniden kontrol U | K,S0 |
| Ankraj cover/spacing/inclination/relaxation | N/I: Tv/T/spacing açı dönüşümü; 0/negatif/NaN/inf kapsamlı B; minrelaxwarning | 4.5mcover bondcenter, spacing1.2m warning,inclination10–45°warning; gerilme ve tendon sayısı ayrı; test protokolünün kendisi modellenmiyor | K,S0 |
| Sonuçlar: load/material/resistance/favourable | N aşağıdaki birleşimler; I diğerleri | Same-action whole force tag mantığı mevcut; WA için tek kullanıcı factor var, bağımsız favourable/unfavourable su faktörü seçeneği yok. Bunun her proje için yeterliliği ayrıca mühendis kararı; burada hata kanıtı olarak sunulmadı | K,S0 |
| Global stability / bearing resistance formülleri | I çağrı ve controllingcase aktarımı | Temel formül denetimi basınç/taşıma/stabilite envanterindedir; yapı incelemesi bu fonksiyonların tümünü tekrar doğrulamamıştır | Bu raporun basınç/taşıma/stabilite envanteri |

## Yönetmelik ve her sayısal/null hücre envanteri

**134 hücrenin her biri** `results.json.code_inventory.<code>.cells[]` içinde path,value,source_claim ve “no current primary-source verification” değerlendirmesiyle saklandı: ASD16,EC7 61,TBDY29,AASHTO28. Bu toplam partial kombinasyonların `passive_participation` alanlarını da içerir. Anchor tablosunun9 tendon,17 transfer ve tüm min/max/guidance satırları `inventory.json.anchor_tables` içindedir. `inventory.json.python[].constants` ayrıca Ns4/5.14,0.65,0.22,3/4H²,0.25H,Ncchart ve bütün algoritma sabitlerini listeler.

| Code/set | Bağımsız sayısal uygulama | Null/eksik/sınır / açık kaynak durumu |
|---|---|---|
| ASD static wall | N globalFS/moment/force nominal; coefficientroutingI | OT2,slide1.5,bearing3,global1.5; e/Bsoil0.1667,rock0.25; tarihsel source labelssecondary/unverified,bu oturumS0 |
| ASD seismic wall | I globalFS slide1.1,bearing2,OT1.5,global1.1,e/Bsoil0.25/rock0.3333 | ±kv structurewall incelendi; bütün sayısal seismiccell bağımsız kaynak karşılaştırmasıU |
| ASD palplanş S/Q static/seismic | N S1.5 pressure/factor; Q2.0 dalroutingI; seismicS1.1/Q1.5 dosyada ama serviceASD staticFS1.5/2 seçimini bilerek koruyor | Statik daha büyükFS depremde kullanılması muhafazakâr; statik yük durumunu atması ENG-C-001. Historical verifiedstatus kaynak yeniden kontrolü değildir |
| EC7 DA1-C1 A1M1R1 | N D0expected5.668471137/actual5.668471302; wallsliding1.425556220 tam | G1.35/1,Q1.5/0,M1all1,R1all1; seismicblocked beklenen |
| EC7 DA1-C2 A2M2R1 | N D06.138701760/6.138701867; sliding1.254364956 tam | G1/1,Q1.3/0,M2tanφ1.25,c1.25,Su1.4,γ1; φ,δ on tan transformed, c/Su divided |
| EC7 DA2 A1M1R2 | N D07.327178969/7.327179048; sliding1.295960200 tam | Rbearing1.4,slide1.1,earth1.4,global1.1; force/resistance divisors doğru |
| EC7 DA3 A2M2R3 | N D06.138701760/6.138701867; sliding1.254364956 tam | Sadece geoteknikA2 branch ismi görünür; yapısalA1 ayrımı genel modelde yok, tamDA3yapısal bileşen iddiası yok |
| EC7 EQU | N bağımsızMR0.9 /MO1.1 veφd ⇒FS2.888602145; `branches.json.ec7_equ` | Gdst1.1,Gstb0.9,Qdst1.5,Qstb0,M2; katmanlıc/Su routingI; sourcecomments ikiOCR hücresini eksik derken geniş metadata verified,bu oturumS0 |
| EC7 seismic | B `limit_state_cases('ec7',seismic=True)` stops | EN1998-5 implemented değil; NaN/0 ile sessiz geçmiyor |
| TBDY-static | N explicit userunity missing factors; ENG-C-002 | G unfav/fav,Qunfav,tanφ,c,Su **null** kullanıcı girdisi gerektirir; Qfav0,γ1. R1.4/1.1/1.4,global1,OT1.3,passiveparticipation0.3; taşıyıcı varsayımlar I |
| TBDY-seismic | B nullmaterialtanφ'da stop; I G1/0.9,Q1/0,EQ1,Mnull; resistance same | Rdev1.3minimum ve tanδcap knowledge; otomatik null doldurulmadı. γoverride ignorewarningI; katsayılar “verified” etiketiyle yeniden kaynak doğrulanmış sayılmadı |
| AASHTO StrengthI | N D07.680920734/7.680920805; wallsliding0.923760431 tam | DC1.25/.9,EV1.35/1,EHactive1.5/.9,EHatrest1.35/.9,ES1.5/.75,LS1.75; bearing.55,slidecast.8,precast.9,passive.5,sheet.75,global.75/support.65. Yalnızcastslide/activeEH/sıradan global routes implemented; diğer hücreler envanter/uygulamaU |
| AASHTO ExtremeI | B case oluşuyor; I EQ1,LS.5,extremeRbearing1,slide1,passive1,global.9 | Permanent load min/max routing strengthile aynı; ayrıextremekuralının kaynak doğrulamasıU. LS.5 projevarsayımımetadata; birincilAASHTOmetniS0 |
| AASHTO e/B | I soilstrength.3333/extreme.40; rock.45/.45 envanter | `_lrfd_case` her zaman soil e_limit okuyor, `foundation_on='rock'` varyantı bu yolda seçilmiyor; daha darsoil limiti konservatif. NreproU,domainlimitation |
| WA runtimeextension | I partialeachcomboWA=None; LRFDkey yok,uservaluegelir; B finite nonnegativecontrol okunup doğrulandı | Su varken missingexplicitWA hesap durdurur; drywall'a otomatikG/EH inferenceyok. Yeni code.yaml hücresi değil;134 sayısına runtimeWA eklenmedi |

Yönetmelik `gamma` malzeme katsayısı config'de var ama motor uygulamıyor; service bunu `wall.warning.override_not_applied` ile gösteriyor. Böyle bir override'ı “uygulandı” saymadım. AASHTO precast/global-supporting-structure/e-at-rest tablolarını motorun desteklediği aktif/cast branch ile karıştırmadım.

## Bilinen yöntem sınırları ve doğrulanmayan alanlar

- Hiçbir yeni birincil PDF/standart sayfası bu oturumda görülmedi. Tarihsel `verified`,secondary veya page/table metinleri **kaynak iddiası** olarak korundu. K/S0 durumları sourceverifieda yükseltilmedi.
- GEC4 Nc grafiğinin tüm digitized hücreleri envanterlendi; 400dpi kaynak görüntüsü olmadığı için sayısallaştırmanın doğruluğu onaylanmadı. Aynı sınırlama tümqu/SMTS/minlength sourcecell'leri için geçerli.
- İksa görünür zarfı ampirik; tüm katmanlarda aynı drenaj tipi aranır. Yeraltı suyu kazı içine girerse, çok ankrajda eğim varsa, kil sürşarjı varsa kapsam dışı durur. Yalnız drained/undrained averages uygulamasını sayısal örnekle görmek, sert tabakalı genel zarfın bilimsel geçerliliğini kanıtlamaz.
- Basal heave profili B′ derinliğine erişmiyorsa motor uyarı verip bilinen kısmın minimumSu'sunu kullanır. Derindeki bilinmeyen zayıf tabaka için güvence verilemez; uyarı mevcut olduğu için bunu gizli kaynak/varsayım hatası olarak yazmadım.
- Ankrajlı iksada external/global stability, Kranz, ankraj grubu, duvar düşey yük taşıması ve deformasyon/EI çözümü yok; sonuçlar uyarıyor. Anchor kapasiteleri deneyle sahada doğrulanmalı; testload hesabı test protokolü uygulaması değildir.
- Tek ankrajın maxT vemaxM'sinin ayrı muhafazakâr seçimi bulundu ve varsayım mesajı var; bu bilinçli zarf, ENG-C-003'teki açıklanmayan tributary/hinge uyuşmazlığıyla aynı şey sayılmadı.
- Eğitimdeki doğrulanmış örnekler: H3 konsolD0≈2.77756,D≈3.33307,M60.75,z4.5; H3,za1 ankrajD0≈1.08225,T≈18.37013,M≈11.935; kumP390,p45; softclay29.92/209.44; dişekH24.68; φ0,α15,χ2 içineksenclearance2.309401. Sayılar bağımsız hesabın yuvarlama düzeyinde tutarlı; ENG-C-005 şekil/parametre uyuşmazlıkları ayrı.
- Bütün karekteristik/geometri/yük kombinasyonlarının exhaustive doğrulandığı iddiası yok. Her yöntem ve katsayı seti yukarıda N/B/I/U ayrımıyla kayda alındı; envanter kapsamı test kapsamından ayrıdır.


## Son belge ve kapsam denetimi

İki nihai belge tek bir son bağımsız denetimde kontrol edildi. Kritik bulgulardan geri çekilen yok; statik palplanş integrali, iki TBDY sürtünme oranı ve iki LPI kırpılmış integrali ayrı dar hesaplarla uyumlu bulundu. Altı temsilî ekran doğrudan incelendi. Kaynak/onay akışı, eğitim gezinmesi, mobil öncelik, tablo biçimi ve tekrar komutlarının arşiv kanıtını korumasına ilişkin belge düzeltmeleri uygulandı. Bu son kontrol yeni birincil standart/PDF doğrulaması veya mevcut test paketlerinin yeniden çalıştırılması değildir. Kanıt: [son denetim raporu](2026-10-22-inceleme-kanitlari/final-review/report.md), [dar hesap sonuçları](2026-10-22-inceleme-kanitlari/final-review/checks.json).
