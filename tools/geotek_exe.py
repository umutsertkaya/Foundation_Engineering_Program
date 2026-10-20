"""PyInstaller entry point: start the local GeoTek server and open the browser."""

from geotek.launcher import main

if __name__ == "__main__":
    raise SystemExit(main())
