import React from 'react';

export const MonthlyDangerRanking = () => {
  const data = [
    { name: 'Helmet A', value: 12 },
    { name: 'Helmet B', value: 19 },
    { name: 'Helmet C', value: 5 },
  ];

  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="bg-[#0d1117] text-white rounded-2xl shadow-lg p-6 relative overflow-hidden">
      <h2 className="text-lg font-semibold mb-4">📊 월간 사고 위험 순위</h2>

      <table className="w-full text-base">
        <thead className="text-gray-400 border-b border-gray-700 text-left">
          <tr>
            <th className="pb-2">Helmet</th>
            <th className="pb-2">Events</th>
            <th className="pb-2">Ratio</th>
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
        </tbody>
      </table>

      {/* ✨ 반짝 애니메이션 스타일 */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          50% {
            opacity: 0.2;
          }
          100% {
            transform: translateX(100%);
            opacity: 0;
          }
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
