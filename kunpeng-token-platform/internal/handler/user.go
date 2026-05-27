package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/middleware"
	"github.com/bright2048/kunpeng-token-platform/internal/model"
	"github.com/bright2048/kunpeng-token-platform/internal/store"
	"golang.org/x/crypto/bcrypt"
)

// UserHandler 用户相关处理器
type UserHandler struct {
	store store.Store
}

// NewUserHandler 创建用户处理器
func NewUserHandler(s store.Store) *UserHandler {
	return &UserHandler{store: s}
}

// Register 用户注册
func (h *UserHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Company  string `json:"company"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and password required"})
		return
	}

	if len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
		return
	}

	// 检查邮箱是否已注册
	if _, err := h.store.GetUserByEmail(r.Context(), req.Email); err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
		return
	}

	// 密码哈希
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	userID := generateID("usr")
	adminToken := generateToken("kp")

	user := &model.User{
		ID:           userID,
		Email:        req.Email,
		PasswordHash: string(hash),
		Company:      req.Company,
		AdminToken:   adminToken,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.store.CreateUser(r.Context(), user); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create user failed"})
		return
	}

	// 创建钱包
	wallet := &model.Wallet{
		UserID:      userID,
		Balance:     0,
		TotalSpent:  0,
		LastUpdated: time.Now(),
	}
	h.store.CreateWallet(r.Context(), wallet)

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"admin_token": user.AdminToken,
		"message":     "注册成功，请保存您的管理令牌(admin_token)用于控制台登录",
	})
}

// Login 用户登录
func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "邮箱或密码错误"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "邮箱或密码错误"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"admin_token": user.AdminToken,
		"company":     user.Company,
	})
}

// GetProfile 获取用户信息
func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	wallet, _ := h.store.GetWallet(r.Context(), userID)
	balance := int64(0)
	totalSpent := int64(0)
	if wallet != nil {
		balance = wallet.Balance
		totalSpent = wallet.TotalSpent
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"company":     user.Company,
		"balance_fen": balance,
		"balance":     fmt.Sprintf("%.2f", float64(balance)/100),
		"total_spent": fmt.Sprintf("%.2f", float64(totalSpent)/100),
		"created_at":  user.CreatedAt,
	})
}

// CreateAPIKey 创建API Key
func (h *UserHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req struct {
		Name       string `json:"name"`
		DailyLimit int64  `json:"daily_limit"`
		RateLimit  int    `json:"rate_limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.Name == "" {
		req.Name = "默认密钥"
	}

	apiKey := &model.APIKey{
		ID:         generateID("key"),
		UserID:     userID,
		Key:        generateToken("sk-kp"),
		Name:       req.Name,
		DailyLimit: req.DailyLimit,
		RateLimit:  req.RateLimit,
		Status:     "active",
		CreatedAt:  time.Now(),
	}

	if err := h.store.CreateAPIKey(r.Context(), apiKey); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create api key failed"})
		return
	}

	writeJSON(w, http.StatusCreated, apiKey)
}

// ListAPIKeys 列出用户的API Keys
func (h *UserHandler) ListAPIKeys(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	keys, err := h.store.ListAPIKeysByUser(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list keys failed"})
		return
	}
	if keys == nil {
		keys = []model.APIKey{}
	}
	writeJSON(w, http.StatusOK, keys)
}

// DeleteAPIKey 删除API Key
func (h *UserHandler) DeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	keyID := r.URL.Query().Get("id")
	if keyID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	h.store.DeleteAPIKey(r.Context(), keyID)
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// GetWallet 获取钱包信息
func (h *UserHandler) GetWallet(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	wallet, err := h.store.GetWallet(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "wallet not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"balance_fen":    wallet.Balance,
		"balance":        fmt.Sprintf("%.2f", float64(wallet.Balance)/100),
		"total_spent":    fmt.Sprintf("%.2f", float64(wallet.TotalSpent)/100),
		"total_spent_fen": wallet.TotalSpent,
		"last_updated":   wallet.LastUpdated,
	})
}

