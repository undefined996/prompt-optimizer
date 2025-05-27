# WebDAV Backup and Restore Feature

## 1. Feature Overview

The WebDAV Backup and Restore feature allows you to save a complete backup of your Prompt Optimizer application data to a remote WebDAV server and restore it later. This is useful for:

*   Keeping your data safe in case of browser issues or data loss.
*   Migrating your data between different browsers or computers.
*   Manually managing versions of your application data.

The backup includes all your prompts, history, settings, and other application-specific data.

## 2. Accessing the Feature

You can access the WebDAV backup and restore settings from the **Data Management** view within the application. Navigate to this section to configure your WebDAV server and perform backup or restore operations.

## 3. Configuring WebDAV Settings

Before you can use the backup and restore functionality, you need to configure the connection details for your WebDAV server.

The following fields are available:

*   **Server URL:**
    *   **Explanation:** The full URL to your WebDAV server's directory where you want to store backups. This URL usually points to the specific user's file area on the WebDAV server.
    *   **Example:** `https://your-webdav-server.com/remote.php/dav/files/username/` or `https://mydomain.com/webdav/`
    *   **Note:** Ensure the URL starts with `http://` or `https://`.

*   **Username:**
    *   **Explanation:** The username required to authenticate with your WebDAV server.

*   **Password:**
    *   **Explanation:** The password for the specified WebDAV username.

*   **Remote Backup Path (Optional):**
    *   **Explanation:** This is a path *relative to your Server URL's root* where the backup file will be stored. Think of it as a subfolder on your WebDAV server. If you leave this field empty, the backup file will be saved in the main directory specified by your Server URL.
    *   The actual backup file will always be named `prompt_optimizer_backup.json`.
    *   **Example:**
        *   If you enter `my_backups/app_data`, the backup will be saved as `[Server URL]/my_backups/app_data/prompt_optimizer_backup.json`.
        *   If you leave it empty, the backup will be saved as `[Server URL]/prompt_optimizer_backup.json`.
    *   **Note:** Do not start or end the path with a slash (`/`). Use `folder/subfolder` format.

**How to save settings:**
Once you have filled in the necessary details, click the "Save Settings" button. The application will store these settings securely in your browser's local storage. You will receive feedback indicating whether the settings were saved successfully.

## 4. Performing a Backup

Once your WebDAV settings are configured and saved:

*   **How to initiate a backup:** Click the "Backup to WebDAV" button in the "Backup & Restore" section of the Data Management view.
*   **What happens during backup:**
    1.  The application gathers all your data (prompts, history, settings, etc.).
    2.  This data is serialized into a JSON format.
    3.  The application connects to your WebDAV server using the saved settings.
    4.  The JSON data is uploaded to the specified "Remote Backup Path" as a file named `prompt_optimizer_backup.json`. If a file with the same name already exists, it will be overwritten.
*   **Success/failure feedback:**
    *   You will see status messages like "Backing up..." while the process is ongoing.
    *   Upon completion, a message will indicate if the backup was successful or if an error occurred. Common errors include connection issues, authentication failures, or problems writing the file to the server.

## 5. Performing a Restore

Restoring data allows you to replace your current application data with data from a previously saved backup.

*   **How to initiate a restore:** Click the "Restore from WebDAV" button in the "Backup & Restore" section.
*   **The confirmation step:**
    *   **IMPORTANT:** Before the restore process begins, you will be asked to confirm the action. Restoring data will **completely overwrite all your current application data**. This action cannot be undone.
    *   Carefully consider this before proceeding.
*   **What happens during restore:**
    1.  The application connects to your WebDAV server using the saved settings.
    2.  It attempts to download the `prompt_optimizer_backup.json` file from the specified "Remote Backup Path".
    3.  If the download is successful, all your existing local application data is cleared.
    4.  The data from the backup file is then imported into the application.
*   **Success/failure feedback:**
    *   You will see status messages like "Restoring..." during the process.
    *   Upon completion, a message will indicate if the restore was successful or if an error occurred. Common errors include being unable to connect to the server, the backup file not being found, or issues with the backup file format.

## 6. Important Notes & Troubleshooting

*   **Server Configuration:** Ensure your WebDAV server is correctly configured, running, and accessible from the network your browser is on. Firewalls or network proxies might interfere with the connection.
*   **Data Overwrite Warning:** Restoring data is a destructive operation for your current local data. Always be sure you want to replace your current data with the backup content. Consider making a local backup (if the application supports other export methods) before restoring from WebDAV if you have any doubts.
*   **Backup File Name:** The backup file stored on your WebDAV server is always named `prompt_optimizer_backup.json`. It will be located within the "Remote Backup Path" you specified, or at the root of your "Server URL" if the remote path was left empty.
*   **Common Error Messages:**
    *   **"WebDAV settings not configured..."**: Go to the "WebDAV Configuration" section and save your server details.
    *   **"Connection Error..."**: Could not reach the WebDAV server. Check your Server URL, internet connection, and if the server is online.
    *   **"Authentication Failed..."**: Invalid username or password. Please verify your credentials in the WebDAV settings.
    *   **"File Not Found..."**: The `prompt_optimizer_backup.json` file could not be found at the specified remote path on your server during a restore attempt. Check the "Remote Backup Path" setting and ensure the backup file exists.
    *   **"Access Forbidden..."**: Your WebDAV user does not have permission to read or write to the specified path. Check the permissions on your WebDAV server.
    *   **"Insufficient Storage..."**: The WebDAV server may not have enough space to save your backup.
    *   **"Invalid Path..."**: The "Remote Backup Path" might contain invalid characters or is not structured correctly.
    *   **"Failed to parse backup data..."**: The downloaded backup file might be corrupted or not in the expected JSON format.
*   **Developer Console:** If you encounter persistent issues and the error messages provided in the UI are not specific enough, open your browser's developer console (usually by pressing F12). More detailed error information or network request logs might be available there, which can help diagnose the problem.

By following these guidelines, you should be able to effectively use the WebDAV backup and restore feature to manage your Prompt Optimizer data.
