/**
 * ===================================================================
 * Tests d'interaction Storybook - Navbar
 * ===================================================================
 * 
 * Tests automatisés pour le composant Navbar utilisant @storybook/test.
 * Ces tests vérifient les interactions utilisateur et le comportement
 * du composant dans différents scénarios.
 * 
 * COUVERTURE :
 * - Toggle du menu mobile
 * - Toggle du thème
 * - Navigation entre les liens
 * - États d'authentification
 * - Accessibilité (aria attributes)
 * 
 * EXÉCUTION :
 * - Via Storybook UI : onglet "Interactions"
 * - Via CLI : npm run test-storybook
 * ===================================================================
 */

import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, fn, userEvent, within } from 'storybook/test';
import Navbar from './Navbar.svelte';
import type { NavLink } from './Navbar.svelte';

/**
 * Liens de navigation par défaut pour les tests
 */
const defaultLinks: NavLink[] = [
  { href: '/reception', label: 'Réception', requiresAuth: true },
  { href: '/user', label: 'Profil', requiresAuth: true },
  { href: '/camera', label: 'Caméra', requiresAuth: true },
  { href: '/gallery', label: 'Galerie', requiresAuth: true },
];

const meta = {
  title: 'Tests/Navbar',
  component: Navbar,
  tags: ['autodocs'],
  args: {
    links: defaultLinks,
    isSignedIn: true,
    currentPath: '/reception',
    navOpen: false,
    theme: 'dark' as const,
    onToggleNav: fn(),
    onToggleTheme: fn(),
    onNavigate: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
## Tests d'interaction Navbar

Ces stories incluent des tests automatisés qui vérifient :
- Les interactions utilisateur (clics, toggles)
- Le bon fonctionnement des callbacks
- Les attributs d'accessibilité
        `
      }
    }
  },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * =====================================================================
 * TEST : Toggle du menu mobile
 * =====================================================================
 * Vérifie que le clic sur le bouton hamburger appelle onToggleNav
 * et que les attributs aria sont corrects.
 */
export const TestToggleMenu: Story = {
  name: '🧪 Test: Toggle Menu',
  args: {
    navOpen: false,
    onToggleNav: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Trouver le bouton menu (hamburger)
    const menuButton = canvas.getByRole('button', { 
      name: /ouvrir le menu|fermer le menu/i 
    });
    
    // Vérifier l'état initial
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    
    // Simuler un clic
    await userEvent.click(menuButton);
    
    // Vérifier que le callback a été appelé
    expect(args.onToggleNav).toHaveBeenCalledTimes(1);
  },
};

/**
 * =====================================================================
 * TEST : Toggle du thème
 * =====================================================================
 * Vérifie que le clic sur le toggle de thème appelle onToggleTheme
 * et affiche le bon label.
 */
export const TestToggleTheme: Story = {
  name: '🧪 Test: Toggle Thème',
  args: {
    theme: 'dark',
    onToggleTheme: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Trouver le bouton thème
    const themeButton = canvas.getByRole('button', { 
      name: /activer le thème/i 
    });
    
    // Vérifier le label initial (thème sombre)
    expect(canvas.getByText('Sombre')).toBeInTheDocument();
    
    // Simuler un clic
    await userEvent.click(themeButton);
    
    // Vérifier que le callback a été appelé
    expect(args.onToggleTheme).toHaveBeenCalledTimes(1);
  },
};

/**
 * =====================================================================
 * TEST : Highlighting du lien actif
 * =====================================================================
 * Vérifie que le lien correspondant au currentPath a aria-current="page".
 */
export const TestActiveLink: Story = {
  name: '🧪 Test: Lien Actif',
  args: {
    currentPath: '/user',
    isSignedIn: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Trouver le lien "Profil" (/user)
    const userLink = canvas.getByRole('link', { name: /profil/i });
    
    // Vérifier qu'il a aria-current="page"
    expect(userLink).toHaveAttribute('aria-current', 'page');
    
    // Vérifier que les autres liens n'ont pas aria-current
    const receptionLink = canvas.getByRole('link', { name: /réception/i });
    expect(receptionLink).not.toHaveAttribute('aria-current');
  },
};

/**
 * =====================================================================
 * TEST : Liens masqués si non authentifié
 * =====================================================================
 * Vérifie que les liens nécessitant l'authentification sont masqués
 * quand isSignedIn est false.
 */
export const TestUnauthenticated: Story = {
  name: '🧪 Test: Non Authentifié',
  args: {
    isSignedIn: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Vérifier que les liens de navigation ne sont pas présents
    const receptionLink = canvas.queryByRole('link', { name: /réception/i });
    const userLink = canvas.queryByRole('link', { name: /profil/i });
    
    expect(receptionLink).not.toBeInTheDocument();
    expect(userLink).not.toBeInTheDocument();
    
    // Vérifier que le brand est toujours présent
    expect(canvas.getByText('TP PWA')).toBeInTheDocument();
  },
};

/**
 * =====================================================================
 * TEST : Menu mobile ouvert
 * =====================================================================
 * Vérifie le comportement quand le drawer mobile est ouvert.
 */
export const TestMobileMenuOpen: Story = {
  name: '🧪 Test: Menu Mobile Ouvert',
  args: {
    navOpen: true,
    isSignedIn: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Vérifier que le bouton menu indique "Fermer"
    const menuButton = canvas.getByRole('button', { 
      name: /fermer le menu/i 
    });
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    
    // Vérifier que la navigation mobile est présente
    const mobileNav = canvas.getByRole('navigation', { 
      name: /navigation mobile/i 
    });
    expect(mobileNav).toBeInTheDocument();
  },
};

/**
 * =====================================================================
 * TEST : Accessibilité complète
 * =====================================================================
 * Vérifie tous les attributs d'accessibilité du composant.
 */
export const TestAccessibility: Story = {
  name: '🧪 Test: Accessibilité',
  args: {
    isSignedIn: true,
    navOpen: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Vérifier la navigation principale
    const mainNav = canvas.getByRole('navigation', { 
      name: /navigation principale/i 
    });
    expect(mainNav).toBeInTheDocument();
    
    // Vérifier le lien d'accueil
    const homeLink = canvas.getByRole('link', { name: /accueil/i });
    expect(homeLink).toHaveAttribute('href', '/');
    
    // Vérifier que les boutons ont des aria-label
    const buttons = canvas.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveAttribute('aria-label');
    });
  },
};

/**
 * =====================================================================
 * TEST : Navigation via drawer
 * =====================================================================
 * Vérifie que la navigation via le drawer mobile appelle onNavigate.
 */
export const TestDrawerNavigation: Story = {
  name: '🧪 Test: Navigation Drawer',
  args: {
    navOpen: true,
    isSignedIn: true,
    onNavigate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Trouver les liens dans le drawer
    const mobileNav = canvas.getByRole('navigation', { 
      name: /navigation mobile/i 
    });
    const drawerLinks = within(mobileNav).getAllByRole('link');
    
    // Cliquer sur le premier lien
    if (drawerLinks.length > 0) {
      await userEvent.click(drawerLinks[0]);
      
      // Vérifier que onNavigate a été appelé
      expect(args.onNavigate).toHaveBeenCalled();
    }
  },
};
