import React, { useEffect, useState } from 'react'
import { user } from '../lib/api'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [p, s] = await Promise.all([user.profile(), user.usageSummary()])
        setProfile(p)
        setSummary(s)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  const totalRequests = summary.reduce((a, b) => a + b.request_count, 0)
  const totalTokens = summary.reduce((a, b) => a + b.input_tokens + b.output_tokens, 0)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">控制台总览</h2>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="账户余额" value={`¥${profile?.balance || '0.00'}`} color="blue" />
        <StatCard title="累计消费" value={`¥${profile?.total_spent || '0.00'}`} color="orange" />
        <StatCard title="近30天请求" value={totalRequests.toLocaleString()} color="green" />
        <StatCard title="近30天Token" value={formatTokens(totalTokens)} color="purple" />
      </div>

      {/* 快速入门 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">快速开始</h3>
        <div className="bg-gray-900 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto">
          <p className="text-gray-500"># 使用您的API Key调用（兼容OpenAI SDK）</p>
          <p className="mt-1">curl {window.location.origin}/v1/chat/completions \</p>
          <p className="ml-4">-H "Authorization: Bearer sk-kp-YOUR_API_KEY" \</p>
          <p className="ml-4">-H "Content-Type: application/json" \</p>
          <p className="ml-4">-d '{`{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}]}`}'</p>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          支持所有兼容OpenAI SDK的客户端直接接入，只需替换 base_url 和 api_key 即可。
        </p>
      </div>

      {/* 近期用量 */}
      {summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">近期用量趋势</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-600">
                  <th className="pb-2">日期</th>
                  <th className="pb-2">请求数</th>
                  <th className="pb-2">输入Token</th>
                  <th className="pb-2">输出Token</th>
                  <th className="pb-2">费用</th>
                </tr>
              </thead>
              <tbody>
                {summary.slice(0, 10).map(s => (
                  <tr key={s.date} className="border-b dark:border-gray-700">
                    <td className="py-2 text-gray-700 dark:text-gray-300">{s.date}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{s.request_count}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{s.input_tokens.toLocaleString()}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{s.output_tokens.toLocaleString()}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">¥{(s.total_cost_fen / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700',
    orange: 'bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-700',
    green: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700',
    purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-700',
  }
  return (
    <div className={`rounded-xl p-5 border ${colors[color]}`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
    </div>
  )
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}
