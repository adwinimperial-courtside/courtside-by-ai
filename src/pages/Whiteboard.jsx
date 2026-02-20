import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import WhiteboardCanvas from "../components/whiteboard/WhiteboardCanvas";

export default function Whiteboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allowedTypes = ['coach', 'league_admin', 'player', 'app_admin'];
  if (!currentUser || !allowedTypes.includes(currentUser.user_type)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Access Restricted</p>
          <p className="text-gray-400">Whiteboard is not available for your role.</p>
        </div>
      </div>
    );
  }

  return <WhiteboardCanvas />;
}