// components/AlarmSSE.tsx
import { useEffect } from "react";
import { useAlarmStore } from "../store/alarmStore";

export default function AlarmSSE() {
  const addAlarm = useAlarmStore((state) => state.addAlarm);

  useEffect(() => {
    const es = new EventSource("http://localhost:8000/alarms");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data)
        addAlarm(data); // 알람 하나씩 처리
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
  }, [addAlarm]);

  return null;
}
