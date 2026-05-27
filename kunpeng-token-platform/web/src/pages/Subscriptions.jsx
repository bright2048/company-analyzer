import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function Subscriptions() {
  const [subscriptions, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/user/subscriptions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setSubs(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const billingLabels = { on_demand: '按需计费', monthly: '包月', quarterly: '包季', yearly: '包年', token_pack: 'Token包' }
  const statusLabels = { active: '使用中', expired: '已过期', exhausted: '已用完', cancelled: '已取消' }
  const statusColors = { active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', expired: 'bg-gray-100 text-gray-600', exhausted: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-600' }

  if (loading) return <div className="p-6 text-center text-gray-500">加载中...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">我的订阅</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">管理已订购的模型服务和API密钥</p>
        </div>
        <a href="/market" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          + 订购新模型
        </a>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
          <div className="text-5xl mb-4">🛒</div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">暂无订阅</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">前往模型超市选购您需要的AI模型</p>
          <a href="/market" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">浏览模型超市</a>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map(sub => (
            <div key={sub.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{sub.model_name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[sub.status] || sub.status}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded">
                      {billingLabels[sub.billing_type] || sub.billing_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{sub.plan_name}</p>
                </div>
              </div>

              {/* 用量和配额 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {sub.billing_type === 'on_demand' ? (
                  <>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">输入单价</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">¥{sub.on_demand_input_price}/百万Token</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">输出单价</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">¥{sub.on_demand_output_price}/百万Token</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">累计消费</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">¥{(sub.total_cost_fen / 100).toFixed(2)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Token配额</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{(sub.token_quota / 10000).toFixed(0)}万</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">已使用</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{(sub.token_used / 10000).toFixed(1)}万</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">使用率</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {sub.token_quota > 0 ? ((sub.token_used / sub.token_quota) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">到期时间</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {new Date(sub.expires_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>

              {/* 配额进度条（非按需模式） */}
              {sub.billing_type !== 'on_demand' && sub.token_quota > 0 && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min((sub.token_used / sub.token_quota) * 100, 100)}%` }}></div>
                  </div>
                </div>
              )}

              {/* 创建时间 */}
              <div className="mt-3 text-xs text-gray-400">
                订购于 {new Date(sub.created_at).toLocaleString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Subscriptions
