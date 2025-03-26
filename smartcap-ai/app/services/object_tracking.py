from app.services.bytetrack.byte_tracker import BYTETracker

# ByteTrack 설정
class TrackerArgs:
    track_thresh = 0.5 # 객체 추적에 사용할 최소 신뢰 점수
    track_buffer = 30 # 객체가 사라진 후에도 몇 프레임 동안 정보를 유지할지
                      # int(frame_rate / 30.0 * args.track_buffer)
    match_thresh = 0.8 # 추적 중인 객체와 새로 들어온 detection 사이의 IOU가 이 값 이상이면 같은 객체로 매칭
    aspect_ratio_thresh = 1.6 # 탐지된 박스의 가로세로 비율 제한값
    min_box_area = 10 # 탐지된 박스의 최소 면적
    mot20 = False # MOT20(극도로 혼잡한 장면 때 사용) 전용 모드 여부

# ByteTrack 초기화
# frame_rate : 실시간 영상 프레임 수
def init_tracker(frame_rate=7):
    """
    ByteTrack 초기화

    Parameter:
        frame_rate (int, optional): 실시간 영상 프레임 수. default=7

    Return:
        BYTETracker: 초기화된 ByteTrack 추적기 인스턴스
    """
    return BYTETracker(TrackerArgs(), frame_rate=frame_rate)