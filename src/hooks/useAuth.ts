import { useEffect, useState } from 'react';
import { isAuthenticated } from '../lib/auth';

export interface AuthUser {
  name?: string;
  email?: string;
}

export function useAuth() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (isAuthenticated()) {
        // Parse user info from session cookie
        try {
          const sessionCookie = document.cookie
            .split(';')
            .find(c => c.trim().startsWith('session='));

          if (sessionCookie) {
            const token = sessionCookie.split('=')[1];
            const decoded = atob(token);
            const session = JSON.parse(decoded);
            setUser({
              name: session.name,
              email: session.email,
            });
          }
        } catch (e) {
          console.error('Failed to parse session:', e);
        }
        setIsAuth(true);
      } else {
        setIsAuth(false);
      }
      setLoading(false);
    }

    checkAuth();
  }, []);

  return { isAuth, user, loading };
}
