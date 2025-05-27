// This file defines custom error classes for the WebDAV service.

export class WebDAVError extends Error {
  public originalError?: any; // Changed to 'any' to accommodate various error structures from webdav lib

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'WebDAVError';
    this.originalError = originalError;
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

export class WebDAVConnectionError extends WebDAVError {
  constructor(serverUrl: string, originalError?: any) {
    super(`Failed to connect to WebDAV server at ${serverUrl}. Please check the URL and network connection.`, originalError);
    this.name = 'WebDAVConnectionError';
  }
}

export class WebDAVAuthenticationError extends WebDAVError {
  constructor(message: string = 'Authentication failed. Please check your WebDAV username and password.', originalError?: any) {
    super(message, originalError);
    this.name = 'WebDAVAuthenticationError';
  }
}

export class WebDAVFileNotFoundError extends WebDAVError {
  constructor(filePath: string, originalError?: any) {
    super(`File not found at WebDAV path: ${filePath}`, originalError);
    this.name = 'WebDAVFileNotFoundError';
  }
}

export class WebDAVDirectoryNotFoundError extends WebDAVError {
  constructor(directoryPath: string, originalError?: any) {
    super(`Directory not found at WebDAV path: ${directoryPath}`, originalError);
    this.name = 'WebDAVDirectoryNotFoundError';
  }
}

export class WebDAVFileError extends WebDAVError {
  constructor(filePath: string, operation: 'read' | 'write' | 'delete' | 'stat' | 'create directory' | 'list directory', message: string, originalError?: any) {
    super(`Failed to ${operation} file/directory '${filePath}': ${message}`, originalError);
    this.name = 'WebDAVFileError';
  }
}

export class WebDAVUploadError extends WebDAVFileError {
  constructor(filePath: string, originalError?: any) {
    const message = originalError?.message || 'Upload operation failed';
    super(filePath, 'write', message, originalError);
    this.name = 'WebDAVUploadError';
  }
}

export class WebDAVDownloadError extends WebDAVFileError {
  constructor(filePath: string, originalError?: any) {
    const message = originalError?.message || 'Download operation failed';
    super(filePath, 'read', message, originalError);
    this.name = 'WebDAVDownloadError';
  }
}

export class WebDAVInsufficientStorageError extends WebDAVError {
  constructor(originalError?: any) {
    super('Insufficient storage on the WebDAV server.', originalError);
    this.name = 'WebDAVInsufficientStorageError';
  }
}

export class WebDAVForbiddenError extends WebDAVError {
  constructor(filePath: string, operation: string, originalError?: any) {
    super(`Access forbidden to ${operation} '${filePath}'. Please check permissions.`, originalError);
    this.name = 'WebDAVForbiddenError';
  }
}

export class WebDAVInvalidPathError extends WebDAVError {
  constructor(filePath: string, message: string = 'Invalid path specified.', originalError?: any) {
    super(`Invalid WebDAV path: '${filePath}'. ${message}`, originalError);
    this.name = 'WebDAVInvalidPathError';
  }
}

export class WebDAVRateLimitError extends WebDAVError {
  constructor(message: string = 'Too many requests to the WebDAV server. Please try again later.', originalError?: any) {
    super(message, originalError);
    this.name = 'WebDAVRateLimitError';
  }
}

export class WebDAVNetworkError extends WebDAVError {
    constructor(message: string = 'A network error occurred while communicating with the WebDAV server.', originalError?: any) {
        super(message, originalError);
        this.name = 'WebDAVNetworkError';
    }
}
