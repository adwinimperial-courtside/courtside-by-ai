import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, CheckCircle, Loader2, History, ChevronDown, ChevronUp, Users, Play, CheckSquare, Square, AlertCircle, Search, MapPin, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const lastNameGuess = (name) => {
  const parts = (name || "").trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : "";
};

export default function NoLeagueUsers() {
  const queryClient = useQueryClient();
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [sendingIds, setSendingIds] = useState({});
  const [successIds, setSuccessIds] = useState({});
  const [sendErrors, setSendErrors] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});

  // Roster match state (bulk)
  const [rosterMatchRunning, setRosterMatchRunning] = useState(false);
  const [rosterMatchResults, setRosterMatchResults] = useState(null);
  const [rosterMatchError, setRosterMatchError] = useState("");
  const [selectedMatchKeys, setSelectedMatchKeys] = useState(new Set());
  const [applyingMatches, setApplyingMatches] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Per-user manual roster search state
  const [openSearchUserId, setOpenSearchUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigningKey, setAssigningKey] = useState(null);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["noLeagueUsers"],
    queryFn: () => base44.functions.invoke("getNoLeagueUsers", {}),
    staleTime: 30000,
  });

  const { data: reminderLogs = [] } = useQuery({
    queryKey: ["reminderLogs"],
    queryFn: () => base44.entities.ReminderLog.list("-sent_at", 1000),
    staleTime: 30000,
  });

  const isAdmin = currentUser?.user_type === "app_admin";

  const { data: allPlayers = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["allPlayers"],
    queryFn: () => base44.entities.Player.list(),
    enabled: isAdmin,
  });
  const { data: allTeams = [] } = useQuery({
    queryKey: ["allTeams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: isAdmin,
  });
  const { data: allLeagues = [] } = useQuery({
    queryKey: ["allLeagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: isAdmin,
  });

  const enrichedPlayers = useMemo(() => {
    const teamById = Object.fromEntries(allTeams.map((t) => [t.id, t]));
    const leagueById = Object.fromEntries(allLeagues.map((l) => [l.id, l]));
    return allPlayers.map((p) => {
      const team = teamById[p.team_id];
      const league = team ? leagueById[team.league_id] : null;
      return {
        ...p,
        teamName: team?.name || "—",
        leagueId: team?.league_id || null,
        leagueName: league?.name || "—",
        leagueSeason: league?.season || "",
      };
    });
  }, [allPlayers, allTeams, allLeagues]);

  const candidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return enrichedPlayers
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.teamName?.toLowerCase().includes(q) ||
          p.leagueName?.toLowerCase().includes(q)
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .slice(0, 25);
  }, [enrichedPlayers, searchQuery]);

  const noLeagueUsers = data?.data?.users || data?.users || [];

  const getLogsForUser = (userId) =>
    reminderLogs.filter((log) => log.user_id === userId);

  const openSearch = (user) => {
    setAssignError("");
    setOpenSearchUserId(user.id);
    setSearchQuery(lastNameGuess(user.full_name));
  };

  const closeSearch = () => {
    setOpenSearchUserId(null);
    setSearchQuery("");
    setAssignError("");
  };

  const handleAssign = async (user, candidate) => {
    const key = `${user.id}:${candidate.id}`;
    setAssigningKey(key);
    setAssignError("");
    try {
      const match = {
        userId: user.id,
        userName: user.full_name,
        userEmail: user.email,
        playerId: candidate.id,
        playerName: candidate.name,
        teamId: candidate.team_id,
        teamName: candidate.teamName,
        leagueId: candidate.leagueId,
        leagueName: candidate.leagueName,
        confidence: "high",
      };
      await base44.functions.invoke("applyRosterMatchForUsers", { approvedMatches: [match] });

      // Fire the player welcome email (best-effort; never blocks the assign)
      try {
        await base44.functions.invoke("sendAccessApprovedEmail", {
          application: {
            id: user.application_id || undefined,
            user_email: user.email,
            user_name: user.full_name,
            display_name: user.application_name || user.full_name,
            requested_role: "player",
          },
        });
      } catch (e) {
        // email failure is non-fatal
      }

      setAssignSuccess(`Assigned ${user.full_name} to ${candidate.leagueName} and sent the welcome email.`);
      setOpenSearchUserId(null);
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["noLeagueUsers"] });
      setTimeout(() => setAssignSuccess(""), 6000);
    } catch (err) {
      setAssignError("Failed to assign: " + (err.message || "Unknown error"));
    } finally {
      setAssigningKey(null);
    }
  };

  const handleSendAll = async () => {
    if (noLeagueUsers.length === 0) return;
    setBulkSending(true);
    setBulkSuccess(false);
    setBulkError("");
    try {
      await base44.functions.invoke("sendNoLeagueReminderEmail", {
        userIds: noLeagueUsers.map((u) => u.id),
      });
      setBulkSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["reminderLogs"] });
      setTimeout(() => setBulkSuccess(false), 5000);
    } catch (err) {
      setBulkError("Failed to send reminders: " + (err.message || "Unknown error"));
    } finally {
      setBulkSending(false);
    }
  };

  const handleSendOne = async (userId) => {
    setSendingIds((prev) => ({ ...prev, [userId]: true }));
    setSendErrors((prev) => ({ ...prev, [userId]: "" }));
    try {
      await base44.functions.invoke("sendNoLeagueReminderEmail", {
        userIds: [userId],
      });
      setSuccessIds((prev) => ({ ...prev, [userId]: true }));
      queryClient.invalidateQueries({ queryKey: ["reminderLogs"] });
      setTimeout(() => setSuccessIds((prev) => ({ ...prev, [userId]: false })), 4000);
    } catch (err) {
      setSendErrors((prev) => ({ ...prev, [userId]: "Failed to send" }));
    } finally {
      setSendingIds((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleRunRosterMatch = async () => {
    setRosterMatchRunning(true);
    setRosterMatchError("");
    setRosterMatchResults(null);
    setSelectedMatchKeys(new Set());
    setApplySuccess(false);
    setApplyError("");
    try {
      const res = await base44.functions.invoke("runRosterMatchForUsers", {});
      const result = res.data || res;
      setRosterMatchResults(result);
      const allKeys = new Set((result.matches || []).filter(m => m.confidence === 'exact').map(m => `${m.userId}:${m.leagueId}`));
      setSelectedMatchKeys(allKeys);
    } catch (err) {
      setRosterMatchError("Failed to run roster match: " + (err.message || "Unknown error"));
    } finally {
      setRosterMatchRunning(false);
    }
  };

  const toggleMatchKey = (key) => {
    setSelectedMatchKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApplyMatches = async () => {
    if (!rosterMatchResults) return;
    const approvedMatches = (rosterMatchResults.matches || []).filter(
      m => selectedMatchKeys.has(`${m.userId}:${m.leagueId}`)
    );
    if (approvedMatches.length === 0) return;
    setApplyingMatches(true);
    setApplyError("");
    setApplySuccess(false);
    try {
      await base44.functions.invoke("applyRosterMatchForUsers", { approvedMatches });

      const userById = Object.fromEntries(noLeagueUsers.map((u) => [u.id, u]));
      const uniqueUserIds = [...new Set(approvedMatches.map((m) => m.userId))];
      for (const uid of uniqueUserIds) {
        const u = userById[uid];
        const m = approvedMatches.find((x) => x.userId === uid);
        const email = u?.email || m?.userEmail;
        const name = u?.full_name || m?.userName;
        if (!email) continue;
        try {
          await base44.functions.invoke("sendAccessApprovedEmail", {
            application: {
              id: u?.application_id || undefined,
              user_email: email,
              user_name: name,
              display_name: u?.application_name || name,
              requested_role: "player",
            },
          });
        } catch (e) {
          // welcome email is best-effort
        }
      }

      setApplySuccess(true);
      setRosterMatchResults(null);
      queryClient.invalidateQueries({ queryKey: ["noLeagueUsers"] });
    } catch (err) {
      setApplyError("Failed to apply matches: " + (err.message || "Unknown error"));
    } finally {
      setApplyingMatches(false);
    }
  };

  const toggleHistory = (userId) => {
    setExpandedHistory((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const roleColors = {
    player: "bg-blue-100 text-blue-800",
    coach: "bg-purple-100 text-purple-800",
    viewer: "bg-slate-100 text-slate-700",
    league_admin: "bg-green-100 text-green-800",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (noLeagueUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CheckCircle className="w-12 h-12 text-green-500" />
        <p className="text-lg font-semibold text-slate-700">
          All approved users have leagues assigned. 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-marker="NO_LEAGUE_ROSTER_SEARCH_V1">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-amber-900">
          <span className="text-lg font-bold">{noLeagueUsers.length}</span>{" "}
          {noLeagueUsers.length === 1 ? "user has" : "users have"} no league assigned
        </p>
        <Button
          onClick={handleSendAll}
          disabled={bulkSending || bulkSuccess}
          className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
          size="sm"
        >
          {bulkSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : bulkSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {bulkSending ? "Sending..." : bulkSuccess ? "✓ Reminders sent!" : "Send Reminder to All"}
        </Button>
      </div>
      {bulkError && <p className="text-sm text-red-600 mt-2">{bulkError}</p>}

      {assignSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800">
          <CheckCircle className="w-4 h-4" /> {assignSuccess}
        </div>
      )}

      {/* Roster Match Section (bulk) */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Bulk Roster Match
            </p>
            <p className="text-xs text-blue-700 mt-0.5">Scan these users against all player rosters by name</p>
          </div>
          <Button
            onClick={handleRunRosterMatch}
            disabled={rosterMatchRunning || applyingMatches}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            size="sm"
          >
            {rosterMatchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {rosterMatchRunning ? "Scanning..." : "Run Roster Match"}
          </Button>
        </div>

        {rosterMatchError && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {rosterMatchError}
          </p>
        )}

        {applySuccess && (
          <p className="text-sm text-green-700 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Matches applied successfully!
          </p>
        )}

        {rosterMatchResults && (
          <div className="space-y-3">
            {(() => {
              const exactCount = (rosterMatchResults.matches || []).filter(m => m.confidence === 'exact').length;
              const mediumCount = (rosterMatchResults.matches || []).filter(m => m.confidence === 'normalized' || m.confidence === 'reversed').length;
              const lowCount = (rosterMatchResults.matches || []).filter(m => m.confidence === 'initial').length;
              return (
                <div className="flex items-center gap-4 text-xs text-blue-800 flex-wrap">
                  <span>Scanned: <strong>{rosterMatchResults.total}</strong></span>
                  <span>✅ Exact: <strong>{exactCount}</strong></span>
                  <span>⚠️ Needs review: <strong>{mediumCount + lowCount}</strong></span>
                  <span>❌ No match: <strong>{rosterMatchResults.unmatched}</strong></span>
                </div>
              );
            })()}

            {rosterMatchResults.matches?.length === 0 ? (
              <p className="text-sm text-slate-500">No exact name matches found.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    {selectedMatchKeys.size} of {rosterMatchResults.matches.length} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedMatchKeys(new Set(rosterMatchResults.matches.map(m => `${m.userId}:${m.leagueId}`)))}
                      className="text-xs text-blue-600 hover:underline"
                    >Select all</button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedMatchKeys(new Set())}
                      className="text-xs text-blue-600 hover:underline"
                    >Deselect all</button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {rosterMatchResults.matches.map(m => {
                    const key = `${m.userId}:${m.leagueId}`;
                    const selected = selectedMatchKeys.has(key);
                    return (
                      <div
                        key={key}
                        onClick={() => toggleMatchKey(key)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected ? "bg-white border-blue-300" : "bg-slate-50 border-slate-200 opacity-60"
                        }`}
                      >
                        {selected
                          ? <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          : <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{m.userName}</div>
                          <div className="text-xs text-slate-500 truncate">{m.userEmail}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-medium text-slate-700">{m.playerName}</div>
                          <div className="text-xs text-slate-500">{m.teamName} · {m.leagueName}</div>
                        </div>
                        {m.confidence === 'exact' && (
                          <Badge className="bg-green-100 text-green-800 text-xs flex-shrink-0">Exact match</Badge>
                        )}
                        {m.confidence === 'normalized' && (
                          <Badge title="Name spelling varies slightly — please verify" className="bg-amber-100 text-amber-800 text-xs flex-shrink-0 cursor-help">Normalized ⚠️</Badge>
                        )}
                        {m.confidence === 'reversed' && (
                          <Badge title="Same name but different order — please verify" className="bg-amber-100 text-amber-800 text-xs flex-shrink-0 cursor-help">Name order differs ⚠️</Badge>
                        )}
                        {m.confidence === 'initial' && (
                          <Badge title="Matched by first initial — please verify" className="bg-amber-100 text-amber-800 text-xs flex-shrink-0 cursor-help">Initial ⚠️</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleApplyMatches}
                  disabled={selectedMatchKeys.size === 0 || applyingMatches}
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                  size="sm"
                >
                  {applyingMatches ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {applyingMatches ? "Applying..." : `Apply ${selectedMatchKeys.size} Selected Match${selectedMatchKeys.size !== 1 ? "es" : ""}`}
                </Button>
                {applyError && <p className="text-sm text-red-600">{applyError}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User list */}
      <div className="space-y-2">
        {noLeagueUsers.map((user) => {
          const logs = getLogsForUser(user.id);
          const lastLog = logs[0];
          const isExpanded = expandedHistory[user.id];
          const isSearchOpen = openSearchUserId === user.id;

          return (
            <div
              key={user.id}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                    {getInitials(user.full_name)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{user.full_name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                    {logs.length > 0 && (
                      <button
                        onClick={() => toggleHistory(user.id)}
                        className="flex items-center gap-1 mt-0.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <History className="w-3 h-3" />
                        Reminded {logs.length} {logs.length === 1 ? "time" : "times"} · Last:{" "}
                        {format(new Date(lastLog.sent_at), "MMM d, yyyy h:mm a")}
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 ml-0.5" />
                        ) : (
                          <ChevronDown className="w-3 h-3 ml-0.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {user.application_country && (
                    <Badge className="bg-amber-100 text-amber-800 gap-1">
                      <MapPin className="w-3 h-3" />
                      {user.application_country}
                    </Badge>
                  )}
                  <Badge className={roleColors[user.user_type] || roleColors.viewer}>
                    {user.user_type || "viewer"}
                  </Badge>
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {user.created_date ? format(new Date(user.created_date), "MMM d, yyyy") : "—"}
                  </span>
                  <Button
                    size="sm"
                    variant={isSearchOpen ? "default" : "outline"}
                    onClick={() => (isSearchOpen ? closeSearch() : openSearch(user))}
                    className={`gap-1.5 text-xs ${isSearchOpen ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                  >
                    <Search className="w-3 h-3" />
                    {isSearchOpen ? "Close" : "Find roster slot"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sendingIds[user.id] || successIds[user.id]}
                    onClick={() => handleSendOne(user.id)}
                    className="gap-1.5 text-xs"
                  >
                    {sendingIds[user.id] ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : successIds[user.id] ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <Mail className="w-3 h-3" />
                    )}
                    {successIds[user.id] ? "Sent!" : "Send Reminder"}
                  </Button>
                </div>
              </div>
              {sendErrors[user.id] && (
                <p className="text-xs text-red-500 mt-1 pl-13">{sendErrors[user.id]}</p>
              )}

              {/* Inline roster search */}
              {isSearchOpen && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      autoFocus
                      placeholder="Search by name, team, or league..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 bg-white"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {loadingPlayers
                      ? "Loading rosters..."
                      : searchQuery.trim()
                        ? `${candidates.length}${candidates.length === 25 ? "+" : ""} roster slot${candidates.length === 1 ? "" : "s"} match${user.application_country ? ` — applicant is from ${user.application_country}` : ""}`
                        : "Type a name to search all rosters."}
                  </p>

                  {assignError && (
                    <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {assignError}
                    </p>
                  )}

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {candidates.map((c) => {
                      const key = `${user.id}:${c.id}`;
                      const busy = assigningKey === key;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <span className="text-xs text-slate-400 font-mono w-6 text-center flex-shrink-0">
                            {c.jersey_number ?? "—"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {c.name}
                              {c.position && <span className="text-slate-400 font-normal"> · {c.position}</span>}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {c.teamName} · {c.leagueName}
                              {c.leagueSeason && <span className="text-slate-400"> ({c.leagueSeason})</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAssign(user, c)}
                            disabled={busy || !!assigningKey}
                            className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs flex-shrink-0"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                            {busy ? "Assigning..." : "Assign"}
                          </Button>
                        </div>
                      );
                    })}
                    {!loadingPlayers && searchQuery.trim() && candidates.length === 0 && (
                      <p className="text-sm text-slate-400 py-3 text-center">
                        No roster slots found for "{searchQuery}".
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded reminder history */}
              {isExpanded && logs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 pl-13">
                  {logs.map((log) => (
                    <div key={log.id} className="text-xs text-slate-500">
                      {format(new Date(log.sent_at), "MMM d, yyyy h:mm a")} — sent by {log.sent_by}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}