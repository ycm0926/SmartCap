package kr.kro.smartcap.smartcap_back.user.service;

import kr.kro.smartcap.smartcap_back.user.entity.User;
import kr.kro.smartcap.smartcap_back.user.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // DB에서 사용자 조회 (loginId 기준)
        User user = userRepository.findByLoginId(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with loginId: " + username));

        // 스프링 시큐리티의 UserDetails 객체로 매핑 (비밀번호는 DB에 암호화된 상태여야 함)
        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getLoginId())
                .password(user.getPassword()) // 암호화된 비밀번호여야 합니다.
                .roles("USER") // 필요한 권한으로 수정하세요.
                .build();
    }
}
