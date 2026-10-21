import { Arrow, C, Line, Svg, T } from "./plot";

const Ground = ({ y = 120, x1 = 20, x2 = 380 }) => (
  <rect x={x1} y={y} width={x2 - x1} height={250 - y} fill={C.soil} opacity={0.6} />
);

export function BearFailureWedge() {
  return (
    <Svg label="Bearing capacity failure wedges">
      <Arrow /><Ground y={90} />
      <rect x={150} y={70} width={100} height={20} fill={C.wall} />
      <Line x1={200} y1={20} x2={200} y2={68} arrow /><T x={206} y={34}>Q, M</T>
      <path d="M150 90 L200 150 L250 90 Z" fill={C.a} opacity={0.35} stroke={C.a} />
      <path d="M150 90 Q110 150 200 150" fill="none" stroke={C.c} strokeWidth={1.5} />
      <path d="M250 90 Q290 150 200 150" fill="none" stroke={C.c} strokeWidth={1.5} />
      <path d="M150 90 L110 120 L90 90 Z" fill={C.d} opacity={0.35} stroke={C.d} />
      <path d="M250 90 L290 120 L310 90 Z" fill={C.d} opacity={0.35} stroke={C.d} />
      <Line x1={150} y1={105} x2={250} y2={105} dash="3 3" /><T x={200} y={118} anchor="middle">B′</T>
      <T x={200} y={130} anchor="middle">φ</T><T x={196} y={175}>c, γ, φ</T>
      <Line x1={330} y1={90} x2={330} y2={70} /><T x={336} y={82}>q</T>
    </Svg>
  );
}

export function EpActivePassive() {
  return (
    <Svg label="Active and passive earth pressure on a wall">
      <Arrow />
      <rect x={180} y={30} width={14} height={200} fill={C.wall} />
      <rect x={194} y={30} width={186} height={200} fill={C.soil} opacity={0.6} />
      <rect x={20} y={130} width={160} height={100} fill={C.soil} opacity={0.6} />
      <polygon points="194,60 194,130 250,130 194,60" fill="none" />
      <polygon points="194,50 194,230 290,230" fill={C.b} opacity={0.3} stroke={C.b} />
      <polygon points="180,130 180,230 100,230 180,130" fill={C.a} opacity={0.3} stroke={C.a} />
      <Line x1={194} y1={50} x2={194} y2={230} /><T x={300} y={225} color={C.b}>σa = Ka σ′v − 2c√Ka</T>
      <T x={30} y={222} color={C.a}>σp = Kp σ′v + 2c√Kp</T>
      <Line x1={260} y1={150} x2={196} y2={150} arrow color={C.b} /><T x={264} y={154}>Pa</T>
      <Line x1={60} y1={180} x2={178} y2={180} arrow color={C.a} /><T x={30} y={184}>Pp</T>
      <line x1={194} y1={60} x2={380} y2={60} stroke={C.water} strokeDasharray="4 3" /><T x={340} y={55}>▽</T>
    </Svg>
  );
}

export function WallStabilityChecks() {
  return (
    <Svg label="Retaining wall stability checks">
      <Arrow /><Ground y={190} />
      <polygon points="150,60 190,60 215,190 120,190 120,170 150,170" fill={C.wall} opacity={0.8} />
      <rect x={215} y={60} width={165} height={130} fill={C.soil} opacity={0.6} />
      <Line x1={300} y1={90} x2={222} y2={90} arrow color={C.b} /><T x={304} y={94}>ΣH</T>
      <Line x1={168} y1={20} x2={168} y2={80} arrow /><T x={174} y={30}>ΣV</T>
      <path d="M120 190 A 20 20 0 0 0 100 170" fill="none" stroke={C.d} strokeWidth={2} markerEnd="url(#ah)" />
      <T x={30} y={165} color={C.d}>M_O vs M_R</T><T x={30} y={180} color={C.d}>FS = ΣM_R / ΣM_O</T>
      <T x={170} y={224} anchor="middle">e = B/2 − x̄,  q_max,min = ΣV/B · (1 ± 6e/B)</T>
      <T x={170} y={238} anchor="middle">FS_slide = ΣV tanδ / ΣH</T>
    </Svg>
  );
}

