package upstream

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/model"
)

// BaiduAdapter 百度文心ERNIE适配器
// 使用OAuth2 client_credentials获取access_token
type BaiduAdapter struct {
	supplier    *model.Supplier
	client      *http.Client
	tokenMu     sync.RWMutex
	accessToken string
	tokenExpiry time.Time
}

// NewBaiduAdapter 创建百度文心适配器
func NewBaiduAdapter(supplier *model.Supplier) Adapter {
	return &BaiduAdapter{
		supplier: supplier,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// getAccessToken 获取或刷新access_token
func (a *BaiduAdapter) getAccessToken(ctx context.Context) (string, error) {
	a.tokenMu.RLock()
	if a.accessToken != "" && time.Now().Before(a.tokenExpiry) {
		token := a.accessToken
		a.tokenMu.RUnlock()
		return token, nil
	}
	a.tokenMu.RUnlock()

	a.tokenMu.Lock()
	defer a.tokenMu.Unlock()

	// 双重检查
	if a.accessToken != "" && time.Now().Before(a.tokenExpiry) {
		return a.accessToken, nil
	}

	url := fmt.Sprintf("https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=%s&client_secret=%s",
		a.supplier.APIKey, a.supplier.SecretKey)

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return "", fmt.Errorf("create token request: %w", err)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("get token: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if tokenResp.Error != "" {
		return "", fmt.Errorf("baidu auth error: %s", tokenResp.Error)
	}

	a.accessToken = tokenResp.AccessToken
	// 提前60秒刷新
	a.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second)

	return a.accessToken, nil
}

func (a *BaiduAdapter) getBaseURL() string {
	if a.supplier.BaseURL != "" {
		return strings.TrimRight(a.supplier.BaseURL, "/")
	}
	return "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat"
}

// ChatCompletion 非流式调用
func (a *BaiduAdapter) ChatCompletion(ctx context.Context, req *model.ChatCompletionRequest) (*model.ChatCompletionResponse, error) {
	token, err := a.getAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	// 转换消息格式
	messages := make([]map[string]string, 0, len(req.Messages))
	for _, msg := range req.Messages {
		if msg.Role == "system" {
			continue // 百度文心不支持system角色，需特殊处理
		}
		messages = append(messages, map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}

	reqBody := map[string]interface{}{
		"messages": messages,
		"stream":   false,
	}
	if req.Temperature != nil {
		reqBody["temperature"] = *req.Temperature
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// 根据模型构建URL
	modelPath := a.supplier.Model
	if modelPath == "" {
		modelPath = "ernie-4.0-8k"
	}
	url := fmt.Sprintf("%s/%s?access_token=%s", a.getBaseURL(), modelPath, token)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	var baiduResp struct {
		ID      string `json:"id"`
		Result  string `json:"result"`
		Usage   struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
		ErrorCode int    `json:"error_code"`
		ErrorMsg  string `json:"error_msg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&baiduResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if baiduResp.ErrorCode != 0 {
		return nil, fmt.Errorf("baidu error (%d): %s", baiduResp.ErrorCode, baiduResp.ErrorMsg)
	}

	// 转换为统一格式
	return &model.ChatCompletionResponse{
		ID:      baiduResp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   a.supplier.Model,
		Choices: []model.ChatChoice{
			{
				Index:        0,
				Message:      model.ChatMessage{Role: "assistant", Content: baiduResp.Result},
				FinishReason: "stop",
			},
		},
		Usage: &model.ChatUsage{
			PromptTokens:     baiduResp.Usage.PromptTokens,
			CompletionTokens: baiduResp.Usage.CompletionTokens,
			TotalTokens:      baiduResp.Usage.TotalTokens,
		},
	}, nil
}

// ChatCompletionStream 流式调用
func (a *BaiduAdapter) ChatCompletionStream(ctx context.Context, req *model.ChatCompletionRequest) (StreamReader, error) {
	token, err := a.getAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	messages := make([]map[string]string, 0, len(req.Messages))
	for _, msg := range req.Messages {
		if msg.Role == "system" {
			continue
		}
		messages = append(messages, map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}

	reqBody := map[string]interface{}{
		"messages": messages,
		"stream":   true,
	}
	if req.Temperature != nil {
		reqBody["temperature"] = *req.Temperature
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	modelPath := a.supplier.Model
	if modelPath == "" {
		modelPath = "ernie-4.0-8k"
	}
	url := fmt.Sprintf("%s/%s?access_token=%s", a.getBaseURL(), modelPath, token)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("baidu stream error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return &BaiduStreamReader{
		body:    resp.Body,
		scanner: bufio.NewScanner(resp.Body),
		model:   a.supplier.Model,
	}, nil
}

// BaiduStreamReader 百度流式读取器
type BaiduStreamReader struct {
	body    io.ReadCloser
	scanner *bufio.Scanner
	model   string
	usage   *model.ChatUsage
	done    bool
}

func (r *BaiduStreamReader) Read() ([]byte, error) {
	if r.done {
		return nil, io.EOF
	}

	for r.scanner.Scan() {
		line := r.scanner.Text()
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")

			var baiduChunk struct {
				ID         string `json:"id"`
				Result     string `json:"result"`
				IsEnd      bool   `json:"is_end"`
				Usage      *struct {
					PromptTokens     int `json:"prompt_tokens"`
					CompletionTokens int `json:"completion_tokens"`
					TotalTokens      int `json:"total_tokens"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &baiduChunk); err != nil {
				continue
			}

			if baiduChunk.Usage != nil {
				r.usage = &model.ChatUsage{
					PromptTokens:     baiduChunk.Usage.PromptTokens,
					CompletionTokens: baiduChunk.Usage.CompletionTokens,
					TotalTokens:      baiduChunk.Usage.TotalTokens,
				}
			}

			// 转换为OpenAI格式的SSE
			chunk := model.StreamChunk{
				ID:      baiduChunk.ID,
				Object:  "chat.completion.chunk",
				Created: time.Now().Unix(),
				Model:   r.model,
				Choices: []model.StreamChunkChoice{
					{
						Index: 0,
						Delta: model.ChatMessage{Content: baiduChunk.Result},
					},
				},
			}

			if baiduChunk.IsEnd {
				finish := "stop"
				chunk.Choices[0].FinishReason = &finish
				chunk.Usage = r.usage
				r.done = true
			}

			chunkJSON, _ := json.Marshal(chunk)
			return []byte("data: " + string(chunkJSON) + "\n\n"), nil
		}
	}

	r.done = true
	return nil, io.EOF
}

func (r *BaiduStreamReader) Close() error {
	return r.body.Close()
}

func (r *BaiduStreamReader) Usage() *model.ChatUsage {
	return r.usage
}
