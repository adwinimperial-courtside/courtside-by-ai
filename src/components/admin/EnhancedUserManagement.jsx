import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { ArrowLeft, UserPlus, Pencil, Trash2, Search, Shield, Trophy, Eye, Mail, MailCheck } from "lucide-react";
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
  const [sendingEmailTo, setSendingEmailTo] = useState(null);
  const [emailSentTo, setEmailSentTo] = useState(new Set());
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

  const { data: userLeagueIdentities = [] } = useQuery({
    queryKey: ["userLeagueIdentities"],
    queryFn: () => base44.entities.UserLeagueIdentity.list(),
  });

  const { data: userApplications = [] } = useQuery({
    queryKey: ["allUserApplications"],
    queryFn: () => base44.entities.UserApplication.list(),
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
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="player">Player</SelectItem>
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
                <SelectItem value="coach">Coach</SelectItem>
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

  const userTypeIcon = (type) => {
    if (type === "app_admin") return <Shield className="w-3 h-3" />;
    if (type === "league_admin") return <Trophy className="w-3 h-3" />;
    if (type === "viewer") return <Eye className="w-3 h-3" />;
    return null;
  };

  const userTypeBadgeColor = (type) => {
    if (type === "app_admin") return "bg-purple-100 text-purple-800";
    if (type === "league_admin") return "bg-orange-100 text-orange-800";
    if (type === "player") return "bg-green-100 text-green-800";
    if (type === "viewer") return "bg-slate-100 text-slate-700";
    return "bg-slate-100 text-slate-700";
  };

  const filteredUsers = users
    .filter(u =>
      !searchQuery ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  // User List
  return (
    <>
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <p className="text-sm text-slate-600 mt-1">{users.length} user{users.length !== 1 ? "s" : ""} total</p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            {filteredUsers.map((user) => {
              // Get approved applications for this user — each may have a different role + league(s)
              const approvedApps = userApplications.filter(
                a => a.user_id === user.id && a.status === "Approved"
              );

              // Build a map of leagueId -> role from approved applications
              const leagueRoleMap = {};
              approvedApps.forEach(app => {
                const leagueIds = app.league_ids?.length > 0
                  ? app.league_ids
                  : app.league_id ? [app.league_id] : [];
                leagueIds.forEach(lid => {
                  leagueRoleMap[lid] = app.requested_role;
                });
              });

              // Build per-league role entries
              const assignedLeagueIds = user.assigned_league_ids || [];
              const leagueRoleEntries = assignedLeagueIds.map(id => ({
                league: leagues.find(l => l.id === id),
                role: leagueRoleMap[id] || user.user_type,
              })).filter(e => e.league);

              return (<div
                  key={user.id}
                  className="flex items-start justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors gap-3"
                >
                  <button onClick={() => handleUserSelect(user)} className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{user.full_name || "—"}</div>
                    <div className="text-sm text-slate-500 truncate">{user.email}</div>
                    <div className="text-xs text-slate-400 mt-1">Created {format(new Date(user.created_date), "MMM dd, yyyy 'at' h:mm a")}</div>

                    {/* Global role badge for app_admin / league_admin */}
                    {(user.user_type === "app_admin" || user.user_type === "league_admin") && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${userTypeBadgeColor(user.user_type)}`}>
                          {userTypeIcon(user.user_type)}
                          {user.user_type}
                        </span>
                      </div>
                    )}

                    {/* Per-league role badges for players/coaches/viewers */}
                    {user.user_type !== "app_admin" && user.user_type !== "league_admin" && (
                      <div className="flex flex-col gap-1 mt-2">
                        {leagueRoleEntries.length > 0 ? leagueRoleEntries.map((entry, i) => (
                          <div key={i} className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${userTypeBadgeColor(entry.role)}`}>
                              {entry.role || "viewer"}
                            </span>
                            <span className="text-xs text-slate-500">@</span>
                            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                              {entry.league.name}
                              {entry.league.season ? ` (${entry.league.season})` : ""}
                            </span>
                          </div>
                        )) : (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit ${userTypeBadgeColor(user.user_type)}`}>
                            {user.user_type || "viewer"} · no league assigned
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Send access approval email"
                      disabled={sendingEmailTo === user.id}
                      onClick={async () => {
                        setSendingEmailTo(user.id);
                        try {
                          await base44.functions.invoke('sendAccessApprovedEmail', { application: { user_email: user.email, user_name: user.full_name } });
                          setEmailSentTo(prev => new Set([...prev, user.id]));
                          alert(`Email sent to ${user.email}`);
                        } catch (e) {
                          alert('Failed to send email: ' + e.message);
                        } finally {
                          setSendingEmailTo(null);
                        }
                      }}
                      className={emailSentTo.has(user.id) ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                    >
                      {emailSentTo.has(user.id) ? <MailCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </Button>
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
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {filteredUsers.length === 0 && (
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