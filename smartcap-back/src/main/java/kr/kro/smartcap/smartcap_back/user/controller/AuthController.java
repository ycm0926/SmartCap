package kr.kro.smartcap.smartcap_back.user.controller;

import jakarta.servlet.http.HttpSession;
import kr.kro.smartcap.smartcap_back.user.dto.LoginRequestDto;
import kr.kro.smartcap.smartcap_back.user.dto.RegistrationRequestDto;
import kr.kro.smartcap.smartcap_back.user.entity.User;
import kr.kro.smartcap.smartcap_back.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final AuthenticationManager authenticationManager;
    private final RememberMeServices rememberMeServices;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegistrationRequestDto registrationRequestDto) {
        try {
            User user = userService.register(registrationRequestDto);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body("Registration successful for " + user.getLoginId());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Registration failed: " + e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequestDto loginRequestDto,
            HttpServletRequest request,
            HttpServletResponse response) {
        try {
            // 사용자 검증
            User user = userService.login(loginRequestDto.getLoginId(), loginRequestDto.getPassword());

            // Spring Security 인증 처리
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequestDto.getLoginId(),
                            loginRequestDto.getPassword()
                    )
            );

            // 중요: SecurityContext에 인증 정보 저장
            SecurityContext context = SecurityContextHolder.getContext();
            context.setAuthentication(authentication);

            // 중요: 세션에 SecurityContext 저장
            HttpSession session = request.getSession(true);
            session.setAttribute("SPRING_SECURITY_CONTEXT", context);

            // Remember Me 처리
            if (loginRequestDto.isRememberMe()) {
                rememberMeServices.loginSuccess(request, response, authentication);
            }

            return ResponseEntity.ok("Login success. Hello " + user.getLoginId());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }
}