import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, ChevronRight } from "lucide-react";

export default function UserManagement() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    role: "",
    user_type: "",
    assigned_league_ids: [],
  });
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.User.update(selectedUser.id, {
        role: data.role,
        user_type: data.user_type,
        assigned_league_ids: data.assigned_league_ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      setFormData({
        role: "",
        user_type: "",
        assigned_league_ids: [],
      });
    },
  });

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setFormData({
      role: user.role || "user",
      user_type: user.user_type || "viewer",
      assigned_league_ids: user.assigned_league_ids || [],
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

  const handleSave = () => {
    updateUserMutation.mutate(formData);
  };

  if (selectedUser) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">{selectedUser.full_name}</CardTitle>
            <p className="text-sm text-slate-600 mt-1">{selectedUser.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedUser(null);
              setFormData({
                role: "",
                user_type: "",
                assigned_league_ids: [],
              });
            }}
            className="text-slate-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Role Selection */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              Role
            </Label>
            <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">App-level access control</p>
          </div>

          {/* User Type Selection */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              User Type
            </Label>
            <Select value={formData.user_type} onValueChange={(val) => setFormData({ ...formData, user_type: val })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select user type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app_admin">App Admin</SelectItem>
                <SelectItem value="league_admin">League Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">Determines feature access and permissions</p>
          </div>

          {/* League Assignment */}
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
                    <span className="font-medium text-slate-900">
                      {league.name}
                    </span>
                    <span className="text-slate-500 text-sm ml-2">
                      ({league.season})
                    </span>
                  </Label>
                </div>
              ))}
              {leagues.length === 0 && (
                <p className="text-slate-500 text-sm">No leagues available</p>
              )}
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={updateUserMutation.isPending}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <CardTitle className="text-xl">User Management</CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          Manage user roles, types, and league assignments
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="font-medium text-slate-900">{user.full_name}</div>
                <div className="text-sm text-slate-600">{user.email}</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {user.role === "admin" ? "Admin" : "User"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {user.user_type || "viewer"}
                  </Badge>
                  {user.assigned_league_ids?.length > 0 && (
                    <Badge className="text-xs bg-blue-100 text-blue-800">
                      {user.assigned_league_ids.length} league(s)
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          ))}
          {users.length === 0 && (
            <p className="text-slate-500 text-center py-8">No users found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}