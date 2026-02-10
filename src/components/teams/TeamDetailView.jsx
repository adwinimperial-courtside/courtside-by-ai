import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Upload } from "lucide-react";

import PlayerManagement from "./PlayerManagement";
import TeamLogo from "./TeamLogo";

export default function TeamDetailView({ team, onBack }) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const queryClient = useQueryClient();

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Team.update(team.id, { logo_url: file_url });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (error) {
      alert("Failed to upload logo: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Teams
        </Button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="relative group">
                <TeamLogo team={team} size="lg" />
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </label>
                {uploadingLogo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{team.name}</h1>
                <p className="text-slate-600">Team Roster</p>
                <div className="flex flex-wrap gap-4 mt-3">
                  {team.head_coach && (
                    <div className="text-sm">
                      <span className="text-slate-600">Head Coach:</span>
                      <span className="font-semibold text-slate-900 ml-2">{team.head_coach}</span>
                    </div>
                  )}
                  {team.manager && (
                    <div className="text-sm">
                      <span className="text-slate-600">Manager:</span>
                      <span className="font-semibold text-slate-900 ml-2">{team.manager}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
            </div>

            <PlayerManagement teamId={team.id} team={team} />
      </div>
    </div>
  );
}