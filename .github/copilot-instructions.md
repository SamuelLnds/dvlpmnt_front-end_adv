# Copilot Instructions – Chat Client PWA

## Architecture Globale

Application **SvelteKit 2 + Svelte 5** (PWA) de chat temps réel avec capture photo et appels WebRTC. Adapter-node pour déploiement serveur (`node build`).

**Stack technique** : SvelteKit 2, Svelte 5, TypeScript, Socket.IO, WebRTC, Vitest (191+ tests, 90%+ coverage)

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
│   │   ├── conference.ts  # Gestion conférences audio WebRTC multi-participants (ConferenceManager)
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
│   │   ├── ConferencePanel.svelte # Interface conférence audio WebRTC
│   │   └── LoadingModal.svelte    # Modal de chargement global
│   └── index.ts      # Barrel exports pour lib/ (tous les modules)
└── routes/           # Pages SvelteKit (file-based routing)
    ├── camera/       # Capture photo locale
    ├── gallery/      # Galerie photos hors-ligne
    ├── reception/    # Lobby / sélection de room
    ├── room/[id]/    # Chat temps réel + conférence audio WebRTC
    └── user/         # Profil utilisateur + géolocalisation
```

### Flux de Données

1. **Authentification** : Profil stocké en `localStorage` (`readProfile()` dans `storage/profile.ts`)
2. **Géolocalisation** : Stockée en `localStorage` (`readLocation()`, `writeLocation()`) avec reverse geocoding via Nominatim
3. **Rooms** : Fetch API externe via `api/rooms.ts` → merge via `utils/merge.ts` → localStorage (`storage/rooms.ts`)
4. **Chat temps réel** : Socket.IO via `getSocket()` singleton (`services/socket.ts`) → événements `message`, `join`, `leave`
5. **Images** : Upload/fetch via `api/images.ts` → utilise `api/client.ts` (`apiFetch<T>()`) → REST API externe
6. **Conférences audio WebRTC** : Signaling via Socket.IO (`peer-signal`), gestion via `ConferenceManager` (`services/conference.ts`)

### Principes de Conception

**Découplage** :
- API HTTP centralisée dans `api/client.ts` avec fonction générique `apiFetch<T>()`
- Services navigateur isolés dans `lib/services/`
- Types partagés définis dans `utils/` (ex: `Room` dans `merge.ts`)
- Ré-exports via barrel files (`lib/index.ts`, `lib/services/index.ts`)

**Testabilité** :
- Fonctions pures dans `utils/` (testables indépendamment)
- 191 tests unitaires (Vitest), 90%+ coverage
- Mocks localStorage via `vi.stubGlobal()` dans les tests

## Système de Conférence Audio WebRTC

### Vue d'ensemble

Le système permet des conférences audio **multi-participants** dans une room de chat. Architecture **mesh P2P** : chaque participant maintient une connexion WebRTC directe avec chaque autre participant de la conférence.

**Fichiers concernés** :
- `services/conference.ts` : `ConferenceManager` - logique de la conférence
- `components/ConferencePanel.svelte` : Interface utilisateur
- `routes/room/[id]/+page.svelte` : Intégration dans la page de chat

### Concepts clés WebRTC

#### Qu'est-ce que WebRTC ?
WebRTC (Web Real-Time Communication) permet la communication audio/vidéo directe entre navigateurs **sans serveur intermédiaire** pour le flux média. Seul le **signaling** (échange d'informations de connexion) passe par le serveur.

#### Comment ça fonctionne ?

1. **Offre SDP (Session Description Protocol)** : L'initiateur crée une "offre" décrivant ses capacités média (codecs audio, etc.)
2. **Réponse SDP** : Le destinataire répond avec ses propres capacités
3. **ICE Candidates** : Échange des chemins réseau possibles pour se connecter

#### Qu'est-ce que ICE ?
**ICE (Interactive Connectivity Establishment)** trouve le meilleur chemin réseau entre deux pairs :
- **STUN** : Découvre l'IP publique derrière un NAT
- **TURN** : Serveur relais si connexion directe impossible (derrière firewall strict)

Notre configuration utilise les serveurs STUN publics de Google :
```typescript
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];
```

### Architecture de signaling

Tout le signaling passe par l'événement Socket.IO **`peer-signal`** (natif au serveur).

**Format du signal** :
```typescript
// Envoyé via socket.emit('peer-signal', { id, signal, roomName })
type ConferenceSignal = {
  signalType: 'webrtc' | 'announcement' | 'state-request' | 'state-response';
  // Pour WebRTC
  conferenceId?: string;
  kind?: 'offer' | 'answer' | 'ice';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  // Pour les annonces
  announcement?: ConferenceAnnouncement;
  // Pour state-request/response
  fromId?: string;
  participants?: string[];
};
```

### Phases de la conférence

```typescript
type ConferencePhase =
  | 'idle'              // Pas de conférence active dans la room
  | 'active_not_joined' // Conférence en cours mais l'utilisateur n'y participe pas
  | 'joining'           // Connexion en cours (micro + connexions peer)
  | 'joined'            // Connecté et participant à la conférence
  | 'leaving'           // Déconnexion en cours
  | 'error';            // Erreur (retour auto à idle ou active_not_joined)
