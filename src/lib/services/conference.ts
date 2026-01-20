/**
 * Module de gestion des conférences audio multi-participants.
 * Architecture mesh P2P avec signaling via Socket.IO.
 */

import type { Socket } from 'socket.io-client';

// ============================================================================
// TYPES
// ============================================================================

export type ConferencePhase =
	| 'idle' // Pas de conférence active
	| 'active_not_joined' // Conférence active mais pas rejoint
	| 'joining' // En cours de connexion (micro + peers)
	| 'joined' // Connecté à la conférence
	| 'leaving' // Déconnexion en cours
	| 'error'; // Erreur (retour à idle ou active_not_joined)

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

export type PeerSignalEnvelope = {
	roomName: string;
	conferenceId: string;
	fromId: string;
	toId: string;
	signal: RTCSessionDescriptionInit | { candidate: RTCIceCandidateInit };
	kind: 'offer' | 'answer' | 'ice';
};

export type ConferenceAnnouncement = {
	type: 'conference-started' | 'conference-ended' | 'conference-joined' | 'conference-left';
	conferenceId: string;
	participantId: string;
	participantPseudo: string;
	participants: string[];
	timestamp: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

// Les ICE servers sont des serveurs publics de Google qui permettent le P2P
const ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' }
];

// ============================================================================
// CONFERENCE MANAGER
// ============================================================================

/**
 * Gestionnaire de conférence audio multi-participants
 * Chaque participant maintient une RTCPeerConnection avec chaque autre participant
 */
export class ConferenceManager {
	private socket: Socket;
	private roomName: string;
	private myPseudo: string;
	private mySocketId: string = '';

	// État de la conférence
	private currentState: ConferenceState = {
		phase: 'idle',
		conferenceId: null,
		participants: []
	};

	// Gestion des peers P2P (mesh)
	private peers: Map<string, RTCPeerConnection> = new Map();
	private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
	private localStream: MediaStream | null = null;

	// Participants de la room (pas forcément dans la conf)
	private roomParticipants: Map<string, { pseudo: string }> = new Map();

	// Callbacks vers le composant parent
	private onStateChange: (state: ConferenceState) => void;
	private onRemoteStream: (peerId: string, stream: MediaStream | null) => void;
	private onParticipantsChange: (participants: ConferenceParticipant[]) => void;
	private onAnnouncement: (announcement: ConferenceAnnouncement) => void;
	private onError: (error: string) => void;

	constructor(
		socket: Socket,
		roomName: string,
		myPseudo: string,
		callbacks: {
			onStateChange: (state: ConferenceState) => void;
			onRemoteStream: (peerId: string, stream: MediaStream | null) => void;
			onParticipantsChange: (participants: ConferenceParticipant[]) => void;
			onAnnouncement: (announcement: ConferenceAnnouncement) => void;
			onError: (error: string) => void;
		}
	) {
		this.socket = socket;
		this.roomName = roomName;
		this.myPseudo = myPseudo;
		this.onStateChange = callbacks.onStateChange;
		this.onRemoteStream = callbacks.onRemoteStream;
		this.onParticipantsChange = callbacks.onParticipantsChange;
		this.onAnnouncement = callbacks.onAnnouncement;
		this.onError = callbacks.onError;

		this.setupSocketListeners();
	}

	/**
	 * Définit l'ID socket de l'utilisateur local.
	 */
	setMySocketId(id: string): void {
		this.mySocketId = id;
	}

	/**
	 * Retourne l'état actuel de la conférence.
	 */
	getState(): ConferenceState {
		return { ...this.currentState };
	}

	// ============================================================================
	// SOCKET LISTENERS
	// ============================================================================

	private setupSocketListeners(): void {
		// Signaling WebRTC
		this.socket.on('peer-signal', (data: PeerSignalEnvelope) => {
			this.handlePeerSignal(data);
		});

		// Annonces de conférence
		this.socket.on('conference-announcement', (data: ConferenceAnnouncement) => {
			this.handleConferenceAnnouncement(data);
		});

		// Requête d'état de conférence (pour les nouveaux arrivants)
		this.socket.on('conference-state-request', (data: { fromId: string; roomName: string }) => {
			this.handleStateRequest(data);
		});

		// Réponse d'état de conférence
		this.socket.on('conference-state-response', (data: { conferenceId: string; participants: string[]; roomName: string }) => {
			this.handleStateResponse(data);
		});
	}

