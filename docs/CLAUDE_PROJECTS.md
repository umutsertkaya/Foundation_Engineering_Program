# GeoTek'i Claude Code Projects ile yürütme (kurulum)

Proje: **Foundation Engineering Program**. Kurallar `CLAUDE.md` ve `docs/WORKFLOW.md` içindedir; bu belge yalnız kurulumu anlatır.

## Nerede ne çalışır

| Yer | Erişim |
|---|---|
| Projects ana konuşması (koordinatör) | Konu açar ve izler; yerel MCP'ye erişmez. |
| Projects konusu (thread) | Bulut kapsayıcısında depo dalında çalışır, Claude alt ajanlarını `Agent` ile başlatır, PR açar; gerekirse cihazdaki onaylı klasöre erişir (cihaz kabuğu Linux VM'dir, Windows `.venv`, `codex.exe`, `agy.exe` çalıştıramaz). |
| Cihazdaki Claude Code oturumu (Remote Control) | Windows araçları, `ai-orchestrator`, `geotek-codemap`, testler ve Git. Konu bu oturumu başlatır. |

## MCP sunucuları

| Sunucu | Kayıt | Not |
|---|---|---|
| `geotek-codemap` | Depo `.mcp.json`; Codex `~/.codex/config.toml`; Antigravity `~/.gemini/config/mcp_config.json` | Kod haritası; `.claude/settings.json` ile önceden onaylı. |
| `ai-orchestrator` | Depo `.mcp.json` → `C:\Users\thebi\.ai-orchestrator-mcp\index.js` | Codex/Antigravity alt ajanları. Codex ve Antigravity'ye eklenmez (döngü olmasın). |

Değişiklik yedekleri: `index.js.bak-2026-10-20`, `config.toml.bak-2026-10-20`, `mcp_config.json.bak-2026-10-20`.

## Kurulum adımları

1. **Project settings > Memory > Project instructions** alanına [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md) metnini yapıştır.
2. Yeni konu cihaz klasörünü ister; Remote Control oturumu ilk kez başlarken izin kartını onayla.
3. Cihaz oturumunda `/mcp` ile iki sunucunun bağlı olduğunu gör; `orchestrator_status` çalıştır.

## Takılmayı ayırt etme

| Belirti | Kontrol |
|---|---|
| Konu "komut çalışıyor" diyor | `.project/logs/` ilerliyor mu bak; tam Python paketi ~6 dk sürebilir. Aynı işi ikinci konuya başlatma. |
| Alt ajan zaman aşımı | Varsayılan 900 sn (`ORCH_TIMEOUT_SEC`); süreç ağacı sonlandırılır. Yeni yazıcıdan önce diff'e bak. |
| MCP araçları yok | Oturum Projects bulutunda mı, cihazda mı? Yerel MCP yalnız cihaz oturumunda yüklenir. |
| Harita eski | `node tools/run_python.cjs tools/gen_code_map.py --check`; eskiyse yenile. |

Library'ye klasör eklemek canlı bağlantı değildir; kopyadır. Kod deposunu Library kopyasından yönetme.
