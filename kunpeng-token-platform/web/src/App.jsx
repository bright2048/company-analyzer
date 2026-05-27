import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ApiKeys from './pages/ApiKeys'
import Plans from './pages/Plans'
import Usage from './pages/Usage'
import Playground from './pages/Playground'
import Market from './pages/Market'
import Subscriptions from './pages/Subscriptions'
import AdminDashboard from './pages/AdminDashboard'
import AdminSuppliers from './pages/AdminSuppliers'
import AdminUsers from './pages/AdminUsers'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('kp_platform_token')
  if (!token) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login isAdmin />} />
        
        {/* 模型超市（公开页面，无需登录即可浏览） */}
        <Route path="/market" element={<Market />} />

        {/* 用户控制台 */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="keys" element={<ApiKeys />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="plans" element={<Plans />} />
          <Route path="usage" element={<Usage />} />
          <Route path="playground" element={<Playground />} />
        </Route>

        {/* 管理员后台 */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="suppliers" element={<AdminSuppliers />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
