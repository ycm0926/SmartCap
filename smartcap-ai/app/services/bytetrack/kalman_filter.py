# vim: expandtab:ts=4:sw=4
import numpy as np
import scipy.linalg


"""
분포의 형태를 결정하는 파라미터에 대한 카이제곱 분포의 확률이 95%인 지점의 값 테이블
MATLAB/Octave의 chi2inv 함수를 가져온 것
예측값과 관측값이 "얼마나 멀리 떨어져 있는가"를 판단할 때 사용되는 거리 기반 필터링 기법
"""
chi2inv95 = {
    1: 3.8415,
    2: 5.9915,
    3: 7.8147,
    4: 9.4877,
    5: 11.070,
    6: 12.592,
    7: 14.067,
    8: 15.507,
    9: 16.919}


class KalmanFilter(object):
    """
    이미지 공간에서 바운딩 박스를 추적하기 위한 칼만 필터
    
    8차원 상태 공간:
        x, y, a, h, vx, vy, va, vh
    
    (x, y)는 중심 좌표, a는 종횡비, h는 높이,
    (vx, vy, va, vh)는 각각의 속도를 의미
    
    물체의 움직임은 선형 관측 모델을 따르며,
    바운딩 박스의 위치 (x, y, a, h)는 상태 공간의 직접적인 관측지로 간주
    """

    def __init__(self):
        ndim, dt = 4, 1.

        # 칼만 필터 모델 행렬 생성
        self._motion_mat = np.eye(2 * ndim, 2 * ndim)
        for i in range(ndim):
            self._motion_mat[i, ndim + i] = dt
        self._update_mat = np.eye(ndim, 2 * ndim)

        # 모델 불확실성 조정
        self._std_weight_position = 1. / 20
        self._std_weight_velocity = 1. / 160

    def initiate(self, measurement):
        """
        새로운 측정값으로부터 트랙을 생성
        
        Parameter:
        - measurement : ndarray
            바운딩 박스 좌표 (x, y, a, h)
        
        Return:
        - (ndarray, ndarray)
            8차원 평균 벡터와 8x8 공분산 행렬 반환
        """
        mean_pos = measurement
        mean_vel = np.zeros_like(mean_pos)
        mean = np.r_[mean_pos, mean_vel]

        std = [
            2 * self._std_weight_position * measurement[3],
            2 * self._std_weight_position * measurement[3],
            1e-2,
            2 * self._std_weight_position * measurement[3],
            10 * self._std_weight_velocity * measurement[3],
            10 * self._std_weight_velocity * measurement[3],
            1e-5,
            10 * self._std_weight_velocity * measurement[3]]
        covariance = np.diag(np.square(std))
        return mean, covariance

    def predict(self, mean, covariance):
        """
        칼만 필터의 예측 단계를 수행

        Parameter:
        - mean : ndarray
            이전 시점에서의 객체 상태를 나타내는 8차원 평균 벡터
        - covariance : ndarray
            이전 시점에서의 객체 상태를 나타내는 8x8 공분산 행렬

        Return:
        - (ndarray, ndarray) :
            예측된 상태의 평균 벡터와 공분산 행렬을 반환
            관측되지 않은 속도 값들은 평균 0으로 초기화
        """
        std_pos = [
            self._std_weight_position * mean[3],
            self._std_weight_position * mean[3],
            1e-2,
            self._std_weight_position * mean[3]]
        std_vel = [
            self._std_weight_velocity * mean[3],
            self._std_weight_velocity * mean[3],
            1e-5,
            self._std_weight_velocity * mean[3]]
        motion_cov = np.diag(np.square(np.r_[std_pos, std_vel]))

        #mean = np.dot(self._motion_mat, mean)
        mean = np.dot(mean, self._motion_mat.T)
        covariance = np.linalg.multi_dot((
            self._motion_mat, covariance, self._motion_mat.T)) + motion_cov

        return mean, covariance

    def project(self, mean, covariance):
        """
        상태 분포를 측정 공간으로 사영(투영)

        Parameter:
        - mean : ndarray
            상태의 평균 벡터 (8차원 배열)
        - covariance : ndarray
            상태의 공분산 행렬 (8x8 차원)

        Return:
        - (ndarray, ndarray)
            주어진 상태 추정값에 대해 사영된 평균 벡터와 공분산 행렬을 반환
        """
        std = [
            self._std_weight_position * mean[3],
            self._std_weight_position * mean[3],
            1e-1,
            self._std_weight_position * mean[3]]
        innovation_cov = np.diag(np.square(std))

        mean = np.dot(self._update_mat, mean)
        covariance = np.linalg.multi_dot((
            self._update_mat, covariance, self._update_mat.T))
        return mean, covariance + innovation_cov

    def multi_predict(self, mean, covariance):
        """
        칼만 필터 예측 단계를 벡터화하여 수행

        Parameter:
        - mean : ndarray
            이전 시점의 객체 상태를 나타내는 Nx8 차원의 평균 행렬
        - covariance : ndarray
            이전 시점의 객체 상태를 나타내는 Nx8x8 차원의 공분산 행렬들
        
        Return:
        - (ndarray, ndarray)
            예측된 상태들의 평균 벡터와 공분산 행렬을 반환
            관측되지 않은 속도는 평균 0으로 초기화
        """
        std_pos = [
            self._std_weight_position * mean[:, 3],
            self._std_weight_position * mean[:, 3],
            1e-2 * np.ones_like(mean[:, 3]),
            self._std_weight_position * mean[:, 3]]
        std_vel = [
            self._std_weight_velocity * mean[:, 3],
            self._std_weight_velocity * mean[:, 3],
            1e-5 * np.ones_like(mean[:, 3]),
            self._std_weight_velocity * mean[:, 3]]
        sqr = np.square(np.r_[std_pos, std_vel]).T

        motion_cov = []
        for i in range(len(mean)):
            motion_cov.append(np.diag(sqr[i]))
        motion_cov = np.asarray(motion_cov)

        mean = np.dot(mean, self._motion_mat.T)
        left = np.dot(self._motion_mat, covariance).transpose((1, 0, 2))
        covariance = np.dot(left, self._motion_mat.T) + motion_cov

        return mean, covariance

    def update(self, mean, covariance, measurement):
        """
        칼만 필터의 보정 단계를 수행

        Parameter:
        - mean : ndarray
            예측된 상태의 평균 벡터(8차원)
        - covariance : ndarray
            상태의 공분산 행렬(8x8 차원)
        - measurement : ndarray
            4차원 측정값 벡터 (x, y, a, h)로, 
            (x, y)는 중심 좌표, a는 종횡비, h는 박스의 높이

        Return:
        - (ndarray, ndarray)
            측정값을 반영하여 보정된 상태 분포(평균 벡터와 공분산 행렬)를 반환
        """
        projected_mean, projected_cov = self.project(mean, covariance)

        chol_factor, lower = scipy.linalg.cho_factor(
            projected_cov, lower=True, check_finite=False)
        kalman_gain = scipy.linalg.cho_solve(
            (chol_factor, lower), np.dot(covariance, self._update_mat.T).T,
            check_finite=False).T
        innovation = measurement - projected_mean

        new_mean = mean + np.dot(innovation, kalman_gain.T)
        new_covariance = covariance - np.linalg.multi_dot((
            kalman_gain, projected_cov, kalman_gain.T))
        return new_mean, new_covariance

    def gating_distance(self, mean, covariance, measurements,
                        only_position=False, metric='maha'):
        """
        상태 분포와 측정값들 사이의 게이팅 거리(마할라노비스 거리)를 계산
        적절한 거리 임계값은 `chi2inv95` 테이블에서 얻음
        
        Parameter:
        - mean : ndarray
            상태 분포의 평균 벡터(8차원)
        - covariance : ndarray
            상태 분포의 공분산 행렬(8x8 차원)
        - measurements : ndarray
            (x, y, a, h) 형식의 Nx4 차원 측정값 행렬
            각 측정값은 중심 좌표 (x, y), 종횡비 a, 높이 h를 포함
        - only_position : Optional[bool]
            True이면 중심 좌표 (x, y)에 대해서만 거리 계산을 수행
            
        Return:
        - ndarray
            길이 N의 배열을 반환하며, 각 요소는 해당 측정값과 상태 간의
            제곱 마할라노비스 거리를 의미
        """
        mean, covariance = self.project(mean, covariance)
        if only_position:
            mean, covariance = mean[:2], covariance[:2, :2]
            measurements = measurements[:, :2]

        d = measurements - mean
        if metric == 'gaussian':
            return np.sum(d * d, axis=1)
        elif metric == 'maha':
            cholesky_factor = np.linalg.cholesky(covariance)
            z = scipy.linalg.solve_triangular(
                cholesky_factor, d.T, lower=True, check_finite=False,
                overwrite_b=True)
            squared_maha = np.sum(z * z, axis=0)
            return squared_maha
        else:
            raise ValueError('invalid distance metric')