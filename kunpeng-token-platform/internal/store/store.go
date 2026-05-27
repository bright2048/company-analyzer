package store

import (
	"context"
	"github.com/bright2048/kunpeng-token-platform/internal/model"
)

// Store 存储层接口
type Store interface {
	// User
	CreateUser(ctx context.Context, user *model.User) error
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)
	GetUserByID(ctx context.Context, id string) (*model.User, error)
	GetUserByAdminToken(ctx context.Context, token string) (*model.User, error)
	ListUsers(ctx context.Context) ([]model.UserDetail, error)

	// API Key
	CreateAPIKey(ctx context.Context, key *model.APIKey) error
	GetAPIKeyByKey(ctx context.Context, key string) (*model.APIKey, error)
	ListAPIKeysByUser(ctx context.Context, userID string) ([]model.APIKey, error)
	UpdateAPIKey(ctx context.Context, key *model.APIKey) error
	DeleteAPIKey(ctx context.Context, id string) error

	// Wallet
	GetWallet(ctx context.Context, userID string) (*model.Wallet, error)
	CreateWallet(ctx context.Context, wallet *model.Wallet) error
	CreditWallet(ctx context.Context, userID string, amountFen int64) error
	DebitWallet(ctx context.Context, userID string, amountFen int64) error

	// Model Product (模型商品)
	ListModelProducts(ctx context.Context, filter *model.ModelFilter) ([]model.ModelProduct, error)
	GetModelProduct(ctx context.Context, id string) (*model.ModelProduct, error)
	CreateModelProduct(ctx context.Context, product *model.ModelProduct) error
	UpdateModelProduct(ctx context.Context, product *model.ModelProduct) error
	DeleteModelProduct(ctx context.Context, id string) error

	// Model Plan (模型套餐)
	ListModelPlansByProduct(ctx context.Context, productID string) ([]model.ModelPlan, error)
	GetModelPlan(ctx context.Context, id string) (*model.ModelPlan, error)
	CreateModelPlan(ctx context.Context, plan *model.ModelPlan) error
	UpdateModelPlan(ctx context.Context, plan *model.ModelPlan) error
	DeleteModelPlan(ctx context.Context, id string) error

	// Model Subscription (模型订阅)
	CreateSubscription(ctx context.Context, sub *model.ModelSubscription) error
	GetSubscription(ctx context.Context, id string) (*model.ModelSubscription, error)
	GetSubscriptionByAPIKey(ctx context.Context, apiKeyID string) (*model.ModelSubscription, error)
	ListSubscriptionsByUser(ctx context.Context, userID string) ([]model.ModelSubscription, error)
	UpdateSubscription(ctx context.Context, sub *model.ModelSubscription) error

	// Supplier
	ListSuppliers(ctx context.Context) ([]model.Supplier, error)
	ListSuppliersByModel(ctx context.Context, modelProductID string) ([]model.Supplier, error)
	GetSupplier(ctx context.Context, id string) (*model.Supplier, error)
	CreateSupplier(ctx context.Context, supplier *model.Supplier) error
	UpdateSupplier(ctx context.Context, supplier *model.Supplier) error
	DeleteSupplier(ctx context.Context, id string) error

	// Plan (充值包，保留兼容)
	ListPlans(ctx context.Context, includeDisabled bool) ([]model.Plan, error)
	GetPlan(ctx context.Context, id string) (*model.Plan, error)
	CreatePlan(ctx context.Context, plan *model.Plan) error
	UpdatePlan(ctx context.Context, plan *model.Plan) error
	DeletePlan(ctx context.Context, id string) error

	// Purchase
	CreatePurchase(ctx context.Context, purchase *model.Purchase) error
	ListPurchasesByUser(ctx context.Context, userID string) ([]model.Purchase, error)
	CountUserPurchasesForPlan(ctx context.Context, userID, planID string) (int, error)

	// Coupon
	ListCoupons(ctx context.Context) ([]model.Coupon, error)
	GetCouponByCode(ctx context.Context, code string) (*model.Coupon, error)
	GetCoupon(ctx context.Context, id string) (*model.Coupon, error)
	CreateCoupon(ctx context.Context, coupon *model.Coupon) error
	UpdateCoupon(ctx context.Context, coupon *model.Coupon) error
	IncrementCouponUsed(ctx context.Context, id string) error
	HasUserUsedCoupon(ctx context.Context, userID, couponID string) (bool, error)
	CreateCouponUseRecord(ctx context.Context, record *model.CouponUseRecord) error

	// Usage
	CreateUsageRecord(ctx context.Context, record *model.UsageRecord) error
	ListUsageByUser(ctx context.Context, userID string, limit int) ([]model.UsageRecord, error)
	GetUsageSummary(ctx context.Context, userID string, days int) ([]model.UsageSummary, error)
	GetAdminOverview(ctx context.Context) (*model.AdminOverview, error)

	// Risk
	CreateRiskEvent(ctx context.Context, event *model.RiskEvent) error
	CountUserRequestsInMinute(ctx context.Context, userID string) (int, error)
	GetUserDailySpent(ctx context.Context, userID string) (int64, error)
}
