<script lang="ts">
  import { QUALITY_NAMES, QUALITY_COLORS } from '$lib/gamedata';

  interface Props {
    value: number;
    onchange: (quality: number) => void;
    compact?: boolean;
  }

  let { value = 0, onchange, compact = false }: Props = $props();

  // Clamp value to valid quality range
  const safeValue = $derived(Math.max(0, Math.min(value, QUALITY_NAMES.length - 1)));
</script>

<div class="inline-flex flex-col gap-1">
  {#if !compact}
    <span class="text-[10px] text-white/30 flex items-center gap-1">
      <span class="text-amber-400/80">✦</span> Quality
    </span>
  {/if}
  <div class="flex items-center gap-0.5 p-1 rounded-lg bg-black/30 border border-white/[0.06]">
    {#each QUALITY_NAMES as name, qi}
      {@const selected = qi === safeValue}
      {@const color = QUALITY_COLORS[qi]}
      <button
        onclick={() => onchange(qi)}
        title={name}
        class="relative rounded-md transition-all duration-200 cursor-pointer flex items-center justify-center
          {compact ? 'w-5 h-5' : 'w-[26px] h-[22px]'}
          {selected
            ? 'z-10 scale-110'
            : 'opacity-25 hover:opacity-60 hover:scale-105'}"
        style="{selected
          ? `background: ${color}18; border: 1.5px solid ${color}; box-shadow: 0 0 8px ${color}50, 0 0 2px ${color}30;`
          : `background: transparent; border: 1.5px solid transparent;`}"
      >
        <span
          class="text-[9px] font-black drop-shadow-sm {selected ? '' : 'opacity-80'}"
          style="color: {color}"
        >✦</span>
      </button>
    {/each}
  </div>
  <div
    class="text-[10px] font-bold tracking-wider flex items-center gap-1 pl-0.5 transition-colors duration-200"
    style="color: {QUALITY_COLORS[safeValue]}"
  >
    {QUALITY_NAMES[safeValue]}
  </div>
</div>
