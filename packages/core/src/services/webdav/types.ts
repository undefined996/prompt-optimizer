// This file can be used to define specific types for the WebDAV service.
// For example, you might define types for WebDAV responses or specific configuration options.

export interface WebDAVUploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface WebDAVDownloadResult {
  success: boolean;
  content?: string;
  error?: string;
}

// Add any other types relevant to your WebDAV service interface
// e.g. export type WebDAVClientStatus = 'connected' | 'disconnected' | 'error';
