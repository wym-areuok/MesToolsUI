<template>
   <div class="app-container">
      <!-- 查询框部分 -->
      <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
         <el-form-item label="资料标题" prop="infoTitle">
            <el-input v-model="queryParams.infoTitle" placeholder="请输入资料标题" clearable style="width: 200px"
               @keyup.enter="handleQuery" />
         </el-form-item>
         <el-form-item label="标签" prop="infoTags">
            <el-select v-model="queryParams.infoTags" placeholder="资料标签" multiple collapse-tags collapse-tags-tooltip
               style="width: 220px">
               <el-option v-for="dict in info_tags" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
         </el-form-item>
         <el-form-item label="类型" prop="infoType">
            <el-select v-model="queryParams.infoType" placeholder="资料类型" clearable style="width: 140px">
               <el-option v-for="dict in info_type" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
         </el-form-item>
         <el-form-item label="状态" prop="status">
            <el-select v-model="queryParams.status" placeholder="资料状态" clearable style="width: 140px">
               <el-option v-for="dict in info_status" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
         </el-form-item>
         <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
         </el-form-item>
      </el-form>
      <!-- 按钮部分 -->
      <el-row :gutter="10" class="mb8">
         <el-col :span="1.5">
            <el-button type="primary" plain icon="Plus" @click="handleAdd"
               v-hasPermi="['dailyTools:queryInfo:add']">新增</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate"
               v-hasPermi="['dailyTools:queryInfo:edit']">修改</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete"
               v-hasPermi="['dailyTools:queryInfo:remove']">删除</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button type="info" plain icon="Upload" @click="handleImport"
               v-hasPermi="['dailyTools:queryInfo:import']">导入</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport"
               v-hasPermi="['dailyTools:queryInfo:export']">导出</el-button>
         </el-col>
         <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
      </el-row>
      <!-- 表格展示区 宽度设置自适应-->
      <el-table v-loading="loading" :data="infoList" height="calc(100vh - 310px)"
         @selection-change="handleSelectionChange">
         <el-table-column type="selection" width="50" align="center" />
         <el-table-column label="序号" align="center" width="80" fixed>
            <template #default="scope">
               <span>{{ (queryParams.pageNum - 1) * queryParams.pageSize + scope.$index + 1 }}</span>
            </template>
         </el-table-column>
         <el-table-column label="资料标题" align="center" prop="infoTitle" :show-overflow-tooltip="true" fixed />
         <el-table-column label="标签" align="center" :show-overflow-tooltip="true">
            <template #default="scope">
               <el-tag v-for="(tag, index) in displayedTags(scope.row.infoTags)" :key="index" type="info" size="small"
                  style="margin: 2px">
                  {{ getTagLabel(tag) }}
               </el-tag>
            </template>
         </el-table-column>
         <el-table-column label="类型" align="center" prop="infoType">
            <template #default="scope">
               <dict-tag :options="info_type" :value="scope.row.infoType" />
            </template>
         </el-table-column>
         <el-table-column label="状态" align="center" prop="status">
            <template #default="scope">
               <dict-tag :options="info_status" :value="scope.row.status" />
            </template>
         </el-table-column>
         <el-table-column label="搜索次数" align="center" prop="searchCount" sortable />
         <el-table-column label="创建者" align="center" prop="createBy" />
         <el-table-column label="创建时间" align="center" prop="createTime" sortable>
            <template #default="scope">
               <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
         </el-table-column>
         <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
            <template #default="scope">
               <el-button link type="primary" icon="View" @click="handleView(scope.row)"
                  v-hasPermi="['dailyTools:queryInfo:list']">查看</el-button>
               <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
                  v-hasPermi="['dailyTools:queryInfo:edit']">修改</el-button>
               <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
                  v-hasPermi="['dailyTools:queryInfo:remove']">删除</el-button>
            </template>
         </el-table-column>
      </el-table>
      <!-- 分页插件 -->
      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
         v-model:limit="queryParams.pageSize" @pagination="getList" />
      <!-- 资料编辑对话框 -->
      <el-dialog :title="title" v-model="open" width="820px" append-to-body>
         <el-form ref="infoRef" :model="form" :rules="rules" label-width="100px">
            <el-row :gutter="20">
               <el-col :span="12">
                  <el-form-item label="资料标题" prop="infoTitle">
                     <el-input v-model="form.infoTitle" placeholder="请输入资料标题" clearable />
                  </el-form-item>
               </el-col>
               <el-col :span="12">
                  <el-form-item label="资料类型" prop="infoType">
                     <el-select v-model="form.infoType" placeholder="请选择类型" clearable style="width: 100%">
                        <el-option v-for="dict in info_type" :key="dict.value" :label="dict.label"
                           :value="dict.value" />
                     </el-select>
                  </el-form-item>
               </el-col>
               <el-col :span="24">
                  <el-form-item label="信息标签" prop="infoTags">
                     <el-select v-model="form.infoTags" placeholder="请选择标签(可多选)" multiple filterable clearable
                        style="width: 100%">
                        <el-option v-for="dict in info_tags" :key="dict.value" :label="dict.label"
                           :value="dict.value" />
                     </el-select>
                  </el-form-item>
               </el-col>
               <el-col :span="12">
                  <el-form-item label="状态" prop="status">
                     <el-radio-group v-model="form.status">
                        <el-radio v-for="dict in info_status" :key="dict.value" :value="dict.value">{{ dict.label
                        }}</el-radio>
                     </el-radio-group>
                  </el-form-item>
               </el-col>
               <el-col :span="24">
                  <el-form-item label="资料内容" prop="infoContent">
                     <editor v-model="form.infoContent" :min-height="220" />
                  </el-form-item>
               </el-col>
            </el-row>
         </el-form>
         <template #footer>
            <div class="dialog-footer">
               <el-button type="primary" @click="submitForm" v-if="title !== '资料详情'">确 定</el-button>
               <el-button @click="cancel">取 消</el-button>
            </div>
         </template>
      </el-dialog>
      <!-- 导入资料对话框 -->
      <el-dialog :title="upload.title" v-model="upload.open" width="420px" append-to-body
         @close="handleUploadDialogClose">
         <el-upload ref="uploadRef" :limit="1" accept=".xlsx, .xls" :headers="upload.headers" :action="upload.url + '?updateSupport=' + (upload.updateSupport ? 'true' : 'false')
            " :disabled="upload.isUploading" :on-progress="handleFileUploadProgress" :on-success="handleFileSuccess"
            :on-change="handleFileChange" :on-remove="handleFileRemove" :auto-upload="false" drag>
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">将文件拖到此处,或<em>点击上传</em></div>
            <template #tip>
               <div class="el-upload__tip text-center">
                  <div class="el-upload__tip">
                     <el-checkbox v-model="upload.updateSupport" />是否更新已经存在的资料数据(使用标题字段区分)
                  </div>
                  <span>仅允许导入xls、xlsx格式文件。</span>
                  <el-link type="primary" :underline="false" style="font-size: 12px; vertical-align: baseline"
                     @click="importTemplate">下载模板</el-link>
               </div>
            </template>
         </el-upload>
         <template #footer>
            <div class="dialog-footer">
               <el-button type="primary" :loading="upload.isUploading" @click="submitUpload">确 定</el-button>
               <el-button @click="handleUploadDialogClose">取 消</el-button>
            </div>
         </template>
      </el-dialog>
   </div>
