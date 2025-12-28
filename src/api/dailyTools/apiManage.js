import request from '@/utils/request'

// --- 接口/目录树管理 ---

// 查询接口树形列表
export function listApiTree(query) {
  return request({
    url: '/dailytools/apiManage/tree',
    method: 'get',
    params: query
  })
}

// 获取接口详细信息 (用于点击节点时获取完整数据)
export function getApi(itemId) {
  return request({
    url: '/dailytools/apiManage/' + itemId,
    method: 'get'
  })
}

// 新增接口/目录
export function addApi(data) {
  return request({
    url: '/dailytools/apiManage',
    method: 'post',
    data: data
  })
}

// 修改接口/目录 (保存接口详情、重命名、拖拽移动)
export function updateApi(data) {
  return request({
    url: '/dailytools/apiManage',
    method: 'put',
    data: data
  })
}

// 删除接口/目录
export function delApi(itemId) {
  return request({
    url: '/dailytools/apiManage/' + itemId,
    method: 'delete'
  })
}

// 锁定/解锁接口
export function toggleLock(itemId, isLocked) {
  return request({
    url: `/dailytools/apiManage/lock/${itemId}/${isLocked}`,
    method: 'put'
  })
}


// --- 环境管理 ---

// 查询环境列表
export function listEnv(query) {
  return request({
    url: '/dailytools/apiManage/env/list',
    method: 'get',
    params: query
  })
}

// 批量保存环境列表 (适配前端一次性保存所有环境的逻辑)
export function saveEnvList(data) {
  return request({
    url: '/dailytools/apiManage/env/batch',
    method: 'post',
    data: data
  })
}

// --- 历史记录 ---

// 查询历史记录列表
export function listHistory(query) {
  return request({
    url: '/dailytools/apiManage/history/list',
    method: 'get',
    params: query
  })
}

// 新增历史记录 (通常由后端在代理请求成功后自动记录，但也提供手动接口)
export function addHistory(data) {
  return request({
    url: '/dailytools/apiManage/history',
    method: 'post',
    data: data
  })
}

// --- 核心功能 ---

// 发送代理请求 (解决浏览器跨域问题，核心接口)
export function proxyRequest(data) {
  return request({
    url: '/dailytools/apiManage/proxy',
    method: 'post',
    data: data
  })
}

// 导出所有数据
export function exportData() {
  return request({
    url: '/dailytools/apiManage/export',
    method: 'get'
  })
}

// 导入数据
export function importData(data) {
  return request({
    url: '/dailytools/apiManage/import',
    method: 'post',
    data: data
  })
}
