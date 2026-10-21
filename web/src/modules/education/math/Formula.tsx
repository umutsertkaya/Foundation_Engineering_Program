import katex from "katex";
import "katex/dist/katex.min.css";
import { lineToTex, toTexLines } from "./toTex";

function render(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: "ignore", trust: false });
  } catch {
    return "";
  }
}

/** Typeset formula (one KaTeX line per source line); falls back to the raw text if KaTeX rejects it. */
export function Formula({ expr, display = true }: { expr: string; display?: boolean }) {
  const lines = toTexLines(expr);
  const html = lines.map((l) => render(l, display));
  if (html.some((h) => !h)) return <code style={{ whiteSpace: "pre-wrap" }}>{expr}</code>;
  return (
    <div data-math style={{ overflowX: "auto", maxWidth: "100%" }}>
      {html.map((h, i) => <div key={i} dangerouslySetInnerHTML={{ __html: h }} />)}
    </div>
  );
}

const INLINE = /(?<![A-Za-zα-ωΑ-Ω0-9_])([A-Za-zα-ωΔΣϕφ]['′]?_(?:\{[^}]+\}|[A-Za-z0-9ğüşöçı]+(?:,[A-Za-z0-9]+)?)(?![A-Za-z_]))/g;

/** Prose with subscripted symbols (σ'_v, K_a, S_u,b) typeset inline; everything else stays text. */
export function Rich({ t }: { t: string }) {
  const parts = t.split(INLINE);
  if (parts.length === 1) return <>{t}</>;
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const html = render(lineToTex(p), false);
        return html ? <span key={i} dangerouslySetInnerHTML={{ __html: html }} /> : p;
      })}
    </>
  );
}
