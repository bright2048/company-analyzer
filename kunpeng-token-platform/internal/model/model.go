package model

import (
	"time"
)

// ============================================================
// 用户相关
// ============================================================

// User 用户模型
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Company      string    `json:"company"`
	AdminToken   string    `json:"admin_token,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Wallet 钱包模型 - 余额单位为"分"(1元=100分)
type Wallet struct {
	UserID      string    `json:"user_id"`
	Balance     int64     `json:"balance"`     // 余额（分）
	TotalSpent  int64     `json:"total_spent"` // 累计消费（分）
	LastUpdated time.Time `json:"last_updated"`
}

// ============================================================
// 模型商品（超市货架）
// ============================================================

// ModelProduct 模型商品 - 展示在超市货架上的模型
type ModelProduct struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`         // 展示名称，如"DeepSeek V3"
	Provider    string   `json:"provider"`     // 厂商名称，如"深度求索"
	ProviderKey string   `json:"provider_key"` // 厂商标识，如"deepseek"
	ModelID     string   `json:"model_id"`     // 实际模型ID，如"deepseek-chat"
	Logo        string   `json:"logo"`         // 厂商Logo URL
	Description string   `json:"description"`  // 模型简介
	Category    string   `json:"category"`     // 分类: chat/reasoning/code/multimodal/embedding
	Tags        []string `json:"tags"`         // 标签: ["高性价比","长上下文","推理强"]
	Scenes      []string `json:"scenes"`       // 适用场景: ["日常对话","代码生成","数据分析","创意写作","知识问答"]
	Features    []string `json:"features"`     // 特性: ["128K上下文","函数调用","流式输出"]

	// 能力评分 (1-5)
	ScoreQuality int `json:"score_quality"` // 质量评分
	ScoreSpeed   int `json:"score_speed"`   // 速度评分
	ScoreCost    int `json:"score_cost"`    // 性价比评分

	// 定价（元/百万Token）- 用于展示
	InputPricePerMillion  float64 `json:"input_price_per_million"`
	OutputPricePerMillion float64 `json:"output_price_per_million"`

	// 上下文窗口
	MaxContext int `json:"max_context"` // 最大上下文长度(Token)

	// 状态与排序
	Status    string `json:"status"`     // active / coming_soon / deprecated
	IsHot     bool   `json:"is_hot"`     // 热门标记
	IsNew     bool   `json:"is_new"`     // 新品标记
	SortOrder int    `json:"sort_order"` // 排序权重

	// 关联的供应商配置ID（内部使用，不暴露给用户）
	SupplierIDs []string `json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ============================================================
// 模型套餐（购买选项）
// ============================================================

// ModelPlan 模型套餐 - 每个模型可有多种购买方式
type ModelPlan struct {
	ID             string `json:"id"`
	ModelProductID string `json:"model_product_id"` // 关联模型商品
	Name           string `json:"name"`             // 套餐名称，如"按需计费"、"月度包"
	BillingType    string `json:"billing_type"`     // 计费类型: on_demand / monthly / quarterly / yearly / token_pack
	Description    string `json:"description"`

	// 定价
	PriceFen    int64 `json:"price_fen"`    // 套餐价格（分），按需计费时为0
	TokenQuota  int64 `json:"token_quota"`  // 包含Token配额，按需计费时为0
	DailyTokens int64 `json:"daily_tokens"` // 每日Token限额，0=不限

	// 按需计费单价（仅billing_type=on_demand时有效）
	OnDemandInputPrice  float64 `json:"on_demand_input_price"`  // 元/百万Token
	OnDemandOutputPrice float64 `json:"on_demand_output_price"` // 元/百万Token

	// 有效期
	ValidDays int `json:"valid_days"` // 有效天数，0=永久

	// 限制
	RateLimit    int `json:"rate_limit"`     // 每分钟请求上限
	LimitPerUser int `json:"limit_per_user"` // 单用户限购次数，0=不限

	// 优惠信息
	OriginalPriceFen int64  `json:"original_price_fen"` // 原价（用于展示划线价）
	Discount         string `json:"discount"`           // 折扣标签，如"7折"、"限时特惠"

	Status    string    `json:"status"` // active / disabled
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

// ============================================================
// 模型订阅（用户购买记录）
// ============================================================

// ModelSubscription 模型订阅 - 用户购买模型套餐后生成
type ModelSubscription struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	ModelProductID string    `json:"model_product_id"`
	ModelPlanID    string    `json:"model_plan_id"`
	ModelName      string    `json:"model_name"`     // 冗余：模型展示名
	PlanName       string    `json:"plan_name"`      // 冗余：套餐名
	BillingType    string    `json:"billing_type"`   // 冗余：计费类型
	APIKeyID       string    `json:"api_key_id"`     // 关联的专属API Key

	// 配额与用量
	TokenQuota    int64 `json:"token_quota"`    // 总Token配额（按需=0表示无限）
	TokenUsed     int64 `json:"token_used"`     // 已使用Token
	DailyTokens   int64 `json:"daily_tokens"`   // 每日限额
	TodayTokenUsed int64 `json:"today_token_used"` // 今日已用

	// 费用
	PriceFen            int64   `json:"price_fen"`              // 购买价格
	OnDemandInputPrice  float64 `json:"on_demand_input_price"`  // 按需输入单价
	OnDemandOutputPrice float64 `json:"on_demand_output_price"` // 按需输出单价
	TotalCostFen        int64   `json:"total_cost_fen"`         // 累计消费（按需模式）

	// 时间
	StartAt   time.Time `json:"start_at"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`

	// 状态
	Status string `json:"status"` // active / expired / exhausted / cancelled
}

// ============================================================
// API密钥（模型专属）
// ============================================================

// APIKey API密钥模型 - 与模型订阅绑定
type APIKey struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	Key              string    `json:"key"`
	Name             string    `json:"name"`
	SubscriptionID   string    `json:"subscription_id"`    // 关联订阅ID
	ModelProductID   string    `json:"model_product_id"`   // 关联模型商品ID
	ModelID          string    `json:"model_id"`           // 允许调用的模型ID
	BillingType      string    `json:"billing_type"`       // 计费类型
	RateLimit        int       `json:"rate_limit"`         // 每分钟请求上限
	Status           string    `json:"status"`             // active / disabled / expired
	CreatedAt        time.Time `json:"created_at"`
}

// ============================================================
// 供应商（内部配置，不直接暴露给用户）
// ============================================================

// Supplier 供应商模型
type Supplier struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Protocol      string  `json:"protocol"`        // openai / baidu / spark / mock
	BaseURL       string  `json:"base_url"`
	APIKey        string  `json:"api_key,omitempty"`
	SecretKey     string  `json:"secret_key,omitempty"`
	Model         string  `json:"model"`
	ModelProductID string `json:"model_product_id"` // 关联的模型商品
	InputPrice    float64 `json:"input_price"`      // 供应商输入成本（元/百万Token）
	OutputPrice   float64 `json:"output_price"`     // 供应商输出成本（元/百万Token）
	CacheHitPrice float64 `json:"cache_hit_price"`
	Priority      int     `json:"priority"`
	Weight        int     `json:"weight"`
	Status        string  `json:"status"`
	FailCount     int     `json:"-"`
	LastFailAt    time.Time `json:"-"`
}

// ============================================================
// 优惠券
// ============================================================

// Coupon 优惠券模型
type Coupon struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Type      string    `json:"type"`       // fixed_credit / discount / gift_tokens
	Value     int64     `json:"value"`
	MinSpend  int64     `json:"min_spend"`
	MaxUses   int       `json:"max_uses"`
	UsedCount int       `json:"used_count"`
	UserLimit int       `json:"user_limit"`
	ExpiresAt time.Time `json:"expires_at"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// CouponUseRecord 优惠券使用记录
