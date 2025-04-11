package kr.kro.smartcap.smartcap_back;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class SmartcapBackApplication {

	public static void main(String[] args) {
		SpringApplication.run(SmartcapBackApplication.class, args);
	}

}
