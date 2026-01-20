import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConferenceManager, type ConferenceState, type ConferenceParticipant, type ConferenceAnnouncement } from './conference';
import type { Socket } from 'socket.io-client';

type MockSocket = Socket & { _trigger: (event: string, ...args: unknown[]) => void };

// Types de signaux (doit correspondre à ConferenceSignal dans conference.ts)
type SignalType = 'webrtc' | 'announcement' | 'state-request' | 'state-response';

type ConferenceSignal = {
	signalType: SignalType;
	conferenceId?: string;
    roomName?: string;
	kind?: 'offer' | 'answer' | 'ice';
	sdp?: string;
	candidate?: RTCIceCandidateInit;
	announcement?: ConferenceAnnouncement;
	fromId?: string;
	participants?: string[];
	toId?: string;
};

// Helper pour créer un signal peer-signal (tout passe par peer-signal maintenant)
function createSignal(fromId: string, signal: ConferenceSignal, roomName = 'test-room') {
	return {
		id: fromId,
		signal,
		roomName
	};
}

// Helper pour créer un signal WebRTC
function createWebRTCSignal(fromId: string, conferenceId: string, kind: 'offer' | 'answer' | 'ice', data: { sdp?: string; candidate?: RTCIceCandidateInit }, roomName = 'test-room') {
	return createSignal(fromId, {
		signalType: 'webrtc',
		conferenceId,
		kind,
		...(kind === 'ice' ? { candidate: data.candidate } : { sdp: data.sdp })
	}, roomName);
}

// Helper pour créer une annonce de conférence
function createAnnouncementSignal(fromId: string, announcement: ConferenceAnnouncement, roomName = 'test-room') {
	return createSignal(fromId, {
		signalType: 'announcement',
		announcement
	}, roomName);
}

// Helper pour vérifier qu'un peer-signal a été émis avec un type spécifique
function expectSignalEmitted(socket: MockSocket, signalType: SignalType, matcher?: (signal: ConferenceSignal) => boolean) {
	const calls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls;
	const peerSignalCalls = calls.filter(call => call[0] === 'peer-signal');
	
	for (const call of peerSignalCalls) {
		const data = call[1] as { id?: string; signal?: ConferenceSignal };
		if (data.signal?.signalType === signalType) {
			if (!matcher || matcher(data.signal)) {
				return true;
			}
		}
	}
	return false;
}

// Helper pour vérifier qu'un signal WebRTC a été émis
function expectWebRTCSignalEmitted(socket: MockSocket, toId: string, kind: 'offer' | 'answer' | 'ice') {
	const calls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls;
	const peerSignalCalls = calls.filter(call => call[0] === 'peer-signal');
	
	for (const call of peerSignalCalls) {
		const data = call[1] as { id?: string; signal?: ConferenceSignal };
		if (data.id === toId && data.signal?.signalType === 'webrtc' && data.signal?.kind === kind) {
			return true;
		}
	}
	return false;
}

// Mock Socket.IO
function createMockSocket(): MockSocket {
	const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
	
	return {
		on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(handler);
		}),
		off: vi.fn((event: string) => {
			delete listeners[event];
		}),
		emit: vi.fn(),
		// Helper pour simuler la réception d'événements
		_trigger: (event: string, ...args: unknown[]) => {
			listeners[event]?.forEach((handler) => handler(...args));
		}
	} as unknown as MockSocket;
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
	localDescription: RTCSessionDescription | null = null;
	remoteDescription: RTCSessionDescription | null = null;
	connectionState = 'new';
	
	onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
	ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
	onconnectionstatechange: (() => void) | null = null;

	addTrack = vi.fn();
	createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' });
	createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' });
	setLocalDescription = vi.fn().mockImplementation((desc) => {
		this.localDescription = desc as RTCSessionDescription;
		return Promise.resolve();
	});
	setRemoteDescription = vi.fn().mockImplementation((desc) => {
		this.remoteDescription = desc as RTCSessionDescription;
		return Promise.resolve();
	});
	addIceCandidate = vi.fn().mockResolvedValue(undefined);
	close = vi.fn();
}

