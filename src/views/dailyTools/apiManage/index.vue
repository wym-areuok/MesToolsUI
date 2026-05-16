<template>
  <div class="api-manager-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <span>接口列表</span>
        <div>
          <el-button type="primary" link icon="Plus" size="small" @click="handleCreate"
            v-hasPermi="['dailyTools:apiManage:insert']">新建</el-button>
        </div>
      </div>
      <div class="sidebar-search">
        <el-input v-model="filterText" placeholder="搜索接口 / URL..." prefix-icon="Search" clearable />
      </div>
      <div class="api-tree-wrapper" @click="handleWrapperClick">
        <el-tree ref="treeRef" :data="apiTreeData" :props="defaultProps" :expand-on-click-node="true"
          :filter-node-method="filterNode" node-key="itemId" highlight-current draggable :allow-drop="allowDrop"
          @node-drop="handleNodeDrop" @node-click="handleNodeClick" @node-contextmenu="handleNodeContextMenu">
          <template #default="{ node, data }">
            <span class="custom-tree-node">
              <el-tag v-if="data.itemType === 'api' && data.protocol === 'webservice'" size="small" type="info"
                class="method-tag">
                SOAP
              </el-tag>
              <el-tag v-else-if="data.itemType === 'api'" size="small" :type="getMethodType(data.reqMethod)"
                class="method-tag">
                {{ data.reqMethod }}
              </el-tag>
              <span v-else class="folder-icon">
                <el-icon v-if="node.expanded">
                  <FolderOpened />
                </el-icon>
                <el-icon v-else>
                  <Folder />
                </el-icon>
              </span>
              <el-icon v-if="data.isLocked" class="lock-icon" title="已锁定">
                <Lock />
              </el-icon>
              <span class="node-label" :title="data.itemName">{{ node.label }}</span>
            </span>
          </template>
        </el-tree>
      </div>
      <!-- 自定义右键菜单 -->
      <div v-if="contextMenu.visible" :style="{ left: contextMenu.left + 'px', top: contextMenu.top + 'px' }"
        class="context-menu">
        <div class="menu-item" @click="handleContextMenu('addChild')" v-hasPermi="['dailyTools:apiManage:insert']">
          <el-icon>
            <Plus />
          </el-icon> 新增子节点
        </div>
        <div class="menu-item" @click="handleContextMenu('rename')" v-hasPermi="['dailyTools:apiManage:edit']"><el-icon>
            <EditPen />
          </el-icon> 重命名</div>
        <div class="menu-item" @click="handleContextMenu('toggleLock')" v-hasPermi="['dailyTools:apiManage:lock']">
          <el-icon>
            <component :is="contextMenu.node && contextMenu.node.data.isLocked ? 'Unlock' : 'Lock'" />
          </el-icon>
          {{ contextMenu.node && contextMenu.node.data.isLocked ? '解锁' : '锁定' }}
        </div>
        <div class="menu-item" @click="handleContextMenu('exportDoc')" v-hasPermi="['dailyTools:apiManage:export']">
          <el-icon>
            <Document />
          </el-icon> 导出文档
        </div>
        <div class="menu-item danger" @click="handleContextMenu('delete')" v-hasPermi="['dailyTools:apiManage:remove']">
          <el-icon>
            <Delete />
          </el-icon> 删除
        </div>
      </div>
      <div v-if="contextMenu.visible" class="context-menu-mask" @click="contextMenu.visible = false"
        @contextmenu.prevent="contextMenu.visible = false">
      </div>
    </div>

    <div class="main-content" v-loading="loading">
      <template v-if="currentNodeType === 'api'">
        <div class="workspace">
          <splitpanes class="default-theme">
            <pane :size="60" style="min-width: 0">
              <div class="request-panel">
                <div class="request-header-bar">
                  <el-alert v-if="requestForm.isLocked" title="接口已锁定" type="info" :closable="false" show-icon
                    style="margin-bottom: 10px; padding: 5px 10px;" />
                  <div class="url-input-container">
                    <el-input v-model="requestForm.url"
                      :placeholder="requestForm.protocol === 'webservice' ? '请输入 WebService 地址 (ASMX/WSDL 地址)...' : urlPlaceholder">
                      <template #prepend>
                        <el-select v-model="requestForm.method" style="width: 100px"
                          :disabled="requestForm.protocol === 'webservice'">
                          <el-option label="GET" value="GET"><span
                              style="color: var(--el-color-success); font-weight: bold">GET</span></el-option>
                          <el-option label="POST" value="POST"><span
                              style="color: var(--el-color-warning); font-weight: bold">POST</span></el-option>
                          <el-option label="PUT" value="PUT"><span
                              style="color: var(--el-color-primary); font-weight: bold">PUT</span></el-option>
                          <el-option label="DELETE" value="DELETE"><span
                              style="color: var(--el-color-danger); font-weight: bold">DELETE</span></el-option>
                        </el-select>
                      </template>
                    </el-input>
                    <div class="action-buttons">
                      <el-button type="primary" icon="Promotion" @click="handleSend"
                        :loading="sendLoading">发送</el-button>
                      <el-button type="success" plain icon="FolderChecked" @click="handleSave"
                        v-hasPermi="['dailyTools:apiManage:insert', 'dailyTools:apiManage:edit']"
                        :disabled="requestForm.isLocked">保存</el-button>
                    </div>
                  </div>
                </div>

                <el-tabs v-model="activeReqTab" class="custom-tabs">
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
                            <el-autocomplete v-model="scope.row.value"
                              :fetch-suggestions="(qs, cb) => queryHeaderValueSearch(scope.row, qs, cb)"
                              placeholder="Value" style="width: 100%" />
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
                        <el-table-column label="Header Key" width="200">
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
                        <el-radio-group v-model="requestForm.bodyType" size="small" @change="handleBodyTypeChange"
                          :disabled="requestForm.protocol === 'webservice'">
                          <el-radio-button label="none">none</el-radio-button>
                          <el-radio-button label="json">{{ requestForm.protocol === 'webservice' ? 'XML' : 'raw (json)'
                          }}</el-radio-button>
                          <el-radio-button label="form">form-data</el-radio-button>
                        </el-radio-group>
                        <el-button link type="primary" size="small" @click="handleFormat">格式化</el-button>
                      </div>
                      <div class="editor-wrapper"
                        v-if="requestForm.bodyType === 'json' || requestForm.protocol === 'webservice'">
                        <codemirror v-model="requestForm.bodyJson"
                          :placeholder="requestForm.protocol === 'webservice' ? '请输入 SOAP Envelope XML...' : '请输入 JSON...'"
                          :style="{ height: '100%' }" :autofocus="true" :indent-with-tab="true" :tab-size="2"
                          :extensions="requestForm.protocol === 'webservice' ? [] : extensions" />
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
                        <el-button link type="primary" icon="Plus"
                          @click="addRow(requestForm.formData)">添加参数</el-button>
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

            <pane :size="40" style="min-width: 0">
              <div class="response-panel">
                <el-tabs v-model="activeResTab" class="custom-tabs">
                  <el-tab-pane label="当前响应" name="response">
                    <div class="panel-content response-content">
                      <div class="response-meta" v-if="responseInfo">
                        <el-tag :type="responseInfo.status >= 200 && responseInfo.status < 300 ? 'success' : 'danger'"
                          effect="dark" size="small" class="status-tag">
                          {{ responseInfo.status }} {{ responseInfo.statusText }}
                        </el-tag>
                        <span class="meta-item time-item">耗时: {{ responseInfo.time }}ms</span>
                        <span class="meta-item">大小: {{ responseInfo.size }}</span>
                        <el-button type="primary" link size="small" style="margin-left: auto;"
                          @click="handleCopyResponse">复制</el-button>
                        <el-button type="primary" link size="small" @click="handleFormatResponse">格式化</el-button>
                        <el-button v-if="requestForm.protocol !== 'webservice'" type="primary" link size="small"
                          @click="handleImportResponse">导入为响应结构</el-button>
                      </div>
                      <div class="editor-wrapper" v-if="responseInfo">
                        <codemirror v-model="responseInfo.data" :style="{ height: '100%' }"
                          :extensions="requestForm.protocol === 'webservice' ? [] : extensions" :disabled="true" />
                      </div>
                      <el-empty v-else description="点击发送查看响应" :image-size="80" />
                    </div>
                  </el-tab-pane>
                  <el-tab-pane label="请求历史" name="history">
                    <div class="panel-content" v-loading="historyLoading">
                      <el-table :data="historyList" size="small" border style="width: 100%">
                        <el-table-column label="状态" width="70">
                          <template #default="scope">
                            <el-tag
                              :type="scope.row.resStatus >= 200 && scope.row.resStatus < 300 ? 'success' : 'danger'"
                              size="small">
                              {{ scope.row.resStatus }}
                            </el-tag>
                          </template>
                        </el-table-column>
                        <el-table-column label="耗时" prop="duration" width="80">
                          <template #default="scope">{{ scope.row.duration }}ms</template>
                        </el-table-column>
                        <el-table-column label="请求时间" prop="createTime" min-width="140" />
                        <el-table-column label="操作" width="70" align="center">
                          <template #default="scope">
                            <el-button link type="primary" @click="handleRestoreHistory(scope.row)"
                              title="还原快照参数">还原</el-button>
                          </template>
                        </el-table-column>
                      </el-table>
                      <el-empty v-if="historyList.length === 0" description="暂无历史记录" :image-size="60" />
                    </div>
                  </el-tab-pane>
                </el-tabs>
              </div>
            </pane>
          </splitpanes>
        </div>
      </template>

      <!-- 初始化样式 / 分组选中时的空白表单占位 -->
      <div v-else class="empty-workspace">
        <el-empty description="请从左侧接口树中选择一个接口进行调试" :image-size="200">
          <template #extra>
            <div class="init-tip">
              <p><el-icon>
                  <InfoFilled />
                </el-icon> 您可以点击左侧“新建”按钮创建新的接口或分组</p>
              <p><el-icon>
                  <Mouse />
                </el-icon> 右键点击树节点可进行重命名、锁定或导出文档等操作</p>
            </div>
          </template>
        </el-empty>
      </div>
    </div>

    <!-- 新建接口/分组弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新建" width="500px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="类型" prop="itemType">
          <el-radio-group v-model="createForm.itemType">
            <el-radio v-for="item in nodeTypeOptions" :key="item.value" :label="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" prop="itemName">
          <el-input v-model="createForm.itemName" placeholder="请输入名称" />
        </el-form-item>
        <template v-if="createForm.itemType === 'api'">
          <el-form-item label="协议类型" prop="protocol">
            <el-radio-group v-model="createForm.protocol">
              <el-radio label="http">HTTP (REST)</el-radio>
              <el-radio label="webservice">WebService (SOAP)</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="createForm.protocol === 'http'" label="请求方式" prop="reqMethod">
            <el-select v-model="createForm.reqMethod" placeholder="请选择">
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </el-form-item>
          <el-form-item label="接口地址" prop="reqUrl">
            <el-input v-model="createForm.reqUrl" placeholder="address/path/to/api" />
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

