import numpy as np
import cv2

from .kalman_filter import KalmanFilter
from app.services.bytetrack import matching
from .basetrack import BaseTrack, TrackState
from config import SPECIFIC_CLASSES

class STrack(BaseTrack):
    shared_kalman = KalmanFilter()

    def __init__(self, tlwh, score, mask=None, class_id=None):
        """
        Parameter:
        - tlwh: top-left width height 형식의 바운딩 박스 (x, y, w, h)
        - score: 객체 신뢰도 점수
        - mask: 세그멘테이션 마스크 좌표
        - class_id: 특정 클래스의 경우 (건설 자재) 세그멘테이션 좌표 사용을 위한 클래스 ID
        """

        # 활성화 대기 상태로 초기화
        self._tlwh = np.asarray(tlwh, dtype=np.float64)
        self.kalman_filter = None
        self.mean, self.covariance = None, None
        self.is_activated = False

        self.score = score
        self.tracklet_len = 0

        # 세그멘테이션 좌표로 
        self._mask = mask
        self._rotated_box = None
        self.class_id = class_id

        # 특정 클래스인 경우 마스크에서 회전된 바운딩 박스 계산
        if mask is not None and (class_id is None or class_id in SPECIFIC_CLASSES):
            # OpenCV의 minAreaRect를 사용하여 회전된 바운딩 박스 계산
            # mask에서 객체의 윤곽선(contour)을 찾고, minAreaRect 적용
            contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # 윤곽선 발견 시 윤곽선을 외접하는 최소 직사각형을 만듦
            if contours:
                self._rotated_box = cv2.minAreaRect(contours[0])


    def predict(self):
        """
        칼만 필터를 사용하여 다음 프레임에서의 객체 위치를 예측합니다.
        """
        mean_state = self.mean.copy()

        # 현재 추적 중이 아닌 경우 속도 성분(mean_state[7])을 0으로 초기화화
        if self.state != TrackState.Tracked:
            mean_state[7] = 0
        self.mean, self.covariance = self.kalman_filter.predict(mean_state, self.covariance)


    @staticmethod
    def multi_predict(stracks):
        """
        칼만 필터를 사용하여 다음 프레임에서의 객체 위치를 예측합니다.
        여러 트랙을 한 번에 예측하여 효율성을 높입니다.
        """
        if len(stracks) > 0:
            multi_mean = np.asarray([st.mean.copy() for st in stracks])
            multi_covariance = np.asarray([st.covariance for st in stracks])
            for i, st in enumerate(stracks):
                if st.state != TrackState.Tracked:
                    multi_mean[i][7] = 0
            multi_mean, multi_covariance = STrack.shared_kalman.multi_predict(multi_mean, multi_covariance)
            for i, (mean, cov) in enumerate(zip(multi_mean, multi_covariance)):
                stracks[i].mean = mean
                stracks[i].covariance = cov


    def activate(self, kalman_filter, frame_id):
        """
        새로운 트랙을 시작합니다.
        고유 ID를 할당하고, 바운딩 박스를 (center_x, center_y, aspect_ratio, height) 형식으로 변환해 칼만 필터를 초기화합니다.
        """
        self.kalman_filter = kalman_filter
        self.track_id = self.next_id()
        self.mean, self.covariance = self.kalman_filter.initiate(self.tlwh_to_xyah(self._tlwh))

        self.tracklet_len = 0
        self.state = TrackState.Tracked
        if frame_id == 1:
            self.is_activated = True
        # self.is_activated = True
        self.frame_id = frame_id
        self.start_frame = frame_id


    def re_activate(self, new_track, frame_id, new_id=False):
        """
        잃어버렸던 트랙을 다시 발견했을 때 실행합니다.
        new_id가 True면 새로운 ID를 할당합니다.
        """
        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.tracklet_len = 0
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id
        if new_id:
            self.track_id = self.next_id()
        self.score = new_track.score

        # 마스크와 회전된 바운딩 박스 업데이트
        if hasattr(new_track, '_mask') and new_track._mask is not None:
            self._mask = new_track._mask
            
            # 새 마스크에서 회전된 바운딩 박스 다시 계산
            if self.class_id in SPECIFIC_CLASSES:
                contours, _ = cv2.findContours(self._mask.astype(np.uint8), 
                                            cv2.RETR_EXTERNAL, 
                                            cv2.CHAIN_APPROX_SIMPLE)
                if contours:
                    self._rotated_box = cv2.minAreaRect(contours[0])


    def update(self, new_track, frame_id):
        """
        매칭된 트랙을 업데이트

        Parameter:
            - new_track : STrack
                매칭된 새 디텍션 트랙 객체
            - frame_id : int
                현재 프레임 번호

        Return:
            - 없음 (내부 상태 업데이트)
        """
        self.frame_id = frame_id
        self.tracklet_len += 1

        new_tlwh = new_track.tlwh
        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_tlwh))
        self.state = TrackState.Tracked
        self.is_activated = True
        self.score = new_track.score

        # 마스크와 회전된 바운딩 박스 업데이트
        if hasattr(new_track, '_mask') and new_track._mask is not None:
            self._mask = new_track._mask
            
            # 새 마스크에서 회전된 바운딩 박스 다시 계산
            if self.class_id in SPECIFIC_CLASSES:
                contours, _ = cv2.findContours(self._mask.astype(np.uint8), 
                                            cv2.RETR_EXTERNAL, 
                                            cv2.CHAIN_APPROX_SIMPLE)
                if contours:
                    self._rotated_box = cv2.minAreaRect(contours[0])


    @property
    # @jit(nopython=True)
    def tlwh(self):
        """
        현재 바운딩 박스 위치를 (좌상단 x, 좌상단 y, 너비, 높이) 형식으로 반환
        """
        if self.mean is None:
            return self._tlwh.copy()
        ret = self.mean[:4].copy()
        ret[2] *= ret[3]
        ret[:2] -= ret[2:] / 2
        return ret


    @property
    # @jit(nopython=True)
    def tlbr(self):
        """
        바운딩 박스를 (min x, min y, max x, max y) 형식으로 변환
        """
        ret = self.tlwh.copy()
        ret[2:] += ret[:2]
        return ret


    @staticmethod
    # @jit(nopython=True)
    def tlwh_to_xyah(tlwh):
        """
        바운딩 박스를 (중심 x, 중심 y, 종횡비, 높이) 형식으로 변환

        Return:
            - np.ndarray
        """
        ret = np.asarray(tlwh).copy()
        ret[:2] += ret[2:] / 2
        ret[2] /= ret[3]
        return ret


    def to_xyah(self):
        return self.tlwh_to_xyah(self.tlwh)


    @staticmethod
    # @jit(nopython=True)
    def tlbr_to_tlwh(tlbr):
        """
        바운딩 박스를 형식 변환
            - tlbr_to_tlwh: (좌상단, 우하단) → (좌상단, 너비, 높이)
        """
        ret = np.asarray(tlbr).copy()
        ret[2:] -= ret[:2]
        return ret


    @staticmethod
    # @jit(nopython=True)
    def tlwh_to_tlbr(tlwh):
        """
        바운딩 박스를 형식 변환
            - tlwh_to_tlbr: (좌상단, 너비, 높이) → (좌상단, 우하단)
        """
        ret = np.asarray(tlwh).copy()
        ret[2:] += ret[:2]
        return ret


    def __repr__(self):
        return 'OT_{}_({}-{})'.format(self.track_id, self.start_frame, self.end_frame)


