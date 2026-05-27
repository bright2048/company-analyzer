import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function Market() {
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productDetail, setProductDetail] = useState(null)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeResult, setSubscribeResult] = useState(null)

  // 筛选状态
  const [category, setCategory] = useState('')
  const [provider, setProvider] = useState('')
  const [scene, setScene] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [sortBy, setSortBy] = useState('popular')
  const [search, setSearch] = useState('')

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchFilters()
    fetchProducts()
  }, [category, provider, scene, priceRange, sortBy])

  const fetchFilters = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/filters`)
      const data = await res.json()
      setFilters(data)
    } catch (e) { console.error(e) }
  }

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (provider) params.set('provider', provider)
      if (scene) params.set('scene', scene)
      if (priceRange) params.set('price_range', priceRange)
      if (sortBy) params.set('sort_by', sortBy)
      if (search) params.set('search', search)
      const res = await fetch(`${API_BASE}/api/v1/market/products?${params}`)
      const data = await res.json()
      setProducts(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchProducts()
  }

  const openDetail = async (productId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/product?id=${productId}`)
      const data = await res.json()
      setProductDetail(data)
      setSelectedProduct(productId)
    } catch (e) { console.error(e) }
  }

  const handleSubscribe = async (planId) => {
    if (!token) {
      alert('请先登录后再订购')
      window.location.href = '/login'
      return
    }
    setSubscribing(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model_plan_id: planId })
      })
      const data = await res.json()
      if (res.ok) {
        setSubscribeResult(data)
      } else {
        alert(data.error || '订购失败')
      }
    } catch (e) { alert('网络错误') }
    setSubscribing(false)
  }

  const categoryLabels = { chat: '对话聊天', reasoning: '深度推理', code: '代码生成', multimodal: '多模态', embedding: '向量嵌入', image: '图像生成' }
  const billingLabels = { on_demand: '按需', monthly: '包月', quarterly: '包季', yearly: '包年', token_pack: 'Token包' }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部横幅 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">AI 模型超市</h1>
          <p className="text-blue-100">一站式浏览、对比、订购国内主流大模型，灵活选择计费方式</p>
          {/* 搜索栏 */}
          <form onSubmit={handleSearch} className="mt-4 flex gap-2 max-w-xl">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索模型名称、厂商、功能..."
              className="flex-1 px-4 py-2 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-300" />
            <button type="submit" className="px-6 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50">搜索</button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* 左侧筛选面板 */}
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sticky top-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">筛选条件</h3>

              {/* 分类 */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">模型分类</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <option value="">全部分类</option>
                  {filters?.categories?.map(c => (
                    <option key={c.key} value={c.key}>{c.label}{c.count > 0 ? ` (${c.count})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* 厂商 */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">模型厂商</label>
                <select value={provider} onChange={e => setProvider(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <option value="">全部厂商</option>
                  {filters?.providers?.map(p => (
                    <option key={p.key} value={p.key}>{p.label}{p.count > 0 ? ` (${p.count})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* 场景 */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">使用场景</label>
                <select value={scene} onChange={e => setScene(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <option value="">全部场景</option>
                  {filters?.scenes?.map(s => (
                    <option key={s.key} value={s.key}>{s.label}{s.count > 0 ? ` (${s.count})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* 价格区间 */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">价格区间</label>
                <select value={priceRange} onChange={e => setPriceRange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <option value="">不限价格</option>
                  {filters?.price_ranges?.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* 重置 */}
              <button onClick={() => { setCategory(''); setProvider(''); setScene(''); setPriceRange(''); setSearch('') }}
                className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                重置筛选
              </button>
            </div>
          </aside>

          {/* 右侧商品列表 */}
          <main className="flex-1">
            {/* 排序栏 */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                共 {products.length} 个模型
              </span>
              <div className="flex gap-2">
                {filters?.sort_options?.map(opt => (
                  <button key={opt.key} onClick={() => setSortBy(opt.key)}
                    className={`px-3 py-1 text-sm rounded-full ${sortBy === opt.key ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 商品卡片网格 */}
            {loading ? (
              <div className="text-center py-20 text-gray-500">加载中...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 text-gray-500">暂无符合条件的模型</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer"
                    onClick={() => openDetail(product.id)}>
                    <div className="p-5">
                      {/* 头部 */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{product.name}</h3>
                            {product.is_hot && <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full font-medium">热门</span>}
                            {product.is_new && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full font-medium">新品</span>}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{product.provider}</p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg font-medium">
                          {categoryLabels[product.category] || product.category}
                        </span>
                      </div>

                      {/* 描述 */}
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{product.description}</p>

                      {/* 能力评分 */}
                      <div className="flex gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400">质量</div>
                          <div className="flex mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-xs ${i < product.score_quality ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}>★</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400">速度</div>
                          <div className="flex mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-xs ${i < product.score_speed ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}>★</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400">性价比</div>
                          <div className="flex mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-xs ${i < product.score_cost ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}>★</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 标签 */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {product.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">{tag}</span>
                        ))}
                      </div>

                      {/* 底部价格和操作 */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{product.min_price || `¥${product.input_price_per_million}/百万Token`}</span>
                        </div>
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">查看套餐 →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 模型详情弹窗 */}
      {selectedProduct && productDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedProduct(null); setSubscribeResult(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {subscribeResult ? (
              /* 订购成功结果 */
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">订购成功</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{subscribeResult.message}</p>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-left mb-6">
                  <div className="mb-3">
                    <label className="text-sm text-gray-500 dark:text-gray-400">模型专属 API Key</label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{subscribeResult.api_key?.key}</code>
                      <button onClick={() => { navigator.clipboard.writeText(subscribeResult.api_key?.key); alert('已复制') }}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">复制</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500 dark:text-gray-400">模型：</span><span className="text-gray-900 dark:text-gray-100">{subscribeResult.api_key?.model}</span></div>
                    <div><span className="text-gray-500 dark:text-gray-400">名称：</span><span className="text-gray-900 dark:text-gray-100">{subscribeResult.api_key?.name}</span></div>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                  请妥善保管此 API Key，关闭后将无法再次查看完整密钥。
                </div>
                <button onClick={() => { setSelectedProduct(null); setSubscribeResult(null) }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">完成</button>
              </div>
            ) : (
              /* 模型详情 */
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{productDetail.product?.name}</h2>
                    <p className="text-gray-500 dark:text-gray-400">{productDetail.product?.provider}</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-4">{productDetail.product?.description}</p>

                {/* 特性 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {productDetail.product?.features?.map(f => (
                    <span key={f} className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">{f}</span>
                  ))}
                </div>

                {/* 适用场景 */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">适用场景</h4>
                  <div className="flex flex-wrap gap-2">
                    {productDetail.product?.scenes?.map(s => (
                      <span key={s} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>

                {/* 套餐选择 */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">选择套餐</h3>
                <div className="space-y-3">
                  {productDetail.plans?.map(plan => (
                    <div key={plan.id} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h4>
                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {billingLabels[plan.billing_type] || plan.billing_type}
                            </span>
                            {plan.discount && <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded font-medium">{plan.discount}</span>}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>
                          {plan.billing_type !== 'on_demand' && (
                            <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {plan.token_quota > 0 && <span>配额: {(plan.token_quota / 10000).toFixed(0)}万Token</span>}
                              {plan.valid_days > 0 && <span>有效期: {plan.valid_days}天</span>}
                              {plan.rate_limit > 0 && <span>限速: {plan.rate_limit}次/分</span>}
                            </div>
                          )}
                          {plan.billing_type === 'on_demand' && (
                            <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>输入: ¥{plan.on_demand_input_price}/百万Token</span>
                              <span>输出: ¥{plan.on_demand_output_price}/百万Token</span>
                              <span>限速: {plan.rate_limit}次/分</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          {plan.billing_type === 'on_demand' ? (
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">按需付费</div>
                          ) : (
                            <div>
                              {plan.original_price_fen > 0 && (
                                <div className="text-sm text-gray-400 line-through">¥{(plan.original_price_fen / 100).toFixed(0)}</div>
                              )}
                              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">¥{(plan.price_fen / 100).toFixed(0)}</div>
                            </div>
                          )}
                          <button onClick={() => handleSubscribe(plan.id)} disabled={subscribing}
                            className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            {subscribing ? '处理中...' : '立即订购'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 使用说明 */}
                <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">使用方式</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">订购后将生成该模型专属的 API Key，使用方式与 OpenAI SDK 完全兼容：</p>
                  <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto">{`from openai import OpenAI

client = OpenAI(
    base_url="https://your-domain.com/v1",
    api_key="sk-kp-your-model-key"
)

response = client.chat.completions.create(
    model="${productDetail.product?.model_id}",
    messages=[{"role": "user", "content": "你好"}]
)`}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Market
