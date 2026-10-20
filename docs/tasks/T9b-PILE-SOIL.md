# T9b-PILE-SOIL — palplanş zemin kopyası: YASS gösterimi, düzenleme ve drenajsız tabaka

**Durum:** bekliyor. Dalga 3'ten sonra ele alınır. Mühendislik kararı gerektirir; karar verilmeden uygulama başlamaz.
Kaynak: `docs/audit/2026-10-20-palplans-web-inceleme-ikinci-gecis.md` (Y2, Y4; yalnız Gemini bulgusu, kodda yeniden doğrulanacak).

## Kapsam
- **Y2:** Detay sayfasında YASS (`soil.profile.gwt`, `gwt_front`, `gwt_retained`) gösterimi; yapıya özel zemin kopyasını
  düzenleme yolu (eksik `phi_eff` gibi boşlukları kaynak profile dönmeden kapatma). Kaynak profil yapı düzenlenirken
  değişmez; yapıya özel kopya, onay ve stale/hash denetimleri korunur (CLAUDE.md).
- **Y4:** `missingSoilInputs` (`web/src/modules/sheet_pile/inputs.ts`) davranış ayrımı yapmadan `phi_eff == null` ise
  eksik sayıyor; drenajsız (`su`) tabaka varsa hesap kilitleniyor. Önce motorun drenajsız tabakayı palplanşta
  gerçekten desteklediği doğrulanır (`geotek/services/structures.py` `_sheet_case`; deprem + drenajsız pasif durdurulur).

## Karar gerekenler (şef/Umut)
1. Zemin kopyası düzenlenecek mi, düzenlenecekse hangi alanlar (yalnız eksik tasarım parametreleri mi, tüm tablo mu)?
2. Düzenleme sonucu sonuç bayatlar (stale); kaynak bağlantısı korunur mu, kopya "elle değiştirildi" mi sayılır?
3. Drenajsız tabaka palplanşta desteklenecek mi (hangi doğrulama kaynağıyla), yoksa net bir "desteklenmiyor" mesajı mı?

## Kabul (kararlar sonrası)
- Yeni katsayı/formül yok; varsa hesap değişikliği CLAUDE.md kurallarına bağlıdır (el hesabı + iki bağımsız salt okuma inceleme).
- Vitest sheet_pile + boundaries, typecheck, ilgili pytest; `gen_code_map --check` 0.
