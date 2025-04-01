package kr.kro.smartcap.smartcap_back.config;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AmazonS3Config {

    // AWS Access Key와 Secret Key는 안전하게 관리해야 합니다.
    // 환경 변수나 외부 설정 파일을 통해 주입하는 것을 권장합니다.
    // 외부에서 설정값 주입 (예: application.properties 또는 환경 변수)
    @Value("${AWS_ACCESS_KEY_ID}")
    private String accessKey;

    @Value("${AWS_SECRET_ACCESS_KEY}")
    private String secretKey;

    // 기본값은 ap-northeast-2(서울)로 설정
    @Value("${aws.region:ap-northeast-2}")
    private String region;

    @Bean
    public AmazonS3 amazonS3() {
        BasicAWSCredentials awsCreds = new BasicAWSCredentials(accessKey, secretKey);
        return AmazonS3ClientBuilder.standard()
                .withRegion(Regions.fromName(region))
                .withCredentials(new AWSStaticCredentialsProvider(awsCreds))
                .build();
    }
}