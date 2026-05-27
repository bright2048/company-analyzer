package store

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/model"
)

// MemoryStore 内存存储实现
type MemoryStore struct {
	mu             sync.RWMutex
	users          map[string]*model.User
	usersByEmail   map[string]*model.User
	usersByToken   map[string]*model.User
	apiKeys        map[string]*model.APIKey
	apiKeysByKey   map[string]*model.APIKey
	wallets        map[string]*model.Wallet
	suppliers      map[string]*model.Supplier
	plans          map[string]*model.Plan
	purchases      []model.Purchase
	coupons        map[string]*model.Coupon
	couponsByCode  map[string]*model.Coupon
	couponUses     []model.CouponUseRecord
	usageRecords   []model.UsageRecord
	riskEvents     []model.RiskEvent
}

// NewMemoryStore 创建内存存储
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:         make(map[string]*model.User),
		usersByEmail:  make(map[string]*model.User),
		usersByToken:  make(map[string]*model.User),
		apiKeys:       make(map[string]*model.APIKey),
		apiKeysByKey:  make(map[string]*model.APIKey),
		wallets:       make(map[string]*model.Wallet),
		suppliers:     make(map[string]*model.Supplier),
		plans:         make(map[string]*model.Plan),
		purchases:     make([]model.Purchase, 0),
		coupons:       make(map[string]*model.Coupon),
		couponsByCode: make(map[string]*model.Coupon),
		couponUses:    make([]model.CouponUseRecord, 0),
		usageRecords:  make([]model.UsageRecord, 0),
		riskEvents:    make([]model.RiskEvent, 0),
	}
}

// User operations
func (m *MemoryStore) CreateUser(ctx context.Context, user *model.User) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.usersByEmail[user.Email]; exists {
		return fmt.Errorf("email already exists")
	}
	m.users[user.ID] = user
	m.usersByEmail[user.Email] = user
	m.usersByToken[user.AdminToken] = user
	return nil
}

func (m *MemoryStore) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if u, ok := m.usersByEmail[email]; ok {
		return u, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MemoryStore) GetUserByID(ctx context.Context, id string) (*model.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if u, ok := m.users[id]; ok {
		return u, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MemoryStore) GetUserByAdminToken(ctx context.Context, token string) (*model.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if u, ok := m.usersByToken[token]; ok {
		return u, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MemoryStore) ListUsers(ctx context.Context) ([]model.UserDetail, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.UserDetail
	for _, u := range m.users {
		detail := model.UserDetail{User: *u}
		if w, ok := m.wallets[u.ID]; ok {
			detail.Balance = w.Balance
			detail.TotalSpent = w.TotalSpent
		}
		var count int64
		var lastActive time.Time
		for _, r := range m.usageRecords {
			if r.UserID == u.ID {
				count++
				if r.RequestedAt.After(lastActive) {
					lastActive = r.RequestedAt
				}
			}
		}
		detail.RequestCount = count
		detail.LastActiveAt = lastActive
		result = append(result, detail)
	}
	return result, nil
}

// API Key operations
func (m *MemoryStore) CreateAPIKey(ctx context.Context, key *model.APIKey) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.apiKeys[key.ID] = key
	m.apiKeysByKey[key.Key] = key
	return nil
}

func (m *MemoryStore) GetAPIKeyByKey(ctx context.Context, key string) (*model.APIKey, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if k, ok := m.apiKeysByKey[key]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("api key not found")
}

func (m *MemoryStore) ListAPIKeysByUser(ctx context.Context, userID string) ([]model.APIKey, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.APIKey
	for _, k := range m.apiKeys {
		if k.UserID == userID {
			result = append(result, *k)
		}
	}
	return result, nil
}

func (m *MemoryStore) UpdateAPIKey(ctx context.Context, key *model.APIKey) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.apiKeys[key.ID] = key
	m.apiKeysByKey[key.Key] = key
	return nil
}

func (m *MemoryStore) DeleteAPIKey(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if k, ok := m.apiKeys[id]; ok {
		delete(m.apiKeysByKey, k.Key)
		delete(m.apiKeys, id)
	}
	return nil
}

