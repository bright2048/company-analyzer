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
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/model"
)

// OpenAIAdapter OpenAI兼容协议适配器
// 支持: OpenAI, DeepSeek, Qwen(通义), Kimi(月之暗面), GLM(智谱), 混元, 豆包等
type OpenAIAdapter struct {
	supplier *model.Supplier
	client   *http.Client
}

// NewOpenAIAdapter 创建OpenAI兼容适配器
func NewOpenAIAdapter(supplier *model.Supplier) Adapter {
	return &OpenAIAdapter{
		supplier: supplier,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (a *OpenAIAdapter) getBaseURL() string {
	if a.supplier.BaseURL != "" {
		return strings.TrimRight(a.supplier.BaseURL, "/")
	}
	return "https://api.openai.com/v1"
}

// ChatCompletion 非流式调用
func (a *OpenAIAdapter) ChatCompletion(ctx context.Context, req *model.ChatCompletionRequest) (*model.ChatCompletionResponse, error) {
	// 构建请求体
	reqBody := map[string]interface{}{
		"model":    a.supplier.Model,
		"messages": req.Messages,
		"stream":   false,
	}
	if req.Temperature != nil {
		reqBody["temperature"] = *req.Temperature
	}
	if req.MaxTokens != nil {
		reqBody["max_tokens"] = *req.MaxTokens
	}
	if len(req.Tools) > 0 {
		reqBody["tools"] = req.Tools
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := a.getBaseURL() + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+a.supplier.APIKey)

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result model.ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// ChatCompletionStream 流式调用
func (a *OpenAIAdapter) ChatCompletionStream(ctx context.Context, req *model.ChatCompletionRequest) (StreamReader, error) {
	reqBody := map[string]interface{}{
		"model":    a.supplier.Model,
		"messages": req.Messages,
		"stream":   true,
		"stream_options": map[string]interface{}{
			"include_usage": true,
		},
	}
	if req.Temperature != nil {
		reqBody["temperature"] = *req.Temperature
	}
	if req.MaxTokens != nil {
		reqBody["max_tokens"] = *req.MaxTokens
	}
	if len(req.Tools) > 0 {
		reqBody["tools"] = req.Tools
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := a.getBaseURL() + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+a.supplier.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return &OpenAIStreamReader{
		body:    resp.Body,
		scanner: bufio.NewScanner(resp.Body),
	}, nil
}

// OpenAIStreamReader OpenAI流式读取器
type OpenAIStreamReader struct {
	body    io.ReadCloser
	scanner *bufio.Scanner
	usage   *model.ChatUsage
	done    bool
}

func (r *OpenAIStreamReader) Read() ([]byte, error) {
	if r.done {
		return nil, io.EOF
	}

	for r.scanner.Scan() {
		line := r.scanner.Text()

		// 跳过空行
		if line == "" {
			continue
		}

		// 处理SSE数据行
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")

			// 检查结束标记
			if data == "[DONE]" {
				r.done = true
				return nil, io.EOF
			}

			// 尝试解析usage
			var chunk model.StreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err == nil {
				if chunk.Usage != nil {
					r.usage = chunk.Usage
				}
			}

			// 返回原始SSE行
			return []byte("data: " + data + "\n\n"), nil
		}
	}

	if err := r.scanner.Err(); err != nil {
		return nil, err
	}

	r.done = true
	return nil, io.EOF
}

func (r *OpenAIStreamReader) Close() error {
	return r.body.Close()
}

func (r *OpenAIStreamReader) Usage() *model.ChatUsage {
	return r.usage
}
