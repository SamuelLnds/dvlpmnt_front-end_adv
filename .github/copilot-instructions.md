# Copilot Instructions – Chat Client PWA

## Architecture Globale

Application **SvelteKit 2 + Svelte 5** (PWA) de chat temps réel avec capture photo. Adapter-node pour déploiement serveur (`node build`).

**Stack technique** : SvelteKit 2, Svelte 5, TypeScript, Socket.IO, Vitest (144 tests, 99%+ coverage)

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
│   │   └── index.ts       # Barrel exports
│   ├── storage/      # Persistance localStorage
│   │   ├── profile.ts     # Profil utilisateur + géolocalisation
│   │   ├── photos.ts      # Galerie photos locales
│   │   ├── rooms.ts       # Rooms + préférences (source unique type Room)
│   │   └── chat.ts        # Messages + helpers (importe Room depuis rooms.ts)
│   ├── utils/        # Fonctions pures et validations
│   │   ├── validation.ts  # safeParse, isDataUrl
│   │   ├── format.ts      # formatRoomName
│   │   ├── merge.ts       # mergeRemoteWithStored, type Room
│   │   └── download.ts    # triggerDownload, blobToDataURL, fileToDataURL
│   ├── stores/       # Stores Svelte réactifs
│   │   └── loading.ts     # Store global de chargement
│   ├── components/   # Composants réutilisables
│   │   ├── Navbar.svelte          # Navigation + thème toggle
│   │   ├── CameraCapture.svelte   # Capture photo (API MediaDevices)
│   │   ├── Battery.svelte         # Indicateur batterie
│   │   └── LoadingModal.svelte    # Modal de chargement global
│   └── index.ts      # Barrel exports pour lib/ (tous les modules)
└── routes/           # Pages SvelteKit (file-based routing)
    ├── camera/       # Capture photo locale
    ├── gallery/      # Galerie photos hors-ligne
    ├── reception/    # Lobby / sélection de room
    ├── room/[id]/    # Chat temps réel
    └── user/         # Profil utilisateur + géolocalisation
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
- `$lib/services/index.ts` : device, socket

## Commandes npm

```bash
npm run dev          # Serveur dev Vite (HMR)
npm run build        # Build production (SvelteKit + PWA)
npm run start        # Lancer le build (node build)
npm run check        # Vérification TypeScript + Svelte
npm run format       # Prettier write
npm run test         # Lancer les tests Vitest (watch mode)
npm run test -- --run # Tests en mode CI (sans watch)
```

## Tests

- Tests co-localisés : `*.test.ts` à côté des fichiers sources
- 144 tests unitaires (Vitest), 99%+ coverage
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
