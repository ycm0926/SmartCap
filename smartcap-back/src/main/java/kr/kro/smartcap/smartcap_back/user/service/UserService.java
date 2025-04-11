package kr.kro.smartcap.smartcap_back.user.service;

import kr.kro.smartcap.smartcap_back.user.dto.RegistrationRequestDto;
import kr.kro.smartcap.smartcap_back.user.entity.User;
import kr.kro.smartcap.smartcap_back.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder; // SecurityConfig 등에서 등록된 Bean

    public User register(RegistrationRequestDto dto) {
        // 중복 사용자 체크 등 검증 로직 추가 가능
        if(userRepository.existsByLoginId(dto.getLoginId())) {
            throw new IllegalArgumentException("User with loginId already exists");
        }

        User user = new User();
        user.setConstructionSitesId(dto.getConstructionSitesId());
        user.setLoginId(dto.getLoginId());
        // BCryptPasswordEncoder를 사용하여 비밀번호 암호화
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRole(dto.getRole());

        return userRepository.save(user);
    }

    public User login(String loginId, String rawPassword) {
        // 1. loginId로 사용자 조회
        User user = userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with loginId: " + loginId));

        // 2. 비밀번호 검증
        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new BadCredentialsException("Invalid password");
        }

        return user;
    }
}
