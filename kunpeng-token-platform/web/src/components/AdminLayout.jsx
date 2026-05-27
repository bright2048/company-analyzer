import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/admin', label: '运营总览', icon: '📊' },
  { path: '/admin/suppliers', label: '供应商管理', icon: '🏭' },
  { path: '/admin/users', label: '用户管理', icon: '👥' },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('kp_platform_token')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-orange-400">鲲鹏平台 · 管理后台</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-sm text-gray-400 hover:text-white">返回用户端</Link>
            <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">退出</button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 min-h-screen bg-gray-800 border-r border-gray-700">
          <nav className="p-4 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-orange-900 text-orange-200'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