```

### Scénarios détaillés

#### Scénario 1 : Démarrer une nouvelle conférence

```
Utilisateur A (seul dans la room) clique sur "Démarrer conférence"

1. A: phase idle → joining
2. A: Demande accès microphone (getUserMedia)
3. A: Génère un conferenceId unique (conf_roomName_timestamp_random)
4. A: phase joining → joined
5. A: Broadcast "conference-started" à tous les participants de la room
   → socket.emit('peer-signal', { id: B, signal: { signalType: 'announcement', announcement: {...} }, roomName })
   → socket.emit('peer-signal', { id: C, signal: {...}, roomName })
   → (pour chaque participant de roomParticipants)
6. B et C reçoivent le signal et passent en phase "active_not_joined"
```

#### Scénario 2 : Rejoindre une conférence existante

```
Utilisateur B voit "Conférence en cours" et clique sur "Rejoindre"

1. B: phase active_not_joined → joining
2. B: Demande accès microphone
3. B: phase joining → joined (avec le conferenceId existant)
4. B: Broadcast "conference-joined" à tous les participants de la room
5. B: Crée RTCPeerConnection avec chaque participant existant de la conf (ex: A)
   a. B crée une offre SDP
   b. B envoie l'offre à A via peer-signal (signalType: 'webrtc', kind: 'offer')
   c. A reçoit l'offre, crée sa réponse SDP
   d. A envoie la réponse à B via peer-signal (signalType: 'webrtc', kind: 'answer')
   e. Échange de candidats ICE (signalType: 'webrtc', kind: 'ice')
   f. Connexion P2P établie, audio transmis directement
6. A reçoit "conference-joined", met à jour sa liste de participants
```

#### Scénario 3 : Nouvel arrivant dans la room (conférence déjà en cours)

```
Utilisateur D arrive dans la room alors que A, B, C sont en conférence

1. D rejoint la room via Socket.IO (chat-join-room)
2. D reçoit "chat-joined-room" avec éventuellement l'info de conférence
3. DEUX MÉCANISMES de découverte :

   MÉCANISME 1 - Info serveur (si disponible) :
   - Le serveur inclut { conference: { conferenceId, participants } } dans chat-joined-room
   - D appelle conferenceManager.setActiveConference(conferenceId, participants)
   - D passe en phase "active_not_joined"

   MÉCANISME 2 - Découverte client (fallback) :
   - D appelle conferenceManager.requestConferenceState() après 500ms
   - D broadcast un signal "state-request" à tous les participants
   - A (en phase joined) reçoit le state-request
   - A répond avec un signal "state-response" contenant conferenceId et participants
   - D reçoit la réponse et passe en phase "active_not_joined"

   MÉCANISME 3 - Découverte passive :
   - Si quelqu'un rejoint/quitte pendant que D est en room, D reçoit les annonces
   - Les annonces "conference-started", "conference-joined" font passer D en "active_not_joined"
```

#### Scénario 4 : Quitter la conférence

```
Utilisateur B quitte la conférence (A et C restent)

1. B: phase joined → leaving
2. B: Ferme toutes ses RTCPeerConnection
3. B: Libère le stream microphone (stop tracks)
4. B: Broadcast "conference-left" à tous les participants de la room
5. B: phase leaving → active_not_joined (conférence continue avec A et C)
6. A et C reçoivent "conference-left", retirent B de leurs listes
7. A et C ferment leur RTCPeerConnection avec B

IMPORTANT : La conférence continue tant qu'il reste au moins 1 participant
```

#### Scénario 5 : Dernier participant quitte

```
Utilisateur A quitte la conférence (dernier participant)

1. A: phase joined → leaving
2. A: Broadcast "conference-ended" (pas "conference-left")
3. A: phase leaving → idle
4. Tous les autres (qui étaient en active_not_joined) passent en idle
```

#### Scénario 6 : Participant se déconnecte brutalement (ferme l'onglet)

```
Utilisateur B ferme son navigateur sans cliquer "Quitter"

