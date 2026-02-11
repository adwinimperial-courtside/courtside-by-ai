import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Key, Palette } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UserManagement from "../components/admin/UserManagement";
import PendingUserManagement from "../components/admin/PendingUserManagement";
import ManageRequests from "../components/admin/ManageRequests";

export default function OwnerTools() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isGeneratingLogos, setIsGeneratingLogos] = useState(false);
  const [logoProgress, setLogoProgress] = useState({ current: 0, total: 0, teamName: '' });
  const queryClient = useQueryClient();

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, []);

  const generateTeamLogos = async () => {
    if (!confirm('This will generate AI logos for teams in Pinoy Basketball Open League Finland. This may take several minutes. Continue?')) {
      return;
    }

    setIsGeneratingLogos(true);
    try {
      const league = leagues.find(l => l.name === 'Pinoy Basketball Open League Finland');
      if (!league) {
        alert('League not found');
        return;
      }

      const leagueTeams = teams.filter(t => t.league_id === league.id);
      setLogoProgress({ current: 0, total: leagueTeams.length, teamName: '' });

      const teamLogoPrompts = {
        'Espoo Eagles': 'Modern basketball team logo for "Espoo Eagles" - featuring a majestic eagle with spread wings holding a basketball, use orange and white colors, professional sports team design, shield emblem style',
        'Oulu Outlaws': 'Modern basketball team logo for "Oulu Outlaws" - featuring a cowboy or outlaw silhouette with a basketball, use green and black colors, professional sports team design, badge style',
        'Kuopio Knights': 'Modern basketball team logo for "Kuopio Knights" - featuring a medieval knight helmet with a basketball, use purple and silver colors, professional sports team design, shield emblem style',
        'Pori Phoenix': 'Modern basketball team logo for "Pori Phoenix" - featuring a rising phoenix bird with flames and a basketball, use orange and red colors, professional sports team design, circular emblem style',
        'Helsinki Hawks': 'Modern basketball team logo for "Helsinki Hawks" - featuring an aggressive hawk head with a basketball, use blue and white colors, professional sports team design, modern badge style',
        'Tampere Thunder': 'Modern basketball team logo for "Tampere Thunder" - featuring lightning bolt striking a basketball, use red and yellow colors, professional sports team design, dynamic shield style',
        'Vantaa Vikings': 'Modern basketball team logo for "Vantaa Vikings" - featuring a viking helmet with horns and a basketball, use purple and gold colors, professional sports team design, shield emblem style',
        'Turku Titans': 'Modern basketball team logo for "Turku Titans" - featuring a titan or giant figure with a basketball, use yellow and black colors, professional sports team design, powerful badge style',
        'Jyväskylä Jets': 'Modern basketball team logo for "Jyväskylä Jets" - featuring a jet plane with a basketball trail, use cyan and white colors, professional sports team design, sleek modern emblem',
        'Lahti Lions': 'Modern basketball team logo for "Lahti Lions" - featuring a roaring lion head with a basketball, use pink and red colors, professional sports team design, fierce shield style'
      };

      for (let i = 0; i < leagueTeams.length; i++) {
        const team = leagueTeams[i];
        setLogoProgress({ current: i + 1, total: leagueTeams.length, teamName: team.name });

        const prompt = teamLogoPrompts[team.name] || `Modern professional basketball team logo for "${team.name}", dynamic design with basketball elements, team colors, shield or badge style`;

        try {
          const result = await base44.integrations.Core.GenerateImage({ prompt });
          await base44.entities.Team.update(team.id, { logo_url: result.url });
        } catch (error) {
          console.error(`Failed to generate logo for ${team.name}:`, error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['teams'] });
      alert('Successfully generated logos for all teams!');
    } catch (error) {
      alert('Error generating logos: ' + error.message);
    } finally {
      setIsGeneratingLogos(false);
      setLogoProgress({ current: 0, total: 0, teamName: '' });
    }
  };

  // Only app_admin can access this page
  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600">You don't have permission to access Owner Tools.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-orange-600" />
              Owner Tools
            </h1>
            <p className="text-slate-600 mt-2">Manage app ownership and user assignments</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Manage Requests */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">League Setup Requests</h2>
            <p className="text-slate-600 mb-4">View and manage incoming requests from the landing page</p>
            <ManageRequests />
          </div>

          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Palette className="w-5 h-5 text-pink-600" />
                Generate Team Logos
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Generate AI-powered logos for all teams in Pinoy Basketball Open League Finland
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <Button
                onClick={generateTeamLogos}
                disabled={isGeneratingLogos}
                className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
              >
                <Palette className={`w-4 h-4 mr-2 ${isGeneratingLogos ? 'animate-spin' : ''}`} />
                {isGeneratingLogos ? `Generating... (${logoProgress.current}/${logoProgress.total}) ${logoProgress.teamName}` : 'Generate All Team Logos'}
              </Button>
            </CardContent>
          </Card>

          {/* Pending User Management */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Pending User Assignments</h2>
            <p className="text-slate-600 mb-4">Pre-configure settings for users before they log in for the first time</p>
            <PendingUserManagement />
          </div>

          {/* User Management */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Existing Users</h2>
            <UserManagement />
          </div>
        </div>
      </div>
    </div>
  );
}