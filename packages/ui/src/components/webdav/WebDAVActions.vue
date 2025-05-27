<template>
  <div class="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800 mt-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">WebDAV Actions</h2>
    <div class="space-y-4">
      <div>
        <button
          @click="performBackup"
          :disabled="isActionInProgress"
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="backupState.inProgress">{{ backupState.statusText }}</span>
          <span v-else>Backup to WebDAV</span>
        </button>
      </div>
      <div>
        <button
          @click="initiateRestore"
          :disabled="isActionInProgress"
          class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="restoreState.inProgress">{{ restoreState.statusText }}</span>
          <span v-else>Restore from WebDAV</span>
        </button>
      </div>
      <p v-if="actionFeedback.message" :class="actionFeedbackMessageClass" class="mt-3 text-sm p-3 rounded-md" :role="actionFeedback.isError ? 'alert' : 'status'">
        {{ actionFeedback.message }}
      </p>
    </div>

    <!-- Restore Confirmation Modal -->
    <div v-if="showRestoreConfirmation" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-50 flex items-center justify-center">
      <div class="relative p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Confirm Restore</h3>
        <div class="mt-2">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Restoring from WebDAV will <strong class="font-semibold">overwrite all current application data</strong>. This action cannot be undone. Are you sure you want to proceed?
          </p>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            @click="confirmRestore"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
            :disabled="restoreState.inProgress"
          >
            {{ restoreState.inProgress ? 'Restoring...' : 'Yes, Restore Data' }}
          </button>
          <button
            type="button"
            @click="cancelRestore"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            :disabled="restoreState.inProgress"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { StorageFactory, IStorageProvider } from '@prompt-optimizer/core/services/storage';
import { 
    BackupService, 
    WebDAVSettings as CoreWebDAVSettings, 
    BackupResult, 
    RestoreResult,
    WebDAVSettingsMissingError,
    BackupConfigurationError,
    RestoreConfigurationError,
    BackupStorageProviderError,
    RestoreStorageProviderError,
} from '@prompt-optimizer/core/services/backup';
import { 
    WebDAVError,
    WebDAVAuthenticationError,
    WebDAVConnectionError,
    WebDAVFileNotFoundError,
    WebDAVForbiddenError,
    WebDAVInsufficientStorageError,
    WebDAVInvalidPathError,
    // Add other specific WebDAV errors if needed
} from '@prompt-optimizer/core/services/webdav';


const WEBDAV_SETTINGS_KEY = 'webdav_settings';

interface ActionState {
  inProgress: boolean;
  statusText: string;
}

const backupState = reactive<ActionState>({ inProgress: false, statusText: 'Backup to WebDAV' });
const restoreState = reactive<ActionState>({ inProgress: false, statusText: 'Restore from WebDAV' });

const actionFeedback = reactive({
    message: '',
    isError: false,
});

const isActionInProgress = computed(() => backupState.inProgress || restoreState.inProgress);
const showRestoreConfirmation = ref(false);

const actionFeedbackMessageClass = computed(() => ({
  'bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300': !actionFeedback.isError && actionFeedback.message,
  'bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300': actionFeedback.isError && actionFeedback.message,
}));

let storageProvider: IStorageProvider | null = null;
let backupService: BackupService | null = null;

function setFeedback(message: string, isError: boolean, duration: number = 0) {
    actionFeedback.message = message;
    actionFeedback.isError = isError;
    if (duration > 0) {
        setTimeout(() => {
            if (actionFeedback.message === message) { // Clear only if it hasn't been overwritten
                actionFeedback.message = '';
            }
        }, duration);
    }
}

onMounted(async () => {
  try {
    storageProvider = await StorageFactory.createDefault();
    if (storageProvider) {
      const castedProvider = storageProvider as any;
      if (
        typeof castedProvider.exportAll !== 'function' ||
        typeof castedProvider.importAll !== 'function' ||
        typeof castedProvider.clearAll !== 'function'
      ) {
         setFeedback('Storage provider is not fully compatible with backup/restore (missing required methods: exportAll, importAll, or clearAll). Backup/Restore disabled.', true);
         backupState.inProgress = true; // Effectively disable buttons
         restoreState.inProgress = true;
         return;
      }
      backupService = new BackupService(storageProvider);
    } else {
      setFeedback('Critical Error: Storage provider not available. Backup/Restore disabled.', true);
      backupState.inProgress = true; // Effectively disable buttons
      restoreState.inProgress = true;
    }
  } catch (error: any) {
    console.error('Failed to initialize services for WebDAVActions:', error);
    setFeedback(`Critical Error initializing services: ${error.message || 'Unknown error'}. Backup/Restore disabled.`, true);
    backupState.inProgress = true; // Effectively disable buttons
    restoreState.inProgress = true;
  }
});

