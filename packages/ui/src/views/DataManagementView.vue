<template>
  <div class="container mx-auto p-4 md:p-6 lg:p-8">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Data Management</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Manage your application data, including backup and restore options via WebDAV.
      </p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section aria-labelledby="webdav-settings-heading">
        <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <div class="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 id="webdav-settings-heading" class="text-lg font-medium text-gray-900 dark:text-white">
              WebDAV Configuration
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure your WebDAV server details to enable remote backups and restores.
            </p>
          </div>
          <div class="p-5">
            <WebDAVSettings />
          </div>
        </div>
      </section>

      <section aria-labelledby="webdav-actions-heading">
         <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <div class="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 id="webdav-actions-heading" class="text-lg font-medium text-gray-900 dark:text-white">
              Backup & Restore
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Perform backup or restore operations using the configured WebDAV server.
            </p>
          </div>
          <div class="p-5">
            <WebDAVActions />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import WebDAVSettings from '@/components/webdav/WebDAVSettings.vue';
import WebDAVActions from '@/components/webdav/WebDAVActions.vue';

// No additional script logic needed for this view as components are self-contained.
</script>

<style scoped>
/* Scoped styles for DataManagementView if necessary */
.container {
  max-width: 1280px; /* Example max width */
}
</style>
