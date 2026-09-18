import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Eye, User, Clock, XCircle, ChevronLeft, ChevronRight, Search, Share2, Copy, Link2 } from "lucide-react";
import PrivacyConsentStep from "./PrivacyConsentStep";

const ROLE_OPTIONS = [
  {
    id: "league_admin",
    label: "League Admin",
    icon: Trophy,
    color: "from-yellow-500 to-orange-500",
    description: "Create and manage a basketball league, teams, and statistics"
  },
  {
    id: "coach",
    label: "Coach",
    icon: Users,
    color: "from-blue-500 to-blue-600",
    description: "Access coaching insights and team analytics"
  },
  {
    id: "player",
    label: "Player",
    icon: User,
    color: "from-green-500 to-emerald-600",
    description: "View your personal stats and follow your team"
  },
  {
    id: "viewer",
    label: "Fan",
    icon: Eye,
    color: "from-purple-500 to-purple-600",
    description: "Follow league stats, standings, and game results"
  },
];

const AppLogo = () => (
  <div className="flex items-center justify-center mb-2">
    <img
      src="https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png"
      alt="Courtside by AI"
      className="h-24 w-auto"
    />
  </div>
);

// GLOBAL_FRONT_DOOR_V1 — the message a player sends their organiser from the
// "someone else runs it" path. Points at the marketing site on purpose: the
// organiser has never heard of Courtside. Early-access wording only.
const INVITE_MESSAGE = "Hi! Could we run our league on Courtside by AI? Live stats, standings and player profiles, and teams sign up with one link. It's free during early access. Take a look: https://courtside-by-ai.info";

// Find a /Join/<slug> in whatever the person pasted (full link or bare slug).
const slugFromPasted = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return "";
  const match = text.match(/\/Join\/([A-Za-z0-9_-]+)/i);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : "";
};

