// stores/alarmStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Alarm = {
  alarm_id: number;
  construction_sites_id: number;
  weather_id?: number;
  gps: any;
  alarm_type: string;
  recognized_type: string;
  created_at: string;
  accident_id?: number | null;
  site_name?: string;
  construction_status?: string;
  weather?: string;
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
          // 이미 존재하는지 확인 (동일 alarm_id)
          const alreadyExists = state.alarms.some((a) => a.alarm_id === newAlarm.alarm_id);
          
          if (alreadyExists) {
            // 이미 존재하는 경우에도 기존 알람을 새 알람으로 업데이트
            const updatedAlarms = state.alarms.map(alarm => 
              alarm.alarm_id === newAlarm.alarm_id ? newAlarm : alarm
            );
            console.log("알람 업데이트:", updatedAlarms);
            return { alarms: updatedAlarms };
          } else {
            // 새 알람은 배열 앞쪽에 추가 (최신순 정렬을 위해)
            const updatedAlarms = [newAlarm, ...state.alarms];
            console.log("새 알람 추가:", updatedAlarms);
            return { alarms: updatedAlarms };
          }
        }),
    }),
    {
      name: "alarm-storage", // localStorage key
    }
  )
);