# Chat Client PWA

Application web progressive (PWA) de messagerie **en temps réel** avec **capture photo**, développée avec **SvelteKit 2** et **Svelte 5**.

Démo : https://samuel.landais.angers.mds-project.fr

## Aperçu

- Profil utilisateur (pseudo + avatar)
- Salons (rooms) + chat temps réel via `Socket.IO`
- Envoi d’images (fichier / caméra / galerie)
- Galerie locale (stockage navigateur)
- Géolocalisation + reverse geocoding (Nominatim / OpenStreetMap)
- Thème clair/sombre, batterie, notifications + vibrations
- PWA : installable, mise en cache, fonctionnement partiel hors ligne

## Stack

- SvelteKit 2, Svelte 5, TypeScript
- Socket.IO Client
- Vite
- Vitest (unitaires), Storybook (composants), Playwright (E2E)

## Installation

### Prérequis
- Node.js **20+**
- npm **10+**

### Démarrage
```bash
npm install
npm run dev
```

Application accessible sur : http://localhost:5173

## Scripts (principal)

- `npm run dev` : serveur de développement
- `npm run build` : build de production
- `npm run start` : lance le build
- `npm run check` : vérifs TypeScript + Svelte
- `npm run format` / `npm run lint` : formatage / contrôle
- `npm run test` / `npm run test:run` / `npm run test:coverage` : tests unitaires
- `npm run storybook` / `npm run build-storybook` : Storybook
- `npm run e2e` (+ `:ui`, `:headed`, `:debug`, `:report`) : tests Playwright

## Architecture

Organisation en couches (séparation des responsabilités) :

```
src/
  lib/
    api/        Clients REST (API externe)
    components/ Composants Svelte réutilisables
    services/   Services navigateur (Socket.IO, notifications, vibrations)
    storage/    Persistance via localStorage
    stores/     Stores Svelte
    utils/      Fonctions pures (validation, format, etc.)
  routes/       Pages SvelteKit (routing par fichiers)
```

Conventions clés :
- Connexion Socket.IO en **singleton**
- Utilitaires « purs » dans ```utils/``` (tests plus simples)
- Accès localStorage via fonctions dédiées (read/write/clear)

## API externe

Base REST : `https://api.tools.gavago.fr/socketio/api`

Endpoints :
- `GET /rooms` : liste des rooms + nombre de participants
- `GET /images/{id}` : récupère un avatar (base64)
- `POST /images/` : upload d’un avatar

Socket.IO :
- URL : `https://api.tools.gavago.fr`
- Path : `/socket.io`
- Transports : WebSocket, Polling

## PWA et hors ligne

- Installable sur l’écran d’accueil (mode standalone)
- Service Worker : mise en cache + mise à jour automatique (via `@vite-pwa/sveltekit`)
- Hors ligne (partiel) :
  - profil / préférences / galerie disponibles
  - messages en cache pour lecture
  - reconnexion automatique au retour réseau

## Tests

- **Unitaires (Vitest)** : fonctions pures + modules de stockage / services
- **Composants (Storybook)** : documentation + tests d’interaction
- **E2E (Playwright)** : parcours utilisateur (profil, rooms, chat, caméra, galerie, navigation)

## Déploiement

### Build / serveur
```bash
npm run build
npm run start
# ou
node build
```
Port par défaut : **3000**

### Docker
```bash
docker build -t chat-client .
docker run -p 3000:3000 chat-client
```
Image : Node.js 24 (Debian Bookworm Slim)

### Variables d’environnement

| Variable    | Défaut       | Description        |
|------------|--------------|--------------------|
| `HOST`     | `0.0.0.0`      | Adresse d’écoute   |
| `PORT`     | `3000`         | Port d’écoute      |
| `NODE_ENV` | `production`   | Environnement      |

## Clés localStorage

| Clé                 | Contenu |
|--------------------|---------|
| `chat.profile.v1`  | Profil (pseudo, avatar) |
| `chat.lastRoom.v1` | Dernière room visitée |
| `chat.location.v1` | Géolocalisation |
| `chat.rooms.v1`    | Rooms connues |
| `chat.messages.v1` | Historique messages |
| `camera.photos.v1` | Galerie photos |
| `app-theme`        | Thème (dark/light) |
