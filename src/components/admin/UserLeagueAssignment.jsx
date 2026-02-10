import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UserLeagueAssignment() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedLeagues, setSelectedLeagues] = useState([]);
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
      base44.entities.User.update(selectedUserId, {
        assigned_league_ids: selectedLeagues,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      alert("User leagues updated successfully!");
      setSelectedLeagues([]);
      setSelectedUserId("");
    },
  });

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    const user = users.find((u) => u.id === userId);
    setSelectedLeagues(user?.assigned_league_ids || []);
  };

  const toggleLeague = (leagueId) => {
    setSelectedLeagues((prev) =>
      prev.includes(leagueId)
        ? prev.filter((id) => id !== leagueId)
        : [...prev, leagueId]
    );
  };

  const handleSubmit = () => {
    if (!selectedUserId) {
      alert("Please select a user");
      return;
    }
    updateUserMutation.mutate();
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <CardTitle className="text-xl">Assign Leagues to Users</CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          Select a user and assign them to one or more leagues
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* User Selection */}
        <div>
          <Label className="text-sm font-semibold text-slate-700 mb-2 block">
            Select User
          </Label>
          <Select value={selectedUserId} onValueChange={handleUserSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a user..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* League Selection */}
        {selectedUserId && (
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">
              Assign Leagues
            </Label>
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {leagues.map((league) => (
                <div key={league.id} className="flex items-center gap-3">
                  <Checkbox
                    id={league.id}
                    checked={selectedLeagues.includes(league.id)}
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
        )}

        {/* Submit Button */}
        {selectedUserId && (
          <Button
            onClick={handleSubmit}
            disabled={updateUserMutation.isPending}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {updateUserMutation.isPending ? "Updating..." : "Save Leagues"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}