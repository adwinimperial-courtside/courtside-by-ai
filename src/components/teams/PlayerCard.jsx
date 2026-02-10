import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerCard({ player, teamColor, isTeamCaptain }) {
  return (
    <Card className="border-slate-200 hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md relative"
              style={{ backgroundColor: teamColor || '#f97316' }}
            >
              {player.jersey_number}
              {isTeamCaptain && (
                <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                  <span className="text-xs">👑</span>
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{player.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs">
                  {player.position || 'N/A'}
                </Badge>
                {isTeamCaptain && (
                  <Badge className="bg-amber-100 text-amber-800 text-xs">Captain</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}