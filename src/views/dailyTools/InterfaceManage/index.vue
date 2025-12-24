<template>
  <div class="api-manager-container">
    <!-- 左侧侧边栏：接口树 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <span>接口列表</span>
        <div>
          <el-button type="primary" link icon="Plus" size="small" @click="handleCreate">新建</el-button>
          <el-button type="danger" link icon="Delete" size="small" @click="handleDeleteNode">删除</el-button>
        </div>
      </div>
      <div class="sidebar-search">
        <el-input v-model="filterText" placeholder="搜索接口 / URL..." prefix-icon="Search" clearable />
      </div>
      <div class="api-tree-wrapper" @click="handleWrapperClick">
        <el-tree ref="treeRef" :data="apiTreeData" :props="defaultProps" :expand-on-click-node="false"
          :filter-node-method="filterNode" node-key="id" default-expand-all highlight-current
          @node-click="handleNodeClick" @node-contextmenu="handleNodeContextMenu">
          <template #default="{ node, data }">
            <span class="custom-tree-node">
              <el-tag v-if="data.method" size="small" :type="getMethodType(data.method)" class="method-tag">{{
                data.method }}</el-tag>
              <span v-else class="folder-icon"><el-icon>
                  <Folder />
                </el-icon></span>
              <span class="node-label" :title="data.label">{{ node.label }}</span>
            </span>
          </template>
        </el-tree>
      </div>
      <!-- 自定义右键菜单 -->
      <div v-if="contextMenu.visible" :style="{ left: contextMenu.left + 'px', top: contextMenu.top + 'px' }"
        class="context-menu">
        <div class="menu-item" @click="handleContextMenu('addChild')"><el-icon>
            <Plus />
          </el-icon> 新增子节点</div>
        <div class="menu-item" @click="handleContextMenu('rename')"><el-icon>
            <EditPen />
          </el-icon> 重命名</div>
        <div class="menu-item danger" @click="handleContextMenu('delete')"><el-icon>
            <Delete />
          </el-icon> 删除</div>
      </div>
      <div v-if="contextMenu.visible" class="context-menu-mask" @click="contextMenu.visible = false"
        @contextmenu.prevent="contextMenu.visible = false">
      </div>
    </div>

    <!-- 右侧主内容区 -->
    <div class="main-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar">
        <el-row :gutter="10" align="middle">
          <!-- 环境选择 -->
          <el-col :span="4">
            <div style="display: flex; gap: 5px;">
              <el-select v-model="currentEnv" placeholder="选择环境" style="width: 100%" clearable>
                <el-option label="未设定 (自定义)" value="" />
                <el-option v-for="env in envList" :key="env.key" :label="env.name" :value="env.key" />
              </el-select>
              <el-button icon="Setting" circle @click="openEnvManager" title="环境管理" />
            </div>
          </el-col>

          <!-- URL 输入区 -->
          <el-col :span="12">
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
            <el-button type="info" plain icon="Download" @click="handleCurlImport">cURL导入</el-button>
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
        <splitpanes class="default-theme" @resize="paneSize = $event[0].size">
          <!-- 左侧：请求配置 -->
          <pane :size="60">
            <div class="request-panel">
              <el-tabs v-model="activeReqTab" class="custom-tabs">
                <el-tab-pane label="Auth" name="auth">
                  <div class="panel-content">
                    <div class="section-desc">Authorization (鉴权)</div>
                    <el-form label-position="top" size="small">
                      <el-form-item label="Type">
                        <el-select v-model="requestForm.authType" style="width: 200px">
                          <el-option label="No Auth" value="none" />
                          <el-option label="Bearer Token" value="bearer" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="Token" v-if="requestForm.authType === 'bearer'">
                        <el-input v-model="requestForm.authToken" type="textarea" :rows="3"
                          placeholder="请输入 Token 或变量 {{token}}" />
                        <div
                          style="font-size: 12px; color: var(--el-text-color-secondary); margin-top: 8px; line-height: 1.5;">
                          <el-icon style="vertical-align: -2px; margin-right: 4px">
                            <InfoFilled />
                          </el-icon>
                          <span>发送请求时，以此处填写的内容为准。若填写 <span v-pre>{{token}}</span>，则会自动替换为当前环境中的变量值。</span>
                        </div>
                      </el-form-item>
                    </el-form>
                  </div>
                </el-tab-pane>
                <el-tab-pane label="Params" name="params">
                  <div class="panel-content">
                    <!-- Path Variables 区域 -->
                    <div v-if="requestForm.pathParams.length > 0">
                      <div class="section-desc">Path Variables (路径参数)</div>
                      <el-table :data="requestForm.pathParams" style="width: 100%; margin-bottom: 15px;" size="small"
                        border>
                        <el-table-column label="Key" width="200" prop="key" />
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
                      </el-table>
                    </div>
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
                    <div v-else-if="requestForm.bodyType === 'form'" class="panel-content" style="padding-top: 0;">
                      <el-table :data="requestForm.formData" style="width: 100%" size="small" border>
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
                        <el-table-column label="Value">
                          <template #default="scope">
                            <el-input v-model="scope.row.value" placeholder="Value" />
                          </template>
                        </el-table-column>
                        <el-table-column width="50" align="center">
                          <template #default="scope">
                            <el-button link type="danger" icon="Delete"
                              @click="removeRow(requestForm.formData, scope.$index)" />
                          </template>
                        </el-table-column>
                      </el-table>
                      <el-button link type="primary" icon="Plus" @click="addRow(requestForm.formData)">添加参数</el-button>
                    </div>
                    <div v-else-if="requestForm.bodyType === 'none'" class="empty-tip">
                      该请求没有 Body 数据
                    </div>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="响应定义" name="responseDef">
                  <div class="panel-content">
                    <div v-if="responseDefList.length > 0">
                      <el-table :data="responseDefList" style="width: 100%" size="small" border>
                        <el-table-column label="字段名" prop="key" width="180" />
                        <el-table-column label="类型" prop="type" width="100" />
                        <el-table-column label="备注">
                          <template #default="scope">
                            <el-input v-model="scope.row.desc" placeholder="请输入备注" size="small" />
                          </template>
                        </el-table-column>
                        <el-table-column width="50" align="center">
                          <template #default="scope">
                            <el-button link type="danger" icon="Delete"
                              @click="removeRow(responseDefList, scope.$index)" />
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                    <div v-else>
                      <el-empty description="暂无响应定义，可从右侧响应结果导入" :image-size="80" />
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </pane>

          <!-- 右侧：响应结果 -->
          <pane :size="40">
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
                      <el-button type="primary" link size="small" style="margin-left: auto;"
                        @click="handleImportResponse">导入为响应结构</el-button>
                      <el-divider direction="vertical" />
                      <el-radio-group v-model="responseViewMode" size="small">
                        <el-radio-button label="pretty">Pretty</el-radio-button>
                        <el-radio-button label="preview">Preview</el-radio-button>
                      </el-radio-group>
                    </div>
                    <div class="editor-wrapper" v-if="responseInfo && responseViewMode === 'pretty'">
                      <codemirror v-model="responseInfo.data" :style="{ height: '100%' }" :extensions="extensions"
                        :disabled="true" />
                    </div>
                    <div class="editor-wrapper" v-else-if="responseInfo && responseViewMode === 'preview'">
                      <iframe :srcdoc="responseInfo.data" style="width: 100%; height: 100%; border: none;"></iframe>
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
          </pane>
        </splitpanes>
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

    <!-- 环境管理弹窗 -->
    <el-dialog v-model="envDialogVisible" title="环境管理" width="600px">
      <el-table :data="envList" border stripe>
        <el-table-column prop="name" label="环境名称">
          <template #default="{ row }">
            <el-input v-model="row.name" placeholder="如: 测试环境" />
          </template>
        </el-table-column>
        <el-table-column prop="key" label="Key (唯一)">
          <template #default="{ row }">
            <el-input v-model="row.key" placeholder="如: test" />
          </template>
        </el-table-column>
        <el-table-column prop="url" label="Base URL">
          <template #default="{ row }">
            <el-input v-model="row.url" placeholder="http://..." />
          </template>
        </el-table-column>
        <el-table-column prop="variables" label="变量 (JSON)">
          <template #default="{ row }">
            <el-input v-model="row.variables" placeholder='{"token": "..."}' />
          </template>
        </el-table-column>
        <el-table-column width="60" align="center">
          <template #header>
            <el-button link type="primary" icon="Plus" @click="addEnvRow"></el-button>
          </template>
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="removeEnvRow($index)"></el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="envDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEnvConfig">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 生成代码弹窗 -->
    <el-dialog v-model="generateCodeVisible" title="生成代码" width="700px">
      <div class="code-generator-dialog">
        <el-tabs v-model="generatedCodeType">
          <el-tab-pane label="Axios" name="axios"></el-tab-pane>
          <el-tab-pane label="Fetch" name="fetch" disabled></el-tab-pane>
        </el-tabs>
        <codemirror v-model="generatedCode" :style="{ height: '400px' }" :autofocus="true" :indent-with-tab="true"
          :tab-size="2" :extensions="codeGenExtensions" :disabled="true" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="generateCodeVisible = false">关 闭</el-button>
          <el-button type="primary" icon="CopyDocument" @click="copyGeneratedCode">复制代码</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApiManager">
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { Splitpanes, Pane } from "splitpanes"
import "splitpanes/dist/splitpanes.css"
import { javascript } from '@codemirror/lang-javascript'