	/**
	 * Répond à une demande d'état de conférence (si on est dans la conf).
	 */
	private handleStateRequest(data: { fromId: string; roomName: string }): void {
		if (data.roomName !== this.roomName) return;
		if (this.currentState.phase !== 'joined' || !this.currentState.conferenceId) return;

		// On est dans la conférence, répondre avec l'état actuel
		this.socket.emit('conference-state-response', {
			roomName: this.roomName,
			conferenceId: this.currentState.conferenceId,
			participants: this.currentState.participants,
			toId: data.fromId
		});
	}

	/**
	 * Traite une réponse d'état de conférence.
	 */
	private handleStateResponse(data: { conferenceId: string; participants: string[]; roomName: string }): void {
		if (data.roomName !== this.roomName) return;
		if (this.currentState.phase !== 'idle') return; // On a déjà l'info

		// Une conférence est en cours
		this.updateState({
			phase: 'active_not_joined',
			conferenceId: data.conferenceId,
			participants: data.participants
		});
		this.notifyParticipantsChange();
	}

	/**
	 * Demande l'état de la conférence aux autres participants.
	 * À appeler après avoir rejoint la room.
	 */
	requestConferenceState(): void {
		if (this.currentState.phase !== 'idle') return;

		this.socket.emit('conference-state-request', {
			fromId: this.mySocketId,
			roomName: this.roomName
		});
	}

	private handlePeerSignal(data: PeerSignalEnvelope): void {
		// Filtrage strict des signaux
		if (!this.mySocketId) return;
		if (data.fromId === this.mySocketId) return; // Ignorer ses propres signaux
		if (data.toId !== this.mySocketId) return; // Pas pour moi
		if (data.roomName !== this.roomName) return; // Mauvaise room
		if (data.conferenceId !== this.currentState.conferenceId) return; // Mauvaise conf

		// Ne traiter que si on est en phase joined ou joining
		if (this.currentState.phase !== 'joined' && this.currentState.phase !== 'joining') {
			return;
		}

		const { fromId, signal, kind } = data;

		if (kind === 'offer') {
			this.handleOffer(fromId, signal as RTCSessionDescriptionInit);
		} else if (kind === 'answer') {
			this.handleAnswer(fromId, signal as RTCSessionDescriptionInit);
		} else if (kind === 'ice') {
			this.handleIceCandidate(fromId, (signal as { candidate: RTCIceCandidateInit }).candidate);
		}
	}

	private handleConferenceAnnouncement(data: ConferenceAnnouncement): void {
		// Notifier le composant parent pour affichage dans le chat
		this.onAnnouncement(data);

		switch (data.type) {
			case 'conference-started':
				// Une nouvelle conférence démarre
				if (this.currentState.phase === 'idle') {
					this.updateState({
						phase: 'active_not_joined',
						conferenceId: data.conferenceId,
						participants: data.participants
					});
				}
				break;

			case 'conference-ended':
				// La conférence se termine
				if (this.currentState.conferenceId === data.conferenceId) {
					this.cleanupAllPeers();
					this.updateState({
						phase: 'idle',
						conferenceId: null,
						participants: []
					});
				}
				break;

			case 'conference-joined':
				// Un participant rejoint
				if (this.currentState.conferenceId === data.conferenceId) {
					const newParticipants = [...new Set([...this.currentState.participants, data.participantId])];
					this.updateState({
						...this.currentState,
						participants: newParticipants
					});
					// Si on est dans la conf, établir une connexion avec le nouveau
					if (this.currentState.phase === 'joined' && data.participantId !== this.mySocketId) {
						this.createPeerConnection(data.participantId, true);
					}
				}
				break;

			case 'conference-left':
				// Un participant quitte
				if (this.currentState.conferenceId === data.conferenceId) {
					const remainingParticipants = this.currentState.participants.filter(
						(p) => p !== data.participantId
					);
					
					// Nettoyer la connexion peer
					this.closePeerConnection(data.participantId);
					
					// Si plus aucun participant (hors moi), la conf est terminée
					if (remainingParticipants.length === 0 || 
						(remainingParticipants.length === 1 && remainingParticipants[0] === this.mySocketId)) {
						this.cleanupAllPeers();
						this.updateState({
							phase: 'idle',
							conferenceId: null,
							participants: []
						});
					} else {
						this.updateState({
							...this.currentState,
							participants: remainingParticipants
						});
					}
				}
				break;
		}

		this.notifyParticipantsChange();
	}

