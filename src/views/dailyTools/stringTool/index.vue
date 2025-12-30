<template>
  <div class="app-container">
    <el-row>
      <el-col :span="16">
        <el-form ref="formRef" :model="formData">
          <!-- 左右输入框 -->
          <el-row>
            <el-col :span="11" :offset="1">
              <el-form-item>
                <el-input ref="inputRef" v-model="formData.input" type="textarea" placeholder="请输入待处理的字符串:" :rows="25"
                  @input="handleInput"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="11" :offset="1">
              <el-form-item>
                <el-input ref="outputRef" v-model="formData.output" type="textarea" placeholder="处理后:" readonly
                  :rows="25"></el-input>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 紧凑型统计信息 -->
          <el-row class="compact-stats">
            <el-col :span="2" :offset="1">
              <div class="stat-item">
                <div class="stat-label">输入行数</div>
                <div class="stat-value">{{ stats.inputLines }}</div>
              </div>
            </el-col>
            <el-col :span="2">
              <div class="stat-item">
                <div class="stat-label">非空行数</div>
                <div class="stat-value">{{ stats.nonEmptyLines }}</div>
              </div>
            </el-col>
            <el-col :span="2">
              <div class="stat-item">
                <div class="stat-label">空行数</div>
                <div class="stat-value">{{ stats.emptyLines }}</div>
              </div>
            </el-col>
            <el-col :span="2">
              <div class="stat-item">
                <div class="stat-label">字符数</div>
                <div class="stat-value">{{ stats.charCount }}</div>
              </div>
            </el-col>
            <el-col :span="2">
              <div class="stat-item">
                <div class="stat-label">处理时间</div>
                <div class="stat-value">{{ stats.processingTime }}</div>
              </div>
            </el-col>
            <el-col :span="2" :offset="1">
              <div class="mode-indicator">
                <el-tag size="default" :type="stats.mode === 'frontend' ? 'success' : 'warning'">
                  {{ stats.mode === "frontend" ? "前端处理" : "后端处理" }}
                </el-tag>
              </div>
            </el-col>

            <!-- 功能按钮 -->
            <el-col :span="8" :offset="2">
              <el-form-item class="mode-indicator">
                <el-button type="primary" icon="Promotion" @click="submitForm" :loading="processing"
                  :disabled="stats.inputLines === 0" v-hasPermi="['dailyTools:stringTool:execute']">提交</el-button>
                <el-button :disabled="!formData.output || processing" @click="copy" icon="CopyDocument">复制</el-button>
                <el-button @click="resetForm" icon="Refresh">重置</el-button>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-col>
      <el-col :span="6" :offset="1">
        <el-row>
          <el-button type="success" plain icon="Download" @click="downloadTemplate"
            v-hasPermi="['dailyTools:stringTool:download']">
            下载模板
          </el-button>
          <el-button type="primary" icon="Upload" @click="handleImport" v-hasPermi="['dailyTools:stringTool:upload']">
            上传文件
          </el-button>
        </el-row>
      </el-col>
    </el-row>

    <!-- 文件上传部分弹窗 -->
    <el-dialog :title="upload.title" v-model="upload.open" width="400px" append-to-body
      @close="handleUploadDialogClose">
      <el-upload ref="uploadRef" :limit="1" accept=".xlsx, .xls" :headers="upload.headers" :action="upload.url"
        :disabled="upload.isUploading" :on-progress="handleFileUploadProgress" :on-success="handleFileSuccess"
        :on-error="handleFileError" :on-change="handleFileChange" :on-remove="handleFileRemove" :auto-upload="false"
        drag>
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip text-center">
            <span>仅允许导入xls、xlsx格式文件。</span>
            <el-link type="primary" :underline="false" style="font-size: 12px; vertical-align: baseline"
              @click="downloadTemplate">下载模板</el-link>
          </div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitFileForm" :loading="upload.isUploading"
            v-hasPermi="['dailyTools:stringTool:execute']">确 定</el-button>
          <el-button @click="upload.open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="StringTool">
import { execute } from "@/api/dailyTools/stringTool";
import { ref, reactive, getCurrentInstance, nextTick, onMounted } from "vue";
import { getToken } from "@/utils/auth";

const { proxy } = getCurrentInstance();
const inputRef = ref();
const outputRef = ref();
const processing = ref(false);
const uploadRef = ref(); // 添加uploadRef引用

/** 上传文件相关变量 */
const title = ref("");
const upload = reactive({
  // 是否显示弹出层
  open: false,
  title: "",
  // 是否禁用上传
  isUploading: false,
  // 设置上传的请求头部
  headers: { Authorization: "Bearer " + getToken() },
  url: import.meta.env.VITE_APP_BASE_API + "/dailytools/stringtool/upload",
  selectedFile: null,
});

