package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"sort"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/config"
	"github.com/bright2048/kunpeng-token-platform/internal/model"
	"github.com/bright2048/kunpeng-token-platform/internal/store"
	"github.com/bright2048/kunpeng-token-platform/internal/upstream"
)

// ProxyService 代理服务（统一调用网关）
type ProxyService struct {
	store    store.Store
	registry *upstream.Registry
	config   *config.Config
}

// NewProxyService 创建代理服务
func NewProxyService(s store.Store, registry *upstream.Registry, cfg *config.Config) *ProxyService {
	return &ProxyService{
		store:    s,
		registry: registry,
		config:   cfg,
	}
}

// ProxyResult 代理调用结果
type ProxyResult struct {
	Response *model.ChatCompletionResponse
	Usage    *model.ChatUsage
	CostFen  int64
}

// StreamCallback 流式回调函数
type StreamCallback func(data []byte) error

// ChatCompletion 非流式代理调用（含路由、故障转移、计费）
func (s *ProxyService) ChatCompletion(ctx context.Context, userID, apiKeyID string, req *model.ChatCompletionRequest) (*ProxyResult, error) {
	// 1. 风控检查
	if err := s.checkRisk(ctx, userID); err != nil {
		return nil, err
	}

	// 2. 获取可用供应商列表（按优先级排序）
	suppliers, err := s.getActiveSuppliers(ctx)
	if err != nil {
		return nil, fmt.Errorf("no available suppliers: %w", err)
	}

	// 3. 依次尝试供应商（故障转移）
	var lastErr error
	maxRetries := 3
	tried := 0

	for _, supplier := range suppliers {
		if tried >= maxRetries {
			break
		}
		tried++

		startTime := time.Now()
		adapter := s.registry.GetAdapter(&supplier)

		resp, err := adapter.ChatCompletion(ctx, req)
		latency := time.Since(startTime).Milliseconds()

		if err != nil {
			lastErr = err
			log.Printf("[PROXY] supplier %s failed: %v (latency: %dms)", supplier.ID, err, latency)
			// 记录失败
			s.recordUsage(ctx, userID, apiKeyID, supplier.ID, req.Model, 0, 0, 0, 0, 0, "failed", latency)
			continue
		}

		// 4. 调用成功，计费扣费
		usage := resp.Usage
		if usage == nil {
			usage = &model.ChatUsage{PromptTokens: 0, CompletionTokens: 0}
		}

		costFen := s.calculateCost(usage.PromptTokens, usage.CompletionTokens)
		supplierCostFen := s.calculateSupplierCost(&supplier, usage.PromptTokens, usage.CompletionTokens, usage.CachedTokens)

		// 扣费
		if err := s.store.DebitWallet(ctx, userID, costFen); err != nil {
			return nil, fmt.Errorf("debit wallet: %w", err)
		}

		// 记录成功
		s.recordUsage(ctx, userID, apiKeyID, supplier.ID, req.Model,
			usage.PromptTokens, usage.CompletionTokens, usage.CachedTokens,
			costFen, supplierCostFen, "success", latency)

		log.Printf("[PROXY] success via %s, input=%d output=%d cost=%.2f元 latency=%dms",
			supplier.ID, usage.PromptTokens, usage.CompletionTokens, float64(costFen)/100, latency)

		return &ProxyResult{
			Response: resp,
			Usage:    usage,
			CostFen:  costFen,
		}, nil
	}

	return nil, fmt.Errorf("all suppliers failed, last error: %v", lastErr)
}

// ChatCompletionStream 流式代理调用
func (s *ProxyService) ChatCompletionStream(ctx context.Context, userID, apiKeyID string, req *model.ChatCompletionRequest, callback StreamCallback) error {
	// 1. 风控检查
	if err := s.checkRisk(ctx, userID); err != nil {
		return err
	}

	// 2. 获取可用供应商列表
	suppliers, err := s.getActiveSuppliers(ctx)
	if err != nil {
		return fmt.Errorf("no available suppliers: %w", err)
	}

	// 3. 依次尝试供应商
	var lastErr error
	maxRetries := 3
	tried := 0

	for _, supplier := range suppliers {
		if tried >= maxRetries {
			break
		}
		tried++

		startTime := time.Now()
		adapter := s.registry.GetAdapter(&supplier)

		reader, err := adapter.ChatCompletionStream(ctx, req)
		if err != nil {
			lastErr = err
			log.Printf("[PROXY-STREAM] supplier %s failed to connect: %v", supplier.ID, err)
			continue
		}

		// 4. 流式转发
		var streamErr error
		for {
			data, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				streamErr = err
				break
			}
			if err := callback(data); err != nil {
				streamErr = err
				break
			}
		}

		// 发送结束标记
		callback([]byte("data: [DONE]\n\n"))
		reader.Close()

		latency := time.Since(startTime).Milliseconds()

		if streamErr != nil {
			lastErr = streamErr
			log.Printf("[PROXY-STREAM] supplier %s stream error: %v", supplier.ID, streamErr)
			continue
		}

		// 5. 流结束后计费
		usage := reader.Usage()
		if usage == nil {
			usage = &model.ChatUsage{PromptTokens: 50, CompletionTokens: 100} // 估算
		}

		costFen := s.calculateCost(usage.PromptTokens, usage.CompletionTokens)
		supplierCostFen := s.calculateSupplierCost(&supplier, usage.PromptTokens, usage.CompletionTokens, usage.CachedTokens)

		// 扣费
		s.store.DebitWallet(ctx, userID, costFen)

		// 记录
		s.recordUsage(ctx, userID, apiKeyID, supplier.ID, req.Model,
			usage.PromptTokens, usage.CompletionTokens, usage.CachedTokens,
			costFen, supplierCostFen, "success", latency)

		log.Printf("[PROXY-STREAM] success via %s, input=%d output=%d cost=%.2f元 latency=%dms",
			supplier.ID, usage.PromptTokens, usage.CompletionTokens, float64(costFen)/100, latency)

		return nil
	}

	return fmt.Errorf("all suppliers failed, last error: %v", lastErr)
}

