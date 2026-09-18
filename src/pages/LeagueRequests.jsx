// LEAGUE_REQUESTS_PAGE_V1 — app admin's outreach list. Built from the league
// names people typed on the global registration page when their league was not
// on Courtside. Requests for the same league are grouped; linking a group to a
// real league (Mark onboarded) updates every requester's front-door card.
// Nothing on this page sends an email.
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import HelpButton from "../components/help/HelpButton";

const STATUS_STYLES = {
  New: "bg-orange-100 text-orange-800",
  Contacted: "bg-blue-100 text-blue-800",
  Onboarded: "bg-green-100 text-green-800",
  Declined: "bg-slate-100 text-slate-500",
};
const STATUS_ORDER = ["New", "Contacted", "Onboarded", "Declined"];

const normName = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

const linkHref = (link) => {
  const t = String(link || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : "https://" + t;
};

async function listAll(entity) {
  const PAGE = 1000;
  const out = [];
  let skip = 0;
  for (;;) {
    const rows = await entity.list("-created_date", PAGE, skip);
    if (!rows || rows.length === 0) break;
    out.push(...rows);
    skip += rows.length;
  }
  return out;
}

export default function LeagueRequests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [linkingKey, setLinkingKey] = useState("");
  const [linkGroupId, setLinkGroupId] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [banner, setBanner] = useState("");

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);
  const isAppAdmin = currentUser?.user_type === "app_admin";

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["league_requests_all"],
    queryFn: () => listAll(base44.entities.LeagueRequest),
    enabled: isAppAdmin,
  });

  const { data: leagueGroups = [] } = useQuery({
    queryKey: ["leagueGroups_for_requests"],
    queryFn: () => base44.entities.LeagueGroup.list(),
    enabled: isAppAdmin,
  });

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of requests) {
      const key = normName(r.league_name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { key, rows: [] });
      map.get(key).rows.push(r);
    }
    const list = [...map.values()].map((g) => {
      const first = g.rows[0];
      const statuses = g.rows.map((r) => r.status || "New");
      const status = STATUS_ORDER.find((s) => statuses.includes(s)) || "New";
      const linked = g.rows.find((r) => r.linked_league_group_id);
      return {
        ...g,
        name: first.league_name,
        where: [first.city, first.country].filter(Boolean).join(", "),
        link: (g.rows.find((r) => r.league_link) || {}).league_link || "",
        teamCount: g.rows.filter((r) => r.requested_from_role !== "fan").length,
        fanCount: g.rows.filter((r) => r.requested_from_role === "fan").length,
        shared: g.rows.filter((r) => r.referral_sent).length,
        status,
        linkedGroupId: linked ? linked.linked_league_group_id : "",
        newest: g.rows.reduce((m, r) => (String(r.created_date || "") > m ? String(r.created_date || "") : m), ""),
      };
    });
    list.sort((a, b) => (b.rows.length - a.rows.length) || b.newest.localeCompare(a.newest));
    return list;
  }, [requests]);

  const groupName = (id) => (leagueGroups.find((g) => g.id === id) || {}).name || "a league";

  const updateGroup = async (g, patch, message) => {
    setSavingKey(g.key);
    setBanner("");
    try {
      for (const r of g.rows) {
        await base44.entities.LeagueRequest.update(r.id, patch);
      }
      await refetch();
      setBanner(message);
      setLinkingKey("");
      setLinkGroupId("");
    } catch (e) {
      setBanner("Could not update: " + (e && e.message ? e.message : "please try again."));
    } finally {
      setSavingKey("");
    }
  };

  if (currentUser && !isAppAdmin) {
    return <div className="p-6 text-slate-600">This page is for the Courtside app admin only.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4" data-marker="LEAGUE_REQUESTS_PAGE_V1">
      <div>
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">League Requests</h1><HelpButton pageKey="leaguerequests" /></div>
        <p className="text-sm text-slate-500 mt-1">Leagues people asked for when they couldn't find theirs. Most-requested first. Nothing here sends an email.</p>
      </div>

      {banner && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{banner}</div>}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && isAppAdmin && groups.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-slate-500">No league requests yet.</CardContent></Card>
      )}

      {groups.map((g) => (
        <Card key={g.key} className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{g.name}</span>
                  <span className={"text-[11px] font-bold px-2 py-0.5 rounded-full " + (STATUS_STYLES[g.status] || STATUS_STYLES.New)}>{g.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {[g.where, g.rows.length + (g.rows.length === 1 ? " person" : " people") + " asked (" + g.teamCount + " team, " + g.fanCount + " fan)", "shared the invite: " + g.shared + " of " + g.rows.length].filter(Boolean).join(" · ")}
                </div>
                {g.link && (
                  <a href={linkHref(g.link)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-600 font-semibold mt-1">
                    {g.link} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {g.linkedGroupId && (
                  <div className="text-xs text-green-700 mt-1">Linked to {groupName(g.linkedGroupId)}</div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {g.status === "New" && (
                  <Button size="sm" variant="outline" disabled={savingKey === g.key} onClick={() => updateGroup(g, { status: "Contacted" }, g.name + " marked contacted.")}>
                    Mark contacted
                  </Button>
                )}
                {g.status !== "Onboarded" && (
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={savingKey === g.key} onClick={() => { setLinkingKey(linkingKey === g.key ? "" : g.key); setLinkGroupId(""); }}>
                    Mark onboarded
                  </Button>
                )}
                {g.status !== "Declined" && g.status !== "Onboarded" && (
                  <Button size="sm" variant="ghost" className="text-slate-500" disabled={savingKey === g.key} onClick={() => updateGroup(g, { status: "Declined" }, g.name + " marked declined.")}>
                    Decline
                  </Button>
                )}
              </div>
            </div>

            {linkingKey === g.key && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-sm text-slate-700">Which league on Courtside is it? The {g.rows.length === 1 ? "person" : g.rows.length + " people"} who asked will see it the next time they log in.</p>
                <Select value={linkGroupId} onValueChange={setLinkGroupId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Pick a league" /></SelectTrigger>
                  <SelectContent>
                    {[...leagueGroups].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))).map((lg) => (
                      <SelectItem key={lg.id} value={lg.id}>{lg.name}{lg.country ? " · " + lg.country : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setLinkingKey(""); setLinkGroupId(""); }}>Cancel</Button>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600"
                    disabled={!linkGroupId || savingKey === g.key}
                    onClick={() => updateGroup(g, { status: "Onboarded", linked_league_group_id: linkGroupId }, g.name + " linked to " + groupName(linkGroupId) + ".")}
                  >
                    Link and mark onboarded
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}