import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebDAVService } from '../../../src/services/webdav/webdav';
import {
  WebDAVError,
  WebDAVAuthenticationError,
  WebDAVConnectionError,
  WebDAVFileNotFoundError,
  WebDAVForbiddenError,
  WebDAVInsufficientStorageError,
  WebDAVUploadError,
  WebDAVDownloadError,
  WebDAVInvalidPathError,
  WebDAVDirectoryNotFoundError,
} from '../../../src/services/webdav/errors';
import type { WebDAVClient, WebDAVClientOptions } from 'webdav';

// Mock the 'webdav' library
const mockPutFileContents = vi.fn();
const mockGetFileContents = vi.fn();
const mockCreateDirectory = vi.fn();
const mockGetStat = vi.fn();
const mockDeleteFile = vi.fn();

const mockWebDAVClient = {
  putFileContents: mockPutFileContents,
  getFileContents: mockGetFileContents,
  createDirectory: mockCreateDirectory,
  getStat: mockGetStat,
  deleteFile: mockDeleteFile,
  remoteURL: 'https://mock-server.com/dav/', // Add for constructor test
} as Partial<WebDAVClient>;

vi.mock('webdav', () => ({
  createClient: vi.fn(() => mockWebDAVClient as WebDAVClient),
  // We might need to mock other exports if WebDAVService uses them directly
}));

