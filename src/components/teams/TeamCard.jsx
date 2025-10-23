import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function TeamCard({ team, league, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
    >
      <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 bg-white overflow-hidden cursor-pointer">
        <div className="h-2" style={{ backgroundColor: team.color || '#f97316' }} />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                {team.name}
              </CardTitle>
              {league && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {league.name}
                </Badge>
              )}
            </div>
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ backgroundColor: `${team.color || '#f97316'}20` }}
            >
              <Users className="w-6 h-6" style={{ color: team.color || '#f97316' }} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Record</span>
            <span className="font-bold text-slate-900">{team.wins || 0}W - {team.losses || 0}L</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}