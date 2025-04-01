import { useEffect } from 'react';
import React from 'react';
import { useAlarmStore } from '../../store/alarmStore';
import dayjs from 'dayjs';

export const MonthlyDangerRanking = () => {
  const alarms = useAlarmStore((state) => state.alarms);
  
  // 높이를 vh 단위로 설정 (viewport height의 45%)
  const boardHeight = "50vh";

  useEffect(() => {
    console.log('알람 변경 감지됨! 새로 계산 중...');
  }, [alarms]);

  // 이번 달 알람만 필터링
  const thisMonthAlarms = alarms.filter((alarm) =>
    dayjs(alarm.created_at).isSame(dayjs(), 'month')
  );

  // recognized_type 기준으로 집계
  const grouped = thisMonthAlarms.reduce((acc, alarm) => {
    const type = alarm.recognized_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  const data = Object.entries(grouped).map(([name, value]) => ({ name, value }));
  const max = Math.max(...data.map((d) => d.value), 1); // 0 방지용 1 추가

  return (
    <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4 relative overflow-hidden" style={{ height: boardHeight, minHeight: "300px" }}>
      <div className="h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">월간 사고 위험 순위</h2>

        <div className="flex-1 overflow-y-auto mt-2">
          <table className="w-full text-base">
            <thead className="text-gray-400 border-b border-gray-800 text-left">
              <tr>
                <th className="pb-2">유형</th>
                <th className="pb-2">건수</th>
                <th className="pb-2">비율</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.name} className="border-b border-gray-800">
                  <td className="py-3">{d.name}</td>
                  <td className="py-3">{d.value}</td>
                  <td className="py-3 w-2/3">
                    <div className="w-full bg-gray-800 rounded-full h-2 relative overflow-hidden">
                      <div
                        className="progress-bar-glow bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(d.value / max) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-500">
                    이번 달 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✨ 반짝 애니메이션 스타일 */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 0.2; }
          100% { transform: translateX(100%); opacity: 0; }
        }

        .progress-bar-glow::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 60%;
          background: linear-gradient(90deg, transparent, white, transparent);
          animation: shimmer 4s ease-in-out infinite;
          border-radius: 9999px;
        }
      `}</style>
    </div>
  );
};