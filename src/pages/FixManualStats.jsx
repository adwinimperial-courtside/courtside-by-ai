import React from "react";

export default function FixManualStats() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Tool retired</h1>
          <p className="text-slate-600">
            This maintenance tool has been removed. Game scores and player stats are
            now handled automatically by the stat engine and no longer need manual
            fixing.
          </p>
        </div>
      </div>
    </div>
  );
}