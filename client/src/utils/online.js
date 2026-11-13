import { ref } from 'vue';

// Whether the browser thinks it has a network connection. A false "online" is common (Wi-Fi with
// no internet behind it), so failed saves are the real signal; this just lets us say so sooner.
export const online = ref(typeof navigator === 'undefined' || navigator.onLine !== false);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => (online.value = true));
  window.addEventListener('offline', () => (online.value = false));
}
