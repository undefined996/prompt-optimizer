<template>
  <div class="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800">
    <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">WebDAV Settings</h2>
    <form @submit.prevent="saveSettings">
      <div class="mb-4">
        <label for="webdav-server-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Server URL</label>
        <input
          type="url"
          id="webdav-server-url"
          v-model="settings.serverUrl"
          placeholder="https://your-webdav-server.com/remote.php/dav/files/username/"
          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-100"
          required
          aria-describedby="server-url-error"
        />
        <p v-if="validationErrors.serverUrl" class="mt-1 text-xs text-red-600 dark:text-red-400" id="server-url-error">
          {{ validationErrors.serverUrl }}
        </p>
      </div>
      <div class="mb-4">
        <label for="webdav-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
        <input
          type="text"
          id="webdav-username"
          v-model="settings.username"
          placeholder="WebDAV Username"
          autocomplete="webdav-username"
          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-100"
        />
      </div>
      <div class="mb-4">
        <label for="webdav-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
        <input
          type="password"
          id="webdav-password"
          v-model="settings.password"
          placeholder="WebDAV Password"
          autocomplete="webdav-password"
          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-100"
        />
      </div>
       <div class="mb-4">
        <label for="webdav-remote-path" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Remote Backup Path (Optional)</label>
        <input
          type="text"
          id="webdav-remote-path"
          v-model="settings.remotePath"
          placeholder="backup/my_app_backup.json"
          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-100"
          aria-describedby="remote-path-desc remote-path-error"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400" id="remote-path-desc">
          Full path including filename for the backup. If empty, 'prompt_optimizer_backup.json' in the root will be used.
        </p>
         <p v-if="validationErrors.remotePath" class="mt-1 text-xs text-red-600 dark:text-red-400" id="remote-path-error">
          {{ validationErrors.remotePath }}
        </p>
      </div>
      <button
        type="submit"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        :disabled="isSaving"
      >
        {{ isSaving ? 'Saving...' : 'Save Settings' }}
      </button>
      <p v-if="feedbackMessage" :class="feedbackMessageClass" class="mt-3 text-sm p-3 rounded-md" :role="feedbackIsError ? 'alert' : 'status'">
        {{ feedbackMessage }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue';
import { StorageFactory } from '@prompt-optimizer/core/services/storage';
import type { IStorageProvider } from '@prompt-optimizer/core/services/storage';
import type { WebDAVSettings as CoreWebDAVSettings } from '@prompt-optimizer/core/services/backup';

const WEBDAV_SETTINGS_KEY = 'webdav_settings';

interface LocalWebDAVSettings extends CoreWebDAVSettings {}

const settings = ref<LocalWebDAVSettings>({
  serverUrl: '',
  username: '',
  password: '',
  remotePath: '',
});

const validationErrors = reactive({
  serverUrl: '',
  remotePath: ''
});

const isSaving = ref(false);
const feedbackMessage = ref('');
const feedbackIsError = ref(false);

const feedbackMessageClass = computed(() => ({
  'bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300': !feedbackIsError.value && feedbackMessage.value,
  'bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300': feedbackIsError.value && feedbackMessage.value,
}));


let storageProvider: IStorageProvider | null = null;

onMounted(async () => {
  try {
    storageProvider = await StorageFactory.createDefault();
    await loadSettings();
  } catch (error: any) {
    console.error('Failed to initialize storage provider:', error);
    feedbackMessage.value = `Critical Error: Could not load storage provider. Settings cannot be loaded or saved. Details: ${error.message || error}`;
    feedbackIsError.value = true;
  }
});

async function loadSettings() {
  if (!storageProvider) {
    // This case should ideally be handled by the onMounted error state
    feedbackMessage.value = 'Storage provider not available. Cannot load settings.';
    feedbackIsError.value = true;
    return;
  }
  try {
    isSaving.value = true; // Use isSaving to indicate loading state as well
    feedbackMessage.value = 'Loading settings...';
    feedbackIsError.value = false;
    const storedSettings = await storageProvider.getItem<LocalWebDAVSettings>(WEBDAV_SETTINGS_KEY);
    if (storedSettings) {
      settings.value = { ...settings.value, ...storedSettings };
      feedbackMessage.value = 'Settings loaded.';
    } else {
      feedbackMessage.value = 'No saved settings found. Please configure your WebDAV details.';
    }
    setTimeout(() => { if(feedbackMessage.value === 'Settings loaded.' || feedbackMessage.value === 'No saved settings found. Please configure your WebDAV details.') feedbackMessage.value = ''; }, 3000);
  } catch (error: any) {
    console.error('Failed to load WebDAV settings:', error);
    feedbackMessage.value = `Error loading settings: ${error.message || 'Unknown error'}. Please try again.`;
    feedbackIsError.value = true;
  } finally {
    isSaving.value = false;
  }
}

function validateSettings(): boolean {
  let isValid = true;
  validationErrors.serverUrl = '';
  validationErrors.remotePath = '';

  if (!settings.value.serverUrl) {
    validationErrors.serverUrl = 'Server URL is required.';
    isValid = false;
  } else {
    try {
      const url = new URL(settings.value.serverUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        validationErrors.serverUrl = 'Server URL must start with http:// or https://';
        isValid = false;
      }
    } catch (_) {
      validationErrors.serverUrl = 'Invalid Server URL format.';
      isValid = false;
    }
  }

  if (settings.value.remotePath && (settings.value.remotePath.startsWith('/') || settings.value.remotePath.endsWith('/'))) {
    validationErrors.remotePath = 'Remote path should not start or end with a slash (e.g., "backup/file.json").';
    isValid = false;
  }
  // Add more specific path validation if needed, e.g. for allowed characters

  return isValid;
}

async function saveSettings() {
  if (!storageProvider) {
    feedbackMessage.value = 'Critical Error: Storage provider not available. Cannot save settings.';
    feedbackIsError.value = true;
    return;
  }

  if (!validateSettings()) {
    feedbackMessage.value = 'Please correct the errors above.';
    feedbackIsError.value = true;
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = 'Saving settings...';
  feedbackIsError.value = false;

  try {
    // Omit password from being stored if it's empty, to avoid overwriting a potentially existing one
    // This is a choice: another approach is to always save what's in the form.
    // However, for passwords, often users expect an empty field to mean "no change".
    // This example assumes we save what's in the form directly.
    // If settings.value.password is an empty string and you want to avoid clearing a stored password,
    // you might fetch existing settings and merge, or handle password updates more explicitly.

    await storageProvider.setItem(WEBDAV_SETTINGS_KEY, settings.value);
    feedbackMessage.value = 'Settings saved successfully!';
    setTimeout(() => { if(feedbackMessage.value === 'Settings saved successfully!') feedbackMessage.value = ''; }, 3000);
  } catch (error: any) {
    console.error('Failed to save WebDAV settings:', error);
    feedbackMessage.value = `Failed to save settings: ${error.message || 'An unknown error occurred'}. Please try again.`;
    feedbackIsError.value = true;
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
/* Feedback message styling for better visibility */
.p-3 {
  padding: 0.75rem;
}
</style>
