import React from "react";

function TeamDot({ color }) {
  return (
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
      style={{ backgroundColor: color }}
    />
  );
}

function playerLabel(player) {
  if (!player) return null;
  return player.jersey_number != null ? `#${player.jersey_number} ${player.name}` : player.name;
}

function SubstitutionContent({ log, players, dotColor }) {
  let subData = null;
  try { subData = JSON.parse(log.stat_label); } catch (e) {}

  if (!subData || (!subData.out_ids?.length && !subData.in_ids?.length)) {
    return (
      <>
        <div className="flex items-center justify-center gap-1.5">
          <TeamDot color={dotColor} />
          <span className="text-xs font-bold text-slate-800">Substitution</span>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-0.5">Substitution recorded</p>
      </>
    );
  }

  const outPlayers = (subData.out_ids || []).map(id => players.find(p => p.id === id)).filter(Boolean);
  const inPlayers  = (subData.in_ids  || []).map(id => players.find(p => p.id === id)).filter(Boolean);
  const count = Math.max(subData.out_ids?.length || 0, subData.in_ids?.length || 0);
  const isMulti = count > 1;

  if (isMulti) {
    const outLabels = (subData.out_ids || []).map(id => {
      const p = players.find(pl => pl.id === id);
      return p ? (p.jersey_number != null ? `#${p.jersey_number} ${p.name.split(' ')[0]}` : p.name.split(' ')[0]) : null;
    }).filter(Boolean).join(', ');
    const inLabels = (subData.in_ids || []).map(id => {
      const p = players.find(pl => pl.id === id);
      return p ? (p.jersey_number != null ? `#${p.jersey_number} ${p.name.split(' ')[0]}` : p.name.split(' ')[0]) : null;
    }).filter(Boolean).join(', ');

    return (
      <>
        <div className="flex items-center justify-center gap-1.5">
          <TeamDot color={dotColor} />
          <span className="text-xs font-bold text-slate-800 truncate">{count}-Player Substitution</span>
        </div>
        {outLabels && <p className="text-[10px] text-slate-500 text-center truncate mt-0.5">OUT: {outLabels}</p>}
        {inLabels  && <p className="text-[10px] text-slate-500 text-center truncate mt-0.5">IN: {inLabels}</p>}
      </>
    );
  }

  // Single substitution
  const outP = outPlayers[0];
  const inP  = inPlayers[0];

  return (
    <>
      <div className="flex items-center justify-center gap-1.5">
        <TeamDot color={dotColor} />
        <span className="text-xs font-bold text-slate-800">Substitution</span>
      </div>
      <p className="text-[10px] text-slate-600 text-center truncate mt-0.5">
        {outP ? `${playerLabel(outP)} OUT` : null}
        {outP && inP ? ' • ' : null}
        {inP ? `${playerLabel(inP)} IN` : null}
        {!outP && !inP ? 'Substitution recorded' : null}
      </p>
    </>
  );
}

function TimeoutContent({ team, dotColor }) {
  return (
    <>
      <div className="flex items-center justify-center gap-1.5">
        <TeamDot color={dotColor} />
        <span className="text-xs font-bold text-slate-800">⏱ Timeout</span>
      </div>
      {team && (
        <p className="text-[10px] text-center truncate mt-0.5 font-medium" style={{ color: dotColor }}>
          {team.name}
        </p>
      )}
    </>
  );
}

function StatContent({ log, player, team, dotColor }) {
  const label = player
    ? (player.jersey_number != null ? `#${player.jersey_number} ${player.name}` : player.name)
    : "Player activity recorded";

  return (
    <>
      <div className="flex items-center justify-center gap-1.5 min-w-0">
        <TeamDot color={dotColor} />
        <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
      </div>
      <p className="text-xs text-slate-500 text-center truncate mt-0.5">
        {log.stat_label || log.stat_type}
        {team && <span style={{ color: dotColor }}> — {team.name}</span>}
      </p>
    </>
  );
}

export default function LatestActivity({ latestLog, players = [], homeTeam, awayTeam, game }) {
  const isEmpty = !latestLog;

  let content = null;
  if (!isEmpty) {
    const isHome  = latestLog.team_id === game?.home_team_id;
    const dotColor = isHome ? "#2563EB" : "#DC2626";
    const team    = isHome ? homeTeam : (latestLog.team_id === game?.away_team_id ? awayTeam : null);
    const player  = players.find(p => p.id === latestLog.player_id) ?? null;

    if (latestLog.stat_type === 'substitution') {
      content = <SubstitutionContent log={latestLog} players={players} dotColor={dotColor} />;
    } else if (latestLog.stat_type === 'timeout') {
      content = <TimeoutContent team={team} dotColor={dotColor} />;
    } else {
      content = <StatContent log={latestLog} player={player} team={team} dotColor={dotColor} />;
    }
  }

  return (
    <div className="mt-3 w-full flex flex-col items-center">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
        Latest Activity
      </p>
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 w-full max-w-[220px] shadow-sm">
        {isEmpty
          ? <p className="text-xs text-slate-400 italic text-center">No activity recorded yet</p>
          : content
        }
      </div>
    </div>
  );
}