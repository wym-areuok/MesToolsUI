<template>
  <div class="api-manager-container">
    <!-- 左侧侧边栏：接口树 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <span>接口列表</span>
        <div>
          <el-button type="primary" link icon="Plus" size="small" @click="handleCreate"
            v-hasPermi="['dailyTools:apiManage:add']">新建</el-button>
          <el-tooltip content="快捷请求 (草稿模式)" placement="top">
            <el-button type="warning" link icon="Lightning" size="small" @click="handleShortcutMode"
              style="margin-left: 5px"></el-button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleMoreCommand">
            <el-button type="primary" link icon="More" size="small" style="margin-left: 5px"></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="import" icon="Upload"
                  v-hasPermi="['dailyTools:apiManage:import']">导入备份</el-dropdown-item>
                <el-dropdown-item command="export" icon="Download"
                  v-hasPermi="['dailyTools:apiManage:export']">导出备份</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
              <el-tag v-if="data.itemType === 'api'" size="small" :type="getMethodType(data.reqMethod)"
                class="method-tag">{{
                  data.reqMethod }}</el-tag>
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
        <div class="menu-item" @click="handleContextMenu('addChild')" v-hasPermi="['dailyTools:apiManage:add']">
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

    <!-- 右侧主内容区 -->
    <div class="main-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar" v-loading="loading">
        <el-row :gutter="10" align="middle">
          <el-col :span="24" v-if="currentMode === 'scratch'" style="margin-bottom: 10px;">
            <el-alert title="当前为快捷请求模式，数据暂存于本地。点击“保存”可将其添加到接口列表中。" type="warning" show-icon :closable="false"
              style="padding: 8px;" />
          </el-col>
          <el-col :span="24" v-if="currentMode === 'tree' && requestForm.isLocked" style="margin-bottom: 10px;">
            <el-alert title="此接口已被锁定，无法进行编辑和删除操作。如需修改，请先在左侧树右键解锁。" type="info" show-icon :closable="false"
              style="padding: 8px;" />
          </el-col>
          <!-- 环境选择 -->
          <el-col :span="4">
            <div style="display: flex; gap: 5px;">
              <el-select v-model="currentItemKey" placeholder="选择环境" style="width: 100%" clearable>
                <el-option label="未设定 (自定义)" value="" />
                <el-option v-for="env in envList" :key="env.itemKey" :label="env.itemName" :value="env.itemKey" />
              </el-select>
              <el-button icon="Setting" circle @click="openEnvManager" title="环境管理" />
            </div>
          </el-col>

          <!-- URL 输入区 -->
          <el-col :span="14">
            <div style="display: flex; gap: 10px;" :class="{ 'locked-form': requestForm.isLocked }">
              <el-input v-model="requestForm.itemName" placeholder="接口名称" style="width: 180px"
                :disabled="requestForm.isLocked" />
              <el-input v-model="requestForm.url" :placeholder="urlPlaceholder" style="flex: 1"
                :disabled="requestForm.isLocked">
                <template #prepend>
                  <el-select v-model="requestForm.method" style="width: 105px" :disabled="requestForm.isLocked">
                    <el-option label="GET" value="GET">
                      <span style="color: var(--el-color-success); font-weight: bold">GET</span>
                    </el-option>
                    <el-option label="POST" value="POST">
                      <span style="color: var(--el-color-warning); font-weight: bold">POST</span>
                    </el-option>
                    <el-option label="PUT" value="PUT">
                      <span style="color: var(--el-color-primary); font-weight: bold">PUT</span>
                    </el-option>
                    <el-option label="DELETE" value="DELETE">
                      <span style="color: var(--el-color-danger); font-weight: bold">DELETE</span>
                    </el-option>
                  </el-select>
                </template>
              </el-input>
            </div>
          </el-col>

          <!-- 操作按钮 -->
          <el-col :span="6">
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <el-button type="primary" icon="Promotion" @click="handleSend" :loading="loading">发送</el-button>
              <el-button type="success" plain icon="FolderChecked" @click="handleSave"
                v-hasPermi="['dailyTools:apiManage:add', 'dailyTools:apiManage:edit']"
                :disabled="requestForm.isLocked">{{
                  currentMode === 'scratch' ? '另存为' : '保存' }}</el-button>
              <el-button type="info" plain icon="Download" @click="handleCurlImport">cURL</el-button>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 核心工作区 -->
      <div class="workspace" v-loading="loading">
        <splitpanes class="default-theme">
          <!-- 左侧：请求配置 -->
          <pane :size="60">
            <div class="request-panel">
              <el-tabs v-model="activeReqTab" class="custom-tabs">
                <el-tab-pane label="Auth" name="auth">
                  <div class="panel-content">
                    <div class="section-desc" :class="{ 'locked-form': requestForm.isLocked }">Authorization (鉴权)</div>
                    <el-form label-position="top" size="small">
                      <el-form-item label="Type">
                        <el-select v-model="requestForm.authType" style="width: 200px" :disabled="requestForm.isLocked">
                          <el-option label="No Auth" value="none" />
                          <el-option label="Bearer Token" value="bearer" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="Token" v-if="requestForm.authType === 'bearer'">
                        <el-input v-model="requestForm.authToken" type="textarea" :rows="3"
                          :disabled="requestForm.isLocked" placeholder="请输入 Token 或变量 {{token}}" />
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
                            <el-input v-model="scope.row.value" placeholder="Value" :disabled="requestForm.isLocked" />
                          </template>
                        </el-table-column>
                        <el-table-column label="Description">
                          <template #default="scope">
                            <el-input v-model="scope.row.desc" placeholder="描述" :disabled="requestForm.isLocked" />
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                    <div class="section-desc">Query Params (URL 参数)</div>
                    <el-table :data="requestForm.params" style="width: 100%" size="small" border>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-checkbox v-model="scope.row.active" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Key" width="200">
                        <template #default="scope">
                          <el-input v-model="scope.row.key" placeholder="Key" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Value" width="200">
                        <template #default="scope">
                          <el-autocomplete v-model="scope.row.value"
                            :fetch-suggestions="(qs, cb) => queryHeaderValueSearch(scope.row, qs, cb)"
                            placeholder="Value" style="width: 100%" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Description">
                        <template #default="scope">
                          <el-input v-model="scope.row.desc" placeholder="描述" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-button link type="danger" icon="Delete"
                            @click="removeRow(requestForm.params, scope.$index)" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                    </el-table>
                    <el-button link type="primary" icon="Plus" @click="addRow(requestForm.params)"
                      :disabled="requestForm.isLocked">添加参数</el-button>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="Headers" name="headers">
                  <div class="panel-content">
                    <div class="section-desc" :class="{ 'locked-form': requestForm.isLocked }">Request Headers</div>
                    <el-table :data="requestForm.headers" style="width: 100%" size="small" border>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-checkbox v-model="scope.row.active" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Key" width="200">
                        <template #default="scope">
                          <el-autocomplete v-model="scope.row.key" :fetch-suggestions="queryHeaderSearch"
                            :disabled="requestForm.isLocked" placeholder="Key" style="width: 100%" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Value" width="200">
                        <template #default="scope">
                          <el-input v-model="scope.row.value" placeholder="Value" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                      <el-table-column label="Description">
                        <template #default="scope">
                          <el-input v-model="scope.row.desc" placeholder="描述" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                      <el-table-column width="50" align="center">
                        <template #default="scope">
                          <el-button link type="danger" icon="Delete"
                            @click="removeRow(requestForm.headers, scope.$index)" :disabled="requestForm.isLocked" />
                        </template>
                      </el-table-column>
                    </el-table>
                    <el-button link type="primary" icon="Plus" @click="addRow(requestForm.headers)"
                      :disabled="requestForm.isLocked">添加
                      Header</el-button>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="Body" name="body">
                  <div class="panel-content body-content">
                    <div class="body-toolbar">
                      <el-radio-group v-model="requestForm.bodyType" size="small" :disabled="requestForm.isLocked">
                        <el-radio-button label="none">none</el-radio-button>
                        <el-radio-button label="json">raw (json)</el-radio-button>
                        <el-radio-button label="form">form-data</el-radio-button>
                      </el-radio-group>
                      <el-button link type="primary" size="small" @click="formatJson"
                        :disabled="requestForm.isLocked">格式化
                        JSON</el-button>
                    </div>
                    <div class="editor-wrapper" v-if="requestForm.bodyType === 'json'">
                      <codemirror v-model="requestForm.bodyJson" placeholder="请输入 JSON..." :style="{ height: '100%' }"
                        :autofocus="true" :indent-with-tab="true" :tab-size="2" :extensions="extensions"
                        :disabled="requestForm.isLocked" />
                    </div>
                    <div v-else-if="requestForm.bodyType === 'form'" class="panel-content" style="padding-top: 0;">
                      <el-table :data="requestForm.formData" style="width: 100%" size="small" border>
                        <el-table-column width="50" align="center">
                          <template #default="scope">
                            <el-checkbox v-model="scope.row.active" :disabled="requestForm.isLocked" />
                          </template>
                        </el-table-column>
                        <el-table-column label="Key" width="200">
                          <template #default="scope">
                            <el-input v-model="scope.row.key" placeholder="Key" :disabled="requestForm.isLocked" />
                          </template>
                        </el-table-column>
                        <el-table-column label="Value">
                          <template #default="scope">
                            <el-input v-model="scope.row.value" placeholder="Value" :disabled="requestForm.isLocked" />
                          </template>
                        </el-table-column>
                        <el-table-column width="50" align="center">
                          <template #default="scope">
                            <el-button link type="danger" icon="Delete" :disabled="requestForm.isLocked"
                              @click="removeRow(requestForm.formData, scope.$index)" />
                          </template>
                        </el-table-column>
                      </el-table>
                      <el-button link type="primary" icon="Plus" @click="addRow(requestForm.formData)"
                        :disabled="requestForm.isLocked">添加参数</el-button>
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
                        @click="handleCopyResponse">复制</el-button>
                      <el-button type="primary" link size="small" @click="handleImportResponse">导入为响应结构</el-button>
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
                      <iframe :srcdoc="responseInfo.data" sandbox="allow-scripts"
                        style="width: 100%; height: 100%; border: none;"></iframe>
                    </div>
                    <el-empty v-else description="点击发送查看响应" :image-size="80" />
                  </div>
                </el-tab-pane>
                <el-tab-pane label="测试历史" name="history">
                  <div class="panel-content">
                    <el-timeline style="padding: 10px;">
                      <el-timeline-item v-for="(item, index) in historyList" :key="index"
                        :type="item.resStatus === 200 ? 'success' : 'danger'" :timestamp="item.createTime"
                        placement="top">
                        <el-card class="history-card" shadow="hover" @click="restoreHistory(item)">
                          <h4>{{ item.reqMethod }} {{ item.reqUrl }}</h4>
                          <p>状态: {{ item.resStatus }} | 耗时: {{ item.duration }}ms</p>
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
        <el-form-item label="类型" prop="itemType">
          <el-radio-group v-model="createForm.itemType">
            <el-radio v-for="item in nodeTypeOptions" :key="item.value" :label="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" prop="itemName">
          <el-input v-model="createForm.itemName" placeholder="请输入名称" />
        </el-form-item>
        <template v-if="createForm.itemType === 'api'">
          <el-form-item label="请求方式" prop="reqMethod">
            <el-select v-model="createForm.reqMethod" placeholder="请选择">
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </el-form-item>
          <el-form-item label="接口地址" prop="reqUrl">
            <el-input v-model="createForm.reqUrl" placeholder="/path/to/api" />
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
        <el-table-column prop="itemName" label="环境名称">
          <template #default="{ row }">
            <el-input v-model="row.itemName" placeholder="如: 测试环境" />
          </template>
        </el-table-column>
        <el-table-column prop="itemKey" label="Key (唯一)">
          <template #default="{ row }">
            <el-input v-model="row.itemKey" placeholder="如: test" />
          </template>
        </el-table-column>
        <el-table-column prop="reqUrl" label="Base URL">
          <template #default="{ row }">
            <el-input v-model="row.reqUrl" placeholder="http://..." />
          </template>
        </el-table-column>
        <el-table-column prop="reqBodyJson" label="环境变量 (JSON)">
          <template #default="{ row }">
            <el-input v-model="row.reqBodyJson" placeholder='{"token": "..."}' />
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

    <!-- 另存为弹窗 (快捷请求保存) -->
    <el-dialog v-model="saveAsDialogVisible" title="保存为新接口" width="500px">
      <el-form :model="saveAsForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="saveAsForm.itemName" placeholder="请输入接口名称" />
        </el-form-item>
        <el-form-item label="目标分组">
          <el-tree-select v-model="saveAsForm.parentId" :data="groupTreeOptions"
            :props="{ label: 'itemName', value: 'itemId', children: 'children', disabled: 'disabled' }" check-strictly
            :render-after-expand="false" placeholder="请选择分组 (留空为根目录)" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="saveAsDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitSaveAs">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 隐藏的文件输入框，用于导入 -->
    <input type="file" ref="importFileRef" style="display: none" @change="handleImportFileChange" accept=".json" />
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
  listApiTree,
  getApi,
  addApi,
  updateApi,
  delApi,
  listEnv,
  saveEnvList,
  proxyRequest,
  listHistory,
  exportData,
  importData,
  toggleLock
} from '@/api/dailyTools/apiManage'