<script setup name="ApiManage">
import { ref, reactive, computed, watch, onMounted, nextTick, getCurrentInstance, toRefs } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { Splitpanes, Pane } from "splitpanes"
import "splitpanes/dist/splitpanes.css"
import {
  listApiTree, getApi,
  addApi, updateApi, delApi,
  proxyRequest,
  toggleLock,
  listHistory
} from '@/api/dailyTools/apiManage'

// --- Ruoyi Style: 获取全局代理 ---
const { proxy } = getCurrentInstance()

const filterText = ref('')
const treeRef = ref(null)
const loading = ref(false)
const sendLoading = ref(false)
const activeReqTab = ref('params')
const activeResTab = ref('response')
const createDialogVisible = ref(false)
const historyList = ref([])
const historyLoading = ref(false)

const contextMenu = reactive({
  visible: false,
  left: 0,
  top: 0,
  node: null
})
const responseDefList = ref([])

// 节点类型选项 (本地常量管理即可，无需后端字典)
const nodeTypeOptions = [
  { label: '分组/模块', value: 'group' },
  { label: '接口', value: 'api' }
]

const currentNodeId = ref(null) // 记录当前选中的节点ID
const currentNodeType = ref(null) // 记录当前选中的节点类型 (api 或 group)
const createParentNode = ref(null) // 用于存储新建时的父节点
const extensions = [json()]
const apiTreeData = ref([])
const defaultProps = {
  children: 'children',
  label: 'itemName'
}
const getDefaultRequestForm = () => ({
  itemName: '',
  protocol: 'http',
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
  formData: [
    { active: true, key: '', value: '', desc: '' }
  ],
  bodyType: 'json',
  bodyJson: '{\n  \n}',
  isLocked: false
})
const requestForm = reactive(getDefaultRequestForm())

