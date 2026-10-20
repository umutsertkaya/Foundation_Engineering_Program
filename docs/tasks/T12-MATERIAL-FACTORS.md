# T12 — kullanılmayan yönetmelik katsayıları (malzeme γ, kaya eksantrisitesi)

2026-10-20 sistem kontrolünde bulundu (`docs/qa/sistem-kontrolu.md`). Seviye S4: katsayı/yöntem
değişikliği; el hesabı + regresyon + iki bağımsız salt okuma incelemesi + kullanıcıya formül özeti gerekir.

## Durum
- EC7/TBDY kombinasyonlarındaki `material.gamma` (YAML'da 1.00) motor tarafından okunmuyor. Kullanıcı
  override'ı kabul edilir, sonuç değişmez; artık sonuçta `wall.warning.override_not_applied` uyarısı çıkar.
- `WallSettings.foundation_on` ("soil"/"rock") katmanlı yolda kullanılmıyor; AASHTO `eccentricity.rock.*`
  sınırları hiç uygulanmıyor. Her zaman zemin sınırı kullanılır (tutucu). Web arayüzü bu alanı göstermiyor.
- Okunmayan diğer YAML anahtarları: AASHTO `sliding_precast_on_sand`, `global_stability_supporting_structure`,
  `EH_at_rest`, `ES`.

## Yapılacak
1. Malzeme katsayısının birim hacim ağırlığına uygulanıp uygulanmayacağını EN 1997-1 (Tablo A.4, γγ) ve
   TBDY 2018 metniyle doğrula; uygulanacaksa `services/structures.py` `_design_structure_soil` yolunda ekle.
2. `foundation_on` için arayüz girdisi + AASHTO 11.6.3.3 kaya eksantrisite sınırını kaynakla doğrulayıp bağla.
3. Okunmayan anahtarlar için ya uygulama ya YAML'dan kaldırma kararı (`docs/katsayi_dogrulama.md`).

Kabul: hedefli pytest + `tests/verification` regresyonu, iki bağımsız inceleme, kullanıcıya formül özeti.
