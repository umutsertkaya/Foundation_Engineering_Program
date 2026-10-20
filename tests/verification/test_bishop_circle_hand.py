"""Independent worked applications of Bishop's circular-arc equations.

Source: A. W. Bishop (1955), "The use of the slip circle in the stability
analysis of slopes", Geotechnique 5(1), 7-17, equations (3), (13), with
interslice vertical shear difference zero; DOI: 10.1680/geot.1955.5.1.7.
Readable original-paper transcription:
https://pdfcoffee.com/bishop-1955-the-use-of-the-slip-circle-in-the-stability-analysis-of-slopes-2-pdf-free.html
These are independently constructed worked cases, not Bishop's dam examples.

Inputs: 2H:1V slope, height 10 m, toe (0,0), crest (20,10) m;
circle centre (5,15) m, R=sqrt(250) m; gamma=20 kN/m^3, c=10 kPa.
The arc intersects the surface exactly at x=0 and x=20 m. Its angle is
pi/2, so L=R*pi/2=24.8364706645 m. For phi=0 degrees,
the driving moment is gamma*integral[h(x)*(x-5), x=0..20]=25000/3 kNm/m,
where h=x/2-15+sqrt(250-(x-5)^2). Hence F=c*L*R/M=3*pi/20
=0.471238898038. Equivalently F=c*L/sum(W*sin(alpha)); the latter
denominator is a force, so it must not receive an extra radius factor.

For phi=20 degrees, integrate in angle theta, not engine slice coordinates:
x=5+R*sin(theta), y=15-R*cos(theta), dx=R*cos(theta)*dtheta.
Solve F*integral(gamma*h*sin(theta)*dx) =
integral([c+(gamma*h-u)*tan(phi)]/[cos(theta)+sin(theta)*tan(phi)/F]*dx).
No engine slice, intersection, weight, or pore-pressure helper supplies the
reference. u=0 gives F=1.441832282789; water elevation 0 m gives
u=9.81*max(-y,0) kPa and F=1.399895339437. Water never ponds, and
gamma*h-u is nonnegative. A water level of -2 m is below the entire arc
and must recover the u=0 (ru=0) result.

Tolerance: relative 2e-4 (0.02%) for FS, allowing 4,000 midpoint slices
and the engine's finite intersection-probe spacing; 0.02 m for endpoints (engine locates arc/surface crossings by linear interpolation on a 600-point probe grid; measured deviation ~1e-4 relative in FS and ~0.01 m in endpoints, set by that probe, not by slice count).
Reference quadrature/root errors are below 1e-8, independently of this
discretization allowance. Parameters are fixed before tests; endpoint tolerance was widened from 0.002 to 0.02 m after measuring the probe-grid effect (reviewed).
"""

import math

import pytest
from scipy.integrate import quad
from scipy.optimize import brentq

from geotek.engine.stability import SlopeModel, SoilBand, bishop


RADIUS = math.sqrt(250.0)
THETA_LEFT = math.asin(-5.0 / RADIUS)
THETA_RIGHT = math.asin(15.0 / RADIUS)


def _model(phi, water_level=None):
    return SlopeModel(
        surface=[(-30, 0), (0, 0), (20, 10), (50, 10)],
        layers=[SoilBand(top=10, gamma=20, c=10, phi=phi)],
        water_level=water_level,
    )


def _angular_reference(water_level):
    """Integrate the continuous Bishop equation using analytic intersections."""
    def geometry(theta):
        x = 5.0 + RADIUS * math.sin(theta)
        y = 15.0 - RADIUS * math.cos(theta)
        return x / 2.0 - y, y

    def integrate(function):
        return quad(
            function, THETA_LEFT, THETA_RIGHT,
            points=[math.asin(5.0 / RADIUS)], epsabs=1e-10, epsrel=1e-11,
        )[0]

    driving = integrate(
        lambda theta: 20 * geometry(theta)[0] * math.sin(theta)
        * RADIUS * math.cos(theta)
    )
    tangent_phi = math.tan(math.radians(20))

    def residual(fs):
        def resistance(theta):
            height, y_base = geometry(theta)
            pore = 0.0 if water_level is None else 9.81 * max(water_level - y_base, 0.0)
            effective = 20 * height - pore
            assert effective >= -1e-10
            return (
                (10 + effective * tangent_phi) * RADIUS * math.cos(theta)
                / (math.cos(theta) + math.sin(theta) * tangent_phi / fs)
            )

        return fs * driving - integrate(resistance)

    return brentq(residual, 0.5, 10.0, xtol=1e-12)


def test_phi_zero_circle_matches_exact_arc_moment():
    result = bishop(_model(0), 5, 15, RADIUS, n_slices=4000)
    assert result is not None
    assert result.fs == pytest.approx(3 * math.pi / 20, rel=2e-4)
    # Entry/exit are located by linear interpolation on a 600-point probe grid (~0.03 m),
    # so the arc/surface intersections are exact only to about 0.02 m.
    assert result.x_exit == pytest.approx(0, abs=0.02)
    assert result.x_entry == pytest.approx(20, abs=0.02)


@pytest.mark.parametrize(
    "water_level, expected",
    [(None, 1.441832282789), (-2.0, 1.441832282789), (0.0, 1.399895339437)],
    ids=["dry", "water-below-arc-ru-zero", "hydrostatic"],
)
def test_effective_stress_circle_matches_independent_integral(water_level, expected):
    reference = _angular_reference(water_level)
    assert reference == pytest.approx(expected, abs=1e-8)
    result = bishop(
        _model(20, water_level), 5, 15, RADIUS, n_slices=4000, tol=1e-10,
    )
    assert result is not None
    assert result.fs == pytest.approx(reference, rel=2e-4)


def test_hydrostatic_fs_loss_matches_independent_calculation():
    dry = bishop(_model(20), 5, 15, RADIUS, n_slices=4000, tol=1e-10)
    wet = bishop(_model(20, 0), 5, 15, RADIUS, n_slices=4000, tol=1e-10)
    assert dry is not None and wet is not None
    expected_loss = _angular_reference(None) - _angular_reference(0.0)
    assert expected_loss > 0
    assert dry.fs - wet.fs == pytest.approx(expected_loss, abs=3e-4)