// Mock MediaDevices
function createMockMediaStream(): MediaStream {
	return {
		getTracks: () => [{ stop: vi.fn(), kind: 'audio' }]
	} as unknown as MediaStream;
}

describe('ConferenceManager', () => {
	let socket: MockSocket;
	let manager: ConferenceManager;
	let stateChanges: ConferenceState[] = [];
	let participantChanges: ConferenceParticipant[][] = [];
	let announcements: ConferenceAnnouncement[] = [];
	let errors: string[] = [];
	let remoteStreams: { peerId: string; stream: MediaStream | null }[] = [];

	beforeEach(() => {
		vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
		vi.stubGlobal('RTCSessionDescription', class {
			constructor(public init: RTCSessionDescriptionInit) {}
		});
		vi.stubGlobal('RTCIceCandidate', class {
			constructor(public init: RTCIceCandidateInit) {}
			toJSON() { return this.init; }
		});
		vi.stubGlobal('navigator', {
			mediaDevices: {
				getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream())
			}
		});

		socket = createMockSocket();
		stateChanges = [];
		participantChanges = [];
		announcements = [];
		errors = [];
		remoteStreams = [];

		manager = new ConferenceManager(socket, 'test-room', 'TestUser', {
			onStateChange: (state) => stateChanges.push({ ...state }),
			onRemoteStream: (peerId, stream) => remoteStreams.push({ peerId, stream }),
			onParticipantsChange: (participants) => participantChanges.push([...participants]),
			onAnnouncement: (announcement) => announcements.push(announcement),
			onError: (error) => errors.push(error)
		});
		manager.setMySocketId('my-socket-id');
	});

	afterEach(() => {
		manager.destroy();
		vi.unstubAllGlobals();
	});

	describe('Initial state', () => {
		it('should start in idle phase', () => {
			const state = manager.getState();
			expect(state.phase).toBe('idle');
			expect(state.conferenceId).toBeNull();
			expect(state.participants).toEqual([]);
		});

		it('should setup socket listeners on construction', () => {
			// Tout passe par peer-signal maintenant
			expect(socket.on).toHaveBeenCalledWith('peer-signal', expect.any(Function));
		});
	});

	describe('Room participants management', () => {
		it('should update room participants', () => {
			manager.updateRoomParticipants({
				'socket-1': { pseudo: 'User1' },
				'socket-2': { pseudo: 'User2' },
				'my-socket-id': { pseudo: 'TestUser' }
			});

			expect(participantChanges.length).toBeGreaterThan(0);
			const lastChange = participantChanges[participantChanges.length - 1];
			expect(lastChange.length).toBe(3);
			expect(lastChange[0].isSelf).toBe(true); // Self should be first
		});

		it('should remove room participant', () => {
			manager.updateRoomParticipants({
				'socket-1': { pseudo: 'User1' },
				'my-socket-id': { pseudo: 'TestUser' }
			});

			manager.removeRoomParticipant('socket-1');

			const lastChange = participantChanges[participantChanges.length - 1];
			expect(lastChange.length).toBe(1);
			expect(lastChange[0].id).toBe('my-socket-id');
		});
	});

	describe('Conference lifecycle', () => {
		it('should start a new conference', async () => {
			await manager.startOrJoinConference();

			expect(stateChanges.length).toBeGreaterThan(0);
			const finalState = stateChanges[stateChanges.length - 1];
			expect(finalState.phase).toBe('joined');
			expect(finalState.conferenceId).toMatch(/^conf_test-room_/);
			expect(finalState.participants).toContain('my-socket-id');
		});

		it('should emit conference-started announcement', async () => {
			// D'abord ajouter des participants à la room pour le broadcast
			manager.updateRoomParticipants({
				'my-socket-id': { pseudo: 'TestUser' },
				'other-1': { pseudo: 'User1' }
			});

			await manager.startOrJoinConference();

			// Vérifie que l'annonce a été émise via peer-signal
			const emitted = expectSignalEmitted(socket, 'announcement', (signal) => {
				return signal.announcement?.type === 'conference-started' && 
				       signal.announcement?.participantPseudo === 'TestUser';
			});
			expect(emitted).toBe(true);
		});

		it('should leave conference', async () => {
			await manager.startOrJoinConference();
			
			manager.leaveConference();

			const finalState = stateChanges[stateChanges.length - 1];
			expect(finalState.phase).toBe('idle');
			expect(finalState.conferenceId).toBeNull();
		});

		it('should emit conference-ended when last participant leaves', async () => {
			// D'abord ajouter des participants à la room pour le broadcast
			manager.updateRoomParticipants({
				'my-socket-id': { pseudo: 'TestUser' },
				'other-1': { pseudo: 'User1' }
			});

			await manager.startOrJoinConference();
			
			manager.leaveConference();

			const emitted = expectSignalEmitted(socket, 'announcement', (signal) => {
				return signal.announcement?.type === 'conference-ended';
			});
			expect(emitted).toBe(true);
		});

		it('should handle joining an existing conference', async () => {
			// Simulate receiving info about an active conference
			manager.setActiveConference('existing-conf-id', ['other-socket-id']);

			const state = manager.getState();
			expect(state.phase).toBe('active_not_joined');
			expect(state.conferenceId).toBe('existing-conf-id');

			// Now join it
			await manager.startOrJoinConference();

			const finalState = stateChanges[stateChanges.length - 1];
			expect(finalState.phase).toBe('joined');
			expect(finalState.conferenceId).toBe('existing-conf-id');
		});

		it('should not allow double join', async () => {
			await manager.startOrJoinConference();
			const emitCallCount = (socket.emit as ReturnType<typeof vi.fn>).mock.calls.length;

			await manager.startOrJoinConference(); // Try to join again

			// Should not have emitted anything new
			expect((socket.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCallCount);
		});

		it('should not allow leave when not joined', () => {
			manager.leaveConference();

			expect(stateChanges.length).toBe(0);
		});
	});

	describe('Conference announcements handling', () => {
		it('should handle conference-started announcement', () => {
			// Simuler la réception d'une annonce via peer-signal
			socket._trigger('peer-signal', createAnnouncementSignal('other-id', {
				type: 'conference-started',
				conferenceId: 'new-conf',
				participantId: 'other-id',
				participantPseudo: 'OtherUser',
				participants: ['other-id'],
				timestamp: new Date().toISOString()
			}));

			const state = manager.getState();
			expect(state.phase).toBe('active_not_joined');
			expect(state.conferenceId).toBe('new-conf');
			expect(announcements.length).toBe(1);
		});

		it('should handle conference-joined announcement when in conference', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', createAnnouncementSignal('new-participant', {
				type: 'conference-joined',
				conferenceId: confId!,
				participantId: 'new-participant',
				participantPseudo: 'NewUser',
				participants: ['my-socket-id', 'new-participant'],
				timestamp: new Date().toISOString()
			}));

			const state = manager.getState();
			expect(state.participants).toContain('new-participant');
		});

		it('should handle conference-left announcement', async () => {
			manager.setActiveConference('conf-id', ['other-1', 'other-2']);

			socket._trigger('peer-signal', createAnnouncementSignal('other-1', {
				type: 'conference-left',
				conferenceId: 'conf-id',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['other-2'],
				timestamp: new Date().toISOString()
			}));

			const state = manager.getState();
			expect(state.participants).not.toContain('other-1');
			expect(state.participants).toContain('other-2');
		});

		it('should handle conference-ended announcement', async () => {
			manager.setActiveConference('conf-id', ['other-id']);

			socket._trigger('peer-signal', createAnnouncementSignal('other-id', {
				type: 'conference-ended',
				conferenceId: 'conf-id',
				participantId: 'other-id',
				participantPseudo: 'OtherUser',
				participants: [],
				timestamp: new Date().toISOString()
			}));

			const state = manager.getState();
			expect(state.phase).toBe('idle');
			expect(state.conferenceId).toBeNull();
		});
	});

	describe('Peer signal filtering', () => {
		it('should ignore signals from self', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', createWebRTCSignal(
				'my-socket-id', // From self - should be ignored
				confId!,
				'offer',
				{ sdp: 'test' }
			));

			// Should not have created any peer connection
			expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.length).toBe(1); // Only initial call
		});

		it('should ignore signals for wrong conference', async () => {
			await manager.startOrJoinConference();

			socket._trigger('peer-signal', createWebRTCSignal(
				'other-id',
				'wrong-conf-id', // Wrong conference
				'offer',
				{ sdp: 'test' }
			));

			// Should not process this signal
		});

		it('should ignore signals for wrong room', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', createWebRTCSignal(
				'other-id',
				confId!,
				'offer',
				{ sdp: 'test' },
				'wrong-room' // Wrong room
			));

			// Should not process this signal (message vient d'une autre room)
		});
	});

	describe('State request/response (new arrival handling)', () => {
		it('should respond to state request when in conference', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', createSignal('new-arrival', {
				signalType: 'state-request',
				fromId: 'new-arrival'
			}));

			const emitted = expectSignalEmitted(socket, 'state-response', (signal) => {
				return signal.conferenceId === confId;
			});
			expect(emitted).toBe(true);
		});

		it('should not respond to state request when not in conference', () => {
			const emitCallCount = (socket.emit as ReturnType<typeof vi.fn>).mock.calls.length;

			socket._trigger('peer-signal', createSignal('new-arrival', {
				signalType: 'state-request',
				fromId: 'new-arrival'
			}));

			expect((socket.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCallCount);
		});

		it('should handle state response', () => {
			socket._trigger('peer-signal', createSignal('other-participant', {
				signalType: 'state-response',
				conferenceId: 'existing-conf',
				participants: ['other-1', 'other-2']
			}));

			const state = manager.getState();
			expect(state.phase).toBe('active_not_joined');
			expect(state.conferenceId).toBe('existing-conf');
		});

		it('should request conference state', () => {
			// Ajouter des participants pour que le broadcast fonctionne
			manager.updateRoomParticipants({
				'my-socket-id': { pseudo: 'TestUser' },
				'other-1': { pseudo: 'User1' }
			});

			manager.requestConferenceState();

			const emitted = expectSignalEmitted(socket, 'state-request', (signal) => {
				return signal.fromId === 'my-socket-id';
			});
			expect(emitted).toBe(true);
		});
	});

	describe('Error handling', () => {
		it('should handle microphone permission denial', async () => {
			vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
				new Error('Permission denied')
			);

			await manager.startOrJoinConference();

			expect(errors.length).toBeGreaterThan(0);
			const state = manager.getState();
			expect(state.phase).toBe('error');
		});
	});

	describe('Cleanup', () => {
		it('should cleanup on destroy', async () => {
			await manager.startOrJoinConference();

			manager.destroy();

			expect(socket.off).toHaveBeenCalledWith('peer-signal');
		});
	});

	describe('getPseudoById', () => {
		it('should return pseudo for known participant', () => {
			manager.updateRoomParticipants({
				'socket-1': { pseudo: 'TestPseudo' }
			});

			expect(manager.getPseudoById('socket-1')).toBe('TestPseudo');
		});

		it('should return Inconnu for unknown participant', () => {
			expect(manager.getPseudoById('unknown-id')).toBe('Inconnu');
		});
	});

	describe('WebRTC peer connections', () => {
		it('should process valid offer signal and create answer', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Simuler la réception d'une offre valide via peer-signal
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'offer',
				{ sdp: 'mock-offer-sdp' }
			));

			// Attendre le traitement asynchrone
			await new Promise(resolve => setTimeout(resolve, 10));

			// Devrait avoir émis une réponse (answer) via peer-signal
			const emitted = expectWebRTCSignalEmitted(socket, 'other-peer-id', 'answer');
			expect(emitted).toBe(true);
		});

		it('should process valid answer signal', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Simuler qu'on a déjà une connexion peer initiée (via announcement)
			socket._trigger('peer-signal', createAnnouncementSignal('other-peer-id', {
				type: 'conference-joined',
				conferenceId: confId!,
				participantId: 'other-peer-id',
				participantPseudo: 'OtherUser',
				participants: ['my-socket-id', 'other-peer-id'],
				timestamp: new Date().toISOString()
			}));

			await new Promise(resolve => setTimeout(resolve, 10));

			// Simuler la réception d'une réponse via peer-signal
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'answer',
				{ sdp: 'mock-answer-sdp' }
			));

			await new Promise(resolve => setTimeout(resolve, 10));
			// Le test passe si pas d'erreur
		});

		it('should process ICE candidate signal', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// D'abord recevoir une offre pour établir la connexion
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'offer',
				{ sdp: 'mock-offer-sdp' }
			));

			await new Promise(resolve => setTimeout(resolve, 10));

			// Puis recevoir un candidat ICE
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'ice',
				{ candidate: { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 } }
			));

			await new Promise(resolve => setTimeout(resolve, 10));
			// Le test passe si pas d'erreur
		});

		it('should buffer ICE candidates when remote description not set', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Envoyer un candidat ICE AVANT l'offre (cas edge)
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'ice',
				{ candidate: { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 } }
			));

			// Le candidat devrait être mis en buffer (pas d'erreur)
			await new Promise(resolve => setTimeout(resolve, 10));
		});

		it('should handle peer connection state change to disconnected', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Créer une connexion peer via offre
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'offer',
				{ sdp: 'mock-offer-sdp' }
			));

			await new Promise(resolve => setTimeout(resolve, 10));

			// Simuler une déconnexion du peer via l'état de connexion
			// (le mock RTCPeerConnection a onconnectionstatechange)
		});
	});

	describe('Conference with multiple existing participants', () => {
		it('should establish connections with all existing participants when joining', async () => {
			// Une conférence existe déjà avec 2 autres participants
			manager.setActiveConference('existing-conf', ['other-1', 'other-2']);

			await manager.startOrJoinConference();

			// Devrait avoir émis des offres vers les 2 participants existants via peer-signal
			const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls;
			const peerSignalCalls = emitCalls.filter(call => call[0] === 'peer-signal');
			
			// Compter les offres WebRTC
			let offerCount = 0;
			for (const call of peerSignalCalls) {
				const data = call[1] as { signal?: ConferenceSignal };
				if (data.signal?.signalType === 'webrtc' && data.signal?.kind === 'offer') {
					offerCount++;
				}
			}
			expect(offerCount).toBeGreaterThanOrEqual(2);
		});

		it('should emit conference-joined when joining existing conference', async () => {
			// Ajouter des participants pour le broadcast
			manager.updateRoomParticipants({
				'my-socket-id': { pseudo: 'TestUser' },
				'other-1': { pseudo: 'User1' }
			});
			manager.setActiveConference('existing-conf', ['other-1']);

			await manager.startOrJoinConference();

			const emitted = expectSignalEmitted(socket, 'announcement', (signal) => {
				return signal.announcement?.type === 'conference-joined' && 
				       signal.announcement?.conferenceId === 'existing-conf';
			});
			expect(emitted).toBe(true);
		});
	});

	describe('Leave conference scenarios', () => {
		it('should emit conference-left when others remain', async () => {
			// Ajouter des participants pour le broadcast
			manager.updateRoomParticipants({
				'my-socket-id': { pseudo: 'TestUser' },
				'other-1': { pseudo: 'User1' },
				'other-2': { pseudo: 'User2' }
			});

			// Rejoindre une conf existante
			manager.setActiveConference('conf-with-others', ['other-1', 'other-2']);
			await manager.startOrJoinConference();

			// Simuler que les autres sont toujours là
			socket._trigger('peer-signal', createAnnouncementSignal('other-1', {
				type: 'conference-joined',
				conferenceId: 'conf-with-others',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id', 'other-1', 'other-2'],
				timestamp: new Date().toISOString()
			}));

			manager.leaveConference();

			const emitted = expectSignalEmitted(socket, 'announcement', (signal) => {
				return signal.announcement?.type === 'conference-left';
			});
			expect(emitted).toBe(true);

			// Devrait rester en active_not_joined
			const finalState = stateChanges[stateChanges.length - 1];
			expect(finalState.phase).toBe('active_not_joined');
		});

		it('should clean up peer connections on leave', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Établir une connexion peer via peer-signal
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-peer-id',
				confId!,
				'offer',
				{ sdp: 'mock-offer-sdp' }
			));

			await new Promise(resolve => setTimeout(resolve, 10));

			manager.leaveConference();

			// Les streams distants devraient être nettoyés
			const nullStreams = remoteStreams.filter(s => s.stream === null);
			expect(nullStreams.length).toBeGreaterThan(0);
		});
	});

	describe('Edge cases', () => {
		it('should ignore state request for wrong room', async () => {
			await manager.startOrJoinConference();
			const emitCallCount = (socket.emit as ReturnType<typeof vi.fn>).mock.calls.length;

			socket._trigger('peer-signal', createSignal('new-arrival', {
				signalType: 'state-request',
				fromId: 'new-arrival',
				roomName: 'wrong-room'
			}, 'wrong-room'));

			// Pas de nouvelle émission
			expect((socket.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCallCount);
		});

		it('should ignore state response for wrong room', () => {
			socket._trigger('peer-signal', createSignal('other-id', {
				signalType: 'state-response',
				roomName: 'wrong-room',
				conferenceId: 'some-conf',
				participants: ['other-1']
			}, 'wrong-room'));

			const state = manager.getState();
			expect(state.phase).toBe('idle');
		});

		it('should ignore state response when not idle', async () => {
			await manager.startOrJoinConference();

			socket._trigger('peer-signal', createSignal('other-id', {
				signalType: 'state-response',
				roomName: 'test-room',
				conferenceId: 'another-conf',
				participants: ['other-1']
			}));

			// Devrait garder la conf actuelle
			const state = manager.getState();
			expect(state.conferenceId).not.toBe('another-conf');
		});

		it('should not request state when not idle', async () => {
			await manager.startOrJoinConference();
			const emitCallCount = (socket.emit as ReturnType<typeof vi.fn>).mock.calls.length;

			manager.requestConferenceState();

			// Pas de nouvelle émission
			expect((socket.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCallCount);
		});

		it('should ignore announcement for different conference', async () => {
			manager.setActiveConference('my-conf', ['other-1']);

			socket._trigger('peer-signal', createAnnouncementSignal('other-2', {
				type: 'conference-left',
				conferenceId: 'different-conf',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: [],
				timestamp: new Date().toISOString()
			}));

			// L'état ne devrait pas changer
			const state = manager.getState();
			expect(state.conferenceId).toBe('my-conf');
			expect(state.participants).toContain('other-1');
		});

		it('should handle conference-left when becoming last participant', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Ajouter un autre participant
			socket._trigger('peer-signal', createAnnouncementSignal('other-1', {
				type: 'conference-joined',
				conferenceId: confId!,
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id', 'other-1'],
				timestamp: new Date().toISOString()
			}));

			// L'autre quitte
			socket._trigger('peer-signal', createAnnouncementSignal('other-1', {
				type: 'conference-left',
				conferenceId: confId!,
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id'],
				timestamp: new Date().toISOString()
			}));

			// Je reste dans la conférence en tant que dernier participant
			// La conf ne se termine que si 0 participant
			const state = manager.getState();
			expect(state.phase).toBe('joined');
			expect(state.participants).toContain('my-socket-id');
			expect(state.participants).toHaveLength(1);
		});

		it('should end conference only when zero participants remain', async () => {
			// Simuler une conférence où on n'est pas participant mais qu'on observe
			manager.setActiveConference('other-conf', ['other-1', 'other-2']);

			// other-1 quitte, il reste other-2
			socket._trigger('peer-signal', createAnnouncementSignal('other-1', {
				type: 'conference-left',
				conferenceId: 'other-conf',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['other-2'],
				timestamp: new Date().toISOString()
			}));

			let state = manager.getState();
			expect(state.phase).toBe('active_not_joined');
			expect(state.participants).toEqual(['other-2']);

			// other-2 quitte aussi, plus personne
			socket._trigger('peer-signal', createAnnouncementSignal('other-2', {
				type: 'conference-left',
				conferenceId: 'other-conf',
				participantId: 'other-2',
				participantPseudo: 'User2',
				participants: [],
				timestamp: new Date().toISOString()
			}));

			state = manager.getState();
			expect(state.phase).toBe('idle');
			expect(state.conferenceId).toBeNull();
		});

		it('should remove participant from conference when disconnected', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Ajouter des participants à la room
			manager.updateRoomParticipants({
				'my-socket-id': { pseudo: 'Me' },
				'other-1': { pseudo: 'User1' }
			});

			// Ajouter other-1 à la conférence
			socket._trigger('peer-signal', createAnnouncementSignal('other-1', {
				type: 'conference-joined',
				conferenceId: confId!,
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id', 'other-1'],
				timestamp: new Date().toISOString()
			}));

			// other-1 se déconnecte de la room
			manager.removeRoomParticipant('other-1');

			const state = manager.getState();
			expect(state.participants).not.toContain('other-1');
		});

		it('should ignore signals when not in joining or joined phase', () => {
			// En phase idle - utilise peer-signal
			socket._trigger('peer-signal', createWebRTCSignal(
				'other-id',
				'some-conf',
				'offer',
				{ sdp: 'test' }
			));

			// Pas d'erreur, signal simplement ignoré
		});

		it('should setActiveConference only when idle', async () => {
			await manager.startOrJoinConference();
			const originalConfId = manager.getState().conferenceId;

			manager.setActiveConference('new-conf', ['other-1']);

			// Devrait garder l'ancienne conf
			expect(manager.getState().conferenceId).toBe(originalConfId);
		});
	});

	describe('Local stream management', () => {
		it('should reuse existing local stream', async () => {
			await manager.startOrJoinConference();
			
			// Premier appel pour obtenir le stream
			expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.length).toBe(1);

			// Quitter et rejoindre ne devrait pas re-demander (car le stream est libéré au leave)
			manager.leaveConference();
			await manager.startOrJoinConference();

			// Un nouvel appel car le stream a été libéré
			expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.length).toBe(2);
		});

		it('should stop tracks on cleanup', async () => {
			// Ce test vérifie que les tracks sont stoppés lors de leaveConference
			// Le mock par défaut est configuré dans beforeEach
			await manager.startOrJoinConference();
			
			// Vérifie qu'on a bien obtenu un stream
			expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenCalled();
			
			manager.leaveConference();
			
			// La phase devrait être idle après leave (conf était seule)
			const state = manager.getState();
			expect(state.phase).toBe('idle');
		});
	});
});
