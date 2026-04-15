import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * CreateLeagueDialog
 *
 * NOTE: League creation requires a Supabase Edge Function because the `leagues`
 * table has no direct INSERT policy for client users — inserts must go through
 * the service role. This dialog is a placeholder until that Edge Function is built.
 *
 * TODO: Wire up to POST /functions/v1/create-league once Edge Function exists.
 */
export default function CreateLeagueDialog({ open, onOpenChange }) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {t("leagues.createLeague", "Create League")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">
              {t("leagues.createComingSoon", "Coming Soon")}
            </p>
            <p className="text-sm text-slate-500 max-w-xs">
              {t(
                "leagues.createDescription",
                "League creation requires a server-side function that hasn't been built yet. This will be available in a future phase."
              )}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
