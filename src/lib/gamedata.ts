export const RANK_TITLES: Record<number, string> = {
  1:"SCOUT",2:"SCOUT II",3:"SCOUT III",4:"SCOUT IV",5:"TENDERFOOT",
  6:"TENDERFOOT II",7:"TENDERFOOT III",8:"TENDERFOOT IV",9:"TENDERFOOT V",
  10:"SECOND CLASS SCOUT",11:"SECOND CLASS SCOUT II",12:"SECOND CLASS SCOUT III",
  13:"SECOND CLASS SCOUT IV",14:"SECOND CLASS SCOUT V",15:"FIRST CLASS SCOUT",
  16:"FIRST CLASS SCOUT II",17:"FIRST CLASS SCOUT III",18:"FIRST CLASS SCOUT IV",
  19:"FIRST CLASS SCOUT V",20:"STAR SCOUT",21:"STAR SCOUT II",22:"STAR SCOUT III",
  23:"STAR SCOUT IV",24:"STAR SCOUT V",25:"LIFE SCOUT",26:"LIFE SCOUT II",
  27:"LIFE SCOUT III",28:"LIFE SCOUT IV",29:"LIFE SCOUT V",30:"EAGLE SCOUT",
  31:"EAGLE SCOUT II",32:"EAGLE SCOUT III",33:"EAGLE SCOUT IV",34:"EAGLE SCOUT V",
  35:"SURVIVAL EXPERT",36:"SURVIVAL EXPERT II",37:"SURVIVAL EXPERT III",
  38:"SURVIVAL EXPERT IV",39:"SURVIVAL EXPERT V",40:"PACK LEADER",
  41:"PACK LEADER II",42:"PACK LEADER III",43:"PACK LEADER IV",44:"PACK LEADER V",
  45:"HEADMASTER",46:"HEADMASTER II",47:"HEADMASTER III",48:"HEADMASTER IV",
  49:"HEADMASTER V",50:"VOYAGER"
};

export interface LureInfo { id: string; name: string; desc: string }
export const ALL_LURES: LureInfo[] = [
  { id: "", name: "Bare Hook", desc: "Simple fishhook" },
  { id: "fly_hook", name: "Fly Hook", desc: "Higher chance of smaller fish" },
  { id: "lucky_hook", name: "Lucky Hook", desc: "Gain cash on catch" },
  { id: "patient_lure", name: "Patient Lure", desc: "Catches wait for input" },
  { id: "quick_jig", name: "Quick Jig", desc: "Reel quicker + rod power" },
  { id: "salty_lure", name: "Salty Lure", desc: "Always saltwater fish" },
  { id: "fresh_lure", name: "Fresh Lure", desc: "Always freshwater fish" },
  { id: "efficient_lure", name: "Efficient Lure", desc: "Chance to not consume bait" },
  { id: "magnet_lure", name: "Magnet Lure", desc: "Higher treasure chance" },
  { id: "large_lure", name: "Large Lure", desc: "Higher chance of bigger fish" },
  { id: "attractive_angler", name: "Attractive Angler", desc: "Higher catch chance" },
  { id: "sparkling_lure", name: "Sparkling Lure", desc: "Greater tier chance" },
  { id: "double_hook", name: "Double Hook", desc: "Chance to double fish" },
  { id: "gold_hook", name: "Golden Hook", desc: "Rare fish chance (3x bait)" },
  { id: "challenge_lure", name: "Challenge Lure", desc: "Popup minigame for cash" },
  { id: "rain_lure", name: "Shower Lure", desc: "Chance to summon rain" },
];

export interface BaitInfo { id: string; name: string; cost: number }
export const ALL_BAIT: BaitInfo[] = [
  { id: "", name: "No Bait", cost: 0 },
  { id: "worms", name: "Worms", cost: 0 },
  { id: "cricket", name: "Crickets", cost: 20 },
  { id: "leech", name: "Leeches", cost: 50 },
  { id: "minnow", name: "Minnows", cost: 100 },
  { id: "squid", name: "Squid", cost: 200 },
  { id: "nautilus", name: "Nautiluses", cost: 500 },
  { id: "gildedworm", name: "Gilded Worm", cost: 1200 },
];

