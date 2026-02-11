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
    setSelectedLeagues(prev => 
      prev.includes(leagueId)
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId]
    );
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
            {leagues.map(league => (
              <div
                key={league.id}
                className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border-2 border-transparent hover:border-orange-200"
                onClick={() => handleToggleLeague(league.id)}
              >
                <Checkbox
                  checked={selectedLeagues.includes(league.id)}
                  onCheckedChange={() => handleToggleLeague(league.id)}
                />
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{league.name}</div>
                  <div className="text-sm text-slate-600">{league.season}</div>
                </div>
              </div>
            ))}
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
              <div className="flex items-center justify-center gap-2 text-slate-700">
                <Clock className="w-5 h-5 text-orange-600" />
                <p>Your request will be reviewed within 10 minutes.</p>
              </div>
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