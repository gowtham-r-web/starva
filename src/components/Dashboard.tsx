import React, { useState } from 'react';
import { RunActivity, UserAthlete } from '../types';
import { RunMap } from './RunMap';
import { formatDuration, formatPace } from '../lib/bluetoothHr';
import {
  TrendingUp,
  Plus,
  Flame,
  Upload,
  Radio,
  ThumbsUp,
  MessageSquare,
  Award,
  Calendar,
  Zap,
  Clock,
  Mountain,
  Heart,
  Search,
  Filter,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

interface DashboardProps {
  athlete: UserAthlete;
  activities: RunActivity[];
  selectedActivity: RunActivity;
  onSelectActivity: (activity: RunActivity) => void;
  onStartLiveTracker: () => void;
  onImportGpx: (file: File) => void;
  onKudoToggle: (activityId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  athlete,
  activities,
  selectedActivity,
  onSelectActivity,
  onStartLiveTracker,
  onImportGpx,
  onKudoToggle,
}) => {
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGpxModalOpen, setIsGpxModalOpen] = useState(false);

  // Compute Weekly Total
  const totalWeeklyKm = activities.reduce((acc, act) => acc + act.distanceKm, 0);
  const weeklyProgressPct = Math.min(100, Math.round((totalWeeklyKm / athlete.weeklyGoalKm) * 100));

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const matchesType = filterType === 'All' || act.type === filterType;
    const matchesSearch =
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportGpx(e.target.files[0]);
      setIsGpxModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Swipe & Record Callout Banner (Strava Style) */}
      <div
        onClick={onStartLiveTracker}
        className="p-4 bg-gradient-to-r from-[#FC5200] via-orange-600 to-amber-600 rounded-2xl border border-orange-500/40 shadow-xl cursor-pointer transform hover:scale-[1.01] transition-all group flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-orange-100 uppercase tracking-widest flex items-center gap-2">
              <span>👉 Swipe Right or Tap Here</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px]">NEW ACTIVITY</span>
            </div>
            <h3 className="font-display text-lg font-bold text-white leading-tight">
              Record a New Run with Live GPS Map & Heart Rate
            </h3>
            <p className="text-xs text-orange-100/80">
              Calculates live distance (km), pace (min/km), elevation gain (+m), and heart rate zones.
            </p>
          </div>
        </div>

        <button className="px-5 py-2.5 rounded-xl bg-white text-[#FC5200] font-display font-bold text-xs shadow-md group-hover:bg-slate-100 transition-colors shrink-0 flex items-center gap-1.5">
          <span>Start Recording</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Top Banner & Quick Controls */}
      <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Athlete Info */}
          <div className="flex items-center gap-4">
            <img
              src={athlete.avatar}
              alt={athlete.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#FC5200] shadow-lg"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-white">{athlete.name}</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#FC5200]/20 text-[#FC5200] border border-[#FC5200]/40 text-[10px] font-bold">
                  PRO
                </span>
              </div>
              <div className="text-xs text-slate-400">{athlete.handle} • {athlete.location}</div>

              {/* Shoe Gear Badge */}
              {athlete.shoes[0] && (
                <div className="text-[11px] text-slate-300 mt-1.5 flex items-center gap-1.5">
                  <span className="text-slate-400">Default Shoe:</span>
                  <span className="font-semibold text-amber-400">{athlete.shoes[0].model}</span>
                  <span className="text-slate-500">({athlete.shoes[0].distanceKm} / {athlete.shoes[0].maxDistanceKm} km)</span>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Goal Progress Bar & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="p-3.5 bg-[#111318] border border-[#2e323d] rounded-xl w-full sm:w-64 space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Weekly Goal</span>
                <span className="text-[#FC5200]">{totalWeeklyKm.toFixed(1)} / {athlete.weeklyGoalKm} km</span>
              </div>
              <div className="w-full h-2 bg-[#1e212b] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FC5200] rounded-full transition-all duration-500"
                  style={{ width: `${weeklyProgressPct}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>{weeklyProgressPct}% Completed</span>
                <span>Max HR: {athlete.maxHr} BPM</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onStartLiveTracker}
                className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-[#FC5200] hover:bg-[#e54500] text-white font-bold text-xs shadow-lg shadow-[#FC5200]/30 transition-all flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Live Workout</span>
              </button>

              <button
                onClick={() => setIsGpxModalOpen(true)}
                className="px-4 py-3 rounded-xl bg-[#222530] hover:bg-[#2c303f] text-slate-200 border border-[#2e323d] text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Import GPX</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search running activities, locations..."
            className="w-full pl-10 pr-4 py-2 bg-[#181a20] border border-[#2e323d] focus:border-[#FC5200] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs p-1 bg-[#181a20] border border-[#2e323d] rounded-xl">
          {['All', 'Road Run', 'Trail Run', 'Track', 'Race'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                filterType === type ? 'bg-[#FC5200] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredActivities.map((act) => {
          const isSelected = act.id === selectedActivity.id;

          return (
            <div
              key={act.id}
              onClick={() => onSelectActivity(act)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xl relative overflow-hidden group ${
                isSelected
                  ? 'bg-[#1c1e26] border-[#FC5200] shadow-[#FC5200]/20 ring-1 ring-[#FC5200]'
                  : 'bg-[#181a20] border-[#2e323d] hover:border-slate-600'
              }`}
            >
              {/* Header Info */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className="font-bold text-[#FC5200]">{act.type}</span>
                    <span>• {act.date}</span>
                    <span>• {act.locationName}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white group-hover:text-[#FC5200] transition-colors">
                    {act.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold">
                    ❤️ {act.avgHeartRate} BPM
                  </span>
                </div>
              </div>

              {/* Map Preview Thumbnail */}
              <div className="mt-3 my-3 rounded-xl overflow-hidden h-40 border border-[#2e323d] pointer-events-none relative">
                <RunMap activity={act} colorBy="hr" />
                <div className="absolute top-2 right-2 px-2 py-1 bg-[#181a20]/90 backdrop-blur border border-[#2e323d] rounded-lg text-[10px] font-bold text-slate-200">
                  Suffer Score: {act.sufferScore}
                </div>
              </div>

              {/* Main Activity Metrics */}
              <div className="grid grid-cols-4 gap-2 py-2 border-t border-[#2e323d] text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Distance</div>
                  <div className="font-display font-bold text-base text-white">{act.distanceKm.toFixed(2)} km</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Pace</div>
                  <div className="font-display font-bold text-base text-amber-400">{formatPace(act.avgPaceSeconds)} /km</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Time</div>
                  <div className="font-display font-bold text-base text-slate-200">{formatDuration(act.durationSeconds)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Elev Gain</div>
                  <div className="font-display font-bold text-base text-emerald-400">+{act.elevationGainMeters}m</div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#2e323d] text-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKudoToggle(act.id);
                    }}
                    className={`flex items-center gap-1 font-bold ${
                      act.userKudoed ? 'text-[#FC5200]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{act.kudos}</span>
                  </button>

                  <span className="text-slate-400 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{act.comments.length}</span>
                  </span>
                </div>

                <div className="text-[#FC5200] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>View Telemetry & Map</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* GPX Upload Modal */}
      {isGpxModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#FC5200]" /> Import GPX Activity File
              </h3>
              <button
                onClick={() => setIsGpxModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Upload a standard <code>.gpx</code> run file recorded from Garmin Connect, Polar Flow, Suunto, or Apple Watch.
            </p>

            <label className="border-2 border-dashed border-[#2e323d] hover:border-[#FC5200] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#111318]">
              <Upload className="w-8 h-8 text-[#FC5200] mb-2" />
              <span className="text-xs font-bold text-slate-200">Click to upload .gpx file</span>
              <span className="text-[10px] text-slate-500 mt-1">Parses trackpoints, elevation, and heart rate extensions</span>
              <input type="file" accept=".gpx" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
