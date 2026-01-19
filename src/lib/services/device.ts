export function vibrate(pattern: number | number[]) {
  // @ts-ignore - vibrate n'existe pas sur tous les UA
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    // @ts-ignore
    navigator.vibrate(pattern);
  }
}

/** Notification + vibration optionnelle */
export async function notifyAndVibrate(
  title: string,
  opts?: NotificationOptions,
  vibration?: number | number[]
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  let perm: NotificationPermission = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
  }
  if (perm === 'granted') {
    new Notification(title, opts);
    if (vibration != null) vibrate(vibration);
    return true;
  }
  return false;
}
