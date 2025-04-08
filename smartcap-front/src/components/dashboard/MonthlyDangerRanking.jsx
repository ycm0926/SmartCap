import { useEffect } from 'react';
import React from 'react';
import { useStatsStore } from '../../store/statsStore';
import dayjs from 'dayjs';

export const MonthlyDangerRanking = () => {
  const monthlyStats = useStatsStore((state) => state.monthlyStats);
  
  // 높이를 vh 단위로 설정 (viewport height의 45%)
  const boardHeight = "39vh";

  useEffect(() => {
    console.log('통계 데이터 변경 감지됨! 새로 계산 중...');
  }, [monthlyStats]);

  // 데이터 처리 함수
  const processData = () => {
    if (!monthlyStats || monthlyStats.length === 0) {
      return [];
    }

    // 현재 달 데이터 가져오기 (배열의 첫 번째 항목이 최신이라고 가정)
    const currentMonthData = monthlyStats[0];
    
    if (!currentMonthData || !currentMonthData.stats) {
      return [];
    }

    // 필드별로 데이터 처리 (car:1, fall:2, material:3 등)
    const grouped = currentMonthData.stats.reduce((acc, stat) => {
      const [category, level] = stat.field.split(':');
      
      // 카테고리별 이름 매핑
      let displayName;
      switch (category) {
        case '차량':
          displayName = `차량 ${getLevelName(level)}`;
          break;
        case '낙상':
          displayName = `추락 ${getLevelName(level)} `;
          break;
        case '건설 자재':
          displayName = ` 건설 자재 ${getLevelName(level)} `;
          break;
        case '원인 불명':
          displayName = `원인 불명`;
          break;
        default:
          displayName = stat.field;
      }
      
      // 레벨에 대한 한글 이름 매핑 함수
      function getLevelName(level) {
        switch(level) {
          case '1': return '경고';
          case '2': return '위험';
          case '3': return '사고';
          case '4': return '경고';
          case '5': return '위험';
          case '6': return '사고';
          case '7': return '경고';
          case '8': return '위험';
          case '9': return '사고';
          default: return level || '';
        }
      }
      
      acc.push({
        name: displayName,
        value: stat.count,
        category: category,
        level: level
      });
      
      return acc;
    }, []);
    
    // 건수별 내림차순 정렬
    return grouped.sort((a, b) => b.value - a.value);
  };
  
  const data = processData();
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1; // 0 방지용 1 추가
  const max = Math.max(...data.map((d) => d.value), 1); // 0 방지용 1 추가

  // 카테고리별 색상 매핑
  const getCategoryColor = (category) => {
    switch(category) {
      case 'car': return 'bg-indigo-500'; // 차량
      case 'fall': return 'bg-rose-500';  // 추락
      case 'material': return 'bg-amber-500'; // 자재
      default: return 'bg-sky-500';
    }
  };

  // 레벨별 색상 매핑 함수 추가
  const getLevelColor = (level) => {
    // 레벨 값에 따라 색상 반환
    if (['1', '4', '7'].includes(level)) {
      return '#ffdd00'; // 경고 - 노란색
    } else if (['2', '5', '8'].includes(level)) {
      return '#ff9500'; // 위험 - 주황색
    } else if (['3', '6', '9'].includes(level)) {
      return '#ff0000'; // 사고 - 빨간색
    } else {
      return '#ff0000'; // 기본 색상
    }
  };

  return (
    <div className="bg-[#0d1117] text-white rounded-md shadow-lg p-4 relative overflow-hidden" style={{ height: boardHeight, minHeight: "300px" }}>
      {/* 배경 글로우 효과 */}
      <div className="absolute inset-0 z-0 bg-[#0d1117] before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)] rounded-md" />
      
      <div className="relative z-10 h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">월간 사고 위험 순위</h2>

        <div className="flex-1 overflow-y-auto mt-2">
          <table className="w-full text-base">
            <thead className="text-gray-400 border-b border-gray-800 text-left">
              <tr>
                <th className="pb-2">유형</th>
                <th className="pb-2">건수</th>
                <th className="pb-2 w-2/5">비율</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.name} className="border-b border-gray-800">
                  <td className="py-3 flex items-center">
                   <span 
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: getLevelColor(d.level) }}
                    ></span>
                    {d.name}
                  </td>
                  <td className="py-3">{d.value}건</td>
                  <td className="py-3">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-800 rounded-full h-2 relative overflow-hidden mr-2">
                       <div
                          className="progress-bar-glow h-2 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${(d.value / max) * 100}%`,
                            backgroundColor: getLevelColor(d.level)
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {((d.value / total) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-500">
                    이번 달 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✨ 반짝 애니메이션 스타일 */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 0.2; }
          100% { transform: translateX(100%); opacity: 0; }
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