export const QUALITY_NAMES = ["Normal", "Shining", "Glistening", "Opulent", "Radiant", "Alpha"] as const;
export const QUALITY_COLORS = ["#d5aa73", "#e5f5f0", "#a49d9c", "#008583", "#e69d00", "#cd0462"] as const;

export const KNOWN_TAGS = [
  "first_join", "spectral", "completed_tutorial",
  "journal_all", "journal_0", "journal_1", "journal_2", "journal_3", "journal_4", "journal_5"
] as const;

export const STEAM_ACHIEVEMENTS = [
  "catch_single_fish", "catch_100_fish", "10k_cash",
  "rank_5", "rank_25", "rank_50",
  "camp_tier_2", "camp_tier_3", "camp_tier_4",
  "spectral_rod",
  "journal_normal", "journal_shining", "journal_glistening", "journal_opulent", "journal_radiant", "journal_alpha"
] as const;

export const JOURNAL_ZONES = ["lake", "ocean", "rain", "water_trash", "alien", "void"] as const;

export const LOAN_DATA: Record<number, number> = { 0: 250, 1: 2500, 2: 10000, 3: 10000 };

export const SAVE_PATH_HINT = "%APPDATA%\\Godot\\app_userdata\\webfishing_2_newver\\";

// Game limits (from playerdata.gd)
export const MAX_INVENTORY_SIZE = 10000;
export const MAX_ACCESSORY_SLOTS = 4;
export const MAX_QUALITY = 5;
export const MAX_LEVEL = 50;

// XP required to advance from `level` to the next rank.
// Replicates playerdata.gd: _get_xp_goal(level)
//   return 100 + ((level - 1) * 50) + stepify(level * level * 0.15 * 75, 50)
export function getXpGoal(level: number): number {
  const raw = level * level * 0.15 * 75;
  const stepped = Math.round(raw / 50) * 50; // stepify(x, 50)
  return 100 + (level - 1) * 50 + stepped;
}

// Quality worth multipliers (from QUALITY_DATA in playerdata.gd)
export const QUALITY_WORTH = [1.0, 1.8, 4.0, 6.0, 10.0, 15.0] as const;

// Size-category sell multipliers (from _get_item_worth in playerdata.gd)
const SIZE_MULTIPLIERS: [number, number][] = [
  [0.1, 1.75], [0.25, 0.6], [0.5, 0.8], [1.0, 1.0],
  [1.5, 1.5], [2.0, 2.5], [3.0, 4.25],
];

// Compute the actual sell worth of an item, matching the game's _get_item_worth().
// Items with generate_worth=true (the default) compute value from tier & loot_weight.
// Items with generate_worth=false use the raw sellValue from the resource file.
export function getItemWorth(
  opts: { sellValue: number; tier: number; lootWeight: number; generateWorth: boolean },
  size: number,
  averageSize: number,
  quality: number,
): number {
  let value: number;
  if (opts.generateWorth) {
    const t = 1.0 + 0.25 * opts.tier;
    const w = opts.lootWeight;
    value = Math.pow(5 * t, 2.5 - w);
    if (w < 0.4) value *= 1.1;
    if (w < 0.15) value *= 1.25;
    if (w < 0.05) value *= 1.5;
  } else {
    value = opts.sellValue;
  }
  // Size multiplier
  const sizeRatio = averageSize > 0 ? size / averageSize : 1.0;
  let mult = 1.0;
  for (const [threshold, m] of SIZE_MULTIPLIERS) {
    if (threshold > sizeRatio) break;
    mult = m;
  }
  const q = Math.max(0, Math.min(quality, MAX_QUALITY));
  return Math.ceil(value * mult * QUALITY_WORTH[q]);
}
