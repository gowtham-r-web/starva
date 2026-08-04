import { RunActivity, UserAthlete, GeoPoint, RunSplit, SegmentMatch } from '../types';
import { calculateHrZones, getZoneForHr, formatPace } from '../lib/bluetoothHr';

export const currentUserAthlete: UserAthlete = {
  name: 'Alex Rivera',
  handle: '@ariveraruns',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  location: 'Boulder, Colorado',
  maxHr: 192,
  restingHr: 48,
  weeklyGoalKm: 45,
  shoes: [
    {
      id: 'shoe-1',
      brand: 'Nike',
      model: 'Vaporfly 3 - Bright Crimson',
      distanceKm: 218.4,
      maxDistanceKm: 600,
      isDefault: true,
    },
    {
      id: 'shoe-2',
      brand: 'Hoka',
      model: 'Clifton 9 - Ice Blue',
      distanceKm: 412.0,
      maxDistanceKm: 700,
      isDefault: false,
    },
  ],
};

// Helper generator to produce high-density realistic GPX points
function generateRoute(
  startLat: number,
  startLng: number,
  totalDistanceKm: number,
  baseEle: number,
  eleVariance: number,
  baseHr: number,
  hrVariance: number,
  basePaceSec: number,
  pointsCount: number = 180
): { routePoints: GeoPoint[]; splits: RunSplit[]; matchedSegments: SegmentMatch[] } {
  const routePoints: GeoPoint[] = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let currentEle = baseEle;
  let currentDist = 0;
  let currentTime = 0;

  const latStep = (Math.sin(0.8) * (totalDistanceKm / 111)) / (pointsCount / 2);
  const lngStep = (Math.cos(0.8) * (totalDistanceKm / 85)) / (pointsCount / 2);

  const splits: RunSplit[] = [];
  let splitStartDist = 0;
  let splitStartTime = 0;
  let splitEleGain = 0;
  let splitHrSum = 0;
  let splitHrMax = 0;
  let splitPointsCount = 0;
  let currentSplitKm = 1;

  for (let i = 0; i < pointsCount; i++) {
    const progress = i / pointsCount;
    // Parameterized loop path
    const angle = progress * Math.PI * 2;
    const radius = (totalDistanceKm / 200) * (1 + 0.3 * Math.sin(angle * 3));

    currentLat = startLat + radius * Math.sin(angle) + progress * 0.005;
    currentLng = startLng + radius * Math.cos(angle * 1.5) + progress * 0.008;

    // Elevation wave
    const eleDelta = Math.sin(progress * Math.PI * 6) * eleVariance + Math.cos(progress * 12) * 8;
    const newEle = Math.max(50, Math.round(baseEle + eleDelta));
    const eleGainThisStep = Math.max(0, newEle - currentEle);
    currentEle = newEle;

    // Heart rate responds to climbs and effort
    const effortImpact = eleDelta > 0 ? eleDelta * 0.8 : eleDelta * 0.3;
    const hrNoise = (Math.sin(i * 0.4) + Math.random() * 0.5) * hrVariance;
    const currentHr = Math.min(195, Math.max(110, Math.round(baseHr + effortImpact + hrNoise)));

    // Cadence
    const cadence = Math.round(168 + Math.sin(i * 0.2) * 8 + (currentHr > 165 ? 6 : 0));

    // Distance & time increment
    const distStepMeters = (totalDistanceKm * 1000) / pointsCount;
    currentDist += distStepMeters;

    // Pace variation based on gradient
    const gradientFactor = 1 + (eleDelta > 0 ? eleDelta / 100 : eleDelta / 200);
    const speedMs = 1000 / (basePaceSec * gradientFactor);
    const stepDurationSec = distStepMeters / speedMs;
    currentTime += stepDurationSec;

    routePoints.push({
      lat: Number(currentLat.toFixed(6)),
      lng: Number(currentLng.toFixed(6)),
      ele: Math.round(currentEle),
      time: Math.round(currentTime),
      hr: currentHr,
      cadence,
      speed: Number(speedMs.toFixed(2)),
      distance: Math.round(currentDist),
    });

    // Split computation
    splitPointsCount++;
    splitHrSum += currentHr;
    if (currentHr > splitHrMax) splitHrMax = currentHr;
    splitEleGain += eleGainThisStep;

    if (currentDist >= currentSplitKm * 1000 || i === pointsCount - 1) {
      const splitTimeSec = currentTime - splitStartTime;
      const splitDistMeters = currentDist - splitStartDist;
      const splitPaceSec = splitDistMeters > 0 ? (splitTimeSec / splitDistMeters) * 1000 : basePaceSec;

      // Grade-Adjusted Pace (GAP)
      const avgGrade = splitDistMeters > 0 ? (splitEleGain / splitDistMeters) * 100 : 0;
      const gapPaceSec = Math.max(200, splitPaceSec - avgGrade * 3.5);

      splits.push({
        splitKm: currentSplitKm,
        paceStr: formatPace(splitPaceSec),
        paceSeconds: Math.round(splitPaceSec),
        avgHr: Math.round(splitHrSum / splitPointsCount),
        maxHr: splitHrMax,
        eleGain: Math.round(splitEleGain),
        gapPaceStr: formatPace(gapPaceSec),
        avgCadence: Math.round(172 + (currentSplitKm % 3)),
      });

      splitStartDist = currentDist;
      splitStartTime = currentTime;
      splitEleGain = 0;
      splitHrSum = 0;
      splitHrMax = 0;
      splitPointsCount = 0;
      currentSplitKm++;
    }
  }

  // Generate 2 matched segments along route
  const midPoint = routePoints[Math.floor(pointsCount / 2)];
  const matchedSegments: SegmentMatch[] = [
    {
      id: 'seg-1',
      name: 'Pinnacle Hill Climb Sprint',
      distanceKm: 0.85,
      avgGrade: 5.4,
      userTime: '3:42',
      userPace: '4:21 /km',
      userAvgHr: 178,
      isPr: true,
      isKom: false,
      leaderTime: '3:18',
      polyline: routePoints.slice(30, 50).map((p) => [p.lat, p.lng]),
    },
    {
      id: 'seg-2',
      name: 'Lakeside Flat Mile Dash',
      distanceKm: 1.2,
      avgGrade: -0.2,
      userTime: '4:48',
      userPace: '4:00 /km',
      userAvgHr: 168,
      isPr: false,
      isKom: true,
      leaderTime: '4:48',
      polyline: routePoints.slice(90, 115).map((p) => [p.lat, p.lng]),
    },
  ];

  return { routePoints, splits, matchedSegments };
}

