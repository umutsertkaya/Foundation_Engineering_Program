import { Concrete, Fig, Force, K, Ln, Poly, Soil, Tx, linspace, useT, type Ctx } from "./kit";

/* More topic-specific figures: slope search, anchored-wall examples, seismic passive, β regions. */

/* ───────────── Slope stability ───────────── */

/** Search bounds for the circle centre and the tangent level; the critical circle is checked against the bounds. */
export function SlpSearchBounds() {
  const t = useT();
  const cx0 = 170, cx1 = 370, cy0 = 40, cy1 = 120;
  const pts = linspace(0, 1, 5).flatMap((u) => linspace(0, 1, 3).map((v): [number, number] => [cx0 + u * (cx1 - cx0), cy0 + v * (cy1 - cy0)]));
  const crit: [number, number] = [cx1, cy0 + 40];
  const R = 190, ty = 250;
  return (
    <Fig label="Search bounds for circle centres and tangent level">
      {(c) => (
        <>
          <polygon points="20,250 160,250 320,160 620,160 620,370 20,370" fill={c.soil} stroke={K.soilLine} />
          <rect x={cx0 - 24} y={cy0 - 24} width={cx1 - cx0 + 48} height={cy1 - cy0 + 48} fill="none" stroke={K.mut} strokeDasharray="6 4" />
          <rect x={cx0} y={cy0} width={cx1 - cx0} height={cy1 - cy0} fill={K.blue} fillOpacity={0.08} stroke={K.blue} strokeWidth={1.8} />
          {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={K.blue} fillOpacity={0.6} />)}
          <circle cx={crit[0]} cy={crit[1]} r={8} fill={K.red} />
          <path d={`M${crit[0] - Math.sqrt(R * R - (ty - crit[1]) ** 2)} ${ty} A ${R} ${R} 0 0 0 ${crit[0] + 120} 160`} fill="none" stroke={K.red} strokeWidth={3.2} />
          <Ln x1={20} y1={ty + 40} x2={620} y2={ty + 40} c={K.orange} w={1.6} d="6 4" /><Tx x={620} y={ty + 34} a="end" s={13} c={K.orange}>{t("teğet kotu sınırı (y_t)", "tangent level limit (y_t)")}</Tx>
          <Tx x={crit[0] + 14} y={crit[1] + 5} c={K.red} b>{t("kritik merkez: sınıra yapışık!", "critical centre: on the bound!")}</Tx>
          <Tx x={cx0} y={cy1 + 40} s={13} c={K.blue} b>{t("arama sınırı: x_c, y_c aralığı", "search bound: x_c, y_c range")}</Tx>
          <Tx x={14} y={20} b>{t("Arama sınırları sonucu belirler", "The search bounds control the result")}</Tx>
          <Tx x={14} y={392} s={13} c={K.mut}>{t("Kritik merkez sınırdaysa, gerçek kritik daire sınırın dışında olabilir: sınırı genişletip yeniden arayın.", "If the critical centre sits on the bound, the true critical circle may lie outside: widen the bound and search again.")}</Tx>
        </>
      )}
    </Fig>
  );
}

/** Mirrored (reversed) slope geometry: the solver assumes the mass slides toward -x. */
export function SlpReversedGeometry() {
  const t = useT();
  const panel = (x0: number, rev: boolean, c: Ctx) => {
    const gx = (v: number) => (rev ? x0 + 290 - v : x0 + v);
    const pts = [[10, 230], [90, 230], [190, 160], [290, 160], [290, 320], [10, 320]].map(([x, y]): [number, number] => [gx(x), y]);
    return (
      <g>
        <rect x={x0} y={34} width={300} height={330} fill="none" stroke={K.grid} rx={4} />
        <Tx x={x0 + 150} y={54} a="middle" b>{rev ? t("Ters yönlü geometri", "Reversed geometry") : t("Doğru yön (şev ayağı solda)", "Correct direction (toe on the left)")}</Tx>
        <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={c.soil} stroke={K.soilLine} />
        <Ln x1={rev ? x0 + 110 : x0 + 190} y1={110} x2={rev ? x0 + 190 : x0 + 110} y2={110} c={rev ? K.red : K.green} w={4} end={c.arrow(rev ? K.red : K.green)} />
        <Tx x={x0 + 150} y={98} a="middle" s={13} c={rev ? K.red : K.green}>{t("kayma yönü", "sliding direction")}</Tx>
        <Tx x={x0 + 150} y={290} a="middle" s={13} c={rev ? K.red : K.green} b>{rev ? t("Program −x varsayımıyla uyumsuz", "Conflicts with the solver's −x assumption") : t("Programın varsayımıyla uyumlu", "Matches the solver's assumption")}</Tx>
        {rev && <Tx x={x0 + 150} y={310} a="middle" s={13} c={K.red}>{t("hata: x koordinatlarını aynalayın", "error: mirror the x coordinates")}</Tx>}
      </g>
    );
  };
  return <Fig label="Reversed slope geometry">{(c) => <>{panel(14, false, c)}{panel(326, true, c)}</>}</Fig>;
}

