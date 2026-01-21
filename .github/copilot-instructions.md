# Copilot Instructions – Chat Client PWA

## Architecture Globale

Application **SvelteKit 2 + Svelte 5** (PWA) de chat temps réel avec capture photo. Adapter-node pour déploiement serveur (`node build`).

**Stack technique** : SvelteKit 2, Svelte 5, TypeScript, Socket.IO, Vitest (tests unitaires), **Storybook 10** (tests de composants), **Playwright** (tests E2E)

### Structure des Couches

```
src/
├── lib/
│   ├── api/          # Clients HTTP pour API REST externe
│   │   ├── client.ts      # Client HTTP générique (apiFetch, API_BASE)
│   │   ├── images.ts      # Upload/fetch d'images utilisateur
│   │   └── rooms.ts       # Index des rooms disponibles
│   ├── services/     # Services navigateur et temps réel
│   │   ├── device.ts      # APIs navigateur (vibrate, notifications)
│   │   ├── socket.ts      # Singleton Socket.IO (getSocket, withSocket, resetSocket)
│   │   ├── battery.ts     # Service centralisé Battery API (subscribeToBattery, getBatteryState)
│   │   └── index.ts       # Barrel exports
│   ├── storage/      # Persistance localStorage
│   │   ├── profile.ts     # Profil utilisateur + géolocalisation
│   │   ├── photos.ts      # Galerie photos locales
│   │   ├── rooms.ts       # Rooms + préférences (source unique type Room)
│   │   └── chat.ts        # Messages + helpers (importe Room depuis rooms.ts)
│   ├── utils/        # Fonctions pures et validations
│   │   ├── index.ts       # Barrel exports utils
│   │   ├── validation.ts  # safeParse, isDataUrl
│   │   ├── format.ts      # formatRoomName
│   │   ├── merge.ts       # mergeRemoteWithStored, type Room
│   │   └── download.ts    # triggerDownload, blobToDataURL, fileToDataURL
│   ├── stores/       # Stores Svelte réactifs
│   │   └── loading.ts     # Store global de chargement
│   ├── components/   # Composants réutilisables + Stories Storybook
│   │   ├── Navbar.svelte              # Navigation + thème toggle
│   │   ├── Navbar.stories.svelte      # Stories Storybook (CSF)
│   │   ├── Navbar.test.stories.ts     # Tests d'interaction Storybook
│   │   ├── CameraCapture.svelte       # Capture photo (API MediaDevices)
│   │   ├── CameraCapture.stories.svelte
│   │   ├── Battery.svelte             # Indicateur batterie
│   │   ├── Battery.stories.svelte
│   │   ├── Battery.test.stories.ts
│   │   ├── LoadingModal.svelte        # Modal de chargement global
│   │   ├── LoadingModal.stories.svelte
│   │   └── LoadingModal.test.stories.ts
│   └── index.ts      # Barrel exports pour lib/ (tous les modules)
├── routes/           # Pages SvelteKit (file-based routing)
│   ├── camera/       # Capture photo locale
│   ├── gallery/      # Galerie photos hors-ligne
│   ├── reception/    # Lobby / sélection de room
│   ├── room/[id]/    # Chat temps réel
│   └── user/         # Profil utilisateur + géolocalisation
└── tests/            # Setup tests Vitest
e2e/                  # Tests E2E Playwright
    ├── fixtures.ts        # Fixtures et helpers partagés
    ├── user.spec.ts       # Tests page profil
    ├── reception.spec.ts  # Tests page réception/lobby
    ├── room.spec.ts       # Tests page chat
    ├── camera.spec.ts     # Tests page caméra
    ├── gallery.spec.ts    # Tests page galerie
    └── navigation.spec.ts # Tests navbar, thème, navigation
.storybook/           # Configuration Storybook
    ├── main.ts       # Config principale (addons, stories pattern)
    └── preview.ts    # Config preview (globals, styles, viewports)
```

### Flux de Données

