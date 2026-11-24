import { createContext, useContext } from 'react';
import type { AuthContextValue } from './AuthGuard';

export const AuthContext = createContext<AuthContextValue>({
  loading: true,
  user: null,
  role: null,
  mfaStatus: null,
  refreshMfa: async () => {},
});

export const useAuth = () => useContext(AuthContext);
