<script lang="ts">
  import { loadFile, supportsDirectSave, openFileWithAccess } from '$lib/stores/save';

  let dragover = $state(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragover = false;
    if (e.dataTransfer?.files.length) loadFile(e.dataTransfer.files[0]);
  }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragover = true; }
  function onDragLeave() { dragover = false; }
  function onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) loadFile(input.files[0]);
  }

  let fileInput: HTMLInputElement;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-16 text-center
    {dragover ? 'border-sky-400 bg-sky-400/5 scale-[1.01]' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.02]'}"
  onclick={() => supportsDirectSave ? openFileWithAccess() : fileInput.click()}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
>
  <div class="flex flex-col items-center gap-4">
    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 flex items-center justify-center text-4xl
      group-hover:from-sky-500/30 group-hover:to-violet-500/30 transition-all duration-300">
      📂
    </div>
    <div>
      <h2 class="text-xl font-semibold text-white/90">Drop your save file here</h2>
      <p class="text-sm text-white/40 mt-1">or click to browse</p>
    </div>
    <div class="flex gap-2 mt-2">
      <span class="px-3 py-1 rounded-full bg-white/5 text-xs text-white/40 border border-white/10">.sav</span>
      <span class="px-3 py-1 rounded-full bg-white/5 text-xs text-white/40 border border-white/10">.backup</span>
    </div>
    {#if supportsDirectSave}
      <p class="text-xs text-emerald-400/40 mt-1">
        💾 Direct save supported — edits write back to the original file
      </p>
    {/if}
    <p class="text-xs text-white/25 mt-2">
      Save location: <code class="text-white/35">%APPDATA%\Godot\app_userdata\webfishing_2_newver\</code>
    </p>
  </div>
  <input bind:this={fileInput} type="file" accept=".sav,.backup,.save" class="hidden" onchange={onFileSelect} />
</div>
