import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Info,
  Sparkles,
  Database,
  FileText,
  Building2,
  BarChart3,
  Flame,
  RefreshCw,
  Download,
  Shield,
  Zap,
  Clock,
  CheckCircle2,
} from "lucide-react";

// 版本更新记录
const versionHistory = [
  {
    version: "3.0",
    date: "2024年12月31日",
    title: "缓存增强版",
    highlights: ["缓存预热", "缓存刷新", "数据导出"],
    features: [
      {
        icon: Flame,
        title: "缓存预热功能",
        description:
          "支持批量导入企业名单后自动预查询并缓存，或一键预热所有园区企业，避免首次查询时的等待",
      },
      {
        icon: RefreshCw,
        title: "缓存刷新按钮",
        description:
          "在报告详情页添加刷新数据按钮，允许用户手动更新特定企业的缓存数据",
      },
      {
        icon: Download,
        title: "缓存数据导出",
        description:
          "支持将所有已缓存的企业数据导出为Excel文件，包含20多个字段，方便离线分析或备份",
      },
    ],
  },
  {
    version: "2.9",
    date: "2024年12月30日",
    title: "智能缓存版",
    highlights: ["数据缓存", "成本优化", "缓存统计"],
    features: [
      {
        icon: Database,
        title: "企查查完整数据缓存",
        description:
          "自动缓存企查查API返回的所有数据，30天内重复查询直接读取缓存，每次节省约4元",
      },
      {
        icon: Clock,
        title: "缓存有效期配置",
        description:
          "支持自定义缓存有效期，在设置页面可随时调整，平衡数据时效性和成本",
      },
      {
        icon: BarChart3,
        title: "缓存统计面板",
        description:
          "在设置页面和API统计页面显示缓存命中次数、命中率和预估节省费用",
      },
    ],
  },
  {
    version: "2.8",
    date: "2024年12月30日",
    title: "数据增强版",
    highlights: ["8个新API", "知识产权", "上下游分析"],
    features: [
      {
        icon: Shield,
        title: "知识产权分析",
        description: "新增专利、商标、软著三个API，报告新增知识产权分析章节",
      },
      {
        icon: Building2,
        title: "上下游关联企业",
        description: "新增客户、供应商两个API，增强报告中的上下游企业分析",
      },
      {
        icon: FileText,
        title: "财务与资质数据",
        description:
          "新增高管详情、年报财务、资质证书三个API，报告内容更加丰富",
      },
    ],
  },
  {
    version: "2.5",
    date: "2024年12月29日",
    title: "企查查集成版",
    highlights: ["企查查API", "工商数据", "股东高管"],
    features: [
      {
        icon: Database,
        title: "企查查API集成",
        description:
          "集成企查查开放平台API，获取企业工商注册信息、股东信息、高管信息等权威数据",
      },
      {
        icon: BarChart3,
        title: "API调用统计",
        description:
          "新增API统计页面，实时监控各接口调用次数和费用，支持按日期筛选",
      },
      {
        icon: Zap,
        title: "数据源切换",
        description:
          "支持在网络公开信息、天眼查API、企查查API三种数据源之间灵活切换",
      },
    ],
  },
  {
    version: "2.0",
    date: "2024年12月28日",
    title: "园区分析版",
    highlights: ["园区企业", "匹配分析", "批量查询"],
    features: [
      {
        icon: Building2,
        title: "园区企业管理",
        description:
          "支持导入园区企业数据，系统自动分析目标企业与园区企业的上下游关系和入驻可能性",
      },
      {
        icon: FileText,
        title: "批量报告生成",
        description:
          "支持上传CSV文件批量生成企业分析报告，完成后可打包下载所有报告",
      },
      {
        icon: CheckCircle2,
        title: "任务管理中心",
        description: "新增任务管理页面，查看所有批量任务的执行状态和进度",
      },
    ],
  },
  {
    version: "1.0",
    date: "2024年12月27日",
    title: "初始版本",
    highlights: ["AI报告", "风险分析", "Word导出"],
    features: [
      {
        icon: Sparkles,
        title: "AI智能报告生成",
        description:
          "输入企业名称，AI自动搜索整合公开信息，生成包含发展历程、营收分析、风险提示等内容的专业报告",
      },
      {
        icon: Shield,
        title: "风险提示分析",
        description:
          "独立的风险分析页签，从报告中提取经营风险、财务风险、法律风险等关键信息",
      },
      {
        icon: Download,
        title: "报告导出功能",
        description: "支持将生成的报告导出为Word或PDF格式，方便分享和存档",
      },
    ],
  },
];

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <Info className="h-5 w-5" />
                关于系统
              </h1>
              <p className="text-sm text-muted-foreground">
                版本说明与功能介绍
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
        {/* 系统介绍 */}
        <Card className="mb-8">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              数智深圳湾智能体 · 企业智能分析平台
            </CardTitle>
            <CardDescription className="text-base mt-2">
              KunLing CIS - Corporate Intelligence System
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground max-w-2xl mx-auto">
              深圳湾
              AI是一款基于AI的企业调研工具，能够自动整合企查查API数据并生成专业的企业分析报告。
              系统支持单个查询、批量查询、园区企业管理等功能，并提供完善的数据缓存机制以降低API调用成本。
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Badge variant="outline" className="text-sm px-3 py-1">
                当前版本: v3.0
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                鲲鹏产业源头创新中心
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 版本历史 */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            版本更新历史
          </h2>

          {versionHistory.map((release, index) => (
            <Card
              key={release.version}
              className={index === 0 ? "border-primary" : ""}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <Badge
                        variant={index === 0 ? "default" : "secondary"}
                        className="text-sm"
                      >
                        v{release.version}
                      </Badge>
                      <span>{release.title}</span>
                      {index === 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs text-primary border-primary"
                        >
                          最新版本
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {release.date}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {release.highlights.map(highlight => (
                      <Badge
                        key={highlight}
                        variant="outline"
                        className="text-xs"
                      >
                        {highlight}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {release.features.map((feature, featureIndex) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={featureIndex}
                        className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">
                            {feature.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 技术支持 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">技术支持</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>开发团队：</strong>鲲鹏产业源头创新中心
            </p>
            <p>
              <strong>数据来源：</strong>企查查开放平台 (openapi.qichacha.com)
            </p>
            <p>
              <strong>AI能力：</strong>通义千问大语言模型
            </p>
            <p className="pt-2 text-xs">
              如有任何问题或建议，请联系系统管理员。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
