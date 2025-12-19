<template>
  <div class="app-container">
    <el-row>
      <el-col :span="12" :offset="1">
        <el-form ref="formRef" :model="formData" :rules="rules" size="default" label-position="top">
          <el-form-item label="数据源" prop="dbDataSource">
            <el-select v-model="formData.dbDataSource" placeholder="请选择数据源" clearable style="width: 240px;">
              <el-option v-for="dict in db_info" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>

          <el-form-item label="SQL 编辑器 (Ctrl+Enter执行)" prop="sqlContent">
            <div class="editor-container">
              <codemirror v-model="formData.sqlContent" placeholder="在此输入SQL语句..." :style="{ height: '400px' }"
                :autofocus="true" :indent-with-tab="true" :tab-size="2" :extensions="extensions"
                @keydown.ctrl.enter.prevent="handleSmartExecute" />
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

      <el-col :span="11">
        <el-tabs v-model="activeTab" class="result-tabs">
          <el-tab-pane label="执行结果" name="result">
            <div class="result-panel">
              <div v-if="executionInfo" class="execution-info">
                <el-tag :type="executionInfo.success ? 'success' : 'danger'" effect="dark">
                  {{ executionInfo.success ? '执行成功' : '执行失败' }}
                </el-tag>
                <span class="info-item">耗时: {{ executionInfo.time }}ms</span>
                <span v-if="executionInfo.affectedRows !== null" class="info-item">
                  影响行数: {{ executionInfo.affectedRows }}
                </span>
              </div>
              <el-table v-if="queryResult.data.length > 0" :data="queryResult.data" border stripe height="400px"
                v-loading="loading">
                <el-table-column v-for="col in queryResult.columns" :key="col" :prop="col" :label="col"
                  show-overflow-tooltip />
              </el-table>
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

const {
  proxy
} = getCurrentInstance()
const { db_info } = proxy.useDict("db_info");

const formRef = ref()
const loading = ref(false)
const activeTab = ref('result')

const extensions = [sql()]
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

