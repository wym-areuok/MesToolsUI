<template>
  <div class="app-container home">
    <!-- 顶部欢迎区域 -->
    <el-card class="welcome-card" shadow="hover">
      <div class="welcome-header">
        <div class="welcome-text">
          <h2 class="greet-title">
            {{ greeting }}
            <el-tag :type="systemStatus ? 'success' : 'danger'" effect="dark" size="small" round class="ml-10"
              style="vertical-align: middle;">
              {{ systemStatus ? '系统正常' : '服务异常' }}
            </el-tag>
            <el-tag type="info" effect="plain" size="small" round class="ml-10" style="vertical-align: middle;">
              IP: {{ clientIp }}
            </el-tag>
          </h2>
          <p class="greet-desc">集成开发、运维与日常管理的综合效能平台。请从下方选择工具开始工作。</p>
          <div class="welcome-search mt-20">
            <el-input ref="searchInputRef" v-model="searchKeyword" placeholder="搜索工具或知识库资料... (Ctrl+K)" size="large"
              class="search-input" @keyup.enter="handleGlobalSearch">
              <template #append><el-button icon="Search" @click="handleGlobalSearch" /></template>
            </el-input>
          </div>
        </div>
        <div class="welcome-stat">
          <el-statistic title="已集成工具" :value="toolList.length" />
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" class="mt-20">
      <!-- 左侧：快捷入口 -->
      <el-col :xs="24" :sm="24" :md="16" :lg="17">
        <el-card class="box-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon class="mr-5">
                  <Menu />
                </el-icon> 快捷入口</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="12" :sm="8" :md="8" :lg="6" v-for="(tool, index) in filteredToolList" :key="index"
              class="mb-20" v-hasPermi="tool.permissions">
              <div class="tool-item" @click="handleNav(tool.path)">
                <div class="tool-icon" :style="{ backgroundColor: tool.bgColor }">
                  <el-icon :size="24" color="#fff">
                    <component :is="tool.icon" />
                  </el-icon>
                </div>
                <div class="tool-info">
                  <div class="tool-title">{{ tool.title }}</div>
                  <div class="tool-desc">{{ tool.desc }}</div>
                  <div v-if="tool.count" class="mt-5">
                    <el-tag size="small" type="info" effect="plain" round>{{ tool.count }} 条数据</el-tag>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>

      <!-- 右侧：更新日志/公告 -->
      <el-col :xs="24" :sm="24" :md="8" :lg="7">
        <el-card class="box-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon class="mr-5">
                  <Bell />
                </el-icon> 更新日志</span>
              <el-tag size="small" effect="plain">v1.0.0</el-tag>
            </div>
          </template>
          <div class="update-log-scroll">
            <el-timeline>
              <el-timeline-item v-for="(log, index) in updateLogs" :key="index" :timestamp="log.timestamp"
                placement="top" :type="log.type" :color="log.color">
                <div class="timeline-content">
                  <h4>{{ log.title }}</h4>
                  <p>{{ log.content }}</p>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>

        <el-card class="box-card mt-20" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon class="mr-5">
                  <InfoFilled />
                </el-icon> 关于项目</span>
            </div>
          </template>
          <div class="about-section">
            <p>MES Tools UI 是基于 Vue3 + Element Plus 构建的工具集合。<br>
              如果在使用过程中遇到问题，请联系管理员。</p>
            <div class="tech-tags">
              <el-tag class="mr-5">Vue 3</el-tag>
              <el-tag class="mr-5" type="success">Vite</el-tag>
              <el-tag type="warning">Element Plus</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Index">
import { useRouter } from 'vue-router';
import { reactive, onMounted, onUnmounted, ref, computed } from 'vue';
import { list as getQueryInfoList } from '@/api/dailyTools/queryInfo';
import useUserStore from '@/store/modules/user';
import { getInfo } from '@/api/login';

const router = useRouter()
const userStore = useUserStore()
const searchKeyword = ref('')
const searchInputRef = ref(null)
const clientIp = ref('Loading...')
const systemStatus = ref(true)

// 更新日志数据
const updateLogs = [
  { timestamp: '2025-12-20', title: 'MES工具箱测试完成', content: '集成SQL执行、跳站、密码修改等功能。', type: 'primary' },
  { timestamp: '2025-12-10', title: '功能初步完成进行测试', content: '功能初步完成进行测试。', color: '#E6A23C' },
  { timestamp: '2025-11-20', title: '项目开始', content: '没有内容。', type: 'primary' },
]

