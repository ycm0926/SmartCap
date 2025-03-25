package kr.kro.smartcap.smartcap_back.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CORS 설정 적용
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // 인증 규칙 설정
                .authorizeHttpRequests(authorize -> authorize
                        // OPTIONS 메서드(프리플라이트 요청)는 모두 허용
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // 로그인, 회원가입 등 공개 엔드포인트 허용 (필요 시 추가)
                        .requestMatchers("/login", "/register").permitAll()
                        // 나머지는 인증 필요
                        .anyRequest().authenticated()
                )
                // CSRF 보호 비활성화 (API 서버의 경우 필요에 따라)
                .csrf(AbstractHttpConfigurer::disable)
                // 폼 로그인과 HTTP Basic 인증 활성화
                .formLogin(Customizer.withDefaults())
                .httpBasic(Customizer.withDefaults())
                // Remember-Me 기능 추가
                .rememberMe(rememberMe -> rememberMe
                        .tokenValiditySeconds(30 * 24 * 60 * 60) // 30일 동안 로그인 유지
                        .key("uniqueAndSecret") // 고유한 키 지정 (추후 환경변수로 보안 업그레이드 필요)
                )
                // 기본 session 기반 인증 사용(IF_REQUIRED는 필요 시 세션 생성)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(Arrays.asList("http://localhost:5173")); // 프론트엔드 주소
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        config.setExposedHeaders(Arrays.asList("Authorization"));  // 노출할 헤더
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);  // 모든 경로에 대해 CORS 설정 적용
        return source;
    }
}