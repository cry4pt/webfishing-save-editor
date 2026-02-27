<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { getThingName, getThingIcon, COSMETICS } from '$lib/gamedata-extracted';
  import { QUEST_COSMETICS } from '$lib/gamedata-extracted';

  type Quest = {
    title: string;
    action: string;
    goal_id: string;
    goal_amt: number;
    progress: number;
    tier: number;
    gold_reward: number;
    xp_reward: number;
    icon: string;
    hidden: boolean;
    max_level: number;
    rewards: string[];
    goal_array: number[];
  };

  type QuestEntry = Record<string, Quest>;

  function getQuests(): Record<string, Quest> {
    if (!$saveData?.quests) return {};
    const raw = $saveData.quests as Record<string, Record<string, unknown>>;
    const result: Record<string, Quest> = {};
    for (const [key, val] of Object.entries(raw)) {
      result[key] = {
        title: (val.title as string) ?? key,
        action: (val.action as string) ?? '',
        goal_id: (val.goal_id as string) ?? '',
        goal_amt: (val.goal_amt as number) ?? 0,
        progress: (val.progress as number) ?? 0,
        tier: (val.tier as number) ?? 0,
        gold_reward: (val.gold_reward as number) ?? 0,
        xp_reward: (val.xp_reward as number) ?? 0,
        icon: (val.icon as string) ?? '',
        hidden: (val.hidden as boolean) ?? false,
        max_level: (val.max_level as number) ?? 0,
        rewards: (val.rewards as string[]) ?? [],
        goal_array: (val.goal_array as number[]) ?? [],
      };
    }
    return result;
  }

  function updateProgress(questKey: string, progress: number) {
    saveData.update(d => {
      if (!d?.quests) return d;
      const qs = d.quests as Record<string, Record<string, unknown>>;
      if (qs[questKey]) {
        qs[questKey] = { ...qs[questKey], progress };
        const goalAmt = (qs[questKey].goal_amt as number) ?? 0;
        const title = (qs[questKey].title as string) ?? questKey;
        const completed = [...((d.completed_quests as string[]) ?? [])];
        if (progress >= goalAmt && goalAmt > 0) {
          if (!completed.includes(title)) completed.push(title);
        } else {
          const idx = completed.indexOf(title);
          if (idx >= 0) completed.splice(idx, 1);
        }
        d.completed_quests = completed;
        d.quests = { ...qs };
      }
      return d;
    });
  }

  function completeAll() {
    saveData.update(d => {
      if (!d?.quests) return d;
      const qs = { ...(d.quests as Record<string, Record<string, unknown>>) };
      const completed = [...((d.completed_quests as string[]) ?? [])];
      for (const [key, q] of Object.entries(qs)) {
        qs[key] = { ...q, progress: q.goal_amt };
        const title = (q.title as string) ?? key;
        if (!completed.includes(title)) completed.push(title);
      }
      d.quests = qs;
      d.completed_quests = completed;
      return d;
    });
    addToast('✅ All quests completed!', 'success');
  }

  function resetAll() {
    if (!confirm('Reset all quest progress?')) return;
    saveData.update(d => {
      if (!d?.quests) return d;
      const qs = { ...(d.quests as Record<string, Record<string, unknown>>) };
      for (const [key, q] of Object.entries(qs)) {
        qs[key] = { ...q, progress: 0 };
      }
      d.quests = qs;
      return d;
    });
    addToast('Quest progress reset', 'info');
  }

  function completeOne(questId: string, goalAmt: number) {
    saveData.update(d => {
      if (!d?.quests) return d;
      const qs = d.quests as Record<string, Record<string, unknown>>;
      if (qs[questId]) {
        qs[questId] = { ...qs[questId], progress: goalAmt };
        const title = (qs[questId].title as string) ?? questId;
        const completed = [...((d.completed_quests as string[]) ?? [])];
        if (!completed.includes(title)) {
          completed.push(title);
          d.completed_quests = completed;
        }
        d.quests = { ...qs };
      }
      return d;
    });
    addToast(`✅ Quest completed!`, 'success');
  }

  const TIER_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const TIER_COLORS = ['text-white/60', 'text-green-400', 'text-blue-400', 'text-purple-400', 'text-amber-400'];
  const TIER_BGS = ['bg-white/5', 'bg-green-500/10', 'bg-blue-500/10', 'bg-purple-500/10', 'bg-amber-500/10'];
  const TIER_BORDERS = ['border-white/10', 'border-green-500/20', 'border-blue-500/20', 'border-purple-500/20', 'border-amber-500/20'];

  function hasQuestReward(id: string): boolean {
    return QUEST_COSMETICS.includes(id);
  }

  let questSearch = $state('');
