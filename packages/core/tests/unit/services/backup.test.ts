import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from '../../../src/services/backup/backup';
import { WebDAVService } from '../../../src/services/webdav/webdav';
import type { IStorageProvider } from '../../../src/services/storage/types';
import type { WebDAVSettings } from '../../../src/services/backup/types';
import {
  BackupConfigurationError,
  WebDAVSettingsMissingError,
  BackupStorageProviderError,
  RestoreStorageProviderError,
  BackupError,
  RestoreError,
} from '../../../src/services/backup/errors';
import { WebDAVUploadError, WebDAVDownloadError, WebDAVError } from '../../../src/services/webdav/errors';

// Mocks
const mockExportAll = vi.fn();
const mockImportAll = vi.fn();
const mockClearAll = vi.fn();
const mockUploadFile = vi.fn();
const mockDownloadFile = vi.fn();

const mockStorageProvider = {
  exportAll: mockExportAll,
  importAll: mockImportAll,
  clearAll: mockClearAll,
  providerName: 'MockStorage',
  // getItem and setItem are not directly used by BackupService but are part of IStorageProvider
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  getKeys: vi.fn(),
  clear: vi.fn(), // Also part of IStorageProvider
} as IStorageProvider;


// Mock WebDAVService constructor and its methods
vi.mock('../../../src/services/webdav/webdav', () => {
  return {
    WebDAVService: vi.fn().mockImplementation(() => {
      return {
        uploadFile: mockUploadFile,
        downloadFile: mockDownloadFile,
        // Add remoteURL to mock instance if getWebDAVService checks it
        remoteURL: 'https://mock-server.com/dav/' 
      };
    }),
    // Export WebDAVError and its children from the actual module for instanceof checks
    ...vi.importActual('../../../src/services/webdav/errors') 
  };
});


// Mock createClient from 'webdav' as BackupService's getWebDAVService creates a new WebDAVService instance
vi.mock('webdav', () => ({
  createClient: vi.fn(() => ({
      // Mock client instance returned by createClient if needed by WebDAVService internals
      // For these tests, WebDAVService itself is mocked, so createClient's return might not be deeply used.
  })),
}));


