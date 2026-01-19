# Copilot Instructions – Chat Client PWA

## Architecture Globale

Application **SvelteKit 2 + Svelte 5** (PWA) de chat temps réel avec capture photo et appels WebRTC. Adapter-node pour déploiement serveur (`node build`).

### Structure des Couches

```
src/
├── lib/
│   ├── api/          # Clients HTTP (images.ts, rooms.ts) → API REST externe
│   ├── components/   # Composants réutilisables (Navbar, CameraCapture, Battery, CallPanel, LoadingModal)
│   ├── storage/      # Persistance localStorage (profile, chat, photos, rooms)
│   ├── stores/       # Stores Svelte (loading.ts)
│   ├── socket.ts     # Singleton Socket.IO (getSocket, withSocket, resetSocket)
│   ├── device.ts     # APIs navigateur (vibrate, notifications)
│   └── webrtc.ts     # Gestion des appels WebRTC (CallManager, CallState)
└── routes/           # Pages SvelteKit (file-based routing)
    ├── camera/       # Capture photo locale
    ├── gallery/      # Galerie photos hors-ligne
    ├── reception/    # Lobby / sélection de room
    ├── room/[id]/    # Chat temps réel + appels
    └── user/         # Profil utilisateur + géolocalisation
```

### Flux de Données

1. **Authentification** : Profil stocké en `localStorage` (`readProfile()` dans [storage/profile.ts](src/lib/storage/profile.ts))
2. **Géolocalisation** : Stockée en `localStorage` (`readLocation()`, `writeLocation()`) avec reverse geocoding via Nominatim
3. **Rooms** : Fetch API externe → merge avec données locales → localStorage
4. **Chat temps réel** : Socket.IO via `getSocket()` singleton → événements `message`, `join`, `leave`
5. **Images** : Upload/fetch via REST API (`/socketio/api/images/`)
6. **Appels WebRTC** : Signaling via Socket.IO, gestion via `CallManager`

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

```typescript
import { MapPin, X, Phone, Menu, Sun, Moon } from 'lucide-svelte';
```

Usage dans le template :
```svelte
<MapPin size={16} class="my-icon" aria-hidden="true" />
<X size={14} />
<Phone size={24} stroke-width={2} />
```

Styliser via `:global()` si nécessaire :
```css
:global(.my-icon) {
  color: var(--color-text-muted);
}
```

### Storage Pattern

Toutes les fonctions de stockage suivent ce modèle ([storage/chat.ts](src/lib/storage/chat.ts)) :
```typescript
export const KEY = 'chat.<domain>.v1';
export function read<T>(): T { /* safeParse + validation */ }
export function write<T>(data: T): void { /* try/catch silencieux */ }
```

### Socket.IO

Singleton paresseux dans [socket.ts](src/lib/socket.ts). Toujours utiliser :
```typescript
const socket = getSocket();
socket.connect(); // connexion manuelle (autoConnect: false)
```
Appeler `resetSocket()` au démontage pour nettoyer les listeners.

## Commandes de Développement

```bash
npm run dev          # Serveur dev Vite (HMR)
npm run build        # Build production
npm run start        # Lancer le build (node build)
npm run check        # Vérification TypeScript + Svelte
npm run format       # Prettier write
```

## Points d'Attention

### API Externe

- Base URL hardcodée : `https://api.tools.gavago.fr`
- Endpoints : `/socketio/api/images/`, `/rooms`
- Socket.IO path : `/socket.io`

### PWA

- Service Worker via `@vite-pwa/sveltekit` (config dans [vite.config.ts](vite.config.ts))
- `serviceWorker: { register: false }` dans svelte.config.js (géré par le plugin)
- Icônes requises : `/icons/icon-192.png`, `/icons/icon-512.png`

### CSS

- Variables CSS custom dans [app.css](src/app.css) (thème dark/light)
- Classes utilitaires : `.surface`, `.stack`, `.card`, `.btn`, `.btn--ghost`, `.btn--primary`, `.btn--danger`
- Thème toggle via `document.documentElement.dataset.theme`

### Composant CameraCapture

Interface exposée ([CameraCapture.svelte](src/lib/components/CameraCapture.svelte)) :
```typescript
camRef.open()    // Ouvrir la caméra
camRef.capture() // Capturer un frame
camRef.close()   // Fermer et libérer le stream
camRef.retake()  // Reprendre une nouvelle photo
```

### Composant CallPanel

Gestion des appels WebRTC ([CallPanel.svelte](src/lib/components/CallPanel.svelte)) :
- Affiche la liste des participants
- Modal plein écran pour appels entrants
- Bandeau d'appel actif en haut de page

### LoadingModal

Modal de chargement global via store ([LoadingModal.svelte](src/lib/components/LoadingModal.svelte)) :
```typescript
import { loadingStore } from '$lib/stores/loading';
loadingStore.show('Message...');
loadingStore.hide();
```
