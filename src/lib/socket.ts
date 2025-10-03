import { io, type Socket } from 'socket.io-client';

// pas d'env j'ai pas le time
const url = 'https://api.tools.gavago.fr';
const path = '/socket.io';

let socket: Socket | null = null;

export function getSocket(): Socket {
	if (!socket) {
		socket = io(url, {
			path,
			transports: ['websocket', 'polling'],
			autoConnect: false
		});
	}
	return socket;
}

export function withSocket(onReady: (s: Socket) => void, onError?: (e: unknown) => void): Socket {
	const s = getSocket();
	try {
		onReady(s);
	} catch (e) {
		onError?.(e);
	}
	return s;
}
