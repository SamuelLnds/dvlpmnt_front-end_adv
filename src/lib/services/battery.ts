/**
 * Service centralisé pour l'API Battery
 * Gère la détection du support, l'initialisation et les mises à jour en temps réel
 */

export type BatteryManager = {
	charging: boolean;
	level: number; // 0..1
	addEventListener: (t: string, cb: () => void) => void;
	removeEventListener: (t: string, cb: () => void) => void;
};

type BatteryState = {
	supported: boolean;
	level: number;
	charging: boolean;
	percent: number;
};

type BatterySubscriber = (state: BatteryState) => void;

let batteryManager: BatteryManager | null = null;
let batteryState: BatteryState = {
	supported: false,
	level: 1,
	charging: false,
	percent: 100
};
let subscribers: Set<BatterySubscriber> = new Set();
let initialized = false;

function notifySubscribers() {
	subscribers.forEach((cb) => cb(batteryState));
}

function updateBatteryState() {
	if (!batteryManager) return;
	batteryState.level = batteryManager.level;
	batteryState.charging = batteryManager.charging;
	batteryState.percent = Math.round(batteryManager.level * 100);
	notifySubscribers();
}

/**
 * Initialise l'API Battery (appelé automatiquement par subscribe)
 * @returns Promise<boolean> - true si l'API est supportée
 */
export async function initBattery(): Promise<boolean> {
	if (initialized) return batteryState.supported;
	initialized = true;

	if (typeof navigator === 'undefined' || typeof window === 'undefined') {
		batteryState.supported = false;
		return false;
	}

	batteryState.supported = 'getBattery' in navigator && window.isSecureContext;
	if (!batteryState.supported) return false;

	try {
		batteryManager = await (
			navigator as unknown as { getBattery: () => Promise<BatteryManager> }
		).getBattery();

		if (!batteryManager) {
			batteryState.supported = false;
			return false;
		}

		updateBatteryState();
		batteryManager.addEventListener('levelchange', updateBatteryState);
		batteryManager.addEventListener('chargingchange', updateBatteryState);

		return true;
	} catch (e) {
		console.warn('Battery API initialization failed:', e);
		batteryState.supported = false;
		return false;
	}
}

/**
 * S'abonner aux mises à jour de l'état de la batterie
 * @param callback - Fonction appelée à chaque mise à jour
 * @returns Fonction de désabonnement
 */
export function subscribeToBattery(callback: BatterySubscriber): () => void {
	// Initialiser automatiquement si pas encore fait
	if (!initialized) {
		void initBattery();
	}

	subscribers.add(callback);
	// Envoyer l'état actuel immédiatement
	callback(batteryState);

	// Retourner la fonction de désabonnement
	return () => {
		subscribers.delete(callback);
	};
}

/**
 * Obtenir l'état actuel de la batterie (synchrone)
 */
export function getBatteryState(): BatteryState {
	return { ...batteryState };
}

/**
 * Vérifier si l'API Battery est supportée
 */
export function isBatterySupported(): boolean {
	return batteryState.supported;
}

/**
 * Nettoyer les listeners (à appeler au démontage de l'application)
 */
export function cleanupBattery(): void {
	if (batteryManager) {
		batteryManager.removeEventListener('levelchange', updateBatteryState);
		batteryManager.removeEventListener('chargingchange', updateBatteryState);
		batteryManager = null;
	}
	subscribers.clear();
	initialized = false;
	batteryState = {
		supported: false,
		level: 1,
		charging: false,
		percent: 100
	};
}
