import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WebDAVActionsVue from '../../../../src/components/webdav/WebDAVActions.vue';
import { StorageFactory, IStorageProvider } from '@prompt-optimizer/core/services/storage';
import { 
    BackupService, 
    WebDAVSettingsMissingError,
    BackupConfigurationError,
} from '@prompt-optimizer/core/services/backup';
import { 
    WebDAVAuthenticationError, 
    WebDAVConnectionError,
    WebDAVFileNotFoundError,
    WebDAVForbiddenError,
    WebDAVError, // Generic WebDAV error for testing
} from '@prompt-optimizer/core/services/webdav';

// Mocks
const mockGetItem = vi.fn();
const mockStorageProvider = {
  getItem: mockGetItem,
  setItem: vi.fn(),
  exportAll: vi.fn(),
  importAll: vi.fn(),
  clearAll: vi.fn(),
  providerName: 'MockActionsStorage',
  removeItem: vi.fn(), getKeys: vi.fn(), clear: vi.fn(),
} as IStorageProvider;

const mockBackupToWebDAV = vi.fn();
const mockRestoreFromWebDAV = vi.fn();

vi.mock('@prompt-optimizer/core/services/storage', () => ({
  StorageFactory: {
    createDefault: vi.fn(() => Promise.resolve(mockStorageProvider)),
  },
  // Export IStorageProvider if needed for type hints in tests, though it's an interface
}));

vi.mock('@prompt-optimizer/core/services/backup', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original, // Export actual error classes
    BackupService: vi.fn(() => ({
      backupToWebDAV: mockBackupToWebDAV,
      restoreFromWebDAV: mockRestoreFromWebDAV,
    })),
  };
});

// Also ensure WebDAV errors are available for mapping tests
vi.mock('@prompt-optimizer/core/services/webdav', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original, // Export actual error classes
  };
});


const WEBDAV_SETTINGS_KEY = 'webdav_settings';
const mockWebDAVSettings = { serverUrl: 'https://mock-dav.com', username: 'user', remotePath: 'backup.json' };