// --- 状态定义 ---
const filterText = ref('')
const treeRef = ref(null)
const currentEnv = ref('')
const loading = ref(false)
const envDialogVisible = ref(false)
const envList = ref([])
const activeReqTab = ref('auth')
const activeResTab = ref('response')
const responseViewMode = ref('pretty')
const curlDialogVisible = ref(false)
const curlInput = ref('')
const createDialogVisible = ref(false)
const createFormRef = ref(null)
const generateCodeVisible = ref(false)
const generatedCode = ref('')
const generatedCodeType = ref('axios')
const contextMenu = reactive({
  visible: false,
  left: 0,
  top: 0,
  node: null
})
const responseDefList = ref([])
const currentNodeId = ref(null) // 记录当前选中的节点ID
const createParentNode = ref(null) // 用于存储新建时的父节点

// Codemirror 扩展
const extensions = [json()]
const codeGenExtensions = [javascript()]

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
          {
            id: 111, label: '新增用户', method: 'POST', url: '/system/user',
            params: [], headers: [{ active: true, key: 'Content-Type', value: 'application/json', desc: '' }],
            bodyType: 'json', bodyJson: '{\n  "userName": "admin"\n}'
          },
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

// --- 优化：提取默认表单数据工厂函数 ---
const getDefaultRequestForm = () => ({
  method: 'GET',
  url: '',
  pathParams: [],
  params: [
    { active: true, key: '', value: '', desc: '' }
  ],
  // 默认 Headers
  headers: [
    { active: true, key: 'Content-Type', value: 'application/json', desc: '' },
    { active: true, key: 'User-Agent', value: 'MesTools/1.0', desc: '' }
  ],
  authType: 'none',
  authToken: '',
  formData: [
    { active: true, key: '', value: '', desc: '' }
  ],
  bodyType: 'json',
  bodyJson: '{\n  \n}'
})

