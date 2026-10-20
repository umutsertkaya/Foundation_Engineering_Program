# T11 — Görsel kontrol (2026-10-20)

**Kapsam:** güncel main (T10c / PR #14 dahil) üzerinde 16 ekran × TR/EN × açık/koyu × 1366×768 / 800 px = 128 ekran görüntüsü (`docs/qa/t11/<ekran>-<dil>-<tema>-<genişlik>.png`).
Veri: `docs/qa/t10_e2e.py` ile hazırlanan proje (CPT+SPT, 3 katmanlı profil, duvar, palplanş, sıvılaşma, sınıflandırma).
**Yöntem:** bulut ortamında Vite + FastAPI + Chromium (headless). Cihaz/Antigravity kullanılmadı (ai-orchestrator bağlanamadı; talimat gereği aşılmadı) — görüntüleri Claude inceledi. Konsol hatası: yok. Yatay taşma (düzeltme sonrası): 128 ekranın hiçbirinde yok.
**Doğrulama:** `tsc --noEmit` temiz, Vitest 33 dosya / 308 test geçti, `npm run build` başarılı (2026-10-20).

## Bu PR'da düzeltilenler
1. **Palplanş detay, 800 px:** varsayımlar listesi 4 px yatay taşıyordu → `ResultPanel.tsx` liste öğesi genişliği düzeltildi.
2. **Palplanş detay, zemin tablosu:** γ, φ′ gibi değerler 17.919418366190715 biçiminde ham basılıyordu → yalnız gösterimde yuvarlandı (veri değişmedi).
3. **Sıvılaşma sonuçları, durum rozeti:** "YERALT…", "SIVILAŞ…" kırpılıyordu → rozet tam metin gösteriyor (`SoundingDetail.tsx`).
4. **Mühendislik parametreleri, 800 px:** aday tablosunun uyarı sütunu çok dar kalıp her nokta uyarısını harf harf alt alta yazıyordu; sayfa 11186 px → 4496 px. Sütun min. 180 px, uyarı kutusu en çok 160 px yüksekliğe kaydırmalı (`ParameterKeyCard.tsx`).

## Açık bulgular (önem sırasıyla, bu PR'da düzeltilmedi)
1. **Orta — çevrilmemiş motor uyarısı (TR arayüzde İngilizce):** "1 record(s) at refusal: N is a lower bound at depth(s) [13.5] m" (`geotek/engine/insitu/spt.py:121`). Uyarı kodu + parametreli çeviri gerekir (motor tarafı, T9 uyarı kodu düzeniyle).
2. **Orta — sıvılaşma GS grafiği ölçeği:** GS ekseni 90.68'e kadar uzandığından anlamlı aralık (GS<2) çizgi gibi sıkışıyor; eksen üst sınırı (ör. GS 3'e kırpma + işaret) önerilir. Ayrıca 800 px'te grafikler çok küçük.
3. **Düşük — ham profil kimliği:** palplanş detayında "…profilinden kopyalandı" ve zemin profili ekranında profil adı yerine 32 haneli kimlik gösteriliyor.
4. **Düşük — duvar kesiti etiket kırpması:** "5.97–9.07 m · Ki…", "0.00–5.97 m · …" (SVG etiket genişliği sabit).
5. **Düşük — 800 px'te sıvılaşma ayrıntı tablosu:** uyarı sütunu kapsayıcı içinde yatay kaydırmayla ulaşılabiliyor; kabul edilebilir.
6. **Bilgi:** tam sayfa görüntülerde sol menü kenar çizgisi ilk 768 px'te bitiyor; yalnız tam sayfa yakalama etkisi, canlı arayüzde sorun değil.

Yeni çevrilmemiş UI anahtarı, okunmaz kontrast veya koyu temada bozuk renk gözlenmedi (örneklenen koyu/EN ekranlar: parametreler, rapor, sıvılaşma analizi, profil).