1. **Authentification** : Profil stocké en `localStorage` (`readProfile()` dans `storage/profile.ts`)
2. **Géolocalisation** : Stockée en `localStorage` (`readLocation()`, `writeLocation()`) avec reverse geocoding via Nominatim
3. **Rooms** : Fetch API externe via `api/rooms.ts` → merge via `utils/merge.ts` → localStorage (`storage/rooms.ts`)
4. **Chat temps réel** : Socket.IO via `getSocket()` singleton (`services/socket.ts`) → événements `message`, `join`, `leave`
5. **Images** : Upload/fetch via `api/images.ts` → utilise `api/client.ts` (`apiFetch<T>()`) → REST API externe

### Principes de Conception

**Découplage** :
- API HTTP centralisée dans `api/client.ts` avec fonction générique `apiFetch<T>()`
- Services navigateur isolés dans `lib/services/`
- Types partagés définis dans `utils/` (ex: `Room` dans `merge.ts`)
- Ré-exports via barrel files (`lib/index.ts`, `lib/services/index.ts`)

**Testabilité** :
- Fonctions pures dans `utils/` (testables indépendamment)
- 144 tests unitaires (Vitest), 99%+ coverage
- Mocks localStorage via `vi.stubGlobal()` dans les tests

**Persistence** :
- Pattern uniforme : `read*()` / `write*()` avec validation via `safeParse()`
- Gestion d'erreurs silencieuse (try/catch avec console.warn)
- Clés versionnées : `chat.<domain>.v1`

## Conventions du Projet

### Svelte 5

- Utiliser `$state()`, `$props()`, `$derived()`, `$effect()` (runes Svelte 5)
- Export des props avec `export let` uniquement pour les composants legacy
- Pattern callback : `export let onEvent: () => void = noop;`

### TypeScript

- Types définis localement dans chaque fichier (pas de fichier types centralisé)
- Guards de type inline : `function isDataUrl(value: unknown): value is string`
- Assertions avec `as` après validation

### Icônes – Lucide Svelte

**IMPORTANT** : Toujours utiliser les composants **lucide-svelte** pour les icônes. Ne jamais utiliser de SVG inline.

### API HTTP Pattern

Client générique dans `api/client.ts` :
```typescript
import { apiFetch, API_BASE, API_ORIGIN } from '$lib/api/client';

// GET request
const response = await apiFetch<DataType>('/endpoint');
if (response.ok) {
  const data = response.data; // type-safe
}

// POST request
const response = await apiFetch<ResponseType>('/endpoint', {
  method: 'POST',
  body: { key: 'value' }
});
```

**Avantages** :
- Typage générique `apiFetch<T>()` pour responses type-safe
- Gestion centralisée des erreurs (status 0 pour erreurs réseau)
- Headers par défaut (Accept, Content-Type)
- Encapsulation de `fetch()` native

### Storage Pattern

Toutes les fonctions de stockage suivent ce modèle (`storage/chat.ts`, `storage/rooms.ts`, etc.) :
```typescript
export const KEY = 'chat.<domain>.v1';

export function read<T>(): T {
  const data = safeParse<T>(localStorage.getItem(KEY), defaultValue);
  // Validation des champs requis
  return data.filter(item => /* validation */);
}

export function write<T>(data: T): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage write failed', e);
  }
}
```

**Conventions** :
- Clés versionnées : `chat.<domain>.v1`, `camera.photos.v1`
- Validation stricte en lecture (filtrage des données invalides)
- Gestion d'erreurs en écriture (QuotaExceededError, etc.)
- Utiliser `safeParse()` de `utils/validation.ts`

### Socket.IO Pattern

Singleton paresseux dans `services/socket.ts`. Toujours utiliser :
```typescript
import { getSocket, resetSocket } from '$lib/services/socket';

const socket = getSocket();
socket.connect(); // connexion manuelle (autoConnect: false)

// Écouter des événements
socket.on('event', (data) => { /* handler */ });

// Nettoyer au démontage du composant
onDestroy(() => {
  resetSocket(); // Supprime tous les listeners et déconnecte
});
```

## Composants Réutilisables

### Composant CameraCapture