// 请求表单数据
const requestForm = reactive(getDefaultRequestForm())

// 环境配置初始化
const initEnvs = () => {
  const saved = localStorage.getItem('api_tool_envs')
  if (saved) {
    envList.value = JSON.parse(saved)
  } else {
    envList.value = [
      { name: '测试环境', key: 'test', url: 'http://192.168.1.20', variables: '{"token": "test_token"}' },
      { name: '开发环境', key: 'dev', url: 'http://localhost:8080', variables: '{"token": "dev_token"}' },
      { name: '正式环境', key: 'prod', url: 'https://api.mes.com', variables: '{"token": ""}' }
    ]
  }
}
initEnvs()

const currentBaseUrl = computed(() => {
  const env = envList.value.find(e => e.key === currentEnv.value)
  return env ? env.url : ''
})

const urlPlaceholder = computed(() => {
  return currentEnv.value ? '请输入接口路径 (如 /system/user)' : '请输入完整接口地址 (如 http://localhost/api...)'
})

// 响应信息
const responseInfo = ref(null)

// 历史记录
const historyList = ref([])

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

// 获取请求方法对应的 Tag 类型
const getMethodType = (method) => {
  const map = {
    GET: 'success',
    POST: 'warning',
    PUT: 'primary',
    DELETE: 'danger'
  }
  return map[method] || 'info'
}

