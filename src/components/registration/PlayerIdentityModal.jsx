import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, ChevronRight } from "lucide-react";

export default function PlayerIdentityModal({ user, onComplete }) {
  const [step, setStep] = useState("identity"); // "identity" | "leagues"
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [handle, setHandle] = useState(user.handle || "");
  const [leagueSelections, setLeagueSelections] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Build league pairs from application
  const leaguePairs = application.league_team_pairs?.length
    ? application.league_team_pairs
    : (application.league_ids || (application.league_id ? [application.league_id] : [])).map(id => ({
        league_id: id,
        team_id: application.team_id || "",
      }));
  const hasLeagues = leaguePairs.length > 0;

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: step === "leagues",
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: step === "leagues",
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
    enabled: step === "leagues",
  });

  // Initialize league selections when step changes to leagues
  useEffect(() => {
    if (step !== "leagues") return;
    const initial = {};
    leaguePairs.forEach(pair => {
      if (pair.league_id) {
        initial[pair.league_id] = {
          teamId: pair.team_id || "",
          rosterName: "",
          isManual: false,
          manualName: "",
        };
      }
    });
    setLeagueSelections(initial);
  }, [step]);

  const updateSel = (leagueId, patch) =>
    setLeagueSelections(prev => ({ ...prev, [leagueId]: { ...prev[leagueId], ...patch } }));

  const handleIdentitySubmit = async () => {
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      await base44.entities.UserApplication.update(application.id, {
        display_name: displayName.trim(),
        handle: handle.trim() || null,
        player_name_status: hasLeagues ? "missing" : "completed",
      });
      if (hasLeagues) {
        setStep("leagues");
      } else {
        onComplete();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaguesSubmit = async () => {
    setIsSaving(true);
    try {
      for (const pair of leaguePairs) {
        const sel = leagueSelections[pair.league_id];
        if (!sel) continue;
        const rosterName = sel.isManual ? sel.manualName?.trim() : sel.rosterName;
        const matchStatus = sel.isManual
          ? "manual_review"
          : rosterName ? "matched" : "unmatched";
        const identityStatus = sel.isManual ? "needs_review" : rosterName ? "completed" : "needs_review";

        await base44.entities.UserLeagueIdentity.create({
          user_application_id: application.id,
          league_id: pair.league_id,
          team_id: sel.teamId || pair.team_id || null,
          roster_player_name: rosterName || null,
          roster_match_status: matchStatus,
          identity_status: identityStatus,
        });
      }
      await base44.entities.UserApplication.update(application.id, {
        player_name_status: "completed",
      });
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md w-full"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        {step === "identity" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <DialogTitle className="text-xl leading-tight">Complete Your Player Identity</DialogTitle>
              </div>
              <p className="text-sm text-slate-500">
                Your official player name will appear in stats, standings, awards, player cards, and box scores.
              </p>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="displayName" className="text-sm font-medium">
                  Official Player Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g., Marko Santos"
                  className="mt-1"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="handle" className="text-sm font-medium text-slate-700">
                  Handle / Nickname{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Input
                  id="handle"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  placeholder="e.g., mako23"
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">Shown as @handle on your profile</p>
              </div>

              <Button
                onClick={handleIdentitySubmit}
                disabled={!displayName.trim() || isSaving}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSaving ? "Saving..." : hasLeagues ? "Continue to League Setup" : "Complete Setup"}
                {!isSaving && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </>
        )}

        {step === "leagues" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Your League Identity</DialogTitle>
              <p className="text-sm text-slate-500">
                Select your name on each team roster so your stats are linked correctly.
              </p>
            </DialogHeader>

            <div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto pr-1">
              {leaguePairs.map(pair => {
                const league = leagues.find(l => l.id === pair.league_id);
                const sel = leagueSelections[pair.league_id] || {};
                const activeTeamId = sel.teamId || pair.team_id || "";
                const leagueTeams = teams.filter(t => t.league_id === pair.league_id);
                const teamPlayers = players.filter(p => p.team_id === activeTeamId);

                return (
                  <div key={pair.league_id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                    <p className="font-semibold text-slate-800">{league?.name || "League"}</p>

                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">Team</Label>
                      <Select
                        value={activeTeamId}
                        onValueChange={val =>
                          updateSel(pair.league_id, { teamId: val, rosterName: "", isManual: false, manualName: "" })
                        }
                      >
                        <SelectTrigger className="bg-white text-sm">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {leagueTeams.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!sel.isManual ? (
                      <div>
                        <Label className="text-xs text-slate-600 mb-1 block">Your Name on Roster</Label>
                        <Select
                          value={sel.rosterName || ""}
                          onValueChange={val => updateSel(pair.league_id, { rosterName: val })}
                          disabled={!activeTeamId}
                        >
                          <SelectTrigger className="bg-white text-sm">
                            <SelectValue
                              placeholder={
                                !activeTeamId
                                  ? "Select a team first"
                                  : teamPlayers.length === 0
                                  ? "No players found for this team"
                                  : "Select your name"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {teamPlayers.map(p => (
                              <SelectItem key={p.id} value={p.name}>
                                {p.jersey_number != null ? `#${p.jersey_number} ` : ""}{p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => updateSel(pair.league_id, { isManual: true, rosterName: "" })}
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1 underline"
                        >
                          My name is not listed
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs text-slate-600 mb-1 block">Enter Your Name Manually</Label>
                        <Input
                          value={sel.manualName || ""}
                          onChange={e => updateSel(pair.league_id, { manualName: e.target.value })}
                          placeholder="Enter your name as it appears on the roster"
                          className="text-sm bg-white"
                        />
                        <p className="text-xs text-amber-600 mt-1">
                          This will be flagged for admin review.
                        </p>
                        <button
                          type="button"
                          onClick={() => updateSel(pair.league_id, { isManual: false, manualName: "" })}
                          className="text-xs text-blue-500 hover:text-blue-700 mt-0.5 underline"
                        >
                          Select from roster instead
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleLeaguesSubmit}
              disabled={isSaving}
              className="w-full bg-green-600 hover:bg-green-700 mt-2"
            >
              {isSaving ? "Saving..." : "Complete Setup"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}