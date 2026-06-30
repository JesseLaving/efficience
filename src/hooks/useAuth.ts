import { useEffect, useState } from 'react';
import { getCurrentUser, type AuthUser } from '../lib/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getCurrentUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return { isAuth: !!user, user, loading };
}
