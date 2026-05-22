import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('gameId') || urlParams.get('gameid');
const logoUrl = urlParams.get('logo');

const formatPeriod = (game) => {
  if (!game) return '';
  const type = game.period_type === 'halves' ? 'H' : 'Q';
  return `${type}${game.clock_period || 1}`;
};

const truncate = (name, len = 8) =>
  name && name.length > len ? name.slice(0, len) : (name || '');

export default function Overlay() {
  const [liveGame, setLiveGame] = useState(null);
  const queryClient = useQueryClient();

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.get(gameId),
    enabled: !!gameId,
    staleTime: 0,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (game) setLiveGame(game);
  }, [game]);

  const { data: homeTeam } = useQuery({
    queryKey: ['team', game?.home_team_id],
    queryFn: () => base44.entities.Team.get(game.home_team_id),
    enabled: !!game?.home_team_id,
  });

  const { data: awayTeam } = useQuery({
    queryKey: ['team', game?.away_team_id],
    queryFn: () => base44.entities.Team.get(game.away_team_id),
    enabled: !!game?.away_team_id,
  });

  useEffect(() => {
    if (!gameId) return;
    const unsub = base44.entities.Game.subscribe((event) => {
      if (event.id === gameId) {
        setLiveGame(event.data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      }
    });
    return () => unsub();
  }, [gameId, queryClient]);

  if (!gameId) return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'transparent' }} />
  );

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: 'transparent',
        pointerEvents: 'none',
        fontFamily: 'sans-serif',
      }}>

        {/* A. TOP LEFT — streamer logo */}
        {logoUrl && (
          <div style={{ position: 'absolute', top: 20, left: 20 }}>
            <img
              src={logoUrl}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
              alt=""
            />
          </div>
        )}

        {/* B. TOP RIGHT — live badge + branding */}
        <div style={{
          position: 'absolute', top: 20, right: 20,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '0.5px solid rgba(239,68,68,0.25)',
            borderRadius: 20,
            padding: '2px 8px',
            fontSize: 9,
            color: '#ef4444',
            display: 'flex', gap: 4, alignItems: 'center',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#ef4444',
              animation: 'pulse 1.2s infinite',
            }} />
            LIVE
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            Powered by <span style={{ color: '#F26B1F' }}>Courtside by AI</span>
          </div>
        </div>

        {/* C. BOTTOM RIGHT — scoreboard */}
        <div style={{ position: 'absolute', bottom: 20, right: 20 }}>
          <div style={{
            background: 'rgba(0,0,0,0.82)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            {/* Home row */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '4px 10px', gap: 7,
              borderBottom: '0.5px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: homeTeam?.color || '#334155', flexShrink: 0,
              }} />
              <span style={{
                fontSize: 9, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 0.5, width: 60,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                {truncate(homeTeam?.name || 'Home')}
              </span>
              <span style={{
                fontSize: 14, fontFamily: 'monospace',
                color: 'white', width: 22, textAlign: 'center',
              }}>
                {liveGame?.home_score ?? 0}
              </span>
              <div style={{ width: '0.5px', height: 12, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36 }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'white' }}>
                  {liveGame?.clock_time_left || '—'}
                </span>
                <span style={{ fontSize: 7, color: '#F26B1F', fontWeight: 500 }}>
                  {formatPeriod(liveGame)}
                </span>
              </div>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: '#F26B1F', flexShrink: 0 }} />
            </div>

            {/* Away row */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '4px 10px', gap: 7,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: awayTeam?.color || '#334155', flexShrink: 0,
              }} />
              <span style={{
                fontSize: 9, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 0.5, width: 60,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                {truncate(awayTeam?.name || 'Away')}
              </span>
              <span style={{
                fontSize: 14, fontFamily: 'monospace',
                color: 'white', width: 22, textAlign: 'center',
              }}>
                {liveGame?.away_score ?? 0}
              </span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}