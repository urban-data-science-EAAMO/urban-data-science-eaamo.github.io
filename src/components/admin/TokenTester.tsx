import React, { useState } from 'react';
import { validateToken } from '../../utils/githubDirectService'; // Updated import path

interface TokenTesterProps {
  token: string;
}

const TokenTester: React.FC<TokenTesterProps> = ({ token }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const testToken = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      const validationResult = await validateToken(token);
      setResult(validationResult);
    } catch (error) {
      setResult({
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 p-4 border rounded-md">
      <h3 className="font-medium text-lg mb-2">Token Tester</h3>
      <p className="mb-2 text-sm">Test if your GitHub token is working correctly</p>
      
      <button
        onClick={testToken}
        disabled={testing || !token}
        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
      >
        {testing ? 'Testing...' : 'Test Token'}
      </button>
      
      {result && (
        <div className={`mt-2 p-2 rounded ${result.valid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p>{result.valid ? '✅ Token is valid!' : `❌ ${result.message || 'Invalid token'}`}</p>
        </div>
      )}
    </div>
  );
};

export default TokenTester;
