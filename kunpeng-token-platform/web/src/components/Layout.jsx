import React, { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/', label: '总览', icon: '📊' },
  { path: '/keys', label: 'API密钥', icon: '🔑' },
  { path: '/plans', label: '套餐购买', icon: '💎' },
  { path: '/usage', label: '用量明细', icon: '📈' },
  { path: '/playground', label: '在线测试', icon: '🧪' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('kp_admin_token')
    localStorage.removeItem('kp_user_email')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
              <span className="text-xl">☰</span>
            </button>
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">鲲鹏Token汇聚平台</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-300">{localStorage.getItem('kp_user_email')}</span>
            <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">退出</button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-56 min-h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm`}>
          <nav className="p-4 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            <hr className="my-3 border-gray-200 dark:border-gray-600" />
            <Link
              to="/admin/login"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span>⚙️</span>
              <span>管理后台</span>
            </Link>
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
