"""Temel seviye: konsol istinat duvarı otomatik ön boyutlandırma (SENTETİK örnek veriler).

    python examples/on_boyutlandirma.py
"""

from geotek.services.walls_basic import BasicWallInput, size_wall

inp = BasicWallInput(
    wall_type="cantilever",
    height=5.0,               # taban altından duvar üstüne [m]
    backfill_gamma=18.0, backfill_phi=32.0,
    foundation_phi=30.0, foundation_gamma=19.0,
    surcharge=10.0,           # kPa
    sds=0.5,                  # TBDY S_DS (deprem durumu için)
)
r = size_wall(inp)
g = r.geometry

print(f"Sonuç: {'UYGUN' if r.passed else 'UYGUN DEĞİL'}  (yöneten tahkik: {r.governing})")
print(f"Taban B = {g.width:.2f} m | ön ayak {g.toe:.2f} | gövde {g.stem_bottom:.2f}/{g.stem_top:.2f} | "
      f"topuk {g.heel:.2f} | taban kalınlığı {g.base_thickness:.2f} | gömülme {g.embedment:.2f} m")
if r.kh is not None:
    print(f"Deprem: k_h = {r.kh:.3f}, k_v = {r.kv:.3f}")

print("\nTahkikler (değer  koşul  sınır):")
for case, name, value, req, ok, cmp in r.summary_rows():
    print(f"  {case:8s} {name:18s} {value:7.2f}  {cmp}  {req:5.2f}  {'✓' if ok else '✗'}")

print("\nKullanılan katsayılar ve kaynakları:")
for f in r.factors_used:
    print(f"  {f.path:34s} {f.value:5.2f}  [{f.status}] {f.source}")

print("\nVarsayımlar:")
for a in r.assumptions:
    print(f"  - {a.text}  ({a.source})")
for w in r.warnings:
    print(f"! {w}")
