import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, User, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Image, FileText, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

// 股权穿透数据结构（上游股东）
interface EquityThroughChild {
  KeyNo: string;
  Name: string;
  Category: string;  // 0-企业, 2-自然人
  FundedRatio: string;
  InParentActualRadio: string;
  Count: string;
  Grade: string;
  ShouldCapi: string;
  StockRightNum: string;
  ShortStatus: string;
  Children: EquityThroughChild[] | null;
}

interface EquityThroughData {
  KeyNo: string;
  Name: string;
  Count: string;
  Children: EquityThroughChild[] | null;
}

// 对外投资穿透数据结构（下游子公司）
interface InvestmentDetailInfo {
  Level: string;
  ShouldCapi: string;
  CapitalType: string;
  BreakThroughStockPercent: string;
  StockType: string;
  Path: string;
  StockPercent: string;
}

interface InvestmentThroughItem {
  KeyNo: string;
  Name: string;
  CreditCode: string;
  CorpStatus: string;
  TotalStockPercent: string;
  DetailInfoList: InvestmentDetailInfo[];
}

interface InvestmentThroughData {
  KeyNo: string;
  CompanyName: string;
  FindMatched: string;
  Remark: string | null;
  BreakThroughList: InvestmentThroughItem[];
}

interface EquityChartProps {
  equityThrough: EquityThroughData | null;
  investmentThrough: InvestmentThroughData | null;
  companyName: string;
}

// 风险状态判断函数
const RISK_STATUSES = ['注销', '吊销', '清算', '迁出', '停业', '撤销', '解散'];
const WARNING_STATUSES = ['迁入', '非正常'];

function isRiskStatus(status: string): boolean {
  if (!status) return false;
  return RISK_STATUSES.some(risk => status.includes(risk));
}

function isWarningStatus(status: string): boolean {
  if (!status) return false;
  return WARNING_STATUSES.some(warn => status.includes(warn));
}

function getStatusType(status: string): 'normal' | 'warning' | 'risk' {
  if (isRiskStatus(status)) return 'risk';
  if (isWarningStatus(status)) return 'warning';
  return 'normal';
}

// 递归统计风险企业数量
function countRiskEntities(children: EquityThroughChild[] | null): { risk: number; warning: number } {
  if (!children) return { risk: 0, warning: 0 };
  
  let risk = 0;
  let warning = 0;
  
  for (const child of children) {
    const statusType = getStatusType(child.ShortStatus);
    if (statusType === 'risk') risk++;
    if (statusType === 'warning') warning++;
    
    if (child.Children) {
      const childCounts = countRiskEntities(child.Children);
      risk += childCounts.risk;
      warning += childCounts.warning;
    }
  }
  
  return { risk, warning };
}

// 统计投资企业风险数量
function countInvestmentRisks(items: InvestmentThroughItem[]): { risk: number; warning: number } {
  let risk = 0;
  let warning = 0;
  
  for (const item of items) {
    const statusType = getStatusType(item.CorpStatus);
    if (statusType === 'risk') risk++;
    if (statusType === 'warning') warning++;
  }
  
  return { risk, warning };
}

