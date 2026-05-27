package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/model"
	"github.com/bright2048/kunpeng-token-platform/internal/store"
)

// AdminHandler 管理员处理器
type AdminHandler struct {
	store store.Store
}

// NewAdminHandler 创建管理员处理器
func NewAdminHandler(s store.Store) *AdminHandler {
	return &AdminHandler{store: s}
}

// GetOverview 运营总览
func (h *AdminHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.store.GetAdminOverview(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "get overview failed"})
		return
	}
	writeJSON(w, http.StatusOK, overview)
}

// ListUsers 用户列表
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list users failed"})
		return
	}
	if users == nil {
		users = []model.UserDetail{}
	}
	writeJSON(w, http.StatusOK, users)
}

// AdjustBalance 人工调整余额
func (h *AdminHandler) AdjustBalance(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID    string `json:"user_id"`
		AmountFen int64  `json:"amount_fen"` // 正数为充值，负数为扣减
		Reason    string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.UserID == "" || req.Reason == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id and reason required"})
		return
	}

	if req.AmountFen == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "amount_fen cannot be 0"})
		return
	}

	if req.AmountFen > 0 {
		if err := h.store.CreditWallet(r.Context(), req.UserID, req.AmountFen); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	} else {
		if err := h.store.DebitWallet(r.Context(), req.UserID, -req.AmountFen); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":    "余额调整成功",
		"user_id":    req.UserID,
		"amount_fen": req.AmountFen,
		"amount":     fmt.Sprintf("%.2f元", float64(req.AmountFen)/100),
		"reason":     req.Reason,
	})
}

// --- 供应商管理 ---

// ListSuppliers 供应商列表
func (h *AdminHandler) ListSuppliers(w http.ResponseWriter, r *http.Request) {
	suppliers, err := h.store.ListSuppliers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list suppliers failed"})
		return
	}
	if suppliers == nil {
		suppliers = []model.Supplier{}
	}
	writeJSON(w, http.StatusOK, suppliers)
}

// CreateSupplier 创建供应商
func (h *AdminHandler) CreateSupplier(w http.ResponseWriter, r *http.Request) {
	var supplier model.Supplier
	if err := json.NewDecoder(r.Body).Decode(&supplier); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if supplier.Name == "" || supplier.Protocol == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and protocol required"})
		return
	}

	if supplier.ID == "" {
		supplier.ID = generateID("sup")
	}
	if supplier.Status == "" {
		supplier.Status = "active"
	}

	if err := h.store.CreateSupplier(r.Context(), &supplier); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create supplier failed"})
		return
	}

	writeJSON(w, http.StatusCreated, supplier)
}

// UpdateSupplier 更新供应商
func (h *AdminHandler) UpdateSupplier(w http.ResponseWriter, r *http.Request) {
	var supplier model.Supplier
	if err := json.NewDecoder(r.Body).Decode(&supplier); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if supplier.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}

	if err := h.store.UpdateSupplier(r.Context(), &supplier); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update supplier failed"})
		return
	}

	writeJSON(w, http.StatusOK, supplier)
}

// DeleteSupplier 删除供应商
func (h *AdminHandler) DeleteSupplier(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	h.store.DeleteSupplier(r.Context(), id)
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- 套餐管理 ---

// ListAllPlans 所有套餐（含禁用）
func (h *AdminHandler) ListAllPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := h.store.ListPlans(r.Context(), true)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list plans failed"})
		return
	}
	if plans == nil {
		plans = []model.Plan{}
	}
	writeJSON(w, http.StatusOK, plans)
}

// CreatePlan 创建套餐
func (h *AdminHandler) CreatePlan(w http.ResponseWriter, r *http.Request) {
	var plan model.Plan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if plan.Name == "" || plan.PriceFen <= 0 || plan.CreditFen <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name, price_fen, credit_fen required"})
		return
	}

	if plan.ID == "" {
		plan.ID = generateID("plan")
	}
	if plan.Status == "" {
		plan.Status = "active"
	}
	plan.CreatedAt = time.Now()

	if err := h.store.CreatePlan(r.Context(), &plan); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create plan failed"})
		return
	}

	writeJSON(w, http.StatusCreated, plan)
}

// UpdatePlan 更新套餐
func (h *AdminHandler) UpdatePlan(w http.ResponseWriter, r *http.Request) {
	var plan model.Plan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if plan.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}

	if err := h.store.UpdatePlan(r.Context(), &plan); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update plan failed"})
		return
	}

	writeJSON(w, http.StatusOK, plan)
}

// --- 优惠券管理 ---

