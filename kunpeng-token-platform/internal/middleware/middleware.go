package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/bright2048/kunpeng-token-platform/internal/store"
)

type contextKey string

const (
	ContextUserID    contextKey = "user_id"
	ContextAPIKeyID  contextKey = "api_key_id"
)

// CORS 跨域中间件
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token, X-Platform-Admin-Token")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// AdminTokenAuth 客户管理令牌鉴权（支持X-Admin-Token和Authorization Bearer两种方式）
func AdminTokenAuth(s store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("X-Admin-Token")
			if token == "" {
				// 也支持 Authorization: Bearer <token>
				auth := r.Header.Get("Authorization")
				if strings.HasPrefix(auth, "Bearer ") {
					token = strings.TrimPrefix(auth, "Bearer ")
				}
			}
			if token == "" {
				http.Error(w, `{"error":"missing authentication"}`, http.StatusUnauthorized)
				return
			}
			user, err := s.GetUserByAdminToken(r.Context(), token)
			if err != nil {
				http.Error(w, `{"error":"invalid admin token"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ContextUserID, user.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// APIKeyAuth API Key鉴权（Bearer Token）
func APIKeyAuth(s store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if !strings.HasPrefix(auth, "Bearer ") {
				http.Error(w, `{"error":"missing or invalid Authorization header"}`, http.StatusUnauthorized)
				return
			}
			key := strings.TrimPrefix(auth, "Bearer ")
			apiKey, err := s.GetAPIKeyByKey(r.Context(), key)
			if err != nil || apiKey.Status != "active" {
				http.Error(w, `{"error":"invalid or disabled API key"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ContextUserID, apiKey.UserID)
			ctx = context.WithValue(ctx, ContextAPIKeyID, apiKey.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// PlatformAdminAuth 平台管理员鉴权
func PlatformAdminAuth(platformToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("X-Platform-Admin-Token")
			if token == "" || token != platformToken {
				http.Error(w, `{"error":"unauthorized: invalid platform admin token"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserID 从context获取用户ID
func GetUserID(ctx context.Context) string {
	if v, ok := ctx.Value(ContextUserID).(string); ok {
		return v
	}
	return ""
}

// GetAPIKeyID 从context获取API Key ID
func GetAPIKeyID(ctx context.Context) string {
	if v, ok := ctx.Value(ContextAPIKeyID).(string); ok {
		return v
	}
	return ""
}
