import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonitorPlay, Send, RefreshCw, X, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import HelpButton from "../components/help/HelpButton";

// STREAM_CREW_V1 - league admins and app admins invite the people who run their
// live stream. Every read and write goes through the manageVideoAdmins backend
// function, because VideoAdminInvite is app_admin-only at the entity level and
// granting a role requires writing to the User entity.
//
// Scoping is enforced server-side: a league admin only ever receives invites and
// video admins for leagues in their own assigned_league_ids. Nothing on this page
// is trusted to do the filtering.
//
// Banners are used instead of window.alert - alerts are silently swallowed inside
// base44's iframe.

function formatDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function StatusPill({ kind, children }) {
  const tones = {
    pending: "bg-amber-100 text-amber-800",
    expired: "bg-slate-100 text-slate-500",
    active: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${tones[kind] || tones.pending}`}>
      {children}
    </span>
  );
}

function Banner({ tone, children }) {
  if (!children) return null;
  const tones = {
    error: "bg-red-50 border-red-200 text-red-700",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`mt-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed ${tones[tone] || tones.error}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export default function StreamCrew() {
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [listError, setListError] = useState("");
  const [listSuccess, setListSuccess] = useState("");
  const [busyId, setBusyId] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const canAccess =
    currentUser?.user_type === "app_admin" || currentUser?.user_type === "league_admin";

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["stream_crew"],
    queryFn: async () => {
      const res = await base44.functions.invoke("manageVideoAdmins", { action: "list" });
      return res?.data || { leagues: [], pending: [], active: [] };
    },
    enabled: !!canAccess,
  });

  const leagues = data?.leagues || [];
  const pending = data?.pending || [];
  const active = data?.active || [];

  const clearBanners = () => {
    setInviteError("");
    setInviteSuccess("");
    setListError("");
    setListSuccess("");
  };

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke("manageVideoAdmins", {
        action: "invite",
        email: email.trim(),
        league_id: leagueId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data || {};
    },
    onSuccess: (result) => {
      setEmail("");
      setInviteSuccess(result.message || "Invitation sent.");
      queryClient.invalidateQueries({ queryKey: ["stream_crew"] });
    },
    onError: (err) => {
      setInviteError(err?.message || "That invitation could not be sent. Please try again.");
    },
  });

  const runAction = async (payload, fallbackError) => {
    clearBanners();
    setBusyId(payload.invite_id || payload.user_id || "busy");
    try {
      const res = await base44.functions.invoke("manageVideoAdmins", payload);
      if (res?.data?.error) throw new Error(res.data.error);
      setListSuccess(res?.data?.message || "Done.");
      queryClient.invalidateQueries({ queryKey: ["stream_crew"] });
    } catch (err) {
      setListError(err?.message || fallbackError);
    } finally {
      setBusyId("");
    }
  };

  const handleInvite = () => {
    clearBanners();
    if (!email.trim()) {
      setInviteError("Enter the email address you want to invite.");
      return;
    }
    if (!leagueId) {
      setInviteError("Choose which league this person will run the stream for.");
      return;
    }
    inviteMutation.mutate();
  };

  const handleCancel = (invite) => {
    if (!window.confirm(`Cancel the invitation to ${invite.email}? They will no longer be able to accept it.`)) return;
    runAction({ action: "cancel", invite_id: invite.id }, "That invitation could not be cancelled.");
  };

  const handleRemove = (person) => {
    if (!window.confirm(`Remove video admin access for ${person.full_name || person.email} in ${person.league_name}? Their account stays, only this league's access is withdrawn.`)) return;
    runAction(
      { action: "remove_access", user_id: person.user_id, league_id: person.league_id },
      "That access could not be removed."
    );
  };

  if (currentUser && !canAccess) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center">
            <MonitorPlay className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Stream Crew</h1>
            <p className="text-sm text-slate-500 mt-2">
              Only league admins and app admins can invite video admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto" data-marker="STREAM_CREW_V1">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-slate-900">Stream Crew</h1>
          <HelpButton pageKey="streamcrew" />
        </div>
        <p className="text-slate-500 text-sm mt-0.5">
          Invite the people who run your live stream. Video admins can set up the game overlay
          {" \u2014 "}logos, score bug, and ticker{" \u2014 "}for the leagues you give them.
        </p>
      </div>

      {/* Invite */}
      <Card className="border-slate-200 mb-5">
        <CardContent className="p-5">
          <h2 className="text-[15px] font-bold text-slate-900">Invite a video admin</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">
            They will get an email asking them to register. Make sure the address is the one they
            will sign up with.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">Email address</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setInviteError(""); setInviteSuccess(""); }}
              />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">League</Label>
              <Select
                value={leagueId}
                onValueChange={(v) => { setLeagueId(v); setInviteError(""); setInviteSuccess(""); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a league..." />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={handleInvite}
              disabled={inviteMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {inviteMutation.isPending ? "Sending..." : "Send invitation"}
            </Button>
          </div>

          <Banner tone="error">{inviteError}</Banner>
          <Banner tone="success">{inviteSuccess}</Banner>
        </CardContent>
      </Card>

      <Banner tone="error">{listError}</Banner>
      <Banner tone="success">{listSuccess}</Banner>

      {/* Pending */}
      <Card className="border-slate-200 mt-5 mb-5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold text-slate-900">Pending invitations</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { clearBanners(); refetch(); }}
              disabled={isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 mb-2">
            Sent, but not yet registered. If someone signs up with a different address, resend the
            invitation to the address they actually used.
          </p>

          {isLoading ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No pending invitations.
            </p>
          ) : (
            <div>
              {pending.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-3 border-t border-slate-200 first:border-t-0 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{inv.email}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {inv.league_name || "\u2014"} {" \u00b7 "} sent {formatDate(inv.last_sent_at || inv.invited_at)}
                      {inv.expired ? " \u00b7 expired" : ` \u00b7 expires ${formatDate(inv.expires_at)}`}
                    </span>
                  </div>
                  <StatusPill kind={inv.expired ? "expired" : "pending"}>
                    {inv.expired ? "Expired" : "Pending"}
                  </StatusPill>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === inv.id}
                    onClick={() => runAction({ action: "resend", invite_id: inv.id }, "That invitation could not be re-sent.")}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Resend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={busyId === inv.id}
                    onClick={() => handleCancel(inv)}
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active */}
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <h2 className="text-[15px] font-bold text-slate-900">Active video admins</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-2">
            Removing access takes effect immediately. Their account stays{" \u2014 "}only the league
            access is withdrawn.
          </p>

          {isLoading ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading...</p>
          ) : active.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No video admins yet. Invite someone above and they will appear here once they register.
            </p>
          ) : (
            <div>
              {active.map((p) => (
                <div key={`${p.user_id}-${p.league_id}`} className="flex items-center gap-3 py-3 border-t border-slate-200 first:border-t-0 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">
                      {p.full_name || p.email}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5 truncate">
                      {p.email} {" \u00b7 "} {p.league_name || "\u2014"}
                    </span>
                  </div>
                  <StatusPill kind="active">Active</StatusPill>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={busyId === p.user_id}
                    onClick={() => handleRemove(p)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Remove access
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}