// 监听 Auth Type 变化，自动填充默认变量
watch(() => requestForm.authType, (val) => {
  if (val === 'bearer' && !requestForm.authToken) {
    requestForm.authToken = '{{token}}'
  }
})

// 监听 Auth 变化，自动同步到 Headers
watch(() => [requestForm.authType, requestForm.authToken], ([type, token]) => {
  const authHeaderKey = 'Authorization'
  if (type === 'bearer' && token) {
    const tokenValue = `Bearer ${token}`
    const existing = requestForm.headers.find(h => h.key === authHeaderKey)
    if (existing) {
      existing.value = tokenValue
      existing.active = true
    } else {
      requestForm.headers.push({ active: true, key: authHeaderKey, value: tokenValue, desc: 'Auto generated' })
    }
  } else if (type === 'none') {
    // 优化：切换回 none 时，自动禁用或删除 Authorization Header
    const existingIndex = requestForm.headers.findIndex(h => h.key === authHeaderKey)
    if (existingIndex !== -1) {
      // 策略1：直接删除
      // requestForm.headers.splice(existingIndex, 1) 
      // 策略2：设为不激活 (更符合 Postman 习惯)
      requestForm.headers[existingIndex].active = false
    }
  }
})

// 监听 URL 变化，自动提取 Path Variables
watch(() => requestForm.url, (newUrl) => {
  if (!newUrl) {
    requestForm.pathParams = []
    return
  }
  // 匹配 {xxx} 格式
  const matches = newUrl.match(/\{([a-zA-Z0-9_]+)\}/g)
  if (matches) {
    const keys = matches.map(m => m.slice(1, -1))
    // 保留已有的值，移除不存在的，添加新的
    const newParams = keys.map(key => {
      const existing = requestForm.pathParams.find(p => p.key === key)
      return existing || { key, value: '', desc: '' }
    })
    requestForm.pathParams = newParams
  } else {
    requestForm.pathParams = []
  }
})

// 环境管理方法
const openEnvManager = () => {
  envDialogVisible.value = true
}

const addEnvRow = () => {
  envList.value.push({ name: '', key: '', url: '', variables: '{}' })
}

const removeEnvRow = (index) => {
  envList.value.splice(index, 1)
}

const saveEnvConfig = () => {
  if (envList.value.some(e => !e.name || !e.key)) {
    ElMessage.warning('环境名称和Key不能为空')
    return
  }
  // 校验 JSON 格式
  try {
    envList.value.forEach(e => e.variables && JSON.parse(e.variables))
  } catch (e) {
    ElMessage.warning('变量必须是有效的 JSON 格式')
    return
  }
  localStorage.setItem('api_tool_envs', JSON.stringify(envList.value))
  envDialogVisible.value = false
  ElMessage.success('环境配置已保存')
}

const handleNodeClick = (data) => {
  // 只有点击具体的接口节点（有method属性）才加载数据
  if (data.method) {
    currentNodeId.value = data.id

    // 1. 重置表单 (使用 Object.assign + 工厂函数，消除冗余代码)
    Object.assign(requestForm, getDefaultRequestForm())
    responseDefList.value = []

    // 2. 回显数据 (使用 structuredClone 替代 JSON.parse/stringify)
    requestForm.url = data.url
    requestForm.method = data.method

    if (data.params) requestForm.params = structuredClone(data.params)
    if (data.headers) requestForm.headers = structuredClone(data.headers)
    if (data.pathParams) requestForm.pathParams = structuredClone(data.pathParams)
    if (data.bodyType) requestForm.bodyType = data.bodyType
    if (data.bodyJson) requestForm.bodyJson = data.bodyJson
    if (data.formData) requestForm.formData = structuredClone(data.formData)
    if (data.authType) requestForm.authType = data.authType
    if (data.authToken) requestForm.authToken = data.authToken
    if (data.responseDef) responseDefList.value = structuredClone(data.responseDef)

    // 如果是新接口没有默认Header，可以加一个默认的
    if (requestForm.headers.length === 0) {
      requestForm.headers.push({ active: true, key: 'Content-Type', value: 'application/json', desc: '' })
    }
  }
}

