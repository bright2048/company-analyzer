package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/bright2048/kunpeng-token-platform/internal/middleware"
	"github.com/bright2048/kunpeng-token-platform/internal/model"
	"github.com/bright2048/kunpeng-token-platform/internal/service"
)

// ProxyHandler 代理处理器
type ProxyHandler struct {
	proxyService *service.ProxyService
}

// NewProxyHandler 创建代理处理器
func NewProxyHandler(ps *service.ProxyService) *ProxyHandler {
	return &ProxyHandler{proxyService: ps}
}

// ChatCompletions 统一对话接口
func (h *ProxyHandler) ChatCompletions(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	apiKeyID := middleware.GetAPIKeyID(r.Context())

	var req model.ChatCompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(req.Messages) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "messages cannot be empty"})
		return
	}

	// 流式响应
	if req.Stream {
		h.handleStream(w, r, userID, apiKeyID, &req)
		return
	}

	// 非流式响应
	result, err := h.proxyService.ChatCompletion(r.Context(), userID, apiKeyID, &req)
	if err != nil {
		if riskErr, ok := err.(*service.RiskError); ok {
			writeJSON(w, riskErr.Code, map[string]string{"error": riskErr.Message})
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, result.Response)
}

// handleStream 处理流式响应
func (h *ProxyHandler) handleStream(w http.ResponseWriter, r *http.Request, userID, apiKeyID string, req *model.ChatCompletionRequest) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	err := h.proxyService.ChatCompletionStream(r.Context(), userID, apiKeyID, req, func(data []byte) error {
		_, err := w.Write(data)
		if err != nil {
			return err
		}
		flusher.Flush()
		return nil
	})

	if err != nil {
		if riskErr, ok := err.(*service.RiskError); ok {
			errData := fmt.Sprintf("data: {\"error\":\"%s\"}\n\n", riskErr.Message)
			w.Write([]byte(errData))
			flusher.Flush()
			return
		}
		errData := fmt.Sprintf("data: {\"error\":\"%s\"}\n\n", err.Error())
		w.Write([]byte(errData))
		flusher.Flush()
	}
}
