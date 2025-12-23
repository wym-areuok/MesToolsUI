<template>
  <div class="app-container api-manager-container">
    <!-- 左侧侧边栏：接口树 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <span>接口列表</span>
        <el-button type="primary" link icon="Plus" size="small" @click="handleCreate">新建</el-button>
      </div>
      <div class="sidebar-search">
        <el-input v-model="filterText" placeholder="搜索接口 / URL..." prefix-icon="Search" clearable />
      </div>
      <div class="api-tree-wrapper">
        <el-tree ref="treeRef" :data="apiTreeData" :props="defaultProps" :expand-on-click-node="false"
          :filter-node-method="filterNode" node-key="id" default-expand-all highlight-current
          @node-click="handleNodeClick">
          <template #default="{ node, data }">
            <span class="custom-tree-node">
              <span v-if="data.method" :class="['method-tag', `method-${data.method}`]">{{ data.method }}</span>
              <span v-else class="folder-icon"><el-icon>
                  <Folder />
                </el-icon></span>
              <span class="node-label" :title="data.label">{{ node.label }}</span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <!-- 右侧主内容区 -->
    <div class="main-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar">
        <el-row :gutter="10" align="middle">
          <!-- 环境选择 -->
          <el-col :span="3">
            <el-select v-model="currentEnv" placeholder="选择环境" style="width: 100%" clearable>
              <el-option label="未设定 (自定义)" value="" />
              <el-option label="测试环境" value="test" />
              <el-option label="开发环境" value="dev" />
              <el-option label="正式环境" value="prod" />
            </el-select>
          </el-col>

          <!-- URL 输入区 -->
          <el-col :span="13">
            <el-input v-model="requestForm.url" :placeholder="urlPlaceholder">
              <template #prepend>
                <el-select v-model="requestForm.method" style="width: 100px">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="DELETE" value="DELETE" />
                </el-select>
              </template>
            </el-input>
          </el-col>

          <!-- 操作按钮 -->
          <el-col :span="8">
            <el-button type="primary" icon="Promotion" @click="handleSend" :loading="loading">发送</el-button>
            <el-button type="success" plain icon="FolderChecked" @click="handleSave">保存</el-button>
            <el-button type="info" plain icon="Download" @click="handleCurlImport">CURL导入</el-button>
            <el-dropdown style="margin-left: 12px">
              <el-button type="primary" plain>
                更多操作<el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="handleGenerateCode" icon="Tickets">生成代码</el-dropdown-item>
                  <el-dropdown-item @click="handleExportDoc" icon="Document">导出文档</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-col>
        </el-row>
      </div>

      <!-- 核心工作区 -->
      <div class="workspace">
        <el-row style="height: 100%; width: 100%; margin: 0">
          <!-- 左侧：请求配置 -->
          <el-col :span="14" style="height: 100%">
            <div class="request-panel">
              <el-tabs v-model="activeReqTab" class="custom-tabs">
                <el-tab-pane label="Params" name="params">
                  <div class="panel-content">
                    <div class="section-desc">Query Params (URL 参数)</div>
                    <el-table :data="requestForm.params" style="width: 100%" size="small" border>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-checkbox v-model="scope.row.active" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Key" width="200">
                        <template #default="scope">
                          <el-input v-model="scope.row.key" placeholder="Key" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Value" width="200">
                        <template #default="scope">
                          <el-input v-model="scope.row.value" placeholder="Value" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Description">
                        <template #default="scope">
                          <el-input v-model="scope.row.desc" placeholder="描述" />
                        </template>
                      </el-table-column>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-button link type="danger" icon="Delete"
                            @click="removeRow(requestForm.params, scope.$index)" />
                        </template>
                      </el-table-column>
                    </el-table>
                    <el-button link type="primary" icon="Plus" @click="addRow(requestForm.params)">添加参数</el-button>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="Headers" name="headers">
                  <div class="panel-content">
                    <div class="section-desc">Request Headers</div>
                    <el-table :data="requestForm.headers" style="width: 100%" size="small" border>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-checkbox v-model="scope.row.active" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Key" width="200">
                        <template #default="scope">
                          <el-autocomplete v-model="scope.row.key" :fetch-suggestions="queryHeaderSearch"
                            placeholder="Key" style="width: 100%" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Value" width="200">
                        <template #default="scope">
                          <el-input v-model="scope.row.value" placeholder="Value" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Description">
                        <template #default="scope">
                          <el-input v-model="scope.row.desc" placeholder="描述" />
                        </template>
                      </el-table-column>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-button link type="danger" icon="Delete"
                            @click="removeRow(requestForm.headers, scope.$index)" />
                        </template>
                      </el-table-column>
                    </el-table>
                    <el-button link type="primary" icon="Plus" @click="addRow(requestForm.headers)">添加
                      Header</el-button>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="Body" name="body">
                  <div class="panel-content body-content">
                    <div class="body-toolbar">
                      <el-radio-group v-model="requestForm.bodyType" size="small">
                        <el-radio-button label="none">none</el-radio-button>
                        <el-radio-button label="json">raw (json)</el-radio-button>
                        <el-radio-button label="form">form-data</el-radio-button>
                      </el-radio-group>
                      <el-button link type="primary" size="small" @click="formatJson">格式化 JSON</el-button>
                    </div>
                    <div class="editor-wrapper" v-if="requestForm.bodyType === 'json'">
                      <codemirror v-model="requestForm.bodyJson" placeholder="请输入 JSON..." :style="{ height: '100%' }"
                        :autofocus="true" :indent-with-tab="true" :tab-size="2" :extensions="extensions" />
                    </div>
                    <div v-else-if="requestForm.bodyType === 'none'" class="empty-tip">
                      该请求没有 Body 数据
                    </div>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="响应定义" name="responseDef">
                  <div class="panel-content">
                    <el-empty description="暂无响应定义，可从右侧响应结果导入" :image-size="80" />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-col>

          <!-- 右侧：响应结果 -->
          <el-col :span="10" style="height: 100%">
            <div class="response-panel">
              <el-tabs v-model="activeResTab" class="custom-tabs">
                <el-tab-pane label="当前响应" name="response">
                  <div class="panel-content response-content">
                    <div class="response-meta" v-if="responseInfo">
                      <el-tag :type="responseInfo.status === 200 ? 'success' : 'danger'" effect="dark" size="small">
                        {{ responseInfo.status }} {{ responseInfo.statusText }}
                      </el-tag>
                      <span class="meta-item">耗时: {{ responseInfo.time }}ms</span>
                      <span class="meta-item">大小: {{ responseInfo.size }}</span>
                    </div>
                    <div class="editor-wrapper" v-if="responseInfo">
                      <codemirror v-model="responseInfo.data" :style="{ height: '100%' }" :extensions="extensions"
                        :disabled="true" />
                    </div>
                    <el-empty v-else description="点击发送查看响应" :image-size="80" />
                  </div>
                </el-tab-pane>
                <el-tab-pane label="测试历史" name="history">
                  <div class="panel-content">
                    <el-timeline style="padding: 10px;">
                      <el-timeline-item v-for="(item, index) in historyList" :key="index"
                        :type="item.status === 200 ? 'success' : 'danger'" :timestamp="item.time" placement="top">
                        <el-card class="history-card" shadow="hover" @click="restoreHistory(item)">
                          <h4>{{ item.method }} {{ item.url }}</h4>
                          <p>状态: {{ item.status }} | 耗时: {{ item.duration }}ms</p>
                        </el-card>
                      </el-timeline-item>
                    </el-timeline>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>

    <!-- cURL 导入弹窗 -->
    <el-dialog v-model="curlDialogVisible" title="导入 cURL" width="600px">
      <el-input v-model="curlInput" type="textarea" :rows="8" placeholder="请粘贴 cURL 命令..." />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="curlDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="parseCurl">解析并填充</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 新建接口/分组弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新建" width="500px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="createForm.type">
            <el-radio label="group">分组/模块</el-radio>
            <el-radio label="api">接口</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" prop="label">
          <el-input v-model="createForm.label" placeholder="请输入名称" />
        </el-form-item>
        <template v-if="createForm.type === 'api'">
          <el-form-item label="请求方式" prop="method">
            <el-select v-model="createForm.method" placeholder="请选择">
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </el-form-item>
          <el-form-item label="接口地址" prop="url">
            <el-input v-model="createForm.url" placeholder="/path/to/api" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitCreate">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApiManager">