// 点击树形控件外部空白处，取消选中状态
const handleWrapperClick = (e) => {
  // 如果点击的是树节点内容区域（包括展开箭头、标签等），则不处理，交给 el-tree 自身逻辑
  if (e.target.closest('.el-tree-node__content')) return

  // 否则视为点击了空白处，清除选中状态
  treeRef.value.setCurrentKey(null)
  currentNodeId.value = null
  // 重置右侧表单
  Object.assign(requestForm, getDefaultRequestForm())
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

// 变量替换辅助函数
const replaceVariables = (str, variables) => {
  if (!str || typeof str !== 'string') return str
  return str.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    return variables[key.trim()] || match
  })
}

// 路径参数替换辅助函数
const replacePathParams = (url, pathParams) => {
  let newUrl = url
  pathParams.forEach(p => {
    if (p.key && p.value) {
      newUrl = newUrl.replace(new RegExp(`\\{${p.key}\\}`, 'g'), p.value)
    }
  })
  return newUrl
}

// 发送请求
const handleSend = async () => {
  loading.value = true

  // 1. 获取当前环境的变量
  let envVariables = {}
  const currentEnvObj = envList.value.find(e => e.key === currentEnv.value)
  if (currentEnvObj && currentEnvObj.variables) {
    try {
      envVariables = JSON.parse(currentEnvObj.variables)
    } catch (e) {
      console.error('环境变量解析失败', e)
    }
  }

  // 2. 执行变量替换 (URL, Headers, AuthToken, Body)
  // 注意：这里只替换用于发送的临时变量，不修改 requestForm 显示的值
  const finalUrl = replaceVariables(currentBaseUrl.value + requestForm.url, envVariables)
  const finalAuthToken = replaceVariables(requestForm.authToken, envVariables)
  const finalUrlWithParams = replacePathParams(finalUrl, requestForm.pathParams)

  // 组装最终 Headers (包含变量替换)
  const finalHeaders = requestForm.headers.map(h => ({
    ...h,
    key: replaceVariables(h.key, envVariables),
    value: replaceVariables(h.value, envVariables)
  })).filter(h => h.active && h.key) // 过滤掉未激活的 Header

  // 如果是 Bearer 模式，强制更新 Authorization Header
  if (requestForm.authType === 'bearer' && finalAuthToken) {
    const authHeader = finalHeaders.find(h => h.key === 'Authorization')
    if (authHeader) authHeader.value = `Bearer ${finalAuthToken}`
    else finalHeaders.push({ key: 'Authorization', value: `Bearer ${finalAuthToken}` })
  }

  // 组装 Headers 对象
  const headersObj = {}
  finalHeaders.forEach(h => headersObj[h.key] = h.value)

  // 创建请求快照 (深拷贝)
  const snapshot = structuredClone(JSON.parse(JSON.stringify(requestForm))) // 确保去除 Proxy

  // --- 真实请求逻辑 (建议) ---
  // 注意：纯前端直接请求会遇到 CORS 跨域问题。
  // 解决方案：通常需要配置 vite/webpack 的 proxy，或者后端提供一个转发接口。

  try {
    const startTime = Date.now()

    // 构造 Axios 配置
    const config = {
      method: requestForm.method,
      url: finalUrlWithParams, // 如果配置了代理，这里可能需要处理 url，例如加上 '/api-proxy' 前缀
      headers: headersObj,
      params: {}, // URL 参数
      data: null
    }

    // 处理 Query Params
    requestForm.params.filter(p => p.active && p.key).forEach(p => {
      config.params[p.key] = replaceVariables(p.value, envVariables)
    })

    // 处理 Body
    if (['POST', 'PUT', 'DELETE'].includes(requestForm.method)) {
      if (requestForm.bodyType === 'json') {
        try {
          config.data = JSON.parse(replaceVariables(requestForm.bodyJson, envVariables))
        } catch (e) {
          config.data = replaceVariables(requestForm.bodyJson, envVariables) // 发送原始字符串或报错
        }
      } else if (requestForm.bodyType === 'form') {
        // 处理 FormData...
      }
    }

    // 模拟发送 (替换为真实请求: const res = await axios(config))
    // const res = await axios(config) 

    // --- 模拟数据开始 ---
    await new Promise(r => setTimeout(r, 800)) // 模拟网络延迟
    const mockRes = {
      status: 200,
      statusText: 'OK',
      data: { code: 200, msg: '操作成功', data: { id: 123, token_used: finalAuthToken } },
      headers: { 'content-type': 'application/json' }
    }
    // --- 模拟数据结束 ---

    const endTime = Date.now()
    const duration = endTime - startTime

    loading.value = false
    responseInfo.value = {
      status: mockRes.status,
      statusText: mockRes.statusText,
      time: duration,
      size: JSON.stringify(mockRes.data).length + ' B', // 简单估算
      data: typeof mockRes.data === 'object' ? JSON.stringify(mockRes.data, null, 2) : mockRes.data
    }
    activeResTab.value = 'response'

    // 添加历史
    historyList.value.unshift({
      time: new Date().toLocaleString(),
      method: requestForm.method,
      url: finalUrlWithParams,
      status: mockRes.status,
      duration: duration,
      snapshot: snapshot
    })
  } catch (error) {
    loading.value = false
    console.error(error)
    ElMessage.error(error.message || '请求失败')
    // 也可以记录失败的历史
  }
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
  if (!currentNodeId.value) {
    ElMessage.warning('请先选择一个接口节点')
    return
  }

  // 递归查找并更新树节点数据
  const updateNode = (nodes) => {
    for (const node of nodes) {
      if (node.id === currentNodeId.value) {
        node.url = requestForm.url
        node.method = requestForm.method
        node.params = structuredClone(requestForm.params)
        node.headers = structuredClone(requestForm.headers)
        node.pathParams = structuredClone(requestForm.pathParams)
        node.bodyType = requestForm.bodyType
        node.bodyJson = requestForm.bodyJson
        node.formData = structuredClone(requestForm.formData)
        node.authType = requestForm.authType
        node.authToken = requestForm.authToken
        node.responseDef = structuredClone(responseDefList.value)
        return true
      }
      if (node.children && node.children.length > 0) {
        if (updateNode(node.children)) return true
      }
    }
    return false
  }

  if (updateNode(apiTreeData.value)) {
    ElMessage.success('接口信息已保存 (本地暂存)')
    // TODO: 这里未来调用后端保存接口 API
  }
}

