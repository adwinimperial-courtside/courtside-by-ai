import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UserPlus, Pencil, Trash2, Search, Shield, Trophy, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EnhancedUserManagement() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    user_type: "viewer",
    assigned_league_ids: [],
    default_league_id: "",
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
        user_type: data.user_type,
        assigned_league_ids: data.assigned_league_ids,
        default_league_id: data.default_league_id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      resetForm();
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (data) => {
      await base44.users.inviteUser(data.email, "user");
      await base44.entities.PendingUserAssignment.create({
        email: data.email,
        user_type: data.user_type,
        assigned_league_ids: data.assigned_league_ids,
        applied: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowAddForm(false);
      resetForm();
      alert("User invited successfully! They will receive an email invitation.");
    },
    onError: (error) => {
      alert("Failed to add user: " + error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowDeleteDialog(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      alert("Failed to delete user: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      email: "",
      full_name: "",
      user_type: "viewer",
      assigned_league_ids: [],
      default_league_id: "",
    });
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      user_type: user.user_type || "viewer",
      assigned_league_ids: user.assigned_league_ids || [],
      default_league_id: user.default_league_id || "",
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

  const handleAdd = () => {
    if (!formData.email || !formData.user_type) {
      alert("Please fill in all required fields");
      return;
    }
    addUserMutation.mutate(formData);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  // Add User Form
  if (showAddForm) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Add New User</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAddForm(false);
              resetForm();
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
              Email *
            </Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              User Type *
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
                    <span className="font-medium text-slate-900">
                      {league.name}
                    </span>
                    <span className="text-slate-500 text-sm ml-2">
                      ({league.season})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleAdd}
            disabled={addUserMutation.isPending}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {addUserMutation.isPending ? "Adding..." : "Add User"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Edit User Form
  if (selectedUser) {
    const assignedLeagues = leagues.filter(l => formData.assigned_league_ids.includes(l.id));
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
            onClick={() => { setSelectedUser(null); resetForm(); }}
            className="text-slate-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">User Type</Label>
            <Select value={formData.user_type} onValueChange={(val) => setFormData({ ...formData, user_type: val })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select user type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app_admin">App Admin</SelectItem>
                <SelectItem value="league_admin">League Admin</SelectItem>
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">Assigned Leagues</Label>
            <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {leagues.length === 0 && <p className="text-sm text-slate-500">No leagues available</p>}
              {leagues.map((league) => (
                <div key={league.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`edit-${league.id}`}
                    checked={formData.assigned_league_ids.includes(league.id)}
                    onCheckedChange={() => toggleLeague(league.id)}
                  />
                  <Label htmlFor={`edit-${league.id}`} className="font-normal cursor-pointer flex-1">
                    <span className="font-medium text-slate-900">{league.name}</span>
                    <span className="text-slate-500 text-sm ml-2">({league.season})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {assignedLeagues.length > 0 && (
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2 block">Default League</Label>
              <Select
                value={formData.default_league_id || "none"}
                onValueChange={(val) => setFormData({ ...formData, default_league_id: val === "none" ? "" : val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select default league..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {assignedLeagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name} ({league.season})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

  // User List
  return (
    <>
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <p className="text-sm text-slate-600 mt-2">
              Add, edit, or delete users and manage their permissions
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <button
                  onClick={() => handleUserSelect(user)}
                  className="flex-1 text-left"
                >
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
                </button>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUserSelect(user)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(user)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-slate-500 text-center py-8">No users found</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}