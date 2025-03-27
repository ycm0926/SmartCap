import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export const RealtimeLineChart = () => {
  const [data] = useState([
    { time: '01 Nov', value: 18000 },
    { time: '02 Nov', value: 26000 },
    { time: '03 Nov', value: 32000 },
    { time: '04 Nov', value: 21000 },
    { time: '05 Nov', value: 39000 },
    { time: '06 Nov', value: 37000 },
    { time: '07 Nov', value: 47000 },
  ]);

  return (
    <div className="relative text-white rounded-2xl shadow-lg p-6 overflow-hidden">
      {/* 🔹 반짝이는 배경 레이어 */}
      <div className="absolute inset-0 z-0 animate-background-glow bg-[#0d1117] before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.08)_0%,_transparent_80%)] before:animate-pulse-glow rounded-2xl" />

      {/* 🔹 실제 콘텐츠 */}
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">📈 월간 사고 발생 추세</h2>
          <div className="space-x-3 text-sm text-gray-400">
            <span className="text-[#38bdf8] font-semibold cursor-pointer">Today</span>
            <span className="hover:text-white cursor-pointer">1d</span>
            <span className="hover:text-white cursor-pointer">7d</span>
            <span className="hover:text-white cursor-pointer">1m</span>
            <span className="hover:text-white cursor-pointer">1y</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#0d1117" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#a855f7' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#a855f7"
              fillOpacity={1}
              fill="url(#colorValue)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ✨ 스타일 - 배경 반짝 */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.02);
          }
        }

        .animate-background-glow::before {
          animation: pulseGlow 4s ease-in-out infinite;
          border-radius: 1rem;
        }
      `}</style>
    </div>
  );
};
