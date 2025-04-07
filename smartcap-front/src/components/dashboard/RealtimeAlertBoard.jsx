import React from "react";
import { useAlarmStore } from "../../store/alarmStore";

export const RealtimeAlertBoard = () => {
  const alarms = useAlarmStore((state) => state.alarms);

  // 높이를 vh 단위로 설정 (viewport height의 45%)
  const boardHeight = "50vh";

  // 최신순 정렬 후 상위 5개만 표시
  const latestAlerts = [...alarms]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 알람 타입 변환 (숫자->이름) 함수
  const getAlarmTypeName = (type) => {
    // 숫자인 경우 변환
    if (type === 1 || type === '1') return "경고";
    if (type === 2 || type === '2') return "위험";
    if (type === 3 || type === '3') return "사고";
    
    // 이미 문자열인 경우 그대로 반환
    if (type === "경고" || type === "위험" || type === "사고") return type;
    
    // 그 외의 경우 기본값
    return type;
  };

  // 알람 타입에 따른 색상 매핑 (HEX 코드 사용)
  const getAlarmTypeColor = (type) => {
    // 숫자 & 문자열 모두 처리
    if (type === 1 || type === '1' || type === "경고") return "#ffdd00"; // 노란색
    if (type === 2 || type === '2' || type === "위험") return "#ff9500"; // 주황색 
    if (type === 3 || type === '3' || type === "사고") return "#ff0000"; // 빨간색
    
    // 기본값
    return "#777777"; // 기본 회색
  };

  return (
    <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4" style={{ height: boardHeight, minHeight: "300px" }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">실시간 위험 로그</h2>
        {/* <span className="text-sm text-gray-400">Now</span> */}
      </div>

      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto mt-2">
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
              {latestAlerts.map((alert, idx) => {
                // 알람 타입 이름 가져오기
                const alarmTypeName = getAlarmTypeName(alert.alarm_type);
                // 알람 타입 색상 가져오기
                const alarmTypeColor = getAlarmTypeColor(alert.alarm_type);
                
                return (
                  <tr key={alert.alarm_id} className="border-b border-gray-800">
                    <td className="py-2">{idx + 1}</td>
                    <td className="py-2">
                      {alert.recognized_type} {alarmTypeName} 감지
                    </td>
                    <td className="py-2">
                      {new Date(alert.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2">
                      <span
                        className="px-2 py-1 rounded text-sm font-bold text-black"
                        style={{ backgroundColor: alarmTypeColor }}
                      >
                        {alarmTypeName}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
      </div>
    </div>
  );
};