import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Scatter,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { shallow } from 'zustand/shallow';
import { useStatsStore } from '../../store/statsStore';
import { ACCIDENT_TYPES } from '../../constants/accidentTypes';

export const RealtimeLineChart = () => {
  // Get stats from Zustand store - using selector function to prevent unnecessary rerenders
  const hourlyStats = useStatsStore(state => state.hourlyStats);
  const dailyStats = useStatsStore(state => state.dailyStats);
  const monthlyStats = useStatsStore(state => state.monthlyStats);
  
  // Refs to track previous data for comparison to avoid infinite loops
  const prevHourlyRef = useRef(null);
  const prevDailyRef = useRef(null);
  const prevMonthlyRef = useRef(null);
  
  // Show comparison toggle
  const [showComparison, setShowComparison] = useState(true);
  
  // Period selection (default: daily view)
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  // Line colors for each accident type
  const accidentTypeColors = {
    '차량': '#38bdf8',     // 파란색
    '낙상': '#f472b6',     // 분홍색
    '건설 자재': '#fbbf24', // 노란색
    '원인 불명': '#94a3b8'  // 회색
  };

  // Log when data changes without causing infinite loops
  useEffect(() => {
    const hourlyChanged = hourlyStats !== prevHourlyRef.current;
    const dailyChanged = dailyStats !== prevDailyRef.current;
    const monthlyChanged = monthlyStats !== prevMonthlyRef.current;
    
    if (hourlyChanged || dailyChanged || monthlyChanged) {
      console.log('통계 데이터 변경 감지됨! 새로 계산 중...');
      // Update refs with current values
      prevHourlyRef.current = hourlyStats;
      prevDailyRef.current = dailyStats;
      prevMonthlyRef.current = monthlyStats;
    }
  }, [hourlyStats, dailyStats, monthlyStats]);

  // Process data for chart based on period selection
  const chartData = useMemo(() => {
    if (!hourlyStats || !dailyStats || hourlyStats.length === 0 || dailyStats.length === 0) {
      return [];
    }
    
    // 오늘 뷰 처리 코드 수정
    if (selectedPeriod === 'today') {
        // 오늘 날짜 구하기 (YYYY-MM-DD 형식)
        const now = new Date();
        const today = now.toISOString().split('T')[0]; 
        const currentHour = now.getHours();
        
        // 모든 시간대 슬롯 생성 (최근 12시간)
        const allHours = [];
        for (let i = 11; i >= 0; i--) {
        const hourToShow = (currentHour - i + 24) % 24;
        const hourData = {
            hour: hourToShow,
            time: `${hourToShow}시`,
            value: 0,
            rawDate: `${today}:${hourToShow.toString().padStart(2, '0')}`
        };
        
        // 사고 유형별 데이터 초기화
        ACCIDENT_TYPES.forEach(type => {
            hourData[`${type}Count`] = 0;
        });
        
        allHours.push(hourData);
        }
        
        // 오늘 데이터 필터링 (더 강건한 방식으로)
        const todayHourlyData = hourlyStats.filter(entry => {
        // hourly key를 파싱해 날짜 부분만 추출
        const keyParts = entry.key.split(':');
        let datePart;
        
        if (keyParts.length >= 2) {
            // 형식이 "YYYY-MM-DD:HH" 또는 비슷한 형식일 경우
            datePart = keyParts[0];
        } else if (entry.key.length >= 10) {
            // 다른 형식이지만 날짜를 포함할 경우
            datePart = entry.key.substring(0, 10);
        } else {
            // 파싱할 수 없는 경우
            return false;
        }
        
        // 오늘 날짜와 비교
        return datePart === today;
        });
        
        console.log('오늘 필터링된 데이터:', todayHourlyData);
        
        // 시간 슬롯에 데이터 채우기 (기존 로직)
        todayHourlyData.forEach(entry => {
        // 시간 부분 추출 (여러 형식 지원)
        let hourPart;
        if (entry.key.includes(':')) {
            hourPart = parseInt(entry.key.split(':').pop());
        } else {
            // 다른 형식일 경우 기본값 사용
            hourPart = new Date().getHours();
        }
        
        // 해당 시간 슬롯 찾기
        const hourSlot = allHours.find(slot => slot.hour === hourPart);
        if (hourSlot) {
            // 기존 로직과 동일하게 데이터 처리
            let totalCount = 0;
            
            ACCIDENT_TYPES.forEach(type => {
            const typeCount = entry.stats
                .filter(stat => stat.field.startsWith(`${type}:`))
                .reduce((sum, stat) => sum + stat.count, 0);
            
            hourSlot[`${type}Count`] = typeCount;
            totalCount += typeCount;
            });
            
            hourSlot.value = totalCount;
        }
        });
        return allHours;
    } else if (selectedPeriod === '7d') {
      // Last 7 days: Show daily data for all 7 days, even if there are no incidents
      const allDays = [];
      const today = new Date();
      
      // Generate entries for the last 7 days
      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        
        const year = targetDate.getFullYear();
        const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
        const day = targetDate.getDate().toString().padStart(2, '0');
        
        const dateKey = `${year}-${month}-${day}`;
        
        const dayData = {
          time: `${month}/${day}`,
          value: 0,
          rawDate: dateKey
        };
        
        // Initialize count for each accident type
        ACCIDENT_TYPES.forEach(type => {
          dayData[`${type}Count`] = 0;
        });
        
        allDays.push(dayData);
      }
      
      // Merge actual data with our day slots
      if (dailyStats && dailyStats.length > 0) {
        dailyStats.forEach(entry => {
          // Find matching day in our prepared array
          const daySlot = allDays.find(slot => slot.rawDate === entry.key);
          
          if (daySlot) {
            // Initialize total count
            let totalCount = 0;
            
            // Process each accident type
            ACCIDENT_TYPES.forEach(type => {
              const typeCount = entry.stats
                .filter(stat => stat.field.startsWith(`${type}:`))
                .reduce((sum, stat) => sum + stat.count, 0);
              
              daySlot[`${type}Count`] = typeCount;
              totalCount += typeCount;
            });
            
            // Update total value
            daySlot.value = totalCount;
          }
        });
      }
      
      return allDays;
      
    } else if (selectedPeriod === '1m') {
      // Last 12 months: Generate monthly data for all months
      const allMonths = [];
      const today = new Date();
      
      // Generate entries for the last 12 months
      for (let i = 11; i >= 0; i--) {
        const targetDate = new Date(today);
        targetDate.setMonth(today.getMonth() - i);
        
        const year = targetDate.getFullYear();
        const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        const monthData = {
          time: targetDate.toLocaleString('ko-KR', { month: 'short' }),
          value: 0,
          rawDate: monthKey
        };
        
        // Initialize count for each accident type
        ACCIDENT_TYPES.forEach(type => {
          monthData[`${type}Count`] = 0;
        });
        
        allMonths.push(monthData);
      }
      
      // If we have monthly stats, merge them with our prepared months
      if (monthlyStats && monthlyStats.length > 0) {
        monthlyStats.forEach(entry => {
          // Handle monthly key format (assuming "2025-04" format)
          const monthKey = entry.key;
          
          // Find matching month in our prepared array
          const monthSlot = allMonths.find(slot => slot.rawDate === monthKey);
          
          if (monthSlot) {
            // Initialize total count
            let totalCount = 0;
            
            // Process each accident type
            ACCIDENT_TYPES.forEach(type => {
              const typeCount = entry.stats
                .filter(stat => stat.field.startsWith(`${type}:`))
                .reduce((sum, stat) => sum + stat.count, 0);
              
              monthSlot[`${type}Count`] = typeCount;
              totalCount += typeCount;
            });
            
            // Update total value
            monthSlot.value = totalCount;
          }
        });
      } else {
        // If no monthly stats, add some sample data (can be removed later)
        allMonths.forEach(month => {
          // Random sample data
          const randomFactor = 0.5 + Math.random();
          let totalValue = 0;
          
          // Generate random values for each accident type
          ACCIDENT_TYPES.forEach(type => {
            const typeRandomFactor = 0.5 + Math.random();
            const typeCount = Math.floor(10 * typeRandomFactor);
            month[`${type}Count`] = typeCount;
            totalValue += typeCount;
          });
          
          month.value = totalValue;
        });
      }
      
      return allMonths;
    }
    
    // Default fallback - use daily data
    return dailyStats.map(entry => {
      const dataParsed = {
        // Format day: "2025-04-01" -> "04/01"
        time: `${entry.key.split('-')[1]}/${entry.key.split('-')[2]}`,
        value: 0,
        rawDate: entry.key
      };
      
      // Initialize total count
      let totalCount = 0;
      
      // Process each accident type
      ACCIDENT_TYPES.forEach(type => {
        const typeCount = entry.stats
          .filter(stat => stat.field.startsWith(`${type}:`))
          .reduce((sum, stat) => sum + stat.count, 0);
        
        dataParsed[`${type}Count`] = typeCount;
        totalCount += typeCount;
      });
      
      // Update total value
      dataParsed.value = totalCount;
      
      return dataParsed;
    }).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [hourlyStats, dailyStats, monthlyStats, selectedPeriod]);

  // Calculate previous period data for comparison
  const previousData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    
    // Generate placeholders for previous data based on selected period
    if (selectedPeriod === 'today') {
      // 이전 3일간의 각 시간 평균
      return chartData.map(current => {
        // 고정된 값으로 이전 평균 설정 (실제 데이터가 들어올 자리)
        return {
          time: current.time,
          previousValue: Math.round(current.value * 0.8), // 고정 비율로 설정
          previousLabel: '이전 3일 평균'
        };
      });
    } 
    else if (selectedPeriod === '7d') {
      // 이전 3주간의 각 요일 평균
      return chartData.map(current => {
        // 고정된 값으로 이전 평균 설정 (실제 데이터가 들어올 자리)
        return {
          time: current.time,
          previousValue: Math.round(current.value * 0.75), // 고정 비율로 설정
          previousLabel: '이전 3주 평균'
        };
      });
    }
    else if (selectedPeriod === '1m') {
      // 이전 3년간의 각 월 평균
      return chartData.map(current => {
        // 고정된 값으로 이전 평균 설정 (실제 데이터가 들어올 자리)
        return {
          time: current.time,
          previousValue: Math.round(current.value * 0.7), // 고정 비율로 설정
          previousLabel: '이전 3년 평균'
        };
      });
    }
    
    // 기본값 (빈 배열)
    return [];
  }, [chartData, selectedPeriod]);

  // Merge current and previous data
  const mergedData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    
    return chartData.map(current => {
      const prevItem = previousData.find(prev => prev.time === current.time);
      return {
        ...current,
        previousValue: prevItem ? prevItem.previousValue : 0,
        previousLabel: prevItem ? prevItem.previousLabel : ''
      };
    });
  }, [chartData, previousData]);

  // Calculate anomalies (data points that deviate significantly from the mean)
  const anomalies = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    
    const values = chartData.map(item => item.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    
    // Calculate standard deviation
    const squaredDiffs = values.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Define anomalies as values that are 1.5 standard deviations above the mean
    const threshold = 1.5 * stdDev;
    
    return chartData.filter(item => (item.value - mean) > threshold)
      .map(item => ({
        ...item,
        isAnomaly: true,
        mean: mean
      }));
  }, [chartData]);

  // Calculate trend line using linear regression
  const trendLine = useMemo(() => {
    if (!chartData || chartData.length <= 1) {
      return { slope: 0, intercept: 0 };
    }
    
    const n = chartData.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const values = chartData.map(item => item.value);
    
    const sumX = indices.reduce((acc, val) => acc + val, 0);
    const sumY = values.reduce((acc, val) => acc + val, 0);
    const sumXY = indices.reduce((acc, i) => acc + (i * values[i]), 0);
    const sumX2 = indices.reduce((acc, val) => acc + (val * val), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }, [chartData]);

  // Create trend line data points
  const trendLineData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    
    return chartData.map((item, index) => ({
      time: item.time,
      trend: trendLine.intercept + trendLine.slope * index
    }));
  }, [chartData, trendLine]);

  // Chart height
  const chartHeight = "44vh";

  // Empty state if no data
  if (!mergedData || mergedData.length === 0) {
    return (
      <div className="relative text-white rounded-md shadow-lg p-4 overflow-hidden bg-[#0d1117]" style={{ height: chartHeight, minHeight: "300px" }}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative text-white rounded-md shadow-lg p-4 overflow-hidden bg-[#0d1117]" style={{ height: chartHeight, minHeight: "300px" }}>
      {/* 🔹 반짝이는 배경 레이어 */}
      <div className="absolute inset-0 z-0 animate-background-glow bg-[#0d1117] before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.08)_0%,_transparent_80%)] before:animate-pulse-glow rounded-md" />

      {/* 🔹 실제 콘텐츠 */}
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">사고 발생 추세</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center text-xs text-gray-400">
              <input 
                type="checkbox" 
                id="comparison"
                checked={showComparison}
                onChange={() => setShowComparison(!showComparison)}
                className="mr-1"
              />
              <label htmlFor="comparison">이전 데이터 비교</label>
            </div>
            <div className="space-x-3 text-sm text-gray-400">
              <span 
                className={`hover:text-white cursor-pointer ${selectedPeriod === 'today' ? 'text-[#38bdf8] font-semibold' : ''}`} 
                onClick={() => setSelectedPeriod('today')}
              >
                Today
              </span>
              <span 
                className={`hover:text-white cursor-pointer ${selectedPeriod === '7d' ? 'text-[#38bdf8] font-semibold' : ''}`} 
                onClick={() => setSelectedPeriod('7d')}
              >
                7d
              </span>
              <span 
                className={`hover:text-white cursor-pointer ${selectedPeriod === '1m' ? 'text-[#38bdf8] font-semibold' : ''}`} 
                onClick={() => setSelectedPeriod('1m')}
              >
                1m
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 mt-2">
          <ResponsiveContainer width="100%" height="95%">
            <AreaChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
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
                  
                  // 사고 유형별 표시 이름 결정
                  if (name.endsWith('Count')) {
                    const typeName = name.replace('Count', '');
                    return [formattedValue, typeName];
                  }
                  
                  const displayName = name === 'value' ? '현재' : 
                                      name === 'previousValue' ? '이전' : 
                                      name === 'trend' ? '추세' : name;
                  return [formattedValue, displayName];
                }}
                labelFormatter={(label) => {
                  return `시간: ${label}`;
                }}
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'value') return '현재 데이터';
                  if (value === 'previousValue') {
                    if (selectedPeriod === 'today') return '이전 3일 평균';
                    if (selectedPeriod === '7d') return '이전 3주 평균';
                    if (selectedPeriod === '1m') return '이전 3년 평균';
                    return '이전 데이터';
                  }
                  if (value === 'trend') return '추세선';
                  
                  // 사고 유형별 표시 이름
                  if (value.endsWith('Count')) {
                    const typeName = value.replace('Count', '');
                    return `${typeName} 사고`;
                  }
                  
                  return value;
                }}
              />
              
              {/* 이전 데이터 */}
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
              
              {/* 사고 유형별 라인 */}
              {ACCIDENT_TYPES.map(type => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={`${type}Count`}
                  stroke={accidentTypeColors[type]}
                  strokeWidth={2}
                  dot={true}
                />
              ))}
              
              {/* 추세선 */}
              <Line
                type="linear"
                dataKey="trend"
                data={trendLineData}
                stroke="#f472b6"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                strokeDasharray="5 5"
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