/* ───────────── Anchored wall (free earth support) ───────────── */

const A = { g: 18, ka: 1 / 3, kp: 3, H: 5 };
function anchoredSolution(za: number) {
  const f = (D: number) => {
    const L = A.H + D;
    return 0.5 * A.ka * A.g * L * L * ((2 / 3) * L - za) - 0.5 * A.kp * A.g * D * D * (A.H + (2 / 3) * D - za);
  };
  let lo = 0.05, hi = 10;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
  const D = (lo + hi) / 2, L = A.H + D;
  return { D, T: 0.5 * A.ka * A.g * L * L - 0.5 * A.kp * A.g * D * D };
}

/** Effect of the anchor position: D0 and T for z_a = 0, 1, 2.5 m (H = 5 m) and the too-low anchor. */
export function AncPositionEffect() {
  const t = useT();
  const s = 28, top = 90, pw = 150;
  const cases: { za: number; bad?: boolean }[] = [{ za: 0 }, { za: 1 }, { za: 2.5 }, { za: 4.9, bad: true }];
  return (
    <Fig label="Effect of the anchor level on embedment and anchor force">
      {(c) => (
        <>
          {cases.map(({ za, bad }, i) => {
            const x0 = 8 + i * (pw + 6), wx = x0 + 44, sol = bad ? null : anchoredSolution(za), D = sol ? sol.D : 1.9, y = (z: number) => top + z * s;
            return (
              <g key={i}>
                <rect x={x0} y={34} width={pw} height={346} fill="none" stroke={bad ? K.red : K.grid} strokeDasharray={bad ? "6 4" : undefined} rx={4} />
                <Tx x={x0 + pw / 2} y={54} a="middle" b>{`z_a = ${t.n(za, za === 4.9 ? 1 : za % 1 ? 1 : 0)} m`}</Tx>
                <Soil x={wx + 6} y={top} w={pw - 56} h={(A.H + D) * s} c={c} />
                <Soil x={x0 + 6} y={y(A.H)} w={38} h={D * s} c={c} />
                <Concrete x={wx - 6} y={top - 12} w={12} h={(A.H + D) * s + 12} c={c} />
                <Ln x1={x0 + 6} y1={y(A.H)} x2={wx - 6} y2={y(A.H)} w={1.6} />
                <circle cx={wx} cy={y(za)} r={5} fill={bad ? K.red : K.green} />
                {!bad && <Ln x1={wx + 8} y1={y(za)} x2={wx + 72} y2={y(za)} c={K.green} w={3} end={c.arrow(K.green)} />}
                {sol ? (
                  <>
                    <Tx x={x0 + 8} y={y(A.H + D) + 28} s={13}>{`D₀ = ${t.n(sol.D, 2)} m`}</Tx>
                    <Tx x={x0 + 8} y={y(A.H + D) + 48} s={13} c={K.green} b>{`T = ${t.n(sol.T, 1)} kN/m`}</Tx>
                  </>
                ) : (
                  <>
                    <Tx x={x0 + pw / 2} y={y(A.H + D) + 28} a="middle" s={13} c={K.red} b>{t("hata:", "error:")}</Tx>
                    <Tx x={x0 + pw / 2} y={y(A.H + D) + 46} a="middle" s={13} c={K.red}>{t("ankraj çok alçak", "anchor too low")}</Tx>
                  </>
                )}
              </g>
            );
          })}
          <Tx x={8} y={20} b>{t("Ankraj yeri (H = 5 m, φ′ = 30°, γ = 18 kN/m³): ankraj aşağı indikçe D₀ küçülür, T büyür", "Anchor level (H = 5 m, φ′ = 30°, γ = 18 kN/m³): lower anchor → smaller D₀, larger T")}</Tx>
        </>
      )}
    </Fig>
  );
}