// Wallet operations
func (m *MemoryStore) GetWallet(ctx context.Context, userID string) (*model.Wallet, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if w, ok := m.wallets[userID]; ok {
		return w, nil
	}
	return nil, fmt.Errorf("wallet not found")
}

func (m *MemoryStore) CreateWallet(ctx context.Context, wallet *model.Wallet) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.wallets[wallet.UserID] = wallet
	return nil
}

func (m *MemoryStore) CreditWallet(ctx context.Context, userID string, amountFen int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.wallets[userID]
	if !ok {
		return fmt.Errorf("wallet not found")
	}
	w.Balance += amountFen
	w.LastUpdated = time.Now()
	return nil
}

func (m *MemoryStore) DebitWallet(ctx context.Context, userID string, amountFen int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.wallets[userID]
	if !ok {
		return fmt.Errorf("wallet not found")
	}
	if w.Balance < amountFen {
		return fmt.Errorf("insufficient balance")
	}
	w.Balance -= amountFen
	w.TotalSpent += amountFen
	w.LastUpdated = time.Now()
	return nil
}

// Supplier operations
func (m *MemoryStore) ListSuppliers(ctx context.Context) ([]model.Supplier, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.Supplier
	for _, s := range m.suppliers {
		result = append(result, *s)
	}
	return result, nil
}

func (m *MemoryStore) GetSupplier(ctx context.Context, id string) (*model.Supplier, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.suppliers[id]; ok {
		return s, nil
	}
	return nil, fmt.Errorf("supplier not found")
}

func (m *MemoryStore) CreateSupplier(ctx context.Context, supplier *model.Supplier) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.suppliers[supplier.ID] = supplier
	return nil
}

func (m *MemoryStore) UpdateSupplier(ctx context.Context, supplier *model.Supplier) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.suppliers[supplier.ID] = supplier
	return nil
}

func (m *MemoryStore) DeleteSupplier(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.suppliers, id)
	return nil
}

// Plan operations
func (m *MemoryStore) ListPlans(ctx context.Context, includeDisabled bool) ([]model.Plan, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.Plan
	for _, p := range m.plans {
		if !includeDisabled && p.Status != "active" {
			continue
		}
		result = append(result, *p)
	}
	return result, nil
}

func (m *MemoryStore) GetPlan(ctx context.Context, id string) (*model.Plan, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if p, ok := m.plans[id]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("plan not found")
}

func (m *MemoryStore) CreatePlan(ctx context.Context, plan *model.Plan) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.plans[plan.ID] = plan
	return nil
}

func (m *MemoryStore) UpdatePlan(ctx context.Context, plan *model.Plan) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.plans[plan.ID] = plan
	return nil
}

func (m *MemoryStore) DeletePlan(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.plans, id)
	return nil
}

// Purchase operations
func (m *MemoryStore) CreatePurchase(ctx context.Context, purchase *model.Purchase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.purchases = append(m.purchases, *purchase)
	return nil
}

func (m *MemoryStore) ListPurchasesByUser(ctx context.Context, userID string) ([]model.Purchase, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.Purchase
	for _, p := range m.purchases {
		if p.UserID == userID {
			result = append(result, p)
		}
	}
	return result, nil
}

func (m *MemoryStore) CountUserPurchasesForPlan(ctx context.Context, userID, planID string) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, p := range m.purchases {
		if p.UserID == userID && p.PlanID == planID {
			count++
		}
	}
	return count, nil
}

// Coupon operations
func (m *MemoryStore) ListCoupons(ctx context.Context) ([]model.Coupon, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.Coupon
	for _, c := range m.coupons {
		result = append(result, *c)
	}
	return result, nil
}

func (m *MemoryStore) GetCouponByCode(ctx context.Context, code string) (*model.Coupon, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if c, ok := m.couponsByCode[code]; ok {
		return c, nil
	}
	return nil, fmt.Errorf("coupon not found")
}

func (m *MemoryStore) GetCoupon(ctx context.Context, id string) (*model.Coupon, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if c, ok := m.coupons[id]; ok {
		return c, nil
	}
	return nil, fmt.Errorf("coupon not found")
}

