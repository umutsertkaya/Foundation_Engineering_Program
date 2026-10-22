"""Read-only scope/provenance inventory; run with PYTHONPATH=. from repository root.
Enumeration is not an engineering validation. File/line locations are snapshot-specific.
"""
import ast, dataclasses, json, pathlib, re
from geotek.engine import anchor_tables
OUT=pathlib.Path(__file__).resolve().parent
roots=['geotek/engine/sheet_pile.py','geotek/engine/anchored_wall.py','geotek/engine/anchors.py','geotek/engine/anchor_tables.py','geotek/engine/limit_state.py',
       'geotek/core/models/walls.py','geotek/core/models/anchors.py','geotek/services/walls_basic.py','geotek/services/walls_advanced.py','geotek/services/structures.py']
roots+=sorted(str(p) for p in pathlib.Path('geotek/engine/walls').glob('*.py'))
rows=[]
for path in roots:
    t=ast.parse(pathlib.Path(path).read_text())
    symbols=[]; constants=[]
    for node in ast.walk(t):
        if isinstance(node,(ast.ClassDef,ast.FunctionDef,ast.AsyncFunctionDef)):
            symbols.append(dict(name=node.name,line=node.lineno,end=node.end_lineno,kind=type(node).__name__,doc=ast.get_docstring(node)))
        if isinstance(node,ast.Assign) and any(isinstance(x,ast.Name) and x.id.isupper() for x in node.targets):
            constants.append(dict(name=ast.unparse(node.targets[0]),line=node.lineno,expression=ast.unparse(node.value)))
    rows.append(dict(file=path,symbols=symbols,constants=constants,review='enumerated; consult report method matrix for numerical coverage'))
education=[]
names=('sheet_pile','sheet_pile_student','anchors','anchors_student','ground_anchors','ground_anchors_student','anchored_wall','anchored_wall_student','shear_key','shear_key_student')
for name in names:
    path=f'web/src/modules/education/content/{name}.ts'
    lines=pathlib.Path(path).read_text().splitlines()
    education.append(dict(file=path,formula_or_numeric_lines=[dict(line=i,text=line.strip()) for i,line in enumerate(lines,1) if 'expr:' in line or 'result:' in line or ('type: "example"' in line) or 'sources:' in line]))
tables=dict(tendons=[dataclasses.asdict(v) for v in anchor_tables.TENDONS],transfer_loads=[dataclasses.asdict(v) for v in anchor_tables.TRANSFER_LOADS],
    minimum_free_length=anchor_tables.MIN_FREE_LENGTH,minimum_bond_length={str(k):v for k,v in anchor_tables.MIN_BOND_LENGTH.items()},
    minimum_horizontal_spacing=anchor_tables.MIN_HORIZONTAL_SPACING,typical_bond_length_max=anchor_tables.TYPICAL_BOND_LENGTH_MAX,
    inclination_range=anchor_tables.INCLINATION_RANGE,safety_factor_guidance=anchor_tables.SAFETY_FACTOR_GUIDANCE,
    source_review='Source labels copied from repository; no source PDF/text independently inspected this session')
result=dict(python=rows,education=education,anchor_tables=tables)
(OUT/'inventory.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
print(json.dumps(dict(files=len(rows),symbols=sum(len(r['symbols']) for r in rows),education_files=len(education),tendon_rows=len(tables['tendons']),transfer_rows=len(tables['transfer_loads']))))
