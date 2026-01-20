/**
 * ===================================================================
 * Tests d'interaction Storybook - Battery
 * ===================================================================
 * 
 * Tests automatisés pour le composant Battery.
 * Note : L'API Battery Status n'est pas disponible dans tous les environnements
 * de test, donc ces tests vérifient principalement le rendu.
 * 
 * COUVERTURE :
 * - Rendu du composant
 * - Fallback quand l'API n'est pas supportée
 * - Structure HTML attendue
 * 
 * EXÉCUTION :
 * - Via Storybook UI : onglet "Interactions"
 * - Via CLI : npm run test-storybook
 * ===================================================================
 */

import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, waitFor, within } from 'storybook/test';
import Battery from './Battery.svelte';

const meta = {
  title: 'Tests/Battery',
  component: Battery,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## Tests d'interaction Battery

Ces stories incluent des tests automatisés qui vérifient :
- Le rendu du composant
- Le fallback si l'API n'est pas supportée
- La structure HTML
        `
      }
    }
  },
} satisfies Meta<typeof Battery>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * =====================================================================
 * TEST : Rendu du composant
 * =====================================================================
 * Vérifie que le composant se rend sans erreur.
 */
export const TestRender: Story = {
  name: '🧪 Test: Rendu',
  play: async ({ canvasElement }) => {
    // Vérifier qu'un élément .battery est présent
    await waitFor(() => {
      const battery = canvasElement.querySelector('.battery');
      expect(battery).toBeInTheDocument();
    });
  },
};

/**
 * =====================================================================
 * TEST : Fallback non supporté
 * =====================================================================
 * Dans les environnements où l'API Battery n'est pas supportée,
 * le composant devrait afficher "Batterie — n/s".
 */
export const TestFallback: Story = {
  name: '🧪 Test: Fallback Non Supporté',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    await waitFor(() => {
      // Le composant affiche soit le niveau de batterie soit le fallback
      const battery = canvasElement.querySelector('.battery');
      expect(battery).toBeInTheDocument();
      
      // Dans un environnement sans API Battery, on devrait voir le fallback
      // ou dans un navigateur supporté, on verra le pourcentage
      const hasPercentage = battery?.textContent?.includes('%');
      const hasFallback = battery?.textContent?.includes('n/s');
      
      // L'un ou l'autre doit être vrai
      expect(hasPercentage || hasFallback).toBe(true);
    }, { timeout: 2000 });
  },
};

/**
 * =====================================================================
 * TEST : Structure avec API supportée
 * =====================================================================
 * Si l'API est supportée, vérifie la structure HTML attendue.
 */
export const TestStructureSupported: Story = {
  name: '🧪 Test: Structure (API supportée)',
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const battery = canvasElement.querySelector('.battery');
      expect(battery).toBeInTheDocument();
      
      // Si l'API est supportée, on devrait avoir l'icône et le texte
      const icon = canvasElement.querySelector('.icon');
      const txt = canvasElement.querySelector('.txt');
      
      // Si supporté, les deux éléments sont présents
      // Si non supporté, on a juste le fallback avec classe .muted
      const isMuted = battery?.classList.contains('muted');
      
      if (!isMuted) {
        expect(icon).toBeInTheDocument();
        expect(txt).toBeInTheDocument();
      }
    }, { timeout: 2000 });
  },
};

/**
 * =====================================================================
 * TEST : Barre de progression
 * =====================================================================
 * Vérifie que la barre de progression est présente si supporté.
 */
export const TestProgressBar: Story = {
  name: '🧪 Test: Barre de Progression',
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const battery = canvasElement.querySelector('.battery');
      const isMuted = battery?.classList.contains('muted');
      
      if (!isMuted) {
        // Si supporté, la barre doit être présente
        const bar = canvasElement.querySelector('.bar');
        expect(bar).toBeInTheDocument();
        
        // Vérifier que le style width est défini
        if (bar) {
          const width = (bar as HTMLElement).style.width;
          expect(width).toMatch(/\d+%/);
        }
      }
    }, { timeout: 2000 });
  },
};

/**
 * =====================================================================
 * TEST : Attribut title
 * =====================================================================
 * Vérifie que l'attribut title contient les informations de batterie.
 */
export const TestTitleAttribute: Story = {
  name: '🧪 Test: Attribut Title',
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const battery = canvasElement.querySelector('.battery');
      expect(battery).toBeInTheDocument();
      
      const title = battery?.getAttribute('title');
      expect(title).toBeTruthy();
      
      // Le title contient soit "Batterie X%" soit "non supporté"
      expect(title).toMatch(/batterie|non supporté/i);
    }, { timeout: 2000 });
  },
};
