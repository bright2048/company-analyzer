import React, { useEffect, useState } from 'react'
import { user } from '../lib/api'

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showKey, setShowKey] = useState(null)

  const loadKeys = async () => {
    try {
      const data = await user.listKeys()
      setKeys(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadKeys() }, [])

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const key = await user.createKey(newKeyName)
      setShowKey(key.key)
      setNewKeyName('')
      loadKeys()
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除该密钥吗？删除后使用该密钥的所有请求将立即失效。')) return
    try {
      await user.deleteKey(id)
      loadKeys()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">API 密钥管理</h2>

      {/* 创建新密钥 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">创建新密钥</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="密钥名称（如：生产环境、测试环境）"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>

        {showKey && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">密钥创建成功！请立即复制保存，关闭后将无法再次查看完整密钥。</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-white dark:bg-gray-800 p-2 rounded border font-mono break-all">{showKey}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(showKey); alert('已复制') }}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm"
              >
                复制
              </button>
            </div>
            <button onClick={() => setShowKey(null)} className="mt-2 text-sm text-gray-500 hover:text-gray-700">关闭</button>
          </div>
        )}
      </div>

      {/* 密钥列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">已创建的密钥</h3>
          {keys.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无密钥，请先创建</p>
          ) : (
            <div className="space-y-3">
              {keys.map(key => (
                <div key={key.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">{key.name}</p>
                    <p className="text-sm text-gray-500 font-mono mt-1">{key.key.slice(0, 20)}...{key.key.slice(-8)}</p>
                    <p className="text-xs text-gray-400 mt-1">创建于 {new Date(key.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${key.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {key.status === 'active' ? '启用' : '禁用'}
                    </span>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">接入说明</h3>
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p><strong>Base URL:</strong> <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{window.location.origin}/v1</code></p>
          <p><strong>认证方式:</strong> <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Authorization: Bearer sk-kp-xxx</code></p>
          <p><strong>兼容性:</strong> 100%兼容OpenAI Chat Completions API格式，支持所有OpenAI SDK直接接入。</p>
        </div>
      </div>
    </div>
  )
}
