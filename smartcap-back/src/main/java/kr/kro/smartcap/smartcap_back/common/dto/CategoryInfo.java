package kr.kro.smartcap.smartcap_back.common.dto;

public class CategoryInfo {
    private final String category;
    private final int code;

    public CategoryInfo(String category, int code) {
        this.category = category;
        this.code = code;
    }

    public String getCategory() {
        return category;
    }

    public int getCode() {
        return code;
    }

    @Override
    public String toString() {
        return category + ", " + code;
    }
}
