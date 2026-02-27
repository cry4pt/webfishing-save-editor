import { writable, derived } from 'svelte/store';
import type { GodotType } from '$lib/godot/codec';
import { parseStoreVar, serializeStoreVar } from '$lib/godot/codec';
import { astToJS, jsToAST } from '$lib/godot/converter';
import type { SaveData } from '$lib/godot/converter';
import { RANK_TITLES, ALL_LURES, ALL_BAIT, KNOWN_TAGS } from '$lib/gamedata';
import { COSMETICS, DEV_COSMETICS, FISH_DATA, ITEMS, UNOBTAINABLE_ITEMS } from '$lib/gamedata-extracted';

// Box-Muller transform for normal distribution (replicates Godot's randfn)
function randfn(mean: number, deviation: number): number {
  let u1 = Math.random();
  const u2 = Math.random();
  if (u1 < 1e-10) u1 = 1e-10; // avoid log(0)
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * deviation;
}

// Replicates Godot's _roll_item_size() from globals.gd lines 127-137
// Game code: base = average_size, deviation = base * 0.55, base += base * 0.25
//            roll = stepify(randfn(base, deviation), 0.01), roll = max(abs(roll), 0.01)
export function rollItemSize(avgSize: number): number {
  const deviation = avgSize * 0.55;
  const base = avgSize * 1.25;
  const raw = randfn(base, deviation);
  // stepify(x, 0.01) rounds to nearest 0.01
  const roll = Math.round(raw * 100) / 100;
  return Math.max(Math.abs(roll), 0.01);
}

// Simulate a realistic record: the record is the largest fish size ever caught.
// We roll size N times (one per simulated catch) and keep the max.
export function simulateRecord(fishId: string, catchCount: number): number {
  const fd = FISH_DATA[fishId];
  if (!fd) {
    // Unknown fish — use a sensible fallback
    return Math.round((20 + Math.random() * 80) * 100) / 100;
  }
  let best = 0;
  const rolls = Math.max(catchCount, 1);
  for (let i = 0; i < rolls; i++) {
    const size = rollItemSize(fd.averageSize);
    if (size > best) best = size;
  }
  return best;
}

// Generate realistic catch count based on loot_weight from .tres files.
// Common fish (weight >= 1.0) are caught far more often than rare ones (weight < 0.2).
export function simulateCatchCount(fishId: string): number {
  const weight = FISH_DATA[fishId]?.lootWeight ?? 0.5;
  // Scaled so common fish (weight 1.25) → ~30-70, rare (0.03) → 1-3
  const base = weight * 40;
  const variance = weight * 20;
  const count = Math.round(base + Math.random() * variance);
  return Math.max(count, 1);
}

function fillJournalRealistic(journal: Record<string, Record<string, { count: number; record: number; quality: number[] }>>): number {
  let total = 0;
  for (const zone of Object.keys(journal)) {
    for (const fish of Object.keys(journal[zone])) {
      const count = simulateCatchCount(fish);
      journal[zone][fish].count = count;
      journal[zone][fish].record = simulateRecord(fish, count);
      journal[zone][fish].quality = [0, 1, 2, 3, 4, 5];
      total += count;
    }
  }
  return total;
}

export const rawAST = writable<GodotType | null>(null);
// Custom store that always notifies subscribers on update().
// Svelte's writable skips notification when safe_not_equal(old, new) is false,
// which happens when mutations return the same object reference.
// We shallow-copy the top-level object to guarantee a new reference.
const _saveStore = writable<SaveData | null>(null);
export const saveData = {
  subscribe: _saveStore.subscribe,
  set: _saveStore.set,
  update: (fn: (d: SaveData | null) => SaveData | null) => {
    _saveStore.update(d => {
      const result = fn(d);
      return result ? { ...result } : result;
    });
  },
};
export const fileName = writable<string>('');
export const fileSize = writable<number>(0);
export const isLoaded = writable<boolean>(false);

// File System Access API handle for save-in-place
let fileHandle: FileSystemFileHandle | null = null;
export const hasDirectAccess = writable<boolean>(false);

// Check if browser supports File System Access API
export const supportsDirectSave = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

export type ToastType = 'success' | 'error' | 'info';
export interface Toast { id: number; message: string; type: ToastType }
let toastId = 0;
export const toasts = writable<Toast[]>([]);

export function addToast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, type }]);
  setTimeout(() => toasts.update(t => t.filter(x => x.id !== id)), 3500);
}

