<script lang="ts">
  import { summary, quickMaxAll, quickAction, downloadSave, saveInPlace, hasDirectAccess, addToast } from '$lib/stores/save';
  import { mergeModOverrides } from '$lib/gamedata-extracted';
  import { dev } from '$app/environment';

  let scanning = $state(false);

  async function rescanMods() {
    scanning = true;
    try {
      const res = await fetch('/__mod-rescan');
      const data = await res.json();
      if (data.error) {
        addToast(`❌ Scan failed: ${data.error}`, 'error');
      } else {
        // Merge overrides into live app without triggering HMR
        if (data.items) mergeModOverrides(data.items);
        addToast(`🎣 Scan complete — ${data.count} modded item(s) found`, 'success');
      }
    } catch (e) {
      addToast('❌ Rescan unavailable (only works in dev mode)', 'error');
    }
    scanning = false;
  }

  const actions = [
    { key: 'all', icon: '🏆', title: 'MAX ALL', desc: '100% completion', color: 'from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border-amber-500/20' },
    { key: 'money', icon: '💰', title: 'Max Money', desc: '$999,999,999', color: 'from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border-emerald-500/20' },
    { key: 'rank', icon: '⭐', title: 'Max Rank', desc: 'Lv.50 VOYAGER', color: 'from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30 border-yellow-500/20' },
    { key: 'rod', icon: '🎣', title: 'Max Rod', desc: 'All upgrades', color: 'from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 border-sky-500/20' },
    { key: 'cosmetics', icon: '👕', title: 'All Cosmetics', desc: 'Unlock everything', color: 'from-fuchsia-500/20 to-pink-500/20 hover:from-fuchsia-500/30 hover:to-pink-500/30 border-fuchsia-500/20' },
    { key: 'props', icon: '🪑', title: 'All Props', desc: 'All furniture', color: 'from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border-amber-500/20' },
    { key: 'lures', icon: '🪝', title: 'All Lures', desc: 'All unlocked', color: 'from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 border-violet-500/20' },
    { key: 'bait', icon: '🪱', title: 'Max Bait', desc: '999 of each', color: 'from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 border-pink-500/20' },
    { key: 'journal', icon: '📖', title: 'Fill Journal', desc: 'All fish discovered', color: 'from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30 border-indigo-500/20' },
    { key: 'quests', icon: '📋', title: 'Complete Quests', desc: 'Finish all active', color: 'from-lime-500/20 to-green-500/20 hover:from-lime-500/30 hover:to-green-500/30 border-lime-500/20' },
    { key: 'loans', icon: '🏦', title: 'Pay Loans', desc: 'Clear all debt', color: 'from-teal-500/20 to-cyan-500/20 hover:from-teal-500/30 hover:to-cyan-500/30 border-teal-500/20' },
    { key: 'buddy', icon: '🐕', title: 'Max Buddy', desc: 'Level & speed', color: 'from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border-orange-500/20' },
  ];
</script>

