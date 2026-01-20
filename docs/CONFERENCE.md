# Conférence Audio Multi-Participants

## Vue d'ensemble

Le système de conférence audio permet aux utilisateurs d'une room de chat de démarrer ou rejoindre une conférence audio multi-participants. Contrairement à un système d'appels 1-1, il s'agit d'une conférence "opt-in" où chacun peut entrer et sortir librement.

## Architecture

### Architecture P2P Mesh

Chaque participant maintient une connexion WebRTC directe avec chaque autre participant :

```
         ┌──────────┐
         │ User A   │
         └────┬─────┘
        ┌─────┼─────┐
        │     │     │
   ┌────▼──┐  │  ┌──▼────┐
   │User B │◄─┴─►│User C │
   └───────┘     └───────┘
```

### Signaling via Socket.IO

Le signaling WebRTC passe par l'événement `peer-signal` :

```typescript
type PeerSignalEnvelope = {
  roomName: string;       // Room de chat associée
  conferenceId: string;   // ID unique de la conférence
  fromId: string;         // Socket ID de l'émetteur
  toId: string;           // Socket ID du destinataire
  signal: RTCSignal;      // Payload WebRTC (offer/answer/ice)
  kind: 'offer' | 'answer' | 'ice';
};
```

**Filtrage obligatoire côté client** :
- Ignorer si `fromId === myId` (self)
- Ignorer si `toId !== myId` (pas pour moi)
- Ignorer si `conferenceId` ne correspond pas
- Ignorer si `roomName` ne correspond pas

## Machine à États

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   idle ──────────┬───────────────────► active_not_joined   │
│     ▲            │                           │              │
│     │            │ (start/join)              │ (join)       │
│     │            ▼                           ▼              │
│     │       ┌─────────┐               ┌─────────┐          │
│     │       │ joining │──────────────►│ joined  │          │
│     │       └─────────┘               └────┬────┘          │
│     │            │                         │                │
│     │            │ (error)                 │ (leave)        │
│     │            ▼                         ▼                │
│     │       ┌─────────┐               ┌─────────┐          │
│     └───────┤  error  │◄──────────────┤ leaving │          │
│             └─────────┘               └─────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### États

| État | Description |
|------|-------------|
| `idle` | Pas de conférence active dans la room |
| `active_not_joined` | Une conférence existe mais l'utilisateur n'y participe pas |
| `joining` | Connexion en cours (acquisition micro + setup peers) |
| `joined` | Connecté et actif dans la conférence |
| `leaving` | Déconnexion en cours |
| `error` | Erreur (timeout puis retour à idle/active_not_joined) |

## Événements Socket.IO

### Événements existants utilisés

| Événement | Direction | Usage |
|-----------|-----------|-------|
| `peer-signal` | Bi-directionnel | Transport du signaling WebRTC |
| `chat-joined-room` | Server → Client | Info participants + état conf (si supporté) |
| `chat-disconnected` | Server → Client | Retrait participant |

### Nouveaux événements (côté client)

| Événement | Direction | Usage |
|-----------|-----------|-------|
| `conference-announcement` | Bi-directionnel | Annonces de conférence (start/end/join/leave) |
| `conference-state-request` | Client → Broadcast | Demande d'état pour nouveaux arrivants |
| `conference-state-response` | Client → Client | Réponse avec état de la conférence |

## Gestion des nouveaux arrivants

### Stratégie hybride

1. **Priorité serveur** : Si le serveur renvoie l'état de conférence dans `chat-joined-room`, l'utiliser directement.

2. **Fallback client** : Si le serveur ne conserve pas l'état, demander aux autres clients via `conference-state-request`.

```typescript
// Réception de chat-joined-room
if (payload.conference?.conferenceId) {
  // Le serveur a l'état
  conferenceManager.setActiveConference(payload.conference.conferenceId, payload.conference.participants);
} else {
  // Fallback : demander aux autres
  setTimeout(() => conferenceManager.requestConferenceState(), 500);
}
```

## Edge Cases Gérés

### 1. Deux utilisateurs démarrent en même temps

Le premier `conference-started` reçu devient la référence. Les autres verront "conférence active" et pourront rejoindre.

### 2. Rafraîchissement de page

L'utilisateur reçoit l'état via `chat-joined-room` ou `conference-state-response` et peut re-joindre proprement.

### 3. Déconnexion de participant

- Événement `chat-disconnected` déclenche `removeRoomParticipant()`
- Nettoyage de la connexion peer associée
- Si dernier participant : conférence terminée

### 4. Permission micro refusée

```typescript
try {
  await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  // État passe en 'error'
  // Message utilisateur affiché
  // Retour à l'état précédent après 2s
}
```

### 5. Double join/leave

Actions idempotentes :
- `startOrJoinConference()` : ignoré si déjà `joining` ou `joined`
- `leaveConference()` : ignoré si pas `joined`

### 6. Cleanup strict

```typescript
destroy() {
  // Notifier le départ
  leaveConference();
  // Supprimer les listeners
  socket.off('peer-signal');
  socket.off('conference-announcement');
  // Fermer toutes les connexions peer
  // Arrêter les tracks micro
}
```

## UI/UX

### ConferencePanel

Panneau latéral flottant :
- Badge avec nombre de participants
- Bouton "Démarrer" / "Rejoindre" / "Quitter"
- Liste des participants avec indicateur visuel (cercle animé) pour ceux dans la conférence

### Bandeau de conférence active

Affiché en haut de page quand en conférence :
- Indicateur visuel (icône animée)
- Compteur de participants
- Bouton "Quitter"

### Messages système dans le chat

```
🎙️ Alice a démarré une conférence audio
🎤 Bob a rejoint la conférence (2 participants)
🔇 Alice a quitté la conférence
🔇 La conférence audio est terminée
```

## Fichiers concernés

| Fichier | Description |
|---------|-------------|
| `src/lib/services/conference.ts` | Module ConferenceManager |
| `src/lib/services/conference.test.ts` | Tests unitaires (27 tests) |
| `src/lib/services/index.ts` | Barrel exports mis à jour |
| `src/lib/components/ConferencePanel.svelte` | Composant UI |
| `src/routes/room/[id]/+page.svelte` | Intégration dans la page room |