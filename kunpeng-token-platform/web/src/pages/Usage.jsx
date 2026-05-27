import React, { useEffect, useState } from 'react'
import { user } from '../lib/api'

export default function Usage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await user.usage()
        setRecords(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">用量明细</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {records.length === 0 ? (
          <p className="text-gray-500 text-center py-12">暂无调用记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">模型</th>
                  <th className="px-4 py-3">输入Token</th>
                  <th className="px-4 py-3">输出Token</th>
                  <th className="px-4 py-3">费用</th>
                  <th className="px-4 py-3">延迟</th>
                  <th className="px-4 py-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {new Date(r.requested_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {r.model}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.input_tokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.output_tokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">¥{(r.cost_fen / 100).toFixed(4)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.latency}ms</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.status === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
