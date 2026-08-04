import React, { useState, useRef } from 'react';
import { initialActivitiesList, currentUserAthlete } from './data/mockRuns';
import { RunActivity, GeoPoint, Comment } from './types';
import { Dashboard } from './components/Dashboard';
import { RunAnalysis } from './components/RunAnalysis';
import { RunMap } from './components/RunMap';
import { LiveTracker } from './components/LiveTracker';
import {
  Flame,
  Radio,
  Activity,
  Layers,
  Award,
  ChevronLeft,
  Search,
  Plus,
  Share2,
  Heart,
  Compass,
  MapPin,
  User,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const [activities, setActivities] = useState<RunActivity[]>(initialActivitiesList);
  const [selectedActivity, setSelectedActivity] = useState<RunActivity>(initialActivitiesList[0]);
  const [viewMode, setViewMode] = useState<'feed' | 'analysis' | 'tracker'>('feed');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Swipe Right Gesture State
  const touchStartXRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && viewMode === 'feed') {
      const deltaX = e.touches[0].clientX - touchStartXRef.current;
      if (deltaX > 0) {
        setSwipeOffset(Math.min(deltaX, 120));
      }
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 75 && viewMode === 'feed') {
      setViewMode('tracker');
    }
    setSwipeOffset(0);
    touchStartXRef.current = null;
  };

  // Toggle Kudos for activity
  const handleKudoToggle = (activityId: string) => {
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id === activityId) {
          const newKudoed = !act.userKudoed;
          return {
            ...act,
            userKudoed: newKudoed,
            kudos: newKudoed ? act.kudos + 1 : act.kudos - 1,
          };
        }
        return act;
      })
    );

    if (selectedActivity.id === activityId) {
      setSelectedActivity((prev) => ({
        ...prev,
        userKudoed: !prev.userKudoed,
        kudos: !prev.userKudoed ? prev.kudos + 1 : prev.kudos - 1,
      }));
    }
  };

  // Add Comment to activity
  const handleAddComment = (activityId: string, text: string) => {
    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      authorName: currentUserAthlete.name,
      authorAvatar: currentUserAthlete.avatar,
      text: text,
      timestamp: 'Just now',
    };

    setActivities((prev) =>
      prev.map((act) => {
        if (act.id === activityId) {
          return { ...act, comments: [...act.comments, newComment] };
        }
        return act;
      })
    );

    if (selectedActivity.id === activityId) {
      setSelectedActivity((prev) => ({
        ...prev,
        comments: [...prev.comments, newComment],
      }));
    }
  };

  // Save new activity from Live Tracker or GPX Import
  const handleSaveActivity = (newActivity: RunActivity) => {
    setActivities([newActivity, ...activities]);
    setSelectedActivity(newActivity);
    setViewMode('analysis');
  };

  // Parse GPX file XML upload
  const handleImportGpx = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const trkpts = xml.getElementsByTagName('trkpt');

        if (!trkpts || trkpts.length === 0) {
          alert('No valid trackpoints found in the GPX file.');
          return;
        }

        const routePoints: GeoPoint[] = [];
        let totalDist = 0;

        for (let i = 0; i < trkpts.length; i++) {
          const pt = trkpts[i];
          const lat = parseFloat(pt.getAttribute('lat') || '0');
          const lng = parseFloat(pt.getAttribute('lon') || '0');
          const eleEl = pt.getElementsByTagName('ele')[0];
          const ele = eleEl ? parseFloat(eleEl.textContent || '0') : 50;

          // Parse Heart Rate extensions
          let hr = 145;
          const hrEl = pt.getElementsByTagName('hr')[0] || pt.getElementsByTagName('gpxtpx:hr')[0];
          if (hrEl) hr = parseInt(hrEl.textContent || '145', 10);

          if (i > 0) {
            const prev = routePoints[i - 1];
            // Haversine distance formula
            const R = 6371000; // meters
            const dLat = ((lat - prev.lat) * Math.PI) / 180;
            const dLng = ((lng - prev.lng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((prev.lat * Math.PI) / 180) *
                Math.cos((lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            totalDist += R * c;
          }

          routePoints.push({
            lat,
            lng,
            ele,
            time: i * 3,
            hr,
            cadence: 172,
            speed: 3.3,
            distance: Math.round(totalDist),
          });
        }

        const distKm = totalDist / 1000;
        const durationSec = routePoints.length * 3;
        const avgHr = Math.round(routePoints.reduce((a, b) => a + b.hr, 0) / routePoints.length);

        const newRun: RunActivity = {
          id: `gpx-import-${Date.now()}`,
          title: file.name.replace('.gpx', '') || 'Imported GPX Activity',
          type: 'Road Run',
          date: 'Just imported',
          timeOfDay: 'GPX File',
          locationName: 'GPX Route',
          distanceKm: Number(distKm.toFixed(2)),
          durationSeconds: durationSec,
          avgPaceSeconds: Math.round(durationSec / (distKm || 1)),
          bestPaceSeconds: Math.round((durationSec / (distKm || 1)) * 0.8),
          elevationGainMeters: 120,
          elevationLossMeters: 110,
          avgHeartRate: avgHr,
          maxHeartRate: Math.max(...routePoints.map((p) => p.hr)),
          avgCadence: 174,
          calories: Math.round(distKm * 65),
          sufferScore: Math.round(distKm * 12),
          kudos: 1,
          userKudoed: true,
          comments: [],
          shoeModel: currentUserAthlete.shoes[0].model,
          routePoints,
          splits: [],
          hrZonesBreakdown: [],
          matchedSegments: [],
        };

        handleSaveActivity(newRun);
      } catch (err) {
        alert('Failed to parse GPX file. Please verify file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="min-h-screen bg-[#0e0f12] text-slate-100 flex flex-col font-sans pb-20 md:pb-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe Feedback Overlay Drawer */}
      {swipeOffset > 20 && viewMode === 'feed' && (
        <div
          className="fixed left-0 top-0 bottom-0 z-50 bg-gradient-to-r from-[#FC5200] to-transparent pointer-events-none flex items-center px-6 transition-all"
          style={{ width: `${swipeOffset * 1.5}px`, opacity: swipeOffset / 100 }}
        >
          <div className="flex items-center gap-2 text-white font-display font-bold text-lg drop-shadow-lg">
            <Radio className="w-6 h-6 animate-pulse" />
            <span>{swipeOffset > 75 ? 'Release to Record!' : 'Swipe Right to Record Run'}</span>
            <ArrowRight className="w-5 h-5 animate-bounce" />
          </div>
        </div>
      )}

      {/* Top Navigation Header (Strava Style) */}
      <header className="sticky top-0 z-40 bg-[#14161c]/90 backdrop-blur-xl border-b border-[#2e323d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            onClick={() => setViewMode('feed')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FC5200] to-orange-500 flex items-center justify-center text-white shadow-lg shadow-[#FC5200]/30 transform group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold tracking-wider text-white group-hover:text-[#FC5200] transition-colors">
                STRAVA<span className="text-[#FC5200]">TRACK</span>
              </span>
              <span className="text-[9px] text-slate-400 -mt-1 font-semibold uppercase tracking-widest">
                Distance • Pace • Elevation
              </span>
            </div>
          </div>

          {/* Center View Switcher */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-[#181a20] border border-[#2e323d] rounded-xl text-xs">
            <button
              onClick={() => setViewMode('feed')}
              className={`px-4 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'feed'
                  ? 'bg-[#FC5200] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Finished Runs Feed</span>
            </button>

            <button
              onClick={() => setViewMode('analysis')}
              className={`px-4 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'analysis'
                  ? 'bg-[#FC5200] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Map & Telemetry</span>
            </button>

            <button
              onClick={() => setViewMode('tracker')}
              className={`px-4 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'tracker'
                  ? 'bg-[#FC5200] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-red-400" />
              <span>Record Activity Map</span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('tracker')}
              className="px-4 py-2 rounded-xl bg-[#FC5200] hover:bg-[#e54500] text-white text-xs font-bold shadow-lg shadow-[#FC5200]/30 transition-all flex items-center gap-1.5"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Record Run</span>
            </button>

            <img
              src={currentUserAthlete.avatar}
              alt={currentUserAthlete.name}
              className="w-8 h-8 rounded-full border border-[#FC5200] object-cover cursor-pointer"
            />
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {viewMode === 'feed' && (
          <Dashboard
            athlete={currentUserAthlete}
            activities={activities}
            selectedActivity={selectedActivity}
            onSelectActivity={(act) => {
              setSelectedActivity(act);
              setViewMode('analysis');
            }}
            onStartLiveTracker={() => setViewMode('tracker')}
            onImportGpx={handleImportGpx}
            onKudoToggle={handleKudoToggle}
          />
        )}

        {viewMode === 'analysis' && (
          <div className="space-y-6">
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setViewMode('feed')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-[#181a20] px-3.5 py-2 rounded-xl border border-[#2e323d] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Feed
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Switch Activity:</span>
                <select
                  value={selectedActivity.id}
                  onChange={(e) => {
                    const found = activities.find((a) => a.id === e.target.value);
                    if (found) setSelectedActivity(found);
                  }}
                  className="bg-[#181a20] border border-[#2e323d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FC5200]"
                >
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.distanceKm} km)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Interactive Leaflet Map Header Component */}
            <RunMap
              activity={selectedActivity}
              hoveredPointIndex={hoveredPointIndex}
              onPointHover={(idx) => setHoveredPointIndex(idx)}
              colorBy="hr"
            />

            {/* Comprehensive Telemetry Analysis Component */}
            <RunAnalysis
              activity={selectedActivity}
              onHoverPoint={(idx) => setHoveredPointIndex(idx)}
              onKudoToggle={handleKudoToggle}
              onAddComment={handleAddComment}
            />
          </div>
        )}

        {viewMode === 'tracker' && (
          <LiveTracker
            onSaveActivity={handleSaveActivity}
            onCancel={() => setViewMode('feed')}
          />
        )}
      </main>

      {/* Strava Iconic Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#14161c]/95 backdrop-blur-xl border-t border-[#2e323d] md:hidden px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => setViewMode('feed')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            viewMode === 'feed' ? 'text-[#FC5200]' : 'text-slate-400'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span>Home Feed</span>
        </button>

        <button
          onClick={() => setViewMode('analysis')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            viewMode === 'analysis' ? 'text-[#FC5200]' : 'text-slate-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>Maps</span>
        </button>

        {/* Central Prominent Record Button */}
        <button
          onClick={() => setViewMode('tracker')}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#FC5200] to-orange-500 text-white flex items-center justify-center shadow-lg shadow-[#FC5200]/40 -mt-5 border-2 border-[#14161c] transform active:scale-95 transition-transform"
        >
          <Radio className="w-6 h-6 animate-pulse" />
        </button>

        <button
          onClick={() => setViewMode('analysis')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            viewMode === 'analysis' ? 'text-[#FC5200]' : 'text-slate-400'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span>Analytics</span>
        </button>

        <button
          onClick={() => setViewMode('feed')}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-400"
        >
          <User className="w-5 h-5" />
          <span>You</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#2e323d] bg-[#111318] py-6 text-center text-xs text-slate-500 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-display font-bold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-[#FC5200]"></span>
            STRAVA TRACK & HR ANALYTICS
          </div>
          <div>
            Real-Time GPS Distance • Pace • Elevation Gain • Interactive Leaflet Maps
          </div>
        </div>
      </footer>
    </div>
  );
}

