import React from "react";
import { useAlarmStore } from "../store/alarmStore";

export const RealtimeAlertBoard = () => {
  const alarms = useAlarmStore((state) => state.alarms);

  // 최신순 정렬 후 상위 5개만 표시
  const latestAlerts = [...alarms]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

    const typeColor = {
      "경고": "bg-yellow-500",
      "위험": "bg-pink-600",
      "사고": "bg-red-600",
    };
    
    const color = typeColor[alert.alarm_type] || "bg-gray-500";
    

  return (
    <div className="bg-[#0d1117] text-white rounded-xl shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">실시간 위험 로그</h2>
        <span className="text-sm text-gray-400">Now</span>
      </div>

      <table className="w-full text-base">
        <thead className="text-gray-400 border-b border-gray-800">
          <tr>
            <th className="text-left py-2">#</th>
            <th className="text-left py-2">Log</th>
            <th className="text-left py-2">Time</th>
            <th className="text-left py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {latestAlerts.map((alert, idx) => (
            <tr key={alert.alarm_id} className="border-b border-gray-800">
              <td className="py-2">{idx + 1}</td>
              <td className="py-2">
                {alert.recognized_type} {alert.alarm_type} 감지
              </td>
              <td className="py-2">
                {new Date(alert.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="py-2">
                <span
                  className={`px-2 py-1 rounded text-sm font-bold text-black ${
                    typeColor[alert.alarm_type] || "bg-gray-500"
                  }`}
                >
                  {alert.alarm_type}
                </span>
              </td>
            </tr>
          ))}
          {latestAlerts.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-500">
                알람이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
