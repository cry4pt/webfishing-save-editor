<script lang="ts">
  import { isLoaded, fileName, downloadSave, saveInPlace, hasDirectAccess, supportsDirectSave, openFileWithAccess } from '$lib/stores/save';
  import Toasts from '$lib/components/Toasts.svelte';
  import DropZone from '$lib/components/DropZone.svelte';
  import OverviewTab from '$lib/components/OverviewTab.svelte';
  import EconomyTab from '$lib/components/EconomyTab.svelte';
  import FishingTab from '$lib/components/FishingTab.svelte';
  import CosmeticsTab from '$lib/components/CosmeticsTab.svelte';
  import InventoryTab from '$lib/components/InventoryTab.svelte';
  import JournalTab from '$lib/components/JournalTab.svelte';
  import QuestsTab from '$lib/components/QuestsTab.svelte';
  import TagsTab from '$lib/components/TagsTab.svelte';
  import RawJsonTab from '$lib/components/RawJsonTab.svelte';
  import PropsTab from '$lib/components/PropsTab.svelte';
  import CorruptBanner from '$lib/components/CorruptBanner.svelte';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '⚡' },
    { id: 'economy', label: 'Economy', icon: '💰' },
    { id: 'fishing', label: 'Fishing', icon: '🎣' },
    { id: 'cosmetics', label: 'Cosmetics', icon: '👕' },
    { id: 'inventory', label: 'Inventory', icon: '🎒' },
    { id: 'props', label: 'Props', icon: '🪑' },
    { id: 'journal', label: 'Journal', icon: '📖' },
    { id: 'quests', label: 'Quests', icon: '📋' },
    { id: 'tags', label: 'Tags & Achievements', icon: '🏷️' },
    { id: 'raw', label: 'Raw JSON', icon: '{ }' },
  ];
  let activeTab = $state('overview');

  // Ctrl+S shortcut
  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if ($isLoaded) {
        if ($hasDirectAccess) saveInPlace();
        else downloadSave();
      }
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />
<Toasts />

<div class="min-h-screen bg-[#09090b] text-white/90">
  <!-- Header -->
  <header class="sticky top-0 z-40 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
      <div class="flex items-center gap-2.5">
        <span class="text-xl">🐟</span>
        <h1 class="text-base font-semibold tracking-tight">
          <span class="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">WEBFISHING</span>
          <span class="text-white/50 font-normal ml-1">Save Editor</span>
        </h1>
      </div>
      <span class="text-xs text-white/20 bg-white/5 px-2 py-0.5 rounded-full">v1.12</span>
      {#if $isLoaded}
        <div class="ml-auto flex items-center gap-3">
          <span class="text-xs text-white/30 font-mono">{$fileName}</span>
          {#if $hasDirectAccess}
            <span class="text-[9px] text-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 rounded-full">Direct Access</span>
          {/if}
          <button
            class="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
            onclick={() => $hasDirectAccess ? saveInPlace() : downloadSave()}
          >
            {$hasDirectAccess ? '💾 Save' : '⬇️ Save'}
          </button>
        </div>
      {/if}
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8">
    {#if !$isLoaded}
      <!-- Upload State -->
      <div class="max-w-2xl mx-auto mt-20">
        <div class="text-center mb-10">
          <h2 class="text-3xl font-bold tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
            Edit your WEBFISHING save
          </h2>
          <p class="text-white/30 mt-2 text-sm">Upload a <code class="text-white/40">.sav</code> file to get started</p>
        </div>
        <DropZone />
      </div>
    {:else}
      <!-- Editor -->
      <div class="space-y-6">
        <!-- Tab Bar -->
        <nav class="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {#each tabs as tab}
            <button
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer
                {activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'}"
              onclick={() => activeTab = tab.id}
            >
              <span class="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          {/each}
        </nav>

        <!-- Corrupt Save Banner -->
        <CorruptBanner />

        <!-- Tab Content -->
        <div class="pb-16">
          {#if activeTab === 'overview'}<OverviewTab />
          {:else if activeTab === 'economy'}<EconomyTab />
          {:else if activeTab === 'fishing'}<FishingTab />
          {:else if activeTab === 'cosmetics'}<CosmeticsTab />
          {:else if activeTab === 'inventory'}<InventoryTab />
          {:else if activeTab === 'props'}<PropsTab />
          {:else if activeTab === 'journal'}<JournalTab />
          {:else if activeTab === 'quests'}<QuestsTab />
          {:else if activeTab === 'tags'}<TagsTab />
          {:else if activeTab === 'raw'}<RawJsonTab />
          {/if}
        </div>
      </div>
    {/if}
  </main>
</div>
