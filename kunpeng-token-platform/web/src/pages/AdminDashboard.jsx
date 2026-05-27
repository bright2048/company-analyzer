import React, { useEffect, useState } from 'react'
import { admin } from '../lib/api'

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await admin.overview()
        setOverview(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>

  const profitFen = (overview?.today_revenue_fen || 0) - (overview?.today_cost_fen || 0)
  const profitRate = overview?.today_revenue_fen > 0
    ? ((profitFen / overview.today_revenue_fen) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">运营总览</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <AdminStatCard title="注册用户" value={overview?.total_users || 0} />
        <AdminStatCard title="总调用量" value={(overview?.total_requests || 0).toLocaleString()} />
        <AdminStatCard title="今日调用" value={(overview?.today_requests || 0).toLocaleString()} />
        <AdminStatCard title="今日收入" value={`¥${((overview?.today_revenue_fen || 0) / 100).toFixed(2)}`} color="green" />
        <AdminStatCard title="今日毛利率" value={`${profitRate}%`} color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">财务概览</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">今日用户侧收入</span>
              <span className="text-green-400">¥{((overview?.today_revenue_fen || 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">今日供应商成本</span>
              <span className="text-red-400">¥{((overview?.today_cost_fen || 0) / 100).toFixed(2)}</span>
            </div>
            <hr className="border-gray-700" />
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-300">今日毛利</span>
              <span className={profitFen >= 0 ? 'text-green-400' : 'text-red-400'}>
                ¥{(profitFen / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">平台总余额池</span>
              <span className="text-blue-400">¥{((overview?.total_balance_fen || 0) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">系统状态</h3>
          <div className="space-y-3">
            <StatusRow label="API网关" status="running" />
            <StatusRow label="数据库" status="running" />
            <StatusRow label="缓存服务" status="running" />
            <StatusRow label="内容安全" status="pending" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminStatCard({ title, value, color = 'default' }) {
  const textColor = color === 'green' ? 'text-green-400' : color === 'orange' ? 'text-orange-400' : 'text-white'
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-sm text-gray-400">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${textColor}`}>{value}</p>
    </div>
  )
}

function StatusRow({ label, status }) {
  const statusConfig = {
    running: { text: '运行中', color: 'bg-green-400' },
    pending: { text: '待接入', color: 'bg-yellow-400' },
    error: { text: '异常', color: 'bg-red-400' },
  }
  const cfg = statusConfig[status] || statusConfig.pending
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${cfg.color}`}></span>
        <span className="text-gray-400">{cfg.text}</span>
      </div>
    </div>
  )
}
