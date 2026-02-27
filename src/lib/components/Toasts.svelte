<script lang="ts">
  import { toasts } from '$lib/stores/save';
</script>

{#each $toasts as toast, i (toast.id)}
  <div
    class="fixed right-5 z-50 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-in
      {toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' :
       toast.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-400' :
       'bg-sky-500/10 border-sky-500/40 text-sky-400'}"
    style="top: {1.25 + i * 3.5}rem"
  >
    <span class="text-sm font-medium">{toast.message}</span>
  </div>
{/each}

<style>
  .animate-slide-in {
    animation: slideIn 0.3s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>
