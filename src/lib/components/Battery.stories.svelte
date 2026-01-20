<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Battery from './Battery.svelte';

  /**
   * ===================================================================
   * STORIES : Battery.svelte
   * ===================================================================
   * 
   * Composant d'affichage du niveau de batterie utilisant l'API Battery
   * du navigateur (Battery Status API).
   * 
   * COMPORTEMENT :
   * - Affiche le pourcentage de batterie et l'état de charge
   * - S'adapte automatiquement aux changements de niveau/état
   * - Affiche "Batterie — n/s" si l'API n'est pas supportée
   * 
   * CONTRAINTES :
   * - Nécessite un contexte sécurisé (HTTPS ou localhost)
   * - API non disponible sur tous les navigateurs (Firefox, Safari)
   * - Le composant gère ses propres états internes via onMount
   * 
   * NOTE : Les stories ci-dessous démontrent le rendu statique.
   * L'état réel de la batterie est déterminé par l'API du navigateur.
   * ===================================================================
   */
  const { Story } = defineMeta({
    title: 'Composants/Battery',
    component: Battery,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
## Indicateur de batterie

Affiche le niveau de batterie du périphérique en utilisant l'API Battery Status.

### Fonctionnalités
- 🔋 Niveau de batterie en pourcentage
- ⚡ Indicateur de charge
- 📱 Mise à jour en temps réel
- 🚫 Fallback si non supporté

### API utilisée
\`navigator.getBattery()\` - [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery)

### Notes techniques
- L'API nécessite un contexte sécurisé (HTTPS)
- Non supporté sur Firefox et Safari
- Le composant nettoie les listeners au démontage
          `
        }
      }
    }
  });
</script>

<!--
  =====================================================================
  STORY : Défaut
  =====================================================================
  Rendu par défaut du composant Battery.
  L'état affiché dépend du support navigateur et de la batterie réelle.
-->
<Story name="Défaut">
  <div class="story-container">
    <Battery />
  </div>
</Story>

<!--
  =====================================================================
  STORY : Dans une navbar
  =====================================================================
  Démontre l'intégration du composant dans un contexte de navigation,
  comme il est utilisé dans Navbar.svelte.
-->
<Story name="Dans une navbar">
  <nav class="story-navbar">
    <span class="story-brand">TP PWA</span>
    <div class="story-tray">
      <Battery />
    </div>
  </nav>
</Story>

<!--
  =====================================================================
  STORY : Multiples instances
  =====================================================================
  Vérifie que plusieurs instances du composant peuvent coexister
  sans conflit d'événements ou de ressources.
-->
<Story name="Multiples instances">
  <div class="story-grid">
    <div class="story-card">
      <span class="story-label">Instance 1</span>
      <Battery />
    </div>
    <div class="story-card">
      <span class="story-label">Instance 2</span>
      <Battery />
    </div>
    <div class="story-card">
      <span class="story-label">Instance 3</span>
      <Battery />
    </div>
  </div>
</Story>

<style>
  /* Container générique pour les stories */
  .story-container {
    padding: 1rem;
    background: var(--color-surface, #1a1a2e);
    border-radius: 0.5rem;
  }

  /* Simulation de navbar pour contexte d'intégration */
  .story-navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--color-surface, #1a1a2e);
    border-radius: 0.5rem;
  }

  .story-brand {
    font-weight: bold;
    font-size: 1.2rem;
    color: var(--color-text, #fff);
  }

  .story-tray {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* Grille pour afficher plusieurs instances */
  .story-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .story-card {
    padding: 1rem;
    background: var(--color-surface, #1a1a2e);
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .story-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
