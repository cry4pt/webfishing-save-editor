<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { KNOWN_TAGS, STEAM_ACHIEVEMENTS } from '$lib/gamedata';
  import { ITEMS, FISH_DATA } from '$lib/gamedata-extracted';

  function removeTag(i: number) {
    saveData.update(d => {
      if (!d) return d;
      d.saved_tags = (d.saved_tags as string[]).filter((_, idx) => idx !== i);
      return d;
    });
  }
  function addTag() {
    const tag = prompt('Enter tag name:');
    if (tag) saveData.update(d => {
      if (d && !(d.saved_tags as string[]).includes(tag)) d.saved_tags = [...(d.saved_tags as string[]), tag];
      return d;
    });
  }
  function addAllTags() {
    saveData.update(d => {
      if (!d) return d;
      // Add all known save tags
      const tags = d.saved_tags as string[];
      const newTags = KNOWN_TAGS.filter(t => !tags.includes(t));
      d.saved_tags = [...tags, ...newTags];

      // Auto-complete save data to satisfy all 16 Steam achievements:

      // catch_single_fish & catch_100_fish: need fish_caught >= 100
      d.fish_caught = Math.max((d.fish_caught as number) ?? 0, 100);

      // 10k_cash: need cash_total >= 10000
      d.cash_total = Math.max((d.cash_total as number) ?? 0, 10000);

      // rank_5, rank_25, rank_50: need level >= 50
      d.level = Math.max((d.level as number) ?? 0, 50);
      d.xp = 0;

      // camp_tier_2, camp_tier_3, camp_tier_4: need loan_level >= 3
      d.loan_level = Math.max((d.loan_level as number) ?? 0, 3);
      d.loan_left = 0;

      // spectral_rod: need fishing_rod_skeleton in inventory
      const inv = (d.inventory as Record<string, unknown>[]) ?? [];
      if (!inv.some(i => String(i.id) === 'fishing_rod_skeleton')) {
        inv.push({ id: 'fishing_rod_skeleton', size: 1.0, quality: 0, ref: Math.floor(Math.random() * 2 ** 32), tags: [] });
        d.inventory = [...inv];
      }

      // journal_normal through journal_alpha: need journal_0 through journal_5 tags
      // (already added via KNOWN_TAGS above)
      // Also fill journal entries with all 6 qualities so the tags are valid
      const journal = d.journal as Record<string, Record<string, { count: number; record: number; quality: number[] }>> | undefined;
      if (journal) {
        for (const zone of Object.keys(journal)) {
          for (const fish of Object.keys(journal[zone])) {
            const entry = journal[zone][fish];
            if (!entry.quality || entry.quality.length < 6) {
              entry.quality = [0, 1, 2, 3, 4, 5];
            }
            if (!entry.count || entry.count < 1) {
              entry.count = 1;
            }
          }
        }
      }

      return d;
    });
    addToast('🏆 All tags added & save data set for all 16 achievements!', 'success');
  }
  function clearTags() {
    if (!confirm('Clear all tags?')) return;
    saveData.update(d => { if (d) d.saved_tags = []; return d; });
    addToast('Tags cleared', 'info');
  }


  function toggleTag(tag: string) {
    saveData.update(d => {
      if (!d) return d;
      const tags = (d.saved_tags as string[]) ?? [];
      if (tags.includes(tag)) {
        d.saved_tags = tags.filter(t => t !== tag);
      } else {
        d.saved_tags = [...tags, tag];
      }
      return d;
    });
  }

  const TAG_DESCRIPTIONS: Record<string, string> = {
    'first_join': 'Player has joined for the first time',
    'spectral': 'Related to spectral/ghost events',
    'completed_tutorial': 'Player completed the tutorial',
    'journal_all': 'All journal entries discovered',
    'journal_0': 'All Normal quality fish caught',
    'journal_1': 'All Shining quality fish caught',
    'journal_2': 'All Glistening quality fish caught',
    'journal_3': 'All Opulent quality fish caught',
    'journal_4': 'All Radiant quality fish caught',
    'journal_5': 'All Alpha quality fish caught',
  };

  const ACHIEVEMENT_DESCRIPTIONS: Record<string, string> = {
    'catch_single_fish': 'Catch your first fish',
    'catch_100_fish': 'Catch 100 fish',
    '10k_cash': 'Earn $10,000',
    'rank_5': 'Reach Rank 5',
    'rank_25': 'Reach Rank 25',
    'rank_50': 'Reach Rank 50',
    'camp_tier_2': 'Upgrade camp to Tier 2',
    'camp_tier_3': 'Upgrade camp to Tier 3',
    'camp_tier_4': 'Upgrade camp to Tier 4',
    'spectral_rod': 'Obtain the Spectral Rod',
    'journal_normal': 'Complete journal — Normal quality',
    'journal_shining': 'Complete journal — Shining quality',
    'journal_glistening': 'Complete journal — Glistening quality',
    'journal_opulent': 'Complete journal — Opulent quality',
    'journal_radiant': 'Complete journal — Radiant quality',
    'journal_alpha': 'Complete journal — Alpha quality',
  };

  /** Map achievements to related save data for auto-detection */
  function isAchievementUnlocked(id: string, data: Record<string, unknown>): boolean {
    switch (id) {
      case 'catch_single_fish': return ((data.fish_caught as number) ?? 0) >= 1;
      case 'catch_100_fish': return ((data.fish_caught as number) ?? 0) >= 100;
      case '10k_cash': return ((data.cash_total as number) ?? 0) >= 10000;
      case 'rank_5': return ((data.level as number) ?? 0) >= 5;
      case 'rank_25': return ((data.level as number) ?? 0) >= 25;
      case 'rank_50': return ((data.level as number) ?? 0) >= 50;
      case 'camp_tier_2': return ((data.loan_level as number) ?? 0) >= 1;
      case 'camp_tier_3': return ((data.loan_level as number) ?? 0) >= 2;
      case 'camp_tier_4': return ((data.loan_level as number) ?? 0) >= 3;
      case 'spectral_rod': {
        const inv = (data.inventory as Record<string, unknown>[]) ?? [];
        return inv.some(i => String(i.id) === 'fishing_rod_skeleton');
      }
      case 'journal_normal': return ((data.saved_tags as string[]) ?? []).includes('journal_0');
      case 'journal_shining': return ((data.saved_tags as string[]) ?? []).includes('journal_1');
      case 'journal_glistening': return ((data.saved_tags as string[]) ?? []).includes('journal_2');
      case 'journal_opulent': return ((data.saved_tags as string[]) ?? []).includes('journal_3');
      case 'journal_radiant': return ((data.saved_tags as string[]) ?? []).includes('journal_4');
      case 'journal_alpha': return ((data.saved_tags as string[]) ?? []).includes('journal_5');
      default: return false;
    }
  }
