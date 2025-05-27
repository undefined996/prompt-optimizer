import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WebDAVSettingsVue from '../../../../src/components/webdav/WebDAVSettings.vue';
import { StorageFactory } from '@prompt-optimizer/core/services/storage';
import type { IStorageProvider } from '@prompt-optimizer/core/services/storage';
import type { WebDAVSettings as CoreWebDAVSettings } from '@prompt-optimizer/core/services/backup';

// Mock StorageFactory and IStorageProvider
const mockGetItem = vi.fn();
const mockSetItem = vi.fn();

const mockStorageProvider = {
  getItem: mockGetItem,
  setItem: mockSetItem,
  // Add other methods if they are called, even if just for type consistency
  removeItem: vi.fn(),
  getKeys: vi.fn(),
  clear: vi.fn(),
  clearAll: vi.fn(),
  exportAll: vi.fn(),
  importAll: vi.fn(),
  providerName: 'MockUIStorage'
} as IStorageProvider;

vi.mock('@prompt-optimizer/core/services/storage', () => ({
  StorageFactory: {
    createDefault: vi.fn(() => Promise.resolve(mockStorageProvider)),
  },
}));


const WEBDAV_SETTINGS_KEY = 'webdav_settings';

describe('WebDAVSettings.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset settings state if necessary, though component's onMounted should handle it
  });

  it('renders the form elements correctly', () => {
    const wrapper = mount(WebDAVSettingsVue);
    expect(wrapper.find('h2').text()).toBe('WebDAV Settings');
    expect(wrapper.find('input#webdav-server-url').exists()).toBe(true);
    expect(wrapper.find('input#webdav-username').exists()).toBe(true);
    expect(wrapper.find('input#webdav-password').exists()).toBe(true);
    expect(wrapper.find('input#webdav-remote-path').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').text()).toBe('Save Settings');
  });

  it('updates settings data when input fields change', async () => {
    const wrapper = mount(WebDAVSettingsVue);
    await flushPromises(); // Ensure onMounted completes

    const serverUrlInput = wrapper.find('input#webdav-server-url');
    await serverUrlInput.setValue('https://new-server.com');
    // @ts-ignore access component instance
    expect(wrapper.vm.settings.serverUrl).toBe('https://new-server.com');

    const usernameInput = wrapper.find('input#webdav-username');
    await usernameInput.setValue('newuser');
     // @ts-ignore
    expect(wrapper.vm.settings.username).toBe('newuser');

    const passwordInput = wrapper.find('input#webdav-password');
    await passwordInput.setValue('newpass');
     // @ts-ignore
    expect(wrapper.vm.settings.password).toBe('newpass');
    
    const remotePathInput = wrapper.find('input#webdav-remote-path');
    await remotePathInput.setValue('new/path.json');
     // @ts-ignore
    expect(wrapper.vm.settings.remotePath).toBe('new/path.json');
  });

  describe('onMounted', () => {
    it('loads settings if they exist in storage', async () => {
      const storedSettings: CoreWebDAVSettings = { serverUrl: 'https://stored.com', username: 'storedUser', remotePath: 'stored/path.json' };
      mockGetItem.mockResolvedValueOnce(storedSettings);
      
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises(); // Wait for onMounted and loadSettings

      // @ts-ignore
      expect(wrapper.vm.settings.serverUrl).toBe('https://stored.com');
      // @ts-ignore
      expect(wrapper.vm.settings.username).toBe('storedUser');
      // @ts-ignore
      expect(wrapper.vm.settings.remotePath).toBe('stored/path.json');
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toContain('Settings loaded');
    });

    it('shows "No saved settings" message if none exist', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toContain('No saved settings found');
    });

    it('handles error during storageProvider.getItem', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('Storage read error'));
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toContain('Error loading settings: Storage read error');
      // @ts-ignore
      expect(wrapper.vm.feedbackIsError).toBe(true);
    });
    
    it('handles error during StorageFactory.createDefault', async () => {
      StorageFactory.createDefault = vi.fn().mockRejectedValueOnce(new Error('Factory init failed'));
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toContain('Critical Error: Could not load storage provider. Settings cannot be loaded or saved. Details: Factory init failed');
      // @ts-ignore
      expect(wrapper.vm.feedbackIsError).toBe(true);
    });
  });

  describe('saveSettings', () => {
    it('successfully saves valid settings', async () => {
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises(); // onMounted

      await wrapper.find('input#webdav-server-url').setValue('https://valid-url.com');
      mockSetItem.mockResolvedValueOnce(undefined);

      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises(); // Wait for saveSettings

      expect(mockSetItem).toHaveBeenCalledWith(WEBDAV_SETTINGS_KEY, expect.objectContaining({ serverUrl: 'https://valid-url.com' }));
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toBe('Settings saved successfully!');
      // @ts-ignore
      expect(wrapper.vm.feedbackIsError).toBe(false);
    });

    it('shows validation error if server URL is empty', async () => {
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();

      await wrapper.find('input#webdav-server-url').setValue(''); // Invalid
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(mockSetItem).not.toHaveBeenCalled();
      // @ts-ignore
      expect(wrapper.vm.validationErrors.serverUrl).toBe('Server URL is required.');
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toBe('Please correct the errors above.');
      // @ts-ignore
      expect(wrapper.vm.feedbackIsError).toBe(true);
    });
    
    it('shows validation error for invalid server URL format (not http/https)', async () => {
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();
      await wrapper.find('input#webdav-server-url').setValue('ftp://invalid.com');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();
      // @ts-ignore
      expect(wrapper.vm.validationErrors.serverUrl).toBe('Server URL must start with http:// or https://');
    });

    it('shows validation error for remote path starting/ending with slash', async () => {
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();
      await wrapper.find('input#webdav-server-url').setValue('https://valid.com');
      await wrapper.find('input#webdav-remote-path').setValue('/invalid/path/');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();
       // @ts-ignore
      expect(wrapper.vm.validationErrors.remotePath).toBe('Remote path should not start or end with a slash');
    });


    it('handles error during storageProvider.setItem', async () => {
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();

      await wrapper.find('input#webdav-server-url').setValue('https://another-valid-url.com');
      mockSetItem.mockRejectedValueOnce(new Error('Storage write error'));

      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toContain('Failed to save settings: Storage write error');
      // @ts-ignore
      expect(wrapper.vm.feedbackIsError).toBe(true);
    });

    it('disables save button while saving', async () => {
      const wrapper = mount(WebDAVSettingsVue);
      await flushPromises();
      await wrapper.find('input#webdav-server-url').setValue('https:// أثناء-saving.com'); // "during-saving.com"
      
      mockSetItem.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 50))); // Simulate delay

      wrapper.find('form').trigger('submit.prevent'); // Do not await here
      await wrapper.vm.$nextTick(); // Allow isSaving to update

      expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
      // @ts-ignore
      expect(wrapper.vm.isSaving).toBe(true);
      // @ts-ignore
      expect(wrapper.vm.feedbackMessage).toBe('Saving settings...');

      await flushPromises(); // Complete the save
      expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
      // @ts-ignore
      expect(wrapper.vm.isSaving).toBe(false);
    });
  });
});
