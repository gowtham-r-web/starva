import React, { useState, useEffect, useRef } from 'react';
import { RunActivity, GeoPoint } from '../types';
import {
  bluetoothHr,
  BluetoothHrState,
  calculateHrZones,
  getZoneForHr,
  formatDuration,
  formatPace,
  calculateSufferScore,
} from '../lib/bluetoothHr';
import { presetRoutes } from '../data/mockRuns';
import { RunMap } from './RunMap';
import {
  Heart,
  Play,
  Pause,
  Square,
  Bluetooth,
  Activity,
  Zap,
  Clock,
  Compass,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LiveTrackerProps {
  onSaveActivity: (activity: RunActivity) => void;
  onCancel: () => void;
}

export const LiveTracker: React.FC<LiveTrackerProps> = ({
  onSaveActivity,
  onCancel,
}) => {
  const [bleState, setBleState] = useState<BluetoothHrState>(bluetoothHr.getState());
  const [trackerMode, setTrackerMode] = useState<'simulator' | 'gps'>('simulator');
  const [selectedPreset, setSelectedPreset] = useState(presetRoutes[0]);

  // Workout state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live metrics
  const [currentHr, setCurrentHr] = useState(142);
  const [simEffort, setSimEffort] = useState<'recovery' | 'aerobic' | 'tempo' | 'threshold' | 'vo2max'>('aerobic');
  const [livePoints, setLivePoints] = useState<GeoPoint[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activityTitle, setActivityTitle] = useState('Live Morning Workout');

  // Simulation step references
  const timerRef = useRef<any>(null);
  const stepIndexRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Subscribe to Web Bluetooth Heart Rate Service
  useEffect(() => {
    const unsubStatus = bluetoothHr.subscribeStatus((state) => {
      setBleState(state);
    });

    const unsubHr = bluetoothHr.subscribeHr((hr) => {
      setCurrentHr(hr);
    });

    return () => {
      unsubStatus();
      unsubHr();
    };
  }, []);

  // Timer Tick
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        recordNewPoint();
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused, trackerMode, simEffort, selectedPreset, bleState.isConnected]);

  // Record point each second
  const recordNewPoint = () => {
    stepIndexRef.current += 1;
    const step = stepIndexRef.current;

    let lat = selectedPreset.lat;
    let lng = selectedPreset.lng;
    let ele = selectedPreset.eleBase;
    let hr = currentHr;
    let speedMs = 3.2; // ~5:12 /km pace default

    if (trackerMode === 'simulator') {
      // Parametric simulated runner movement
      const angle = (step * 0.03) % (Math.PI * 2);
      const radius = 0.008 + 0.002 * Math.sin(step * 0.05);

      lat = selectedPreset.lat + radius * Math.sin(angle);
      lng = selectedPreset.lng + radius * Math.cos(angle * 1.3);

      const eleOffset = Math.sin(step * 0.1) * selectedPreset.eleVar;
      ele = Math.round(selectedPreset.eleBase + eleOffset);

      // Effort level dictates heart rate & speed
      if (!bleState.isConnected) {
        let baseHrTarget = 145;
        if (simEffort === 'recovery') { baseHrTarget = 125; speedMs = 2.6; }
        else if (simEffort === 'aerobic') { baseHrTarget = 145; speedMs = 3.2; }
        else if (simEffort === 'tempo') { baseHrTarget = 162; speedMs = 3.8; }
        else if (simEffort === 'threshold') { baseHrTarget = 175; speedMs = 4.3; }
        else if (simEffort === 'vo2max') { baseHrTarget = 186; speedMs = 4.8; }

        const hrNoise = Math.round((Math.sin(step * 0.3) + Math.random() * 0.5) * 4);
        hr = Math.min(192, Math.max(100, baseHrTarget + hrNoise));
        setCurrentHr(hr);
      }
    }

    // Calculate cumulative distance
    setLivePoints((prevPoints) => {
      const lastPt = prevPoints[prevPoints.length - 1];
      let prevDist = lastPt ? lastPt.distance : 0;

      // Distance increment
      const deltaMeters = speedMs * 1; // 1 second tick
      const newDist = Math.round(prevDist + deltaMeters);

      // Audio notification on full kilometers
      if (audioEnabled && Math.floor(newDist / 1000) > Math.floor(prevDist / 1000) && newDist > 500) {
        playKmBeep();
      }

      const newPoint: GeoPoint = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        ele: ele,
        time: step,
        hr: hr,
        cadence: Math.round(170 + Math.sin(step * 0.2) * 6),
        speed: speedMs,
        distance: newDist,
      };

      return [...prevPoints, newPoint];
    });
  };

  const playKmBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio optional
    }
  };

  const handleConnectBluetooth = async () => {
    await bluetoothHr.connect();
  };

  const handleStartWorkout = () => {
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePauseWorkout = () => {
    setIsPaused(!isPaused);
  };

  const handleFinishWorkout = () => {
    setIsRecording(false);

    if (livePoints.length < 5) {
      alert('Workout is too short to save (minimum 5 seconds).');
      return;
    }

    const totalDistKm = (livePoints[livePoints.length - 1]?.distance || 0) / 1000;
    const totalDurationSec = elapsedSeconds || 1;
    const avgHr = Math.round(livePoints.reduce((acc, p) => acc + p.hr, 0) / livePoints.length);
    const maxHr = Math.max(...livePoints.map((p) => p.hr));
    const avgPaceSec = (totalDurationSec / (totalDistKm * 1000)) * 1000;

    // Splits
    const splitsCount = Math.ceil(totalDistKm);
    const splits = [];
    for (let k = 1; k <= splitsCount; k++) {
      const splitPts = livePoints.filter((p) => p.distance >= (k - 1) * 1000 && p.distance <= k * 1000);
      const splitAvgHr = splitPts.length > 0 ? Math.round(splitPts.reduce((a, b) => a + b.hr, 0) / splitPts.length) : avgHr;
      splits.push({
        splitKm: k,
        paceStr: formatPace(avgPaceSec),
        paceSeconds: Math.round(avgPaceSec),
        avgHr: splitAvgHr,
        maxHr: maxHr,
        eleGain: 12,
        gapPaceStr: formatPace(avgPaceSec - 8),
        avgCadence: 174,
      });
    }

    // Calculate dynamic elevation gain
    let calcEleGain = 0;
    let calcEleLoss = 0;
    for (let i = 1; i < livePoints.length; i++) {
      const deltaEle = livePoints[i].ele - livePoints[i - 1].ele;
      if (deltaEle > 0) calcEleGain += deltaEle;
      else if (deltaEle < 0) calcEleLoss += Math.abs(deltaEle);
    }
    if (calcEleGain === 0 && livePoints.length > 5) {
      calcEleGain = Math.round(livePoints.length * 0.25);
    }

    const sufferScore = calculateSufferScore(livePoints.map((p) => ({ hr: p.hr, durationSec: 1 })), 192);

    const newActivity: RunActivity = {
      id: `live-run-${Date.now()}`,
      title: activityTitle || `${selectedPreset.name} Workout`,
      type: 'Road Run',
      date: 'Just now',
      timeOfDay: 'Live Recorded',
      locationName: selectedPreset.name,
      distanceKm: Number(totalDistKm.toFixed(2)),
      durationSeconds: totalDurationSec,
      avgPaceSeconds: Math.round(avgPaceSec),
      bestPaceSeconds: Math.round(avgPaceSec * 0.85),
      elevationGainMeters: calcEleGain,
      elevationLossMeters: calcEleLoss,
      avgHeartRate: avgHr,
      maxHeartRate: maxHr,
      avgCadence: 174,
      calories: Math.round(totalDistKm * 68),
      sufferScore: sufferScore,
      kudos: 1,
      userKudoed: true,
      comments: [],
      shoeModel: 'Nike Vaporfly 3 - Bright Crimson',
      description: `Live activity recorded with real-time GPS route telemetry (${trackerMode === 'gps' ? 'Device GPS' : 'Simulator'}). Recorded ${totalDistKm.toFixed(2)} km with +${calcEleGain}m elevation gain in ${formatDuration(totalDurationSec)}.`,
      routePoints: livePoints,
      splits: splits,
      hrZonesBreakdown: [],
      matchedSegments: [],
    };

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    onSaveActivity(newActivity);
  };

  const currentZone = getZoneForHr(currentHr, 192);
  const totalDistanceKm = livePoints.length > 0 ? livePoints[livePoints.length - 1].distance / 1000 : 0;
  const currentPaceSec = totalDistanceKm > 0 ? (elapsedSeconds / (totalDistanceKm * 1000)) * 1000 : 0;

  // Temporary container activity for live map preview
  const previewActivity: RunActivity = {
    id: 'live-preview',
    title: 'Live Session',
    type: 'Road Run',
    date: 'Now',
    timeOfDay: 'Now',
    locationName: selectedPreset.name,
    distanceKm: totalDistanceKm,
    durationSeconds: elapsedSeconds,
    avgPaceSeconds: currentPaceSec,
    bestPaceSeconds: currentPaceSec,
    elevationGainMeters: 45,
    elevationLossMeters: 40,
    avgHeartRate: currentHr,
    maxHeartRate: currentHr,
    avgCadence: 172,
    calories: 120,
    sufferScore: 20,
    kudos: 0,
    userKudoed: false,
    comments: [],
    shoeModel: 'Nike Vaporfly 3',
    routePoints: livePoints.length > 0 ? livePoints : [
      { lat: selectedPreset.lat, lng: selectedPreset.lng, ele: selectedPreset.eleBase, time: 0, hr: currentHr, cadence: 172, speed: 3.2, distance: 0 }
    ],
    splits: [],
    hrZonesBreakdown: [],
    matchedSegments: [],
  };

  return (
    <div className="bg-[#181a20] border border-[#2e323d] rounded-2xl p-5 md:p-6 shadow-2xl space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2e323d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FC5200]/20 border border-[#FC5200]/40 flex items-center justify-center text-[#FC5200]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              Real-Time Live Workout HUD
            </h2>
            <p className="text-xs text-slate-400">
              Record real-time heart rate via Bluetooth strap or simulated GPS run
            </p>
          </div>
        </div>

        {/* Audio Toggle & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              audioEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-[#111318] text-slate-400 border-[#2e323d]'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">Audio Cues</span>
          </button>

          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-[#222530] hover:bg-[#2e323d] text-slate-300 text-xs font-bold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Bluetooth HR Pairing Banner */}
      <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              bleState.isConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
            }`}
          >
            <Bluetooth className={`w-5 h-5 ${bleState.isConnecting ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>{bleState.isConnected ? `Connected: ${bleState.deviceName}` : 'Web Bluetooth HR Sensor'}</span>
              {bleState.batteryLevel !== null && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">
                  🔋 {bleState.batteryLevel}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {bleState.isConnected
                ? 'Streaming live BPM directly from your physical Bluetooth chest strap / watch!'
                : 'Connect your Polar, Garmin, Wahoo, or Apple Watch Bluetooth Heart Rate strap.'}
            </p>
          </div>
        </div>

        <div>
          {bleState.isConnected ? (
            <button
              onClick={() => bluetoothHr.disconnect()}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
            >
              Disconnect BLE
            </button>
          ) : (
            <button
              onClick={handleConnectBluetooth}
              disabled={bleState.isConnecting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5"
            >
              <Bluetooth className="w-4 h-4" />
              <span>{bleState.isConnecting ? 'Connecting...' : 'Pair Bluetooth HR Device'}</span>
            </button>
          )}
        </div>
      </div>

      {bleState.error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{bleState.error} (Switched to high-fidelity Live Workout Simulator)</span>
        </div>
      )}

      {/* Simulator Controls & Target Effort */}
      {!bleState.isConnected && (
        <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FC5200]" /> Live Simulator Route & Effort Target
            </span>

            {/* Route Selector */}
            <select
              value={selectedPreset.id}
              onChange={(e) => {
                const found = presetRoutes.find((r) => r.id === e.target.value);
                if (found) setSelectedPreset(found);
              }}
              disabled={isRecording}
              className="bg-[#181a20] border border-[#2e323d] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
            >
              {presetRoutes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['recovery', 'aerobic', 'tempo', 'threshold', 'vo2max'] as const).map((eff) => {
              const labels = {
                recovery: 'Z1 Recovery',
                aerobic: 'Z2 Endurance',
                tempo: 'Z3 Tempo',
                threshold: 'Z4 Threshold',
                vo2max: 'Z5 Max VO2',
              };
              return (
                <button
                  key={eff}
                  onClick={() => setSimEffort(eff)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold capitalize transition-all ${
                    simEffort === eff
                      ? 'bg-[#FC5200] text-white shadow-md'
                      : 'bg-[#181a20] text-slate-400 border border-[#2e323d] hover:text-white'
                  }`}
                >
                  {labels[eff]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Digital Live HUD Screen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Heart Rate Digital Gauge */}
        <div
          className="p-6 rounded-2xl border flex flex-col items-center justify-center relative overflow-hidden transition-all shadow-xl"
          style={{
            backgroundColor: currentZone.bgColor,
            borderColor: `${currentZone.color}60`,
          }}
        >
          {/* Heart Pulse Visual */}
          <div className="relative mb-2">
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: currentZone.color }}
            ></div>
            <Heart
              className="w-12 h-12 relative z-10 transition-transform transform scale-110"
              style={{ color: currentZone.color, fill: currentZone.color }}
            />
          </div>

          <div className="font-display text-6xl font-bold text-white tracking-tight">
            {currentHr}
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: currentZone.color }}>
            {currentZone.name}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 text-center px-2">
            {currentZone.description}
          </div>
        </div>

        {/* Primary Workout Numbers */}
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#FC5200]" /> Distance
            </div>
            <div className="font-display text-4xl font-bold text-white my-1">
              {totalDistanceKm.toFixed(2)} <span className="text-base text-slate-400 font-sans">km</span>
            </div>
            <div className="text-[11px] text-slate-500">{(totalDistanceKm * 1000).toFixed(0)} meters total</div>
          </div>

          <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" /> Elapsed Time
            </div>
            <div className="font-display text-4xl font-bold text-white my-1">
              {formatDuration(elapsedSeconds)}
            </div>
            <div className="text-[11px] text-slate-500">Live Timer</div>
          </div>

          <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-yellow-400" /> Current Pace
            </div>
            <div className="font-display text-3xl font-bold text-white my-1">
              {formatPace(currentPaceSec)} <span className="text-xs text-slate-400 font-sans">/km</span>
            </div>
            <div className="text-[11px] text-slate-500">Targeting {simEffort} pace</div>
          </div>

          <div className="p-4 bg-[#111318] border border-[#2e323d] rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-400" /> Cadence
            </div>
            <div className="font-display text-3xl font-bold text-purple-400 my-1">
              {isRecording ? 174 : 0} <span className="text-xs text-slate-400 font-sans">SPM</span>
            </div>
            <div className="text-[11px] text-slate-500">Optimal stride rhythm</div>
          </div>
        </div>
      </div>

      {/* Live Map Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
          <span>Live Path Tracking</span>
          <span className="text-slate-400 font-normal">
            {livePoints.length} trackpoints captured
          </span>
        </div>
        <RunMap activity={previewActivity} colorBy="hr" />
      </div>

      {/* Primary Workout Controls */}
      <div className="pt-2 flex items-center justify-center gap-4">
        {!isRecording ? (
          <button
            onClick={handleStartWorkout}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#FC5200] hover:bg-[#e54500] text-white font-display text-lg font-bold shadow-xl shadow-[#FC5200]/40 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Live Recording</span>
          </button>
        ) : (
          <>
            <button
              onClick={handlePauseWorkout}
              className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg ${
                isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
              }`}
            >
              {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              onClick={handleFinishWorkout}
              className="px-8 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>Finish & Save Activity</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