/** 响应式对象转换为普通对象减少性能开销 */
const formData = reactive({
  input: "",
  output: "",
});
const stats = reactive({
  inputLines: 0,
  nonEmptyLines: 0,
  emptyLines: 0,
  processingTime: "0ms",
  mode: "frontend",
  charCount: 0,
});

/** 使用requestAnimationFrame进行节流处理 */
let inputTimer = null;
const handleInput = () => {
  if (inputTimer) cancelAnimationFrame(inputTimer);
  // 直接使用简化的统计算法
  inputTimer = requestAnimationFrame(() => {
    calculateStats();
  });
};

/** 优化后的统计计算方法 */
function calculateStats() {
  const text = formData.input;
  if (!text) {
    stats.inputLines = 0;
    stats.nonEmptyLines = 0;
    stats.emptyLines = 0;
    stats.charCount = 0;
    return;
  }
  // 更新字符计数
  stats.charCount = text.length;
  // 处理大文本时的分块计算
  const processChunk = (start, end) => {
    let localLineCount = 0;
    let localNonEmptyLines = 0;
    let lastNewline = start === 0 ? -1 : start - 1;
    for (let i = start; i < end; i++) {
      if (text[i] === "\n") {
        // 计算行内容是否为空
        const line = text.slice(lastNewline + 1, i);
        if (line.trim()) {
          localNonEmptyLines++;
        }
        localLineCount++;
        lastNewline = i;
      }
    }
    return { localLineCount, localNonEmptyLines, lastNewline };
  };
  // 每10万字符为一组
  const CHUNK_SIZE = 100000;
  let accumulatedLines = 0;
  let accumulatedNonEmpty = 0;
  let index = 0;
  while (index < text.length) {
    const end = Math.min(index + CHUNK_SIZE, text.length);
    const result = processChunk(index, end);
    accumulatedLines += result.localLineCount;
    accumulatedNonEmpty += result.localNonEmptyLines;
    index = end;
    // 大文本时分批释放主线程
    if (text.length > 100000) {
      // 保持UI响应
      requestAnimationFrame(() => { });
    }
  }
  // 处理最后一行（如果没有换行符结尾）
  if (index > 0 && text.length > 0 && text[text.length - 1] !== "\n") {
    accumulatedLines++;
    const lastLine = text.slice(
      Math.max(0, text.lastIndexOf("\n") + 1),
      text.length
    );
    if (lastLine.trim()) {
      accumulatedNonEmpty++;
    }
  }
  // 更新统计信息
  stats.inputLines = accumulatedLines;
  stats.nonEmptyLines = accumulatedNonEmpty;
  stats.emptyLines = accumulatedLines - accumulatedNonEmpty;
}

/** 高性能处理函数 (避免阻塞主线程) */
function processInput() {
  const startTime = performance.now();
  if (!formData.input) {
    return {
      result: "()",
      processingTime: "0ms",
    };
  }
  const chunks = [];
  let position = 0;
  let inQuote = false;
  let hasContentInLine = false;
  // 分块处理避免阻塞
  function processChunk(endPos) {
    for (; position < endPos; position++) {
      const char = formData.input[position];
      switch (char) {
        case "\n":
          // 行结束处理
          if (inQuote) {
            chunks.push(`',`);
            inQuote = false;
          } else if (hasContentInLine) {
            chunks.push(",");
          }
          hasContentInLine = false;
          break;
        case " ":
        case "\t":
        case "\r":
          // 跳过空白字符
          break;
        default:
          if (!inQuote) {
            chunks.push("'");
            inQuote = true;
          }
          chunks.push(char);
          hasContentInLine = true;
      }
    }
  }
  // 分批处理 (10000字符/批)
  const CHUNK_SIZE = 10000;
  while (position < formData.input.length) {
    processChunk(Math.min(position + CHUNK_SIZE, formData.input.length));
    // 每批处理完后让出主线程
    if (position < formData.input.length) {
      yieldToUI();
    }
  }
  // 最后一行处理
  if (inQuote) chunks.push("'");
  // 优化结果处理 (避免操作大字符串)
  let result = `(${chunks.join("").replace(/,\s*$/, "")})`;
  const endTime = performance.now();
  return {
    result,
    processingTime: `${(endTime - startTime).toFixed(2)}ms`,
  };
}

/** 异步函数 (避免阻塞主线程) */
function yieldToUI() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 优化大文本赋值 (分块设置避免浏览器卡死) */
async function setOutputValue(value) {
  formData.output = "";
  await nextTick();
  const CHUNK_SIZE = 50000;
  let position = 0;
  while (position < value.length) {
    const chunk = value.substring(position, position + CHUNK_SIZE);
    formData.output += chunk;
    position += CHUNK_SIZE;
    // 大文本分批更新避免卡顿
    if (position < value.length) {
      await yieldToUI();
    }
  }
}