export function SpCantilever() {
  return (
    <Svg label="Cantilever sheet pile wall">
      <Arrow />
      <rect x={20} y={100} width={360} height={140} fill={C.soil} opacity={0.6} />
      <rect x={178} y={20} width={202} height={80} fill={C.soil} opacity={0.6} />
      <rect x={170} y={20} width={8} height={220} fill={C.wall} />
      <Line x1={192} y1={80} x2={192} y2={20} dash="3 3" /><T x={198} y={55}>H</T>
      <Line x1={192} y1={100} x2={192} y2={232} dash="3 3" /><T x={198} y={170}>D</T>
      <polygon points="178,20 178,100 250,100" fill={C.b} opacity={0.3} stroke={C.b} />
      <polygon points="170,100 170,200 90,200" fill={C.a} opacity={0.3} stroke={C.a} />
      <T x={100} y={95}>▽</T><T x={30} y={150} color={C.a}>pasif</T><T x={250} y={130} color={C.b}>aktif</T>
      <circle cx={174} cy={200} r={4} fill="currentColor" /><T x={110} y={216}>D₀, R (Blum)</T>
    </Svg>
  );
}

export function SpNetDiagram() {
  return (
    <Svg label="Net pressure, shear and moment diagram">
      <Arrow />
      <Line x1={60} y1={20} x2={60} y2={240} />
      <polygon points="60,20 60,100 130,100" fill={C.b} opacity={0.3} stroke={C.b} />
      <polygon points="60,100 60,170 130,170 130,100" fill="none" />
      <polygon points="60,100 130,100 60,170" fill={C.a} opacity={0.3} stroke={C.a} />
      <T x={60} y={252} anchor="middle">net p</T>
      <Line x1={200} y1={20} x2={200} y2={240} /><polyline fill="none" stroke={C.c} strokeWidth={2} points="200,20 250,100 200,170 160,230" />
      <T x={200} y={252} anchor="middle">V = 0 ⇒ M_max</T>
      <Line x1={310} y1={20} x2={310} y2={240} /><polyline fill="none" stroke={C.d} strokeWidth={2} points="310,20 350,100 310,230" />
      <T x={310} y={252} anchor="middle">M</T>
    </Svg>
  );
}

export function SpPassiveFactor() {
  return (
    <Svg label="Passive pressure with safety factor">
      <Arrow /><Line x1={200} y1={20} x2={200} y2={240} />
      <polygon points="200,60 200,230 90,230" fill={C.a} opacity={0.25} stroke={C.a} />
      <polygon points="200,60 200,230 145,230" fill={C.d} opacity={0.4} stroke={C.d} />
      <T x={70} y={246}>GS = 1</T><T x={140} y={216} color={C.d}>GS = 1,5</T>
      <polygon points="200,40 200,230 300,230" fill={C.b} opacity={0.25} stroke={C.b} />
      <T x={280} y={246}>aktif</T>
    </Svg>
  );
}

export function SlopeBishopSlice() {
  return (
    <Svg label="Bishop method slices">
      <Arrow />
      <polygon points="20,160 130,160 250,90 380,90 380,240 20,240" fill={C.soil} opacity={0.6} />
      <path d="M110 150 A 120 120 0 0 0 290 95" fill="none" stroke={C.b} strokeWidth={2} />
      {[140, 170, 200, 230, 260].map((x) => <Line key={x} x1={x} y1={x < 200 ? 140 : 100} x2={x} y2={x < 200 ? 200 - Math.abs(x - 170) / 3 : 200 - Math.abs(x - 215) / 3} color={C.grid} />)}
      <circle cx={200} cy={20} r={3} fill="currentColor" /><Line x1={200} y1={20} x2={150} y2={155} dash="3 3" /><T x={160} y={80}>R</T>
      <T x={206} y={22}>O</T><T x={150} y={185}>W, α, u</T><T x={300} y={85} color={C.a}>q</T>
      <line x1={20} y1={175} x2={380} y2={175} stroke={C.water} strokeDasharray="4 3" />
    </Svg>
  );
}