describe('WebDAVActions.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure StorageFactory mock is reset for onMounted tests
     StorageFactory.createDefault = vi.fn(() => Promise.resolve(mockStorageProvider));
  });

  it('renders buttons correctly', () => {
    const wrapper = mount(WebDAVActionsVue);
    expect(wrapper.find('button.bg-blue-600').text()).toContain('Backup to WebDAV');
    expect(wrapper.find('button.bg-green-600').text()).toContain('Restore from WebDAV');
  });

  it('disables buttons if storageProvider is not compatible on mount', async () => {
    const incompatibleProvider = { ...mockStorageProvider, exportAll: undefined };
    StorageFactory.createDefault = vi.fn(() => Promise.resolve(incompatibleProvider as any));
    const wrapper = mount(WebDAVActionsVue);
    await flushPromises();
    // @ts-ignore
    expect(wrapper.vm.actionFeedback.message).toContain('Storage provider is not fully compatible');
    // @ts-ignore
    expect(wrapper.vm.backupState.inProgress).toBe(true); // Buttons effectively disabled
    // @ts-ignore
    expect(wrapper.vm.restoreState.inProgress).toBe(true);
  });
  
  it('disables buttons if StorageFactory fails on mount', async () => {
    StorageFactory.createDefault = vi.fn().mockRejectedValueOnce(new Error('Storage Ctor Fail'));
    const wrapper = mount(WebDAVActionsVue);
    await flushPromises();
    // @ts-ignore
    expect(wrapper.vm.actionFeedback.message).toContain('Critical Error initializing services: Storage Ctor Fail');
    // @ts-ignore
    expect(wrapper.vm.backupState.inProgress).toBe(true);
    // @ts-ignore
    expect(wrapper.vm.restoreState.inProgress).toBe(true);
  });


  describe('performBackup', () => {
    it('calls backupService.backupToWebDAV and shows success', async () => {
      mockGetItem.mockResolvedValueOnce(mockWebDAVSettings);
      mockBackupToWebDAV.mockResolvedValueOnce({ success: true, message: 'Backup done!' });
      const wrapper = mount(WebDAVActionsVue);
      await flushPromises(); // onMounted

      await wrapper.find('button.bg-blue-600').trigger('click');
      await flushPromises();

      expect(mockBackupToWebDAV).toHaveBeenCalledWith(mockWebDAVSettings);
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.message).toBe('Backup done!');
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.isError).toBe(false);
      // @ts-ignore
      expect(wrapper.vm.backupState.inProgress).toBe(false);
    });

    it('shows error if WebDAV settings are not configured', async () => {
      mockGetItem.mockResolvedValueOnce(null); // No settings
      const wrapper = mount(WebDAVActionsVue);
      await flushPromises();

      await wrapper.find('button.bg-blue-600').trigger('click');
      await flushPromises();

      expect(mockBackupToWebDAV).not.toHaveBeenCalled();
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.message).toContain('WebDAV settings not configured');
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.isError).toBe(true);
    });

    it('handles WebDAVAuthenticationError from backupService', async () => {
      mockGetItem.mockResolvedValueOnce(mockWebDAVSettings);
      mockBackupToWebDAV.mockRejectedValueOnce(new WebDAVAuthenticationError('Bad creds'));
      const wrapper = mount(WebDAVActionsVue);
      await flushPromises();

      await wrapper.find('button.bg-blue-600').trigger('click');
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.message).toContain('WebDAV Authentication Failed: Bad creds');
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.isError).toBe(true);
    });
    
    it('handles generic BackupError from backupService', async () => {
        mockGetItem.mockResolvedValueOnce(mockWebDAVSettings);
        // Simulate an error that would be wrapped in BackupError by the service
        const originalWebDavError = new WebDAVError("Some generic webdav issue during upload", { status: 500 });
        mockBackupToWebDAV.mockRejectedValueOnce(
            new (await vi.importActual<any>('@prompt-optimizer/core/services/backup')).BackupError(
                `WebDAV operation failed during backup: ${originalWebDavError.message}`, 
                originalWebDavError
            )
        );

        const wrapper = mount(WebDAVActionsVue);
        await flushPromises();

        await wrapper.find('button.bg-blue-600').trigger('click');
        await flushPromises();
        // @ts-ignore
        expect(wrapper.vm.actionFeedback.message).toContain('WebDAV operation failed during backup: Some generic webdav issue during upload');
        // @ts-ignore
        expect(wrapper.vm.actionFeedback.isError).toBe(true);
    });
  });

  describe('performRestore', () => {
    it('shows confirmation, then calls restoreService.restoreFromWebDAV and shows success', async () => {
      mockGetItem.mockResolvedValueOnce(mockWebDAVSettings);
      mockRestoreFromWebDAV.mockResolvedValueOnce({ success: true, message: 'Restore done!' });
      const wrapper = mount(WebDAVActionsVue);
      await flushPromises(); // onMounted

      // Initiate restore
      await wrapper.find('button.bg-green-600').trigger('click');
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.showRestoreConfirmation).toBe(true);
      expect(wrapper.find('.bg-red-600').text()).toContain('Yes, Restore Data'); // In modal

      // Confirm restore
      await wrapper.find('.bg-red-600').trigger('click'); // Confirm button in modal
      await flushPromises();

      // @ts-ignore
      expect(wrapper.vm.showRestoreConfirmation).toBe(false);
      expect(mockRestoreFromWebDAV).toHaveBeenCalledWith(mockWebDAVSettings);
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.message).toBe('Restore done!');
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.isError).toBe(false);
      // @ts-ignore
      expect(wrapper.vm.restoreState.inProgress).toBe(false);
    });

    it('allows cancelling restore confirmation', async () => {
      const wrapper = mount(WebDAVActionsVue);
      await flushPromises();

      await wrapper.find('button.bg-green-600').trigger('click'); // Initiate
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.showRestoreConfirmation).toBe(true);

      // Click cancel button (assuming it's the second button in the modal footer or specific class)
      await wrapper.find('button.sm\\:col-start-1').trigger('click'); // Cancel button in modal
      await flushPromises();
      
      // @ts-ignore
      expect(wrapper.vm.showRestoreConfirmation).toBe(false);
      expect(mockRestoreFromWebDAV).not.toHaveBeenCalled();
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.message).toContain('Restore cancelled.');
    });
    
    it('handles WebDAVFileNotFoundError from restoreService', async () => {
      mockGetItem.mockResolvedValueOnce(mockWebDAVSettings);
      mockRestoreFromWebDAV.mockRejectedValueOnce(new WebDAVFileNotFoundError('backup.json'));
      const wrapper = mount(WebDAVActionsVue);
      await flushPromises();

      await wrapper.find('button.bg-green-600').trigger('click'); //initiate
      await flushPromises();
      await wrapper.find('.bg-red-600').trigger('click'); // confirm
      await flushPromises();

      // @ts-ignore
      expect(wrapper.vm.actionFeedback.message).toContain('WebDAV File Not Found: File not found at WebDAV path: backup.json');
      // @ts-ignore
      expect(wrapper.vm.actionFeedback.isError).toBe(true);
    });
  });

  describe('mapErrorToUserMessage', () => {
    const wrapper = mount(WebDAVActionsVue);
    // @ts-ignore
    const mapError = wrapper.vm.mapErrorToUserMessage;

    it('maps WebDAVSettingsMissingError', () => {
      expect(mapError(new WebDAVSettingsMissingError('Custom message'))).toBe('WebDAV settings are missing. Please configure them first.');
    });
    it('maps WebDAVAuthenticationError', () => {
      expect(mapError(new WebDAVAuthenticationError('Auth details.'))).toBe('WebDAV Authentication Failed: Auth details. Please check your credentials and server URL.');
    });
     it('maps WebDAVConnectionError', () => {
      expect(mapError(new WebDAVConnectionError('https://test.com', new Error('ECONNREFUSED')))).toContain('WebDAV Connection Error: Failed to connect to WebDAV server at https://test.com');
    });
    it('maps WebDAVFileNotFoundError', () => {
      expect(mapError(new WebDAVFileNotFoundError('path/file.txt'))).toBe('WebDAV File Not Found: File not found at WebDAV path: path/file.txt Ensure the remote path is correct and the file exists for restore.');
    });
    it('maps WebDAVForbiddenError', () => {
      expect(mapError(new WebDAVForbiddenError('path/file.txt', 'read'))).toBe('WebDAV Access Forbidden: Access forbidden to read \'path/file.txt\'. Please check permissions. Check permissions for the specified path on the server.');
    });
     it('maps generic WebDAVError', () => {
      expect(mapError(new WebDAVError('Generic WebDAV problem'))).toBe('A WebDAV operational error occurred: Generic WebDAV problem');
    });
    it('maps generic Error', () => {
      expect(mapError(new Error('Some other problem'))).toBe('An unexpected error occurred: Some other problem. Check console for details.');
    });
     it('maps BackupConfigurationError', () => {
      expect(mapError(new BackupConfigurationError('Provider incomplete'))).toBe('Configuration Error: Provider incomplete');
    });
  });

});