	// ============================================================================
	// ACTIONS PUBLIQUES
	// ============================================================================

	/**
	 * Démarre une nouvelle conférence ou rejoint une existante.
	 */
	async startOrJoinConference(): Promise<void> {
		if (this.currentState.phase === 'joined' || this.currentState.phase === 'joining') {
			return; // Déjà dans une conf
		}

		try {
			this.updateState({ ...this.currentState, phase: 'joining' });

			// Récupérer le flux audio local
			await this.ensureLocalStream();

			let conferenceId = this.currentState.conferenceId;
			const isNewConference = !conferenceId;

			if (isNewConference) {
				// Générer un nouvel ID de conférence
				conferenceId = this.generateConferenceId();
			}

			// Mettre à jour l'état
			const participants = [...this.currentState.participants];
			if (!participants.includes(this.mySocketId)) {
				participants.push(this.mySocketId);
			}

			this.updateState({
				phase: 'joined',
				conferenceId,
				participants
			});

			// Annoncer dans le chat
			const announcement: ConferenceAnnouncement = {
				type: isNewConference ? 'conference-started' : 'conference-joined',
				conferenceId: conferenceId!,
				participantId: this.mySocketId,
				participantPseudo: this.myPseudo,
				participants,
				timestamp: new Date().toISOString()
			};

			this.socket.emit('conference-announcement', {
				roomName: this.roomName,
				...announcement
			});

			// Établir les connexions avec les autres participants existants
			for (const participantId of this.currentState.participants) {
				if (participantId !== this.mySocketId && !this.peers.has(participantId)) {
					await this.createPeerConnection(participantId, true);
				}
			}

			this.notifyParticipantsChange();
		} catch (error) {
			console.error('[Conference] Erreur lors de la connexion:', error);
			this.updateState({
				phase: 'error',
				conferenceId: this.currentState.conferenceId,
				participants: this.currentState.participants,
				error: error instanceof Error ? error.message : 'Erreur de connexion'
			});
			this.onError(error instanceof Error ? error.message : 'Impossible de rejoindre la conférence');
			
			// Revenir à l'état précédent après un délai
			setTimeout(() => {
				if (this.currentState.phase === 'error') {
					this.updateState({
						phase: this.currentState.conferenceId ? 'active_not_joined' : 'idle',
						conferenceId: this.currentState.conferenceId,
						participants: this.currentState.participants.filter((p) => p !== this.mySocketId)
					});
				}
			}, 2000);
		}
	}

	/**
	 * Quitte la conférence en cours.
	 */
	leaveConference(): void {
		if (this.currentState.phase !== 'joined') {
			return;
		}

		this.updateState({ ...this.currentState, phase: 'leaving' });

		const conferenceId = this.currentState.conferenceId;
		const remainingParticipants = this.currentState.participants.filter(
			(p) => p !== this.mySocketId
		);

		// Annoncer le départ
		const announcement: ConferenceAnnouncement = {
			type: remainingParticipants.length === 0 ? 'conference-ended' : 'conference-left',
			conferenceId: conferenceId!,
			participantId: this.mySocketId,
			participantPseudo: this.myPseudo,
			participants: remainingParticipants,
			timestamp: new Date().toISOString()
		};

		this.socket.emit('conference-announcement', {
			roomName: this.roomName,
			...announcement
		});

		// Nettoyer
		this.cleanupAllPeers();

		// Nouvel état
		if (remainingParticipants.length > 0) {
			this.updateState({
				phase: 'active_not_joined',
				conferenceId,
				participants: remainingParticipants
			});
		} else {
			this.updateState({
				phase: 'idle',
				conferenceId: null,
				participants: []
			});
		}

		this.notifyParticipantsChange();
	}

