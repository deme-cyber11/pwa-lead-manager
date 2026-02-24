// Twilio API proxy client — all calls go through Cloudflare Worker
const TwilioAPI = (() => {
  let WORKER_URL = '';
  let AUTH_TOKEN = '';

  function init(workerUrl, token) {
    WORKER_URL = workerUrl.replace(/\/$/, '');
    AUTH_TOKEN = token;
  }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'X-Auth-Token': AUTH_TOKEN
    };
  }

  async function request(path, method = 'GET', body = null) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${WORKER_URL}${path}`, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
  }

  // Fetch SMS messages for a business number
  async function getMessages(businessNumber, limit = 50) {
    return request(`/messages?number=${encodeURIComponent(businessNumber)}&limit=${limit}`);
  }

  // Send SMS from a business number
  async function sendMessage(from, to, body) {
    return request('/messages', 'POST', { from, to, body });
  }

  // Fetch call logs for a business number
  async function getCalls(businessNumber, limit = 50) {
    return request(`/calls?number=${encodeURIComponent(businessNumber)}&limit=${limit}`);
  }

  // Initiate click-to-callback
  async function initiateCall(businessNumber, customerNumber) {
    return request('/call', 'POST', { from: businessNumber, to: customerNumber });
  }

  // Register push subscription
  async function registerPush(subscription) {
    return request('/push/subscribe', 'POST', { subscription });
  }

  // Get VAPID public key
  async function getVapidKey() {
    return request('/push/vapid-key');
  }

  return { init, getMessages, sendMessage, getCalls, initiateCall, registerPush, getVapidKey };
})();
