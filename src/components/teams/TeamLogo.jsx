import React from "react";

export default function TeamLogo({ team, size = "md" }) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16"
  };

  if (team?.logo_url) {
    return (
      <img 
        src={team.logo_url} 
        alt={`${team.name} logo`}
        className={`${sizeClasses[size]} rounded-lg object-cover`}
      />
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center text-white font-bold ${
        size === 'sm' ? 'text-xs' : size === 'md' ? 'text-base' : 'text-xl'
      }`}
      style={{ backgroundColor: team?.color || '#f97316' }}
    >
      {team?.name?.[0]}
    </div>
  );
}