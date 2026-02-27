<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { RANK_TITLES, ALL_LURES, ALL_BAIT, getXpGoal } from '$lib/gamedata';
  import { ITEMS, getThingIcon, getThingName } from '$lib/gamedata-extracted';
  import QualityPicker from './QualityPicker.svelte';

  // --- Aqua Fish ---
  function updateAqua(key: string, value: unknown) {
    saveData.update(d => {
      if (!d) return d;
      const current = (d.saved_aqua_fish as Record<string, unknown>) ?? { id: 'empty', ref: 0, size: 1.0, quality: 0 };
      d.saved_aqua_fish = { ...current, [key]: value };
      return d;
    });
  }

  const fishOptions = Object.entries(ITEMS)
    .filter(([, item]) => item.category === 'fish')
    .map(([id, item]) => ({ id, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  function update(key: string, value: number | string) {
    saveData.update(d => { if (d) d[key] = value; return d; });
  }
  function toggleLure(id: string, checked: boolean) {
    saveData.update(d => {
      if (!d) return d;
      const arr = d.lure_unlocked as string[];
      if (checked && !arr.includes(id)) d.lure_unlocked = [...arr, id];
      else if (!checked) d.lure_unlocked = arr.filter((x: string) => x !== id);
      return d;
    });
  }
  function toggleBaitUnlock(id: string, checked: boolean) {
    saveData.update(d => {
      if (!d) return d;
      const arr = d.bait_unlocked as string[];
      if (checked && !arr.includes(id)) d.bait_unlocked = [...arr, id];
      else if (!checked) d.bait_unlocked = arr.filter((x: string) => x !== id);
      return d;
    });
  }
  function updateBaitQty(id: string, qty: number) {
    saveData.update(d => {
      if (!d) return d;
      d.bait_inv = { ...(d.bait_inv as Record<string, number>), [id]: qty };
      return d;
    });
  }
  function maxAllUpgrades() {
    saveData.update(d => {
      if (!d) return d;
      d.rod_power = 8; d.rod_speed = 5; d.rod_chance = 5; d.rod_luck = 5;
      d.buddy_level = 5; d.buddy_speed = 5;
      return d;
    });
    addToast('🎣 All upgrades maxed!', 'success');
  }
  function unlockAllLures() {
    saveData.update(d => {
      if (!d) return d;
      const existing = (d.lure_unlocked as string[]) ?? [];
      const vanilla = ALL_LURES.filter(l => l.id).map(l => l.id);
      // Merge: keep modded lures + add all vanilla
      const merged = [...existing.filter(id => !vanilla.includes(id)), ...vanilla];
      d.lure_unlocked = merged;
      return d;
    });
    addToast('🪝 All lures unlocked!', 'success');
  }
  function maxAllBait() {
    saveData.update(d => {
      if (!d) return d;
      const existing = (d.bait_unlocked as string[]) ?? [];
      const vanilla = ALL_BAIT.filter(b => b.id).map(b => b.id);
      // Merge: keep modded bait + add all vanilla
      const merged = [...existing.filter(id => !vanilla.includes(id)), ...vanilla];
      d.bait_unlocked = merged;
      const newBaitInv = { ...(d.bait_inv as Record<string, number>) };
      for (const b of ALL_BAIT) {
        if (b.id) newBaitInv[b.id] = 999;
      }
      d.bait_inv = newBaitInv;
      return d;
    });
    addToast('🪱 All bait maxed!', 'success');
  }

  const inputClass = "mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all";

  const ROD_COSTS = [100, 350, 1000, 5000, 10000, 12500, 17500, 25000, 30000, 40000, 50000];
  const ROD_DESCS: Record<string, string> = {
    rod_power: 'Increases reel-in force per tick',
    rod_speed: 'Faster line retrieval speed',
    rod_chance: 'Higher bite chance per tick',
    rod_luck: 'Increases rare fish probability',
  };
  const BUDDY_DESCS: Record<string, string> = {
    buddy_level: 'Unlocks new buddy abilities',
    buddy_speed: 'Faster buddy fetch speed',
  };
</script>

{#if $saveData}
  {@const rodPower = ($saveData.rod_power ?? 0) as number}
  {@const rodSpeed = ($saveData.rod_speed ?? 0) as number}
  {@const rodChance = ($saveData.rod_chance ?? 0) as number}
  {@const rodLuck = ($saveData.rod_luck ?? 0) as number}
  {@const totalUpgrades = rodPower + rodSpeed + rodChance + rodLuck}
  {@const maxUpgrades = 8 + 5 + 5 + 5}
  {@const upgradePct = Math.round(totalUpgrades / maxUpgrades * 100)}
  {@const luresUnlocked = (($saveData.lure_unlocked as string[]) ?? []).filter(l => l).length}
  {@const luresMax = ALL_LURES.filter(l => l.id).length}
  {@const baitTypes = ALL_BAIT.filter(b => b.id)}
  {@const baitUnlocked = baitTypes.filter(b => (($saveData.bait_unlocked as string[]) ?? []).includes(b.id)).length}
  {@const totalBait = baitTypes.reduce((s, b) => s + (($saveData.bait_inv as Record<string, number>)?.[b.id] ?? 0), 0)}
  {@const aqua = ($saveData.saved_aqua_fish as Record<string, unknown>) ?? { id: 'empty', ref: 0, size: 1.0, quality: 0 }}

  <div class="space-y-4">
    <!-- Stats Dashboard -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
        <div class="text-[10px] text-sky-400/50 uppercase tracking-wider font-medium">Rod Upgrades</div>
        <div class="text-2xl font-bold text-sky-400 font-mono mt-1">{upgradePct}%</div>
        <div class="text-[10px] text-white/20 font-mono">{totalUpgrades}/{maxUpgrades}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Lures</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{luresUnlocked}<span class="text-xs text-white/20">/{luresMax}</span></div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Bait Types</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{baitUnlocked}<span class="text-xs text-white/20">/{baitTypes.length}</span></div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Total Bait</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{totalBait.toLocaleString()}</div>
      </div>
      <div class="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-4">
        <div class="text-[10px] text-yellow-400/50 uppercase tracking-wider font-medium">Level</div>
        <div class="text-2xl font-bold text-yellow-400 font-mono mt-1">{$saveData.level ?? 1}</div>
        <div class="text-[10px] text-yellow-400/40">{RANK_TITLES[$saveData.level] ?? ''}</div>
      </div>
    </div>

    <!-- Quick Actions Bar -->
    <div class="flex flex-wrap gap-2">
      <button onclick={maxAllUpgrades} class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 border border-sky-500/20 text-sky-300 text-xs font-medium transition-all cursor-pointer">🎣 Max All Upgrades</button>
      <button onclick={unlockAllLures} class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 border border-violet-500/20 text-violet-300 text-xs font-medium transition-all cursor-pointer">🪝 Unlock All Lures</button>
      <button onclick={maxAllBait} class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 border border-pink-500/20 text-pink-300 text-xs font-medium transition-all cursor-pointer">🪱 Max All Bait</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Rank -->
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>⭐</span> Rank
        </h3>
        <label class="block">
          <span class="text-xs text-white/40">Level (1-50)</span>
          <input type="number" min="1" max="50" value={$saveData.level ?? 1}
            onchange={(e) => update('level', +(e.target as HTMLInputElement).value)}
            class={inputClass} />
        </label>
        <div class="text-sm text-yellow-400 font-medium">{RANK_TITLES[$saveData.level] ?? ''}</div>
        <label class="block">
          <span class="text-xs text-white/40">Current XP</span>
          <input type="number" min="0" value={$saveData.xp ?? 0}
            onchange={(e) => update('xp', +(e.target as HTMLInputElement).value)}
            class={inputClass} />
          {#if ($saveData.level ?? 1) < 50}
            <div class="text-[9px] text-white/20 mt-0.5">Next rank: {getXpGoal(($saveData.level ?? 1) as number).toLocaleString()} XP needed</div>
          {:else}
            <div class="text-[9px] text-emerald-400/40 mt-0.5">MAX RANK</div>
          {/if}
        </label>
        <label class="block">
          <span class="text-xs text-white/40">Fish Caught</span>
          <input type="text" inputmode="numeric"
            value={Number($saveData.fish_caught ?? 0).toLocaleString()}
            onchange={(e) => { const v = +(e.target as HTMLInputElement).value.replace(/[^0-9]/g, ''); update('fish_caught', v); (e.target as HTMLInputElement).value = v.toLocaleString(); }}
            class={inputClass} />
        </label>
      </div>

      <!-- Rod -->
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🎣</span> Rod
        </h3>
        {#each [['rod_power', 'Power', 8], ['rod_speed', 'Speed', 5], ['rod_chance', 'Chance', 5], ['rod_luck', 'Luck', 5]] as [key, label, max]}
          {@const val = ($saveData[key] ?? 0) as number}
          {@const pct = Math.round(val / (max as number) * 100)}
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="text-white/40">{label}</span>
              <span class="text-white/60 font-mono">{val}/{max}</span>
            </div>
            <div class="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300 {pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-sky-500/60'}" style="width: {pct}%"></div>
            </div>
            <input type="range" min="0" max={max} value={val}
              oninput={(e) => update(key as string, +(e.target as HTMLInputElement).value)}
              class="w-full accent-sky-500 h-1" />
            <div class="text-[9px] text-white/20">{ROD_DESCS[key as string] ?? ''}{val < (max as number) ? ` · Next: $${(ROD_COSTS[val] ?? 0).toLocaleString()}` : ' · MAX'}</div>
          </div>
        {/each}
      </div>

      <!-- Buddy -->
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🐕</span> Buddy
        </h3>
        {#each [['buddy_level', 'Level', 5], ['buddy_speed', 'Speed', 5]] as [key, label, max]}
          {@const val = ($saveData[key] ?? 0) as number}
          {@const pct = Math.round(val / (max as number) * 100)}
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="text-white/40">{label}</span>
              <span class="text-white/60 font-mono">{val}/{max}</span>
            </div>
            <div class="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300 {pct === 100 ? 'bg-emerald-500' : 'bg-amber-500/60'}" style="width: {pct}%"></div>
            </div>
            <input type="range" min="0" max={max} value={val}
              oninput={(e) => update(key as string, +(e.target as HTMLInputElement).value)}
              class="w-full accent-amber-500 h-1" />
            <div class="text-[9px] text-white/20">{BUDDY_DESCS[key as string] ?? ''}{val < (max as number) ? ` · Next: $${(ROD_COSTS[val] ?? 0).toLocaleString()}` : ' · MAX'}</div>
          </div>
        {/each}
      </div>

      <!-- Voice -->
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🎵</span> Voice
        </h3>
        <label class="block">
          <span class="text-xs text-white/40">Pitch</span>
          <input type="number" step="0.1" value={$saveData.voice_pitch ?? 1.5}
            onchange={(e) => update('voice_pitch', +(e.target as HTMLInputElement).value)}
            class={inputClass} />
          <div class="text-[9px] text-white/20 mt-0.5">Range: 0.5 – 3.0 typical</div>
        </label>
        <label class="block">
          <span class="text-xs text-white/40">Speed</span>
          <input type="number" step="0.1" value={$saveData.voice_speed ?? 5}
            onchange={(e) => update('voice_speed', +(e.target as HTMLInputElement).value)}
            class={inputClass} />
          <div class="text-[9px] text-white/20 mt-0.5">Range: 1.0 – 10.0 typical</div>
        </label>
      </div>
    </div>

    <!-- Lures -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🪝</span> Lures
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{luresUnlocked}/{luresMax}</span>
        </h3>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2">
            <span class="text-xs text-white/40">Selected:</span>
            <select value={$saveData.lure_selected ?? ''}
              onchange={(e) => update('lure_selected', (e.target as HTMLSelectElement).value)}
              class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500/50 cursor-pointer">
              <option value="" class="bg-[#1a1a2e]">Bare Hook (default)</option>
              {#each ALL_LURES.filter(l => l.id) as lure}
                <option value={lure.id} class="bg-[#1a1a2e]">{lure.name}</option>
              {/each}
            </select>
          </label>
          <button onclick={unlockAllLures} class="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-xs font-medium transition-all cursor-pointer">Unlock All</button>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {#each ALL_LURES.filter(l => l.id) as lure}
          {@const unlocked = ($saveData.lure_unlocked as string[])?.includes(lure.id)}
          {@const isSelected = ($saveData.lure_selected ?? '') === lure.id}
          {@const lureIcons: Record<string, string> = {
            'fly_hook': 'bait_icons10.png', 'lucky_hook': 'bait_icons11.png', 'patient_lure': 'bait_icons12.png',
            'quick_jig': 'bait_icons13.png', 'salty_lure': 'bait_icons19.png', 'fresh_lure': 'bait_icons21.png',
            'efficient_lure': 'bait_icons14.png', 'magnet_lure': 'bait_icons15.png', 'large_lure': 'bait_icons16.png',
            'attractive_angler': 'bait_icons17.png', 'sparkling_lure': 'bait_icons18.png', 'double_hook': 'bait_icons20.png',
            'gold_hook': 'bait_icons22.png', 'challenge_lure': 'bait_icons23.png', 'rain_lure': 'bait_icons24.png',
          }}
          <label class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors {isSelected ? 'bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/20' : unlocked ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/5'}">
            <input type="checkbox" checked={unlocked}
              onchange={(e) => toggleLure(lure.id, (e.target as HTMLInputElement).checked)}
              class="accent-sky-500 rounded" />
            {#if lureIcons[lure.id]}
              <img src="/icons/{lureIcons[lure.id]}" alt="" class="w-7 h-7 object-contain pixelated shrink-0" />
            {/if}
            <div>
              <div class="text-xs font-medium text-white/80 flex items-center gap-1.5">
                {lure.name}
                {#if isSelected}
                  <span class="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded font-bold">EQUIPPED</span>
                {/if}
              </div>
              <div class="text-[10px] text-white/30">{lure.desc}</div>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- Bait -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🪱</span> Bait
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{baitUnlocked}/{baitTypes.length}</span>
        </h3>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2">
            <span class="text-xs text-white/40">Selected:</span>
            <select value={$saveData.bait_selected ?? ''}
              onchange={(e) => update('bait_selected', (e.target as HTMLSelectElement).value)}
              class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500/50 cursor-pointer">
              {#each ALL_BAIT as b}
                <option value={b.id} class="bg-[#1a1a2e]">{b.name}</option>
              {/each}
            </select>
          </label>
          <button onclick={maxAllBait} class="px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-xs font-medium transition-all cursor-pointer">Max All</button>
        </div>
      </div>
      <label class="block max-w-xs">
        <span class="text-xs text-white/40">Max Capacity</span>
        <input type="number" min="1" max="9999" value={$saveData.max_bait ?? 5}
          onchange={(e) => update('max_bait', +(e.target as HTMLInputElement).value)}
          class={inputClass} />
      </label>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {#each ALL_BAIT.filter(b => b.id) as bait}
          {@const unlocked = ($saveData.bait_unlocked as string[])?.includes(bait.id)}
          {@const isSelected = ($saveData.bait_selected ?? '') === bait.id}
          {@const qty = ($saveData.bait_inv as Record<string, number>)?.[bait.id] ?? 0}
          {@const baitIcons: Record<string, string> = {
            'worms': 'bait_icons2.png', 'cricket': 'bait_icons3.png', 'leech': 'bait_icons4.png',
            'minnow': 'bait_icons5.png', 'squid': 'bait_icons6.png', 'nautilus': 'bait_icons7.png',
            'gildedworm': 'bait_icons25.png',
          }}
          <div class="p-3 rounded-lg border transition-colors {isSelected ? 'bg-amber-500/5 border-amber-500/20 ring-1 ring-amber-500/10' : unlocked ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-white/[0.02] border-white/5'}">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={unlocked}
                onchange={(e) => toggleBaitUnlock(bait.id, (e.target as HTMLInputElement).checked)}
                class="accent-emerald-500 rounded" />
              {#if baitIcons[bait.id]}
                <img src="/icons/{baitIcons[bait.id]}" alt="" class="w-6 h-6 object-contain pixelated shrink-0" />
              {/if}
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium text-white/80 flex items-center gap-1">
                  {bait.name}
                  {#if isSelected}
                    <span class="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded font-bold">ACTIVE</span>
                  {/if}
                </div>
              </div>
              <span class="text-[10px] text-white/25 shrink-0">${bait.cost}</span>
            </label>
            <div class="flex items-center gap-1.5 mt-2">
              <input type="number" min="0" max="9999" value={qty}
                onchange={(e) => updateBaitQty(bait.id, +(e.target as HTMLInputElement).value)}
                class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
              <button class="px-1.5 py-1 rounded bg-white/5 hover:bg-emerald-500/20 text-white/20 hover:text-emerald-300 text-[9px] font-mono transition-colors cursor-pointer" onclick={() => updateBaitQty(bait.id, 999)}>999</button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Aquarium Fish -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
        <span>🐠</span> Aquarium Fish
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="block">
          <span class="text-xs text-white/40">Fish</span>
          <div class="flex items-center gap-2 mt-1">
            {#if getThingIcon(String(aqua.id ?? ''))}
              <img src="/icons/{getThingIcon(String(aqua.id ?? ''))}" alt="" class="w-8 h-8 object-contain pixelated shrink-0" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
            {/if}
            <select value={String(aqua.id ?? 'empty')}
              onchange={(e) => updateAqua('id', (e.target as HTMLSelectElement).value)}
              class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all cursor-pointer">
              <option value="empty" class="bg-[#1a1a2e]">Empty</option>
              {#each fishOptions as fish}
                <option value={fish.id} class="bg-[#1a1a2e]">{fish.name}</option>
              {/each}
            </select>
          </div>
        </label>
        <label class="block">
          <span class="text-xs text-white/40">Size</span>
          <input type="number" step="0.1" min="0" value={aqua.size ?? 1.0}
            onchange={(e) => updateAqua('size', +(e.target as HTMLInputElement).value)}
            class="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
        </label>
        <div class="block">
          <QualityPicker value={aqua.quality ?? 0} onchange={(q) => updateAqua('quality', q)} />
        </div>
        <label class="block">
          <span class="text-xs text-white/40">Ref ID</span>
          <input type="number" min="0" value={aqua.ref ?? 0}
            onchange={(e) => updateAqua('ref', +(e.target as HTMLInputElement).value)}
            class="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
        </label>
      </div>
    </div>
  </div>
{/if}

<style>
  .pixelated { image-rendering: pixelated; }
</style>
