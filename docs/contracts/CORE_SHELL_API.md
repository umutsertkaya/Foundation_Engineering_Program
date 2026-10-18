# Core shell API contract (library, settings, modules, session)

Used by the start screen, launcher and module shell. Backend: `geotek/api/library_routes.py` + `geotek/api/session.py` (C5a/C5b). Web: `web/src/shared/api/core.ts` + mock `web/src/shared/api/mock/core.ts` (W2). Both sides must match this file.

All paths are under `/api`. Errors use the existing `ApiError` envelope `{code, message, details?}`.

## DTOs

```ts
interface LibraryEntry {            // geotek.library.LibraryEntry
  file: string;                     // bare file name inside the library, e.g. "caglayan-sev.gtk"
  name: string; number: string; engineer: string;
  modified: string;                 // ISO 8601 datetime
  size: number;                     // bytes
  schema_version: string | null;
  error: string | null;             // non-null when the file could not be read
}
interface AppSettings {             // geotek.library.AppSettings
  library_dir: string; language: "tr" | "en"; recent: string[];   // recent: absolute paths, most recent first, ≤ 10
}
interface ModuleInfo {              // from ModuleManifest
  id: string; version: string; title_key: string; description_key: string; icon: string; order: number;
}
interface SessionInfo {
  open: boolean; file: string | null;     // library file name of the open project
  dirty: boolean;                         // unsaved changes since open/save
}
interface NewProjectRequest {       // subset of ProjectMeta
  name: string; number?: string; engineer?: string; language?: "tr" | "en"; design_code?: string;
}
```

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/modules` | – | `ModuleInfo[]` sorted by order |
| GET | `/settings` | – | `AppSettings` |
| PUT | `/settings` | `AppSettings` (library_dir, language; recent ignored) | `AppSettings` — the new library directory is created first; failure is 400 `invalid_path` and the old settings stay |
| GET | `/library` | – | `LibraryEntry[]` (modified desc) |
| POST | `/library` | `NewProjectRequest` | `LibraryEntry` — creates the file **and opens it** as the current project |
| POST | `/library/{file}/open` | – | `SessionInfo` (also pushes to recent) |
| POST | `/library/{file}/duplicate` | – | `LibraryEntry` |
| POST | `/library/{file}/rename` | `{name: string}` | `LibraryEntry` |
| POST | `/library/{file}/export` | `{dest: string, overwrite?: boolean}` (default `false`) | `{path: string}` — never overwrites silently, see below |
| DELETE | `/library/{file}` | – | `{trash_path: string}` (moves to `.trash`; refused with code `project_open` if it is the open project) |
| POST | `/library/import` | `{path: string}` | `LibraryEntry` |
| GET | `/session` | – | `SessionInfo` |
| POST | `/project/save` | – | `SessionInfo` (saves to the open library file) |
| POST | `/project/close` | – | `SessionInfo` (`open: false`) |
| GET | `/project` | – | `Project`; when nothing is open: 409 `{code: "no_project_open"}` |
| GET | `/data/profiles` | – | `ProfileSummary[]` — read-only list of the open project's soil profiles (core, so modules such as walls need not import the soil module); 409 `no_project_open` when nothing is open |
| POST | `/m/liquefaction/run` | `LiquefactionSettingsDTO` | `JobRef` (501 stub) — `profile_id` (optional) picks the soil profile for unit weights and the seismic GWT; null = the active profile, none active: 409 `no_soil_source`; unknown id: 404 `not_found` |

Error codes: `no_project_open` (409), `no_soil_source` (409, `POST /structures` only, implemented in A1: `soil`, `profile_id` and the active profile are all absent, so the client must resend an explicit manual `soil` with `source_profile_id: null`), `invalid_file_name` (400), `not_found` (404), `project_open` (409), `invalid_project_file` (422), `file_exists` (409), `invalid_path` (400).

Export destination: an existing directory gets `<dir>/<file>`; otherwise a `dest` without a suffix gets `.gtk` appended; any other suffix is 400 `invalid_path` (the suffix is never replaced). An existing destination file is 409 `file_exists` unless `overwrite` is true. Writes are atomic (temp file + replace).

File names: the `.gtk` suffix is matched case-insensitively and names resolve case-insensitively on Windows (the on-disk spelling is returned in `LibraryEntry.file`). Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and names ending in a dot or space are 400 `invalid_file_name`. `open`/`create` leave the current session untouched when they fail; updating `recent` is best effort.

The existing `/project/new` and `/project/open {path}` stay for compatibility (path-based, outside the library).