import { ref, reactive, computed, watch } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { ElMessage } from 'element-plus'

// --- 状态定义 ---
const filterText = ref('')
const treeRef = ref(null)
const currentEnv = ref('')
const loading = ref(false)
const activeReqTab = ref('params')
const activeResTab = ref('response')
const curlDialogVisible = ref(false)
const curlInput = ref('')
const createDialogVisible = ref(false)
const createFormRef = ref(null)

// Codemirror 扩展
const extensions = [json()]

// 接口树数据 (模拟)
const apiTreeData = ref([
  {
    id: 1,
    label: 'MES 主系统',
    children: [
      {
        id: 11,
        label: 'System 模块',
        children: [
          { id: 111, label: '新增用户', method: 'POST', url: '/system/user' },
          { id: 112, label: '查询用户列表', method: 'GET', url: '/system/user/list' }
        ]
      },
      {
        id: 12,
        label: 'DailyTools 模块',
        children: [
          { id: 121, label: '查询工具信息', method: 'GET', url: '/dailytools/queryInfo/list' }
        ]
      }
    ]
  },
  {
    id: 2,
    label: 'WMS 仓储系统',
    children: [
      { id: 21, label: '库存查询', method: 'GET', url: '/wms/stock/query' }
    ]
  }
])

const defaultProps = {
  children: 'children',
  label: 'label'
}

