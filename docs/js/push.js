// Push notification setup
const PushManager2 = (() => {
  async function setup() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;

      // Get VAPID key from worker
      let vapidKey;
      try {
        const resp = await TwilioAPI.getVapidKey();
        vapidKey = resp.key;
      } catch (e) {
        console.log('VAPID key not configured, push disabled');
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // Send subscription to worker
      await TwilioAPI.registerPush(subscription);
      console.log('Push notifications enabled');
      return true;
    } catch (e) {
      console.error('Push setup failed:', e);
      return false;
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return { setup };
})();
