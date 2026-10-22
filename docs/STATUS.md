# GeoTek — güncel durum ve tek iş sırası

Son güncelleme: 2026-10-22 (uygulamalı inceleme ve kullanıcı deneyimi raporları). Bu sayfa **tek güncel durum kaynağıdır**;
ayrıntılı geçmiş Git günlüğünde ve birleşmiş PR'lardadır. Son kontrol raporu: [sistem kontrolü](qa/sistem-kontrolu.md).

## Aktif iş

Compact veya devir öncesi yalnız bu üç satır güncellenir (kural: [WORKFLOW](WORKFLOW.md#bağlam-ve-compact-kuralı)).

- Biten: 2026-10-22 GPT incelemesinin [değerlendirmesi](audit/2026-10-22-inceleme-degerlendirmesi.md) ve düzeltmeleri: ASD palplanş statik+deprem zarfı, TBDY tanδ_b ≤ 0,6 (karakteristik değere), sismik Bishop ağırlık merkezi, daire taraması, pasif izdüşüm, ankraj v_max, LPI (GWT kırpma, DTO/ekran/rapor), içe alma/korelasyon geçerliliği, kil tabakada kum bağıntısı, üst Kaydet taslak kaybı, DOCX yapı esası, eğitim şekilleri. Bağımsız Opus incelemesi 4 kusur buldu, düzeltildi, ikinci kontrol geçti. 2026-10-22 testleri: pytest 2068 geçti / 2 atlandı; web 382 geçti; typecheck, build ve kod haritası kontrolü başarılı.
- Sıradaki: hedef adım 2 (modüler yapı ve yeni modül eklenebilirliği), ardından adım 3 [K1](tasks/K1.md) exe üretimi.
- Açık karar: yok. CPT γ alt sınırı (R&C 2010, 12 kN/m³) ve `predrill_depth` dışlama Umut onayıyla, profilsiz CPT q_t ≤ 0 için en yakın γ koordinatör kararıyla uygulandı (2026-10-20).

## Koddan doğrulanan durum

| Alan | Şu an |
|---|---|
| Çekirdek | Başlangıç, kütüphane, proje/oturum, modül keşfi, işler, katsayılar ve birleşik i18n API. |
| Veri | `.gtk` şeması 1.3; eski sürüm göçleri, yapı zemin kopyası, stale/hash kontrolleri. NaN/Infinity içeren dosya reddedilir. |
| Zemin | CPT/SPT işleme, otomatik katmanlama, parametre aday/seçim/onay, sınıflandırma (SBTn + USCS) web akışı. |
| Duvar | Katmanlı motor, öner/kontrol, iş takibi/iptal, analiz seçenekleri, sonuç kartları, SVG kesit. |
| Sıvılaşma | Motor/API, iş takibi, kayıtlı sonuç, GS ve CSR/CRR grafikleri, ayrıntı tablosu. |
| Palplanş | Motor/API, oluşturma, tasarım işi, sonuç paneli, çevrilebilir uyarı/varsayım kodları. |
| Ankraj | `anchored_wall` modülü: ankraj tasarımı (GEC-4), tek/çok seviyeli ankrajlı duvar analizi (GEC-4 trapez/Henkel zarfları, kilde taban kabarması), web iki sayfa, rapor bölümleri. Kayma dişi (G3/G4) bekliyor. Kabul: [G8-kabul](qa/G8-kabul.md); mühendislik kontrolü 2026-10-21: [ankraj-muhendislik-kontrolu](qa/ankraj-muhendislik-kontrolu.md). Dış stabilite/Kranz yok (zorunlu uyarı). |
| Rapor | docx (`POST /api/m/report/docx`); PDF ve grafik yok. |
| Paket | `geotek/launcher.py` (API + `web/dist`, tarayıcıyı açar), `tools/build_exe.ps1` ve `.github/workflows/build-exe.yml` (windows-latest, PyInstaller, artifact `GeoTek-windows-exe`). Arayüz yalnız web; PySide6 yolu kaldırıldı. |

Kabul kanıtı: gerçek API uçtan uca [T10-kabul](qa/T10-kabul.md) (61 adım), görsel [T11-gorsel](qa/T11-gorsel.md) (128 ekran).

## İş sırası

| Sıra | Kart | Kapsam |
|---|---|---|
| 1 | Hedef adım 2 | Modüler yapı doğrulaması: `tools/new_module.py`, [MODULE_GUIDE](MODULE_GUIDE.md), exe sonrası modül ekleme. |
| 2 | [K1](tasks/K1.md) | Yerel başlatıcı + exe (hedef adım 3). |
| Açık | [T9b](tasks/T9b-PILE-SOIL.md) | Palplanş zemin Y2/Y4, mühendislik kararı bekliyor. |
| Açık | [T10b](tasks/T10b-POLISH.md) | Sıvılaşma/rapor cilası, duvar varsayımlarının TR/EN kodları. |
| Açık | [T12](tasks/T12-MATERIAL-FACTORS.md) | Kullanılmayan katsayılar (malzeme γ, kaya eksantrisitesi), S4. |

Paralel çalışmada en çok iki bağımsız yazıcı. Ortak dosya ihtiyacı varsa şef önce sözleşmeyi netleştirir.

## Onaylar ve mühendislik sınırları

- Tarihsel kayıtta P1, E4/kapı 2 ve yapı Y1/Y2 onaylı. Bunları yeniden açma.
- Görsel kapı 3 (F1/zemin) ve kapı 4 (F3/F4) için açık insan kabul kaydı yok; T11 görsel kontrolü Claude
  incelemesidir. Umut'un 2026-10-20 hedef planı (kontrol → modülerlik → exe) bu kapıların yerine geçti
  (koordinatör kaydı); kodun main'e birleşmesi insan kabulünün yerine geçmez.
- Paketleme öncesi kullanıcı onayı: Umut'un hedef planının 3. adımı exe üretimini istiyor.
- Su altı deprem, ±kv zarfı, uplift moment ve YASS taşıma gücü kararları için
  [E4 formül kaydı](contracts/E4_FORMULAS.md) ve [araştırma](research/submerged_seismic_thrust.md).
- `delta_base` önerisi gerçek `phi_cv` alanı bulunmadığından `phi_cv_assumed_equal_phi_eff` uyarısı taşır.
- LS extreme_I 0.50 proje varsayımıdır; duvar sonucunda görünür varsayım + uyarı (`wall.ls_extreme_i`).
- Yönetmelik kaynak doğrulama açıkları: [katsayı doğrulama listesi](katsayi_dogrulama.md).
  Eski notta okunamadığı belirtilen KDYY belgelerinin doğrulandığını varsayma.

## T3a-FIX etki notu (2026-10-20)

`youd2001.py` CPT yolu Youd 2001 metnine hizalandı: Q'da net qc, ara üs 0.7 (eski 0.75), Kc yalnız Ic'ye bağlı (F<0.5 kısayolu kaldırıldı). qc1N brüt qc ile kalır. SPT değişmedi.
Etki (σv=100, σ'v=60 kPa, bağımsız denklem hesabı; FS = CRR·MSF·Kσ/CSR olduğundan FS, CRR7.5 ile aynı oranda değişir):
kum (qc 10000) CRR 0.276→0.276 (0%); siltli kum (4000/60) 0.154→0.157 (+2%); kil (800) değişmez; Ic≈2.56 ara bölge (900/5) 0.084→0.087 (+3%); düşük-F siltli kum (2000/5, F<0.5) 0.071→0.085 (+18%, kısayol kalktığı için Kc 1→1.62). Etki yalnız Ic>1.64 ara/siltli CPT katmanlarında; temiz kum değişmez.
Test 2026-10-20: tam pytest 1688 geçti/1 atlandı; discrepancy 16 geçti; gen_code_map --check 0. Andrus-Stokoe üssü (madde 5) doğrulanmadı, kod değişmedi.
Not (T3a-FIX inceleme): Kc'deki F<0.5 kısayolu R&W 1998'de vardı, Youd 2001 Eq.19'da yok; çevre PDF metni doğrulanmadı, koordinatör kararıyla silinmiş kalır. Ic tanımsız (net qc<=0, fs<=0, σ'v<=0) noktalar NaN -> INVALID + uyarı; fs=0 artık "clay_like" değil INVALID (2026-10-20 sistem kontrolüyle BI2014 yolunda da: `normalise_iterative` fs<=0 noktayı I_c tanımsız sayar). Ic>2.6 noktalar mevcut sözleşmeyle CLAY_LIKE (FS atanmaz). σ'v>Pa için n=0.7 ara dalı ızgara taramasında ulaşılamadı (yalnız n=0.5/1).

## Youd 2001 makale kontrolü (2026-10-20, salt okuma, kod değişmedi)
Kaynak: Umut'un cihazındaki tam metin md dönüşümü (`docs/research/Youd.et.al.LiquefactionEvaluation.2001.ASCE.md`; telifli, git dışı, `.gitignore`). Denklemler dönüşümde çoğunlukla okunamıyor (Eq. 23/25/26 yok, Eq. 19 bozuk).
- F<0.5% / Kc=1.0 kısayolu: makalede **yok** ("0.5 %" ifadesi geçmiyor). Kc yalnız Ic'ye bağlı (md satır 306-314, Robertson & Wride 1998'e atıf); kısayol R&W 1998'e aittir. `youd2001.py` `kc_factor` (Ic<=1.64 -> 1.0, aksi halde polinom) makaleyle uyumlu; eski "doğrulanmadı" notu kapandı.
- MSF: makale tek üs önermez, aralık verir (md 498-500): M<7.5 için alt sınır Idriss (Tablo 3 sütun 3, Eq. 23), üst sınır Andrus-Stokoe (sütun 7, Eq. 26); M>7.5 için Idriss kullanılmalı (Eq. 25). Üslerin sayısal değerleri (−2.56 / −3.3) md'de okunamadı, PDF'ten doğrulanabilir. Kod: varsayılan `idriss`, `andrus_stokoe` (M/7.5)^-3.3; NCEER'in bilinen formülleriyle uyumlu.
- Koordinatör kararı: M>7.5'te `andrus_stokoe` engellenmez (Idriss'ten düşük, tutucu); seçilirse `liquefaction.warning.msf_andrus_stokoe_high_magnitude` uyarısı (TR/EN, testli) çıkar. Formül değişmedi.

