import { IStorageProvider } from '../storage/types';
import { WebDAVService } from '../webdav/webdav';
import { WebDAVSettings, BackupResult, RestoreResult } from './types';
import { 
  BackupError, 
  RestoreError, 
  BackupConfigurationError,
  RestoreConfigurationError,
  WebDAVSettingsMissingError,
  BackupStorageProviderError,
  RestoreStorageProviderError
} from './errors';
import { WebDAVClientOptions, createClient } from 'webdav';
import { WebDAVError } from '../webdav/errors'; // Import base WebDAVError for instanceof checks

// Define a type for storage providers that support backup/restore operations.
interface IBackupableStorageProvider extends IStorageProvider {
  exportAll: () => Promise<any>;
  importAll: (data: any) => Promise<void>;
  clearAll: () => Promise<void>; // Made clearAll mandatory for IBackupableStorageProvider
  readonly providerName: string; // To identify the provider in logs/errors
}

export class BackupService {
  private storageProvider: IBackupableStorageProvider;
  private webdavServiceInstance?: WebDAVService;

  constructor(storageProvider: IStorageProvider, webdavService?: WebDAVService) {
    if (typeof (storageProvider as any).exportAll !== 'function') {
      throw new BackupConfigurationError(
        `StorageProvider '${(storageProvider as any).providerName || 'Unknown'}' must implement exportAll method.`
      );
    }
    if (typeof (storageProvider as any).importAll !== 'function') {
      throw new BackupConfigurationError(
        `StorageProvider '${(storageProvider as any).providerName || 'Unknown'}' must implement importAll method.`
      );
    }
    if (typeof (storageProvider as any).clearAll !== 'function') {
        throw new BackupConfigurationError(
            `StorageProvider '${(storageProvider as any).providerName || 'Unknown'}' must implement clearAll method for restore functionality.`
        );
    }
    this.storageProvider = storageProvider as IBackupableStorageProvider;
    this.webdavServiceInstance = webdavService; // Can be undefined if not provided
  }

  private getWebDAVService(settings: WebDAVSettings): WebDAVService {
    if (!settings || !settings.serverUrl) {
      throw new WebDAVSettingsMissingError('WebDAV server URL is not configured.');
    }
    // If a service instance is provided and it's configured with the same URL, reuse it.
    // This is a simplistic check; a more robust check might involve more settings.
    if (this.webdavServiceInstance && (this.webdavServiceInstance as any).remoteURL === settings.serverUrl) {
        // Potentially re-configure credentials if they can change
        // For now, assume if URL matches, it's usable or re-created if credentials differ.
        // This part depends on how WebDAVService handles re-configuration.
        // If WebDAVService is immutable regarding its options, always create a new one.
    }

    const clientOptions: WebDAVClientOptions = {
      remoteURL: settings.serverUrl,
      username: settings.username,
      password: settings.password,
      // TODO: Consider passing other options like headers from settings if needed
    };
    // Always create a new client for simplicity and to ensure fresh auth details are used.
    return new WebDAVService(createClient(settings.serverUrl, clientOptions));
  }

  async backupToWebDAV(webDAVSettings: WebDAVSettings): Promise<BackupResult> {
    if (!webDAVSettings || !webDAVSettings.serverUrl) {
      throw new WebDAVSettingsMissingError();
    }
    const remotePath = webDAVSettings.remotePath || 'prompt_optimizer_backup.json'; // More specific default
    let data;
    try {
      data = await this.storageProvider.exportAll();
    } catch (error: any) {
      throw new BackupStorageProviderError(this.storageProvider.providerName, 'exportAll', error);
    }

    let jsonData;
    try {
      jsonData = JSON.stringify(data);
    } catch (error: any) {
      throw new BackupError(`Failed to serialize data for backup: ${error.message}`, error);
    }
    
    const webdavService = this.getWebDAVService(webDAVSettings);
    try {
      await webdavService.uploadFile(remotePath, jsonData);
      return { success: true, message: `Backup successful to ${webDAVSettings.serverUrl}/${remotePath}` };
    } catch (error: any) {
      if (error instanceof WebDAVError) { // Check if it's one of our custom WebDAV errors
         throw new BackupError(`WebDAV operation failed during backup: ${error.message}`, error);
      }
      // For unexpected errors from WebDAVService or other issues
      throw new BackupError(`An unexpected error occurred during WebDAV backup: ${error.message}`, error);
    }
  }

  async restoreFromWebDAV(webDAVSettings: WebDAVSettings): Promise<RestoreResult> {
    if (!webDAVSettings || !webDAVSettings.serverUrl) {
      throw new WebDAVSettingsMissingError();
    }
    const remotePath = webDAVSettings.remotePath || 'prompt_optimizer_backup.json';
    
    const webdavService = this.getWebDAVService(webDAVSettings);
    let jsonData;
    try {
      jsonData = await webdavService.downloadFile(remotePath);
    } catch (error: any) {
       if (error instanceof WebDAVError) {
         throw new RestoreError(`WebDAV operation failed during restore: ${error.message}`, error);
      }
      throw new RestoreError(`An unexpected error occurred during WebDAV download: ${error.message}`, error);
    }

    let data;
    try {
      data = JSON.parse(jsonData);
    } catch (error: any) {
      throw new RestoreError(`Failed to parse backup data: ${error.message}. The backup file might be corrupted.`, error);
    }

    try {
      await this.storageProvider.clearAll();
    } catch (error: any) {
      throw new RestoreStorageProviderError(this.storageProvider.providerName, 'clearAll', error);
    }

    try {
      await this.storageProvider.importAll(data);
    } catch (error: any) {
      throw new RestoreStorageProviderError(this.storageProvider.providerName, 'importAll', error);
    }
      
    return { success: true, message: `Restore successful from ${webDAVSettings.serverUrl}/${remotePath}` };
  }
}
