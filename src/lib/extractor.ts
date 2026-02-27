/**
 * Unified extraction module for WEBFISHING save editor.
 * Combines vanilla game data extraction + mod PCK scanning + Vite plugin.
 *
 * Usage:
 *   CLI:  bun src/lib/extractor.ts [gameDir]
 *   Vite: import { modScannerPlugin } from '$lib/extractor';
 */

import {
	readFileSync, writeFileSync, readdirSync, statSync,
	mkdirSync, existsSync, copyFileSync
} from 'fs';
import { join, basename, extname, resolve, dirname } from 'path';
import type { Plugin } from 'vite';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsedResource {
	id: string;
	name: string;
	description: string;
	category: string;
	iconPath: string;
	type: 'item' | 'cosmetic';
	sellValue: number;
	tier: number;
	lootTable: string;
	averageSize: number;
	lootWeight: number;
	cost: number;
	mod: string;
}

export interface ModItem {
	name: string;
	icon: string;
	type: string;
	category: string;
	loot_table: string;
	average_size: number;
	loot_weight: number;
	sell_value: number;
	tier: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared utilities
// ═══════════════════════════════════════════════════════════════════════════════

/** Recursively find files with a given extension */
export function findFiles(dir: string, ext: string): string[] {
	const ret: string[] = [];
	if (!existsSync(dir)) return ret;
	try {
		for (const file of readdirSync(dir)) {
			const fullPath = join(dir, file);
			try {
				if (statSync(fullPath).isDirectory()) {
					ret.push(...findFiles(fullPath, ext));
				} else if (file.endsWith(ext)) {
					ret.push(fullPath);
				}
			} catch { /* skip inaccessible */ }
		}
	} catch { /* skip inaccessible */ }
	return ret;
}

/** Resolve a Godot res:// path to an absolute filesystem path */
function resolveGamePath(gameDir: string, resPath: string): string {
	return join(gameDir, resPath.replace('res://', ''));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified .tres parser
// ═══════════════════════════════════════════════════════════════════════════════

/** Parse a .tres file content string into a ParsedResource (or null if not item/cosmetic) */
export function parseTresContent(content: string, tresPath: string): ParsedResource | null {
	const isItem = content.includes('item_resource.gd');
	const isCosmetic = content.includes('cosmetic_resource.gd');
	if (!isItem && !isCosmetic) return null;

	const id = basename(tresPath, '.tres');

	// Parse ext_resource declarations (handles both key orderings)
	const extResources: Record<string, { path: string; type: string }> = {};
	const extPattern = /\[ext_resource\s+(?:path="([^"]*)"[^\]]*type="([^"]*)"[^\]]*id=(\d+)|path="([^"]*)"[^\]]*id=(\d+))\]/g;
	let m;
	while ((m = extPattern.exec(content)) !== null) {
		if (m[1]) extResources[m[3]] = { path: m[1], type: m[2] };
		else if (m[4]) extResources[m[5]] = { path: m[4], type: '' };
	}

	// Get resource body
	const resourceMatch = content.match(/\[resource\]([\s\S]*)/);
	const body = resourceMatch ? resourceMatch[1] : content;

	// Resolve icon ExtResource path
	let iconPath = '';
	const iconMatch = body.match(/icon\s*=\s*ExtResource\(\s*(\d+)\s*\)/);
	if (iconMatch) {
		const ext = extResources[iconMatch[1]];
		if (ext) iconPath = ext.path;
	}

	if (isCosmetic) {
		const nameMatch = body.match(/^name\s*=\s*"((?:[^"\\]|\\.)*)"/m);
		const descMatch = body.match(/^desc\s*=\s*"((?:[^"\\]|\\.)*)"/m);
		const catMatch = body.match(/category\s*=\s*"([^"]*)"/);
		const costMatch = body.match(/cost\s*=\s*(\d+)/);
		return {
			id,
			name: nameMatch?.[1]?.replace(/\\"/g, '"') ?? id,
			description: descMatch?.[1]?.replace(/\\"/g, '"') ?? '',
			category: catMatch?.[1] ?? 'other',
			iconPath,
			type: 'cosmetic',
			sellValue: 0,
			tier: 0,
			lootTable: '',
			averageSize: 0,
			lootWeight: 0,
			cost: costMatch ? parseInt(costMatch[1]) : 0,
			mod: '',
		};
	}

	// Item resource
	const nameMatch = body.match(/item_name\s*=\s*"((?:[^"\\]|\\.)*)"/);
	const descMatch = body.match(/item_description\s*=\s*"((?:[^"\\]|\\.)*)"/);
	const lootMatch = body.match(/loot_table\s*=\s*"([^"]*)"/);
	const catMatch = body.match(/^category\s*=\s*"([^"]*)"/m);
	const avgSizeMatch = body.match(/average_size\s*=\s*([\d.]+)/);
	const lootWeightMatch = body.match(/loot_weight\s*=\s*([\d.]+)/);
	const sellValueMatch = body.match(/sell_value\s*=\s*([\d.]+)/);
	const tierMatch = body.match(/tier\s*=\s*(\d+)/);

	let category = catMatch?.[1] ?? 'unknown';
	if (category === 'unknown') {
		const pathLower = tresPath.toLowerCase();
		if (pathLower.includes('creature') || pathLower.includes('fish')) category = 'fish';
		else if (pathLower.includes('prop')) category = 'furniture';
		else if (pathLower.includes('item')) category = 'item';
	}

	return {
		id,
		name: nameMatch?.[1]?.replace(/\\"/g, '"') ?? id,
		description: descMatch?.[1]?.replace(/\\"/g, '"') ?? '',
		category,
		iconPath,
		type: 'item',
		sellValue: sellValueMatch ? parseFloat(sellValueMatch[1]) : 0,
		tier: tierMatch ? parseInt(tierMatch[1]) : 0,
		lootTable: lootMatch?.[1] ?? '',
		averageSize: avgSizeMatch ? parseFloat(avgSizeMatch[1]) : 0,
		lootWeight: lootWeightMatch ? parseFloat(lootWeightMatch[1]) : 0,
		cost: 0,
		mod: '',
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// PCK binary parser
// ═══════════════════════════════════════════════════════════════════════════════

/** Read a Godot .pck file and return a map of path → Buffer */
export function readPck(filepath: string): Map<string, Buffer> {
	const files = new Map<string, Buffer>();
	const buf = readFileSync(filepath);
	let offset = 0;

	const readU32 = () => { const v = buf.readUInt32LE(offset); offset += 4; return v; };
	const readU64 = () => { const v = Number(buf.readBigUInt64LE(offset)); offset += 8; return v; };
	const readBytes = (n: number) => { const v = buf.subarray(offset, offset + n); offset += n; return v; };

	const magic = buf.subarray(0, 4).toString('ascii');
	if (magic !== 'GDPC') return files;
	offset = 4;

	const packVersion = readU32();
	readU32(); readU32(); readU32(); // godot version

	if (packVersion >= 2) {
		readU32(); // flags
		readBytes(16 * 4); // reserved
	} else {
		readBytes(16 * 4);
	}

	const fileCount = readU32();
	const entries: [string, number, number][] = [];

	for (let i = 0; i < fileCount; i++) {
		const pathLen = readU32();
		const pathBuf = readBytes(pathLen);
		let path = '';
		for (let j = 0; j < pathLen; j++) {
			if (pathBuf[j] !== 0) path += String.fromCharCode(pathBuf[j]);
		}
		const fileOffset = readU64();
		const fileSize = readU64();
		readBytes(16); // md5
		if (packVersion >= 2) readU32(); // file flags
		entries.push([path, fileOffset, fileSize]);
	}

	for (const [path, fileOffset, fileSize] of entries) {
		files.set(path, buf.subarray(fileOffset, fileOffset + fileSize));
	}

	return files;
}

/** Extract a PNG (or WebP) image from a Godot .stex texture file */
export function extractPngFromStex(data: Buffer): Buffer | null {
	// Look for PNG signature
	const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const idx = data.indexOf(pngSig);
	if (idx >= 0) {
		const iend = data.indexOf('IEND', idx);
		if (iend >= 0) return data.subarray(idx, iend + 8);
		return data.subarray(idx);
	}

	// Look for WebP
	if (data.indexOf('RIFF') >= 0) {
		const riffIdx = data.indexOf('RIFF');
		if (data.subarray(riffIdx + 8, riffIdx + 12).toString('ascii') === 'WEBP') {
			const size = data.readUInt32LE(riffIdx + 4);
			return data.subarray(riffIdx, riffIdx + 8 + size);
		}
	}

	return null;
}

/** Find an image file in a PCK archive (tries direct match, .import redirect, basename search) */
export function findImageInPck(pckFiles: Map<string, Buffer>, iconPath: string): [string, Buffer] | null {
	if (pckFiles.has(iconPath)) return [iconPath, pckFiles.get(iconPath)!];

	// Try .import file to find .stex
	const importPath = iconPath + '.import';
	if (pckFiles.has(importPath)) {
		const importContent = pckFiles.get(importPath)!.toString('utf-8');
		const stexMatch = importContent.match(/dest_files=\["([^"]*)"/);
		const stexMatch2 = importContent.match(/path="([^"]*\.stex)"/);
		const stexPath = stexMatch?.[1] ?? stexMatch2?.[1];
		if (stexPath && pckFiles.has(stexPath)) {
			return [stexPath, pckFiles.get(stexPath)!];
		}
	}

	// Brute force: search by basename
	const base = basename(iconPath).replace(extname(iconPath), '');
	for (const [key, data] of pckFiles) {
		if (key.includes('.stex') && key.includes(base)) return [key, data];
	}
	for (const [key, data] of pckFiles) {
		if (key.endsWith('.png') && key.includes(base)) return [key, data];
	}

	return null;
}

/** Recursively find .pck files in a directory */
export function findPckFiles(dir: string): string[] {
	const results: string[] = [];
	if (!existsSync(dir)) return results;
	try {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			try {
				const stat = statSync(full);
				if (stat.isDirectory()) results.push(...findPckFiles(full));
				else if (entry.endsWith('.pck')) results.push(full);
			} catch { /* skip inaccessible */ }
		}
	} catch { /* skip inaccessible */ }
	return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GDScript data parser — extracts additional constants from .gd source files
// ═══════════════════════════════════════════════════════════════════════════════

export interface BadgeQuestData {
	location: string;
	count: number;
	goldReward: number;
	xpReward: number;
}

export interface BadgeLevelInfo {
	title: string;
	rewards: string[];
	quest: BadgeQuestData | null;
}

/** Parse BADGE_LEVEL_DATA from playerdata.gd to extract quest definitions */
export function parseBadgeLevelData(gdContent: string): Record<number, BadgeLevelInfo> {
	const result: Record<number, BadgeLevelInfo> = {};
	// Match each level entry: N: {"title": "...", ..., "quest": [...]}
	const levelPattern = /(\d+):\s*\{[^}]*"title":\s*"([^"]*)"[^}]*"reward":\s*\[([^\]]*)\][^}]*"quest":\s*\[([^\]]*)\]/g;
	let m;
	while ((m = levelPattern.exec(gdContent)) !== null) {
		const level = parseInt(m[1]);
		const title = m[2];
		const rewardStr = m[3].trim();
		const questStr = m[4].trim();

		const rewards = rewardStr
			? rewardStr.split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean)
			: [];

		let quest: BadgeQuestData | null = null;
		if (questStr) {
			const parts = questStr.split(',').map(s => s.trim().replace(/"/g, ''));
			if (parts.length >= 5) {
				quest = {
					location: parts[0],
					count: parseInt(parts[1]) || parseInt(parts[2]) || 0,
					goldReward: parseInt(parts[3]) || 0,
					xpReward: parseInt(parts[4]) || 0,
				};
			}
		}

		result[level] = { title, rewards, quest };
	}
	return result;
}

/** Parse BAIT_DATA from playerdata.gd to extract full descriptions */
export function parseBaitDescriptions(gdContent: string): Record<string, string> {
	const result: Record<string, string> = {};
	const baitPattern = /"(\w*)":\s*\{[^}]*"desc":\s*"([^"]*)"/g;
	const baitSection = gdContent.match(/const BAIT_DATA\s*=\s*\{([\s\S]*?)\n\}/);
	if (!baitSection) return result;
	let m;
	while ((m = baitPattern.exec(baitSection[1])) !== null) {
		result[m[1]] = m[2].replace(/\\n/g, '\n');
	}
	return result;
}

