import React, { useState, useEffect } from 'react';
import { 
  encryptToken, 
  decryptToken,
  saveMasterPassword, 
  encryptAndStoreData, 
  STORAGE_KEYS,
  loadRepoSettings,
  saveRepoSettings,
  hashPassword,
  verifyPassword,
  getMasterPasswordSettings,
  getEncryptedGitHubToken
} from '../../utils/cryptoUtil';
import { validateToken } from '../../utils/githubDirectService';

interface AuthSetupProps {
  onSetupComplete: (password: string) => void;
  envToken?: string;
  mode?: 'initial' | 'token'; // 'initial' for first setup, 'token' for just updating token
}

const AuthSetup: React.FC<AuthSetupProps> = ({ 
  onSetupComplete,
  envToken,
  mode = 'initial'
}) => {
  // Common state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useRepoSettings, setUseRepoSettings] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Token specific state
  const [token, setToken] = useState(envToken || '');
  const [tokenValidating, setTokenValidating] = useState(false);
  
  // Repository settings state
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
    
    // For token mode, load existing password hint
    if (mode === 'token') {
      const settings = getMasterPasswordSettings();
      if (settings.hint) {
        setPasswordHint(settings.hint);
      }
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    
    try {
      // Different validation depending on mode
      if (mode === 'initial') {
        if (repoSettingsAvailable) {
          try {
            // Get the master password hash from repo settings
            const settings = await loadRepoSettings();
            const storedHash = settings.master_password_hash;
            
            if (!storedHash) {
              throw new Error("No master password hash found in repository settings");
            }
            
            // Verify the entered password matches the stored hash
            const passwordHash = hashPassword(password);
            
            console.log("Debugging password verification:");
            console.log("- Entered password:", password);
            console.log("- Generated hash:", passwordHash);
            console.log("- Stored hash:", storedHash);
            console.log("- Match:", passwordHash === storedHash);
            
            if (passwordHash !== storedHash) {
              setError('Incorrect master password');
              setIsProcessing(false);
              return;
            }
            
            // If password check passes, store it locally
            saveMasterPassword(password, settings.password_hint || undefined);
            
            // If there's an encrypted token in the repo settings, set it locally too
            if (settings.github_token) {
              try {
                const decryptedToken = decryptToken(settings.github_token, password);
                if (decryptedToken && (decryptedToken.startsWith('ghp_') || decryptedToken.startsWith('github_'))) {
                  // Successfully decrypted the token, store it locally
                  encryptAndStoreData('github_token', decryptedToken, password);
                  localStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, settings.github_token);
                  localStorage.setItem(STORAGE_KEYS.TOKEN_ENCRYPTED, 'true');
                }
              } catch (e) {
                console.error("Failed to decrypt token from repository settings", e);
                // Continue anyway - user can set up the token later
              }
            }
            
            // Mark setup as complete since we're using existing settings
            localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true');
            
            // Complete setup
            onSetupComplete(password);
            return;
          } catch (error) {
            console.error("Error verifying repository password:", error);
            setError('Error verifying repository password: ' + (error instanceof Error ? error.message : String(error)));
            setIsProcessing(false);
            return;
          }
        }

        // Validate password for initial setup
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
        
        // Save master password locally
        saveMasterPassword(password, passwordHint);
        
        // Handle GitHub token if provided
        if (token) {
          try {
            // Validate the token
            const result = await validateToken(token.trim());
            if (!result.valid) {
              setError(result.message || 'Invalid GitHub token');
              return;
            }
            
            // Save token to localStorage
            encryptAndStoreData('github_token', token, password);
            
            // If user wants to use repo settings, save to repo
            // With this combined approach:
            if (useRepoSettings) {
                // Create a single settings object with all properties
                const passwordHash = hashPassword(password);
                const encryptedToken = getEncryptedGitHubToken(token, password);
                
                // Save all settings in one commit
                const settingsToSave = {
                master_password_hash: passwordHash,
                password_hint: passwordHint || '',
                github_token: encryptedToken
                };
                
                // Make a single call to save repository settings
                await saveRepoSettings(settingsToSave, token);
                console.log("All settings saved to repository in a single commit");
            }
          } catch (error) {
            console.error('Error processing token:', error);
            // Continue anyway - we still want to complete setup
          }
        }
        
        // Mark setup as complete
        localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true');
      } 
      else { // Token mode
        // Verify the master password
        if (!password) {
          setError('Please enter your master password');
          return;
        }
        
        const settings = getMasterPasswordSettings();
        if (settings.passwordHash && !verifyPassword(password, settings.passwordHash)) {
          setError('Incorrect master password');
          return;
        }
        
        // Validate the new token
        if (!token.trim()) {
          setError('Please enter a GitHub token');
          return;
        }
        
        setTokenValidating(true);
        const result = await validateToken(token.trim());
        
        if (result.valid) {
          // Save token to localStorage using new unified method
          encryptAndStoreData('github_token', token.trim(), password);
          
          // If user opted to store in repo, save to repo settings
          if (useRepoSettings) {
            try {
              // To avoid making a second commit, we need to get the existing settings
              // and update the token in a single commit
              const repoSettings = await loadRepoSettings();
              
              // Use consistent encryption method
              const encryptedTokenForRepo = getEncryptedGitHubToken(token.trim(), password);
              
              // Create a merged settings object
              const updatedSettings = {
                master_password_hash: repoSettings.master_password_hash || hashPassword(password),
                password_hint: repoSettings.password_hint || settings.hint || '',
                github_token: encryptedTokenForRepo
              };
              
              // Save everything in one commit
              await saveRepoSettings(updatedSettings, token.trim());
              console.log("All settings updated in repository in a single commit");
            } catch (repoError) {
              console.error("Failed to save token to repository:", repoError);
              // Continue anyway - local storage is still updated
            }
          }
        } else {
          setError(result.message || 'Invalid token');
          setIsProcessing(false);
          setTokenValidating(false);
          return;
        }
      }
      
      // Notify parent that setup is complete
      onSetupComplete(password);
    } catch (error) {
      setError('Error: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsProcessing(false);
      setTokenValidating(false);
    }
  };

  if (loadingRepoSettings && mode === 'initial') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Different UI based on mode
  if (mode === 'initial') {
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

                {/* GitHub token input if not provided via env */}
                {!envToken && (
                  <div>
                    <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                      GitHub Token (Optional)
                    </label>
                    <input
                      type="password"
                      id="token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      You can also add a GitHub token later
                    </p>
                  </div>
                )}
                
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
                disabled={isProcessing}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isProcessing ? "Processing..." : (repoSettingsAvailable ? "Continue" : "Complete Setup")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  
  // Token Update Mode
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">GitHub Setup</h1>
        
        <div className="mb-6 text-gray-700">
          <p className="mb-4">To manage your content, you need to provide a GitHub personal access token (PAT). This token will be used to commit changes to your repository.</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to your <a href="https://github.com/settings/tokens" target="_blank" rel="noopener" className="text-indigo-600 hover:text-indigo-800">GitHub Personal Access Tokens</a> page</li>
            <li>Click "Generate new token" → "Generate new token (classic)"</li>
            <li>Give it a descriptive name (like "Brain CMS")</li>
            <li><strong>For a private repository</strong>: Select the <strong>repo</strong> scope</li>
            <li><strong>For a public repository</strong>: Select the <strong>public_repo</strong> scope</li>
            <li>Click "Generate token" and copy the token</li>
          </ol>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="pt-3 pb-2 border-t">
            <div className="mb-3">
              <h2 className="block text-sm font-medium text-gray-700">
                Confirm Your Master Password
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Your GitHub token will be encrypted with your master password for security.
              </p>
            </div>
            
            <div>
              <label htmlFor="masterPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Enter your master password
              </label>
              <input
                type="password"
                id="masterPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your master password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              
              {passwordHint && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-semibold">Password hint:</span> {passwordHint}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              id="storeInRepo"
              type="checkbox"
              checked={useRepoSettings}
              onChange={(e) => setUseRepoSettings(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="storeInRepo" className="ml-2 text-sm text-gray-700">
              Store encrypted token in repository (for multi-device access)
            </label>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md">
              <p>{error}</p>
            </div>
          )}
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={!token.trim() || isProcessing}
              className={`w-full px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {tokenValidating ? 'Validating...' : 'Save Token'}
            </button>
          </div>
        </form>
        
        <div className="mt-4 text-xs text-gray-500">
          Note: Your encrypted token will be stored in your browser's local storage{useRepoSettings ? ' and in your repository' : ''}.
        </div>
      </div>
    </div>
  );
};

export default AuthSetup;