# GeoTek — Geoteknik Mühendislik Yazılımı

Yerel/offline kullanım hedefleyen Python hesap motoru, FastAPI ve React/TypeScript arayüzü.
Dört modül: zemin, sıvılaşma, istinat duvarı ve palplanş. Eski PySide6 arayüzü geçiş boyunca korunur.

## Buradan başla

- **Ajan / Claude Code:** [CLAUDE.md](CLAUDE.md) → [güncel durum](docs/STATUS.md) → tek görev kartı.
- **Kodda yön bulma:** [mimari harita](docs/ARCHITECTURE.md); yeni modül için [modül rehberi](docs/MODULE_GUIDE.md).
- **İş dağıtımı:** [şef protokolü](docs/WORKFLOW.md).
- **Claude Code Projects:** [mevcut yerel projeyi bağlama](docs/CLAUDE_PROJECTS.md),
  [Projects alanına yapıştırılacak talimat](docs/PROJECT_INSTRUCTIONS.md).
- **Neler değişti / test kanıtı:** [2026-10-19 düzenleme raporu](docs/audit/2026-10-19-sadelestirme.md).

Zemin ve duvar web akışları uygulanmıştır. Sıvılaşma ve palplanş ilk web teslimleri de mevcuttur;
gerçek API/görsel kabul, rapor ve tek exe teslimi beklemektedir. Ayrıntılı durum yalnız `docs/STATUS.md` içinde tutulur.

Canlı kod ilişkileri: `node tools/run_python.cjs tools/code_map_view.py` →
`http://127.0.0.1:8766`. Görünüm kaynak değişince yenilenir; import, API çağrısı,
modül keşfi ve test bağlarını ayrı gösterir. Ajanlar aynı grafiği `geotek-codemap` MCP araçlarıyla sorgular.

## Çalıştırma (Windows / PowerShell)

Mevcut `.venv` ve `web/node_modules` ile iki terminal:

```powershell
# Gerçek API
.\.venv\Scripts\python.exe -m uvicorn geotek.api.app:create_app --factory --host 127.0.0.1 --port 8765
```

```powershell
# Gerçek API'ye bağlanan web
npm.cmd --prefix web run dev -- --host 127.0.0.1 --port 5173
```

Tarayıcı: `http://127.0.0.1:5173`. Yalnız arayüz demosu için `npm.cmd --prefix web run dev:mock`;
mock, gerçek mühendislik hesabı yapmaz. Mevcut PySide6 girişi: `.\.venv\Scripts\python.exe -m geotek.ui`.

Temiz ortam gerekirse Python >=3.11 ve Node/npm ile bağımlılıklar `pyproject.toml` ve
`web/package-lock.json` üzerinden kurulur: `python -m venv .venv`,
`.\.venv\Scripts\python.exe -m pip install -e '.[web,gui,dev]'`, `npm.cmd --prefix web ci`.
Normal proje kontrolleri bu kurulumları otomatik yapmaz.

## Kontroller

```powershell
.\.venv\Scripts\python.exe tools/project.py status
.\.venv\Scripts\python.exe tools/project.py brief F5-LIQ
.\.venv\Scripts\python.exe tools/project.py check quick
.\.venv\Scripts\python.exe tools/project.py check full
```

`backend`: pytest. `web`: typecheck + Vitest + build. `full`: indeks kontrolü + ikisi.
Kısa sonuç ekranda, ayrıntılı çıktı `.project/logs/` içindedir. Testleri aynı anda iki süreçte çalıştırmayın;
pytest geçici dizini ve test ortamı paylaşılır. Hedefli testler [mimari haritada](docs/ARCHITECTURE.md).

## Hesap ve kaynaklar

İç birimler: m, kN, kPa; CPT qc girişi MPa. `.gtk` sürümlü JSON proje formatıdır.
Katsayılar uydurulmaz; eksik girdiler açık gösterilir. Formül/katsayı değişikliği el hesabı,
regresyon ve iki bağımsız inceleme ister. [Katsayı doğrulama açıkları](docs/katsayi_dogrulama.md),
[duvar formül kaydı](docs/contracts/E4_FORMULAS.md), [doğrulama veri kaynakları](tests/verification/data/README.md).

Özgün planlar ve eski ajan anlaşmaları [baytları korunmuş arşivde](docs/archive/2026-10-19/README.md).
Aktif talimat veya güncel iş listesi olarak kullanılmaz.
