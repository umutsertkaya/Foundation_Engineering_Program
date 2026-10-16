import json
from pathlib import Path

import pytest

from geotek import i18n
from geotek.config.codes import get_design_code, list_design_codes, require_factor
from geotek.core.errors import GeoTekError


def test_all_builtin_codes_load():
    codes = list_design_codes()
    assert {"asd", "ec7", "aashto_lrfd", "tbdy2018"} <= set(codes)
    for code in codes.values():
        assert code.label.tr and code.label.en


def test_asd_and_ec7_values():
    asd = get_design_code("asd")
    assert asd.safety_factors["sliding"]["static"] == 1.5
    da2 = get_design_code("ec7").combination("DA2")
    assert da2.resistance_factors["bearing"] == 1.4


def test_missing_factor_is_refused():
    tbdy = get_design_code("tbdy2018")
    assert tbdy.is_usable and tbdy.status == "partially_verified"
    assert tbdy.combination("TBDY-static").resistance_factors["bearing"] == 1.4
    value = tbdy.combination("TBDY-static").material_factors["tan_phi"]
    with pytest.raises(GeoTekError):
        require_factor(value, "tan_phi")


def test_user_code_overrides_builtin(tmp_path):
    (tmp_path / "asd_custom.yaml").write_text(
        "id: asd\nlabel: {tr: Özel, en: Custom}\napproach: global_fs\nreference: x\n"
        "status: draft\nsafety_factors: {sliding: {static: 1.3, seismic: 1.0}}\n",
        encoding="utf-8",
    )
    assert get_design_code("asd", [tmp_path]).safety_factors["sliding"]["static"] == 1.3


def test_catalogs_have_identical_keys():
    folder = Path(i18n.__file__).parent
    tr = json.loads((folder / "tr.json").read_text(encoding="utf-8"))
    en = json.loads((folder / "en.json").read_text(encoding="utf-8"))
    assert tr.keys() == en.keys()


def test_translate_with_fallback_and_format():
    assert i18n.t("term.depth", "tr") == "Derinlik"
    assert i18n.t("term.depth", "en") == "Depth"
    assert i18n.t("msg.import_ok", "en", count=5) == "5 rows imported."
    assert i18n.t("no.such.key", "tr") == "no.such.key"
