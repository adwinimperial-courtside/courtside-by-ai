import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

// AI_USAGE_LOG_V1
// One row per AI generation, across every AI feature. Separate from
// AIUsageCounter: the counter enforces monthly allowances, this records history
// so an app admin can see who generated what, where, when, and whether it worked.
//
// Two deliberate choices:
//  - Failures are logged too. A feature that silently fails leaves no trace
//    anywhere else, which is exactly how the counter bug hid for four months.
//  - A logging failure must never break the feature the user actually asked for,
//    so every write is wrapped and only warns.
//
// AIUsageLog requires only `feature`, so a partial row still saves rather than
// being rejected and lost.

export const AI_FEATURES = {
  TACTICAL_BRIEFING: "tactical_briefing",
  STORY_BUILDER: "story_builder",
  SEASON_RECAP: "season_recap",
  LEAGUE_LEADERS: "league_leaders",
};

export async function logAIUsage({
  user = null,
  feature,
  leagueId = "",
  model = "claude_sonnet_4_6",
  targetId = "",
  success = true,
  errorMessage = "",
  promptChars = 0,
  responseChars = 0,
  durationMs = 0,
} = {}) {
  try {
    if (!feature) return;
    await base44.entities.AIUsageLog.create({
      user_email: user?.email || "",
      user_type: user?.user_type || "",
      league_id: leagueId || "",
      feature,
      model: model || "",
      month_year: format(new Date(), "yyyy-MM"),
      occurred_at: new Date().toISOString(),
      success: success !== false,
      error_message: errorMessage ? String(errorMessage).slice(0, 500) : "",
      prompt_chars: Number(promptChars) || 0,
      response_chars: Number(responseChars) || 0,
      duration_ms: Number(durationMs) || 0,
      target_id: targetId || "",
    });
  } catch (logError) {
    console.warn("AI_USAGE_LOG_V1: usage log write failed", logError);
  }
}