<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { COSMETICS, DEV_COSMETICS, CHEST_COSMETICS, QUEST_COSMETICS, RANK_COSMETICS, getCosmeticSource, getThingName, getThingIcon, getCosmeticsByCategory, isModdedCosmetic, getModdedCosmetics, getModdedCosmeticOverrides, guessModdedName, guessModdedCosmeticCategory } from '$lib/gamedata-extracted';

  // Compute shop cosmetics (everything that's not dev/chest/quest/rank)
  const SHOP_COSMETICS: string[] = Object.keys(COSMETICS).filter(id =>
    !DEV_COSMETICS.includes(id) && !CHEST_COSMETICS.includes(id) &&
    !QUEST_COSMETICS.includes(id) && !RANK_COSMETICS.includes(id)
  );

  let searchQuery = $state('');
  let showDevCosmetics = $state(false);
  let sourceFilter = $state<string>('all');

  const SOURCE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    dev:    { label: 'DEV',    color: 'text-red-400',     bg: 'bg-red-500/20' },
    chest:  { label: 'CHEST',  color: 'text-amber-400',   bg: 'bg-amber-500/20' },
    quest:  { label: 'QUEST',  color: 'text-cyan-400',    bg: 'bg-cyan-500/20' },
    rank:   { label: 'RANK',   color: 'text-yellow-400',  bg: 'bg-yellow-500/20' },
    shop:   { label: 'SHOP',   color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    modded: { label: 'MODDED', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20' },
  };

  // Map equipped slot names to cosmetic categories
  const SLOT_TO_CATEGORY: Record<string, string> = {
    species: 'species', pattern: 'pattern', primary_color: 'primary_color',
    secondary_color: 'secondary_color', hat: 'hat', undershirt: 'undershirt',
    overshirt: 'overshirt', title: 'title', bobber: 'bobber', eye: 'eye',
    nose: 'nose', mouth: 'mouth', accessory: 'accessory', tail: 'tail', legs: 'legs',
  };

  function removeCosm(id: string) {
    saveData.update(d => {
      if (!d) return d;
      d.cosmetics_unlocked = (d.cosmetics_unlocked as string[]).filter(x => x !== id);
      return d;
    });
  }

  function toggleCosm(id: string, checked: boolean) {
    saveData.update(d => {
      if (!d) return d;
      const arr = d.cosmetics_unlocked as string[];
      if (checked && !arr.includes(id)) d.cosmetics_unlocked = [...arr, id];
      else if (!checked) d.cosmetics_unlocked = arr.filter((x: string) => x !== id);
      return d;
    });
  }

  function unlockAll() {
    saveData.update(d => {
      if (!d) return d;
      const arr = d.cosmetics_unlocked as string[];
      const vanillaIds = Object.keys(COSMETICS).filter(id => !DEV_COSMETICS.includes(id) && !arr.includes(id));
      const moddedIds = Object.keys(getModdedCosmeticOverrides()).filter(id => !arr.includes(id));
      d.cosmetics_unlocked = [...arr, ...vanillaIds, ...moddedIds];
      return d;
    });
    addToast('👕 All cosmetics unlocked (including modded)!', 'success');
  }

  function unlockBySource(source: string) {
    const ids = source === 'chest' ? CHEST_COSMETICS : source === 'quest' ? QUEST_COSMETICS : source === 'rank' ? RANK_COSMETICS : source === 'shop' ? SHOP_COSMETICS : [];
    saveData.update(d => {
      if (!d) return d;
      const arr = d.cosmetics_unlocked as string[];
      const newIds = ids.filter(id => !arr.includes(id));
      d.cosmetics_unlocked = [...arr, ...newIds];
      return d;
    });
    addToast(`Unlocked all ${source} cosmetics!`, 'success');
  }

  function unlockModded() {
    const moddedIds = Object.keys(getModdedCosmeticOverrides());
    if (moddedIds.length === 0) { addToast('No modded cosmetics detected', 'info'); return; }
    saveData.update(d => {
      if (!d) return d;
      const arr = d.cosmetics_unlocked as string[];
      const newIds = moddedIds.filter(id => !arr.includes(id));
      d.cosmetics_unlocked = [...arr, ...newIds];
      return d;
    });
    addToast(`🧩 Unlocked ${moddedIds.length} modded cosmetics!`, 'success');
  }

  function lockAll() {
    if (!confirm('Lock ALL cosmetics? This will remove all unlocks.')) return;
    saveData.update(d => { if (d) d.cosmetics_unlocked = []; return d; });
    addToast('🔒 All cosmetics locked', 'info');
  }

  function getCategories(unlocked: string[], query: string): Record<string, { id: string; name: string; icon: string | null; isUnlocked: boolean; source: string }[]> {
    const cats: Record<string, { id: string; name: string; icon: string | null; isUnlocked: boolean; source: string }[]> = {};
    const q = query.toLowerCase();

    // Include vanilla cosmetics
    for (const [id, cosm] of Object.entries(COSMETICS)) {
      if (!showDevCosmetics && DEV_COSMETICS.includes(id)) continue;
      const source = getCosmeticSource(id) ?? 'shop';
      if (sourceFilter !== 'all' && source !== sourceFilter) continue;
      const name = cosm.name;
      if (q && !id.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) continue;
      const cat = cosm.category || 'other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ id, name, icon: cosm.icon, isUnlocked: unlocked.includes(id), source });
    }

    // Include modded cosmetics from save data
    const moddedCosmetics = getModdedCosmetics(unlocked);
    for (const [id, cosm] of Object.entries(moddedCosmetics)) {
      if (sourceFilter !== 'all' && sourceFilter !== 'modded') continue;
      const name = cosm.name;
      if (q && !id.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) continue;
      const cat = cosm.category || 'other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ id, name, icon: cosm.icon, isUnlocked: unlocked.includes(id), source: 'modded' });
    }

    for (const k of Object.keys(cats)) {
      cats[k].sort((a, b) => a.name.localeCompare(b.name));
    }
    return cats;
  }

  function updateEquipped(slot: string, value: string) {
    saveData.update(d => {
      if (!d) return d;
      const equipped = { ...(d.cosmetics_equipped as Record<string, unknown>) };
      if (slot === 'accessory') {
        equipped[slot] = value.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        equipped[slot] = value;
      }
      d.cosmetics_equipped = equipped;
      return d;
    });
  }

  function toggleAccessory(id: string, checked: boolean) {
    saveData.update(d => {
      if (!d) return d;
      const equipped = { ...(d.cosmetics_equipped as Record<string, unknown>) };
      const current = Array.isArray(equipped.accessory) ? [...(equipped.accessory as string[])] : [];
      if (checked && !current.includes(id) && current.length < 4) {
        current.push(id);
      } else if (!checked) {
        const idx = current.indexOf(id);
        if (idx >= 0) current.splice(idx, 1);
      }
      equipped.accessory = current;
      d.cosmetics_equipped = equipped;
      return d;
    });
  }

  // Get cosmetic options for a slot filtered to unlocked items (includes modded)
  function getSlotOptions(slot: string, unlocked: string[]): { id: string; name: string; icon: string | null }[] {
    const cat = SLOT_TO_CATEGORY[slot];
    if (!cat) return [];
    const options = Object.entries(COSMETICS)
      .filter(([id, cosm]) => cosm.category === cat && unlocked.includes(id))
      .map(([id, cosm]) => ({ id, name: cosm.name, icon: cosm.icon }));
    // Add modded cosmetics matching this category
    const moddedCosmetics = getModdedCosmetics(unlocked);
    for (const [id, cosm] of Object.entries(moddedCosmetics)) {
      if (cosm.category === cat) {
        options.push({ id, name: cosm.name, icon: cosm.icon });
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }

  const CATEGORY_LABELS: Record<string, string> = {
    hat: '🎩 Hats', undershirt: '👕 Undershirts', overshirt: '🧥 Overshirts',
    accessory: '💍 Accessories', title: '🏷️ Titles', pattern: '🎨 Patterns',
    primary_color: '🟡 Primary Colors', secondary_color: '🔵 Secondary Colors',
    eye: '👁️ Eyes', nose: '👃 Noses', mouth: '👄 Mouths', species: '🐱 Species',
    bobber: '🎈 Bobbers', tail: '🦊 Tails', legs: '🦵 Legs',
  };

  const SLOT_ICONS: Record<string, string> = {
    species: '🐱', pattern: '🎨', primary_color: '🟡', secondary_color: '🔵',
    hat: '🎩', undershirt: '👕', overshirt: '🧥', title: '🏷️', bobber: '🎈',
    eye: '👁️', nose: '👃', mouth: '👄', accessory: '💍', tail: '🦊', legs: '🦵',
  };

  // Stats
  let totalCosmetics = $derived(Object.keys(COSMETICS).length);
  let shopCount = $derived(SHOP_COSMETICS.length);
  let chestCount = $derived(CHEST_COSMETICS.length);
  let questCount = $derived(QUEST_COSMETICS.length);
  let rankCount = $derived(RANK_COSMETICS.length);
  let devCount = $derived(DEV_COSMETICS.length);
</script>

{#if $saveData}
  {@const unlocked = ($saveData.cosmetics_unlocked as string[]) ?? []}
  {@const equipped = ($saveData.cosmetics_equipped as Record<string, unknown>) ?? {}}
  {@const cats = getCategories(unlocked, searchQuery)}
  {@const unlockedChest = CHEST_COSMETICS.filter(id => unlocked.includes(id)).length}
  {@const unlockedQuest = QUEST_COSMETICS.filter(id => unlocked.includes(id)).length}
  {@const unlockedRank = RANK_COSMETICS.filter(id => unlocked.includes(id)).length}
  {@const unlockedShop = SHOP_COSMETICS.filter(id => unlocked.includes(id)).length}
  {@const moddedAllIds = Object.keys(getModdedCosmeticOverrides())}
  {@const totalModdedCosmetics = moddedAllIds.length}
  {@const unlockedModdedCount = moddedAllIds.filter(id => unlocked.includes(id)).length}

  <div class="space-y-4">
    <!-- Source Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
      <button onclick={() => sourceFilter = 'all'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'all' ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-white/90">{unlocked.length}</div>
        <div class="text-[10px] text-white/30 uppercase tracking-wider">All Unlocked</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-violet-500 h-1 rounded-full transition-all" style="width: {(unlocked.length / totalCosmetics * 100).toFixed(1)}%"></div></div>
      </button>
      <button onclick={() => sourceFilter = 'chest'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'chest' ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-amber-400">{unlockedChest}<span class="text-xs text-white/20">/{chestCount}</span></div>
        <div class="text-[10px] text-amber-400/50 uppercase tracking-wider">🎁 Chest</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-amber-500 h-1 rounded-full transition-all" style="width: {(unlockedChest / chestCount * 100).toFixed(1)}%"></div></div>
      </button>
      <button onclick={() => sourceFilter = 'quest'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'quest' ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-cyan-400">{unlockedQuest}<span class="text-xs text-white/20">/{questCount}</span></div>
        <div class="text-[10px] text-cyan-400/50 uppercase tracking-wider">📋 Quest</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-cyan-500 h-1 rounded-full transition-all" style="width: {(unlockedQuest / questCount * 100).toFixed(1)}%"></div></div>
      </button>
      <button onclick={() => sourceFilter = 'rank'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'rank' ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-yellow-400">{unlockedRank}<span class="text-xs text-white/20">/{rankCount}</span></div>
        <div class="text-[10px] text-yellow-400/50 uppercase tracking-wider">⭐ Rank</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-yellow-500 h-1 rounded-full transition-all" style="width: {(unlockedRank / rankCount * 100).toFixed(1)}%"></div></div>
      </button>
      <button onclick={() => sourceFilter = 'shop'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'shop' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-emerald-400">{unlockedShop}<span class="text-xs text-white/20">/{shopCount}</span></div>
        <div class="text-[10px] text-emerald-400/50 uppercase tracking-wider">🏪 Shop</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-emerald-500 h-1 rounded-full transition-all" style="width: {(unlockedShop / shopCount * 100).toFixed(1)}%"></div></div>
      </button>
      <button onclick={() => sourceFilter = 'modded'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'modded' ? 'border-fuchsia-500/40 bg-fuchsia-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-fuchsia-400">{totalModdedCosmetics > 0 ? unlockedModdedCount : '—'}{#if totalModdedCosmetics > 0}<span class="text-xs text-white/20">/{totalModdedCosmetics}</span>{/if}</div>
        <div class="text-[10px] text-fuchsia-400/50 uppercase tracking-wider">🧩 Modded</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-fuchsia-500 h-1 rounded-full transition-all" style="width: {totalModdedCosmetics > 0 ? (unlockedModdedCount / totalModdedCosmetics * 100).toFixed(1) : 0}%"></div></div>
      </button>
    </div>

    <!-- Header -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>👕</span> Cosmetics
          <span class="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">{unlocked.length} / {totalCosmetics}</span>
        </h3>
        <div class="flex gap-2 flex-wrap">
          <button class="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium transition-all cursor-pointer" onclick={unlockAll}>
            ✨ Unlock All
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-all cursor-pointer" onclick={() => unlockBySource('chest')}>
            🎁 Unlock Chest
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-medium transition-all cursor-pointer" onclick={() => unlockBySource('quest')}>
            📋 Unlock Quest
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-medium transition-all cursor-pointer" onclick={() => unlockBySource('rank')}>
            ⭐ Unlock Rank
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300/80 text-xs font-medium transition-all cursor-pointer" onclick={() => unlockBySource('shop')}>
            🏪 Unlock Shop
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 text-xs font-medium transition-all cursor-pointer" onclick={unlockModded}>
            🧩 Unlock Modded
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/10 hover:bg-red-500/20 text-red-400/60 text-xs font-medium transition-all cursor-pointer" onclick={lockAll}>
            🔒 Lock All
          </button>
        </div>
      </div>
      <div class="flex gap-3 flex-wrap items-center">
        <input type="text" placeholder="Search cosmetics by name or ID..." bind:value={searchQuery}
          class="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all" />
        <button onclick={() => showDevCosmetics = !showDevCosmetics}
          class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap {showDevCosmetics ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'}">
          {showDevCosmetics ? '🔓' : '🔒'} Dev ({devCount})
        </button>
      </div>

      <!-- Source legend -->
      <div class="flex flex-wrap gap-2 text-[10px]">
        {#each Object.entries(SOURCE_BADGES) as [, badge]}
          <span class="{badge.bg} {badge.color} px-2 py-0.5 rounded-full font-medium">{badge.label}</span>
        {/each}
        <span class="text-white/20 ml-1">← Source badges show where each cosmetic is obtained</span>
      </div>

      {#each Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0])) as [cat, entries] (cat)}
        <details class="group">
          <summary class="cursor-pointer py-2 px-3 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2">
            <span class="text-sm font-medium text-white/70">{CATEGORY_LABELS[cat] ?? `📦 ${cat}`}</span>
            <span class="text-xs text-white/30">{entries.filter(e => e.isUnlocked).length}/{entries.length}</span>
            <div class="ml-auto flex items-center gap-1.5">
              {#if entries.some(e => e.source === 'chest')}
                <span class="text-[8px] bg-amber-500/15 text-amber-400/60 px-1 rounded">🎁 {entries.filter(e => e.source === 'chest').length}</span>
              {/if}
              {#if entries.some(e => e.source === 'quest')}
                <span class="text-[8px] bg-cyan-500/15 text-cyan-400/60 px-1 rounded">📋 {entries.filter(e => e.source === 'quest').length}</span>
              {/if}
              {#if entries.some(e => e.source === 'modded')}
                <span class="text-[8px] bg-fuchsia-500/15 text-fuchsia-400/60 px-1 rounded">🧩 {entries.filter(e => e.source === 'modded').length}</span>
              {/if}
              <svg class="w-4 h-4 text-white/30 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          </summary>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pt-2 pl-2">
            {#each entries as entry (entry.id)}
              {@const badge = SOURCE_BADGES[entry.source]}
              <label class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all {entry.isUnlocked ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/5 opacity-60 hover:opacity-100'}">
                <input type="checkbox" checked={entry.isUnlocked}
                  onchange={(e) => toggleCosm(entry.id, (e.target as HTMLInputElement).checked)}
                  class="accent-violet-500 rounded shrink-0" />
                {#if entry.icon}
                  <img src="/icons/{entry.icon}" alt="" class="w-8 h-8 object-contain shrink-0 pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                {:else if entry.source === 'modded'}
                  <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-8 h-8 object-contain shrink-0" />
                {:else}
                  <span class="w-8 h-8 flex items-center justify-center shrink-0 text-white/20 text-lg">{SLOT_ICONS[entry.source] ?? '📦'}</span>
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-medium text-white/80 truncate">{entry.name}</div>
                  <div class="text-[10px] text-white/25 font-mono truncate">{entry.id}</div>
                </div>
                {#if badge && entry.source !== 'shop'}
                  <span class="text-[9px] {badge.bg} {badge.color} px-1.5 py-0.5 rounded-full shrink-0 font-medium">{badge.label}</span>
                {/if}
              </label>
            {/each}
          </div>
        </details>
      {/each}
    </div>

    <!-- Equipped -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
        <span>🎨</span> Equipped Cosmetics
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {#each Object.entries(equipped) as [slot, val] (slot)}
          {@const icon = !Array.isArray(val) && val ? getThingIcon(String(val)) : null}
          {@const source = !Array.isArray(val) && val ? getCosmeticSource(String(val)) : null}
          {@const badge = source ? SOURCE_BADGES[source] : null}
          {@const options = getSlotOptions(slot, unlocked)}
          <div class="block">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-white/40 capitalize flex items-center gap-1">
                <span>{SLOT_ICONS[slot] ?? '📦'}</span>
                {slot.replace('_', ' ')}
              </span>
              {#if badge && source !== 'shop'}
                <span class="text-[8px] {badge.bg} {badge.color} px-1 py-0 rounded-full font-medium">{badge.label}</span>
              {/if}
            </div>
            <div class="flex items-center gap-2 mt-1">
              {#if icon}
                <img src="/icons/{icon}" alt="" class="w-6 h-6 object-contain shrink-0 pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
              {:else}
                <span class="w-6 h-6 flex items-center justify-center shrink-0 text-white/20 text-sm">{SLOT_ICONS[slot] ?? '📦'}</span>
              {/if}
              {#if slot === 'accessory'}
                <!-- Accessory: multi-select with checkboxes (up to 4) -->
                {@const currentAccessories = Array.isArray(val) ? (val as string[]) : []}
                <div class="w-full">
                  <details class="group/acc">
                    <summary class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs cursor-pointer hover:bg-white/[0.08] transition-all flex items-center justify-between">
                      <span class="truncate">{currentAccessories.length > 0 ? currentAccessories.map(id => getThingName(id)).join(', ') : 'None equipped'}</span>
                      <span class="text-[10px] text-white/30 ml-2 shrink-0">{currentAccessories.length}/4</span>
                    </summary>
                    <div class="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a2e] p-1 space-y-0.5">
                      {#each options as opt (opt.id)}
                        {@const isEquipped = currentAccessories.includes(opt.id)}
                        <label class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-white/5 transition-colors {isEquipped ? 'bg-violet-500/10' : ''}">
                          <input type="checkbox" checked={isEquipped}
                            disabled={!isEquipped && currentAccessories.length >= 4}
                            onchange={(e) => toggleAccessory(opt.id, (e.target as HTMLInputElement).checked)}
                            class="accent-violet-500 shrink-0" />
                          {#if opt.icon}
                            <img src="/icons/{opt.icon}" alt="" class="w-5 h-5 object-contain shrink-0 pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                          {:else}
                            <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-5 h-5 object-contain shrink-0" />
                          {/if}
                          <span class="text-xs text-white/70 truncate">{opt.name}</span>
                        </label>
                      {/each}
                      {#if options.length === 0}
                        <div class="text-[10px] text-white/20 px-2 py-1">No unlocked accessories</div>
                      {/if}
                    </div>
                  </details>
                </div>
              {:else}
                <!-- Single-select dropdown -->
                <select
                  value={String(val ?? '')}
                  onchange={(e) => updateEquipped(slot, (e.target as HTMLSelectElement).value)}
                  class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500/50 cursor-pointer transition-all">
                  {#each options as opt (opt.id)}
                    <option value={opt.id} class="bg-[#1a1a2e] text-white">{opt.name} ({opt.id})</option>
                  {/each}
                  {#if val && !options.find(o => o.id === String(val))}
                    <option value={String(val)} class="bg-[#1a1a2e] text-white">{getThingName(String(val))} ({val}) — not unlocked</option>
                  {/if}
                </select>
              {/if}
            </div>
            {#if !Array.isArray(val) && val}
              <div class="text-[10px] text-white/25 mt-0.5 pl-8">{getThingName(String(val))}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .pixelated { image-rendering: pixelated; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
</style>
