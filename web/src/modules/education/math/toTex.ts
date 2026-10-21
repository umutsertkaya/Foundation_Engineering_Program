/** Converts the plain-text formula notation used in content files into LaTeX for KaTeX. */

const BS = "\\";
const FUNCS = new Set(["sin", "cos", "tan", "cot", "exp", "max", "min", "log", "ln", "arctan", "atan"]);
const SYMBOLS: Record<string, string> = {
  "·": `${BS}cdot `, "×": `${BS}times `, "−": "-", "–": "-", "≤": `${BS}le `, "≥": `${BS}ge `, "≈": `${BS}approx `,
  "≠": `${BS}ne `, "°": `^{${BS}circ}`, "½": `${BS}tfrac{1}{2}`, "²": "^{2}", "³": "^{3}", "′": "'",
  "→": `${BS}to `, "±": `${BS}pm `, "Σ": `${BS}Sigma `, "∫": `${BS}int `, "Δ": `${BS}Delta `, "∞": `${BS}infty `,
  "%": `${BS}%`, "{": `${BS}{`, "}": `${BS}}`, "&": `${BS}&`, "#": `${BS}#`, "|": `${BS}vert `,
};
const LETTER = "A-Za-zÇĞİÖŞÜçğıöşü";
const GREEK = "α-ωΑ-Ωϕφ";

function word(w: string): string {
  if (FUNCS.has(w)) return `${BS}operatorname{${w === "atan" ? "arctan" : w}}`;
  if (/^[A-Z0-9]+$/.test(w)) return `${BS}mathrm{${w}}`;
  if (w.length >= 4 && /^[a-zçğıöşü]+$/.test(w)) return `${BS}text{${w}}`;
  return `${BS}mathit{${w}}`;
}

function inner(src: string): string {
  let s = src.replace(/(\d),(\d)/g, "$1{,}$2").replace(/<=/g, "≤").replace(/>=/g, "≥");
  s = s.replace(new RegExp(`([${GREEK}${LETTER}])̄`, "g"), `${BS}bar{$1}`);
  let out = "";
  const re = new RegExp(
    `(\\^\\([^)]*\\))|(\\^[0-9.]+(?:\\{,\\}[0-9]+)?)|(_[${LETTER}${GREEK}0-9,]+)|(√)|([${LETTER}]{2,})|(\\s{3,})|([\\s\\S])`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) out += `^{${m[1].slice(2, -1)}}`;
    else if (m[2]) out += `^{${m[2].slice(1)}}`;
    else if (m[3]) {
      const sub = m[3].slice(1);
      out += /^[A-Za-zÇĞİÖŞÜçğıöşü]{2,}$/.test(sub) ? `_{${BS}mathrm{${sub}}}` : `_{${sub.replace(/,/g, "{,}")}}`;
    } else if (m[4]) out += `${BS}sqrt`;
    else if (m[5]) out += word(m[5]) + " ";
    else if (m[6]) out += `${BS}quad `;
    else out += SYMBOLS[m[7]] ?? m[7];
  }
  return out;
}

/** `\sqrt` needs a braced argument: wrap the following parenthesised group or token. */
function fixSqrt(t: string): string {
  const key = `${BS}sqrt`;
  const tokRe = /^(\\[a-z]+\{[^}]*\}|[A-Za-zα-ωϕ0-9]+(?:'|_\{[^}]*\}|_[A-Za-z0-9])*(?:\^\{[^}]*\})?)/;
  let out = "", i = 0;
  while (i < t.length) {
    if (t.startsWith(key, i)) {
      let j = i + key.length;
      while (t[j] === " ") j++;
      if (t[j] === "(" || t[j] === "[") {
        const open = t[j], close = open === "(" ? ")" : "]";
        let d = 0, k = j;
        for (; k < t.length; k++) {
          if (t[k] === open) d++;
          else if (t[k] === close && --d === 0) break;
        }
        out += `${key}{${fixSqrt(t.slice(j + 1, k))}}`;
        i = k + 1;
        continue;
      }
      const tok = tokRe.exec(t.slice(j));
      if (tok) {
        out += `${key}{${tok[0]}}`;
        i = j + tok[0].length;
        continue;
      }
    }
    out += t[i++];
  }
  return out;
}

/** Trailing remarks (after 3+ spaces) that contain real words are set as upright text. */
function splitRemark(line: string): [string, string | null] {
  const m = /\s{3,}(\([^)]*[a-zçğıöşü]{4,}[^)]*\))\s*$/.exec(line);
  return m ? [line.slice(0, m.index), m[1]] : [line, null];
}

export function lineToTex(line: string): string {
  const [math, remark] = splitRemark(line.trimEnd());
  const t = fixSqrt(inner(math));
  return remark ? `${t}${BS}quad${BS}text{${remark.replace(/[\\{}$&#%_^~]/g, " ").replace(/([α-ωΑ-Ωϕ])/g, "$$$1$$")}}` : t;
}

export const toTexLines = (expr: string): string[] => expr.split("\n").map(lineToTex);