export function SlopeSearchDomain() {
  return (
    <Svg label="Slip circle search domain">
      <polygon points="20,160 130,160 250,90 380,90 380,240 20,240" fill={C.soil} opacity={0.6} />
      {[0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((j) => <circle key={`${i}${j}`} cx={150 + i * 28} cy={40 + j * 22} r={2.5} fill={C.grid} />))}
      <circle cx={178} cy={62} r={5} fill={C.b} /><T x={186} y={58}>F_min</T>
      <path d="M100 160 A 130 130 0 0 0 290 92" fill="none" stroke={C.b} strokeWidth={2} />
      <Line x1={100} y1={172} x2={150} y2={172} color={C.a} /><T x={100} y={186}>teğet y</T>
    </Svg>
  );
}

export function AnchorTieForce() {
  return (
    <Svg label="Anchored sheet pile tie force">
      <Arrow />
      <rect x={20} y={80} width={150} height={160} fill={C.soil} opacity={0.6} />
      <rect x={20} y={20} width={150} height={60} fill="var(--mantine-color-body)" />
      <rect x={170} y={20} width={8} height={220} fill={C.wall} />
      <polygon points="178,20 178,80 230,80" fill={C.b} opacity={0.3} stroke={C.b} />
      <line x1={178} y1={40} x2={330} y2={90} stroke="currentColor" strokeWidth={3} />
      <Line x1={178} y1={40} x2={120} y2={40} arrow color={C.a} /><T x={90} y={36}>T</T>
      <circle cx={178} cy={40} r={4} fill={C.a} /><T x={184} y={36}>z_a</T>
      <circle cx={174} cy={170} r={4} fill="currentColor" /><T x={110} y={186}>D₀</T>
      <T x={250} y={62}>θ</T><T x={250} y={110}>P = T·s / cos θ</T>
    </Svg>
  );
}

export function SpAnchoredMoment() {
  return (
    <Svg label="Shear and moment with anchor">
      <Arrow />
      <Line x1={90} y1={20} x2={90} y2={240} /><polyline fill="none" stroke={C.c} strokeWidth={2} points="90,20 140,60 140,110 90,170 60,230" />
      <T x={90} y={252} anchor="middle">V (−T)</T>
      <Line x1={260} y1={20} x2={260} y2={240} /><polyline fill="none" stroke={C.d} strokeWidth={2} points="260,20 300,110 260,230" />
      <T x={260} y={252} anchor="middle">M_max</T>
    </Svg>
  );
}

export function ShearKeyPlanes() {
  return (
    <Svg label="Shear key sliding planes">
      <Arrow /><Ground y={170} />
      <polygon points="120,40 160,40 200,170 90,170" fill={C.wall} opacity={0.8} />
      <rect x={90} y={170} width={110} height={20} fill={C.wall} />
      <rect x={90} y={190} width={30} height={30} fill={C.wall} />
      <rect x={200} y={40} width={180} height={130} fill={C.soil} opacity={0.6} />
      <rect x={200} y={170} width={180} height={50} fill={C.soil} opacity={0.6} />
      <Line x1={60} y1={170} x2={230} y2={170} color={C.a} dash="5 3" /><T x={232} y={174} color={C.a}>1</T>
      <Line x1={60} y1={220} x2={230} y2={220} color={C.b} dash="5 3" /><T x={232} y={224} color={C.b}>2</T>
      <Line x1={300} y1={120} x2={206} y2={120} arrow color={C.b} /><T x={304} y={124}>Pa</T>
      <Line x1={300} y1={195} x2={206} y2={195} arrow color={C.d} /><T x={304} y={199}>ΔH diş</T>
      <Line x1={60} y1={205} x2={88} y2={205} arrow color={C.c} /><T x={20} y={209}>Pp</T>
    </Svg>
  );
}

