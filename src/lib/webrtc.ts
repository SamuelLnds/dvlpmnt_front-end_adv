/**
 * Module de gestion des appels WebRTC avec l'API native du navigateur.
 * Gère la signalisation via Socket.IO et le cycle de vie des connexions peer-to-peer.
 */

import type { Socket } from 'socket.io-client';

// Types pour la gestion des participants et de l'état d'appel
export type Participant = {
	id: string;
	pseudo: string;
	isSelf?: boolean;
};

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active';

export type CallState = {
	phase: CallPhase;
	peerId?: string;
	peerPseudo?: string;
};

// Type pour les signaux WebRTC
type SignalData = RTCSessionDescriptionInit | { candidate: RTCIceCandidateInit } | { type: 'reject' } | { type: 'hangup' };

// Configuration des serveurs STUN/TURN pour la traversée NAT
const ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' }
];

/**
 * Gestionnaire d'appels WebRTC utilisant l'API native RTCPeerConnection.
 */
export class CallManager {
	private socket: Socket;
	private roomName: string;
	private myPseudo: string;
	private localStream: MediaStream | null = null;
	private peerConnection: RTCPeerConnection | null = null;
	private pendingCandidates: RTCIceCandidateInit[] = [];
	private pendingOffer: RTCSessionDescriptionInit | null = null;

	// Callbacks pour notifier le composant parent
	private onStateChange: (state: CallState) => void;
	private onRemoteStream: (stream: MediaStream | null) => void;
	private onParticipantsChange: (participants: Participant[]) => void;

	private currentState: CallState = { phase: 'idle' };
	private participants: Participant[] = [];
	private currentTargetId: string | null = null;

	constructor(
		socket: Socket,
		roomName: string,
		myPseudo: string,
		callbacks: {
			onStateChange: (state: CallState) => void;
			onRemoteStream: (stream: MediaStream | null) => void;
			onParticipantsChange: (participants: Participant[]) => void;
		}
	) {
		this.socket = socket;
		this.roomName = roomName;
		this.myPseudo = myPseudo;
		this.onStateChange = callbacks.onStateChange;
		this.onRemoteStream = callbacks.onRemoteStream;
		this.onParticipantsChange = callbacks.onParticipantsChange;

		this.setupSocketListeners();
	}

	/**
	 * Configure les écouteurs Socket.IO pour la signalisation WebRTC.
	 */
	private setupSocketListeners(): void {
		this.socket.on('peer-signal', async (data: { id: string; signal: SignalData; pseudo?: string }) => {
			// Déterminer le type de signal
			const signal = data.signal;
			const isOffer = 'type' in signal && signal.type === 'offer';
			const isAnswer = 'type' in signal && signal.type === 'answer';
			const isCandidate = 'candidate' in signal;
			const isReject = 'type' in signal && signal.type === 'reject';
			const isHangup = 'type' in signal && signal.type === 'hangup';

			// Si on reçoit un rejet ou raccrochage, on termine l'appel
			if (isReject || isHangup) {
				this.cleanupPeer();
				this.updateState({ phase: 'idle' });
				return;
			}

			// Si on reçoit une offre et qu'on n'est pas déjà en appel, c'est un appel entrant
			if (isOffer && this.currentState.phase === 'idle') {
				const callerPseudo = data.pseudo ?? this.findPseudoById(data.id) ?? 'Inconnu';
				this.currentTargetId = data.id;
				
				// Stocker l'offre pour l'appliquer lors de l'acceptation
				if ('type' in signal && signal.type === 'offer') {
					this.pendingOffer = signal;
				}
				
				this.updateState({
					phase: 'incoming',
					peerId: data.id,
					peerPseudo: callerPseudo
				});
				return;
			}

			// Traiter les autres signaux si on a une connexion
			if (this.peerConnection) {
				try {
					if (isAnswer && 'type' in signal) {
						await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
						
						// Appliquer les candidats ICE en attente
						for (const candidate of this.pendingCandidates) {
							await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
						}
						this.pendingCandidates = [];
					} else if (isCandidate && 'candidate' in signal) {
						if (this.peerConnection.remoteDescription && this.peerConnection.localDescription) {
							await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
						} else {
							// Stocker pour plus tard si les descriptions ne sont pas encore définies
							this.pendingCandidates.push(signal.candidate);
						}
					}
				} catch (err) {
					console.error('[WebRTC] Erreur lors du traitement du signal:', err);
				}
			}
		});
	}

	/**
	 * Retrouve le pseudo d'un participant par son ID.
	 */
	private findPseudoById(id: string): string | undefined {
		return this.participants.find((p) => p.id === id)?.pseudo;
	}

