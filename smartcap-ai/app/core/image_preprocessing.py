import cv2
import numpy as np


def read_binary_image(binary_data):
    """
    바이너리 데이터를 OpenCV 이미지(NumPy 배열)로 변환
    
    Parameter:
    - binary_data: 이미지의 바이너리 데이터
    
    Return:
    - OpenCV 이미지 객체 (NumPy 배열)
    """

    # 바이너리 데이터를 1차원 NumPy 배열로 변환
    nparr = np.frombuffer(binary_data, np.uint8)
    
    # 1차원 NumPy 배열을 실제 이미지 NumPy 배열로 변환 == cv2.imread('image.jpg')
    img_data = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    return img_data


def correct_fisheye_distortion(img_data):
    """
    160° 광각 카메라(YXF-HDF3M-811-V1-166)의 어안렌즈 왜곡 보정 함수
    
    카메라 사양:
    - 화각: 160°
    - 초점 거리(EFL): 1.7mm
    - 왜곡: <-85.32%
    
    Parameter:
    - img: NumPy배열
    
    Return:
    - 왜곡이 보정된 이미지 (BGR 채널이 포함된 HWC 형식의 NumPy 배열)
    """
    
    h, w = img_data.shape[:2]

    # 카메라 매트릭스 K 추정
    # 초점거리(픽셀) = 1.7mm / 0.0018mm/픽셀 ≈ 944 픽셀
    fx = fy = 944  # 픽셀 단위 초점 거리
    cx = w / 2     # 이미지 중심 x 좌표
    cy = h / 2     # 이미지 중심 y 좌표

    K = np.array([
        [fx, 0, cx],
        [0, fy, cy],
        [0, 0, 1]
    ])

    # 왜곡 계수 기반으로 튜닝 시작
    k1 = -0.34
    k2 = -0.05
    k3 = 0.0
    k4 = 0.0

    D = np.array([k1, k2, k3, k4])

    # 새로운 카메라 매트릭스 계산
    new_K = K.copy()
    balance = 0.0
    new_K = cv2.fisheye.estimateNewCameraMatrixForUndistortRectify(
        K, D, (w, h), np.eye(3), balance=balance
    )

    # 맵 계산
    map1, map2 = cv2.fisheye.initUndistortRectifyMap(
        K, D, np.eye(3), new_K, (w, h), cv2.CV_16SC2
    )

    # 이미지 왜곡 보정
    undistorted_img = cv2.remap(img_data, map1, map2, interpolation=cv2.INTER_LINEAR)
    
    return undistorted_img