// 工具列表配置
const toolList = reactive([
  {
    title: 'FisWeb密码修改',
    desc: '修改FIS/其他工号密码',
    icon: 'Lock',
    path: '/dailyTools/changePwd',
    bgColor: '#409EFF',
    permissions: ['dailyTools:changePwd:loginFisNo']
  },
  {
    title: 'SQL 执行器',
    desc: '在线执行数据库查询',
    icon: 'Coin',
    path: '/dailyTools/executeSql',
    bgColor: '#67C23A',
    permissions: ['dailyTools:executeSql:query']
  },
  {
    title: '跳站工具',
    desc: 'SN批量跳站处理',
    icon: 'Position',
    path: '/dailyTools/jumpStation',
    bgColor: '#E6A23C',
    permissions: ['dailyTools:jumpStation:query']
  },
  {
    title: '资料查询',
    desc: '知识库资料检索',
    icon: 'Search',
    path: '/dailyTools/queryInfo',
    bgColor: '#F56C6C',
    permissions: ['dailyTools:queryInfo:list'],
    count: 0
  },
  {
    title: '字符串工具',
    desc: '文本处理与格式转换',
    icon: 'EditPen',
    path: '/dailyTools/stringTool',
    bgColor: '#909399',
    permissions: ['dailyTools:stringTool:execute']
  }, {
    title: '接口管理',
    desc: '接口信息查询和发送',
    icon: 'Search',
    path: '/dailyTools/apiManage',
    bgColor: '#4285F4',
    permissions: ['dailyTools:apiManage:list'],
    count: 0
  }
])

// 动态问候语
const greeting = computed(() => {
  const hour = new Date().getHours()
  let timeText = ''
  if (hour < 12) timeText = '上午好'
  else if (hour < 18) timeText = '下午好'
  else timeText = '晚上好'

  const name = userStore.nickName || userStore.name || '用户'
  return `${timeText}，${name}！`
})

// 搜索过滤工具列表
const filteredToolList = computed(() => {
  if (!searchKeyword.value) return toolList
  const keyword = searchKeyword.value.toLowerCase()
  return toolList.filter(tool =>
    tool.title.toLowerCase().includes(keyword) ||
    tool.desc.toLowerCase().includes(keyword)
  )
})

onMounted(() => {
  // 获取资料查询的总数
  getQueryInfoList({ pageNum: 1, pageSize: 1 }).then(res => {
    const infoTool = toolList.find(t => t.path === '/dailyTools/queryInfo')
    if (infoTool) {
      infoTool.count = res.total
    }
  }).catch(e => console.log('获取资料统计失败', e))

  // 获取用户信息(IP)及检测系统状态
  getInfo().then(res => {
    if (res.user && res.user.loginIp) {
      clientIp.value = res.user.loginIp
    } else {
      clientIp.value = '未知'
    }
    systemStatus.value = true
  }).catch(() => {
    clientIp.value = '获取失败'
    systemStatus.value = false
  })

  // 绑定快捷键
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchInputRef.value?.focus()
  }
}

function handleNav(path) {
  router.push(path)
}

function handleGlobalSearch() {
  if (!searchKeyword.value) return
  router.push({ path: '/dailyTools/queryInfo', query: { keyword: searchKeyword.value } })
}
</script>

<style scoped lang="scss">
.home {
  .welcome-card {
    border: none;
    background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%);

    .welcome-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 10px;
    }

    .greet-title {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 10px 0;
    }

    .greet-desc {
      color: #606266;
      margin: 0;
      font-size: 14px;
    }

    .welcome-search {
      max-width: 400px;

      :deep(.el-input-group__append) {
        background-color: #409EFF;
        color: white;
        border-color: #409EFF;
      }
    }
  }

  .mt-20 {
    margin-top: 20px;
  }

  .mt-5 {
    margin-top: 5px;
  }

  .mt-10 {
    margin-top: 10px;
  }

  .mb-20 {
    margin-bottom: 20px;
  }

  .mr-5 {
    margin-right: 5px;
  }

  .ml-10 {
    margin-left: 10px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
  }

  // 工具卡片样式
  .tool-item {
    display: flex;
    align-items: center;
    padding: 15px;
    border-radius: 8px;
    background-color: #f8f9fa;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;

    &:hover {
      background-color: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
      border-color: #ebeef5;
    }

    .tool-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 15px;
      flex-shrink: 0;
    }

    .tool-info {
      overflow: hidden;

      .tool-title {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tool-desc {
        font-size: 12px;
        color: #909399;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .timeline-content {
    h4 {
      margin: 0 0 5px;
      font-size: 14px;
      font-weight: 600;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: #909399;
    }
  }

  .update-log-scroll {
    max-height: 300px;
    overflow-y: auto;
    padding-right: 5px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #e0e3e9;
      border-radius: 4px;
    }
  }

  .about-section {
    font-size: 14px;
    color: #606266;
    line-height: 1.6;

    .tech-tags {
      margin-top: 10px;
    }
  }
}
</style>