export const summary = derived(saveData, $d => {
  if (!$d) return null;
  return {
    money: $d.money ?? 0,
    cashTotal: $d.cash_total ?? 0,
    level: $d.level ?? 1,
    rankTitle: RANK_TITLES[$d.level] ?? 'Unknown',
    xp: $d.xp ?? 0,
    fishCaught: $d.fish_caught ?? 0,
    inventoryCount: ($d.inventory as unknown[])?.length ?? 0,
    cosmeticsCount: ($d.cosmetics_unlocked as string[])?.length ?? 0,
    lureCount: (($d.lure_unlocked as string[]) ?? []).filter(l => l).length,
    lureTotal: ALL_LURES.filter(l => l.id).length,
    loanLevel: $d.loan_level ?? 0,
    loanLeft: $d.loan_left ?? 0,
    rodPower: $d.rod_power ?? 0,
    rodSpeed: $d.rod_speed ?? 0,
    rodChance: $d.rod_chance ?? 0,
    rodLuck: $d.rod_luck ?? 0,
    buddyLevel: $d.buddy_level ?? 0,
    buddySpeed: $d.buddy_speed ?? 0,
    version: $d.version ?? '?',
    tagCount: ($d.saved_tags as string[])?.length ?? 0,
    questCount: Object.keys(($d.quests as Record<string, unknown>) ?? {}).length,
    completedQuestCount: (($d.completed_quests as string[]) ?? []).length,
    baitUnlocked: ($d.bait_unlocked as string[])?.length ?? 0,
    lockedItems: (($d.locked_refs as number[]) ?? []).length,
    newCosmeticsCount: (($d.new_cosmetics as string[]) ?? []).length,
    propsCount: (($d.inventory as Record<string, unknown>[]) ?? []).filter(i => ITEMS[String(i.id)]?.category === 'furniture').length,
  };
});

export function loadFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const buffer = reader.result as ArrayBuffer;
      const ast = parseStoreVar(buffer);
      const data = astToJS(ast) as SaveData;
      rawAST.set(ast);
      saveData.set(data);
      fileName.set(file.name);
      fileSize.set(file.size);
      isLoaded.set(true);
      addToast(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
    } catch (err) {
      addToast(`Failed to parse: ${(err as Error).message}`, 'error');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// Open file using File System Access API (retains writable handle for save-in-place)
export async function openFileWithAccess() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'WEBFISHING Save', accept: { 'application/octet-stream': ['.sav', '.backup', '.save'] } }],
      multiple: false,
    });
    fileHandle = handle;
    hasDirectAccess.set(true);
    const file = await handle.getFile();
    loadFile(file);
  } catch (err) {
    // User cancelled the picker
    if ((err as Error).name !== 'AbortError') {
      addToast(`Failed to open: ${(err as Error).message}`, 'error');
    }
  }
}

function buildSaveBuffer(): ArrayBuffer | null {
  let currentAST: GodotType | null = null;
  let currentData: SaveData | null = null;
  rawAST.subscribe(v => currentAST = v)();
  saveData.subscribe(v => currentData = v)();
  if (!currentAST || !currentData) return null;
  const rebuilt = jsToAST(currentData, currentAST);
  return serializeStoreVar(rebuilt);
}

// Save directly to the original file (overwrites in place)
export async function saveInPlace() {
  if (!fileHandle) {
    addToast('No direct file access — use Download instead', 'error');
    return;
  }
  try {
    const buffer = buildSaveBuffer();
    if (!buffer) return;
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
    addToast('💾 Saved directly to file!', 'success');
  } catch (err) {
    addToast(`Save failed: ${(err as Error).message}`, 'error');
    console.error(err);
  }
}