const handleGenerateCode = () => {
  const { method, url, params, headers, bodyType, bodyJson, pathParams } = requestForm;
  let finalUrl = currentBaseUrl.value + url;

  // 替换 Path Params
  finalUrl = replacePathParams(finalUrl, pathParams);

  let code = `import axios from 'axios';\n\n`;

  // 处理 Params
  const activeParams = params.filter(p => p.active && p.key);
  let paramsStr = '';
  if (activeParams.length > 0) {
    paramsStr = `params: {\n` + activeParams.map(p => `    '${p.key}': '${p.value}'`).join(',\n') + `\n  },`;
  }

  // 处理 Headers
  const activeHeaders = headers.filter(h => h.active && h.key);
  let headersStr = '';
  if (activeHeaders.length > 0) {
    headersStr = `headers: {\n` + activeHeaders.map(h => `    '${h.key}': '${h.value}'`).join(',\n') + `\n  },`;
  }

  // 处理 Body
  let dataStr = '';
  if (method.toUpperCase() !== 'GET' && bodyType === 'json' && bodyJson.trim() !== '{}') {
    try {
      // 尝试格式化，如果失败则按原样使用
      const formattedBody = JSON.stringify(JSON.parse(bodyJson), null, 2);
      dataStr = `data: ${formattedBody},`;
    } catch (e) {
      dataStr = `data: ${bodyJson},`;
    }
  }

  code += `axios({\n`
  code += `  method: '${method.toLowerCase()}',\n`
  code += `  url: '${finalUrl}',\n`
  if (paramsStr) code += `  ${paramsStr}\n`
  if (headersStr) code += `  ${headersStr}\n`
  if (dataStr) code += `  ${dataStr}\n`
  code += `}).then(res => {\n  console.log(res.data);\n}).catch(err => {\n  console.error(err);\n});`

  generatedCode.value = code;
  generateCodeVisible.value = true;
}