</template>

<script setup name="QueryInfo">
import { list, getInfo, deleteInfo, addInfo, updateInfo } from "@/api/dailyTools/queryInfo";
import { getToken } from "@/utils/auth";
import { useRoute } from "vue-router";

const { proxy } = getCurrentInstance();
const { info_status, info_type, info_tags } = proxy.useDict(
   "info_status",
   "info_type",
   "info_tags"
);

const route = useRoute();
const infoList = ref([]);
const open = ref(false);
const loading = ref(false);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");

// 常量定义
const DELETE_CONFIRM_MSG = (count) => `确认删除${count}条资料？`;
const baseApi = import.meta.env.VITE_APP_BASE_API || "";

const upload = reactive({
   open: false,
   title: "资料导入",
   isUploading: false,
   updateSupport: false,
   headers: { Authorization: "Bearer " + getToken() },
   url: `${baseApi}/dailytools/queryInfo/importData`,
   selectedFile: null,
});

const data = reactive({
   form: {
      infoTags: [],
   },
   queryParams: {
      pageNum: 1,
      pageSize: 15,
      infoTitle: undefined,
      infoTags: [],
      infoType: undefined,
      status: undefined,
   },
   rules: {
      infoTitle: [
         { required: true, message: "资料标题不能为空", trigger: "blur" },
      ],
      infoType: [
         { required: true, message: "资料类型不能为空", trigger: "change" },
      ],
      infoTags: [
         {
            required: true,
            message: "至少选择一个标签",
            trigger: "change",
            type: "array",
            min: 1,
         },
      ],
      infoContent: [
         { required: true, message: "资料内容不能为空", trigger: "blur" },
      ],
   },
});

