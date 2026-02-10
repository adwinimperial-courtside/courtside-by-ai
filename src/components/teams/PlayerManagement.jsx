import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PlayerManagement({ teamId, team }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [formData, setFormData] = useState({ name: "", jersey_number: "", position: "PG" });
  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
  });

  const createPlayerMutation = useMutation({
    mutationFn: (playerData) => base44.entities.Player.create({
      ...playerData,
      team_id: teamId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      setShowAddDialog(false);
      setFormData({ name: "", jersey_number: "", position: "PG" });
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      setEditingPlayer(null);
      setFormData({ name: "", jersey_number: "", position: "PG" });
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: (playerId) => base44.entities.Player.delete(playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setPlayerToDelete(null);
    },
  });

  const setAsCaptainMutation = useMutation({
    mutationFn: (playerId) => base44.entities.Team.update(teamId, { team_captain: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const handleAddClick = () => {
    setEditingPlayer(null);
    setFormData({ name: "", jersey_number: "", position: "PG" });
    setShowAddDialog(true);
  };

  const handleEditClick = (player) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      jersey_number: player.jersey_number,
      position: player.position
    });
    setShowAddDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingPlayer) {
      updatePlayerMutation.mutate({
        id: editingPlayer.id,
        data: formData
      });
    } else {
      createPlayerMutation.mutate(formData);
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingPlayer(null);
    setFormData({ name: "", jersey_number: "", position: "PG" });
  };

  const isCaptain = (playerId) => team?.team_captain === playerId;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Players</CardTitle>
            <Button
              onClick={handleAddClick}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-slate-400">Loading players...</div>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">No players added yet</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table className="text-sm">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-slate-900">Name</TableHead>
                    <TableHead className="w-20 text-slate-900">#</TableHead>
                    <TableHead className="w-24 text-slate-900">Position</TableHead>
                    <TableHead className="w-24 text-slate-900">Captain</TableHead>
                    <TableHead className="w-20 text-slate-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow key={player.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900">{player.name}</TableCell>
                      <TableCell className="text-slate-600">{player.jersey_number}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {player.position}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isCaptain(player.id) ? (
                          <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                            <Crown className="w-3 h-3" />
                            Captain
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAsCaptainMutation.mutate(player.id)}
                            className="text-xs text-slate-500 hover:text-amber-600"
                            disabled={setAsCaptainMutation.isPending}
                          >
                            Set Captain
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(player)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPlayerToDelete(player)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlayer ? "Edit Player" : "Add New Player"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Player Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., LeBron James"
                required
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="jersey">Jersey Number</Label>
                <Input
                  id="jersey"
                  type="number"
                  value={formData.jersey_number}
                  onChange={(e) => setFormData({ ...formData, jersey_number: parseInt(e.target.value) || "" })}
                  placeholder="e.g., 23"
                  required
                  className="mt-1.5"
                  min="0"
                  max="99"
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PG">PG</SelectItem>
                    <SelectItem value="SG">SG</SelectItem>
                    <SelectItem value="SF">SF</SelectItem>
                    <SelectItem value="PF">PF</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={createPlayerMutation.isPending || updatePlayerMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPlayerMutation.isPending || updatePlayerMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {createPlayerMutation.isPending || updatePlayerMutation.isPending
                  ? "Saving..."
                  : editingPlayer
                  ? "Update Player"
                  : "Add Player"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Player</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{playerToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel disabled={deletePlayerMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePlayerMutation.mutate(playerToDelete.id)}
              disabled={deletePlayerMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletePlayerMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}