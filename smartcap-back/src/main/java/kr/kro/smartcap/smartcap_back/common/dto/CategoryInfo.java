package kr.kro.smartcap.smartcap_back.common.dto;

import lombok.Getter;

@Getter
public class CategoryInfo {
    private final String category;
    private final String code;

    public CategoryInfo(String category, String code) {
        this.category = category;
        this.code = code;
    }

    @Override
    public String toString() {
        return category + ", " + code;
    }
}
