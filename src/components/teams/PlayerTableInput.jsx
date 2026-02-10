import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PlayerTableInput({ players, onChange }) {
  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };
    onChange(newPlayers);
  };

  const handleAddRow = () => {
    onChange([
      ...players,
      { name: "", jersey_number: "", position: "PG" }
    ]);
  };

  const handleDeleteRow = (index) => {
    onChange(players.filter((_, i) => i !== index));
  };

  const validPlayers = players.filter(p => p.name && p.jersey_number);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {validPlayers.length} player{validPlayers.length !== 1 ? 's' : ''} added
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddRow}
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </Button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <Table className="text-sm">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-1/2 text-slate-900">Player Name</TableHead>
              <TableHead className="w-20 text-slate-900">Number</TableHead>
              <TableHead className="w-24 text-slate-900">Position</TableHead>
              <TableHead className="w-10 text-slate-900"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player, index) => (
              <TableRow key={index} className="hover:bg-slate-50">
                <TableCell className="p-2">
                  <Input
                    value={player.name}
                    onChange={(e) => handlePlayerChange(index, "name", e.target.value)}
                    placeholder="Player name"
                    className="h-8"
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    value={player.jersey_number}
                    onChange={(e) => handlePlayerChange(index, "jersey_number", parseInt(e.target.value) || "")}
                    placeholder="0"
                    className="h-8"
                    min="0"
                    max="99"
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Select
                    value={player.position}
                    onValueChange={(value) => handlePlayerChange(index, "position", value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
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
                <TableCell className="p-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRow(index)}
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}