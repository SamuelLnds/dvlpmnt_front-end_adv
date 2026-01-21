# Chat Client PWA

Application web progressive (PWA) de messagerie **en temps réel** avec **capture photo**, développée avec **SvelteKit 2** et **Svelte 5**.

Site en prod : https://samuel.landais.angers.mds-project.fr

## Sommaire

- [Chat Client PWA](#chat-client-pwa)
  - [Sommaire](#sommaire)
  - [Aperçu](#aperçu)
  - [Stack](#stack)
  - [Installation](#installation)
    - [Prérequis](#prérequis)
    - [Démarrage](#démarrage)
  - [Scripts (principal)](#scripts-principal)
  - [Architecture](#architecture)
  - [Fonctionnalités](#fonctionnalités)
    - [Profil utilisateur (/user)](#profil-utilisateur-user)
    - [Chat temps réel (/room/\[id\])](#chat-temps-réel-roomid)
    - [Caméra (/camera)](#caméra-camera)
    - [Galerie (/gallery)](#galerie-gallery)
    - [Lobby (/reception)](#lobby-reception)
    - [Navigation et thème (Navbar)](#navigation-et-thème-navbar)
    - [APIs navigateur](#apis-navigateur)
    - [Fonctionnement hors-ligne](#fonctionnement-hors-ligne)
  - [API externe](#api-externe)
  - [PWA et hors ligne](#pwa-et-hors-ligne)
  - [Tests](#tests)
  - [Déploiement](#déploiement)
    - [Build / serveur](#build--serveur)
    - [Docker](#docker)
    - [Variables d’environnement](#variables-denvironnement)
  - [Clés localStorage](#clés-localstorage)

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

## Fonctionnalités

### Profil utilisateur ([/user](src/routes/user/+page.svelte))
- **Pseudo et avatar** : Configuration du profil avec pseudo obligatoire et avatar optionnel
- **Sources avatar** : Fichier local, capture caméra, ou galerie hors-ligne
- **Géolocalisation** : Activation optionnelle via `navigator.geolocation`
  - Reverse geocoding via API Nominatim (OpenStreetMap)
  - Stockage local (ville, pays, coordonnées)
  - Utilisée pour partage de position dans le chat

### Chat temps réel ([/room/[id]](src/routes/room/[id]/+page.svelte))
- **Messagerie** : Envoi/réception de messages texte via Socket.IO
- **Images** : Partage d'images (fichier, caméra, galerie)
- **Participants** : Liste en temps réel des utilisateurs connectés
- **Avatars** : Synchronisation automatique via API REST externe
- **Partage batterie** : Bouton conditionnel (si API supportée) partageant niveau + état de charge
- **Partage géolocalisation** : Bouton conditionnel (si activée) partageant ville/pays
- **Notifications** : Alerte + vibration sur nouveau message
- **Responsive** : Boutons desktop + menu déroulant mobile (<960px)
- **Persistance** : Historique des messages stocké localement par room

### Caméra ([/camera](src/routes/camera/+page.svelte))
- **Capture photo** : MediaDevices API (`getUserMedia`) pour accès webcam
- **Stockage local** : Photos sauvegardées automatiquement dans la galerie hors-ligne
- **Actions** : Téléchargement ou suppression de la dernière capture
- **Notifications** : Feedback visuel + vibration à chaque action

### Galerie ([/gallery](src/routes/gallery/+page.svelte))
- **Consultation hors-ligne** : Visualisation de toutes les photos capturées
- **Recherche** : Filtrage par date/heure de capture
- **Actions** : Téléchargement ou suppression individuelle
- **Limitation** : Maximum 100 photos stockées (FIFO)

### Lobby ([/reception](src/routes/reception/+page.svelte))
- **Liste des rooms** : Fetch API externe (`/rooms`) avec nombre de participants
- **Room personnalisée** : Création dynamique via formulaire
- **Room protégée** : Lorsqu'une room est marquée privée (visible avec une icône), elle peut être accédée que via mot de passe
- **Dernière room** : Mémorisation pour reconnexion rapide
- **Synchronisation** : Merge entre rooms distantes et locales

### Navigation et thème ([Navbar](src/lib/components/Navbar.svelte))
- **Toggle thème** : Bascule dark/light avec persistance localStorage
- **Préférence système** : Détection automatique `prefers-color-scheme`
- **Indicateur batterie** : Composant [Battery.svelte](src/lib/components/Battery.svelte) dans navbar
  - Battery Status API via service centralisé ([battery.ts](src/lib/services/battery.ts))
  - Mise à jour en temps réel (niveau + charge)
  - Fallback si API non supportée
- **Menu responsive** : Desktop horizontal + mobile drawer

### APIs navigateur

| API | Fichier | Usage |
|-----|---------|-------|
| **Geolocation** | [routes/user](src/routes/user/+page.svelte) | Capture position GPS + reverse geocoding |
| **MediaDevices** | [routes/camera](src/routes/camera/+page.svelte), [CameraCapture](src/lib/components/CameraCapture.svelte) | Accès webcam pour capture photo |
| **Battery Status** | [services/battery.ts](src/lib/services/battery.ts) | Niveau batterie + état de charge |
| **Notification** | [services/device.ts](src/lib/services/device.ts) | Notifications push avec permission |
| **Vibration** | [services/device.ts](src/lib/services/device.ts) | Feedback haptique |
| **Service Worker** | [vite.config.ts](vite.config.ts) | Mise en cache PWA (via @vite-pwa/sveltekit) |
| **localStorage** | [storage/*](src/lib/storage/) | Persistance profil, messages, photos, rooms |

### Fonctionnement hors-ligne
- **Galerie photos** : Consultation et gestion complète sans réseau
- **Profil** : Modification locale avec resynchronisation au retour réseau
- **Historique messages** : Lecture des messages en cache par room
- **Service Worker** : Mise en cache des assets statiques (HTML, CSS, JS)
- **Reconnexion auto** : Socket.IO reconnecte automatiquement au retour réseau

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
