<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { ITEMS, getThingName, getThingIcon, UNOBTAINABLE_ITEMS, isModdedItem, guessModdedName, guessModdedItemCategory } from '$lib/gamedata-extracted';
  import QualityPicker from './QualityPicker.svelte';

  // All furniture items from game data
  const ALL_PROPS = Object.entries(ITEMS)
    .filter(([, item]) => item.category === 'furniture')
    .map(([id, item]) => ({ id, name: item.name, icon: item.icon, sellValue: item.sellValue ?? 0, unobtainable: UNOBTAINABLE_ITEMS.includes(id), modded: false }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const OBTAINABLE_PROPS = ALL_PROPS.filter(p => !p.unobtainable);

  /** Check if an item is a prop — vanilla furniture or modded with prop_ prefix */
  function isProp(id: string): boolean {
    if (ITEMS[id]?.category === 'furniture') return true;
    if (isModdedItem(id) && guessModdedItemCategory(id) === 'furniture') return true;
    return false;
  }

  function getOwnedProps(): { id: string; ref: number; size: number; quality: number; index: number; modded: boolean }[] {
    if (!$saveData?.inventory) return [];
    const inv = $saveData.inventory as Record<string, unknown>[];
    return inv
      .map((item, index) => ({
        id: String(item.id ?? ''),
        ref: (item.ref as number) ?? 0,
        size: (item.size as number) ?? 1,
        quality: (item.quality as number) ?? 0,
        index,
        modded: isModdedItem(String(item.id ?? '')),
      }))
      .filter(item => isProp(item.id));
  }

  /** Build the full props catalog including modded props from inventory */
  function getFullPropsCatalog(inv: Record<string, unknown>[]) {
    const moddedProps = inv
      .filter(item => {
        const id = String(item.id ?? '');
        return isModdedItem(id) && guessModdedItemCategory(id) === 'furniture';
      })
      .reduce((acc, item) => {
        const id = String(item.id ?? '');
        if (!acc.has(id)) {
          acc.set(id, { id, name: guessModdedName(id), icon: null as string | null, sellValue: 0, unobtainable: false, modded: true });
        }
        return acc;
      }, new Map<string, { id: string; name: string; icon: string | null; sellValue: number; unobtainable: boolean; modded: boolean }>());
    return [...ALL_PROPS, ...moddedProps.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function addProp(propId: string) {
    saveData.update(d => {
      if (!d) return d;
      if (!d.inventory) d.inventory = [];
      (d.inventory as Record<string, unknown>[]).push({
        id: propId,
        size: 1.0,
        quality: 0,
        ref: Math.floor(Math.random() * 2 ** 32),
        tags: [],
      });
      return d;
    });
    addToast(`🪑 Added ${getThingName(propId)}!`, 'success');
  }

  function addAllProps() {
    saveData.update(d => {
      if (!d) return d;
      if (!d.inventory) d.inventory = [];
      const inv = d.inventory as Record<string, unknown>[];
      const owned = new Set(inv.filter(i => ITEMS[String(i.id)]?.category === 'furniture').map(i => String(i.id)));
      for (const prop of OBTAINABLE_PROPS) {
        if (!owned.has(prop.id)) {
          inv.push({ id: prop.id, size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
        }
      }
      return d;
    });
    addToast('🪑 All props added to inventory!', 'success');
  }

  function removeOneProp(propId: string) {
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as Record<string, unknown>[])];
      const idx = inv.findLastIndex(i => String(i.id) === propId);
      if (idx >= 0) inv.splice(idx, 1);
      d.inventory = inv;
      return d;
    });
  }

  function removeProp(invIndex: number) {
    saveData.update(d => {
      if (!d) return d;
      (d.inventory as unknown[]).splice(invIndex, 1);
      return d;
    });
  }

  function removeAllProps() {
    if (!confirm('Remove all furniture/props from inventory?')) return;
    saveData.update(d => {
      if (!d) return d;
      d.inventory = (d.inventory as Record<string, unknown>[]).filter(i => !isProp(String(i.id ?? '')));
      return d;
    });
    addToast('🗑️ All props removed', 'info');
  }

  function updateProp(invIndex: number, key: string, value: unknown) {
    saveData.update(d => {
      if (!d) return d;
      const inv = d.inventory as Record<string, unknown>[];
      inv[invIndex] = { ...inv[invIndex], [key]: value };
      return d;
    });
  }

  function updatePropCount(propId: string, newCount: number) {
    if (newCount < 0) return;
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as Record<string, unknown>[])];
      const currentCount = inv.filter(i => String(i.id) === propId && ITEMS[String(i.id)]?.category === 'furniture').length;
      if (newCount > currentCount) {
        for (let n = 0; n < newCount - currentCount; n++) {
          inv.push({ id: propId, size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
        }
      } else if (newCount < currentCount) {
        let toRemove = currentCount - newCount;
        for (let i = inv.length - 1; i >= 0 && toRemove > 0; i--) {
          if (String(inv[i].id) === propId) { inv.splice(i, 1); toRemove--; }
        }
      }
      d.inventory = inv;
      return d;
    });
  }

  let ownedPropsSearch = $state('');
</script>

