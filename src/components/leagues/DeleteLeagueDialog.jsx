import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DeleteLeagueDialog({ open, onOpenChange, league, onConfirm, isLoading }) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const isMatch = confirmText === league?.name;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">Delete League</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This will permanently delete <strong>{league?.name}</strong> and cannot be undone.
              All associated data references may be affected.
            </p>
            <div className="pt-2">
              <Label htmlFor="confirm-name" className="text-slate-700 font-medium">
                Type <span className="font-mono bg-slate-100 px-1 rounded">{league?.name}</span> to confirm:
              </Label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={league?.name}
                className="mt-1.5"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!isMatch || isLoading}
            onClick={() => onConfirm()}
          >
            {isLoading ? "Deleting..." : "Delete League"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}