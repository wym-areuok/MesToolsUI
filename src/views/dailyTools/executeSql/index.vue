<template>
  <div class="app-container">
    <el-row>
      <el-col :span="10" :offset="1">
        <el-form ref="formRef" :model="formData" :rules="rules" size="default" label-position="top">
          <el-form-item label="数据源" prop="dbDataSource">
            <el-select v-model="formData.dbDataSource" placeholder="请选择数据源" clearable style="width: 240px;">
              <el-option v-for="dict in db_info" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>

          <el-form-item label="SQL 编辑器 (Ctrl+Enter执行)" prop="sqlContent">
            <div class="editor-container">
              <codemirror v-model="formData.sqlContent" placeholder="在此输入SQL语句..."
                :style="{ height: '500px', width: '100%' }" :autofocus="true" :indent-with-tab="true" :tab-size="2"
                :extensions="extensions" @ready="handleReady" @keydown.ctrl.enter.prevent="handleSmartExecute" />
            </div>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery" v-hasPermi="['dailyTools:executeSql:query']">
              查询
            </el-button>
            <el-button type="success" icon="Edit" @click="handleUpdate" v-hasPermi="['dailyTools:executeSql:update']">
              修改
            </el-button>
            <el-button type="warning" icon="CirclePlus" @click="handleInsert"
              v-hasPermi="['dailyTools:executeSql:insert']">
              插入
            </el-button>
            <el-button type="danger" icon="Delete" @click="handleDelete" v-hasPermi="['dailyTools:executeSql:delete']">
              删除
            </el-button>
            <el-button @click="resetForm" icon="Refresh">重置</el-button>
          </el-form-item>
        </el-form>
      </el-col>

      <el-col :span="13">
        <el-tabs v-model="activeTab" class="result-tabs">
          <el-tab-pane label="执行结果" name="result">
            <div class="result-panel">
              <div v-if="executionInfo">
                <div class="execution-info">
                  <el-tag :type="executionInfo.success ? 'success' : 'danger'" effect="dark">
                    {{ executionInfo.success ? '执行成功' : '执行失败' }}
                  </el-tag>
                  <span class="info-item">耗时: {{ executionInfo.time }}ms</span>
                  <span v-if="executionInfo.affectedRows !== null" class="info-item">
                    影响行数: {{ executionInfo.affectedRows }}
                  </span>
                </div>
                <div class="execution-scope">
                  <el-tag effect="dark" type="warning">
                    执行范围: {{ executionInfo.scope }}
                  </el-tag>
                </div>
              </div>
              <div v-if="queryResult.data.length > 0" class="table-wrapper">
                <el-table :data="queryResult.data" border stripe height="100%" v-loading="loading">
                  <el-table-column v-for="col in queryResult.columns" :key="col" :prop="col" :label="col"
                    show-overflow-tooltip />
                </el-table>
              </div>
              <el-alert v-else-if="executionInfo" :title="executionInfo.message"
                :type="executionInfo.success ? 'info' : 'error'" :closable="false" show-icon />

              <el-empty v-else description="暂无结果" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="历史日志" name="log">
            <div class="log-panel">
              <el-timeline>
                <el-timeline-item v-for="(log, index) in executionLogs" :key="index" :timestamp="log.timestamp"
                  :type="log.success ? 'primary' : 'danger'" placement="top">
                  <el-card>
                    <h4>{{ log.type }} 操作 {{ log.success ? '成功' : '失败' }}</h4>
                    <p class="log-sql">{{ log.sql }}</p>
                    <p v-if="!log.success" class="log-error">错误: {{ log.message }}</p>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
              <el-empty v-if="executionLogs.length === 0" description="暂无历史日志" />
            </div>
          </el-tab-pane>
        </el-tabs>

      </el-col>
    </el-row>
  </div>
</template>

<script setup name="ExecuteSql">
import { executeQuery, executeUpdate, executeInsert, executeDelete } from '@/api/dailyTools/executeSql'
import { Codemirror } from 'vue-codemirror'
import { sql } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import { shallowRef, ref, reactive, toRefs, getCurrentInstance } from 'vue'
import { validateSqlServerSql } from '@/utils/sqlValidator'

const {
  proxy
} = getCurrentInstance()
const { db_info } = proxy.useDict("db_info");

const formRef = ref()
const loading = ref(false)
const activeTab = ref('result')

const editorView = shallowRef()
const handleReady = (payload) => {
  editorView.value = payload.view
}

const extensions = [sql(), EditorView.lineWrapping]
// 执行结果 { success: bool, time: number, affectedRows: number|null, message: string }
const executionInfo = ref(null)
const queryResult = reactive({
  columns: [],
  data: []
})
const executionLogs = ref([])

const data = reactive({
  formData: {
    dbDataSource: undefined,
    sqlContent: undefined,
  },
  rules: {
    dbDataSource: [{
      required: true,
      message: '请选择数据源',
      trigger: 'change'
    }],
    sqlContent: [{
      required: true,
      message: '请输入SQL语句',
      trigger: 'blur'
    }],
  }
})
const {
  formData,
  rules
} = toRefs(data)

/** 获取需要执行的SQL (选中内容或全部内容) */
function getSqlToExecute() {
  if (editorView.value) {
    const state = editorView.value.state
    const selection = state.sliceDoc(state.selection.main.from, state.selection.main.to)
    if (selection && selection.trim()) {
      return { sql: selection, scope: '选中区SQL' }
    }
  }
  return { sql: formData.value.sqlContent, scope: '全部SQL' }
}

