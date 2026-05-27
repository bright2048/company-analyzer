package upstream

import (
	"context"
	"io"

	"github.com/bright2048/kunpeng-token-platform/internal/model"
)

// Adapter 供应商适配器接口
type Adapter interface {
	// ChatCompletion 非流式调用
	ChatCompletion(ctx context.Context, req *model.ChatCompletionRequest) (*model.ChatCompletionResponse, error)
	// ChatCompletionStream 流式调用，返回一个读取器
	ChatCompletionStream(ctx context.Context, req *model.ChatCompletionRequest) (StreamReader, error)
}

// StreamReader 流式读取接口
type StreamReader interface {
	// Read 读取下一个chunk，返回原始SSE数据行
	Read() ([]byte, error)
	// Close 关闭流
	Close() error
	// Usage 获取最终的usage信息（流结束后可用）
	Usage() *model.ChatUsage
}

// StreamReaderImpl 基于io.ReadCloser的流式读取器
type StreamReaderImpl struct {
	body    io.ReadCloser
	usage   *model.ChatUsage
	scanner *SSEScanner
}

// SSEScanner SSE数据扫描器
type SSEScanner struct {
	reader io.Reader
	buf    []byte
}

// Registry 适配器注册中心
type Registry struct {
	adapters map[string]AdapterFactory
}

// AdapterFactory 适配器工厂函数
type AdapterFactory func(supplier *model.Supplier) Adapter

// NewRegistry 创建注册中心
func NewRegistry() *Registry {
	r := &Registry{
		adapters: make(map[string]AdapterFactory),
	}
	// 注册所有支持的协议适配器
	r.Register("openai", NewOpenAIAdapter)
	r.Register("baidu", NewBaiduAdapter)
	r.Register("mock", NewMockAdapter)
	return r
}

// Register 注册适配器工厂
func (r *Registry) Register(protocol string, factory AdapterFactory) {
	r.adapters[protocol] = factory
}

// GetAdapter 获取适配器实例
func (r *Registry) GetAdapter(supplier *model.Supplier) Adapter {
	factory, ok := r.adapters[supplier.Protocol]
	if !ok {
		// 默认使用OpenAI兼容适配器
		factory = NewOpenAIAdapter
	}
	return factory(supplier)
}
