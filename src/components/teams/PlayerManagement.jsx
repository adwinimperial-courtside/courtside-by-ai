import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Crown, Upload, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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
import PhotoCropDialog, { fetchPhotoAsFile } from "@/components/shared/PhotoCropDialog"; // PHOTO_CROP_V1
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // PHOTO_CROP_V1
import { Crop } from "lucide-react"; // PHOTO_CROP_V1

export default function PlayerManagement({ teamId, team, userType }) {
   const isViewer = userType === "viewer";
   const canManage = userType === 'app_admin' || userType === 'league_admin';
   const { toast } = useToast();
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [tableData, setTableData] = useState(
    Array(12).fill(null).map(() => ({ id: null, name: "", jersey_number: "", position: "PG" }))
  );
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  // PLAYER_PHOTO_V1 — per-row photo upload state
  const [photoUploadingIndex, setPhotoUploadingIndex] = useState(null);
  const photoInputRef = useRef(null);
  const photoTargetIndexRef = useRef(null);
  // PHOTO_CROP_V1 — picked file waiting in the crop dialog, with its target row
  const [pendingCrop, setPendingCrop] = useState(null);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
  });

  const { data: currentTeam } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const teams = await base44.entities.Team.filter({ id: teamId });
      return teams[0];
    },
    initialData: team,
  });

  React.useEffect(() => {
    const initialData = players.map(p => ({ ...p }));
    while (initialData.length < 12) {
      initialData.push({ id: null, name: "", jersey_number: "", position: "PG" });
    }
    setTableData(initialData);
  }, [players.length]);

  // JERSEY_DEDUPE_V1 — jersey numbers must be unique within a team.
  // Find numbers used by 2+ rows; blank/empty rows are ignored.
  const duplicateJerseys = React.useMemo(() => {
    const counts = {};
    tableData.forEach(row => {
      const jn = String(row.jersey_number ?? '').trim();
      if (jn === '') return;
      const n = parseInt(jn, 10);
      if (isNaN(n)) return;
      counts[n] = (counts[n] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1).map(Number));
  }, [tableData]);

  const hasDuplicates = duplicateJerseys.size > 0;
  const duplicateList = [...duplicateJerseys].sort((a, b) => a - b).map(n => `#${n}`).join(', ');
  const isDuplicateRow = (row) => {
    const jn = String(row.jersey_number ?? '').trim();
    if (jn === '') return false;
    const n = parseInt(jn, 10);
    return !isNaN(n) && duplicateJerseys.has(n);
  };

  const handleSaveAllPlayers = async () => {
    // JERSEY_DEDUPE_V1 — never save a roster with duplicate numbers
    if (hasDuplicates) {
      toast({ title: "Duplicate jersey numbers", description: "Two players share the same number. Make each number unique, then save.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let savedCount = 0;
      for (const row of tableData) {
        const name = (row.name || '').trim();
        const jerseyNum = String(row.jersey_number || '').trim();
        const parsedJersey = parseInt(jerseyNum);
        if (name && jerseyNum !== '' && !isNaN(parsedJersey)) {
          if (row.id) {
            await base44.entities.Player.update(row.id, {
              name,
              jersey_number: parsedJersey,
              position: row.position || 'PG'
            });
          } else {
            await base44.entities.Player.create({
              name,
              jersey_number: parsedJersey,
              position: row.position || 'PG',
              team_id: teamId
            });
          }
          savedCount++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: "Saved", description: `${savedCount} player${savedCount !== 1 ? 's' : ''} saved successfully.` });
    } catch (error) {
      console.error("Error saving players:", error);
      toast({ title: "Error", description: "Failed to save players. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlayerMutation = useMutation({
    mutationFn: (playerId) => base44.entities.Player.delete(playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setPlayerToDelete(null);
    },
  });

  // DELETE_STATS_WARNING_V1 — when a delete is requested, check whether the player has recorded game stats
  const { data: deleteStatsRows = [], isLoading: checkingDeleteStats } = useQuery({
    queryKey: ['playerDeleteStats', playerToDelete?.id],
    queryFn: () => base44.entities.PlayerStats.filter({ player_id: playerToDelete.id }),
    enabled: !!playerToDelete?.id,
  });
  const deleteGamesCount = React.useMemo(() => {
    const gameIds = new Set();
    for (const row of deleteStatsRows) {
      if (row && row.game_id) gameIds.add(row.game_id);
    }
    return gameIds.size;
  }, [deleteStatsRows]);

  const setAsCaptainMutation = useMutation({
    mutationFn: (playerId) => base44.entities.Team.update(teamId, { team_captain: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
    },
  });

  const handleRowChange = (index, field, value) => {
    const newData = [...tableData];
    newData[index] = { ...newData[index], [field]: value };
    setTableData(newData);
  };

  const handleDeleteRow = (index) => {
    const row = tableData[index];
    if (row.id) {
      setPlayerToDelete(row);
    } else {
      const newData = tableData.filter((_, i) => i !== index);
      setTableData(newData);
    }
  };

  const handleAddRow = () => {
    setTableData([...tableData, { id: null, name: "", jersey_number: "", position: "PG" }]);
  };

  // PLAYER_PHOTO_V1 — open the photo picker for a specific saved player row
  const openPhotoPicker = (index) => {
    photoTargetIndexRef.current = index;
    photoInputRef.current?.click();
  };

  // PHOTO_CROP_V1 — picked photo opens the crop dialog instead of uploading directly
  const handlePhotoSelected = (e) => {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    const index = photoTargetIndexRef.current;
    photoTargetIndexRef.current = null;
    if (!file || index === null || index === undefined) return;
    const row = tableData[index];
    if (!row?.id) {
      toast({ title: "Save the player first", description: "Add the name and jersey number, press Save All, then upload the photo.", variant: "destructive" });
      return;
    }
    setPendingCrop({ file, index });
  };

  // PHOTO_CROP_V1 — upload the cropped headshot and save it to the player record
  const handleCropSave = async (croppedFile) => {
    const pending = pendingCrop;
    setPendingCrop(null);
    if (!pending) return;
    const { index } = pending;
    const row = tableData[index];
    if (!row?.id) return;
    setPhotoUploadingIndex(index);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: croppedFile });
      await base44.entities.Player.update(row.id, { photo_url: file_url });
      handleRowChange(index, 'photo_url', file_url);
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      toast({ title: "Photo saved", description: `${row.name || 'Player'}'s photo has been updated.` });
    } catch (error) {
      console.error("Error uploading player photo:", error);
      toast({ title: "Upload failed", description: "Could not upload the photo. Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploadingIndex(null);
    }
  };

  // PHOTO_CROP_V1 — re-crop a player's existing photo without re-uploading
  const handleEditPhoto = async (index) => {
    const row = tableData[index];
    if (!row?.id || !row.photo_url) return;
    setPhotoUploadingIndex(index);
    try {
      const file = await fetchPhotoAsFile(row.photo_url);
      setPendingCrop({ file, index });
    } catch (error) {
      console.error("Error loading photo for editing:", error);
      toast({ title: "Could not load photo", description: "The current photo could not be opened for editing. Upload a new photo instead.", variant: "destructive" });
    } finally {
      setPhotoUploadingIndex(null);
    }
  };

  // PLAYER_PHOTO_V1 — remove a player's photo
  const handleRemovePhoto = async (index) => {
    const row = tableData[index];
    if (!row?.id) return;
    setPhotoUploadingIndex(index);
    try {
      await base44.entities.Player.update(row.id, { photo_url: null });
      handleRowChange(index, 'photo_url', null);
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      toast({ title: "Photo removed", description: `${row.name || 'Player'} will show the jersey number again.` });
    } catch (error) {
      console.error("Error removing player photo:", error);
      toast({ title: "Error", description: "Could not remove the photo. Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploadingIndex(null);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      // Parse CSV/XLSX-exported-as-CSV format
      const headers = lines[0].split(',').map(h => h.trim());
      const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
      const numberIndex = headers.findIndex(h => h.toLowerCase().includes('number'));
      
      if (nameIndex === -1 || numberIndex === -1) {
        alert('File must contain "Name" and "Number" columns');
        return;
      }

      const mappedRows = lines.slice(1)
        .map(line => {
          const cols = line.split(',').map(c => c.trim());
          const num = parseInt(cols[numberIndex]);
          return {
            id: null,
            name: cols[nameIndex] || "",
            jersey_number: !isNaN(num) ? num : "",
            position: "PG"
          };
        })
        .filter(row => row.name && row.jersey_number !== "");

      // Remove empty rows and duplicates, keeping existing rows with captain flag
      let filteredData = tableData.filter(row => row.name && row.jersey_number);
      
      // Only add imported rows that don't already exist
      mappedRows.forEach(newRow => {
        const isDuplicate = filteredData.some(
          row => row.name === newRow.name && row.jersey_number === newRow.jersey_number
        );
        if (!isDuplicate) {
          filteredData.push(newRow);
        }
      });

      setTableData(filteredData);
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error reading file. Please ensure it's a valid CSV file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isCaptain = (playerId) => currentTeam?.team_captain === playerId;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Players</CardTitle>
            {canManage && (
              <Button
                onClick={handleSaveAllPlayers}
                disabled={isSaving || isLoading || hasDuplicates}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!isLoading && hasDuplicates && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-700 leading-snug">
                Duplicate jersey number{duplicateJerseys.size > 1 ? 's' : ''}: {duplicateList}. Each number must be unique within the team before you can save.
              </span>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-slate-400">Loading players...</div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table className="text-sm">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-16 text-slate-900">Photo</TableHead>
                    <TableHead className="text-slate-900">Name</TableHead>
                    <TableHead className="w-20 text-slate-900">#</TableHead>
                    <TableHead className="w-24 text-slate-900">Position</TableHead>
                    <TableHead className="w-24 text-slate-900">Captain</TableHead>
                    <TableHead className="w-20 text-slate-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={index} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="relative w-10 h-10">
                          {photoUploadingIndex === index ? (
                            <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            </div>
                          ) : row.photo_url ? (
                            /* PHOTO_CROP_V1 — photo menu: upload new / edit crop / remove */
                            canManage ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    title="Photo options"
                                    className="block w-10 h-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-orange-500"
                                  >
                                    <img src={row.photo_url} alt={row.name || "Player"} className="w-10 h-10 rounded-full object-cover" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => openPhotoPicker(index)}>
                                    <Upload className="w-4 h-4 mr-2" /> Upload New Photo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditPhoto(index)}>
                                    <Crop className="w-4 h-4 mr-2" /> Edit Crop
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRemovePhoto(index)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" /> Remove Photo
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <img src={row.photo_url} alt={row.name || "Player"} className="w-10 h-10 rounded-full object-cover" />
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => canManage && row.id && openPhotoPicker(index)}
                              disabled={!canManage || !row.id || isSaving}
                              title={!row.id ? "Save the player first, then add a photo" : "Add photo"}
                              className="relative block w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                            >
                              <span
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: '#F26B1F', display: 'flex' }}
                              >
                                {String(row.jersey_number ?? '').trim() !== '' ? row.jersey_number : <Camera className="w-4 h-4" />}
                              </span>
                              {canManage && row.id && (
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-300 flex items-center justify-center">
                                  <Camera className="w-3 h-3 text-slate-500" />
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.name}
                          onChange={(e) => handleRowChange(index, 'name', e.target.value)}
                          placeholder="Player name"
                          className="border-0 p-1 h-8"
                          disabled={isSaving || !canManage}
                          />
                          </TableCell>
                          <TableCell>
                          <Input
                           type="text"
                           inputMode="numeric"
                           value={row.jersey_number}
                           onChange={(e) => {
                             const val = e.target.value.replace(/[^\d]/g, '').slice(0, 2);
                             handleRowChange(index, 'jersey_number', val);
                           }}
                           placeholder="#"
                           className={`p-1 h-8 ${isDuplicateRow(row) ? 'border-2 border-red-500 bg-red-50 text-red-700 font-semibold' : 'border-0'}`}
                           disabled={isSaving || !canManage}
                         />
                         {isDuplicateRow(row) && (
                           <span className="block text-xs text-red-600 mt-0.5">duplicate</span>
                         )}
                       </TableCell>
                      <TableCell>
                        <Select
                          value={row.position}
                          onValueChange={(value) => handleRowChange(index, 'position', value)}
                          disabled={isSaving || !canManage}
                        >
                          <SelectTrigger className="h-8 border-0 p-1">
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
                      </TableCell>
                      <TableCell>
                        {row.id && canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAsCaptainMutation.mutate(row.id)}
                            className={`text-xs ${isCaptain(row.id) ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:text-amber-600'}`}
                            disabled={isSaving || setAsCaptainMutation.isPending || !row.name}
                          >
                            {isCaptain(row.id) ? <Crown className="w-3 h-3 mr-1" /> : null}
                            {isCaptain(row.id) ? "Captain" : "Set"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRow(index)}
                            className="h-8 w-8 p-0"
                            disabled={isSaving}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!isLoading && canManage && (
            <div className="flex justify-center gap-3 pt-4">
              <Button
                onClick={handleAddRow}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={isSaving || isUploading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add More Rows
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={isSaving || isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? "Uploading..." : "Import CSV/Excel"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelected}
                className="hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>



      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteGamesCount > 0 ? "Delete player with game history?" : "Delete Player"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkingDeleteStats
                ? `Checking ${playerToDelete?.name}'s game history...`
                : deleteGamesCount > 0
                  ? `"${playerToDelete?.name}" has stats recorded in ${deleteGamesCount} ${deleteGamesCount === 1 ? "game" : "games"}. Deleting this player cannot be undone and will affect those games.`
                  : `Are you sure you want to delete "${playerToDelete?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* DELETE_STATS_WARNING_V1 — plain-language effects when the player has stats */}
          {!checkingDeleteStats && deleteGamesCount > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1">
              <p>• Their lines in those box scores will show gaps</p>
              <p>• Team game totals will no longer match the final scores</p>
              <p>• They will disappear from stat leaders and award races</p>
              <p className="pt-1 font-medium">If the player just left the team, keep them on the roster instead — their stats stay intact.</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsSaving(true);
                try {
                  await base44.entities.Player.delete(playerToDelete.id);
                  queryClient.invalidateQueries({ queryKey: ['players', teamId] });
                  queryClient.invalidateQueries({ queryKey: ['teams'] });
                  setPlayerToDelete(null);
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving || checkingDeleteStats}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving ? "Deleting..." : deleteGamesCount > 0 ? "Delete anyway" : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* PHOTO_CROP_V1 — crop dialog for player photo uploads */}
      <PhotoCropDialog
        file={pendingCrop?.file || null}
        onSave={handleCropSave}
        onCancel={() => setPendingCrop(null)}
        showPermissionNote
      />
    </div>
  );
}