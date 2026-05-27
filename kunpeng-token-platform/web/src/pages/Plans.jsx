import React, { useEffect, useState } from 'react'
import { plans as plansApi, user } from '../lib/api'

export default function Plans() {
  const [planList, setPlanList] = useState([])
  const [couponCode, setCouponCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await plansApi.list()
        setPlanList(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePurchase = async (planId) => {
    if (!confirm('确认购买该套餐？（当前为模拟支付，将直接到账）')) return
    setPurchasing(planId)
    try {
      const result = await user.purchase(planId)
      alert(`${result.message}\n到账金额: ${result.credited}\n有效期至: ${result.expires_at}`)
    } catch (err) {
      alert('购买失败: ' + err.message)
    } finally {
      setPurchasing(null)
    }
  }

  const handleRedeem = async () => {
    if (!couponCode.trim()) return
    try {
      const result = await user.redeemCoupon(couponCode)
      alert(`${result.message}\n到账金额: ${result.credited}`)
      setCouponCode('')
    } catch (err) {
      alert('核销失败: ' + err.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">套餐购买</h2>

      {/* 套餐列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {planList.map(plan => (
          <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{plan.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
            
            <div className="mt-4 flex-1">
              <p className="text-3xl font-bold text-blue-600">
                ¥{(plan.price_fen / 100).toFixed(plan.price_fen % 100 === 0 ? 0 : 2)}
              </p>
              <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>到账额度: <span className="font-medium text-green-600">¥{(plan.credit_fen / 100).toFixed(0)}</span></p>
                <p>参考Token: <span className="font-medium">{(plan.token_quota / 10000).toFixed(0)}万</span></p>
                <p>有效期: <span className="font-medium">{plan.valid_days}天</span></p>
                {plan.limit_per_user > 0 && (
                  <p className="text-orange-500">限购{plan.limit_per_user}次</p>
                )}
              </div>
            </div>

            <button
              onClick={() => handlePurchase(plan.id)}
              disabled={purchasing === plan.id}
              className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {purchasing === plan.id ? '处理中...' : '立即购买'}
            </button>
          </div>
        ))}
      </div>

      {/* 优惠券 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">兑换优惠券</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="输入优惠券码"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={handleRedeem}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
          >
            兑换
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">新用户可使用 WELCOME2026 获得5元体验金</p>
      </div>
    </div>
  )
}
