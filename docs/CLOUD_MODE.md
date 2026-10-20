# Çalışma kipleri: cihaz ve bulut

Geçerli kip `docs/MODE` dosyasındadır (`device` veya `cloud`). GitHub deposu
(`umutsertkaya/Foundation_Engineering_Program`, `main`) ortak kaynaktır; cihazdaki klasör bir çalışma kopyasıdır.

| | Cihaz kipi (varsayılan) | Bulut kipi |
|---|---|---|
| MCP | `geotek-codemap` + `ai-orchestrator` açık (`.mcp.json`) | Hiçbiri; `.mcp.json` boş |
| Claude işleri | Projects konusunda `Agent` alt ajanı | Aynı |
| Codex / Antigravity | `ai-orchestrator` ile cihazdan | Kullanılmaz (bulut ağı OpenAI'yi engelliyor; Gemini için `GEMINI_API_KEY` gerekir). Tablodaki S0–S4 işleri Claude modelleriyle yapılır. |
| Kod haritası | `code_map_*` MCP araçları | `rg` + dar satır aralığı; harita yenileme `node tools/run_python.cjs tools/gen_code_map.py` ve `--check` |
| Testler | Cihazda `.venv` | Bulut kabuğunda (aşağıda) |
| Git | Cihazda commit; push'u kullanıcı yapar | Konu dalda çalışır, GitHub'a push eder; birleştirme PR ile |

## Tek adımda geçiş

Kullanıcı "buluta geç" derse konu şefi şunu yapar:

1. Bu klasörün GitHub `main` ile aynı olduğundan emin ol (cihazda bekleyen commit varsa önce push edilmiş olmalı).
2. `python3 tools/set_mode.py cloud` çalıştır; `docs/STATUS.md` "Aktif iş" satırına "Kip: bulut" yaz; commit + push.
3. Yeni konular Claude alt ajanlarıyla çalışır; MCP araçları çağrılmaz.

Cihaza dönüş: `python3 tools/set_mode.py device`, commit, push; cihazda `git pull`.
`python3 tools/set_mode.py status` geçerli kipi yazar.

## Bulutta test ve harita (MCP'siz)

```bash
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install -e ".[dev,web,report]"
/tmp/venv/bin/python -m pytest -q          # ~5 dk
node tools/run_python.cjs tools/gen_code_map.py --check
npm --prefix web ci && npm --prefix web run typecheck && npm --prefix web test -- --run
```

Bulut ortamı geçicidir: iş bittikçe commit + push et, yoksa kaybolur. `.venv` ve `node_modules` depoya girmez.

## Bulut kipinde açık sınırlar

- Windows paketleme/gerçek ekran (insan onay kapıları) cihazda kalır; STATUS'ta işaretlenir.
- Codex/Antigravity gerekirse: bulut ağında `api.openai.com`, `auth.openai.com`, `chatgpt.com` izni ve
  `OPENAI_API_KEY` / `GEMINI_API_KEY` ortam sırları gerekir (kullanıcı ayarı); sonra `ai-orchestrator` uyarlanır.
