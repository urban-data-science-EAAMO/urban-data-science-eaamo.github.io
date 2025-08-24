import React, { useState, useEffect } from 'react';
import { validateToken } from '../src/utils/githubDirectService'; // Changed from githubService
import { 
  encryptToken, 
  encryptAndStoreData, 
  getMasterPasswordSettings, 
  verifyPassword,
  STORAGE_KEYS,
  saveRepoSettings // Add this import
} from '../src/utils/cryptoUtil';

interface GitHubSetupProps {
  onTokenSave: (token: string, encrypted: boolean) => void;
}

const GitHubSetup: React.FC<GitHubSetupProps> = ({ onTokenSave }) => {
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [storeInRepo, setStoreInRepo] = useState(true); // Add this state
  
  // Load existing master password hint if available
  useEffect(() => {
    const settings = getMasterPasswordSettings();
    if (settings.hint) {
      setPasswordHint(settings.hint);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) return;
    
    // Validate password
    if (!masterPassword) {
      setPasswordError('Please enter your master password');
      return;
    }
    
    // Verify password against stored hash
    const settings = getMasterPasswordSettings();
    if (settings.passwordHash && !verifyPassword(masterPassword, settings.passwordHash)) {
      setPasswordError('Incorrect master password');
      return;
    }
    
    setValidating(true);
    setValidationError(null);
    setPasswordError(null);
    
    try {
      // Validate the token before saving
      const result = await validateToken(token.trim());
      
      if (result.valid) {
        // Encrypt and store the GitHub token with the master password
        encryptAndStoreData('github_token', token.trim(), masterPassword);
        
        // For compatibility, also store it the old way
        const encryptedToken = encryptToken(token.trim(), masterPassword);
        localStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, encryptedToken);
        localStorage.setItem(STORAGE_KEYS.TOKEN_ENCRYPTED, 'true');

        // If user opted to store in repo, save to repo settings
        if (storeInRepo) {
          try {
            // Encrypt token for the repo
            const encryptedTokenForRepo = encryptToken(token.trim(), masterPassword);
            
            // Create partial settings object with just the encrypted token
            const partialSettings = {
              github_token: encryptedTokenForRepo
            };
            
            // This will merge with existing settings
            await saveRepoSettings(partialSettings, token.trim());
            console.log("Token saved to repository settings");
          } catch (repoError) {
            console.error("Failed to save token to repository:", repoError);
            // Continue anyway - local storage is still updated
          }
        }
        
        // Notify parent
        onTokenSave(encryptedToken, true);
      } else {
        setValidationError(result.message || 'Invalid token');
      }
    } catch (error) {
      setValidationError(
        error instanceof Error 
          ? error.message 
          : 'Error validating token'
      );
    } finally {
      setValidating(false);
    }
  };

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
            {validationError && (
              <p className="mt-1 text-sm text-red-600">{validationError}</p>
            )}
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
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter your master password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              
              {passwordHint && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-semibold">Password hint:</span> {passwordHint}
                </div>
              )}
              
              {passwordError && (
                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
              )}
            </div>
          </div>
          
          {/* Add repo storage option */}
          <div className="flex items-center">
            <input
              id="storeInRepo"
              type="checkbox"
              checked={storeInRepo}
              onChange={(e) => setStoreInRepo(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="storeInRepo" className="ml-2 text-sm text-gray-700">
              Store encrypted token in repository (for multi-device access)
            </label>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={!token.trim() || validating}
              className="w-full px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {validating ? 'Validating...' : 'Save Token'}
            </button>
          </div>
        </form>
        
        <div className="mt-4 text-xs text-gray-500">
          Note: Your encrypted token will be stored in your browser's local storage.
        </div>
      </div>
    </div>
  );
};

export default GitHubSetup;
