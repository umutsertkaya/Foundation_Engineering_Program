# Builds dist\GeoTek.exe (single file). Run from the repo root in PowerShell:
#   .\tools\build_exe.ps1
# Needs Python >=3.11 and Node/npm on PATH. Installs build dependencies, builds the web UI,
# then runs PyInstaller. Module packages and i18n catalogs come from tools/pyinstaller_modules.py,
# so a new module needs no change here.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

python -m pip install -e ".[report,package]" fastapi uvicorn
python tools/gen_module_index.py
python tools/pyinstaller_modules.py --check
if ($LASTEXITCODE -ne 0) { throw "Module index is stale." }

npm --prefix web ci
npm --prefix web run build

$options = @(python tools/pyinstaller_modules.py)
python -m PyInstaller --noconfirm --clean --onefile --name GeoTek `
  --paths . `
  --add-data "$((Resolve-Path web/dist).Path);web_dist" `
  --collect-data geotek `
  --collect-submodules uvicorn `
  @options `
  tools/geotek_exe.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed." }
Write-Host "Done: dist\GeoTek.exe"
