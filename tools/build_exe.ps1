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

# Second package: folder build (exe + unpacked libraries) next to the source code, zipped.
# Starts faster, needs no temp extraction, and kaynak\ lets the program run from source.
$pkg = "dist\GeoTek-kaynakli"
Remove-Item -Recurse -Force $pkg, "dist\GeoTek-kaynakli.zip" -ErrorAction SilentlyContinue
python -m PyInstaller --noconfirm --clean --onedir --name GeoTek `
  --distpath "$pkg" --workpath build\onedir `
  --paths . `
  --add-data "$((Resolve-Path web/dist).Path);web_dist" `
  --collect-data geotek `
  --collect-submodules uvicorn `
  @options `
  tools/geotek_exe.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller (onedir) failed." }
$src = "$pkg\kaynak"
New-Item -ItemType Directory -Force $src | Out-Null
foreach ($item in "geotek", "tools", "tests", "examples", "docs", "pyproject.toml", "README.md", "CLAUDE.md") {
  if (Test-Path $item) { Copy-Item $item "$src\$item" -Recurse -Force }
}
New-Item -ItemType Directory -Force "$src\web" | Out-Null
foreach ($item in "src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "postcss.config.cjs") {
  if (Test-Path "web\$item") { Copy-Item "web\$item" "$src\web\$item" -Recurse -Force }
}
Copy-Item web\dist "$src\web\dist" -Recurse -Force
Get-ChildItem $src -Recurse -Directory -Force -Include __pycache__, node_modules | Remove-Item -Recurse -Force
Copy-Item tools\package_readme.txt "$pkg\OKUBENI.txt"
Copy-Item tools\kaynaktan_calistir.bat "$pkg\kaynaktan_calistir.bat"
Compress-Archive -Path "$pkg\*" -DestinationPath "dist\GeoTek-kaynakli.zip" -Force
Write-Host "Done: dist\GeoTek-kaynakli.zip"
