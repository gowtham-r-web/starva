export interface GeoPoint {
  lat: number;
  lng: number;
  ele: number; // elevation in meters
  time: number; // timestamp in seconds from start
  hr: number; // Heart rate in bpm
  cadence: number; // Steps per minute (spm)
  speed: number; // Speed in m/s
  distance: number; // Cumulative distance in meters
}

export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  minHr: number;
  maxHr: number;
  color: string;
  bgColor: string;
  description: string;
  durationSeconds?: number;
  percentage?: number;
}

export interface RunSplit {
  splitKm: number;
  paceStr: string;
  paceSeconds: number;
  avgHr: number;
  maxHr: number;
  eleGain: number;
  gapPaceStr: string; // Grade-Adjusted Pace
  avgCadence: number;
}

export interface SegmentMatch {
  id: string;
  name: string;
  distanceKm: number;
  avgGrade: number; // percentage
  userTime: string;
  userPace: string;
  userAvgHr: number;
  isPr: boolean;
  isKom: boolean;
  leaderTime: string;
  polyline: [number, number][];
}

export interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  timestamp: string;
}

export interface RunActivity {
  id: string;
  title: string;
  type: 'Road Run' | 'Trail Run' | 'Track' | 'Treadmill' | 'Race';
  date: string;
  timeOfDay: string;
  locationName: string;
  distanceKm: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  bestPaceSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  avgHeartRate: number;
  maxHeartRate: number;
  avgCadence: number;
  calories: number;
  sufferScore: number; // Strava Relative Effort (1 - 500)
  kudos: number;
  userKudoed: boolean;
  comments: Comment[];
  shoeModel: string;
  description?: string;
  weather?: {
    tempC: number;
    condition: string;
    humidity: number;
    windKmh: number;
  };
  routePoints: GeoPoint[];
  splits: RunSplit[];
  hrZonesBreakdown: HeartRateZone[];
  matchedSegments: SegmentMatch[];
}

export interface Shoe {
  id: string;
  brand: string;
  model: string;
  distanceKm: number;
  maxDistanceKm: number;
  isDefault: boolean;
}

export interface UserAthlete {
  name: string;
  handle: string;
  avatar: string;
  location: string;
  maxHr: number;
  restingHr: number;
  weeklyGoalKm: number;
  shoes: Shoe[];
}