1. Le gestionnaire beforeunload tente de déconnecter proprement
2. Le serveur détecte la déconnexion Socket.IO
3. Le serveur broadcast "chat-disconnected" avec l'id de B
4. Tous les clients reçoivent "chat-disconnected"
5. conferenceManager.removeRoomParticipant(B.id) est appelé
6. B est retiré de la conférence et les RTCPeerConnection sont fermées
```

### Diagramme de séquence - Établissement connexion P2P

```
  A (initiateur)                    Serveur Socket.IO                    B (récepteur)
       |                                   |                                   |
       |------- peer-signal (offer) ------>|                                   |
       |                                   |------- peer-signal (offer) ------>|
       |                                   |                                   |
       |                                   |<------ peer-signal (answer) ------|
       |<------ peer-signal (answer) ------|                                   |
       |                                   |                                   |
       |------- peer-signal (ice) -------->|                                   |
       |                                   |------- peer-signal (ice) -------->|
       |                                   |                                   |
       |                                   |<------ peer-signal (ice) ---------|
       |<------ peer-signal (ice) ---------|                                   |
       |                                   |                                   |
       |<============== Audio P2P directement (sans serveur) ================>|
```

### Points d'attention

#### roomParticipants doit être à jour
Le broadcast des signaux utilise `roomParticipants`. Si cette Map est vide, aucun signal ne sera envoyé !
```typescript
// Dans +page.svelte, après chat-joined-room :
conferenceManager?.updateRoomParticipants(payload.clients);
```

#### Gestion du rechargement de page
Un gestionnaire `beforeunload` déconnecte proprement le socket pour éviter les utilisateurs dupliqués :
```typescript
window.addEventListener('beforeunload', handleBeforeUnload);

function handleBeforeUnload() {
  conferenceManager?.leaveConference();
  conferenceManager?.destroy();
  getSocket().disconnect();
}
```

#### DEBUG - Activer les logs
Dans `conference.ts`, mettre `DEBUG = true` pour voir tous les signaux :
```typescript
const DEBUG = true; // Affiche [Conference] ... dans la console
```

### API du ConferenceManager

```typescript
import { ConferenceManager, type ConferenceState, type ConferenceParticipant } from '$lib/services/conference';

// Création
const manager = new ConferenceManager(socket, roomName, myPseudo, {
  onStateChange: (state: ConferenceState) => { ... },
  onRemoteStream: (peerId: string, stream: MediaStream | null) => { ... },
  onParticipantsChange: (participants: ConferenceParticipant[]) => { ... },
  onAnnouncement: (announcement: ConferenceAnnouncement) => { ... },
  onError: (error: string) => { ... }
});

// Configuration
manager.setMySocketId(socketId);
manager.updateRoomParticipants(clientsRecord);

// Actions
await manager.startOrJoinConference(); // Démarre ou rejoint
manager.leaveConference();              // Quitte
manager.requestConferenceState();       // Demande l'état aux autres

// État
manager.getState();                     // { phase, conferenceId, participants }
manager.getPseudoById(socketId);        // Pseudo d'un participant

// Cleanup
manager.destroy();                      // Nettoie tout (listeners, streams, peers)
```

### Types exportés

```typescript
export type ConferencePhase = 'idle' | 'active_not_joined' | 'joining' | 'joined' | 'leaving' | 'error';

export type ConferenceState = {
  phase: ConferencePhase;
  conferenceId: string | null;
  participants: string[]; // Socket IDs des participants dans la conf
  error?: string;
};

export type ConferenceParticipant = {
  id: string;
  pseudo: string;
  isSelf: boolean;
  inConference: boolean;
};

export type ConferenceAnnouncement = {
  type: 'conference-started' | 'conference-ended' | 'conference-joined' | 'conference-left';
  conferenceId: string;
  participantId: string;
  participantPseudo: string;
  participants: string[];
  timestamp: string;
};
```

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

```tAPI HTTP Pattern

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
  } catch (e) { (SvelteKit + PWA)
npm run start        # Lancer le build (node build)
npm run check        # Vérification TypeScript + Svelte
npm run format       # Prettier write
npm run test         # Lancer les tests Vitest (watch mode)
npm run test -- --run # Tests en mode CI (sans watch)
```

## Tests

**Configuration** (définie dans `api/client.ts`) :
- `API_ORIGIN` : `https://api.tools.gavago.fr`
- `API_BASE` : `${API_ORIGIN}/socketio/api`
- Socket.IO path : `/socket.io`

**Endpoints disponibles** :
- `GET /images/{id}` : Récupérer photo utilisateur (data URL base64)
- `POST /images/` : Upload photo utilisateur
- `GET /rooms` : Index des rooms avec nombre de clients connectés

**Utilisation** :
```typescript
import { apiFetch } from '$lib/api/client';
// Toujours utiliser apiFetch() au lieu de fetch() direct
const response = await apiFetch<ResponseType>('/endpoint');
``
- Tests co-localisés : `*.test.ts` à côté des fichiers sources
- 191 tests unitaires (Vitest), 90%+ coverage
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

**Important** : `re`lib/components/CameraCapture.svelte`) :
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

