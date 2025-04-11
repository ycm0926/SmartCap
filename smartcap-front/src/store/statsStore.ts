// src/store/statsStore.js
import { create } from 'zustand';

export const useStatsStore = create((set) => ({
  hourlyStats: [],
  dailyStats: [],
  monthlyStats: [],

  // 전체 덮어쓰기
  setAllStats: ({ hourlyStats, dailyStats, monthlyStats }) =>
    set({ hourlyStats, dailyStats, monthlyStats }),

  // SSE 업데이트
  updateStat: ({ scope, key, field, newValue }) =>
    set((state) => {
      const scopeKey = {
        hour: 'hourlyStats',
        day: 'dailyStats',
        month: 'monthlyStats',
      }[scope];
  
      if (!scopeKey) return state;
      
      // key에서 prefix 제거 (summary:day: 등 제거)
      const cleanKey = key.includes(':') ? key.split(':').slice(-1)[0] : key;
      
      // 해당 key가 있는지 확인
      const keyExists = state[scopeKey].some(entry => entry.key === cleanKey);
      
      let updated;
      
      if (keyExists) {
        // 기존 키가 있는 경우 업데이트
        updated = state[scopeKey].map((entry) => {
          if (entry.key !== cleanKey) return entry;
          
          const updatedStats = [...entry.stats];
          const fieldIndex = updatedStats.findIndex(s => s.field === field);
          
          if (fieldIndex >= 0) {
            // 필드가 있으면 업데이트
            updatedStats[fieldIndex] = { ...updatedStats[fieldIndex], count: newValue };
          } else {
            // 필드가 없으면 추가
            updatedStats.push({ field, count: newValue });
          }
          
          console.log("기존 키 업데이트 됨:", cleanKey, field, newValue);
          return { ...entry, stats: updatedStats };
        });
      } else {
        // 기존 키가 없는 경우 새로 추가
        console.log("새 키 추가됨:", cleanKey, field, newValue);
        updated = [
          ...state[scopeKey],
          { 
            key: cleanKey, 
            scope, 
            stats: [{ field, count: newValue }] 
          }
        ];
      }
      
      // 날짜 기준으로 내림차순 정렬 (최신 날짜가 먼저 오도록)
      const sortedUpdated = updated.sort((a, b) => {
        // 날짜 형식에 따라 정렬 로직 조정
        try {
          if (scope === 'hour') {
            // 시간 형식 (2025-04-04:10)
            // ':' 문자를 'T'로 변환하여 올바른 날짜 형식으로 만듦
            const dateA = new Date(a.key.replace(':', 'T'));
            const dateB = new Date(b.key.replace(':', 'T'));
            return dateB.getTime() - dateA.getTime();
          } else if (scope === 'day') {
            // 일자 형식 (2025-04-04)
            const dateA = new Date(a.key);
            const dateB = new Date(b.key);
            return dateB.getTime() - dateA.getTime();
          } else {
            // 월 형식 (2025-04)
            const dateA = new Date(a.key + '-01');
            const dateB = new Date(b.key + '-01');
            return dateB.getTime() - dateA.getTime();
          }
        } catch (e) {
          console.error("날짜 정렬 중 오류:", e, a.key, b.key);
          return 0; // 오류 발생 시 순서 유지
        }
      });
      
      return { ...state, [scopeKey]: sortedUpdated };
    }),
}));