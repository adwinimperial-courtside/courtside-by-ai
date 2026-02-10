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
import { Plus, Edit2, Trash2, Crown, Upload } from "lucide-react";
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

export default function PlayerManagement({ teamId, team, userType }) {
  const isViewer = userType === "viewer";
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [tableData, setTableData] = useState(
    Array(12).fill(null).map(() => ({ id: null, name: "", jersey_number: "", position: "PG" }))
  );
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
  });

  React.useEffect(() => {
    const initialData = players.map(p => ({ ...p }));
    while (initialData.length < 12) {
      initialData.push({ id: null, name: "", jersey_number: "", position: "PG" });
    }
    setTableData(initialData);
  }, [players.length]);

  const handleSaveAllPlayers = async () => {
    setIsSaving(true);
    try {
      for (const row of tableData) {
        if (row.name && row.jersey_number !== '') {
          if (row.id) {
            await base44.entities.Player.update(row.id, {
              name: row.name,
              jersey_number: parseInt(row.jersey_number),
              position: row.position
            });
          } else {
            await base44.entities.Player.create({
              name: row.name,
              jersey_number: parseInt(row.jersey_number),
              position: row.position,
              team_id: teamId
            });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (error) {
      console.error("Error saving players:", error);
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

  const setAsCaptainMutation = useMutation({
    mutationFn: (playerId) => base44.entities.Team.update(teamId, { team_captain: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
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

  const isCaptain = (playerId) => team?.team_captain === playerId;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Players</CardTitle>
            {!isViewer && (
              <Button
                onClick={handleSaveAllPlayers}
                disabled={isSaving || isLoading}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-slate-400">Loading players...</div>
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
                  {tableData.map((row, index) => (
                    <TableRow key={index} className="hover:bg-slate-50">
                      <TableCell>
                        <Input
                          value={row.name}
                          onChange={(e) => handleRowChange(index, 'name', e.target.value)}
                          placeholder="Player name"
                          className="border-0 p-1 h-8"
                          disabled={isSaving}
                        />
                      </TableCell>
                      <TableCell>
                         <Input
                           type="text"
                           inputMode="numeric"
                           value={row.jersey_number}
                           onChange={(e) => {
                             const val = e.target.value;
                             if (val === '' || /^\d{0,2}$/.test(val)) {
                               handleRowChange(index, 'jersey_number', val);
                             }
                           }}
                           placeholder="#"
                           className="border-0 p-1 h-8"
                           disabled={isSaving}
                         />
                       </TableCell>
                      <TableCell>
                        <Select
                          value={row.position}
                          onValueChange={(value) => handleRowChange(index, 'position', value)}
                          disabled={isSaving}
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
                        {row.id && (
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRow(index)}
                          className="h-8 w-8 p-0"
                          disabled={isSaving}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!isLoading && (
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
            </div>
          )}
        </CardContent>
      </Card>



      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Player</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{playerToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}