import type { Preview } from '@storybook/sveltekit';

/**
 * Import des styles globaux de l'application
 * Permet aux stories d'utiliser les variables CSS et classes utilitaires
 */
import '../src/app.css';

/**
 * Configuration globale du preview Storybook
 * 
 * - Matchers automatiques pour les contrôles (color, date)
 * - Backgrounds pour tester les thèmes dark/light
 * - Configuration viewport pour tester le responsive
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    /**
     * Backgrounds prédéfinis correspondant aux thèmes de l'application
     */
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a2e' },
        { name: 'light', value: '#f8f9fa' },
      ],
    },
    /**
     * Viewports prédéfinis pour tester le responsive
     */
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '800px' },
        },
      },
    },
  },
  /**
   * Tags globaux pour les stories
   * - autodocs : génération automatique de la documentation
   */
  tags: ['autodocs'],
};

export default preview;