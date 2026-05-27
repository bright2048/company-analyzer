import React, { useState, useEffect, useRef } from 'react'
import { user } from '../lib/api'

export default function Playground() {
  const [keys, setKeys] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [model, setModel] = useState('mock-gpt-4')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    user.listKeys().then(data => {
      setKeys(data)
      if (data.length > 0) setSelectedKey(data[0].key)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !selectedKey) return
    
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${selectedKey}`,
        },
        body: JSON.stringify({
          model,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          temperature,
          stream: false,
        }),
      })

      const data = await response.json()
      if (data.error) {
        setMessages([...newMessages, { role: 'system', content: `错误: ${data.error}` }])
      } else if (data.choices && data.choices.length > 0) {
        const assistantMsg = data.choices[0].message
        setMessages([...newMessages, { ...assistantMsg, usage: data.usage }])
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'system', content: `请求失败: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 h-full">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">在线测试 (Playground)</h2>

      {/* 配置栏 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            >
              {keys.map(k => (
                <option key={k.id} value={k.key}>{k.name} ({k.key.slice(0, 12)}...)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              placeholder="模型名称"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>
      </div>

      {/* 对话区域 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col" style={{ minHeight: '400px' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <p className="text-lg">开始对话</p>
              <p className="text-sm mt-1">在下方输入消息，测试AI模型的响应效果</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : msg.role === 'system'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.usage && (
                  <p className="text-xs mt-1 opacity-60">
                    Token: {msg.usage.prompt_tokens}+{msg.usage.completion_tokens}={msg.usage.total_tokens}
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                <span className="text-gray-500 animate-pulse">思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="输入消息..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              disabled={loading || !selectedKey}
            />
            <button
              onClick={handleSend}
              disabled={loading || !selectedKey || !input.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              发送
            </button>
            <button
              onClick={() => setMessages([])}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
