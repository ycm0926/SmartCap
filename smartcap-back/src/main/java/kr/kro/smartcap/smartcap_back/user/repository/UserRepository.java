package kr.kro.smartcap.smartcap_back.user.repository;

import kr.kro.smartcap.smartcap_back.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // loginId로 사용자 조회
    Optional<User> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);
}
