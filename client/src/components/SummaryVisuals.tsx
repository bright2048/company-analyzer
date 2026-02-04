/**
 * 缩略版报告可视化组件
 *
 * 功能说明：
 * - 企业综合评分雷达图（6维度：规模、稳定性、创新力、合规性、成长性、财务健康）
 * - 关键指标卡片（注册资本、成立年限、专利数量、员工规模等）
 * - 风险等级指示器（低/中/高风险可视化）
 * - 合作建议指标
 *
 * 使用方法：
 * <SummaryVisuals companyInfo={report.companyInfo} summaryContent={report.summaryContent} />
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RiskScanData } from "./RiskScanInfo";
import {
  Building2,
  Calendar,
  Users,
  Banknote,
  Award,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Scale,
  Target,
  Zap,
} from "lucide-react";

// ============================================================
// 类型定义
// ============================================================

interface CompanyInfo {
  // 企查查原始字段名
  Name?: string;
  RegistCapi?: string;
  StartDate?: string;
  Status?: string;
  Industry?: string;
  Employees?: string;
  // 后端存储的字段名（小写驼峰）
  name?: string;
  registeredCapital?: string;
  realCapital?: string;
  establishDate?: string;
  status?: string;
  industry?: string;
  employees?: string;
  // 知识产权数据 - 支持两种格式：{total, list}对象格式或数组格式
  patents?: { total: number; list: any[] } | any[];
  trademarks?: { total: number; list: any[] } | any[];
  copyrights?: { total: number; list: any[] } | any[];
  // 资质证书 - 支持两种字段名：certificates（新）和certifications（旧）
  certificates?: { total: number; list: any[] } | any[];
  certifications?: Array<{ CertName: string }>;
  // 股东和高管
  shareholders?: Array<{ StockName: string; StockPercent: string }>;
  executives?: Array<{ Name: string; Job: string }>;
  // 客户和供应商
  customers?: { total: number; list: any[] } | any[];
  suppliers?: { total: number; list: any[] } | any[];
  // 年报和融资
  annualReports?: Array<{ Year: string }> | any[];
  financings?: any[];
  riskScan?: RiskScanData | null;
}

interface SummaryVisualsProps {
  companyInfo: string | null;
  summaryContent: string | null;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 解析注册资本字符串，提取数值（单位：万元）
 */
