// AlarmSSE.tsx
import { useEffect } from "react";
import { useAlarmStore } from "../store/alarmStore";
import { useNavigate, useLocation } from "react-router-dom";

export default function AlarmSSE() {
  const addAlarm = useAlarmStore((state) => state.addAlarm);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    console.log("🔄 SSE 연결 시도...");
    
    const es = new EventSource("http://localhost:8080/alarms");

    es.onopen = () => {
      console.log("✅ SSE 연결 성공!");
    };

    es.addEventListener('alarm', (event) => {
      console.log("🚨 알람 이벤트 수신:", event.data);
      try {
        const data = JSON.parse(event.data);
        console.log("📦 파싱된 알람 데이터:", data);
        
        // 알람 타입 정규화
        let normalizedType = data.alarm_type;
        if (data.alarm_type === '1차' || data.alarm_type === '1') {
          normalizedType = 'Warning';
          console.log("🔄 알람 타입 정규화: '1차'/'1' -> 'Warning'");
        } else if (data.alarm_type === '2차' || data.alarm_type === '2') {
          normalizedType = 'Danger';
          console.log("🔄 알람 타입 정규화: '2차'/'2' -> 'Danger'");
        }
        data.alarm_type = normalizedType;
        
        // created_at이 문자열이면 Date 객체로 변환
        if (typeof data.created_at === 'string') {
          console.log("📅 원본 날짜:", data.created_at);
          data.created_at = new Date(data.created_at);
          console.log("📅 변환된 날짜:", data.created_at);
        }

        // alarm_id가 전혀 없다면, 프론트에서 고유한 ID 생성
        if (!data.alarm_id) {
          data.alarm_id = crypto.randomUUID();
          console.log("🔄 생성된 alarm_id:", data.alarm_id);
        }
        
        console.log("💾 알람 스토어에 추가 중...");
        addAlarm(data);
        console.log("✅ 알람 스토어에 추가 완료");

        // 알람 타입이 Accident인 경우 지도 페이지로 라우팅
        if (data.alarm_type === 'Accident' && location.pathname !== '/map') {
          console.log("🚀 사고 알람 감지! 지도 페이지로 이동 중...");
          navigate('/map', {
            state: {
              alert: true,
              alarmId: data.alarm_id,
              fromAccident: true
            }
          });
        }
      } catch (err) {
        console.error("❌ 알람 데이터 파싱 실패:", err);
        console.error("📄 원본 데이터:", event.data);
      }
    });

    es.addEventListener('connect', (event) => {
      console.log("🔌 연결 이벤트 수신:", event.data);
    });

    es.onmessage = (event) => {
      console.log("📨 일반 메시지 수신:", event.data);
    };

    es.onerror = (err) => {
      console.error("❌ SSE 연결 에러:", err);
      console.log("🔄 연결 상태:", es.readyState === 0 ? "연결 중" : es.readyState === 1 ? "열림" : "닫힘");
    };

    return () => {
      console.log("❌ SSE 연결 종료");
      es.close();
    };
  }, [addAlarm, navigate, location.pathname]);

//   return null;
// }