{#if $summary}
  <div class="space-y-6">
    <!-- Quick Actions Grid -->
    <div>
      <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Quick Actions</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {#each actions as a}
          <button
            class="group relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 text-left transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] {a.color}"
            onclick={() => a.key === 'all' ? quickMaxAll() : quickAction(a.key)}
          >
            <div class="text-2xl mb-2">{a.icon}</div>
            <div class="text-sm font-semibold text-white/90">{a.title}</div>
            <div class="text-xs text-white/40">{a.desc}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Save Summary</h3>
        <div class="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <!-- Economy -->
          <div class="flex justify-between"><span class="text-white/40">Money</span><span class="text-emerald-400 font-mono font-medium">${$summary.money.toLocaleString()}</span></div>
          <div class="flex justify-between"><span class="text-white/40">Cash Total</span><span class="text-white/80 font-mono">${$summary.cashTotal.toLocaleString()}</span></div>
          <!-- Fishing -->
          <div class="flex justify-between"><span class="text-white/40">Rank</span><span class="text-yellow-400 font-medium">{$summary.level} — {$summary.rankTitle}</span></div>
          <div class="flex justify-between"><span class="text-white/40">Rod Power</span><span class="text-white/80">{$summary.rodPower}/8</span></div>
          <div class="flex justify-between"><span class="text-white/40">Rod Speed</span><span class="text-white/80">{$summary.rodSpeed}/5</span></div>
          <div class="flex justify-between"><span class="text-white/40">Fish Caught</span><span class="text-white/80 font-mono">{Number($summary.fishCaught).toLocaleString()}</span></div>
          <div class="flex justify-between"><span class="text-white/40">Lures</span><span class="text-sky-400">{$summary.lureCount}/{$summary.lureTotal}</span></div>
          <div class="flex justify-between"><span class="text-white/40">Bait Types</span><span class="text-pink-400">{$summary.baitUnlocked} unlocked</span></div>
          <div class="flex justify-between"><span class="text-white/40">Buddy</span><span class="text-orange-400">Lv.{$summary.buddyLevel} / Spd.{$summary.buddySpeed}</span></div>
          <!-- Cosmetics & Props -->
          <div class="flex justify-between"><span class="text-white/40">Cosmetics</span><span class="text-violet-400">{$summary.cosmeticsCount} unlocked</span></div>
          <div class="flex justify-between"><span class="text-white/40">Props</span><span class="text-amber-400">{$summary.propsCount} owned</span></div>
          <!-- Inventory -->
          <div class="flex justify-between"><span class="text-white/40">Inventory</span><span class="text-white/80">{$summary.inventoryCount} items</span></div>
          <!-- Journal & Quests -->
          <div class="flex justify-between"><span class="text-white/40">Active Quests</span><span class="text-lime-400">{$summary.questCount}</span></div>
          <div class="flex justify-between"><span class="text-white/40">Quests Done</span><span class="text-lime-400/60">{$summary.completedQuestCount}</span></div>
          <!-- Advanced -->
          <div class="flex justify-between"><span class="text-white/40">Camp Tier</span><span class="text-white/80">Tier {$summary.loanLevel + 1} (${$summary.loanLeft.toLocaleString()} owed)</span></div>
          <div class="flex justify-between"><span class="text-white/40">Locked Items</span><span class="text-amber-400/60">{$summary.lockedItems}</span></div>
          <!-- Tags -->
          <div class="flex justify-between"><span class="text-white/40">Saved Tags</span><span class="text-white/80">{$summary.tagCount}</span></div>
          <div class="flex justify-between"><span class="text-white/40">Version</span><span class="text-white/50">{$summary.version}</span></div>
        </div>
      </div>

      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider mb-1">Export</h3>
        {#if $hasDirectAccess}
          <button
            class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold text-sm transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-emerald-500/20"
            onclick={() => saveInPlace()}
          >
            💾 Save to File (Direct)
          </button>
        {/if}
        <button
          class="w-full py-3 rounded-xl {$hasDirectAccess ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/80' : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20'} font-semibold text-sm transition-all duration-200 cursor-pointer"
          onclick={() => downloadSave()}
        >
          ⬇️ Download Modified Save
        </button>
        <button
          class="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-medium text-sm transition-all cursor-pointer"
          onclick={() => downloadSave(true)}
        >
          📋 Download as Backup
        </button>
        {#if dev}
          <button
            class="w-full py-2.5 rounded-xl bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/15 text-fuchsia-300/80 font-medium text-sm transition-all cursor-pointer disabled:opacity-40"
            onclick={rescanMods}
            disabled={scanning}
          >
            {scanning ? '⏳ Scanning...' : '🧩 Rescan Mods'}
          </button>
        {/if}
        <div class="text-xs text-white/25 mt-auto">
          {#if $hasDirectAccess}
            <span class="text-emerald-400/50">💾 Direct access active</span> — saves overwrite the original file.<br/>
          {:else}
            Replace your <code class="text-white/35">webfishing_save_slot_X.sav</code> file.<br/>
          {/if}
          <kbd class="text-white/35">Ctrl+S</kbd> to quick-save.
        </div>
      </div>
    </div>
  </div>
{/if}
