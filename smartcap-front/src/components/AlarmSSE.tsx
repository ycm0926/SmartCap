// components/AlarmSSE.tsx
import { useEffect } from "react";
import { useAlarmStore } from "../store/alarmStore";
import { useNavigate, useLocation } from "react-router-dom";

export default function AlarmSSE() {
  const addAlarm = useAlarmStore((state) => state.addAlarm);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const es = new EventSource("http://localhost:8000/alarms");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data);
        addAlarm(data); // 알람 하나씩 처리

        // 알람 타입이 Accident인 경우, 현재 지도 페이지가 아니라면 지도로 라우팅
        if (data.alarm_type === 'Accident' && location.pathname !== '/map') {
          navigate('/map', {
            state: {
              alert: true,
              alarmId: data.alarm_id,
              fromAccident: true
            }
          });
        }
      } catch (err) {
        console.error("SSE 데이터 파싱 실패:", err);
      }
    };

    es.onerror = (err) => {
      console.error("SSE 연결 에러:", err);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [addAlarm, navigate, location]);

  return null;
}