// 请求表单数据
const requestForm = reactive({
  method: 'GET',
  url: '',
  params: [
    { active: true, key: 'pageNum', value: '1', desc: '页码' },
    { active: true, key: 'pageSize', value: '10', desc: '每页条数' }
  ],
  headers: [
    { active: true, key: 'Content-Type', value: 'application/json', desc: '' },
    { active: true, key: 'Authorization', value: '', desc: 'Token' }
  ],
  bodyType: 'json',
  bodyJson: '{\n  \n}'
})

// 环境配置
const envMap = {
  test: 'http://192.168.1.20',
  dev: 'http://localhost:8080',
  prod: 'https://api.mes.com'
}

const currentBaseUrl = computed(() => envMap[currentEnv.value] || '')
const urlPlaceholder = computed(() => {
  return currentEnv.value ? '请输入接口路径 (如 /system/user)' : '请输入完整接口地址 (如 http://localhost/api...)'
})

// 响应信息
const responseInfo = ref(null)

// 历史记录
const historyList = ref([
  { time: '2023-10-27 10:00:00', method: 'POST', url: '/system/user', status: 200, duration: 120 },
  { time: '2023-10-27 09:55:00', method: 'GET', url: '/system/user/list', status: 500, duration: 45 }
])

// 新建表单数据
const createForm = reactive({
  type: 'group',
  label: '',
  method: 'GET',
  url: ''
})
const createRules = {
  label: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  method: [{ required: true, message: '请选择请求方式', trigger: 'change' }],
  url: [{ required: true, message: '请输入接口地址', trigger: 'blur' }]
}

// --- 方法实现 ---

// 树节点过滤
watch(filterText, (val) => {
  treeRef.value.filter(val)
})

const filterNode = (value, data) => {
  if (!value) return true
  return data.label.includes(value) || (data.url && data.url.includes(value))
}

const handleNodeClick = (data) => {
  if (data.url) {
    requestForm.url = data.url
    requestForm.method = data.method || 'GET'
    // 这里可以根据接口ID加载详细参数
  }
}

// 表格行操作
const addRow = (list) => {
  list.push({ active: true, key: '', value: '', desc: '' })
}

const removeRow = (list, index) => {
  list.splice(index, 1)
}

// Header 自动补全建议
const queryHeaderSearch = (queryString, cb) => {
  const headers = [
    { value: 'Accept' }, { value: 'Authorization' }, { value: 'Content-Type' },
    { value: 'Cache-Control' }, { value: 'User-Agent' }
  ]
  const results = queryString ? headers.filter(h => h.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0) : headers
  cb(results)
}

// 格式化 JSON
const formatJson = () => {
  try {
    const obj = JSON.parse(requestForm.bodyJson)
    requestForm.bodyJson = JSON.stringify(obj, null, 2)
  } catch (e) {
    ElMessage.warning('JSON 格式错误，无法格式化')
  }
}

