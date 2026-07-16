import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Link2, Copy, RefreshCw, Upload, CheckCircle2, XCircle, Pencil } from "lucide-react";

// REGISTRATION_ADMIN_V1 — self-serve registration campaigns for league admins.
// Backed entirely by the manageRegistrationCampaign backend function; this page
// never reads SignupCampaign or CoachInviteCode entities directly.

const DEFAULT_PRIMARY = "#0B1F3A";
const DEFAULT_ACCENT = "#F26B1F";
const ROLE_OPTIONS = [
  { key: "coach", label: "Coaches (team codes)" },
  { key: "player", label: "Players" },
  { key: "viewer", label: "Viewers" },
];

function StatusPill({ status }) {
  const open = status === "open";
  return (
    <span
      className={`text-xs font-medium px-3 py-1 rounded-full ${
        open ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {open ? "Open" : "Closed"}
    </span>
  );
}

function CampaignForm({ league, initial, busy, onSubmit, onCancel, submitLabel }) {
  const [heroTitle, setHeroTitle] = useState(initial?.hero_title || league?.name || "");
  const [seasonText, setSeasonText] = useState(initial?.season_text || "");
  const [crestUrl, setCrestUrl] = useState(initial?.crest_url || "");
  const [colorPrimary, setColorPrimary] = useState(initial?.color_primary || DEFAULT_PRIMARY);
  const [colorAccent, setColorAccent] = useState(initial?.color_accent || DEFAULT_ACCENT);
  const [roles, setRoles] = useState(
    Array.isArray(initial?.roles_enabled) && initial.roles_enabled.length ? initial.roles_enabled : ["coach"]
  );
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [slugInput, setSlugInput] = useState("");

  const toggleRole = (key) => {
    setRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  const handleCrestUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCrestUrl(file_url);
    } catch (err) {
      setFormError("Crest upload failed. Please try again.");
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!roles.length) {
      setFormError("Enable at least one role.");
      return;
    }
    if (!heroTitle.trim()) {
      setFormError("Page title is required.");
      return;
    }
    setFormError("");
    onSubmit({
      ...(initial ? {} : { slug: slugInput.trim() }),
      hero_title: heroTitle.trim(),
      season_text: seasonText.trim(),
      crest_url: crestUrl,
      color_primary: colorPrimary,
      color_accent: colorAccent,
      roles_enabled: roles,
    });
  };

  return (
    <div className="space-y-4">
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{formError}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Page title</label>
          <input
            type="text"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder={league?.name || "League name"}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Season text</label>
          <input
            type="text"
            value={seasonText}
            onChange={(e) => setSeasonText(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Season starts August 2026"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Crest image (optional)</label>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
              {crestUrl ? (
                <img src={crestUrl} alt="Crest" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : crestUrl ? "Replace" : "Upload"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCrestUpload} disabled={uploading} />
            </label>
            {crestUrl && (
              <button type="button" onClick={() => setCrestUrl("")} className="text-xs text-slate-500 underline">
                Remove
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Colors</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorPrimary}
              onChange={(e) => setColorPrimary(e.target.value)}
              className="w-9 h-9 rounded border border-slate-200 cursor-pointer"
              title="Hero background"
            />
            <input
              type="color"
              value={colorAccent}
              onChange={(e) => setColorAccent(e.target.value)}
              className="w-9 h-9 rounded border border-slate-200 cursor-pointer"
              title="Accent"
            />
            <span className="text-xs text-slate-400">
              {colorPrimary === DEFAULT_PRIMARY && colorAccent === DEFAULT_ACCENT ? "Courtside default" : "Custom"}
            </span>
          </div>
        </div>
      </div>
      {!initial && (
        <div>
          <label className="block text-sm text-slate-600 mb-1">Custom link (optional)</label>
          <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden">
            <span className="text-xs text-slate-400 bg-slate-50 px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">courtside-by-ai.com/Join/</span>
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="flex-1 px-3 py-2 text-sm font-mono outline-none min-w-0"
              placeholder="auto-generated"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Short and memorable, e.g. fnbopen. Leave empty to auto-generate from the league name. Cannot be changed after creation.</p>
        </div>
      )}
      <div>
        <label className="block text-sm text-slate-600 mb-2">Who can sign up</label>
        <div className="flex flex-wrap gap-4">
          {ROLE_OPTIONS.map((r) => (
            <label key={r.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={roles.includes(r.key)} onChange={() => toggleRole(r.key)} />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} disabled={busy} className="bg-[#F26B1F] hover:bg-[#d95d16] text-white">
          {busy ? "Working..." : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Registration() {
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const isAppAdmin = currentUser?.user_type === "app_admin";
  const isLeagueAdmin = currentUser?.user_type === "league_admin";
  const myLeagues = isAppAdmin
    ? leagues
    : isLeagueAdmin
    ? leagues.filter((l) => (currentUser?.assigned_league_ids || []).includes(l.id))
    : [];

  useEffect(() => {
    if (!selectedLeagueId && myLeagues.length === 1) {
      setSelectedLeagueId(myLeagues[0].id);
    }
  }, [myLeagues, selectedLeagueId]);

  const selectedLeague = myLeagues.find((l) => l.id === selectedLeagueId) || null;

  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ["regCampaign", selectedLeagueId],
    queryFn: async () => {
      const res = await base44.functions.invoke("manageRegistrationCampaign", {
        action: "get",
        league_id: selectedLeagueId,
      });
      return res.data;
    },
    enabled: !!selectedLeagueId,
  });

  const campaign = campaignData?.campaign || null;
  const codes = campaignData?.codes || [];
  const coachEnabled = campaign?.roles_enabled?.includes("coach");

  const callAction = async (payload, successMessage) => {
    setBusy(true);
    setPageError("");
    try {
      await base44.functions.invoke("manageRegistrationCampaign", {
        league_id: selectedLeagueId,
        ...payload,
      });
      await queryClient.invalidateQueries({ queryKey: ["regCampaign", selectedLeagueId] });
      if (successMessage) toast({ description: successMessage });
      return true;
    } catch (err) {
      setPageError(err?.response?.data?.error || "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = campaign ? `https://courtside-by-ai.com/Join/${campaign.slug}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ description: "Link copied" });
    } catch (e) {
      setPageError("Could not copy automatically — select and copy the link text.");
    }
  };

  const handleClose = async () => {
    const closing = campaign.status === "open";
    if (closing && !window.confirm("Close registration? The public page will stop accepting signups. You can reopen it anytime.")) {
      return;
    }
    await callAction({ action: "set_status", status: closing ? "closed" : "open" }, closing ? "Registration closed" : "Registration reopened");
  };

  const handleRearm = async (code) => {
    if (!window.confirm(`Re-arm code ${code.code} for ${code.team_name}? The previous use will be cleared and the code can be redeemed again.`)) return;
    await callAction({ action: "rearm_code", code_id: code.id }, "Code re-armed");
  };

  if (currentUser && !isAppAdmin && !isLeagueAdmin) {
    return (
      <div className="p-8 text-center text-slate-500">You don't have access to this page.</div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0B1F3A] flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registration</h1>
          <p className="text-sm text-slate-500">Create a signup page and invite codes for your league</p>
        </div>
      </div>

      <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setEditing(false); setPageError(""); }}>
        <SelectTrigger className="w-full md:w-96 bg-white">
          <SelectValue placeholder="Select a league" />
        </SelectTrigger>
        <SelectContent>
          {myLeagues.map((l) => (
            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{pageError}</div>
      )}

      {selectedLeague && campaignLoading && (
        <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>
      )}

      {selectedLeague && !campaignLoading && !campaign && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900">{selectedLeague.name}</h2>
                <p className="text-sm text-slate-500">Set up the public signup page. Team codes are generated automatically.</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full">No campaign</span>
            </div>
            <CampaignForm
              league={selectedLeague}
              busy={busy}
              submitLabel="Create registration and generate team codes"
              onSubmit={(fields) => callAction({ action: "create", ...fields }, "Registration created")}
            />
          </CardContent>
        </Card>
      )}

      {selectedLeague && !campaignLoading && campaign && (
        <Card className="border-slate-200">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">{selectedLeague.name}</h2>
                <p className="text-sm text-slate-500">
                  {campaign.roles_enabled.map((r) => ({ coach: "Coaches", player: "Players", viewer: "Viewers" }[r] || r)).join(" · ")}
                </p>
              </div>
              <StatusPill status={campaign.status} />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
              <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-mono text-xs md:text-sm text-slate-700 flex-1 truncate">{shareUrl}</span>
              <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy link
              </Button>
            </div>

            {editing ? (
              <CampaignForm
                league={selectedLeague}
                initial={campaign}
                busy={busy}
                submitLabel="Save changes"
                onCancel={() => setEditing(false)}
                onSubmit={async (fields) => {
                  const ok = await callAction({ action: "update", ...fields }, "Details saved");
                  if (ok) setEditing(false);
                }}
              />
            ) : (
              <>
                {coachEnabled && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-slate-700">Team codes</h3>
                      <Button size="sm" variant="outline" onClick={() => callAction({ action: "sync_teams" }, "Team codes synced")} disabled={busy}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Sync team codes
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="py-2 font-medium">Team</th>
                            <th className="py-2 font-medium">Code</th>
                            <th className="py-2 font-medium">Status</th>
                            <th className="py-2 font-medium hidden md:table-cell">Used by</th>
                            <th className="py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {codes.map((c) => (
                            <tr key={c.id} className="border-b border-slate-50">
                              <td className="py-2.5 text-slate-900">{c.team_name}</td>
                              <td className="py-2.5 font-mono text-slate-700">{c.code}</td>
                              <td className="py-2.5">
                                {c.status === "used" ? (
                                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Used
                                  </span>
                                ) : (
                                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Active</span>
                                )}
                              </td>
                              <td className="py-2.5 text-slate-500 text-xs hidden md:table-cell">{c.used_by_email || "—"}</td>
                              <td className="py-2.5 text-right">
                                {c.status === "used" && (
                                  <Button size="sm" variant="outline" onClick={() => handleRearm(c)} disabled={busy}>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Re-arm
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {codes.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400 text-sm">No codes yet — use Sync team codes.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit page details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={busy}
                    className={campaign.status === "open" ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-700 border-green-200 hover:bg-green-50"}
                  >
                    {campaign.status === "open" ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Close registration
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Reopen registration
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}