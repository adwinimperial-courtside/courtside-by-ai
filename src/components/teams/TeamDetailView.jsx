import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * TeamDetailView — stub
 *
 * Full player management will be built in the Players.jsx phase.
 * For now this shows the team header and a placeholder.
 */
export default function TeamDetailView({ team, onBack }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("teams.backToTeams", "Back to Teams")}
        </Button>

        {/* Team header */}
        <div className="flex items-center gap-4 mb-10">
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={team.name}
              className="w-16 h-16 rounded-xl object-cover border-2"
              style={{ borderColor: team.color || "#f97316" }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${team.color || "#f97316"}20` }}
            >
              <Users
                className="w-8 h-8"
                style={{ color: team.color || "#f97316" }}
              />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>
            {team.short_name && (
              <p className="text-slate-500 text-sm">{team.short_name}</p>
            )}
          </div>
        </div>

        {/* Placeholder */}
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {t("teams.rosterComingSoon", "Player Roster Coming Soon")}
          </h3>
          <p className="text-slate-500 text-center max-w-sm">
            {t(
              "teams.rosterDescription",
              "Full player management will be available once the Players page is rebuilt. Check back after Phase 2 is complete."
            )}
          </p>
        </div>

      </div>
    </div>
  );
}
