
import React, { useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { ChatScreen } from './components/ChatScreen';


const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <main className="h-screen w-screen">
         {isLoggedIn ? <ChatScreen /> : <AuthScreen onLoginSuccess={handleLoginSuccess} />}
      </main>
    </div>
  );
};

export default App;
