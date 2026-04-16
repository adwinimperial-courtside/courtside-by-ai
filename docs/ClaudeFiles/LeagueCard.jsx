import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Users, Star, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function LeagueCard({ league, role, isDefault, onSetDefault, multipleLeagues }) {
  const { t } = useTranslation();
  const isViewer = role === "viewer";

  // Role badge colour
  const roleBadgeClass = {
    league_admin: "bg-orange-100 text-orange-700",
    coach:        "bg-blue-100 text-blue-700",
    player:       "bg-green-100 text-green-700",
    viewer:       "bg-slate-100 text-slate-600",
  }[role] ?? "bg-slate-100 text-slate-600";

  const roleLabel = {
    league_admin: t("roles.leagueAdmin", "League Admin"),
    coach:        t("roles.coach", "Coach"),
    player:       t("roles.player", "Player"),
    viewer:       t("roles.viewer", "Viewer"),
  }[role] ?? role;

  const cardContent = (
    <Card className="group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden cursor-pointer bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="h-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600" />
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-2 group-hover:from-indigo-700 group-hover:to-blue-700 transition-all">
              {league.name}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Role badge */}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass}`}>
                {roleLabel}
              </span>
              {/* Country */}
              {league.country && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Globe className="w-3 h-3" />
                  {league.country}
                </span>
              )}
            </div>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:from-indigo-600 group-hover:to-blue-700 transition-all shadow-lg ml-3 shrink-0">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {!isViewer && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="font-medium">
                {t("leagues.manageTeams", "Manage teams and schedule")}
              </span>
            </div>
          )}

          {/* Set default button — only shown when user has multiple leagues */}
          {onSetDefault && (
            <Button
              onClick={(e) => {
                e.preventDefault();
                onSetDefault();
              }}
              variant={isDefault ? "default" : "outline"}
              size="sm"
              className={`w-full ${
                isDefault
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-0"
                  : ""
              }`}
            >
              <Star className={`w-4 h-4 mr-2 ${isDefault ? "fill-white" : ""}`} />
              {isDefault
                ? t("leagues.defaultLeague", "Default League")
                : t("leagues.setDefault", "Set as Default")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const wrappedContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {cardContent}
    </motion.div>
  );

  // Viewers don't navigate into the league
  return isViewer ? (
    wrappedContent
  ) : (
    <Link to={`/Teams?league=${league.id}`}>
      {wrappedContent}
    </Link>
  );
}
