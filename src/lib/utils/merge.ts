/**
 * Fonctions de fusion de données pures, testables indépendamment.
 */

import { formatRoomName } from './format';

export type Room = { id: string; name: string; joined: boolean };

const DEFAULT_JOINED_IDS = new Set(['general', 'random']);

/**
 * Fusionne les rooms distantes avec les rooms stockées localement.
 * Préserve les préférences utilisateur (nom personnalisé, statut joined).
 */
export function mergeRemoteWithStored(remoteIds: string[], stored: Room[]): Room[] {
	const storedById = new Map(stored.map((room) => [room.id, room]));

	const remoteRooms = remoteIds.map((id) => {
		const storedRoom = storedById.get(id);
		const storedName = storedRoom?.name;
		const storedJoined = storedRoom?.joined;
		return {
			id,
			name: storedName && storedName.trim().length > 0 ? storedName : formatRoomName(id),
			joined: storedJoined ?? DEFAULT_JOINED_IDS.has(id)
		};
	});

	const remoteSet = new Set(remoteIds);
	const customRooms = stored.filter((room) => !remoteSet.has(room.id));

	return [...remoteRooms, ...customRooms];
}
