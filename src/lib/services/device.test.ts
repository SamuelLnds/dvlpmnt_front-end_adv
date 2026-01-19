import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vibrate, notifyAndVibrate } from '$lib/services/device';

describe('vibrate', () => {
	beforeEach(() => {
		vi.stubGlobal('navigator', {
			vibrate: vi.fn()
		});
	});

	it('appelle navigator.vibrate avec le pattern fourni', () => {
		vibrate(100);
		expect(navigator.vibrate).toHaveBeenCalledWith(100);

		vibrate([100, 50, 100]);
		expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
	});

	it('ne plante pas si vibrate n\'est pas supporté', () => {
		vi.stubGlobal('navigator', {});
		expect(() => vibrate(100)).not.toThrow();
	});
});

describe('notifyAndVibrate', () => {
	beforeEach(() => {
		vi.stubGlobal('navigator', { vibrate: vi.fn() });
	});

	it('retourne false si window n\'est pas défini', async () => {
		vi.stubGlobal('window', undefined);
		const result = await notifyAndVibrate('Test');
		expect(result).toBe(false);
	});

	it('retourne false si Notification n\'est pas disponible', async () => {
		vi.stubGlobal('window', {});
		const win = globalThis.window as { Notification?: unknown };
		delete win.Notification;

		const result = await notifyAndVibrate('Test');
		expect(result).toBe(false);
	});

	it('retourne false si la permission est refusée', async () => {
		const mockNotification = vi.fn();
		Object.assign(mockNotification, {
			permission: 'denied',
			requestPermission: vi.fn().mockResolvedValue('denied')
		});
		vi.stubGlobal('window', { Notification: mockNotification });
		vi.stubGlobal('Notification', mockNotification);

		const result = await notifyAndVibrate('Test');
		expect(result).toBe(false);
	});

	it('crée une notification et retourne true si permission accordée', async () => {
		const mockNotification = vi.fn();
		Object.assign(mockNotification, {
			permission: 'granted',
			requestPermission: vi.fn().mockResolvedValue('granted')
		});
		vi.stubGlobal('window', { Notification: mockNotification });
		vi.stubGlobal('Notification', mockNotification);

		const result = await notifyAndVibrate('Test Title', { body: 'Test body' });

		expect(result).toBe(true);
		expect(mockNotification).toHaveBeenCalledWith('Test Title', { body: 'Test body' });
	});

	it('vibre si un pattern est fourni avec permission accordée', async () => {
		const mockNotification = vi.fn();
		Object.assign(mockNotification, {
			permission: 'granted',
			requestPermission: vi.fn().mockResolvedValue('granted')
		});
		vi.stubGlobal('window', { Notification: mockNotification });
		vi.stubGlobal('Notification', mockNotification);

		await notifyAndVibrate('Title', {}, [100, 50]);

		expect(navigator.vibrate).toHaveBeenCalledWith([100, 50]);
	});

	it('demande la permission si non accordée et l\'obtient', async () => {
		const mockNotification = vi.fn();
		Object.assign(mockNotification, {
			permission: 'default',
			requestPermission: vi.fn().mockResolvedValue('granted')
		});
		vi.stubGlobal('window', { Notification: mockNotification });
		vi.stubGlobal('Notification', mockNotification);

		const result = await notifyAndVibrate('Test');

		expect(Notification.requestPermission).toHaveBeenCalled();
		expect(result).toBe(true);
	});
});
