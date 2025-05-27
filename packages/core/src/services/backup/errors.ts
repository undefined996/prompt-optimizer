// Custom error classes for the BackupService

export class BackupError extends Error {
  public originalError?: any;
  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'BackupError';
    this.originalError = originalError;
     if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

export class RestoreError extends Error {
  public originalError?: any;
  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'RestoreError';
    this.originalError = originalError;
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

export class BackupConfigurationError extends BackupError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'BackupConfigurationError';
  }
}

export class RestoreConfigurationError extends RestoreError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'RestoreConfigurationError';
  }
}

export class WebDAVSettingsMissingError extends BackupConfigurationError {
  constructor(message: string = 'WebDAV settings are missing or incomplete. Please configure them before proceeding.') {
    super(message);
    this.name = 'WebDAVSettingsMissingError';
  }
}

export class StorageProviderError extends Error { // Can be used by both Backup and Restore
  public originalError?: any;
  constructor(providerName: string, operation: 'exportAll' | 'importAll' | 'clearAll' | 'getItem' | 'setItem', message: string, originalError?: any) {
    super(`Error with storage provider '${providerName}' during ${operation}: ${message}`, originalError);
    this.name = 'StorageProviderError';
    this.originalError = originalError;
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

export class BackupStorageProviderError extends BackupError {
    constructor(providerName: string, operation: 'exportAll' | 'clearAll' | 'getItem' | 'setItem', originalError?: any) {
        const message = originalError?.message || `Storage provider operation ${operation} failed.`;
        super(`Backup failed due to storage provider '${providerName}' error during ${operation}: ${message}`, originalError);
        this.name = 'BackupStorageProviderError';
    }
}

export class RestoreStorageProviderError extends RestoreError {
    constructor(providerName: string, operation: 'importAll' | 'clearAll' | 'getItem' | 'setItem', originalError?: any) {
        const message = originalError?.message || `Storage provider operation ${operation} failed.`;
        super(`Restore failed due to storage provider '${providerName}' error during ${operation}: ${message}`, originalError);
        this.name = 'RestoreStorageProviderError';
    }
}
