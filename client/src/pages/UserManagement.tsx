import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Loader2,
  Search,
  RefreshCw,
  Trash2,
  Key,
  Edit,
  Upload,
  Download,
  Copy,
  Check,
  Coins,
  History,
  CheckCircle,
  XCircle,
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

export default function UserManagement() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [importPhones, setImportPhones] = useState("");
  const [importQuota, setImportQuota] = useState(50);
  const [importResults, setImportResults] = useState<Array<{ phone: string; password: string; success: boolean; error?: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    name: string;
    role: 'user' | 'admin';
    reportQuota: number;
    preferredLlm: 'qwen' | 'zhipu' | 'wenxin';
  } | null>(null);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [rechargeUserId, setRechargeUserId] = useState<number | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState(50);
  const [showLoginLogsDialog, setShowLoginLogsDialog] = useState(false);

  const utils = trpc.useUtils();

  // 检查是否是管理员
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast.error("仅管理员可访问此页面");
      setLocation("/");
    }
  }, [user, setLocation]);

  // 获取用户列表
  const { data: usersData, isLoading } = trpc.userManagement.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // 批量导入用户
  const batchImportMutation = trpc.userManagement.batchImport.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setImportResults(data.results);
      setShowImportDialog(false);
      setShowResultDialog(true);
      setImportPhones("");
      utils.userManagement.list.invalidate();
    },
    onError: (error) => {
      toast.error("导入失败: " + error.message);
    },
  });

  // 更新用户
  const updateUserMutation = trpc.userManagement.update.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowEditDialog(false);
      setEditingUser(null);
      utils.userManagement.list.invalidate();
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  // 重置密码
  const resetPasswordMutation = trpc.userManagement.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(`密码已重置为: ${data.newPassword}`);
      // 复制到剪贴板
      navigator.clipboard.writeText(data.newPassword);
      toast.info("新密码已复制到剪贴板");
    },
    onError: (error) => {
      toast.error("重置失败: " + error.message);
    },
  });

  // 删除用户
  const deleteUserMutation = trpc.userManagement.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.userManagement.list.invalidate();
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  // 额度充值
  const rechargeQuotaMutation = trpc.userManagement.rechargeQuota.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowRechargeDialog(false);
      setRechargeUserId(null);
      setRechargeAmount(50);
      utils.userManagement.list.invalidate();
    },
    onError: (error) => {
      toast.error("充值失败: " + error.message);
    },
  });

  // 获取登录日志
  const { data: loginLogsData, isLoading: loginLogsLoading, refetch: refetchLoginLogs } = trpc.userManagement.getLoginLogs.useQuery(
    { limit: 50 },
    { enabled: showLoginLogsDialog }
  );

  // 处理导入
  const handleImport = () => {
    const phones = importPhones
      .split(/[\n,，\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (phones.length === 0) {
      toast.error("请输入至少一个手机号");
      return;
    }

    if (phones.length > 500) {
      toast.error("每次最多导入500个用户");
      return;
    }

    batchImportMutation.mutate({
      phones,
      reportQuota: importQuota,
    });
  };

  // 处理编辑
  const handleEdit = (user: any) => {
    setEditingUser({
      id: user.id,
      name: user.name || "",
      role: user.role,
      reportQuota: user.reportQuota,
      preferredLlm: (user.preferredLlm || "zhipu") as 'qwen' | 'zhipu' | 'wenxin',
    });
    setShowEditDialog(true);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateUserMutation.mutate(editingUser);
  };

  // 重置密码
  const handleResetPassword = (userId: number) => {
    if (confirm("确定要重置该用户的密码吗？")) {
      resetPasswordMutation.mutate({ id: userId });
    }
  };

  // 删除用户
  const handleDelete = (userId: number) => {
    if (confirm("确定要删除该用户吗？此操作不可恢复。")) {
      deleteUserMutation.mutate({ id: userId });
    }
  };

  // 复制密码
  const handleCopyPassword = (password: string, index: number) => {
    navigator.clipboard.writeText(password);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // 处理额度充值
  const handleRecharge = (userId: number) => {
    setRechargeUserId(userId);
    setRechargeAmount(50);
    setShowRechargeDialog(true);
  };

  // 确认充值
  const handleConfirmRecharge = () => {
    if (!rechargeUserId || rechargeAmount <= 0) return;
    rechargeQuotaMutation.mutate({
      userId: rechargeUserId,
      amount: rechargeAmount,
    });
  };

  // 导出结果为CSV
  const handleExportResults = () => {
    const successResults = importResults.filter(r => r.success);
    if (successResults.length === 0) {
      toast.error("没有成功导入的用户");
      return;
    }

    const csv = "手机号,密码\n" + successResults.map(r => `${r.phone},${r.password}`).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `用户导入结果_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 过滤用户
  const filteredUsers = usersData?.users?.filter(u => {
    if (!searchKeyword) return true;
    return (
      u.phone?.includes(searchKeyword) ||
      u.name?.includes(searchKeyword)
    );
  }) || [];

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                用户管理
              </h1>
              <p className="text-sm text-muted-foreground">管理系统用户和权限</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          {/* 操作栏 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索手机号或姓名..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => utils.userManagement.list.invalidate()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setShowLoginLogsDialog(true)}>
                    <History className="h-4 w-4 mr-2" />
                    登录日志
                  </Button>
                  <Button onClick={() => setShowImportDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    批量导入用户
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 用户统计 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{usersData?.total || 0}</div>
                <p className="text-sm text-muted-foreground">总用户数</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {usersData?.users?.filter(u => u.role === 'admin').length || 0}
                </div>
                <p className="text-sm text-muted-foreground">管理员</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {usersData?.users?.filter(u => u.role === 'user').length || 0}
                </div>
                <p className="text-sm text-muted-foreground">普通用户</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {usersData?.users?.reduce((sum, u) => sum + (u.reportQuota - u.reportUsed), 0) || 0}
                </div>
                <p className="text-sm text-muted-foreground">剩余总额度</p>
              </CardContent>
            </Card>
          </div>

          {/* 用户列表 */}
          <Card>
            <CardHeader>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>
                共 {filteredUsers.length} 个用户
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无用户数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>手机号</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>角色</TableHead>
                        <TableHead>额度</TableHead>
                        <TableHead>默认模型</TableHead>
                        <TableHead>最后登录</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono">{u.phone || '-'}</TableCell>
                          <TableCell>{u.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role === 'admin' ? '管理员' : '用户'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={u.reportUsed >= u.reportQuota ? 'text-destructive' : ''}>
                              {u.reportUsed}/{u.reportQuota}
                            </span>
                          </TableCell>
                          <TableCell>
                            {u.preferredLlm === 'zhipu' && '智谱'}
                            {u.preferredLlm === 'qwen' && '通义'}
                            {u.preferredLlm === 'wenxin' && '文心'}
                            {!u.preferredLlm && '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {u.lastSignedIn
                              ? new Date(u.lastSignedIn).toLocaleString('zh-CN')
                              : '从未登录'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(u)}
                                title="编辑"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRecharge(u.id)}
                                title="充值额度"
                                className="text-green-600 hover:text-green-700"
                              >
                                <Coins className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResetPassword(u.id)}
                                title="重置密码"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(u.id)}
                                title="删除"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 批量导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量导入用户</DialogTitle>
            <DialogDescription>
              输入手机号码，每行一个或用逗号分隔。系统将自动生成6位随机密码。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>手机号列表</Label>
              <Textarea
                value={importPhones}
                onChange={(e) => setImportPhones(e.target.value)}
                placeholder="13800138000&#10;13900139000&#10;或用逗号分隔: 13800138000, 13900139000"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                支持换行、逗号、空格分隔，每次最多500个
              </p>
            </div>
            <div className="space-y-2">
              <Label>默认报告额度</Label>
              <Input
                type="number"
                value={importQuota}
                onChange={(e) => setImportQuota(parseInt(e.target.value) || 50)}
                min={1}
                max={9999}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={batchImportMutation.isPending}>
              {batchImportMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入结果对话框 */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>导入结果</DialogTitle>
            <DialogDescription>
              成功 {importResults.filter(r => r.success).length} 个，
              失败 {importResults.filter(r => !r.success).length} 个
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>手机号</TableHead>
                  <TableHead>密码</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importResults.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{r.phone}</TableCell>
                    <TableCell>
                      {r.success ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{r.password}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyPassword(r.password, i)}
                          >
                            {copiedIndex === i ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {r.success ? (
                        <Badge variant="default">成功</Badge>
                      ) : (
                        <Badge variant="destructive">{r.error || '失败'}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleExportResults}>
              <Download className="h-4 w-4 mr-2" />
              导出CSV
            </Button>
            <Button onClick={() => setShowResultDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="用户姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(v) => setEditingUser({ ...editingUser, role: v as 'user' | 'admin' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>报告额度</Label>
                <Input
                  type="number"
                  value={editingUser.reportQuota}
                  onChange={(e) => setEditingUser({ ...editingUser, reportQuota: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={9999}
                />
              </div>
              <div className="space-y-2">
                <Label>默认大模型</Label>
                <Select
                  value={editingUser.preferredLlm}
                  onValueChange={(v) => setEditingUser({ ...editingUser, preferredLlm: v as 'qwen' | 'zhipu' | 'wenxin' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zhipu">智谱AI</SelectItem>
                    <SelectItem value="qwen">通义千问</SelectItem>
                    <SelectItem value="wenxin">文心一言</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 额度充值对话框 */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>额度充值</DialogTitle>
            <DialogDescription>
              为用户增加报告生成额度
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>充值数量</Label>
              <Input
                type="number"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(parseInt(e.target.value) || 0)}
                min={1}
                max={9999}
                placeholder="请输入充值数量"
              />
              <p className="text-xs text-muted-foreground">
                充值后用户的报告额度将增加相应数量
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRechargeDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={handleConfirmRecharge} 
              disabled={rechargeQuotaMutation.isPending || rechargeAmount <= 0}
            >
              {rechargeQuotaMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              确认充值
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 登录日志对话框 */}
      <Dialog open={showLoginLogsDialog} onOpenChange={setShowLoginLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              登录日志
            </DialogTitle>
            <DialogDescription>
              最近50条登录记录
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loginLogsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : loginLogsData && loginLogsData.logs && loginLogsData.logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>状态</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>登录时间</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead className="hidden lg:table-cell">失败原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginLogsData.logs.map((log: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            成功
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            失败
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{log.phone || '-'}</TableCell>
                      <TableCell>{log.userName || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(log.loginTime).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.ipAddress || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {log.failReason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">暂无登录记录</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
