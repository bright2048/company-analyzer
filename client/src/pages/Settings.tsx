import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Globe,
  Database,
  Loader2,
  CheckCircle2,
  Info,
  HardDrive,
  Trash2,
  Calendar,
  TrendingUp,
  Download,
  Flame,
  Building2,
  Upload,
  Bot,
  Check,
  Star,
  Plus,
  Key,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Edit, RefreshCw, ExternalLink } from "lucide-react";

// 企查查API端点配置组件
function ApiEndpointConfig() {
  const [editingApi, setEditingApi] = useState<{
    apiCode: string;
    apiName: string;
    endpoint: string;
    primaryParam: string;
    cost: string;
    description: string;
    isEnabled: boolean;
  } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const utils = trpc.useUtils();

  // 获取所有API配置
  const { data: apiConfigs, isLoading: apiConfigsLoading } = trpc.qichachaApiConfig.list.useQuery();

  // 更新API配置
  const updateApiConfigMutation = trpc.qichachaApiConfig.update.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.qichachaApiConfig.list.invalidate();
      setShowEditDialog(false);
      setEditingApi(null);
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    },
  });

  // 初始化默认配置
  const initDefaultsMutation = trpc.qichachaApiConfig.initDefaults.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.qichachaApiConfig.list.invalidate();
    },
    onError: (error) => {
      toast.error("初始化失败: " + error.message);
    },
  });

  const handleEditApi = (api: typeof editingApi) => {
    setEditingApi(api);
    setShowEditDialog(true);
  };

  const handleSaveApi = () => {
    if (!editingApi) return;
    updateApiConfigMutation.mutate({
      apiCode: editingApi.apiCode,
      apiName: editingApi.apiName,
      endpoint: editingApi.endpoint,
      primaryParam: editingApi.primaryParam,
      cost: editingApi.cost,
      description: editingApi.description,
      isEnabled: editingApi.isEnabled,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          企查查API端点配置
        </CardTitle>
        <CardDescription>
          配置企查查各接口的调用端点、参数名和费用。修改后即时生效，无需重启服务。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 初始化按钮 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            如果配置丢失或需要重置，点击右侧按钮初始化默认配置
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => initDefaultsMutation.mutate()}
            disabled={initDefaultsMutation.isPending}
          >
            {initDefaultsMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            初始化默认配置
          </Button>
        </div>

        {/* API配置列表 */}
        {apiConfigsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : apiConfigs && apiConfigs.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">API编码</TableHead>
                  <TableHead className="w-[120px]">接口名称</TableHead>
                  <TableHead>端点路径</TableHead>
                  <TableHead className="w-[80px]">参数名</TableHead>
                  <TableHead className="w-[60px]">费用</TableHead>
                  <TableHead className="w-[60px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiConfigs.map((api) => (
                  <TableRow key={api.apiCode}>
                    <TableCell className="font-mono text-xs">{api.apiCode}</TableCell>
                    <TableCell className="font-medium text-sm">{api.apiName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {api.endpoint}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{api.primaryParam}</TableCell>
                    <TableCell className="text-orange-500">¥{api.cost}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditApi({
                          apiCode: api.apiCode,
                          apiName: api.apiName,
                          endpoint: api.endpoint,
                          primaryParam: api.primaryParam || 'searchKey',
                          cost: api.cost || '0.00',
                          description: api.description || '',
                          isEnabled: api.isEnabled,
                        })}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无API配置，点击上方按钮初始化默认配置</p>
          </div>
        )}

        {/* 编辑对话框 */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>编辑API配置</DialogTitle>
              <DialogDescription>
                修改企查查API的调用端点和参数配置
              </DialogDescription>
            </DialogHeader>
            {editingApi && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>API编码</Label>
                    <Input value={editingApi.apiCode} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>接口名称</Label>
                    <Input
                      value={editingApi.apiName}
                      onChange={(e) => setEditingApi({ ...editingApi, apiName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>端点路径</Label>
                  <Input
                    value={editingApi.endpoint}
                    onChange={(e) => setEditingApi({ ...editingApi, endpoint: e.target.value })}
                    placeholder="例如: ECIV4/GetDetailsByName"
                  />
                  <p className="text-xs text-muted-foreground">
                    完整URL为: https://api.qichacha.com/「端点路径」
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>主参数名</Label>
                    <Input
                      value={editingApi.primaryParam}
                      onChange={(e) => setEditingApi({ ...editingApi, primaryParam: e.target.value })}
                      placeholder="例如: searchKey"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>费用（元/次）</Label>
                    <Input
                      value={editingApi.cost}
                      onChange={(e) => setEditingApi({ ...editingApi, cost: e.target.value })}
                      placeholder="例如: 0.30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>接口说明</Label>
                  <Textarea
                    value={editingApi.description}
                    onChange={(e) => setEditingApi({ ...editingApi, description: e.target.value })}
                    placeholder="接口用途说明..."
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveApi} disabled={updateApiConfigMutation.isPending}>
                {updateApiConfigMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 企查查官方文档链接 */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          <a
            href="https://openapi.qcc.com/dataApi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            查看企查查官方API文档
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// LLM提供商配置信息
const LLM_PROVIDERS = [
  { id: 'zhipu', name: '智谱AI', defaultModel: 'glm-4.7', description: 'GLM-4系列，推荐GLM-4.7最新旗舰模型' },
  { id: 'wenxin', name: '百度文心一言', defaultModel: 'ernie-4.5-8k-preview', description: 'ERNIE系列，支持DeepSeek-V3' },
  { id: 'qwen', name: '通义千问', defaultModel: 'qwen-plus', description: 'Qwen系列，阿里云提供' },
];

// LLM大模型配置组件
function LlmConfigSection() {
  const utils = trpc.useUtils();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; response?: string }>>({});
  
  // 添加/编辑配置相关状态
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<{
    provider: 'qwen' | 'zhipu' | 'wenxin';
    providerName: string;
    defaultModel: string;
    apiKey: string;
    apiSecret: string;
    isDefault: boolean;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  // 获取LLM提供商列表（静态配置）
  const { data: llmProviders } = trpc.llmProvider.list.useQuery();

  // 获取启用的LLM配置（从数据库读取）
  const { data: enabledConfigs, isLoading, refetch } = trpc.llmProvider.getEnabled.useQuery();

  // 获取默认LLM配置
  const { data: defaultConfig } = trpc.llmProvider.getDefault.useQuery();

  // 保存配置
  const saveConfigMutation = trpc.llmProvider.saveConfig.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("配置已保存");
        utils.llmProvider.getEnabled.invalidate();
        utils.llmProvider.getDefault.invalidate();
        setShowAddDialog(false);
        setEditingConfig(null);
        setShowApiKey(false);
        setShowApiSecret(false);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    },
  });

  // 删除配置
  const deleteConfigMutation = trpc.llmProvider.deleteConfig.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("配置已删除");
        utils.llmProvider.getEnabled.invalidate();
        utils.llmProvider.getDefault.invalidate();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  // 设置默认提供商
  const setDefaultMutation = trpc.llmProvider.setDefault.useMutation({
    onSuccess: () => {
      toast.success("默认模型已更新");
      utils.llmProvider.getDefault.invalidate();
      utils.llmProvider.getEnabled.invalidate();
    },
    onError: (error) => {
      toast.error("设置失败: " + error.message);
    },
  });

  // 测试连接
  const testConnectionMutation = trpc.llmProvider.testConnection.useMutation({
    onSuccess: (data, variables) => {
      setTestResults(prev => ({
        ...prev,
        [variables.provider]: {
          success: data.success,
          message: data.message,
          response: data.response,
        }
      }));
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      setTestingProvider(null);
    },
    onError: (error, variables) => {
      setTestResults(prev => ({
        ...prev,
        [variables.provider]: {
          success: false,
          message: error.message,
        }
      }));
      toast.error("测试失败: " + error.message);
      setTestingProvider(null);
    },
  });

  const handleSetDefault = (provider: string) => {
    setDefaultMutation.mutate({ provider: provider as 'qwen' | 'zhipu' | 'wenxin' });
  };

  const handleTestConnection = (provider: string) => {
    setTestingProvider(provider);
    // 清除之前的测试结果
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[provider];
      return newResults;
    });
    testConnectionMutation.mutate({ provider: provider as 'qwen' | 'zhipu' | 'wenxin' });
  };

  const handleAddConfig = () => {
    // 找到第一个未配置的提供商
    const configuredProviders = enabledConfigs?.map(c => c.provider) || [];
    const availableProvider = LLM_PROVIDERS.find(p => !configuredProviders.includes(p.id));
    
    if (availableProvider) {
      setEditingConfig({
        provider: availableProvider.id as 'qwen' | 'zhipu' | 'wenxin',
        providerName: availableProvider.name,
        defaultModel: availableProvider.defaultModel,
        apiKey: '',
        apiSecret: '',
        isDefault: !enabledConfigs || enabledConfigs.length === 0,
      });
    } else {
      setEditingConfig({
        provider: 'zhipu',
        providerName: '智谱AI',
        defaultModel: 'glm-4.7',
        apiKey: '',
        apiSecret: '',
        isDefault: false,
      });
    }
    setShowAddDialog(true);
    setShowApiKey(false);
    setShowApiSecret(false);
  };

  const handleEditConfig = (config: typeof enabledConfigs extends (infer T)[] | undefined ? T : never) => {
    const providerInfo = LLM_PROVIDERS.find(p => p.id === config.provider);
    setEditingConfig({
      provider: config.provider as 'qwen' | 'zhipu' | 'wenxin',
      providerName: config.providerName || providerInfo?.name || '',
      defaultModel: config.defaultModel || providerInfo?.defaultModel || '',
      apiKey: '', // 不显示已保存的API Key
      apiSecret: '',
      isDefault: defaultConfig?.provider === config.provider,
    });
    setShowAddDialog(true);
    setShowApiKey(false);
    setShowApiSecret(false);
  };

  const handleSaveConfig = () => {
    if (!editingConfig) return;
    
    if (!editingConfig.apiKey && !enabledConfigs?.find(c => c.provider === editingConfig.provider)) {
      toast.error("请输入API Key");
      return;
    }
    
    saveConfigMutation.mutate({
      provider: editingConfig.provider,
      providerName: editingConfig.providerName,
      defaultModel: editingConfig.defaultModel,
      apiKey: editingConfig.apiKey || undefined,
      apiSecret: editingConfig.apiSecret || undefined,
      isEnabled: true,
      isDefault: editingConfig.isDefault,
    });
  };

  const handleDeleteConfig = (provider: string) => {
    if (confirm(`确定要删除 ${LLM_PROVIDERS.find(p => p.id === provider)?.name || provider} 的配置吗？`)) {
      deleteConfigMutation.mutate({ provider: provider as 'qwen' | 'zhipu' | 'wenxin' });
    }
  };

  const handleProviderChange = (provider: 'qwen' | 'zhipu' | 'wenxin') => {
    const providerInfo = LLM_PROVIDERS.find(p => p.id === provider);
    if (providerInfo && editingConfig) {
      setEditingConfig({
        ...editingConfig,
        provider,
        providerName: providerInfo.name,
        defaultModel: providerInfo.defaultModel,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI大模型配置
            </CardTitle>
            <CardDescription>
              配置报告生成使用的AI大模型。点击"添加配置"按钮添加新的模型配置。
            </CardDescription>
          </div>
          <Button onClick={handleAddConfig} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            添加配置
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : enabledConfigs && enabledConfigs.length > 0 ? (
          <div className="space-y-3">
            {enabledConfigs.map((config) => {
              const providerInfo = llmProviders?.find(p => p.id === config.provider) || LLM_PROVIDERS.find(p => p.id === config.provider);
              const isDefault = defaultConfig?.provider === config.provider;
              return (
                <div key={config.provider} className="space-y-2">
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isDefault ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDefault ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {config.providerName}
                          {isDefault && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                              默认
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          当前模型: {config.defaultModel}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {providerInfo?.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        已配置
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditConfig(config)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(config.provider)}
                        disabled={testingProvider === config.provider}
                      >
                        {testingProvider === config.provider ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            测试连接
                          </>
                        )}
                      </Button>
                      {!isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(config.provider)}
                          disabled={setDefaultMutation.isPending}
                        >
                          {setDefaultMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Star className="h-4 w-4 mr-1" />
                              设为默认
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteConfig(config.provider)}
                        disabled={deleteConfigMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* 测试结果显示 */}
                  {testResults[config.provider] && (
                    <div className={`p-3 rounded-lg text-sm ${
                      testResults[config.provider].success 
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testResults[config.provider].success ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Info className="h-4 w-4" />
                        )}
                        <span>{testResults[config.provider].message}</span>
                      </div>
                      {testResults[config.provider].response && (
                        <div className="mt-2 text-xs opacity-80">
                          AI回复: {testResults[config.provider].response}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无已配置的AI模型</p>
            <p className="text-sm mt-2">点击上方"添加配置"按钮添加AI模型配置</p>
          </div>
        )}

        {/* 添加/编辑配置对话框 */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {editingConfig && enabledConfigs?.find(c => c.provider === editingConfig.provider) ? '编辑' : '添加'}AI模型配置
              </DialogTitle>
              <DialogDescription>
                配置AI大模型的API Key和默认模型
              </DialogDescription>
            </DialogHeader>
            {editingConfig && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>选择提供商</Label>
                  <Select
                    value={editingConfig.provider}
                    onValueChange={(value) => handleProviderChange(value as 'qwen' | 'zhipu' | 'wenxin')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择AI提供商" />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name} - {provider.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>默认模型</Label>
                  <Input
                    value={editingConfig.defaultModel}
                    onChange={(e) => setEditingConfig({ ...editingConfig, defaultModel: e.target.value })}
                    placeholder="例如: glm-4.7"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingConfig.provider === 'zhipu' && '智谱AI推荐模型: glm-4.7, glm-4-flash'}
                    {editingConfig.provider === 'wenxin' && '文心一言推荐模型: ernie-4.5-8k-preview, deepseek-v3'}
                    {editingConfig.provider === 'qwen' && '通义千问推荐模型: qwen-plus, qwen-turbo'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={editingConfig.apiKey}
                      onChange={(e) => setEditingConfig({ ...editingConfig, apiKey: e.target.value })}
                      placeholder={enabledConfigs?.find(c => c.provider === editingConfig.provider) ? "留空则保持原有配置" : "请输入API Key"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {editingConfig.provider === 'zhipu' && (
                      <>获取地址: <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">智谱AI开放平台</a></>
                    )}
                    {editingConfig.provider === 'wenxin' && (
                      <>获取地址: <a href="https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">百度千帆平台</a></>
                    )}
                    {editingConfig.provider === 'qwen' && (
                      <>获取地址: <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">阿里云DashScope</a></>
                    )}
                  </p>
                </div>
                
                {editingConfig.provider === 'wenxin' && (
                  <div className="space-y-2">
                    <Label>Secret Key（可选）</Label>
                    <div className="relative">
                      <Input
                        type={showApiSecret ? "text" : "password"}
                        value={editingConfig.apiSecret}
                        onChange={(e) => setEditingConfig({ ...editingConfig, apiSecret: e.target.value })}
                        placeholder="百度文心一言的Secret Key（新版API可不填）"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiSecret(!showApiSecret)}
                      >
                        {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDefault"
                    checked={editingConfig.isDefault}
                    onCheckedChange={(checked) => setEditingConfig({ ...editingConfig, isDefault: checked })}
                  />
                  <Label htmlFor="isDefault">设为默认模型</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveConfig} disabled={saveConfigMutation.isPending}>
                {saveConfigMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 配置说明 */}
        <div className="pt-4 border-t text-sm text-muted-foreground space-y-2">
          <p><strong>支持的提供商：</strong></p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li><strong>智谱AI (zhipu)</strong> - GLM-4系列，推荐GLM-4.7</li>
            <li><strong>百度文心一言 (wenxin)</strong> - ERNIE系列，支持DeepSeek-V3</li>
            <li><strong>通义千问 (qwen)</strong> - Qwen系列</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// 日志配置组件
function LogConfigSection() {
  const { data: logConfigs, isLoading } = trpc.system.getLogConfigs.useQuery();
  const utils = trpc.useUtils();

  const setAllLogConfigsMutation = trpc.system.setAllLogConfigs.useMutation({
    onSuccess: () => {
      toast.success("日志配置已保存");
      utils.system.getLogConfigs.invalidate();
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    },
  });

  const [localConfigs, setLocalConfigs] = useState({
    debugLogEnabled: false,
    logDbOperations: false,
    logQichachaApi: false,
    logLlmApi: false,
    logReportGeneration: false,
  });

  // 同步服务器配置到本地状态
  useEffect(() => {
    if (logConfigs) {
      setLocalConfigs(logConfigs);
    }
  }, [logConfigs]);

  const handleToggle = (key: keyof typeof localConfigs) => {
    const newConfigs = { ...localConfigs, [key]: !localConfigs[key] };
    setLocalConfigs(newConfigs);
    setAllLogConfigsMutation.mutate(newConfigs);
  };

  const logOptions = [
    {
      key: 'debugLogEnabled' as const,
      label: '调试日志总开关',
      description: '开启后才会输出下面各类日志',
      isMain: true,
    },
    {
      key: 'logDbOperations' as const,
      label: '数据库操作日志',
      description: '记录数据库插入、更新、查询等操作',
    },
    {
      key: 'logQichachaApi' as const,
      label: '企查查API调用日志',
      description: '记录企查查接口请求和响应',
    },
    {
      key: 'logLlmApi' as const,
      label: '大模型API调用日志',
      description: '记录智谱AI、文心一言等大模型调用',
    },
    {
      key: 'logReportGeneration' as const,
      label: '报告生成流程日志',
      description: '记录报告生成的各个步骤和结果',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          日志配置
        </CardTitle>
        <CardDescription>
          开启日志后，可以在服务器后台查看各个关键步骤的执行结果，便于问题排查。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {logOptions.map((option) => (
              <div
                key={option.key}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  option.isMain ? 'bg-muted/50' : ''
                } ${!localConfigs.debugLogEnabled && !option.isMain ? 'opacity-50' : ''}`}
              >
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {option.label}
                    {option.isMain && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">主开关</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
                <Switch
                  checked={localConfigs[option.key]}
                  onCheckedChange={() => handleToggle(option.key)}
                  disabled={!option.isMain && !localConfigs.debugLogEnabled}
                />
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t text-sm text-muted-foreground">
          <p>提示：开启日志后，可通过服务器控制台或日志文件查看详细信息。日志前缀说明：</p>
          <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
            <li><code>[DB]</code> - 数据库操作</li>
            <li><code>[QCC]</code> - 企查查API调用</li>
            <li><code>[LLM]</code> - 大模型API调用</li>
            <li><code>[Report]</code> - 报告生成流程</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const [activeSource, setActiveSource] = useState<"web" | "tianyancha" | "qichacha">("web");
  const [tianyanchaKey, setTianyanchaKey] = useState("");
  const [qichachaKey, setQichachaKey] = useState("");
  const [qichachaSecret, setQichachaSecret] = useState("");
  const [cacheDays, setCacheDays] = useState(30);
  const [warmupCompanies, setWarmupCompanies] = useState("");
  const [showWarmupInput, setShowWarmupInput] = useState(false);

  const utils = trpc.useUtils();

  const { data: configs, isLoading } = trpc.dataSource.list.useQuery();
  
  // 获取缓存统计信息
  const { data: cacheStats, isLoading: cacheStatsLoading } = trpc.qichachaCache.stats.useQuery();

  // 初始化缓存天数
  useEffect(() => {
    if (cacheStats?.cacheDays) {
      setCacheDays(cacheStats.cacheDays);
    }
  }, [cacheStats?.cacheDays]);

  // 从数据库初始化数据源配置
  useEffect(() => {
    if (configs && configs.length > 0) {
      // 查找当前启用的数据源
      const enabledConfig = configs.find(c => c.isEnabled);
      if (enabledConfig) {
        setActiveSource(enabledConfig.sourceType as "web" | "tianyancha" | "qichacha");
      }
      
      // 初始化API密钥
      const tianyanchaConfig = configs.find(c => c.sourceType === "tianyancha");
      const qichachaConfig = configs.find(c => c.sourceType === "qichacha");
      
      if (tianyanchaConfig?.apiKey) {
        setTianyanchaKey(tianyanchaConfig.apiKey);
      }
      if (qichachaConfig?.apiKey) {
        setQichachaKey(qichachaConfig.apiKey);
      }
      if (qichachaConfig?.apiSecret) {
        setQichachaSecret(qichachaConfig.apiSecret);
      }
    }
  }, [configs]);

  const updateMutation = trpc.dataSource.update.useMutation({
    onSuccess: () => {
      toast.success("配置已保存");
      utils.dataSource.list.invalidate();
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    },
  });

  const setActiveMutation = trpc.dataSource.setActive.useMutation({
    onSuccess: () => {
      toast.success("数据源已切换");
      utils.dataSource.list.invalidate();
    },
    onError: (error) => {
      toast.error("切换失败: " + error.message);
    },
  });

  // 设置缓存有效期
  const setCacheDaysMutation = trpc.qichachaCache.setCacheDays.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.qichachaCache.stats.invalidate();
    },
    onError: (error) => {
      toast.error("设置失败: " + error.message);
    },
  });

  // 清理过期缓存
  const cleanCacheMutation = trpc.qichachaCache.cleanExpired.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.qichachaCache.stats.invalidate();
    },
    onError: (error) => {
      toast.error("清理失败: " + error.message);
    },
  });

  // 导出缓存数据
  const exportCacheMutation = trpc.qichachaCache.export.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error("导出失败: " + error.message);
    },
  });

  // 缓存预热（自定义企业列表）
  const warmupMutation = trpc.cacheWarmup.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setWarmupCompanies("");
      setShowWarmupInput(false);
      utils.qichachaCache.stats.invalidate();
    },
    onError: (error) => {
      toast.error("预热失败: " + error.message);
    },
  });

  // 缓存预热（园区企业）
  const warmupFromParkMutation = trpc.cacheWarmup.createFromPark.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.qichachaCache.stats.invalidate();
    },
    onError: (error) => {
      toast.error("预热失败: " + error.message);
    },
  });

  // 处理预热提交
  const handleWarmupSubmit = () => {
    const companies = warmupCompanies
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (companies.length === 0) {
      toast.error("请输入至少一个企业名称");
      return;
    }
    
    if (companies.length > 500) {
      toast.error("每次最多预热500个企业");
      return;
    }
    
    warmupMutation.mutate({ companyNames: companies, skipExisting: true });
  };

  const handleSaveConfig = (sourceType: "tianyancha" | "qichacha") => {
    if (sourceType === "tianyancha") {
      updateMutation.mutate({
        sourceType: "tianyancha",
        apiKey: tianyanchaKey,
        isEnabled: activeSource === "tianyancha",
      });
    } else {
      updateMutation.mutate({
        sourceType: "qichacha",
        apiKey: qichachaKey,
        apiSecret: qichachaSecret,
        isEnabled: activeSource === "qichacha",
      });
    }
  };

  const handleSourceChange = (value: string) => {
    const source = value as "web" | "tianyancha" | "qichacha";
    setActiveSource(source);
    setActiveMutation.mutate({ sourceType: source });
  };

  const handleSaveCacheDays = () => {
    if (cacheDays < 1 || cacheDays > 365) {
      toast.error("缓存有效期必须在1-365天之间");
      return;
    }
    setCacheDaysMutation.mutate({ days: cacheDays });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                系统设置
              </h1>
              <p className="text-sm text-muted-foreground">配置数据获取方式和缓存策略</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-3xl">
        <div className="space-y-6">
          {/* 用户管理入口 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                用户管理
              </CardTitle>
              <CardDescription>
                管理系统用户、批量导入用户、设置额度和权限
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setLocation("/users")}>
                <Users className="h-4 w-4 mr-2" />
                进入用户管理
              </Button>
            </CardContent>
          </Card>

          {/* AI大模型配置 */}
          <LlmConfigSection />

          {/* 日志配置 */}
          <LogConfigSection />

          {/* 数据源选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">数据源配置</CardTitle>
              <CardDescription>
                选择获取公司信息的数据来源。默认使用网络公开信息，如需更准确的数据可配置天眼查或企查查API。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={activeSource}
                onValueChange={handleSourceChange}
                className="space-y-4"
              >
                {/* 网络公开信息 */}
                <div className="flex items-start space-x-4 p-4 rounded-lg border">
                  <RadioGroupItem value="web" id="web" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="web" className="flex items-center gap-2 cursor-pointer">
                      <Globe className="h-5 w-5 text-primary" />
                      <span className="font-medium">网络公开信息</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">默认</span>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      通过AI搜索整合网络公开信息，无需API密钥，适合一般性调研
                    </p>
                  </div>
                  {activeSource === "web" && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* 天眼查API */}
                <div className="flex items-start space-x-4 p-4 rounded-lg border">
                  <RadioGroupItem value="tianyancha" id="tianyancha" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="tianyancha" className="flex items-center gap-2 cursor-pointer">
                      <Database className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">天眼查API</span>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      使用天眼查官方API获取企业工商、融资、专利等详细数据
                    </p>
                    {activeSource === "tianyancha" && (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor="tianyancha-key">API Key</Label>
                          <Input
                            id="tianyancha-key"
                            type="password"
                            placeholder="请输入天眼查API Key"
                            value={tianyanchaKey}
                            onChange={(e) => setTianyanchaKey(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSaveConfig("tianyancha")}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          保存配置
                        </Button>
                      </div>
                    )}
                  </div>
                  {activeSource === "tianyancha" && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* 企查查API */}
                <div className="flex items-start space-x-4 p-4 rounded-lg border">
                  <RadioGroupItem value="qichacha" id="qichacha" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="qichacha" className="flex items-center gap-2 cursor-pointer">
                      <Database className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">企查查API</span>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      使用企查查官方API获取企业工商、融资、专利等详细数据
                    </p>
                    {activeSource === "qichacha" && (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor="qichacha-key">API Key</Label>
                          <Input
                            id="qichacha-key"
                            type="password"
                            placeholder="请输入企查查API Key"
                            value={qichachaKey}
                            onChange={(e) => setQichachaKey(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="qichacha-secret">API Secret</Label>
                          <Input
                            id="qichacha-secret"
                            type="password"
                            placeholder="请输入企查查API Secret"
                            value={qichachaSecret}
                            onChange={(e) => setQichachaSecret(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSaveConfig("qichacha")}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          保存配置
                        </Button>
                      </div>
                    )}
                  </div>
                  {activeSource === "qichacha" && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* 企查查API端点配置 */}
          <ApiEndpointConfig />

          {/* 企查查数据缓存设置 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                企查查数据缓存
              </CardTitle>
              <CardDescription>
                缓存企查查API返回的数据，在有效期内重复查询同一企业时直接读取缓存，节省API调用费用。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 缓存统计 */}
              {cacheStatsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : cacheStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-primary">{cacheStats.totalCount}</div>
                    <div className="text-xs text-muted-foreground">已缓存企业</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-green-600">{cacheStats.totalHits}</div>
                    <div className="text-xs text-muted-foreground">缓存命中次数</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-orange-500">¥{cacheStats.estimatedSavings}</div>
                    <div className="text-xs text-muted-foreground">预估节省费用</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{cacheStats.avgHitCount}</div>
                    <div className="text-xs text-muted-foreground">平均命中率</div>
                  </div>
                </div>
              ) : null}

              {/* 缓存有效期设置 */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  缓存有效期（天）
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={cacheDays}
                    onChange={(e) => setCacheDays(parseInt(e.target.value) || 30)}
                    className="w-32"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveCacheDays}
                    disabled={setCacheDaysMutation.isPending}
                  >
                    {setCacheDaysMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    保存
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  在有效期内查询同一企业将直接读取缓存数据，不调用API。建议设置为30天，平衡数据时效性和成本。
                </p>
              </div>

              {/* 缓存预热 */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      缓存预热
                    </div>
                    <p className="text-xs text-muted-foreground">
                      提前查询并缓存企业数据，避免首次查询时的等待
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowWarmupInput(!showWarmupInput)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      输入企业
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => warmupFromParkMutation.mutate({ skipExisting: true })}
                      disabled={warmupFromParkMutation.isPending}
                    >
                      {warmupFromParkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Building2 className="h-4 w-4 mr-2" />
                      )}
                      园区企业
                    </Button>
                  </div>
                </div>
                
                {showWarmupInput && (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <Textarea
                      placeholder="请输入企业名称，每行一个，最多500个：\n华为技术有限公司\n腾讯科技（深圳）有限公司\n..."
                      value={warmupCompanies}
                      onChange={(e) => setWarmupCompanies(e.target.value)}
                      rows={6}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        已输入 {warmupCompanies.split("\n").filter(s => s.trim()).length} 个企业
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowWarmupInput(false);
                            setWarmupCompanies("");
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleWarmupSubmit}
                          disabled={warmupMutation.isPending}
                        >
                          {warmupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          开始预热
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 导出缓存数据 */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <div className="font-medium text-sm">导出缓存数据</div>
                  <p className="text-xs text-muted-foreground">
                    将所有缓存的企业数据导出为Excel文件
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportCacheMutation.mutate()}
                  disabled={exportCacheMutation.isPending || !cacheStats?.totalCount}
                >
                  {exportCacheMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  导出Excel
                </Button>
              </div>

              {/* 清理缓存 */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <div className="font-medium text-sm">清理过期缓存</div>
                  <p className="text-xs text-muted-foreground">
                    删除超过有效期的缓存数据，释放数据库空间
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cleanCacheMutation.mutate()}
                  disabled={cleanCacheMutation.isPending}
                >
                  {cleanCacheMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  清理
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" />
                使用说明
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                <strong>网络公开信息：</strong>系统将通过AI能力搜索整合网络上的公开信息，包括公司官网、新闻报道、行业报告等。这种方式无需额外配置，但数据可能不够全面或实时。
              </p>
              <p>
                <strong>天眼查/企查查API：</strong>通过官方API获取企业工商注册信息、股东信息、融资历程、知识产权等结构化数据。需要在相应平台注册并获取API密钥。
              </p>
              <p>
                <strong>数据缓存：</strong>系统会自动缓存企查查API返回的完整数据。当您在缓存有效期内再次查询同一企业时，系统将直接使用缓存数据，无需重复调用API，可节省约4.35元/次的API费用。
              </p>
              <p>
                <strong>注意：</strong>API调用可能产生费用，请根据实际需求选择合适的数据源。合理设置缓存有效期可以有效降低成本。
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
