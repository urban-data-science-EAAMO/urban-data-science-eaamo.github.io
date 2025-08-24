/**
 * Simple utility for encrypting and decrypting GitHub tokens with a user-provided password
 */

import CryptoJS from 'crypto-js';

// Add this interface at the top of the file
interface EncryptedSettings {
  github_token?: string;
  master_password_hash?: string;
  password_hint?: string;
  [key: string]: string | undefined;
}

/**
 * Unified password management system - ensures only one master password is used
 */

// Constants for localStorage keys - centralized for consistency
const STORAGE_KEYS = {
  MASTER_PASSWORD_HASH: 'master_password_hash',
  MASTER_PASSWORD_HINT: 'master_password_hint',
  REMEMBER_DEVICE: 'remember_device',
  SESSION_EXPIRY: 'password_session_expiry',
  ADMIN_AUTH: 'admin_auth',
  TOKEN_EXPIRY: 'token_expiry',
  GITHUB_TOKEN: 'github_token',
  TOKEN_ENCRYPTED: 'token_encrypted',
  SETUP_COMPLETE: 'admin_setup_complete',
  ENCRYPTED_DATA: 'encrypted_data' // New key for storing all encrypted data
};

// Encrypt a token with a password
export function encryptToken(token: string, password: string): string {
  if (!token || !password) return '';
  return CryptoJS.AES.encrypt(token, password).toString();
}

// Decrypt a token with a password
export function decryptToken(encryptedToken: string, password: string): string {
  if (!encryptedToken || !password) return '';
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Failed to decrypt token:', e);
    return '';
  }
}

// Check if a string looks like an encrypted token
export function isEncryptedToken(str: string): boolean {
  // Encrypted tokens will typically be base64-encoded strings with certain characteristics
  return /^U2FsdGVkX1.*/.test(str);
}

// Generate a hash of the password for verification purposes
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString();
}

// Verify a password against its hash
export function verifyPassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword;
}

// Store the master password settings
export function saveMasterPassword(password: string, hint?: string, remember: boolean = false): void {
  // Store password hash for verification
  const passwordHash = hashPassword(password);
  localStorage.setItem(STORAGE_KEYS.MASTER_PASSWORD_HASH, passwordHash);
  
  // Store hint if provided
  if (hint) {
    localStorage.setItem(STORAGE_KEYS.MASTER_PASSWORD_HINT, hint);
  }
  
  // Store remember preference
  localStorage.setItem(STORAGE_KEYS.REMEMBER_DEVICE, remember.toString());
  
  // If remember is true, store a session cookie that lasts longer
  if (remember) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
    localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiryDate.toISOString());
  }
}

// Encrypt and store sensitive data with the master password
export function encryptAndStoreData(key: string, data: string, password: string): void {
  // Get existing encrypted data
  const encryptedDataJson = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_DATA) || '{}';
  let encryptedDataObj;
  
  try {
    encryptedDataObj = JSON.parse(encryptedDataJson);
  } catch (e) {
    encryptedDataObj = {};
  }
  
  // Encrypt the new data
  const encrypted = encryptToken(data, password);
  
  // Store it under the specified key
  encryptedDataObj[key] = encrypted;
  
  // Save back to localStorage
  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_DATA, JSON.stringify(encryptedDataObj));
}

// Decrypt stored data with the master password
export function getDecryptedData(key: string, password: string): string | null {
  const encryptedDataJson = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_DATA) || '{}';
  let encryptedDataObj;
  
  try {
    encryptedDataObj = JSON.parse(encryptedDataJson);
  } catch (e) {
    return null;
  }
  
  const encrypted = encryptedDataObj[key];
  if (!encrypted) return null;
  
  try {
    return decryptToken(encrypted, password);
  } catch (e) {
    return null;
  }
}

