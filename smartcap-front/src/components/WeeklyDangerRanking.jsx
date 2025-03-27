import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export const WeeklyDangerRanking = () => {
  const devices = [
    { id: 'Helmet A', score: 92, change: -1.5 },
    { id: 'Helmet B', score: 81, change: 3.2 },
    { id: 'Helmet C', score: 74, change: 0.8 },
  ];

  const formatChange = (value) => {
    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUp : ArrowDown;
    const color = isPositive ? "text-green-400" : "text-red-400";
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        <Icon size={14} />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="bg-zinc-900 text-white rounded-2xl shadow-lg p-4">
      <h2 className="text-lg font-semibold mb-4">🏆 위험도 순위</h2>
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-zinc-400">
            <th className="py-2">#</th>
            <th>장비</th>
            <th>위험도</th>
            <th>변화율</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d, idx) => (
            <tr key={d.id} className="border-t border-zinc-800">
              <td className="py-2">{idx + 1}</td>
              <td>{d.id}</td>
              <td>{d.score}%</td>
              <td>{formatChange(d.change)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