### Composant ConferencePanel

Gestion des conférences audio WebRTC (`lib/components/ConferencePanel.svelte`) :
- Affiche l'état de la conférence (idle, active_not_joined, joining, joined, etc.)
- Boutons pour démarrer/rejoindre/quitter la conférence
- Liste des participants de la room avec indication de qui est en conférence
- Éléments audio pour les streams distants

**Props** :
```typescript
{
  conferenceState: ConferenceState;
  participants: ConferenceParticipant[];
  remoteStreams: Map<string, MediaStream>;
  onStartOrJoin: () => void;
  onLeave: () => void;
}
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
- `$lib/services/index.ts` : device, socket, conference

## Commandes npm

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

### Composant ConferencePanel

Interface de conférence audio WebRTC ([ConferencePanel.svelte](src/lib/components/ConferencePanel.svelte)) :
- Affiche l'état de la conférence (idle, active_not_joined, joining, joined)
- Boutons pour démarrer/rejoindre/quitter
- Liste des participants avec indication de présence en conférence
- Éléments `<audio>` pour les streams distants

### LoadingModal

Modal de chargement global via store ([LoadingModal.svelte](src/lib/components/LoadingModal.svelte)) :
```typescript
import { loadingStore } from '$lib/stores/loading';
loadingStore.show('Message...');
loadingStore.hide();
```

## Synchronisation automatique des instructions avec le repo (anti-obsolescence)

**Règle impérative** : à chaque fois qu’un changement touche l’arborescence (ajout/suppression de fichier, renommage, déplacement, création de dossier, changement d’exports “barrel”, modification de routes SvelteKit), Copilot doit **mettre à jour ses propres hypothèses** avant de proposer une solution.

### Déclencheurs obligatoires (tu DOIS revalider)
- Fichier ajouté/supprimé/déplacé/renommé dans `src/`
- Nouveau module dans `lib/api/`, `lib/services/`, `lib/storage/`, `lib/utils/`, `lib/components/`, `lib/stores/`
- Changement de routing dans `src/routes/` (nouveau dossier, nouveau `+page.*`, `+layout.*`, `[param]`, etc.)
- Modification de `src/lib/index.ts` ou `src/lib/services/index.ts` (barrel exports)
- Introduction d’un nouveau type partagé (ex: `Room`) ou déplacement de sa “source unique”
- Refactor d'un singleton (ex: `services/socket.ts`) ou d'un manager (ex: `services/conference.ts`)

### Procédure de re-synchronisation (avant toute réponse “définitive”)
1. **Re-lire l’arborescence actuelle** pertinente (au minimum : le dossier concerné + ses imports directs).
2. **Vérifier les exports** : si un import passe par `$lib` ou un barrel, confirmer que l’export existe toujours et pointe vers le bon fichier.
3. **Vérifier la “source de vérité” des types** (ex: `Room`) : ne jamais dupliquer un type si le projet a un emplacement déclaré comme unique.
4. **Comparer avec les instructions** : si divergence, **corriger la solution proposée** pour coller au repo, et **mettre à jour la section “Structure / Conventions”** dans ta réponse (en listant précisément ce qui change : fichier, chemin, export).
5. Si une info manque (ex: tu ne vois pas le repo), tu dois **poser des hypothèses minimales** et **expliciter exactement ce que tu dois vérifier** (fichier(s) et symbole(s)) avant que le changement soit intégré.

### Interdictions anti-dette technique
- Ne jamais inventer un chemin de fichier ou un export “barrel” : si non vérifié, traiter comme **incertain**.
- Ne jamais conserver une instruction obsolète : si un fichier cité n’existe plus, **réécrire** l’instruction avec le nouveau chemin.
- Ne jamais créer un nouveau fichier “types centralisés” si les conventions disent l’inverse.
- Ne jamais contourner `apiFetch()` par `fetch()` direct, sauf exception explicitement justifiée et localisée.

### Sortie attendue après changement de structure
Quand une modification structurelle est détectée, **ta réponse doit inclure** un mini “patch mental” :
- *Nouveaux chemins / fichiers* (liste courte)
- *Imports corrigés* (ce qui change entre ancien et nouveau)
- *Impact sur conventions* (barrel exports, types, storage pattern, etc.)
- *Action de test* à exécuter (ex: `npm run check` + tests ciblés)
