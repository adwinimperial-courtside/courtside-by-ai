import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";

import LeagueCard from "../components/leagues/LeagueCard";
import CreateLeagueDialog from "../components/leagues/CreateLeagueDialog";

export default function LeaguesPage() {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current user's session
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id;
  const isAppAdmin = session?.user?.user_metadata?.app_admin === true;

  // Fetch this user's league memberships, joining league details
  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["league-memberships", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_league_memberships")
        .select(`
          id,
          role,
          is_active,
          is_billing_admin,
          league:leagues (
            id,
            name,
            slug,
            country,
            timezone,
            sport,
            logo_url,
            is_active,
            created_at
          )
        `)
        .eq("user_id", userId)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch user's profile to get default_league_id
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("default_league_id")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Set default league
  const setDefaultLeagueMutation = useMutation({
    mutationFn: async (leagueId) => {
      const { error } = await supabase
        .from("profiles")
        .update({ default_league_id: leagueId })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });

  // Auto-set default if user only has one league and none is set
  React.useEffect(() => {
    if (
      memberships.length === 1 &&
      profile &&
      !profile.default_league_id
    ) {
      setDefaultLeagueMutation.mutate(memberships[0].league.id);
    }
  }, [memberships, profile]);

  const userIsLeagueAdmin = memberships.some((m) => m.role === "league_admin");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                {t("leagues.title", "Leagues")}
              </h1>
            </div>
            <p className="text-slate-600 ml-15">
              {t("leagues.subtitle", "Manage your basketball leagues and competitions")}
            </p>
          </div>

          {(isAppAdmin || userIsLeagueAdmin) && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 h-12 px-6"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t("leagues.createLeague", "Create League")}
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : memberships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Trophy className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {t("leagues.noLeagues", "No Leagues Assigned")}
            </h3>
            <p className="text-slate-600 text-center mb-8 max-w-md">
              {t(
                "leagues.noLeaguesDescription",
                "You haven't been assigned to any leagues yet. Contact an admin to get assigned."
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memberships.map((membership) => (
              <LeagueCard
                key={membership.league.id}
                league={membership.league}
                role={membership.role}
                isDefault={profile?.default_league_id === membership.league.id}
                onSetDefault={
                  memberships.length > 1
                    ? () => setDefaultLeagueMutation.mutate(membership.league.id)
                    : null
                }
                multipleLeagues={memberships.length > 1}
              />
            ))}
          </div>
        )}

        <CreateLeagueDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </div>
  );
}
