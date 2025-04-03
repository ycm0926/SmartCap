package kr.kro.smartcap.smartcap_back.common.util;

import kr.kro.smartcap.smartcap_back.common.dto.CategoryInfo;

import java.util.Map;

public class AlarmCategoryMapper {
    private static final Map<Integer, CategoryInfo> typeMap = Map.of(
            1, new CategoryInfo("건설 자재", "1"),
            2, new CategoryInfo("건설 자재", "2"),
            3, new CategoryInfo("건설 자재", "3"),
            4, new CategoryInfo("낙상", "1"),
            5, new CategoryInfo("낙상", "2"),
            6, new CategoryInfo("낙상", "3"),
            7, new CategoryInfo("차량", "1"),
            8, new CategoryInfo("차량", "2"),
            9, new CategoryInfo("차량", "3"),
            10, new CategoryInfo("원인 불명", "3")
    );

    public static CategoryInfo map(int type) {
        return typeMap.getOrDefault(type, new CategoryInfo("기타", "-1"));
    }
}
