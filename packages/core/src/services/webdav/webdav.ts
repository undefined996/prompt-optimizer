import { createClient, WebDAVClient, WebDAVClientOptions, WebDAVError as LibWebDAVError } from 'webdav';
import {
  WebDAVError,
  WebDAVConnectionError,
  WebDAVAuthenticationError,
  WebDAVFileNotFoundError,
  WebDAVDirectoryNotFoundError,
  WebDAVFileError,
  WebDAVUploadError,
  WebDAVDownloadError,
  WebDAVInsufficientStorageError,
  WebDAVForbiddenError,
  WebDAVInvalidPathError,
  WebDAVNetworkError
} from './errors';

export class WebDAVService {
  private client: WebDAVClient;
  private remoteURL: string;

  constructor(options: WebDAVClientOptions | WebDAVClient) {
    if ((options as WebDAVClient).getStat) { // Check if it's a WebDAVClient instance
      this.client = options as WebDAVClient;
      // Attempt to get remoteURL if possible, may not always be available on custom client instances
      this.remoteURL = (options as any).remoteURL || 'Unknown WebDAV Server'; 
    } else {
      if (!(options as WebDAVClientOptions).remoteURL) {
        throw new WebDAVInvalidPathError('', 'Remote URL is not provided in WebDAVClientOptions.');
      }
      this.client = createClient(
        (options as WebDAVClientOptions).remoteURL!,
        options as WebDAVClientOptions
      );
      this.remoteURL = (options as WebDAVClientOptions).remoteURL!;
    }
  }

  private handleError(error: any, filePath: string, operation: 'read' | 'write' | 'delete' | 'stat' | 'create directory' | 'list directory'): WebDAVError {
    // console.error(`WebDAV Error during ${operation} on ${filePath}:`, error); // For debugging
    const status = error.response?.status || error.status; // 'status' can be directly on error for some lib versions
    const errorMessage = error.message || 'An unknown WebDAV error occurred.';

    if (error instanceof WebDAVError) { // If it's already one of our custom errors
        return error;
    }

    // Network or connection related issues
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('EHOSTUNREACH')) {
        return new WebDAVConnectionError(this.remoteURL, error);
    }
     if (errorMessage.toLowerCase().includes('network request failed')) { // Common in JS fetch API errors
        return new WebDAVNetworkError(errorMessage, error);
    }


    switch (status) {
      case 401:
      case 407: // Proxy Authentication Required might also be relevant
        return new WebDAVAuthenticationError(undefined, error);
      case 403:
        return new WebDAVForbiddenError(filePath, operation, error);
      case 404:
        // Check if it's a directory operation to return a more specific error
        if (operation === 'create directory' || operation === 'list directory' || operation === 'stat' && filePath.endsWith('/')) {
             return new WebDAVDirectoryNotFoundError(filePath, error);
        }
        return new WebDAVFileNotFoundError(filePath, error);
      case 400: // Bad Request, often due to invalid path characters or structure
        return new WebDAVInvalidPathError(filePath, errorMessage, error);
      case 409: // Conflict, e.g. trying to create a directory that exists as a file
        return new WebDAVFileError(filePath, operation, `Conflict: ${errorMessage}`, error);
      case 507:
        return new WebDAVInsufficientStorageError(error);
      case 429: // Too Many Requests
        return new WebDAVRateLimitError(undefined, error);
      default:
        // For specific operations, wrap in more specific errors if not covered above
        if (operation === 'write') {
            return new WebDAVUploadError(filePath, error);
        }
        if (operation === 'read') {
            return new WebDAVDownloadError(filePath, error);
        }
        return new WebDAVFileError(filePath, operation, errorMessage, error);
    }
  }

  async uploadFile(filePath: string, data: ArrayBuffer | string): Promise<void> {
    const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (parentDir) {
      try {
        // Check if directory exists first, then create. Avoids error if it's a file.
        const stat = await this.client.getStat(parentDir);
        if (stat.type !== "directory") {
            throw this.handleError({ message: `Path ${parentDir} exists but is not a directory.`} , parentDir, 'create directory');
        }
      } catch (statError: any) {
        const handledStatError = this.handleError(statError, parentDir, 'stat');
        if (handledStatError instanceof WebDAVFileNotFoundError || handledStatError instanceof WebDAVDirectoryNotFoundError) {
          try {
            await this.client.createDirectory(parentDir, { recursive: true });
          } catch (dirError: any) {
            throw this.handleError(dirError, parentDir, 'create directory');
          }
        } else {
            // Don't throw if the error is something else like auth/connection,
            // as putFileContents will fail and provide a better context
            // This path is tricky; we want to create if not exists, but not mask other critical errors.
            // console.warn(`Could not ensure directory ${parentDir} exists due to non-404 error:`, handledStatError);
        }
      }
    }

    try {
      await this.client.putFileContents(filePath, data, { overwrite: true });
    } catch (error: any) {
      throw this.handleError(error, filePath, 'write');
    }
  }

  async downloadFile(filePath: string): Promise<string> {
    try {
      const fileContents = await this.client.getFileContents(filePath, { format: 'text' });
      return fileContents as string;
    } catch (error: any) {
      throw this.handleError(error, filePath, 'read');
    }
  }

  async pathExists(filePath: string): Promise<boolean> {
    try {
      await this.client.getStat(filePath);
      return true;
    } catch (error: any) {
      const handledError = this.handleError(error, filePath, 'stat');
      if (handledError instanceof WebDAVFileNotFoundError || handledError instanceof WebDAVDirectoryNotFoundError) {
        return false;
      }
      // For other errors (connection, auth), rethrow to make it visible
      throw handledError;
    }
  }

  async createDirectoryRecursive(dirPath: string): Promise<void> {
    try {
      await this.client.createDirectory(dirPath, { recursive: true });
    } catch (error: any) {
      throw this.handleError(error, dirPath, 'create directory');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.client.deleteFile(filePath);
    } catch (error: any) {
      throw this.handleError(error, filePath, 'delete');
    }
  }
}