/** Parse LURE_DATA from playerdata.gd to extract effect IDs */
export function parseLureEffects(gdContent: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lurePattern = /"(\w*)":\s*\{[^}]*"effect_id":\s*"([^"]*)"/g;
	const lureSection = gdContent.match(/const LURE_DATA\s*=\s*\{([\s\S]*?)\n\}/);
	if (!lureSection) return result;
	let m;
	while ((m = lurePattern.exec(lureSection[1])) !== null) {
		result[m[1]] = m[2];
	}
	return result;
}

/** Parse rod upgrade costs from button_rod_upgrade.gd */
export function parseRodUpgradeCosts(gdContent: string): number[] {
	const m = gdContent.match(/var new_cost\s*=\s*\[([^\]]+)\]/);
	if (!m) return [];
	return m[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vanilla game data extraction (from decompiled source)
// ═══════════════════════════════════════════════════════════════════════════════

interface ExtractedData {
	items: Record<string, { name: string; category: string; icon: string | null; sellValue?: number; tier?: number; lootTable?: string }>;
	cosmetics: Record<string, { name: string; category: string; icon: string | null; cost?: number }>;
	allThings: Record<string, { name: string; category: string; icon: string | null }>;
	fishData: Record<string, { averageSize: number; lootWeight: number }>;
	badgeLevels: Record<number, BadgeLevelInfo>;
	baitDescriptions: Record<string, string>;
	lureEffects: Record<string, string>;
	rodUpgradeCosts: number[];
}

/** Extract all game data from a decompiled WEBFISHING source directory */
export function extractVanillaGameData(gameDir: string, iconsDir: string): ExtractedData {
	mkdirSync(iconsDir, { recursive: true });

	const items: ExtractedData['items'] = {};
	const cosmetics: ExtractedData['cosmetics'] = {};
	const allThings: ExtractedData['allThings'] = {};
	const fishData: ExtractedData['fishData'] = {};

	// Scan .tres resource files
	const resourceDir = join(gameDir, 'Resources');
	const tresFiles = findFiles(resourceDir, '.tres');
	let itemCount = 0;
	let cosmeticCount = 0;
	const iconsCopied = new Set<string>();

	for (const file of tresFiles) {
		const content = readFileSync(file, 'utf8');
		const data = parseTresContent(content, file);
		if (!data) continue;

		// Copy icon file (only actual image files, not .tres/.tscn etc.)
		const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.bmp'];
		let iconFile: string | null = null;
		if (data.iconPath) {
			const srcPath = resolveGamePath(gameDir, data.iconPath);
			const srcExt = extname(srcPath).toLowerCase();
			if (IMAGE_EXTS.includes(srcExt) && existsSync(srcPath)) {
				iconFile = basename(srcPath);
				const destPath = join(iconsDir, iconFile);
				if (!existsSync(destPath)) {
					copyFileSync(srcPath, destPath);
					iconsCopied.add(iconFile);
				}
			}
		}

		const entry = { name: data.name, category: data.category, icon: iconFile };
		allThings[data.id] = entry;

		if (data.type === 'item') {
			items[data.id] = {
				...entry,
				sellValue: data.sellValue || undefined,
				tier: data.tier || undefined,
				lootTable: data.lootTable || undefined,
			};
			// Collect fish data for simulation
			if (data.category === 'fish' && data.averageSize > 0) {
				fishData[data.id] = {
					averageSize: data.averageSize,
					lootWeight: data.lootWeight,
				};
			}
			itemCount++;
		} else {
			cosmetics[data.id] = {
				...entry,
				cost: data.cost || undefined,
			};
			cosmeticCount++;
		}
	}

	console.log(`  Extracted: ${itemCount} items, ${cosmeticCount} cosmetics, ${iconsCopied.size} icons`);

	// Parse additional data from GDScript sources
	let badgeLevels: Record<number, BadgeLevelInfo> = {};
	let baitDescriptions: Record<string, string> = {};
	let lureEffects: Record<string, string> = {};
	let rodUpgradeCosts: number[] = [];

	const playerDataPath = join(gameDir, 'Scenes', 'Singletons', 'playerdata.gd');
	if (existsSync(playerDataPath)) {
		const gdContent = readFileSync(playerDataPath, 'utf8');
		badgeLevels = parseBadgeLevelData(gdContent);
		baitDescriptions = parseBaitDescriptions(gdContent);
		lureEffects = parseLureEffects(gdContent);
		console.log(`  Parsed playerdata.gd: ${Object.keys(badgeLevels).length} badge levels, ${Object.keys(baitDescriptions).length} bait descriptions, ${Object.keys(lureEffects).length} lure effects`);
	}

	const rodUpgradePath = join(gameDir, 'Scenes', 'HUD', 'Shop', 'ShopButtons', 'button_rod_upgrade.gd');
	if (existsSync(rodUpgradePath)) {
		const rodContent = readFileSync(rodUpgradePath, 'utf8');
		rodUpgradeCosts = parseRodUpgradeCosts(rodContent);
		console.log(`  Parsed rod upgrades: ${rodUpgradeCosts.length} cost tiers`);
	}

	return { items, cosmetics, allThings, fishData, badgeLevels, baitDescriptions, lureEffects, rodUpgradeCosts };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TypeScript code generation
// ═══════════════════════════════════════════════════════════════════════════════

// Hardcoded game knowledge (cross-referenced from playerdata.gd, not parseable from .tres)
const DEV_COSMETICS = [
	"title_stupididiotbaby", "title_imnormal", "title_bipedalanimaldrawer",
	"pcolor_west", "title_lamedev", "title_lamedev_real",
	"scolor_midnight_special", "title_admiral", "title_candy",
	"title_hazard", "title_igloo", "title_nitrousoxide",
	"title_specialforces", "title_zed"
];

const CHEST_COSMETICS = [
	"overshirt_sweatshirt_yellow","overshirt_sweatshirt_white","overshirt_sweatshirt_teal","overshirt_sweatshirt_tan","overshirt_sweatshirt_salmon","overshirt_sweatshirt_red","overshirt_sweatshirt_purple","overshirt_sweatshirt_orange","overshirt_sweatshirt_olive","overshirt_sweatshirt_maroon","overshirt_sweatshirt_grey","overshirt_sweatshirt_green","overshirt_sweatshirt_brown","overshirt_sweatshirt_blue","overshirt_sweatshirt_black",
	"overshirt_overall_yellow",
	"overshirt_flannel_open_yellow","overshirt_flannel_open_white","overshirt_flannel_open_teal","overshirt_flannel_open_salmon","overshirt_flannel_open_red","overshirt_flannel_open_purple","overshirt_flannel_open_olive","overshirt_flannel_open_green","overshirt_flannel_open_blue","overshirt_flannel_open_black",
	"overshirt_flannel_closed_yellow","overshirt_flannel_closed_white","overshirt_flannel_closed_teal","overshirt_flannel_closed_salmon","overshirt_flannel_closed_red","overshirt_flannel_closed_purple","overshirt_flannel_closed_olive","overshirt_flannel_closed_green","overshirt_flannel_closed_blue","overshirt_flannel_closed_black",
	"undershirt_tshirt_yellow","undershirt_tshirt_white","undershirt_tshirt_teal","undershirt_tshirt_tan","undershirt_tshirt_salmon","undershirt_tshirt_red","undershirt_tshirt_purple","undershirt_tshirt_orange","undershirt_tshirt_olive","undershirt_tshirt_maroon","undershirt_tshirt_grey","undershirt_tshirt_green","undershirt_tshirt_brown","undershirt_tshirt_blue","undershirt_tshirt_black",
	"undershirt_tanktop_yellow","undershirt_tanktop_white","undershirt_tanktop_teal","undershirt_tanktop_tan","undershirt_tanktop_salmon","undershirt_tanktop_red","undershirt_tanktop_purple","undershirt_tanktop_orange","undershirt_tanktop_olive","undershirt_tanktop_maroon","undershirt_tanktop_grey","undershirt_tanktop_green","undershirt_tanktop_brown","undershirt_tanktop_blue","undershirt_tanktop_black",
	"undershirt_graphic_tshirt_smokemon","undershirt_graphic_tshirt_nobait","undershirt_graphic_tshirt_hooklite","undershirt_graphic_tshirt_goodboy","undershirt_graphic_tshirt_anchor",
	"nose_pierced","nose_button",
	"legs_pants_short_yellow","legs_pants_short_white","legs_pants_short_teal","legs_pants_short_tan","legs_pants_short_salmon","legs_pants_short_red","legs_pants_short_purple","legs_pants_short_orange","legs_pants_short_olive","legs_pants_short_maroon","legs_pants_short_grey","legs_pants_short_green","legs_pants_short_brown","legs_pants_short_blue","legs_pants_short_black",
	"legs_pants_long_yellow","legs_pants_long_white","legs_pants_long_teal","legs_pants_long_tan","legs_pants_long_salmon","legs_pants_long_red","legs_pants_long_purple","legs_pants_long_orange","legs_pants_long_olive","legs_pants_long_maroon","legs_pants_long_grey","legs_pants_long_green","legs_pants_long_brown","legs_pants_long_blue","legs_pants_long_black",
	"mouth_toothier","mouth_fishy","mouth_fangs","mouth_sabertooth","mouth_drool","mouth_distraught","mouth_jaws","mouth_hymn","mouth_happy","mouth_bucktoothed","mouth_grin","mouth_braces","mouth_grimace","mouth_bite",
	"title_yapper","title_goodgirl","title_trans","title_goodboy","title_goober","title_stinkerdinker","title_gay","title_bi","title_sillyguy","title_equalsthree","title_ace","title_queer","title_cryptid","title_puppy","title_creature","title_littlelad","title_lesbian","title_pan","title_lamedev","title_nonbinary","title_kitten","title_iscool",
	"accessory_glasses","accessory_bandaid","accessory_antlers","accessory_cig","accessory_collar_bell","accessory_collar","accessory_glasses_round","accessory_hook","accessory_shades","accessory_rain_boots_yellow",
	"eye_glare","eye_angry","eye_almond","eye_wings","eye_froggy","eye_starlight","eye_fierce","eye_squared","eye_distraught","eye_lenny","eye_sad","eye_inverted","eye_possessed","eye_haunted","eye_goat","eye_harper",
	"hat_cowboyhat_brown","hat_beanie_yellow","hat_beanie_white","hat_beanie_teal","hat_beanie_maroon","hat_beanie_green","hat_beanie_blue","hat_beanie_black","hat_baseball_cap_missing","hat_baseball_cap_sports","hat_baseball_cap_exclaim","hat_baseball_cap_mcd","hat_baseball_cap_big","hat_baseball_cap_green","hat_baseball_cap_pee","hat_baseball_cap_orange","hat_baseball_cap_size",
];

const QUEST_COSMETICS = [
	"title_pretty","pcolor_pink_special","title_ancient","pcolor_stone_special",
	"eye_scribble","pcolor_midnight_special","title_special","mouth_rabid",
	"title_freaky","eye_wobble"
];

const RANK_COSMETICS = [
	"title_rank_5","title_rank_10","title_rank_15","title_rank_20","title_rank_25",
	"title_rank_30","title_rank_35","title_rank_40","title_rank_45","title_rank_50"
];

const UNOBTAINABLE_ITEMS = [
	"prop_test","shovel","paint_brush","painting","empty_hand","net",
	"fish_deep_test","fish_deep_testb","fish_deep_testc"
];

const HIDDEN_ITEMS = ["empty_hand"];

const DEV_STEAM_UNLOCKS: Record<string, { name: string; cosmetics: string[]; bonusMoney: number }> = {
	"76561198116925213": { name: "west (lamedev)", cosmetics: ["undershirt_graphic_tshirt_dare","pcolor_west","mouth_toothier","title_lamedev","title_lamedev_real","title_stupididiotbaby","title_bipedalanimaldrawer","title_imnormal","title_hazard","title_nitrousoxide"], bonusMoney: 200 },
	"76561198298932199": { name: "Contributor", cosmetics: ["overshirt_sweatshirt_purple","title_stupididiotbaby"], bonusMoney: 200 },
	"76561198108125836": { name: "Contributor", cosmetics: ["undershirt_graphic_tshirt_threewolves","title_imnormal"], bonusMoney: 200 },
	"76561198109913387": { name: "Contributor", cosmetics: ["accessory_stink_particles","title_bipedalanimaldrawer"], bonusMoney: 200 },
	"76561198048418963": { name: "Contributor", cosmetics: ["accessory_bandaid","title_admiral"], bonusMoney: 200 },
	"76561198075315616": { name: "Contributor", cosmetics: ["pcolor_midnight_special","scolor_midnight_special","overshirt_labcoat","title_cadaverdog"], bonusMoney: 200 },
	"76561199104328044": { name: "Contributor", cosmetics: ["title_hazard"], bonusMoney: 0 },
	"76561199179487223": { name: "Contributor", cosmetics: ["title_nitrousoxide"], bonusMoney: 0 },
	"76561198353061650": { name: "Contributor", cosmetics: ["title_igloo"], bonusMoney: 0 },
	"76561198169378907": { name: "Contributor", cosmetics: ["title_zed"], bonusMoney: 0 },
	"76561198816340850": { name: "Contributor", cosmetics: ["title_specialforces"], bonusMoney: 0 },
	"76561198215486940": { name: "Contributor", cosmetics: ["title_candy"], bonusMoney: 0 },
};

/** Generate the full gamedata-extracted.ts file content */
export function generateTypeScript(data: ExtractedData): string {
	const { items, cosmetics, allThings, fishData, badgeLevels, baitDescriptions, lureEffects, rodUpgradeCosts } = data;

	return `// Auto-generated by src/lib/extractor.ts — DO NOT EDIT MANUALLY
// Extracted from WEBFISHING v1.12 game resources

export interface ThingEntry {
  name: string;
  category: string;
  icon: string | null;
}

export interface ItemEntry extends ThingEntry {
  sellValue?: number;
  tier?: number;
  lootTable?: string;
}

export interface CosmeticEntry extends ThingEntry {
  cost?: number;
}

/** Developer-only cosmetics that shouldn't be unlocked by regular players */
export const DEV_COSMETICS: string[] = ${JSON.stringify(DEV_COSMETICS)};

/** Cosmetics only obtainable from fishing treasure chests */
export const CHEST_COSMETICS: string[] = ${JSON.stringify(CHEST_COSMETICS)};

/** Quest reward exclusive cosmetics */
export const QUEST_COSMETICS: string[] = ${JSON.stringify(QUEST_COSMETICS)};

/** Rank milestone reward cosmetics */
export const RANK_COSMETICS: string[] = ${JSON.stringify(RANK_COSMETICS)};

/** Unobtainable/test items */
export const UNOBTAINABLE_ITEMS: string[] = ${JSON.stringify(UNOBTAINABLE_ITEMS)};

/** Hidden items (not shown in normal gameplay) */
export const HIDDEN_ITEMS: string[] = ${JSON.stringify(HIDDEN_ITEMS)};

/** Developer Steam ID → exclusive cosmetic unlocks */
export const DEV_STEAM_UNLOCKS: Record<string, { name: string; cosmetics: string[]; bonusMoney: number }> = ${JSON.stringify(DEV_STEAM_UNLOCKS, null, 2)};

/** Get the source/origin badge for a cosmetic ID */
export function getCosmeticSource(id: string): 'dev' | 'chest' | 'quest' | 'rank' | 'shop' | 'modded' {
  if (DEV_COSMETICS.includes(id)) return 'dev';
  if (QUEST_COSMETICS.includes(id)) return 'quest';
  if (RANK_COSMETICS.includes(id)) return 'rank';
  if (CHEST_COSMETICS.includes(id)) return 'chest';
  if (!(id in COSMETICS)) return 'modded';
  return 'shop';
}

/** Get the source badge for an item ID */
export function getItemSource(id: string): 'unobtainable' | 'hidden' | 'modded' | 'normal' {
  if (HIDDEN_ITEMS.includes(id)) return 'hidden';
  if (UNOBTAINABLE_ITEMS.includes(id)) return 'unobtainable';
  if (!(id in ITEMS)) return 'modded';
  return 'normal';
}

/** Fish average sizes and loot weights from game .tres resources (used for realistic journal generation) */
export const FISH_DATA: Record<string, { averageSize: number; lootWeight: number }> = ${JSON.stringify(fishData, null, 2)};

/** Badge level quest definitions (extracted from playerdata.gd BADGE_LEVEL_DATA) */
export const BADGE_QUEST_DATA: Record<number, { title: string; rewards: string[]; quest: { location: string; count: number; goldReward: number; xpReward: number } | null }> = ${JSON.stringify(badgeLevels, null, 2)};

/** Bait descriptions from playerdata.gd (key is bait ID, value is full description) */
export const BAIT_DESCRIPTIONS: Record<string, string> = ${JSON.stringify(baitDescriptions, null, 2)};

/** Lure effect IDs from playerdata.gd (key is lure ID, value is effect_id) */
export const LURE_EFFECTS: Record<string, string> = ${JSON.stringify(lureEffects, null, 2)};

/** Rod upgrade costs per level [0..10] from button_rod_upgrade.gd */
export const ROD_UPGRADE_COSTS: number[] = ${JSON.stringify(rodUpgradeCosts)};

/** All items (tools, fish, props, etc.) keyed by ID */
export const ITEMS: Record<string, ItemEntry> = ${JSON.stringify(items, null, 2)};

/** All cosmetics keyed by ID */
export const COSMETICS: Record<string, CosmeticEntry> = ${JSON.stringify(cosmetics, null, 2)};

/** Combined lookup of all known game things (items + cosmetics) */
export const ALL_THINGS: Record<string, ThingEntry> = ${JSON.stringify(allThings, null, 2)};

/** Get human-readable name for any game ID */
export function getThingName(id: string): string {
  return ALL_THINGS[id]?.name ?? id;
}

/** Get icon filename for any game ID */
export function getThingIcon(id: string): string | null {
  return ALL_THINGS[id]?.icon ?? null;
}

/** Check if an ID is a known valid game thing */
export function isKnownThing(id: string): boolean {
  return id in ALL_THINGS;
}

/** Get all items by category */
export function getItemsByCategory(category: string): Record<string, ItemEntry> {
  return Object.fromEntries(Object.entries(ITEMS).filter(([, v]) => v.category === category));
}

/** Get all cosmetics by category */
export function getCosmeticsByCategory(category: string): Record<string, CosmeticEntry> {
  return Object.fromEntries(Object.entries(COSMETICS).filter(([, v]) => v.category === category));
}

// --- Known modded overrides (auto-scanned from GDWeave mods + manual) ---
import scannedOverrides from './mod-overrides.json';
const MODDED_OVERRIDES: Record<string, { name: string; icon: string; type?: string; category?: string; loot_table?: string; average_size?: number; loot_weight?: number; sell_value?: number; tier?: number }> = {
  ...scannedOverrides,
};

// Inject modded fish data into FISH_DATA so simulateCatchCount/simulateRecord use real values
for (const [id, v] of Object.entries(MODDED_OVERRIDES)) {
  if (v.category === 'fish' && v.average_size && v.loot_weight && !(id in FISH_DATA)) {
    FISH_DATA[id] = { averageSize: v.average_size, lootWeight: v.loot_weight };
  }
}

/** Merge new overrides at runtime (used by rescan without triggering HMR) */
export function mergeModOverrides(overrides: Record<string, { name: string; icon: string; type?: string; category?: string; loot_table?: string; average_size?: number; loot_weight?: number; sell_value?: number; tier?: number }>) {
  Object.assign(MODDED_OVERRIDES, overrides);
  for (const [id, v] of Object.entries(overrides)) {
    if (v.category === 'fish' && v.average_size && v.loot_weight && !(id in FISH_DATA)) {
      FISH_DATA[id] = { averageSize: v.average_size, lootWeight: v.loot_weight };
    }
  }
}

/** Get all modded fish from overrides (items with category 'fish') */
export function getModdedFishList(): { id: string; name: string; icon: string; loot_table: string }[] {
  return Object.entries(MODDED_OVERRIDES)
    .filter(([, v]) => v.category === 'fish')
    .map(([id, v]) => ({ id, name: v.name, icon: v.icon, loot_table: v.loot_table ?? '' }));
}

/** Get all modded items from overrides (non-cosmetic items for inventory catalog) */
export function getModdedItemOverrides(): Record<string, { name: string; icon: string; category: string }> {
  const result: Record<string, { name: string; icon: string; category: string }> = {};
  for (const [id, v] of Object.entries(MODDED_OVERRIDES)) {
    if (v.type === 'item' || v.type === undefined) {
      result[id] = { name: v.name, icon: v.icon, category: v.category ?? 'unknown' };
    }
  }
  return result;
}

/** Get all modded cosmetics from overrides (scanned cosmetic data with proper names/icons/categories) */
export function getModdedCosmeticOverrides(): Record<string, { name: string; icon: string; category: string }> {
  const result: Record<string, { name: string; icon: string; category: string }> = {};
  for (const [id, v] of Object.entries(MODDED_OVERRIDES)) {
    if (v.type === 'cosmetic') {
      result[id] = { name: v.name, icon: v.icon, category: v.category ?? 'other' };
    }
  }
  return result;
}

// --- Modded content detection ---

export function isModdedCosmetic(id: string): boolean {
  return !(id in COSMETICS) && !DEV_COSMETICS.includes(id);
}

export function isModdedItem(id: string): boolean {
  return !(id in ITEMS);
}

export function isModdedFish(id: string): boolean {
  return !(id in ITEMS) && id.startsWith('fish_');
}

export function guessModdedName(id: string): string {
  return id
    .replace(/^(fish_|prop_|item_|title_|hat_|eye_|mouth_|nose_|legs_|undershirt_|overshirt_|accessory_|scolor_|pcolor_|tail_|pattern_)/, '')
    .replace(/_/g, ' ')
    .replace(/\\b\\w/g, c => c.toUpperCase());
}

export function guessModdedCosmeticCategory(id: string): string {
  const prefixMap: Record<string, string> = {
    'title_': 'title', 'hat_': 'hat', 'eye_': 'eye', 'mouth_': 'mouth',
    'nose_': 'nose', 'legs_': 'legs', 'undershirt_': 'undershirt',
    'overshirt_': 'overshirt', 'accessory_': 'accessory', 'scolor_': 'species_color',
    'pcolor_': 'primary_color', 'tail_': 'tail', 'pattern_': 'pattern',
    'bobber_': 'bobber',
  };
  for (const [prefix, cat] of Object.entries(prefixMap)) {
    if (id.startsWith(prefix)) return cat;
  }
  return 'other';
}

export function guessModdedItemCategory(id: string): string {
  if (id.startsWith('fish_')) return 'fish';
  if (id.startsWith('prop_')) return 'furniture';
  if (id.startsWith('chalk_')) return 'chalk';
  return 'tool';
}

/**
 * Extract all modded cosmetic IDs from the save's cosmetics_unlocked + scanned overrides.
 * Returns CosmeticEntry-like objects for display in catalog.
 */
export function getModdedCosmetics(unlockedIds: string[]): Record<string, CosmeticEntry> {
  const modded: Record<string, CosmeticEntry> = {};
  const cosmeticOverrides = getModdedCosmeticOverrides();
  for (const [id, ov] of Object.entries(cosmeticOverrides)) {
    modded[id] = {
      name: ov.name,
      category: ov.category,
      icon: ov.icon || null,
    };
  }
  for (const id of unlockedIds) {
    if (isModdedCosmetic(id) && !(id in modded)) {
      modded[id] = {
        name: guessModdedName(id),
        category: guessModdedCosmeticCategory(id),
        icon: null,
      };
    }
  }
  return modded;
}

/**
 * Extract all modded item IDs from the save's inventory + scanned overrides.
 * Returns ItemEntry-like objects for display in catalog.
 */
export function getModdedItems(inventory: Record<string, unknown>[]): Record<string, ItemEntry> {
  const modded: Record<string, ItemEntry> = {};
  const itemOverrides = getModdedItemOverrides();
  for (const [id, ov] of Object.entries(itemOverrides)) {
    modded[id] = {
      name: ov.name,
      category: ov.category === 'fish' ? 'fish' : ov.category,
      icon: ov.icon || null,
    };
  }
  for (const item of inventory) {
    const id = String(item.id ?? '');
    if (id && isModdedItem(id) && !(id in modded)) {
      modded[id] = {
        name: guessModdedName(id),
        category: guessModdedItemCategory(id),
        icon: null,
      };
    }
  }
  return modded;
}

/**
 * Extract all modded fish IDs from journal zones.
 */
export function getModdedJournalFish(journal: Record<string, Record<string, unknown>>): Set<string> {
  const modded = new Set<string>();
  for (const zone of Object.values(journal)) {
    for (const fishId of Object.keys(zone)) {
      if (isModdedItem(fishId)) modded.add(fishId);
    }
  }
  return modded;
}
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mod scanning (from .pck files)
// ═══════════════════════════════════════════════════════════════════════════════

/** Scan a mods directory for .pck files and extract item/cosmetic data */
export function scanMods(modsDir: string, iconsDir: string): Record<string, ModItem> {
	const overrides: Record<string, ModItem> = {};

	if (!existsSync(modsDir)) {
		console.log(`  [mod-scanner] Mods directory not found: ${modsDir}`);
		return overrides;
	}

	mkdirSync(iconsDir, { recursive: true });
	const pckFiles = findPckFiles(modsDir);
	let itemCount = 0;

	for (const pckPath of pckFiles) {
		const modName = basename(dirname(pckPath));
		let pckContents: Map<string, Buffer>;

		try {
			pckContents = readPck(pckPath);
		} catch {
			continue;
		}

		for (const [filePath, fileData] of pckContents) {
			if (!filePath.endsWith('.tres')) continue;

			let content: string;
			try {
				content = fileData.toString('utf-8');
			} catch { continue; }

			const item = parseTresContent(content, filePath);
			if (!item) continue;

			const itemId = basename(filePath, '.tres');
			item.mod = modName;
			itemCount++;

			let iconFilename = '';
			if (item.iconPath) {
				const imgResult = findImageInPck(pckContents, item.iconPath);
				if (imgResult) {
					const [imgKey, imgData] = imgResult;
					if (imgKey.includes('.stex')) {
						const pngData = extractPngFromStex(imgData);
						if (pngData && pngData.length > 0) {
							iconFilename = `mod_${itemId}.png`;
							writeFileSync(join(iconsDir, iconFilename), pngData);
						}
					} else if (imgData.length > 0) {
						const ext = extname(imgKey) || '.png';
						iconFilename = `mod_${itemId}${ext}`;
						writeFileSync(join(iconsDir, iconFilename), imgData);
					}
				}
			}

			overrides[itemId] = {
				name: item.name,
				icon: iconFilename,
				type: item.type,
				category: item.category,
				loot_table: item.lootTable,
				average_size: item.averageSize,
				loot_weight: item.lootWeight,
				sell_value: item.sellValue,
				tier: item.tier,
			};
			console.log(`  [mod-scanner] ✅ ${itemId}: "${item.name}" [${item.type}:${item.category}] (${modName})${iconFilename ? ' 🖼️' : ''}`);
		}
	}

	return overrides;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Steam/mod directory resolution
// ═══════════════════════════════════════════════════════════════════════════════

/** Parse Steam's libraryfolders.vdf to find all Steam library paths */
function getSteamLibraryPaths(): string[] {
	const paths: string[] = [];
	const defaultSteam = [
		'C:\\Program Files (x86)\\Steam',
		'C:\\Program Files\\Steam',
		join(process.env.HOME ?? process.env.USERPROFILE ?? '', 'Steam'),
	];

	for (const steamDir of defaultSteam) {
		if (!existsSync(steamDir)) continue;
		paths.push(steamDir);

		const vdfPath = join(steamDir, 'steamapps', 'libraryfolders.vdf');
		if (!existsSync(vdfPath)) continue;
		try {
			const content = readFileSync(vdfPath, 'utf-8');
			const pathMatches = content.matchAll(/"path"\s*"([^"]*)"/g);
			for (const m of pathMatches) {
				const p = m[1].replace(/\\\\/g, '\\');
				if (existsSync(p) && !paths.includes(p)) paths.push(p);
			}
		} catch { /* skip */ }
	}

	return paths;
}

/** Recursively search a directory for GDWeave\mods folders */
function findGDWeaveMods(baseDir: string, maxDepth = 5): string[] {
	const results: string[] = [];

	function walk(dir: string, depth: number) {
		if (depth > maxDepth) return;
		try {
			for (const entry of readdirSync(dir)) {
				const full = join(dir, entry);
				try {
					if (!statSync(full).isDirectory()) continue;
				} catch { continue; }

				if (entry === 'mods') {
					const parent = basename(dir);
					if (parent === 'GDWeave') results.push(full);
				} else if (entry !== 'node_modules' && entry !== '.git' && entry !== 'build') {
					walk(full, depth + 1);
				}
			}
		} catch { /* skip inaccessible */ }
	}

	if (existsSync(baseDir)) walk(baseDir, 0);
	return results;
}

/** Resolve the mods directory (env var > search %APPDATA% > search Steam libraries > fallback) */
export function resolveModsDir(): string {
	if (process.env.WEBFISHING_MODS_DIR) return process.env.WEBFISHING_MODS_DIR;

	const found: string[] = [];
	const appData = process.env.APPDATA ?? '';

	if (appData) found.push(...findGDWeaveMods(appData, 6));

	for (const libPath of getSteamLibraryPaths()) {
		const gameDir = join(libPath, 'steamapps', 'common', 'WEBFISHING');
		if (existsSync(gameDir)) found.push(...findGDWeaveMods(gameDir, 3));
	}

	const unique = [...new Set(found)];
	if (unique.length > 0) {
		const profileMods = unique.filter(p => p.includes('profiles'));
		return profileMods[0] ?? unique[0];
	}

	const fallbacks = [
		join(appData, 'com.kesomannen.gale', 'webfishing', 'profiles', 'Default', 'GDWeave', 'mods'),
		join(appData, 'r2modmanPlus-local', 'WEBFISHING', 'profiles', 'Default', 'GDWeave', 'mods'),
	];
	return fallbacks[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vite Plugin
// ═══════════════════════════════════════════════════════════════════════════════

/** Vite plugin that scans GDWeave mods at dev/build time and serves a rescan endpoint */
export function modScannerPlugin(): Plugin {
	const outputJsonPath = resolve('src', 'lib', 'mod-overrides.json');

	function runScan(writeJson: boolean) {
		const modsDir = resolveModsDir();
		const iconsDir = resolve('static', 'icons');

		console.log(`\n🎣 Scanning WEBFISHING mods...`);
		console.log(`  Mods: ${modsDir}`);

		const overrides = scanMods(modsDir, iconsDir);
		const count = Object.keys(overrides).length;

		if (writeJson) {
			writeFileSync(outputJsonPath, JSON.stringify(overrides, null, 2));
		}

		if (count > 0) {
			console.log(`  📦 Found ${count} modded item(s)\n`);
		} else {
			console.log(`  No modded items found (mods may only modify gameplay)\n`);
		}

		return { count, modsDir, items: overrides };
	}

	return {
		name: 'webfishing-mod-scanner',
		buildStart() {
			runScan(true);
		},
		configureServer(server) {
			server.middlewares.use('/__mod-rescan', (_req, res) => {
				try {
					const result = runScan(false);
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(result));
				} catch (e) {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: String(e) }));
				}
			});
		},
	};
}

// Also export as default for backwards compatibility with vite.config.ts
export default modScannerPlugin;

// ═══════════════════════════════════════════════════════════════════════════════
// CLI entry point — run with: bun src/lib/extractor.ts [gameDir]
// ═══════════════════════════════════════════════════════════════════════════════

const isCLI = typeof process !== 'undefined' &&
	process.argv[1] &&
	(process.argv[1].includes('extractor.ts') || process.argv[1].includes('extractor.js'));

if (isCLI) {
	const DEFAULT_GAME_DIR = 'C:/Users/ghostsec/Desktop/GDRE_tools-v2.4.0-windows/webfishing_2_newver';
	const gameDir = process.argv[2] || DEFAULT_GAME_DIR;
	const outTs = resolve('src', 'lib', 'gamedata-extracted.ts');
	const iconsDir = resolve('static', 'icons');

	console.log(`\n🎮 WEBFISHING Data Extractor`);
	console.log(`  Game source: ${gameDir}`);
	console.log(`  Output: ${outTs}`);
	console.log(`  Icons: ${iconsDir}\n`);

	if (!existsSync(gameDir)) {
		console.error(`❌ Game directory not found: ${gameDir}`);
		process.exit(1);
	}

	const data = extractVanillaGameData(gameDir, iconsDir);
	const tsContent = generateTypeScript(data);
	writeFileSync(outTs, tsContent);

	const itemCount = Object.keys(data.items).length;
	const cosmeticCount = Object.keys(data.cosmetics).length;
	const fishCount = Object.keys(data.fishData).length;
	const badgeCount = Object.keys(data.badgeLevels).length;

	console.log(`\n✅ Generated ${outTs}`);
	console.log(`   ${itemCount} items, ${cosmeticCount} cosmetics, ${fishCount} fish entries`);
	console.log(`   ${badgeCount} badge levels, ${data.rodUpgradeCosts.length} rod upgrade tiers`);
	console.log(`   ${Object.keys(data.baitDescriptions).length} bait descriptions, ${Object.keys(data.lureEffects).length} lure effects`);
}