describe('WebDAVService', () => {
  const clientOptions: WebDAVClientOptions = {
    remoteURL: 'https://test.com/dav',
    username: 'user',
    password: 'password',
  };

  beforeEach(() => {
    vi.clearAllMocks(); // Clear mocks before each test
  });

  describe('Constructor', () => {
    it('should create a client with options if WebDAVClientOptions are provided', () => {
      const service = new WebDAVService(clientOptions);
      expect(service).toBeInstanceOf(WebDAVService);
      // @ts-ignore - accessing private property for test
      expect(service.client).toBeDefined();
      // @ts-ignore
      expect(service.remoteURL).toBe(clientOptions.remoteURL);
    });

    it('should use the provided client instance if WebDAVClient is provided', () => {
      const existingClient = { ...mockWebDAVClient, getStat: vi.fn() } as WebDAVClient; // Ensure getStat is on the mock for the check
      const service = new WebDAVService(existingClient);
      expect(service).toBeInstanceOf(WebDAVService);
       // @ts-ignore
      expect(service.client).toBe(existingClient);
    });

    it('should throw WebDAVInvalidPathError if remoteURL is missing in options', () => {
      const invalidOptions: Partial<WebDAVClientOptions> = { username: 'user' };
      expect(() => new WebDAVService(invalidOptions as WebDAVClientOptions)).toThrow(WebDAVInvalidPathError);
      expect(() => new WebDAVService(invalidOptions as WebDAVClientOptions)).toThrow('Remote URL is not provided');
    });
  });

  describe('uploadFile', () => {
    it('should upload a file and create parent directory if it does not exist', async () => {
      const service = new WebDAVService(clientOptions);
      const filePath = 'parent/child/file.txt';
      const data = 'Hello World';

      // Simulate parent directory does not exist, then successfully created
      mockGetStat.mockRejectedValueOnce({ response: { status: 404 } }); // For parent/child
      mockCreateDirectory.mockResolvedValueOnce(undefined); // For parent/child
      mockPutFileContents.mockResolvedValueOnce(undefined);

      await service.uploadFile(filePath, data);

      expect(mockGetStat).toHaveBeenCalledWith('parent/child');
      expect(mockCreateDirectory).toHaveBeenCalledWith('parent/child', { recursive: true });
      expect(mockPutFileContents).toHaveBeenCalledWith(filePath, data, { overwrite: true });
    });
    
    it('should upload a file without creating directory if parent is root', async () => {
      const service = new WebDAVService(clientOptions);
      const filePath = 'file.txt'; // Root path
      const data = 'Hello World';

      mockPutFileContents.mockResolvedValueOnce(undefined);
      await service.uploadFile(filePath, data);

      expect(mockGetStat).not.toHaveBeenCalled();
      expect(mockCreateDirectory).not.toHaveBeenCalled();
      expect(mockPutFileContents).toHaveBeenCalledWith(filePath, data, { overwrite: true });
    });


    it('should throw WebDAVUploadError on failure', async () => {
      const service = new WebDAVService(clientOptions);
      const filePath = 'test/file.txt';
      mockGetStat.mockResolvedValueOnce({ type: "directory" }); // Parent directory exists
      mockPutFileContents.mockRejectedValueOnce({ message: 'Upload failed', response: { status: 500 } });

      await expect(service.uploadFile(filePath, 'data')).rejects.toThrow(WebDAVUploadError);
      await expect(service.uploadFile(filePath, 'data')).rejects.toThrow(/Failed to write file\/directory 'test\/file.txt': Upload failed/);
    });

    it('should correctly map 401 to WebDAVAuthenticationError during upload', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockResolvedValueOnce({ type: "directory" });
      mockPutFileContents.mockRejectedValueOnce({ response: { status: 401 } });
      await expect(service.uploadFile('file.txt', 'data')).rejects.toThrow(WebDAVAuthenticationError);
    });
    
    it('should correctly map 403 to WebDAVForbiddenError during upload', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockResolvedValueOnce({ type: "directory" });
      mockPutFileContents.mockRejectedValueOnce({ response: { status: 403 } });
      await expect(service.uploadFile('file.txt', 'data')).rejects.toThrow(WebDAVForbiddenError);
    });

    it('should correctly map 507 to WebDAVInsufficientStorageError during upload', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockResolvedValueOnce({ type: "directory" });
      mockPutFileContents.mockRejectedValueOnce({ response: { status: 507 } });
      await expect(service.uploadFile('file.txt', 'data')).rejects.toThrow(WebDAVInsufficientStorageError);
    });
    
    it('should throw WebDAVConnectionError for network issues like ENOTFOUND', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockResolvedValueOnce({ type: "directory" });
      mockPutFileContents.mockRejectedValueOnce({ message: 'request to https://test.com/dav/test/file.txt failed, reason: getaddrinfo ENOTFOUND test.com' });
      await expect(service.uploadFile('test/file.txt', 'data')).rejects.toThrow(WebDAVConnectionError);
    });

     it('should throw an error if parent path exists but is not a directory', async () => {
      const service = new WebDAVService(clientOptions);
      const filePath = 'existingfile/newfile.txt';
      mockGetStat.mockResolvedValueOnce({ type: "file" }); // parent path is a file

      await expect(service.uploadFile(filePath, 'data')).rejects.toThrow(WebDAVError); // Specific error can be WebDAVFileError
      await expect(service.uploadFile(filePath, 'data')).rejects.toThrow(/Path existingfile exists but is not a directory/);
      expect(mockCreateDirectory).not.toHaveBeenCalled();
      expect(mockPutFileContents).not.toHaveBeenCalled();
    });

  });

  describe('downloadFile', () => {
    it('should download a file successfully', async () => {
      const service = new WebDAVService(clientOptions);
      const filePath = 'file.txt';
      const expectedContent = 'File content';
      mockGetFileContents.mockResolvedValueOnce(expectedContent);

      const content = await service.downloadFile(filePath);

      expect(mockGetFileContents).toHaveBeenCalledWith(filePath, { format: 'text' });
      expect(content).toBe(expectedContent);
    });

    it('should throw WebDAVFileNotFoundError for 404', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetFileContents.mockRejectedValueOnce({ response: { status: 404 } });
      await expect(service.downloadFile('nonexistent.txt')).rejects.toThrow(WebDAVFileNotFoundError);
    });

    it('should throw WebDAVDownloadError for other errors', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetFileContents.mockRejectedValueOnce({ message: 'Download failed', response: { status: 500 } });
      await expect(service.downloadFile('file.txt')).rejects.toThrow(WebDAVDownloadError);
       await expect(service.downloadFile('file.txt')).rejects.toThrow(/Failed to read file\/directory 'file.txt': Download failed/);
    });
  });

  describe('pathExists', () => {
    it('should return true if path exists', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockResolvedValueOnce({ type: 'file' }); // Or 'directory'
      const exists = await service.pathExists('existing.txt');
      expect(exists).toBe(true);
      expect(mockGetStat).toHaveBeenCalledWith('existing.txt');
    });

    it('should return false if path does not exist (404)', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockRejectedValueOnce({ response: { status: 404 } });
      const exists = await service.pathExists('nonexistent.txt');
      expect(exists).toBe(false);
    });

    it('should re-throw other errors as specific WebDAVErrors', async () => {
      const service = new WebDAVService(clientOptions);
      mockGetStat.mockRejectedValueOnce({ response: { status: 401 } }); // Auth error
      await expect(service.pathExists('somepath.txt')).rejects.toThrow(WebDAVAuthenticationError);
    });
  });

  describe('createDirectoryRecursive', () => {
    it('should call client.createDirectory', async () => {
      const service = new WebDAVService(clientOptions);
      mockCreateDirectory.mockResolvedValueOnce(undefined);
      await service.createDirectoryRecursive('new/dir');
      expect(mockCreateDirectory).toHaveBeenCalledWith('new/dir', { recursive: true });
    });

    it('should throw WebDAVFileError on failure', async () => {
      const service = new WebDAVService(clientOptions);
      mockCreateDirectory.mockRejectedValueOnce({ message: 'Dir creation failed', response: { status: 500 } });
      await expect(service.createDirectoryRecursive('new/dir')).rejects.toThrow(WebDAVFileError);
      await expect(service.createDirectoryRecursive('new/dir')).rejects.toThrow(/Failed to create directory file\/directory 'new\/dir': Dir creation failed/);
    });
  });
  
  describe('deleteFile', () => {
    it('should call client.deleteFile', async () => {
      const service = new WebDAVService(clientOptions);
      mockDeleteFile.mockResolvedValueOnce(undefined);
      await service.deleteFile('file_to_delete.txt');
      expect(mockDeleteFile).toHaveBeenCalledWith('file_to_delete.txt');
    });

    it('should throw WebDAVFileNotFoundError if file to delete is not found (404)', async () => {
      const service = new WebDAVService(clientOptions);
      mockDeleteFile.mockRejectedValueOnce({ response: { status: 404 }});
      await expect(service.deleteFile('not_found.txt')).rejects.toThrow(WebDAVFileNotFoundError);
    });

    it('should throw WebDAVFileError for other deletion failures', async () => {
      const service = new WebDAVService(clientOptions);
      mockDeleteFile.mockRejectedValueOnce({ message: 'Deletion forbidden', response: { status: 403 }});
      await expect(service.deleteFile('protected_file.txt')).rejects.toThrow(WebDAVForbiddenError);
    });
  });

});
