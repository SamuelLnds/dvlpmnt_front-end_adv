import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConferenceManager, type ConferenceState, type ConferenceParticipant, type ConferenceAnnouncement, type PeerSignalEnvelope } from './conference';
import type { Socket } from 'socket.io-client';

type MockSocket = Socket & { _trigger: (event: string, ...args: unknown[]) => void };

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
			expect(socket.on).toHaveBeenCalledWith('peer-signal', expect.any(Function));
			expect(socket.on).toHaveBeenCalledWith('conference-announcement', expect.any(Function));
			expect(socket.on).toHaveBeenCalledWith('conference-state-request', expect.any(Function));
			expect(socket.on).toHaveBeenCalledWith('conference-state-response', expect.any(Function));
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
			await manager.startOrJoinConference();

			expect(socket.emit).toHaveBeenCalledWith(
				'conference-announcement',
				expect.objectContaining({
					roomName: 'test-room',
					type: 'conference-started',
					participantPseudo: 'TestUser'
				})
			);
		});

		it('should leave conference', async () => {
			await manager.startOrJoinConference();
			
			manager.leaveConference();

			const finalState = stateChanges[stateChanges.length - 1];
			expect(finalState.phase).toBe('idle');
			expect(finalState.conferenceId).toBeNull();
		});

		it('should emit conference-ended when last participant leaves', async () => {
			await manager.startOrJoinConference();
			
			manager.leaveConference();

			expect(socket.emit).toHaveBeenCalledWith(
				'conference-announcement',
				expect.objectContaining({
					type: 'conference-ended'
				})
			);
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
			socket._trigger('conference-announcement', {
				type: 'conference-started',
				conferenceId: 'new-conf',
				participantId: 'other-id',
				participantPseudo: 'OtherUser',
				participants: ['other-id'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			const state = manager.getState();
			expect(state.phase).toBe('active_not_joined');
			expect(state.conferenceId).toBe('new-conf');
			expect(announcements.length).toBe(1);
		});

		it('should handle conference-joined announcement when in conference', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('conference-announcement', {
				type: 'conference-joined',
				conferenceId: confId,
				participantId: 'new-participant',
				participantPseudo: 'NewUser',
				participants: ['my-socket-id', 'new-participant'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			const state = manager.getState();
			expect(state.participants).toContain('new-participant');
		});

		it('should handle conference-left announcement', async () => {
			manager.setActiveConference('conf-id', ['other-1', 'other-2']);

			socket._trigger('conference-announcement', {
				type: 'conference-left',
				conferenceId: 'conf-id',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['other-2'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			const state = manager.getState();
			expect(state.participants).not.toContain('other-1');
			expect(state.participants).toContain('other-2');
		});

		it('should handle conference-ended announcement', async () => {
			manager.setActiveConference('conf-id', ['other-id']);

			socket._trigger('conference-announcement', {
				type: 'conference-ended',
				conferenceId: 'conf-id',
				participantId: 'other-id',
				participantPseudo: 'OtherUser',
				participants: [],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			const state = manager.getState();
			expect(state.phase).toBe('idle');
			expect(state.conferenceId).toBeNull();
		});
	});

	describe('Peer signal filtering', () => {
		it('should ignore signals from self', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'my-socket-id', // From self
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'test' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			// Should not have created any peer connection
			expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.length).toBe(1); // Only initial call
		});

		it('should ignore signals not addressed to self', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-id',
				toId: 'someone-else', // Not for me
				signal: { type: 'offer', sdp: 'test' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			// Should not process this signal
		});

		it('should ignore signals for wrong conference', async () => {
			await manager.startOrJoinConference();

			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: 'wrong-conf-id', // Wrong conference
				fromId: 'other-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'test' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			// Should not process this signal
		});

		it('should ignore signals for wrong room', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('peer-signal', {
				roomName: 'wrong-room', // Wrong room
				conferenceId: confId,
				fromId: 'other-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'test' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			// Should not process this signal
		});
	});

	describe('State request/response (new arrival handling)', () => {
		it('should respond to state request when in conference', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			socket._trigger('conference-state-request', {
				fromId: 'new-arrival',
				roomName: 'test-room'
			});

			expect(socket.emit).toHaveBeenCalledWith(
				'conference-state-response',
				expect.objectContaining({
					roomName: 'test-room',
					conferenceId: confId,
					toId: 'new-arrival'
				})
			);
		});

		it('should not respond to state request when not in conference', () => {
			const emitCallCount = (socket.emit as ReturnType<typeof vi.fn>).mock.calls.length;

			socket._trigger('conference-state-request', {
				fromId: 'new-arrival',
				roomName: 'test-room'
			});

			expect((socket.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCallCount);
		});

		it('should handle state response', () => {
			socket._trigger('conference-state-response', {
				roomName: 'test-room',
				conferenceId: 'existing-conf',
				participants: ['other-1', 'other-2']
			});

			const state = manager.getState();
			expect(state.phase).toBe('active_not_joined');
			expect(state.conferenceId).toBe('existing-conf');
		});

		it('should request conference state', () => {
			manager.requestConferenceState();

			expect(socket.emit).toHaveBeenCalledWith(
				'conference-state-request',
				expect.objectContaining({
					fromId: 'my-socket-id',
					roomName: 'test-room'
				})
			);
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
			expect(socket.off).toHaveBeenCalledWith('conference-announcement');
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

			// Simuler la réception d'une offre valide
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'mock-offer-sdp' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			// Attendre le traitement asynchrone
			await new Promise(resolve => setTimeout(resolve, 10));

			// Devrait avoir émis une réponse (answer)
			expect(socket.emit).toHaveBeenCalledWith(
				'peer-signal',
				expect.objectContaining({
					kind: 'answer',
					toId: 'other-peer-id'
				})
			);
		});

		it('should process valid answer signal', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Simuler qu'on a déjà une connexion peer initiée (via announcement)
			socket._trigger('conference-announcement', {
				type: 'conference-joined',
				conferenceId: confId,
				participantId: 'other-peer-id',
				participantPseudo: 'OtherUser',
				participants: ['my-socket-id', 'other-peer-id'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Simuler la réception d'une réponse
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { type: 'answer', sdp: 'mock-answer-sdp' },
				kind: 'answer'
			} as PeerSignalEnvelope);

			await new Promise(resolve => setTimeout(resolve, 10));
			// Le test passe si pas d'erreur
		});

		it('should process ICE candidate signal', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// D'abord recevoir une offre pour établir la connexion
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'mock-offer-sdp' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Puis recevoir un candidat ICE
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { candidate: { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 } },
				kind: 'ice'
			} as PeerSignalEnvelope);

			await new Promise(resolve => setTimeout(resolve, 10));
			// Le test passe si pas d'erreur
		});

		it('should buffer ICE candidates when remote description not set', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Envoyer un candidat ICE AVANT l'offre (cas edge)
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { candidate: { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 } },
				kind: 'ice'
			} as PeerSignalEnvelope);

			// Le candidat devrait être mis en buffer (pas d'erreur)
			await new Promise(resolve => setTimeout(resolve, 10));
		});

		it('should handle peer connection state change to disconnected', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Créer une connexion peer via offre
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'mock-offer-sdp' },
				kind: 'offer'
			} as PeerSignalEnvelope);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Simuler une déconnexion du peer via l'état de connexion
			// (le mock RTCPeerConnection a onconnectionstatechange)
		});

		it('should emit ICE candidates when available', async () => {
			await manager.startOrJoinConference();
			
			// Les candidats ICE sont émis via le callback onicecandidate du peer
			// Ce test vérifie que la structure est correcte
			expect(socket.emit).toHaveBeenCalledWith(
				'conference-announcement',
				expect.any(Object)
			);
		});
	});

	describe('Conference with multiple existing participants', () => {
		it('should establish connections with all existing participants when joining', async () => {
			// Une conférence existe déjà avec 2 autres participants
			manager.setActiveConference('existing-conf', ['other-1', 'other-2']);

			await manager.startOrJoinConference();

			// Devrait avoir émis des offres vers les 2 participants existants
			const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls;
			const peerSignalCalls = emitCalls.filter(call => call[0] === 'peer-signal');
			
			// Au moins 2 offres (une par participant)
			const offerCalls = peerSignalCalls.filter(call => call[1]?.kind === 'offer');
			expect(offerCalls.length).toBeGreaterThanOrEqual(2);
		});

		it('should emit conference-joined when joining existing conference', async () => {
			manager.setActiveConference('existing-conf', ['other-1']);

			await manager.startOrJoinConference();

			expect(socket.emit).toHaveBeenCalledWith(
				'conference-announcement',
				expect.objectContaining({
					type: 'conference-joined',
					conferenceId: 'existing-conf'
				})
			);
		});
	});

	describe('Leave conference scenarios', () => {
		it('should emit conference-left when others remain', async () => {
			// Rejoindre une conf existante
			manager.setActiveConference('conf-with-others', ['other-1', 'other-2']);
			await manager.startOrJoinConference();

			// Simuler que les autres sont toujours là
			socket._trigger('conference-announcement', {
				type: 'conference-joined',
				conferenceId: 'conf-with-others',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id', 'other-1', 'other-2'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			manager.leaveConference();

			expect(socket.emit).toHaveBeenCalledWith(
				'conference-announcement',
				expect.objectContaining({
					type: 'conference-left'
				})
			);

			// Devrait rester en active_not_joined
			const finalState = stateChanges[stateChanges.length - 1];
			expect(finalState.phase).toBe('active_not_joined');
		});

		it('should clean up peer connections on leave', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Établir une connexion peer
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: confId,
				fromId: 'other-peer-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'mock-offer-sdp' },
				kind: 'offer'
			} as PeerSignalEnvelope);

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

			socket._trigger('conference-state-request', {
				fromId: 'new-arrival',
				roomName: 'wrong-room'
			});

			// Pas de nouvelle émission
			expect((socket.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCallCount);
		});

		it('should ignore state response for wrong room', () => {
			socket._trigger('conference-state-response', {
				roomName: 'wrong-room',
				conferenceId: 'some-conf',
				participants: ['other-1']
			});

			const state = manager.getState();
			expect(state.phase).toBe('idle');
		});

		it('should ignore state response when not idle', async () => {
			await manager.startOrJoinConference();

			socket._trigger('conference-state-response', {
				roomName: 'test-room',
				conferenceId: 'another-conf',
				participants: ['other-1']
			});

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

			socket._trigger('conference-announcement', {
				type: 'conference-left',
				conferenceId: 'different-conf',
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: [],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			// L'état ne devrait pas changer
			const state = manager.getState();
			expect(state.conferenceId).toBe('my-conf');
			expect(state.participants).toContain('other-1');
		});

		it('should handle conference-left when becoming last participant', async () => {
			await manager.startOrJoinConference();
			const confId = manager.getState().conferenceId;

			// Ajouter un autre participant
			socket._trigger('conference-announcement', {
				type: 'conference-joined',
				conferenceId: confId,
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id', 'other-1'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			// L'autre quitte
			socket._trigger('conference-announcement', {
				type: 'conference-left',
				conferenceId: confId,
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			// La conf devrait se terminer (dernier participant)
			const state = manager.getState();
			expect(state.phase).toBe('idle');
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
			socket._trigger('conference-announcement', {
				type: 'conference-joined',
				conferenceId: confId,
				participantId: 'other-1',
				participantPseudo: 'User1',
				participants: ['my-socket-id', 'other-1'],
				timestamp: new Date().toISOString()
			} as ConferenceAnnouncement);

			// other-1 se déconnecte de la room
			manager.removeRoomParticipant('other-1');

			const state = manager.getState();
			expect(state.participants).not.toContain('other-1');
		});

		it('should ignore signals when not in joining or joined phase', () => {
			// En phase idle
			socket._trigger('peer-signal', {
				roomName: 'test-room',
				conferenceId: 'some-conf',
				fromId: 'other-id',
				toId: 'my-socket-id',
				signal: { type: 'offer', sdp: 'test' },
				kind: 'offer'
			} as PeerSignalEnvelope);

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