// --- Ruoyi Style: 获取全局代理 ---
const { proxy } = getCurrentInstance()

// --- 状态定义 ---
const filterText = ref('')
const treeRef = ref(null)
const currentItemKey = ref('')
const loading = ref(false)
const envDialogVisible = ref(false)
const envList = ref([])
const activeReqTab = ref('auth')
const activeResTab = ref('response')
const responseViewMode = ref('pretty')
const curlDialogVisible = ref(false)
const curlInput = ref('')
const createDialogVisible = ref(false)
const saveAsDialogVisible = ref(false)
const currentMode = ref('tree') // 'tree' | 'scratch'
const saveAsForm = reactive({ parentId: 0, itemName: '' })
const importFileRef = ref(null)

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
const createParentNode = ref(null) // 用于存储新建时的父节点

// Codemirror 扩展
const extensions = [json()]

// 接口树数据 (模拟)
const apiTreeData = ref([])

const defaultProps = {
  children: 'children',
  label: 'itemName'
}

// 计算属性：仅包含分组的树结构 (用于另存为选择父节点)
const groupTreeOptions = computed(() => {
  const disableApi = (nodes) => {
    return nodes.map(node => {
      const newNode = { ...node }
      if (newNode.itemType === 'api') {
        newNode.disabled = true // 禁止选择接口作为父节点
      }
      if (newNode.children && newNode.children.length > 0) {
        newNode.children = disableApi(newNode.children)
      }
      return newNode
    })
  }
  return disableApi(apiTreeData.value)
})

