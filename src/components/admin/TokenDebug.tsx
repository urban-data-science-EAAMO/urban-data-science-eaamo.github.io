import React, { useState } from 'react';

interface TokenDebugProps {
  token: string;
  envToken: string;
}

const TokenDebug: React.FC<TokenDebugProps> = ({ token, envToken }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className="mt-4 p-4 border border-dashed border-yellow-400 bg-yellow-50 rounded-md">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-lg text-yellow-800">Token Debugging</h3>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs px-2 py-1 bg-yellow-200 rounded hover:bg-yellow-300"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-3 text-sm font-mono">
          <div className="mb-2">
            <div className="font-semibold">Environment Token:</div>
            <div className="bg-gray-100 p-2 rounded overflow-x-auto whitespace-nowrap">
              {envToken ? envToken : 'Not Set'}
            </div>
          </div>
          
          <div>
            <div className="font-semibold">Current Token:</div>
            <div className="bg-gray-100 p-2 rounded overflow-x-auto whitespace-nowrap">
              {token || 'Not Set'}
            </div>
          </div>
          
          <p className="mt-3 text-red-600">
            Remove this component before production deployment!
          </p>
        </div>
      )}
    </div>
  );
};

export default TokenDebug;
