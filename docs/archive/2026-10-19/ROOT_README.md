# GeoTek — Geoteknik Mühendislik Yazılımı

Modül 1: SPT/CPT verileri, zemin sınıflaması, ampirik parametreler, sıvılaşma.
Modül 2: İstinat yapıları (ağırlık, konsol, palplanş), yanal basınçlar, stabilite tahkikleri.

Ayrıntılı teorik çerçeve ve yol haritası: [docs/PLAN.md](docs/PLAN.md).

## Durum

| Faz | İçerik | Durum |
|---|---|---|
| 0 | Proje iskeleti, test altyapısı, tasarım kodu YAML'ları, TR/EN dil altyapısı | Tamam (formül/katsayı kaynak doğrulaması bekliyor) |
| 1 | Veri modelleri, `SoilProfile`, gerilme hesabı, proje dosyası (.gtk), CSV/Excel içe aktarma | Tamam |
| 2 | SPT düzeltmeleri, CPT işleme (Q_tn/I_c iterasyonu), Robertson SBTn, USCS, korelasyon kayıt defteri (16 korelasyon) | Tamam (yayımlanmış örneklerle doğrulama bekliyor) |
| 3 | Sıvılaşma: Youd et al. 2001 ve Boulanger & Idriss 2014 (SPT + CPT), duyarlılık filtreleri, LPI | Tamam (LSN ve oturma sonraya) |
| 3a | B&I yönteminin yayımlanmış vaka tablolarına karşı doğrulaması (233 CPT + 226 SPT vakası) | Tamam; Youd 2001 için açık tablo bulunamadı ([ayrıntı](tests/verification/data/README.md)) |
| 4 | Modül 1 arayüzü (PySide6): proje ağacı, profil editörü + sondaj logu, veri tablosu, CPT/SPT derinlik grafikleri, SBTn grafiği, sıvılaşma paneli, TR/EN, açık/koyu tema | Tamam (laboratuvar verisi henüz arayüzden girilemiyor) |
| 5 | Yanal basınç: Rankine, Coulomb, Mononobe-Okabe (aktif/pasif), sayısal deneme kaması, log-spiral pasif, SoilProfile'dan çok tabakalı basınç diyagramı; taşıma gücü: Meyerhof, Hansen, Vesic | Tamam (kapalı formlar sayısal kamayla çapraz doğrulandı) |
| 6 | Ağırlık ve konsol duvar dış stabilitesi (devrilme, kayma, eksantrisite, taban basıncı, taşıma gücü; statik + sismik), Bishop basitleştirilmiş + daire arama, duvar global stabilitesi | Tamam (yalnızca ASD; EC7/LRFD kombinasyonları sırada) |
| 7 | Palplanş: konsol (sabit uç, Blum) ve tek ankrajlı (serbest uç); gömülme, M_max, ankraj kuvveti, kesit modülü; çok tabakalı + su farkı + drenajsız | Tamam (kapalı form çözümlerle doğrulandı) |
| 7a | Kısmi katsayılar: EC7 (DA1-C1/C2, DA2, DA3, EQU) ve AASHTO LRFD (Strength I a/b, Extreme Event I) — duvar dış stabilitesi, global stabilite, palplanş (kombinasyon zarfı) | Tamam (YAML katsayıları `draft`; EC7 + deprem/EN 1998-5 yok) |
| 7b | Katsayı doğrulama: TBDY 2018 Bölüm 16 girildi (resmi metinden), EC7 JRC tablolarıyla doğrulandı, AASHTO kısmen | Tamam ([durum](docs/katsayi_dogrulama.md)) |
| 7c | Analiz seviyeleri: **Temel** (ASD + TBDY deprem, güvenli varsayılanlar, istinat duvarı otomatik ön boyutlandırma, basit palplanş) ve **İleri** (tüm kodlar, eksik katsayı listesi, kullanıcı katsayıları, Modül 1 profil bağlantısı); her katsayı ve varsayım kaynağıyla etiketli | Tamam |
| 8 | Yeni arayüz (tüm uygulama): sol gezinme menüsü, kart düzeni, açık/koyu tema, TR/EN. İstinat duvarında tek akış: **Boyut öner → düzenle → Kontrol et** (temel ve ileri seviye; ileri seviye için `size_wall_advanced`). Eksik katsayı formu, katsayılar sayfası, palplanş, kesit/kuvvet, Bishop dairesi ve palplanş diyagramları; form girdileri .gtk dosyasına kaydedilir | Tamam (hesap doğrulaması kullanıcı tarafından tekrarlanacak) |
| 9+ | Raporlama | Sırada |

## Analiz seviyeleri

- **Temel** (`geotek.services.walls_basic`): `size_wall` en az girdiyle en küçük uygun taban genişliğini
  bulur; `design_sheet_pile_basic` homojen zeminde palplanş. Örnek: `examples/on_boyutlandirma.py`.
  `check_wall` kullanıcının girdiği boyutları aynı esasla tahkik eder.
- **İleri** (`geotek.services.walls_advanced`): `required_inputs` seçilen kodun eksik katsayılarını listeler;
  `size_wall_advanced` (seçili kodla ön boyutlandırma), `check_wall_advanced`, `analyze_wall_advanced`,
  `design_sheet_pile_advanced`; `foundation_from_profile` / `bands_from_profile` Modül 1 zemin profilini kullanır.
- Kullanıcı katsayıları `WallSettings.factor_overrides` (proje dosyasında `design_overrides`) ile girilir ve
  sonuçlarda "Kullanıcı girdisi" olarak etiketlenir; yerleşik yönetmelik dosyaları değişmez.

Tasarım kodu katsayılarının kaynak doğrulama durumu için bkz. [docs/katsayi_dogrulama.md](docs/katsayi_dogrulama.md).
TBDY 2018'in sayısal değer vermediği katsayılar (γRφ, γRc, statik yük katsayıları) boş bırakılmıştır.

## Kurulum ve test

```bash
py -3.14 -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev,gui]"
.venv\Scripts\python.exe -m pytest
```

## Arayüzü çalıştırma

```bash
.venv\Scripts\python.exe -m geotek.ui examples\ornek_proje.gtk
```

Arayüz kodu `geotek/ui` altındadır: `main_window.py` (kabuk), `pages/` (her menü sayfası), `theme.py`
(açık/koyu tema), `widgets.py` (ortak bileşenler), `worker.py` (hesaplar ayrı iş parçacığında çalışır).
Hesap motorunun ürettiği varsayım ve uyarı metinleri yalnız Türkçedir; İngilizce arayüzde de Türkçe görünür.

`examples/` klasöründeki veriler **sentetiktir** (gerçek bir saha değildir) ve
`examples/make_example.py` ile yeniden üretilir.

## Yapı

```
geotek/core      veri modelleri (pydantic), birimler, sabitler
geotek/engine    hesap motoru (GUI bağımsız)
geotek/io        proje dosyası ve CSV/Excel içe aktarma
geotek/config    tasarım kodu katsayı setleri (ASD, EC7, AASHTO LRFD, TBDY 2018)
geotek/i18n      TR/EN metin katalogları
tests/           birim ve özellik (hypothesis) testleri
```

İç birim sistemi SI'dır (m, kPa, kN/m³, derece); CPT q_c içe aktarmada MPa → kPa çevrilir.
