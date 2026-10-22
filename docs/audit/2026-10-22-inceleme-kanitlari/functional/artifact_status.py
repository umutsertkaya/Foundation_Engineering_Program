from pathlib import Path
import json
out=Path('/tmp/geotek-audit/functional')
for fname in ['lifecycle.json','discard-job.json','narrow-metrics.json']:
 p=out/fname
 if p.exists():print(fname,p.read_text()[:1500])
print('shots',len(list((out/'screenshots').glob('*.png'))))
