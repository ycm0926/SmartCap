package kr.kro.smartcap.smartcap_back.user.controller;

import kr.kro.smartcap.smartcap_back.user.dto.LoginRequestDto;
import kr.kro.smartcap.smartcap_back.user.entity.User;
import kr.kro.smartcap.smartcap_back.user.service.LoginService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final LoginService loginService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDto loginRequestDto) {
        try {
            // 로그인 시도
            User user = loginService.login(loginRequestDto.getLoginId(), loginRequestDto.getPassword());
            // Remember-Me 쿠키 설정은 Spring Security 설정(SecurityConfig)에서 처리됨
            return ResponseEntity.ok("Login success. Hello " + user.getLoginId());
        } catch (UsernameNotFoundException | BadCredentialsException e) {
            // 로그인 실패 시
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }
}