// GetUsage 获取使用记录
func (h *UserHandler) GetUsage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	records, err := h.store.ListUsageByUser(r.Context(), userID, 100)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "get usage failed"})
		return
	}
	if records == nil {
		records = []model.UsageRecord{}
	}
	writeJSON(w, http.StatusOK, records)
}

// GetUsageSummary 获取用量汇总
func (h *UserHandler) GetUsageSummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	summary, err := h.store.GetUsageSummary(r.Context(), userID, 30)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "get summary failed"})
		return
	}
	if summary == nil {
		summary = []model.UsageSummary{}
	}
	writeJSON(w, http.StatusOK, summary)
}

// ListPlans 获取套餐列表
func (h *UserHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := h.store.ListPlans(r.Context(), false)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list plans failed"})
		return
	}
	if plans == nil {
		plans = []model.Plan{}
	}
	writeJSON(w, http.StatusOK, plans)
}

// PurchasePlan 购买套餐（模拟支付）
func (h *UserHandler) PurchasePlan(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req struct {
		PlanID string `json:"plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	plan, err := h.store.GetPlan(r.Context(), req.PlanID)
	if err != nil || plan.Status != "active" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "套餐不存在或已下架"})
		return
	}

	// 检查限购
	if plan.LimitPerUser > 0 {
		count, _ := h.store.CountUserPurchasesForPlan(r.Context(), userID, plan.ID)
		if count >= plan.LimitPerUser {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "已达到该套餐限购次数"})
			return
		}
	}

	// 模拟支付成功，直接到账
	var expiresAt time.Time
	if plan.ValidDays > 0 {
		expiresAt = time.Now().AddDate(0, 0, plan.ValidDays)
	} else {
		expiresAt = time.Now().AddDate(100, 0, 0) // 永久有效
	}

	purchase := &model.Purchase{
		ID:        generateID("pur"),
		UserID:    userID,
		PlanID:    plan.ID,
		PlanName:  plan.Name,
		PriceFen:  plan.PriceFen,
		CreditFen: plan.CreditFen,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}

	h.store.CreatePurchase(r.Context(), purchase)
	h.store.CreditWallet(r.Context(), userID, plan.CreditFen)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":    "购买成功",
		"purchase":   purchase,
		"credited":   fmt.Sprintf("%.2f元", float64(plan.CreditFen)/100),
		"expires_at": expiresAt.Format("2006-01-02"),
	})
}

// RedeemCoupon 核销优惠券
func (h *UserHandler) RedeemCoupon(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	coupon, err := h.store.GetCouponByCode(r.Context(), req.Code)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "优惠券不存在"})
		return
	}

	if coupon.Status != "active" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "优惠券已失效"})
		return
	}

	if time.Now().After(coupon.ExpiresAt) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "优惠券已过期"})
		return
	}

	if coupon.MaxUses > 0 && coupon.UsedCount >= coupon.MaxUses {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "优惠券已被领完"})
		return
	}

	used, _ := h.store.HasUserUsedCoupon(r.Context(), userID, coupon.ID)
	if used {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "您已使用过该优惠券"})
		return
	}

	// 核销
	var creditFen int64
	switch coupon.Type {
	case "fixed_credit":
		creditFen = coupon.Value
	case "gift_tokens":
		// 赠送Token折算为余额（按平台输出价计算）
		creditFen = coupon.Value / 10000 // 简化：1万Token ≈ 1分
	default:
		creditFen = coupon.Value
	}

	h.store.CreditWallet(r.Context(), userID, creditFen)
	h.store.IncrementCouponUsed(r.Context(), coupon.ID)
	h.store.CreateCouponUseRecord(r.Context(), &model.CouponUseRecord{
		ID:        generateID("cur"),
		CouponID:  coupon.ID,
		UserID:    userID,
		CreditFen: creditFen,
		CreatedAt: time.Now(),
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "优惠券核销成功",
		"credited": fmt.Sprintf("%.2f元", float64(creditFen)/100),
	})
}

// Helpers
func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}

func generateToken(prefix string) string {
	b := make([]byte, 24)
	rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
