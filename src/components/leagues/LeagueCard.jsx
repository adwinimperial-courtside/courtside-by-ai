import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function LeagueCard({ league, userType }) {
  const isViewer = userType === "viewer";

  const CardElement = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 bg-white overflow-hidden cursor-pointer">
        <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-600" />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
             <div className="flex-1">
               <CardTitle className="text-xl font-bold text-slate-900 mb-1 group-hover:text-orange-600 transition-colors">
                 {league.name}
               </CardTitle>
               <div className="flex flex-col gap-2 text-sm text-slate-500">
                 <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4" />
                   <span>{league.season}</span>
                 </div>
                 <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                   ID: {league.id}
                 </div>
               </div>
             </div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <Trophy className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {league.description && (
            <p className="text-slate-600 text-sm line-clamp-2 mb-4">
              {league.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>{isViewer ? "View league details" : "Manage teams and schedule"}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return isViewer ? (
    CardElement
  ) : (
    <Link to={`${createPageUrl("Teams")}?league=${league.id}`}>
        <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 bg-white overflow-hidden cursor-pointer">
        <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-600" />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
             <div className="flex-1">
               <CardTitle className="text-xl font-bold text-slate-900 mb-1 group-hover:text-orange-600 transition-colors">
                 {league.name}
               </CardTitle>
               <div className="flex flex-col gap-2 text-sm text-slate-500">
                 <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4" />
                   <span>{league.season}</span>
                 </div>
                 <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                   ID: {league.id}
                 </div>
               </div>
             </div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <Trophy className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {league.description && (
            <p className="text-slate-600 text-sm line-clamp-2 mb-4">
              {league.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>Manage teams and schedule</span>
          </div>
        </CardContent>
      </Card>
      </Link>
    </motion.div>
  );
}