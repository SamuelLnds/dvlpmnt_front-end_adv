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

// Logger pour le debug - mettre DEBUG à true pour activer les logs détaillés
const DEBUG = false;
function log(...args: unknown[]): void {
	if (DEBUG) console.log('[Conference]', ...args);
}

// Types de signaux envoyés via peer-signal
type SignalType = 'webrtc' | 'announcement' | 'state-request' | 'state-response';

type ConferenceSignal = {
	signalType: SignalType;
	conferenceId?: string;
	// Pour WebRTC
	kind?: 'offer' | 'answer' | 'ice';
	sdp?: string;
	candidate?: RTCIceCandidateInit;
	// Pour les annonces
	announcement?: ConferenceAnnouncement;
	// Pour state-request/response
	fromId?: string;
	participants?: string[];
	toId?: string;
};

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
		// Tout passe par peer-signal : WebRTC, annonces, et demandes d'état
		this.socket.on('peer-signal', (data: { id: string; signal: unknown; roomName: string }) => {
			log('Received peer-signal:', { from: data.id, roomName: data.roomName, signal: data.signal });
			if (data.roomName !== this.roomName) {
				log('Ignoring signal for different room:', data.roomName, '!==', this.roomName);
				return;
			}
			this.handlePeerSignal(data);
		});
	}

	/**
	 * Traite un signal reçu via peer-signal.
	 */
	private handlePeerSignal(data: { id: string; signal: unknown; roomName: string }): void {
		const signal = data.signal as ConferenceSignal;
		const fromId = data.id;

		// Ignorer ses propres signaux
		if (fromId === this.mySocketId) {
			log('Ignoring own signal');
			return;
		}

		log('Processing signal:', signal.signalType, 'from:', fromId, 'current phase:', this.currentState.phase);

		switch (signal.signalType) {
			case 'webrtc':
				this.handleWebRTCSignal(fromId, signal);
				break;
			case 'announcement':
				if (signal.announcement) {
					this.handleConferenceAnnouncement(signal.announcement);
				}
				break;
			case 'state-request':
				this.handleStateRequest(fromId);
				break;
			case 'state-response':
				this.handleStateResponse(signal);
				break;
		}
	}

	/**
	 * Traite un signal WebRTC (offer/answer/ice).
	 */
	private handleWebRTCSignal(fromId: string, signal: ConferenceSignal): void {
		// Vérifier que c'est pour notre conférence
		if (!signal.conferenceId || signal.conferenceId !== this.currentState.conferenceId) return;
		
		// Ne traiter que si on est en phase joined ou joining
		if (this.currentState.phase !== 'joined' && this.currentState.phase !== 'joining') return;

		const kind = signal.kind;

		if (kind === 'offer' && signal.sdp) {
			this.handleOffer(fromId, { type: 'offer', sdp: signal.sdp });
		} else if (kind === 'answer' && signal.sdp) {
			this.handleAnswer(fromId, { type: 'answer', sdp: signal.sdp });
		} else if (kind === 'ice' && signal.candidate) {
			this.handleIceCandidate(fromId, signal.candidate);
		}
	}

	/**
	 * Envoie un signal via peer-signal vers un destinataire spécifique.
	 */
	private sendSignal(toId: string, signal: ConferenceSignal): void {
		log('Sending signal:', signal.signalType, 'to:', toId);
		this.socket.emit('peer-signal', {
			id: toId,
			signal,
			roomName: this.roomName
		});
	}

	/**
	 * Envoie un signal à tous les participants de la room (broadcast manuel).
	 */
	private broadcastSignal(signal: ConferenceSignal): void {
		const recipients = Array.from(this.roomParticipants.keys()).filter(id => id !== this.mySocketId);
		log('Broadcasting signal:', signal.signalType, 'to', recipients.length, 'recipients:', recipients);
		
		if (recipients.length === 0) {
			log('WARNING: No recipients for broadcast! roomParticipants:', Array.from(this.roomParticipants.entries()));
		}
		
		for (const participantId of recipients) {
			this.sendSignal(participantId, signal);
		}
	}

	/**
	 * Envoie un signal WebRTC via peer-signal.
	 */
	private sendPeerSignal(toId: string, kind: 'offer' | 'answer' | 'ice', signalData: RTCSessionDescriptionInit | { candidate: RTCIceCandidateInit }): void {
		if (!this.currentState.conferenceId) return;

		const signal: ConferenceSignal = {
			signalType: 'webrtc',
			conferenceId: this.currentState.conferenceId,
			kind,
			...(kind === 'ice' 
				? { candidate: (signalData as { candidate: RTCIceCandidateInit }).candidate }
				: { sdp: (signalData as RTCSessionDescriptionInit).sdp })
		};

		this.sendSignal(toId, signal);
	}

	/**
	 * Répond à une demande d'état de conférence (si on est dans la conf).
	 */
	private handleStateRequest(fromId: string): void {
		log('State request from:', fromId, 'my phase:', this.currentState.phase);
		if (this.currentState.phase !== 'joined' || !this.currentState.conferenceId) {
			log('Not responding to state request (not joined or no conferenceId)');
			return;
		}

		// On est dans la conférence, répondre avec l'état actuel
		this.sendSignal(fromId, {
			signalType: 'state-response',
			conferenceId: this.currentState.conferenceId,
			participants: this.currentState.participants
		});
	}

	/**
	 * Traite une réponse d'état de conférence.
	 */
	private handleStateResponse(signal: ConferenceSignal): void {
		log('State response received:', { conferenceId: signal.conferenceId, participants: signal.participants });
		if (this.currentState.phase !== 'idle') {
			log('Ignoring state response (not idle, phase:', this.currentState.phase, ')');
			return;
		}
		if (!signal.conferenceId || !signal.participants) {
			log('Ignoring invalid state response');
			return;
		}

		// Une conférence est en cours
		this.updateState({
			phase: 'active_not_joined',
			conferenceId: signal.conferenceId,
			participants: signal.participants
		});
		this.notifyParticipantsChange();
	}

	/**
	 * Demande l'état de la conférence aux autres participants.
	 * À appeler après avoir rejoint la room.
	 */
	requestConferenceState(): void {
		log('requestConferenceState called, phase:', this.currentState.phase, 'mySocketId:', this.mySocketId);
		if (this.currentState.phase !== 'idle') {
			log('Not requesting state (not idle)');
			return;
		}

		log('Broadcasting state-request to room');
		this.broadcastSignal({
			signalType: 'state-request',
			fromId: this.mySocketId
		});
	}

	private handleConferenceAnnouncement(data: ConferenceAnnouncement): void {
		log('Conference announcement received:', data.type, 'conferenceId:', data.conferenceId, 'from:', data.participantId);
		// Notifier le composant parent pour affichage dans le chat
		this.onAnnouncement(data);

		switch (data.type) {
			case 'conference-started':
				log('conference-started: current phase:', this.currentState.phase);
				// Une nouvelle conférence démarre - on peut la voir même si on est déjà active_not_joined
				if (this.currentState.phase === 'idle' || this.currentState.phase === 'active_not_joined') {
					log('Transitioning to active_not_joined for conference:', data.conferenceId);
					this.updateState({
						phase: 'active_not_joined',
						conferenceId: data.conferenceId,
						participants: data.participants
					});
				}
				break;

			case 'conference-ended':
				log('conference-ended: current conferenceId:', this.currentState.conferenceId, 'received:', data.conferenceId);
				// La conférence se termine
				if (this.currentState.conferenceId === data.conferenceId) {
					log('Cleaning up and transitioning to idle');
					this.cleanupAllPeers();
					this.updateState({
						phase: 'idle',
						conferenceId: null,
						participants: []
					});
				}
				break;

			case 'conference-joined':
				log('conference-joined:', data.participantId, 'current conferenceId:', this.currentState.conferenceId);
				// Un participant rejoint
				if (this.currentState.conferenceId === data.conferenceId) {
					const newParticipants = [...new Set([...this.currentState.participants, data.participantId])];
					log('Updated participants:', newParticipants);
					this.updateState({
						...this.currentState,
						participants: newParticipants
					});
					// Si on est dans la conf, établir une connexion avec le nouveau
					if (this.currentState.phase === 'joined' && data.participantId !== this.mySocketId) {
						log('Creating peer connection with new participant:', data.participantId);
						this.createPeerConnection(data.participantId, true);
					}
				} else if (this.currentState.phase === 'idle') {
					// Si on est idle et qu'on reçoit un conference-joined, c'est qu'une conf existe
					log('Discovered conference via conference-joined:', data.conferenceId);
					this.updateState({
						phase: 'active_not_joined',
						conferenceId: data.conferenceId,
						participants: data.participants
					});
				}
				break;

			case 'conference-left':
				log('conference-left:', data.participantId, 'remaining:', data.participants);
				// Un participant quitte
				if (this.currentState.conferenceId === data.conferenceId) {
					const remainingParticipants = this.currentState.participants.filter(
						(p) => p !== data.participantId
					);
					
					// Nettoyer la connexion peer
					this.closePeerConnection(data.participantId);
					
					// La conf se termine uniquement si 0 participant restant (pas moi-même)
					// Si je suis le seul restant ET que je suis dans la conf, je reste joined
					const othersInConf = remainingParticipants.filter(p => p !== this.mySocketId);
					log('Others in conf:', othersInConf.length, 'I am joined:', this.currentState.phase === 'joined');
					
					if (remainingParticipants.length === 0) {
						// Plus personne dans la conf
						log('No participants left, ending conference');
						this.cleanupAllPeers();
						this.updateState({
							phase: 'idle',
							conferenceId: null,
							participants: []
						});
					} else if (remainingParticipants.length === 1 && remainingParticipants[0] === this.mySocketId) {
						// Je suis le seul restant - je reste dans la conf mais seul
						log('I am the only one left, staying in conference');
						this.updateState({
							...this.currentState,
							participants: remainingParticipants
						});
					} else {
						log('Conference continues with', remainingParticipants.length, 'participants');
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
		log('startOrJoinConference called, phase:', this.currentState.phase, 'mySocketId:', this.mySocketId);
		if (this.currentState.phase === 'joined' || this.currentState.phase === 'joining') {
			log('Already in conference or joining, ignoring');
			return; // Déjà dans une conf
		}

		try {
			this.updateState({ ...this.currentState, phase: 'joining' });

			// Récupérer le flux audio local
			await this.ensureLocalStream();

			let conferenceId = this.currentState.conferenceId;
			const isNewConference = !conferenceId;
			log('isNewConference:', isNewConference, 'existing conferenceId:', conferenceId);

			if (isNewConference) {
				// Générer un nouvel ID de conférence
				conferenceId = this.generateConferenceId();
				log('Generated new conferenceId:', conferenceId);
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

			// Annoncer à tous les participants de la room
			const announcement: ConferenceAnnouncement = {
				type: isNewConference ? 'conference-started' : 'conference-joined',
				conferenceId: conferenceId!,
				participantId: this.mySocketId,
				participantPseudo: this.myPseudo,
				participants,
				timestamp: new Date().toISOString()
			};

			log('Broadcasting announcement:', announcement.type, 'participants:', participants);
			this.broadcastSignal({
				signalType: 'announcement',
				announcement
			});

			// Établir les connexions avec les autres participants existants
			log('Establishing peer connections with existing participants:', this.currentState.participants);
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
		log('leaveConference called, phase:', this.currentState.phase);
		if (this.currentState.phase !== 'joined') {
			log('Not in conference, ignoring leave');
			return;
		}

		this.updateState({ ...this.currentState, phase: 'leaving' });

		const conferenceId = this.currentState.conferenceId;
		const remainingParticipants = this.currentState.participants.filter(
			(p) => p !== this.mySocketId
		);
		log('Remaining participants after leave:', remainingParticipants);

		// Annoncer le départ à tous les participants de la room
		const announcement: ConferenceAnnouncement = {
			type: remainingParticipants.length === 0 ? 'conference-ended' : 'conference-left',
			conferenceId: conferenceId!,
			participantId: this.mySocketId,
			participantPseudo: this.myPseudo,
			participants: remainingParticipants,
			timestamp: new Date().toISOString()
		};

		this.broadcastSignal({
			signalType: 'announcement',
			announcement
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
		log('updateRoomParticipants:', Object.keys(clients));
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
				this.sendPeerSignal(peerId, 'ice', { candidate: event.candidate.toJSON() });
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
					this.sendPeerSignal(peerId, 'offer', offer);
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
				this.sendPeerSignal(fromId, 'answer', answer);
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
	}
}
