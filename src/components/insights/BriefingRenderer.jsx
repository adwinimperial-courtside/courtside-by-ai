import React from "react";
import { AlertTriangle, ArrowRight, Clock, Crosshair, Key, Search, ClipboardList } from "lucide-react";

// BRIEF_VISUAL_V1 — display-only renderer for the AI Tactical Briefing.
// The model still returns the same plain text it always has; this component
// splits that text on the fixed emoji headings and lays each section out as a
// card. Every chart below is drawn from data already loaded on the Coach
// Insights page, never from the model, so none of this costs a single extra
// token. If the text ever drifts from the expected headings the parser gives
// up and the raw text is rendered as formatted markdown instead, so a bad
// parse can never produce a blank screen.

const NAVY = "#0B1F3A";
const ORANGE = "#F26B1F";

const SECTION_DEFS = [
  { key: "headline",   marker: "\u{1F3AF}", title: "The game in one line" },
  { key: "howWeWin",   marker: "\u{1F511}", title: "How we win this one" },
  { key: "whoTheyAre", marker: "\u{1F575}", title: "Who they are" },
  { key: "matchups",   marker: "\u{1F94A}", title: "Matchups" },
  { key: "firstFive",  marker: "\u{23F1}",  title: "First five minutes" },
  { key: "risks",      marker: "\u{26A0}",  title: "What could lose this" },
  { key: "confidence", marker: "\u{1F4CB}", title: "Confidence" },
];

export function parseBriefing(text) {
  if (!text || typeof text !== "string") return { sections: {}, matched: 0 };

  const sections = {};
  let current = null;
  let matched = 0;

  text.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const hit = SECTION_DEFS.find(def => line.startsWith(def.marker));
    if (hit) {
      current = hit.key;
      sections[current] = [];
      matched += 1;
      // Some responses put the heading and its first line together.
      const remainder = line.slice(hit.marker.length).replace(/^[\uFE0F\s]*/, "").trim();
      const looksLikeHeading = remainder.toUpperCase() === remainder;
      if (remainder && !looksLikeHeading) sections[current].push(remainder);
      return;
    }

    if (current) sections[current].push(line);
  });

  return { sections, matched };
}

function stripBullet(line) {
  // A single leading * is a bullet; a doubled ** is the start of bold text.
  return line.replace(/^\s*(?:[-\u2022]|\*(?!\*)|\d+[.)])\s+/, "").trim();
}

// BRIEF_VISUAL_V2 - minimal inline markdown: **bold** and *italic*. Anything
// else is left exactly as written. Single asterisks used to reach the screen
// as literal characters, which is what the model uses for its caveat lines.
function Rich({ text, className = "" }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (/^\*[^*]+\*$/.test(part)) {
          return <em key={i} className="text-slate-500">{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

// ---------------------------------------------------------------- charts

function Bar({ label, value, width, color, suffix = "" }) {
  return (
    <div className="flex items-center gap-2 text-[11px] sm:text-xs mb-1.5">
      <span className="w-14 sm:w-20 text-slate-500 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-0">
        <div className="h-2 rounded-full" style={{ width: `${Math.max(2, Math.min(100, width))}%`, background: color }} />
      </div>
      <span className="w-10 sm:w-12 text-right text-slate-700 flex-shrink-0">{value}{suffix}</span>
    </div>
  );
}

function WinLossChart({ winLossComparison, excludeTurnovers }) {
  if (!winLossComparison || winLossComparison.wins.count === 0 || winLossComparison.losses.count === 0) return null;

  const w = winLossComparison.wins.stats;
  const l = winLossComparison.losses.stats;

  const rows = [
    { label: "Points", win: parseFloat(w.points), loss: parseFloat(l.points) },
    { label: "Assists", win: parseFloat(w.assists), loss: parseFloat(l.assists) },
    { label: "Reb margin", win: parseFloat(w.reboundMargin), loss: parseFloat(l.reboundMargin) },
    ...(excludeTurnovers ? [] : [{ label: "Turnovers", win: parseFloat(w.turnovers), loss: parseFloat(l.turnovers) }]),
  ].filter(r => Number.isFinite(r.win) && Number.isFinite(r.loss));

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
        Wins ({winLossComparison.wins.count}) vs losses ({winLossComparison.losses.count})
      </p>
      {rows.map(row => {
        const scale = Math.max(Math.abs(row.win), Math.abs(row.loss), 1);
        return (
          <div key={row.label} className="mb-3">
            <p className="text-xs text-slate-600 mb-1">{row.label}</p>
            <Bar label="In wins" value={row.win.toFixed(1)} width={(Math.abs(row.win) / scale) * 100} color="#1D9E75" />
            <Bar label="In losses" value={row.loss.toFixed(1)} width={(Math.abs(row.loss) / scale) * 100} color="#C0392B" />
          </div>
        );
      })}
    </div>
  );
}

function ThreatChart({ opponentSnapshot, teamSeasonAverages, selectedTeamName, selectedOpponentName }) {
  if (!opponentSnapshot) return null;

  const oppPoints = parseFloat(opponentSnapshot.avgPoints);
  const topPpg = parseFloat(opponentSnapshot.topScorer?.ppg);
  const oppThrees = parseFloat(opponentSnapshot.avgThrees);
  const ourThrees = teamSeasonAverages?.threes;

  const hasShare = Number.isFinite(oppPoints) && Number.isFinite(topPpg) && oppPoints > 0;
  const hasThrees = Number.isFinite(oppThrees) && Number.isFinite(ourThrees);

  if (!hasShare && !hasThrees) return null;

  const sharePct = hasShare ? Math.min(100, (topPpg / oppPoints) * 100) : 0;
  const threeScale = hasThrees ? Math.max(oppThrees, ourThrees, 1) : 1;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
      {hasShare && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Where their points come from</p>
          <div className="flex h-6 rounded-md overflow-hidden bg-slate-100">
            <div className="flex items-center px-1.5 sm:px-2 min-w-0" style={{ width: `${sharePct}%`, background: "#C0392B", minWidth: "30%" }}>
              <span className="text-[10px] sm:text-[11px] text-white truncate">{opponentSnapshot.topScorer?.name} {topPpg.toFixed(1)}</span>
            </div>
            <div className="flex items-center px-1.5 sm:px-2 flex-1 min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-600 truncate">Rest {(oppPoints - topPpg).toFixed(1)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {sharePct.toFixed(0)}% of their scoring comes from one player.
          </p>
        </div>
      )}

      {hasThrees && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Threes made per game</p>
          <Bar label={selectedOpponentName || "Them"} value={oppThrees.toFixed(1)} width={(oppThrees / threeScale) * 100} color={NAVY} />
          <Bar label={selectedTeamName || "Us"} value={ourThrees.toFixed(1)} width={(ourThrees / threeScale) * 100} color={ORANGE} />
        </div>
      )}
    </div>
  );
}

