<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Navbar from './Navbar.svelte';

  /**
   * ===================================================================
   * STORIES : Navbar.svelte
   * ===================================================================
   * 
   * Composant de navigation principal de l'application PWA Chat.
   * Gère la navigation desktop/mobile, le toggle de thème et l'état auth.
   * 
   * PROPS :
   * - links: NavLink[]        - Liste des liens de navigation
   * - isSignedIn: boolean     - État d'authentification
   * - currentPath: string     - Chemin courant pour highlighting
   * - navOpen: boolean        - État du drawer mobile
   * - theme: 'dark' | 'light' - Thème actuel
   * 
   * CALLBACKS :
   * - onToggleNav()           - Toggle du menu mobile
   * - onToggleTheme()         - Toggle du thème
   * - onNavigate(href)        - Navigation vers une page
   * ===================================================================
   */

  /** Liens de navigation par défaut */
  const defaultLinks = [
    { href: '/reception', label: 'Réception', requiresAuth: true },
    { href: '/user', label: 'Profil', requiresAuth: true },
    { href: '/camera', label: 'Caméra', requiresAuth: true },
    { href: '/gallery', label: 'Galerie', requiresAuth: true },
  ];

  const { Story } = defineMeta({
    title: 'Composants/Navbar',
    component: Navbar,
    tags: ['autodocs'],
    args: {
      links: defaultLinks,
      isSignedIn: true,
      currentPath: '/reception',
      navOpen: false,
      theme: 'dark',
    },
    argTypes: {
      isSignedIn: {
        description: 'État d\'authentification',
        control: 'boolean',
      },
      currentPath: {
        description: 'Chemin URL actuel',
        control: 'text',
      },
      navOpen: {
        description: 'État du menu mobile',
        control: 'boolean',
      },
      theme: {
        description: 'Thème de l\'application',
        control: 'radio',
        options: ['dark', 'light'],
      },
    },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: 'Barre de navigation avec support responsive et gestion du theme.'
        }
      }
    }
  });
</script>

<!-- Story : Défaut (connecté) -->
<Story name="Défaut (connecté)">
  <Navbar
    links={defaultLinks}
    isSignedIn={true}
    currentPath="/reception"
    navOpen={false}
    theme="dark"
    onToggleNav={() => console.log('Toggle nav')}
    onToggleTheme={() => console.log('Toggle theme')}
    onNavigate={(href) => console.log('Navigate to:', href)}
  />
  <div class="story-content">
    <p>Contenu de la page sous la navbar</p>
  </div>
</Story>

<!-- Story : Non connecté -->
<Story name="Non connecté">
  <Navbar
    links={defaultLinks}
    isSignedIn={false}
    currentPath="/"
    navOpen={false}
    theme="dark"
  />
  <div class="story-content">
    <p><strong>Utilisateur non connecté</strong> - Les liens sont masqués.</p>
  </div>
</Story>

<!-- Story : Menu mobile ouvert -->
<Story name="Menu mobile ouvert">
  <Navbar
    links={defaultLinks}
    isSignedIn={true}
    currentPath="/user"
    navOpen={true}
    theme="dark"
  />
  <div class="story-content">
    <p>Le drawer mobile est ouvert.</p>
  </div>
</Story>

<!-- Story : Thème clair -->
<Story name="Thème clair">
  <Navbar
    links={defaultLinks}
    isSignedIn={true}
    currentPath="/gallery"
    navOpen={false}
    theme="light"
  />
  <div class="story-content story-content--light">
    <p>Page avec le thème clair activé.</p>
  </div>
</Story>

<!-- Story : Highlighting des pages -->
<Story name="Highlighting des pages">
  <div class="story-stack">
    <div class="story-section">
      <span class="story-label">Page: /reception</span>
      <Navbar links={defaultLinks} isSignedIn={true} currentPath="/reception" navOpen={false} theme="dark" />
    </div>
    <div class="story-section">
      <span class="story-label">Page: /user</span>
      <Navbar links={defaultLinks} isSignedIn={true} currentPath="/user" navOpen={false} theme="dark" />
    </div>
    <div class="story-section">
      <span class="story-label">Page: /camera</span>
      <Navbar links={defaultLinks} isSignedIn={true} currentPath="/camera" navOpen={false} theme="dark" />
    </div>
  </div>
</Story>

<!-- Story : Test accessibilité -->
<Story name="Test accessibilité">
  <Navbar
    links={defaultLinks}
    isSignedIn={true}
    currentPath="/reception"
    navOpen={false}
    theme="dark"
  />
  <div class="story-content">
    <h3>Points d'accessibilité vérifiés :</h3>
    <ul class="story-list">
      <li>aria-label sur les boutons (menu, thème)</li>
      <li>aria-current="page" sur le lien actif</li>
      <li>aria-expanded sur le toggle menu</li>
      <li>aria-controls liant le toggle au drawer</li>
      <li>aria-hidden sur les icônes décoratives</li>
    </ul>
    <p class="story-hint">
      Utilisez l'onglet "Accessibility" pour voir le rapport a11y.
    </p>
  </div>
</Story>

<style>
  .story-content {
    padding: 2rem;
    min-height: 300px;
    background: var(--color-bg, #0f0f23);
    color: var(--color-text, #fff);
  }

  .story-content--light {
    background: #f8f9fa;
    color: #212529;
  }

  .story-stack {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    background: var(--color-bg, #0f0f23);
    padding: 1rem;
  }

  .story-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .story-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-left: 0.5rem;
  }

  .story-hint {
    color: var(--color-text-secondary, #888);
    font-style: italic;
    font-size: 0.9rem;
    margin-top: 1rem;
  }

  .story-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
  }

  .story-list li {
    padding: 0.5rem 0;
    font-size: 0.95rem;
  }

  .story-list li::before {
    content: "✅ ";
  }
</style>