async function getWebDAVSettings(): Promise<CoreWebDAVSettings | null> {
  if (!storageProvider) {
    setFeedback('Error: Storage not available to load WebDAV settings.', true);
    return null;
  }
  try {
    const settings = await storageProvider.getItem<CoreWebDAVSettings>(WEBDAV_SETTINGS_KEY);
    if (!settings || !settings.serverUrl) {
      setFeedback('WebDAV settings not configured. Please go to "WebDAV Configuration" and save your settings first.', true, 5000);
      return null;
    }
    return settings;
  } catch (error: any) {
    console.error('Failed to load WebDAV settings:', error);
    setFeedback(`Error loading WebDAV settings: ${error.message || 'Unknown error'}.`, true);
    return null;
  }
}

function mapErrorToUserMessage(error: any): string {
    if (error instanceof WebDAVSettingsMissingError) {
        return "WebDAV settings are missing. Please configure them first.";
    }
    if (error instanceof WebDAVAuthenticationError) {
        return `WebDAV Authentication Failed: ${error.message} Please check your credentials and server URL.`;
    }
    if (error instanceof WebDAVConnectionError) {
        return `WebDAV Connection Error: ${error.message} Ensure the server URL is correct and the server is accessible.`;
    }
    if (error instanceof WebDAVFileNotFoundError) {
        return `WebDAV File Not Found: ${error.message} Ensure the remote path is correct and the file exists for restore.`;
    }
    if (error instanceof WebDAVForbiddenError) {
        return `WebDAV Access Forbidden: ${error.message} Check permissions for the specified path on the server.`;
    }
    if (error instanceof WebDAVInsufficientStorageError) {
        return `WebDAV Insufficient Storage: ${error.message} There may not be enough space on the server.`;
    }
     if (error instanceof WebDAVInvalidPathError) {
        return `WebDAV Invalid Path: ${error.message} The specified remote path is not valid.`;
    }
    if (error instanceof BackupConfigurationError || error instanceof RestoreConfigurationError) {
        return `Configuration Error: ${error.message}`;
    }
    if (error instanceof BackupStorageProviderError || error instanceof RestoreStorageProviderError) {
        return `Storage Provider Error: ${error.message}`;
    }
    if (error instanceof WebDAVError) { // Generic WebDAV error
        return `A WebDAV operational error occurred: ${error.message}`;
    }
    // Generic backup/restore errors from BackupService if not more specific
    if (error.name === 'BackupError' || error.name === 'RestoreError') {
        return `Operation failed: ${error.message}`;
    }
    return `An unexpected error occurred: ${error.message || 'Unknown error'}. Check console for details.`;
}


async function performBackup() {
  if (!backupService) {
     setFeedback('Backup service not initialized. Cannot perform backup.', true, 5000);
     return;
  }
  const webDAVSettings = await getWebDAVSettings();
  if (!webDAVSettings) return;

  backupState.inProgress = true;
  backupState.statusText = 'Backing up...';
  setFeedback('Starting backup...', false);

  try {
    const result: BackupResult = await backupService.backupToWebDAV(webDAVSettings);
    if (result.success) {
      setFeedback(result.message || 'Backup successful!', false, 5000);
    } else {
      // This case should ideally not be reached if errors are thrown
      setFeedback(result.error || 'Unknown backup error occurred.', true);
    }
  } catch (error: any) {
    console.error('Backup failed:', error);
    setFeedback(mapErrorToUserMessage(error), true);
  } finally {
    backupState.inProgress = false;
    backupState.statusText = 'Backup to WebDAV';
  }
}

function initiateRestore() {
  if (!backupService) {
     setFeedback('Restore service not initialized. Cannot perform restore.', true, 5000);
     return;
  }
  // Clear previous messages before showing confirmation
  setFeedback('', false);
  showRestoreConfirmation.value = true;
}

function cancelRestore() {
  showRestoreConfirmation.value = false;
  setFeedback('Restore cancelled.', false, 3000);
}

async function confirmRestore() {
  showRestoreConfirmation.value = false;
  if (!backupService) {
     setFeedback('Restore service not initialized. Cannot perform restore.', true, 5000);
     return;
  }

  const webDAVSettings = await getWebDAVSettings();
  if (!webDAVSettings) return;

  restoreState.inProgress = true;
  restoreState.statusText = 'Restoring...';
  setFeedback('Starting restore...', false);

  try {
    const result: RestoreResult = await backupService.restoreFromWebDAV(webDAVSettings);
     if (result.success) {
      setFeedback(result.message || 'Restore successful! Application data has been updated.', false, 7000);
    } else {
      // This case should ideally not be reached
      setFeedback(result.error || 'Unknown restore error occurred.', true);
    }
  } catch (error: any) {
    console.error('Restore failed:', error);
    setFeedback(mapErrorToUserMessage(error), true);
  } finally {
    restoreState.inProgress = false;
    restoreState.statusText = 'Restore from WebDAV';
  }
}

</script>

<style scoped>
/* Ensure consistent button heights and loading states */
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.fixed.inset-0 { /* Ensure modal is on top */
  z-index: 1000; 
}
</style>
