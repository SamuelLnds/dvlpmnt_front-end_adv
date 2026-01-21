import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	initBattery,
	subscribeToBattery,
	getBatteryState,
	isBatterySupported,
	cleanupBattery
} from './battery';

describe('services/battery', () => {
	let mockBatteryManager: {
		charging: boolean;
		level: number;
		listeners: Record<string, (() => void)[]>;
		addEventListener: (type: string, callback: () => void) => void;
		removeEventListener: (type: string, callback: () => void) => void;
	};

	beforeEach(() => {
		// Reset du module entre les tests
		cleanupBattery();

		// Mock du BatteryManager
		mockBatteryManager = {
			charging: false,
			level: 0.75,
			listeners: {},
			addEventListener(type: string, callback: () => void) {
				if (!this.listeners[type]) this.listeners[type] = [];
				this.listeners[type].push(callback);
			},
			removeEventListener(type: string, callback: () => void) {
				if (!this.listeners[type]) return;
				this.listeners[type] = this.listeners[type].filter((cb) => cb !== callback);
			}
		};

		// Mock de navigator.getBattery
		vi.stubGlobal('navigator', {
			getBattery: vi.fn().mockResolvedValue(mockBatteryManager)
		});

		// Mock de window.isSecureContext
		vi.stubGlobal('window', {
			isSecureContext: true
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		cleanupBattery();
	});

	describe('initBattery', () => {
		it('devrait initialiser et retourner true si l\'API est supportée', async () => {
			const result = await initBattery();
			expect(result).toBe(true);
			expect((navigator as unknown as { getBattery: () => unknown }).getBattery).toHaveBeenCalled();
		});

		it('devrait retourner false si getBattery n\'existe pas', async () => {
			vi.stubGlobal('navigator', {});
			const result = await initBattery();
			expect(result).toBe(false);
		});

		it('devrait retourner false si le contexte n\'est pas sécurisé', async () => {
			vi.stubGlobal('window', { isSecureContext: false });
			const result = await initBattery();
			expect(result).toBe(false);
		});

		it('devrait gérer les erreurs getBattery', async () => {
			vi.stubGlobal('navigator', {
				getBattery: vi.fn().mockRejectedValue(new Error('Battery API not available'))
			});
			const result = await initBattery();
			expect(result).toBe(false);
			expect(isBatterySupported()).toBe(false);
		});

		it('devrait enregistrer les listeners levelchange et chargingchange', async () => {
			await initBattery();
			expect(mockBatteryManager.listeners.levelchange).toBeDefined();
			expect(mockBatteryManager.listeners.chargingchange).toBeDefined();
			expect(mockBatteryManager.listeners.levelchange.length).toBe(1);
			expect(mockBatteryManager.listeners.chargingchange.length).toBe(1);
		});
	});

	describe('subscribeToBattery', () => {
		it('devrait appeler le callback avec l\'état initial', async () => {
			await initBattery();
			const callback = vi.fn();
			subscribeToBattery(callback);

			expect(callback).toHaveBeenCalledWith({
				supported: true,
				level: 0.75,
				charging: false,
				percent: 75
			});
		});

		it('devrait retourner une fonction de désabonnement', async () => {
			await initBattery();
			const callback = vi.fn();
			const unsubscribe = subscribeToBattery(callback);

			expect(typeof unsubscribe).toBe('function');
		});

		it('devrait initialiser automatiquement si pas encore fait', () => {
			const callback = vi.fn();
			subscribeToBattery(callback);

			expect((navigator as unknown as { getBattery: () => unknown }).getBattery).toHaveBeenCalled();
		});

		it('devrait appeler le callback lors des mises à jour', async () => {
			await initBattery();
			const callback = vi.fn();
			subscribeToBattery(callback);

			// Clear les appels précédents
			callback.mockClear();

			// Simuler un changement de niveau
			mockBatteryManager.level = 0.5;
			mockBatteryManager.listeners.levelchange[0]();

			expect(callback).toHaveBeenCalledWith({
				supported: true,
				level: 0.5,
				charging: false,
				percent: 50
			});
		});

		it('devrait ne plus appeler le callback après désabonnement', async () => {
			await initBattery();
			const callback = vi.fn();
			const unsubscribe = subscribeToBattery(callback);

			callback.mockClear();
			unsubscribe();

			// Simuler un changement
			mockBatteryManager.level = 0.3;
			mockBatteryManager.listeners.levelchange[0]();

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('getBatteryState', () => {
		it('devrait retourner l\'état actuel', async () => {
			await initBattery();
			const state = getBatteryState();

			expect(state).toEqual({
				supported: true,
				level: 0.75,
				charging: false,
				percent: 75
			});
		});

		it('devrait retourner un état par défaut avant initialisation', () => {
			const state = getBatteryState();

			expect(state).toEqual({
				supported: false,
				level: 1,
				charging: false,
				percent: 100
			});
		});
	});

	describe('isBatterySupported', () => {
		it('devrait retourner true après initialisation réussie', async () => {
			await initBattery();
			expect(isBatterySupported()).toBe(true);
		});

		it('devrait retourner false avant initialisation', () => {
			expect(isBatterySupported()).toBe(false);
		});

		it('devrait retourner false après échec d\'initialisation', async () => {
			vi.stubGlobal('navigator', {
				getBattery: vi.fn().mockRejectedValue(new Error('Not supported'))
			});
			await initBattery();
			expect(isBatterySupported()).toBe(false);
		});
	});

	describe('cleanupBattery', () => {
		it('devrait retirer les listeners', async () => {
			await initBattery();
			cleanupBattery();

			expect(mockBatteryManager.listeners.levelchange).toEqual([]);
			expect(mockBatteryManager.listeners.chargingchange).toEqual([]);
		});

		it('devrait réinitialiser l\'état', async () => {
			await initBattery();
			cleanupBattery();

			// Devrait pouvoir réinitialiser
			const result = await initBattery();
			expect(result).toBe(true);
		});

		it('devrait supprimer tous les subscribers', async () => {
			await initBattery();
			const callback = vi.fn();
			subscribeToBattery(callback);

			cleanupBattery();
			callback.mockClear();

			// Simuler un changement après cleanup
			mockBatteryManager.level = 0.2;
			if (mockBatteryManager.listeners.levelchange?.[0]) {
				mockBatteryManager.listeners.levelchange[0]();
			}

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('calcul du pourcentage', () => {
		it('devrait arrondir correctement le pourcentage', async () => {
			await initBattery();
			
			mockBatteryManager.level = 0.127; // 12.7%
			mockBatteryManager.listeners.levelchange[0]();
			expect(getBatteryState().percent).toBe(13);

			mockBatteryManager.level = 0.124; // 12.4%
			mockBatteryManager.listeners.levelchange[0]();
			expect(getBatteryState().percent).toBe(12);

			mockBatteryManager.level = 1; // 100%
			mockBatteryManager.listeners.levelchange[0]();
			expect(getBatteryState().percent).toBe(100);

			mockBatteryManager.level = 0; // 0%
			mockBatteryManager.listeners.levelchange[0]();
			expect(getBatteryState().percent).toBe(0);
		});
	});

	describe('état de charge', () => {
		it('devrait mettre à jour l\'état charging', async () => {
			await initBattery();
			
			mockBatteryManager.charging = true;
			mockBatteryManager.listeners.chargingchange[0]();

			expect(getBatteryState().charging).toBe(true);
		});
	});
});
