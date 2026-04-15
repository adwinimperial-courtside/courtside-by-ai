import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      navigate('/Landing', { replace: true });
    } else {
      navigate('/LeagueSelection', { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, navigate]);

  return null;
}
