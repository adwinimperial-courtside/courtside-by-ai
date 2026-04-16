import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Zap } from "lucide-react";

export default function EndOfPeriodModal({
  open,
  game,
  periodType,
  totalPeriods,
  onStartNextPeriod,
  onStartOvertime,
  onEndGame,
  onCancel,
}) {
  if (!game) return null;

  const period = game.clock_period ?? 1;
  const homeScore = game.home_score || 0;
  const awayScore = game.away_score || 0;
  const isFinalRegulation = period === totalPeriods;
  const isTied = homeScore === awayScore;

  const getPeriodLabel = () => {
    if (periodType === "halves") {
      return period === 1 ? "Half 1" : "Half 2";
    }
    return `Quarter ${period}`;
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) onCancel();
    }}>
      <DialogContent className="bg-white border-slate-200 w-[95vw] max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {isFinalRegulation && isTied ? "Regulation Complete" : `End of ${getPeriodLabel()}`}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {isFinalRegulation && isTied && (
            <p className="text-slate-600 text-base">
              Scores are tied <span className="font-bold">{homeScore} – {awayScore}</span>
            </p>
          )}
          
          {isFinalRegulation && !isTied && (
            <p className="text-slate-600 text-base">
              Game Final: <span className="font-bold">{homeScore} – {awayScore}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {!isFinalRegulation && (
            <>
              <Button
                onClick={onStartNextPeriod}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold h-11"
              >
                Start Next Period
              </Button>
              <Button
                onClick={onCancel}
                className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-semibold h-11"
              >
                Cancel
              </Button>
            </>
          )}

          {isFinalRegulation && isTied && (
            <>
              <Button
                onClick={onStartOvertime}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold h-11"
              >
                <Zap className="w-4 h-4 mr-2" />
                Start Overtime
              </Button>
              <Button
                onClick={onCancel}
                className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-semibold h-11"
              >
                Cancel
              </Button>
            </>
          )}

          {isFinalRegulation && !isTied && (
            <Button
              onClick={onEndGame}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold h-11"
            >
              Confirm End Game
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}