## Son doğrulama

- 2026-10-20, sistem kontrolü dalı (Linux bulut): tam pytest 1869 geçti / 2 atlandı; `tsc --noEmit` temiz;
  Vitest 37 dosya / 337 test geçti; `npm run build` başarılı; `gen_code_map.py --check` 0.
  Windows `tools/project.py check full` bu ortamda çalıştırılamadı.
- 2026-10-20, modüler yapı kontrolü dalı (Linux bulut, kip: cloud): modül manifest'ine rapor bölümü kancası
  (`report_entries`/`report_writer`) ve `tools/pyinstaller_modules.py` (exe için hidden-import/add-data listesi) eklendi;
  rehber güncellendi. Tam pytest 1874 geçti / 2 atlandı; `tsc --noEmit` temiz; Vitest 37 dosya / 337 test geçti;
  `npm run build` başarılı; `gen_code_map.py --check` 0. Formül/katsayı değişmedi. Sıradaki: exe derlemesi (adım 3).
- 2026-10-20, G5 ankraj Faz A dalı (Linux bulut, kip: cloud): yeni `anchored_wall` modülü (manifest, `/api/m/anchored_wall`
  durum al/yaz, `POST /anchor/design`, `GET /anchor/reference`, durum `Project.modules` içinde, `state_version=1`, TR/EN, web iskeleti)
  ve `geotek/engine/anchors.py` ankraj tasarım motoru (serbest boy, kök boyu, tendon, tasarım/kilitleme/deneme yükü; GEC-4
  Tablo 6/8/9/10 kaynak etiketli). FS, q_u/τ_ult ve kilitleme oranı zorunlu girdi; eksikse 422 `missing_inputs`.
  El hesabı: GEC-4 Ek A Örnek 1 (T=445 kN, L_b=8.9 m, 3 halat / 32 mm çubuk) + bağımsız kama kesişim hesabı; iki salt okuma
  inceleme yapıldı, bulgular düzeltildi. Tam pytest 1933 geçti / 2 atlandı; `tsc --noEmit` temiz; Vitest 38 dosya / 339 test geçti;
  `npm run build` başarılı; `gen_code_map.py --check` 0; `pyinstaller_modules.py --check` 0. Sıradaki: G6 ankrajlı duvar analizi.
