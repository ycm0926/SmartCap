package kr.kro.smartcap.smartcap_back.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;


@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        Info info = new Info()
                .version("v1.0") //버전
                .title("Smart-Cap API") //이름
                .description("Smart-Cap API"); //설명
        return new OpenAPI()
                .info(info);
    }
}