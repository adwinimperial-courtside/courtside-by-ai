import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div style={{ fontFamily: 'sans-serif', margin: 0, padding: 0 }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#F97316', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="1.5"/>
              <path d="M1 10h18M10 1v18M4 4l12 12M16 4L4 16" stroke="white" strokeWidth="1"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>
            Courtside <span style={{ color: '#F97316' }}>by AI</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/Login')}
            style={{ background: 'transparent', color: '#1E2A5E', border: '1.5px solid #1E2A5E', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            {t('landing.signIn', 'Sign in')}
          </button>
          <button
            onClick={() => navigate('/Login')}
            style={{ background: '#1E2A5E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            {t('landing.getStarted', 'Get started')}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '4rem 2rem 3rem', textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: '#FFF3E8', color: '#C24D00', fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 999, marginBottom: '1.25rem' }}>
          {t('landing.badge', 'Built for basketball league operators')}
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 500, color: '#111827', lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.5px' }}>
          {t('landing.headline', 'Run your league.')}<br />
          {t('landing.headlineSub', 'Track every')}{' '}
          <span style={{ color: '#F97316' }}>{t('landing.headlineAccent', 'play.')}</span>
        </h1>
        <p style={{ fontSize: 17, color: '#6b7280', lineHeight: 1.7, marginBottom: '2rem', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          {t('landing.subheadline', 'Courtside by AI gives coaches, admins, and players everything they need — live stat tracking, standings, analytics, and AI-powered game stories — in one platform.')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/Login')}
            style={{ background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            {t('landing.startFree', 'Start for free')}
          </button>
          <button
            onClick={() => navigate('/Login')}
            style={{ background: 'transparent', color: '#111827', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            {t('landing.howItWorks', 'See how it works')}
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '3rem 2rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#F97316', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          {t('landing.featuresLabel', 'Features')}
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, color: '#111827', marginBottom: '0.75rem', letterSpacing: '-0.3px' }}>
          {t('landing.featuresTitle', 'Everything your league needs')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: '2rem' }}>
          {[
            { icon: '📊', title: t('landing.feat1Title', 'Live stat tracking'), desc: t('landing.feat1Desc', 'Track points, rebounds, assists, and fouls in real time during the game.') },
            { icon: '🏆', title: t('landing.feat2Title', 'Standings & awards'), desc: t('landing.feat2Desc', 'Automatic standings, award leaderboards, and season summaries.') },
            { icon: '📋', title: t('landing.feat3Title', 'Roster management'), desc: t('landing.feat3Desc', 'Manage teams, players, and coaches across multiple leagues.') },
            { icon: '✨', title: t('landing.feat4Title', 'AI game stories'), desc: t('landing.feat4Desc', 'Auto-generated game narratives and end-of-season recaps powered by AI.') },
            { icon: '📅', title: t('landing.feat5Title', 'Schedule & results'), desc: t('landing.feat5Desc', 'Build schedules, log results, and publish live box scores.') },
            { icon: '👥', title: t('landing.feat6Title', 'Multi-role access'), desc: t('landing.feat6Desc', 'Separate views and permissions for admins, coaches, and players.') },
          ].map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>© 2026 Courtside by AI. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <span style={{ fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Privacy</span>
          <span style={{ fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Terms</span>
          <span style={{ fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Contact</span>
        </div>
      </footer>

    </div>
  );
}