</script>

{#if $saveData}
  {@const quests = getQuests()}
  {@const questEntries = Object.entries(quests)}
  {@const completed = questEntries.filter(([, q]) => q.progress >= q.goal_amt).length}
  {@const totalGold = questEntries.reduce((s, [, q]) => s + (q.gold_reward ?? 0), 0)}
  {@const totalXP = questEntries.reduce((s, [, q]) => s + (q.xp_reward ?? 0), 0)}
  {@const earnedGold = questEntries.filter(([, q]) => q.progress >= q.goal_amt).reduce((s, [, q]) => s + (q.gold_reward ?? 0), 0)}
  {@const earnedXP = questEntries.filter(([, q]) => q.progress >= q.goal_amt).reduce((s, [, q]) => s + (q.xp_reward ?? 0), 0)}
  {@const completionPct = questEntries.length > 0 ? Math.round(completed / questEntries.length * 100) : 0}

  <div class="space-y-4">
    <!-- Stats Dashboard -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-xl border border-lime-500/20 bg-lime-500/[0.04] p-4">
        <div class="text-[10px] text-lime-400/50 uppercase tracking-wider font-medium">Active Quests</div>
        <div class="text-2xl font-bold text-lime-400 font-mono mt-1">{questEntries.length}</div>
      </div>
      <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <div class="text-[10px] text-emerald-400/50 uppercase tracking-wider font-medium">Completed</div>
        <div class="text-2xl font-bold text-emerald-400 font-mono mt-1">{completed}<span class="text-xs text-white/20">/{questEntries.length}</span></div>
        <!-- Completion ring -->
        <div class="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
          <div class="h-full rounded-full bg-emerald-500 transition-all" style="width: {completionPct}%"></div>
        </div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Gold Rewards</div>
        <div class="text-lg font-bold text-white/70 font-mono mt-1">${earnedGold.toLocaleString()}<span class="text-xs text-white/20">/${totalGold.toLocaleString()}</span></div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">XP Rewards</div>
        <div class="text-lg font-bold text-white/70 font-mono mt-1">{earnedXP.toLocaleString()}<span class="text-xs text-white/20">/{totalXP.toLocaleString()}</span></div>
      </div>
    </div>

    <!-- Tier breakdown -->
    <div class="flex flex-wrap gap-2">
      {#each [0, 1, 2, 3, 4] as tier}
        {@const count = questEntries.filter(([, q]) => q.tier === tier).length}
        {#if count > 0}
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg {TIER_BGS[tier]} border {TIER_BORDERS[tier]}">
            <span class="text-xs font-medium {TIER_COLORS[tier]}">{TIER_LABELS[tier]}</span>
            <span class="text-[10px] text-white/30 font-mono">{count}</span>
          </div>
        {/if}
      {/each}
    </div>

    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>📋</span> Quests
          <span class="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">{questEntries.length}</span>
        </h3>
        <div class="flex gap-2 items-center">
          <input type="text" placeholder="Search quests..." bind:value={questSearch}
            class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-sky-500/50 w-44" />
          <button class="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium transition-all cursor-pointer" onclick={completeAll}>
            ✅ Complete All
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-all cursor-pointer" onclick={resetAll}>
            Reset All
          </button>
        </div>
      </div>

      {#if true}
      {@const qq = questSearch.toLowerCase()}
      {@const filteredQuests = qq ? questEntries.filter(([id, q]) => q.title.toLowerCase().includes(qq) || id.toLowerCase().includes(qq) || q.goal_id.toLowerCase().includes(qq) || q.action.toLowerCase().includes(qq)) : questEntries}
      {#if filteredQuests.length === 0}
        <div class="text-center py-8 text-white/20 text-sm">{qq ? 'No quests match your search' : 'No active quests'}</div>
      {:else}
        <div class="space-y-2">
          {#each filteredQuests as [questId, quest]}
            {@const pct = quest.goal_amt > 0 ? Math.min(100, Math.round((quest.progress / quest.goal_amt) * 100)) : 0}
            {@const isComplete = quest.progress >= quest.goal_amt}
            {@const goalIcon = getThingIcon(quest.goal_id)}
            <div class="rounded-lg border p-4 transition-all {isComplete ? 'bg-emerald-500/5 border-emerald-500/15' : TIER_BGS[quest.tier] + ' ' + TIER_BORDERS[quest.tier]}">
              <div class="flex items-start gap-3">
                <!-- Icon -->
                <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                  {#if goalIcon}
                    <img src="/icons/{goalIcon}" alt="" class="w-8 h-8 object-contain pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                  {:else}
                    <span class="text-lg">📋</span>
                  {/if}
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-white/90">{quest.title || questId}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full {TIER_BGS[quest.tier]} border {TIER_BORDERS[quest.tier]} {TIER_COLORS[quest.tier]} font-medium">
                      {TIER_LABELS[quest.tier] ?? `Tier ${quest.tier}`}
                    </span>
                    {#if isComplete}
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">✓ Complete</span>
                    {/if}
                    {#if quest.hidden}
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">Hidden</span>
                    {/if}
                  </div>

                  <div class="text-xs text-white/40 mt-1">
                    {quest.action} {quest.goal_id ? getThingName(quest.goal_id) : ''}
                  </div>

                  <!-- Progress bar -->
                  <div class="mt-2 flex items-center gap-3">
                    <div class="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-500 {isComplete ? 'bg-emerald-500' : 'bg-sky-500'}"
                        style="width: {pct}%"></div>
                    </div>
                    <span class="text-xs font-mono text-white/50 shrink-0 w-20 text-right">{quest.progress}/{quest.goal_amt} <span class="text-white/20">({pct}%)</span></span>
                  </div>

                  <!-- Progress editor -->
                  <div class="mt-2 flex items-center gap-2">
                    <input type="range" min="0" max={quest.goal_amt} value={quest.progress}
                      oninput={(e) => updateProgress(questId, +(e.target as HTMLInputElement).value)}
                      class="flex-1 accent-sky-500 h-1" />
                    <input type="number" min="0" max={quest.goal_amt} value={quest.progress}
                      onchange={(e) => updateProgress(questId, +(e.target as HTMLInputElement).value)}
                      class="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all" />
                    {#if !isComplete}
                      <button onclick={() => completeOne(questId, quest.goal_amt)}
                        class="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-medium transition-all cursor-pointer shrink-0">Done</button>
                    {/if}
                  </div>

                  <!-- Rewards -->
                  <div class="mt-2 flex items-center gap-3 text-[10px] flex-wrap">
                    {#if quest.gold_reward > 0}
                      <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/15 text-yellow-400/70">💰 ${quest.gold_reward.toLocaleString()}</span>
                    {/if}
                    {#if quest.xp_reward > 0}
                      <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/15 text-blue-400/70">⭐ {quest.xp_reward} XP</span>
                    {/if}
                    {#if quest.rewards?.length > 0}
                      {#each quest.rewards as reward}
                        {@const rIcon = getThingIcon(String(reward))}
                        {@const isQuestCosmetic = hasQuestReward(String(reward))}
                        <span class="flex items-center gap-1 px-2 py-0.5 rounded-full border {isQuestCosmetic ? 'bg-fuchsia-500/10 border-fuchsia-500/15 text-fuchsia-400/70' : 'bg-white/5 border-white/10 text-white/40'}">
                          {#if rIcon}
                            <img src="/icons/{rIcon}" alt="" class="w-3.5 h-3.5 pixelated" onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/icons/light-bulb.png'; (e.currentTarget as HTMLImageElement).classList.remove('pixelated'); }} />
                          {:else}
                            🎁
                          {/if}
                          {getThingName(String(reward))}
                          {#if isQuestCosmetic}
                            <span class="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 rounded font-bold">QUEST</span>
                          {/if}
                        </span>
                      {/each}
                    {/if}
                  </div>
                </div>
              </div>
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
