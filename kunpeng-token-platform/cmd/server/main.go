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

	log.Println("=== 鲲鹏Token汇聚平台 - AI模型超市 ===")
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
		WriteTimeout: 120 * time.Second,
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

// initDefaultData 初始化默认数据
func initDefaultData(s store.Store) {
	ctx := context.Background()

	// ============================================================
	// 模型商品（超市货架）
	// ============================================================
	modelProducts := []model.ModelProduct{
		{
			ID: "mp_deepseek_chat", Name: "DeepSeek V3", Provider: "深度求索", ProviderKey: "deepseek",
			ModelID: "deepseek-chat", Description: "DeepSeek最新一代通用对话模型，性价比极高，支持128K上下文",
			Category: "chat", Tags: []string{"高性价比", "长上下文", "中文优秀"},
			Scenes: []string{"日常对话", "知识问答", "文案写作", "数据分析"},
			Features: []string{"128K上下文", "函数调用", "流式输出", "JSON模式"},
			ScoreQuality: 5, ScoreSpeed: 4, ScoreCost: 5,
			InputPricePerMillion: 1.0, OutputPricePerMillion: 2.0, MaxContext: 128000,
			Status: "active", IsHot: true, SortOrder: 1, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_deepseek_reasoner", Name: "DeepSeek R1", Provider: "深度求索", ProviderKey: "deepseek",
			ModelID: "deepseek-reasoner", Description: "深度推理模型，擅长数学、逻辑、复杂问题分析",
			Category: "reasoning", Tags: []string{"深度推理", "数学强", "逻辑分析"},
			Scenes: []string{"数学推理", "逻辑分析", "代码调试", "复杂决策"},
			Features: []string{"思维链推理", "128K上下文", "流式输出"},
			ScoreQuality: 5, ScoreSpeed: 3, ScoreCost: 4,
			InputPricePerMillion: 4.0, OutputPricePerMillion: 16.0, MaxContext: 128000,
			Status: "active", IsNew: true, SortOrder: 2, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_qwen_max", Name: "通义千问 Max", Provider: "阿里云", ProviderKey: "qwen",
			ModelID: "qwen-max", Description: "阿里云旗舰级大模型，综合能力强，企业级稳定性",
			Category: "chat", Tags: []string{"企业级", "稳定可靠", "多语言"},
			Scenes: []string{"企业应用", "客服对话", "文档处理", "知识问答"},
			Features: []string{"32K上下文", "函数调用", "流式输出", "多语言"},
			ScoreQuality: 5, ScoreSpeed: 4, ScoreCost: 4,
			InputPricePerMillion: 2.0, OutputPricePerMillion: 6.0, MaxContext: 32000,
			Status: "active", IsHot: true, SortOrder: 3, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_qwen_plus", Name: "通义千问 Plus", Provider: "阿里云", ProviderKey: "qwen",
			ModelID: "qwen-plus", Description: "阿里云高性价比模型，适合日常使用",
			Category: "chat", Tags: []string{"高性价比", "速度快", "稳定"},
			Scenes: []string{"日常对话", "文案写作", "翻译", "摘要"},
			Features: []string{"128K上下文", "函数调用", "流式输出"},
			ScoreQuality: 4, ScoreSpeed: 5, ScoreCost: 5,
			InputPricePerMillion: 0.8, OutputPricePerMillion: 2.0, MaxContext: 128000,
			Status: "active", SortOrder: 4, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_kimi_moonshot", Name: "Kimi (Moonshot)", Provider: "月之暗面", ProviderKey: "kimi",
			ModelID: "moonshot-v1-128k", Description: "超长上下文专家，支持128K窗口，擅长长文档分析",
			Category: "chat", Tags: []string{"超长上下文", "文档分析", "Agent"},
			Scenes: []string{"长文档分析", "论文阅读", "代码审查", "会议纪要"},
			Features: []string{"128K上下文", "文件解析", "联网搜索", "流式输出"},
			ScoreQuality: 4, ScoreSpeed: 4, ScoreCost: 3,
			InputPricePerMillion: 12.0, OutputPricePerMillion: 12.0, MaxContext: 128000,
			Status: "active", SortOrder: 5, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_glm4", Name: "GLM-4", Provider: "智谱AI", ProviderKey: "zhipu",
			ModelID: "glm-4", Description: "智谱AI旗舰模型，中文理解能力出色",
			Category: "chat", Tags: []string{"中文优秀", "知识丰富", "安全可控"},
			Scenes: []string{"中文写作", "知识问答", "教育辅导", "内容审核"},
			Features: []string{"128K上下文", "函数调用", "流式输出", "安全对齐"},
			ScoreQuality: 4, ScoreSpeed: 4, ScoreCost: 4,
			InputPricePerMillion: 1.0, OutputPricePerMillion: 1.0, MaxContext: 128000,
			Status: "active", SortOrder: 6, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_hunyuan", Name: "腾讯混元 Pro", Provider: "腾讯云", ProviderKey: "hunyuan",
			ModelID: "hunyuan-pro", Description: "腾讯混元大模型，深度融合腾讯生态",
			Category: "chat", Tags: []string{"腾讯生态", "安全合规", "企业级"},
			Scenes: []string{"企业应用", "内容生成", "客服对话", "社交场景"},
			Features: []string{"32K上下文", "函数调用", "流式输出"},
			ScoreQuality: 4, ScoreSpeed: 4, ScoreCost: 4,
			InputPricePerMillion: 3.0, OutputPricePerMillion: 5.0, MaxContext: 32000,
			Status: "active", SortOrder: 7, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_ernie4", Name: "文心一言 4.0", Provider: "百度", ProviderKey: "baidu",
			ModelID: "ernie-4.0-8k", Description: "百度旗舰大模型，中文生成能力强",
			Category: "chat", Tags: []string{"中文生成", "百度生态", "知识增强"},
			Scenes: []string{"中文写作", "营销文案", "知识问答", "教育"},
			Features: []string{"8K上下文", "插件调用", "流式输出"},
			ScoreQuality: 4, ScoreSpeed: 4, ScoreCost: 3,
			InputPricePerMillion: 8.0, OutputPricePerMillion: 8.0, MaxContext: 8000,
			Status: "active", SortOrder: 8, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_spark_ultra", Name: "讯飞星火 Ultra", Provider: "科大讯飞", ProviderKey: "spark",
			ModelID: "spark-ultra", Description: "讯飞最强模型，语音+文字多模态",
			Category: "multimodal", Tags: []string{"语音识别", "多模态", "教育"},
			Scenes: []string{"语音交互", "教育辅导", "会议记录", "同声传译"},
			Features: []string{"8K上下文", "语音输入", "多模态", "流式输出"},
			ScoreQuality: 4, ScoreSpeed: 4, ScoreCost: 3,
			InputPricePerMillion: 5.0, OutputPricePerMillion: 5.0, MaxContext: 8000,
			Status: "active", SortOrder: 9, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
		{
			ID: "mp_deepseek_coder", Name: "DeepSeek Coder V2", Provider: "深度求索", ProviderKey: "deepseek",
			ModelID: "deepseek-coder", Description: "专业代码生成模型，支持300+编程语言",
			Category: "code", Tags: []string{"代码生成", "多语言", "高性价比"},
			Scenes: []string{"代码生成", "代码补全", "Bug修复", "代码审查"},
			Features: []string{"128K上下文", "FIM补全", "流式输出", "300+语言"},
			ScoreQuality: 5, ScoreSpeed: 4, ScoreCost: 5,
			InputPricePerMillion: 1.0, OutputPricePerMillion: 2.0, MaxContext: 128000,
			Status: "active", IsHot: true, SortOrder: 10, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
	}

	for i := range modelProducts {
		s.CreateModelProduct(ctx, &modelProducts[i])
	}

	// ============================================================
	// 模型套餐（每个模型的购买选项）
	// ============================================================
	modelPlans := []model.ModelPlan{
		// DeepSeek V3 套餐
		{ID: "mplan_ds_demand", ModelProductID: "mp_deepseek_chat", Name: "按需计费", BillingType: "on_demand",
			Description: "用多少付多少，灵活无绑定", OnDemandInputPrice: 1.0, OnDemandOutputPrice: 2.0,
			RateLimit: 30, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_ds_month", ModelProductID: "mp_deepseek_chat", Name: "月度畅享包", BillingType: "monthly",
			Description: "每月500万Token，适合日常开发", PriceFen: 4900, TokenQuota: 5000000,
			ValidDays: 30, RateLimit: 60, OriginalPriceFen: 6900, Discount: "7折", Status: "active", SortOrder: 2, CreatedAt: time.Now()},
		{ID: "mplan_ds_quarter", ModelProductID: "mp_deepseek_chat", Name: "季度尊享包", BillingType: "quarterly",
			Description: "每季度2000万Token，企业首选", PriceFen: 14900, TokenQuota: 20000000,
			ValidDays: 90, RateLimit: 120, OriginalPriceFen: 20700, Discount: "7.2折", Status: "active", SortOrder: 3, CreatedAt: time.Now()},

		// DeepSeek R1 套餐
		{ID: "mplan_r1_demand", ModelProductID: "mp_deepseek_reasoner", Name: "按需计费", BillingType: "on_demand",
			Description: "深度推理按需使用", OnDemandInputPrice: 4.0, OnDemandOutputPrice: 16.0,
			RateLimit: 20, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_r1_pack", ModelProductID: "mp_deepseek_reasoner", Name: "推理Token包(100万)", BillingType: "token_pack",
			Description: "100万Token推理包，90天有效", PriceFen: 9900, TokenQuota: 1000000,
			ValidDays: 90, RateLimit: 30, Status: "active", SortOrder: 2, CreatedAt: time.Now()},

		// 通义千问 Max 套餐
		{ID: "mplan_qmax_demand", ModelProductID: "mp_qwen_max", Name: "按需计费", BillingType: "on_demand",
			Description: "企业级稳定，按需付费", OnDemandInputPrice: 2.0, OnDemandOutputPrice: 6.0,
			RateLimit: 30, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_qmax_month", ModelProductID: "mp_qwen_max", Name: "月度专业包", BillingType: "monthly",
			Description: "每月300万Token，企业稳定之选", PriceFen: 6900, TokenQuota: 3000000,
			ValidDays: 30, RateLimit: 60, Status: "active", SortOrder: 2, CreatedAt: time.Now()},

		// 通义千问 Plus 套餐
		{ID: "mplan_qplus_demand", ModelProductID: "mp_qwen_plus", Name: "按需计费", BillingType: "on_demand",
			Description: "超低价格，日常首选", OnDemandInputPrice: 0.8, OnDemandOutputPrice: 2.0,
			RateLimit: 60, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_qplus_month", ModelProductID: "mp_qwen_plus", Name: "月度无限包", BillingType: "monthly",
			Description: "每月1000万Token，畅快使用", PriceFen: 3900, TokenQuota: 10000000,
			ValidDays: 30, RateLimit: 120, OriginalPriceFen: 5900, Discount: "6.6折", Status: "active", SortOrder: 2, CreatedAt: time.Now()},

		// Kimi 套餐
		{ID: "mplan_kimi_demand", ModelProductID: "mp_kimi_moonshot", Name: "按需计费", BillingType: "on_demand",
			Description: "超长上下文按需使用", OnDemandInputPrice: 12.0, OnDemandOutputPrice: 12.0,
			RateLimit: 20, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_kimi_pack", ModelProductID: "mp_kimi_moonshot", Name: "长文档分析包", BillingType: "token_pack",
			Description: "200万Token，专为长文档场景", PriceFen: 12900, TokenQuota: 2000000,
			ValidDays: 60, RateLimit: 30, Status: "active", SortOrder: 2, CreatedAt: time.Now()},

		// GLM-4 套餐
		{ID: "mplan_glm_demand", ModelProductID: "mp_glm4", Name: "按需计费", BillingType: "on_demand",
			Description: "智谱AI按需使用", OnDemandInputPrice: 1.0, OnDemandOutputPrice: 1.0,
			RateLimit: 30, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_glm_month", ModelProductID: "mp_glm4", Name: "月度标准包", BillingType: "monthly",
			Description: "每月500万Token", PriceFen: 3900, TokenQuota: 5000000,
			ValidDays: 30, RateLimit: 60, Status: "active", SortOrder: 2, CreatedAt: time.Now()},

		// 混元 套餐
		{ID: "mplan_hy_demand", ModelProductID: "mp_hunyuan", Name: "按需计费", BillingType: "on_demand",
			Description: "腾讯混元按需使用", OnDemandInputPrice: 3.0, OnDemandOutputPrice: 5.0,
			RateLimit: 30, Status: "active", SortOrder: 1, CreatedAt: time.Now()},

		// 文心 套餐
		{ID: "mplan_ernie_demand", ModelProductID: "mp_ernie4", Name: "按需计费", BillingType: "on_demand",
			Description: "文心一言按需使用", OnDemandInputPrice: 8.0, OnDemandOutputPrice: 8.0,
			RateLimit: 20, Status: "active", SortOrder: 1, CreatedAt: time.Now()},

		// 讯飞 套餐
		{ID: "mplan_spark_demand", ModelProductID: "mp_spark_ultra", Name: "按需计费", BillingType: "on_demand",
			Description: "讯飞星火按需使用", OnDemandInputPrice: 5.0, OnDemandOutputPrice: 5.0,
			RateLimit: 20, Status: "active", SortOrder: 1, CreatedAt: time.Now()},

		// DeepSeek Coder 套餐
		{ID: "mplan_dsc_demand", ModelProductID: "mp_deepseek_coder", Name: "按需计费", BillingType: "on_demand",
			Description: "代码生成按需付费", OnDemandInputPrice: 1.0, OnDemandOutputPrice: 2.0,
			RateLimit: 30, Status: "active", SortOrder: 1, CreatedAt: time.Now()},
		{ID: "mplan_dsc_month", ModelProductID: "mp_deepseek_coder", Name: "开发者月度包", BillingType: "monthly",
			Description: "每月800万Token，程序员必备", PriceFen: 5900, TokenQuota: 8000000,
			ValidDays: 30, RateLimit: 60, OriginalPriceFen: 8900, Discount: "6.6折", Status: "active", SortOrder: 2, CreatedAt: time.Now()},
	}

	for i := range modelPlans {
		s.CreateModelPlan(ctx, &modelPlans[i])
	}

	// ============================================================
	// 供应商（关联模型商品）
	// ============================================================
	mockSupplier := &model.Supplier{
		ID: "sup_mock", Name: "模拟供应商(测试用)", Protocol: "mock",
		Model: "mock-gpt-4", ModelProductID: "mp_deepseek_chat",
		InputPrice: 0.5, OutputPrice: 1.5, Priority: 100, Weight: 1, Status: "active",
	}
	s.CreateSupplier(ctx, mockSupplier)

	// ============================================================
	// 充值包（钱包充值用）
	// ============================================================
	plans := []model.Plan{
		{ID: "plan_10", Name: "10元充值", Description: "小额充值体验", PriceFen: 1000, CreditFen: 1000, ValidDays: 365, Status: "active", CreatedAt: time.Now()},
		{ID: "plan_50", Name: "50元充值", Description: "日常使用", PriceFen: 5000, CreditFen: 5500, ValidDays: 365, Status: "active", CreatedAt: time.Now()},
		{ID: "plan_100", Name: "100元充值", Description: "赠10元", PriceFen: 10000, CreditFen: 11000, ValidDays: 365, Status: "active", CreatedAt: time.Now()},
		{ID: "plan_500", Name: "500元充值", Description: "赠80元", PriceFen: 50000, CreditFen: 58000, ValidDays: 365, Status: "active", CreatedAt: time.Now()},
		{ID: "plan_1000", Name: "1000元充值", Description: "赠200元", PriceFen: 100000, CreditFen: 120000, ValidDays: 365, Status: "active", CreatedAt: time.Now()},
	}
	for _, p := range plans {
		s.CreatePlan(ctx, &p)
	}

	// 欢迎优惠券
	welcomeCoupon := &model.Coupon{
		ID: "cpn_welcome", Code: "WELCOME2026", Type: "fixed_credit",
		Value: 500, MaxUses: 1000, UserLimit: 1,
		ExpiresAt: time.Now().AddDate(1, 0, 0), Status: "active", CreatedAt: time.Now(),
	}
	s.CreateCoupon(ctx, welcomeCoupon)

	fmt.Println("[INIT] 默认数据初始化完成:")
	fmt.Printf("  - %d 个模型商品\n", len(modelProducts))
	fmt.Printf("  - %d 个模型套餐\n", len(modelPlans))
	fmt.Printf("  - %d 个充值包\n", len(plans))
	fmt.Println("  - 1 个Mock供应商")
	fmt.Println("  - 1 张欢迎优惠券 (WELCOME2026, 赠5元)")
}
