<script lang="ts">
  import { saveData, addToast } from '$lib/stores/save';

  let jsonText = $state('');
  let hasError = $state(false);
  let editorEl: HTMLTextAreaElement | undefined = $state();
  let highlightEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    if ($saveData) jsonText = JSON.stringify($saveData, null, 2);
  });

  function apply() {
    try {
      const parsed = JSON.parse(jsonText);
      saveData.set(parsed);
      hasError = false;
      addToast('JSON applied!', 'success');
    } catch (e) {
      hasError = true;
      addToast('Invalid JSON: ' + (e as Error).message, 'error');
    }
  }

  function refreshJson() {
    if ($saveData) jsonText = JSON.stringify($saveData, null, 2);
    hasError = false;
    addToast('Refreshed from editor state', 'info');
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(jsonText);
      jsonText = JSON.stringify(parsed, null, 2);
      hasError = false;
      addToast('Formatted!', 'info');
    } catch (e) {
      hasError = true;
      addToast('Cannot format: invalid JSON', 'error');
    }
  }

  function minifyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      jsonText = JSON.stringify(parsed);
      hasError = false;
      addToast('Minified!', 'info');
    } catch (e) {
      hasError = true;
      addToast('Cannot minify: invalid JSON', 'error');
    }
  }

  function copyJson() {
    navigator.clipboard.writeText(jsonText);
    addToast('Copied to clipboard!', 'info');
  }

  function highlightJson(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\.|[^"\\])*")\s*(?=:)|("(?:\\.|[^"\\])*")|((?:true|false|null))|([-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\]:,])/g,
      (match, key, str, bool, num, punct) => {
        if (key) return `<span class="json-key">${key}</span>`;
        if (str) return `<span class="json-string">${str}</span>`;
        if (bool) return `<span class="json-bool">${bool}</span>`;
        if (num) return `<span class="json-number">${num}</span>`;
        if (punct) return `<span class="json-punct">${punct}</span>`;
        return match;
      }
    );
  }

  function syncScroll() {
    if (editorEl && highlightEl) {
      highlightEl.scrollTop = editorEl.scrollTop;
      highlightEl.scrollLeft = editorEl.scrollLeft;
    }
  }

  let lineCount = $derived(jsonText.split('\n').length);
  let charCount = $derived(jsonText.length);
  let keyCount = $derived.by(() => { try { return Object.keys(JSON.parse(jsonText)).length; } catch { return 0; } });
  let highlighted = $derived(highlightJson(jsonText));
</script>