const getTreeData = async () => {
  // 1. 记录当前展开的节点
  const expandedKeys = []
  if (treeRef.value) {
    const nodesMap = treeRef.value.store.nodesMap
    for (const key in nodesMap) {
      if (nodesMap[key].expanded) {
        expandedKeys.push(key)
      }
    }
  }

  const res = await listApiTree()
  // 3. 递归处理数据，确保 isLocked 为布尔值，防止 Tree 内部组件警告
  apiTreeData.value = formatTreeData(res.data || [])

  // 2. 恢复展开状态
  await nextTick()
  if (treeRef.value) {
    expandedKeys.forEach(key => {
      const node = treeRef.value.getNode(key)
      if (node) node.expanded = true
    })
  }
}

function formatTreeData(data) {
  return data.map(item => ({
    ...item,
    isLocked: !!item.isLocked,
    children: item.children ? formatTreeData(item.children) : []
  }))
}

const urlPlaceholder = ref('请输入完整接口地址 (如 http://localhost/api...)')

const responseInfo = ref(null)

const data = reactive({
  createForm: {
    itemType: 'group',
    protocol: 'http',
    itemName: '',
    reqMethod: 'GET',
    reqUrl: ''
  },
  createRules: {
    itemName: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    reqMethod: [{ required: true, message: '请选择请求方式', trigger: 'change' }],
    reqUrl: [{ required: true, message: '请输入接口地址', trigger: 'blur' }]
  }
})
const { createForm, createRules } = toRefs(data)
watch(filterText, (val) => {
  treeRef.value.filter(val)
})

const filterNode = (value, data) => {
  if (!value) return true
  return data.itemName.includes(value) || (data.reqUrl && data.reqUrl.includes(value))
}

const getMethodType = (method) => {
  const map = {
    GET: 'success',
    POST: 'warning',
    PUT: 'primary',
    DELETE: 'danger'
  }
  return map[method] || 'info'
}
watch(() => requestForm.url, (newUrl) => {
  if (!newUrl) {
    requestForm.pathParams = []
    return
  }
  const keys = Array.from(newUrl.matchAll(/\{([\w-]+)\}/g), m => m[1])
  if (keys.length > 0) {
    // 深度对比逻辑修复：检查 key 的集合是否真的变化，避免输入时的重复刷新导致焦点丢失
    const currentKeys = requestForm.pathParams.map(p => p.key);
    const isSame = keys.length === currentKeys.length && keys.every(k => currentKeys.includes(k));

    if (!isSame) {
      const newParams = keys.map(key => {
        const existing = requestForm.pathParams.find(p => p.key === key)
        // 必须保留原有对象引用或深度克隆值，防止描述丢失
        return existing ? { key: existing.key, value: existing.value, desc: existing.desc } : { key, value: '', desc: '' }
      })
      requestForm.pathParams = newParams
    }
  } else {
    requestForm.pathParams = []
  }
})

const parseJson = (str) => {
  if (!str || str === 'undefined') return []
  if (typeof str === 'object') return str
  try { return JSON.parse(str) } catch (e) { return [] }
}

// Body 类型切换时自动处理 Header
const handleBodyTypeChange = (type) => {
  if (type === 'json') {
    const hasContentType = requestForm.headers.some(h => h.key.toLowerCase() === 'content-type')
    if (!hasContentType) {
      requestForm.headers.unshift({ active: true, key: 'Content-Type', value: 'application/json', desc: 'Auto-added' })
    } else {
      const ct = requestForm.headers.find(h => h.key.toLowerCase() === 'content-type')
      if (ct) ct.value = 'application/json'
    }
  }
}