/** 提交表单 */
async function submitForm() {
  if (stats.inputLines === 0 || processing.value) return;
  try {
    processing.value = true;
    stats.processingTime = "处理中...";
    await nextTick();
    stats.mode = stats.inputLines > 10000 ? "backend" : "frontend";
    // 显示更详细的处理状态
    if (stats.mode === "frontend") {
      proxy.$message.info(`正在前端处理 ${stats.inputLines} 行数据，请稍候...`);
    } else {
      proxy.$message.info(`正在后端处理 ${stats.inputLines} 行数据，请稍候...`);
    }
    try {
      if (stats.mode === "frontend") {
        // 前端处理使用分块算法
        const result = processInput();
        stats.processingTime = result.processingTime;
        await setOutputValue(result.result);
      } else {
        // 后端处理优化：显示进度提示
        const startTime = performance.now();
        const response = await execute({ input: formData.input });
        if (response.code === 200) {
          const endTime = performance.now();
          stats.processingTime = `${(endTime - startTime).toFixed(2)}ms`;
          await setOutputValue(response.data);
        } else {
          throw new Error(response.msg || "后端处理失败");
        }
      }
      proxy.$message.success(
        `处理完成 (${stats.nonEmptyLines}行，耗时${stats.processingTime})`
      );
    } catch (error) {
      console.error('字符串处理失败:', error);
    }
  } finally {
    processing.value = false;
  }
}

/** 优化复制性能 */
function copy() {
  if (!formData.output) return;
  try {
    // 优先使用现代API
    navigator.clipboard.writeText(formData.output);
    proxy.$message.success("复制成功");
  } catch (error) {
    // 降级方案
    outputRef.value.select();
    document.execCommand("copy");
    proxy.$message.success("复制成功");
  }
}

/** 重置表单 */
function resetForm() {
  formData.input = "";
  formData.output = "";
  stats.inputLines = 0;
  stats.nonEmptyLines = 0;
  stats.emptyLines = 0;
  stats.processingTime = "0ms";
  stats.charCount = 0;
}

/** 初始性能优化 */
onMounted(() => {
  // 禁用自动完成减少内存开销
  inputRef.value?.textarea?.setAttribute("autocomplete", "off");
  outputRef.value?.textarea?.setAttribute("autocomplete", "off");
  // 禁用拼写检查
  inputRef.value?.textarea?.setAttribute("spellcheck", "false");
  outputRef.value?.textarea?.setAttribute("spellcheck", "false");
});

/** 下载模板 */
function downloadTemplate() {
  proxy.download(
    "dailytools/stringtool/downloadTemplate",
    {},
    `data_template_${new Date().getTime()}.xlsx`
  );
}

/** 上传按钮操作 */
function handleImport() {
  upload.title = "上传待处理文件";
  upload.open = true;
  upload.selectedFile = null;
}

/** 处理上传对话框关闭事件 */
function handleUploadDialogClose() {
  // 清空已选择的文件
  if (uploadRef.value) {
    uploadRef.value.clearFiles();
  }
  upload.selectedFile = null;
}

/** 文件上传中处理 */
const handleFileUploadProgress = (event, file, fileList) => {
  upload.isUploading = true;
};

/** 文件选择处理 */
const handleFileChange = (file, fileList) => {
  upload.selectedFile = file;
};

/** 文件删除处理 */
const handleFileRemove = (file, fileList) => {
  upload.selectedFile = null;
};

/** 文件上传成功处理 */
const handleFileSuccess = (response, file, fileList) => {
  upload.isUploading = false;
  if (response.code === 200) {
    upload.open = false;
    if (response.data) {
      formData.output = response.data;
      proxy.$modal.msgSuccess("文件处理成功");
    } else {
      proxy.$modal.msgSuccess("文件上传成功，正在后台处理");
    }
  } else {
    upload.open = false;
    proxy.$modal.msgError(response.msg || "文件上传失败");
  }
};

/** 文件上传失败处理 */
const handleFileError = (error) => {
  upload.isUploading = false;
  upload.open = false;
  console.error("文件上传失败:", error);
};

/** 提交上传文件 */
function submitFileForm() {
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
  upload.isUploading = true;
  // 使用uploadRef而不是proxy.$refs
  uploadRef.value.submit();
}
</script>

<style scoped>
.compact-stats {
  margin: 2px 0 2px;
  padding: 5px 0;
  border-top: 1px dashed #e4e7ed;
  border-bottom: 1px dashed #e4e7ed;
}

.stat-item {
  text-align: center;
  padding: 5px 0;
}

.stat-label {
  font-size: 10px;
  color: #909399;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 15px;
  font-weight: bold;
  color: #409eff;
  font-family: monospace;
}

.mode-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>