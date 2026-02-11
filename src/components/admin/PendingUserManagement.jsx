import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ChevronRight, UserPlus, Mail } from "lucide-react";

export default function PendingUserManagement() {
  const [selectedPending, setSelectedPending] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [formData, setFormData] = useState({
    user_type: "viewer",
    assigned_league_ids: [],
  });
  const queryClient = useQueryClient();

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ["pendingUserAssignments"],
    queryFn: () => base44.entities.PendingUserAssignment.filter({ applied: false }),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const createPendingMutation = useMutation({
    mutationFn: (data) => base44.entities.PendingUserAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingUserAssignments"] });
      setShowAddForm(false);
      setNewEmail("");
      setFormData({ user_type: "viewer", assigned_league_ids: [] });
    },
  });

  const updatePendingMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.PendingUserAssignment.update(selectedPending.id, {
        user_type: data.user_type,
        assigned_league_ids: data.assigned_league_ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingUserAssignments"] });
      setSelectedPending(null);
      setFormData({ user_type: "viewer", assigned_league_ids: [] });
    },
  });

  const deletePendingMutation = useMutation({
    mutationFn: (id) => base44.entities.PendingUserAssignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingUserAssignments"] });
      setSelectedPending(null);
    },
  });

  const handlePendingSelect = (pending) => {
    setSelectedPending(pending);
    setFormData({
      user_type: pending.user_type || "viewer",
      assigned_league_ids: pending.assigned_league_ids || [],
    });
  };

  const toggleLeague = (leagueId) => {
    setFormData((prev) => ({
      ...prev,
      assigned_league_ids: prev.assigned_league_ids.includes(leagueId)
        ? prev.assigned_league_ids.filter((id) => id !== leagueId)
        : [...prev.assigned_league_ids, leagueId],
    }));
  };

  const handleAddPending = () => {
    if (!newEmail.trim()) {
      alert("Please enter an email address");
      return;
    }
    createPendingMutation.mutate({
      email: newEmail.trim().toLowerCase(),
      user_type: formData.user_type,
      assigned_league_ids: formData.assigned_league_ids,
      applied: false,
    });
  };

  const handleUpdatePending = () => {
    updatePendingMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (confirm(`Remove pending assignment for ${selectedPending.email}?`)) {
      deletePendingMutation.mutate(selectedPending.id);
    }
  };

  if (showAddForm) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Add Pending User Assignment</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAddForm(false);
              setNewEmail("");
              setFormData({ user_type: "viewer", assigned_league_ids: [] });
            }}
            className="text-slate-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              Email Address
            </Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Email of the user you'll invite
            </p>
          </div>

          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              User Type
            </Label>
            <Select
              value={formData.user_type}
              onValueChange={(val) => setFormData({ ...formData, user_type: val })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select user type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app_admin">App Admin</SelectItem>
                <SelectItem value="league_admin">League Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">
              Assigned Leagues
            </Label>
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {leagues.map((league) => (
                <div key={league.id} className="flex items-center gap-3">
                  <Checkbox
                    id={league.id}
                    checked={formData.assigned_league_ids.includes(league.id)}
                    onCheckedChange={() => toggleLeague(league.id)}
                  />
                  <Label
                    htmlFor={league.id}
                    className="font-normal cursor-pointer flex-1"
                  >
                    <span className="font-medium text-slate-900">{league.name}</span>
                    <span className="text-slate-500 text-sm ml-2">
                      ({league.season})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleAddPending}
            disabled={createPendingMutation.isPending}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {createPendingMutation.isPending ? "Adding..." : "Add Pending Assignment"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedPending) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Edit Pending Assignment</CardTitle>
            <p className="text-sm text-slate-600 mt-1">{selectedPending.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPending(null);
              setFormData({ user_type: "viewer", assigned_league_ids: [] });
            }}
            className="text-slate-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              User Type
            </Label>
            <Select
              value={formData.user_type}
              onValueChange={(val) => setFormData({ ...formData, user_type: val })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select user type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app_admin">App Admin</SelectItem>
                <SelectItem value="league_admin">League Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">
              Assigned Leagues
            </Label>
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {leagues.map((league) => (
                <div key={league.id} className="flex items-center gap-3">
                  <Checkbox
                    id={league.id}
                    checked={formData.assigned_league_ids.includes(league.id)}
                    onCheckedChange={() => toggleLeague(league.id)}
                  />
                  <Label
                    htmlFor={league.id}
                    className="font-normal cursor-pointer flex-1"
                  >
                    <span className="font-medium text-slate-900">{league.name}</span>
                    <span className="text-slate-500 text-sm ml-2">
                      ({league.season})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleUpdatePending}
              disabled={updatePendingMutation.isPending}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {updatePendingMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deletePendingMutation.isPending}
              variant="destructive"
              className="px-6"
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Pending User Assignments</CardTitle>
            <p className="text-sm text-slate-600 mt-2">
              Pre-assign settings for users before they log in
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Pending User
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {pendingUsers.map((pending) => (
            <button
              key={pending.id}
              onClick={() => handlePendingSelect(pending)}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div className="font-medium text-slate-900">{pending.email}</div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {pending.user_type || "viewer"}
                  </Badge>
                  {pending.assigned_league_ids?.length > 0 && (
                    <Badge className="text-xs bg-blue-100 text-blue-800">
                      {pending.assigned_league_ids.length} league(s)
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          ))}
          {pendingUsers.length === 0 && (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No pending user assignments</p>
              <p className="text-sm text-slate-400 mt-1">
                Add users to pre-configure their settings
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}