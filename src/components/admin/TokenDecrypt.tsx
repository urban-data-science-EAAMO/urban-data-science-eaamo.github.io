import React, { useState, useEffect } from 'react';
import { decryptToken, getMasterPasswordSettings, verifyPassword, getDecryptedData, STORAGE_KEYS } from '../../utils/cryptoUtil';

interface TokenDecryptProps {
  encryptedToken: string;
  onDecrypt: (decryptedToken: string) => void;
}

const TokenDecrypt: React.FC<TokenDecryptProps> = ({ encryptedToken, onDecrypt }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Get password hint from unified system
    const settings = getMasterPasswordSettings();
    if (settings.hint) {
      setHint(settings.hint);
    }
    
    setLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Verify against the master password hash
      const settings = getMasterPasswordSettings();
      
      if (settings.passwordHash && !verifyPassword(password, settings.passwordHash)) {
        setError('Incorrect password');
        return;
      }
      
      // Try to decrypt the token
      let decrypted;
      
      // First check if token is stored in the new unified system
      const storedToken = getDecryptedData('github_token', password);
      if (storedToken) {
        decrypted = storedToken;
      } else {
        // Fall back to decrypting the provided token
        decrypted = decryptToken(encryptedToken, password);
      }
      
      if (!decrypted) {
        setError('Incorrect password');
        return;
      }
      
      // Check if token looks like a GitHub token
      if (!decrypted.startsWith('ghp_') && !decrypted.startsWith('github_')) {
        setError('Incorrect password');
        return;
      }
      
      // Password was correct
      onDecrypt(decrypted);
    } catch (e) {
      setError('Decryption failed. Please check your password.');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Unlock GitHub Token</h1>
        
        <p className="mb-4 text-gray-700">
          Enter your master password to unlock your GitHub token.
        </p>
        
        {hint && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">
            <p className="text-sm">
              <span className="font-semibold">Password hint:</span> {hint}
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Master Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TokenDecrypt;
