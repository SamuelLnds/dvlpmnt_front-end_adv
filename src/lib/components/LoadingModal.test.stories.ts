/**
 * ===================================================================
 * Tests d'interaction Storybook - LoadingModal
 * ===================================================================
 * 
 * Tests automatisés pour le composant LoadingModal.
 * Vérifie le comportement du store et l'affichage du modal.
 * 
 * COUVERTURE :
 * - Affichage/masquage via le store
 * - Messages personnalisés
 * - Animation du spinner
 * - Blocage des interactions en arrière-plan
 * 
 * EXÉCUTION :
 * - Via Storybook UI : onglet "Interactions"
 * - Via CLI : npm run test-storybook
 * ===================================================================
 */

import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, waitFor, within } from 'storybook/test';
import LoadingModal from './LoadingModal.svelte';
import { loadingStore } from '$lib/stores/loading';

const meta = {
  title: 'Tests/LoadingModal',
  component: LoadingModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
## Tests d'interaction LoadingModal

Ces stories incluent des tests automatisés qui vérifient :
- L'affichage/masquage via loadingStore
- Les messages personnalisés
- La présence des éléments d'UI
        `
      }
    }
  },
  /**
   * Décorateur pour reset le store entre les tests
   */
  decorators: [
    () => {
      // Reset le store avant chaque story
      loadingStore.hide();
      return {};
    }
  ],
} satisfies Meta<typeof LoadingModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * =====================================================================
 * TEST : État initial masqué
 * =====================================================================
 * Vérifie que le modal n'est pas visible par défaut.
 */
export const TestInitialHidden: Story = {
  name: '🧪 Test: État Initial Masqué',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // S'assurer que le store est réinitialisé
    loadingStore.hide();
    
    // Le modal ne devrait pas être présent
    await waitFor(() => {
      const overlay = canvas.queryByText(/chargement/i);
      expect(overlay).not.toBeInTheDocument();
    });
  },
};

/**
 * =====================================================================
 * TEST : Affichage avec message par défaut
 * =====================================================================
 * Vérifie que loadingStore.show() affiche le modal avec le message par défaut.
 */
export const TestShowDefault: Story = {
  name: '🧪 Test: Affichage Défaut',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Afficher le modal
    loadingStore.show();
    
    // Vérifier que le message par défaut est affiché
    await waitFor(() => {
      const message = canvas.getByText('Chargement...');
      expect(message).toBeInTheDocument();
    });
    
    // Vérifier la présence du spinner
    const spinner = canvasElement.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  },
};

/**
 * =====================================================================
 * TEST : Message personnalisé
 * =====================================================================
 * Vérifie que le message personnalisé est correctement affiché.
 */
export const TestCustomMessage: Story = {
  name: '🧪 Test: Message Personnalisé',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    const customMessage = 'Envoi de votre photo en cours...';
    loadingStore.show(customMessage);
    
    // Vérifier que le message personnalisé est affiché
    await waitFor(() => {
      const message = canvas.getByText(customMessage);
      expect(message).toBeInTheDocument();
    });
  },
};

/**
 * =====================================================================
 * TEST : Masquage du modal
 * =====================================================================
 * Vérifie que loadingStore.hide() masque correctement le modal.
 */
export const TestHide: Story = {
  name: '🧪 Test: Masquage',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Afficher puis masquer
    loadingStore.show('Test de masquage');
    
    // Vérifier l'affichage
    await waitFor(() => {
      expect(canvas.getByText('Test de masquage')).toBeInTheDocument();
    });
    
    // Masquer
    loadingStore.hide();
    
    // Vérifier le masquage
    await waitFor(() => {
      const message = canvas.queryByText('Test de masquage');
      expect(message).not.toBeInTheDocument();
    });
  },
};

/**
 * =====================================================================
 * TEST : Structure du spinner
 * =====================================================================
 * Vérifie que le spinner contient tous les éléments animés.
 */
export const TestSpinnerStructure: Story = {
  name: '🧪 Test: Structure Spinner',
  play: async ({ canvasElement }) => {
    loadingStore.show();
    
    await waitFor(() => {
      // Vérifier les anneaux du spinner
      const rings = canvasElement.querySelectorAll('.spinner-ring');
      expect(rings).toHaveLength(3);
      
      // Vérifier le point central
      const dot = canvasElement.querySelector('.spinner-dot');
      expect(dot).toBeInTheDocument();
    });
  },
};

/**
 * =====================================================================
 * TEST : Overlay couvre l'écran
 * =====================================================================
 * Vérifie que l'overlay occupe tout l'écran.
 */
export const TestOverlayFullscreen: Story = {
  name: '🧪 Test: Overlay Plein Écran',
  play: async ({ canvasElement }) => {
    loadingStore.show();
    
    await waitFor(() => {
      const overlay = canvasElement.querySelector('.loading-overlay');
      expect(overlay).toBeInTheDocument();
      
      // Vérifier les styles de positionnement
      if (overlay) {
        const styles = window.getComputedStyle(overlay);
        expect(styles.position).toBe('fixed');
      }
    });
  },
};

/**
 * =====================================================================
 * TEST : Changement de message
 * =====================================================================
 * Vérifie qu'on peut changer le message sans masquer/réafficher.
 */
export const TestMessageChange: Story = {
  name: '🧪 Test: Changement de Message',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Premier message
    loadingStore.show('Premier message');
    
    await waitFor(() => {
      expect(canvas.getByText('Premier message')).toBeInTheDocument();
    });
    
    // Changer le message
    loadingStore.show('Deuxième message');
    
    await waitFor(() => {
      expect(canvas.getByText('Deuxième message')).toBeInTheDocument();
      expect(canvas.queryByText('Premier message')).not.toBeInTheDocument();
    });
  },
};