const handleNodeClick = async (data) => {
  currentNodeType.value = data.itemType
  if (data.itemType === 'api') {
    currentNodeId.value = data.itemId
    responseInfo.value = null
    Object.assign(requestForm, getDefaultRequestForm())
    responseDefList.value = []
    historyList.value = []
    activeResTab.value = 'response'
    try {
      loading.value = true
      const res = await getApi(data.itemId)
      const apiData = res.data
      requestForm.itemName = apiData.itemName
      requestForm.protocol = apiData.protocol || 'http'
      requestForm.url = apiData.reqUrl
      requestForm.method = requestForm.protocol === 'webservice' ? 'POST' : apiData.reqMethod
      requestForm.params = parseJson(apiData.reqParams)
      requestForm.headers = parseJson(apiData.reqHeaders)
      requestForm.pathParams = parseJson(apiData.reqPathParams)
      requestForm.formData = parseJson(apiData.reqFormData)
      responseDefList.value = parseJson(apiData.responseDef)
      if (apiData.reqBodyType) requestForm.bodyType = apiData.reqBodyType

      // 如果是 WebService 且 Body 为空，给一个默认 Envelope
      if (requestForm.protocol === 'webservice' && (!apiData.reqBodyJson || apiData.reqBodyJson === '{\n  \n}')) {
        requestForm.bodyJson = `<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    \n  </soap:Body>\n</soap:Envelope>`
      } else {
        requestForm.bodyJson = apiData.reqBodyJson
      }

      requestForm.isLocked = !!apiData.isLocked
      getHistory()
    } catch (error) {
      console.error(error)
      proxy.$modal.msgError('获取接口详情失败')
    } finally {
      loading.value = false
    }
  } else {
    currentNodeId.value = data.itemId
    Object.assign(requestForm, getDefaultRequestForm())
    requestForm.itemName = data.itemName
    requestForm.isLocked = data.isLocked
    responseDefList.value = []
    historyList.value = []
  }
}

// 点击树形控件外部空白处，取消选中状态
const handleWrapperClick = (e) => {
  // 如果点击的是树节点内容区域（包括展开箭头、标签等），则不处理，交给 el-tree 自身逻辑
  if (e.target.closest('.el-tree-node__content')) return

  // 优化：如果当前未选中，则不重复重置
  if (!currentNodeId.value) return

  // 否则视为点击了空白处，清除选中状态
  treeRef.value.setCurrentKey(null)
  currentNodeId.value = null
  currentNodeType.value = null
  Object.assign(requestForm, getDefaultRequestForm())
  responseDefList.value = [] // 修复：同时清空响应定义列表
  responseInfo.value = null
}

// 加载历史记录
const getHistory = async () => {
  if (!currentNodeId.value) return
  historyLoading.value = true
  try {
    const res = await listHistory({ itemId: currentNodeId.value })
    historyList.value = res.rows || []
  } finally {
    historyLoading.value = false
  }
}

// 还原历史快照
const handleRestoreHistory = (row) => {
  proxy.$modal.confirm('还原快照将覆盖当前编辑器的所有参数，是否确认？').then(() => {
    if (!row.snapshotJson || row.snapshotJson === 'undefined') {
      proxy.$modal.msgError('该历史记录不包含快照数据')
      return
    }
    try {
      const snapshot = JSON.parse(row.snapshotJson)
      if (!snapshot || typeof snapshot !== 'object') return

      requestForm.protocol = snapshot.protocol || 'http'
      requestForm.method = snapshot.method || 'GET'
      requestForm.params = Array.isArray(snapshot.params) ? snapshot.params : []
      requestForm.headers = Array.isArray(snapshot.headers) ? snapshot.headers : []
      requestForm.pathParams = Array.isArray(snapshot.pathParams) ? snapshot.pathParams : []
      requestForm.bodyType = snapshot.bodyType || 'none'
      requestForm.bodyJson = snapshot.bodyJson || ''
      requestForm.formData = Array.isArray(snapshot.formData) ? snapshot.formData : []
      requestForm.url = snapshot.url || ''

      activeReqTab.value = requestForm.bodyType !== 'none' ? 'body' : 'params'
      proxy.$modal.msgSuccess('已从历史记录还原参数')
    } catch (e) {
      proxy.$modal.msgError('快照数据解析失败')
    }
  })
}

// 表格行操作
const addRow = (list) => {
  list.push({ active: true, key: '', value: '', desc: '' })
}

const removeRow = (list, index) => {
  list.splice(index, 1)
}

const commonHeaderKeys = [
  { value: 'Accept' }, { value: 'Accept-Charset' }, { value: 'Accept-Encoding' }, { value: 'Accept-Language' },
  { value: 'Authorization' }, { value: 'Cache-Control' }, { value: 'Connection' }, { value: 'Content-Length' },
  { value: 'Content-Type' }, { value: 'Cookie' }, { value: 'Date' }, { value: 'Expect' }, { value: 'Host' },
  { value: 'If-Match' }, { value: 'If-Modified-Since' }, { value: 'If-None-Match' }, { value: 'Origin' },
  { value: 'Pragma' }, { value: 'Referer' }, { value: 'User-Agent' }, { value: 'X-Requested-With' }, { value: 'X-Forwarded-For' }
]