export function SlopeSurchargeWedge() {
  return (
    <Svg label="Sloping backfill and surcharge wedge">
      <Arrow />
      <rect x={20} y={200} width={360} height={40} fill={C.soil} opacity={0.6} />
      <polygon points="150,200 150,60 380,10 380,200" fill={C.soil} opacity={0.6} />
      <rect x={136} y={60} width={14} height={180} fill={C.wall} />
      {[190, 230, 270, 310, 350].map((x) => <Line key={x} x1={x} y1={52 - (x - 190) * 0.22 - 22} x2={x} y2={52 - (x - 190) * 0.22} arrow color={C.a} />)}
      <T x={200} y={22} color={C.a}>q</T>
      <polygon points="150,200 150,60 300,200" fill={C.d} opacity={0.3} stroke={C.d} />
      <path d="M150 60 L230 40" fill="none" stroke="none" /><T x={260} y={190} color={C.d}>ψ</T>
      <T x={200} y={72}>β</T>
      <Line x1={118} y1={130} x2={148} y2={130} arrow color={C.b} /><T x={90} y={134}>Pa</T>
    </Svg>
  );
}

export function AnchorBondFreeLength() {
  return (
    <Svg label="Ground anchor free and bond length">
      <Arrow />
      <rect x={20} y={20} width={360} height={220} fill={C.soil} opacity={0.6} />
      <rect x={60} y={20} width={10} height={220} fill={C.wall} />
      <line x1={70} y1={60} x2={310} y2={140} stroke={C.grid} strokeWidth={1.5} />
      <line x1={70} y1={60} x2={230} y2={113} stroke="currentColor" strokeWidth={2} />
      <line x1={230} y1={113} x2={330} y2={146} stroke={C.b} strokeWidth={7} />
      <line x1={70} y1={240} x2={230} y2={20} stroke={C.d} strokeDasharray="5 3" />
      <T x={110} y={78}>L serbest</T><T x={250} y={132} color={C.b}>L kök</T>
      <T x={200} y={36} color={C.d}>45° + φ′/2</T><T x={74} y={52}>θ</T>
    </Svg>
  );
}

export function AnchoredWallEnvelopes() {
  return (
    <Svg label="Apparent pressure envelopes for anchored walls">
      <rect x={30} y={30} width={8} height={200} fill={C.wall} />
      {[70, 120, 170].map((y) => <g key={y}><circle cx={38} cy={y} r={4} fill={C.a} /></g>)}
      <polygon points="38,30 150,30 150,200 38,230" fill={C.b} opacity={0.25} stroke={C.b} />
      <polygon points="230,30 360,30 360,230 230,230 " fill="none" />
      <polygon points="230,30 300,30 300,200 230,230" fill={C.c} opacity={0.25} stroke={C.c} />
      <polygon points="230,30 340,70 340,200 230,230" fill={C.d} opacity={0.25} stroke={C.d} />
      <T x={94} y={246} anchor="middle" color={C.b}>kum: trapez</T><T x={290} y={246} anchor="middle">kil: yumuşak / sert</T>
      <T x={160} y={110}>p</T>
    </Svg>
  );
}

export function AnchoredWallHeave() {
  return (
    <Svg label="Base heave in clay">
      <Arrow />
      <rect x={20} y={20} width={110} height={90} fill={C.soil} opacity={0.6} />
      <rect x={270} y={20} width={110} height={90} fill={C.soil} opacity={0.6} />
      <rect x={20} y={110} width={360} height={130} fill={C.soil} opacity={0.9} />
      <rect x={126} y={20} width={8} height={130} fill={C.wall} /><rect x={266} y={20} width={8} height={130} fill={C.wall} />
      <Line x1={140} y1={116} x2={260} y2={116} dash="3 3" /><T x={200} y={106} anchor="middle">B</T>
      <path d="M140 116 Q200 220 260 116" fill="none" stroke={C.b} strokeWidth={2} />
      <Line x1={200} y1={150} x2={200} y2={118} arrow color={C.b} /><T x={206} y={140}>FS = Nc·Su,b / (γH + q)</T>
      <T x={30} y={60}>H</T><T x={290} y={200}>Su,b</T>
    </Svg>
  );
}