class BYTETracker(object):
    def __init__(self, args, frame_rate=30):
        self.tracked_stracks = []  # type: list[STrack]
        self.lost_stracks = []  # type: list[STrack]
        self.removed_stracks = []  # type: list[STrack]

        self.frame_id = 0
        self.args = args
        #self.det_thresh = args.track_thresh
        self.det_thresh = args.track_thresh + 0.1 # 새 트랙 생성 시 필요한 최소 신뢰도
        self.buffer_size = int(frame_rate / 30.0 * args.track_buffer) # 트랙이 사라진 후 유지되는 최대 프레임 수
        self.max_time_lost = self.buffer_size
        self.kalman_filter = KalmanFilter() # 위치 예측에 사용되는 칼만 필터


    def update(self, output_results, img_info, img_size):
        """
        트래커 업데이트 (새 프레임이 입력될 때 마다 호출)

        Parameter:
            - output_results : np.ndarray
                디텍터 출력 (박스 + 점수)
            - img_info : tuple
                원본 이미지 크기 (높이, 너비)
            - img_size : tuple
                입력 크기 (높이, 너비)

        Return:
            - output_stracks : list[STrack]
                현재 프레임에서 활성화된 트랙들
        """
        self.frame_id += 1
        activated_starcks = []
        refind_stracks = []
        lost_stracks = []
        removed_stracks = []

        if output_results.shape[1] == 5:
            scores = output_results[:, 4]
            bboxes = output_results[:, :4]
        else:
            output_results = output_results.cpu().numpy()
            scores = output_results[:, 4] * output_results[:, 5]
            bboxes = output_results[:, :4]  # x1y1x2y2
        img_h, img_w = img_info[0], img_info[1]
        scale = min(img_size[0] / float(img_h), img_size[1] / float(img_w))
        bboxes /= scale

        remain_inds = scores > self.args.track_thresh
        inds_low = scores > 0.1
        inds_high = scores < self.args.track_thresh

        inds_second = np.logical_and(inds_low, inds_high)
        dets_second = bboxes[inds_second] # 두 번째 매칭에서 사용할 낮은 객체 탐지 값 (0.1 ~ track_thresh)
        dets = bboxes[remain_inds] # track_thresh 이상
        scores_keep = scores[remain_inds]
        scores_second = scores[inds_second]

        # 1단계 : 디텍션 생성
        if len(dets) > 0:
            detections = [STrack(STrack.tlbr_to_tlwh(tlbr), s) for
                          (tlbr, s) in zip(dets, scores_keep)]
        else:
            detections = []

        # 2단계 : 추적 중인 트랙 분류
        unconfirmed = [] # 아직 활성화되지 않은 새 트랙
        tracked_stracks = []  # type: list[STrack]
        for track in self.tracked_stracks:
            if not track.is_activated:
                unconfirmed.append(track)
            else:
                tracked_stracks.append(track)

        # 3단계: 첫 번째 매칭 (고득점 디텍션)
        strack_pool = joint_stracks(tracked_stracks, self.lost_stracks)
        # 칼만 필터로 현재 위치를 예측
        STrack.multi_predict(strack_pool)
        dists = matching.iou_distance(strack_pool, detections)
        if not self.args.mot20:
            dists = matching.fuse_score(dists, detections)
        matches, u_track, u_detection = matching.linear_assignment(dists, thresh=self.args.match_thresh)

        for itracked, idet in matches:
            track = strack_pool[itracked]
            det = detections[idet]

            # 현재 추적 중인 트랙인 경우 update 호출하여 칼만 필터 상태 업데이트
            if track.state == TrackState.Tracked:
                track.update(detections[idet], self.frame_id)
                activated_starcks.append(track)
            
            # 이전에 잃어버린 트랙인 경우 re_activate 호출하여 다시 활성화
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # 4단계: 두 번째 매칭 (저득점 디텍션)
        # 첫 번째 매칭에서 매칭되지 않은 트랙들을 저신뢰도 디텍션과 매칭 시도 (ByteTrack의 핵심 아이디어)
        if len(dets_second) > 0:
            '''Detections'''
            detections_second = [STrack(STrack.tlbr_to_tlwh(tlbr), s) for
                          (tlbr, s) in zip(dets_second, scores_second)]
        else:
            detections_second = []
        r_tracked_stracks = [strack_pool[i] for i in u_track if strack_pool[i].state == TrackState.Tracked]
        dists = matching.iou_distance(r_tracked_stracks, detections_second)
        matches, u_track, u_detection_second = matching.linear_assignment(dists, thresh=0.5)
        for itracked, idet in matches:
            track = r_tracked_stracks[itracked]
            det = detections_second[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_starcks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # 연속 프레임에서 매칭되지 않은 트랙의 상태를 Lost로 변경
        for it in u_track:
            track = r_tracked_stracks[it]
            if not track.state == TrackState.Lost:
                track.mark_lost()
                lost_stracks.append(track)

        # 5단계: 활성화되지 않은 트랙 처리
        detections = [detections[i] for i in u_detection]

        # 아직 활성화되지 않은 트랙(unconfirmed)에 대해 매칭 시도
        dists = matching.iou_distance(unconfirmed, detections)
        if not self.args.mot20:
            dists = matching.fuse_score(dists, detections)
        matches, u_unconfirmed, u_detection = matching.linear_assignment(dists, thresh=0.7)

        # 매칭된 트랙 활성화
        for itracked, idet in matches:
            unconfirmed[itracked].update(detections[idet], self.frame_id)
            activated_starcks.append(unconfirmed[itracked])
        for it in u_unconfirmed:
            track = unconfirmed[it]
            track.mark_removed()
            removed_stracks.append(track)

        # 6단계: 새로운 트랙 생성
        for inew in u_detection:
            track = detections[inew]
            if track.score < self.det_thresh:
                continue
            track.activate(self.kalman_filter, self.frame_id)
            activated_starcks.append(track)

        # 7단계: 오래된 트랙 제거
        for track in self.lost_stracks:
            if self.frame_id - track.end_frame > self.max_time_lost:
                track.mark_removed()
                removed_stracks.append(track)

        # print('Ramained match {} s'.format(t4-t3))

        # 각 상태별 트랙 리스트 업데이트 (추적 중, 잃어버림, 제거)
        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.Tracked]
        self.tracked_stracks = joint_stracks(self.tracked_stracks, activated_starcks)
        self.tracked_stracks = joint_stracks(self.tracked_stracks, refind_stracks)
        self.lost_stracks = sub_stracks(self.lost_stracks, self.tracked_stracks)
        self.lost_stracks.extend(lost_stracks)
        self.lost_stracks = sub_stracks(self.lost_stracks, self.removed_stracks)
        self.removed_stracks.extend(removed_stracks)
        self.tracked_stracks, self.lost_stracks = remove_duplicate_stracks(self.tracked_stracks, self.lost_stracks)
        # 사라진 트랙의 신뢰도 가져오기
        output_stracks = [track for track in self.tracked_stracks if track.is_activated]

        return output_stracks


