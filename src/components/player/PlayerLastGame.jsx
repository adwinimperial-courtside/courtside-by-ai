import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PlayerLastGame({ games, myStats, teams, teamId }) {
  const navigate = useNavigate();

  const lastGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    return games
      .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === 'completed')
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date))[0] || null;
  }, [games, teamId]);

  const statLine = useMemo(() => lastGame ? myStats.find(s => s.game_id === lastGame.id) || null : null, [lastGame, myStats]);

  if (!lastGame) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-700">Last Game</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm text-center py-6">No game stats available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const isHome = lastGame.home_team_id === teamId;
  const opponentId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
  const opponent = teams.find(t => t.id === opponentId);
  const myScore = isHome ? lastGame.home_score : lastGame.away_score;
  const oppScore = isHome ? lastGame.away_score : lastGame.home_score;
  const won = myScore > oppScore;

  const pts = statLine ? (statLine.points_2||0)*2 + (statLine.points_3||0)*3 + (statLine.free_throws||0) : null;
  const reb = statLine ? (statLine.offensive_rebounds||0) + (statLine.defensive_rebounds||0) : null;
  const ast = statLine ? statLine.assists || 0 : null;
  const min = statLine ? Math.round(statLine.minutes_played || 0) : null;

  return (
    <Card
      className="border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(createPageUrl(`LiveBoxScore?gameId=${lastGame.id}`))}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-700">Last Game</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {won ? 'WIN' : 'LOSS'}
            </span>
            <p className="text-xl font-bold text-slate-900 mt-2">{myScore} – {oppScore}</p>
            <p className="text-sm text-slate-600">vs {opponent?.name || "Opponent"}</p>
            {statLine && (
              <p className="text-sm text-slate-500 mt-2 font-medium">
                {pts} PTS • {reb} REB • {ast} AST{min > 0 ? ` • ${min} MIN` : ""}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">{format(new Date(lastGame.game_date), "EEE, MMM d")}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}