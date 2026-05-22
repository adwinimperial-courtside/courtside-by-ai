import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

export default function UpdateNameModal({ user, onComplete }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim().length >= 3 && name.trim().includes(" ");

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Please enter your first and last name");
      return;
    }
    setSaving(true);
    setError("");
    await base44.entities.User.update(user.id, { full_name: name.trim() });
    setSaving(false);
    onComplete();
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Welcome to Courtside by AI! 👋
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-2">
          Before you get started, please tell us your name so other members can recognise you.
        </p>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Your full name
            </label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Juan dela Cruz"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}