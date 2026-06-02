import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function SubstitutionDialog({
  open,
  onOpenChange,
  subStep,
  subSaving,
  subError,
  homeTeam,
  awayTeam,
  homeActivePlayers,
  awayActivePlayers,
  homeBenchPlayers,
  awayBenchPlayers,
  homePlayersOut,
  awayPlayersOut,
  homePlayersIn,
  awayPlayersIn,
  isEligibleReplacement,
  existingStats,
  game,
  subEntryMode,
  isSubConfirmReady,
  setSubStep,
  setHomePlayersOut,
  setAwayPlayersOut,
  setHomePlayersIn,
  setAwayPlayersIn,
  setSubError,
  setShowSubDialog,
  resetSubDialog,
  togglePlayerOut,
  togglePlayerIn,
  handleConfirmSubstitution,
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (subSaving) return;
      if (!o) resetSubDialog();
      onOpenChange(o);
    }}>
      <DialogContent className="bg-white text-slate-900 border-slate-200 w-[95vw] max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-xl text-slate-900 font-bold">
            {subStep === 'select_out' ? 'Select Players to Take Out' : 'Select Replacement Players'}
          </DialogTitle>
          {subStep === 'select_out' ? (
            <div className="flex items-center gap-4 mt-1.5">
              {homePlayersOut.length > 0 && <span className="text-sm font-semibold text-blue-600">Home: {homePlayersOut.length} out</span>}
              {awayPlayersOut.length > 0 && <span className="text-sm font-semibold text-red-600">Away: {awayPlayersOut.length} out</span>}
              {homePlayersOut.length === 0 && awayPlayersOut.length === 0 && (
                <span className="text-sm text-slate-400">Tap on-court players from either or both teams</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 mt-1.5">
              {homePlayersOut.length > 0 && (
                <span className={`text-sm font-semibold ${homePlayersIn.length === homePlayersOut.length ? 'text-green-600' : 'text-blue-600'}`}>
                  Home: {homePlayersIn.length}/{homePlayersOut.length}
                </span>
              )}
              {awayPlayersOut.length > 0 && (
                <span className={`text-sm font-semibold ${awayPlayersIn.length === awayPlayersOut.length ? 'text-green-600' : 'text-red-600'}`}>
                  Away: {awayPlayersIn.length}/{awayPlayersOut.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {subError && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3 mb-2">
              <p className="text-sm font-semibold text-red-700">⚠ {subError}</p>
              <p className="text-xs text-red-500 mt-1">Your selections have been kept. Tap Confirm to retry, or Cancel to start over.</p>
              <Button
                size="sm" variant="outline"
                className="mt-2 w-full border-red-300 text-red-600 hover:bg-red-100"
                onClick={async () => {
                  const freshStats = await base44.entities.PlayerStats.filter({ game_id: game.id });
                  const activeHomeIds = new Set(freshStats.filter(s => s.team_id === game.home_team_id && s.is_active).map(s => s.player_id));
                  const activeAwayIds = new Set(freshStats.filter(s => s.team_id === game.away_team_id && s.is_active).map(s => s.player_id));
                  setHomePlayersOut(prev => prev.filter(p => activeHomeIds.has(p.id)));
                  setAwayPlayersOut(prev => prev.filter(p => activeAwayIds.has(p.id)));
                  setSubError(null);
                }}
              >
                Reload Lineup
              </Button>
            </div>
          )}

          {subStep === 'select_out' ? (
            <>
              {/* HOME on-court */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold bg-blue-600">{homeTeam?.name?.[0]}</div>
                  <span className="font-bold text-blue-700 text-sm">{homeTeam?.name}</span>
                  <span className="ml-auto text-xs text-blue-500 font-semibold">{homePlayersOut.length} selected</span>
                </div>
                <div className="space-y-1.5">
                  {homeActivePlayers.map(player => {
                    const isSelected = homePlayersOut.some(p => p.id === player.id);
                    return (
                      <button key={player.id} onClick={() => togglePlayerOut(player, game.home_team_id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-600">{player.jersey_number}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                          <p className="text-xs text-slate-500">{player.position}</p>
                        </div>
                        {isSelected && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* AWAY on-court */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold bg-red-600">{awayTeam?.name?.[0]}</div>
                  <span className="font-bold text-red-700 text-sm">{awayTeam?.name}</span>
                  <span className="ml-auto text-xs text-red-500 font-semibold">{awayPlayersOut.length} selected</span>
                </div>
                <div className="space-y-1.5">
                  {awayActivePlayers.map(player => {
                    const isSelected = awayPlayersOut.some(p => p.id === player.id);
                    return (
                      <button key={player.id} onClick={() => togglePlayerOut(player, game.away_team_id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40'}`}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-red-600">{player.jersey_number}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                          <p className="text-xs text-slate-500">{player.position}</p>
                        </div>
                        {isSelected && <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* HOME replacements */}
              {homePlayersOut.length > 0 && (
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1.5">Home — Coming Out</p>
                    <div className="flex flex-wrap gap-1.5">
                      {homePlayersOut.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-2 py-0.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs bg-blue-600">{p.jersey_number}</div>
                          <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-blue-700 mb-1.5 px-1">Select {homePlayersOut.length} Home replacement{homePlayersOut.length > 1 ? 's' : ''} ({homePlayersIn.length}/{homePlayersOut.length})</p>
                  {homeBenchPlayers.filter(p => isEligibleReplacement(p.id)).length === 0 ? (
                    <p className="text-center text-red-500 py-3 text-xs font-semibold">No eligible home bench players.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {homeBenchPlayers.map(player => {
                        if (!isEligibleReplacement(player.id)) return null;
                        const isSelected = homePlayersIn.includes(player.id);
                        const limitReached = !isSelected && homePlayersIn.length >= homePlayersOut.length;
                        const pStats = existingStats.find(s => s.player_id === player.id);
                        return (
                          <button key={player.id} disabled={limitReached} onClick={() => togglePlayerIn(player.id, game.home_team_id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${limitReached ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-600">{player.jersey_number}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                              <p className="text-xs text-slate-500">{player.position}{pStats ? ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T` : ''}</p>
                            </div>
                            {isSelected && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* AWAY replacements */}
              {awayPlayersOut.length > 0 && (
                <div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1.5">Away — Coming Out</p>
                    <div className="flex flex-wrap gap-1.5">
                      {awayPlayersOut.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-white border border-red-200 rounded-lg px-2 py-0.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs bg-red-600">{p.jersey_number}</div>
                          <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-red-700 mb-1.5 px-1">Select {awayPlayersOut.length} Away replacement{awayPlayersOut.length > 1 ? 's' : ''} ({awayPlayersIn.length}/{awayPlayersOut.length})</p>
                  {awayBenchPlayers.filter(p => isEligibleReplacement(p.id)).length === 0 ? (
                    <p className="text-center text-red-500 py-3 text-xs font-semibold">No eligible away bench players.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {awayBenchPlayers.map(player => {
                        if (!isEligibleReplacement(player.id)) return null;
                        const isSelected = awayPlayersIn.includes(player.id);
                        const limitReached = !isSelected && awayPlayersIn.length >= awayPlayersOut.length;
                        const pStats = existingStats.find(s => s.player_id === player.id);
                        return (
                          <button key={player.id} disabled={limitReached} onClick={() => togglePlayerIn(player.id, game.away_team_id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${limitReached ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white' : isSelected ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40'}`}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-red-600">{player.jersey_number}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                              <p className="text-xs text-slate-500">{player.position}{pStats ? ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T` : ''}</p>
                            </div>
                            {isSelected && <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex-shrink-0">
          {subStep === 'select_out' ? (
            <Button
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-base shadow"
              disabled={homePlayersOut.length === 0 && awayPlayersOut.length === 0}
              onClick={() => setSubStep('select_in')}
            >
              Next: Select Replacements ({homePlayersOut.length + awayPlayersOut.length} out)
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12 border-slate-300" disabled={subSaving}
                onClick={() => {
                  if (subEntryMode === 'single') { setShowSubDialog(false); resetSubDialog(); }
                  else { setSubStep('select_out'); setHomePlayersIn([]); setAwayPlayersIn([]); }
                }}>
                {subEntryMode === 'single' ? 'Cancel' : 'Back'}
              </Button>
              <Button
                className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold"
                disabled={!isSubConfirmReady() || subSaving}
                onClick={handleConfirmSubstitution}
              >
                {subSaving ? 'Saving substitution...' : 'Confirm Substitution'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}