func (m *MemoryStore) CreateCoupon(ctx context.Context, coupon *model.Coupon) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.coupons[coupon.ID] = coupon
	m.couponsByCode[coupon.Code] = coupon
	return nil
}

func (m *MemoryStore) UpdateCoupon(ctx context.Context, coupon *model.Coupon) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.coupons[coupon.ID] = coupon
	m.couponsByCode[coupon.Code] = coupon
	return nil
}

func (m *MemoryStore) IncrementCouponUsed(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.coupons[id]; ok {
		c.UsedCount++
	}
	return nil
}

func (m *MemoryStore) HasUserUsedCoupon(ctx context.Context, userID, couponID string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, r := range m.couponUses {
		if r.UserID == userID && r.CouponID == couponID {
			count++
		}
	}
	c, ok := m.coupons[couponID]
	if !ok {
		return true, nil
	}
	limit := c.UserLimit
	if limit == 0 {
		limit = 1
	}
	return count >= limit, nil
}

func (m *MemoryStore) CreateCouponUseRecord(ctx context.Context, record *model.CouponUseRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.couponUses = append(m.couponUses, *record)
	return nil
}

// Usage operations
func (m *MemoryStore) CreateUsageRecord(ctx context.Context, record *model.UsageRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.usageRecords = append(m.usageRecords, *record)
	return nil
}

func (m *MemoryStore) ListUsageByUser(ctx context.Context, userID string, limit int) ([]model.UsageRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []model.UsageRecord
	for i := len(m.usageRecords) - 1; i >= 0; i-- {
		if m.usageRecords[i].UserID == userID {
			result = append(result, m.usageRecords[i])
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *MemoryStore) GetUsageSummary(ctx context.Context, userID string, days int) ([]model.UsageSummary, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	summaryMap := make(map[string]*model.UsageSummary)
	cutoff := time.Now().AddDate(0, 0, -days)
	for _, r := range m.usageRecords {
		if r.UserID == userID && r.RequestedAt.After(cutoff) {
			date := r.RequestedAt.Format("2006-01-02")
			if _, ok := summaryMap[date]; !ok {
				summaryMap[date] = &model.UsageSummary{Date: date}
			}
			s := summaryMap[date]
			s.RequestCount++
			s.InputTokens += int64(r.InputTokens)
			s.OutputTokens += int64(r.OutputTokens)
			s.TotalCostFen += r.CostFen
		}
	}
	var result []model.UsageSummary
	for _, s := range summaryMap {
		result = append(result, *s)
	}
	return result, nil
}

func (m *MemoryStore) GetAdminOverview(ctx context.Context) (*model.AdminOverview, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	overview := &model.AdminOverview{
		TotalUsers: len(m.users),
	}
	today := time.Now().Format("2006-01-02")
	for _, r := range m.usageRecords {
		overview.TotalRequests++
		if r.RequestedAt.Format("2006-01-02") == today {
			overview.TodayRequests++
			overview.TodayRevenueFen += r.CostFen
			overview.TodayCostFen += r.SupplierCostFen
		}
	}
	for _, w := range m.wallets {
		overview.TotalBalanceFen += w.Balance
	}
	return overview, nil
}

// Risk operations
func (m *MemoryStore) CreateRiskEvent(ctx context.Context, event *model.RiskEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.riskEvents = append(m.riskEvents, *event)
	return nil
}

func (m *MemoryStore) CountUserRequestsInMinute(ctx context.Context, userID string) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	oneMinuteAgo := time.Now().Add(-time.Minute)
	for i := len(m.usageRecords) - 1; i >= 0; i-- {
		r := m.usageRecords[i]
		if r.RequestedAt.Before(oneMinuteAgo) {
			break
		}
		if r.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (m *MemoryStore) GetUserDailySpent(ctx context.Context, userID string) (int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var spent int64
	today := time.Now().Format("2006-01-02")
	for _, r := range m.usageRecords {
		if r.UserID == userID && r.RequestedAt.Format("2006-01-02") == today && r.Status == "success" {
			spent += r.CostFen
		}
	}
	return spent, nil
}
