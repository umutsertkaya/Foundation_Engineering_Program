"""Source inventory only. Run from repository root; outputs beside this script."""
import ast, hashlib, json, pathlib, re, subprocess
root=pathlib.Path.cwd(); out=pathlib.Path(__file__).parent
engine=[*root.glob('geotek/engine/earth_pressure/*.py'),root/'geotek/engine/bearing.py',root/'geotek/engine/stability.py',root/'geotek/engine/walls/global_stability.py']
education=[root/f'web/src/modules/education/content/{n}.ts' for n in ['earth_pressure','ep_student_a','ep_student_b','bearing','bearing_student','slope','slope_student','sloping_surcharge','sloping_surcharge_student']]
figures=[root/f'web/src/modules/education/figures/{n}.tsx' for n in ['epDraw','bearDraw','spDraw','extraDraw','extraDraw2','index']]
inventory=[]
for path in engine:
    source=path.read_text(); tree=ast.parse(source)
    symbols=[]
    for node in tree.body:
        if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
            symbols.append(dict(name=node.name,line=node.lineno,end_line=node.end_lineno,public=not node.name.startswith('_'),arguments=ast.unparse(node.args)))
        elif isinstance(node,ast.ClassDef):
            symbols.append(dict(name=node.name,line=node.lineno,end_line=node.end_lineno,kind='class',fields=[n.target.id for n in node.body if isinstance(n,ast.AnnAssign) and isinstance(n.target,ast.Name)]))
            for method in node.body:
                if isinstance(method,ast.FunctionDef):symbols.append(dict(name=f'{node.name}.{method.name}',line=method.lineno,end_line=method.end_lineno,public=not method.name.startswith('_'),arguments=ast.unparse(method.args)))
    inventory.append(dict(path=str(path.relative_to(root)),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),symbols=symbols))
edu=[]
mapping=dict(re.findall(r'"([^"\n]+)":\s*(\w+)',(root/'web/src/modules/education/figures/index.tsx').read_text()))
for path in education:
    txt=path.read_text(); ids=re.findall(r'type:\s*"figure"\s*,\s*id:\s*"([^"]+)"',txt)
    edu.append(dict(path=str(path.relative_to(root)),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),figure_ids=ids,figure_symbols={i:mapping.get(i) for i in ids},formula_count=len(re.findall(r'type:\s*"formula"',txt)),worked_count=len(re.findall(r'type:\s*"worked"',txt))))
tests=[root/f'tests/unit/{n}.py' for n in ['test_earth_pressure','test_earth_pressure_crosscheck','test_bearing','test_stability','test_walls','test_walls_layered']]+[root/f'tests/verification/{n}.py' for n in ['test_earth_pressure_textbook','test_bearing_textbook','test_bishop_circle_hand','test_bishop_stability_number']]
testinventory=[dict(path=str(p.relative_to(root)),tests=re.findall(r'^def (test_\w+)\(',p.read_text(),re.M),execution='not rerun by B; runtime agent owns suite') for p in tests]
data=dict(commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),engine=inventory,education=edu,figures=[str(p.relative_to(root)) for p in figures],tests=testinventory,figure_occurrences=sum(len(e['figure_ids']) for e in edu),unique_figure_ids=sorted(set(i for e in edu for i in e['figure_ids'])))
(out/'inventory.json').write_text(json.dumps(data,indent=2))
print(json.dumps(dict(engine_files=len(inventory),public_callables=sum(s.get('public',False) for e in inventory for s in e['symbols']),education_files=len(edu),formula_blocks=sum(e['formula_count'] for e in edu),worked_blocks=sum(e['worked_count'] for e in edu),figure_occurrences=data['figure_occurrences'],unique_figures=len(data['unique_figure_ids']),unmapped=[i for e in edu for i,s in e['figure_symbols'].items() if not s]),indent=2))