</script>

{#if $saveData}
  {@const tags = ($saveData.saved_tags as string[]) ?? []}
  {@const knownCount = tags.filter(t => KNOWN_TAGS.includes(t)).length}
  {@const achievementCount = STEAM_ACHIEVEMENTS.filter(a => isAchievementUnlocked(a, $saveData as Record<string, unknown>)).length}

  <div class="space-y-4">
    <!-- Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
        <div class="text-[10px] text-violet-400/50 uppercase tracking-wider font-medium">Tags</div>
        <div class="text-2xl font-bold text-violet-400 font-mono mt-1">{knownCount}<span class="text-xs text-white/20">/{KNOWN_TAGS.length}</span></div>
      </div>
      <div class="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <div class="text-[10px] text-amber-400/50 uppercase tracking-wider font-medium">Achievements</div>
        <div class="text-2xl font-bold text-amber-400 font-mono mt-1">{achievementCount}<span class="text-xs text-white/20">/{STEAM_ACHIEVEMENTS.length}</span></div>
      </div>
    </div>

    <!-- Tags -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🏷️</span> Achievements / Tags
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{tags.length}<span class="text-white/20">/{KNOWN_TAGS.length} known</span></span>
        </h3>
        <div class="flex gap-2">
          <button class="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-xs font-medium transition-all cursor-pointer" onclick={addAllTags}>Unlock All</button>
          <button class="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-all cursor-pointer" onclick={clearTags}>Clear</button>
        </div>
      </div>

      <!-- Known tags as checkboxes -->
      <div class="space-y-1.5">
        {#each KNOWN_TAGS as tag}
          {@const has = tags.includes(tag)}
          {@const desc = TAG_DESCRIPTIONS[tag]}
          <label class="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors {has ? 'bg-emerald-500/[0.06] border-emerald-500/15' : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'}">
            <input type="checkbox" checked={has} onchange={() => toggleTag(tag)}
              class="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
            <div class="flex-1 min-w-0">
              <span class="text-sm font-mono {has ? 'text-emerald-400' : 'text-white/50'}">{tag}</span>
              {#if desc}
                <span class="text-[10px] text-white/25 ml-2">— {desc}</span>
              {/if}
            </div>
            {#if has}
              <span class="text-emerald-400/60 text-xs">✓</span>
            {/if}
          </label>
        {/each}
      </div>

      <!-- Custom tags -->
      {#if tags.filter(t => !KNOWN_TAGS.includes(t)).length > 0}
        <div class="border-t border-white/5 pt-3 mt-3">
          <div class="text-[10px] text-white/30 uppercase tracking-wider mb-2">Custom Tags</div>
          <div class="flex flex-wrap gap-2">
            {#each tags.filter(t => !KNOWN_TAGS.includes(t)) as tag}
              <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-xs font-mono text-amber-400">
                {tag}
                <button class="text-red-400/40 hover:text-red-400 transition-colors cursor-pointer ml-0.5" onclick={() => toggleTag(tag)}>×</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <button class="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-medium transition-all cursor-pointer" onclick={addTag}>+ Add Custom Tag</button>
    </div>

    <!-- Steam Achievements -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🏆</span> Steam Achievements
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{achievementCount}<span class="text-white/20">/{STEAM_ACHIEVEMENTS.length}</span></span>
        </h3>
        <span class="text-[10px] text-white/20">Based on save data — managed by Steam</span>
      </div>
      <div class="space-y-1.5">
        {#each STEAM_ACHIEVEMENTS as ach}
          {@const unlocked = isAchievementUnlocked(ach, $saveData as Record<string, unknown>)}
          {@const desc = ACHIEVEMENT_DESCRIPTIONS[ach]}
          <div class="flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors {unlocked ? 'bg-amber-500/[0.06] border-amber-500/15' : 'bg-white/[0.02] border-white/[0.04]'}">
            <span class="text-lg w-6 text-center">{unlocked ? '🏆' : '🔒'}</span>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-mono {unlocked ? 'text-amber-400' : 'text-white/30'}">{ach}</span>
              {#if desc}
                <span class="text-[10px] text-white/25 ml-2">— {desc}</span>
              {/if}
            </div>
            {#if unlocked}
              <span class="text-amber-400/60 text-xs">Unlocked</span>
            {:else}
              <span class="text-white/15 text-xs">Locked</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

  </div>
{/if}
