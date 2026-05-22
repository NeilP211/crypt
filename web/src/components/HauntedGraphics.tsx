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

function School() {
  return (
    <g>
      <rect x="74" y="86" width="92" height="44" fill={DARK} />
      <polygon points="104,74 120,62 136,74" fill={DARK} />
      <rect x="106" y="74" width="28" height="12" fill={DARK} />
      {[110, 118, 126].map((x) => (
        <rect key={x} x={x} y="86" width="3" height="44" fill="#0a090b" />
      ))}
      <rect x="116" y="108" width="8" height="22" fill={DARK} />
      {[0, 1].map((row) =>
        [80, 92, 140, 152].map((x) => (
          <rect key={`${row}-${x}`} x={x} y={92 + row * 16} width="7" height="9" fill={GLOW} opacity="0.8" />
        )),
      )}
      <line x1="120" y1="62" x2="120" y2="50" stroke={DARK} strokeWidth="2" />
      <polygon points="120,50 130,53 120,56" fill={MOON} />
    </g>
  );
}

function Theater() {
  return (
    <g>
      <rect x="80" y="78" width="80" height="52" fill={DARK} />
      <rect x="76" y="96" width="88" height="9" fill={DARK} />
      {[84, 96, 108, 132, 144, 156].map((x) => (
        <circle key={x} cx={x} cy="100.5" r="2" fill={GLOW_BRIGHT} />
      ))}
      <rect x="114" y="50" width="12" height="28" fill={DARK} />
      <rect x="116" y="54" width="8" height="20" fill={GLOW} opacity="0.6" />
      <path d="M112,130 L112,112 Q120,104 128,112 L128,130 Z" fill="#0a090b" />
    </g>
  );
}

function Hotel() {
  return (
    <g>
      <rect x="94" y="52" width="50" height="78" fill={DARK} />
      {[0, 1, 2, 3].map((r) =>
        [98, 108, 118, 128].map((x) => (
          <rect key={`${r}-${x}`} x={x} y={58 + r * 14} width="6" height="8" fill={GLOW} opacity="0.7" />
        )),
      )}
      <rect x="90" y="118" width="58" height="6" fill={DARK} />
      <rect x="144" y="56" width="7" height="40" fill={DARK} />
      <rect x="146" y="60" width="3" height="32" fill={MOON} />
      <rect x="112" y="118" width="14" height="12" fill="#0a090b" />
    </g>
  );
}

function Bridge() {
  return (
    <g stroke={DARK} strokeWidth="2.5" fill="none">
      <line x1="46" y1="106" x2="194" y2="106" />
      <line x1="60" y1="86" x2="180" y2="86" />
      <line x1="60" y1="86" x2="60" y2="106" />
      <line x1="180" y1="86" x2="180" y2="106" />
      <path d="M60,86 L84,106 L108,86 L132,106 L156,86 L180,106" />
      <path d="M60,106 L84,86 L108,106 L132,86 L156,106 L180,86" />
    </g>
  );
}

function Lighthouse() {
  return (
    <g>
      <polygon points="125,53 162,44 162,62" fill={GLOW} opacity="0.18" />
      <polygon points="115,53 78,44 78,62" fill={GLOW} opacity="0.18" />
      <polygon points="110,128 116,58 124,58 130,128" fill={DARK} />
      <rect x="112" y="78" width="16" height="5" fill={MOON} opacity="0.75" />
      <rect x="110" y="100" width="20" height="5" fill={MOON} opacity="0.75" />
      <rect x="113" y="48" width="14" height="10" fill={DARK} />
      <polygon points="111,48 129,48 120,40" fill={DARK} />
      <rect x="115" y="50" width="10" height="7" fill={GLOW_BRIGHT} />
      <path d="M96,130 Q120,120 144,130 Z" fill={DARK} />
    </g>
  );
}

function Jail() {
  return (
    <g>
      <rect x="80" y="82" width="100" height="48" fill={DARK} />
      {[88, 118, 148].map((x) => (
        <g key={x}>
          <rect x={x} y="92" width="14" height="16" fill={GLOW} opacity="0.55" />
          {[0, 1, 2].map((b) => (
            <rect key={b} x={x + 3 + b * 4} y="92" width="1.5" height="16" fill={DARK} />
          ))}
        </g>
      ))}
      <rect x="120" y="64" width="18" height="18" fill={DARK} />
      <rect x="124" y="68" width="10" height="10" fill={GLOW} opacity="0.6" />
      <rect x="122" y="112" width="16" height="18" fill="#0a090b" />
    </g>
  );
}

