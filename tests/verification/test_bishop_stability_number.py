"""Deep homogeneous phi=0 slope: published stability-number benchmark.

Sources: D. W. Taylor (1937), "Stability of earth slopes", Journal of the
Boston Society of Civil Engineers 24, 197-246 (historical chart origin);
R. L. Michalowski (2002), "Stability Charts for Uniform Slopes",
J. Geotechnical and Geoenvironmental Engineering 128(4), 351-355,
"Stability Number", equations (2), (5), (6), Figure 1, pp. 351-352:
https://websites.umich.edu/~rlmich/index_files/references/Michalowski%20SlopeCharts%202002.pdf
The directly verified numerical source is Michalowski equation (6), not an
unverified reading of Taylor's original chart: N=0.181 for deep phi=0 soil.

Inputs: beta=45 degrees, H=5 m, gamma=20 kN/m^3, c=20 kPa,
phi=0 degrees, no water, load, seismic force, or shallow bedrock.
Hand calculation: N=c/(F*gamma*H), hence F=20/(0.181*20*5)
=1.104972375691. Equation (5) independently gives
N=cos(alpha)^2/[2*(pi-2*alpha)], maximized at alpha about 23.2 degrees.
This is an infinite-depth limiting mechanism, not a toe-only circle.

The model has 100H benches on each side and permits tangencies down to -20H;
the centre grid covers x=-2H..12H and y=H..40H, followed by refinement.
No exit-at-toe constraint is imposed. Relative tolerance 1% on N (measured deviation ~0.1%; the critical circle sits on the lower tangent bound of the search domain, so this does not show an interior optimum) 
    -- originally 5%, tightened after review; N permits
finite-domain approximation to the infinite mechanism, chart rounding, and
400-slice/search discretization. The domain and tolerance are selected from
the published mechanism before observing engine results. This test does
not claim a finite bedrock depth is equivalent to infinite soil depth.
"""

import math

import pytest
from scipy.optimize import brentq

from geotek.engine.stability import SlopeModel, SoilBand, search_critical_circle


def test_published_phi_zero_stability_number():
    # dN/dalpha=0 implies tan(alpha)*(pi-2*alpha)=1.
    alpha = brentq(lambda angle: math.tan(angle) * (math.pi - 2 * angle) - 1,
                   0.1, 0.7)
    independent_number = math.cos(alpha) ** 2 / (2 * (math.pi - 2 * alpha))
    assert independent_number == pytest.approx(0.181, abs=5e-4)
    model = SlopeModel(
        surface=[(-500, 0), (0, 0), (5, 5), (505, 5)],
        layers=[SoilBand(top=5, gamma=20, c=20, phi=0)],
    )
    result = search_critical_circle(
        model, x_range=(-10, 60), y_range=(5, 200),
        tangent_range=(-100, 0), n_x=11, n_y=11, n_tangent=9,
        n_slices=400, min_width=5, refine=True,
    )
    assert math.isfinite(result.fs) and result.fs > 0
    assert -500 < result.x_exit < result.x_entry < 505
    assert 20 / (result.fs * 20 * 5) == pytest.approx(0.181, rel=0.01)
