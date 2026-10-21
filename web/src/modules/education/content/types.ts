/** Localised text; `en` falls back to `tr` when omitted. */
export interface L {
  tr: string;
  en?: string;
}

export type Block =
  | { type: "p"; text: L }
  | { type: "h"; text: L }
  | { type: "formula"; expr: string; caption: L; where?: L[] }
  | { type: "assumptions"; title: L; items: L[] }
  | { type: "steps"; title: L; items: L[] }
  | { type: "figure"; id: string; caption: L }
  | { type: "example"; title: L; text: L }
  | { type: "warn"; text: L };

export interface Topic {
  id: string;
  title: L;
  summary: L;
  level: "basic" | "intermediate" | "advanced";
  /** Repo files the content was derived from (verified against code). */
  codeRefs: string[];
  /** Human-readable literature references. */
  sources: string[];
  blocks: Block[];
}
