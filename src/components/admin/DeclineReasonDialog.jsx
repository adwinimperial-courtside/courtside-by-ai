import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

// DECLINE_REASON_DIALOG_V1
// One dialog, used by every reject button on the User Requests page.
// The code picked here is stored on the application and drives which decline email
// the applicant receives, so these codes must stay in sync with the REASONS map in
// base44/functions/sendDeclinedEmail/entry.ts and REASON_LABELS in approveUserApplication.

export const DECLINE_REASONS = {
  player_not_on_roster: { label: "Not on that team's roster", hint: "We looked and the name isn't on the team sheet." },
  player_details_mismatch: { label: "Name or jersey number didn't match", hint: "Details don't line up with the roster entry." },
  invalid_name: { label: "Not a real name", hint: "Nickname, initials, gibberish or a placeholder." },
  player_slot_claimed: { label: "That roster spot is already claimed", hint: "Another account is already linked to that player." },
  coach_not_listed: { label: "Not listed as a coach for that team", hint: "The organiser doesn't have you down as staff." },
  coach_staff_full: { label: "Coaching staff is already full", hint: "Both coach spots (head + assistant) are taken." },
  wrong_league_team: { label: "Wrong league or team selected", hint: "Looks like a mis-tap on the signup form." },
  not_recognised: { label: "Not recognised by the league", hint: "The organiser doesn't know this person." },
  league_private: { label: "League is invite only", hint: "This league isn't open to public followers." },
  league_already_exists: { label: "This league is already on Courtside", hint: "Someone else already set it up." },
  not_organiser: { label: "Couldn't confirm they run this league", hint: "No proof of organiser role." },
  insufficient_info: { label: "Not enough information", hint: "Missing league name, country or team count.", appAdminOnly: true },
  duplicate_request: { label: "Duplicate request", hint: "Same person, request already handled.", appAdminOnly: true },
  other: { label: "Other — write your own message", hint: "Your note becomes the whole explanation. Required.", needsNote: true },
};

export const REASONS_BY_ROLE = {
  player: ["player_not_on_roster", "player_details_mismatch", "invalid_name", "player_slot_claimed", "wrong_league_team", "not_recognised", "other"],
  coach: ["coach_not_listed", "coach_staff_full", "invalid_name", "wrong_league_team", "not_recognised", "other"],
  viewer: ["league_private", "invalid_name", "not_recognised", "other"],
  league_admin: ["league_already_exists", "not_organiser", "invalid_name", "insufficient_info", "duplicate_request", "other"],
};

const ROLE_LABELS = { league_admin: "League Admin", coach: "Coach", player: "Player", viewer: "Fan" };

const NOTE_MAX = 300;

export default function DeclineReasonDialog({
  open,
  onClose,
  onConfirm,
  role,
  applicantName,
  contextLabel,
  isAppAdmin = false,
  busy = false,
}) {
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Reset every time the dialog opens so a previous rejection never leaks into the next one.
  useEffect(() => {
    if (open) {
      setCode("");
      setNote("");
      setSendEmail(true);
    }
  }, [open]);

  const codes = (REASONS_BY_ROLE[role] || REASONS_BY_ROLE.player)
    .filter((c) => isAppAdmin || !DECLINE_REASONS[c].appAdminOnly);

  const picked = code ? DECLINE_REASONS[code] : null;
  const noteMissing = !!(picked && picked.needsNote && !note.trim());
  const canSubmit = !!code && !noteMissing && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({ code, note: note.trim().slice(0, NOTE_MAX), sendEmail });
  };

  return (
    <Dialog open={!!open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reject this request</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-500 -mt-2">
          {applicantName || "This person"}
          {role ? ` · ${ROLE_LABELS[role] || role}` : ""}
          {contextLabel ? ` · ${contextLabel}` : ""}
        </p>

        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
            Why is this being rejected? <span className="text-red-600">*</span>
          </p>

          <div className="space-y-2">
            {codes.map((c) => {
              const r = DECLINE_REASONS[c];
              const on = code === c;
              return (
                <label
                  key={c}
                  className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                    on ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="decline_reason"
                    className="mt-1 accent-orange-500"
                    checked={on}
                    onChange={() => setCode(c)}
                    disabled={busy}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {r.label}
                      {r.appAdminOnly && (
                        <span className="ml-2 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                          APP ADMIN
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">{r.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mt-5 mb-2">
            Add a note {picked && picked.needsNote ? <span className="text-red-600">(required)</span> : "(optional)"}
          </p>
          <Textarea
            value={note}
            maxLength={NOTE_MAX}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shown to the applicant, in your words…"
            className="min-h-[70px]"
          />
          <p className="text-[11px] text-slate-400 text-right mt-1">
            {note.length}/{NOTE_MAX} · appears in the email as a quoted note from you
          </p>

          <label className="flex items-center gap-3 p-3 mt-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-orange-500"
              checked={sendEmail}
              disabled={busy}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Email the applicant</span>
              <span className="block text-xs text-slate-500">
                Turn off to reject quietly — the reason is still saved to the audit log.
              </span>
            </span>
          </label>

          {noteMissing && (
            <div className="flex gap-2 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>With &ldquo;Other&rdquo; selected, your note becomes the whole explanation in the email. Please write one.</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 mt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {busy ? "Rejecting…" : "Reject request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}