/** 根据SQL关键字判断操作类型 */
function handleSmartExecute() {
  const { sql: rawSql } = getSqlToExecute();
  const sql = rawSql?.replace(/\uFEFF/g, '').trim();
  if (!sql) return;
  // 使用正则提取第一个有效关键字 (忽略注释、字符串、方括号)
  const tokenRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|(N?'(?:''|[^'])*')|(\[[^\]]*\])|\b(SELECT|UPDATE|INSERT|DELETE)\b/gi;
  const matches = [...sql.matchAll(tokenRegex)];
  let firstKeyword = null;
  for (const match of matches) {
    if (!match[1] && !match[2] && !match[3] && !match[4]) {
      firstKeyword = match[5].toUpperCase();
      break;
    }
  }
  if (firstKeyword === 'SELECT') {
    handleQuery();
  } else if (firstKeyword === 'UPDATE') {
    handleUpdate();
  } else if (firstKeyword === 'INSERT') {
    handleInsert();
  } else if (firstKeyword === 'DELETE') {
    handleDelete();
  } else {
    proxy.$message.warning('无法识别SQL操作类型,请点击对应按钮执行。');
  }
}

/** 查询操作 */
function handleQuery() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const { sql, scope } = getSqlToExecute();
    const validation = validateSqlServerSql(sql, 'SELECT');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    executeSql('SELECT', sql, scope);
  });
}

/** 更新操作 */
function handleUpdate() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const { sql, scope } = getSqlToExecute();
    const validation = validateSqlServerSql(sql, 'UPDATE');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    proxy.$confirm('确定要执行此更新操作吗？请确认WHERE条件正确无误。', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      executeSql('UPDATE', sql, scope);
    }).catch(() => {
      proxy.$message.info('已取消操作');
    });
  });
}

/** 插入操作 */
function handleInsert() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const { sql, scope } = getSqlToExecute();
    const validation = validateSqlServerSql(sql, 'INSERT');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    proxy.$confirm('确定要执行此插入操作吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      executeSql('INSERT', sql, scope);
    }).catch(() => {
      proxy.$message.info('已取消操作');
    });
  });
}

/** 删除操作 */
function handleDelete() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const { sql, scope } = getSqlToExecute();
    const validation = validateSqlServerSql(sql, 'DELETE');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    proxy.$confirm('删除操作不可恢复,确定要执行此删除操作吗？请再次确认WHERE条件正确无误。', '危险操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(() => {
      executeSql('DELETE', sql, scope);
    }).catch(() => {
      proxy.$message.info('已取消操作');
    });
  });
}

/** 执行SQL的通用方法 */
async function executeSql(operationType, sqlContent, scope) {
  // 重置之前的结果
  clearResults();
  activeTab.value = 'result';
  loading.value = true;
  const requestData = {
    dbDataSource: formData.value.dbDataSource,
    sqlContent: sqlContent
  };
  try {
    const startTime = new Date();
    let response;
    switch (operationType) {
      case 'SELECT':
        response = await executeQuery(requestData);
        break;
      case 'UPDATE':
        response = await executeUpdate(requestData);
        break;
      case 'INSERT':
        response = await executeInsert(requestData);
        break;
      case 'DELETE':
        response = await executeDelete(requestData);
        break;
    }
    const endTime = new Date();
    const executionTime = endTime - startTime;
    if (operationType === 'SELECT') {
      // 假设后端返回 { code: 200, msg: "查询成功", data: [...] }
      const resultData = response.data || [];
      if (resultData.length > 0) {
        queryResult.columns = Object.keys(resultData[0]);
        queryResult.data = resultData;
      }
      executionInfo.value = {
        success: true,
        time: executionTime,
        affectedRows: resultData.length,
        message: `查询成功,返回 ${resultData.length} 条记录。`,
        scope: scope
      };
    } else {
      // 假设后端返回 { code: 200, msg: "操作成功", data: 1 } (data为影响行数)
      executionInfo.value = {
        success: true,
        time: executionTime,
        affectedRows: response.data || 0,
        message: `${response.msg} (影响行数: ${response.data || 0})`,
        scope: scope
      };
    }
    addLog(operationType, true, executionTime, sqlContent);
  } catch (error) {
    const errorMessage = error.message || error.msg || '未知错误';
    executionInfo.value = {
      success: false,
      time: 0,
      affectedRows: null,
      message: errorMessage,
      scope: scope
    };
    addLog(operationType, false, 0, sqlContent, errorMessage);
    console.error('SQL执行失败：', error);
  } finally {
    loading.value = false;
  }
}

/** 添加到历史日志 */
function addLog(type, success, time, sql, message = '') {
  executionLogs.value.unshift({
    type,
    success,
    time,
    sql,
    message,
    timestamp: new Date().toLocaleString()
  });
}

/** 清理结果区域 */
function clearResults() {
  executionInfo.value = null;
  queryResult.columns = [];
  queryResult.data = [];
}

/** 表单重置 */
function resetForm() {
  formRef.value.resetFields();
  clearResults();
  executionLogs.value = [];
}
</script>

<style scoped>
.editor-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  max-width: 100%;
  width: 100%;
}

/* 强制长单词换行,防止撑开容器 */
:deep(.cm-content) {
  word-break: break-all;
}

.result-tabs,
.log-panel {
  height: 600px;
}

.result-panel {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.table-wrapper {
  flex: 1;
  overflow: hidden;
}

.log-panel {
  overflow-y: auto;
}

.execution-info {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 14px;
}

.execution-scope {
  margin-top: 5px;
  margin-bottom: 5px;
}

.log-sql {
  font-family: 'Courier New', Courier, monospace;
  background-color: #f5f5f5;
  padding: 5px;
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-error {
  color: #f56c6c;
}
</style>