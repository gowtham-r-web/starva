import React, { useState } from 'react';
import { RunActivity } from '../types';
import {
  formatDuration,
  formatPace,
  calculateHrZones,
} from '../lib/bluetoothHr';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Heart,
  Flame,
  Award,
  Zap,
  Clock,
  TrendingUp,
  Mountain,
  Share2,
  Download,
  ThumbsUp,
  MessageSquare,
  Activity,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RunAnalysisProps {
  activity: RunActivity;
  onHoverPoint: (index: number | null) => void;
  onKudoToggle: (activityId: string) => void;
  onAddComment: (activityId: string, text: string) => void;
}

export const RunAnalysis: React.FC<RunAnalysisProps> = ({
  activity,
  onHoverPoint,
  onKudoToggle,
  onAddComment,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'hr-zones' | 'splits' | 'segments'>('overview');
  const [chartMetric, setChartMetric] = useState<'all' | 'hr' | 'elevation' | 'pace'>('all');
  const [commentText, setCommentText] = useState('');

  const hrZones = activity.hrZonesBreakdown || calculateHrZones(activity.maxHeartRate);

  // Prepare chart dataset from routePoints
  const chartData = activity.routePoints.map((pt, idx) => {
    const paceVal = pt.speed > 0 ? (1000 / pt.speed) : 300;
    return {
      index: idx,
      distanceKm: Number((pt.distance / 1000).toFixed(2)),
      hr: pt.hr,
      elevation: pt.ele,
      paceSeconds: Math.min(600, Math.max(180, Math.round(paceVal))),
      paceDisplay: formatPace(paceVal),
      cadence: pt.cadence,
    };
  });

  const handleKudosClick = () => {
    onKudoToggle(activity.id);
    if (!activity.userKudoed) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#FC5200', '#f97316', '#eab308'],
      });
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(activity.id, commentText);
    setCommentText('');
  };

  // Download GPX File handler
  const exportGpx = () => {
    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="StravaTrack AI Studio" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${activity.title}</name>
    <time>${activity.date}</time>
  </metadata>
  <trk>
    <name>${activity.title}</name>
    <trkseg>`;

    const trkPoints = activity.routePoints
      .map(
        (p) => `
      <trkpt lat="${p.lat}" lon="${p.lng}">
        <ele>${p.ele}</ele>
        <extensions>
          <hr>${p.hr}</hr>
          <cadence>${p.cadence}</cadence>
        </extensions>
      </trkpt>`
      )
      .join('');

    const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

    const fullGpx = gpxHeader + trkPoints + gpxFooter;
    const blob = new Blob([fullGpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activity.title.replace(/\s+/g, '_')}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Suffer Score Badge Color
  const getSufferScoreBadge = (score: number) => {
    if (score > 180) return { label: 'Extreme Effort', color: 'bg-red-500/20 text-red-400 border-red-500/40' };
    if (score > 120) return { label: 'Hard Effort', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
    if (score > 60) return { label: 'Moderate Effort', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
    return { label: 'Easy Cruise', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
  };

  const sufferBadge = getSufferScoreBadge(activity.sufferScore);

  return (
    <div className="space-y-6">
      {/* Activity Header Card */}
      <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Background Subtle Gradient Accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FC5200] via-orange-500 to-amber-500"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FC5200]/15 text-[#FC5200] border border-[#FC5200]/30 text-xs font-bold uppercase tracking-wider">
                {activity.type}
              </span>
              <span className="text-slate-400 text-xs">{activity.date} • {activity.locationName}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sufferBadge.color}`}>
                🔥 Suffer Score: {activity.sufferScore} ({sufferBadge.label})
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-wide">
              {activity.title}
            </h1>
            {activity.description && (
              <p className="text-slate-300 text-sm mt-1 max-w-3xl leading-relaxed">
                {activity.description}
              </p>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={handleKudosClick}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-md ${
                activity.userKudoed
                  ? 'bg-[#FC5200] text-white border-[#FC5200] shadow-[#FC5200]/30'
                  : 'bg-[#222530] text-slate-300 border-[#2e323d] hover:border-[#FC5200] hover:text-white'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>{activity.kudos} Kudos</span>
            </button>

            <button
              onClick={exportGpx}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#222530] hover:bg-[#2c303f] text-slate-200 border border-[#2e323d] text-xs font-bold transition-colors"
            >
              <Download className="w-4 h-4 text-[#FC5200]" />
              <span className="hidden sm:inline">Export GPX</span>
            </button>
          </div>
        </div>

        {/* Primary Hero Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6 pt-5 border-t border-[#2e323d]">
          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#FC5200]" /> Distance
            </div>
            <div className="font-display text-2xl font-bold text-white mt-1">
              {activity.distanceKm.toFixed(2)} <span className="text-sm text-slate-400 font-sans">km</span>
            </div>
          </div>

          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" /> Moving Time
            </div>
            <div className="font-display text-2xl font-bold text-white mt-1">
              {formatDuration(activity.durationSeconds)}
            </div>
          </div>

          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Avg Pace
            </div>
            <div className="font-display text-2xl font-bold text-white mt-1">
              {formatPace(activity.avgPaceSeconds)} <span className="text-sm text-slate-400 font-sans">/km</span>
            </div>
          </div>

          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Mountain className="w-3.5 h-3.5 text-emerald-400" /> Elev Gain
            </div>
            <div className="font-display text-2xl font-bold text-white mt-1">
              +{activity.elevationGainMeters} <span className="text-sm text-slate-400 font-sans">m</span>
            </div>
          </div>

          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-red-400" /> Avg HR
            </div>
            <div className="font-display text-2xl font-bold text-red-400 mt-1">
              {activity.avgHeartRate} <span className="text-sm text-slate-400 font-sans">BPM</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Max: {activity.maxHeartRate} BPM</div>
          </div>

          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> Cadence
            </div>
            <div className="font-display text-2xl font-bold text-purple-400 mt-1">
              {activity.avgCadence} <span className="text-sm text-slate-400 font-sans">SPM</span>
            </div>
          </div>

          <div className="p-3 bg-[#111318] border border-[#2e323d] rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" /> Calories
            </div>
            <div className="font-display text-2xl font-bold text-white mt-1">
              {activity.calories} <span className="text-sm text-slate-400 font-sans">kcal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#2e323d] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-[#FC5200] text-white shadow-lg shadow-[#FC5200]/30'
              : 'text-slate-400 hover:text-white bg-[#181a20]'
          }`}
        >
          <Activity className="w-4 h-4" /> Telemetry Charts
        </button>

        <button
          onClick={() => setActiveTab('hr-zones')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'hr-zones'
              ? 'bg-[#FC5200] text-white shadow-lg shadow-[#FC5200]/30'
              : 'text-slate-400 hover:text-white bg-[#181a20]'
          }`}
        >
          <Heart className="w-4 h-4 text-red-400" /> HR Zone Analytics
        </button>

        <button
          onClick={() => setActiveTab('splits')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'splits'
              ? 'bg-[#FC5200] text-white shadow-lg shadow-[#FC5200]/30'
              : 'text-slate-400 hover:text-white bg-[#181a20]'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> KM Splits & GAP
        </button>

        <button
          onClick={() => setActiveTab('segments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'segments'
              ? 'bg-[#FC5200] text-white shadow-lg shadow-[#FC5200]/30'
              : 'text-slate-400 hover:text-white bg-[#181a20]'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" /> Matched Segments ({activity.matchedSegments?.length || 0})
        </button>
      </div>

      {/* Tab 1: Synchronized Recharts Telemetry Charts */}
      {activeTab === 'overview' && (
        <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#FC5200]" /> Synchronized Route Telemetry
              </h3>
              <p className="text-xs text-slate-400">
                Hover over the chart to scrub through time and highlight the runner's exact location on the map above.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs bg-[#111318] p-1 border border-[#2e323d] rounded-xl self-start">
              <button
                onClick={() => setChartMetric('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  chartMetric === 'all' ? 'bg-[#FC5200] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Metrics
              </button>
              <button
                onClick={() => setChartMetric('hr')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  chartMetric === 'hr' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Heart Rate
              </button>
              <button
                onClick={() => setChartMetric('elevation')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  chartMetric === 'elevation' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Elevation
              </button>
            </div>
          </div>

          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onMouseMove={(state) => {
                  if (state && state.activeTooltipIndex !== undefined) {
                    onHoverPoint(state.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => onHoverPoint(null)}
              >
                <defs>
                  <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d38" vertical={false} />
                <XAxis
                  dataKey="distanceKm"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  unit="km"
                />
                <YAxis
                  yAxisId="hr"
                  orientation="left"
                  stroke="#ef4444"
                  domain={['dataMin - 10', 'dataMax + 10']}
                  tick={{ fontSize: 11, fill: '#ef4444' }}
                  unit=" bpm"
                  hide={chartMetric === 'elevation'}
                />
                <YAxis
                  yAxisId="ele"
                  orientation="right"
                  stroke="#10b981"
                  domain={['dataMin - 10', 'dataMax + 20']}
                  tick={{ fontSize: 11, fill: '#10b981' }}
                  unit=" m"
                  hide={chartMetric === 'hr'}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1c1e26] border border-[#2e323d] p-3 rounded-xl shadow-2xl text-xs space-y-1">
                          <div className="font-bold text-[#FC5200]">
                            Distance: {data.distanceKm} km
                          </div>
                          <div className="text-red-400 font-semibold flex items-center justify-between gap-4">
                            <span>Heart Rate:</span>
                            <span>{data.hr} BPM</span>
                          </div>
                          <div className="text-emerald-400 font-semibold flex items-center justify-between gap-4">
                            <span>Elevation:</span>
                            <span>{data.elevation} m</span>
                          </div>
                          <div className="text-yellow-400 font-semibold flex items-center justify-between gap-4">
                            <span>Pace:</span>
                            <span>{data.paceDisplay} /km</span>
                          </div>
                          <div className="text-purple-400 font-semibold flex items-center justify-between gap-4">
                            <span>Cadence:</span>
                            <span>{data.cadence} spm</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Legend />

                {(chartMetric === 'all' || chartMetric === 'elevation') && (
                  <Area
                    yAxisId="ele"
                    type="monotone"
                    dataKey="elevation"
                    name="Elevation (m)"
                    stroke="#10b981"
                    fill="url(#eleGrad)"
                    strokeWidth={2}
                  />
                )}

                {(chartMetric === 'all' || chartMetric === 'hr') && (
                  <Line
                    yAxisId="hr"
                    type="monotone"
                    dataKey="hr"
                    name="Heart Rate (BPM)"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 2: HR Zone Analytics */}
      {activeTab === 'hr-zones' && (
        <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" /> Heart Rate Zone Distribution
              </h3>
              <p className="text-xs text-slate-400">
                Time spent in physiological training zones based on Max HR ({activity.maxHeartRate} BPM).
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Average HR</span>
              <div className="font-display text-xl font-bold text-red-400">{activity.avgHeartRate} BPM</div>
            </div>
          </div>

          {/* Zones Visual Bars */}
          <div className="space-y-3">
            {hrZones.map((zone) => {
              const durSec = zone.durationSeconds || 0;
              const pct = zone.percentage || 0;

              return (
                <div
                  key={zone.zone}
                  className="p-3.5 bg-[#111318] border border-[#2e323d] rounded-xl space-y-2 hover:border-[#FC5200]/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      ></span>
                      <span className="text-white">{zone.name}</span>
                      <span className="text-slate-400 text-[11px] font-normal">
                        ({zone.minHr} - {zone.maxHr} BPM)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 font-mono font-bold">
                        {formatDuration(durSec)}
                      </span>
                      <span className="font-display font-bold text-sm text-white w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-[#1e212b] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: zone.color,
                      }}
                    ></div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">{zone.description}</p>
                </div>
              );
            })}
          </div>

          {/* Training Effect Summary */}
          <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#FC5200] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <strong className="text-slate-200">Coach's Aerobic Analysis:</strong>
              <p className="text-slate-400 leading-relaxed">
                {(hrZones[1]?.percentage || 0) + (hrZones[2]?.percentage || 0) > 60
                  ? 'Excellent base aerobic building session! Over 60% of your run was spent in Zone 1 & Zone 2, improving mitochondrial density and fat oxidation.'
                  : 'High intensity threshold run! A large portion was spent in Zone 4 & Zone 5, building lactate clearance capacity and VO2 Max.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: KM Splits & Grade-Adjusted Pace */}
      {activeTab === 'splits' && (
        <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FC5200]" /> Kilometer Splits & Grade-Adjusted Pace (GAP)
            </h3>
            <p className="text-xs text-slate-400">
              Grade-Adjusted Pace calculates what your speed would have been on flat ground.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111318] text-slate-400 border-b border-[#2e323d] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">KM</th>
                  <th className="py-3 px-4">Split Pace</th>
                  <th className="py-3 px-4">GAP (Flat)</th>
                  <th className="py-3 px-4">Avg HR</th>
                  <th className="py-3 px-4">Max HR</th>
                  <th className="py-3 px-4">Elev Delta</th>
                  <th className="py-3 px-4">Cadence</th>
                  <th className="py-3 px-4 text-right">Pace Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d38]">
                {activity.splits.map((split) => {
                  const isFastest = split.paceSeconds === Math.min(...activity.splits.map((s) => s.paceSeconds));

                  return (
                    <tr
                      key={split.splitKm}
                      className="hover:bg-[#222530] transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                        <span>{split.splitKm}</span>
                        {isFastest && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                            ⚡ Fast
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-display font-bold text-sm text-slate-200">
                        {split.paceStr} <span className="text-[10px] text-slate-400 font-sans">/km</span>
                      </td>
                      <td className="py-3 px-4 font-display font-bold text-sm text-[#FC5200]">
                        {split.gapPaceStr} <span className="text-[10px] text-slate-400 font-sans">/km</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-red-400">{split.avgHr} BPM</td>
                      <td className="py-3 px-4 text-slate-400">{split.maxHr} BPM</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        {split.eleGain > 0 ? `+${split.eleGain}m` : `${split.eleGain}m`}
                      </td>
                      <td className="py-3 px-4 text-purple-400 font-medium">{split.avgCadence} spm</td>
                      <td className="py-3 px-4 text-right">
                        <div className="w-24 h-2 bg-[#111318] rounded-full overflow-hidden ml-auto">
                          <div
                            className={`h-full rounded-full ${isFastest ? 'bg-amber-400' : 'bg-[#FC5200]'}`}
                            style={{
                              width: `${Math.max(20, 100 - (split.paceSeconds - 240) * 0.4)}%`,
                            }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Matched Segments */}
      {activeTab === 'segments' && (
        <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> Strava Matched Segments
            </h3>
            <p className="text-xs text-slate-400">
              Popular course segments crossed during this activity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activity.matchedSegments.map((seg) => (
              <div
                key={seg.id}
                className="p-4 bg-[#111318] border border-[#2e323d] hover:border-[#FC5200]/50 rounded-xl space-y-3 transition-colors shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      {seg.name}
                    </h4>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {seg.distanceKm} km • Avg Grade: {seg.avgGrade}%
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {seg.isPr && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                        🏆 PR
                      </span>
                    )}
                    {seg.isKom && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FC5200]/20 text-[#FC5200] border border-[#FC5200]/40 text-[10px] font-bold flex items-center gap-1">
                        👑 KOM
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2e323d] text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Your Time</span>
                    <div className="font-display font-bold text-base text-white">{seg.userTime}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Pace</span>
                    <div className="font-display font-bold text-base text-slate-300">{seg.userPace}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Segment Leader</span>
                    <div className="font-display font-bold text-base text-amber-400">{seg.leaderTime}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social Comments Section */}
      <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" /> Athlete Comments ({activity.comments.length})
        </h3>

        {/* Existing Comments */}
        <div className="space-y-3">
          {activity.comments.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No comments yet. Be the first to cheer on this run!</p>
          ) : (
            activity.comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start gap-3 p-3 bg-[#111318] border border-[#2e323d] rounded-xl text-xs"
              >
                <img
                  src={comment.authorAvatar}
                  alt={comment.authorName}
                  className="w-8 h-8 rounded-full object-cover border border-[#2e323d]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{comment.authorName}</span>
                    <span className="text-[10px] text-slate-500">{comment.timestamp}</span>
                  </div>
                  <p className="text-slate-300">{comment.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Comment Input Form */}
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment or cheer on the pace..."
            className="flex-1 bg-[#111318] border border-[#2e323d] focus:border-[#FC5200] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#FC5200] hover:bg-[#e54500] text-white rounded-xl text-xs font-bold transition-colors"
          >
            Post
          </button>
        </form>
      </div>
    </div>
  );
};
