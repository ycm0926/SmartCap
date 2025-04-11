package kr.kro.smartcap.smartcap_back.user.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequestDto {
    private String loginId;
    private String password;
    private boolean rememberMe; // Remember Me 옵션을 위한 필드 추가
}