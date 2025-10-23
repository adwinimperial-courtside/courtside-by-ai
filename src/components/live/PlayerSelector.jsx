import React from "react";
import { motion } from "framer-motion";

export default function PlayerSelector({ players, existingStats, selectedPlayer, onSelectPlayer, teamColor }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {players.map((player) => {
        const playerStats = existingStats.find(s => s.player_id === player.id);
        const totalPoints = ((playerStats?.points_2 || 0) * 2) + ((playerStats?.points_3 || 0) * 3);
        const isSelected = selectedPlayer?.id === player.id;

        return (
          <motion.button
            key={player.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectPlayer(player)}
            className={`p-4 rounded-xl transition-all ${
              isSelected
                ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                : 'hover:bg-white/10'
            } bg-white/5 border border-white/10`}
            style={isSelected ? { ringColor: teamColor, backgroundColor: `${teamColor}20` } : {}}
          >
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
                style={{ backgroundColor: teamColor || '#f97316' }}
              >
                {player.jersey_number}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{player.name}</p>
                <p className="text-xs text-slate-400">{player.position}</p>
              </div>
            </div>
            {playerStats && (
              <div className="flex justify-between text-xs text-slate-300 pt-2 border-t border-white/10">
                <span>{totalPoints} PTS</span>
                <span>{(playerStats.offensive_rebounds || 0) + (playerStats.defensive_rebounds || 0)} REB</span>
                <span>{playerStats.assists || 0} AST</span>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}