describe('BackupService', () => {
  const webDAVSettings: WebDAVSettings = {
    serverUrl: 'https://test-server.com/dav',
    username: 'user',
    password: 'password',
    remotePath: 'backups/backup.json',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create an instance if storageProvider has all methods', () => {
      const service = new BackupService(mockStorageProvider);
      expect(service).toBeInstanceOf(BackupService);
    });

    it('should throw BackupConfigurationError if exportAll is missing', () => {
      const incompleteProvider = { ...mockStorageProvider, exportAll: undefined } as any;
      expect(() => new BackupService(incompleteProvider)).toThrow(BackupConfigurationError);
      expect(() => new BackupService(incompleteProvider)).toThrow(/must implement exportAll method/);
    });

    it('should throw BackupConfigurationError if importAll is missing', () => {
      const incompleteProvider = { ...mockStorageProvider, importAll: undefined } as any;
      expect(() => new BackupService(incompleteProvider)).toThrow(BackupConfigurationError);
      expect(() => new BackupService(incompleteProvider)).toThrow(/must implement importAll method/);
    });
    
    it('should throw BackupConfigurationError if clearAll is missing', () => {
      const incompleteProvider = { ...mockStorageProvider, clearAll: undefined } as any;
      expect(() => new BackupService(incompleteProvider)).toThrow(BackupConfigurationError);
      expect(() => new BackupService(incompleteProvider)).toThrow(/must implement clearAll method/);
    });
  });

  describe('backupToWebDAV', () => {
    it('should successfully backup data', async () => {
      const service = new BackupService(mockStorageProvider);
      const mockData = { key: 'value' };
      mockExportAll.mockResolvedValueOnce(mockData);
      mockUploadFile.mockResolvedValueOnce(undefined);

      const result = await service.backupToWebDAV(webDAVSettings);

      expect(mockExportAll).toHaveBeenCalledOnce();
      expect(WebDAVService).toHaveBeenCalledOnce(); // Check if WebDAVService constructor was called
      expect(mockUploadFile).toHaveBeenCalledWith(webDAVSettings.remotePath, JSON.stringify(mockData));
      expect(result.success).toBe(true);
      expect(result.message).toContain('Backup successful');
    });

    it('should use default remotePath if not provided', async () => {
        const service = new BackupService(mockStorageProvider);
        const settingsWithoutPath = { ...webDAVSettings, remotePath: undefined };
        mockExportAll.mockResolvedValueOnce({});
        mockUploadFile.mockResolvedValueOnce(undefined);

        await service.backupToWebDAV(settingsWithoutPath);
        expect(mockUploadFile).toHaveBeenCalledWith('prompt_optimizer_backup.json', JSON.stringify({}));
    });

    it('should throw WebDAVSettingsMissingError if serverUrl is missing', async () => {
      const service = new BackupService(mockStorageProvider);
      const incompleteSettings = { ...webDAVSettings, serverUrl: '' };
      await expect(service.backupToWebDAV(incompleteSettings)).rejects.toThrow(WebDAVSettingsMissingError);
    });

    it('should throw BackupStorageProviderError if exportAll fails', async () => {
      const service = new BackupService(mockStorageProvider);
      mockExportAll.mockRejectedValueOnce(new Error('Export failed'));
      await expect(service.backupToWebDAV(webDAVSettings)).rejects.toThrow(BackupStorageProviderError);
      await expect(service.backupToWebDAV(webDAVSettings)).rejects.toThrow(/Backup failed due to storage provider 'MockStorage' error during exportAll: Export failed/);
    });
    
    it('should throw BackupError if JSON.stringify fails', async () => {
        const service = new BackupService(mockStorageProvider);
        const circularData = { a: {} };
        circularData.a = circularData; // Create circular reference
        mockExportAll.mockResolvedValueOnce(circularData);
        
        await expect(service.backupToWebDAV(webDAVSettings)).rejects.toThrow(BackupError);
        await expect(service.backupToWebDAV(webDAVSettings)).rejects.toThrow(/Failed to serialize data for backup/);
    });

    it('should throw BackupError if WebDAVService.uploadFile fails', async () => {
      const service = new BackupService(mockStorageProvider);
      mockExportAll.mockResolvedValueOnce({ key: 'value' });
      const webdavError = new WebDAVUploadError(webDAVSettings.remotePath!, new Error('Network issue'));
      mockUploadFile.mockRejectedValueOnce(webdavError);

      await expect(service.backupToWebDAV(webDAVSettings)).rejects.toThrow(BackupError);
      await expect(service.backupToWebDAV(webDAVSettings)).rejects.toThrow(/WebDAV operation failed during backup: Failed to write file\/directory/);
    });
  });

  describe('restoreFromWebDAV', () => {
    const mockJsonData = JSON.stringify({ key: 'restoredValue' });
    const mockParsedData = { key: 'restoredValue' };

    it('should successfully restore data', async () => {
      const service = new BackupService(mockStorageProvider);
      mockDownloadFile.mockResolvedValueOnce(mockJsonData);
      mockClearAll.mockResolvedValueOnce(undefined);
      mockImportAll.mockResolvedValueOnce(undefined);

      const result = await service.restoreFromWebDAV(webDAVSettings);

      expect(WebDAVService).toHaveBeenCalledOnce();
      expect(mockDownloadFile).toHaveBeenCalledWith(webDAVSettings.remotePath);
      expect(mockClearAll).toHaveBeenCalledOnce();
      expect(mockImportAll).toHaveBeenCalledWith(mockParsedData);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Restore successful');
    });
    
    it('should throw WebDAVSettingsMissingError if serverUrl is missing for restore', async () => {
      const service = new BackupService(mockStorageProvider);
      const incompleteSettings = { ...webDAVSettings, serverUrl: '' };
      await expect(service.restoreFromWebDAV(incompleteSettings)).rejects.toThrow(WebDAVSettingsMissingError);
    });

    it('should throw RestoreError if WebDAVService.downloadFile fails', async () => {
      const service = new BackupService(mockStorageProvider);
      const webdavError = new WebDAVDownloadError(webDAVSettings.remotePath!, new Error('Server unavailable'));
      mockDownloadFile.mockRejectedValueOnce(webdavError);
      
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(RestoreError);
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(/WebDAV operation failed during restore: Failed to read file\/directory/);
    });

    it('should throw RestoreError if JSON.parse fails', async () => {
      const service = new BackupService(mockStorageProvider);
      mockDownloadFile.mockResolvedValueOnce('invalid json');
      
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(RestoreError);
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(/Failed to parse backup data/);
    });

    it('should throw RestoreStorageProviderError if clearAll fails', async () => {
      const service = new BackupService(mockStorageProvider);
      mockDownloadFile.mockResolvedValueOnce(mockJsonData);
      mockClearAll.mockRejectedValueOnce(new Error('Clear failed'));
      
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(RestoreStorageProviderError);
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(/Restore failed due to storage provider 'MockStorage' error during clearAll: Clear failed/);
    });

    it('should throw RestoreStorageProviderError if importAll fails', async () => {
      const service = new BackupService(mockStorageProvider);
      mockDownloadFile.mockResolvedValueOnce(mockJsonData);
      mockClearAll.mockResolvedValueOnce(undefined);
      mockImportAll.mockRejectedValueOnce(new Error('Import failed'));
      
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(RestoreStorageProviderError);
      await expect(service.restoreFromWebDAV(webDAVSettings)).rejects.toThrow(/Restore failed due to storage provider 'MockStorage' error during importAll: Import failed/);
    });
  });
  
  describe('getWebDAVService internal behavior', () => {
    it('should create a new WebDAVService instance when called', () => {
        const service = new BackupService(mockStorageProvider);
        // @ts-ignore access private method
        service.getWebDAVService(webDAVSettings);
        expect(WebDAVService).toHaveBeenCalledTimes(1);
         // @ts-ignore
        service.getWebDAVService(webDAVSettings);
        expect(WebDAVService).toHaveBeenCalledTimes(2); // Verifies it's created each time
    });

    it('should use provided WebDAVService instance if constructor was called with one (and settings match - current impl always new)', () => {
        const preconfiguredWebDAVService = new WebDAVService(clientOptions); // WebDAVService is mocked, this calls the mock constructor
        vi.clearAllMocks(); // Clear mocks after preconfiguredWebDAVService instantiation
        
        const backupServiceWithInstance = new BackupService(mockStorageProvider, preconfiguredWebDAVService);
         // @ts-ignore access private method
        const SUTWebDAVService = backupServiceWithInstance.getWebDAVService(webDAVSettings);

        // Current implementation of getWebDAVService in BackupService *always* creates a new client.
        // So, the preconfigured instance won't be returned unless BackupService logic changes.
        // This test reflects current reality. If getWebDAVService is changed to reuse instances, this test needs an update.
        expect(WebDAVService).toHaveBeenCalledTimes(1); // Called by getWebDAVService
        expect(SUTWebDAVService).not.toBe(preconfiguredWebDAVService);
    });
  });

});