// 发送请求 (模拟)
const handleSend = () => {
  loading.value = true
  const finalUrl = currentBaseUrl.value + requestForm.url
  setTimeout(() => {
    loading.value = false
    responseInfo.value = {
      status: 200,
      statusText: 'OK',
      time: 156,
      size: '1.2KB',
      data: JSON.stringify({ code: 200, msg: '操作成功', data: { id: 123, name: 'Test' } }, null, 2)
    }
    activeResTab.value = 'response'
    // 添加历史
    historyList.value.unshift({
      time: new Date().toLocaleString(),
      method: requestForm.method,
      url: finalUrl,
      status: 200,
      duration: 156
    })
  }, 800)
}

// cURL 导入逻辑
const handleCurlImport = () => {
  curlDialogVisible.value = true
  curlInput.value = ''
}

const parseCurl = () => {
  const curlStr = curlInput.value.trim()
  if (!curlStr) return

  // 简易解析逻辑 (复用之前的思路)
  try {
    // 1. 提取 URL
    const urlMatch = curlStr.match(/['"](http[s]?:\/\/[^'"]+)['"]?/) || curlStr.match(/curl\s+['"]?([^'"\s]+)/)
    if (urlMatch) {
      requestForm.url = urlMatch[1]
    }

    // 2. 提取 Method
    if (curlStr.includes('-X POST') || curlStr.includes('--data')) {
      requestForm.method = 'POST'
    } else {
      requestForm.method = 'GET'
    }

    // 3. 提取 Headers
    const headerRegex = /-H\s+['"]([^'"]+)['"]/g
    let hMatch
    const newHeaders = []
    while ((hMatch = headerRegex.exec(curlStr)) !== null) {
      const [key, ...values] = hMatch[1].split(':')
      if (key) {
        newHeaders.push({ active: true, key: key.trim(), value: values.join(':').trim(), desc: '' })
      }
    }
    if (newHeaders.length > 0) requestForm.headers = newHeaders

    // 4. 提取 Body
    const dataMatch = curlStr.match(/(--data-raw|--data|-d)\s+'"['"]/)
    if (dataMatch && dataMatch[2]) {
      requestForm.bodyType = 'json'
      try {
        const jsonBody = JSON.parse(dataMatch[2])
        requestForm.bodyJson = JSON.stringify(jsonBody, null, 2)
      } catch (e) {
        requestForm.bodyJson = dataMatch[2]
      }
    }

    ElMessage.success('cURL 解析成功')
    curlDialogVisible.value = false
  } catch (e) {
    ElMessage.error('cURL 解析失败: ' + e.message)
  }
}

const handleSave = () => {
  ElMessage.success('接口信息已保存')
}

const handleGenerateCode = () => {
  ElMessage.info('代码生成功能开发中...')
}

const handleExportDoc = () => {
  ElMessage.info('文档导出功能开发中...')
}

const restoreHistory = (item) => {
  requestForm.method = item.method
  requestForm.url = item.url
  ElMessage.success('已恢复历史参数')
}

// 新建逻辑
const handleCreate = () => {
  createForm.type = 'group'
  createForm.label = ''
  createForm.method = 'GET'
  createForm.url = ''
  createDialogVisible.value = true
}

const submitCreate = () => {
  createFormRef.value.validate((valid) => {
    if (valid) {
      const newNode = {
        id: Date.now(),
        label: createForm.label,
        children: []
      }

      if (createForm.type === 'api') {
        newNode.method = createForm.method
        newNode.url = createForm.url
        delete newNode.children
      }

      // 获取当前选中的节点，如果是分组则添加到该分组下，否则添加到根节点
      const currentNode = treeRef.value.getCurrentNode()
      if (currentNode && !currentNode.method) { // 选中了分组节点
        if (!currentNode.children) currentNode.children = []
        currentNode.children.push(newNode)
      } else {
        apiTreeData.value.push(newNode)
      }

      createDialogVisible.value = false
      ElMessage.success('创建成功')
    }
  })
}
</script>

<style scoped lang="scss">
.api-manager-container {
  height: calc(100vh - 84px);
  /* 减去 navbar 和 tagsview 的高度 */
  display: flex;
  padding: 0 !important;
  /* 覆盖 app-container 默认 padding */
  overflow: hidden;
  background-color: #fff;
  color: #303133;
}

/* 左侧侧边栏 */
.sidebar {
  width: 280px;
  background-color: #fff;
  border-right: 1px solid #dcdfe6;
  display: flex;
  flex-direction: column;

  .sidebar-header {
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #dcdfe6;
    font-weight: bold;
    color: #303133;
  }

  .sidebar-search {
    padding: 10px;
    border-bottom: 1px solid #dcdfe6;

    :deep(.el-input__wrapper) {
      background-color: #fff;
      box-shadow: none;
    }

    :deep(.el-input__inner) {
      color: #606266;
    }
  }

  .api-tree-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;

    :deep(.el-tree) {
      background: transparent;
      color: #606266;
    }

    :deep(.el-tree-node__content:hover) {
      background-color: #f5f7fa;
    }

    :deep(.el-tree-node:focus > .el-tree-node__content) {
      background-color: #f5f7fa;
    }
  }
}

.custom-tree-node {
  display: flex;
  align-items: center;
  font-size: 13px;
  width: 100%;
  overflow: hidden;

  .method-tag {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    margin-right: 6px;
    width: 36px;
    text-align: center;
    font-weight: bold;

    &.method-GET {
      color: #52c41a;
      background: rgba(82, 196, 26, 0.1);
    }

    &.method-POST {
      color: #faad14;
      background: rgba(250, 173, 20, 0.1);
    }

    &.method-PUT {
      color: #1890ff;
      background: rgba(24, 144, 255, 0.1);
    }

    &.method-DELETE {
      color: #ff4d4f;
      background: rgba(255, 77, 79, 0.1);
    }
  }

  .folder-icon {
    margin-right: 6px;
    color: #888;
  }

  .node-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;

  .top-bar {
    padding: 10px 15px;
    background-color: #fff;
    border-bottom: 1px solid #dcdfe6;
  }

  .workspace {
    flex: 1;
    overflow: hidden;

    .request-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #dcdfe6;
    }

    .response-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background-color: #fff;
    }
  }
}

