"""Static ASTM D2487 base group names for symbols produced by the USCS engine.

Source: FHWA NHI-05-037, Table 4-13 and its dual-symbol notes:
https://www.fhwa.dot.gov/engineering/geotech/pubs/05037/04c.cfm
Names omit sample-dependent modifiers (e.g. 'with sand'). Turkish names are
translations; descriptions explain the base groups without adding classification rules.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class USCSName:
    group_name_en: str
    group_name_tr: str
    description: str


USCS_NAMES: dict[str, USCSName] = {
    "GW": USCSName(
        "Well-graded gravel", "İyi derecelenmiş çakıl",
        "Gravel with a broad particle-size distribution and little fines.",
    ),
    "GP": USCSName(
        "Poorly graded gravel", "Kötü derecelenmiş çakıl",
        "Gravel with a narrow or gap-graded particle-size distribution and little fines.",
    ),
    "GM": USCSName(
        "Silty gravel", "Siltli çakıl",
        "Gravel whose fines have silty behaviour.",
    ),
    "GC": USCSName(
        "Clayey gravel", "Killi çakıl",
        "Gravel whose fines have clayey behaviour.",
    ),
    "GC-GM": USCSName(
        "Silty, clayey gravel", "Siltli, killi çakıl",
        "Gravel whose fines fall in the silty-clay transition.",
    ),
    "SW": USCSName(
        "Well-graded sand", "İyi derecelenmiş kum",
        "Sand with a broad particle-size distribution and little fines.",
    ),
    "SP": USCSName(
        "Poorly graded sand", "Kötü derecelenmiş kum",
        "Sand with a narrow or gap-graded particle-size distribution and little fines.",
    ),
    "SM": USCSName(
        "Silty sand", "Siltli kum",
        "Sand whose fines have silty behaviour.",
    ),
    "SC": USCSName(
        "Clayey sand", "Killi kum",
        "Sand whose fines have clayey behaviour.",
    ),
    "SC-SM": USCSName(
        "Silty, clayey sand", "Siltli, killi kum",
        "Sand whose fines fall in the silty-clay transition.",
    ),
    "GW-GM": USCSName(
        "Well-graded gravel with silt", "Silt içeren iyi derecelenmiş çakıl",
        "Well-graded gravel with a secondary silty fines fraction.",
    ),
    "GW-GC": USCSName(
        "Well-graded gravel with clay", "Kil içeren iyi derecelenmiş çakıl",
        "Well-graded gravel with a secondary clayey fines fraction.",
    ),
    "GP-GM": USCSName(
        "Poorly graded gravel with silt", "Silt içeren kötü derecelenmiş çakıl",
        "Poorly graded gravel with a secondary silty fines fraction.",
    ),
    "GP-GC": USCSName(
        "Poorly graded gravel with clay", "Kil içeren kötü derecelenmiş çakıl",
        "Poorly graded gravel with a secondary clayey fines fraction.",
    ),
    "SW-SM": USCSName(
        "Well-graded sand with silt", "Silt içeren iyi derecelenmiş kum",
        "Well-graded sand with a secondary silty fines fraction.",
    ),
    "SW-SC": USCSName(
        "Well-graded sand with clay", "Kil içeren iyi derecelenmiş kum",
        "Well-graded sand with a secondary clayey fines fraction.",
    ),
    "SP-SM": USCSName(
        "Poorly graded sand with silt", "Silt içeren kötü derecelenmiş kum",
        "Poorly graded sand with a secondary silty fines fraction.",
    ),
    "SP-SC": USCSName(
        "Poorly graded sand with clay", "Kil içeren kötü derecelenmiş kum",
        "Poorly graded sand with a secondary clayey fines fraction.",
    ),
    "CL": USCSName(
        "Lean clay", "Düşük plastisiteli kil",
        "Inorganic clay in the low liquid-limit group.",
    ),
    "ML": USCSName(
        "Silt", "Silt",
        "Inorganic silt in the low liquid-limit group.",
    ),
    "CL-ML": USCSName(
        "Silty clay", "Siltli kil",
        "Fine-grained soil in the silty-clay transition.",
    ),
    "CH": USCSName(
        "Fat clay", "Yüksek plastisiteli kil",
        "Inorganic clay in the high liquid-limit group.",
    ),
    "MH": USCSName(
        "Elastic silt", "Elastik silt",
        "Inorganic silt in the high liquid-limit group.",
    ),
}