const GRAPHICS: Record<string, () => JSX.Element> = {
  graveyard: Graveyard,
  church: Church,
  school: School,
  hospital: Asylum,
  theater: Theater,
  hotel: Hotel,
  bridge: Bridge,
  lighthouse: Lighthouse,
  jail: Jail,
  factory: Factory,
  mine: Mine,
  rail: Train,
  castle: Castle,
  military: Bunker,
  house: House,
  ruins: Ruins,
};

// Ordered name keywords → graphic. The location *name* is far more specific
// than the coarse structure_type, so we classify from it first.
const NAME_RULES: [RegExp, string][] = [
  [/cemeter|graveyard|burial|\bgrave|tomb|\bcrypt|mausoleum/i, "graveyard"],
  [/jail|prison|penitentiar|reformatory|\bgaol|correctional/i, "jail"],
  [/hospital|asylum|sanator|sanitar|infirmary|insane|psychiatric/i, "hospital"],
  [/church|chapel|cathedral|abbey|monaster|convent|shrine|parish|temple|cemetery chapel/i, "church"],
  [/school|academ|college|universit|institute|seminary|dormitor/i, "school"],
  [/theat(?:er|re)|opera|playhouse|cinema|auditorium|amphitheat/i, "theater"],
  [/hotel|motel|\binn\b|tavern|saloon|\blodge|boarding|brothel/i, "hotel"],
  [/bridge|viaduct|trestle|overpass/i, "bridge"],
  [/lighthouse|light\s?station/i, "lighthouse"],
  [/mill|factory|works|foundr|furnace|refinery|\bplant\b|warehouse|brewery|distiller/i, "factory"],
  [/\bmine\b|colliery|quarry|mineshaft/i, "mine"],
  [/rail|train|depot|\bstation\b|locomotive|roundhouse|\bdepot/i, "rail"],
  [/bunker|arsenal|armory|battery|\bbase\b|barracks|military|naval|air\s?force/i, "military"],
  [/castle|fort\b|fortress|citadel|garrison|tower/i, "castle"],
  [/house|mansion|manor|estate|\bhome\b|residence|plantation|cabin|farmhouse|cottage|villa/i, "house"],
  [/ruin/i, "ruins"],
];

const STRUCT_FALLBACK: Record<string, string> = {
  religious: "church",
  rail: "rail",
  factory: "factory",
  hospital: "hospital",
  castle: "castle",
  mine: "mine",
  military: "military",
  residential: "house",
  ruins: "ruins",
};

/** Classify a location into a graphic/filter category from its name (most
 * specific) then its structure_type, defaulting to a graveyard. */
export function categoryOf(name: string, structureType: string): string {
  for (const [re, key] of NAME_RULES) {
    if (re.test(name ?? "")) return key;
  }
  return STRUCT_FALLBACK[structureType] ?? "graveyard";
}

// The categories used by both the detail graphic and the map filters.
export const CATEGORIES: { key: string; label: string }[] = [
  { key: "house", label: "House" },
  { key: "graveyard", label: "Cemetery" },
  { key: "church", label: "Church" },
  { key: "school", label: "School" },
  { key: "hospital", label: "Asylum" },
  { key: "theater", label: "Theater" },
  { key: "hotel", label: "Hotel" },
  { key: "jail", label: "Prison" },
  { key: "factory", label: "Factory" },
  { key: "mine", label: "Mine" },
  { key: "rail", label: "Railroad" },
  { key: "bridge", label: "Bridge" },
  { key: "lighthouse", label: "Lighthouse" },
  { key: "castle", label: "Castle" },
  { key: "military", label: "Military" },
  { key: "ruins", label: "Ruins" },
];

function pickGraphic(name: string, structureType: string): () => JSX.Element {
  return GRAPHICS[categoryOf(name, structureType)] ?? Graveyard;
}

export function CategoryGraphic({
  name,
  structureType,
}: {
  name: string;
  structureType: string;
}) {
  const Shape = pickGraphic(name ?? "", structureType ?? "");
  return (
    <Frame>
      <Shape />
    </Frame>
  );
}