const commonHeaderValues = {
  'content-type': [
    { value: 'application/json' }, { value: 'application/x-www-form-urlencoded' },
    { value: 'multipart/form-data' }, { value: 'text/html' }, { value: 'text/plain' }
  ],
  'accept': [
    { value: 'application/json' }, { value: '*/*' }, { value: 'text/html' }, { value: 'text/plain' }
  ],
  'cache-control': [
    { value: 'no-cache' }, { value: 'no-store' }, { value: 'max-age=0' }
  ],
  'connection': [
    { value: 'keep-alive' }, { value: 'close' }
  ]
}

const queryHeaderSearch = (queryString, cb) => {
  const results = queryString ? commonHeaderKeys.filter(h => h.value.toLowerCase().includes(queryString.toLowerCase())) : commonHeaderKeys
  cb(results)
}

const queryHeaderValueSearch = (row, queryString, cb) => {
  const key = row && row.key ? row.key.toLowerCase() : ''
  const suggestions = commonHeaderValues[key] || []
  const results = queryString ? suggestions.filter(s => s.value.toLowerCase().includes(queryString.toLowerCase())) : suggestions
  cb(results)
}

// 简单的 XML 格式化函数
function formatXml(xml) {
  let formatted = '';
  let reg = /(>)(<)(\/*)/g;
  xml = xml.replace(reg, '$1\r\n$2$3');
  let pad = 0;
  xml.split('\r\n').forEach(function (node) {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) pad -= 1;
    } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }
    let padding = '';
    for (let i = 0; i < pad; i++) padding += '  ';
    formatted += padding + node + '\r\n';
    pad += indent;
  });
  return formatted.trim();
}

const handleFormat = () => {
  if (!requestForm.bodyJson || !requestForm.bodyJson.trim()) {
    proxy.$modal.msgInfo('当前内容为空，无需格式化')
    return
  }
  try {
    if (requestForm.protocol === 'webservice' || requestForm.bodyJson.trim().startsWith('<')) {
      requestForm.bodyJson = formatXml(requestForm.bodyJson)
      proxy.$modal.msgSuccess('XML 格式化成功')
    } else {
      const obj = JSON.parse(requestForm.bodyJson)
      requestForm.bodyJson = JSON.stringify(obj, null, 2)
      proxy.$modal.msgSuccess('格式化成功')
    }
  } catch (e) {
    proxy.$modal.msgWarning('格式化失败，请检查语法')
  }
}

/** 手动格式化响应内容 - 用户自主选择 */
const handleFormatResponse = () => {
  if (!responseInfo.value || !responseInfo.value.data) return
  const rawData = responseInfo.value.data.trim()
  try {
    if (rawData.startsWith('<')) {
      responseInfo.value.data = formatXml(rawData)
      proxy.$modal.msgSuccess('XML 响应美化成功')
    } else {
      const obj = JSON.parse(rawData)
      responseInfo.value.data = JSON.stringify(obj, null, 2)
      proxy.$modal.msgSuccess('JSON 响应美化成功')
    }
  } catch (e) {
    proxy.$modal.msgWarning('当前响应内容不是标准的 JSON 或 XML，无法格式化')
  }
}

const replacePathParams = (url, pathParams) => {
  let newUrl = url
  pathParams.forEach(p => {
    if (p.key && p.value) {
      const escapedKey = p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      newUrl = newUrl.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), p.value)
    }
  })
  return newUrl
}

const handleSend = async () => {
  const url = requestForm.url ? requestForm.url.trim() : '';
  if (!url) {
    proxy.$modal.msgWarning('请输入接口地址')
    return
  }
  sendLoading.value = true
  let finalUrl = replacePathParams(url, requestForm.pathParams);
  const finalHeaders = requestForm.headers.filter(h => h.active && h.key)
  const headersObj = {}
  finalHeaders.forEach(h => headersObj[h.key] = h.value)
  try {
    const startTime = performance.now()
    const proxyPayload = {
      itemId: currentNodeId.value,
      method: requestForm.method,
      protocol: requestForm.protocol,
      url: finalUrl,
      headers: headersObj,
      params: {},
      body: '',
      bodyType: requestForm.bodyType,
      snapshotJson: JSON.stringify({
        protocol: requestForm.protocol,
        method: requestForm.method,
        url: requestForm.url,
        params: requestForm.params,
        headers: requestForm.headers,
        pathParams: requestForm.pathParams,
        bodyType: requestForm.bodyType,
        bodyJson: requestForm.bodyJson,
        formData: requestForm.formData
      })
    }
    // 统一交由后端处理参数构造
    const activeParams = requestForm.params.filter(p => p.active && p.key)
    activeParams.forEach(p => {
      proxyPayload.params[p.key] = p.value
    })

    if (['POST', 'PUT', 'DELETE'].includes(requestForm.method)) {
      if (requestForm.bodyType === 'json') {
        proxyPayload.body = requestForm.bodyJson
      } else if (requestForm.bodyType === 'form') {
        const formDataObj = {}
        requestForm.formData.filter(f => f.active && f.key).forEach(f => {
          formDataObj[f.key] = f.value
        })
        proxyPayload.body = formDataObj
      }
    }
    const res = await proxyRequest(proxyPayload)
    const actualResponse = res.data
    const endTime = performance.now()
    const duration = Math.round(endTime - startTime)
    let displayData = actualResponse.data

    // 如果后端因为 RestTemplate 转换原因返回了 Object，则转为紧凑 JSON 字符串，否则保持原样（String）
    if (displayData !== null && typeof displayData === 'object') {
      displayData = JSON.stringify(displayData);
    }

    responseInfo.value = {
      status: actualResponse.status,
      statusText: actualResponse.statusText || 'Error',
      time: duration,
      size: actualResponse.size,
      data: displayData
    }
    if (actualResponse.status === 0) {
      proxy.$modal.msgError('请求发送失败: ' + (typeof actualResponse.data === 'string' ? actualResponse.data : '网络或代理错误'))
    } else {
      proxy.$modal.msgSuccess(`请求完成 (Status: ${actualResponse.status})`)
    }
    getHistory()
  } catch (error) {
    console.error('Send Request Error:', error)
  } finally {
    sendLoading.value = false
  }
}

