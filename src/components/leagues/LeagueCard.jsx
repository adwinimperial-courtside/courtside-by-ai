import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar, Star, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function LeagueCard({ league, userType, isDefault, onSetDefault, multipleLeagues, onEdit, onDelete, onNewSeason }) {
  const isViewer = userType === "viewer";
  const canManage = onEdit && onDelete;

  const cardContent = (
    <Card className="group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden cursor-pointer bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="h-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600" />
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
           <div className="flex-1">
             <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-1 group-hover:from-indigo-700 group-hover:to-blue-700 transition-all">
               {league.name}
             </CardTitle>
             <div className="flex items-center gap-2 text-sm text-slate-600">
               <Calendar className="w-4 h-4 text-indigo-500" />
               <span>{league.season}</span>
             </div>
           </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); onEdit(league); }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-orange-50 hover:border-orange-300 text-slate-500 hover:text-orange-600 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); onDelete(league); }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-300 text-slate-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {onNewSeason && (
                  <button
                    onClick={(e) => { e.preventDefault(); onNewSeason(league); }}
                    title="New season"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-green-50 hover:border-green-300 text-slate-500 hover:text-green-600 transition-colors"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:from-indigo-600 group-hover:to-blue-700 transition-all shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {league.description && (
          <p className="text-slate-700 text-sm line-clamp-2 mb-4">
            {league.description}
          </p>
        )}
        {userType === 'app_admin' && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm space-y-1 border border-slate-200">
            <p className="text-slate-800">
              <span className="font-medium">Owner:</span> {league.owner_name || league.owner_email || league.created_by || "Unknown"}
              {league.owner_name && league.owner_email ? ` (${league.owner_email})` : ""}
            </p>
            <p className="text-slate-600">
              <span className="font-medium">Created by:</span> {league.created_by}
            </p>
            <p className="text-slate-600">
              <span className="font-medium">Created:</span> {new Date(league.created_date).toLocaleString()}
            </p>
            <p className="text-slate-500 text-xs font-mono mt-1 break-all">
              ID: {league.id}
            </p>
          </div>
        )}
        <div className="space-y-3">
          {!isViewer && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="font-medium">Manage teams and schedule</span>
            </div>
          )}
          {onSetDefault && (
            <Button
              onClick={(e) => {
                e.preventDefault();
                onSetDefault(league.id);
              }}
              variant={isDefault ? "default" : "outline"}
              size="sm"
              className={`w-full ${isDefault ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
            >
              <Star className={`w-4 h-4 mr-2 ${isDefault ? "fill-white" : ""}`} />
              {isDefault ? "Default League" : "Set as Default"}
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

  return isViewer ? (
    wrappedContent
  ) : (
    <Link to={`${createPageUrl("Teams")}?league=${league.id}`}>
      {wrappedContent}
    </Link>
  );
}