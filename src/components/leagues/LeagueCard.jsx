import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function LeagueCard({ league, userType }) {
  const isViewer = userType === "viewer";

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
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:from-indigo-600 group-hover:to-blue-700 transition-all shadow-lg">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {league.description && (
          <p className="text-slate-700 text-sm line-clamp-2 mb-4">
            {league.description}
          </p>
        )}
        {!isViewer && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="font-medium">Manage teams and schedule</span>
          </div>
        )}
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