const handleExportDoc = () => {
  ElMessage.info('文档导出功能开发中...')
}

const restoreHistory = (item) => {
  if (item.snapshot) {
    Object.assign(requestForm, structuredClone(item.snapshot))
    ElMessage.success('已恢复历史参数')
  } else {
    // 兼容旧数据
    requestForm.method = item.method
    requestForm.url = item.url.replace(currentBaseUrl.value, '')
    ElMessage.success('已恢复部分历史参数')
  }
}

const handleImportResponse = () => {
  if (!responseInfo.value || !responseInfo.value.data) {
    ElMessage.warning('暂无响应数据')
    return
  }
  try {
    const json = JSON.parse(responseInfo.value.data)
    responseDefList.value = flattenJson(json)
    activeReqTab.value = 'responseDef'
    ElMessage.success('响应结构导入成功')
  } catch (e) {
    ElMessage.error('解析响应JSON失败')
  }
}

const flattenJson = (obj, prefix = '') => {
  let result = []
  if (typeof obj !== 'object' || obj === null) return result

  for (const key in obj) {
    const value = obj[key]
    let type = typeof value
    if (value === null) type = 'null'
    else if (Array.isArray(value)) type = 'Array'

    const fullKey = prefix ? `${prefix}.${key}` : key

    result.push({
      key: fullKey,
      type: type.charAt(0).toUpperCase() + type.slice(1),
      desc: ''
    })

    if (type === 'object' && value !== null) {
      result = result.concat(flattenJson(value, fullKey))
    } else if (type === 'Array' && value.length > 0 && typeof value[0] === 'object') {
      result = result.concat(flattenJson(value[0], fullKey + '[0]'))
    }
  }
  return result
}

// --- 优化：统一删除逻辑 (供顶部按钮和右键菜单共用) ---
const execDeleteNode = (node) => {
  const data = node.data
  ElMessageBox.confirm(`确定要删除 "${data.label}" 吗?`, '警告', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    const parent = node.parent
    const children = parent.data.children || parent.data
    const index = children.findIndex(d => d.id === data.id)
    children.splice(index, 1)

    // 如果删除的是当前选中的节点，清空选中状态并重置表单
    if (currentNodeId.value === data.id) {
      currentNodeId.value = null
      Object.assign(requestForm, getDefaultRequestForm())
    }
    ElMessage.success('删除成功')
  }).catch(() => { })
}

// 右键菜单处理
const handleNodeContextMenu = (event, data, node, component) => {
  contextMenu.node = node
  contextMenu.visible = true
  contextMenu.left = event.clientX
  contextMenu.top = event.clientY
}

const handleContextMenu = (action) => {
  const node = contextMenu.node
  contextMenu.visible = false
  if (!node) return

  switch (action) {
    case 'addChild':
      // 只有分组可以添加子节点
      if (node.data.method) {
        ElMessage.warning('接口节点下不能再添加子节点')
        return
      }
      handleCreate(node)
      break
    case 'rename':
      ElMessageBox.prompt('请输入新的名称', '重命名', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: node.label,
      }).then(({ value }) => {
        node.data.label = value
        ElMessage.success('重命名成功')
      }).catch(() => { })
      break
    case 'delete':
      execDeleteNode(node)
      break
  }
}