// 递归渲染股东树节点（带风险高亮）
function EquityNode({ node, level = 0 }: { node: EquityThroughChild; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.Children && node.Children.length > 0;
  const isCompany = node.Category === '0';
  const statusType = getStatusType(node.ShortStatus);
  const isRisk = statusType === 'risk';
  const isWarning = statusType === 'warning';
  
  // 根据风险状态设置样式
  const getBorderColor = () => {
    if (isRisk) return 'border-red-400 dark:border-red-600';
    if (isWarning) return 'border-yellow-400 dark:border-yellow-600';
    return 'border-gray-200 dark:border-gray-700';
  };
  
  const getBackgroundColor = () => {
    if (isRisk) return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
    if (isWarning) return 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30';
    return 'hover:bg-gray-50 dark:hover:bg-gray-800';
  };
  
  const getIconBackground = () => {
    if (isRisk) return 'bg-red-100 dark:bg-red-900';
    if (isWarning) return 'bg-yellow-100 dark:bg-yellow-900';
    if (isCompany) return 'bg-blue-100 dark:bg-blue-900';
    return 'bg-green-100 dark:bg-green-900';
  };
  
  const getIconColor = () => {
    if (isRisk) return 'text-red-600 dark:text-red-400';
    if (isWarning) return 'text-yellow-600 dark:text-yellow-400';
    if (isCompany) return 'text-blue-600 dark:text-blue-400';
    return 'text-green-600 dark:text-green-400';
  };
  
  return (
    <div className={`ml-4 border-l-2 ${getBorderColor()} pl-4 py-2`}>
      <div 
        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${getBackgroundColor()} ${hasChildren ? 'cursor-pointer' : ''}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <div className="w-4" />
        )}
        
        <div className={`p-2 rounded-full ${getIconBackground()}`}>
          {isRisk ? (
            <ShieldAlert className={`w-4 h-4 ${getIconColor()}`} />
          ) : isWarning ? (
            <AlertTriangle className={`w-4 h-4 ${getIconColor()}`} />
          ) : isCompany ? (
            <Building2 className={`w-4 h-4 ${getIconColor()}`} />
          ) : (
            <User className={`w-4 h-4 ${getIconColor()}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate ${isRisk ? 'text-red-700 dark:text-red-300' : isWarning ? 'text-yellow-700 dark:text-yellow-300' : ''}`}>
              {node.Name}
            </span>
            {node.ShortStatus && (
              <Badge 
                variant={isRisk ? 'destructive' : isWarning ? 'outline' : node.ShortStatus === '存续' ? 'default' : 'secondary'} 
                className={`text-xs ${isWarning ? 'border-yellow-500 text-yellow-700 dark:text-yellow-300' : ''}`}
              >
                {isRisk && <ShieldAlert className="w-3 h-3 mr-1" />}
                {isWarning && <AlertTriangle className="w-3 h-3 mr-1" />}
                {node.ShortStatus}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className={`font-medium ${isRisk ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}`}>
              持股 {node.FundedRatio}
            </span>
            {node.ShouldCapi && (
              <span>认缴 {node.ShouldCapi}万</span>
            )}
            <span>第{node.Grade}层</span>
          </div>
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div className="mt-1">
          {node.Children!.map((child, index) => (
            <EquityNode key={child.KeyNo || index} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// 对外投资列表项（带风险高亮）
function InvestmentItem({ item }: { item: InvestmentThroughItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.DetailInfoList && item.DetailInfoList.length > 0;
  const statusType = getStatusType(item.CorpStatus);
  const isRisk = statusType === 'risk';
  const isWarning = statusType === 'warning';
  
  const getBorderColor = () => {
    if (isRisk) return 'border-red-400 dark:border-red-600';
    if (isWarning) return 'border-yellow-400 dark:border-yellow-600';
    return 'border-gray-200 dark:border-gray-700';
  };
  
  const getBackgroundColor = () => {
    if (isRisk) return 'bg-red-50 dark:bg-red-900/20';
    if (isWarning) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return 'bg-gray-50 dark:bg-gray-800';
  };
  
  const getIconBackground = () => {
    if (isRisk) return 'bg-red-100 dark:bg-red-900';
    if (isWarning) return 'bg-yellow-100 dark:bg-yellow-900';
    return 'bg-orange-100 dark:bg-orange-900';
  };
  
  const getIconColor = () => {
    if (isRisk) return 'text-red-600 dark:text-red-400';
    if (isWarning) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };
  
  return (
    <div className={`border ${getBorderColor()} rounded-lg mb-2 overflow-hidden`}>
      <div 
        className={`flex items-center gap-3 p-3 ${getBackgroundColor()} ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {hasDetails ? (
          expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <div className="w-4" />
        )}
        
        <div className={`p-2 rounded-full ${getIconBackground()}`}>
          {isRisk ? (
            <ShieldAlert className={`w-4 h-4 ${getIconColor()}`} />
          ) : isWarning ? (
            <AlertTriangle className={`w-4 h-4 ${getIconColor()}`} />
          ) : (
            <TrendingDown className={`w-4 h-4 ${getIconColor()}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate ${isRisk ? 'text-red-700 dark:text-red-300' : isWarning ? 'text-yellow-700 dark:text-yellow-300' : ''}`}>
              {item.Name}
            </span>
            <Badge 
              variant={isRisk ? 'destructive' : isWarning ? 'outline' : item.CorpStatus === '存续' ? 'default' : 'secondary'} 
              className={`text-xs ${isWarning ? 'border-yellow-500 text-yellow-700 dark:text-yellow-300' : ''}`}
            >
              {isRisk && <ShieldAlert className="w-3 h-3 mr-1" />}
              {isWarning && <AlertTriangle className="w-3 h-3 mr-1" />}
              {item.CorpStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className={`font-medium ${isRisk ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400'}`}>
              总持股 {item.TotalStockPercent}
            </span>
            {item.CreditCode && (
              <span className="font-mono">{item.CreditCode}</span>
            )}
          </div>
        </div>
      </div>
      
      {expanded && hasDetails && (
        <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">穿透路径：</div>
          {item.DetailInfoList.map((detail, index) => (
            <div key={index} className="flex items-center gap-2 py-1 text-sm">
              <Badge variant="outline" className="text-xs">
                {detail.StockType}
              </Badge>
              <span className="text-gray-600 dark:text-gray-300 truncate flex-1">
                {detail.Path}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                {detail.StockPercent}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 风险图例组件
function RiskLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <span className="font-medium">风险图例：</span>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
        <span>正常企业</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span>自然人</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <span>异常预警</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <span>高风险</span>
      </div>
    </div>
  );
}

export function EquityChart({ equityThrough, investmentThrough, companyName }: EquityChartProps) {
  const equityRef = useRef<HTMLDivElement | null>(null);
  const investmentRef = useRef<HTMLDivElement | null>(null);
  const [exportingEquityPng, setExportingEquityPng] = useState(false);
  const [exportingInvestmentPng, setExportingInvestmentPng] = useState(false);
  
  const hasEquityData = equityThrough && equityThrough.Children && equityThrough.Children.length > 0;
  const hasInvestmentData = investmentThrough && investmentThrough.BreakThroughList && investmentThrough.BreakThroughList.length > 0;
  
  // 统计风险数量
  const equityRisks = hasEquityData ? countRiskEntities(equityThrough.Children) : { risk: 0, warning: 0 };
  const investmentRisks = hasInvestmentData ? countInvestmentRisks(investmentThrough.BreakThroughList) : { risk: 0, warning: 0 };
  
  // 导出为PNG图片
  const exportToPng = async (ref: React.RefObject<HTMLDivElement | null>, filename: string, setLoading: (v: boolean) => void) => {
    if (!ref.current) return;
    
    setLoading(true);
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('图片导出成功');
    } catch (error) {
      console.error('Export PNG error:', error);
      toast.error('图片导出失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 导出为PDF
  const exportToPdf = async (ref: React.RefObject<HTMLDivElement | null>, title: string) => {
    if (!ref.current) return;
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('请允许弹出窗口以导出PDF');
        return;
      }
      
      const styles = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch {
            return '';
          }
        })
        .join('\n');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title} - ${companyName}</title>
          <style>
            ${styles}
            body { 
              padding: 20px; 
              background: white;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #3b82f6;
            }
            .print-header h1 {
              font-size: 24px;
              color: #1f2937;
              margin: 0 0 8px 0;
            }
            .print-header p {
              font-size: 14px;
              color: #6b7280;
              margin: 0;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${title}</h1>
            <p>${companyName} | 生成时间：${new Date().toLocaleString()}</p>
          </div>
          ${ref.current.innerHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
      toast.success('已打开打印窗口，请选择"另存为PDF"');
    } catch (error) {
      console.error('Export PDF error:', error);
      toast.error('PDF导出失败');
    }
  };
  
  if (!hasEquityData && !hasInvestmentData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            企业族谱
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无股权穿透数据</p>
            <p className="text-sm mt-1">请确保已配置企查查API并开通股权穿透接口</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 风险图例 */}
      <RiskLegend />
      
      {/* 股权穿透（上游股东） */}
      {hasEquityData && (
        <Card className={equityRisks.risk > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                股权穿透（上游股东）
                <Badge variant="secondary" className="ml-2">
                  {equityThrough.Count} 个股东
                </Badge>
                {equityRisks.risk > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    {equityRisks.risk} 高风险
                  </Badge>
                )}
                {equityRisks.warning > 0 && (
                  <Badge variant="outline" className="ml-1 border-yellow-500 text-yellow-700">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {equityRisks.warning} 预警
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPng(equityRef, `${companyName}-股权穿透图`, setExportingEquityPng)}
                  disabled={exportingEquityPng}
                >
                  {exportingEquityPng ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Image className="w-4 h-4 mr-1" />
                  )}
                  导出PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPdf(equityRef, '股权穿透图')}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  导出PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={equityRef} className="bg-white p-4 rounded-lg">
              {/* 目标企业 */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                <div className="p-2 rounded-full bg-blue-600">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg">{companyName}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">查询目标企业</div>
                </div>
              </div>
              
              {/* 股东树 */}
              <div className="border-l-4 border-blue-500 pl-2">
                {equityThrough.Children!.map((child, index) => (
                  <EquityNode key={child.KeyNo || index} node={child} level={0} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 对外投资穿透（下游子公司） */}
      {hasInvestmentData && (
        <Card className={investmentRisks.risk > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-orange-600" />
                对外投资穿透（下游子公司）
                <Badge variant="secondary" className="ml-2">
                  {investmentThrough.BreakThroughList.length} 家企业
                </Badge>
                {investmentRisks.risk > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    {investmentRisks.risk} 高风险
                  </Badge>
                )}
                {investmentRisks.warning > 0 && (
                  <Badge variant="outline" className="ml-1 border-yellow-500 text-yellow-700">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {investmentRisks.warning} 预警
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPng(investmentRef, `${companyName}-对外投资图`, setExportingInvestmentPng)}
                  disabled={exportingInvestmentPng}
                >
                  {exportingInvestmentPng ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Image className="w-4 h-4 mr-1" />
                  )}
                  导出PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPdf(investmentRef, '对外投资穿透图')}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  导出PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={investmentRef} className="bg-white p-4 rounded-lg">
              {/* 目标企业 */}
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-4">
                <div className="p-2 rounded-full bg-orange-600">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg">{companyName}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">查询目标企业</div>
                </div>
              </div>
              
              {/* 投资企业列表 */}
              <div className="space-y-2">
                {investmentThrough.BreakThroughList.map((item, index) => (
                  <InvestmentItem key={item.KeyNo || index} item={item} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EquityChart;
