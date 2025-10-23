import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function StatButtons({ statTypes, selectedPlayer, onStatClick }) {
  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
      <h3 className="text-white font-bold text-lg mb-4">
        {selectedPlayer ? `Record Stats for #${selectedPlayer.jersey_number}` : 'Select a Player'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {statTypes.map((stat) => (
          <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.95 : 1 }}>
            <Button
              onClick={() => onStatClick(stat)}
              disabled={!selectedPlayer}
              className={`w-full h-20 text-white font-bold text-lg ${stat.color} hover:opacity-90 disabled:opacity-30`}
            >
              {stat.label}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}