- 2026-10-21, G6 ankrajlı duvar analizi dalı (Linux bulut, kip: cloud): `geotek/engine/anchored_wall.py` ve `POST /api/m/anchored_wall/analysis/run`
  (durum `AnchoredWallState.analysis`, stale/hash, `state_version=1`). Tek seviye: `anchored_sheet_pile` ile aynı çözücü (birebir test);
  çok seviye: görünür basınç zarfı (kum 0,65 Ka γH, yumuşak kil γH−4Su, sert kil c·γH, 0,25H üst rampa), menteşe veya katkı alanı
  ankraj yükleri, taban reaksiyonu R_B ile taban altı moment dengesinden gömülme, soldier kazık pasif genişliği, M/W kontrolü,
  her seviye G5 ankraj tasarımına beslenir. β>0, karışık/ drenaj uyumsuz katmanlar, kazı içinde YASS, kil+sürşarj, menteşede çekme dışı yük:
  kodlu 422 `calculation_stopped`. Zarf şekilleri özgün Peck şekilleriyle değil ders notu özetiyle karşılaştırıldı (görünür varsayım).
  El hesabı 3 seviyeli kum (H=10, Ka=1/3: 131,625/102,375/107,25 kN/m, R_B 48,75) ve kil ordinatları; iki bağımsız salt okuma inceleme:
  işaret tutarsızlığı, negatif menteşe yükü, taban uç kesmesi, drenaj/katman uyumsuzluğu bulguları düzeltildi.
  Kapsam dışı: Kranz derin stabilite, aşamalı kazı, yaylı kiriş, sehim (EI saklanır, kullanılmaz), betonarme/çelik kesit tasarımı.
