// stores/alarmStore.ts
import { create } from "zustand";

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
  addAlarms: (newAlarms: Alarm[]) => void;
  setAlarms: (alarms: Alarm[]) => void;
};

export const useAlarmStore = create<AlarmState>((set) => ({
  alarms: [],
  
  // 단일 알람 추가
  addAlarm: (newAlarm) =>
    set((state) => {
      // 유효성 검사
      if (!newAlarm || !newAlarm.created_at) {
        console.warn("유효하지 않은 알람 데이터:", newAlarm);
        return state;
      }
      
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
  
  // 여러 알람 일괄 추가 함수
  addAlarms: (newAlarms: Alarm[]) => 
    set((state) => {
      if (!newAlarms || !Array.isArray(newAlarms) || newAlarms.length === 0) {
        return state;
      }
      
      // 기존 알람 ID 집합
      const existingIds = new Set(state.alarms.map(a => a.alarm_id));
      
      // 새 알람과 업데이트된 알람 분리
      const newItems: Alarm[] = [];
      const updatedItems: Alarm[] = [];
      
      newAlarms.forEach(alarm => {
        if (!alarm.alarm_id || !existingIds.has(alarm.alarm_id)) {
          newItems.push(alarm);
        } else {
          updatedItems.push(alarm);
        }
      });
      
      // 기존 알람 업데이트
      let updatedAlarms = state.alarms;
      if (updatedItems.length > 0) {
        updatedAlarms = updatedAlarms.map(existing => {
          const update = updatedItems.find(u => u.alarm_id === existing.alarm_id);
          return update || existing;
        });
      }
      
      // 새 알람 추가 및 날짜 기준 정렬
      const combinedAlarms = [...newItems, ...updatedAlarms];
      combinedAlarms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return { alarms: combinedAlarms };
    }),
    
  // 알람 목록 설정 (백엔드에서 받은 데이터로 완전히 교체)
  setAlarms: (alarms: Alarm[]) => set({ alarms }),
}));