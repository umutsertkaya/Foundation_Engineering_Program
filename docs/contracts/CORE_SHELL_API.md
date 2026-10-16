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
| PUT | `/settings` | `AppSettings` (library_dir, language; recent ignored) | `AppSettings` |
| GET | `/library` | – | `LibraryEntry[]` (modified desc) |
| POST | `/library` | `NewProjectRequest` | `LibraryEntry` — creates the file **and opens it** as the current project |
| POST | `/library/{file}/open` | – | `SessionInfo` (also pushes to recent) |
| POST | `/library/{file}/duplicate` | – | `LibraryEntry` |
| POST | `/library/{file}/rename` | `{name: string}` | `LibraryEntry` |
| POST | `/library/{file}/export` | `{dest: string}` | `{path: string}` |
| DELETE | `/library/{file}` | – | `{trash_path: string}` (moves to `.trash`; refused with code `project_open` if it is the open project) |
| POST | `/library/import` | `{path: string}` | `LibraryEntry` |
| GET | `/session` | – | `SessionInfo` |
| POST | `/project/save` | – | `SessionInfo` (saves to the open library file) |
| POST | `/project/close` | – | `SessionInfo` (`open: false`) |
| GET | `/project` | – | `Project`; when nothing is open: 409 `{code: "no_project_open"}` |

Error codes: `no_project_open` (409), `invalid_file_name` (400), `not_found` (404), `project_open` (409), `invalid_project_file` (422).

The existing `/project/new` and `/project/open {path}` stay for compatibility (path-based, outside the library).
