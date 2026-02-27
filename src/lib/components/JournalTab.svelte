<script lang="ts">
  import { saveData, addToast, rollItemSize, simulateRecord, simulateCatchCount } from '$lib/stores/save';
  import { QUALITY_NAMES, QUALITY_COLORS } from '$lib/gamedata';
  import { getThingName, getThingIcon, ITEMS, FISH_DATA, isModdedItem, getModdedFishList } from '$lib/gamedata-extracted';

  type JournalEntry = { count: number; record: number; quality: number[] };
  type JournalZone = Record<string, JournalEntry>;

  let preserveExisting = $state(true);
  let journalSearch = $state('');
  let openZones = $state<Set<string>>(new Set());

  // Auto-inject modded fish into journal on load
  $effect(() => {
    const d = $saveData;
    if (!d?.journal) return;
    const j = d.journal as Record<string, JournalZone>;
    const allIds = new Set(Object.values(j).flatMap(z => Object.keys(z)));
    const moddedFish = getModdedFishList();
    const missing = moddedFish.filter(f => !allIds.has(f.id));
    if (missing.length === 0) return;
    saveData.update(sd => {
      if (!sd) return sd;
      const journal = sd.journal as Record<string, JournalZone>;
      for (const fish of missing) {
        const zone = fish.loot_table || 'lake';
        if (!journal[zone]) journal[zone] = {};
        if (!journal[zone][fish.id]) {
          journal[zone][fish.id] = { count: 0, record: 0, quality: [] };
        }
      }
      sd.journal = { ...journal };
      return sd;
    });
    addToast(`🧩 Auto-added ${missing.length} modded fish to journal`, 'info');
  });

  const ZONE_LABELS: Record<string, string> = {
    lake: '🏞️ Lake (Freshwater)',
    ocean: '🌊 Ocean (Saltwater)',
    rain: '🌧️ Rain Special',
    water_trash: '🗑️ Trash',
    alien: '👽 Alien',
    void: '🕳️ Void',
    deep: '🌑 Deep Sea',
  };
  const ZONE_COLORS: Record<string, string> = {
    lake: 'bg-sky-500', ocean: 'bg-blue-500', rain: 'bg-violet-500',
    water_trash: 'bg-gray-500', alien: 'bg-green-500', void: 'bg-purple-500', deep: 'bg-indigo-500',
  };
  const TIER_BADGES: Record<number, { label: string; color: string; bg: string }> = {
    0: { label: 'T0', color: 'text-gray-400',   bg: 'bg-gray-500/20' },
    1: { label: 'T1', color: 'text-green-400',  bg: 'bg-green-500/20' },
    2: { label: 'T2', color: 'text-blue-400',   bg: 'bg-blue-500/20' },
    3: { label: 'T3', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    4: { label: 'T4', color: 'text-amber-400',  bg: 'bg-amber-500/20' },
    5: { label: 'T5', color: 'text-red-400',    bg: 'bg-red-500/20' },
  };

  function fillAll() {
    saveData.update(d => {
      if (!d) return d;
      const j = d.journal as Record<string, JournalZone>;
      const newJournal: Record<string, JournalZone> = {};
      for (const zone of Object.keys(j)) {
        newJournal[zone] = {};
        for (const fish of Object.keys(j[zone])) {
          const existing = j[zone][fish];
          if (preserveExisting && existing.count > 0) {
            newJournal[zone][fish] = existing;
          } else {
            const count = simulateCatchCount(fish);
            newJournal[zone][fish] = { count, record: simulateRecord(fish, count), quality: [0, 1, 2, 3, 4, 5] };
          }
        }
      }
      d.journal = newJournal;
      // Sync fish_caught with journal total
      const totalCaught = Object.values(newJournal).reduce((sum, z) => sum + Object.values(z).reduce((s, f) => s + (f.count || 0), 0), 0);
      d.fish_caught = Math.max((d.fish_caught as number) ?? 0, totalCaught);
      return d;
    });
    addToast(preserveExisting ? '📖 Filled empty entries (existing preserved)!' : '📖 Journal filled with realistic game data!', 'success');
  }
  function fillZone(zone: string) {
    saveData.update(d => {
      if (!d) return d;
      const j = d.journal as Record<string, JournalZone>;
      if (!j[zone]) return d;
      const newZone: JournalZone = {};
      for (const fish of Object.keys(j[zone])) {
        const existing = j[zone][fish];
        if (preserveExisting && existing.count > 0) {
          newZone[fish] = existing;
        } else {
          const count = simulateCatchCount(fish);
          newZone[fish] = { count, record: simulateRecord(fish, count), quality: [0, 1, 2, 3, 4, 5] };
        }
      }
      const newJournal = { ...j, [zone]: newZone };
      d.journal = newJournal;
      // Sync fish_caught with journal total
      const totalCaught = Object.values(newJournal).reduce((sum, z) => sum + Object.values(z).reduce((s, f) => s + (f.count || 0), 0), 0);
      d.fish_caught = Math.max((d.fish_caught as number) ?? 0, totalCaught);
      return d;
    });
    addToast(preserveExisting ? `📖 Filled empty entries in ${zone}!` : `📖 ${zone} zone filled with realistic data!`, 'success');
  }
  function fillFish(zone: string, fishId: string) {
    saveData.update(d => {
      if (!d) return d;
      const j = d.journal as Record<string, JournalZone>;
      if (!j[zone]?.[fishId]) return d;
      const existing = j[zone][fishId];
      if (preserveExisting && existing.count > 0) {
        addToast(`⏩ Skipped ${getThingName(fishId)} (already caught, preserve mode on)`, 'info');
        return d;
      }
      const count = simulateCatchCount(fishId);
      const newEntry = { count, record: simulateRecord(fishId, count), quality: [0, 1, 2, 3, 4, 5] };
      const newJournal = { ...j, [zone]: { ...j[zone], [fishId]: newEntry } };
      d.journal = newJournal;
      const totalCaught = Object.values(newJournal).reduce((sum, z) => sum + Object.values(z).reduce((s, f) => s + (f.count || 0), 0), 0);
      d.fish_caught = Math.max((d.fish_caught as number) ?? 0, totalCaught);
      return d;
    });
    addToast(`🐟 Generated realistic data for ${getThingName(fishId)}!`, 'success');
  }
  function clearAll() {
    if (!confirm('Clear all journal progression? (resets caught/record/qualities but keeps fish entries)')) return;
    saveData.update(d => {
      if (!d) return d;
      const j = d.journal as Record<string, JournalZone>;
      const newJ: Record<string, JournalZone> = {};
      for (const zone of Object.keys(j)) {
        newJ[zone] = {};
        for (const fish of Object.keys(j[zone])) {
          newJ[zone][fish] = { count: 0, record: 0, quality: [] };
        }
      }
      d.journal = newJ;
      return d;
    });
    addToast('🧹 Journal progression cleared (fish entries preserved)', 'info');
  }
  function updateEntry(zone: string, fish: string, key: string, value: number) {
    saveData.update(d => {
      if (!d) return d;
      const j = d.journal as Record<string, JournalZone>;
      const entry = j[zone]?.[fish];
      if (!entry) return d;
      const newEntry = { ...entry, [key]: value };
      const newJournal = { ...j, [zone]: { ...j[zone], [fish]: newEntry } };
      d.journal = newJournal;
      if (key === 'count') {
        const totalCaught = Object.values(newJournal).reduce((sum, z) => sum + Object.values(z).reduce((s, f) => s + (f.count || 0), 0), 0);
        d.fish_caught = Math.max((d.fish_caught as number) ?? 0, totalCaught);
      }
      return d;
    });
  }
  function toggleQuality(zone: string, fish: string, qi: number, checked: boolean) {
    saveData.update(d => {
      if (!d) return d;
      const j = d.journal as Record<string, JournalZone>;
      const entry = j[zone]?.[fish];
      if (!entry) return d;
      const arr = entry.quality;
      const newQuality = checked ? (arr.includes(qi) ? arr : [...arr, qi]) : arr.filter(q => q !== qi);
      d.journal = { ...j, [zone]: { ...j[zone], [fish]: { ...entry, quality: newQuality } } };
      return d;
    });
  }

  function getFishTier(id: string): number {
    return ITEMS[id]?.tier ?? -1;
  }
  function getFishValue(id: string): number {
    return ITEMS[id]?.sellValue ?? 0;
  }
</script>

{#if $saveData}
  {@const journal = ($saveData.journal as Record<string, JournalZone>) ?? {}}
  {@const totalFish = Object.values(journal).reduce((sum, z) => sum + Object.keys(z).length, 0)}
  {@const totalCaught = Object.values(journal).reduce((sum, z) => sum + Object.values(z).reduce((s, f) => s + (f.count || 0), 0), 0)}
  {@const allQualComplete = Object.values(journal).reduce((sum, z) => sum + Object.values(z).filter(f => f.quality?.length >= QUALITY_NAMES.length).length, 0)}
  {@const moddedFishCount = Object.values(journal).reduce((sum, z) => sum + Object.keys(z).filter(id => isModdedItem(id)).length, 0)}

  <div class="space-y-4">
    <!-- Journal Stats Dashboard -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4">
        <div class="text-[10px] text-indigo-400/50 uppercase tracking-wider font-medium">Species Discovered</div>
        <div class="text-2xl font-bold text-indigo-400 font-mono mt-1">{totalFish}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Total Caught</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{totalCaught.toLocaleString()}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">All 6 Qualities</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{allQualComplete}<span class="text-xs text-white/20">/{totalFish}</span></div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Zones</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{Object.keys(journal).length}</div>
      </div>
    </div>
    {#if moddedFishCount > 0}
      <div class="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-3 flex items-center gap-3">
        <span class="text-lg">🧩</span>
        <div>
          <div class="text-sm font-medium text-fuchsia-400">{moddedFishCount} Modded Fish Species Detected</div>
          <div class="text-[10px] text-white/25">Modded fish entries are fully preserved and editable</div>
        </div>
      </div>
    {/if}

    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>📖</span> Journal
        </h3>
        <div class="flex items-center gap-2">
          <input type="text" placeholder="Search fish..." bind:value={journalSearch}
            class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-sky-500/50 w-44" />
          <button onclick={() => preserveExisting = !preserveExisting}
            class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap {preserveExisting ? 'bg-amber-500/20 border-amber-500/20 text-amber-300' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}">
            {preserveExisting ? '🛡️ Preserve' : '♻️ Overwrite'}
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium transition-all cursor-pointer" onclick={fillAll}>Fill All</button>
          <button class="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-all cursor-pointer" onclick={clearAll}>Clear</button>
        </div>
      </div>

      {#each Object.entries(journal) as [zone, fishes]}
        {@const fishEntries = Object.entries(fishes)}
        {@const jq = journalSearch.toLowerCase()}
        {@const filteredFish = jq ? fishEntries.filter(([id]) => getThingName(id).toLowerCase().includes(jq) || id.toLowerCase().includes(jq)) : fishEntries}
        {@const zoneComplete = fishEntries.filter(([,f]) => f.quality?.length >= 6).length}
        {@const zonePct = fishEntries.length > 0 ? (zoneComplete / fishEntries.length * 100) : 0}
        {@const zoneCaught = fishEntries.reduce((s, [,f]) => s + (f.count || 0), 0)}
        {@const zoneModded = fishEntries.filter(([id]) => isModdedItem(id)).length}
        {#if !jq || filteredFish.length > 0}
        <details class="group" open={openZones.has(zone) || (!!jq && filteredFish.length > 0)}
          ontoggle={(e: Event) => { const el = e.target as HTMLDetailsElement; if (el.open) openZones.add(zone); else openZones.delete(zone); openZones = new Set(openZones); }}>
          <summary class="cursor-pointer py-3 px-4 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors flex items-center gap-3 border border-white/5">
            <span class="text-sm font-medium text-white/70">{ZONE_LABELS[zone] ?? `📍 ${zone}`}</span>
            <span class="text-xs text-white/30">{fishEntries.length} species</span>
            <span class="text-[10px] text-white/20 font-mono">{zoneCaught} caught</span>
            {#if zoneModded > 0}
              <span class="text-[8px] bg-fuchsia-500/15 text-fuchsia-400/70 px-1.5 py-0.5 rounded font-medium">🧩 {zoneModded} modded</span>
            {/if}
            <div class="ml-auto flex items-center gap-3">
              <!-- Zone progress bar -->
              <div class="flex items-center gap-2">
                <div class="w-20 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div class="h-full rounded-full transition-all {ZONE_COLORS[zone] ?? 'bg-white/30'}" style="width: {zonePct}%"></div>
                </div>
                <span class="text-[10px] text-white/30 font-mono w-8 text-right">{zonePct.toFixed(0)}%</span>
              </div>
              <button class="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400/60 hover:text-sky-400 text-[10px] font-medium border border-sky-500/10 hover:border-sky-500/20 transition-all cursor-pointer" onclick={(e) => { e.stopPropagation(); fillZone(zone); }}>🎲 Fill</button>
              <svg class="w-4 h-4 text-white/20 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          </summary>
          {#if filteredFish.length === 0}
            <div class="text-center py-4 text-white/15 text-xs">No entries</div>
          {:else}
            <div class="mt-2 space-y-1.5">
              {#each filteredFish as [fishId, data]}
                {@const icon = getThingIcon(fishId)}
                {@const fishName = getThingName(fishId)}
                {@const tier = getFishTier(fishId)}
                {@const value = getFishValue(fishId)}
                {@const tierBadge = tier >= 0 ? TIER_BADGES[tier] ?? TIER_BADGES[0] : null}
                {@const qualComplete = data.quality?.length >= 6}
                {@const isModded = isModdedItem(fishId)}
                <div class="flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors {qualComplete ? 'bg-emerald-500/[0.03] border-emerald-500/10' : isModded ? 'bg-fuchsia-500/[0.03] border-fuchsia-500/10' : 'bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.04]'}">
                  <!-- Fish icon + name -->
                  <div class="flex items-center gap-2 w-52 shrink-0">
                    {#if icon}
                      <img src="/icons/{icon}" alt="" class="w-8 h-8 object-contain shrink-0 pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                    {:else if isModded}
                      <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-8 h-8 object-contain shrink-0" />
                    {:else}
                      <span class="w-8 h-8 flex items-center justify-center text-white/15">🐟</span>
                    {/if}
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-medium text-white/80 truncate">{fishName}</span>
                        {#if isModded}
                          <span class="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded font-bold shrink-0">MOD</span>
                        {/if}
                        {#if tierBadge}
                          <span class="text-[8px] {tierBadge.bg} {tierBadge.color} px-1 py-0 rounded font-bold shrink-0">{tierBadge.label}</span>
                        {/if}
                        {#if qualComplete}
                          <span class="text-[8px] text-emerald-400 shrink-0">✓</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] text-white/25 font-mono truncate">{fishId}</span>
                        {#if value > 0}
                          <span class="text-[9px] text-emerald-400/40 font-mono">${value}</span>
                        {/if}
                      </div>
                    </div>
                  </div>

                  <!-- Count -->
                  <div class="w-20 shrink-0">
                    <span class="text-[10px] text-white/25">Caught</span>
                    <input type="number" min="0" value={data.count ?? 0}
                      onchange={(e) => updateEntry(zone, fishId, 'count', +(e.target as HTMLInputElement).value)}
                      class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
                  </div>

                  <!-- Record -->
                  <div class="w-24 shrink-0">
                    <span class="text-[10px] text-white/25">Record</span>
                    <input type="number" step="0.1" min="0" value={data.record ?? 0}
                      onchange={(e) => updateEntry(zone, fishId, 'record', +(e.target as HTMLInputElement).value)}
                      class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
                  </div>

                  <!-- Qualities + Fill -->
                  <div class="inline-flex flex-col gap-1">
                    <span class="text-[10px] text-white/30 flex items-center gap-1 leading-none">
                      <span class="text-amber-400/80">✦</span> Quality
                    </span>
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-1.5 p-1 rounded-lg bg-black/30 border border-white/[0.06]">
                        {#each QUALITY_NAMES as name, qi}
                          {@const has = data.quality?.includes(qi)}
                          {@const color = QUALITY_COLORS[qi]}
                          <button
                            onclick={() => toggleQuality(zone, fishId, qi, !has)}
                            title="{name}{has ? ' ✓' : ''}"
                            class="relative rounded-md transition-all duration-200 cursor-pointer flex items-center justify-center w-[26px] h-[22px] shrink-0
                              {has
                                ? ''
                                : 'opacity-25 hover:opacity-60'}"
                            style="{has
                              ? `background: ${color}18; border: 1.5px solid ${color}; box-shadow: 0 0 6px ${color}40;`
                              : `background: transparent; border: 1.5px solid transparent;`}"
                          >
                            <span class="text-[9px] font-black {has ? '' : 'opacity-80'}" style="color: {color}">✦</span>
                          </button>
                        {/each}
                      </div>
                      <button class="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400/60 hover:text-sky-400 text-[10px] font-medium border border-sky-500/10 hover:border-sky-500/20 transition-all cursor-pointer shrink-0" title="Generate realistic data for this fish" onclick={() => fillFish(zone, fishId)}>🎲 Fill</button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </details>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .pixelated { image-rendering: pixelated; }
</style>
