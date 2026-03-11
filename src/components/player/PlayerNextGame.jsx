import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ChevronRight } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PlayerNextGame({ games, teams, teamId }) {
  const navigate = useNavigate();

  const nextGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const now = new Date();
    return games
      .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === 'scheduled' && new Date(g.game_date) >= now)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))[0] || null;
  }, [games, teamId]);

  if (!nextGame) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-slate-700">
            <Calendar className="w-4 h-4 text-orange-500" />
            Next Game
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm text-center py-6">No upcoming games scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  const isHome = nextGame.home_team_id === teamId;
  const opponentId = isHome ? nextGame.away_team_id : nextGame.home_team_id;
  const opponent = teams.find(t => t.id === opponentId);
  const gameDate = new Date(nextGame.game_date);
  const gameDay = isToday(gameDate);
  const dateLabel = gameDay ? "Today" : isTomorrow(gameDate) ? "Tomorrow" : format(gameDate, "EEE, MMM d");

  return (
    <Card
      className={`border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${gameDay ? 'border-l-4 border-l-orange-400' : ''}`}
      onClick={() => navigate(createPageUrl(`LiveBoxScore?gameId=${nextGame.id}`))}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-700">
          <Calendar className="w-4 h-4 text-orange-500" />
          Next Game
          {gameDay && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Game Day!</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-slate-900">{opponent?.name || "Opponent"}</p>
            <p className="text-sm text-slate-500">{dateLabel} • {format(gameDate, "HH:mm")}</p>
            <p className="text-xs text-slate-400 mt-1">{isHome ? "Home" : "Away"}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}