package model

import (
	"time"
)

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

// APIKey API密钥模型
type APIKey struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	DailyLimit  int64     `json:"daily_limit"`  // 每日消费限额（分）, 0=不限
	RateLimit   int       `json:"rate_limit"`   // 每分钟请求上限, 0=不限
	Status      string    `json:"status"`       // active / disabled
	CreatedAt   time.Time `json:"created_at"`
}

// Wallet 钱包模型 - 余额单位为"分"(1元=100分)
type Wallet struct {
	UserID      string    `json:"user_id"`
	Balance     int64     `json:"balance"`      // 余额（分）
	TotalSpent  int64     `json:"total_spent"`  // 累计消费（分）
	LastUpdated time.Time `json:"last_updated"`
}

// Supplier 供应商模型
type Supplier struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Protocol      string  `json:"protocol"`       // openai / baidu / spark / mock
	BaseURL       string  `json:"base_url"`
	APIKey        string  `json:"api_key,omitempty"`
	SecretKey     string  `json:"secret_key,omitempty"`
	Model         string  `json:"model"`
	InputPrice    float64 `json:"input_price"`    // 供应商输入成本（元/百万Token）
	OutputPrice   float64 `json:"output_price"`   // 供应商输出成本（元/百万Token）
	CacheHitPrice float64 `json:"cache_hit_price"` // 缓存命中价格（元/百万Token）
	Priority      int     `json:"priority"`       // 路由优先级，越小越优先
	Weight        int     `json:"weight"`         // 负载均衡权重
	Status        string  `json:"status"`         // active / disabled / degraded
	FailCount     int     `json:"-"`              // 连续失败次数（运行时）
	LastFailAt    time.Time `json:"-"`            // 最后失败时间
}

// Plan 套餐模型
type Plan struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	PriceFen     int64     `json:"price_fen"`      // 套餐价格（分）
	CreditFen    int64     `json:"credit_fen"`     // 到账额度（分）
	TokenQuota   int64     `json:"token_quota"`    // 参考Token配额（展示用）
	ValidDays    int       `json:"valid_days"`     // 有效天数
	LimitPerUser int       `json:"limit_per_user"` // 单用户限购次数, 0=不限
	Status       string    `json:"status"`         // active / disabled
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

// Coupon 优惠券模型
type Coupon struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Type      string    `json:"type"`       // fixed_credit / discount / gift_tokens
	Value     int64     `json:"value"`      // 固定额度(分) / 折扣百分比(1-99) / Token数量
	MinSpend  int64     `json:"min_spend"`  // 最低消费要求（分）
	MaxUses   int       `json:"max_uses"`   // 最大使用次数, 0=不限
	UsedCount int       `json:"used_count"`
	UserLimit int       `json:"user_limit"` // 单用户限制次数
	ExpiresAt time.Time `json:"expires_at"`
	Status    string    `json:"status"`     // active / disabled
	CreatedAt time.Time `json:"created_at"`
}

// CouponUseRecord 优惠券使用记录
type CouponUseRecord struct {
	ID        string    `json:"id"`
	CouponID  string    `json:"coupon_id"`
	UserID    string    `json:"user_id"`
	CreditFen int64     `json:"credit_fen"` // 实际到账金额（分）
	CreatedAt time.Time `json:"created_at"`
}

// UsageRecord 调用记录
type UsageRecord struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	APIKeyID        string    `json:"api_key_id"`
	SupplierID      string    `json:"supplier_id"`
	Model           string    `json:"model"`
	InputTokens     int       `json:"input_tokens"`
	OutputTokens    int       `json:"output_tokens"`
	CachedTokens    int       `json:"cached_tokens"`
	CostFen         int64     `json:"cost_fen"`          // 用户侧费用（分）
	SupplierCostFen int64     `json:"supplier_cost_fen"` // 供应商侧成本（分）
	Status          string    `json:"status"`            // success / failed
	Latency         int64     `json:"latency"`           // 响应时间（毫秒）
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

// RiskEvent 风控事件
type RiskEvent struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"` // rate_limit / daily_limit / balance_insufficient
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

// PlatformConfig 平台计费配置
type PlatformConfig struct {
	InputPriceFen  float64 // 平台输入单价（元/百万Token）
	OutputPriceFen float64 // 平台输出单价（元/百万Token）
}

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
	ID      string             `json:"id"`
	Object  string             `json:"object"`
	Created int64              `json:"created"`
	Model   string             `json:"model"`
	Choices []ChatChoice       `json:"choices"`
	Usage   *ChatUsage         `json:"usage,omitempty"`
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
	Index        int          `json:"index"`
	Delta        ChatMessage  `json:"delta"`
	FinishReason *string      `json:"finish_reason"`
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
