// AccidentSSE.jsx
import { useEffect } from "react";
import { useAlarmStore } from "../store/alarmStore";
import { useNavigate, useLocation } from "react-router-dom"; // 추가 필요

export default function AccidentSSE() {
  const addAlarm = useAlarmStore((state) => state.addAlarm);
  const navigate = useNavigate(); // 추가
  const location = useLocation(); // 추가

  useEffect(() => {
    console.log("🔄 Accident SSE 연결 시도...");
    const BASE_URL = import.meta.env.VITE_API_BASE_URL; // BASE_URL 정의 필요
    const es = new EventSource(`${BASE_URL}/api/sse/accident/subscribe`); // es 변수명 수정 필요

    es.onopen = () => {
      console.log("✅ Accident SSE 연결 성공!");
    };

    // 사고 이벤트 처리 부분
    es.addEventListener("accident", (event) => {
        console.log("🚨 사고 이벤트 수신:", event.data);
        try {
            const data = JSON.parse(event.data);
            console.log("📦 파싱된 사고 데이터:", data);
            
            // 고유 식별자 생성
            if (!data.alarm_id) {
                data.alarm_id = `accident-${data.accident_id}-${Date.now()}`;
            }
            
            // 알람 타입을 명시적으로 '3' 또는 'Accident'로 설정
            data.alarm_type = 'Accident'; // 또는 '3'으로 설정
            
            addAlarm(data);
            
            // 사고 알람인 경우 지도 페이지로 라우팅
            // if (location.pathname !== '/map') {
            //     navigate('/map', {
            //         state: {
            //             alert: true,
            //             alarmId: data.alarm_id,
            //             fromAccident: true
            //         }
            //     });
            // }
        } catch (err) {
            console.error("❌ 사고 데이터 파싱 실패:", err);
        }
    });

    es.onerror = (err) => {
      console.error("❌ Accident SSE 연결 에러:", err);
    };

    return () => {
      console.log("❌ Accident SSE 연결 종료");
      es.close();
    };
  }, [addAlarm, navigate, location.pathname]); // 의존성 배열 업데이트

  return null;
}