Interface exposée (`lib/components/CameraCapture.svelte`) :
```typescript
let camRef: InstanceType<typeof CameraCapture> | null = null;

camRef.open()    // Ouvrir la caméra (MediaDevices API)
camRef.capture() // Capturer un frame (canvas → data URL)
camRef.close()   // Fermer et libérer le stream
camRef.retake()  // Reprendre une nouvelle photo
```

**Usage** :
```svelte
<CameraCapture bind:this={camRef} onCapture={handlePhoto} />
```

### LoadingModal

Modal de chargement global via store (`lib/components/LoadingModal.svelte`) :
```typescript
import { loadingStore } from '$lib/stores/loading';

// Afficher le modal
loadingStore.show('Chargement en cours...');

// Masquer le modal
loadingStore.hide();
```

**Usage pattern** :
```typescript
async function fetchData() {
  loadingStore.show('Récupération des données...');
  try {
    await apiFetch('/endpoint');
  } finally {
    loadingStore.hide(); // Toujours dans finally
  }
}
```

### Battery Service

Service centralisé pour la Battery API (`lib/services/battery.ts`) :
```typescript
import { subscribeToBattery, getBatteryState, isBatterySupported } from '$lib/services/battery';

// S'abonner aux mises à jour (pattern observer)
const unsubscribe = subscribeToBattery((state) => {
  console.log(`Battery: ${state.percent}% ${state.charging ? '(charging)' : ''}`);
});

// Obtenir l'état actuel (synchrone)
const state = getBatteryState();
// state: { supported: boolean, level: number, charging: boolean, percent: number }

// Vérifier le support
if (isBatterySupported()) {
  // API disponible
}

// Nettoyer (dans onDestroy)
unsubscribe();
```

**Avantages** :
- Initialisation automatique au premier subscribe
- Pattern observer pour les mises à jour en temps réel
- Gestion centralisée des listeners (évite les fuites mémoire)
- État partagé entre tous les composants

## Imports et Barrel Exports

**Privilégier les barrel exports** pour des imports propres :

```typescript
// ✅ Bon - Via barrel export
import { getSocket, resetSocket } from '$lib/services';
import { apiFetch, API_BASE } from '$lib/api/client';
import { readProfile, writeProfile } from '$lib/storage/profile';

// ❌ À éviter - Import direct (sauf si nécessaire)
import { getSocket } from '$lib/services/socket';
```

**Fichiers barrel disponibles** :
- `$lib/index.ts` : Tous les exports de lib/
- `$lib/services/index.ts` : device, socket, battery
- `$lib/utils/index.ts` : validation, format, download, merge

## Commandes npm

```bash
npm run dev          # Serveur dev Vite (HMR)
npm run build        # Build production (SvelteKit + PWA)
npm run start        # Lancer le build (node build)
npm run check        # Vérification TypeScript + Svelte
npm run format       # Prettier write
npm run test         # Lancer les tests Vitest (watch mode)
npm run test -- --run # Tests en mode CI (sans watch)
npm run storybook    # Lancer Storybook (port 6006)
npm run build-storybook # Build statique Storybook
npm run e2e          # Lancer les tests E2E Playwright
npm run e2e:ui       # Tests E2E avec interface graphique
npm run e2e:headed   # Tests E2E avec navigateur visible
npm run e2e:debug    # Tests E2E en mode debug
npm run e2e:report   # Voir le rapport HTML des tests
npm run e2e:codegen  # Générer des tests via enregistrement
```

## Tests Unitaires (Vitest)

- Tests co-localisés : `*.test.ts` à côté des fichiers sources
- Setup global dans `src/tests/setup.ts`

