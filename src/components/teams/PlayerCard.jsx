import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerCard({ player, teamColor }) {
  return (
    <Card className="border-slate-200 hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
              style={{ backgroundColor: teamColor || '#f97316' }}
            >
              {player.jersey_number}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{player.name}</p>
              <Badge variant="secondary" className="mt-1 bg-slate-100 text-slate-700 text-xs">
                {player.position || 'N/A'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}