// ListCoupons 优惠券列表
func (h *AdminHandler) ListCoupons(w http.ResponseWriter, r *http.Request) {
	coupons, err := h.store.ListCoupons(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list coupons failed"})
		return
	}
	if coupons == nil {
		coupons = []model.Coupon{}
	}
	writeJSON(w, http.StatusOK, coupons)
}

// CreateCoupon 创建优惠券
func (h *AdminHandler) CreateCoupon(w http.ResponseWriter, r *http.Request) {
	var coupon model.Coupon
	if err := json.NewDecoder(r.Body).Decode(&coupon); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if coupon.Code == "" || coupon.Type == "" || coupon.Value <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "code, type, value required"})
		return
	}

	if coupon.ID == "" {
		coupon.ID = generateID("cpn")
	}
	if coupon.Status == "" {
		coupon.Status = "active"
	}
	if coupon.UserLimit == 0 {
		coupon.UserLimit = 1
	}
	if coupon.ExpiresAt.IsZero() {
		coupon.ExpiresAt = time.Now().AddDate(1, 0, 0) // 默认1年有效
	}
	coupon.CreatedAt = time.Now()

	if err := h.store.CreateCoupon(r.Context(), &coupon); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create coupon failed"})
		return
	}

	writeJSON(w, http.StatusCreated, coupon)
}

// ============================================================
// 模型商品管理
// ============================================================

// ListModelProducts 模型商品列表
func (h *AdminHandler) ListModelProducts(w http.ResponseWriter, r *http.Request) {
	products, err := h.store.ListModelProducts(r.Context(), nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list products failed"})
		return
	}
	if products == nil {
		products = []model.ModelProduct{}
	}
	writeJSON(w, http.StatusOK, products)
}

// CreateModelProduct 创建模型商品
func (h *AdminHandler) CreateModelProduct(w http.ResponseWriter, r *http.Request) {
	var product model.ModelProduct
	if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if product.Name == "" || product.Provider == "" || product.ModelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name, provider, model_id required"})
		return
	}

	if product.ID == "" {
		product.ID = generateID("mp")
	}
	if product.Status == "" {
		product.Status = "active"
	}
	product.CreatedAt = time.Now()
	product.UpdatedAt = time.Now()

	if err := h.store.CreateModelProduct(r.Context(), &product); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create product failed"})
		return
	}

	writeJSON(w, http.StatusCreated, product)
}

// UpdateModelProduct 更新模型商品
func (h *AdminHandler) UpdateModelProduct(w http.ResponseWriter, r *http.Request) {
	var product model.ModelProduct
	if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if product.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	product.UpdatedAt = time.Now()

	if err := h.store.UpdateModelProduct(r.Context(), &product); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update product failed"})
		return
	}

	writeJSON(w, http.StatusOK, product)
}

// DeleteModelProduct 删除模型商品
func (h *AdminHandler) DeleteModelProduct(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	h.store.DeleteModelProduct(r.Context(), id)
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// ============================================================
// 模型套餐管理
// ============================================================

// ListModelPlans 模型套餐列表
func (h *AdminHandler) ListModelPlans(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Query().Get("product_id")
	if productID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "product_id required"})
		return
	}
	plans, err := h.store.ListModelPlansByProduct(r.Context(), productID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list plans failed"})
		return
	}
	if plans == nil {
		plans = []model.ModelPlan{}
	}
	writeJSON(w, http.StatusOK, plans)
}

// CreateModelPlan 创建模型套餐
func (h *AdminHandler) CreateModelPlan(w http.ResponseWriter, r *http.Request) {
	var plan model.ModelPlan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if plan.ModelProductID == "" || plan.Name == "" || plan.BillingType == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model_product_id, name, billing_type required"})
		return
	}

	if plan.ID == "" {
		plan.ID = generateID("mplan")
	}
	if plan.Status == "" {
		plan.Status = "active"
	}
	plan.CreatedAt = time.Now()

	if err := h.store.CreateModelPlan(r.Context(), &plan); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create plan failed"})
		return
	}

	writeJSON(w, http.StatusCreated, plan)
}

// UpdateModelPlan 更新模型套餐
func (h *AdminHandler) UpdateModelPlan(w http.ResponseWriter, r *http.Request) {
	var plan model.ModelPlan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if plan.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}

	if err := h.store.UpdateModelPlan(r.Context(), &plan); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update plan failed"})
		return
	}

	writeJSON(w, http.StatusOK, plan)
}

// DeleteModelPlan 删除模型套餐
func (h *AdminHandler) DeleteModelPlan(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	h.store.DeleteModelPlan(r.Context(), id)
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}
