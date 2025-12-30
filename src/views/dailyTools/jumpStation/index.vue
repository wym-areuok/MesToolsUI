<template>
  <div class="app-container">
    <el-form ref="formRef" :model="formData" :rules="rules" size="default" label-width="100px">
      <el-row>
        <!-- 多行输入框 -->
        <el-col :span="5">
          <el-form-item label="SN列表" prop="inputSn">
            <el-input v-model="formData.inputSn" type="textarea" placeholder="请输入SN(多SN用换行分隔):" :rows="13"
              show-word-limit :style="{ width: '100%' }"></el-input>
          </el-form-item>
        </el-col>

        <!-- 功能区 -->
        <el-col :span="8">
          <el-form-item label="数据源" prop="dbDataSource">
            <el-select v-model="formData.dbDataSource" placeholder="请选择数据源" clearable :style="{ width: '100%' }">
              <el-option v-for="dict in db_info" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="类型" prop="jumpType">
            <el-select v-model="formData.jumpType" placeholder="请选择跳站类型" @change="handleJumpTypeChange">
              <el-option v-for="dict in jump_type" :key="dict.value" :label="dict.label"
                :value="dict.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="站点" prop="station">
            <el-select v-model="formData.station" placeholder="请选择跳站的目标站点(NWC)" filterable clearable
              :style="{ width: '100%' }">
              <el-option v-for="(item, index) in stationOptions" :key="index" :label="item.label"
                :value="item.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="formData.remark" type="textarea" placeholder="请输入原因:格式:需求方+原因"
              :style="{ width: '100%' }"></el-input>
          </el-form-item>
          <el-form-item label="途程" prop="sfc">
            <el-input v-model="formData.sfc" type="textarea" readonly :style="{ width: '100%' }"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button v-hasPermi="['dailyTools:jumpStation:query']" @click="handleQuery" icon="Search"
              :disabled="!hasValidSnInput || loading">
              查询
            </el-button>
            <el-button v-hasPermi="['dailyTools:jumpStation:execute']" type="primary" icon="Promotion"
              @click="submitForm" :disabled="!hasValidResult || loading">
              跳站
            </el-button>
            <el-button @click="resetForm" icon="Refresh"> 重置 </el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <!-- 动态结果展示区 -->
    <el-card v-if="resultTable.data.length > 0" class="box-card">
      <template #header>
        <div class="card-header" style="font-size: 12px;">
          <span>{{ resultTable.title }}</span>
        </div>
      </template>
      <el-table v-loading="loading" :data="paginatedData" border stripe>
        <!-- 动态生成列 -->
        <el-table-column v-for="col in resultTable.columns" :key="col" :prop="col" :label="col" show-overflow-tooltip />
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="pageNum" v-model:limit="pageSize" />
    </el-card>
    <el-empty v-else description="暂无结果" style="margin-top: 5px;" />
  </div>
</template>

<script setup name="JumpStation">
import {
  list as querySnList,
  execute as executeJump,
  getStationList,
} from "@/api/dailyTools/jumpStation";

const { proxy } = getCurrentInstance();
const { jump_type, db_info } = proxy.useDict("jump_type", "db_info");
const formRef = ref();
const loading = ref(false);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);
const resultTable = reactive({
  columns: [],
  data: [],
  title: '查询/执行结果'
});

// 定义校验规则常量
const baseSnRules = [
  {
    required: true,
    message: "请输入SN(多SN用换行分隔):",
    trigger: "blur",
  },
  {
    validator: (rule, value, callback) => {
      if (value) {
        const snList = processSnInput(value);
        if (snList.length === 0) {
          callback(new Error("请输入至少一个有效的SN"));
        } else {
          callback();
        }
      } else {
        callback();
      }
    },
    trigger: "blur",
  },
];

const dbDataSourceRules = [{
  required: true,
  message: '请选择数据源',
  trigger: 'change'
}];

const jumpTypeRules = [
  {
    required: true,
    message: "请选择跳站类型",
    trigger: "change",
  },
];

const stationRules = [{
  required: true,
  message: "请选择跳站的站点",
  trigger: "change",
}];

const remarkRules = [{
  required: true,
  message: "请输入原因:格式:需求方+原因",
  trigger: "blur",
}];

// 定义完整的校验规则对象
const data = reactive({
  formData: {
    dbDataSource: undefined,
    inputSn: undefined,
    station: undefined,
    jumpType: undefined,
    remark: undefined,
    sfc: undefined,
  },
  rules: {
    inputSn: [...baseSnRules],
    dbDataSource: [...dbDataSourceRules],
    jumpType: [...jumpTypeRules],
    station: [...stationRules],
    remark: [...remarkRules]
  }
});

// 初始化时设置校验规则状态
data.rules.station[0].required = false; // 查询时站点非必需
data.rules.remark[0].required = false;  // 查询时备注非必需

const { formData, rules } = toRefs(data);
const stationOptions = ref([]);

/** 处理输入的SN序列号 */
const processSnInput = (input) => {
  if (!input) return [];
  return input
    .split("\n")
    .map((sn) => sn.replace(/\s+/g, ""))
    .filter((sn) => sn.length > 0);
};

/** 计算属性：是否有有效的SN输入 */
const hasValidSnInput = computed(() => {
  const snList = processSnInput(formData.value.inputSn);
  return snList.length > 0;
});

/** 计算属性：是否有有效的查询结果 */
const hasValidResult = computed(() => {
  return resultTable.data && resultTable.data.length > 0;
});

/** 计算属性：用于前端分页的数据 */
const paginatedData = computed(() => {
  return resultTable.data.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value);
});