// --- 优化：提取默认表单数据工厂函数 ---
const getDefaultRequestForm = () => ({
  itemName: '',
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
  bodyJson: '{\n  \n}',
  responseDef: [], // 修复：确保重置时能清空响应定义
  isLocked: 0
})

// 请求表单数据
const requestForm = reactive(getDefaultRequestForm())

// 环境配置初始化
const initEnvs = async () => {
  try {
    const res = await listEnv()
    envList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

// 获取树数据
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
  apiTreeData.value = res.data || []

  // 2. 恢复展开状态
  await nextTick()
  if (treeRef.value) {
    expandedKeys.forEach(key => {
      const node = treeRef.value.getNode(key)
      if (node) node.expanded = true
    })
  }
}

const currentBaseUrl = computed(() => {
  const env = envList.value.find(e => e.itemKey === currentItemKey.value)
  return env ? env.reqUrl : ''
})

const urlPlaceholder = computed(() => {
  return currentItemKey.value ? '请输入接口路径 (如 /system/user)' : '请输入完整接口地址 (如 http://localhost/api...)'
})

// 响应信息
const responseInfo = ref(null)

// 历史记录
const historyList = ref([])

// 获取历史记录
const getHistory = async (itemId = null) => {
  try {
    const query = itemId ? { itemId } : (currentNodeId.value ? { itemId: currentNodeId.value } : {})
    const res = await listHistory(query)
    historyList.value = res.rows || []
  } catch (e) {
    console.error("获取历史记录失败", e)
  }
}

// --- Ruoyi Style: 统一管理数据 ---
const data = reactive({
  createForm: {
    itemType: 'group',
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

// --- 方法实现 ---

// 树节点过滤
watch(filterText, (val) => {
  treeRef.value.filter(val)
})

const filterNode = (value, data) => {
  if (!value) return true
  return data.itemName.includes(value) || (data.reqUrl && data.reqUrl.includes(value))
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
  envList.value.push({ itemName: '', itemKey: '', reqUrl: '', reqBodyJson: '{}', itemType: 'env' })
}

const removeEnvRow = (index) => {
  envList.value.splice(index, 1)
}

const saveEnvConfig = () => {
  if (envList.value.some(e => !e.itemName || !e.itemKey)) {
    proxy.$modal.msgWarning('环境名称和Key不能为空')
    return
  }
  // 校验 JSON 格式
  try {
    envList.value.forEach(e => e.reqBodyJson && JSON.parse(e.reqBodyJson))
  } catch (e) {
    proxy.$modal.msgWarning('变量必须是有效的 JSON 格式')
    return
  }
  saveEnvList(envList.value).then(() => {
    envDialogVisible.value = false
    proxy.$modal.msgSuccess('环境配置已保存')
  })
}

// 辅助函数：安全解析 JSON
const parseJson = (str) => {
  if (!str) return []
  if (typeof str === 'object') return str // 已经是对象则直接返回
  try { return JSON.parse(str) } catch (e) { return [] }
}

const handleNodeClick = async (data) => {
  // 只有点击具体的接口节点（有method属性）才加载数据
  if (data.itemType === 'api') {
    currentNodeId.value = data.itemId
    currentMode.value = 'tree' // 切换回树模式

    // 切换节点时，先清空旧的响应和历史，避免混淆
    responseInfo.value = null
    historyList.value = []

    // 获取最新详情
    try {
      loading.value = true
      const res = await getApi(data.itemId)
      const apiData = res.data

      // 1. 重置表单
      Object.assign(requestForm, getDefaultRequestForm())
      responseDefList.value = []

      // 2. 回显数据 (映射后端字段到前端表单)
      requestForm.itemName = apiData.itemName
      requestForm.url = apiData.reqUrl
      requestForm.method = apiData.reqMethod


      // JSON 字段解析
      requestForm.params = parseJson(apiData.reqParams)
      requestForm.headers = parseJson(apiData.reqHeaders)
      requestForm.pathParams = parseJson(apiData.reqPathParams)
      requestForm.formData = parseJson(apiData.reqFormData)
      requestForm.responseDef = parseJson(apiData.responseDef)

      // 普通字段
      if (apiData.reqBodyType) requestForm.bodyType = apiData.reqBodyType
      if (apiData.reqBodyJson) requestForm.bodyJson = apiData.reqBodyJson
      if (apiData.authType) requestForm.authType = apiData.authType
      if (apiData.authToken) requestForm.authToken = apiData.authToken
      if (apiData.isLocked) requestForm.isLocked = apiData.isLocked

      // 兼容处理：如果 responseDef 解析出来是空的，赋值为空数组
      if (!requestForm.responseDef) responseDefList.value = []
      else responseDefList.value = requestForm.responseDef

      // 移除此处强制添加默认 Header 的逻辑，避免覆盖用户保存的“无 Header”状态
      // 默认 Header 仅在 getDefaultRequestForm 中初始化，用于新建或重置

      // 加载该接口的历史记录
      getHistory(data.itemId)
    } catch (error) {
      console.error(error)
      proxy.$modal.msgError('获取接口详情失败')
    } finally {
      loading.value = false
    }
  } else {
    // 点击分组时，记录ID以便导出，但清空表单防止误编辑
    currentNodeId.value = data.itemId
    currentMode.value = 'tree'
    Object.assign(requestForm, getDefaultRequestForm())
    responseDefList.value = []
  }
}

// 点击树形控件外部空白处，取消选中状态
const handleWrapperClick = (e) => {
  // 如果点击的是树节点内容区域（包括展开箭头、标签等），则不处理，交给 el-tree 自身逻辑
  if (e.target.closest('.el-tree-node__content')) return

  // 否则视为点击了空白处，清除选中状态
  treeRef.value.setCurrentKey(null)
  currentNodeId.value = null
  currentMode.value = 'tree' // 点击空白处也视为回到树模式(未选中状态)
  // 重置右侧表单
  Object.assign(requestForm, getDefaultRequestForm())
  responseDefList.value = [] // 修复：同时清空响应定义列表
  responseInfo.value = null
  historyList.value = []
}

// 切换到快捷请求模式
const handleShortcutMode = () => {
  currentMode.value = 'scratch'
  treeRef.value.setCurrentKey(null)
  currentNodeId.value = null
  Object.assign(requestForm, getDefaultRequestForm())
  responseDefList.value = []
  responseInfo.value = null
  historyList.value = []
  proxy.$modal.msgSuccess('已切换至快捷请求模式')
}

// 表格行操作
const addRow = (list) => {
  list.push({ active: true, key: '', value: '', desc: '' })
}

const removeRow = (list, index) => {
  list.splice(index, 1)
}

// --- UX优化: 增强的 Header 补全 ---
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
  const key = row.key ? row.key.toLowerCase() : ''
  const suggestions = commonHeaderValues[key] || []
  const results = queryString ? suggestions.filter(s => s.value.toLowerCase().includes(queryString.toLowerCase())) : suggestions
  cb(results)
}

// 格式化 JSON
const formatJson = () => {
  try {
    const obj = JSON.parse(requestForm.bodyJson)
    requestForm.bodyJson = JSON.stringify(obj, null, 2)
  } catch (e) {
    proxy.$modal.msgWarning('JSON 格式错误，无法格式化')
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
      // 修复：对 key 进行正则转义，防止特殊字符导致报错
      const escapedKey = p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      newUrl = newUrl.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), p.value)
    }
  })
  return newUrl
}

