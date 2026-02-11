import React, { useState } from "react";
import { motion } from "framer-motion";
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
  LogIn
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
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge className="mb-6 bg-gradient-to-r from-blue-600 to-orange-500 text-white border-none px-4 py-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 mr-2" />
                COURTSIDE by AI
              </Badge>
              
              <h1 className="text-5xl lg:text-7xl font-black text-slate-900 mb-6 leading-tight">
                Where Competition<br />Gets <span className="bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">Serious</span>.
              </h1>
              
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Live stats. Automated awards. Tactical insights. Competitive analytics.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-6 text-lg font-bold shadow-xl"
                  onClick={() => document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth' })}
                >
                  Request League Setup
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-slate-900 text-slate-900 px-8 py-6 text-lg font-bold hover:bg-slate-900 hover:text-white"
                  onClick={handleLogin}
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  League Login
                </Button>
              </div>
            </motion.div>

            {/* Right Side - Device Mockups */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-slate-200 shadow-2xl">
                  <CardContent className="p-6">
                    <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg h-48 flex items-center justify-center mb-3">
                      <Trophy className="w-16 h-16 text-blue-600" />
                    </div>
                    <div className="text-sm font-semibold text-slate-700">Standings</div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-slate-200 shadow-2xl mt-8">
                  <CardContent className="p-6">
                    <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg h-48 flex items-center justify-center mb-3">
                      <TrendingUp className="w-16 h-16 text-orange-600" />
                    </div>
                    <div className="text-sm font-semibold text-slate-700">Leaderboard</div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-slate-200 shadow-2xl col-span-2">
                  <CardContent className="p-6">
                    <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg h-48 flex items-center justify-center mb-3">
                      <Brain className="w-16 h-16 text-purple-600" />
                    </div>
                    <div className="text-sm font-semibold text-slate-700">Coach Insights</div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
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