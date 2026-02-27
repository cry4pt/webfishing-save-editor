<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';
  import { ALL_THINGS, isKnownThing } from '$lib/gamedata-extracted';

  type CorruptionIssue = { type: string; id: string; location: string };

  function checkCorruption(): CorruptionIssue[] {
    if (!$saveData) return [];
    const issues: CorruptionIssue[] = [];

    // Check inventory item IDs
    const inv = ($saveData.inventory as Record<string, unknown>[]) ?? [];
    for (const item of inv) {
      const id = String(item.id ?? '');
      if (id && !isKnownThing(id)) {
        issues.push({ type: 'item', id, location: 'inventory' });
      }
    }

    // Check unlocked cosmetics
    const cosmetics = ($saveData.cosmetics_unlocked as string[]) ?? [];
    for (const id of cosmetics) {
      if (!isKnownThing(id)) {
        issues.push({ type: 'cosmetic', id, location: 'cosmetics_unlocked' });
      }
    }

    // Check equipped cosmetics
    const equipped = ($saveData.cosmetics_equipped as Record<string, unknown>) ?? {};
    for (const [slot, val] of Object.entries(equipped)) {
      if (Array.isArray(val)) {
        for (const id of val as string[]) {
          if (id && !isKnownThing(id)) {
            issues.push({ type: 'equipped', id, location: `cosmetics_equipped.${slot}` });
          }
        }
      } else if (typeof val === 'string' && val && !isKnownThing(val)) {
        issues.push({ type: 'equipped', id: val, location: `cosmetics_equipped.${slot}` });
      }
    }

    // Check journal fish IDs (soft check - only flag if clearly invalid, not just unrecognized)
    // Journal entries use fish IDs that may not exactly match extracted item resources
    // (e.g. old game versions, loot table aliases). Don't flag these as corruption.

    return issues;
  }

  function autoFix() {
    saveData.update(d => {
      if (!d) return d;

      // Remove unknown inventory items
      d.inventory = ((d.inventory as Record<string, unknown>[]) ?? []).filter(item => isKnownThing(String(item.id ?? '')));

      // Remove unknown cosmetics
      d.cosmetics_unlocked = ((d.cosmetics_unlocked as string[]) ?? []).filter(id => isKnownThing(id));

      // Fix equipped cosmetics
      const equipped = (d.cosmetics_equipped as Record<string, unknown>) ?? {};
      const fallbacks: Record<string, string | string[]> = {
        species: 'species_cat', pattern: 'pattern_none', primary_color: 'pcolor_white',
        secondary_color: 'scolor_tan', hat: 'hat_none', undershirt: 'shirt_none',
        overshirt: 'overshirt_none', title: 'title_rank_1', bobber: 'bobber_default',
        eye: 'eye_halfclosed', nose: 'nose_cat', mouth: 'mouth_default',
        accessory: [], tail: 'tail_cat', legs: 'legs_none',
      };
      for (const [slot, val] of Object.entries(equipped)) {
        if (Array.isArray(val)) {
          equipped[slot] = (val as string[]).filter(id => isKnownThing(id));
        } else if (typeof val === 'string' && val && !isKnownThing(val)) {
          equipped[slot] = fallbacks[slot] ?? val;
        }
      }

      // Journal entries are not cleaned — they are tracking data, not item references

      return d;
    });
    addToast('🔧 Corrupt entries removed!', 'success');
  }

  $effect(() => {
    // Re-check whenever saveData changes
    if ($saveData) issues = checkCorruption();
  });

  let issues = $state<CorruptionIssue[]>([]);
</script>

{#if issues.length > 0}
  <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
    <div class="flex items-center gap-2">
      <span class="text-xl">⚠️</span>
      <h3 class="text-sm font-semibold text-amber-400">Potentially Corrupt Save Detected</h3>
      <span class="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{issues.length} issues</span>
    </div>

    <p class="text-xs text-white/50">
      Found {issues.length} unknown item/cosmetic ID(s) that don't match known game data.
      This may be caused by mods, game updates, or save corruption.
    </p>

    <details class="group">
      <summary class="cursor-pointer text-xs text-amber-400/70 hover:text-amber-400 transition-colors">
        Show details ({issues.length} entries)
      </summary>
      <div class="mt-2 max-h-40 overflow-y-auto space-y-1">
        {#each issues as issue}
          <div class="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-white/[0.02]">
            <span class="text-amber-400/50">{issue.type}</span>
            <span class="font-mono text-white/60">{issue.id}</span>
            <span class="text-white/20 ml-auto">in {issue.location}</span>
          </div>
        {/each}
      </div>
    </details>

    <button
      class="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-all cursor-pointer"
      onclick={autoFix}
    >
      🔧 Auto-Fix (Remove Unknown Entries)
    </button>
  </div>
{/if}
