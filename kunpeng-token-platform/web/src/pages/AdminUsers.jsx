import React, { useEffect, useState } from 'react'
import { admin } from '../lib/api'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjustForm, setAdjustForm] = useState({ userId: '', amount: '', reason: '' })
  const [showAdjust, setShowAdjust] = useState(false)

  const loadUsers = async () => {
    try {
      const data = await admin.users()
      setUsers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleAdjust = async () => {
    if (!adjustForm.userId || !adjustForm.amount || !adjustForm.reason) {
      alert('请填写完整信息')
      return
    }
    try {
      const amountFen = Math.round(parseFloat(adjustForm.amount) * 100)
      await admin.adjustBalance(adjustForm.userId, amountFen, adjustForm.reason)
      alert('余额调整成功')
      setShowAdjust(false)
      setAdjustForm({ userId: '', amount: '', reason: '' })
      loadUsers()
    } catch (err) {
      alert('调整失败: ' + err.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">用户管理</h2>
        <span className="text-sm text-gray-400">共 {users.length} 个用户</span>
      </div>

      {/* 余额调整弹窗 */}
      {showAdjust && (
        <div className="bg-gray-800 rounded-xl p-6 border border-orange-700">
          <h3 className="text-lg font-semibold text-white mb-4">人工调整余额</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">用户ID</label>
              <input value={adjustForm.userId} onChange={e => setAdjustForm({...adjustForm, userId: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="usr_xxx" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">金额(元，正数充值/负数扣减)</label>
              <input type="number" value={adjustForm.amount} onChange={e => setAdjustForm({...adjustForm, amount: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="10.00" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">原因(必填)</label>
              <input value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="客服补偿/测试充值" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdjust} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">确认调整</button>
            <button onClick={() => setShowAdjust(false)} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 用户列表 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 className="text-white font-medium">用户列表</h3>
          <button onClick={() => setShowAdjust(!showAdjust)} className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm">
            人工调整余额
          </button>
        </div>
        {users.length === 0 ? (
          <p className="text-gray-400 text-center py-12">暂无用户</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="px-4 py-3">邮箱</th>
                  <th className="px-4 py-3">公司</th>
                  <th className="px-4 py-3">余额</th>
                  <th className="px-4 py-3">累计消费</th>
                  <th className="px-4 py-3">请求数</th>
                  <th className="px-4 py-3">注册时间</th>
                  <th className="px-4 py-3">用户ID</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-4 py-3 text-white">{u.email}</td>
                    <td className="px-4 py-3 text-gray-300">{u.company || '-'}</td>
                    <td className="px-4 py-3 text-green-400">¥{(u.balance / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-orange-400">¥{(u.total_spent / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-300">{u.request_count}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-gray-500 cursor-pointer" onClick={() => {
                        setAdjustForm({...adjustForm, userId: u.id})
                        setShowAdjust(true)
                      }}>{u.id}</code>
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