const { queryParams, form, rules } = toRefs(data);

/** 获取标签显示名称 */
function getTagLabel(tagValue) {
   const tag = info_tags.value.find((item) => item.value === tagValue);
   return tag ? tag.label : tagValue;
}

/** 处理标签显示 限制最多显示3个标签 不然表格列显示太丑*/
function displayedTags(tagsStr) {
   if (!tagsStr) return [];
   const tags = tagsStr.split(",");
   // 如果标签少于等于3个 全部显示 否则显示前3个并在末尾添加省略号
   return tags.length <= 3 ? tags : [...tags.slice(0, 3), '...'];
}

/** 列表查询 */
async function getList() {
   loading.value = true;
   try {
      const params = {
         ...queryParams.value,
         infoTags: queryParams.value.infoTags.join(","),
      };
      const res = await list(params);
      infoList.value = res.rows;
      total.value = res.total;
      if (res.rows && res.rows.length > 0) {
         proxy.$message.success(`查询完成,共找到 ${res.rows.length} 条记录`);
      } else {
         proxy.$message.info('查询完成,未找到相关数据');
      }
   } catch (error) {
      console.error("获取资料列表失败:", error);
      proxy.$modal.msgError(error.message || "获取资料列表失败,请重试");
   } finally {
      loading.value = false;
   }
}

/** 查询处理 */
function handleQuery() {
   queryParams.value.pageNum = 1;
   getList();
}

/** 重置查询条件 */
function resetQuery() {
   proxy.resetForm("queryRef");
   queryParams.value.infoTags = [];
   handleQuery();
}

/** 处理表格选择 */
function handleSelectionChange(selection) {
   ids.value = selection.map((item) => item.infoId);
   single.value = selection.length !== 1;
   multiple.value = !selection.length;
}

/** 新增 */
function handleAdd() {
   reset();
   open.value = true;
   title.value = "新增资料";
}

/** 查看 */
async function handleView(row) {
   try {
      reset();
      const infoId = row.infoId;
      const res = await getInfo(infoId);
      form.value = {
         ...res.data,
         infoTags: res.data.infoTags ? res.data.infoTags.split(",") : [],
      };
      open.value = true;
      title.value = "资料详情";
   } catch (error) {
      console.error("获取资料详情失败:", error);
      proxy.$modal.msgError(error.message || "获取资料详情失败,请重试");
   }
}

/** 修改 */
async function handleUpdate(row) {
   try {
      reset();
      const infoId = row.infoId || ids.value[0];
      if (!infoId) {
         proxy.$modal.msgWarning("请选择要修改的资料");
         return;
      }
      const res = await getInfo(infoId);
      form.value = {
         ...res.data,
         infoTags: res.data.infoTags ? res.data.infoTags.split(",") : [],
      };
      open.value = true;
      title.value = "修改资料";
   } catch (error) {
      console.error("获取资料详情失败:", error);
      proxy.$modal.msgError(error.message || "获取资料详情失败,请重试");
   }
}

/** 提交表单 */
function submitForm() {
   proxy.$refs.infoRef.validate(async (valid) => {
      if (valid) {
         try {
            //数据赋值
            const formData = {
               ...form.value,
               infoTags: form.value.infoTags.join(","),
            };
            if (formData.infoId) {
               await updateInfo(formData);
               proxy.$modal.msgSuccess("修改成功");
            } else {
               await addInfo(formData);
               proxy.$modal.msgSuccess("新增成功");
            }
            open.value = false;
            getList();
         } catch (error) {
            console.error("提交失败:", error);
            proxy.$modal.msgError(error.message || "提交失败,请重试");
         }
      }
   });
}

