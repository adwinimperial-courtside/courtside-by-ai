import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, CheckCircle } from "lucide-react";

export default function GameConfirmationModal({ isOpen, game, homeTeam, awayTeam, playerOfGame, players, onClose }) {
  const pogPlayer = players?.find(p => p.id === playerOfGame);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            Game Saved Successfully
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Final Score */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-slate-600">{homeTeam?.name}</p>
                  <p className="text-3xl font-bold text-slate-900">{game?.home_score}</p>
                </div>
                <p className="text-lg text-slate-400 font-semibold">-</p>
                <div className="flex-1 text-right">
                  <p className="text-sm text-slate-600">{awayTeam?.name}</p>
                  <p className="text-3xl font-bold text-slate-900">{game?.away_score}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Player of the Game */}
          {pogPlayer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-amber-900">Player of the Game</p>
              </div>
              <p className="text-lg font-bold text-amber-900">{pogPlayer.name}</p>
              <p className="text-sm text-amber-700">{pogPlayer.jersey_number ? `#${pogPlayer.jersey_number}` : ''}</p>
            </div>
          )}
        </div>

        <Button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-green-500 to-green-600"
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}