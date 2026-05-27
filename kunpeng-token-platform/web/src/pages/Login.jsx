import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/api'

export default function Login({ isAdmin }) {
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [platformToken, setPlatformToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isAdmin) {
        // 管理员直接输入平台令牌
        localStorage.setItem('kp_platform_token', platformToken)
        navigate('/admin')
        return
      }

      if (isRegister) {
        const data = await auth.register(email, password, company)
        localStorage.setItem('token', data.admin_token)
        localStorage.setItem('kp_user_email', email)
        navigate('/')
      } else {
        const data = await auth.login(email, password)
        localStorage.setItem('token', data.admin_token)
        localStorage.setItem('kp_user_email', data.email)
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">鲲鹏Token汇聚平台</h1>
          <p className="text-gray-500 mt-2">
            {isAdmin ? '管理后台登录' : '一站式AI大模型Token消费平台'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdmin ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">平台管理令牌</label>
                <input
                  type="password"
                  value={platformToken}
                  onChange={(e) => setPlatformToken(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="输入平台管理员令牌"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="至少6位"
                    required
                  />
                </div>
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公司名称（选填）</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="您的公司名称"
                    />
                  </div>
                )}
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '处理中...' : isAdmin ? '登录管理后台' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          {!isAdmin && (
            <div className="mt-4 text-center">
              <button
                onClick={() => { setIsRegister(!isRegister); setError('') }}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