function parseCapital(capitalStr: string | undefined): number {
  if (!capitalStr) return 0;
  const match = capitalStr.match(/([\d.]+)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (capitalStr.includes("亿")) return value * 10000;
  if (capitalStr.includes("万")) return value;
  return value / 10000; // 默认为元，转换为万元
}

/**
 * 计算企业成立年限
 */
function calculateYears(startDate: string | undefined): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const diffInDays = (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  const years = diffInDays / 365.25;
  // 如果不满一年但有有效日期，返回-1表示"未满一年"
  if (years < 1 && years > 0) return 1;
  return Math.floor(years);
}

/**
 * 从缩略版报告内容中提取风险等级
 */
function extractRiskLevel(
  summaryContent: string | null,
  riskScan?: CompanyInfo["riskScan"]
): "low" | "medium" | "high" {
  // 优先使用风险扫描真实数据
  if (riskScan) {
    // 高风险：失信、被执行、股权冻结、严重违法、破产
    if (
      (riskScan.ShiXin && riskScan.ShiXin.length > 0) ||
      (riskScan.ZhiXing && riskScan.ZhiXing.length > 0) ||
      (riskScan.EquityFreeze && riskScan.EquityFreeze.length > 0) ||
      (riskScan.SeriousIllegal && riskScan.SeriousIllegal.length > 0) ||
      (riskScan.Bankruptcy && riskScan.Bankruptcy.length > 0)
    ) {
      return "high";
    }

    // 中等风险：行政处罚、经营异常、税务异常
    if (
      (riskScan.AdminPenalty && riskScan.AdminPenalty.length > 0) ||
      (riskScan.Exception && riskScan.Exception.length > 0) ||
      (riskScan.TaxAbnormal && riskScan.TaxAbnormal.length > 0)
    ) {
      return "medium";
    }

    return "low";
  }

  // 该部分代码是通过搜索缩略版报告内容中的关键字来确定风险等级，这个
  //存在严重 bug，比如缩略报告中的描述中，包含了“无失信、被执行等信息”，也被识别为高风险。
  // 3. **法律与合规风险**：
  //  - “ZHENHUA”商标在第9类被驳回并进入复审，存在品牌使用不确定性；
  //  - 资质证书信息不完整（全部显示为“undefined”），关键电信业务许可真实性待验证；
  //  - 无失信、被执行或行政处罚记录，经营状态正常。
  // 回退到原来的文本分析逻辑
  if (!summaryContent) return "medium";
  if (!summaryContent) return "medium";
  const content = summaryContent.toLowerCase();

  // // 高风险关键词
  // if (
  //   content.includes("高风险") ||
  //   content.includes("重大风险") ||
  //   content.includes("严重") ||
  //   content.includes("注销") ||
  //   content.includes("吊销") ||
  //   content.includes("失信")
  // ) {
  //   return "high";
  // }

  // 低风险关键词
  if (
    content.includes("低风险") ||
    content.includes("风险较低") ||
    content.includes("经营稳定") ||
    content.includes("信誉良好") ||
    content.includes("优质") ||
    content.includes("推荐合作")
  ) {
    return "low";
  }

  return "medium";
}

/**
 * 从缩略版报告内容中提取合作建议
 */
function extractCooperationAdvice(summaryContent: string | null): string {
  if (!summaryContent) return "建议进一步了解后决定";

  if (
    summaryContent.includes("强烈推荐") ||
    summaryContent.includes("优先合作")
  ) {
    return "强烈推荐合作";
  }
  if (
    summaryContent.includes("建议合作") ||
    summaryContent.includes("可以合作") ||
    summaryContent.includes("推荐")
  ) {
    return "建议合作";
  }
  if (summaryContent.includes("谨慎") || summaryContent.includes("观望")) {
    return "建议谨慎考虑";
  }
  if (summaryContent.includes("不建议") || summaryContent.includes("暂不")) {
    return "暂不建议合作";
  }

  return "建议进一步了解";
}

// ============================================================
// 子组件
// ============================================================

/**
 * 雷达图组件 - 使用SVG绘制6维度评分
 */
function RadarChart({
  scores,
}: {
  scores: { label: string; value: number; color: string }[];
}) {
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const levels = 5;

  // 计算多边形顶点
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / scores.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // 生成背景网格
  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = scores
      .map((_, index) => {
        const angle = (Math.PI * 2 * index) / scores.length - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
      })
      .join(" ");
    return (
      <polygon
        key={i}
        points={points}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="1"
      />
    );
  });

  // 生成数据多边形
  const dataPoints = scores.map((s, i) => getPoint(i, s.value));
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  // 生成标签
  const labels = scores.map((s, i) => {
    const angle = (Math.PI * 2 * i) / scores.length - Math.PI / 2;
    const labelRadius = radius + 25;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);
    return (
      <text
        key={i}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xs fill-muted-foreground"
      >
        {s.label}
      </text>
    );
  });

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* 背景网格 */}
      {gridLines}

      {/* 轴线 */}
      {scores.map((_, i) => {
        const angle = (Math.PI * 2 * i) / scores.length - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        );
      })}

      {/* 数据区域 */}
      <polygon
        points={dataPolygon}
        fill="rgba(59, 130, 246, 0.3)"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
      ))}

      {/* 标签 */}
      {labels}
    </svg>
  );
}

/**
 * 指标卡片组件
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className={`p-2 rounded-full bg-background ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold truncate">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

/**
 * 风险等级指示器
 */