def joint_stracks(tlista, tlistb):
    """
    두 트랙 리스트를 병합 (중복 제거)

    Parameter:
        - tlista : list[STrack]
        - tlistb : list[STrack]

    Return:
        - list[STrack]
    """
    exists = {}
    res = []
    for t in tlista:
        exists[t.track_id] = 1
        res.append(t)
    for t in tlistb:
        tid = t.track_id
        if not exists.get(tid, 0):
            exists[tid] = 1
            res.append(t)
    return res


def sub_stracks(tlista, tlistb):
    """
    첫 번째 리스트에서 두 번째 리스트의 트랙들을 제거

    Parameter:
        - tlista : list[STrack]
        - tlistb : list[STrack]

    Return:
        - list[STrack]
    """
    stracks = {}
    for t in tlista:
        stracks[t.track_id] = t
    for t in tlistb:
        tid = t.track_id
        if stracks.get(tid, 0):
            del stracks[tid]
    return list(stracks.values())


def remove_duplicate_stracks(stracksa, stracksb):
    """
    IoU가 일정 이하인 중복 트랙 제거

    Parameter:
        - stracksa : list[STrack]
        - stracksb : list[STrack]

    Return:
        - (list[STrack], list[STrack])
            중복이 제거된 두 트랙 리스트
    """
    pdist = matching.iou_distance(stracksa, stracksb)
    pairs = np.where(pdist < 0.15)
    dupa, dupb = list(), list()
    for p, q in zip(*pairs):
        timep = stracksa[p].frame_id - stracksa[p].start_frame
        timeq = stracksb[q].frame_id - stracksb[q].start_frame
        if timep > timeq:
            dupb.append(q)
        else:
            dupa.append(p)
    resa = [t for i, t in enumerate(stracksa) if not i in dupa]
    resb = [t for i, t in enumerate(stracksb) if not i in dupb]
    return resa, resb