/** SQL语法检查 */
function validateSqlServerSql(sql, operationType) {
  const trimmedSql = sql.replace(/\uFEFF/g, '').trim();
  if (!trimmedSql) {
    return { valid: false, message: 'SQL语句不能为空' };
  }
  const upperSql = trimmedSql.toUpperCase();
  // 2. 通用校验：不允许执行批量SQL操作
  if (isBatchOperation(trimmedSql)) {
    return { valid: false, message: '不允许执行批量SQL操作' };
  }
  // 3. 安全校验：通过分词检查关键字数量,防止多语句执行(如 UPDATE...DELETE)及危险操作
  // 正则匹配: 1.单行注释 2.多行注释 3.字符串 4.方括号标识符 5.关键字
  const tokenRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|(\[[^\]]*\])|\b(SELECT|UPDATE|INSERT|DELETE|DROP|TRUNCATE|ALTER|CREATE|RENAME)\b/gi;
  const tokens = [...trimmedSql.matchAll(tokenRegex)];
  const kwCounts = { SELECT: 0, UPDATE: 0, INSERT: 0, DELETE: 0, DANGEROUS: 0 };
  let firstKeyword = null;
  for (const match of tokens) {
    if (match[1] || match[2] || match[3] || match[4]) continue; // 跳过注释、字符串和方括号标识符
    const kw = match[5].toUpperCase();
    if (!firstKeyword) firstKeyword = kw; // 记录找到的第一个有效关键字

    if (['DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'RENAME'].includes(kw)) {
      kwCounts.DANGEROUS++;
    } else {
      kwCounts[kw] = (kwCounts[kw] || 0) + 1;
    }
  }
  // 1. 通用校验：检查第一个有效关键字是否匹配操作类型 (忽略开头的注释)
  if (!firstKeyword || firstKeyword !== operationType) {
    return { valid: false, message: `${operationType} 语句必须以 ${operationType} 开头` };
  }
  // 检查危险关键字 (保留原逻辑：INSERT操作允许包含CREATE等,其他不允许)
  if (operationType !== 'INSERT' && kwCounts.DANGEROUS > 0) {
    return { valid: false, message: '语句中包含危险关键字 (DROP, TRUNCATE, ALTER, CREATE, RENAME)' };
  }
  // 检查混合操作/多语句 (即使没有分号也能检测)
  if (operationType === 'SELECT') {
    if (kwCounts.UPDATE > 0 || kwCounts.INSERT > 0 || kwCounts.DELETE > 0) {
      return { valid: false, message: '查询语句不允许包含 UPDATE/INSERT/DELETE 操作' };
    }
  }
  // 4. 特定操作类型的校验
  switch (operationType) {
    case 'UPDATE':
    case 'INSERT':
    case 'DELETE':
      // 确保主操作关键字数量为 1 (防止 UPDATE...UPDATE)
      if (kwCounts[operationType] > 1) {
        return { valid: false, message: `检测到多个 ${operationType} 关键字,禁止执行多条语句` };
      }
      // 检查是否包含其他 DML 关键字 (例如 UPDATE 中包含 DELETE)
      const otherDmls = ['UPDATE', 'INSERT', 'DELETE'].filter(k => k !== operationType);
      for (const other of otherDmls) {
        if (kwCounts[other] > 0) {
          return { valid: false, message: `${operationType} 语句不允许包含 ${other} 操作` };
        }
      }
      // INSERT 不需要检查 WHERE
      if (operationType === 'INSERT') break;
      // 使用正则查找真正的 WHERE 关键字 (忽略注释、字符串、方括号)
      const whereRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|(\[[^\]]*\])|(\bWHERE\b)/gi;
      const whereMatches = [...trimmedSql.matchAll(whereRegex)];
      let rawWhereClause = null;
      for (const match of whereMatches) {
        if (match[1] || match[2] || match[3] || match[4]) continue;
        if (match[5]) {
          rawWhereClause = trimmedSql.substring(match.index + match[0].length);
          break;
        }
      }
      if (rawWhereClause === null) {
        return { valid: false, message: `${operationType} 操作必须包含WHERE条件以防止全表操作` };
      }
      // 清理 WHERE 子句：只去除注释,保留字符串内容
      let cleanWhereClause = rawWhereClause.replace(/(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)/g, ' ');
      // 移除后续子句和末尾分号
      cleanWhereClause = removeSubsequentClauses(cleanWhereClause);
      if (cleanWhereClause.trim().endsWith(';')) {
        cleanWhereClause = cleanWhereClause.trim().slice(0, -1);
      }
      cleanWhereClause = cleanWhereClause.trim();
      // 检查WHERE条件是否为恒真条件
      if (isAlwaysTrueCondition(cleanWhereClause)) {
        return { valid: false, message: 'WHERE条件疑似为恒真条件(如 1=1),操作被禁止' };
      }
      // 检查WHERE条件是否包含等号(=)或IN子句指定精确条件效防止因缺少精确条件（如主键/唯一键）而导致的大范围更新或删除
      const hasSpecificCondition = cleanWhereClause.includes('=') || cleanWhereClause.toUpperCase().includes(' IN ');
      if (!hasSpecificCondition) {
        return { valid: false, message: '高危操作的WHERE条件必须包含等号(=)或IN子句进行精确匹配,以防止大范围误操作。' };
      }
      break;
    case 'SELECT':
      // 检查所有 SELECT (包括子查询、联合查询) 是否都使用了 TOP N 语法
      // 正则匹配: 1.单行注释 2.多行注释 3.字符串 4.方括号标识符 5.SELECT关键字 6.TOP N
      const selectRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|(\[[^\]]*\])|(\bSELECT\b)(?:\s+(?:DISTINCT|ALL))?(?:\s+TOP(?:\s+|\s*\(\s*)(\d+))?/gi;
      const matches = [...trimmedSql.matchAll(selectRegex)];
      for (const match of matches) {
        // 如果是注释、字符串或方括号标识符 跳过
        if (match[1] || match[2] || match[3] || match[4]) {
          continue;
        }
        // 这是一个 SELECT 语句匹配
        const topN = match[6];
        if (!topN) {
          return { valid: false, message: '所有查询(包括子查询、联合查询)必须包含 TOP N 语法' };
        }
        const n = parseInt(topN, 10);
        if (isNaN(n) || n <= 0) {
          return { valid: false, message: 'TOP N 中的 N 必须是一个正整数' };
        }
        if (n > 1000) {
          return { valid: false, message: `查询限制数量不能超过 1000 (检测到: ${n})` };
        }
      }
      break;
    case 'INSERT':
      // INSERT 语句目前没有额外的严格限制
      break;
  }
  return { valid: true, message: '验证通过' };
}

