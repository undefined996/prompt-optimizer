import { WebDAVClientOptions } from 'webdav';

/**
 * Settings for connecting to a WebDAV server.
 * Extends WebDAVClientOptions for flexibility, but ensures remoteURL is present.
 */
export interface WebDAVSettings extends Omit<WebDAVClientOptions, 'remoteURL'> {
  /**
   * The URL of the WebDAV server.
   * Example: "https://example.com/webdav/"
   */
  serverUrl: string;

  /**
   * The remote path (including filename) where the backup will be stored on the WebDAV server.
   * Defaults to 'backup.json' if not provided.
   * Example: "myApp/backups/latest_backup.json"
   */
  remotePath?: string;

  /**
   * Optional username for WebDAV authentication.
   */
  username?: string;

  /**
   * Optional password for WebDAV authentication.
   */
  password?: string;

  // Other WebDAVClientOptions like headers, httpsAgent, etc., can be included if needed.
}

export interface BackupResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  message?: string;
  error?: string;
}