// getActiveSuppliers 获取活跃供应商列表（按优先级排序）
func (s *ProxyService) getActiveSuppliers(ctx context.Context) ([]model.Supplier, error) {
	all, err := s.store.ListSuppliers(ctx)
	if err != nil {
		return nil, err
	}

	var active []model.Supplier
	for _, sup := range all {
		if sup.Status == "active" {
			active = append(active, sup)
		}
	}

	if len(active) == 0 {
		return nil, fmt.Errorf("no active suppliers")
	}

	sort.Slice(active, func(i, j int) bool {
		return active[i].Priority < active[j].Priority
	})

	return active, nil
}

// checkRisk 风控检查
func (s *ProxyService) checkRisk(ctx context.Context, userID string) error {
	// 检查余额
	wallet, err := s.store.GetWallet(ctx, userID)
	if err != nil {
		return fmt.Errorf("wallet not found")
	}
	if wallet.Balance <= 0 {
		return &RiskError{Code: 402, Message: "余额不足，请充值后再试"}
	}

	// 检查每分钟请求数
	count, _ := s.store.CountUserRequestsInMinute(ctx, userID)
	if count >= 60 { // 默认60次/分钟
		return &RiskError{Code: 429, Message: "请求过于频繁，请稍后再试"}
	}

	// 检查每日消费上限
	dailySpent, _ := s.store.GetUserDailySpent(ctx, userID)
	if dailySpent >= 100000 { // 默认每日上限1000元
		return &RiskError{Code: 429, Message: "已达每日消费上限"}
	}

	return nil
}

// calculateCost 计算用户侧费用（分）
func (s *ProxyService) calculateCost(inputTokens, outputTokens int) int64 {
	// 平台定价：元/百万Token -> 分/Token
	inputCost := float64(inputTokens) * s.config.InputPriceFen / 1000000 * 100
	outputCost := float64(outputTokens) * s.config.OutputPriceFen / 1000000 * 100
	total := int64(inputCost + outputCost)
	if total < 1 && (inputTokens > 0 || outputTokens > 0) {
		total = 1 // 最低1分
	}
	return total
}

// calculateSupplierCost 计算供应商侧成本（分）
func (s *ProxyService) calculateSupplierCost(supplier *model.Supplier, inputTokens, outputTokens, cachedTokens int) int64 {
	normalInputTokens := inputTokens - cachedTokens
	if normalInputTokens < 0 {
		normalInputTokens = 0
	}

	inputCost := float64(normalInputTokens) * supplier.InputPrice / 1000000 * 100
	cacheCost := float64(cachedTokens) * supplier.CacheHitPrice / 1000000 * 100
	outputCost := float64(outputTokens) * supplier.OutputPrice / 1000000 * 100

	return int64(inputCost + cacheCost + outputCost)
}

// recordUsage 记录调用
func (s *ProxyService) recordUsage(ctx context.Context, userID, apiKeyID, supplierID, modelName string,
	inputTokens, outputTokens, cachedTokens int, costFen, supplierCostFen int64, status string, latency int64) {
	record := &model.UsageRecord{
		ID:              fmt.Sprintf("usage-%d", time.Now().UnixNano()),
		UserID:          userID,
		APIKeyID:        apiKeyID,
		SupplierID:      supplierID,
		Model:           modelName,
		InputTokens:     inputTokens,
		OutputTokens:    outputTokens,
		CachedTokens:    cachedTokens,
		CostFen:         costFen,
		SupplierCostFen: supplierCostFen,
		Status:          status,
		Latency:         latency,
		RequestedAt:     time.Now(),
	}
	s.store.CreateUsageRecord(ctx, record)
}

// RiskError 风控错误
type RiskError struct {
	Code    int
	Message string
}

func (e *RiskError) Error() string {
	return e.Message
}