const buildApiData = (id) => {
  return {
    itemId: id,
    itemName: requestForm.itemName || '未命名接口',
    protocol: requestForm.protocol,
    reqUrl: requestForm.url,
    reqMethod: requestForm.method,
    reqParams: JSON.stringify(requestForm.params),
    reqHeaders: JSON.stringify(requestForm.headers),
    reqPathParams: JSON.stringify(requestForm.pathParams),
    reqFormData: JSON.stringify(requestForm.formData),
    responseDef: JSON.stringify(responseDefList.value),
    reqBodyType: requestForm.bodyType,
    reqBodyJson: requestForm.bodyJson,
    isLocked: requestForm.isLocked ? 1 : 0
  }
}

const handleSave = async () => {
  if (requestForm.isLocked) {
    proxy.$modal.msgWarning('当前接口已被锁定，无法修改')
    return
  }
  if (!currentNodeId.value) {
    proxy.$modal.msgWarning('请先选择一个接口节点')
    return
  }
  if (!requestForm.itemName) {
    proxy.$modal.msgWarning('接口名称不能为空')
    return
  }
  if (!requestForm.url || !requestForm.url.trim()) {
    proxy.$modal.msgWarning('接口地址不能为空')
    return
  }
  const saveData = buildApiData(currentNodeId.value)

  // 深度测试修复：保存时同样增加协议头确认逻辑，防止规避
  if (saveData.reqUrl && !saveData.reqUrl.toLowerCase().startsWith('http')) {
    try {
      await proxy.$modal.confirm('当前接口地址未以 http:// 或 https:// 开头，可能导致代理请求失败，是否确认保存？', '确认提示', {
        confirmButtonText: '确定保存',
        cancelButtonText: '返回修改',
        type: 'warning'
      })
    } catch (e) {
      return
    }
  }

  updateApi(saveData).then(() => {
    proxy.$modal.msgSuccess('接口信息已保存')
    getTreeData()
  })
}