// 发送请求
const handleSend = async () => {
  // 1. 基础校验
  if (!requestForm.url) {
    proxy.$modal.msgWarning('请输入接口地址')
    return
  }

  // 2. JSON Body 校验 (仅在 POST/PUT/DELETE 且类型为 JSON 时)
  // 注意：如果包含 {{}} 变量，则跳过校验，防止因变量未替换而导致 JSON 解析失败
  if (['POST', 'PUT', 'DELETE'].includes(requestForm.method) && requestForm.bodyType === 'json') {
    const jsonStr = requestForm.bodyJson ? requestForm.bodyJson.trim() : ''
    if (jsonStr && !jsonStr.includes('{{')) {
      try {
        JSON.parse(jsonStr)
      } catch (e) {
        proxy.$modal.msgWarning('Body JSON 格式错误，请检查')
        return
      }
    }
  }

  loading.value = true

  // 1. 获取当前环境的变量
  let envVariables = {}
  const currentEnvObj = envList.value.find(e => e.itemKey === currentItemKey.value)
  if (currentEnvObj && currentEnvObj.reqBodyJson) {
    try {
      envVariables = JSON.parse(currentEnvObj.reqBodyJson)
    } catch (e) {
      console.error('环境变量解析失败', e)
    }
  }

  // 2. 执行变量替换 (URL, Headers, AuthToken, Body)
  // 注意：这里只替换用于发送的临时变量，不修改 requestForm 显示的值
  const resolvedUrl = replaceVariables(requestForm.url, envVariables)
  const resolvedBaseUrl = replaceVariables(currentBaseUrl.value, envVariables)

  let finalUrl = ''
  // 修复：如果 URL 是绝对路径，则忽略 Base URL
  if (/^https?:\/\//i.test(resolvedUrl)) {
    finalUrl = resolvedUrl
  } else {
    // 处理拼接时的斜杠问题
    const base = resolvedBaseUrl.replace(/\/$/, '')
    const path = resolvedUrl.replace(/^\//, '')
    finalUrl = base ? `${base}/${path}` : resolvedUrl
  }

  const finalAuthToken = replaceVariables(requestForm.authToken, envVariables)
  // 先替换 Path Params
  finalUrl = replacePathParams(finalUrl, requestForm.pathParams)

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

  // --- 真实请求逻辑 (建议) ---
  // 注意：纯前端直接请求会遇到 CORS 跨域问题。
  // 解决方案：通常需要配置 vite/webpack 的 proxy，或者后端提供一个转发接口。

  try {
    const startTime = Date.now()

    // 构造代理请求数据
    const proxyPayload = {
      itemId: currentNodeId.value,
      method: requestForm.method,
      url: finalUrl, // 此时 url 包含 path params，但不包含 query params
      headers: headersObj,
      params: {}, // Query Params 留空，改为手动拼接到 URL
      body: null, // Request Body
      bodyType: requestForm.bodyType,
      // 新增：传递UI快照用于历史记录
      snapshotJson: JSON.stringify(requestForm)
    }

    // 处理 Query Params (手动拼接以支持重复 Key，如 ?id=1&id=2)
    const activeParams = requestForm.params.filter(p => p.active && p.key)
    if (activeParams.length > 0) {
      const queryString = activeParams.map(p => {
        const key = p.key
        const val = replaceVariables(p.value, envVariables)
        return `${encodeURIComponent(key)}=${encodeURIComponent(val)}`
      }).join('&')

      if (proxyPayload.url.includes('?')) {
        proxyPayload.url += '&' + queryString
      } else {
        proxyPayload.url += '?' + queryString
      }
    }

    // 处理 Body
    if (['POST', 'PUT', 'DELETE'].includes(requestForm.method)) {
      if (requestForm.bodyType === 'json') {
        proxyPayload.body = replaceVariables(requestForm.bodyJson, envVariables)
      } else if (requestForm.bodyType === 'form') {
        const formDataObj = {}
        requestForm.formData.filter(f => f.active && f.key).forEach(f => {
          formDataObj[f.key] = replaceVariables(f.value, envVariables)
        })
        proxyPayload.body = formDataObj
      }
    }

    // 发送真实代理请求
    const res = await proxyRequest(proxyPayload)
    const actualResponse = res.data // 后端代理接口返回的真实响应

    const endTime = Date.now()
    const duration = endTime - startTime

    // 尝试格式化响应数据，以便在 Pretty 视图中显示
    let displayData = actualResponse.data
    if (typeof displayData === 'string') {
      try {
        displayData = JSON.stringify(JSON.parse(displayData), null, 2)
      } catch (e) { /* 不是JSON，保持原样 */ }
    } else if (typeof displayData === 'object') {
      displayData = JSON.stringify(displayData, null, 2)
    }

    loading.value = false
    responseInfo.value = {
      status: actualResponse.status,
      statusText: actualResponse.statusText,
      time: duration,
      size: actualResponse.size,
      data: displayData
    }
    activeResTab.value = 'response'

    // 3. 结果反馈
    if (actualResponse.status === 0) {
      proxy.$modal.msgError('请求发送失败: ' + (typeof actualResponse.data === 'string' ? actualResponse.data : '网络或代理错误'))
    } else {
      // 成功或正常的 HTTP 错误响应 (404, 500 等)
      proxy.$modal.msgSuccess(`请求完成 (Status: ${actualResponse.status})`)
    }

    // 刷新历史记录列表 (后端会自动记录)
    getHistory()
  } catch (error) {
    loading.value = false
    console.error(error)
    proxy.$modal.msgError(error.message || '请求失败')
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

    proxy.$modal.msgSuccess('cURL 解析成功')
    curlDialogVisible.value = false
  } catch (e) {
    proxy.$modal.msgError('cURL 解析失败: ' + e.message)
  }
}

// 提取通用的数据构建逻辑
const buildApiData = (id) => {
  return {
    itemId: id,
    itemName: requestForm.itemName,
    reqUrl: requestForm.url,
    reqMethod: requestForm.method,
    // 复杂对象转 JSON 字符串存入数据库
    reqParams: JSON.stringify(requestForm.params),
    reqHeaders: JSON.stringify(requestForm.headers),
    reqPathParams: JSON.stringify(requestForm.pathParams),
    reqFormData: JSON.stringify(requestForm.formData),
    responseDef: JSON.stringify(responseDefList.value),
    reqBodyType: requestForm.bodyType,
    reqBodyJson: requestForm.bodyJson,
    authType: requestForm.authType,
    authToken: requestForm.authToken,
    isLocked: requestForm.isLocked
  }
}

const handleSave = () => {
  // 快捷模式下，触发另存为
  if (currentMode.value === 'scratch') {
    if (!requestForm.url) {
      proxy.$modal.msgWarning('接口地址不能为空')
      return
    }
    saveAsForm.itemName = requestForm.itemName || '新接口'
    saveAsForm.parentId = 0
    saveAsDialogVisible.value = true
    return
  }

  // 安全检查：如果已锁定，禁止保存
  if (requestForm.isLocked) {
    proxy.$modal.msgWarning('当前接口已被锁定，无法修改')
    return
  }

  // 树模式下，常规保存
  if (!currentNodeId.value) {
    proxy.$modal.msgWarning('请先选择一个接口节点')
    return
  }
  if (!requestForm.itemName) {
    proxy.$modal.msgWarning('接口名称不能为空')
    return
  }
  if (!requestForm.url) {
    proxy.$modal.msgWarning('接口地址不能为空')
    return
  }

  const saveData = buildApiData(currentNodeId.value)

  updateApi(saveData).then(() => {
    proxy.$modal.msgSuccess('接口信息已保存')
    getTreeData() // 刷新树
  })
}

// 提交另存为 (快捷请求 -> 正式接口)
const submitSaveAs = async () => {
  if (!saveAsForm.itemName) {
    proxy.$modal.msgWarning('请输入接口名称')
    return
  }

  const postData = buildApiData(0) // ID为0表示新增
  postData.itemName = saveAsForm.itemName
  postData.parentId = saveAsForm.parentId || 0
  postData.itemType = 'api'

  await addApi(postData)
  proxy.$modal.msgSuccess('保存成功')
  saveAsDialogVisible.value = false

  // 刷新树并自动切换回树模式（逻辑在 getTreeData 后续操作中可优化，这里简单刷新即可）
  getTreeData()
}

const handleExportDoc = (nodeData = null) => {
  if (!nodeData && !currentNodeId.value) {
    proxy.$modal.msgWarning('请先选择(或右键点击)要导出的接口或分组')
    return
  }

  // 递归生成 Markdown 内容
  const generateMd = (nodes, level = 1) => {
    let md = ''
    for (const node of nodes) {
      const prefix = '#'.repeat(level)
      md += `${prefix} ${node.itemName}\n\n`

      if (node.itemType === 'api') {
        md += `**URL**: \`${node.reqMethod} ${node.reqUrl}\`\n\n`

        // Params
        const params = parseJson(node.reqParams)
        if (params && params.length > 0 && params.some(p => p.active)) {
          md += `**Query Params**:\n\n`
          md += `| Key | Value | Description |\n| --- | --- | --- |\n`
          params.filter(p => p.active).forEach(p => {
            md += `| ${p.key} | ${p.value} | ${p.desc || '-'} |\n`
          })
          md += `\n`
        }

        // Body
        if (node.reqBodyType === 'json' && node.reqBodyJson) {
          md += `**Body (JSON)**:\n\`\`\`json\n${node.reqBodyJson}\n\`\`\`\n\n`
        }
      }

      if (node.children && node.children.length > 0) {
        md += generateMd(node.children, level + 1)
      }
      md += `---\n\n`
    }
    return md
  }

  // 查找当前选中的节点对象（树结构）
  const findNode = (nodes, id) => {
    for (const node of nodes) {
      if (node.itemId === id) return node
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

  // 创建 Blob 并下载
  const blob = new Blob([markdownContent], { type: 'text/markdown' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${targetNode.itemName}.md`
  link.click()
  URL.revokeObjectURL(link.href)

  proxy.$modal.msgSuccess('文档导出成功')
}

const restoreHistory = (item) => {
  if (item.snapshotJson) {
    Object.assign(requestForm, JSON.parse(item.snapshotJson))
    proxy.$modal.msgSuccess('已恢复历史参数')
  } else {
    // 兼容旧数据
    requestForm.method = item.reqMethod
    requestForm.url = item.reqUrl.replace(currentBaseUrl.value, '')
    proxy.$modal.msgSuccess('已恢复部分历史参数')
  }
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
    const json = parseJson(responseInfo.value.data) // 使用 parseJson 更安全
    responseDefList.value = flattenJson(json)
    activeReqTab.value = 'responseDef'
    proxy.$modal.msgSuccess('响应结构导入成功')
  } catch (e) {
    proxy.$modal.msgError('解析响应JSON失败')
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
  proxy.$modal.confirm(`确定要删除 "${data.itemName}" 吗?`).then(() => {
    delApi(data.itemId).then(() => {
      proxy.$modal.msgSuccess('删除成功')
      getTreeData() // 刷新树
      // 如果删除的是当前选中的节点，清空选中状态
      if (currentNodeId.value === data.itemId) {
        currentNodeId.value = null
        Object.assign(requestForm, getDefaultRequestForm())
      }
    })
  }).catch(() => { })
}

// 右键菜单处理
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
      // 只有分组可以添加子节点
      if (node.data.itemType === 'api') {
        proxy.$modal.msgWarning('接口节点下不能再添加子节点')
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
        updateApi({ itemId: node.data.itemId, itemName: value }).then(() => {
          proxy.$modal.msgSuccess('重命名成功')
          getTreeData()
          // 修复：如果重命名的是当前选中的节点，同步更新右侧表单显示的名称
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
        // 如果操作的是当前选中的节点，同步更新右侧表单的锁定状态
        if (currentNodeId.value === node.data.itemId) {
          requestForm.isLocked = newLockState
        }
      })
      break
  }
}

// 表单重置
function reset() {
  createForm.value = {
    itemType: 'group',
    itemName: '',
    reqMethod: 'GET',
    reqUrl: ''
  }
  proxy.resetForm("createFormRef")
}

// 新建逻辑
const handleCreate = (parentNode = null) => {
  reset()
  createDialogVisible.value = true

  // 如果是从右键菜单“新增子节点”进来，parentNode 是 Node 对象
  if (parentNode && parentNode.data) {
    createParentNode.value = parentNode
  } else {
    createParentNode.value = null
  }
}

const submitCreate = async () => {
  if (!proxy.$refs['createFormRef']) return

  try {
    await proxy.$refs['createFormRef'].validate()
  } catch (e) {
    return // 校验失败，停止执行
  }

  const postData = {
    itemName: createForm.value.itemName,
    itemType: createForm.value.itemType,
    parentId: createParentNode.value ? createParentNode.value.data.itemId : 0
  }

  if (createForm.value.itemType === 'api') {
    postData.reqMethod = createForm.value.reqMethod
    postData.reqUrl = createForm.value.reqUrl
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

// --- 导入导出功能 ---

const handleMoreCommand = (command) => {
  if (command === 'export') {
    handleExportAll()
  } else if (command === 'import') {
    importFileRef.value.click()
  }
}

const handleExportAll = async () => {
  try {
    const res = await exportData()
    const dataStr = JSON.stringify(res.data, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `api_backup_${new Date().getTime()}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    proxy.$modal.msgSuccess('备份导出成功')
  } catch (e) {
    proxy.$modal.msgError('导出失败')
  }
}

const handleImportFileChange = (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result)
      await proxy.$modal.confirm('导入将新增接口和环境配置，确定要继续吗？')
      loading.value = true
      await importData(json)
      proxy.$modal.msgSuccess('导入成功')
      // 刷新数据
      getTreeData()
      initEnvs()
    } catch (err) {
      if (err === 'cancel') return // 用户点击了取消，静默处理
      console.error(err)
      proxy.$modal.msgError('导入失败: ' + (err.message || '文件格式错误'))
    } finally {
      loading.value = false
      importFileRef.value.value = '' // 清空 input，允许重复导入同名文件
    }
  }
  reader.readAsText(file)
}

// --- 拖拽功能逻辑 ---

// 拖拽规则控制
const allowDrop = (draggingNode, dropNode, type) => {
  // type: 'prev' (前), 'inner' (内), 'next' (后)
  // 只有“分组”节点允许被插入内部 ('inner')
  if (type === 'inner') {
    return dropNode.data.itemType === 'group'
  }
  return true
}

// 拖拽完成后的处理
const handleNodeDrop = (draggingNode, dropNode, dropType) => {
  let newParentId = 0
  if (dropType === 'inner') {
    newParentId = dropNode.data.itemId
  } else {
    // 如果是拖到前后，则父节点与目标节点相同
    newParentId = dropNode.data.parentId
  }

  // 调用后端更新父节点ID
  updateApi({ itemId: draggingNode.data.itemId, parentId: newParentId }).then(() => {
    proxy.$modal.msgSuccess('移动成功')
  }).catch(() => {
    getTreeData() // 失败则刷新树，恢复原状
  })
}

onMounted(() => {
  initEnvs()
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

    :deep(.el-tree-node__content) {
      height: 32px;
      /* 增加行高，点击更舒适 */
    }

    :deep(.el-tree-node__content:hover) {
      background-color: var(--el-color-primary-light-9);
    }

    :deep(.el-tree-node:focus > .el-tree-node__content) {
      background-color: var(--el-color-primary-light-9);
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

  .lock-icon {
    margin-left: 4px;
    color: var(--el-color-warning);
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

  .locked-form {
    opacity: 0.6;
    pointer-events: none;
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