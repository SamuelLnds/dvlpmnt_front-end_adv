import type { StorybookConfig } from '@storybook/sveltekit';

/**
 * Configuration Storybook pour le projet PWA Chat
 * 
 * Points clés :
 * - Stories co-localisées avec les composants (*.stories.svelte)
 * - Framework SvelteKit avec support natif des alias ($lib)
 * - Addons : accessibilité (a11y), documentation, tests visuels
 */
const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|ts|svelte)'
  ],
  addons: [
    '@storybook/addon-svelte-csf',
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs'
  ],
  framework: '@storybook/sveltekit'
};

export default config;