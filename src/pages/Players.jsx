import React from "react";
import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/**
 * Players page — player management happens inside the Teams page (TeamDetailView).
 * This page redirects users there.
 */
export default function PlayersPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {t("players.title", "Players")}
        </h1>
        <p className="text-slate-500 mb-6">
          {t(
            "players.redirectMessage",
            "Player rosters are managed inside each team. Go to Teams, click a team, and manage players from there."
          )}
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link to="/Teams">
            {t("players.goToTeams", "Go to Teams")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
