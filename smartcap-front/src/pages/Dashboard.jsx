import {React, useEffect, useState} from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useStatsStore } from '../store/statsStore';

import { MonthlyDangerRanking } from '../components/dashboard/MonthlyDangerRanking.jsx';
import { RealtimeAlertBoard } from '../components/dashboard/RealtimeAlertBoard.jsx';
import { RealtimeLineChart } from '../components/dashboard/RealtimeLineChart.jsx';
import {AccidentTypeTrendChart} from '../components/dashboard/AccidentTypeTrendChart.jsx'
import { Map as MapIcon } from 'lucide-react';

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const setAllStats = useStatsStore((state) => state.setAllStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 대시보드 데이터 가져오기
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/events/dashboard`;
        
        const res = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          }
        });
        
        // 응답 디버깅
        console.log('응답 상태:', res.status);
        console.log('응답 헤더:', [...res.headers.entries()]);
        
        if (!res.ok) {
          console.error(`API 오류: ${res.status} ${res.statusText}`);
          
          // 오류 응답 내용 확인
          const errorText = await res.text();
          console.error('오류 응답:', errorText);
          
          if (res.status === 403 || res.status === 401) {
            console.error('인증 오류: 로그인이 필요합니다.');
            // 쿠키 문제 확인
            console.log('요청 시 쿠키:', document.cookie);
            setError('인증 오류: 로그인이 필요합니다.');
            //navigate('/login');
            return;
          }
          throw new Error(`API 오류: ${res.status}`);
        }
        
        const text = await res.text();
        
        // 응답이 비어있는지 확인
        if (!text || text.trim() === '') {
          console.log('빈 응답을 받았습니다.');
          setAllStats({});
          setLoading(false);
          return;
        }
        
        try {
          const data = JSON.parse(text);
          console.log("대시보드 데이터:", data);
          setAllStats(data);
          setError(null);
        } catch (parseError) {
          console.error('JSON 파싱 오류:', parseError);
          setError('데이터 형식 오류');
        }
      } catch (error) {
        console.error('데이터 가져오기 오류:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // 주기적인 데이터 갱신
    const intervalId = setInterval(fetchStats, 30000);
    
    return () => clearInterval(intervalId);
  }, [navigate, setAllStats]);

  // SSE 연결
  useEffect(() => {
    const sseUrl = `${import.meta.env.VITE_API_BASE_URL}/api/sse/stat`;
    console.log('SSE 연결 URL:', sseUrl);
    
    // withCredentials 옵션을 포함한 SSE 연결
    const eventSource = new EventSource(sseUrl, {
      withCredentials: true // 중요: 쿠키 포함
    });
  
    const updateStat = useStatsStore.getState().updateStat;
  
    eventSource.onopen = () => {
      console.log("✅ SSE 연결 성공");
    };
  
    eventSource.addEventListener('stat_update', (event) => {
      console.log("📦 stat_update 이벤트 수신:", event.data);
      try {
        const update = JSON.parse(event.data);
        updateStat(update);
  
        const newState = useStatsStore.getState();
        console.log("🆕 업데이트된 상태:", newState);
      } catch (err) {
        console.error("❌ JSON 파싱 실패", err);
      }
    });
  
    eventSource.onerror = (err) => {
      console.error("🚨 SSE 오류 발생:", err);
      // 오류 발생 시 fetch로 폴백
    };
  
    return () => {
      console.log("👋 SSE 연결 종료");
      eventSource.close();
    };
  }, []);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToMapPage = () => {
    navigate('/map');
  };
  
  // 로딩 중이거나 오류 상태일 때 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c232d] text-white flex justify-center items-center">
        <div className="text-xl">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1c232d] text-white flex flex-col justify-center items-center">
        <div className="text-xl text-red-400 mb-4">오류 발생: {error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-[#0084ff] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#0077e6]"
        >
          새로고침
        </button>
        <button 
          onClick={() => navigate('/login')}
          className="mt-4 bg-[#2c3e50] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#34495e]"
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c232d] text-white">
      {/* 🔹 헤더 */}
      <header className="flex justify-between items-center px-8 py-4 bg-[#0d1117] shadow-md">
        <h1 className="text-2xl font-bold m-0">안전 모니터링 대시보드</h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={goToMapPage}
            className="flex items-center gap-2 bg-[#2c3e50] hover:bg-[#34495e] text-white rounded px-4 py-2 text-sm transition-colors duration-200"
          >
            <MapIcon size={16} />
            안전 지도 보기
          </button>
          <button
            onClick={handleLogout}
            className="bg-[#0084ff] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#0077e6]"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 🔹 본문 */}
      <main className="p-8">
        {/* 대시보드 위젯 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-8">
            <RealtimeLineChart />
          </div>
          <div className="md:col-span-4">
            <AccidentTypeTrendChart />
          </div>
          <div className="md:col-span-5">
            <RealtimeAlertBoard />
          </div>
          <div className="md:col-span-7">
            <MonthlyDangerRanking />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;