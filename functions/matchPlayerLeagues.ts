import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,\-]/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { user_id, display_name, full_name, handle, assigned_league_ids } = body;

    if (!user_id || !Array.isArray(assigned_league_ids)) {
      return Response.json({ error: 'Missing required fields: user_id and assigned_league_ids' }, { status: 400 });
    }

    if (!assigned_league_ids.length) {
      return Response.json({ matches: [] });
    }

    const [allLeagues, allTeams] = await Promise.all([
      base44.asServiceRole.entities.League.list('-created_date', 500),
      base44.asServiceRole.entities.Team.list('-created_date', 1000),
    ]);

    const results = [];

    for (const leagueId of assigned_league_ids) {
      const league = allLeagues.find(l => l.id === leagueId);
      const teamsInLeague = allTeams.filter(t => t.league_id === leagueId);

      if (!teamsInLeague.length) {
        results.push({
          league_id: leagueId,
          league_name: league?.name || leagueId,
          match_status: 'unmatched',
          match_method: 'none',
          match_confidence: null,
          roster_players: [],
          note: 'No teams in this league',
        });
        continue;
      }

      // Fetch roster players for all teams in this league in parallel
      const rosterArrays = await Promise.all(
        teamsInLeague.map(t => base44.asServiceRole.entities.Player.filter({ team_id: t.id }))
      );
      const rosterPlayers = rosterArrays.flat().map(p => ({
        ...p,
        team_name: teamsInLeague.find(t => t.id === p.team_id)?.name || '',
      }));

      // Check for an existing manually confirmed record — don't overwrite it
      const existing = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
        user_id,
        league_id: leagueId,
      });
      const existingRecord = existing[0] || null;

      if (
        existingRecord &&
        (existingRecord.match_method === 'manual_admin' || existingRecord.match_method === 'manual_user')
      ) {
        results.push({
          league_id: leagueId,
          league_name: league?.name || leagueId,
          identity_record_id: existingRecord.id,
          matched_player_name: existingRecord.matched_player_name || null,
          matched_player_id: existingRecord.matched_player_id || null,
          team_id: existingRecord.team_id || null,
          team_name: teamsInLeague.find(t => t.id === existingRecord.team_id)?.name || null,
          match_status: existingRecord.match_status,
          match_confidence: existingRecord.match_confidence,
          match_method: existingRecord.match_method,
          roster_players: rosterPlayers.map(p => ({
            id: p.id,
            name: p.name,
            team_id: p.team_id,
            team_name: p.team_name,
            jersey_number: p.jersey_number,
          })),
        });
        continue;
      }

      // Run matching logic
      let matchResult = null;

      // A. Exact display_name match
      if (display_name) {
        const exactMatches = rosterPlayers.filter(p => p.name === display_name);
        if (exactMatches.length === 1) {
          matchResult = {
            matched_player_name: exactMatches[0].name,
            matched_player_id: exactMatches[0].id,
            team_id: exactMatches[0].team_id,
            team_name: exactMatches[0].team_name,
            match_status: 'matched',
            match_confidence: 'high',
            match_method: 'exact_name',
          };
        } else if (exactMatches.length > 1) {
          matchResult = {
            match_status: 'needs_review',
            match_confidence: 'low',
            match_method: 'exact_name',
            note: `${exactMatches.length} exact matches found for display name`,
          };
        }
      }

      // B. Exact full_name match
      if (!matchResult && full_name) {
        const exactMatches = rosterPlayers.filter(p => p.name === full_name);
        if (exactMatches.length === 1) {
          matchResult = {
            matched_player_name: exactMatches[0].name,
            matched_player_id: exactMatches[0].id,
            team_id: exactMatches[0].team_id,
            team_name: exactMatches[0].team_name,
            match_status: 'matched',
            match_confidence: 'high',
            match_method: 'exact_name',
          };
        } else if (exactMatches.length > 1) {
          matchResult = {
            match_status: 'needs_review',
            match_confidence: 'low',
            match_method: 'exact_name',
            note: `${exactMatches.length} exact matches found for full name`,
          };
        }
      }

      // C. Normalized name match
      if (!matchResult) {
        const namesToCheck = [display_name, full_name].filter(Boolean);
        for (const name of namesToCheck) {
          const normalizedUser = normalizeName(name);
          if (!normalizedUser) continue;
          const normalizedMatches = rosterPlayers.filter(p => normalizeName(p.name) === normalizedUser);
          if (normalizedMatches.length === 1) {
            matchResult = {
              matched_player_name: normalizedMatches[0].name,
              matched_player_id: normalizedMatches[0].id,
              team_id: normalizedMatches[0].team_id,
              team_name: normalizedMatches[0].team_name,
              match_status: 'matched',
              match_confidence: 'medium',
              match_method: 'normalized_name',
            };
            break;
          } else if (normalizedMatches.length > 1 && !matchResult) {
            matchResult = {
              match_status: 'needs_review',
              match_confidence: 'low',
              match_method: 'normalized_name',
              note: `${normalizedMatches.length} normalized matches found`,
            };
          }
        }
      }



      if (!matchResult) {
        matchResult = { match_status: 'unmatched', match_confidence: null, match_method: 'none' };
      }

      // Save or create the UserLeagueIdentity record
      const identityData = {
        user_id,
        league_id: leagueId,
        team_id: matchResult.team_id || null,
        matched_player_name: matchResult.matched_player_name || null,
        matched_player_id: matchResult.matched_player_id || null,
        match_status: matchResult.match_status,
        match_confidence: matchResult.match_confidence || null,
        match_method: matchResult.match_method,
        matched_at: new Date().toISOString(),
        matched_by: 'system_auto',
      };

      let identityRecordId;
      if (existingRecord) {
        await base44.asServiceRole.entities.UserLeagueIdentity.update(existingRecord.id, identityData);
        identityRecordId = existingRecord.id;
      } else {
        const created = await base44.asServiceRole.entities.UserLeagueIdentity.create(identityData);
        identityRecordId = created.id;
      }

      results.push({
        league_id: leagueId,
        league_name: league?.name || leagueId,
        identity_record_id: identityRecordId,
        roster_players: rosterPlayers.map(p => ({
          id: p.id,
          name: p.name,
          team_id: p.team_id,
          team_name: p.team_name,
          jersey_number: p.jersey_number,
        })),
        ...matchResult,
      });
    }

    return Response.json({ user_id, matches: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});