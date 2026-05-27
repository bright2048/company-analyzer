package config

import (
	"os"
)

// Config 应用配置
type Config struct {
	Addr               string
	StorageBackend     string
	DatabaseURL        string
	PlatformAdminToken string
	StaticDir          string  // 前端静态文件目录
	LogLevel           string  // 日志级别: debug, info, warn, error
	InputPriceFen      float64 // 平台输入单价（元/百万Token）
	OutputPriceFen     float64 // 平台输出单价（元/百万Token）
}

// Load 从环境变量加载配置
func Load() *Config {
	cfg := &Config{
		Addr:               getEnv("APP_ADDR", "0.0.0.0:8080"),
		StorageBackend:     getEnv("STORAGE_BACKEND", "memory"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		PlatformAdminToken: getEnv("PLATFORM_ADMIN_TOKEN", "kp-admin-secret-2026"),
		StaticDir:          getEnv("STATIC_DIR", "./static"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		InputPriceFen:      0.8, // 默认：0.8元/百万Token输入
		OutputPriceFen:     2.0, // 默认：2.0元/百万Token输出
	}
	return cfg
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