// Get master password settings
export function getMasterPasswordSettings(): { 
  passwordHash: string | null;
  hint: string | null; 
  remember: boolean;
  sessionValid: boolean;
} {
  const passwordHash = localStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
  const hint = localStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HINT);
  const remember = localStorage.getItem(STORAGE_KEYS.REMEMBER_DEVICE) === 'true';
  
  // Check if the remember session is still valid
  let sessionValid = false;
  if (remember) {
    const storedExpiryDate = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
    if (storedExpiryDate) {
      const expiryDate = new Date(storedExpiryDate);
      sessionValid = expiryDate > new Date();
    }
  }
  
  return {
    passwordHash,
    hint,
    remember,
    sessionValid
  };
}

// Clear all sensitive data and settings
export function clearAllSettings(): void {
  localStorage.removeItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
  localStorage.removeItem(STORAGE_KEYS.MASTER_PASSWORD_HINT);
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_DEVICE);
  localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_ENCRYPTED);
  localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_DATA);
}

// Export the storage keys for consistent usage across components
export { STORAGE_KEYS };

// For backward compatibility
export const getEncryptionSettings = getMasterPasswordSettings;
export const saveEncryptionSettings = saveMasterPassword;
export const clearEncryptionSettings = clearAllSettings;

// SIMPLIFIED REPOSITORY FUNCTIONS

// Function to load settings from the repository
export async function loadRepoSettings(): Promise<EncryptedSettings> {
  try {
    // Fetch the settings file from your deployed site
    const response = await fetch('/data/encryptedSettings.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load repository settings:', error);
    // Return default empty settings
    return {
      github_token: "",
      master_password_hash: "",
      password_hint: ""
    };
  }
}

// Function to save encrypted settings to the repository
export async function saveRepoSettings(
  newSettings: Partial<EncryptedSettings>, 
  token: string
): Promise<void> {
  try {
    console.log("Attempting to save settings to repository...");
    
    // Constants - hardcoded for consistency
    const REPO_OWNER = 'mattwfranchi';
    const REPO_NAME = 'mattwfranchi.github.io';
    
    // Get the current file to check if it exists and get the SHA
    let sha: string | undefined;
    let existingSettings: EncryptedSettings = {
      github_token: "",
      master_password_hash: "",
      password_hint: ""
    };
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/data/encryptedSettings.json`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        sha = data.sha;
        
        // Decode the content from base64
        const content = atob(data.content);
        existingSettings = JSON.parse(content);
        console.log("Existing settings found, merging with new settings");
      }
    } catch (e) {
      console.warn("File might not exist yet, creating new one");
    }
    
    // IMPORTANT: Merge the new settings with existing settings
    const mergedSettings = { ...existingSettings, ...newSettings };
    
    // Convert settings to JSON
    const content = JSON.stringify(mergedSettings, null, 2);
    
    // Base64 encode the content for GitHub API
    const contentBase64 = btoa(content);
    
    // Prepare the request body
    const requestBody: any = {
      message: 'Update encrypted settings',
      content: contentBase64,
    };
    
    // If we have a SHA, include it (update operation)
    if (sha) {
      requestBody.sha = sha;
    }
    
    // Commit the file to the repository
    const commitResponse = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/data/encryptedSettings.json`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!commitResponse.ok) {
      const errorData = await commitResponse.json();
      console.error("GitHub API error:", errorData);
      throw new Error(`GitHub API error: ${commitResponse.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    console.log("Settings saved to repository successfully");
    
  } catch (error) {
    console.error("Error saving settings to repository:", error);
    throw error;
  }
}

// REMOVED: saveMasterPasswordToRepo - functionality integrated into InitialSetup.tsx directly
// REMOVED: encryptAndStoreDataToRepo - functionality integrated into GitHubSetup.tsx directly

// Add this function to ensure consistent token encryption
export function getEncryptedGitHubToken(token: string, password: string): string {
  // Always use the same encryption method
  return encryptToken(token, password);
}

// Add this function to get the token from various sources
export function getGitHubToken(password: string): string | null {
  // Try the new unified storage method first
  const token = getDecryptedData('github_token', password);
  if (token) return token;
  
  // Fall back to the old method
  const encryptedToken = localStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN);
  if (encryptedToken) {
    try {
      return decryptToken(encryptedToken, password);
    } catch (e) {
      console.error("Failed to decrypt token from old storage method");
    }
  }
  
  return null;
}