// Calculate HR zones breakdown for a set of route points
function buildHrZoneBreakdown(points: GeoPoint[], maxHr: number = 192) {
  const zones = calculateHrZones(maxHr);
  const zoneDurations = [0, 0, 0, 0, 0];
  let totalTime = 0;

  for (let i = 1; i < points.length; i++) {
    const duration = points[i].time - points[i - 1].time;
    totalTime += duration;
    const hr = points[i].hr;

    if (hr < zones[0].minHr) zoneDurations[0] += duration;
    else if (hr >= zones[4].minHr) zoneDurations[4] += duration;
    else {
      const idx = zones.findIndex((z) => hr >= z.minHr && hr <= z.maxHr);
      if (idx !== -1) zoneDurations[idx] += duration;
    }
  }

  return zones.map((zone, idx) => {
    const durSec = Math.round(zoneDurations[idx]);
    const pct = totalTime > 0 ? Math.round((durSec / totalTime) * 100) : 0;
    return {
      ...zone,
      durationSeconds: durSec,
      percentage: pct,
    };
  });
}

// Mock Run 1: Chamonix Alpine Trail
const run1Data = generateRoute(45.9237, 6.8694, 12.4, 1030, 180, 158, 22, 335, 200);
export const run1: RunActivity = {
  id: 'run-chamonix-trail-01',
  title: 'Chamonix Alpine Ridge Loop & Glacier View',
  type: 'Trail Run',
  date: 'Yesterday at 7:15 AM',
  timeOfDay: 'Morning',
  locationName: 'Chamonix-Mont-Blanc, France',
  distanceKm: 12.42,
  durationSeconds: 4180, // 1h 09m 40s
  avgPaceSeconds: 336, // 5:36 /km
  bestPaceSeconds: 268, // 4:28 /km
  elevationGainMeters: 540,
  elevationLossMeters: 520,
  avgHeartRate: 162,
  maxHeartRate: 186,
  avgCadence: 174,
  calories: 940,
  sufferScore: 184, // Heavy effort
  kudos: 34,
  userKudoed: true,
  shoeModel: 'Nike Vaporfly 3 - Bright Crimson',
  description: 'Steep initial climb up towards Plan de l\'Aiguille. Crisp alpine air, sustained HR Zone 4 push on the gradient before a fast flowy descent back through town.',
  weather: {
    tempC: 14,
    condition: 'Partly Cloudy',
    humidity: 58,
    windKmh: 12,
  },
  comments: [
    {
      id: 'c1',
      authorName: 'Marcus Vance',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
      text: 'Insane elevation gain on that 3rd km! Great HR control on the downhill.',
      timestamp: 'Yesterday at 9:40 AM',
    },
    {
      id: 'c2',
      authorName: 'Elena Rostova',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150',
      text: 'That view of Mont Blanc must have been unreal 🏔️🔥',
      timestamp: 'Yesterday at 11:15 AM',
    },
  ],
  routePoints: run1Data.routePoints,
  splits: run1Data.splits,
  hrZonesBreakdown: buildHrZoneBreakdown(run1Data.routePoints),
  matchedSegments: run1Data.matchedSegments,
};

