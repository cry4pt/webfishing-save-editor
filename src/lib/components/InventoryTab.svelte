<script lang="ts">
  import { saveData, addToast, rollItemSize } from '$lib/stores/save';
  import { ITEMS, FISH_DATA, getThingName, getThingIcon, getItemSource, isModdedItem, getModdedItems, getModdedItemOverrides, guessModdedName } from '$lib/gamedata-extracted';
  import { MAX_INVENTORY_SIZE, MAX_QUALITY } from '$lib/gamedata';
  import QualityPicker from './QualityPicker.svelte';

  let searchQuery = $state('');
  let invSearch = $state('');
  let showUnobtainable = $state(false);
  let categoryFilter = $state<string>('all');
  let sourceFilter = $state<string>('all');

  const SOURCE_BADGES: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    normal:       { label: 'NORMAL',       color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: '📦' },
    unobtainable: { label: 'UNOBTAINABLE', color: 'text-red-400',     bg: 'bg-red-500/20',     icon: '🚫' },
    modded:       { label: 'MODDED',       color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', icon: '🧩' },
  };

  // Build item catalog
  const ALL_CATALOG_ITEMS = Object.entries(ITEMS)
    .map(([id, item]) => ({
      id, name: item.name, icon: item.icon,
      category: item.category, source: getItemSource(id),
      sellValue: item.sellValue ?? 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const CATEGORIES = [...new Set(ALL_CATALOG_ITEMS.map(i => i.category))].sort();

  const CATEGORY_ICONS: Record<string, string> = {
    fish: '🐟', furniture: '🪑', tool: '🔧', cosmetic: '💄',
    tackle_box: '🧰', bait: '🪱',
  };

  function getOwnedCounts(inv: Record<string, unknown>[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of inv) {
      const id = String(item.id ?? '');
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  function getFilteredCatalog(q: string, cat: string, srcFilter: string, showUnob: boolean, inv: Record<string, unknown>[]) {
    // Build dynamic catalog including modded items from save
    const moddedItems = getModdedItems(inv);
    const moddedCatalog = Object.entries(moddedItems).map(([id, item]) => ({
      id, name: item.name, icon: item.icon,
      category: item.category, source: 'modded' as const,
      sellValue: 0
    }));
    const combined = [...ALL_CATALOG_ITEMS, ...moddedCatalog];

    return combined.filter(item => {
      if (!showUnob && item.source === 'unobtainable') return false;
      if (!showUnob && item.source === 'hidden') return false;
      if (srcFilter !== 'all') {
        if (srcFilter === 'unobtainable') {
          if (item.source !== 'unobtainable' && item.source !== 'hidden') return false;
        } else if (item.source !== srcFilter) return false;
      }
      if (cat !== 'all' && item.category !== cat) return false;
      if (q) {
        const ql = q.toLowerCase();
        return item.name.toLowerCase().includes(ql) || item.id.toLowerCase().includes(ql);
      }
      return true;
    });
  }

  function rollQuality(): number {
    const r = Math.random();
    // Weighted distribution for spawned fish
    if (r < 0.02) return 5;   // ★★★★★ (2%)
    if (r < 0.08) return 4;   // ★★★★ (6%)
    if (r < 0.20) return 3;   // ★★★ (12%)
    if (r < 0.45) return 2;   // ★★ (25%)
    if (r < 0.75) return 1;   // ★ (30%)
    return 0;                  // Normal (25%)
  }

  function addItem(itemId: string) {
    const fd = FISH_DATA[itemId];
    const isFish = fd || ITEMS[itemId]?.category === 'fish';
    const size = fd ? rollItemSize(fd.averageSize) : isFish ? rollItemSize(30) : 1.0;
    const quality = isFish ? rollQuality() : 0;

    saveData.update(d => {
      if (!d) return d;
      const inv = (d.inventory as Record<string, unknown>[]) ?? [];
      if (inv.length >= MAX_INVENTORY_SIZE) {
        addToast(`❌ Inventory full (${MAX_INVENTORY_SIZE} items max)`, 'error');
        return d;
      }
      d.inventory = [...inv, {
        id: itemId, size, quality,
        ref: Math.floor(Math.random() * 2 ** 32), tags: []
      }];
      return d;
    });
    addToast(`📦 Added ${getThingName(itemId)}!`, 'success');
  }

  function removeOneItem(itemId: string) {
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as Record<string, unknown>[])];
      const idx = inv.findLastIndex(i => String(i.id) === itemId);
      if (idx >= 0) inv.splice(idx, 1);
      d.inventory = inv;
      return d;
    });
  }

  function removeItem(i: number) {
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as unknown[])];
      inv.splice(i, 1);
      d.inventory = inv;
      return d;
    });
  }

  const ESSENTIAL_ITEMS = new Set(['empty_hand', 'fishing_rod_simple']);

  function clearInv() {
    if (confirm('Clear inventory? (keeps Empty Hand & Simple Fishing Rod)'))
      saveData.update(d => {
        if (!d) return d;
        d.inventory = (d.inventory as Record<string, unknown>[]).filter(i => ESSENTIAL_ITEMS.has(String(i.id ?? '')));
        return d;
      });
  }

  function addAllToolsFurniture() {
    const items = ALL_CATALOG_ITEMS.filter(i => (i.category === 'tool' || i.category === 'furniture') && i.source === 'normal');
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as Record<string, unknown>[]) ?? []];
      const owned = new Set(inv.map(i => String(i.id ?? '')));
      let added = 0;
      for (const item of items) {
        if (!owned.has(item.id)) {
          inv.push({ id: item.id, size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
          added++;
        }
      }
      d.inventory = inv;
      return d;
    });
    addToast(`🔧🪑 Added ${items.length} tools & furniture!`, 'success');
  }

  function toggleLock(ref: number) {
    saveData.update(d => {
      if (!d) return d;
      const locked = (d.locked_refs as number[]) ?? [];
      if (locked.includes(ref)) {
        d.locked_refs = locked.filter(r => r !== ref);
      } else {
        d.locked_refs = [...locked, ref];
      }
      return d;
    });
  }

  function lockAllItems() {
    saveData.update(d => {
      if (!d) return d;
      const inv = (d.inventory as Record<string, unknown>[]) ?? [];
      const locked = new Set((d.locked_refs as number[]) ?? []);
      for (const item of inv) {
        const ref = item.ref as number;
        if (ref) locked.add(ref);
      }
      d.locked_refs = [...locked];
      return d;
    });
    addToast('🔒 All inventory items locked!', 'success');
  }

  function unlockAllItems() {
    saveData.update(d => {
      if (!d) return d;
      const inv = (d.inventory as Record<string, unknown>[]) ?? [];
      const invRefs = new Set(inv.map(i => i.ref as number));
      const locked = (d.locked_refs as number[]) ?? [];
      // Only remove locks for items in inventory, keep locks for other refs
      d.locked_refs = locked.filter(r => !invRefs.has(r));
      return d;
    });
    addToast('🔓 All inventory items unlocked!', 'info');
  }

  function updateItem(i: number, key: string, value: unknown) {
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as Record<string, unknown>[])];
      inv[i] = { ...inv[i], [key]: value };
      d.inventory = inv;
      return d;
    });
  }

  function updateItemCount(itemId: string, newCount: number) {
    if (newCount < 0) return;
    saveData.update(d => {
      if (!d) return d;
      const inv = [...(d.inventory as Record<string, unknown>[])];
      const currentCount = inv.filter(i => String(i.id) === itemId).length;
      if (newCount > currentCount) {
        for (let n = 0; n < newCount - currentCount; n++) {
          inv.push({ id: itemId, size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
        }
      } else if (newCount < currentCount) {
        let toRemove = currentCount - newCount;
        for (let i = inv.length - 1; i >= 0 && toRemove > 0; i--) {
          if (String(inv[i].id) === itemId) { inv.splice(i, 1); toRemove--; }
        }
      }
      d.inventory = inv;
      return d;
    });
  }

  function updateHotbar(slot: string, value: number) {
    saveData.update(d => {
      if (!d) return d;
      d.hotbar = { ...(d.hotbar as Record<string, number>), [slot]: value };
      return d;
    });
  }
</script>

{#if $saveData}
  {@const inv = ($saveData.inventory as Record<string, unknown>[]) ?? []}
  {@const hotbar = ($saveData.hotbar as Record<string, number>) ?? {}}
  {@const locked = ($saveData.locked_refs as number[]) ?? []}
  {@const ownedCounts = getOwnedCounts(inv)}
  {@const moddedInInv = new Set(inv.map(i => String(i.id ?? '')).filter(id => isModdedItem(id)))}
  {@const moddedOverrideCount = Object.keys(getModdedItemOverrides()).length}
  {@const totalModdedItems = new Set([...moddedInInv, ...Object.keys(getModdedItemOverrides())]).size}
  {@const catalog = getFilteredCatalog(searchQuery, categoryFilter, sourceFilter, showUnobtainable, inv)}
  {@const normalCount = ALL_CATALOG_ITEMS.filter(i => i.source === 'normal').length}
  {@const unobtainableCount = ALL_CATALOG_ITEMS.filter(i => i.source === 'unobtainable' || i.source === 'hidden').length}

  <div class="space-y-4">
    <!-- Source Stats / Filter Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <button onclick={() => sourceFilter = 'all'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'all' ? 'border-sky-500/40 bg-sky-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-sky-400">{inv.length}</div>
        <div class="text-[10px] text-sky-400/50 uppercase tracking-wider">📦 All Items</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-sky-500 h-1 rounded-full transition-all" style="width: {Math.min(inv.length / Math.max(normalCount, 1) * 100, 100).toFixed(1)}%"></div></div>
        <div class="text-[9px] text-white/20 mt-0.5">{ownedCounts.size} unique · 🔒 {locked.length}</div>
      </button>
      <button onclick={() => sourceFilter = 'normal'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'normal' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-emerald-400">{normalCount}</div>
        <div class="text-[10px] text-emerald-400/50 uppercase tracking-wider">📦 Normal</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-emerald-500 h-1 rounded-full transition-all" style="width: 100%"></div></div>
        <div class="text-[9px] text-white/20 mt-0.5">Obtainable items</div>
      </button>
      <button onclick={() => { sourceFilter = 'unobtainable'; showUnobtainable = true; }}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'unobtainable' ? 'border-red-500/40 bg-red-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-red-400">{unobtainableCount}</div>
        <div class="text-[10px] text-red-400/50 uppercase tracking-wider">🚫 Unobtainable</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-red-500 h-1 rounded-full transition-all" style="width: 100%"></div></div>
        <div class="text-[9px] text-white/20 mt-0.5">Hidden / debug items</div>
      </button>
      <button onclick={() => sourceFilter = 'modded'}
        class="p-3 rounded-xl border text-left transition-all cursor-pointer {sourceFilter === 'modded' ? 'border-fuchsia-500/40 bg-fuchsia-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}">
        <div class="text-lg font-bold text-fuchsia-400">{totalModdedItems > 0 ? totalModdedItems : '—'}</div>
        <div class="text-[10px] text-fuchsia-400/50 uppercase tracking-wider">🧩 Modded</div>
        <div class="mt-1 w-full bg-white/5 rounded-full h-1"><div class="bg-fuchsia-500 h-1 rounded-full transition-all" style="width: {totalModdedItems > 0 ? 100 : 0}%"></div></div>
        <div class="text-[9px] text-white/20 mt-0.5">Items from mods</div>
      </button>
    </div>

    <!-- Item Catalog -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>📦</span> Item Catalog
          <span class="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full">{catalog.length} items</span>
        </h3>
        <div class="flex gap-2">
          <button onclick={addAllToolsFurniture} class="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-medium transition-all cursor-pointer">🔧🪑 Add All Tools & Furniture</button>
          <button onclick={clearInv} class="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-all cursor-pointer">🗑️ Clear Inventory</button>
        </div>
      </div>

      <!-- Search -->
      <div class="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search items by name or ID..." bind:value={searchQuery}
          class="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all" />
      </div>

      <!-- Source legend -->
      <div class="flex flex-wrap gap-2 text-[10px]">
        {#each Object.entries(SOURCE_BADGES) as [, badge]}
          <span class="{badge.bg} {badge.color} px-2 py-0.5 rounded-full font-medium">{badge.icon} {badge.label}</span>
        {/each}
        <span class="text-white/20 ml-1">← Source badges show item origin</span>
      </div>

      <!-- Category Filters -->
      {#if true}
      {@const catCatalog = getFilteredCatalog(searchQuery, 'all', sourceFilter, showUnobtainable, inv)}
      <div class="flex flex-wrap gap-1.5">
        <button onclick={() => categoryFilter = 'all'}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
            {categoryFilter === 'all' ? 'bg-sky-500/20 border border-sky-500/30 text-sky-300' : 'bg-white/5 border border-white/5 text-white/40 hover:text-white/60'}">
          📋 All ({catCatalog.length})
        </button>
        {#each CATEGORIES as cat}
          {@const icon = CATEGORY_ICONS[cat] ?? '📦'}
          {@const catCount = catCatalog.filter(i => i.category === cat).length}
          {#if catCount > 0 || categoryFilter === cat}
            <button onclick={() => categoryFilter = cat}
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                {categoryFilter === cat ? 'bg-sky-500/20 border border-sky-500/30 text-sky-300' : 'bg-white/5 border border-white/5 text-white/40 hover:text-white/60'}">
              {icon} {cat.replace('_', ' ')} ({catCount})
            </button>
          {/if}
        {/each}
      </div>
      {/if}

      <!-- Catalog Grid -->
      {#if catalog.length === 0}
        <div class="text-center py-6 text-white/20 text-sm">No items match your search</div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {#each catalog as item (item.id)}
            {@const count = ownedCounts.get(item.id) ?? 0}
            <button
              class="group relative p-3 rounded-xl border text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]
                {count > 0 ? 'bg-sky-500/10 border-sky-500/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}"
              onclick={() => addItem(item.id)}
              oncontextmenu={(e) => { e.preventDefault(); if (count > 0) removeOneItem(item.id); }}
            >
              <div class="w-12 h-12 mx-auto mb-2 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                {#if item.icon}
                  <img src="/icons/{item.icon}" alt="" class="w-10 h-10 object-contain pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                {:else if item.source === 'modded'}
                  <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-10 h-10 object-contain" />
                {:else}
                  <span class="text-xl">{CATEGORY_ICONS[item.category] ?? '📦'}</span>
                {/if}
              </div>
              <div class="text-[11px] font-medium text-white/80 truncate">{item.name}</div>
              {#if item.source === 'modded'}
                <span class="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0 rounded-full font-medium">🧩 MODDED</span>
              {:else if item.source === 'unobtainable' || item.source === 'hidden'}
                <span class="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0 rounded-full font-medium">🚫 HIDDEN</span>
              {:else}
                <span class="text-[8px] bg-emerald-500/15 text-emerald-400/60 px-1.5 py-0 rounded-full font-medium">{item.category}</span>
              {/if}
              {#if count > 0}
                <div class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-sky-500 text-[9px] font-bold text-white flex items-center justify-center shadow-lg">
                  {count}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Owned Items -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🎒</span> Your Inventory
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{inv.length} items</span>
          {#if locked.length > 0}
            <span class="text-xs bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-400/60">🔒 {locked.length}</span>
          {/if}
        </h3>
        <div class="flex gap-2 items-center">
          <input type="text" placeholder="Search inventory..." bind:value={invSearch}
            class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-sky-500/50 w-44" />
          {#if inv.length > 0}
            <button onclick={lockAllItems} class="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-all cursor-pointer">🔒 Lock All</button>
            <button onclick={unlockAllItems} class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 text-xs font-medium transition-all cursor-pointer">🔓 Unlock All</button>
          {/if}
        </div>
      </div>

      {#if true}
      {@const iq = invSearch.toLowerCase()}
      {@const filteredInv = iq ? inv.map((item, i) => ({ item, i })).filter(({ item }) => getThingName(String(item.id ?? '')).toLowerCase().includes(iq) || String(item.id ?? '').toLowerCase().includes(iq)) : inv.map((item, i) => ({ item, i }))}
      {#if inv.length === 0}
        <div class="text-center py-8 text-white/20 text-sm">
          <div class="text-3xl mb-2">🎒</div>
          Inventory is empty. Click items in the catalog above to add them!
        </div>
      {:else if filteredInv.length === 0}
        <div class="text-center py-6 text-white/20 text-sm">No items match your search</div>
      {:else}
        <div class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {#each filteredInv as { item, i } (item.ref ?? i)}
            {@const icon = getThingIcon(String(item.id ?? ''))}
            {@const itemName = getThingName(String(item.id ?? ''))}
            {@const source = getItemSource(String(item.id ?? ''))}
            {@const isLocked = locked.includes(item.ref as number)}
            <div class="flex items-center gap-3 p-3 rounded-lg border transition-colors
              {isLocked ? 'bg-amber-500/[0.03] border-amber-500/15' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}">
              <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden relative">
                {#if icon}
                  <img src="/icons/{icon}" alt="" class="w-8 h-8 object-contain pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                {:else if source === 'modded'}
                  <img src="/icons/light-bulb.png" alt="Unknown mod" class="w-8 h-8 object-contain" />
                {:else}
                  <span class="text-white/20 text-lg">📦</span>
                {/if}
                {#if isLocked}
                  <div class="absolute -top-0.5 -right-0.5 text-[8px]">🔒</div>
                {/if}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-medium text-white/80 truncate">{itemName}</span>
                  {#if source === 'modded'}
                    <span class="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0 rounded-full font-medium">🧩 MOD</span>
                  {:else if source !== 'normal'}
                    <span class="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0 rounded-full font-medium">🚫</span>
                  {/if}
                  {#if isLocked}
                    <span class="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0 rounded-full font-medium">LOCKED</span>
                  {/if}
                </div>
                <div class="text-[10px] text-white/25 font-mono">{item.id} · ref #{item.ref}</div>
              </div>

              <div class="w-16 shrink-0">
                <span class="text-[10px] text-white/30">Qty</span>
                <input type="number" min="0" value={inv.filter(x => String(x.id) === String(item.id)).length}
                  onchange={(e) => updateItemCount(String(item.id), +(e.target as HTMLInputElement).value)}
                  class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
              </div>

              <div class="w-20 shrink-0">
                <span class="text-[10px] text-white/30">Size</span>
                <input type="number" step="0.1" value={item.size ?? 1}
                  onchange={(e) => updateItem(i, 'size', +(e.target as HTMLInputElement).value)}
                  class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
              </div>

              <div class="shrink-0">
                <QualityPicker value={item.quality ?? 0} onchange={(q) => updateItem(i, 'quality', q)} />
              </div>

              <button
                class="shrink-0 p-1.5 rounded-lg transition-all cursor-pointer
                  {isLocked ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' : 'bg-white/5 hover:bg-white/10 text-white/20 hover:text-white/40'}"
                onclick={() => toggleLock(item.ref as number)}
                title={isLocked ? 'Unlock item' : 'Lock item (protects from selling)'}
              >{isLocked ? '🔒' : '🔓'}</button>

              <button class="text-red-400/40 hover:text-red-400 transition-colors cursor-pointer shrink-0 p-1" onclick={() => removeItem(i)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
      {/if}
    </div>

    <!-- Hotbar -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
        <span>🎹</span> Hotbar
        <span class="text-xs text-white/20 font-normal normal-case tracking-normal">Assign inventory items to quick-use slots</span>
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {#each Array(5) as _, slot}
          {@const refVal = Number(hotbar[String(slot)] ?? 0)}
          {@const assignedItem = refVal ? inv.find(i => Number(i.ref) === refVal) : null}
          {@const assignedIcon = assignedItem ? getThingIcon(String(assignedItem.id ?? '')) : null}
          <div class="p-3 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/40 font-medium">Slot {slot + 1}</span>
              {#if assignedItem}
                <span class="text-[9px] text-emerald-400/50">●</span>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              {#if assignedIcon}
                <img src="/icons/{assignedIcon}" alt="" class="w-7 h-7 object-contain pixelated shrink-0" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
              {:else}
                <span class="w-7 h-7 flex items-center justify-center text-white/15 text-sm shrink-0">—</span>
              {/if}
              <select
                value={String(refVal)}
                onchange={(e) => updateHotbar(String(slot), Number((e.target as HTMLSelectElement).value))}
                class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500/50 cursor-pointer transition-all">
                <option value="0" class="bg-[#1a1a2e]">Empty</option>
                {#each inv as invItem}
                  <option value={String(invItem.ref)} class="bg-[#1a1a2e]">
                    {getThingName(String(invItem.id ?? ''))} (#{invItem.ref})
                  </option>
                {/each}
              </select>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .pixelated { image-rendering: pixelated; }
</style>