{#if $saveData}
  {@const inv = ($saveData.inventory as Record<string, unknown>[]) ?? []}
  {@const owned = getOwnedProps()}
  {@const ownedIds = new Set(owned.map(p => p.id))}
  {@const fullCatalog = getFullPropsCatalog(inv)}
  {@const totalAvailable = fullCatalog.length}
  {@const uniqueOwned = new Set(owned.map(p => p.id)).size}
  {@const moddedPropsCount = owned.filter(p => p.modded).length}

  <div class="space-y-4">
    <!-- Stats Dashboard -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <div class="text-[10px] text-amber-400/50 uppercase tracking-wider font-medium">Props Owned</div>
        <div class="text-2xl font-bold text-amber-400 font-mono mt-1">{owned.length}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Unique Types</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{uniqueOwned}<span class="text-xs text-white/20">/{totalAvailable}</span></div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Available Props</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{totalAvailable}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Placement Limit</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">5 max</div>
        <div class="text-[10px] text-white/20">per session</div>
      </div>
    </div>
    {#if moddedPropsCount > 0}
      <div class="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-3 flex items-center gap-3">
        <span class="text-lg">🧩</span>
        <div>
          <div class="text-sm font-medium text-fuchsia-400">{moddedPropsCount} Modded Prop{moddedPropsCount > 1 ? 's' : ''} Detected</div>
          <div class="text-[10px] text-white/25">Modded furniture items are preserved and editable</div>
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="flex flex-wrap gap-2">
      <button onclick={addAllProps} class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/20 text-amber-300 text-xs font-medium transition-all cursor-pointer">🪑 Add All Props</button>
      <button onclick={removeAllProps} class="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 text-red-300 text-xs font-medium transition-all cursor-pointer">🗑️ Remove All Props</button>
    </div>

    <!-- Props Catalog -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>📦</span> Props Catalog
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{totalAvailable} props</span>
        </h3>
      </div>
      {#if true}
      {@const filteredProps = fullCatalog}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {#each filteredProps as prop}
          {@const isOwned = ownedIds.has(prop.id)}
          {@const count = owned.filter(o => o.id === prop.id).length}
          <button
            class="group relative p-3 rounded-xl border text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]
              {isOwned ? 'bg-amber-500/10 border-amber-500/20' : prop.modded ? 'bg-fuchsia-500/[0.05] border-fuchsia-500/10 hover:bg-fuchsia-500/10' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}"
            onclick={() => addProp(prop.id)}
            oncontextmenu={(e) => { e.preventDefault(); if (isOwned) removeOneProp(prop.id); }}
          >
            <div class="w-12 h-12 mx-auto mb-2 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
              {#if prop.icon}
                <img src="/icons/{prop.icon}" alt="" class="w-10 h-10 object-contain pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
              {:else if prop.modded}
                <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-10 h-10 object-contain" />
              {:else}
                <span class="text-xl">🪑</span>
              {/if}
            </div>
            <div class="text-[11px] font-medium text-white/80 truncate">{prop.name}</div>
            {#if prop.modded}
              <span class="text-[8px] text-fuchsia-400/80 font-medium">🧩 MODDED</span>
            {:else if prop.unobtainable}
              <span class="text-[8px] text-red-400/60">UNOBTAINABLE</span>
            {:else if prop.sellValue > 0}
              <div class="text-[9px] text-emerald-400/40 font-mono">${prop.sellValue}</div>
            {/if}
            {#if isOwned}
              <div class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center shadow-lg">
                {count}
              </div>
            {/if}
          </button>
        {/each}
      </div>
      {/if}
    </div>

    <!-- Owned Props -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🪑</span> Your Props
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{owned.length}</span>
        </h3>
        <input type="text" placeholder="Search your props..." bind:value={ownedPropsSearch}
          class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-sky-500/50 w-44" />
      </div>

      {#if true}
      {@const opq = ownedPropsSearch.toLowerCase()}
      {@const filteredOwned = opq ? owned.filter(p => getThingName(p.id).toLowerCase().includes(opq) || p.id.toLowerCase().includes(opq)) : owned}
      {#if owned.length === 0}
        <div class="text-center py-8 text-white/20 text-sm">
          <div class="text-3xl mb-2">🪑</div>
          No props in inventory. Add some from the catalog above!
        </div>
      {:else if filteredOwned.length === 0}
        <div class="text-center py-6 text-white/20 text-sm">No props match your search</div>
      {:else}
        <div class="space-y-2">
          {#each filteredOwned as prop}
            {@const icon = getThingIcon(prop.id)}
            {@const propName = getThingName(prop.id)}
            <div class="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <!-- Icon -->
              <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                {#if icon}
                  <img src="/icons/{icon}" alt="" class="w-8 h-8 object-contain pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                {:else if prop.modded}
                  <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-8 h-8 object-contain" />
                {:else}
                  <span class="text-white/20 text-lg">🪑</span>
                {/if}
              </div>

              <!-- Name -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-medium text-white/80 truncate">{propName}</span>
                  {#if prop.modded}
                    <span class="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0 rounded-full font-medium">🧩 MOD</span>
                  {/if}
                </div>
                <div class="text-[10px] text-white/25 font-mono">{prop.id} · ref #{prop.ref}</div>
              </div>

              <!-- Qty -->
              <div class="w-16 shrink-0">
                <span class="text-[10px] text-white/30">Qty</span>
                <input type="number" min="0" value={owned.filter(o => o.id === prop.id).length}
                  onchange={(e) => updatePropCount(prop.id, +(e.target as HTMLInputElement).value)}
                  class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-all" />
              </div>

              <!-- Quality -->
              <div class="shrink-0">
                <QualityPicker value={prop.quality} onchange={(q) => updateProp(prop.index, 'quality', q)} />
              </div>

              <!-- Remove -->
              <button class="text-red-400/40 hover:text-red-400 transition-colors cursor-pointer shrink-0 p-1" onclick={() => removeProp(prop.index)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .pixelated { image-rendering: pixelated; }
</style>
