package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/config"
	"github.com/bright2048/kunpeng-token-platform/internal/model"
	"github.com/bright2048/kunpeng-token-platform/internal/router"
	"github.com/bright2048/kunpeng-token-platform/internal/store"
)

func main() {
	cfg := config.Load()

	log.Println("=== 鲲鹏Token汇聚平台 ===")
	log.Printf("监听地址: %s", cfg.Addr)
	log.Printf("存储后端: %s", cfg.StorageBackend)

	// 初始化存储
	var s store.Store
	s = store.NewMemoryStore()

	// 初始化默认数据
	initDefaultData(s)

	// 设置路由
	handler := router.Setup(s, cfg)

	// 启动HTTP服务
	srv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second, // 流式响应需要较长超时
		IdleTimeout:  60 * time.Second,
	}

	// 优雅关闭
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("正在关闭服务...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("服务启动成功: http://%s", cfg.Addr)
	log.Printf("管理员令牌: %s", cfg.PlatformAdminToken)
	log.Println("API文档: http://" + cfg.Addr + "/api/health")

	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("服务异常退出: %v", err)
	}
	log.Println("服务已关闭")
}

// initDefaultData 初始化默认数据（套餐、Mock供应商等）
func initDefaultData(s store.Store) {
	ctx := context.Background()

	// 默认套餐
	plans := []model.Plan{
		{
			ID:          "plan_trial",
			Name:        "体验包",
			Description: "适合个人尝鲜、快速测试",
			PriceFen:    990,    // ¥9.9
			CreditFen:   1500,   // ¥15 额度
			TokenQuota:  500000, // 约50万Token
			ValidDays:   15,
			Status:      "active",
			CreatedAt:   time.Now(),
		},
		{
			ID:          "plan_starter",
			Name:        "入门包",
			Description: "适合个人开发者、轻量应用",
			PriceFen:    2900,   // ¥29
			CreditFen:   4500,   // ¥45 额度
			TokenQuota:  2000000, // 约200万Token
			ValidDays:   30,
			Status:      "active",
			CreatedAt:   time.Now(),
		},
		{
			ID:          "plan_basic",
			Name:        "基础包",
			Description: "适合中小项目、日常开发",
			PriceFen:    9900,    // ¥99
			CreditFen:   16000,   // ¥160 额度
			TokenQuota:  8000000, // 约800万Token
			ValidDays:   90,
			Status:      "active",
			CreatedAt:   time.Now(),
		},
		{
			ID:          "plan_pro",
			Name:        "专业包",
			Description: "适合线上生产环境、高频调用",
			PriceFen:    39900,    // ¥399
			CreditFen:   68000,    // ¥680 额度
			TokenQuota:  35000000, // 约3500万Token
			ValidDays:   180,
			Status:      "active",
			CreatedAt:   time.Now(),
		},
		{
			ID:          "plan_enterprise",
			Name:        "企业包",
			Description: "适合企业级团队协作、大批量采购",
			PriceFen:    149900,    // ¥1499
			CreditFen:   260000,    // ¥2600 额度
			TokenQuota:  130000000, // 约1.3亿Token
			ValidDays:   365,
			Status:      "active",
			CreatedAt:   time.Now(),
		},
	}

	for _, p := range plans {
		s.CreatePlan(ctx, &p)
	}

	// 默认Mock供应商（用于测试）
	mockSupplier := &model.Supplier{
		ID:          "sup_mock",
		Name:        "模拟供应商(测试用)",
		Protocol:    "mock",
		BaseURL:     "",
		Model:       "mock-gpt-4",
		InputPrice:  0.5,
		OutputPrice: 1.5,
		Priority:    100,
		Weight:      1,
		Status:      "active",
	}
	s.CreateSupplier(ctx, mockSupplier)

	// 默认欢迎优惠券
	welcomeCoupon := &model.Coupon{
		ID:        "cpn_welcome",
		Code:      "WELCOME2026",
		Type:      "fixed_credit",
		Value:     500, // 5元
		MaxUses:   1000,
		UserLimit: 1,
		ExpiresAt: time.Now().AddDate(1, 0, 0),
		Status:    "active",
		CreatedAt: time.Now(),
	}
	s.CreateCoupon(ctx, welcomeCoupon)

	fmt.Println("[INIT] 默认数据初始化完成:")
	fmt.Printf("  - %d 个套餐\n", len(plans))
	fmt.Println("  - 1 个Mock供应商")
	fmt.Println("  - 1 张欢迎优惠券 (WELCOME2026, 赠5元)")
}