// Share sheet on phones, clipboard everywhere else. Never throws.
const shareOrCopy = async (text, preferShare) => {
  try {
    if (preferShare && typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (e) {
    return "failed";
  }
};

const initialsOf = (name) => (name || "")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 3)
  .map(w => w[0])
  .join("")
  .toUpperCase();

function GroupedLeaguePicker({ sections, selectedLeagues, onToggle }) {
  return (
    <div data-marker="GROUPED_REG_PICKER_V1" className="space-y-1 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
      {sections.length === 0 && (
        <p className="text-sm text-slate-400">No open leagues to join right now.</p>
      )}
      {sections.map((sec, i) => (
        <div key={sec.group ? sec.group.id : "other"} className={i > 0 ? "border-t border-slate-100 pt-2 mt-2" : ""}>
          <div className="flex items-center gap-2 px-1 py-1">
            {sec.group && (
              sec.group.logo_url ? (
                <img src={sec.group.logo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#0B1F3A] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                  {initialsOf(sec.group.name)}
                </div>
              )
            )}
            <span className="text-sm font-semibold text-slate-800">{sec.group ? sec.group.name : "Other leagues"}</span>
            {sec.group && sec.group.country && (
              <span className="text-xs text-slate-400">{sec.group.country}</span>
            )}
          </div>
          <div className="ml-3 border-l border-slate-200 pl-3">
            {sec.seasons.map(l => (
              <label key={l.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded p-1">
                <input
                  type="checkbox"
                  checked={selectedLeagues.includes(l.id)}
                  onChange={(e) => onToggle(l.id, e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-slate-800">{l.name} <span className="text-slate-400">({l.season})</span></span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RegistrationGate({ user }) {
  const getInitialStep = () => {
    if (user.application_status === "Pending") return "pending";
    if (user.application_status === "Rejected") return "rejected";
    return "select_role";
  };

  const [step, setStep] = useState(getInitialStep);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({});
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [leagueTeamMap, setLeagueTeamMap] = useState({}); // { league_id: team_id }
  const [consentData, setConsentData] = useState(null);
  const [adminLeagueMode, setAdminLeagueMode] = useState("new");
  const [selectedAdminLeagueId, setSelectedAdminLeagueId] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  // COACH_REDIRECT_V1 — the coach signpost's "I have a link" box
  const [joinLinkInput, setJoinLinkInput] = useState("");
  const [joinLinkError, setJoinLinkError] = useState("");
  // GLOBAL_FRONT_DOOR_V1 — front door, league search and league request
  const [searchMode, setSearchMode] = useState("team"); // "team" | "fan"
  const [searchQuery, setSearchQuery] = useState("");
  const [openGroupKey, setOpenGroupKey] = useState("");
  const [showNotFound, setShowNotFound] = useState(false);
  const [showLinkBox, setShowLinkBox] = useState(false);
  const [requestForm, setRequestForm] = useState({});
  const [requestError, setRequestError] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);
  const [shareNote, setShareNote] = useState("");

  const { data: leagues = [] } = useQuery({
    queryKey: ['publicLeagues'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPublicLeagues', {});
      return (res.data.leagues || []).filter(l => !l.is_archived);
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: selectedRole === "player",
  });

  const { data: leagueGroups = [] } = useQuery({
    queryKey: ['leagueGroups'],
    queryFn: () => base44.entities.LeagueGroup.list(),
  });

  // LEAGUE_REQUEST_V1 — this person's own league requests (the entity lets
  // people read only the rows they created). Newest first; drives the card at
  // the top of the front door.
  const { data: myRequests = [], refetch: refetchMyRequests } = useQuery({
    queryKey: ['my_league_requests', user?.id],
    queryFn: async () => {
      const rows = await base44.entities.LeagueRequest.filter({ requester_user_id: user.id });
      return [...(rows || [])].sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || "")));
    },
    enabled: !!user?.id,
  });
  const latestRequest = myRequests[0] || null;

  // SEARCH_PUBLIC_V1 — open, listed registration campaigns. Loaded for the
  // search screen, and for the front-door card once a request is linked.
  const { data: openCampaigns = [], isLoading: searchLoading } = useQuery({
    queryKey: ['search_public_campaigns'],
    queryFn: async () => {
      const res = await base44.functions.invoke("manageRegistrationCampaign", { action: "search_public" });
      return (res && res.data && res.data.results) || [];
    },
    enabled: step === "league_search" || !!(latestRequest && latestRequest.linked_league_group_id),
  });

  // Has this user ever actually submitted an application? A genuine applicant
  // and a brand-new account can both show application_status "Pending", so we
  // check for a real application on file instead of trusting the status flag.
  const { data: myApplications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['my_applications', user?.id],
    queryFn: () => base44.entities.UserApplication.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });
  const hasApplied = myApplications.some(
    app => app.league_id
      || (Array.isArray(app.league_ids) && app.league_ids.length > 0)
      || (app.league_name && String(app.league_name).trim())
  );

  // On the waiting screen but never actually applied? Send them to the
  // role/league form instead of a dead-end. (justSubmitted guards the brief
  // window right after submitting, before the application list refreshes.)
  useEffect(() => {
    if (!appsLoading && step === "pending" && !hasApplied && !justSubmitted) {
      setStep("select_role");
    }
  }, [appsLoading, hasApplied, step, justSubmitted]);

  const selectedLeague = selectedLeagues[0] || ""; // kept for backwards compat reference

  const groupedLeagues = useMemo(() => {
    const byGroup = new Map();
    const ungrouped = [];
    for (const l of leagues) {
      if (l.group_id) {
        if (!byGroup.has(l.group_id)) byGroup.set(l.group_id, []);
        byGroup.get(l.group_id).push(l);
      } else {
        ungrouped.push(l);
      }
    }
    const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "");
    const sections = [];
    for (const g of [...leagueGroups].sort(sortByName)) {
      const seasons = byGroup.get(g.id);
      if (seasons && seasons.length > 0) {
        sections.push({ group: g, seasons: [...seasons].sort(sortByName) });
        byGroup.delete(g.id);
      }
    }
    for (const orphanSeasons of byGroup.values()) ungrouped.push(...orphanSeasons);
    if (ungrouped.length > 0) {
      sections.push({ group: null, seasons: [...ungrouped].sort(sortByName) });
    }
    return sections;
  }, [leagues, leagueGroups]);

  const groupNameFor = (league) => {
    if (!league || !league.group_id) return null;
    const g = leagueGroups.find(gr => gr.id === league.group_id);
    return g ? g.name : null;
  };

  const toggleLeague = (lid, checked) => {
    if (checked) {
      setSelectedLeagues(prev => [...prev, lid]);
    } else {
      setSelectedLeagues(prev => prev.filter(id => id !== lid));
      setLeagueTeamMap(prev => { const next = { ...prev }; delete next[lid]; return next; });
    }
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setFormData({});
    setSelectedLeagues([]);
    setLeagueTeamMap({});
    setSelectedAdminLeagueId("");
    setFormError("");
    // COACH_REDIRECT_V1 — coaches join through their own league's registration
    // link and code, so this generic picker sends them there instead of taking
    // an application. Nothing is written on that screen. Because of this,
    // selectedRole can never be "coach" once we reach privacy_consent or
    // fill_form, so the coach branches that used to live there are gone.
    if (roleId === "coach") {
      setJoinLinkInput("");
      setJoinLinkError("");
      setStep("coach_signpost");
      return;
    }
    setStep("privacy_consent");
  };

  // GLOBAL_FRONT_DOOR_V1 — navigation helpers
  const openSearch = (mode) => {
    setSearchMode(mode);
    setSearchQuery("");
    setOpenGroupKey("");
    setShowNotFound(false);
    setStep("league_search");
  };

  const goToJoin = (slug) => {
    if (slug) window.location.href = "/Join/" + slug;
  };

  const startLeagueAdmin = (prefillName) => {
    handleRoleSelect("league_admin");
    if (prefillName && prefillName.trim()) setFormData({ league_name: prefillName.trim() });
  };

  const startLeagueRequest = () => {
    setRequestForm({ league_name: searchQuery.trim(), city: "", country: "", league_link: "" });
    setRequestError("");
    setShareNote("");
    setStep("request_consent");
  };

  const saveLeagueRequest = async (how) => {
    setRequestError("");
    const name = (requestForm.league_name || "").trim();
    const country = (requestForm.country || "").trim();
    const link = (requestForm.league_link || "").trim();
    if (!name) { setRequestError("Please enter the league name."); return; }
    if (!country) { setRequestError("Please enter the country."); return; }
    if (link && (link.includes("@") || /^[+\d\s()-]{6,}$/.test(link))) {
      setRequestError("Please enter a web link, not an email address or phone number.");
      return;
    }
    setRequestSaving(true);
    try {
      await base44.entities.LeagueRequest.create({
        league_name: name,
        city: (requestForm.city || "").trim(),
        country,
        league_link: link,
        requester_user_id: user.id,
        requester_email: user.email || "",
        requester_name: user.full_name || "",
        requested_from_role: searchMode === "fan" ? "fan" : "team",
        referral_sent: how !== "save",
        status: "New",
      });
      if (consentData) {
        try { await base44.auth.updateMe({ ...consentData }); }
        catch (e) { console.error("LEAGUE_REQUEST_V1 consent save failed:", e && e.message); }
      }
    } catch (e) {
      setRequestError("Could not save your request: " + (e && e.message ? e.message : "please try again."));
      setRequestSaving(false);
      return;
    }
    setRequestSaving(false);
    if (how !== "save") {
      const result = await shareOrCopy(INVITE_MESSAGE, how === "share");
      setShareNote(result === "copied" ? "Message copied. Paste it in your league's group chat." : "");
    }
    try { refetchMyRequests(); } catch (e) { /* the card refreshes on the next visit */ }
    setStep("request_done");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (selectedRole === "league_admin") {
      if (adminLeagueMode === "new") {
        if (!formData.league_name?.trim()) { setFormError("Please enter a league name."); return; }
        if (!formData.season_start_date) { setFormError("Please enter the season start date."); return; }
        const teams = Number.parseInt(formData.number_of_teams, 10);
        if (!Number.isInteger(teams) || teams < 2) { setFormError("Please enter the number of teams (at least 2)."); return; }
        const players = Number.parseInt(formData.avg_players_per_team, 10);
        if (!Number.isInteger(players) || players < 5) { setFormError("Please enter the average players per team (at least 5)."); return; }
        if (!formData.phone?.trim()) { setFormError("Please enter your mobile number so we can reach you about your league."); return; }
        if (formData.onboarding_call === true && (!formData.onboarding_date || !formData.onboarding_time)) {
          setFormError("Please pick a preferred date and time for your onboarding call, or untick the onboarding call option."); return;
        }
      }
      if (adminLeagueMode === "existing" && !selectedAdminLeagueId) {
        setFormError("Please select an existing league."); return;
      }
      if (!formData.country?.trim()) { setFormError("Please enter your country."); return; }
    } else {
      if (selectedLeagues.length === 0) { setFormError("Please select at least one league."); return; }
      if (selectedRole === "player") {
        const missingTeam = selectedLeagues.some(lid => !leagueTeamMap[lid]);
        if (missingTeam) { setFormError("Please select a team for each selected league."); return; }
      }
    }

    setIsSubmitting(true);
    try {
      const applicationData = {
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        requested_role: selectedRole,
        status: "Pending",
        applied_at: new Date().toISOString(),
      };

      if (selectedRole === "league_admin") {
        if (formData.full_name) applicationData.user_name = formData.full_name;
        applicationData.country = formData.country;
        if (formData.phone) applicationData.phone = formData.phone;
        if (adminLeagueMode === "existing") {
          applicationData.league_id = selectedAdminLeagueId;
          applicationData.league_ids = [selectedAdminLeagueId];
          if (formData.role_in_league) applicationData.role_in_league = formData.role_in_league;
        } else {
          Object.assign(applicationData, {
            league_name: formData.league_name,
            season_start_date: formData.season_start_date,
            number_of_teams: parseInt(formData.number_of_teams),
            avg_players_per_team: parseInt(formData.avg_players_per_team),
          });
          if (formData.preferred_channel) applicationData.preferred_channel = formData.preferred_channel;
          if (formData.league_type) applicationData.league_type = formData.league_type;
          if (formData.heard_from) applicationData.heard_from = formData.heard_from;
          if (formData.league_fb_page) applicationData.league_fb_page = formData.league_fb_page;
        }
      } else {
        applicationData.country = formData.country;
        applicationData.league_id = selectedLeagues[0];
        applicationData.league_ids = selectedLeagues;
        if (selectedRole === "viewer") {
          if (formData.full_name) applicationData.user_name = formData.full_name;
        }
        if (selectedRole === "player") {
          // Only submit for leagues where a team was actually chosen (teamless leagues are dropped — see the signup note).
          const chosenLeagues = selectedLeagues.filter(lid => leagueTeamMap[lid]);
          applicationData.display_name = formData.display_name;
          applicationData.handle = formData.handle || "";
          applicationData.jersey_number = (formData.jersey_number || "").trim();
          applicationData.player_name_status = formData.display_name ? "completed" : "missing";
          applicationData.league_id = chosenLeagues[0] || selectedLeagues[0];
          applicationData.league_ids = chosenLeagues.length ? chosenLeagues : selectedLeagues;
          applicationData.team_id = leagueTeamMap[chosenLeagues[0]] || "";
          applicationData.league_team_pairs = chosenLeagues.map(lid => ({
            league_id: lid,
            team_id: leagueTeamMap[lid],
          }));
        }
      }

      const createdApp = await base44.entities.UserApplication.create(applicationData);
      // SUGGEST_PLAYER_MATCH_CALL — best-effort; never block signup if it fails
      if (selectedRole === "player" && createdApp?.id) {
        try { await base44.functions.invoke("suggestPlayerMatch", { applicationId: createdApp.id }); }
        catch (e) { console.error("suggestPlayerMatch failed (non-blocking):", e?.message); }
      }
      // ONBOARDING_BOOKING_V1 — new-league applicants can request an onboarding call (non-blocking)
      if (selectedRole === "league_admin" && adminLeagueMode === "new" && formData.onboarding_call === true && formData.onboarding_date && formData.onboarding_time && createdApp?.id) {
        try {
          await base44.entities.OnboardingBooking.create({
            application_id: createdApp.id,
            user_id: user.id,
            user_email: user.email,
            user_name: formData.full_name || user.full_name || "",
            league_name: formData.league_name || "",
            requested_datetime: `${formData.onboarding_date}T${formData.onboarding_time}`,
            requested_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            status: "requested",
          });
        } catch (e) { console.error("OnboardingBooking create failed (non-blocking):", e?.message); }
      }
      await base44.auth.updateMe({
        application_status: "Pending",
        ...(formData.full_name?.trim() ? { full_name: formData.full_name.trim() } : {}),
        ...(consentData || {}),
      });
      setJustSubmitted(true);
      setStep("pending");
    } catch (error) {
      setFormError("Failed to submit application: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "pending") {
    if (appsLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <AppLogo />
            <p className="text-slate-500 mt-6">Loading…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AppLogo />
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mt-6 mb-4">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Under Review</h2>
          <p className="text-slate-600 mb-6">
            Your application has been submitted. Our admin team will review it shortly and grant you access once approved.
          </p>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-left mb-6">
            <p className="text-sm font-medium text-amber-800">What happens next?</p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>Admin reviews your application</li>
              <li>You'll get full access once approved</li>
              <li>Tap "Refresh Status" below to check your progress</li>
            </ul>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full mb-3">
            Refresh Status
          </Button>
          <Button onClick={() => base44.auth.logout('/')} variant="ghost" className="w-full text-slate-500">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (step === "rejected") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AppLogo />
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mt-6 mb-4">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Not Approved</h2>
          <p className="text-slate-600 mb-6">
            Your previous application was not approved. You may submit a new application with updated information.
          </p>
          <Button
            onClick={() => { setSelectedRole(null); setFormData({}); setSelectedLeagues([]); setLeagueTeamMap({}); setStep("select_role"); }}
            className="w-full bg-orange-500 hover:bg-orange-600 mb-3"
          >
            Apply Again
          </Button>
          <Button onClick={() => base44.auth.logout('/')} variant="ghost" className="w-full text-slate-500">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // COACH_REDIRECT_V1 — a signpost, not a form. No UserApplication is created
  // here: coaches are registered by their league, so we point them at the
  // registration link and code their organizer sends out.
  if (step === "coach_signpost") {
    const goToJoinLink = () => {
      const raw = (joinLinkInput || "").trim();
      if (!raw) { setJoinLinkError("Paste the link your organizer sent you."); return; }
      const match = raw.match(/\/Join\/([A-Za-z0-9_-]+)/i);
      const slug = match ? match[1] : (/^[A-Za-z0-9_-]+$/.test(raw) ? raw : "");
      if (!slug) { setJoinLinkError("That doesn't look like a registration link — it ends with /Join/your-league."); return; }
      window.location.href = `/Join/${slug}`;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div data-marker="COACH_REDIRECT_V1" className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          <button
            onClick={() => { setSelectedRole(null); setJoinLinkError(""); setStep("select_role"); }}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to role selection
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Coaches join by invitation</h2>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 leading-relaxed mb-5">
            <p className="font-semibold mb-2">Ask your league organizer for your registration link and code.</p>
            <p>
              Coaches are registered by their league, so we know which team is yours. Your organizer
              will send you a link that looks like <span className="font-mono text-xs">courtside-by-ai.com/Join/your-league</span>{" "}
              and, if your team already exists, a code like <span className="font-mono text-xs">EBL-1A2B</span>.
            </p>
          </div>

          <label className="block text-sm font-medium text-slate-700 mb-1.5">Already have the link?</label>
          <div className="flex gap-2">
            <Input
              value={joinLinkInput}
              onChange={(e) => { setJoinLinkInput(e.target.value); setJoinLinkError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goToJoinLink(); } }}
              placeholder="Paste your registration link"
            />
            <Button onClick={goToJoinLink} className="bg-orange-500 hover:bg-orange-600 flex-shrink-0">
              Go
            </Button>
          </div>
          {joinLinkError && <p className="text-sm text-red-600 mt-2">{joinLinkError}</p>}

          <Button
            onClick={() => { setSelectedRole(null); setJoinLinkError(""); setStep("select_role"); }}
            variant="outline"
            className="w-full mt-5"
          >
            Choose a different role
          </Button>

          <div className="text-center mt-4">
            <button onClick={() => base44.auth.logout('/')} className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SEARCH_PUBLIC_V1 — find a league with registration open. Coaches and
  // players see every open season; fans see the seasons open to fans first
  // and the rest greyed out. Picking one opens that league's own /Join page.
  if (step === "league_search") {
    const isFan = searchMode === "fan";
    const q = searchQuery.trim().toLowerCase();
    const matches = openCampaigns.filter((c) => {
      if (!isFan && !c.roles_enabled.some((r) => r === "coach" || r === "player")) return false;
      if (!q) return true;
      const hay = [c.group_name, c.season_name, c.hero_title, c.season_text, c.country].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const groupsMap = new Map();
    for (const c of matches) {
      const key = c.group_id || ("c:" + c.slug);
      if (!groupsMap.has(key)) groupsMap.set(key, { key, name: c.group_name || c.hero_title || c.season_name, country: c.country, logo: c.logo_url, seasons: [] });
      groupsMap.get(key).seasons.push(c);
    }
    const allGroups = [...groupsMap.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const fanOpen = (g) => g.seasons.some((c) => c.roles_enabled.includes("viewer"));
    const shown = isFan ? allGroups.filter(fanOpen) : allGroups;
    const greyed = isFan ? allGroups.filter((g) => !fanOpen(g)) : [];
    const noResults = !searchLoading && q && shown.length === 0 && greyed.length === 0;
    const roleLabel = { coach: "Coaches", player: "Players", viewer: "Fans" };
    const seasonLabel = (c) => c.season_text || c.season_name || "Registration open";

    const pickGroup = (g) => {
      const usable = isFan ? g.seasons.filter((c) => c.roles_enabled.includes("viewer")) : g.seasons;
      if (usable.length === 1) { goToJoin(usable[0].slug); return; }
      setOpenGroupKey(openGroupKey === g.key ? "" : g.key);
    };

    const groupRow = (g, disabled) => (
      <div key={g.key} className="mb-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => pickGroup(g)}
          className={"w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors " + (disabled ? "border-slate-200 bg-slate-50 opacity-60 cursor-default" : "border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50")}
        >
          {g.logo ? (
            <img src={g.logo} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{initialsOf(g.name)}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 truncate">{g.name}</div>
            <div className="text-xs text-slate-500">
              {(() => {
                const list = isFan && !disabled ? g.seasons.filter((c) => c.roles_enabled.includes("viewer")) : g.seasons;
                return [g.country, list.length > 1 ? list.length + " seasons open" : seasonLabel(list[0])].filter(Boolean).join(" · ");
              })()}
            </div>
            {disabled ? (
              <div className="text-xs text-slate-500 mt-1">The organiser hasn't opened fan signup yet</div>
            ) : (
              !isFan && g.seasons.length === 1 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {["coach", "player", "viewer"].map((r) => (
                    <span key={r} className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (g.seasons[0].roles_enabled.includes(r) ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-400 line-through")}>{roleLabel[r]}</span>
                  ))}
                </div>
              )
            )}
          </div>
          {!disabled && <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </button>
        {openGroupKey === g.key && (
          <div className="mt-2 ml-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600">Which season?</p>
            {(isFan ? g.seasons.filter((c) => c.roles_enabled.includes("viewer")) : g.seasons).map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => goToJoin(c.slug)}
                className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-orange-400"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">{seasonLabel(c)}</div>
                  <div className="text-xs text-slate-500">{c.roles_enabled.map((r) => roleLabel[r]).join(", ")} open</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div data-marker="SEARCH_PUBLIC_V1" className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <button
            onClick={() => setStep("select_role")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="text-xl font-bold text-slate-900 mb-1">{isFan ? "Find a league to follow" : "Find your league"}</h2>
          <p className="text-sm text-slate-500 mb-4">{isFan ? "Scores, standings and player stats." : "Search by league name or country."}</p>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setOpenGroupKey(""); setShowNotFound(false); }}
              placeholder="e.g. Espoo, Manila, KOE"
              className="pl-9"
            />
          </div>

          {searchLoading && <p className="text-sm text-slate-500 py-4 text-center">Loading leagues…</p>}

          {!searchLoading && !noResults && !showNotFound && (
            <div className="max-h-96 overflow-y-auto">
              {shown.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{isFan ? "Open to fans" : "Registration open"} · {shown.length}</p>
              )}
              {shown.map((g) => groupRow(g, false))}
              {greyed.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-4 mb-2">Not open to fans yet · {greyed.length}</p>
              )}
              {greyed.map((g) => groupRow(g, true))}
              {!q && shown.length === 0 && greyed.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No leagues are taking registrations right now.</p>
              )}
            </div>
          )}

          {(noResults || showNotFound) ? (
            <div data-marker="LEAGUE_REQUEST_V1" className="mt-2">
              <div className="text-center mb-4">
                <p className="font-semibold text-slate-900">{q ? "“" + searchQuery.trim() + "” isn't on Courtside yet" : "Can't find your league?"}</p>
                <p className="text-sm text-slate-500 mt-1">Or it hasn't opened registration. Who organises it?</p>
              </div>
              <button
                type="button"
                onClick={() => startLeagueAdmin(searchQuery)}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-orange-500 bg-orange-50 p-4 text-left mb-3"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0"><Trophy className="w-5 h-5 text-white" /></div>
                <div>
                  <div className="font-bold text-slate-900">I organise it</div>
                  <div className="text-xs text-slate-600">Set it up in a few minutes. Your teams can register straight away.</div>
                </div>
              </button>
              <button
                type="button"
                onClick={startLeagueRequest}
                className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Share2 className="w-5 h-5 text-slate-600" /></div>
                <div>
                  <div className="font-bold text-slate-900">Someone else organises it</div>
                  <div className="text-xs text-slate-600">Send them a message about Courtside. We'll remember your league.</div>
                </div>
              </button>
              {!isFan && (
                <p className="text-center text-sm text-slate-500 mt-4">
                  Just want to follow games?{" "}
                  <button type="button" onClick={() => openSearch("fan")} className="text-orange-600 font-semibold">Continue as a fan</button>
                </p>
              )}
              {showNotFound && !noResults && (
                <p className="text-center text-sm mt-3">
                  <button type="button" onClick={() => setShowNotFound(false)} className="text-slate-500 hover:text-slate-700">Back to the list</button>
                </p>
              )}
            </div>
          ) : (
            !searchLoading && (
              <Button variant="outline" onClick={() => setShowNotFound(true)} className="w-full mt-4">
                I can't find my league
              </Button>
            )
          )}
        </div>
      </div>
    );
  }

  // LEAGUE_REQUEST_V1 — consent first: the request stores this person's name
  // and email next to a league they named.
  if (step === "request_consent") {
    return (
      <PrivacyConsentStep
        onAccept={(data) => { setConsentData(data); setStep("league_request"); }}
        onBack={() => setStep("league_search")}
        role="requester"
        source="LeagueRequest"
      />
    );
  }

  if (step === "league_request") {
    const setField = (k, v) => setRequestForm((prev) => ({ ...prev, [k]: v }));
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div data-marker="LEAGUE_REQUEST_V1" className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <button
            onClick={() => setStep("league_search")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Bring your league to Courtside</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">League name</label>
              <Input value={requestForm.league_name || ""} onChange={(e) => setField("league_name", e.target.value)} placeholder="e.g. Kerava Hoops" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <Input value={requestForm.city || ""} onChange={(e) => setField("city", e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <Input value={requestForm.country || ""} onChange={(e) => setField("country", e.target.value)} placeholder="e.g. Finland" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">League's Facebook page or website <span className="font-normal text-slate-400">optional</span></label>
              <Input value={requestForm.league_link || ""} onChange={(e) => setField("league_link", e.target.value)} placeholder="facebook.com/yourleague" />
              <p className="text-xs text-slate-500 mt-1">Helps us find the right league. Please don't enter anyone's email or phone number.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message for your organiser</label>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed">{INVITE_MESSAGE}</div>
            </div>
          </div>
          {requestError && <p className="text-sm text-red-600 mt-3">{requestError}</p>}
          <div className="flex gap-2 mt-4">
            <Button disabled={requestSaving} onClick={() => saveLeagueRequest("share")} className="flex-1 bg-orange-500 hover:bg-orange-600">
              <Share2 className="w-4 h-4 mr-2" />Share
            </Button>
            <Button disabled={requestSaving} variant="outline" onClick={() => saveLeagueRequest("copy")} className="flex-1">
              <Copy className="w-4 h-4 mr-2" />Copy
            </Button>
          </div>
          <p className="text-center text-sm mt-3">
            <button type="button" disabled={requestSaving} onClick={() => saveLeagueRequest("save")} className="text-slate-500 hover:text-slate-700">
              Just save my request
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (step === "request_done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div data-marker="LEAGUE_REQUEST_V1" className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AppLogo />
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mt-4 mb-4 text-green-600 text-3xl font-bold">✓</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">We've added {(requestForm.league_name || "your league").trim()} to our list</h2>
          <p className="text-sm text-slate-600 mb-4">When it joins Courtside, you'll see it here next time you log in. Until then you can follow other leagues as a fan.</p>
          {shareNote && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2 mb-4">{shareNote}</p>}
          <Button onClick={() => openSearch("fan")} className="w-full bg-slate-900 hover:bg-slate-800 mb-2">Follow a league as a fan</Button>
          <Button variant="ghost" onClick={() => setStep("select_role")} className="w-full text-slate-500">Back to start</Button>
        </div>
      </div>
    );
  }

  if (step === "privacy_consent") {
    // CONSENT_LOG_V1 — role and source are known here; leagueId deliberately is
    // not passed, because leagues are picked on the NEXT step (fill_form), so
    // there is no league to record at the moment consent is given.
    return (
      <PrivacyConsentStep
        onAccept={(data) => { setConsentData(data); setStep("fill_form"); }}
        onBack={() => { setSelectedRole(null); setStep("select_role"); }}
        role={selectedRole || ""}
        source="RegistrationGate"
      />
    );
  }

  if (step === "fill_form") {
    const roleInfo = ROLE_OPTIONS.find(r => r.id === selectedRole);
    const RoleIcon = roleInfo?.icon;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div data-marker="REGGATE_BANNERS_V1" className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          <button
            onClick={() => setStep("select_role")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to role selection
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo?.color} flex items-center justify-center`}>
              {RoleIcon && <RoleIcon className="w-5 h-5 text-white" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{roleInfo?.label} Application</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedRole === "league_admin" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminLeagueMode("new")}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${adminLeagueMode === "new" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    I'm starting a new league
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminLeagueMode("existing")}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${adminLeagueMode === "existing" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    I help run a league already on Courtside
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <Input value={formData.full_name || ""} onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Your full name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <Input value={formData.country || ""} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g., Finland" required />
                </div>
                {adminLeagueMode === "new" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">League Name</label>
                      <Input value={formData.league_name || ""} onChange={e => setFormData(prev => ({ ...prev, league_name: e.target.value }))} placeholder="e.g., Helsinki Basketball League" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Season Start Date</label>
                      <Input type="date" value={formData.season_start_date || ""} onChange={e => setFormData(prev => ({ ...prev, season_start_date: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Number of Teams</label>
                        <Input type="number" min="2" value={formData.number_of_teams || ""} onChange={e => setFormData(prev => ({ ...prev, number_of_teams: e.target.value }))} placeholder="e.g., 8" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Avg Players/Team</label>
                        <Input type="number" min="5" value={formData.avg_players_per_team || ""} onChange={e => setFormData(prev => ({ ...prev, avg_players_per_team: e.target.value }))} placeholder="e.g., 12" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number <span className="text-orange-600">*</span></label>
                      <Input value={formData.phone || ""} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="e.g., +63 917 555 0142" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Best way to reach you</label>
                      <div className="flex flex-wrap gap-2">
                        {[["whatsapp","WhatsApp"],["messenger","Messenger"],["email","Email"],["call","Call"]].map(([val,lbl]) => (
                          <button key={val} type="button" onClick={() => setFormData(prev => ({ ...prev, preferred_channel: val }))} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${formData.preferred_channel === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">League type</label>
                      <div className="flex flex-wrap gap-2">
                        {[["recreational","Recreational"],["competitive","Competitive"],["corporate","Corporate"],["school","School"]].map(([val,lbl]) => (
                          <button key={val} type="button" onClick={() => setFormData(prev => ({ ...prev, league_type: val }))} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${formData.league_type === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">How did you hear about us?</label>
                      <div className="flex flex-wrap gap-2">
                        {[["facebook_group","Facebook group"],["referral","Referral"],["search","Search"],["another_league","Another league"],["other","Other"]].map(([val,lbl]) => (
                          <button key={val} type="button" onClick={() => setFormData(prev => ({ ...prev, heard_from: val }))} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${formData.heard_from === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">League Facebook page <span className="text-slate-400 font-normal">(optional)</span></label>
                      <Input value={formData.league_fb_page || ""} onChange={e => setFormData(prev => ({ ...prev, league_fb_page: e.target.value }))} placeholder="facebook.com/yourleague" />
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={formData.onboarding_call === true} onChange={e => setFormData(prev => ({ ...prev, onboarding_call: e.target.checked }))} />
                        <span className="text-sm text-slate-700"><span className="font-semibold text-orange-700">Book a free 30-min onboarding &amp; demo call</span> — we'll set your league up with you and show you around. Highly recommended for new leagues.</span>
                      </label>
                      {formData.onboarding_call === true && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred date</label>
                            <Input type="date" value={formData.onboarding_date || ""} onChange={e => setFormData(prev => ({ ...prev, onboarding_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred time</label>
                            <Input type="time" step="1800" value={formData.onboarding_time || ""} onChange={e => setFormData(prev => ({ ...prev, onboarding_time: e.target.value }))} />
                          </div>
                          <p className="col-span-2 text-xs text-slate-500">Times are in your local timezone (auto-detected): {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {adminLeagueMode === "existing" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Which league?</label>
                      <Select value={selectedAdminLeagueId} onValueChange={v => setSelectedAdminLeagueId(v)}>
                        <SelectTrigger><SelectValue placeholder="Choose a league…" /></SelectTrigger>
                        <SelectContent>
                          {groupedLeagues.map(sec => (
                            <SelectGroup key={sec.group ? sec.group.id : "other"}>
                              <SelectLabel>{sec.group ? sec.group.name : "Other leagues"}</SelectLabel>
                              {sec.seasons.map(l => (
                                <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your role in this league</label>
                      <Input value={formData.role_in_league || ""} onChange={e => setFormData(prev => ({ ...prev, role_in_league: e.target.value }))} placeholder="e.g., Stats keeper, assistant organizer" />
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-blue-800">We'll send your request to the league's owner to approve.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedRole === "viewer" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Full Name *</label>
                  <Input value={formData.full_name || ""} onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Your full name" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                  <Input value={formData.country || ""} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g., Finland" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Select League(s) *</label>
                  <GroupedLeaguePicker sections={groupedLeagues} selectedLeagues={selectedLeagues} onToggle={toggleLeague} />
                  {selectedLeagues.length > 0 && (
                    <p className="text-xs text-orange-600 mt-1">{selectedLeagues.length} league(s) selected</p>
                  )}
                </div>
              </div>
            )}

            {selectedRole === "player" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Player Display Name *</label>
                    <Input value={formData.display_name || ""} onChange={e => setFormData(prev => ({ ...prev, display_name: e.target.value }))} placeholder="Your name as it appears on the roster" required />
                    <p className="text-xs text-slate-400 mt-1">This is how your name will appear in stats, standings, and awards.</p>
                  </div>
                  {/* JERSEY_FIELD_V1 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Jersey Number *</label>
                    <Input value={formData.jersey_number || ""} onChange={e => setFormData(prev => ({ ...prev, jersey_number: e.target.value }))} placeholder="e.g., 23" maxLength={3} required />
                    <p className="text-xs text-slate-400 mt-1">Enter your name and jersey number exactly as your team lists them. We'll try to match you to your team's roster automatically. If we can't, a league organizer will review your request — you'll get an email once you're approved.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Nickname / Handle <span className="font-normal text-slate-400">(optional)</span></label>
                    <Input value={formData.handle || ""} onChange={e => setFormData(prev => ({ ...prev, handle: e.target.value }))} placeholder="e.g., The Flash" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                    <Input value={formData.country || ""} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g., Finland" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Select League(s) *</label>
                    <GroupedLeaguePicker sections={groupedLeagues} selectedLeagues={selectedLeagues} onToggle={toggleLeague} />
                    {selectedLeagues.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">{selectedLeagues.length} league(s) selected</p>
                    )}
                  </div>
                  {selectedLeagues.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-700 block">Select Team per League *</label>
                      {selectedLeagues.map(lid => {
                        const league = leagues.find(l => l.id === lid);
                        const leagueTeams = teams.filter(t => t.league_id === lid);
                        const noTeams = leagueTeams.length === 0;
                        return (
                          <div key={lid} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                            <p className="text-xs font-semibold text-slate-600 mb-2">{groupNameFor(league) ? `${groupNameFor(league)} \u2014 ` : ""}{league?.name} <span className="text-slate-400">({league?.season})</span></p>
                            {/* TEAMLESS_LEAGUE_V1 */}
                            {noTeams ? (
                              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                This league hasn't added any teams yet, so there's no roster to join. Ask your league organizer to set up your team, then come back to finish signing up. You can still continue with any other league that has teams.
                              </div>
                            ) : (
                              <Select
                                value={leagueTeamMap[lid] || ""}
                                onValueChange={(val) => setLeagueTeamMap(prev => ({ ...prev, [lid]: val }))}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Choose a team" />
                                </SelectTrigger>
                                <SelectContent>
                                  {leagueTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {formError}
              </div>
            )}

            {(() => {
              let canSubmit = true;
              if (selectedRole === "league_admin") {
                if (!formData.country?.trim()) canSubmit = false;
                if (adminLeagueMode === "new" && !formData.league_name?.trim()) canSubmit = false;
                if (adminLeagueMode === "existing" && !selectedAdminLeagueId) canSubmit = false;
              } else {
                if (selectedLeagues.length === 0) canSubmit = false;
                if (selectedRole === "player") {
                  // Leagues that actually have teams must have a team chosen; teamless leagues are excluded (note shown instead).
                  const leaguesWithTeams = selectedLeagues.filter(lid => teams.some(t => t.league_id === lid));
                  if (leaguesWithTeams.some(lid => !leagueTeamMap[lid])) canSubmit = false;
                  if (!leaguesWithTeams.some(lid => leagueTeamMap[lid])) canSubmit = false;
                  if (!formData.display_name?.trim()) canSubmit = false;
                  if (!formData.jersey_number?.trim()) canSubmit = false;
                }
              }
              return (
                <Button type="submit" disabled={isSubmitting || !canSubmit} className="w-full bg-orange-500 hover:bg-orange-600 mt-2 disabled:opacity-50">
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
              );
            })()}
          </form>
        </div>
      </div>
    );
  }

  // GLOBAL_FRONT_DOOR_V1 — the front door for anyone signed in with no role
  // and no league link. Written as who you are, not as a list of benefits.
  // Coaches, players and fans always finish on their league's /Join page.
  const linkedCampaign = latestRequest && latestRequest.linked_league_group_id
    ? openCampaigns.find((c) => c.group_id === latestRequest.linked_league_group_id) || null
    : null;
  const pasteGo = () => {
    const slug = slugFromPasted(joinLinkInput);
    if (!slug) { setJoinLinkError("That doesn't look like a registration link. It ends with /Join/your-league."); return; }
    goToJoin(slug);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div data-marker="GLOBAL_FRONT_DOOR_V1" className="max-w-lg w-full">
        <div className="text-center mb-6">
          <AppLogo />
          <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-2">
            {user?.full_name ? "Welcome, " + String(user.full_name).split(" ")[0] : "Welcome to Courtside by AI"}
          </h1>
          <p className="text-slate-600">Tell us how you're joining and we'll take you to the right place.</p>
        </div>

        {latestRequest && (
          latestRequest.linked_league_group_id ? (
            <div data-marker="LEAGUE_REQUEST_V1" className="rounded-2xl border-2 border-green-500 bg-green-50 p-4 mb-4">
              <p className="text-[11px] font-bold tracking-wide text-green-800">GOOD NEWS</p>
              <p className="font-bold text-slate-900">{latestRequest.league_name} is on Courtside</p>
              {linkedCampaign ? (
                <>
                  <p className="text-xs text-green-800">{linkedCampaign.season_text || linkedCampaign.season_name} registration is open</p>
                  <Button onClick={() => goToJoin(linkedCampaign.slug)} className="w-full bg-orange-500 hover:bg-orange-600 mt-3">
                    Join {latestRequest.league_name}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-green-800">Registration opens soon. Check back here.</p>
              )}
            </div>
          ) : (
            <div data-marker="LEAGUE_REQUEST_V1" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-[11px] font-bold tracking-wide text-amber-800">YOUR REQUEST</p>
              <p className="font-bold text-slate-900">{latestRequest.league_name}</p>
              <p className="text-xs text-amber-800">Waiting to join Courtside</p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={async () => { const r = await shareOrCopy(INVITE_MESSAGE, true); setShareNote(r === "copied" ? "Message copied." : ""); }}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Share again
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSearch("fan")}>Follow another league</Button>
              </div>
              {shareNote && <p className="text-xs text-green-700 mt-2">{shareNote}</p>}
            </div>
          )
        )}

        <div className="space-y-3">
          <button
            onClick={() => startLeagueAdmin("")}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-orange-500 bg-orange-50 p-5 text-left shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0"><Trophy className="w-6 h-6 text-white" /></div>
            <div className="flex-1">
              <div className="text-lg font-bold text-slate-900">I run a league</div>
              <div className="text-sm text-slate-600">Set up your league, seasons, teams and live stats.</div>
              <span className="inline-block mt-2 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-orange-500 text-white">START HERE IF YOUR LEAGUE IS NEW</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button
            onClick={() => openSearch("team")}
            className="w-full flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:shadow-md hover:border-orange-300 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0"><Users className="w-6 h-6 text-white" /></div>
            <div className="flex-1">
              <div className="text-lg font-bold text-slate-900">I coach or play on a team</div>
              <div className="text-sm text-slate-600">Find your league and register your team or yourself.</div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button
            onClick={() => openSearch("fan")}
            className="w-full flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:shadow-md hover:border-orange-300 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0"><Eye className="w-6 h-6 text-white" /></div>
            <div className="flex-1">
              <div className="text-lg font-bold text-slate-900">I'm a fan</div>
              <div className="text-sm text-slate-600">Follow scores, standings and player stats.</div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="text-center mt-5">
          {showLinkBox ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-left">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Paste the registration link from your league</label>
              <div className="flex gap-2">
                <Input
                  value={joinLinkInput}
                  onChange={(e) => { setJoinLinkInput(e.target.value); setJoinLinkError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pasteGo(); } }}
                  placeholder="courtside-by-ai.com/Join/your-league"
                />
                <Button onClick={pasteGo} className="bg-orange-500 hover:bg-orange-600 flex-shrink-0">Go</Button>
              </div>
              {joinLinkError && <p className="text-sm text-red-600 mt-2">{joinLinkError}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              <Link2 className="w-4 h-4 inline mr-1 -mt-0.5" />
              Got a registration link from your league?{" "}
              <button onClick={() => { setShowLinkBox(true); setJoinLinkError(""); }} className="text-orange-600 font-semibold">Paste it here</button>
            </p>
          )}
          <div className="mt-4">
            <button onClick={() => base44.auth.logout('/')} className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}