package kr.kro.smartcap.smartcap_back.user.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegistrationRequestDto {
    private Long constructionSitesId;
    private String loginId;
    private String password;
    private String role;  // 예: "user" 또는 "관리자"
}