function RiskIndicator({ level }: { level: "low" | "medium" | "high" }) {
  const config = {
    low: {
      label: "低风险",
      color: "bg-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      textColor: "text-green-700 dark:text-green-400",
      icon: CheckCircle2,
      description: "企业经营状况良好，风险可控",
      progress: 25,
    },
    medium: {
      label: "中等风险",
      color: "bg-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      textColor: "text-amber-700 dark:text-amber-400",
      icon: AlertTriangle,
      description: "存在一定风险，建议关注",
      progress: 50,
    },
    high: {
      label: "高风险",
      color: "bg-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      textColor: "text-red-700 dark:text-red-400",
      icon: XCircle,
      description: "风险较高，需谨慎评估",
      progress: 85,
    },
  };

  const {
    label,
    color,
    bgColor,
    textColor,
    icon: Icon,
    description,
    progress,
  } = config[level];

  return (
    <div className={`p-4 rounded-lg ${bgColor}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`h-6 w-6 ${textColor}`} />
        <div>
          <span className={`font-semibold ${textColor}`}>{label}</span>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${color} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>低</span>
        <span>中</span>
        <span>高</span>
      </div>
    </div>
  );
}

/**
 * 合作建议卡片
 */
function CooperationAdvice({
  advice,
  riskLevel,
}: {
  advice: string;
  riskLevel: "low" | "medium" | "high";
}) {
  const getAdviceConfig = () => {
    if (advice.includes("强烈推荐")) {
      return {
        color: "bg-green-500",
        icon: Target,
        badgeClass: "bg-green-500 text-white hover:bg-green-600",
      };
    }
    if (advice.includes("建议合作") || advice.includes("推荐")) {
      return {
        color: "bg-blue-500",
        icon: Lightbulb,
        badgeClass: "bg-blue-500 text-white hover:bg-blue-600",
      };
    }
    if (advice.includes("谨慎")) {
      return {
        color: "bg-amber-500",
        icon: Scale,
        badgeClass: "bg-amber-500 text-white hover:bg-amber-600",
      };
    }
    if (advice.includes("不建议")) {
      return {
        color: "bg-red-500",
        icon: XCircle,
        badgeClass: "bg-red-500 text-white hover:bg-red-600",
      };
    }
    return { color: "bg-gray-500", icon: Lightbulb, badgeClass: "" };
  };

  const { icon: Icon, badgeClass } = getAdviceConfig();

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <div className="p-2 rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">合作建议</p>
        <Badge className={`mt-1 ${badgeClass}`}>{advice}</Badge>
      </div>
    </div>
  );
}


// ============================================================
// 主组件
// ============================================================

export function SummaryVisuals({
  companyInfo,
  summaryContent,
}: SummaryVisualsProps) {
  // 解析企业信息

  const info: CompanyInfo = useMemo(() => {
    if (!companyInfo) return {};
    try {
      return JSON.parse(companyInfo);
    } catch {
      return {};
    }
  }, [companyInfo]);

  // 计算各项指标
  const metrics = useMemo(() => {
    // 同时支持企查查原始字段名和后端存储的字段名
    const capital = parseCapital(info.RegistCapi || info.registeredCapital);
    const years = calculateYears(info.StartDate || info.establishDate);

    // 辅助函数：从两种格式中提取数量
    const getCount = (
      data: { total: number; list: any[] } | any[] | undefined
    ): number => {
      if (!data) return 0;
      if (Array.isArray(data)) return data.length;
      if (typeof data === "object" && "total" in data) return data.total || 0;
      return 0;
    };

    const patentCount = getCount(info.patents);
    const trademarkCount = getCount(info.trademarks);
    const copyrightCount = getCount(info.copyrights);
    // 资质证书：优先用certificates，其次用certifications
    const certCount =
      getCount(info.certificates) || info.certifications?.length || 0;
    const customerCount = getCount(info.customers);
    const supplierCount = getCount(info.suppliers);

    return {
      capital,
      years,
      patentCount,
      trademarkCount,
      copyrightCount,
      certCount,
      customerCount,
      supplierCount,
      totalIP: patentCount + trademarkCount + copyrightCount,
    };
  }, [info]);

  // 计算雷达图评分（0-100）
  const radarScores = useMemo(() => {
    // 规模评分：基于注册资本，500 万以上才算满分
    const scaleScore = Math.min(100, (metrics.capital / 10000 / 5) * 100);

    // 稳定性评分：基于成立年限
    const stabilityScore = Math.min(100, metrics.years * 10);

    // 创新力评分：基于知识产权数量
    const innovationScore = Math.min(100, metrics.totalIP * 5);

    // 合规性评分：基于资质证书
    const complianceScore = Math.min(100, metrics.certCount * 20);

    // 成长性评分：基于客户和供应商数量
    const growthScore = Math.min(
      100,
      (metrics.customerCount + metrics.supplierCount) * 10
    );

    // 财务健康：基于实缴资本比例（支持两种字段名）
    const realCapi = parseCapital(info.RecCap || info.realCapital);
    const financialScore =
      metrics.capital > 0
        ? Math.min(100, (realCapi / metrics.capital) * 100)
        : 50;

    return [
      { label: "规模", value: scaleScore || 50, color: "#3b82f6" },
      { label: "稳定性", value: stabilityScore || 50, color: "#10b981" },
      { label: "创新力", value: innovationScore || 30, color: "#8b5cf6" },
      { label: "合规性", value: complianceScore || 40, color: "#f59e0b" },
      { label: "成长性", value: growthScore || 40, color: "#ef4444" },
      { label: "财务", value: financialScore || 50, color: "#06b6d4" },
    ];
  }, [metrics, info.RealCapi, info.realCapital]);

  // 提取风险等级和合作建议
  const riskLevel = extractRiskLevel(summaryContent, info.riskScan);
  const cooperationAdvice = extractCooperationAdvice(summaryContent);

  // 计算综合评分
  const overallScore = useMemo(() => {
    const avg =
      radarScores.reduce((sum, s) => sum + s.value, 0) / radarScores.length;
    return Math.round(avg);
  }, [radarScores]);

  return (
    <div className="space-y-6">
      {/* 第一行：综合评分和雷达图 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 综合评分卡片 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              企业综合评分
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(overallScore / 100) * 352} 352`}
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl font-bold">{overallScore}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              基于企业规模、稳定性、创新力等6个维度综合评估
            </p>
          </CardContent>
        </Card>

        {/* 雷达图 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              多维度分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart scores={radarScores} />
          </CardContent>
        </Card>
      </div>

      {/* 第二行：关键指标 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            关键指标
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={Banknote}
              label="注册资本"
              value={info.RegistCapi || info.registeredCapital || "未知"}
              // 添加次级内容
              subValue={`实缴：${info.realCapital || "未知"}`}
              color="text-green-600"
            />
            <MetricCard
              icon={Calendar}
              label="成立年限"
              value={
                metrics.years === -1
                  ? "未满一年"
                  : metrics.years > 0
                    ? `${metrics.years}年`
                    : "未知"
              }
              subValue={info.StartDate || info.establishDate}
              color="text-blue-600"
            />
            <MetricCard
              icon={Award}
              label="知识产权"
              value={`${metrics.totalIP}项`}
              subValue={`专利${metrics.patentCount} / 商标${metrics.trademarkCount} / 软著${metrics.copyrightCount}`}
              color="text-purple-600"
            />
            <MetricCard
              icon={Shield}
              label="资质证书"
              value={`${metrics.certCount}项`}
              color="text-amber-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* 第三行：风险评估和合作建议 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              风险评估
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskIndicator level={riskLevel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              合作建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CooperationAdvice
              advice={cooperationAdvice}
              riskLevel={riskLevel}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">客户数：</span>
                <span className="font-medium">{metrics.customerCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">供应商：</span>
                <span className="font-medium">{metrics.supplierCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SummaryVisuals;
