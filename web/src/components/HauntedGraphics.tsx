// Stylized silhouette graphics for the location detail panel, chosen by
// structure type so a church looks different from a railroad, a mine, a
// castle, etc. All share a crimson-glow frame with a blood moon.

const DARK = "#070708";
const GLOW = "#36b39a";
const GLOW_BRIGHT = "#54d4ba";
const MOON = "#7d1d2b";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 140"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="hg-glow" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#bf2f43" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#5e1622" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#0a090b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="140" fill="#0a090b" />
      <rect width="240" height="140" fill="url(#hg-glow)" />
      <circle cx="186" cy="40" r="16" fill={MOON} opacity="0.85" />
      {children}
      <rect y="130" width="240" height="10" fill={DARK} />
    </svg>
  );
}

function House() {
  return (
    <g>
      <polygon points="90,78 120,56 150,78" fill={DARK} />
      <rect x="96" y="78" width="48" height="52" fill={DARK} />
      <rect x="134" y="46" width="7" height="16" fill={DARK} />
      <rect x="114" y="108" width="12" height="22" fill={DARK} />
      <rect x="102" y="86" width="9" height="10" fill={GLOW} opacity="0.9" />
      <rect x="130" y="86" width="9" height="10" fill={GLOW} opacity="0.9" />
      <rect x="116" y="62" width="8" height="8" fill={GLOW_BRIGHT} />
    </g>
  );
}

function Church() {
  return (
    <g>
      <polygon points="88,82 116,62 144,82" fill={DARK} />
      <rect x="92" y="82" width="48" height="48" fill={DARK} />
      <rect x="144" y="60" width="16" height="70" fill={DARK} />
      <polygon points="142,60 152,40 162,60" fill={DARK} />
      <rect x="150.5" y="29" width="3" height="13" fill={DARK} />
      <rect x="146" y="33" width="12" height="3" fill={DARK} />
      <rect x="110" y="110" width="12" height="20" fill={DARK} />
      <rect x="112" y="92" width="8" height="10" fill={GLOW_BRIGHT} />
    </g>
  );
}

function Train() {
  return (
    <g>
      <line x1="60" y1="127" x2="180" y2="127" stroke={DARK} strokeWidth="2" />
      <rect x="78" y="98" width="76" height="22" fill={DARK} />
      <rect x="128" y="84" width="28" height="16" fill={DARK} />
      <rect x="88" y="80" width="9" height="18" fill={DARK} />
      <polygon points="74,120 78,98 78,120" fill={DARK} />
      <circle cx="92" cy="122" r="6" fill={DARK} />
      <circle cx="116" cy="122" r="6" fill={DARK} />
      <circle cx="142" cy="122" r="6" fill={DARK} />
      <rect x="134" y="88" width="9" height="8" fill={GLOW_BRIGHT} />
    </g>
  );
}

function Factory() {
  return (
    <g>
      <rect x="80" y="94" width="86" height="36" fill={DARK} />
      <rect x="92" y="56" width="11" height="38" fill={DARK} />
      <rect x="110" y="64" width="11" height="30" fill={DARK} />
      <polygon points="80,94 88,86 96,94 104,86 112,94 120,86 128,94" fill={DARK} />
      {[88, 104, 120, 136, 152].map((x) => (
        <rect key={x} x={x} y="104" width="8" height="9" fill={GLOW} opacity="0.85" />
      ))}
    </g>
  );
}

function Asylum() {
  return (
    <g>
      <rect x="70" y="78" width="100" height="52" fill={DARK} />
      <rect x="110" y="62" width="20" height="16" fill={DARK} />
      <path d="M110,62 Q120,52 130,62 Z" fill={DARK} />
      {[0, 1, 2].map((row) =>
        [78, 94, 110, 126, 142, 154].map((x) => (
          <rect
            key={`${row}-${x}`}
            x={x}
            y={86 + row * 14}
            width="7"
            height="8"
            fill={GLOW}
            opacity="0.7"
          />
        )),
      )}
    </g>
  );
}

function Castle() {
  const merlons = (x: number, y: number, w: number) =>
    [0, 1, 2, 3].map((i) => (
      <rect key={i} x={x + i * (w / 4)} y={y - 6} width={w / 8} height="6" fill={DARK} />
    ));
  return (
    <g>
      <rect x="88" y="92" width="64" height="38" fill={DARK} />
      <rect x="76" y="78" width="18" height="52" fill={DARK} />
      <rect x="146" y="78" width="18" height="52" fill={DARK} />
      {merlons(76, 78, 18)}
      {merlons(146, 78, 18)}
      {merlons(94, 92, 52)}
      <path d="M112,130 L112,114 Q120,104 128,114 L128,130 Z" fill="#0a090b" />
      <rect x="82" y="88" width="5" height="9" fill={GLOW} opacity="0.8" />
      <rect x="152" y="88" width="5" height="9" fill={GLOW} opacity="0.8" />
    </g>
  );
}

function Mine() {
  return (
    <g>
      <g stroke={DARK} strokeWidth="5" fill="none">
        <path d="M104,130 L116,74 M136,130 L124,74 M114,74 L126,74" />
        <path d="M124,76 L152,110" />
        <path d="M110,100 L130,100" />
      </g>
      <circle cx="120" cy="72" r="9" fill={DARK} />
      <circle cx="120" cy="72" r="4" fill={MOON} />
      <rect x="96" y="104" width="50" height="26" fill={DARK} />
      <rect x="104" y="112" width="9" height="10" fill={GLOW} opacity="0.85" />
    </g>
  );
}

function Bunker() {
  return (
    <g>
      <path d="M82,130 L82,116 Q120,94 158,116 L158,130 Z" fill={DARK} />
      <rect x="108" y="116" width="28" height="4" fill={GLOW} opacity="0.85" />
      <line x1="150" y1="104" x2="150" y2="86" stroke={DARK} strokeWidth="2" />
    </g>
  );
}

function Ruins() {
  return (
    <g fill={DARK}>
      <rect x="88" y="72" width="42" height="8" />
      <rect x="90" y="80" width="10" height="50" />
      <rect x="110" y="80" width="10" height="50" />
      <rect x="130" y="92" width="10" height="38" />
      <rect x="148" y="84" width="10" height="46" />
      <polygon points="148,84 158,84 153,76" />
      <rect x="96" y="126" width="60" height="4" />
    </g>
  );
}

function Graveyard() {
  return (
    <g fill={DARK}>
      <rect x="116" y="92" width="6" height="38" />
      <rect x="106" y="100" width="26" height="6" />
      <path d="M88,130 L88,108 Q97,98 106,108 L106,130 Z" />
      <path d="M138,130 L138,114 Q145,106 152,114 L152,130 Z" />
    </g>
  );
}

const GRAPHICS: Record<string, () => JSX.Element> = {
  religious: Church,
  rail: Train,
  factory: Factory,
  hospital: Asylum,
  castle: Castle,
  mine: Mine,
  military: Bunker,
  ruins: Ruins,
  residential: House,
};

export function CategoryGraphic({ structureType }: { structureType: string }) {
  const Shape = GRAPHICS[structureType] ?? Graveyard;
  return (
    <Frame>
      <Shape />
    </Frame>
  );
}