/** 表单提交 - 跳站操作 */
function submitForm() {
  // 设置跳站操作所需的校验规则
  rules.value.station[0].required = true;
  rules.value.remark[0].required = true;
  formRef.value.validate((valid) => {
    if (!valid) return;
    const snList = processSnInput(formData.value.inputSn);
    const data = {
      snList: snList,
      station: formData.value.station,
      jumpType: formData.value.jumpType,
      remark: formData.value.remark,
      dbDataSource: formData.value.dbDataSource,
    };
    proxy.$modal
      .confirm("是否确认执行跳站操作?")
      .then(() => {
        loading.value = true;
        return executeJump(data);
      })
      .then((res) => {
        const resultData = res.data || [];
        resultTable.title = '跳站执行结果';
        if (resultData.length > 0) {
          resultTable.columns = Object.keys(resultData[0]);
          resultTable.data = resultData;
          total.value = resultData.length;
          proxy.$message.success(res.msg || "操作完成");
        } else {
          clearResultTable();
          proxy.$message.info(res.msg || "操作完成，但没有返回结果数据。");
        }
      })
      .finally(() => {
        loading.value = false;
      });
  });
}

/** 重置表单 */
function resetForm() {
  formRef.value.resetFields();
  stationOptions.value = [];
  clearResultTable();
  // 重置所有校验规则到初始状态
  resetValidationRules();
  // 清除表单验证状态
  setTimeout(() => {
    if (formRef.value) {
      formRef.value.clearValidate();
    }
  }, 10);
}

/** 清空结果表格 */
function clearResultTable() {
  resultTable.columns = [];
  resultTable.data = [];
  total.value = 0;
  pageNum.value = 1;
}

/** 重置校验规则到初始状态 */
function resetValidationRules() {
  // 重置所有校验规则
  rules.value.inputSn = [...baseSnRules];
  rules.value.dbDataSource = [...dbDataSourceRules];
  rules.value.jumpType = [...jumpTypeRules];
  rules.value.station = [...stationRules];
  rules.value.remark = [...remarkRules];
  // 恢复特定规则的初始状态
  rules.value.station[0].required = false; // 查询时站点非必需
  rules.value.remark[0].required = false;  // 查询时备注非必需
}

/** 搜索功能 */
function handleQuery() {
  // 设置查询操作所需的校验规则
  rules.value.station[0].required = false;
  rules.value.remark[0].required = false;
  formRef.value.validate((valid) => {
    if (!valid) return;
    const snList = processSnInput(formData.value.inputSn);
    if (snList.length === 0) {
      proxy.$message.warning("请输入至少一个SN");
      return;
    }
    if (!formData.value.dbDataSource) {
      proxy.$message.warning("请选择数据源");
      return;
    }
    if (!formData.value.jumpType) {
      proxy.$message.warning("请选择跳站类型");
      return;
    }
    clearResultTable();
    formData.value.remark = "";
    formData.value.sfc = "";
    loading.value = true;
    const query = {
      snList: snList,
      jumpType: formData.value.jumpType,
      dbDataSource: formData.value.dbDataSource,
    };
    querySnList(query)
      .then((res) => {
        const resultData = res.rows || [];
        resultTable.title = 'SN 查询结果';
        if (resultData.length > 0) {
          resultTable.columns = Object.keys(resultData[0]);
          resultTable.data = resultData;
          total.value = res.total || resultData.length;
          proxy.$message.success(`查询完成,共找到 ${total.value} 条记录`);
        } else {
          proxy.$message.info('查询完成,未找到相关数据。');
        }
        loading.value = false;
        // 回填SFC数据
        fillSfcData(res.rows);
      })
      .catch((err) => {
        loading.value = false;
        console.error('查询失败:', err);
        proxy.$message.error('查询失败');
      });
  });
}

/** 回填SFC数据 */
function fillSfcData(rows) {
  if (rows && rows.length > 0 && rows[0].sfc) {
    // 获取第一个对象的sfc字段值
    const sfcValue = rows[0].sfc;
    const formattedSfc = formatSfcWithStationNames(sfcValue);
    formData.value.sfc = formattedSfc;
  } else {
    formData.value.sfc = "";
  }
}

/** 格式化SFC路径 将站点代码转换为站点名称 映射为code-name 形式 */
function formatSfcWithStationNames(sfcPath) {
  if (!sfcPath) return "";
  const stationCodes = sfcPath.split("/");
  const formattedStations = stationCodes.map((code) => {
    const station = stationOptions.value.find(
      (option) => option.value === code,
    );
    // 如果有对应的站点信息 返回code-name形式 否则只返回code
    return station ? `${code}-${station.label.split("-")[1]}` : code;
  });
  return formattedStations.join("\n");
}

/** 类型选择变化时 获取对应的站点信息 */
function handleJumpTypeChange(value) {
  if (!value) {
    stationOptions.value = [];
    formData.value.station = undefined;
    return;
  }
  formData.value.station = undefined;
  getStationList({ jumpType: value })
    .then((response) => {
      if (response.data) {
        stationOptions.value = response.data
          .map((item) => ({
            value: item.stationCode,
            label: item.stationCode + "-" + item.stationName,
          }))
          .filter((item) => item.label && item.value);
      } else {
        stationOptions.value = [];
      }
    })
    .catch((err) => {
      stationOptions.value = [];
      console.error('获取站点信息失败:', err);
    });
}
</script>

<style scoped>
.box-card :deep(.el-card__header) {
  padding: 5px 5px;
}
</style>