/** 移除WHERE子句后的干扰项 */
function removeSubsequentClauses(whereClause) {
  let clause = whereClause;
  const nextClauses = [' ORDER BY ', ' GROUP BY ', ' HAVING '];
  for (const next of nextClauses) {
    const clauseIndex = clause.toUpperCase().indexOf(next);
    if (clauseIndex > 0) {
      clause = clause.substring(0, clauseIndex);
      break;
    }
  }
  return clause;
}

/** 判断是否为恒真条件 */
function isAlwaysTrueCondition(whereClause) {
  if (!whereClause) return false;
  const upperClause = whereClause.toUpperCase();
  // 匹配常见的恒真条件
  // 移除了字符串自相等检查,因为它可能在某些场景下是合法的（例如 WHERE name = ''）
  const alwaysTruePatterns = [
    /^\s*1\s*=\s*1\s*$/,
    /^\s*2\s*>\s*1\s*$/,
    /^\s*0\s*=\s*0\s*$/,
    /^\s*'(?:''|[^'])*'\s*=\s*'(?:''|[^'])*'\s*$/, // 'a'='a' (支持包含特殊字符)
  ];
  for (const pattern of alwaysTruePatterns) {
    if (pattern.test(upperClause)) {
      return true;
    }
  }
  return false;
}

/** 检查是否为批处理操作 */
function isBatchOperation(sql) {
  // 检查是否包含多个SQL语句（以分号分隔）
  const statements = sql.split(';').filter(s => s.trim());
  return statements.length > 1;
}

/** 根据SQL关键字判断操作类型 */
function handleSmartExecute() {
  const sql = formData.value.sqlContent?.replace(/\uFEFF/g, '').trim();
  if (!sql) return;
  // 使用正则提取第一个有效关键字 (忽略注释、字符串、方括号)
  const tokenRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|(\[[^\]]*\])|\b(SELECT|UPDATE|INSERT|DELETE)\b/gi;
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
    const validation = validateSqlServerSql(formData.value.sqlContent, 'SELECT');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    executeSql('SELECT');
  });
}

/** 更新操作 */
function handleUpdate() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const validation = validateSqlServerSql(formData.value.sqlContent, 'UPDATE');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    proxy.$confirm('确定要执行此更新操作吗？请确认WHERE条件正确无误。', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      executeSql('UPDATE');
    }).catch(() => {
      proxy.$message.info('已取消操作');
    });
  });
}

/** 插入操作 */
function handleInsert() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const validation = validateSqlServerSql(formData.value.sqlContent, 'INSERT');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    proxy.$confirm('确定要执行此插入操作吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      executeSql('INSERT');
    }).catch(() => {
      proxy.$message.info('已取消操作');
    });
  });
}

/** 删除操作 */
function handleDelete() {
  formRef.value.validate((valid) => {
    if (!valid) return;
    const validation = validateSqlServerSql(formData.value.sqlContent, 'DELETE');
    if (!validation.valid) {
      proxy.$message.error(validation.message);
      return;
    }
    proxy.$confirm('删除操作不可恢复,确定要执行此删除操作吗？请再次确认WHERE条件正确无误。', '危险操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(() => {
      executeSql('DELETE');
    }).catch(() => {
      proxy.$message.info('已取消操作');
    });
  });
}

/** 执行SQL的通用方法 */
async function executeSql(operationType) {
  // 重置之前的结果
  clearResults();
  activeTab.value = 'result';
  loading.value = true;
  const requestData = {
    dbDataSource: formData.value.dbDataSource,
    sqlContent: formData.value.sqlContent
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
        message: `查询成功,返回 ${resultData.length} 条记录。`
      };
    } else {
      // 假设后端返回 { code: 200, msg: "操作成功", data: 1 } (data为影响行数)
      executionInfo.value = {
        success: true,
        time: executionTime,
        affectedRows: response.data || 0,
        message: `${response.msg} (影响行数: ${response.data || 0})`
      };
    }
    addLog(operationType, true, executionTime, formData.value.sqlContent);
  } catch (error) {
    const errorMessage = error.message || error.msg || '未知错误';
    executionInfo.value = {
      success: false,
      time: 0,
      affectedRows: null,
      message: errorMessage
    };
    addLog(operationType, false, 0, formData.value.sqlContent, errorMessage);
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
}

.result-tabs,
.result-panel,
.log-panel {
  height: 500px;
}

.log-panel {
  overflow-y: auto;
}

.execution-info {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 14px;
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