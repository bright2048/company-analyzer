package upstream

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/bright2048/kunpeng-token-platform/internal/model"
)

// MockAdapter 模拟适配器，用于开发测试
type MockAdapter struct {
	supplier *model.Supplier
}

// NewMockAdapter 创建模拟适配器
func NewMockAdapter(supplier *model.Supplier) Adapter {
	return &MockAdapter{supplier: supplier}
}

// ChatCompletion 模拟非流式调用
func (a *MockAdapter) ChatCompletion(ctx context.Context, req *model.ChatCompletionRequest) (*model.ChatCompletionResponse, error) {
	// 模拟一定延迟
	time.Sleep(100 * time.Millisecond)

	inputTokens := 0
	for _, msg := range req.Messages {
		inputTokens += len(msg.Content) / 2 // 粗略估算：2个字符≈1 token
	}

	responseContent := fmt.Sprintf("这是来自鲲鹏Token汇聚平台的模拟响应。您的消息已收到，共包含 %d 个预估Token。当前使用的模型为: %s", inputTokens, a.supplier.Model)
	outputTokens := len(responseContent) / 2

	return &model.ChatCompletionResponse{
		ID:      fmt.Sprintf("mock-%d", time.Now().UnixNano()),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   a.supplier.Model,
		Choices: []model.ChatChoice{
			{
				Index:        0,
				Message:      model.ChatMessage{Role: "assistant", Content: responseContent},
				FinishReason: "stop",
			},
		},
		Usage: &model.ChatUsage{
			PromptTokens:     inputTokens,
			CompletionTokens: outputTokens,
			TotalTokens:      inputTokens + outputTokens,
		},
	}, nil
}

// ChatCompletionStream 模拟流式调用
func (a *MockAdapter) ChatCompletionStream(ctx context.Context, req *model.ChatCompletionRequest) (StreamReader, error) {
	inputTokens := 0
	for _, msg := range req.Messages {
		inputTokens += len(msg.Content) / 2
	}

	chunks := []string{
		"这是来自",
		"鲲鹏Token汇聚平台",
		"的模拟流式响应。",
		"您的消息已收到，",
		fmt.Sprintf("共包含 %d 个预估Token。", inputTokens),
		fmt.Sprintf("当前模型: %s", a.supplier.Model),
	}

	outputTokens := 0
	for _, c := range chunks {
		outputTokens += len(c) / 2
	}

	return &MockStreamReader{
		chunks:       chunks,
		model:        a.supplier.Model,
		inputTokens:  inputTokens,
		outputTokens: outputTokens,
		index:        0,
	}, nil
}

// MockStreamReader 模拟流式读取器
type MockStreamReader struct {
	chunks       []string
	model        string
	inputTokens  int
	outputTokens int
	index        int
	usage        *model.ChatUsage
}

func (r *MockStreamReader) Read() ([]byte, error) {
	if r.index >= len(r.chunks) {
		return nil, io.EOF
	}

	time.Sleep(50 * time.Millisecond) // 模拟延迟

	chunk := r.chunks[r.index]
	r.index++

	isLast := r.index >= len(r.chunks)

	sseData := fmt.Sprintf(`{"id":"mock-%d","object":"chat.completion.chunk","created":%d,"model":"%s","choices":[{"index":0,"delta":{"content":"%s"}`,
		time.Now().UnixNano(), time.Now().Unix(), r.model, chunk)

	if isLast {
		sseData += `,"finish_reason":"stop"}]`
		r.usage = &model.ChatUsage{
			PromptTokens:     r.inputTokens,
			CompletionTokens: r.outputTokens,
			TotalTokens:      r.inputTokens + r.outputTokens,
		}
		sseData += fmt.Sprintf(`,"usage":{"prompt_tokens":%d,"completion_tokens":%d,"total_tokens":%d}`,
			r.inputTokens, r.outputTokens, r.inputTokens+r.outputTokens)
	} else {
		sseData += `,"finish_reason":null}]`
	}
	sseData += "}"

	return []byte("data: " + sseData + "\n\n"), nil
}

func (r *MockStreamReader) Close() error {
	return nil
}

func (r *MockStreamReader) Usage() *model.ChatUsage {
	return r.usage
}
