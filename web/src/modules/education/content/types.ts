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
  | { type: "warn"; text: L }
  | { type: "derivation"; title: L; steps: { text: L; expr?: string }[] }
  | {
      type: "worked";
      title: L;
      given: L[];
      steps: { label: L; expr: string; result: string }[];
      /** Same input run through the program; `output` is what the program returned. */
      program: { input: string; output: string; note?: L };
    }
  | { type: "quiz"; items: { q: L; a: L }[] }
  | { type: "mistakes"; items: L[] }
  | { type: "glossary"; items: { term: L; def: L }[] }
  | { type: "reading"; items: string[] };

export interface Topic {
  id: string;
  title: L;
  summary: L;
  level: "basic" | "intermediate" | "advanced";
  /** Repo files the content was derived from (verified against code). */
  codeRefs: string[];
  /** Human-readable literature references. */
  sources: string[];
  /** Engineer layer: how the program computes this (equations, assumptions, sources). */
  blocks: Block[];
  /** Student layer: textbook-style teaching. When absent only `blocks` is shown. */
  student?: Block[];
}
