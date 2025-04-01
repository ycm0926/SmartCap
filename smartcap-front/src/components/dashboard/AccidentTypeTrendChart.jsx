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
import { useAlarmStore } from '../../store/alarmStore';

export const AccidentTypeTrendChart = () => {
  const alarms = useAlarmStore((state) => state.alarms);
  const [period, setPeriod] = useState('day'); // 'day', 'week', 'month'
  const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'low', 'high', 'accident'
  
  // 알람 타입과 인식 타입 정의 (영어)
  const alarm_types = ["Warning", "Danger", "Accident"];
  const recognized_types = ["Material", "Vehicle", "Falling", "Unknown Cause"];
  
  // 알람 타입별 표시 이름
  const typeNames = {
    "Warning": "경고",
    "Danger": "위험",
    "Accident": "사고",
  };
  
  // 인식 타입별 표시 이름
  const recognizedTypeNames = {
    "Material": "자재",
    "Vehicle": "차량",
    "Falling": "낙상",
    "Unknown Cause": "원인 미상"
  };
  
  // 위험도 수준별 필터링
  const filterAlarmsByRiskLevel = (alarmList) => {
    if (riskFilter === 'all') return alarmList;
    
    return alarmList.filter(alarm => {
      if (riskFilter === 'low') return alarm.alarm_type === "Warning"; 
      if (riskFilter === 'high') return alarm.alarm_type === "Danger"; 
      if (riskFilter === 'accident') return alarm.alarm_type === "Accident"; 
      return true;
    });
  };
  
  // 기간별 데이터 집계 함수
  const aggregateDataByPeriod = (alarmList) => {
    const now = new Date();
    let filteredAlarms;
    let previousPeriodAlarms = [];
    let periodLabel;
    
    // 현재 기간 필터링
    if (period === 'day') {
      // 오늘 데이터
      filteredAlarms = alarmList.filter(alarm => {
        const alarmDate = new Date(alarm.created_at);
        return alarmDate.getDate() === now.getDate() &&
               alarmDate.getMonth() === now.getMonth() &&
               alarmDate.getFullYear() === now.getFullYear();
      });
      
      // 이전 7일 평균 데이터 (오늘 제외)
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(now.getDate() - 7);
      
      previousPeriodAlarms = alarmList.filter(alarm => {
        const alarmDate = new Date(alarm.created_at);
        return alarmDate >= oneWeekAgo && 
               (alarmDate.getDate() !== now.getDate() || 
                alarmDate.getMonth() !== now.getMonth() || 
                alarmDate.getFullYear() !== now.getFullYear());
      });
      
      periodLabel = "일간";
    } else if (period === 'week') {
      // 이번 주 데이터 (일요일~토요일)
      const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      
      filteredAlarms = alarmList.filter(alarm => {
        const alarmDate = new Date(alarm.created_at);
        return alarmDate >= startOfWeek;
      });
      
      // 이전 4주 평균 데이터
      const fiveWeeksAgo = new Date(startOfWeek);
      fiveWeeksAgo.setDate(startOfWeek.getDate() - 28);
      
      const fourWeeksAgo = new Date(startOfWeek);
      fourWeeksAgo.setDate(startOfWeek.getDate() - 7);
      
      previousPeriodAlarms = alarmList.filter(alarm => {
        const alarmDate = new Date(alarm.created_at);
        return alarmDate >= fiveWeeksAgo && alarmDate < fourWeeksAgo;
      });
      
      periodLabel = "주간";
    } else { // month
      // 현재 연도와 월을 가져옴
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // 이번 달의 첫날과 마지막 날 설정
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
      
      // 이번 달 데이터
      filteredAlarms = alarmList.filter(alarm => {
        const alarmDate = new Date(alarm.created_at);
        return alarmDate >= firstDayOfMonth && alarmDate <= lastDayOfMonth;
      });
      
      // 이전 3개월 데이터 수집 (각 월별로 누적)
      for (let i = 1; i <= 3; i++) {
        // i개월 전의 첫날과 마지막날
        const prevMonthFirstDay = new Date(currentYear, currentMonth - i, 1);
        const prevMonthLastDay = new Date(currentYear, currentMonth - i + 1, 0);
        
        // 해당 월의 데이터를 이전 기간 데이터에 추가
        const monthData = alarmList.filter(alarm => {
          const alarmDate = new Date(alarm.created_at);
          return alarmDate >= prevMonthFirstDay && alarmDate <= prevMonthLastDay;
        });
        
        previousPeriodAlarms = [...previousPeriodAlarms, ...monthData];
      }
      
      periodLabel = "월간";
    }
    
    // 인식 타입별로 집계
    const currentCounts = {};
    const previousCounts = {};
    
    recognized_types.forEach(type => {
      currentCounts[type] = filteredAlarms.filter(alarm => alarm.recognized_type === type).length;
      
      // 이전 기간 평균 계산
      const prevCount = previousPeriodAlarms.filter(alarm => alarm.recognized_type === type).length;
      
      if (period === 'day') {
        // 7일간의 일평균
        previousCounts[type] = prevCount / 7;
      } else if (period === 'week') {
        // 4주간의 주평균
        previousCounts[type] = prevCount / 4;
      } else { // month
        // 3개월간의 월평균
        previousCounts[type] = prevCount / 3;
      }
    });
    
    // 차트 데이터 포맷
    return {
      data: recognized_types.map(type => {
        const current = currentCounts[type] || 0;
        const previous = previousCounts[type] || 0;
        const percentChange = previous > 0 
          ? ((current - previous) / previous) * 100
          : current > 0 ? 100 : 0;
          
        return {
          name: recognizedTypeNames[type] || type,
          current: Math.round(current),
          previous: Math.round(previous * 10) / 10, // 소수점 첫째자리까지
          percentChange: Math.round(percentChange * 10) / 10
        };
      }),
      periodLabel
    };
  };
  
  // 필터링 및 집계된 데이터
  const chartData = useMemo(() => {
    if (!alarms || alarms.length === 0) {
      return { data: [], periodLabel: "일간" };
    }
    const filteredAlarms = filterAlarmsByRiskLevel(alarms);
    return aggregateDataByPeriod(filteredAlarms);
  }, [alarms, period, riskFilter]);
  
  // 컴포넌트 높이
  const chartHeight = "60vh";
  
  // 막대 색상 (현재, 이전)
  const currentBarColor = "#3B82F6"; // 파란색
  const previousBarColor = "#9CA3AF"; // 회색
  
  // 위험도 필터 레이블
  const riskFilterLabels = {
    'all': '전체',
    'low': '경고',
    'high': '위험',
    'accident': '사고'
  };
  
  // 알람 개수가 없을 때 메시지 표시
  if (!alarms || alarms.length === 0) {
    return (
      <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4 flex items-center justify-center" style={{ height: chartHeight, minHeight: "300px" }}>
        <div className="text-center text-gray-400">
          <AlertTriangle size={24} className="mx-auto mb-2" />
          <p>알람 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4" style={{ height: chartHeight, minHeight: "300px" }}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold">위험 유형별 발생 현황 ({chartData.periodLabel})</h2>
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
      
      {/* 필터 섹션 */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center mr-1">
          <Filter size={14} className="mr-1" />
          <span>위험도:</span>
        </div>
        
        {Object.entries(riskFilterLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRiskFilter(key)}
            className={`px-2 py-1 rounded ${
              riskFilter === key ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
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
              barGap={10}
              barCategoryGap={40}
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
                  if (name === 'current') return [value, '현재'];
                  if (name === 'previous') return [value, '이전 평균'];
                  return [value, name];
                }}
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'current') return '현재';
                  if (value === 'previous') return '이전 평균';
                  return value;
                }}
                wrapperStyle={{ paddingTop: '10px' }}
              />
              <Bar 
                dataKey="previous" 
                name="이전 평균" 
                fill={previousBarColor}
                radius={[4, 4, 0, 0]}
              >
                <LabelList 
                  dataKey="previous" 
                  position="top" 
                  fill="#9ca3af" 
                  fontSize={12}
                  formatter={(value) => value > 0 ? value : ''}
                />
              </Bar>
              <Bar 
                dataKey="current" 
                name="현재" 
                fill={currentBarColor}
                radius={[4, 4, 0, 0]}
              >
                <LabelList 
                  dataKey="current" 
                  position="top" 
                  fill="#3B82F6" 
                  fontSize={12}
                  formatter={(value) => value > 0 ? value : ''}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* 변화율 표시 */}
        <div className="grid grid-cols-4 gap-4 mt-3 text-xs">
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