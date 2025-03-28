// stores/alarmStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Alarm = {
  alarm_id: number;
  construction_sites_id: number;
  weather_id: number;
  gps: any;
  alarm_type: string;
  recognized_type: string;
  created_at: string;
};

type AlarmState = {
  alarms: Alarm[];
  addAlarm: (newAlarm: Alarm) => void;
};

export const useAlarmStore = create<AlarmState>()(
  persist(
    (set) => ({
      alarms: [],
      addAlarm: (newAlarm) =>
        set((state) => {
          const alreadyExists = state.alarms.some((a) => a.alarm_id === newAlarm.alarm_id);
          const updated = alreadyExists
            ? [...state.alarms] // 똑같아도 새 배열 리턴해서 렌더링 트리거
            : [...state.alarms, newAlarm];
            console.log(updated);
          return { alarms: updated };
        }),
    }),
    {
      name: "alarm-storage", // localStorage key
    }
  )
);