/* 通用面板样式 */
.panel-content {
  padding: 10px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  .section-desc {
    color: #888;
    font-size: 12px;
    margin-bottom: 8px;
  }
}

.body-content {
  padding: 0;

  .body-toolbar {
    padding: 5px 10px;
    border-bottom: 1px solid #dcdfe6;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }

  .empty-tip {
    padding: 20px;
    text-align: center;
    color: #666;
  }
}

.response-content {
  padding: 0;

  .response-meta {
    padding: 5px 10px;
    border-bottom: 1px solid #dcdfe6;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;

    .meta-item {
      color: #888;
    }
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }
}

.history-card {
  background-color: #fff;
  border: 1px solid #e4e7ed;
  color: #303133;
  cursor: pointer;
  margin-bottom: 5px;

  :deep(.el-card__body) {
    padding: 10px;
  }

  h4 {
    margin: 0 0 5px 0;
    font-size: 13px;
    color: #303133;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #909399;
  }

  &:hover {
    border-color: var(--el-color-primary);
  }
}

/* 覆盖 Element Plus Tabs 样式以适应暗色主题 */
:deep(.custom-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;

  .el-tabs__header {
    margin: 0;
    background-color: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    padding: 0 15px;
  }

  .el-tabs__nav-wrap::after {
    display: none;
  }

  .el-tabs__item {
    color: #909399;
    height: 36px;
    line-height: 36px;

    &.is-active {
      color: var(--el-color-primary);
      background-color: #fff;
    }
  }

  .el-tabs__content {
    flex: 1;
    overflow: hidden;
  }

  .el-tab-pane {
    height: 100%;
  }
}

/* 表格暗色适配 */
:deep(.el-table) {
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-header-bg-color: #f8f8f9;
  --el-table-border-color: #ebeef5;
  --el-table-text-color: #606266;
  --el-table-header-text-color: #515a6e;
  background-color: #fff;

  th.el-table__cell {
    background-color: #f8f8f9;
  }

  .el-input__wrapper {
    background-color: #fff;
    box-shadow: none;
    padding: 0;
  }

  .el-input__inner {
    color: #606266;
  }
}
</style>