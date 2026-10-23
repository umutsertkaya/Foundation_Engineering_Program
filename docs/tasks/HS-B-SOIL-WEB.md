# HS-B — Zemin modülü arayüzü: düşen onayın nedeni, eski→yeni, toplu yeniden onay, γ/γsat önceliği

**Durum:** HS-A birleştikten sonra uygulanır. Tasarım: Opus. Uygulayıcı yalnız bu kartı kodlar.
Bağımlılık: HS-A API'si (`ParameterSelection.stale_reason`, `.refreshed`, `DerivedParameter.based_on`,
`POST /profiles/{id}/parameters/reapprove`, `GET /profiles/{id}/readiness`, `LayerInventory.stress_issue`,
`LayeringProposal` katmanında `gamma_sat_suggested`, `layer_gamma_sat_missing` hata kodu).
Metinler `web` i18n (TR/EN) anahtarlarıyla. Mevcut bileşen desenleri (Mantine) kullanılır. Mock modu
(`modules/soil/mock.ts`, `shared/api/mock/data.ts`) yeni alanları üretir ki `dev:mock` ve Vitest çalışsın.

## B1. Düşen onay kartı (`components/ParameterKeyCard.tsx`, `parameterState.ts`)
- `approvalState`: `stale` = `!approved && approved_at` (mevcut). Rozetin yanında neden metni:
  - `stress_changed` → "Gerilme tabanı değişti (γ, γsat veya YASS). Bu yöntem σ′v kullanıyor."
  - `data_changed` → "Ölçüm verisi değişti."
  - `dependency_changed` → "Dayandığı φ′ (veya OCR) değişti."
  - `method_upgraded` → "Onay kayıt yöntemi güncellendi; veriler onaydan sonra değişmiş."
- `refreshed` varsa satır: "Onaylı: {eski} → Güncel: {yeni} {birim}" (fark ve % fark). Düğme "Güncel değerle
  yeniden onayla" → `reapprove` rotası, tek öğe `{layer_id, key, expected_value: refreshed.value}`. 409
  `reapprove_value_changed` → listeyi yeniden yükle ve bildirim göster.
- `refreshed` yoksa (yöntem artık yok) mevcut "yeniden uygula" akışı kalır, metin: "Seçilen yöntem artık
  uygulanamıyor; yeni bir seçim yapın."

## B2. Toplu yeniden onay (`pages/ParametersPage.tsx`)
Profil düzeyinde düğme "Değişen onayları gözden geçir" (yalnız `refreshed` dolu düşen onay varsa etkin). Açılan
modalda tablo: katman (derinlik aralığı), parametre, eski, yeni, fark %, neden; her satırda onay kutusu (varsayılan
**seçili değil**); "Seçilenleri yeniden onayla" yalnız seçilenleri gönderir. Otomatik onay yok.
Katman listesinde katman başına düşen onay sayısı (mevcut `layer_stale`) korunur.

## B3. γ/γsat önce
- Parametre kartları sırası: `gamma`, `gamma_sat` en üstte, sonra diğerleri (mevcut sıra korunur).
- Katman için `readiness` (yeni rota) γ veya γsat onaysızsa sayfa üstünde bilgi kutusu: "Önce birim hacim
  ağırlıklarını onaylayın: σ′v'ye bağlı tüm korelasyonlar bunlara dayanır. γ değişirse σ′v kullanan onaylar
  yeniden onay ister."
- `gamma_sat_missing_below_gwt` → kırmızı uyarı: "Katman YASS altında ve γsat girilmemiş: gerilmeye bağlı
  korelasyonlar hesaplanamıyor ve analizler duracak. γsat'ı laboratuvardan, CPT'den ya da elle girip onaylayın."
- `gamma_sat_equals_gamma_unapproved` → sarı uyarı: "γsat = γ ve onaylanmamış (eski dosyalarda program γsat'ı γ'ya
  eşitliyordu). Kontrol edip onaylayın."

## B4. Envanter paneli (`components/LayerInventoryPanel.tsx`)
`stress_issue == "gamma_sat_missing"` → panel başında aynı kırmızı uyarı. `missing_inputs` içinde `"uscs"`
→ "Katman USCS sınıfı gerekli (bu yöntem zemin sınıfına göre seçilir)". `spt_class` varsa gösterilir
("SPT'ye göre: orta sıkı" vb., Clayton 1993).

## B5. Katman tablosu ve öneri (`shared/soil/LayerEditor.tsx`, `components/LayeringModal.tsx`, ProfilesPage)
- γsat hücresi boş bırakılabilir; boşken YASS altındaki katmanda satır uyarısı (aynı metin, kısa).
- Katmanlama önerisi tablosunda `gamma_sat_suggested` sütunu; profil oluştururken taşınır (sunucu taşır, ön yüz
  yalnız gösterir).
- Katman birleştirme sonrası sunucu `Warning` başlığındaki birim hacim ağırlığı uyarısı bildirim olarak gösterilir
  (mevcut uyarı yolu varsa onu kullan).

## B6. Analiz hata metni
`layer_gamma_sat_missing` ve `layer_k0_missing` mesaj kodları web i18n'e (TR/EN) eklenir; mevcut
`LayerDesignError` gösterim yolu bunları derinlik aralığıyla gösterir.

## Kabul
`npm run typecheck`, `npm test` (yeni Vitest: neden metinleri, eski→yeni satırı, toplu modalda varsayılan seçimsiz,
yalnız seçilenlerin gönderilmesi, γ/γsat sırası, γsat eksik uyarısı), `npm run build`. Gerçek API ile elle akış:
`examples/ornek_excel_proje.gtk` aç, katman 1 γ elle onayla → γ onaylı kalır, φ′ "gerilme tabanı değişti" ile düşer,
eski→yeni görünür, yeniden onay çalışır (ekran görüntüsü `/mnt/project-files/ekran/2026-10-23/`).