type CouponUseRecord struct {
	ID        string    `json:"id"`
	CouponID  string    `json:"coupon_id"`
	UserID    string    `json:"user_id"`
	CreditFen int64     `json:"credit_fen"`
	CreatedAt time.Time `json:"created_at"`
}

// ============================================================
// 调用记录
// ============================================================

// UsageRecord 调用记录
type UsageRecord struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	APIKeyID        string    `json:"api_key_id"`
	SubscriptionID  string    `json:"subscription_id"`
	SupplierID      string    `json:"supplier_id"`
	Model           string    `json:"model"`
	InputTokens     int       `json:"input_tokens"`
	OutputTokens    int       `json:"output_tokens"`
	CachedTokens    int       `json:"cached_tokens"`
	CostFen         int64     `json:"cost_fen"`
	SupplierCostFen int64     `json:"supplier_cost_fen"`
	Status          string    `json:"status"`
	Latency         int64     `json:"latency"`
	RequestedAt     time.Time `json:"requested_at"`
}

// UsageSummary 用量汇总
type UsageSummary struct {
	Date         string `json:"date"`
	RequestCount int    `json:"request_count"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
	TotalCostFen int64  `json:"total_cost_fen"`
}

// ============================================================
// 其他
// ============================================================

// Plan 通用套餐（保留兼容，用于充值包）
type Plan struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	PriceFen     int64     `json:"price_fen"`
	CreditFen    int64     `json:"credit_fen"`
	TokenQuota   int64     `json:"token_quota"`
	ValidDays    int       `json:"valid_days"`
	LimitPerUser int       `json:"limit_per_user"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

// Purchase 购买记录
type Purchase struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	PlanID     string    `json:"plan_id"`
	PlanName   string    `json:"plan_name"`
	PriceFen   int64     `json:"price_fen"`
	CreditFen  int64     `json:"credit_fen"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// RiskEvent 风控事件
type RiskEvent struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

// PlatformConfig 平台计费配置
type PlatformConfig struct {
	InputPriceFen  float64
	OutputPriceFen float64
}

// AdminOverview 管理员总览数据
type AdminOverview struct {
	TotalUsers      int   `json:"total_users"`
	TotalRequests   int64 `json:"total_requests"`
	TodayRequests   int64 `json:"today_requests"`
	TodayRevenueFen int64 `json:"today_revenue_fen"`
	TodayCostFen    int64 `json:"today_cost_fen"`
	TotalBalanceFen int64 `json:"total_balance_fen"`
}

// UserDetail 用户详情（管理员视角）
type UserDetail struct {
	User
	Balance      int64     `json:"balance"`
	TotalSpent   int64     `json:"total_spent"`
	RequestCount int64     `json:"request_count"`
	LastActiveAt time.Time `json:"last_active_at"`
}

// ============================================================
// API请求/响应格式
// ============================================================

// ChatCompletionRequest 统一请求格式
type ChatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Stream      bool          `json:"stream"`
	Temperature *float64      `json:"temperature,omitempty"`
	MaxTokens   *int          `json:"max_tokens,omitempty"`
	Tools       []interface{} `json:"tools,omitempty"`
}

// ChatMessage 消息格式
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionResponse 统一响应格式
type ChatCompletionResponse struct {
	ID      string       `json:"id"`
	Object  string       `json:"object"`
	Created int64        `json:"created"`
	Model   string       `json:"model"`
	Choices []ChatChoice `json:"choices"`
	Usage   *ChatUsage   `json:"usage,omitempty"`
}

// ChatChoice 选择
type ChatChoice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

// ChatUsage Token使用量
type ChatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	CachedTokens     int `json:"cached_tokens,omitempty"`
}

// StreamChunk 流式数据块
type StreamChunk struct {
	ID      string              `json:"id"`
	Object  string              `json:"object"`
	Created int64               `json:"created"`
	Model   string              `json:"model"`
	Choices []StreamChunkChoice `json:"choices"`
	Usage   *ChatUsage          `json:"usage,omitempty"`
}

// StreamChunkChoice 流式选择
type StreamChunkChoice struct {
	Index        int         `json:"index"`
	Delta        ChatMessage `json:"delta"`
	FinishReason *string     `json:"finish_reason"`
}

// ============================================================
// 筛选参数
// ============================================================

// ModelFilter 模型筛选条件
type ModelFilter struct {
	Category    string `json:"category"`     // 分类筛选
	Provider    string `json:"provider"`     // 厂商筛选
	Scene       string `json:"scene"`        // 场景筛选
	PriceRange  string `json:"price_range"`  // 价格区间: free/low/medium/high
	BillingType string `json:"billing_type"` // 计费方式: on_demand/monthly/token_pack
	SortBy      string `json:"sort_by"`      // 排序: price_asc/price_desc/quality/speed/popular
	Search      string `json:"search"`       // 关键词搜索
}