/** 删除 只有管理员可以删除,按钮有权限控制 但是怕分配错误其他用户删除 后端已加校验 */
function handleDelete(row) {
   const infoIds = row.infoId || ids.value;
   if (!infoIds || infoIds.length === 0) {
      proxy.$modal.msgWarning("请选择要删除的资料");
      return;
   }
   proxy.$modal
      .confirm(DELETE_CONFIRM_MSG(infoIds.length))
      .then(async () => {
         try {
            // 兼容批量删除API
            if (Array.isArray(infoIds)) {
               await Promise.all(infoIds.map((id) => deleteInfo(id)));
            } else {
               await deleteInfo(infoIds);
            }
            proxy.$modal.msgSuccess("删除成功");
            getList();
         } catch (error) {
            console.error("删除失败:", error);
            proxy.$modal.msgError(error.message || "删除失败");
         }
      })
      .catch(() => { });
}

/** 导出 */
async function handleExport() {
   try {
      await proxy.$modal.confirm("确认导出所有资料信息?");
      const params = {
         ...queryParams.value,
         infoTags: queryParams.value.infoTags.join(","),
      };
      // 使用POST方式导出 没选择get是因为我要考虑多标签查询 get请求的参数长度有限制且不方便
      proxy.download(
         "dailytools/queryInfo/export",
         params,
         `资料信息_${new Date().getTime()}.xlsx`
      );
   } catch (error) {
      if (error !== "cancel") {
         console.error("资料导出失败:", error);
         proxy.$modal.msgError(error.message || "资料导出失败");
      }
   }
}

/** 导入 */
function handleImport() {
   upload.open = true;
}

/** 导入模板下载 */
function importTemplate() {
   proxy.download(
      "dailytools/queryInfo/importTemplate",
      {},
      `info_template_${new Date().getTime()}.xlsx`
   );
}

/** 上传文件进度监听 显示进度条 */
function handleFileUploadProgress(event, file, fileList) {
   upload.isUploading = true;
}

/** 上传文件成功监听 */
function handleFileSuccess(response, file, fileList) {
   upload.isUploading = false;
   upload.open = false;
   proxy.$refs.uploadRef.clearFiles();
   if (response.code === 200) {
      proxy.$modal.msgSuccess(response.msg);
      getList();
   } else {
      proxy.$modal.msgError(response.msg || "导入失败");
   }
}

/** 处理文件改变 */
function handleFileChange(file, fileList) {
   upload.selectedFile = file;
}

/** 文件移除 */
function handleFileRemove(file, fileList) {
   upload.selectedFile = null;
}

/** 关闭上传对话框 */
function handleUploadDialogClose() {
   // 关闭对话框时清空已选择的文件 主要是处理上传后不提交再关闭后打开显示旧文件
   upload.open = false;
   upload.selectedFile = null;
   if (proxy.$refs.uploadRef) {
      proxy.$refs.uploadRef.clearFiles();
   }
}

/** 提交上传文件 */
function submitUpload() {
   const file = upload.selectedFile;
   if (!file || !file.raw) {
      proxy.$modal.msgError("请选择要上传的文件。");
      return;
   }
   const fileName = file.name.toLowerCase();
   if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      proxy.$modal.msgError("请选择后缀为 'xlsx' 或 'xls' 的文件。");
      return;
   }
   proxy.$refs.uploadRef.submit();
}

/** 重置表单 */
function reset() {
   form.value = {
      infoId: undefined,
      infoTitle: "",
      infoTags: [],
      infoType: undefined,
      infoContent: "",
      status: "0",
   };
   if (proxy.$refs.infoRef) {
      proxy.resetForm("infoRef");
   }
}

/** 取消/关闭 */
function cancel() {
   open.value = false;
   reset();
}

/** 页面加载时执行 获取列表数据 */
onMounted(() => {
   // 接收路由参数中的 keyword 并自动搜索
   if (route.query.keyword) {
      queryParams.value.infoTitle = route.query.keyword;
   }
   getList();
});
</script>