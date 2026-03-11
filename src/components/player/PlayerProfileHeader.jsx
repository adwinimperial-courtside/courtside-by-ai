import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Upload, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PlayerProfileHeader({ currentUser, team, playerRecord, onPhotoUpdate }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const displayName = currentUser?.display_name || currentUser?.full_name || "Player";
  const handle = currentUser?.handle;
  const photoUrl = currentUser?.profile_photo_url;
  const initials = displayName.charAt(0).toUpperCase();

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Photo must be less than 5MB");
      return;
    }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ profile_photo_url: file_url });
    setUploading(false);
    onPhotoUpdate?.();
    e.target.value = "";
  };

  const handleRemovePhoto = async () => {
    await base44.auth.updateMe({ profile_photo_url: null });
    onPhotoUpdate?.();
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex-shrink-0 group cursor-pointer">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-orange-100 border-2 border-orange-200 flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  ) : photoUrl ? (
                    <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl md:text-3xl font-bold text-orange-600">{initials}</span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </DropdownMenuItem>
              {photoUrl && (
                <DropdownMenuItem onClick={handleRemovePhoto} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Photo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{displayName}</h2>
            {handle && <p className="text-sm text-slate-500 mt-0.5">@{handle}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {team && (
                <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">
                  {team.name}
                </Badge>
              )}
              {playerRecord?.jersey_number !== undefined && (
                <Badge variant="outline" className="border-slate-200 text-slate-700">
                  #{playerRecord.jersey_number}
                </Badge>
              )}
              {playerRecord?.position && (
                <Badge variant="outline" className="border-slate-200 text-slate-700">
                  {playerRecord.position}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}