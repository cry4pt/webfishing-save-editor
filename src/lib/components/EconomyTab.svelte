<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { LOAN_DATA } from '$lib/gamedata';

  function update(key: string, value: number) {
    saveData.update(d => { if (d) d[key] = value; return d; });
  }

  function setMoneyPreset(amount: number) {
    saveData.update(d => { if (d) { d.money = amount; d.cash_total = amount; } return d; });
  }

  function payOff() {
    saveData.update(d => { if (d) { d.loan_level = 3; d.loan_left = 0; } return d; });
    addToast('🏦 All loans paid off!', 'success');
  }
</script>

{#if $saveData}
  {@const money = ($saveData.money ?? 0) as number}
  {@const cashTotal = ($saveData.cash_total ?? 0) as number}
  {@const loanLevel = ($saveData.loan_level ?? 0) as number}
  {@const loanLeft = ($saveData.loan_left ?? 0) as number}
  {@const loanMax = LOAN_DATA[loanLevel] ?? 0}
  {@const loanPaid = loanMax > 0 ? Math.max(0, loanMax - loanLeft) : 0}
  {@const loanPct = loanMax > 0 ? (loanPaid / loanMax * 100) : 100}
  {@const inv = ($saveData.inventory as Record<string, unknown>[]) ?? []}

  <div class="space-y-4">
    <!-- Wealth Dashboard -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <div class="text-[10px] text-emerald-400/50 uppercase tracking-wider font-medium">Current Money</div>
        <div class="text-2xl font-bold text-emerald-400 font-mono mt-1">${money.toLocaleString()}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Lifetime Earned</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">${cashTotal.toLocaleString()}</div>
      </div>
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Items Owned</div>
        <div class="text-2xl font-bold text-white/70 font-mono mt-1">{inv.length}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Currency -->
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>💰</span> Currency
        </h3>
        <div class="space-y-3">
          <label class="block">
            <span class="text-xs text-white/40 uppercase tracking-wider">Current Money</span>
            <input type="number" min="0" max="999999999"
              value={$saveData.money ?? 0}
              onchange={(e) => update('money', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all" />
          </label>
          <label class="block">
            <span class="text-xs text-white/40 uppercase tracking-wider">Lifetime Cash Total</span>
            <input type="number" min="0" max="999999999"
              value={$saveData.cash_total ?? 0}
              onchange={(e) => update('cash_total', Math.max(0, +(e.target as HTMLInputElement).value))}
              class="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all" />
          </label>

          <!-- Quick presets -->
          <div class="flex flex-wrap gap-2 pt-1">
            {#each [1000, 10000, 100000, 999999999] as amount}
              <button class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/40 hover:text-emerald-300 text-[10px] font-mono transition-colors cursor-pointer" onclick={() => setMoneyPreset(amount)}>
                ${amount.toLocaleString()}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Loans -->
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
            <span>🏦</span> Loans
          </h3>
          <button class="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-medium transition-all cursor-pointer" onclick={payOff}>
            Pay Off All
          </button>
        </div>

        <!-- Loan progress -->
        <div class="space-y-2">
          <div class="flex justify-between text-xs">
            <span class="text-white/40">Camp Tier {loanLevel + 1} Progress</span>
            <span class="text-white/60 font-mono">${loanPaid.toLocaleString()} / ${loanMax.toLocaleString()}</span>
          </div>
          <div class="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500 {loanLeft === 0 ? 'bg-emerald-500' : 'bg-teal-500'}" style="width: {loanPct}%"></div>
          </div>
          {#if loanLeft === 0 && loanLevel >= 3}
            <div class="text-xs text-emerald-400 font-medium">✓ Camp Tier 4 — All loans fully paid!</div>
          {:else if loanLeft === 0}
            <div class="text-xs text-emerald-400/60">✓ Current tier paid — upgrade available</div>
          {:else}
            <div class="text-xs text-white/25">${loanLeft.toLocaleString()} remaining</div>
          {/if}
        </div>

        <div class="space-y-3">
          <label class="block">
            <span class="text-xs text-white/40 uppercase tracking-wider">Camp Tier (1-4)</span>
            <input type="number" min="1" max="4"
              value={(($saveData.loan_level ?? 0) as number) + 1}
              onchange={(e) => update('loan_level', Math.max(0, Math.min(3, +(e.target as HTMLInputElement).value - 1)))}
              class="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all" />
          </label>
          <label class="block">
            <span class="text-xs text-white/40 uppercase tracking-wider">Remaining Balance</span>
            <input type="number" min="0" max={loanMax}
              value={$saveData.loan_left ?? 0}
              onchange={(e) => update('loan_left', Math.max(0, Math.min(loanMax, +(e.target as HTMLInputElement).value)))}
              class="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all" />
          </label>
        </div>

        <!-- Loan tiers -->
        <div class="space-y-1 pt-1">
          {#each Object.entries(LOAN_DATA) as [tier, amount]}
            {@const tierNum = Number(tier)}
            {@const isComplete = loanLevel > tierNum || (loanLevel === tierNum && loanLeft === 0)}
            {@const isCurrent = loanLevel === tierNum && loanLeft > 0}
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs {isCurrent ? 'bg-teal-500/10 border border-teal-500/20' : isComplete ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-white/[0.01] border border-white/5'}">
              <span class="w-5 text-center {isComplete ? 'text-emerald-400' : isCurrent ? 'text-teal-400' : 'text-white/20'}">{isComplete ? '✓' : isCurrent ? '◉' : '○'}</span>
              <span class="text-white/50 font-medium">Camp Tier {tierNum + 1}</span>
              <span class="font-mono text-white/30 ml-auto">${amount.toLocaleString()}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
