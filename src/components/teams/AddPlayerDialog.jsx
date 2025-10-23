import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddPlayerDialog({ open, onOpenChange, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    name: "",
    jersey_number: "",
    position: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      jersey_number: parseInt(formData.jersey_number)
    });
    setFormData({ name: "", jersey_number: "", position: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Add New Player</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="playerName">Player Name</Label>
            <Input
              id="playerName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., John Smith"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="jersey">Jersey Number</Label>
            <Input
              id="jersey"
              type="number"
              min="0"
              max="99"
              value={formData.jersey_number}
              onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
              placeholder="e.g., 23"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="position">Position</Label>
            <Select
              value={formData.position}
              onValueChange={(value) => setFormData({ ...formData, position: value })}
              required
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PG">Point Guard (PG)</SelectItem>
                <SelectItem value="SG">Shooting Guard (SG)</SelectItem>
                <SelectItem value="SF">Small Forward (SF)</SelectItem>
                <SelectItem value="PF">Power Forward (PF)</SelectItem>
                <SelectItem value="C">Center (C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isLoading ? "Adding..." : "Add Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}