# HS-F — Katmanlama penceresi: γ kaynağı, düzenlenebilir γsat, ortak katmanlama (web)

**Durum:** HS-E birleştikten sonra. Tasarım: Opus. Uygulayıcı yalnız bu kartı kodlar.
Bağımlılık: HS-E API'si (`gamma_source`, `gamma_sat_source`, `gamma_range`, `supplied_gamma`, `POST /layering/combined`,
`conflict`, `top_source`, `distances`, `source_ids`, `resolution`, 422 `layering_conflict_unresolved`).
Metinler i18n (TR/EN). Mantine desenleri. Mock (`modules/soil/mock.ts`) yeni alanları üretir.

## F1. `components/LayeringModal.tsx` γ sütunları
- γ hücresi: öneri varsa **önceden doldurulmuş** düzenlenebilir sayı (bugün "Öneriyi kullan" düğmesiyle dolduruluyor;
  artık öneri varsayılan değer, kullanıcı değiştirebilir). Altında küçük kaynak etiketi:
  `lab` "Lab ölçümü", `phase` "Faz bağıntısı (w, Gs)", `cpt_rc2010` "CPT (Robertson & Cabal 2010)",
  `spt_bowles` "SPT tablo (Bowles 1996), aralık {low}–{high}", `user` "Elle". Öneri yoksa boş ve zorunlu (bugünkü gibi).
- γsat hücresi de **düzenlenebilir** (boş bırakılabilir; YASS altında boşsa satır uyarısı, HS-B metniyle aynı). Kaynak etiketi aynı.
- Kullanıcı bir γ girip öneri yeniden istendiğinde (`supplied_gamma`), alttaki katmanların SPT önerileri yenilenir:
  γ/γsat alanından çıkınca (blur) öneri isteği tekrarlanır; kullanıcının elle girdiği hücreler korunur.
- Gönderimde γsat da kullanıcının değeriyle gider (`gamma_sat_suggested` alanı, mevcut sözleşme).

## F2. Ortak katmanlama
- Katmanlama penceresinde yöntem seçimine "Ortak (CPT + sondaj)" eklenir: bir CPT ve bir ya da daha çok sondaj seçimi.
- Sonuç üstünde bilgi: her sondaj için yatay mesafe ("SK-1: CPT'ye 12.4 m") ya da "koordinat yok";
  `depth_not_aligned` uyarısı varsa sarı kutu: "Kotlar eksik: derinlikler hizalanmadan birleştirildi."
- Tabloya "Sınır kaynağı" sütunu (`cpt` "CPT", `borehole` "Sondaj", `both` "İkisi").
- `conflict` olan satır kırmızı; hücrede "CPT: kum gibi (Ic 1.9) — Lab/log: CL" ve iki seçenekli seçim
  ("Lab/log'a göre", "CPT'ye göre"). Çözülmemiş çelişki varken "Profil oluştur" pasif ve açıklaması:
  "Çelişkili katmanlarda hangi verinin geçerli olacağını seçin."
- Profil oluşturma `source_ids` = CPT + sondajlar; `resolution` her çelişkili katman için gönderilir.

## Testler (Vitest)
Kaynak etiketleri; öneri ön-dolu ve düzenlenebilir; γsat düzenlenebilir; elle değer korunur; ortak yöntemde mesafe ve
hizalama uyarısı; çelişkide oluştur düğmesi pasif, seçim sonrası etkin ve `resolution` gönderilir.

## Kabul
`npm run typecheck && npm test && npm run build`; `gen_code_map --check` 0. Gerçek API ile elle akış:
`examples/ornek_excel_proje.gtk` kopyasında SPT katmanlaması γ sorusu sormadan önerili açılır; ortak katmanlama
çalışır (ekran görüntüleri `/mnt/project-files/ekran/2026-10-24/hs-f-*.png`).
