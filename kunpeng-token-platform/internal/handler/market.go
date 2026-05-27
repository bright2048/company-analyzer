package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/middleware"
	"github.com/bright2048/kunpeng-token-platform/internal/model"
	"github.com/bright2048/kunpeng-token-platform/internal/store"
)

// MarketHandler 模型超市处理器
type MarketHandler struct {
	store store.Store
}

// NewMarketHandler 创建模型超市处理器
func NewMarketHandler(s store.Store) *MarketHandler {
	return &MarketHandler{store: s}
}

// ListProducts 获取模型商品列表（支持筛选）
func (h *MarketHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	filter := &model.ModelFilter{
		Category:    r.URL.Query().Get("category"),
		Provider:    r.URL.Query().Get("provider"),
		Scene:       r.URL.Query().Get("scene"),
		PriceRange:  r.URL.Query().Get("price_range"),
		BillingType: r.URL.Query().Get("billing_type"),
		SortBy:      r.URL.Query().Get("sort_by"),
		Search:      r.URL.Query().Get("search"),
	}

	products, err := h.store.ListModelProducts(r.Context(), filter)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "获取模型列表失败"})
		return
	}
	if products == nil {
		products = []model.ModelProduct{}
	}

	// 获取每个模型的套餐信息（用于展示价格范围）
	type ProductWithPlans struct {
		model.ModelProduct
		Plans      []model.ModelPlan `json:"plans"`
		MinPrice   string            `json:"min_price"`   // 最低价格展示
		PlanCount  int               `json:"plan_count"`  // 套餐数量
	}

	var result []ProductWithPlans
	for _, p := range products {
		plans, _ := h.store.ListModelPlansByProduct(r.Context(), p.ID)
		if plans == nil {
			plans = []model.ModelPlan{}
		}
		item := ProductWithPlans{
			ModelProduct: p,
			Plans:        plans,
			PlanCount:    len(plans),
		}
		// 计算最低价格
		if len(plans) > 0 {
			for _, plan := range plans {
				if plan.BillingType == "on_demand" {
					item.MinPrice = fmt.Sprintf("¥%.2f/百万Token起", plan.OnDemandInputPrice)
					break
				}
			}
			if item.MinPrice == "" {
				item.MinPrice = fmt.Sprintf("¥%.2f起", float64(plans[0].PriceFen)/100)
			}
		}
		result = append(result, item)
	}

	writeJSON(w, http.StatusOK, result)
}

// GetProductDetail 获取模型商品详情（含套餐列表）
func (h *MarketHandler) GetProductDetail(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Query().Get("id")
	if productID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "缺少模型ID"})
		return
	}

	product, err := h.store.GetModelProduct(r.Context(), productID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "模型不存在"})
		return
	}

	plans, _ := h.store.ListModelPlansByProduct(r.Context(), productID)
	if plans == nil {
		plans = []model.ModelPlan{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"product": product,
		"plans":   plans,
	})
}

// GetFilterOptions 获取筛选选项（分类、厂商、场景列表）
func (h *MarketHandler) GetFilterOptions(w http.ResponseWriter, r *http.Request) {
	products, _ := h.store.ListModelProducts(r.Context(), nil)

	categories := make(map[string]int)
	providers := make(map[string]string)  // key -> display name
	scenes := make(map[string]int)

	for _, p := range products {
		categories[p.Category]++
		providers[p.ProviderKey] = p.Provider
		for _, s := range p.Scenes {
			scenes[s]++
		}
	}

	type FilterOption struct {
		Key   string `json:"key"`
		Label string `json:"label"`
		Count int    `json:"count"`
	}

	var catOpts []FilterOption
	catLabels := map[string]string{
		"chat":       "对话聊天",
		"reasoning":  "深度推理",
		"code":       "代码生成",
		"multimodal": "多模态",
		"embedding":  "向量嵌入",
		"image":      "图像生成",
	}
	for k, v := range categories {
		label := catLabels[k]
		if label == "" {
			label = k
		}
		catOpts = append(catOpts, FilterOption{Key: k, Label: label, Count: v})
	}

	var provOpts []FilterOption
	for k, v := range providers {
		count := 0
		for _, p := range products {
			if p.ProviderKey == k {
				count++
			}
		}
		provOpts = append(provOpts, FilterOption{Key: k, Label: v, Count: count})
	}

	var sceneOpts []FilterOption
	for k, v := range scenes {
		sceneOpts = append(sceneOpts, FilterOption{Key: k, Label: k, Count: v})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"categories": catOpts,
		"providers":  provOpts,
		"scenes":     sceneOpts,
		"price_ranges": []FilterOption{
			{Key: "free", Label: "免费", Count: 0},
			{Key: "low", Label: "经济型 (≤2元/百万Token)", Count: 0},
			{Key: "medium", Label: "标准型 (2-10元)", Count: 0},
			{Key: "high", Label: "高端型 (>10元)", Count: 0},
		},
		"billing_types": []FilterOption{
			{Key: "on_demand", Label: "按需计费", Count: 0},
			{Key: "monthly", Label: "包月套餐", Count: 0},
			{Key: "token_pack", Label: "Token包", Count: 0},
		},
		"sort_options": []FilterOption{
			{Key: "popular", Label: "综合推荐"},
			{Key: "price_asc", Label: "价格从低到高"},
			{Key: "price_desc", Label: "价格从高到低"},
			{Key: "quality", Label: "质量最高"},
			{Key: "speed", Label: "速度最快"},
		},
	})
}

