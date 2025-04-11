import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { Calendar, Filter, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useStatsStore } from '../../store/statsStore';
import { ACCIDENT_TYPES } from '../../constants/accidentTypes';

export const AccidentTypeTrendChart = () => {
  const { hourlyStats, dailyStats, monthlyStats } = useStatsStore();
  const [period, setPeriod] = useState('day'); // 'day', 'week', 'month'
  const [alarmFilter, setAlarmFilter] = useState('all'); // 'all', '1', '2', '3'
  
  // 알람 레벨 정의 (데이터에 맞게 수정)
  const alarmLevels = ["1", "2", "3"];
  const alarmLevelNames = {
    "1": "경고",
    "2": "위험",
    "3": "사고"
  };
  
  // 필터링 함수
  const filterByAlarmLevel = (stats) => {
    if (alarmFilter === 'all') return stats;
    
    return stats.filter(stat => {
      const fieldParts = stat.field.split(':');
      return fieldParts.length > 1 && fieldParts[1] === alarmFilter;
    });
  };
  
  // 날짜를 기준으로 데이터를 내림차순 정렬하는 함수 (최신이 먼저)
  const sortDataByDate = (data) => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => new Date(b.key) - new Date(a.key));
  };
  
  // 데이터 처리 및 집계 함수
  const processDataByPeriod = () => {
    let currentData = [];
    let previousData = [];
    let periodLabel = "";
    
    // 기간에 따라 데이터 선택
    if (period === 'day') {
      // 일간 데이터: 가장 최근 날짜 데이터 사용
      if (dailyStats && dailyStats.length > 0) {
        // 날짜로 정렬
        const sortedDailyStats = sortDataByDate(dailyStats);
        
        // 가장 최근 날짜의 데이터
        const latestDaily = sortedDailyStats[0];
        
        // 이전 데이터: 최근 3일의 평균 (가장 최근 날짜 제외)
        const previousDays = sortedDailyStats.slice(1, 4); // 인덱스 1, 2, 3 (최대 3개)
        
        currentData = latestDaily.stats || [];
        
        // 이전 데이터 평균 계산
        if (previousDays.length > 0) {
          // 이전 일자들의 모든 stats 항목 수집
          const allPreviousStats = previousDays.flatMap(day => day.stats || []);
          
          // field 기준으로 그룹화하여 평균 계산
          const fieldGroups = {};
          allPreviousStats.forEach(stat => {
            if (!fieldGroups[stat.field]) {
              fieldGroups[stat.field] = [];
            }
            fieldGroups[stat.field].push(stat.count);
          });
          
          // 각 필드별 평균 계산
          previousData = Object.entries(fieldGroups).map(([field, counts]) => ({
            field,
            count: Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length)
          }));
        }
        
        periodLabel = "일간";
      }
    } else if (period === 'week') {
      // 주간 데이터: 지난 7일의 합계 vs 이전 3주의 평균
      if (dailyStats && dailyStats.length > 0) {
        // 날짜로 정렬
        const sortedDailyStats = sortDataByDate(dailyStats);
        
        // 최근 7일 데이터 수집
        const recentWeek = sortedDailyStats.slice(0, 7); // 최대 7일
        
        // 필드별로 합산
        const fieldSums = {};
        recentWeek.forEach(day => {
          (day.stats || []).forEach(stat => {
            if (!fieldSums[stat.field]) {
              fieldSums[stat.field] = 0;
            }
            fieldSums[stat.field] += stat.count;
          });
        });
        
        // 현재 데이터 포맷
        currentData = Object.entries(fieldSums).map(([field, count]) => ({
          field,
          count
        }));
        
        // 이전 3주 데이터 (21일)
        const previousWeeks = sortedDailyStats.slice(7, 28); // 인덱스 7-27 (최대 21일)
        
        if (previousWeeks.length > 0) {
          // 필드별로 합산 후 3으로 나누어 주 평균 계산
          const fieldSums = {};
          previousWeeks.forEach(day => {
            (day.stats || []).forEach(stat => {
              if (!fieldSums[stat.field]) {
                fieldSums[stat.field] = 0;
              }
              fieldSums[stat.field] += stat.count;
            });
          });
          
          // 현재 데이터 포맷 (주 평균) - 소수점 반올림
          previousData = Object.entries(fieldSums).map(([field, count]) => ({
            field,
            count: Math.round(count / 3) // 3주 평균, 정수로 반올림
          }));
        }
        
        periodLabel = "주간";
      }
    } else { // month
      // 월간 데이터: 이번 달 vs 이전 3개월 평균
      if (monthlyStats && monthlyStats.length > 0) {
        // 날짜로 정렬
        const sortedMonthlyStats = sortDataByDate(monthlyStats);
        
        // 현재 월 데이터 (인덱스 0)
        const currentMonth = sortedMonthlyStats[0];
        
        // 이전 3개월 데이터 (인덱스 1-3)
        const previousMonths = sortedMonthlyStats.slice(1, 4);
        
        currentData = currentMonth.stats || [];
        
        // 이전 데이터 평균 계산
        if (previousMonths.length > 0) {
          // 이전 월들의 모든 stats 항목 수집
          const allPreviousStats = previousMonths.flatMap(month => month.stats || []);
          
          // field 기준으로 그룹화하여 평균 계산
          const fieldGroups = {};
          allPreviousStats.forEach(stat => {
            if (!fieldGroups[stat.field]) {
              fieldGroups[stat.field] = [];
            }
            fieldGroups[stat.field].push(stat.count);
          });
          
          // 각 필드별 평균 계산 - 소수점 반올림
          previousData = Object.entries(fieldGroups).map(([field, counts]) => ({
            field,
            count: Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length)
          }));
        }
        
        periodLabel = "월간";
      }
    }
    
    // 필터링 적용
    currentData = filterByAlarmLevel(currentData);
    previousData = filterByAlarmLevel(previousData);
    
    // 결과 데이터 처리
    const result = processChartData(currentData, previousData);
    
    return {
      data: result,
      periodLabel
    };
  };
  
  // 먼저 기존 processChartData 함수를 수정하여 레벨별로 데이터를 분리합니다.
  const processChartData = (currentData, previousData) => {
    // 사고 타입별로 데이터 집계
    const typeData = {};
    
    // ACCIDENT_TYPES를 기반으로 초기 데이터 구성
    ACCIDENT_TYPES.forEach((typeName) => {
      typeData[typeName] = {
        name: typeName,
        current: 0,
        previous: 0,
        level1: 0,  // 1단계 알람 (노랑)
        level2: 0,  // 2단계 알람 (주황)
        level3: 0,  // 3단계 알람 (빨강)
        percentChange: 0
      };
    });
    
    // 현재 데이터를 레벨별로 분리하여 합산
    currentData.forEach(stat => {
      const [type, level] = stat.field.split(':');
      // ACCIDENT_TYPES에 포함된 타입만 처리
      if (ACCIDENT_TYPES.includes(type)) {
        // 전체 합계는 유지
        typeData[type].current += stat.count;
        
        // 레벨별로 데이터 분리
        if (level === '1') {
          typeData[type].level1 += stat.count;
        } else if (level === '2') {
          typeData[type].level2 += stat.count;
        } else if (level === '3') {
          typeData[type].level3 += stat.count;
        }
      }
    });
    
    // 이전 데이터 합산 (실제 필드 형식에 맞게 수정)
    previousData.forEach(stat => {
      const [type] = stat.field.split(':');
      // ACCIDENT_TYPES에 포함된 타입만 처리
      if (ACCIDENT_TYPES.includes(type)) {
        typeData[type].previous += stat.count;
      }
    });
    
    // 변화율 계산
    Object.values(typeData).forEach(item => {
      // 정수로 반올림 (소수점 없음)
      item.previous = Math.round(item.previous);
      
      if (item.previous > 0) {
        item.percentChange = Math.round(((item.current - item.previous) / item.previous) * 100);
      } else if (item.current > 0) {
        item.percentChange = 100;
      } else {
        item.percentChange = 0;
      }
    });
    
    return Object.values(typeData);
  };

  // 필터링 및 집계된 데이터
  const chartData = useMemo(() => {
    const result = processDataByPeriod();
    return result;
  }, [hourlyStats, dailyStats, monthlyStats, period, alarmFilter]);
  
  // 컴포넌트 높이
  const chartHeight = "44vh";
  
  // 막대 색상 (현재, 이전)
  const currentBarColor = "#3B82F6"; // 파란색
  const previousBarColor = "#9CA3AF"; // 회색
  const level1BarColor = "#ffdd00"; // 노란색 (1단계/경고)
  const level2BarColor = "#ff9500"; // 주황색 (2단계/위험)
  const level3BarColor = "#ff0000"; // 빨간색 (3단계/사고)


  // 알람 레벨 필터 레이블 (데이터에 맞게 수정)
  const alarmFilterLabels = {
    'all': '전체',
    '1': '경고',
    '2': '위험',
    '3': '사고'
  };
  
  // 데이터가 없을 때 메시지 표시
  if (!chartData.data || chartData.data.length === 0) {
    return (
      <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4 flex items-center justify-center" style={{ height: chartHeight, minHeight: "300px" }}>
        <div className="text-center text-gray-400">
          <AlertTriangle size={24} className="mx-auto mb-2" />
          <p>통계 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4" style={{ height: chartHeight, minHeight: "300px" }}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold">사고 유형별 발생 현황</h2>
        <div className="flex space-x-3 text-sm">
          <button 
            onClick={() => setPeriod('day')}
            className={`px-2 py-1 rounded ${period === 'day' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            일간
          </button>
          <button 
            onClick={() => setPeriod('week')}
            className={`px-2 py-1 rounded ${period === 'week' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            주간
          </button>
          <button 
            onClick={() => setPeriod('month')}
            className={`px-2 py-1 rounded ${period === 'month' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            월간
          </button>
        </div>
      </div>
      
      {/* 필터 섹션 - 알람 레벨 필터로 변경, 데이터에 맞게 수정 */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center mr-1">
          <Filter size={14} className="mr-1" />
          <span>알람:</span>
        </div>
        
        {Object.entries(alarmFilterLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAlarmFilter(key)}
            className={`px-2 py-1 rounded ${
              alarmFilter === key ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      <div className="h-full flex flex-col" style={{ height: "calc(100% - 80px)" }}>
        <div className="flex-1 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData.data}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              barGap={2} // 굉장히 좁은 간격으로 설정 (완전히 0으로 하지 않고 미세한 간격 유지)
              barCategoryGap={25} // 카테고리 간 간격도 조금 더 줄임
              maxBarSize={60} // 막대 최대 너비 제한
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9ca3af' }}
                axisLine={{ stroke: '#374151' }}
              />
              <YAxis 
                tick={{ fill: '#9ca3af' }}
                axisLine={{ stroke: '#374151' }}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '4px' }}
                itemStyle={{ color: '#e5e7eb' }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }}
                formatter={(value, name) => {
                  if (name === 'previous') return [value, '이전 평균'];
                  if (name === 'level1') return [value, '경고'];
                  if (name === 'level2') return [value, '위험'];
                  if (name === 'level3') return [value, '사고'];
                  return [value, name];
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} // 툴팁 배경 투명도 조정
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'previous') return '이전 평균';
                  if (value === 'level1') return '경고';
                  if (value === 'level2') return '위험';
                  if (value === 'level3') return '사고';
                  return value;
                }}
                wrapperStyle={{ paddingTop: '10px' }}
              />
              
              {/* 이전 평균 막대 */}
              <Bar 
                dataKey="previous" 
                name="previous" 
                fill={previousBarColor}
                animationDuration={1000} // 애니메이션 시간 추가
              >
                <LabelList 
                  dataKey="previous" 
                  position="top" 
                  fill="#9ca3af" 
                  fontSize={12}
                  formatter={(value) => value > 0 ? value : ''}
                />
              </Bar>
              
              {/* 레벨별 막대 - 스택 형태로 처리 */}
              <Bar 
                dataKey="level1" 
                name="level1" 
                stackId="current" 
                fill={level1BarColor} 
                animationDuration={800} // 애니메이션 시간 추가
                // 각 막대 구간 사이의 여백 없애기
                background={{ fill: 'transparent' }}
              />
              <Bar 
                dataKey="level2" 
                name="level2" 
                stackId="current"
                fill={level2BarColor}
                animationDuration={900} // 애니메이션 시간 추가
                background={{ fill: 'transparent' }}
              />
              <Bar 
                dataKey="level3" 
                name="level3" 
                stackId="current"
                fill={level3BarColor}
                animationDuration={1000} // 애니메이션 시간 추가
                background={{ fill: 'transparent' }}
              >
                <LabelList 
                  dataKey="current" 
                  position="top" 
                  fill="#ffffff" 
                  fontSize={12}
                  formatter={(value) => value > 0 ? value : ''}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>    
        </div>
        
        {/* 변화율 표시 - 소수점 제거 */}
        <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
          {chartData.data.map((item) => (
            <div key={item.name} className="bg-gray-900 p-2 rounded">
              <div className="flex justify-between items-center">
                <span className="font-medium">{item.name}</span>
                <span 
                  className={`flex items-center gap-1 ${
                    item.percentChange > 0 
                      ? 'text-red-400' 
                      : item.percentChange < 0 
                        ? 'text-green-400' 
                        : 'text-gray-400'
                  }`}
                >
                  {item.percentChange > 0 ? (
                    <TrendingUp size={14} />
                  ) : item.percentChange < 0 ? (
                    <TrendingDown size={14} />
                  ) : null}
                  <span>{item.percentChange > 0 ? '+' : ''}{item.percentChange}%</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};