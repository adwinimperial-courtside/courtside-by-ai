import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

function initialsOf(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function SeasonRow({ league, isViewer, isDefault, onSetDefault, canManage, onEdit, onDelete, isArchived, navigate }) {
  const openSeason = () => {
    if (isViewer) return;
    navigate(`${createPageUrl("Teams")}?league=${league.id}`);
  };
  return (
    <div
      onClick={openSeason}
      className={`flex items-center gap-2 px-2 py-2.5 border-t border-slate-100 rounded-lg transition-colors ${isViewer ? "" : "cursor-pointer hover:bg-slate-50"}`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isArchived ? "text-slate-500" : "text-slate-900"}`}>{league.name}</p>
        <p className="text-xs text-slate-400 truncate">Season {league.season}</p>
      </div>
      {isArchived ? (
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">Archived</span>
      ) : (
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">Current</span>
      )}
      {onSetDefault && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetDefault(league.id); }}
          title={isDefault ? "Default league" : "Set as default"}
          className="p-1 rounded-md hover:bg-amber-50"
        >
          <Star className={`w-4 h-4 ${isDefault ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
        </button>
      )}
      {canManage && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(league); }}
            title="Edit season"
            className="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(league); }}
            title="Delete season"
            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
      {!isViewer && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
    </div>
  );
}

export default function GroupCard({ group, seasons, userType, defaultLeagueId, onSetDefault, canManageSeason, onEdit, onDelete, onNewSeason }) {
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const isViewer = userType === "viewer";

  const bySeasonDesc = (a, b) =>
    (b.season || "").localeCompare(a.season || "") || (a.name || "").localeCompare(b.name || "");
  const currentSeasons = seasons.filter((l) => !l.is_archived).sort(bySeasonDesc);
  const archivedSeasons = seasons.filter((l) => l.is_archived).sort(bySeasonDesc);

  const rowProps = (l) => ({
    league: l,
    isViewer,
    isDefault: defaultLeagueId === l.id,
    onSetDefault,
    canManage: canManageSeason ? canManageSeason(l) : false,
    onEdit,
    onDelete,
    navigate,
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card data-marker="GROUPED_LEAGUES_V1" className="border-0 overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-white">
        <div className="h-3" style={{ backgroundColor: "#0B1F3A" }} />
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          {group.logo_url ? (
            <img src={group.logo_url} alt={group.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
          ) : (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-[15px] shrink-0"
              style={{ backgroundColor: "#0B1F3A", color: "#F26B1F" }}
            >
              {initialsOf(group.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-slate-900 truncate">{group.name}</p>
            <p className="text-xs text-slate-500">
              League · {currentSeasons.length} current season{currentSeasons.length === 1 ? "" : "s"}
            </p>
          </div>

        </div>
        <div className="px-2 pb-3">
          {currentSeasons.map((l) => (
            <SeasonRow key={l.id} {...rowProps(l)} isArchived={false} />
          ))}
          {currentSeasons.length === 0 && (
            <p className="text-sm text-slate-400 px-2 py-3 border-t border-slate-100">No current seasons</p>
          )}
          {onNewSeason && (
            <button
              onClick={() => onNewSeason(group)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl border-2 border-dashed border-orange-400 text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create season
            </button>
          )}
          {archivedSeasons.length > 0 && (
            <>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 py-2 mt-1 hover:text-slate-700 transition-colors"
              >
                {showArchived ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Archived seasons ({archivedSeasons.length})
              </button>
              {showArchived &&
                archivedSeasons.map((l) => <SeasonRow key={l.id} {...rowProps(l)} isArchived={true} />)}
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}