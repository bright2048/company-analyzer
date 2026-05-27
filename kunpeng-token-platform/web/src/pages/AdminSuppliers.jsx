import React, { useEffect, useState } from 'react'
import { admin } from '../lib/api'

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', protocol: 'openai', base_url: '', api_key: '', secret_key: '',
    model: '', input_price: 0, output_price: 0, priority: 10, weight: 1, status: 'active'
  })

  const loadSuppliers = async () => {
    try {
      const data = await admin.suppliers()
      setSuppliers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSuppliers() }, [])

  const handleCreate = async () => {
    try {
      await admin.createSupplier({
        ...form,
        input_price: parseFloat(form.input_price),
        output_price: parseFloat(form.output_price),
        priority: parseInt(form.priority),
        weight: parseInt(form.weight),
      })
      setShowForm(false)
      setForm({ name: '', protocol: 'openai', base_url: '', api_key: '', secret_key: '', model: '', input_price: 0, output_price: 0, priority: 10, weight: 1, status: 'active' })
      loadSuppliers()
    } catch (err) {
      alert('创建失败: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除该供应商？')) return
    try {
      await admin.deleteSupplier(id)
      loadSuppliers()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">供应商管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
        >
          {showForm ? '取消' : '+ 添加供应商'}
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">添加新供应商</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="名称" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="如: DeepSeek V4" />
            <div>
              <label className="block text-sm text-gray-400 mb-1">协议</label>
              <select value={form.protocol} onChange={e => setForm({...form, protocol: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm">
                <option value="openai">OpenAI兼容 (DeepSeek/Qwen/Kimi/GLM/混元)</option>
                <option value="baidu">百度文心</option>
                <option value="mock">Mock测试</option>
              </select>
            </div>
            <FormField label="Base URL" value={form.base_url} onChange={v => setForm({...form, base_url: v})} placeholder="https://api.deepseek.com/v1" />
            <FormField label="模型ID" value={form.model} onChange={v => setForm({...form, model: v})} placeholder="deepseek-chat" />
            <FormField label="API Key" value={form.api_key} onChange={v => setForm({...form, api_key: v})} placeholder="sk-xxx" type="password" />
            <FormField label="Secret Key (百度专用)" value={form.secret_key} onChange={v => setForm({...form, secret_key: v})} placeholder="可选" type="password" />
            <FormField label="输入价格 (元/百万Token)" value={form.input_price} onChange={v => setForm({...form, input_price: v})} type="number" />
            <FormField label="输出价格 (元/百万Token)" value={form.output_price} onChange={v => setForm({...form, output_price: v})} type="number" />
            <FormField label="优先级 (越小越优先)" value={form.priority} onChange={v => setForm({...form, priority: v})} type="number" />
            <FormField label="权重" value={form.weight} onChange={v => setForm({...form, weight: v})} type="number" />
          </div>
          <button onClick={handleCreate} className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
            保存
          </button>
        </div>
      )}

      {/* 供应商列表 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {suppliers.length === 0 ? (
          <p className="text-gray-400 text-center py-12">暂无供应商</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-750">
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="px-4 py-3">名称</th>
                  <th className="px-4 py-3">协议</th>
                  <th className="px-4 py-3">模型</th>
                  <th className="px-4 py-3">输入价</th>
                  <th className="px-4 py-3">输出价</th>
                  <th className="px-4 py-3">优先级</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-300">{s.protocol}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-900 text-blue-300 rounded text-xs">{s.model}</span></td>
                    <td className="px-4 py-3 text-gray-300">¥{s.input_price}/M</td>
                    <td className="px-4 py-3 text-gray-300">¥{s.output_price}/M</td>
                    <td className="px-4 py-3 text-gray-300">{s.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {s.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 text-xs">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 接入指南 */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">支持的供应商协议</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
          <div className="p-3 bg-gray-750 rounded-lg">
            <p className="font-medium text-white">OpenAI兼容协议</p>
            <p className="text-gray-400 mt-1">DeepSeek、通义千问(Qwen)、月之暗面(Kimi)、智谱(GLM)、腾讯混元、字节豆包、OpenAI</p>
          </div>
          <div className="p-3 bg-gray-750 rounded-lg">
            <p className="font-medium text-white">百度文心协议</p>
            <p className="text-gray-400 mt-1">ERNIE 4.0、ERNIE 3.5 等百度文心系列模型</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
      />
    </div>
  )
}
