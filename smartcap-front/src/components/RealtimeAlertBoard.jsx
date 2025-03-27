// 2️⃣ 실시간 알람 보드
import React, { useState } from 'react';

export const RealtimeAlertBoard = () => {
  const [alerts, setAlerts] = useState([
    { id: 1, msg: 'Helmet A 낙상 감지', time: '14:32', type: 'Warning' },
    { id: 2, msg: 'Helmet B 배터리 부족', time: '14:30', type: 'Danger' },
  ]);

  const typeColor = {
    Warning: 'bg-yellow-500',
    Danger: 'bg-pink-600',
    Emergency: 'bg-red-600',
  };

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
          {alerts.map((alert, idx) => (
            <tr key={alert.id} className="border-b border-gray-800">
              <td className="py-2">{idx + 1}</td>
              <td className="py-2">{alert.msg}</td>
              <td className="py-2">{alert.time}</td>
              <td className="py-2">
                <span
                  className={`px-2 py-1 rounded text-sm font-bold text-black ${typeColor[alert.type]}`}
                >
                  {alert.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

