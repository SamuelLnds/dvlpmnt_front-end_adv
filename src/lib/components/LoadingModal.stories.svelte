<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import LoadingModal from './LoadingModal.svelte';
  import { loadingStore } from '$lib/stores/loading';

  /**
   * ===================================================================
   * STORIES : LoadingModal.svelte
   * ===================================================================
   * 
   * Modal de chargement global controlé par un store Svelte.
   * Affiche un overlay avec spinner animé et message personnalisable.
   * 
   * ARCHITECTURE :
   * - Le composant s'abonne a loadingStore (store Svelte)
   * - loadingStore.show(message) : affiche le modal
   * - loadingStore.hide() : masque le modal
   * ===================================================================
   */
  const { Story } = defineMeta({
    title: 'Composants/LoadingModal',
    component: LoadingModal,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: 'Modal de chargement global avec spinner anime et message personnalisable.'
        }
      }
    }
  });
</script>

<script>
  // Fonctions de controle pour les stories interactives
  function showDefault() {
    loadingStore.show();
  }
  
  function showCustom() {
    loadingStore.show('Envoi de votre message...');
  }
  
  function showLong() {
    loadingStore.show('Synchronisation des données en cours, veuillez patienter quelques instants...');
  }
  
  function hideModal() {
    loadingStore.hide();
  }
</script>

<!-- Story : État initial masqué -->
<Story name="Masqué (défaut)">
  <div class="story-page">
    <p class="story-info">
      Le LoadingModal est actuellement masqué (état par défaut).
    </p>
    <LoadingModal />
  </div>
</Story>

<!-- Story : Contrôle interactif -->
<Story name="Contrôle interactif">
  <div class="story-page">
    <div class="story-controls">
      <button class="story-btn story-btn--primary" onclick={showDefault}>
        Afficher (défaut)
      </button>
      <button class="story-btn" onclick={showCustom}>
        Message: Envoi
      </button>
      <button class="story-btn" onclick={showLong}>
        Message: Long
      </button>
      <button class="story-btn story-btn--danger" onclick={hideModal}>
        Masquer
      </button>
    </div>
    <LoadingModal />
  </div>
</Story>

<style>
  .story-page {
    min-height: 400px;
    padding: 2rem;
    background: var(--color-bg, #0f0f23);
    color: var(--color-text, #fff);
    position: relative;
  }

  .story-info {
    color: var(--color-text-secondary, #888);
    font-style: italic;
  }

  .story-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .story-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border, #333);
    background: var(--color-surface, #1a1a2e);
    color: var(--color-text, #fff);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .story-btn:hover {
    background: var(--color-surface-hover, #252542);
  }

  .story-btn--primary {
    background: var(--color-accent, #4f46e5);
    border-color: var(--color-accent, #4f46e5);
  }

  .story-btn--primary:hover {
    background: #6366f1;
  }

  .story-btn--danger {
    background: var(--color-danger, #dc2626);
    border-color: var(--color-danger, #dc2626);
  }

  .story-btn--danger:hover {
    background: #ef4444;
  }
</style>
