import React, { useState, useEffect } from 'react';
import AdminInterface from './AdminInterface';
import AuthSetup from './AuthSetup';
import TokenTester from './TokenTester';
import TokenDebug from './TokenDebug';
import { 
  hashPassword, 
  verifyPassword, 
  getMasterPasswordSettings, 
  saveMasterPassword,
  encryptAndStoreData,
  getDecryptedData,
  STORAGE_KEYS,
  loadRepoSettings,
  saveRepoSettings,
  getEncryptedGitHubToken, // Use consistent encryption method
  getGitHubToken // Use the new unified token getter
} from '../../utils/cryptoUtil';

import { getContentList, validateToken } from '../../utils/githubDirectService';
import { normalizeContentItems } from '../../utils/contentHelpers';

interface ClientAdminAppProps {
  albums: any[];
  photos: any[];
  snips: any[];
  playlists: any[];
}

interface ContentData {
  albums: any[];
  photos: any[];
  snips: any[];
  playlists: any[];
}

// Default fallback password if env var isn't available
const DEFAULT_PASSWORD = 'admin123';
const TOKEN_EXPIRY_DAYS = 30;

const ClientAdminApp: React.FC<ClientAdminAppProps> = (props) => {
  // Move environment variable access inside the component to prevent build-time issues
  const [envVars, setEnvVars] = useState({
    password: DEFAULT_PASSWORD,
    token: ''
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [gitHubToken, setGitHubToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [contentData, setContentData] = useState<ContentData>({
    albums: props.albums || [],
    photos: props.photos || [],
    snips: props.snips || [],
    playlists: props.playlists || []
  });

  // Load environment variables safely after component mount
  useEffect(() => {
    // Access environment variables only after component is mounted
    const envToken = import.meta.env.VITE_GITHUB_TOKEN;

    // Check if we have a master password hash already set
    const masterPasswordHash = localStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
    
    setEnvVars({
      password: '', // We'll use the encrypted one instead
      token: envToken || ''
    });
    
    // Try to load repo settings
    async function attemptLoadRepoSettings() {
      try {
        const settings = await loadRepoSettings();
        if (settings && settings.master_password_hash) {
          // We have repo settings, ensure we're in a state to prompt for master password
          if (!localStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HASH)) {
            localStorage.setItem(STORAGE_KEYS.MASTER_PASSWORD_HASH, settings.master_password_hash);
          }
          if (settings.password_hint) {
            localStorage.setItem(STORAGE_KEYS.MASTER_PASSWORD_HINT, settings.password_hint);
          }
        }
      } catch (error) {
        console.log('Could not load repository settings:', error);
      }
    }
    
    attemptLoadRepoSettings();
  }, []);
  
  // Check for existing auth on mount
  useEffect(() => {
    const storedAuth = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
    const storedExpiryDate = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
    let tokenExpired = false;
    
    // Check if token has expired
    if (storedExpiryDate) {
      const expiryDate = new Date(storedExpiryDate);
      if (expiryDate < new Date()) {
        // Token expired, clear it
        localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
        tokenExpired = true;
      }
    }
    
    if (storedAuth && !tokenExpired) {
      // If we have valid auth data, set authenticated
      setIsAuthenticated(true);
      
      // Try to get token from session storage if available (temporary storage during session)
      const sessionPassword = sessionStorage.getItem('master_password');
      if (sessionPassword) {
        const token = getDecryptedData('github_token', sessionPassword);
        if (token) {
          console.log("Retrieved token from session storage");
          setGitHubToken(token);
        } else if (envVars.token) {
          // If we have an environment token, use it
          setGitHubToken(envVars.token);
        }
      } else if (envVars.token) {
        // If no session password but we have an env token, use it
        setGitHubToken(envVars.token);
      }
    }
    
    setLoading(false);
  }, [envVars]);

  // Check if initial setup is complete
  useEffect(() => {
    async function checkSetup() {
      try {
        // First check if repository settings exist
        const repoSettings = await loadRepoSettings();
        
        if (repoSettings && repoSettings.master_password_hash) {
          // We have repository settings
          if (!localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE)) {
            // Local setup is not complete, but we have repo settings
            // Show the setup screen that will ask for the master password
            setIsSetupComplete(false);
          }
        } else {
          // No repo settings, check local storage
          const setupComplete = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true';
          setIsSetupComplete(setupComplete);
        }
      } catch (e) {
        console.error('Failed to check repo settings:', e);
        // If we can't access repo settings, fall back to local storage
        const setupComplete = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true';
        setIsSetupComplete(setupComplete);
      }
      
      setLoading(false);
    }
    
    checkSetup();
  }, []);

  // Fetch content from GitHub when token becomes available
  useEffect(() => {
    const fetchLiveContent = async () => {
      if (!gitHubToken) return;
      
      setLoading(true);
      
      try {
        // Validate the token before using it
        const validationResult = await validateToken(gitHubToken);
        if (!validationResult.valid) {
          console.error("Token validation failed:", validationResult.message);
          setGitHubToken(null);
          setLoading(false);
          return;
        }
        
        // Make GitHub API calls to fetch content
        const fetchTypes = ['albums', 'photos', 'snips', 'playlists'];
        const newData: ContentData = {
          albums: [],
          photos: [],
          snips: [],
          playlists: []
        };
        
        // Fetch each content type in parallel
        const results = await Promise.all(
          fetchTypes.map(type => getContentList(gitHubToken, type))
        );
        
        // Process results
        results.forEach((result, index) => {
          const type = fetchTypes[index] as keyof typeof contentData;
          
          if (result.success && result.items && result.items.length > 0) {
            // Only normalize once and only when we have items
            newData[type] = normalizeContentItems(result.items, type);
            console.log(`Set ${result.items.length} ${type} items from GitHub`);
          } else if (result.error) {
            console.error(`Error fetching ${type}:`, result.error);
            
            // Use existing props data as fallback
            if (props[type] && props[type].length > 0) {
              console.log(`Using ${props[type].length} initial ${type} items from Astro`);
              newData[type] = normalizeContentItems(props[type], type);
            } else {
              // If no props data, set empty array
              newData[type] = [];
            }
          } else {
            // If no items returned and no error, use props data
            if (props[type] && props[type].length > 0) {
              console.log(`Using ${props[type].length} initial ${type} items from Astro`);
              newData[type] = normalizeContentItems(props[type], type);
            } else {
              // If no props data, set empty array
              newData[type] = [];
            }
          }
        });
        
        // Update all content at once to avoid duplicate renders
        setContentData(newData);
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLiveContent();
  }, [gitHubToken]);

  // Debug the token value
  useEffect(() => {
    if (gitHubToken) {
      console.log(
        "Using GitHub token:", 
        gitHubToken.substring(0, 4) + '...' + gitHubToken.substring(gitHubToken.length - 4)
      );
    }
  }, [gitHubToken]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get the master password hash
    const settings = getMasterPasswordSettings();
    
    if (settings.passwordHash) {
      // Verify against master password hash
      if (verifyPassword(password, settings.passwordHash)) {
        // Store password temporarily in session storage for token encryption
        sessionStorage.setItem('master_password', password);
        
        // Set login success
        loginSuccess();
        
        // Try to get decrypted GitHub token using the unified approach
        const decryptedToken = getDecryptedData('github_token', password);
        if (decryptedToken) {
          setGitHubToken(decryptedToken);
        } else if (envVars.token) {
          // Encrypt and store the environment token
          encryptAndStoreData('github_token', envVars.token, password);
          setGitHubToken(envVars.token);
          
          // Save to repository if possible
          saveSettingsToRepository(password, envVars.token);
        }
      } else {
        setLoginError('Incorrect password');
        setTimeout(() => setLoginError(''), 3000);
      }
    } else {
      setLoginError('No master password found. Please complete setup first.');
      setTimeout(() => setLoginError(''), 3000);
    }
  };
  
  // Helper function to handle successful login
  const loginSuccess = () => {
    // Set auth data with expiration
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + TOKEN_EXPIRY_DAYS);
    
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'authenticated');
    localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiryDate.toISOString());
    
    setIsAuthenticated(true);
    setLoginError('');
  };

  // Save settings to repository for cross-device access
  const saveSettingsToRepository = async (masterPassword: string, token: string) => {
    try {
      // First validate that the token works
      const validation = await validateToken(token);
      if (!validation.valid) {
        console.error('Cannot save settings to repo: Invalid token');
        return;
      }
      
      // Get the hash of the master password
      const passwordHash = hashPassword(masterPassword);
      const settings = getMasterPasswordSettings();
      
      // Use consistent encryption for the token
      const encryptedToken = getEncryptedGitHubToken(token, masterPassword);
      
      // Save all settings in a single commit
      const repoSettings = {
        github_token: encryptedToken,
        master_password_hash: passwordHash,
        password_hint: settings.hint || ''
      };
      
      // Save to repository
      await saveRepoSettings(repoSettings, token);
      console.log('Settings saved to repository in a single commit');
    } catch (error) {
      console.error('Failed to save settings to repository:', error);
    }
  };

  const handleLogout = () => {
    // Clear authenticated status
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    sessionStorage.removeItem('master_password');
    
    setIsAuthenticated(false);
    setGitHubToken(null);
  };

  const handleTokenSave = (password: string) => {
    // This gets called when a token is saved through AuthSetup in token mode
    
    // Get the token from the encrypted data storage
    const token = getDecryptedData('github_token', password);
    
    if (token) {
      // Successfully got the token
      setGitHubToken(token);
      
      // Store password temporarily for session
      sessionStorage.setItem('master_password', password);
    }
  };

  const handleSetupComplete = (newPassword: string) => {
    setIsSetupComplete(true);
    
    // Auto login after setup
    setPassword(newPassword);
    
    // Set auth data with expiration
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + TOKEN_EXPIRY_DAYS);
    
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'authenticated');
    localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiryDate.toISOString());
    localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true');
    
    setIsAuthenticated(true);
    
    // Store password temporarily in session storage for token encryption
    sessionStorage.setItem('master_password', newPassword);
    
    // Try to get decrypted GitHub token if it exists in repository settings
    const handleRepoToken = async () => {
      try {
        const repoSettings = await loadRepoSettings();
        if (repoSettings && repoSettings.github_token) {
          try {
            // First try with the new unified storage
            let decryptedToken = getDecryptedData('github_token', newPassword);
            
            // If no token found in unified storage, get it directly from repo settings
            if (!decryptedToken) {
              // Use getGitHubToken instead of direct decryptToken call - it's already imported
              decryptedToken = getGitHubToken(newPassword);
            }
            
            if (decryptedToken && (decryptedToken.startsWith('ghp_') || decryptedToken.startsWith('github_'))) {
              // Successfully decrypted token from repo settings
              setGitHubToken(decryptedToken);
              
              // Also store in local storage
              encryptAndStoreData('github_token', decryptedToken, newPassword);
            }
          } catch (e) {
            console.error('Failed to decrypt repository token:', e);
          }
        }
      } catch (e) {
        console.error('Failed to load repository settings:', e);
      }
    };
    
    handleRepoToken();
  };

  // Inactivity timeout setup (auto logout after 2 hours of inactivity)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let inactivityTimer: number;
    
    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
      }
      
      // Auto logout after 2 hours of inactivity
      inactivityTimer = window.setTimeout(() => {
        handleLogout();
        alert('You have been logged out due to inactivity');
      }, 2 * 60 * 60 * 1000);
    };
    
    // Set up event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });
    
    resetInactivityTimer();
    
    return () => {
      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [isAuthenticated]);

  // Fix loading screen div structure
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Show initial setup screen if needed
  if (!isSetupComplete) {
    return (
      <AuthSetup 
        onSetupComplete={handleSetupComplete}
        envToken={envVars.token}
        mode="initial"
      />
    );
  }

  // Fix login screen div structure
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Brain Admin Login</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Master Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              
              {/* Display password hint if available */}
              {getMasterPasswordSettings().hint && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-semibold">Password hint:</span> {getMasterPasswordSettings().hint}
                </div>
              )}
            </div>
            {loginError && (
              <div className="text-red-600 text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Log in
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Skip GitHub setup if token is available from environment or has been decrypted
  if (isAuthenticated && !gitHubToken) {
    return <AuthSetup onSetupComplete={handleTokenSave} mode="token" />;
  }

  // Fix main return structure at the bottom
  return (
    <div className="container mx-auto px-4">
      <div className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-sm text-green-600 mb-2">
            GitHub token is active and ready to use
          </div>
          {/* Token testing components */}
          <TokenTester token={gitHubToken || ''} />
        </div>
        
        <button 
          onClick={handleLogout} 
          className="text-gray-600 hover:text-gray-800 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          Logout
        </button>
      </div>
      
      <AdminInterface 
        albums={contentData.albums} 
        photos={contentData.photos} 
        snips={contentData.snips} 
        playlists={contentData.playlists} 
        gitHubToken={gitHubToken || ''} 
      />
    </div>
  );
};

export default ClientAdminApp;