	/**
	 * Met à jour la liste des participants de la room.
	 */
	updateRoomParticipants(clients: Record<string, { pseudo?: string }>): void {
		this.roomParticipants.clear();
		for (const [id, data] of Object.entries(clients)) {
			this.roomParticipants.set(id, { pseudo: data.pseudo ?? 'Inconnu' });
		}
		this.notifyParticipantsChange();
	}

	/**
	 * Retire un participant déconnecté.
	 */
	removeRoomParticipant(id: string): void {
		this.roomParticipants.delete(id);
		
		// Si dans la conférence, nettoyer sa connexion peer
		if (this.currentState.participants.includes(id)) {
			this.closePeerConnection(id);
			const newParticipants = this.currentState.participants.filter((p) => p !== id);
			this.updateState({
				...this.currentState,
				participants: newParticipants
			});
		}
		
		this.notifyParticipantsChange();
	}

	/**
	 * Informe le manager qu'une conférence est en cours (pour les nouveaux arrivants).
	 */
	setActiveConference(conferenceId: string, participants: string[]): void {
		if (this.currentState.phase === 'idle') {
			this.updateState({
				phase: 'active_not_joined',
				conferenceId,
				participants
			});
			this.notifyParticipantsChange();
		}
	}

	// ============================================================================
	// WEBRTC P2P MESH
	// ============================================================================

