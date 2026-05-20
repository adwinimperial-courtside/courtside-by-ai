import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Trophy, 
  Brain, 
  Calendar, 
  Users, 
  TrendingUp, 
  Target, 
  Shield, 
  Zap,
  Check,
  Sparkles,
  ArrowRight,
  LogIn,
  User,
  GitBranch,
  Clock,
  RefreshCw
} from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Landing() {
  const [formData, setFormData] = useState({
    leagueName: "",
    contactPerson: "",
    email: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const role = currentUser?.user_type;
  const firstName = currentUser?.full_name?.split(" ")[0] || null;

  const getRoleLabel = () => {
    if (role === "app_admin" || role === "league_admin") return "League organiser";
    if (role === "coach") return "Coach";
    if (role === "player") return "Player";
    if (role === "viewer") return "Viewer";
    return "Member";
  };

  const getStatChip = () => {
    if (role === "app_admin" || role === "league_admin") {
      const count = currentUser?.assigned_league_ids?.length ?? 0;
      return `${count} Active league${count !== 1 ? "s" : ""}`;
    }
    if (role === "coach") return "Coach insights ready";
    if (role === "player") return "Your stats are live";
    return "Follow the action";
  };

  const getTagline = () => {
    if (role === "app_admin" || role === "league_admin") return "Your leagues are live. Stats are tracking.";
    if (role === "coach") return "Study the numbers. Prepare your game plan.";
    if (role === "player") return "Track your progress. Earn your recognition.";
    return "Follow every game. Live stats and standings.";
  };

  const getQuickCards = () => {
    if (role === "app_admin" || role === "league_admin") return [
      { icon: Calendar, color: "#F26B1F", bg: "bg-orange-100", title: "Schedule", subtitle: "View & manage games", href: "/schedule" },
      { icon: Trophy, color: "#D97706", bg: "bg-amber-100", title: "Standings", subtitle: "League standings", href: "/standings" },
      { icon: Users, color: "#3B82F6", bg: "bg-blue-100", title: "League users", subtitle: "Manage members", href: "/leagueusers" },
    ];
    if (role === "coach") return [
      { icon: Target, color: "#9333EA", bg: "bg-purple-100", title: "Coach insights", subtitle: "Analyse matchups", href: "/coachinsights" },
      { icon: Calendar, color: "#F26B1F", bg: "bg-orange-100", title: "Schedule", subtitle: "Upcoming games", href: "/schedule" },
      { icon: BarChart3, color: "#16A34A", bg: "bg-green-100", title: "Statistics", subtitle: "Team & player stats", href: "/statistics" },
    ];
    if (role === "player") return [
      { icon: User, color: "#F26B1F", bg: "bg-orange-100", title: "My profile", subtitle: "Your stats & awards", href: "/playerprofile" },
      { icon: BarChart3, color: "#3B82F6", bg: "bg-blue-100", title: "Statistics", subtitle: "League leaders", href: "/statistics" },
      { icon: Calendar, color: "#16A34A", bg: "bg-green-100", title: "Schedule", subtitle: "Upcoming games", href: "/schedule" },
    ];
    return [
      { icon: Calendar, color: "#F26B1F", bg: "bg-orange-100", title: "Schedule", subtitle: "Upcoming games", href: "/schedule" },
      { icon: Trophy, color: "#D97706", bg: "bg-amber-100", title: "Standings", subtitle: "League standings", href: "/standings" },
      { icon: BarChart3, color: "#3B82F6", bg: "bg-blue-100", title: "Statistics", subtitle: "Player leaders", href: "/statistics" },
    ];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await base44.entities.LeagueSetupRequest.create({
        league_name: formData.leagueName,
        contact_person: formData.contactPerson,
        email: formData.email,
        message: formData.message,
        status: "pending"
      });

      setSubmitSuccess(true);
      setFormData({ leagueName: "", contactPerson: "", email: "", message: "" });
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      console.error("Failed to send request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = () => {
    window.location.href = "/Leagues";
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Dashboard Card */}
      <section className="bg-slate-100 px-4 sm:px-6 pt-6 pb-0">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl p-5 sm:p-8 md:p-10" style={{ backgroundColor: "#0B1F3A" }}>
            {/* Top row: avatar + greeting + stat chip */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full font-black text-white text-lg sm:text-xl flex-shrink-0"
                  style={{ backgroundColor: "#F26B1F", width: 40, height: 40, minWidth: 40 }}
                >
                  {currentUser?.full_name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">{getRoleLabel()}</div>
                  <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
                  </div>
                </div>
              </div>
              <div
                className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 ml-2"
                style={{ backgroundColor: "rgba(242,107,31,0.15)", color: "#F26B1F", border: "1px solid rgba(242,107,31,0.4)" }}
              >
                {getStatChip()}
              </div>
            </div>

            {/* Tagline */}
            <p className="text-sm text-slate-400 mb-6">{getTagline()}</p>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {getQuickCards().map((card, idx) => {
                const Icon = card.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => window.location.href = card.href}
                    className="flex items-center gap-3 sm:flex-col sm:items-start rounded-xl p-3 sm:p-4 text-left transition-all hover:opacity-80 min-h-[44px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <div className={`flex items-center justify-center rounded-lg flex-shrink-0 ${card.bg}`} style={{ width: 36, height: 36, minWidth: 36 }}>
                      <Icon style={{ color: card.color, width: 18, height: 18 }} />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-bold text-white">{card.title}</div>
                      <div className="text-xs text-slate-400">{card.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-slate-50 py-7">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-0 text-center">
            {[
              { number: "500+", label: "Games logged" },
              { number: "20+", label: "Leagues" },
              { number: "186+", label: "Users" },
            ].map((stat, idx) => (
              <div key={idx} className={`flex-1 ${idx > 0 ? "sm:border-l sm:border-slate-200" : ""}`}>
                <div className="text-3xl font-black" style={{ color: "#F26B1F" }}>{stat.number}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New */}
      <section className="bg-slate-100 px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">What's New</div>
          <div className="space-y-3">
            {[
              {
                icon: GitBranch,
                bg: "bg-green-100",
                color: "#16A34A",
                title: "Bracket-based standings",
                desc: "Split your league into groups with separate standings per bracket",
              },
              {
                icon: Clock,
                bg: "bg-blue-100",
                color: "#3B82F6",
                title: "Per-period game rules",
                desc: "Set different time, timeouts, and foul limits per quarter or half",
              },
              {
                icon: RefreshCw,
                bg: "bg-amber-100",
                color: "#D97706",
                title: "Improved substitutions",
                desc: "Faster, more reliable live substitutions during games",
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3 min-h-[56px]"
                >
                  <div className={`flex items-center justify-center rounded-lg flex-shrink-0 ${item.bg}`} style={{ width: 36, height: 36 }}>
                    <Icon style={{ color: item.color, width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#FEF0E7", color: "#F26B1F" }}>
                    New
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What Makes It Different */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-8">
              This Isn't Just Scorekeeping.<br />This Is <span className="text-blue-600">Competitive Intelligence</span>.
            </h2>
            
            <div className="max-w-3xl mx-auto text-lg text-slate-600 space-y-4 mb-12">
              <p>
                Courtside by AI combines full league management, live stat tracking, automated awards, 
                and real performance insights into one system built to elevate competition.
              </p>
              
              <p className="font-semibold text-slate-900">
                When every stat is visible:<br />
                Players push harder. Coaches prepare deeper. Leagues operate at a higher standard.
              </p>
              
              <p className="italic">
                Data creates accountability.<br />
                Accountability creates intensity.<br />
                Intensity raises the level of play.
              </p>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { icon: BarChart3, title: "Live Statistics", color: "blue" },
              { icon: Trophy, title: "Automated Awards", color: "orange" },
              { icon: Brain, title: "Tactical Insights", color: "purple" }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border-2 border-slate-200 hover:border-blue-400 transition-all duration-300 h-full">
                  <CardContent className="p-8 text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-${item.color}-100 to-${item.color}-200 flex items-center justify-center`}>
                      <item.icon className={`w-8 h-8 text-${item.color}-600`} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border-2 border-slate-200 p-4 bg-gradient-to-br from-purple-50 to-blue-50"
          >
            <div className="bg-white rounded-xl h-64 flex items-center justify-center">
              <Brain className="w-24 h-24 text-purple-600" />
            </div>
            <p className="text-center text-sm text-slate-600 mt-4 font-medium">Coach Insights View</p>
          </motion.div>
        </div>
      </section>

      {/* League Management */}
      <section className="py-24 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6">
                Stop Running Your League <span className="text-orange-600">on Paper</span>.
              </h2>
              
              <p className="text-xl text-slate-600 mb-8">
                No scattered sheets.<br />
                No manual calculations.<br />
                No confusion in standings.
              </p>

              <p className="text-lg text-slate-700 mb-8">
                Courtside by AI gives your league a digital backbone.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  "Schedule games",
                  "Manage teams and rosters",
                  "Track results live",
                  "Watch standings update instantly"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-lg font-bold text-slate-900">
                Structured. Clean. Professional.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border-2 border-slate-200 p-4 bg-white shadow-2xl"
            >
              <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-xl h-96 flex items-center justify-center">
                <Calendar className="w-32 h-32 text-blue-600" />
              </div>
              <p className="text-center text-sm text-slate-600 mt-4 font-medium">Schedule + Standings View</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Player & Team Statistics */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border-2 border-slate-200 p-4 bg-white shadow-2xl lg:order-1"
            >
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl h-96 flex items-center justify-center">
                <TrendingUp className="w-32 h-32 text-orange-600" />
              </div>
              <p className="text-center text-sm text-slate-600 mt-4 font-medium">Leaderboard View</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:order-2"
            >
              <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-8">
                Performance Drives <span className="text-blue-600">Competition</span>.
              </h2>

              <div className="space-y-4 mb-8">
                {[
                  "Track points, rebounds, assists, steals, and blocks",
                  "Compare rankings across the league",
                  "Measure real impact with transparent data",
                  "Share stats and compete harder"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Zap className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-lg font-bold text-slate-900">
                When performance is visible — effort increases.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Automated Awards */}
      <section className="py-24 bg-gradient-to-br from-orange-50 to-yellow-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Earned Through <span className="text-orange-600">Numbers</span>.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { title: "Player of the Game", icon: Target },
              { title: "Season MVP", icon: Trophy },
              { title: "Defensive Player", icon: Shield },
              { title: "Mythical Five", icon: Users }
            ].map((award, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border-2 border-orange-300 hover:border-orange-500 transition-all duration-300 h-full bg-white">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center">
                      <award.icon className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="font-bold text-slate-900">{award.title}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-xl font-bold text-slate-900"
          >
            No politics. No bias. The numbers decide.
          </motion.p>
        </div>
      </section>

      {/* Coach Insights */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-4xl lg:text-5xl font-black text-slate-900">
                  Prepare With <span className="text-purple-600">Data</span>.
                </h2>
                <Badge className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">Premium</Badge>
              </div>

              <div className="space-y-4 mb-8">
                {[
                  "Win vs Loss breakdown",
                  "Opponent performance snapshot",
                  "Tactical priority detection",
                  "AI Tactical Briefings (Premium Layer)"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Brain className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-lg font-bold text-slate-900">
                Adjust with clarity. Compete with intention.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border-2 border-purple-300 p-4 bg-gradient-to-br from-purple-50 to-blue-50 shadow-2xl"
            >
              <div className="bg-white rounded-xl h-96 flex items-center justify-center relative">
                <Brain className="w-32 h-32 text-purple-600" />
                <Badge className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Powered
                </Badge>
              </div>
              <p className="text-center text-sm text-slate-600 mt-4 font-medium">AI Tactical Briefing</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA + Contact Form */}
      <section id="contact-form" className="py-24 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
              Ready to Raise the Standard?
            </h2>
            <p className="text-xl text-blue-100">
              Leagues that operate with performance analytics compete at a higher level.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-none shadow-2xl">
              <CardContent className="p-8 md:p-12">
                <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">Request League Setup</h3>
                
                {submitSuccess && (
                  <div className="mb-6 p-4 bg-green-100 border-2 border-green-500 rounded-lg text-center">
                    <p className="text-green-800 font-semibold">✓ Request sent successfully! We'll be in touch soon.</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">League Name</label>
                    <Input
                      required
                      value={formData.leagueName}
                      onChange={(e) => setFormData({ ...formData, leagueName: e.target.value })}
                      placeholder="Enter your league name"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Person</label>
                    <Input
                      required
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      placeholder="Your name"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                    <Input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                    <Textarea
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your league..."
                      rows={4}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 text-lg font-bold"
                  >
                    {isSubmitting ? "Sending..." : "Send Request"}
                    {!isSubmitting && <ArrowRight className="w-5 h-5 ml-2" />}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <div className="text-2xl font-black text-white mb-2">COURTSIDE by AI</div>
              <p className="text-slate-400 text-sm">Elevate your competition</p>
            </div>

            <div className="flex gap-8">
              <button onClick={handleLogin} className="text-slate-300 hover:text-white font-medium transition-colors">
                Login
              </button>
              <button onClick={() => document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth' })} className="text-slate-300 hover:text-white font-medium transition-colors">
                Contact
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm">© 2026 Courtside by AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}