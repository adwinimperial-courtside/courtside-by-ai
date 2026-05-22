import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, Clock, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createPageUrl } from "../utils";

export default function LeagueSelection() {
  const navigate = useNavigate();
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [leagueRoles, setLeagueRoles] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [notApprovedMessage, setNotApprovedMessage] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const createRequestMutation = useMutation({
    mutationFn: async (leagueIds) => {
      await base44.entities.LeagueAccessRequest.create({
        user_id: currentUser.id,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        requested_league_ids: leagueIds,
        requested_roles: leagueRoles,
        status: "pending"
      });
    },
    onSuccess: () => {
      setShowSuccessModal(true);
    },
    onError: (error) => {
      alert('Failed to submit request: ' + error.message);
    }
  });

  const handleToggleLeague = (leagueId) => {
    setSelectedLeagues(prev => {
      if (prev.includes(leagueId)) {
        setLeagueRoles(r => { const next = { ...r }; delete next[leagueId]; return next; });
        return prev.filter(id => id !== leagueId);
      } else {
        setLeagueRoles(r => ({ ...r, [leagueId]: "viewer" }));
        return [...prev, leagueId];
      }
    });
  };

  const handleRoleSelect = (leagueId, role) => {
    setLeagueRoles(prev => ({ ...prev, [leagueId]: role }));
  };

  const handleSubmit = () => {
    if (selectedLeagues.length === 0) {
      alert('Please select at least one league');
      return;
    }
    createRequestMutation.mutate(selectedLeagues);
  };

  const handleRefresh = async () => {
    setIsCheckingApproval(true);
    setNotApprovedMessage("");
    
    try {
      const updatedUser = await base44.auth.me();
      
      if (updatedUser.assigned_league_ids && updatedUser.assigned_league_ids.length > 0) {
        navigate(createPageUrl('Leagues'));
      } else {
        setNotApprovedMessage("Request has not yet been approved.");
      }
    } catch (error) {
      setNotApprovedMessage("Error checking approval status. Please try again.");
    } finally {
      setIsCheckingApproval(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full border-slate-200 shadow-2xl">
        <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Welcome to Courtside by AI!</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Select the leagues you'd like to access</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6">
            <p className="text-slate-700 mb-4">
              To get started, please select the leagues you want to follow. Your request will be reviewed by an administrator and approved within 10 minutes.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {leagues.map(league => {
              const isSelected = selectedLeagues.includes(league.id);
              const role = leagueRoles[league.id] || "viewer";
              const roles = [
                { value: "player", label: "Player", emoji: "🏀" },
                { value: "coach",  label: "Coach",  emoji: "📋" },
                { value: "viewer", label: "Viewer", emoji: "👁" },
              ];
              return (
                <div
                  key={league.id}
                  className={`rounded-lg border-2 transition-colors ${isSelected ? "border-orange-400 bg-orange-50" : "border-transparent bg-slate-50 hover:bg-slate-100 hover:border-orange-200"}`}
                >
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => handleToggleLeague(league.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleLeague(league.id)}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{league.name}</div>
                      <div className="text-sm text-slate-600">{league.season}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="px-4 pb-4">
                      <p className="text-xs text-slate-500 mb-2 font-medium">Select your role:</p>
                      <div className="flex gap-2">
                        {roles.map(r => (
                          <button
                            key={r.value}
                            onClick={() => handleRoleSelect(league.id, r.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                              role === r.value
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-orange-300"
                            }`}
                          >
                            <span>{r.emoji}</span> {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={selectedLeagues.length === 0 || createRequestMutation.isPending}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
          >
            {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl">Request Submitted Successfully!</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-4 pt-4">
              <p className="text-slate-700">
                Your request has been submitted! The league organiser will review it shortly. You'll be notified once approved.
              </p>
              <p className="text-slate-600">
                Click the button below to check if your request has been approved.
              </p>
              {notApprovedMessage && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-sm font-medium">{notApprovedMessage}</p>
                </div>
              )}
              <Button
                onClick={handleRefresh}
                disabled={isCheckingApproval}
                className="w-full mt-4 bg-orange-600 hover:bg-orange-700"
              >
                {isCheckingApproval ? 'Checking...' : 'Refresh Page'}
              </Button>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}