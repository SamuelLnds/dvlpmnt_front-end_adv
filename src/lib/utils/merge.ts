/**
 * Fonctions de fusion de données pures, testables indépendamment.
 */

import { formatRoomName } from './format';

export type Room = {
	id: string;
	name: string;
	joined: boolean;
	private: boolean;
	clientCount: number;
};

const DEFAULT_JOINED_IDS = new Set(['general', 'random']);

export type RemoteRoom = {
	id: string;
	name: string;
	private: boolean;
	clientCount: number;
};

/**
 * Fusionne les rooms distantes avec les rooms stockées localement.
 * Préserve les préférences utilisateur (nom personnalisé, statut joined).
 */
export function mergeRemoteWithStored(remoteRooms: RemoteRoom[], stored: Room[]): Room[] {
	const storedById = new Map(stored.map((room) => [room.id, room]));

	const merged = remoteRooms.map((remote) => {
		const storedRoom = storedById.get(remote.id);
		const storedName = storedRoom?.name;
		const storedJoined = storedRoom?.joined;
		return {
			id: remote.id,
			name: storedName && storedName.trim().length > 0 ? storedName : remote.name || formatRoomName(remote.id),
			joined: storedJoined ?? DEFAULT_JOINED_IDS.has(remote.id),
			private: remote.private,
			clientCount: remote.clientCount
		};
	});

	const remoteSet = new Set(remoteRooms.map((r) => r.id));
	const customRooms = stored
		.filter((room) => !remoteSet.has(room.id))
		.map((room) => ({
			...room,
			private: room.private ?? false,
			clientCount: room.clientCount ?? 0
		}));

	return [...merged, ...customRooms];
}
