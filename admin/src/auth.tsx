import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from './api';

interface AuthState {
  ready: boolean;
  authed: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false));
    api
      .get('/me')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, []);

  const login = async (password: string) => {
    await api.post('/login', { password });
    setAuthed(true);
  };
  const logout = async () => {
    await api.post('/logout').catch(() => {});
    setAuthed(false);
  };

  return <Ctx.Provider value={{ ready, authed, login, logout }}>{children}</Ctx.Provider>;
}
