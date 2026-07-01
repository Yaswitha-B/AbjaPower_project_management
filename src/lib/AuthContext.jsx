import { createContext, useContext, useEffect, useState } from 'react';
import { authClient } from '../auth.js';
import { checkSession } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [checking, setChecking] = useState(true);

  // Re-verify against the backend on load rather than trusting anything
  // cached client-side — holding a session token isn't the same as being
  // authorized; user_roles decides that, every time.
  useEffect(() => {
    checkSession()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const login  = (loggedInUser) => setUser(loggedInUser);
  const logout = () => {
    authClient.signOut().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
