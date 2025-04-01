package kr.kro.smartcap.smartcap_back.util;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.PutObjectRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
@RequiredArgsConstructor
public class S3Uploader {

    private final AmazonS3 amazonS3;

    public String uploadFile(File file, String bucketName, String key) {
        // S3에 업로드
        amazonS3.putObject(new PutObjectRequest(bucketName, key, file));
        // 업로드된 파일의 URL 반환 (권한 설정에 따라 접근 가능)
        return amazonS3.getUrl(bucketName, key).toString();
    }
}
