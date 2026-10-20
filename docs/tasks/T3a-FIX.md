# T3a-FIX — Youd et al. (2001) motor hizalaması

Durum: bekliyor. Şef kararı (2026-10-20): `geotek/engine/liquefaction/youd2001.py` Youd et al. (2001),
JGGE 127(10), 817-833 **metnine** hizalanır; Robertson & Wride (1998) ayrımları docstring'de belirtilir.
Düzeltme önce tek formül özetiyle kullanıcıya sunulur (S4 kapısı); katsayı/kaynak uydurma yok.

## Oku

- `geotek/engine/liquefaction/youd2001.py` (yalnız ilgili satırlar), `geotek/engine/classification/robertson.py::soil_behaviour_index`
- `tests/verification/test_youd2001_{spt,cpt}.py` (commit `d260167`)
- **Untracked** `tests/verification/test_youd2001_cpt_discrepancy.py` (worktree
  `Documents\geotek-wt\T3a`): kabul testleri. Bu dosya **commit edilmez**, silinmez; ana depoya
  kopyalanıp yerelde çalıştırılır, düzeltme sonrası geçen testler `test_youd2001_cpt.py`'ye taşınır
  (taşıma ayrı commit, yazıcı değil şef onaylar).

## Düzeltmeler

1. **Q'da net qc** (`youd2001.py:99`): n≠1 için Eq.15 `Q = ((qc − σv)/Pa)(Pa/σ'v)^n`; kod `qc/Pa` kullanıyor.
   `qc1N` (Eq.12) brüt `qc` ile kalır — değiştirme.
2. **Ara üs 0.7** (`:106`, `:115-117`): Youd metni "intermediate exponent n of 0.7"; kod 0.75 (R&W 1998).
3. **Kc F<0.5 kısayolu** (`:130-131`): Youd Eq.19 yalnız Ic'ye bağlı; kısayol metinde yok → kaldır
   (`kc_factor` imzası uyumluluk için `F` kabul edip yok sayabilir; çağıranları `code_map_impact` ile bak).
4. **Docstring**: `stress_reduction` 23–30 m dalı R&W 1998'dendir (Youd Eq.2 yalnız 23 m'ye kadar);
   `MAX_DEPTH` açıklaması "Eq.2 ile 30 m" demesin. Davranış (30 m üstü NaN) değişmez.
5. **Andrus-Stokoe Eq.25 üssü**: çıkarılmış metin −2.56 gösteriyor, Tablo 3 sütun 7 değerleri −3.3 ile tutuyor.
   Basılı PDF sayfasını görüntü olarak oku (`tool-results` PDF'i veya ASCE) ve üssü doğrula.
   Yalnız doğrulama sonucuna göre karar; doğrulanmadan kod değişmez. Sonucu karta yaz.

## Yazma sınırı

`geotek/engine/liquefaction/youd2001.py`, bu dosyanın testleri (`tests/unit/test_liquefaction_methods.py`
içinde etkilenen beklenti varsa) ve `tests/verification/test_youd2001_*.py`.
`boulanger_idriss2014.py`, katsayı YAML'ları ve başka modüller yazılmaz.

## Kabul

- `test_youd2001_cpt_discrepancy.py` içindeki 8 test geçer (ana depoda yerelde).
- Tam `pytest` (tests/verification + tests/unit liquefaction + api liquefaction) ve `gen_code_map.py --check` 0.
- Etki: Youd yöntemini kullanan sıvılaşma sonuçları (CPT Ic/qc1Ncs/CRR) değişir → regresyon beklentilerini
  elle doğrulayarak güncelle, STATUS'a farkı yaz.
- S4: formül özeti kullanıcıya + iki bağımsız salt okuma incelemesi (`gemini-4-argon` high + Claude Opus).
- Uygulayıcı: `gpt-6-astra` high.