// Subscribe 订购模型套餐
func (h *MarketHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(string)

	var req struct {
		ModelPlanID string `json:"model_plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "参数格式错误"})
		return
	}

	// 获取套餐信息
	plan, err := h.store.GetModelPlan(r.Context(), req.ModelPlanID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "套餐不存在"})
		return
	}

	// 获取模型商品信息
	product, err := h.store.GetModelProduct(r.Context(), plan.ModelProductID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "模型商品不存在"})
		return
	}

	// 非按需计费需要扣费
	if plan.BillingType != "on_demand" && plan.PriceFen > 0 {
		err = h.store.DebitWallet(r.Context(), userID, plan.PriceFen)
		if err != nil {
			writeJSON(w, http.StatusPaymentRequired, map[string]string{"error": "余额不足，请先充值"})
			return
		}
	}

	// 生成专属API Key
	apiKeyStr := generateToken("sk-kp")
	keyID := generateID("key")
	apiKey := &model.APIKey{
		ID:             keyID,
		UserID:         userID,
		Key:            apiKeyStr,
		Name:           product.Name + " - " + plan.Name,
		SubscriptionID: "",  // 稍后更新
		ModelProductID: product.ID,
		ModelID:        product.ModelID,
		BillingType:    plan.BillingType,
		RateLimit:      plan.RateLimit,
		Status:         "active",
		CreatedAt:      time.Now(),
	}

	// 创建订阅
	subID := generateID("sub")
	now := time.Now()
	var expiresAt time.Time
	if plan.ValidDays > 0 {
		expiresAt = now.AddDate(0, 0, plan.ValidDays)
	} else {
		expiresAt = now.AddDate(10, 0, 0) // 永久=10年
	}

	subscription := &model.ModelSubscription{
		ID:                  subID,
		UserID:              userID,
		ModelProductID:      product.ID,
		ModelPlanID:         plan.ID,
		ModelName:           product.Name,
		PlanName:            plan.Name,
		BillingType:         plan.BillingType,
		APIKeyID:            keyID,
		TokenQuota:          plan.TokenQuota,
		TokenUsed:           0,
		DailyTokens:         plan.DailyTokens,
		TodayTokenUsed:      0,
		PriceFen:            plan.PriceFen,
		OnDemandInputPrice:  plan.OnDemandInputPrice,
		OnDemandOutputPrice: plan.OnDemandOutputPrice,
		TotalCostFen:        0,
		StartAt:             now,
		ExpiresAt:           expiresAt,
		CreatedAt:           now,
		Status:              "active",
	}

	// 更新API Key的订阅ID
	apiKey.SubscriptionID = subID

	// 保存
	if err := h.store.CreateAPIKey(r.Context(), apiKey); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "创建API密钥失败"})
		return
	}
	if err := h.store.CreateSubscription(r.Context(), subscription); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "创建订阅失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"subscription": subscription,
		"api_key": map[string]interface{}{
			"id":    apiKey.ID,
			"key":   apiKey.Key,
			"name":  apiKey.Name,
			"model": apiKey.ModelID,
		},
		"message": "订购成功！请妥善保管您的API密钥，密钥仅显示一次。",
	})
}

// ListSubscriptions 获取用户的模型订阅列表
func (h *MarketHandler) ListSubscriptions(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(string)

	subs, err := h.store.ListSubscriptionsByUser(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "获取订阅列表失败"})
		return
	}
	if subs == nil {
		subs = []model.ModelSubscription{}
	}

	writeJSON(w, http.StatusOK, subs)
}

// GetSubscriptionDetail 获取订阅详情
func (h *MarketHandler) GetSubscriptionDetail(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(string)
	subID := r.URL.Query().Get("id")

	sub, err := h.store.GetSubscription(r.Context(), subID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "订阅不存在"})
		return
	}
	if sub.UserID != userID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "无权访问"})
		return
	}

	// 获取关联的API Key
	keys, _ := h.store.ListAPIKeysByUser(r.Context(), userID)
	var relatedKey *model.APIKey
	for _, k := range keys {
		if k.SubscriptionID == subID {
			relatedKey = &k
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"subscription": sub,
		"api_key":      relatedKey,
	})
}


