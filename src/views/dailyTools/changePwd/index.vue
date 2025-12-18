<template>
  <div class="app-container">
    <el-form ref="formRef" :model="formData" :rules="rules" size="default" label-width="100px">
      <el-row>
        <el-col :span="9" :offset="1">
          <el-form-item label="当前工号" prop="loginFisNo">
            <el-input v-model="formData.loginFisNo" type="text" placeholder="当前用户FIS工号" show-word-limit readonly
              :disabled='true' :style="{ width: '100%' }"></el-input>
          </el-form-item>
          <el-form-item label="其他工号" prop="otherFisNo">
            <el-input v-model="formData.otherFisNo" type="text" placeholder="请输入要修改密码的FIS工号" :maxlength="7"
              show-word-limit clearable :style="{ width: '100%' }"></el-input>
          </el-form-item>
          <el-form-item label="数据源" prop="dbDataSource">
            <el-select v-model="formData.dbDataSource" placeholder="请选择数据源" clearable :style="{ width: '100%' }">
              <el-option v-for="dict in db_info" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="密码" prop="customPwd">
            <el-input v-model="formData.customPwd" type="password" placeholder="默认密码123" :maxlength="7" show-word-limit
              clearable show-password :style="{ width: '100%' }"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Edit" @click="submitForm('current')" :loading="currentBtnLoading"
              v-hasPermi="['dailyTools:changePwd:loginFisNo']">修改当前</el-button>
            <el-button icon="Edit" @click="submitForm('other')" :loading="otherBtnLoading"
              v-hasPermi="['dailyTools:changePwd:otherFisNo']">修改其他</el-button>
            <el-button icon="Refresh" @click="resetForm">重置</el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup name="ChangePwd">
import { ref, reactive, onMounted } from 'vue'
import { getCurrentInstance, toRefs } from 'vue'
import { changeCurrentPwd, changeOtherPwd } from '@/api/dailyTools/changePwd'
import useUserStore from '@/store/modules/user'
import { getInfo } from '@/api/login'

const { proxy } = getCurrentInstance()
const { db_info } = proxy.useDict("db_info")
const formRef = ref()
const userStore = useUserStore()
const currentBtnLoading = ref(false)
const otherBtnLoading = ref(false)

// 定义校验规则常量
const loginFisNoRules = []
const otherFisNoRules = [
  {
    required: true,
    message: '请输入其他用户FIS工号',
    trigger: 'blur'
  },
  {
    pattern: /^[a-zA-Z0-9]+$/,
    message: 'FIS工号只能由字母和数字组成!',
    trigger: 'blur'
  }
]
const dbDataSourceRules = [{
  required: true,
  message: '请选择数据源',
  trigger: 'change'
}]
const customPwdRules = [{
  required: true,
  message: '请输入密码:默认密码123',
  trigger: 'blur'
}]

const data = reactive({
  formData: {
    loginFisNo: '',
    otherFisNo: '',
    dbDataSource: undefined,
    customPwd: '123',
  },
  // 固定的校验规则对象
  rules: {
    loginFisNo: [...loginFisNoRules],
    otherFisNo: [...otherFisNoRules],
    dbDataSource: [...dbDataSourceRules],
    customPwd: [...customPwdRules],
  }
})

// 初始化时设置校验规则状态
data.rules.otherFisNo[0].required = false  // 修改当前时 其他工号非必需

const { formData, rules } = toRefs(data)

/** 表单提交 提交类型: 'current'(当前用户) 或 'other'(其他用户) */
function submitForm(type) {
  // 根据操作类型设置对应的校验规则
  if (type === 'other') {
    // 修改其他用户时 其他工号为必需
    rules.value.otherFisNo[0].required = true
  } else {
    // 修改当前用户时 其他工号非必需
    rules.value.otherFisNo[0].required = false
  }
  // 执行表单校验
  formRef.value.validate((valid) => {
    if (!valid) return
    performSubmit(type)
  })
}

/** 执行提交操作 */
function performSubmit(type) {
  if (type === 'current') {
    currentBtnLoading.value = true
    const requestData = {
      fisNumber: formData.value.loginFisNo,
      dbDataSource: formData.value.dbDataSource,
      password: formData.value.customPwd
    }
    changeCurrentPwd(requestData)
      .then(response => {
        proxy.$modal.msgSuccess(response.msg || '密码修改成功')
      })
      .finally(() => {
        currentBtnLoading.value = false
      })
  } else if (type === 'other') {
    otherBtnLoading.value = true
    const requestData = {
      fisNumber: formData.value.otherFisNo,
      dbDataSource: formData.value.dbDataSource,
      password: formData.value.customPwd
    }
    changeOtherPwd(requestData)
      .then(response => {
        proxy.$modal.msgSuccess(response.msg || '密码修改成功')
      })
      .finally(() => {
        otherBtnLoading.value = false
      })
  }
}

/** 表单重置 */
function resetForm() {
  formRef.value.resetFields()
  formData.value.otherFisNo = ''
  formData.value.customPwd = '123'
  // 重置所有校验规则到初始状态
  resetValidationRules()
  // 清除表单验证状态
  setTimeout(() => {
    if (formRef.value) {
      formRef.value.clearValidate()
    }
  }, 10)
}

/** 重置校验规则到初始状态-不要使用两套单独校验规则切换 否则重置会有问题 */
function resetValidationRules() {
  // 重置所有校验规则
  rules.value.loginFisNo = [...loginFisNoRules]
  rules.value.otherFisNo = [...otherFisNoRules]
  rules.value.dbDataSource = [...dbDataSourceRules]
  rules.value.customPwd = [...customPwdRules]
  // 恢复特定规则的初始状态
  rules.value.otherFisNo[0].required = false  // 其他工号默认非必需
}

/** 获取当前用户FIS账号 */
function getCurrentUserFisNo() {
  // 从store中尝试获取fisNumber 先从前端获取当前用户FIS账号 如果获取不到则调用后端接口获取
  const fisNumber = userStore.fisNumber
  if (fisNumber) {
    formData.value.loginFisNo = fisNumber
  } else {
    // 如果store中没有fisNumber 则调用后端接口获取用户信息
    getInfo().then(res => {
      const user = res.user
      if (user && user.fisNumber) {
        formData.value.loginFisNo = user.fisNumber
        // 同时更新store中的信息
        userStore.fisNumber = user.fisNumber
      } else {
        proxy.$modal.msgWarning('无法获取当前用户FIS账号')
      }
    }).catch(error => {
      console.error("获取用户信息失败:", error)
    })
  }
}

/** 页面加载时获取当前用户FIS账号 */
onMounted(() => {
  getCurrentUserFisNo()
})
</script>