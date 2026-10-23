"""Smart import of field and laboratory workbooks (xlsx/csv).

``analyze_workbook`` reads a file without storing anything and returns an ``ImportPlan``
(sheet roles, column mapping, units, open questions). After the engineer confirmed or
edited the plan, ``build_import`` converts the file into investigation records.
"""

from geotek.io.workbook.build import ImportResult, build_import
from geotek.io.workbook.detect import analyze_workbook, refresh_plan
from geotek.io.workbook.schema import ImportPlan

__all__ = ["ImportPlan", "ImportResult", "analyze_workbook", "build_import", "refresh_plan"]