	private async ensureLocalStream(): Promise<MediaStream> {
		if (this.localStream) return this.localStream;

		try {
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});
			return this.localStream;
		} catch (error) {
			throw new Error('Impossible d\'accéder au microphone. Vérifiez les permissions.');
		}
	}

	private releaseLocalStream(): void {
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => track.stop());
			this.localStream = null;
		}
	}

	private async createPeerConnection(peerId: string, initiator: boolean): Promise<void> {
		if (this.peers.has(peerId)) {
			return; // Connexion déjà existante
		}

		const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
		this.peers.set(peerId, pc);

		// Ajouter le flux audio local
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => {
				pc.addTrack(track, this.localStream!);
			});
		}

		// Gestion des candidats ICE
		pc.onicecandidate = (event) => {
			if (event.candidate && this.currentState.conferenceId) {
				const signal: PeerSignalEnvelope = {
					roomName: this.roomName,
					conferenceId: this.currentState.conferenceId,
					fromId: this.mySocketId,
					toId: peerId,
					signal: { candidate: event.candidate.toJSON() },
					kind: 'ice'
				};
				this.socket.emit('peer-signal', signal);
			}
		};

		// Réception du flux distant
		pc.ontrack = (event) => {
			const [remoteStream] = event.streams;
			this.onRemoteStream(peerId, remoteStream);
		};

		// Gestion de l'état de connexion
		pc.onconnectionstatechange = () => {
			if (
				pc.connectionState === 'disconnected' ||
				pc.connectionState === 'failed' ||
				pc.connectionState === 'closed'
			) {
				this.closePeerConnection(peerId);
			}
		};

		// Si initiateur, créer et envoyer l'offre
		if (initiator) {
			try {
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);

				if (this.currentState.conferenceId) {
					const signal: PeerSignalEnvelope = {
						roomName: this.roomName,
						conferenceId: this.currentState.conferenceId,
						fromId: this.mySocketId,
						toId: peerId,
						signal: offer,
						kind: 'offer'
					};
					this.socket.emit('peer-signal', signal);
				}
			} catch (error) {
				console.error('[Conference] Erreur création offre:', error);
				this.closePeerConnection(peerId);
			}
		}
	}

	private async handleOffer(fromId: string, offer: RTCSessionDescriptionInit): Promise<void> {
		// Créer la connexion si elle n'existe pas (non-initiateur)
		if (!this.peers.has(fromId)) {
			await this.createPeerConnection(fromId, false);
		}

		const pc = this.peers.get(fromId);
		if (!pc) return;

		try {
			await pc.setRemoteDescription(new RTCSessionDescription(offer));

			// Appliquer les candidats ICE en attente
			const pending = this.pendingCandidates.get(fromId) ?? [];
			for (const candidate of pending) {
				await pc.addIceCandidate(new RTCIceCandidate(candidate));
			}
			this.pendingCandidates.delete(fromId);

			// Créer et envoyer la réponse
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			if (this.currentState.conferenceId) {
				const signal: PeerSignalEnvelope = {
					roomName: this.roomName,
					conferenceId: this.currentState.conferenceId,
					fromId: this.mySocketId,
					toId: fromId,
					signal: answer,
					kind: 'answer'
				};
				this.socket.emit('peer-signal', signal);
			}
		} catch (error) {
			console.error('[Conference] Erreur traitement offre:', error);
		}
	}

	private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit): Promise<void> {
		const pc = this.peers.get(fromId);
		if (!pc) return;

		try {
			await pc.setRemoteDescription(new RTCSessionDescription(answer));

			// Appliquer les candidats ICE en attente
			const pending = this.pendingCandidates.get(fromId) ?? [];
			for (const candidate of pending) {
				await pc.addIceCandidate(new RTCIceCandidate(candidate));
			}
			this.pendingCandidates.delete(fromId);
		} catch (error) {
			console.error('[Conference] Erreur traitement réponse:', error);
		}
	}

	private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): Promise<void> {
		const pc = this.peers.get(fromId);

		if (pc && pc.remoteDescription && pc.localDescription) {
			try {
				await pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (error) {
				console.error('[Conference] Erreur ajout ICE candidate:', error);
			}
		} else {
			// Stocker pour plus tard
			const pending = this.pendingCandidates.get(fromId) ?? [];
			pending.push(candidate);
			this.pendingCandidates.set(fromId, pending);
		}
	}

	private closePeerConnection(peerId: string): void {
		const pc = this.peers.get(peerId);
		if (pc) {
			pc.close();
			this.peers.delete(peerId);
		}
		this.pendingCandidates.delete(peerId);
		this.onRemoteStream(peerId, null);
	}

	private cleanupAllPeers(): void {
		for (const [peerId] of this.peers) {
			this.closePeerConnection(peerId);
		}
		this.releaseLocalStream();
	}

	// ============================================================================
	// HELPERS
	// ============================================================================

	private generateConferenceId(): string {
		return `conf_${this.roomName}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
	}

	private updateState(state: ConferenceState): void {
		this.currentState = state;
		this.onStateChange(state);
	}

	private notifyParticipantsChange(): void {
		const participants: ConferenceParticipant[] = [];

		for (const [id, data] of this.roomParticipants) {
			participants.push({
				id,
				pseudo: data.pseudo,
				isSelf: id === this.mySocketId,
				inConference: this.currentState.participants.includes(id)
			});
		}

		// Trier : soi-même en premier, puis ceux dans la conf, puis les autres
		participants.sort((a, b) => {
			if (a.isSelf) return -1;
			if (b.isSelf) return 1;
			if (a.inConference && !b.inConference) return -1;
			if (!a.inConference && b.inConference) return 1;
			return a.pseudo.localeCompare(b.pseudo);
		});

		this.onParticipantsChange(participants);
	}

	/**
	 * Retourne le pseudo d'un participant par son ID.
	 */
	getPseudoById(id: string): string {
		return this.roomParticipants.get(id)?.pseudo ?? 'Inconnu';
	}

	/**
	 * Nettoyage complet lors de la destruction du manager.
	 */
	destroy(): void {
		this.leaveConference();
		this.socket.off('peer-signal');
		this.socket.off('conference-announcement');
	}
}