/** Shear and moment of the anchored wall for z_a = 1 m: the anchor force makes the shear jump; |M| peaks where V = 0. */
export function AncShearMoment() {
  const t = useT();
  const za = 1, { D, T } = anchoredSolution(za), L = A.H + D, n = 4000, dz = L / n;
  const net = (z: number) => A.ka * A.g * z - (z > A.H ? A.kp * A.g * (z - A.H) : 0);
  const V: number[] = [0], M: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const z = i * dz; let v = V[i - 1] + 0.5 * (net(z) + net(z - dz)) * dz;
    if (z - dz < za && za <= z) v -= T;
    V.push(v); M.push(M[i - 1] + 0.5 * (V[i] + V[i - 1]) * dz);
  }
  const iM = M.reduce((b, v, i) => (Math.abs(v) > Math.abs(M[b]) ? i : b), 0);
  const top = 70, s = 36, y = (z: number) => top + z * s;
  const xv = 250, xm = 450, sv = 0.9, sm = 2.2;
  const col = (x0: number, vals: number[], k: number, color: string, label: string) => (
    <g>
      <Ln x1={x0} y1={top - 8} x2={x0} y2={y(L) + 8} w={1.4} />
      <polyline fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2.4} points={[`${x0},${y(0)}`, ...vals.map((v, i) => `${x0 + v * k},${y(i * dz)}`), `${x0},${y(L)}`].join(" ")} />
      <Tx x={x0} y={top - 24} a="middle" b>{label}</Tx>
    </g>
  );
  return (
    <Fig label="Shear force and bending moment of an anchored wall" h={420}>
      {(c) => (
        <>
          <Soil x={14} y={y(A.H)} w={72} h={y(L) - y(A.H) + 10} c={c} />
          <Soil x={100} y={top} w={52} h={y(L) - top + 10} c={c} />
          <Concrete x={86} y={top - 14} w={14} h={y(L) - top + 14} c={c} />
          <circle cx={93} cy={y(za)} r={5} fill={K.green} />
          {[0, za, A.H, L].map((z, i) => <Ln key={i} x1={14} y1={y(z)} x2={620} y2={y(z)} c={K.mut} w={0.8} d="5 4" />)}
          <Tx x={16} y={y(A.H) - 6} s={13}>{t("kazı tabanı", "dredge line")}</Tx>
          {col(xv, V, sv, K.green, "V (kN/m)")}
          {col(xm, M, sm, K.orange, "M (kN·m/m)")}
                    <Tx x={xv + 10} y={y(za) - 8} s={13} c={K.red} b>{t(`T = ${t.n(T, 1)} (sıçrama)`, `T = ${t.n(T, 1)} (jump)`)}</Tx>
          <circle cx={xm + M[iM] * sm} cy={y(iM * dz)} r={6} fill={K.red} />
          <Tx x={xm + M[iM] * sm - 10} y={y(iM * dz) - 12} a="end" c={K.red} b>|M|max ≈ {t.n(Math.abs(M[iM]), 0)}</Tx>
          <Tx x={xm + M[iM] * sm - 10} y={y(iM * dz) + 6} a="end" c={K.red}>z = {t.n(iM * dz, 2)} m</Tx>
          <Tx x={14} y={y(L) + 34} s={14}>z_a = 1 m, H = 5 m, D₀ = {t.n(D, 2)} m, T = {t.n(T, 1)} kN/m</Tx>
          <Tx x={14} y={y(L) + 54} s={14} c={K.mut}>{t("V = 0 olan derinlikte |M| en büyüktür; uçta M = 0 (serbest uç).", "|M| peaks where V = 0; M = 0 at the toe (free end).")}</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Shear key seismic passive ───────────── */

export function KeyPassiveSeismic() {
  const t = useT();
  const panel = (x0: number, seismic: boolean, c: Ctx) => {
    const wx = x0 + 190, top = 100, h = 150, w1 = seismic ? 50 : 100;
    return (
      <g>
        <rect x={x0} y={34} width={300} height={330} fill="none" stroke={K.grid} rx={4} />
        <Tx x={x0 + 150} y={54} a="middle" b>{seismic ? t("Deprem: kayma için azaltılmış pasif", "Earthquake: reduced passive for sliding") : t("Statik pasif (tam)", "Static passive (full)")}</Tx>
        <Soil x={x0 + 8} y={top} w={wx - x0 - 14} h={h} c={c} />
        <Concrete x={wx - 6} y={top - 10} w={36} h={h + 10} c={c} />
        <Poly pts={[[wx - 6, top], [wx - 6 - w1, top], [wx - 6 - w1, top + h], [wx - 6, top + h]]} fill={seismic ? K.orange : K.blue} o={0.35} />
        <Force x1={wx - 6 - w1 - 26} y1={top + h / 2} x2={wx - 8} y2={top + h / 2} c={seismic ? K.orange : K.blue} arrow={c.arrow} w={3.4} label={seismic ? "P_pE" : "P_p"} lx={wx - w1 - 40} ly={top + h / 2 - 8} />
        <Tx x={x0 + 150} y={top + h + 34} a="middle" s={13}>{seismic ? t("(1 − k_v)·K_PE oranına göre azalır", "reduced by the (1 − k_v)·K_PE ratio") : t("σ_p = K_p·σ′v  (φ = 0: σ_v + 2·s_u)", "σ_p = K_p·σ′v  (φ = 0: σ_v + 2·s_u)")}</Tx>
        <Tx x={x0 + 150} y={top + h + 56} a="middle" s={13} c={K.mut} b>{seismic ? t("kayma kontrolünde kullanılan", "used in the sliding check") : t("yapısal talepte kullanılan (azaltılmamış)", "used for the structural demand (unreduced)")}</Tx>
      </g>
    );
  };
  return <Fig label="Static versus seismic passive resistance of the key">{(c) => <>{panel(14, false, c)}{panel(326, true, c)}</>}</Fig>;
}

/* ───────────── Sloping surcharge: seismic regions along β ───────────── */

export function SurBetaRegions() {
  const t = useT();
  const phi = 30, kh = 0.2, psi = (Math.atan(kh) * 180) / Math.PI, lim = phi - psi;
  const X = (b: number) => 70 + (b / 36) * 520, y = 150, h = 44;
  const ticks = [0, 10, 20, 30];
  return (
    <Fig label="Beta regions with and without a Mononobe-Okabe solution">
      {() => (
        <>
          <rect x={X(0)} y={y} width={X(lim) - X(0)} height={h} fill={K.green} fillOpacity={0.35} stroke={K.ink} />
          <rect x={X(lim)} y={y} width={X(phi) - X(lim)} height={h} fill={K.orange} fillOpacity={0.4} stroke={K.ink} />
          <rect x={X(phi)} y={y} width={X(36) - X(phi)} height={h} fill={K.red} fillOpacity={0.3} stroke={K.ink} />
          <Tx x={(X(0) + X(lim)) / 2} y={y + 26} a="middle" b>{t("Mononobe-Okabe geçerli", "Mononobe-Okabe valid")}</Tx>
          <Tx x={(X(lim) + X(phi)) / 2} y={y + 20} a="middle" s={13} b>TBDY</Tx>
          <Tx x={(X(lim) + X(phi)) / 2} y={y + 36} a="middle" s={13} b>16.24b</Tx>
          <Tx x={(X(phi) + X(36)) / 2} y={y + 26} a="middle" s={13} b c={K.red}>{t("hata", "error")}</Tx>
          {ticks.map((b) => <g key={b}><Ln x1={X(b)} y1={y + h} x2={X(b)} y2={y + h + 8} /><Tx x={X(b)} y={y + h + 26} a="middle">{b}°</Tx></g>)}
          <Ln x1={X(lim)} y1={y - 30} x2={X(lim)} y2={y + h + 8} c={K.orange} w={2.4} d="6 4" />
          <Tx x={X(lim)} y={y - 38} a="middle" c={K.orange} b>β = φ′ − ψ = {t.n(lim, 2)}°</Tx>
          <Ln x1={X(phi)} y1={y - 30} x2={X(phi)} y2={y + h + 8} c={K.red} w={2.4} d="6 4" />
          <Tx x={X(phi)} y={y - 38} a="middle" c={K.red} b>β = φ′ = 30°</Tx>
          <Tx x={X(36)} y={y + h + 26} a="end" b>β</Tx>
          <Tx x={14} y={26} b>{t("Eğim açısı β ve deprem: φ′ = 30°, k_h = 0,2", "Slope angle β and earthquake: φ′ = 30°, k_h = 0.2")}</Tx>
          <Tx x={14} y={y + h + 70} s={14}>ψ = arctan(k_h / (1 − k_v)) = {t.n(psi, 2)}°</Tx>
          <Tx x={14} y={y + h + 92} s={14} c={K.mut}>{t("β > φ′ − ψ olunca kama çözümü sınırsız büyür; katmanlı yolda TBDY 16.24b kullanılır.", "For β > φ′ − ψ the wedge solution grows without bound; the layered path uses TBDY 16.24b.")}</Tx>
          <Tx x={14} y={y + h + 112} s={14} c={K.mut}>{t("β > φ′ iken Rankine/kama çözümü yoktur: program hata verir.", "For β > φ′ there is no Rankine/wedge solution: the program stops with an error.")}</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Shear key: factor of safety on the candidate sliding planes ───────────── */

export function KeyFsBars() {
  const t = useT();
  const bars = [
    { v: 1.56, a: t("diş yok", "no key"), b: t("taban yüzeyi", "base plane"), c: K.mut },
    { v: 1.85, a: t("diş var", "with key"), b: t("taban yüzeyi", "base plane"), c: K.blue },
    { v: 1.66, a: t("diş var", "with key"), b: t("diş ucu düzlemi", "key-tip plane"), c: K.red },
  ];
  const X0 = 90, Y0 = 300, k = 110;
  return (
    <Fig label="Sliding factor of safety with and without a shear key">
      {() => (
        <>
          <Ln x1={X0} y1={Y0} x2={X0 + 500} y2={Y0} w={1.8} /><Ln x1={X0} y1={Y0} x2={X0} y2={60} w={1.8} />
          <Tx x={X0 - 8} y={Y0 - 1.5 * k + 5} a="end">1,5</Tx>
          <Ln x1={X0} y1={Y0 - 1.5 * k} x2={X0 + 500} y2={Y0 - 1.5 * k} c={K.orange} w={1.6} d="6 4" />
          <Tx x={X0 + 500} y={Y0 - 1.5 * k - 8} a="end" s={13} c={K.orange}>{t("örnek sınır FS = 1,50 (yönetmelik değeri değil)", "example limit FS = 1.50 (not a code value)")}</Tx>
          {bars.map((b, i) => {
            const x = X0 + 50 + i * 160, h = b.v * k;
            return (
              <g key={i}>
                <rect x={x} y={Y0 - h} width={90} height={h} fill={b.c} fillOpacity={0.45} stroke={K.ink} />
                <Tx x={x + 45} y={Y0 - h - 8} a="middle" b>{t.n(b.v, 2)}</Tx>
                <Tx x={x + 45} y={Y0 + 20} a="middle" s={13}>{b.a}</Tx>
                <Tx x={x + 45} y={Y0 + 38} a="middle" s={13}>{b.b}</Tx>
              </g>
            );
          })}
          <Tx x={14} y={26} b>{t("Kayma güvenliği: diş yokken ve varken", "Sliding safety without and with a key")}</Tx>
          <Tx x={14} y={Y0 + 66} s={13} c={K.mut}>{t("Referans duvar: küçük FS yöneten yüzeydir (dişli duvarda diş ucu düzlemi, FS = 1,66).", "Reference wall: the smaller FS governs (with a key, the key-tip plane, FS = 1.66).")}</Tx>
        </>
      )}
    </Fig>
  );
}