function FoulRiskStrip({ playerRankings, mentionedIn = "" }) {
  // BRIEF_VISUAL_V2 - the briefing usually calls out foul risks in its own
  // words. Repeating those same players as chips underneath reads as a bug,
  // so anyone already named in the matchup text is left out here.
  const said = String(mentionedIn || "").toLowerCase();
  const risky = (playerRankings || [])
    .filter(p => parseFloat(p.fpg) >= 3.5)
    .filter(p => !p.name || !said.includes(String(p.name).toLowerCase()))
    .sort((a, b) => parseFloat(b.fpg) - parseFloat(a.fpg));

  if (risky.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
      <p className="text-xs font-medium text-amber-900 mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Foul trouble risk
      </p>
      <div className="flex flex-wrap gap-1.5">
        {risky.map(p => (
          <span key={p.id} className="text-xs bg-white border border-amber-200 text-amber-900 rounded-full px-2.5 py-1">
            {p.name}{p.jerseyNumber ? ` #${p.jerseyNumber}` : ""} · {p.fpg} fouls
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sections

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <p className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Icon className="w-5 h-5" style={{ color: ORANGE }} />
        {title}
      </p>
      {children}
    </div>
  );
}

function PointList({ lines }) {
  return (
    <div className="space-y-3">
      {lines.map((raw, i) => {
        const line = stripBullet(raw);
        const boldMatch = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
        if (boldMatch) {
          return (
            <div key={i} className="pl-3 border-l-[3px]" style={{ borderColor: ORANGE }}>
              <p className="text-sm font-medium text-slate-900">{boldMatch[1]}</p>
              {boldMatch[2] && <p className="text-sm text-slate-600 mt-0.5"><Rich text={boldMatch[2]} /></p>}
            </div>
          );
        }
        return (
          <div key={i} className="pl-3 border-l-[3px]" style={{ borderColor: ORANGE }}>
            <p className="text-sm text-slate-700"><Rich text={line} /></p>
          </div>
        );
      })}
    </div>
  );
}

function MatchupList({ lines }) {
  return (
    <div className="divide-y divide-slate-100">
      {lines.map((raw, i) => {
        const line = stripBullet(raw);
        const plain = line.replace(/\*\*/g, "");
        const m = plain.match(/^(.+?)\s+on\s+(.+?)\s*[\u2014\u2013-]\s*(.*)$/);

        if (m) {
          return (
            <div key={i} className="py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
                <p className="flex-1 min-w-0 text-sm font-medium text-slate-900 sm:truncate">{m[1].trim()}</p>
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 rotate-90 sm:rotate-0" />
                <p className="flex-1 min-w-0 text-sm font-medium text-slate-900 sm:truncate sm:text-right">{m[2].trim()}</p>
              </div>
              {m[3] && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{m[3].trim()}</p>}
            </div>
          );
        }

        if (/foul/i.test(plain)) {
          return (
            <p key={i} className="text-sm text-amber-900 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><Rich text={line} /></span>
            </p>
          );
        }

        return <p key={i} className="text-sm text-slate-700 py-2.5"><Rich text={line} /></p>;
      })}
    </div>
  );
}

function StepList({ lines }) {
  return (
    <div className="space-y-2.5">
      {lines.map((raw, i) => (
        <p key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
          <span
            className="w-5 h-5 rounded-full text-white text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: NAVY }}
          >
            {i + 1}
          </span>
          <span><Rich text={stripBullet(raw)} /></span>
        </p>
      ))}
    </div>
  );
}

function RiskList({ lines }) {
  return (
    <div className="space-y-3">
      {lines.map((raw, i) => {
        const line = stripBullet(raw).replace(/\*\*/g, "");
        const m = line.match(/IF:\s*(.+?)\s*THEN:\s*(.*)$/i)
          || line.match(/^If\s+(.+?),\s*(?:then\s+)?(.+)$/i);

        if (m) {
          // BRIEF_VISUAL_V2 - the model often ends the IF clause with a dash
          // before the THEN label; leaving it in looks like a cut-off sentence.
          const tidy = (t) => String(t || "").trim().replace(/[\s\u2014\u2013-]+$/, "").trim();
          return (
            <div key={i} className="pl-3 border-l-[3px] border-red-500">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">If</p>
              <p className="text-sm text-slate-900 mb-1.5">{tidy(m[1])}</p>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Then</p>
              <p className="text-sm text-slate-700">{tidy(m[2])}</p>
            </div>
          );
        }

        return (
          <div key={i} className="pl-3 border-l-[3px] border-red-500">
            <p className="text-sm text-slate-700"><Rich text={stripBullet(raw)} /></p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- fallback

function FallbackText({ text }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="space-y-2">
        {String(text || "").split("\n").map((line, i) =>
          line.trim()
            ? <p key={i} className="text-sm text-slate-700 leading-relaxed"><Rich text={line} /></p>
            : <div key={i} className="h-2" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- main

export default function BriefingRenderer({
  text,
  generatedDate,
  selectedTeamName,
  selectedOpponentName,
  winLossComparison,
  opponentSnapshot,
  teamSeasonAverages,
  playerRankings = [],
  excludeTurnovers = false,
}) {
  const { sections, matched } = parseBriefing(text);

  // Fewer than four recognised headings means the response did not follow the
  // expected shape. Rendering the raw text is always better than empty cards.
  if (matched < 4) return <FallbackText text={text} />;

  const headline = (sections.headline || []).join(" ").replace(/\*\*/g, "");
  const confidence = (sections.confidence || []).join(" ").replace(/\*\*/g, "");

  return (
    <div className="space-y-3">
      {/* Headline banner */}
      <div className="rounded-xl p-4 sm:p-5" style={{ background: NAVY }}>
        <p className="text-[11px] tracking-widest mb-2" style={{ color: ORANGE }}>
          GAME PLAN{selectedOpponentName ? ` \u00B7 VS ${String(selectedOpponentName).toUpperCase()}` : ""}
        </p>
        <p className="text-[15px] sm:text-[17px] font-medium text-white leading-relaxed">{headline}</p>
        {(confidence || generatedDate) && (
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-white/20">
            {generatedDate && (
              <div>
                <p className="text-[11px] text-white/60">GENERATED</p>
                <p className="text-[13px] text-white mt-0.5">{generatedDate}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {sections.howWeWin?.length > 0 && (
        <SectionCard icon={Key} title="How we win this one">
          <PointList lines={sections.howWeWin} />
          <WinLossChart winLossComparison={winLossComparison} excludeTurnovers={excludeTurnovers} />
        </SectionCard>
      )}

      {sections.whoTheyAre?.length > 0 && (
        <SectionCard icon={Search} title="Who they are">
          <PointList lines={sections.whoTheyAre} />
          <ThreatChart
            opponentSnapshot={opponentSnapshot}
            teamSeasonAverages={teamSeasonAverages}
            selectedTeamName={selectedTeamName}
            selectedOpponentName={selectedOpponentName}
          />
        </SectionCard>
      )}

      {sections.matchups?.length > 0 && (
        <SectionCard icon={Crosshair} title="Matchups">
          <MatchupList lines={sections.matchups} />
          <FoulRiskStrip playerRankings={playerRankings} mentionedIn={(sections.matchups || []).join(" ")} />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.firstFive?.length > 0 && (
          <SectionCard icon={Clock} title="First five minutes">
            <StepList lines={sections.firstFive} />
          </SectionCard>
        )}

        {sections.risks?.length > 0 && (
          <SectionCard icon={AlertTriangle} title="What could lose this">
            <RiskList lines={sections.risks} />
          </SectionCard>
        )}
      </div>

      {confidence && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-2.5">
          <ClipboardList className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">How much to trust this</p>
            <p className="text-sm text-slate-700 leading-relaxed">{confidence}</p>
          </div>
        </div>
      )}
    </div>
  );
}