// Barrel exports for lib modules
// Services
export * from './services';

// API
export { apiFetch, API_BASE, API_ORIGIN } from './api/client';
export { fetchUserImage, uploadUserImage } from './api/images';
export { fetchRoomsIndex, type RoomsIndexItem } from './api/rooms';

// Storage
export {
	readProfile,
	writeProfile,
	readLastRoom,
	writeLastRoom,
	readLocation,
	writeLocation,
	clearLocation,
	reverseGeocode,
	defaultAvatarDataURL,
	type Profile,
	type Location
} from './storage/profile';

export {
	readPhotos,
	writePhotos,
	addPhotoFromDataURL,
	removePhotoByTs,
	downloadPhoto,
	dataURLFromBlob,
	type PhotoItem
} from './storage/photos';

export {
	readRooms,
	writeRooms,
	ensureSeed,
	upsertRoom,
	type Room
} from './storage/rooms';

export {
	readMessages,
	writeMessages,
	unsubscribeRoom,
	readMessagesByRoom,
	type Message
} from './storage/chat';

// Stores
export { loadingStore } from './stores/loading';

// Utils
export { safeParse, isDataUrl } from './utils/validation';
export { formatRoomName } from './utils/format';
export { mergeRemoteWithStored } from './utils/merge';
export { triggerDownload, blobToDataURL, fileToDataURL, type DownloadableItem } from './utils/download';