// Mock Run 2: Central Park 10K Progressive
const run2Data = generateRoute(40.7829, -73.9654, 10.0, 32, 25, 148, 18, 285, 160);
export const run2: RunActivity = {
  id: 'run-central-park-10k',
  title: 'Central Park Full Loop Progressive Tempo',
  type: 'Road Run',
  date: 'August 2, 2026',
  timeOfDay: 'Morning',
  locationName: 'New York, NY',
  distanceKm: 10.05,
  durationSeconds: 2880, // 48:00
  avgPaceSeconds: 286, // 4:46 /km
  bestPaceSeconds: 242, // 4:02 /km
  elevationGainMeters: 85,
  elevationLossMeters: 82,
  avgHeartRate: 154,
  maxHeartRate: 178,
  avgCadence: 178,
  calories: 720,
  sufferScore: 112,
  kudos: 42,
  userKudoed: false,
  shoeModel: 'Hoka Clifton 9 - Ice Blue',
  description: 'Classic 10K around Central Park outer loop. Focused on Zone 2 aerobic cruising for the first 6km, then built into Zone 4 threshold pace over Harlem Hill.',
  weather: {
    tempC: 22,
    condition: 'Sunny',
    humidity: 64,
    windKmh: 8,
  },
  comments: [],
  routePoints: run2Data.routePoints,
  splits: run2Data.splits,
  hrZonesBreakdown: buildHrZoneBreakdown(run2Data.routePoints),
  matchedSegments: run2Data.matchedSegments,
};

// Mock Run 3: San Francisco Coastal Trail
const run3Data = generateRoute(37.8024, -122.464, 7.8, 18, 50, 155, 16, 310, 140);
export const run3: RunActivity = {
  id: 'run-sf-coastal',
  title: 'Presidio & Golden Gate Bridge Overlook',
  type: 'Trail Run',
  date: 'July 30, 2026',
  timeOfDay: 'Sunset',
  locationName: 'San Francisco, CA',
  distanceKm: 7.82,
  durationSeconds: 2420,
  avgPaceSeconds: 309,
  bestPaceSeconds: 250,
  elevationGainMeters: 195,
  elevationLossMeters: 190,
  avgHeartRate: 158,
  maxHeartRate: 180,
  avgCadence: 176,
  calories: 580,
  sufferScore: 98,
  kudos: 28,
  userKudoed: true,
  shoeModel: 'Nike Vaporfly 3 - Bright Crimson',
  description: 'Sunset coastal trail past Baker Beach and up through the Presidio batteries. Gusty ocean headwind on the return leg.',
  weather: {
    tempC: 17,
    condition: 'Windy',
    humidity: 78,
    windKmh: 24,
  },
  comments: [],
  routePoints: run3Data.routePoints,
  splits: run3Data.splits,
  hrZonesBreakdown: buildHrZoneBreakdown(run3Data.routePoints),
  matchedSegments: run3Data.matchedSegments,
};

export const initialActivitiesList: RunActivity[] = [run1, run2, run3];

/** Pre-packaged Scenic Routes for the Live Simulator mode */
export const presetRoutes = [
  {
    id: 'chamonix',
    name: 'Chamonix Valley Trail (France)',
    lat: 45.9237,
    lng: 6.8694,
    eleBase: 1030,
    eleVar: 120,
    distanceKm: 8.5,
  },
  {
    id: 'centralpark',
    name: 'Central Park Loop (New York)',
    lat: 40.7829,
    lng: -73.9654,
    eleBase: 35,
    eleVar: 30,
    distanceKm: 10.0,
  },
  {
    id: 'tokyo',
    name: 'Imperial Palace Outer Ring (Tokyo)',
    lat: 35.6852,
    lng: 139.7528,
    eleBase: 12,
    eleVar: 15,
    distanceKm: 5.0,
  },
  {
    id: 'boulder',
    name: 'Flatirons Mesa Trail (Boulder, CO)',
    lat: 39.9988,
    lng: -105.2828,
    eleBase: 1650,
    eleVar: 220,
    distanceKm: 6.8,
  },
];
