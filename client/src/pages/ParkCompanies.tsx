import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Upload,
  Plus,
  Search,
  Trash2,
  Edit,
  Loader2,
  FileSpreadsheet,
  Download,
} from "lucide-react";

export default function ParkCompanies() {
  const [, setLocation] = useLocation();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.parkCompany.list.useQuery({ limit: 100, offset: 0 });
  const searchQuery = trpc.parkCompany.search.useQuery(
    { keyword: searchKeyword },
    { enabled: searchKeyword.length > 0 }
  );

  const createMutation = trpc.parkCompany.create.useMutation({
    onSuccess: () => {
      toast.success("企业添加成功");
      setIsAddDialogOpen(false);
      utils.parkCompany.list.invalidate();
    },
    onError: (error) => {
      toast.error("添加失败: " + error.message);
    },
  });

  const updateMutation = trpc.parkCompany.update.useMutation({
    onSuccess: () => {
      toast.success("企业信息更新成功");
      setEditingCompany(null);
      utils.parkCompany.list.invalidate();
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteMutation = trpc.parkCompany.delete.useMutation({
    onSuccess: () => {
      toast.success("企业删除成功");
      utils.parkCompany.list.invalidate();
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const importMutation = trpc.parkCompany.importFromXls.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || `成功导入 ${data.count} 家企业`);
      utils.parkCompany.list.invalidate();
    },
    onError: (error) => {
      toast.error("导入失败: " + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(",")[1];
      importMutation.mutate({ fileContent: base64 });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddCompany = (formData: FormData) => {
    const data = {
      companyName: formData.get("companyName") as string,
      industry: formData.get("industry") as string || undefined,
      businessScope: formData.get("businessScope") as string || undefined,
      registeredCapital: formData.get("registeredCapital") as string || undefined,
      contactPerson: formData.get("contactPerson") as string || undefined,
      contactPhone: formData.get("contactPhone") as string || undefined,
      officeArea: formData.get("officeArea") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    };
    createMutation.mutate(data);
  };

  const handleUpdateCompany = (formData: FormData) => {
    if (!editingCompany) return;
    const data = {
      id: editingCompany.id,
      companyName: formData.get("companyName") as string,
      industry: formData.get("industry") as string || undefined,
      businessScope: formData.get("businessScope") as string || undefined,
      registeredCapital: formData.get("registeredCapital") as string || undefined,
      contactPerson: formData.get("contactPerson") as string || undefined,
      contactPhone: formData.get("contactPhone") as string || undefined,
      officeArea: formData.get("officeArea") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    };
    updateMutation.mutate(data);
  };

  const displayCompanies = searchKeyword ? searchQuery.data : data?.companies;

  const downloadTemplate = () => {
    // 企查查导出格式的模板（14列）
    const headers = [
      "原文件导入名称",
      "登记状态",
      "统一社会信用代码",
      "法定代表人",
      "企业规模",
      "注册资本",
      "电话",
      "更多电话",
      "成立日期",
      "实缴资本",
      "所属省份",
      "所属城市",
      "所属区县",
      "企业地址"
    ];
    const exampleRow = [
      "深圳示例科技有限公司",
      "存续",
      "91440300XXXXXXXXXX",
      "张三",
      "S(小型)",
      "1000万元",
      "0755-12345678",
      "13800138000;13900139000",
      "2020-01-01",
      "500万元",
      "广东省",
      "深圳市",
      "南山区",
      "深圳市南山区科技园路1号"
    ];
    const csvContent = headers.join(",") + "\n" + exampleRow.join(",");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "园区企业导入模板(企查查格式).csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                园区企业管理
              </h1>
              <p className="text-sm text-muted-foreground">
                共 {data?.total || 0} 家企业
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              下载模板
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  导入Excel
                </>
              )}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  添加企业
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={(e) => { e.preventDefault(); handleAddCompany(new FormData(e.currentTarget)); }}>
                  <DialogHeader>
                    <DialogTitle>添加园区企业</DialogTitle>
                    <DialogDescription>填写企业基本信息</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="companyName">公司名称 *</Label>
                      <Input id="companyName" name="companyName" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="industry">行业</Label>
                        <Input id="industry" name="industry" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="registeredCapital">注册资本</Label>
                        <Input id="registeredCapital" name="registeredCapital" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="businessScope">经营范围</Label>
                      <Textarea id="businessScope" name="businessScope" rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="contactPerson">联系人</Label>
                        <Input id="contactPerson" name="contactPerson" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="contactPhone">联系电话</Label>
                        <Input id="contactPhone" name="contactPhone" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="officeArea">办公面积</Label>
                      <Input id="officeArea" name="officeArea" placeholder="如：500平米" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">备注</Label>
                      <Textarea id="notes" name="notes" rows={2} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      取消
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      添加
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索企业名称..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : displayCompanies && displayCompanies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>行业</TableHead>
                    <TableHead>注册资本</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>联系电话</TableHead>
                    <TableHead>办公面积</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.companyName}</TableCell>
                      <TableCell>{company.industry || "-"}</TableCell>
                      <TableCell>{company.registeredCapital || "-"}</TableCell>
                      <TableCell>{company.contactPerson || "-"}</TableCell>
                      <TableCell>{company.contactPhone || "-"}</TableCell>
                      <TableCell>{company.officeArea || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingCompany(company)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("确定要删除这家企业吗？")) {
                                deleteMutation.mutate({ id: company.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无园区企业数据</p>
                <p className="text-sm text-muted-foreground mt-2">
                  点击"导入Excel"批量导入，或"添加企业"手动添加
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
          <DialogContent>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateCompany(new FormData(e.currentTarget)); }}>
              <DialogHeader>
                <DialogTitle>编辑企业信息</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-companyName">公司名称 *</Label>
                  <Input
                    id="edit-companyName"
                    name="companyName"
                    defaultValue={editingCompany?.companyName}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-industry">行业</Label>
                    <Input
                      id="edit-industry"
                      name="industry"
                      defaultValue={editingCompany?.industry}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-registeredCapital">注册资本</Label>
                    <Input
                      id="edit-registeredCapital"
                      name="registeredCapital"
                      defaultValue={editingCompany?.registeredCapital}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-businessScope">经营范围</Label>
                  <Textarea
                    id="edit-businessScope"
                    name="businessScope"
                    defaultValue={editingCompany?.businessScope}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-contactPerson">联系人</Label>
                    <Input
                      id="edit-contactPerson"
                      name="contactPerson"
                      defaultValue={editingCompany?.contactPerson}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-contactPhone">联系电话</Label>
                    <Input
                      id="edit-contactPhone"
                      name="contactPhone"
                      defaultValue={editingCompany?.contactPhone}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-officeArea">办公面积</Label>
                  <Input
                    id="edit-officeArea"
                    name="officeArea"
                    defaultValue={editingCompany?.officeArea}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-notes">备注</Label>
                  <Textarea
                    id="edit-notes"
                    name="notes"
                    defaultValue={editingCompany?.notes}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCompany(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
