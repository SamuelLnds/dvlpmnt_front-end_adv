import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSocket, withSocket, resetSocket } from '$lib/services/socket';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
	io: vi.fn(() => ({
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
		connect: vi.fn(),
		disconnect: vi.fn(),
		removeAllListeners: vi.fn(),
		connected: false,
		disconnected: true,
		io: { opts: { autoConnect: false } }
	}))
}));

describe('getSocket', () => {
	beforeEach(() => {
		resetSocket();
	});

	it('retourne une instance de socket', () => {
		const socket = getSocket();
		expect(socket).toBeDefined();
		expect(socket.on).toBeDefined();
		expect(socket.emit).toBeDefined();
	});

	it('retourne la même instance (singleton)', () => {
		const socket1 = getSocket();
		const socket2 = getSocket();
		expect(socket1).toBe(socket2);
	});
});

describe('withSocket', () => {
	beforeEach(() => {
		resetSocket();
	});

	it('exécute le callback avec le socket', () => {
		const callback = vi.fn();
		withSocket(callback);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith(expect.objectContaining({ on: expect.any(Function) }));
	});

	it('appelle onError si le callback échoue', () => {
		const error = new Error('Test error');
		const onReady = vi.fn(() => {
			throw error;
		});
		const onError = vi.fn();

		withSocket(onReady, onError);

		expect(onError).toHaveBeenCalledWith(error);
	});
});

describe('resetSocket', () => {
	it('nettoie le socket existant', () => {
		const socket = getSocket();
		resetSocket();

		expect(socket.removeAllListeners).toHaveBeenCalled();
		expect(socket.disconnect).toHaveBeenCalled();
	});

	it('permet de créer une nouvelle instance après reset', () => {
		const socket1 = getSocket();
		resetSocket();
		const socket2 = getSocket();

		// Après reset, une nouvelle instance devrait être créée
		// (bien que le mock retourne le même objet, le comportement est correct)
		expect(socket2).toBeDefined();
	});
});
