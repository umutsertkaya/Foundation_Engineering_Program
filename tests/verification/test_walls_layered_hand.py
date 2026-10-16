"""Two-layer wet retained soil: all numbers independent of coefficient/integration helpers.

SI units, H=6, B=4, D=1, beta=delta=theta=0, q=0, gamma_w=9.81.
Cantilever: slab=0.6, stem_height=5.4, toe=1, stem_bottom=0.4,
stem_top=0.3, heel=2.6. Natural foundation phi=30, gamma=19, dry front.
Retained fill: upper z=0..2, phi=30, gamma=18, gamma_sat=20;
lower z=2..6, phi=20, gamma=19, gamma_sat=21. Retained GWT z=3.

K1=tan(45-30/2)^2=0.3333333333333333.
K2=tan(45-20/2)^2=0.4902905965657021.
Effective vertical stresses z=0,2,3,6: 0,36,55,88.57 kPa.
u at z=0,2,3,6: 0,0,0,29.43 kPa.
Effective horizontal stresses:
z=0: 0; z=2-:12; z=2+:17.650461476365273;
z=3:26.965982811113612; z=6:43.42503813782423 kPa.

Interval    F [kN/m]          depth centroid [m]     base lever [m]
0..2        12.000000000000   1.333333333333333      4.666666666666667
2..3        22.308222143739   2.534798534798535      3.465201465201465
3..6       105.586531423407   4.616911611060807      1.383088388939193
Base moments: 56, 77.30248405852569, 146.03550564007708 kNm/m.
EH=139.8947535671462; M_EH=279.3379896986029; y_EH=1.996772449114950.
WA=0.5*9.81*3^2=44.145; y_WA=1; M_WA=44.145.
Total horizontal F=184.0397535671462; M=323.4829896986029;
y=1.757679976356746; depth centroid=4.242320023643254.

Base u_front=0, u_retained=29.43; uplift U=0.5*29.43*4=58.86;
x_U=2*4/3=2.666666666666667; uplift moment=156.96 kNm/m.
Heel weights: 2.6*2*18=93.6 at y=5;
2.6*1*19=49.4 at y=3.5; 2.6*2.4*21=131.04 at y=1.8.
W_heel=274.04 at x=2.7; vertical first moment in y=876.772;
heel resisting moment about toe=739.908 kNm/m. Front overburden=19*1=19 kPa.
"""

import numpy as np
import pytest

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.walls import CantileverGeometry, WallLoads, WallSettings
from geotek.engine.walls.layered import foundation_from_structure, wall_forces_layered, wall_pressures_layered


def test_two_layer_water_hand_calculation():
    geometry = CantileverGeometry(stem_height=5.4, stem_top=0.3, stem_bottom=0.4, toe=1,
                                    heel=2.6, base_thickness=0.6, embedment=1)
    natural = SoilLayer(id="natural", top=0, bottom=30, gamma=19,
                        design=DesignParameters(phi_eff=30))
    upper = SoilLayer(id="upper", top=0, bottom=2, gamma=18, gamma_sat=20,
                      design=DesignParameters(phi_eff=30))
    lower = SoilLayer(id="lower", top=2, bottom=6, gamma=19, gamma_sat=21,
                      design=DesignParameters(phi_eff=20))
    soil = StructureSoilModel(
        profile=SoilProfile(id="hand", layers=[natural], gwt=GroundwaterCondition(depth_insitu=100)),
        retained_fill=[upper, lower], gwt_retained=GroundwaterCondition(depth_insitu=3),
    )
    diagram = wall_pressures_layered(geometry, soil, WallLoads(), WallSettings(), seismic=False)["retained"]
    np.testing.assert_allclose(diagram.z, [0, 2, 2, 3, 6], rtol=0, atol=1e-6)
    np.testing.assert_allclose(diagram.K, [1 / 3, 1 / 3, 0.4902905965657021,
                                         0.4902905965657021, 0.4902905965657021], rtol=0, atol=1e-6)
    np.testing.assert_allclose(diagram.sigma_v_eff, [0, 36, 36, 55, 88.57], rtol=0, atol=1e-6)
    np.testing.assert_allclose(diagram.sigma_h_eff,
                               [0, 12, 17.650461476365273, 26.965982811113612, 43.42503813782423],
                               rtol=0, atol=1e-6)
    np.testing.assert_allclose(diagram.u, [0, 0, 0, 0, 29.43], rtol=0, atol=1e-6)
    assert diagram.force == pytest.approx(184.0397535671462, rel=0, abs=1e-6)
    assert 6 - diagram.z_resultant == pytest.approx(1.757679976356746, rel=0, abs=1e-6)

    forces = wall_forces_layered(geometry, soil, WallLoads(), WallSettings(), seismic=False).forces
    earth = [f for f in forces if f.kind == "EH"]
    assert -sum(f.fx for f in earth) == pytest.approx(139.8947535671462, rel=0, abs=1e-6)
    assert -sum(f.fx * f.y for f in earth) == pytest.approx(279.3379896986029, rel=0, abs=1e-6)
    water = next(f for f in forces if f.name == "Water (retained)")
    assert -water.fx == pytest.approx(44.145, rel=0, abs=1e-6)
    assert water.y == pytest.approx(1.0, rel=0, abs=1e-6)
    uplift = next(f for f in forces if f.name == "Uplift")
    assert uplift.fy == pytest.approx(58.86, rel=0, abs=1e-6)
    assert uplift.x == pytest.approx(8 / 3, rel=0, abs=1e-6)
    assert uplift.moment == pytest.approx(156.96, rel=0, abs=1e-6)
    weights = [f for f in forces if f.kind == "EV"]
    assert -sum(f.fy for f in weights) == pytest.approx(274.04, rel=0, abs=1e-6)
    assert -sum(f.fy * f.y for f in weights) == pytest.approx(876.772, rel=0, abs=1e-6)
    assert -sum(f.moment for f in weights) == pytest.approx(739.908, rel=0, abs=1e-6)
    assert foundation_from_structure(soil, 5, 6, 4)[0].overburden == pytest.approx(19, rel=0, abs=1e-6)
