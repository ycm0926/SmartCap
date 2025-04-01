import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Scatter,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

export const RealtimeLineChart = () => {
  // 알람 데이터를 시간 기준으로 집계하는 함수
  const aggregateAlarmsByDay = (alarms) => {
    const aggregated = {};
    
    alarms.forEach(alarm => {
      const date = new Date(alarm.created_at);
      const dayKey = `${String(date.getDate()).padStart(2, '0')} Nov`;
      
      if (!aggregated[dayKey]) {
        aggregated[dayKey] = { time: dayKey, value: 0 };
      }
      
      aggregated[dayKey].value += 1;
    });
    
    // 빈 날짜 채우기 (1~7일)
    for (let i = 1; i <= 7; i++) {
      const dayKey = `${String(i).padStart(2, '0')} Nov`;
      if (!aggregated[dayKey]) {
        aggregated[dayKey] = { time: dayKey, value: 0 };
      }
    }
    
    // 날짜순으로 정렬
    return Object.values(aggregated).sort((a, b) => {
      return parseInt(a.time) - parseInt(b.time);
    });
  };

  // 샘플 현재 달 알람 데이터
  const [currentMonthAlarms] = useState([
    // 샘플 알람 데이터를 날짜별로 분포하여 생성
    { alarm_id: 1, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [126.97, 37.56] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-01T09:10:00.000Z" },
    { alarm_id: 2, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [126.98, 37.55] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-11-01T14:20:00.000Z" },
    { alarm_id: 3, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [126.99, 37.57] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-11-02T10:30:00.000Z" },
    // 더 많은 데이터 포인트 추가
    { alarm_id: 4, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.00, 37.54] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-02T15:40:00.000Z" },
    { alarm_id: 5, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.01, 37.53] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-11-03T11:50:00.000Z" },
    { alarm_id: 6, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.02, 37.52] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-11-03T16:00:00.000Z" },
    { alarm_id: 7, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.03, 37.51] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-04T10:10:00.000Z" },
    { alarm_id: 8, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.04, 37.50] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-11-05T14:20:00.000Z" },
    { alarm_id: 9, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.05, 37.49] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-11-05T09:30:00.000Z" },
    { alarm_id: 10, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.06, 37.48] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-05T15:40:00.000Z" },
    { alarm_id: 11, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.07, 37.47] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-11-06T11:50:00.000Z" },
    { alarm_id: 12, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.08, 37.46] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-11-06T16:00:00.000Z" },
    { alarm_id: 13, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.09, 37.45] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-07T10:10:00.000Z" },
    { alarm_id: 14, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.10, 37.44] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-11-07T14:20:00.000Z" },
    { alarm_id: 15, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.11, 37.43] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-11-07T09:30:00.000Z" },
    // 이상치 데이터 포인트 추가 (매우 높은 값)
    { alarm_id: 16, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.12, 37.42] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-04T08:40:00.000Z" },
    { alarm_id: 17, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.12, 37.42] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-04T09:40:00.000Z" },
    { alarm_id: 18, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.12, 37.42] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-04T10:40:00.000Z" },
    { alarm_id: 19, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.12, 37.42] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-11-04T11:40:00.000Z" },
  ]);

  // 샘플 이전 달 알람 데이터
  const [previousMonthAlarms] = useState([
    // 이전 달 데이터는 현재보다 약간 적게 설정
    { alarm_id: 101, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [126.97, 37.56] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-10-01T09:10:00.000Z" },
    { alarm_id: 102, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [126.98, 37.55] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-10-01T14:20:00.000Z" },
    { alarm_id: 103, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [126.99, 37.57] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-10-02T10:30:00.000Z" },
    { alarm_id: 104, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.00, 37.54] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-10-03T15:40:00.000Z" },
    { alarm_id: 105, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.01, 37.53] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-10-03T11:50:00.000Z" },
    { alarm_id: 106, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.02, 37.52] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-10-04T16:00:00.000Z" },
    { alarm_id: 107, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.03, 37.51] },
      alarm_type: "FALL", recognized_type: "WORKER", 
      created_at: "2023-10-05T10:10:00.000Z" },
    { alarm_id: 108, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.04, 37.50] },
      alarm_type: "DANGER_ZONE", recognized_type: "VEHICLE", 
      created_at: "2023-10-06T14:20:00.000Z" },
    { alarm_id: 109, construction_sites_id: 1, weather_id: 1, 
      gps: { type: "Point", coordinates: [127.05, 37.49] },
      alarm_type: "EQUIPMENT", recognized_type: "CRANE", 
      created_at: "2023-10-07T09:30:00.000Z" },
  ]);

  // 표시 기간 상태 (기본값: 7일)
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  
  // 비교 데이터 표시 여부
  const [showComparison, setShowComparison] = useState(true);

  // 집계된 데이터
  const currentData = useMemo(() => aggregateAlarmsByDay(currentMonthAlarms), [currentMonthAlarms]);
  const previousData = useMemo(() => aggregateAlarmsByDay(previousMonthAlarms), [previousMonthAlarms]);

  // 두 데이터셋 병합 (차트에서 함께 표시하기 위함)
  const mergedData = useMemo(() => {
    return currentData.map(current => {
      const prevItem = previousData.find(prev => prev.time === current.time);
      return {
        ...current,
        previousValue: prevItem ? prevItem.value : 0
      };
    });
  }, [currentData, previousData]);

  // 이상치 감지
  const anomalies = useMemo(() => {
    const values = currentData.map(item => item.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    
    // 표준편차 계산
    const squaredDiffs = values.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // 이상치 기준: 평균에서 1.5 표준편차 이상 벗어난 값
    const threshold = 1.5 * stdDev;
    
    return currentData.filter(item => Math.abs(item.value - mean) > threshold)
      .map(item => ({
        ...item,
        isAnomaly: true,
        mean: mean
      }));
  }, [currentData]);

  // 추세선 계산 (선형 회귀)
  const trendLine = useMemo(() => {
    const n = currentData.length;
    if (n <= 1) return { slope: 0, intercept: 0 };
    
    const indices = Array.from({ length: n }, (_, i) => i);
    const values = currentData.map(item => item.value);
    
    const sumX = indices.reduce((acc, val) => acc + val, 0);
    const sumY = values.reduce((acc, val) => acc + val, 0);
    const sumXY = indices.reduce((acc, i) => acc + (i * values[i]), 0);
    const sumX2 = indices.reduce((acc, val) => acc + (val * val), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }, [currentData]);

  // 추세선 데이터 포인트 생성
  const trendLineData = useMemo(() => {
    return currentData.map((item, index) => ({
      time: item.time,
      trend: trendLine.intercept + trendLine.slope * index
    }));
  }, [currentData, trendLine]);

  // 차트 높이 설정
  const chartHeight = "60vh";

  // 선택된 기간에 따라 필터링된 데이터 
  const filteredData = useMemo(() => {
    // 실제 구현에서는 날짜 범위에 따라 필터링
    return mergedData;
  }, [mergedData, selectedPeriod]);

  return (
    <div className="relative text-white rounded-md shadow-lg p-4 overflow-hidden bg-[#0d1117]" style={{ height: chartHeight, minHeight: "300px" }}>
      {/* 🔹 반짝이는 배경 레이어 */}
      <div className="absolute inset-0 z-0 animate-background-glow bg-[#0d1117] before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.08)_0%,_transparent_80%)] before:animate-pulse-glow rounded-md" />

      {/* 🔹 실제 콘텐츠 */}
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">월간 사고 발생 추세</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center text-xs text-gray-400">
              <input 
                type="checkbox" 
                id="comparison"
                checked={showComparison}
                onChange={() => setShowComparison(!showComparison)}
                className="mr-1"
              />
              <label htmlFor="comparison">전월 데이터 비교</label>
            </div>
            <div className="space-x-3 text-sm text-gray-400">
              <span className="text-[#38bdf8] font-semibold cursor-pointer">Today</span>
              <span className={`hover:text-white cursor-pointer ${selectedPeriod === '1d' ? 'text-white' : ''}`} onClick={() => setSelectedPeriod('1d')}>1d</span>
              <span className={`hover:text-white cursor-pointer ${selectedPeriod === '7d' ? 'text-white' : ''}`} onClick={() => setSelectedPeriod('7d')}>7d</span>
              <span className={`hover:text-white cursor-pointer ${selectedPeriod === '1m' ? 'text-white' : ''}`} onClick={() => setSelectedPeriod('1m')}>1m</span>
              <span className={`hover:text-white cursor-pointer ${selectedPeriod === '1y' ? 'text-white' : ''}`} onClick={() => setSelectedPeriod('1y')}>1y</span>
            </div>
          </div>
        </div>

        <div className="flex-1 mt-2">
          <ResponsiveContainer width="100%" height="95%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#0d1117" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b7280" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#0d1117" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" tickFormatter={(v) => `${(v).toFixed(0)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: 'none' }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(value, name) => {
                  const formattedValue = Number(value).toFixed(0);
                  const displayName = name === 'value' ? '현재' : 
                                      name === 'previousValue' ? '전월' : 
                                      name === 'trend' ? '추세' : name;
                  return [formattedValue, displayName];
                }}
              />
              <Legend 
                formatter={(value) => {
                  return value === 'value' ? '현재' : 
                        value === 'previousValue' ? '전월' : 
                        value === 'trend' ? '추세선' : value;
                }}
              />
              
              {/* 이전 달 데이터 */}
              {showComparison && (
                <Area
                  type="monotone"
                  dataKey="previousValue"
                  stroke="#6b7280"
                  strokeDasharray="3 3"
                  fillOpacity={0.3}
                  fill="url(#colorPrevious)"
                  strokeWidth={2}
                />
              )}
              
              {/* 현재 데이터 */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#a855f7"
                fillOpacity={1}
                fill="url(#colorValue)"
                strokeWidth={3}
              />
              
              {/* 추세선 */}
              <Line
                type="linear"
                dataKey="trend"
                data={trendLineData}
                stroke="#f472b6"
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
              
              {/* 이상치 표시 */}
              {anomalies.map((anomaly, index) => (
                <Scatter
                  key={`anomaly-${index}`}
                  data={[anomaly]}
                  fill="#ff4d4f"
                  shape={(props) => {
                    const { cx, cy } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={6} fill="#ff4d4f" />
                        <circle cx={cx} cy={cy} r={10} fill="none" stroke="#ff4d4f" strokeWidth={2} opacity={0.6} />
                      </g>
                    );
                  }}
                />
              ))}
              
              {/* 이상치에 레퍼런스 라인 추가 */}
              {anomalies.map((anomaly, index) => (
                <ReferenceLine
                  key={`ref-line-${index}`}
                  x={anomaly.time}
                  stroke="#ff4d4f"
                  strokeDasharray="3 3"
                  label={{
                    value: '이상치',
                    position: 'insideTopRight',
                    fill: '#ff4d4f',
                    fontSize: 12
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* 차트 하단 이상치 알림 */}
        {anomalies.length > 0 && (
          <div className="mt-2 flex items-center text-xs text-red-400">
            <AlertTriangle size={14} className="mr-1" />
            <span>평균보다 높은 비정상적인 사고 발생이 감지되었습니다. 주의가 필요합니다.</span>
          </div>
        )}
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
          border-radius: 0.375rem;
        }
      `}</style>
    </div>
  );
};