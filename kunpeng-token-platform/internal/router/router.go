package router

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/bright2048/kunpeng-token-platform/internal/config"
	"github.com/bright2048/kunpeng-token-platform/internal/handler"
	"github.com/bright2048/kunpeng-token-platform/internal/middleware"
	"github.com/bright2048/kunpeng-token-platform/internal/service"
	"github.com/bright2048/kunpeng-token-platform/internal/store"
	"github.com/bright2048/kunpeng-token-platform/internal/upstream"
)

// Setup 设置路由
func Setup(s store.Store, cfg *config.Config) http.Handler {
	mux := http.NewServeMux()

	// 初始化服务
	registry := upstream.NewRegistry()
	proxyService := service.NewProxyService(s, registry, cfg)

	// 初始化处理器
	userHandler := handler.NewUserHandler(s)
	proxyHandler := handler.NewProxyHandler(proxyService)
	adminHandler := handler.NewAdminHandler(s)

	// === 公开接口 ===
	mux.HandleFunc("POST /api/v1/auth/register", userHandler.Register)
	mux.HandleFunc("POST /api/v1/auth/login", userHandler.Login)
	mux.HandleFunc("GET /api/v1/plans", userHandler.ListPlans)

	// 健康检查
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"kunpeng-token-platform"}`))
	})

	// === 用户控制台接口（需Admin Token鉴权） ===
	userAuth := middleware.AdminTokenAuth(s)

	mux.Handle("GET /api/v1/user/profile", userAuth(http.HandlerFunc(userHandler.GetProfile)))
	mux.Handle("GET /api/v1/user/wallet", userAuth(http.HandlerFunc(userHandler.GetWallet)))
	mux.Handle("POST /api/v1/user/apikeys", userAuth(http.HandlerFunc(userHandler.CreateAPIKey)))
	mux.Handle("GET /api/v1/user/apikeys", userAuth(http.HandlerFunc(userHandler.ListAPIKeys)))
	mux.Handle("DELETE /api/v1/user/apikeys", userAuth(http.HandlerFunc(userHandler.DeleteAPIKey)))
	mux.Handle("GET /api/v1/user/usage", userAuth(http.HandlerFunc(userHandler.GetUsage)))
	mux.Handle("GET /api/v1/user/usage/summary", userAuth(http.HandlerFunc(userHandler.GetUsageSummary)))
	mux.Handle("POST /api/v1/user/purchase", userAuth(http.HandlerFunc(userHandler.PurchasePlan)))
	mux.Handle("POST /api/v1/user/coupon/redeem", userAuth(http.HandlerFunc(userHandler.RedeemCoupon)))

	// === AI代理接口（需API Key鉴权） ===
	apiKeyAuth := middleware.APIKeyAuth(s)

	mux.Handle("POST /v1/chat/completions", apiKeyAuth(http.HandlerFunc(proxyHandler.ChatCompletions)))

	// === 平台管理员接口 ===
	platformAuth := middleware.PlatformAdminAuth(cfg.PlatformAdminToken)

	mux.Handle("GET /api/admin/overview", platformAuth(http.HandlerFunc(adminHandler.GetOverview)))
	mux.Handle("GET /api/admin/users", platformAuth(http.HandlerFunc(adminHandler.ListUsers)))
	mux.Handle("POST /api/admin/users/adjust-balance", platformAuth(http.HandlerFunc(adminHandler.AdjustBalance)))
	mux.Handle("GET /api/admin/suppliers", platformAuth(http.HandlerFunc(adminHandler.ListSuppliers)))
	mux.Handle("POST /api/admin/suppliers", platformAuth(http.HandlerFunc(adminHandler.CreateSupplier)))
	mux.Handle("PUT /api/admin/suppliers", platformAuth(http.HandlerFunc(adminHandler.UpdateSupplier)))
	mux.Handle("DELETE /api/admin/suppliers", platformAuth(http.HandlerFunc(adminHandler.DeleteSupplier)))
	mux.Handle("GET /api/admin/plans", platformAuth(http.HandlerFunc(adminHandler.ListAllPlans)))
	mux.Handle("POST /api/admin/plans", platformAuth(http.HandlerFunc(adminHandler.CreatePlan)))
	mux.Handle("PUT /api/admin/plans", platformAuth(http.HandlerFunc(adminHandler.UpdatePlan)))
	mux.Handle("GET /api/admin/coupons", platformAuth(http.HandlerFunc(adminHandler.ListCoupons)))
	mux.Handle("POST /api/admin/coupons", platformAuth(http.HandlerFunc(adminHandler.CreateCoupon)))

	// === 静态文件服务（前端SPA） ===
	staticDir := cfg.StaticDir
	if staticDir == "" {
		staticDir = "./static"
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// API和v1路径不走静态文件
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/v1/") {
			http.NotFound(w, r)
			return
		}
		// 尝试提供静态文件
		path := filepath.Join(staticDir, r.URL.Path)
		if _, err := os.Stat(path); err == nil {
			http.ServeFile(w, r, path)
			return
		}
		// SPA fallback: 所有前端路由返回index.html
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})

	// 应用CORS中间件
	return middleware.CORS(mux)
}
