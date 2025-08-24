import React, { useState, useEffect } from 'react';
import { 
  encryptToken, 
  decryptToken,
  saveMasterPassword, 
  encryptAndStoreData, 
  STORAGE_KEYS,
  loadRepoSettings,
  saveRepoSettings,  // Keep only this one for repository operations
  hashPassword       // Add this for hashing the password
} from '../src/utils/cryptoUtil';

interface InitialSetupProps {
  defaultAdminPassword: string;
  onSetupComplete: (password: string) => void;
  envToken?: string; // Add GitHub token from environment
}

const InitialSetup: React.FC<InitialSetupProps> = ({ 
  defaultAdminPassword, 
  onSetupComplete,
  envToken 
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useRepoSettings, setUseRepoSettings] = useState(true);
  const [loadingRepoSettings, setLoadingRepoSettings] = useState(true);
  const [repoSettingsAvailable, setRepoSettingsAvailable] = useState(false);
  
  // Check if repository settings are available
  useEffect(() => {
    async function checkRepoSettings() {
      try {
        const settings = await loadRepoSettings();
        if (settings.master_password_hash) {
          setRepoSettingsAvailable(true);
          
          // If there's a password hint, show it
          if (settings.password_hint) {
            setPasswordHint(settings.password_hint);
          }
        }
      } catch (e) {
        console.error('Error loading repo settings:', e);
      } finally {
        setLoadingRepoSettings(false);
      }
    }
    
    checkRepoSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password
    if (!password) {
      setError('Please enter a password');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    try {
      // Save master password locally
      saveMasterPassword(password, passwordHint);
      
      // If environment token is provided and user wants to use repository settings
      if (envToken && useRepoSettings) {
        // First decrypt the token to make sure password is correct (if using repo settings)
        if (repoSettingsAvailable) {
          const settings = await loadRepoSettings();
          try {
            const decryptedToken = decryptToken(settings.github_token || '', password);
            if (!decryptedToken || !decryptedToken.startsWith('ghp_')) {
              setError('Incorrect master password for repository settings');
              return;
            }
          } catch (e) {
            setError('Failed to decrypt repository settings with this password');
            return;
          }
        }
        
        // Save master password hash and hint to repository
        const passwordHash = hashPassword(password);
        await saveRepoSettings({
          master_password_hash: passwordHash,
          password_hint: passwordHint || ''
        }, envToken);
        console.log("Master password saved to repository");
        
        // If this is first setup with new token, save the token too
        if (!repoSettingsAvailable) {
          // Encrypt and store the token using the master password
          const encryptedToken = encryptToken(envToken, password);
          await saveRepoSettings({ github_token: encryptedToken }, envToken);
          console.log("GitHub token saved to repository");
        }
      }

      // Add detailed GitHub token validation
      if (envToken) {
        try {
          // Test the token with a simple API call
          const response = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `token ${envToken}`
            }
          });
          
          if (response.ok) {
            const user = await response.json();
            console.log("GitHub token is valid, authenticated as:", user.login);
          } else {
            console.error("GitHub token validation failed:", await response.text());
          }
        } catch (e) {
          console.error("Error validating GitHub token:", e);
        }
      }
      
      // Mark setup as complete
      localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true');
      
      // Store GitHub token in localStorage if available
      if (envToken) {
        encryptAndStoreData('github_token', envToken, password);
      }
      
      // Notify parent component
      onSetupComplete(password);
    } catch (error) {
      setError('Failed to complete setup: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  if (loadingRepoSettings) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {repoSettingsAvailable ? "Enter Master Password" : "Initial Setup"}
        </h1>
        
        <div className="mb-6 text-gray-700">
          {repoSettingsAvailable ? (
            <p>
              Repository settings found. Please enter your master password to decrypt and use these settings.
              {passwordHint && (
                <div className="mt-2 p-3 bg-blue-50 text-blue-800 rounded-md">
                  <span className="font-semibold">Password hint:</span> {passwordHint}
                </div>
              )}
            </p>
          ) : (
            <p>
              Welcome to the Brain Admin interface! To secure your admin area, please create a master password.
              This password will be used for both admin login and encrypting your GitHub token.
            </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {repoSettingsAvailable ? "Master Password" : "Create Master Password"}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              placeholder={repoSettingsAvailable ? "Enter your master password" : "Enter a strong password"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {!repoSettingsAvailable && (
            <>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label htmlFor="passwordHint" className="block text-sm font-medium text-gray-700 mb-1">
                  Password Hint (Optional)
                </label>
                <input
                  type="text"
                  id="passwordHint"
                  value={passwordHint}
                  onChange={(e) => setPasswordHint(e.target.value)}
                  placeholder="A hint to help you remember your password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">This hint will be shown if you forget your password</p>
              </div>
              
              {envToken && (
                <div className="flex items-center mt-4">
                  <input
                    id="useRepoSettings"
                    type="checkbox"
                    checked={useRepoSettings}
                    onChange={(e) => setUseRepoSettings(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useRepoSettings" className="ml-2 text-sm text-gray-700">
                    Store encrypted settings in repository (recommended for multi-device access)
                  </label>
                </div>
              )}
            </>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md">
              <p>{error}</p>
            </div>
          )}
          
          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {repoSettingsAvailable ? "Continue" : "Complete Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InitialSetup;