- 2026-10-21, G7 ankraj web arayüzü ve rapor dalı (Linux bulut, kip: cloud): `/m/anchored_wall` iki sayfa (ankrajlı duvar analizi, tek ankraj),
  proje zemin profilinden kopya (`GET /api/m/anchored_wall/soil/{profile_id}`, kaynak kimliği ve hash ile), seviye tablosu, GEC-4 referans
  değerleri yalnız öneri (Kullan düğmesi), eksik girdi listesi, kodlu durdurma/uyarı/varsayım çevirisi TR/EN, güncel/eski/sonuç yok rozeti,
  ölçekli kesit çizimi (serbest/kök boyu) ve moment/kesme grafikleri. Rapor: `anchored_wall:analysis` ve `anchored_wall:anchor` bölümleri
  (`report_entries`/`report_writer`, stale ise rapor reddedilir). Gerçek API ile elle gözle kontrol yapılmadı; ekran testleri mock üzerinde.
  Test (2026-10-21): pytest tam 1963 geçti (1 test sabiti güncellendikten sonra ilgili dosyalar yeniden koşuldu); Vitest 343 geçti; tsc ve `npm run build` başarılı; `gen_code_map.py --check` 0. Sıradaki: G8 entegrasyon.
- 2026-10-21, G8 kabul dalı (Linux bulut, kip: cloud): gerçek HTTP ile uçtan uca `docs/qa/g8_e2e.py` (duvar ve palplanş eğim+sürşarj iki tabanda,
  ankraj tasarımı, ankrajlı duvar tek/çok seviye, kodlu durdurma, docx TR/EN) 0 FAIL; ayrıntı [qa/G8-kabul.md](qa/G8-kabul.md).
  Düzeltme: ankraj zarf türü varsayım metninde ham kimlik (`sand`) görünüyordu, rapor ve web çeviriyor. Formül/katsayı değişmedi.
  Test: pytest tam 1963 geçti / 2 atlandı; tsc temiz; Vitest 38 dosya / 343 test geçti; `npm run build` başarılı;
  `gen_code_map.py --check` 0; `pyinstaller_modules.py --check` 0. Kayma dişi G3 (PR #21) birleşmedi, G4 başlamadı. Web ekranı gerçek API ile elle gözle kontrol edilmedi.

- 2026-10-21, kaynak karşılaştırması ([rapor](qa/kaynak-karsilastirmasi.md)): Umut'un `docs/research` kaynaklarıyla (EM 2502/2504, EN 1997-1, KDYY el kitabı, Peck, PTI) karşılaştırma. Kod: LPI ilk katman yüzeye uzatıldı (güvensiz eksik), palplanşta global-FS pasifi EM 2504'e göre tanφ′/c′ azaltması ile kuvvet bölmenin küçüğü (φ ≥ 35°), düz zeminde Bishop FS≈1e16 reddi; ec7.yaml birincil metinle doğrulandı. İki bağımsız salt okuma inceleme geçti. Açık: ince daneli Q durumu FS 2.0, KDYY düzgün deprem artımı, AASHTO 0.55/0.50, ters şev yön denetimi. Test sonucu PR açıklamasında.
- 2026-10-21, kaynak karşılaştırması 2. parça: ince daneli (drenajsız) palplanş pasifi FS 2.0 (EM 2504 Tablo 5-1) uygulandı. KDYY palplanş deprem dağılımı (üniform ½ΔK_ad σ′v(uç) + üçgen sürşarj, uç yinelemesi; Opus incelemesi geçti, tam test 2018 geçti) uygulandı; ters şev yön hatası (search_critical_circle) eklendi; ayrıntı [rapor §5](qa/kaynak-karsilastirmasi.md). Umut kaynak araştırmasını sonraya bıraktı.

Her kayıt tarih, kapsam ve gerçek sonuç taşır; eski sayı güncel başarı diye kullanılmaz.

## Çalışma alanları ve devir

- Ortak kaynak GitHub `main`; cihaz klasörü ve bulut kapsayıcıları çalışma kopyasıdır ([CLOUD_MODE](CLOUD_MODE.md)).
- Cihazdaki eski `Documents/geotek-wt/` worktree'lerinin silinmesi kararlaştırıldı; uygulandığı bu oturumdan doğrulanamadı.
- Claude Code Projects: [CLAUDE_PROJECTS.md](CLAUDE_PROJECTS.md), talimat [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md).
- Kod bulma: `code_map_target` → `code_map_read`; büyük CODE_MAP belgesi varsayılan bağlam değildir.
  Araç kurulum kanıtı: [2026-10-20 araç denetimi](audit/2026-10-20-projects-codemap.md).

Yalnız bu sayfayı güncelle: biten görev + kanıtı, sıradaki kart, açık karar ve test sonucu.
- 2026-10-20 (hedef adım 3): yerel başlatıcı + exe derleme hattı eklendi. Test: `tests/unit` 1031 geçti + `test_launcher.py`; Linux'ta PyInstaller denemesi: exe `/api/health`, `/api/modules` ve arayüzü sundu. Windows exe'si GitHub Actions'ta derlenir (çalıştırma kontrolü yapılmadı, istenmedi).
- 2026-10-21 (G3 kayma dişi, arka uç): `ShearKey` (toe/middle/heel, genişlik, derinlik) konsol ve ağırlık duvarı geometrisinde; temel ASD, katmanlı ve kısmi katsayı yolları. Kayma = min(taban yüzeyi + diş pasifi, diş ucu düzlemi + diş pasifi); pasif Rankine Kp, 0.50 azaltma görünür varsayım (katmanlı yolda ayak pasifi gibi, temel kısmi katsayı yolunda 1.0); dişsiz/dişli FS ve diş V, M talebi sonuçta (`shear_key`). key=None sonucu ve hash'i değişmedi. Test (2026-10-21): tam pytest 1921 geçti / 2 atlandı; Vitest 337 geçti; tsc temiz; build başarılı; `gen_code_map --check` 0; iki bağımsız salt okuma inceleme, bulgular işlendi. Açık: web/rapor G4; diş derinliğinde arka aktif itki ve su altı düzeltmesi yok (uyarı/varsayım olarak yazılı); Das/Bowles örneğiyle karşılaştırma yapılmadı (elle bağımsız hesap kullanıldı).
- 2026-10-21 (G9 mühendislik incelemesi, Umut isteği): duvar eğim/sürşarj, palplanş β ve kayma dişi kaynaklara ve yayınlanmış örneklere karşı incelendi; rapor [qa/G9-muhendislik-incelemesi.md](qa/G9-muhendislik-incelemesi.md). PR #21 bu dala taşındı. Düzeltmeler: diş ucu düzleminde diş derinliği boyunca arka itki/su/deprem/atalet; diş bölgesinde temel zemini γ; duvarda deprem pasifi (1−k_v)K_PE/K_P; palplanşta M-O aktif artımı kazı tabanı altında; temel palplanşta deprem artımına sürşarj payı; katmanlı kısmi katsayı yolunda diş bölgesi suyu için WA katsayısı. Örnek duvar FS 1.85 → 1.66. Açık: B7, B8, B13–B15 Umut kararı/kaynak bekliyor; G4 (web/rapor) başlamadı.
- T1 (feat/t1-liq-charts) ve T3b (test/T3b-bearing-earthpressure) main'e birleştirildi; T3b test dosyalarındaki BOM kaldırıldı (kod haritası testini bozuyordu). Bulut testi: pytest 1802 geçti, 3 atlandı, 1 ortam hatası (PySide6 yok, `test_dynamic_i18n_keys_exist`); web Vitest 298 geçti, tsc temiz; gen_code_map --check 0.
- T4 belgeleri (`katsayi_dogrulama.md`, `research/katsayi_kaynak_arastirmasi_2026-10-20.md`) main'de.
- T3a-FIX açıkları **doğrulanamadı** (2026-10-20): Youd 2001 tam metni bulut ağından alınamadı (memphis.edu/cgs.ca erişilemez). (a) F<0.5 kısayolu Youd 2001 Eq.19'da var mı: kaynak görülmeden karar verilmedi, kod değişmedi (kaldırılmış hâli +2…+18% CRR, yalnız Ic>1.64). (b) Andrus-Stokoe üssü: kod (M/7.5)^-3.3, Tablo 3 ile tutuyor; -2.56 Idriss'in (Eq.24) üssüdür, çıkarım artefaktı olasılığı yüksek, basılı metinden doğrulanmadı. Cihazdan PDF ile kontrol gerekir.
- Bağımsız incelemeler (T1, T4 Antigravity; T8a Antigravity; T8b Codex luna) ai-orchestrator bağlanamadığı için çalıştırılamadı (cihaz oturumu gerekir).
- Claude (Opus) salt okuma incelemeleri (2026-10-20, T1/T4/T8a): farklı motordan (Antigravity) inceleme **hâlâ açık**; ai-orchestrator cihaz ayarında izinlenirse yeniden koşulmalı. Düzeltilenler: EN `liquefaction.method.youd2001` metni, DepthChart React anahtarları, rapor USCS tablo başlıkları (`report.cls.borehole/depth/status`), raporda sıvılaşma uyarıları, T4 araştırma notunda LS extreme_I kararı.
- İncelemeden kalan açıklar (düzeltilmedi): T1: TR "GS" ile "FS" terim tutarsızlığı, SoundingDetail motor uyarıları İngilizce (anahtar sözleşmesi gerekir), FS x ekseni üst sınırı, marginal/hedef GS çizgisi, sayı biçimi (`Intl.NumberFormat`), özet tablo caption'ı, EN/errors/marginal testleri. T8a: rapor ayarlarında `gwt_seismic`/`default_fc` None iken "-" yazıyor (profil değeri kullanılıyor), `c_fc`/`ic_cutoff` yok; sınıflandırma bölümü rapor anında yeniden hesaplanıyor (hash yok); geometri anahtarları ham ve birimsiz; `calculation_fingerprint` NaN/bilinmeyen kodda 500 verebilir; no_result+stale birlikteyken yalnız no_result döner; stale/override/silinen profil test boşlukları. T4: `asd.yaml`/`aashto_lrfd.yaml` doğrulama durumları belgeyle çelişiyor, `asd.yaml` kaynağı NHI-06-088 (Cilt I) yerine -089 olmalı, AASHTO 11.6.5 eksantrisite ve tablo numarası (11.5.6-1/11.5.7-1) metinle doğrulanmalı, devrilme 2.0 kaya için 1.5 değil. Hesap formülüne dokunulmadı.
- Youd 2001 PDF kontrolü (F<0.5, Andrus-Stokoe üssü) Umut PDF verene kadar park.
- T4 metaveri düzeltmesi (2026-10-20): `asd.yaml` kaynağı NHI-06-089; ASD ve AASHTO `factor_sources` durumları katsayi_dogrulama.md ile hizalandı (katsayı değeri değişmedi); AASHTO 11.6.5 eksantrisite 0.40B ve tablo numarası unverified. T1/T8a artıkları: [T10b-POLISH](tasks/T10b-POLISH.md); `_structure_status` NaN koruması eklendi.
- T6 biten (2026-10-20, claude/project-thread-q7m1fh): web paketi bölündü; her modül manifest'i `lazy(() => import("./Root"))` kullanır, `vite.config.ts`'e `vendor-react/mantine/icons` parçaları eklendi. Build öncesi tek `index` parçası 918,36 kB (gzip 272,25) ve >500 kB uyarısı; sonrası en büyük parça 291,97 kB (vendor-mantine, gzip 89,83), ana `index` 239,56 kB (gzip 70,78), modül Root parçaları 2,8–72,8 kB, uyarı yok. Davranış değişmedi. Testler (2026-10-20): `tsc --noEmit` temiz, Vitest 298 geçti, `npm run build` yeşil. ai-orchestrator bağlanamadığı için Codex kullanılmadı; uygulama Claude ile, inceleme build çıktısıyla yapıldı.

## Eğitim modülü (2026-10-21)
`education` modülü eklendi (yalnız web, API rotası yok): 11 konu (sınıflandırma, yanal basınç/istinat, taşıma gücü, sıvılaşma, palplanş, ankrajlı palplanş, ankraj tasarımı GEC-4, ankrajlı iksa, kayma dişi, eğimli zemin ve sürşarj, şev), 22 statik SVG şema; origin/main (#27) üzerine alındı. İçerik koddan türetildi; yönteme dayalı el örnekleri Haiku ile üretildi ve henüz bağımsız mühendis incelemesinden geçmedi. Kaynak künyeleri Gemini ile doğrulandı; GEC-3 bölüm numarası ve USS manual doğrulanamadı. Test (2026-10-21, cihaz, Windows): pytest 2002 geçti, 1 atlandı; vitest 357 geçti; tsc temiz. Tarayıcıda gözle kontrol yapılamadı.

Eğitim pilotu (2026-10-21): yanal basınç/istinat konusu iki katmanlı: öğrenci anlatımı (kavram, türetim, 3 çözümlü örnek programla karşılaştırılmış, sık hatalar, sınama, sözlük, okuma) ve mühendis paneli. 9 yeni etiketli şekil. Örnek sayıları elle ve `distribution`/`walls` fonksiyonlarıyla doğrulandı; Gemini ile bağımsız doğrulama bu oturumda headless izin hatası nedeniyle yapılamadı. Diğer 10 konu henüz eski (sığ) biçimde.
Eğitim (2026-10-21, devam): taşıma gücü ve sıvılaşma konuları da iki katmanlı hale getirildi (çözümlü örnekler programla çalıştırılarak doğrulandı). Gözlemler: Vesic φ=0 kolunda kod d_c=1+0.4k kullanıyor (genel limit ≈1+0.39k); LPI tributary_thickness ilk test noktasının üstünü (örnek 0-1 m) hesaba katmıyor. İkisi de mühendis incelemesi bekliyor, kod değiştirilmedi.
Eğitim (2026-10-21, tamamlandı): 11 konunun hepsi iki katmanlı (öğrenci anlatımı + mühendis paneli); çözümlü örnekler programla çalıştırılarak karşılaştırıldı. Şekillerin bir kısmı (şev, kayma dişi, ankraj, palplanş) mevcut genel şemaları paylaşıyor; konuya özel ayrıntılı şemalar sonraki iş. Kod gözlemleri (değiştirilmedi): ters geometrili şevde FS≈6e16 hatasız dönüyor; tbdy_kae_steep β kontrolü yok; palplanş toe_force işaret konvansiyonu doğrulanmalı; Vesic φ=0 d_c; LPI ilk kalınlık.
Eğitim şekilleri (2026-10-21): tüm şemalar ortak çizim kitiyle (`web/src/modules/education/figures/kit.tsx`) yeniden çizildi (taralı zemin/beton, ölçü çizgileri, etiketli kuvvetler); sayısal diyagramlar çalışan örneklerin değerleriyle çiziliyor. Ondalık virgül (6,00) KaTeX dönüşüm hatası düzeltildi, test eklendi. İnceleme sayfası: /m/education/gallery.
Eğitim modülü devam (2026-10-21, claude/project-thread-n6o9wl): origin/main (#38'e kadar) alındı; içerik güncellendi (LPI üst tabaka, KDYY sismik dağılımı, palplanş pasif GS'nin dayanıma uygulanması, ters şev hatası). 19 konuya özel yeni şema (`figures/extraDraw*.tsx`), ortak şema paylaşımı kaldırıldı; ~55 başlık spec biçiminde yeniden yazıldı. Şekil içi etiketler İngilizce sözlükle (`figures/labels.ts`) çevriliyor; içerikteki tüm `tr` alanlarının `en` karşılığı eklendi (Haiku çevirisi, insan gözünden geçmedi). Künyeler web aramasıyla kontrol edildi (Iwasaki yılı, Ebeling & Morrison ITL-92-11, Seed & Whitman başlığı düzeltildi; EM 2502/2504 doğrulandı). Test (2026-10-21, bulut): `tsc --noEmit` temiz, `vitest run src/modules/education` 17 geçti.
Eğitim açık işler: (1) Haiku'nun çözümlü örnekleri ve İngilizce metinler bağımsız mühendis incelemesi bekliyor; (2) doğrulanamayan künyeler: Skempton 1951, Bishop 1955, Robertson 2010, Robertson & Cabal 2010; kontrol edilmeyen: Coulomb, Mononobe-Okabe, Janbu, Blum, USS manual, Das/Bowles/Coduto/Craig/Budhu, EN 1998-5, TBDY madde metni; (3) şev arama şemasındaki FS sayıları şematik; (4) İngilizce formül bağlamında ondalık virgüller kaynak formüllerde olduğu gibi kaldı.
