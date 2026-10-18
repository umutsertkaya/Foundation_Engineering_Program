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
| POST | `/m/liquefaction/run` | `LiquefactionSettingsDTO` | 202 `JobRef` — `profile_id` (optional) picks the soil profile for unit weights and the seismic GWT; null = the active profile (including the domain's first-profile fallback), none active: 409 `no_soil_source`; unknown id: 404 `not_found` |

Error codes: `no_project_open` (409), `no_soil_source` (409, `POST /structures` when manual soil and a selected/active profile are absent; `POST /m/liquefaction/run` when there is no selected/active profile), `invalid_file_name` (400), `not_found` (404), `project_open` (409), `invalid_project_file` (422), `file_exists` (409), `invalid_path` (400). Structure creation without a project soil source requires explicit manual `soil` with `source_profile_id: null`.

Export destination: an existing directory gets `<dir>/<file>`; otherwise a `dest` without a suffix gets `.gtk` appended; any other suffix is 400 `invalid_path` (the suffix is never replaced). An existing destination file is 409 `file_exists` unless `overwrite` is true. Writes are atomic (temp file + replace).

File names: the `.gtk` suffix is matched case-insensitively and names resolve case-insensitively on Windows (the on-disk spelling is returned in `LibraryEntry.file`). Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and names ending in a dot or space are 400 `invalid_file_name`. `open`/`create` leave the current session untouched when they fail; updating `recent` is best effort.

The existing `/project/new` and `/project/open {path}` stay for compatibility (path-based, outside the library).

## Calculation jobs

Wall sizing/checking, sheet pile design and liquefaction submit application-local jobs.
`GET /jobs/{job_id}` and `DELETE /jobs/{job_id}` return the declared `JobState`;
unknown or expired ids return 404 `not_found`, independently of the open project.
Success is `done` in `JobStatus`. Cancellation is cooperative: DELETE requests it,
and a running job becomes `cancelled` at its next progress callback or before writeback.
Cancelling a terminal job leaves its state unchanged. Progress never decreases.
The default runner has two worker threads and retains at most 256 finished jobs for
one hour; cleanup runs on completion and job operations. Jobs are not restart-persistent.

Calculation inputs are copied under the session lock at submission. Writeback checks
the same project object and unchanged input fingerprints under that lock. A changed
project, deleted resource or changed inputs fail the job with `stale_structure`,
`details.discarded=true`, and a null result; previous saved results remain untouched.
Wall sizing saves proposed geometry and fingerprints those resulting inputs.
Structures persist the finite JSON payload in `result` and its input fingerprint in
`result_hash`; both output fields are excluded from subsequent input fingerprints.
Liquefaction persists its payload, settings, selected profile and input hash in
`Project.modules["liquefaction"].data`. Sounding failures remain independent entries
in `LiquefactionResultDTO.errors`. Missing design factors are rejected synchronously
with HTTP 422 `missing_factors`, including provenance in `ApiError.missing_factors`.

For partial-factor sheet pile designs the flat `SheetPileResultDTO` uses the service's
embedment, moment and anchor-force envelopes. The curves and section modulus belong
to the governing moment case; D0 and toe force belong to the governing embedment
case. The result assumptions identify both cases.
