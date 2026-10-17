<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useCatalogStore } from '../stores/catalog.js';
import ItemList from '../components/ItemList.vue';
import SkillList from '../components/SkillList.vue';

const auth = useAuthStore();
const catalog = useCatalogStore();
const router = useRouter();

onMounted(() => catalog.load());

const current = ref('');
const next = ref('');
const confirm = ref('');
const pwMessage = ref('');
const pwError = ref('');

async function changePassword() {
  pwMessage.value = pwError.value = '';
  if (next.value.length < 8) return (pwError.value = 'Use at least 8 characters.');
  if (next.value !== confirm.value) return (pwError.value = "The new passwords don't match.");
  try {
    await auth.changePassword(current.value, next.value);
    current.value = next.value = confirm.value = '';
    pwMessage.value = 'Password changed. Other devices have been logged out.';
  } catch (e) {
    pwError.value = e.message;
  }
}

async function logout() {
  await auth.logout();
  router.replace('/login');
}
</script>

<template>
  <div class="settings">
    <header class="page-header">
      <h1>Settings</h1>
    </header>

    <div v-if="catalog.loaded" class="sections">
      <section>
        <h2 class="section-title">Emotions</h2>
        <ItemList kind="emotion" />
      </section>

      <section>
        <h2 class="section-title">Urges</h2>
        <ItemList kind="urge" />
      </section>

      <section>
        <h2 class="section-title">Medications</h2>
        <ItemList kind="medication" />
      </section>

      <section>
        <h2 class="section-title">Skills</h2>
        <SkillList />
      </section>

      <section>
        <h2 class="section-title">Account</h2>
        <form class="card stack" autocomplete="on" @submit.prevent="changePassword">
          <input type="text" autocomplete="username" value="diary" hidden />
          <label class="field">
            Current password
            <input v-model="current" type="password" autocomplete="current-password" required />
          </label>
          <label class="field">
            New password
            <input v-model="next" type="password" autocomplete="new-password" required />
          </label>
          <label class="field">
            Confirm new password
            <input v-model="confirm" type="password" autocomplete="new-password" required />
          </label>
          <p v-if="pwError" class="error-text" role="alert">{{ pwError }}</p>
          <p v-if="pwMessage" class="muted small" role="status">{{ pwMessage }}</p>
          <div class="row">
            <button class="btn primary" type="submit">Change password</button>
            <span class="spacer" />
            <button class="btn danger" type="button" @click="logout">Log out</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sections {
  display: grid;
  gap: 32px;
}

.settings p {
  margin: 0;
}

/* Wide screens: two columns of sections. */
@media (min-width: 1024px) {
  .sections {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 32px 40px;
  }
}
</style>
