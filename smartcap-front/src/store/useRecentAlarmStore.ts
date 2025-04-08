// src/store/alarmStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useRecentAlarmStore = create(
  persist(
    (set, get) => ({
      alarms: [],
      addAlarmToFront: (newAlarm) =>
        set((state) => ({
          alarms: [newAlarm, ...state.alarms].slice(0, 100), // 최대 100개 유지
        })),
      clearAlarms: () => set({ alarms: [] }),
    }),
    {
      name: 'alarm-store', // localStorage 키
    }
  )
);