**Conventions de test** :
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('nomDuModule', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn()); // Mock fetch si nécessaire
  });

  it('décrit le comportement attendu', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = maFonction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

**Mocks courants** :
- `vi.stubGlobal('localStorage', mockLocalStorage)` pour localStorage
- `vi.mock('socket.io-client')` pour Socket.IO
- `vi.mocked(fetch).mockResolvedValue()` pour fetch

## Tests de Composants (Storybook)

### Structure des Stories

Chaque composant a des fichiers associés :
- `Component.svelte` : Le composant
- `Component.stories.svelte` : Stories CSF (Svelte Component Story Format)
- `Component.test.stories.ts` : Tests d'interaction Storybook

### Conventions de Stories

**Stories visuelles** (`.stories.svelte`) - Format CSF Svelte :
```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MonComposant from './MonComposant.svelte';

  /**
   * Documentation du composant et de ses stories
   */
  const { Story } = defineMeta({
    title: 'Composants/MonComposant',
    component: MonComposant,
    tags: ['autodocs'],
    args: { /* props par défaut */ },
    argTypes: { /* contrôles */ },
  });
</script>

<!-- Story avec nom descriptif -->
<Story name="État par défaut">
  <MonComposant prop="valeur" />
</Story>
```

**Tests d'interaction** (`.test.stories.ts`) :
```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import MonComposant from './MonComposant.svelte';

const meta = {
  title: 'Tests/MonComposant',
  component: MonComposant,
  args: {
    onAction: fn(), // Mock des callbacks
  },
} satisfies Meta<typeof MonComposant>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TestInteraction: Story = {
  name: '🧪 Test: Nom du test',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Trouver un élément
    const button = canvas.getByRole('button', { name: /label/i });
    
    // Simuler une interaction
    await userEvent.click(button);
    
    // Vérifier le résultat
    expect(args.onAction).toHaveBeenCalled();
  },
};
```

### Configuration Storybook

**Fichier `.storybook/main.ts`** :
- Alias `$lib` configuré pour SvelteKit
- Addons : a11y, docs, vitest, svelte-csf

**Fichier `.storybook/preview.ts`** :
- Import des styles globaux (`app.css`)
- Viewports prédéfinis (mobile, tablet, desktop)
- Backgrounds pour thèmes dark/light

### Bonnes Pratiques Stories

1. **Nommer clairement** : `État par défaut`, `Avec erreur`, `Mode mobile`
2. **Documenter** : Blocs `/** ... */` expliquant le comportement testé
3. **Tester l'a11y** : Utiliser l'onglet Accessibility de Storybook
4. **Couvrir les cas** : États normaux, erreurs, edge cases, responsive

## Tests E2E (Playwright)

### Structure des Tests

Tests organisés par fonctionnalité dans `e2e/` :
- `fixtures.ts` : Fixtures partagées et helpers (StorageHelper, authenticatedPage)
- `user.spec.ts` : Tests page profil utilisateur
- `reception.spec.ts` : Tests page réception/lobby
- `room.spec.ts` : Tests page chat temps réel
- `camera.spec.ts` : Tests page caméra
- `gallery.spec.ts` : Tests page galerie
- `navigation.spec.ts` : Tests navbar, thème, navigation globale

### Configuration Playwright

**Fichier `playwright.config.ts`** :
- Navigateurs : Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Serveur dev automatique (`npm run dev`)
- Permissions préaccordées : camera, notifications, geolocation
- Traces et screenshots en cas d'échec

### Fixtures Personnalisées

```typescript
import { test, expect, StorageHelper, TEST_DATA } from './fixtures';

// Fixture pour utilisateur authentifié
test('exemple avec utilisateur connecté', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/reception');
  // L'utilisateur "TestUser" est déjà connecté
});

// Helper pour manipuler le localStorage
test('manipulation du storage', async ({ page }) => {
  const storage = new StorageHelper(page);
  await storage.setProfile('MonPseudo');
  await storage.setPhotos([TEST_DATA.photos.red]);
  const profile = await storage.getProfile();
});
```

### Conventions de Test E2E

```typescript
import { test, expect, StorageHelper, waitForLoadingToFinish } from './fixtures';

test.describe('Ma fonctionnalité', () => {
  test.describe('Sous-catégorie', () => {
    test('décrit le comportement testé', async ({ authenticatedPage }) => {
      // Arrange : préparer l'état
      const storage = new StorageHelper(authenticatedPage);
      await storage.setProfile('TestUser');
      
      // Act : effectuer l'action
      await authenticatedPage.goto('/reception');
      await authenticatedPage.getByRole('button', { name: /rejoindre/i }).click();
      
      // Assert : vérifier le résultat
      await expect(authenticatedPage).toHaveURL(/\/room\//);
    });
  });
});
```

### Clés localStorage (constantes)

```typescript
export const STORAGE_KEYS = {
  PROFILE: 'chat.profile.v1',
  LAST_ROOM: 'chat.lastRoom.v1',
  LOCATION: 'chat.location.v1',
  ROOMS: 'chat.rooms.v1',
  PHOTOS: 'camera.photos.v1',
  THEME: 'app-theme',
};
```

### Helpers Utiles

- `waitForLoadingToFinish(page)` : Attend que le LoadingModal disparaisse
- `TEST_DATA.users` : Profils de test (default, withAvatar)
- `TEST_DATA.rooms` : Rooms de test (general, random, tech)
- `TEST_DATA.photos` : Photos placeholder en base64
- `TEST_DATA.locations` : Positions géographiques (Paris, Lyon)

### Bonnes Pratiques E2E

1. **Utiliser les fixtures** : `authenticatedPage` pour les tests authentifiés
2. **Isoler les tests** : Chaque test doit être indépendant
3. **Préférer les sélecteurs accessibles** : `getByRole()`, `getByLabel()`, `getByText()`
4. **Gérer l'asynchrone** : Utiliser `waitForLoadingToFinish()` après les actions
5. **Documenter les tests** : Blocs `test.describe()` avec descriptions claires
6. **Tester responsive** : `page.setViewportSize()` pour mobile
7. **Gestion des erreurs** : `.catch()` pour les assertions qui peuvent échouer

## Points d'Attention

### API Externe

**Configuration** (définie dans `api/client.ts`) :
- `API_ORIGIN` : `https://api.tools.gavago.fr`
- `API_BASE` : `${API_ORIGIN}/socketio/api`
- Socket.IO path : `/socket.io`

**Endpoints disponibles** :
- `GET /images/{id}` : Récupérer photo utilisateur (data URL base64)
- `POST /images/` : Upload photo utilisateur
- `GET /rooms` : Index des rooms avec nombre de clients connectés

### PWA

- Service Worker via `@vite-pwa/sveltekit` (config dans `vite.config.ts`)
- `serviceWorker: { register: false }` dans svelte.config.js (géré par le plugin)
- Icônes requises : `/icons/icon-192.png`, `/icons/icon-512.png`

### CSS

- Variables CSS custom dans `app.css` (thème dark/light)
- Classes utilitaires : `.surface`, `.stack`, `.card`, `.btn`, `.btn--ghost`, `.btn--primary`, `.btn--danger`
- Thème toggle via `document.documentElement.dataset.theme`

## Synchronisation automatique des instructions avec le repo (anti-obsolescence)

**Règle impérative** : à chaque fois qu'un changement touche l'arborescence (ajout/suppression de fichier, renommage, déplacement, création de dossier, changement d'exports "barrel", modification de routes SvelteKit), Copilot doit **mettre à jour ses propres hypothèses** avant de proposer une solution.

### Déclencheurs obligatoires (tu DOIS revalider)
- Fichier ajouté/supprimé/déplacé/renommé dans `src/`
- Nouveau module dans `lib/api/`, `lib/services/`, `lib/storage/`, `lib/utils/`, `lib/components/`, `lib/stores/`
- Changement de routing dans `src/routes/` (nouveau dossier, nouveau `+page.*`, `+layout.*`, `[param]`, etc.)
- Modification de `src/lib/index.ts` ou `src/lib/services/index.ts` (barrel exports)
- Introduction d'un nouveau type partagé (ex: `Room`) ou déplacement de sa "source unique"
- Refactor d'un singleton (ex: `services/socket.ts`)

### Interdictions anti-dette technique
- Ne jamais inventer un chemin de fichier ou un export "barrel" : si non vérifié, traiter comme **incertain**.
- Ne jamais conserver une instruction obsolète : si un fichier cité n'existe plus, **réécrire** l'instruction avec le nouveau chemin.
- Ne jamais créer un nouveau fichier "types centralisés" si les conventions disent l'inverse.
- Ne jamais contourner `apiFetch()` par `fetch()` direct, sauf exception explicitement justifiée et localisée.