export function downloadSave(asBackup = false) {
  let currentName = '';
  fileName.subscribe(v => currentName = v)();

  try {
    const buffer = buildSaveBuffer();
    if (!buffer) return;
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    if (asBackup) {
      a.download = (currentName || 'webfishing_save_slot_0').replace(/\.\w+$/, '') + '.backup';
    } else {
      a.download = currentName || 'webfishing_save_slot_0.sav';
    }
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Downloaded ${a.download}`, 'success');
  } catch (err) {
    addToast(`Serialize error: ${(err as Error).message}`, 'error');
    console.error(err);
  }
}

// Quick actions
export function quickMaxAll() {
  saveData.update(d => {
    if (!d) return d;
    d.money = 999999999;
    d.cash_total = 999999999;
    d.level = 50;
    d.xp = 0;
    d.rod_power = 8;
    d.rod_speed = 5;
    d.rod_chance = 5;
    d.rod_luck = 5;
    d.buddy_level = 5;
    d.buddy_speed = 5;
    d.loan_level = 3;
    d.loan_left = 0;
    d.max_bait = 999;
    ALL_LURES.forEach(l => {
      if (l.id && !(d.lure_unlocked as string[]).includes(l.id)) (d.lure_unlocked as string[]).push(l.id);
    });
    ALL_BAIT.forEach(b => {
      if (b.id && !(d.bait_unlocked as string[]).includes(b.id)) (d.bait_unlocked as string[]).push(b.id);
      if (b.id) (d.bait_inv as Record<string, number>)[b.id] = 999;
    });
    // Fill journal with realistic game data
    const journal = d.journal as Record<string, Record<string, { count: number; record: number; quality: number[] }>>;
    if (journal) {
      const totalCaught = fillJournalRealistic(journal);
      d.fish_caught = Math.max(d.fish_caught ?? 0, totalCaught);
    }
    // Unlock all cosmetics (excluding dev)
    const allCosm = Object.keys(COSMETICS).filter(id => !DEV_COSMETICS.includes(id));
    const unlocked = d.cosmetics_unlocked as string[];
    allCosm.forEach(id => { if (!unlocked.includes(id)) unlocked.push(id); });
    // Complete all quests
    const quests = d.quests as Record<string, { progress?: number; goal_amt?: number; title?: string }> | undefined;
    if (quests) {
      const completed = (d.completed_quests as string[]) ?? [];
      for (const q of Object.values(quests)) {
        if (q.goal_amt) {
          q.progress = q.goal_amt;
          if (q.title && !completed.includes(q.title)) completed.push(q.title);
        }
      }
      d.completed_quests = completed;
    }
    // Clear new cosmetics markers
    d.new_cosmetics = [];
    // Add all known tags/achievements
    const tags = (d.saved_tags as string[]) ?? [];
    const newTags = KNOWN_TAGS.filter(t => !tags.includes(t));
    d.saved_tags = [...tags, ...newTags];
    // Add all props/furniture + spectral rod if missing
    const inv = d.inventory as Record<string, unknown>[];
    if (!inv.some(i => String(i.id) === 'fishing_rod_skeleton')) {
      inv.push({ id: 'fishing_rod_skeleton', size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
    }
    const ownedFurn = new Set(inv.filter(i => ITEMS[String(i.id)]?.category === 'furniture').map(i => String(i.id)));
    Object.entries(ITEMS).forEach(([id, item]) => {
      if (item.category === 'furniture' && !ownedFurn.has(id) && !UNOBTAINABLE_ITEMS.includes(id)) {
        inv.push({ id, size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
      }
    });
    d.inventory = [...inv];
    return d;
  });
  addToast('🏆 Everything maxed out!', 'success');
}

export function quickAction(key: string) {
  saveData.update(d => {
    if (!d) return d;
    switch (key) {
      case 'money':
        d.money = 999999999;
        d.cash_total = Math.max(d.cash_total ?? 0, 999999999);
        break;
      case 'rank':
        d.level = 50; d.xp = 0;
        break;
      case 'rod':
        d.rod_power = 8; d.rod_speed = 5; d.rod_chance = 5; d.rod_luck = 5;
        break;
      case 'lures':
        ALL_LURES.forEach(l => {
          if (l.id && !(d.lure_unlocked as string[]).includes(l.id)) (d.lure_unlocked as string[]).push(l.id);
        });
        break;
      case 'bait':
        ALL_BAIT.forEach(b => {
          if (b.id && !(d.bait_unlocked as string[]).includes(b.id)) (d.bait_unlocked as string[]).push(b.id);
          if (b.id) (d.bait_inv as Record<string, number>)[b.id] = 999;
        });
        d.max_bait = 999;
        break;
      case 'loans':
        d.loan_level = 3; d.loan_left = 0;
        break;
      case 'buddy':
        d.buddy_level = 5; d.buddy_speed = 5;
        break;
      case 'cosmetics': {
        const allCosm = Object.keys(COSMETICS).filter(id => !DEV_COSMETICS.includes(id));
        const unlocked = d.cosmetics_unlocked as string[];
        allCosm.forEach(id => { if (!unlocked.includes(id)) unlocked.push(id); });
        d.new_cosmetics = [];
        break;
      }
      case 'quests': {
        const quests = d.quests as Record<string, { progress?: number; goal_amt?: number; title?: string }> | undefined;
        if (quests) {
          const completed = (d.completed_quests as string[]) ?? [];
          for (const q of Object.values(quests)) {
            if (q.goal_amt) {
              q.progress = q.goal_amt;
              // Add to completed_quests like the game does (by title)
              if (q.title && !completed.includes(q.title)) {
                completed.push(q.title);
              }
            }
          }
          d.completed_quests = completed;
        }
        break;
      }
      case 'journal': {
        const journal = d.journal as Record<string, Record<string, { count: number; record: number; quality: number[] }>>;
        if (journal) {
          const totalCaught = fillJournalRealistic(journal);
          d.fish_caught = Math.max(d.fish_caught ?? 0, totalCaught);
        }
        break;
      }
      case 'props': {
        const inv = d.inventory as Record<string, unknown>[];
        const ownedFurn = new Set(inv.filter(i => ITEMS[String(i.id)]?.category === 'furniture').map(i => String(i.id)));
        Object.entries(ITEMS).forEach(([id, item]) => {
          if (item.category === 'furniture' && !ownedFurn.has(id) && !UNOBTAINABLE_ITEMS.includes(id)) {
            inv.push({ id, size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
          }
        });
        break;
      }
    }
    return d;
  });
  const labels: Record<string, string> = {
    money: '💰 Money maxed!', rank: '⭐ Rank 50 — VOYAGER!', rod: '🎣 Rod maxed!',
    lures: '🪝 All lures unlocked!', bait: '🪱 Bait maxed!', loans: '🏦 Loans cleared!',
    buddy: '🐕 Buddy maxed!', cosmetics: '👕 All cosmetics unlocked!',
    quests: '📋 All quests completed!', journal: '📖 Journal filled!',
    props: '🪑 All props added!'
  };
  addToast(labels[key] ?? 'Done!', 'success');
}
