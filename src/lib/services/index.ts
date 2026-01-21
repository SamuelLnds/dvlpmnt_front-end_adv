// Barrel exports for services
export { vibrate, notifyAndVibrate } from './device';
export { getSocket, withSocket, resetSocket } from './socket';
export {
	initBattery,
	subscribeToBattery,
	getBatteryState,
	isBatterySupported,
	cleanupBattery
} from './battery';
export type { BatteryManager } from './battery';