	/**
	 * Met à jour la liste des participants de la room.
	 */
	updateParticipants(clients: Record<string, { pseudo?: string }>, mySocketId: string): void {
		this.participants = Object.entries(clients)
			.map(([id, data]) => ({
				id,
				pseudo: data.pseudo ?? 'Inconnu',
				isSelf: id === mySocketId
			}))
			.sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0));
		this.onParticipantsChange(this.participants);
	}

	/**
	 * Supprime un participant déconnecté.
	 */
	removeParticipant(id: string): void {
		this.participants = this.participants.filter((p) => p.id !== id);
		this.onParticipantsChange(this.participants);

		if (this.currentState.peerId === id && this.currentState.phase !== 'idle') {
			this.hangup();
		}
	}

	/**
	 * Récupère le flux audio local (microphone).
	 */
	private async ensureLocalStream(): Promise<MediaStream> {
		if (this.localStream) return this.localStream;

		this.localStream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: false
		});
		return this.localStream;
	}

	/**
	 * Libère les ressources du flux local.
	 */
	private releaseLocalStream(): void {
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => track.stop());
			this.localStream = null;
		}
	}

	/**
	 * Crée une nouvelle RTCPeerConnection.
	 */
	private async createPeerConnection(targetId: string, targetPseudo: string): Promise<void> {
		this.peerConnection = new RTCPeerConnection({
			iceServers: ICE_SERVERS
		});

		// Récupérer le flux audio local
		const stream = await this.ensureLocalStream();
		stream.getTracks().forEach((track) => {
			this.peerConnection?.addTrack(track, stream);
		});

		// Envoi des candidats ICE
		this.peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				this.socket.emit('peer-signal', {
					roomName: this.roomName,
					id: targetId,
					signal: { candidate: event.candidate.toJSON() },
					pseudo: this.myPseudo
				});
			}
		};

		// Réception du flux distant
		this.peerConnection.ontrack = (event) => {
			const [remoteStream] = event.streams;
			this.onRemoteStream(remoteStream);
			this.updateState({
				phase: 'active',
				peerId: targetId,
				peerPseudo: targetPseudo
			});
		};

		// Gestion de l'état de connexion
		this.peerConnection.onconnectionstatechange = () => {
			if (this.peerConnection?.connectionState === 'disconnected' ||
				this.peerConnection?.connectionState === 'failed' ||
				this.peerConnection?.connectionState === 'closed') {
				this.cleanupPeer();
				this.updateState({ phase: 'idle' });
			}
		};
	}

	/**
	 * Initialise un appel vers un participant.
	 */
	async call(target: Participant): Promise<void> {
		if (this.currentState.phase !== 'idle') {
			return;
		}

		this.currentTargetId = target.id;
		this.updateState({
			phase: 'outgoing',
			peerId: target.id,
			peerPseudo: target.pseudo
		});

		// Créer la connexion peer
		await this.createPeerConnection(target.id, target.pseudo);

		// Créer et envoyer l'offre
		if (this.peerConnection) {
			const offer = await this.peerConnection.createOffer();
			await this.peerConnection.setLocalDescription(offer);

			this.socket.emit('peer-signal', {
				roomName: this.roomName,
				id: target.id,
				signal: offer,
				pseudo: this.myPseudo
			});
		}
	}

	/**
	 * Accepte un appel entrant.
	 */
	async acceptCall(): Promise<void> {
		if (this.currentState.phase !== 'incoming' || !this.currentState.peerId || !this.pendingOffer) {
			console.error('[WebRTC] Impossible d\'accepter: état invalide');
			return;
		}

		const peerId = this.currentState.peerId;
		const peerPseudo = this.currentState.peerPseudo ?? '';

		try {
			// Créer la connexion peer maintenant
			await this.createPeerConnection(peerId, peerPseudo);

			if (!this.peerConnection) {
				throw new Error('PeerConnection non créée');
			}

			// Appliquer l'offre stockée
			await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
			this.pendingOffer = null;

			// Créer et envoyer la réponse
			const answer = await this.peerConnection.createAnswer();
			await this.peerConnection.setLocalDescription(answer);

			this.socket.emit('peer-signal', {
				roomName: this.roomName,
				id: peerId,
				signal: answer,
				pseudo: this.myPseudo
			});

			// Appliquer les candidats ICE en attente
			for (const candidate of this.pendingCandidates) {
				try {
					await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
				} catch (err) {
					console.warn('[WebRTC] Erreur lors de l\'ajout d\'un candidat ICE en attente:', err);
				}
			}
			this.pendingCandidates = [];

			// Passer en état actif immédiatement (le flux arrivera via ontrack)
			this.updateState({
				phase: 'active',
				peerId,
				peerPseudo
			});
		} catch (err) {
			console.error('[WebRTC] Erreur lors de l\'acceptation de l\'appel:', err);
			this.cleanupPeer();
			this.updateState({ phase: 'idle' });
		}
	}

	/**
	 * Refuse un appel entrant.
	 */
	rejectCall(): void {
		if (this.currentState.phase !== 'incoming' || !this.currentState.peerId) return;

		const peerId = this.currentState.peerId;

		// Notifier l'appelant que l'appel est refusé
		this.socket.emit('peer-signal', {
			roomName: this.roomName,
			id: peerId,
			signal: { type: 'reject' },
			pseudo: this.myPseudo
		});

		this.cleanupPeer();
		this.updateState({ phase: 'idle' });
	}

	/**
	 * Nettoie les ressources du peer.
	 */
	private cleanupPeer(): void {
		if (this.peerConnection) {
			this.peerConnection.close();
			this.peerConnection = null;
		}
		this.currentTargetId = null;
		this.pendingCandidates = [];
		this.pendingOffer = null;
		this.onRemoteStream(null);
		this.releaseLocalStream();
	}

	/**
	 * Raccroche l'appel en cours.
	 */
	hangup(): void {
		if (this.currentState.phase === 'idle') return;

		const peerId = this.currentState.peerId;

		// Notifier l'autre partie que l'on raccroche
		if (peerId) {
			this.socket.emit('peer-signal', {
				roomName: this.roomName,
				id: peerId,
				signal: { type: 'hangup' },
				pseudo: this.myPseudo
			});
		}

		this.cleanupPeer();
		this.updateState({ phase: 'idle' });
	}

	/**
	 * Met à jour l'état et notifie le composant parent.
	 */
	private updateState(state: CallState): void {
		this.currentState = state;
		this.onStateChange(state);
	}

	/**
	 * Nettoyage complet lors de la destruction du manager.
	 */
	destroy(): void {
		this.hangup();
		this.socket.off('peer-signal');
	}
}
