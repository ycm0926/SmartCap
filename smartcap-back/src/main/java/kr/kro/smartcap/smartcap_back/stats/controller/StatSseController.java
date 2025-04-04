package kr.kro.smartcap.smartcap_back.stats.controller;

import kr.kro.smartcap.smartcap_back.stats.sse.StatSseEmitterManager;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sse/stat")
public class StatSseController {

    private final StatSseEmitterManager statSseEmitterManager;

    @GetMapping
    @CrossOrigin(origins = "https://j12a102.p.ssafy.io")
    public SseEmitter connectToStatSse() {
        return statSseEmitterManager.subscribe();
    }
}
