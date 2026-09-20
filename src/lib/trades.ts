export const TRADES = [
  {
    key: "plumber",
    name: "Plumber",
    keywords: [
      "plumb",
      "pipe",
      "pipes",
      "leak",
      "leaking",
      "faucet",
      "tap",
      "sink",
      "toilet",
      "drain",
      "water heater",
      "valve",
      "shower",
      "tub",
      "gcfi",
      "supply line",
      "p-trap",
      "ptrap",
      "sewer",
      "hot water",
      "cold water",
    ],
  },
  {
    key: "electrician",
    name: "Electrician",
    keywords: [
      "electric",
      "electrical",
      "outlet",
      "receptacle",
      "breaker",
      "panel",
      "wire",
      "wiring",
      "switch",
      "gfci",
      "gfi",
      "light fixture",
      "lighting",
      "junction",
      "conduit",
      "voltage",
      "circuit",
    ],
  },
  {
    key: "painter",
    name: "Painter",
    keywords: [
      "paint",
      "painter",
      "painting",
      "primer",
      "caulk",
      "caulking",
      "touch up",
      "touch-up",
      "scuff",
      "peeling",
      "wall color",
      "trim paint",
      "roller",
      "brush",
    ],
  },
  {
    key: "hvac",
    name: "HVAC",
    keywords: [
      "hvac",
      "furnace",
      "air conditioner",
      "ac unit",
      "a/c",
      "duct",
      "ductwork",
      "thermostat",
      "vent",
      "filter",
      "condenser",
      "heat pump",
      "air handler",
    ],
  },
  {
    key: "carpenter",
    name: "Carpenter",
    keywords: [
      "carpenter",
      "carpentry",
      "trim",
      "baseboard",
      "casing",
      "cabinet",
      "door hang",
      "door doesn't",
      "door does not",
      "jamb",
      "framing",
      "stud",
      "dry fit",
      "wood rot",
      "sill",
    ],
  },
  {
    key: "roofer",
    name: "Roofer",
    keywords: ["roof", "shingle", "flashing", "gutter", "downspout", "soffit", "fascia", "ridge", "leak in the roof"],
  },
  {
    key: "flooring",
    name: "Flooring",
    keywords: ["floor", "flooring", "tile", "grout", "hardwood", "lvp", "vinyl plank", "carpet", "subfloor"],
  },
  {
    key: "drywall",
    name: "Drywall",
    keywords: ["drywall", "sheetrock", "mud", "tape", "joint compound", "hole in the wall", "crack in the wall"],
  },
  {
    key: "mason",
    name: "Mason",
    keywords: ["mason", "brick", "block", "mortar", "concrete", "foundation", "stone"],
  },
  {
    key: "landscaper",
    name: "Landscaper",
    keywords: ["landscape", "landscaper", "yard", "lawn", "irrigation", "sprinkler", "fence", "grade", "grading"],
  },
  {
    key: "windows",
    name: "Windows & doors",
    keywords: ["window", "windows", "sliding door", "entry door", "weatherstrip", "lockset", "deadbolt", "screen"],
  },
] as const;

export type TradeKey = (typeof TRADES)[number]["key"] | "general";

export const GENERAL_TRADE = { key: "general" as const, name: "General" };

const TRADE_ORDER = [...TRADES.map((trade) => trade.name), GENERAL_TRADE.name];

export function tradeDisplayName(value: string) {
  const needle = value.trim().toLowerCase();
  if (!needle) return GENERAL_TRADE.name;
  const match = TRADES.find((trade) => trade.key === needle || trade.name.toLowerCase() === needle);
  if (match) return match.name;
  if (needle === "general") return GENERAL_TRADE.name;
  return value.trim();
}

export function classifyTrade(text: string, fallback = GENERAL_TRADE.name): string {
  const haystack = text.toLowerCase();
  let best = fallback;
  let bestScore = 0;
  for (const trade of TRADES) {
    let score = 0;
    for (const keyword of trade.keywords) {
      if (haystack.includes(keyword)) score += keyword.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = trade.name;
    }
  }
  return bestScore > 0 ? best : fallback;
}

export function sortTrades(names: string[]) {
  return [...names].sort((a, b) => {
    const ai = TRADE_ORDER.indexOf(a);
    const bi = TRADE_ORDER.indexOf(b);
    const av = ai === -1 ? TRADE_ORDER.length : ai;
    const bv = bi === -1 ? TRADE_ORDER.length : bi;
    if (av !== bv) return av - bv;
    return a.localeCompare(b);
  });
}
