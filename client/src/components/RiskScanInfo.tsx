/**
 * 风险扫描信息展示组件
 *
 * 展示企查查风险扫描接口（2006）返回的风险数据
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Shield,
  Gavel,
  FileWarning,
  Building2,
  Landmark,
  Scale,
  CheckCircle2,
} from "lucide-react";

// 风险数据类型定义
export interface RiskScanData {
  ShiXin: any[] | null; // 失信被执行人
  ZhiXing: any[] | null; // 被执行人
  AdminPenalty: any[] | null; // 行政处罚
  Exception: any[] | null; // 经营异常
  ChattelMortgage: any[] | null; // 动产抵押
  Liquidation: any[] | null; // 清算信息
  EquityPledge: any[] | null; // 股权质押
  SeriousIllegal: any[] | null; // 严重违法
  EquityFreeze: any[] | null; // 股权冻结
  JudicialSale: any[] | null; // 司法拍卖
  Bankruptcy: any[] | null; // 破产信息
  Sumptuary: any[] | null; // 限制消费
  EnvPunishment: any[] | null; // 环保处罚
  TaxOweNotice: any[] | null; // 欠税公告
  TaxIllegal: any[] | null; // 税务违法
  TaxAbnormal: any[] | null; // 税务异常
  TaxHurry: any[] | null; // 税务催报
  TaxReminder: any[] | null; // 税务提醒
  PublicSecurityNotice: any[] | null; // 公安通知
}

interface RiskScanInfoProps {
  riskData: RiskScanData | null;
}

// 风险类型配置
const RISK_TYPES = [
  {
    key: "ShiXin",
    label: "失信被执行人",
    icon: XCircle,
    level: "high",
    color: "text-red-500",
  },
  {
    key: "ZhiXing",
    label: "被执行人",
    icon: Gavel,
    level: "high",
    color: "text-red-500",
  },
  {
    key: "AdminPenalty",
    label: "行政处罚",
    icon: FileWarning,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "Exception",
    label: "经营异常",
    icon: AlertCircle,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "EquityPledge",
    label: "股权质押",
    icon: Building2,
    level: "low",
    color: "text-yellow-500",
  },
  {
    key: "EquityFreeze",
    label: "股权冻结",
    icon: Shield,
    level: "high",
    color: "text-red-500",
  },
  {
    key: "ChattelMortgage",
    label: "动产抵押",
    icon: Landmark,
    level: "low",
    color: "text-yellow-500",
  },
  {
    key: "SeriousIllegal",
    label: "严重违法",
    icon: XCircle,
    level: "high",
    color: "text-red-500",
  },
  {
    key: "Bankruptcy",
    label: "破产信息",
    icon: AlertTriangle,
    level: "high",
    color: "text-red-500",
  },
  {
    key: "Sumptuary",
    label: "限制消费",
    icon: Scale,
    level: "high",
    color: "text-red-500",
  },
  {
    key: "TaxOweNotice",
    label: "欠税公告",
    icon: Landmark,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "TaxIllegal",
    label: "税务违法",
    icon: FileWarning,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "TaxAbnormal",
    label: "税务异常",
    icon: AlertCircle,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "EnvPunishment",
    label: "环保处罚",
    icon: AlertTriangle,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "JudicialSale",
    label: "司法拍卖",
    icon: Gavel,
    level: "medium",
    color: "text-orange-500",
  },
  {
    key: "Liquidation",
    label: "清算信息",
    icon: Building2,
    level: "high",
    color: "text-red-500",
  },
];

export function RiskScanInfo({ riskData }: RiskScanInfoProps) {
  if (!riskData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            风险扫描
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">暂无风险扫描数据</p>
        </CardContent>
      </Card>
    );
  }

  // 统计各类风险
  const riskStats = RISK_TYPES.map(type => {
    const data = riskData[type.key as keyof RiskScanData];
    const count = Array.isArray(data) ? data.length : 0;
    return { ...type, count, data };
  }).filter(item => item.count > 0);

  // 计算风险等级
  const hasHighRisk = riskStats.some(r => r.level === "high" && r.count > 0);
  const hasMediumRisk = riskStats.some(
    r => r.level === "medium" && r.count > 0
  );
  const overallRisk = hasHighRisk ? "high" : hasMediumRisk ? "medium" : "low";

  const riskLevelConfig = {
    high: { label: "高风险", color: "bg-red-500", textColor: "text-red-500" },
    medium: {
      label: "中等风险",
      color: "bg-orange-500",
      textColor: "text-orange-500",
    },
    low: {
      label: "低风险",
      color: "bg-green-500",
      textColor: "text-green-500",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            风险扫描结果
          </span>
          <Badge className={`${riskLevelConfig[overallRisk].color} text-white`}>
            {riskLevelConfig[overallRisk].label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {riskStats.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span>未发现风险信息</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 风险概览 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {riskStats.map(risk => (
                <div
                  key={risk.key}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <risk.icon className={`h-4 w-4 ${risk.color}`} />
                  <div className="text-sm">
                    <span className="font-medium">{risk.label}</span>
                    <span className="text-muted-foreground ml-1">
                      ({risk.count})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 风险详情（可展开） */}
            {riskStats.filter(r => r.level === "high").length > 0 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                  ❗ 高风险提示
                </p>
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  {riskStats
                    .filter(r => r.level === "high")
                    .map(risk => (
                      <li key={risk.key}>
                        • 存在{risk.label}记录 ({risk.count}条)
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
