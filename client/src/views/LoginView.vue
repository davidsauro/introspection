<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const password = ref('');
const confirm = ref('');
const error = ref('');
const busy = ref(false);
const setup = computed(() => auth.setupRequired);

async function submit() {
  error.value = '';
  if (setup.value) {
    if (password.value.length < 8) return (error.value = 'Use at least 8 characters.');
    if (password.value !== confirm.value) return (error.value = "The passwords don't match.");
  }
  busy.value = true;
  try {
    if (setup.value) await auth.setup(password.value);
    else await auth.login(password.value);
    // Only follow same-site paths ("//host" would be another site).
    const n = route.query.next;
    const next = typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/';
    router.replace(next);
  } catch (e) {
    error.value = e.message;
    password.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="wrap">
    <form class="card login" @submit.prevent="submit">
      <img src="/icon.svg" alt="" width="56" height="56" />
      <h1>{{ setup ? 'Welcome' : 'Diary' }}</h1>
      <p v-if="setup" class="muted">Choose a password to keep your diary private.</p>

      <label class="field">
        Password
        <input
          v-model="password"
          type="password"
          :autocomplete="setup ? 'new-password' : 'current-password'"
          autofocus
          required
        />
      </label>
      <label v-if="setup" class="field">
        Confirm password
        <input v-model="confirm" type="password" autocomplete="new-password" required />
      </label>

      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <button class="btn primary" type="submit" :disabled="busy">
        {{ setup ? 'Create diary' : 'Log in' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
}

.login {
  width: 100%;
  max-width: 380px;
  display: grid;
  gap: 16px;
  padding: 28px 24px;
  text-align: center;
}

.login img {
  justify-self: center;
  border-radius: 14px;
}

.login .field {
  text-align: left;
}

.login p {
  margin: 0;
}
</style>