const handleExportDoc = (nodeData = null) => {
  if (!nodeData && !currentNodeId.value) {
    proxy.$modal.msgWarning('请先选择(或右键点击)要导出的接口或分组')
    return
  }
  const generateMd = (nodes, level = 1) => {
    let md = ''
    for (const node of nodes) {
      const prefix = '#'.repeat(level)
      md += `${prefix} ${node.itemName}\n\n`

      if (node.itemType === 'api') {
        md += `**基本信息**\n\n`
        md += `- **协议类型**: \`${(node.protocol || 'http').toUpperCase()}\`\n`
        md += `- **请求方式**: \`${node.reqMethod || 'GET'}\`\n`
        md += `- **接口地址**: \`${node.reqUrl || '-'}\`\n\n`

        // 1. Path Variables
        const pathParams = parseJson(node.reqPathParams)
        if (pathParams && pathParams.length > 0) {
          md += `**路径参数 (Path Variables)**\n\n| 参数名 | 示例值 | 描述 |\n| --- | --- | --- |\n`
          pathParams.forEach(p => {
            md += `| ${p.key || '-'} | ${p.value || '-'} | ${p.desc || '-'} |\n`
          })
          md += `\n`
        }

        // 2. Query Params
        const params = parseJson(node.reqParams)
        if (params && params.length > 0 && params.some(p => p.active)) {
          md += `**Query 参数**\n\n| 参数名 | 示例值 | 描述 |\n| --- | --- | --- |\n`
          params.filter(p => p.active).forEach(p => {
            md += `| ${p.key} | ${p.value} | ${p.desc || '-'} |\n`
          })
          md += `\n`
        }

        // 3. Headers
        const headers = parseJson(node.reqHeaders)
        if (headers && headers.length > 0 && headers.some(h => h.active)) {
          md += `**请求头 (Headers)**\n\n| 参数名 | 示例值 | 描述 |\n| --- | --- | --- |\n`
          headers.filter(h => h.active).forEach(h => {
            md += `| ${h.key} | ${h.value} | ${h.desc || '-'} |\n`
          })
          md += `\n`
        }

        // 4. Request Body
        if (node.reqBodyType === 'json' || node.protocol === 'webservice') {
          const lang = node.protocol === 'webservice' ? 'xml' : 'json'
          if (node.reqBodyJson && node.reqBodyJson.trim() !== '') {
            md += `**请求体 (${lang.toUpperCase()})**\n\n\`\`\`${lang}\n${node.reqBodyJson}\n\`\`\`\n\n`
          }
        } else if (node.reqBodyType === 'form') {
          const formData = parseJson(node.reqFormData)
          if (formData && formData.length > 0 && formData.some(f => f.active)) {
            md += `**请求体 (Form-Data)**\n\n| 参数名 | 示例值 | 描述 |\n| --- | --- | --- |\n`
            formData.filter(f => f.active).forEach(f => {
              md += `| ${f.key} | ${f.value} | ${f.desc || '-'} |\n`
            })
            md += `\n`
          }
        }

        // 5. Response Definition
        const resDef = parseJson(node.responseDef)
        if (resDef && resDef.length > 0) {
          md += `**响应定义 (Response Structure)**\n\n| 字段名 | 类型 | 说明 |\n| --- | --- | --- |\n`
          resDef.forEach(r => {
            md += `| ${r.key} | ${r.type} | ${r.desc || '-'} |\n`
          })
          md += `\n`
        }
      }

      // 递归处理子节点 (如果是分组)
      if (node.children && node.children.length > 0) {
        md += generateMd(node.children, level + 1)
      }
      md += `\n---\n\n`
    }
    return md
  }

  const findNode = (nodes, id) => {
    for (const node of nodes) {
      if (String(node.itemId) === String(id)) return node
      if (node.children) {
        const found = findNode(node.children, id)
        if (found) return found
      }
    }
    return null
  }
  let targetNode = nodeData
  if (!targetNode) {
    targetNode = findNode(apiTreeData.value, currentNodeId.value)
  }
  if (!targetNode) return
  const markdownContent = generateMd([targetNode])
  const blob = new Blob([markdownContent], { type: 'text/markdown' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${targetNode.itemName}.md`
  link.click()
  URL.revokeObjectURL(link.href)

  proxy.$modal.msgSuccess('文档导出成功')
}

const handleCopyResponse = () => {
  if (responseInfo.value && responseInfo.value.data) {
    navigator.clipboard.writeText(responseInfo.value.data).then(() => {
      proxy.$modal.msgSuccess('复制成功')
    }).catch(() => {
      proxy.$modal.msgError('复制失败，请手动复制')
    })
  }
}

const handleImportResponse = () => {
  if (!responseInfo.value || !responseInfo.value.data) {
    proxy.$modal.msgWarning('暂无响应数据')
    return
  }
  try {
    const json = parseJson(responseInfo.value.data)
    const flattened = flattenJson(json)
    if (flattened.length === 0) {
      proxy.$modal.msgWarning('响应内容不是标准 JSON 或为空，无法提取结构')
      return
    }
    responseDefList.value = flattened
    activeReqTab.value = 'responseDef'
    proxy.$modal.msgSuccess('响应结构导入成功')
  } catch (e) {
    proxy.$modal.msgError('解析响应JSON失败')
  }
}

const flattenJson = (obj, prefix = '', depth = 0) => {
  let result = []
  // 深度限制，防止恶意 JSON 导致递归死循环
  if (typeof obj !== 'object' || obj === null || depth > 10) return result

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
      result = result.concat(flattenJson(value, fullKey, depth + 1))
    } else if (type === 'Array' && value.length > 0 && typeof value[0] === 'object') {
      result = result.concat(flattenJson(value[0], fullKey + '[0]', depth + 1))
    }
  }
  return result
}

const execDeleteNode = (node) => {
  const data = node.data
  const isGroup = data.itemType === 'group'
  const confirmMsg = isGroup
    ? `确认要删除分组 "${data.itemName}" 及其包含的所有子目录和接口吗？此操作将同步清除所有关联的请求历史且无法恢复！`
    : `确认要删除接口 "${data.itemName}" 吗？相关的请求历史也将被一并清除。`

  proxy.$modal.confirm(confirmMsg, "警告", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    delApi(data.itemId).then(() => {
      proxy.$modal.msgSuccess('删除成功')
      getTreeData()
      if (currentNodeId.value === data.itemId) {
        currentNodeId.value = null
        currentNodeType.value = null
        Object.assign(requestForm, getDefaultRequestForm())
        responseInfo.value = null // 优化：清理响应信息
        responseDefList.value = [] // 优化：清理响应定义
        activeReqTab.value = 'params' // 状态彻底回滚
        activeResTab.value = 'response'
      }
    })
  }).catch(() => { })
}

const handleNodeContextMenu = (event, data, node) => {
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
      if (node.data.itemType === 'api') {
        proxy.$modal.msgWarning('接口节点下不能再添加子节点')
        return
      }
      handleCreate(node)
      break
    case 'rename':
      if (node.data.isLocked) {
        proxy.$modal.msgWarning('该节点已被锁定，无法重命名')
        return
      }
      ElMessageBox.prompt('请输入新的名称', '重命名', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: node.label,
      }).then(({ value }) => {
        updateApi({ itemId: node.data.itemId, itemName: value }).then(() => {
          proxy.$modal.msgSuccess('重命名成功')
          getTreeData()
          if (currentNodeId.value === node.data.itemId) {
            requestForm.itemName = value
          }
        })
      }).catch(() => { })
      break
    case 'delete':
      execDeleteNode(node)
      break
    case 'exportDoc':
      handleExportDoc(node.data)
      break
    case 'toggleLock':
      const newLockState = node.data.isLocked ? 0 : 1
      toggleLock(node.data.itemId, newLockState).then(() => {
        proxy.$modal.msgSuccess(newLockState ? '锁定成功' : '解锁成功')
        getTreeData()
        if (currentNodeId.value === node.data.itemId) {
          requestForm.isLocked = !!newLockState
        }
      })
      break
  }
}

// 表单重置
function reset() {
  createForm.value = {
    itemType: 'group',
    protocol: 'http',
    itemName: '',
    reqMethod: 'GET',
    reqUrl: ''
  }
  proxy.resetForm("createFormRef")
}
const createFormRef = ref(null)
const handleCreate = (parentNode = null) => {
  reset()
  createDialogVisible.value = true
  if (parentNode && parentNode.data) {
    createParentNode.value = parentNode
  } else {
    createParentNode.value = null
  }
}

const submitCreate = async () => {
  if (!createFormRef.value) return

  try {
    await createFormRef.value.validate()
  } catch (e) {
    return // 校验失败，停止执行
  }

  const postData = {
    itemName: createForm.value.itemName,
    itemType: createForm.value.itemType,
    protocol: createForm.value.protocol,
    parentId: createParentNode.value ? createParentNode.value.data.itemId : 0
  }

  if (createForm.value.itemType === 'api') {
    // WebService 协议下强制记录为 POST
    postData.reqMethod = createForm.value.protocol === 'webservice' ? 'POST' : createForm.value.reqMethod
    postData.reqUrl = createForm.value.reqUrl

    // 修正：如果 reqUrl 不包含协议头，弹出确认框要求用户确认
    if (postData.reqUrl && !postData.reqUrl.toLowerCase().startsWith('http')) {
      try {
        await proxy.$modal.confirm('当前接口地址未以 http:// 或 https:// 开头，可能导致代理请求失败，是否确认创建？', '确认提示', {
          confirmButtonText: '确定创建',
          cancelButtonText: '返回修改',
          type: 'warning'
        })
      } catch (e) {
        return // 用户选择取消，终止创建流程
      }
    }
  }

  try {
    await addApi(postData)
    proxy.$modal.msgSuccess('创建成功')
    createDialogVisible.value = false
    await getTreeData()

    // 自动展开父节点 (确保能看到刚新增的子节点)
    if (postData.parentId) {
      const node = treeRef.value.getNode(postData.parentId)
      if (node) node.expanded = true
    }
  } catch (e) {
    console.error(e)
    // 发生错误时不关闭弹窗，允许用户重试
  }
}

// --- 拖拽功能逻辑 ---

// 拖拽规则控制
const allowDrop = (draggingNode, dropNode, type) => {
  // type: 'prev' (前), 'inner' (内), 'next' (后)
  if (type === 'inner') {
    // 1. 只有“分组”节点允许被插入内部
    // 2. 深度测试优化：如果目标分组已锁定，禁止在 UI 上执行拖入操作
    if (dropNode.data.isLocked) {
      return false
    }
    return dropNode.data.itemType === 'group'
  }
  return true
}
const handleNodeDrop = (draggingNode, dropNode, dropType) => {
  let newParentId = 0
  if (dropType === 'inner') {
    newParentId = dropNode.data.itemId
  } else {
    newParentId = dropNode.data.parentId
  }
  updateApi({ itemId: draggingNode.data.itemId, parentId: newParentId }).then(() => {
    proxy.$modal.msgSuccess('移动成功')
    getTreeData() // 刷新树结构，确保父子关系即时更新
  }).catch(() => {
    getTreeData()
  })
}

onMounted(() => {
  getTreeData()
})
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
  background: rgba(0, 0, 0, 0.02);
  /* 建议2：增加极轻微遮罩，提升交互感 */
}

/* Splitpanes 样式适配 */
:deep(.splitpanes.default-theme) {
  .splitpanes__splitter {
    background-color: var(--el-border-color-extra-light);
    border-left: 1px solid var(--el-border-color-lighter);
    box-sizing: border-box;
    width: 6px;

    &:hover {
      background-color: var(--el-color-primary-light-7);
    }
  }
}

.api-manager-container {
  height: calc(100vh - 84px);
  display: flex;
  overflow: hidden;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

.sidebar {
  flex: 0 0 20%;
  min-width: 250px;
  max-width: 400px;
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;

  .sidebar-header {
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--el-border-color);
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  .sidebar-search {
    padding: 10px;
    border-bottom: 1px solid var(--el-border-color);

    :deep(.el-input__wrapper) {
      box-shadow: none;
      background: transparent;
    }
  }

  .api-tree-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 5px 0;

    :deep(.el-tree-node__content) {
      height: 34px;
    }

    :deep(.el-tree-node__content:hover) {
      background-color: var(--el-fill-color-lighter);
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background-color: var(--el-color-primary-light-8) !important;
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
    flex-shrink: 0;
  }

  .folder-icon {
    margin-right: 6px;
    color: var(--el-text-color-secondary);
  }

  .node-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .lock-icon {
    margin-left: 4px;
    color: var(--el-color-warning);
  }
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace {
  flex: 1;
  width: 100%;
  overflow: hidden;
}

.request-header-bar {
  padding: 15px 15px 10px 15px;
  background-color: var(--el-bg-color);

  .url-input-container {
    display: flex;
    gap: 10px;

    .el-input {
      flex: 1;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }
  }
}

.locked-form {
  opacity: 0.6;
}

.request-panel,
.response-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.panel-content {
  padding: 10px;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
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
    overflow: hidden;

    .status-tag {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .meta-item {
      color: var(--el-text-color-secondary);
      flex-shrink: 0;
    }
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }
}

:deep(.custom-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;

  .el-tabs__header {
    margin: 0;
    background-color: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color);
    padding: 0 15px;
  }

  .el-tabs__nav-wrap::after {
    display: none;
  }

  .el-tabs__item {
    height: 38px;
    line-height: 38px;
    font-weight: normal;
  }

  .el-tabs__content {
    flex: 1;
    overflow: hidden;
  }

  .el-tab-pane {
    height: 100%;
  }
}

:deep(.el-table) {
  width: 100% !important;

  .el-table__row .el-input__wrapper {
    box-shadow: none;
    padding: 0;
    background-color: transparent;
  }
}
</style>