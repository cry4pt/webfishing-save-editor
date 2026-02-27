<script lang="ts">
  import { saveData } from '$lib/stores/save';

  // --- Guitar Shapes ---
  function toggleCell(shapeIdx: number, row: number, col: number) {
    saveData.update(d => {
      if (!d) return d;
      const shapes = d.guitar_shapes as number[][][];
      if (!shapes?.[shapeIdx]?.[row]) return d;
      const newRow = [...shapes[shapeIdx][row]];
      newRow[col] = newRow[col] ? 0 : 1;
      const newShape = [...shapes[shapeIdx]];
      newShape[row] = newRow;
      const newShapes = [...shapes];
      newShapes[shapeIdx] = newShape;
      d.guitar_shapes = newShapes;
      return d;
    });
  }
  function clearShape(idx: number) {
    saveData.update(d => {
      if (!d) return d;
      const shapes = d.guitar_shapes as number[][][];
      if (!shapes?.[idx]) return d;
      const newShapes = [...shapes];
      newShapes[idx] = shapes[idx].map(row => row.map(() => 0));
      d.guitar_shapes = newShapes;
      return d;
    });
  }

  // --- Recorded Time ---
  function updateTime(key: string, value: number) {
    saveData.update(d => {
      if (!d) return d;
      const current = (d.recorded_time && typeof d.recorded_time === 'object' ? d.recorded_time : { hour: 0, minute: 0, second: 0 }) as Record<string, number>;
      d.recorded_time = { ...current, [key]: value };
      return d;
    });
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all";
</script>

{#if $saveData}
  {@const shapes = ($saveData.guitar_shapes as number[][][]) ?? []}
  {@const time = ($saveData.recorded_time as Record<string, number>) ?? {}}

  <div class="space-y-4">
    <!-- Guitar Shapes -->
    {#if shapes.length > 0}
      <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <span>🎸</span> Guitar Shapes
          <span class="text-xs text-white/25">Click cells to toggle</span>
        </h3>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {#each shapes as shape, si}
            <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-white/50 font-medium">Shape {si + 1}</span>
                <button class="text-[10px] text-red-400/50 hover:text-red-400 transition-colors cursor-pointer" onclick={() => clearShape(si)}>Clear</button>
              </div>
              <div class="flex flex-col gap-0.5">
                {#each shape as row, ri}
                  <div class="flex gap-0.5">
                    {#each row as cell, ci}
                      <button
                        aria-label="Toggle note string {ri+1} fret {ci+1}"
                        class="w-5 h-5 rounded-sm transition-all cursor-pointer {cell ? 'bg-amber-400 shadow-sm shadow-amber-400/30' : 'bg-white/10 hover:bg-white/20'}"
                        onclick={() => toggleCell(si, ri, ci)}
                      ></button>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Recorded Time -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
        <span>🕐</span> Recorded Time
      </h3>
      <div class="grid grid-cols-3 gap-2" style="max-width: 20rem;">
        {#each ['hour', 'minute', 'second'] as unit}
          <label class="block">
            <span class="text-[10px] text-white/30 capitalize">{unit}</span>
            <input type="number" min="0" max={unit === 'hour' ? 23 : 59}
              value={time[unit] ?? 0}
              onchange={(e) => updateTime(unit, +(e.target as HTMLInputElement).value)}
              class={inputClass} />
          </label>
        {/each}
      </div>
    </div>

    <!-- Version & Misc -->
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <h3 class="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
        <span>⚙️</span> Miscellaneous
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="block">
          <span class="text-xs text-white/40">Save Version</span>
          <input type="number" step="0.01" value={$saveData.version ?? 0}
            onchange={(e) => saveData.update(d => { if (d) d.version = +(e.target as HTMLInputElement).value; return d; })}
            class={'mt-1 ' + inputClass} />
        </label>
      </div>
    </div>
  </div>
{/if}
