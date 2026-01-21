
export interface Exercise {
  id: string;
  name: string;
  videoUrl: string;
  currentWeight: number;
  dateAdded: string;
  lastUpdated: string;
}

export interface Profile {
  id: string;
  name: string;
  startDate: string;
  weightInitial: number;
  weightCurrent: number;
  goalWeight: number | null;
  photo: string | null;
  notes: string;
  exercises: Record<string, Exercise>;
  createdAt: string;
}

export interface DayData {
  trained: boolean;
  exercises: Record<string, boolean>;
}

export interface WeekData {
  [date: string]: Record<string, DayData>; // date -> profileId -> DayData
}

export interface AppData {
  profiles: Record<string, Profile>;
  currentProfileId: string;
  weekData: WeekData;
}
