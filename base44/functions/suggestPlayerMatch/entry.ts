import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// SUGGEST_PLAYER_MATCH_V1
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,\-_'']/g, '');
}
function normJersey(j) {
  if (j === null || j === undefined) return '';
  return String(j).trim();
}
// lenient name closeness: equal, one contains the other, or a shared name token (>=3 chars)
function namesClose(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ca = na.replace(/\s+/g, '');
  const cb = nb.replace(/\s+/g, '');
  if (ca.includes(cb) || cb.includes(ca)) return true;
  const ta = na.split(' ').filter(t => t.length >= 3);
  const tb = nb.split(' ').filter(t => t.length >= 3);
  return ta.some(t => tb.includes(t));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { applicationId } = body;
    if (!applicationId) return Response.json({ error: 'Missing applicationId' }, { status: 400 });

    const app = await base44.asServiceRole.entities.UserApplication.get(applicationId);
    if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });
    if (app.requested_role !== 'player') {
      return Response.json({ skipped: true, reason: 'not a player application' });
    }

    const claimedName = app.display_name || app.user_name || '';
    const claimedJersey = normJersey(app.jersey_number);

    const pairs = (Array.isArray(app.league_team_pairs) && app.league_team_pairs.length)
      ? app.league_team_pairs
      : (app.league_id && app.team_id ? [{ league_id: app.league_id, team_id: app.team_id }] : []);

    const suggestions = [];
    for (const pair of pairs) {
      if (!pair || !pair.team_id) continue;
      const teamId = pair.team_id;
      const [team, roster] = await Promise.all([
        base44.asServiceRole.entities.Team.get(teamId).catch(() => null),
        base44.asServiceRole.entities.Player.filter({ team_id: teamId }),
      ]);
      const teamName = team?.name || '';
      const list = Array.isArray(roster) ? roster : [];

      const jerseyMatches = claimedJersey
        ? list.filter(p => normJersey(p.jersey_number) === claimedJersey)
        : [];
      const nameMatches = list.filter(p => namesClose(p.name, claimedName));

      let suggested = null;
      let confidence = 'none';
      let reason = 'No roster match — needs review.';

      if (jerseyMatches.length === 1) {
        const jm = jerseyMatches[0];
        if (namesClose(jm.name, claimedName)) {
          suggested = jm; confidence = 'strong'; reason = 'Number and name match.';
        } else {
          suggested = jm; confidence = 'number_match_name_differs';
          reason = '⚠ Number matches, name differs — verify.';
        }
      } else if (jerseyMatches.length > 1) {
        confidence = 'ambiguous';
        reason = `⚠ ${jerseyMatches.length} players wear #${claimedJersey} (${jerseyMatches.map(p => p.name).join(', ')}) — pick one.`;
      } else if (nameMatches.length === 1) {
        suggested = nameMatches[0]; confidence = 'name_match_number_differs';
        reason = `Name matches; number differs (roster #${normJersey(nameMatches[0].jersey_number) || '—'} vs claimed #${claimedJersey || '—'}).`;
      } else if (nameMatches.length > 1) {
        confidence = 'ambiguous';
        reason = `⚠ ${nameMatches.length} roster names look similar — pick one.`;
      } else {
        reason = claimedJersey
          ? `No #${claimedJersey} and no name match on this roster — needs review.`
          : 'No roster match — needs review.';
      }

      suggestions.push({
        league_id: pair.league_id || null,
        team_id: teamId,
        team_name: teamName,
        claimed_name: claimedName,
        claimed_jersey: claimedJersey,
        suggested_player_id: suggested ? suggested.id : null,
        suggested_player_name: suggested ? suggested.name : null,
        suggested_jersey: suggested ? normJersey(suggested.jersey_number) : null,
        confidence,
        reason,
      });
    }

    await base44.asServiceRole.entities.UserApplication.update(applicationId, {
      match_suggestions: suggestions,
      match_suggested_at: new Date().toISOString(),
    });

    return Response.json({ applicationId, suggestions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});