<div class="space-y-4">
  <!-- Stats Dashboard -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div class="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
      <div class="text-[10px] text-sky-400/50 uppercase tracking-wider font-medium">Lines</div>
      <div class="text-2xl font-bold text-sky-400 font-mono mt-1">{lineCount.toLocaleString()}</div>
    </div>
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Characters</div>
      <div class="text-2xl font-bold text-white/70 font-mono mt-1">{charCount.toLocaleString()}</div>
    </div>
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div class="text-[10px] text-white/30 uppercase tracking-wider font-medium">Properties</div>
      <div class="text-2xl font-bold text-white/70 font-mono mt-1">{keyCount}</div>
    </div>
    <div class="rounded-xl border {hasError ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-emerald-500/20 bg-emerald-500/[0.04]'} p-4">
      <div class="text-[10px] {hasError ? 'text-red-400/50' : 'text-emerald-400/50'} uppercase tracking-wider font-medium">Status</div>
      <div class="text-2xl font-bold {hasError ? 'text-red-400' : 'text-emerald-400'} font-mono mt-1">{hasError ? '✕ Error' : '✓ Valid'}</div>
    </div>
  </div>

  <div class="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
    <!-- Toolbar (VS Code title bar style) -->
    <div class="flex items-center justify-between gap-3 px-4 py-2" style="background: #323233; border-bottom: 1px solid #3c3c3c;">
      <div class="flex items-center gap-2">
        <span class="text-sm font-mono text-[#569cd6] font-semibold">{'{ }'}</span>
        <span class="text-xs font-medium text-[#cccccc] tracking-wide">save_data.json</span>
        <span class="text-[10px] text-[#858585] hidden sm:inline">— Raw Editor</span>
      </div>
      <div class="flex items-center gap-1">
        <button class="px-3 py-1 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-medium transition-all cursor-pointer" onclick={apply}>
          ✓ Apply
        </button>
        <div class="w-px h-4 mx-1" style="background: #3c3c3c;"></div>
        <button class="p-1.5 rounded hover:bg-[#505050] text-[#cccccc] text-xs transition-all cursor-pointer" onclick={refreshJson} title="Refresh from editor state">
          ↻
        </button>
        <button class="p-1.5 rounded hover:bg-[#505050] text-[#cccccc] text-xs transition-all cursor-pointer" onclick={formatJson} title="Format Document">
          ⎆
        </button>
        <button class="p-1.5 rounded hover:bg-[#505050] text-[#cccccc] text-xs transition-all cursor-pointer" onclick={minifyJson} title="Minify">
          ▬
        </button>
        <button class="p-1.5 rounded hover:bg-[#505050] text-[#cccccc] text-xs transition-all cursor-pointer" onclick={copyJson} title="Copy to clipboard">
          📋
        </button>
      </div>
    </div>

    <!-- Syntax-highlighted editor -->
    <div class="json-editor-wrap {hasError ? 'json-editor-error' : ''}">
      <div class="json-editor-container">
        <div class="json-line-numbers" aria-hidden="true">
          {#each { length: lineCount } as _, i}
            <div class="json-line-num">{i + 1}</div>
          {/each}
        </div>
        <div class="json-editor-inner">
          <div bind:this={highlightEl} class="json-highlight" aria-hidden="true">
            <pre><code>{@html highlighted + '\n'}</code></pre>
          </div>
          <textarea
            bind:this={editorEl}
            bind:value={jsonText}
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            oninput={syncScroll}
            onscroll={syncScroll}
            class="json-textarea"
          ></textarea>
        </div>
      </div>

      <!-- Status bar (VS Code style) -->
      <div class="flex items-center justify-between px-4 py-1 text-[11px] font-mono" style="background: #007acc;">
        <div class="flex items-center gap-4 text-white/90">
          <span>Ln {lineCount.toLocaleString()}</span>
          <span>·</span>
          <span>{(charCount / 1024).toFixed(1)} KB</span>
          <span>·</span>
          <span>{keyCount} props</span>
        </div>
        <div class="flex items-center gap-3 text-white/90">
          <span>JSON</span>
          <span>UTF-8</span>
          {#if hasError}
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> Error</span>
          {:else}
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span> Valid</span>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .json-editor-wrap {
    background: #1e1e1e;
    border-radius: 0 0 0.75rem 0.75rem;
  }
  .json-editor-error {
    box-shadow: inset 0 0 30px rgba(239, 68, 68, 0.05);
  }
  .json-editor-container {
    display: flex;
    position: relative;
    max-height: 600px;
    min-height: 400px;
  }
  .json-line-numbers {
    flex-shrink: 0;
    width: 52px;
    padding: 16px 0;
    background: #1e1e1e;
    border-right: 1px solid #2d2d2d;
    overflow: hidden;
    user-select: none;
    pointer-events: none;
  }
  .json-line-num {
    height: 1.5em;
    padding-right: 14px;
    text-align: right;
    font-family: 'Cascadia Code', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.5em;
    color: #858585;
  }
  .json-editor-inner {
    position: relative;
    flex: 1;
    overflow: hidden;
  }
  .json-highlight, .json-textarea {
    position: absolute;
    inset: 0;
    padding: 16px;
    font-family: 'Cascadia Code', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5em;
    tab-size: 2;
    white-space: pre;
    overflow: auto;
    word-wrap: normal;
  }
  .json-highlight {
    pointer-events: none;
    z-index: 1;
    color: transparent;
  }
  .json-highlight pre {
    margin: 0;
    font: inherit;
  }
  .json-highlight code {
    font: inherit;
  }
  .json-textarea {
    z-index: 2;
    color: transparent;
    caret-color: #aeafad;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    width: 100%;
    height: 100%;
    -webkit-text-fill-color: transparent;
  }
  .json-textarea::selection {
    background: #264f78;
    -webkit-text-fill-color: transparent;
  }

  /* VS Code Dark+ syntax colors */
  :global(.json-key) { color: #9cdcfe; }
  :global(.json-string) { color: #ce9178; }
  :global(.json-number) { color: #b5cea8; }
  :global(.json-bool) { color: #569cd6; }
  :global(.json-punct) { color: #808080; }
</style>
