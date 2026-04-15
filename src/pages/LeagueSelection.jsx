import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export default function LeagueSelection() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    loadLeagues();
  }, [currentUser]);

  async function loadLeagues() {
    setLoading(true);
    setError(null);
    try {
      // Get all leagues this user is a member of
      const { data: memberships, error: memErr } = await supabase
        .from('user_league_memberships')
        .select('league_id, role, leagues(id, name, logo_url, is_active)')
        .eq('user_id', currentUser.id)
        .eq('is_active', true);

      if (memErr) throw memErr;

      const activeLeagues = memberships
        .map(m => ({ ...m.leagues, role: m.role }))
        .filter(l => l && l.is_active);

      // If only one league, auto-set it and go straight to Schedule
      if (activeLeagues.length === 1) {
        await setDefaultAndNavigate(activeLeagues[0].id);
        return;
      }

      // Check if user already has a default set
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('default_league_id')
        .eq('id', currentUser.id)
        .single();

      if (profErr) throw profErr;

      if (profile.default_league_id) {
        navigate('/Schedule', { replace: true });
        return;
      }

      setLeagues(activeLeagues);
    } catch (err) {
      setError(t('leagueSelection.errorLoading', 'Failed to load your leagues. Please try again.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function setDefaultAndNavigate(leagueId) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_league_id: leagueId })
        .eq('id', currentUser.id);

      if (error) throw error;
      navigate('/Schedule', { replace: true });
    } catch (err) {
      setError(t('leagueSelection.errorSaving', 'Failed to save your selection. Please try again.'));
      console.error(err);
      setSaving(false);
    }
  }

  if (loading || saving) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 32, height: 32, border: '4px solid #e5e7eb', borderTopColor: '#1E2A5E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', background: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, background: '#F97316', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="1.5"/>
              <path d="M1 10h18M10 1v18M4 4l12 12M16 4L4 16" stroke="white" strokeWidth="1"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: '#111827', marginBottom: 8 }}>
            {t('leagueSelection.title', 'Choose your league')}
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280' }}>
            {t('leagueSelection.subtitle', 'Select which league to open by default.')}
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 14, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {leagues.map(league => (
            <button
              key={league.id}
              onClick={() => setDefaultAndNavigate(league.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#1E2A5E'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              {league.logo_url ? (
                <img src={league.logo_url} alt={league.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, background: '#EEF1FA', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏀</div>
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>{league.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', textTransform: 'capitalize' }}>{league.role.replace('_', ' ')}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#9ca3af' }}>→</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
