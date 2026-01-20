// Barrel exports for services
export { vibrate, notifyAndVibrate } from './device';
export { getSocket, withSocket, resetSocket } from './socket';
export { CallManager, type CallState, type CallPhase, type Participant } from './webrtc';
export {
	ConferenceManager,
	type ConferenceState,
	type ConferencePhase,
	type ConferenceParticipant,
	type ConferenceAnnouncement,
	type PeerSignalEnvelope
} from './conference';