const handleDeleteNode = () => {
  const currentNode = treeRef.value.getCurrentNode()
  if (!currentNode) {
    ElMessage.warning('请先选择要删除的节点')
    return
  }
  const node = treeRef.value.getNode(currentNode)
  execDeleteNode(node)
}

// 新建逻辑
const handleCreate = (parentNode = null) => {
  createForm.type = 'group'
  createForm.label = ''
  createForm.method = 'GET'
  createForm.url = ''
  createDialogVisible.value = true

  // 如果是从右键菜单“新增子节点”进来，parentNode 是 Node 对象
  if (parentNode && parentNode.data) {
    createParentNode.value = parentNode
  } else {
    createParentNode.value = null
  }
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
      let currentNode = null
      if (createParentNode.value) {
        currentNode = createParentNode.value.data
      } else {
        currentNode = treeRef.value.getCurrentNode()
      }

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
/* 右键菜单样式优化 */
.context-menu {
  position: fixed;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);
  z-index: 2001;
  padding: 5px 0;

  .menu-item {
    padding: 8px 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--el-text-color-regular);

    .el-icon {
      margin-right: 8px;
    }

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &.danger {
      color: var(--el-color-danger);
    }
  }
}

/* 遮罩层样式：确保点击菜单外部时能关闭菜单 */
.context-menu-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  /* 必须比菜单(2001)低，但比页面内容高 */
  background: transparent;
}

.api-manager-container {
  height: calc(100vh - 84px);
  /* 减去 navbar 和 tagsview 的高度 */
  display: flex;
  overflow: hidden;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

/* 左侧侧边栏 */
.sidebar {
  width: 280px;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;

  .sidebar-header {
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--el-border-color);
    font-weight: bold;
    color: var(--el-text-color-primary);
  }

  .sidebar-search {
    padding: 10px;
    border-bottom: 1px solid var(--el-border-color);

    :deep(.el-input__wrapper) {
      box-shadow: none;
      background-color: transparent;
    }

    :deep(.el-input__inner) {
      color: var(--el-text-color-regular);
    }
  }

  .api-tree-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;

    :deep(.el-tree) {
      background: transparent;
      color: var(--el-text-color-regular);
    }

    :deep(.el-tree-node__content:hover) {
      background-color: var(--el-fill-color-light);
    }

    :deep(.el-tree-node:focus > .el-tree-node__content) {
      background-color: var(--el-fill-color-light);
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
    margin-right: 6px;
    width: 45px;
    text-align: center;
    font-weight: bold;
    justify-content: center;
  }

  .folder-icon {
    margin-right: 6px;
    color: var(--el-text-color-secondary);
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
  background-color: var(--el-bg-color);

  .top-bar {
    padding: 10px 15px;
    background-color: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color);
  }

  .workspace {
    flex: 1;
    overflow: hidden;

    .request-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--el-border-color);
    }

    .response-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background-color: var(--el-bg-color);
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
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-bottom: 8px;
  }
}

.body-content {
  padding: 0;

  .body-toolbar {
    padding: 5px 10px;
    border-bottom: 1px solid var(--el-border-color);
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
    color: var(--el-text-color-secondary);
  }
}

.response-content {
  padding: 0;

  .response-meta {
    padding: 5px 10px;
    border-bottom: 1px solid var(--el-border-color);
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;

    .meta-item {
      color: var(--el-text-color-secondary);
    }
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }
}

.history-card {
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  color: var(--el-text-color-primary);
  cursor: pointer;
  margin-bottom: 5px;

  :deep(.el-card__body) {
    padding: 10px;
  }

  h4 {
    margin: 0 0 5px 0;
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
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
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color);
    padding: 0 15px;
  }

  .el-tabs__nav-wrap::after {
    display: none;
  }

  .el-tabs__item {
    color: var(--el-text-color-secondary);
    height: 36px;
    line-height: 36px;

    &.is-active {
      color: var(--el-color-primary);
      background-color: var(--el-bg-color);
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

/* 表格样式微调，移除强制背景色，使用 Element Plus 变量 */
:deep(.el-table) {
  .el-input__wrapper {
    box-shadow: none;
    padding: 0;
    background-color: transparent;
  }
}
</style>