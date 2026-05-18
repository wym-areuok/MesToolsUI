import request from '@/utils/request'

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

// 查询历史记录列表
export function listHistory(query) {
  return request({
    url: '/dailytools/apiManage/history/list',
    method: 'get',
    params: query
  })
}

// 删除单条历史记录
export function delHistory(historyId) {
  return request({
    url: '/dailytools/apiManage/history/' + historyId,
    method: 'delete'
  })
}

// 清空某个接口的全部历史记录
export function clearHistory(itemId) {
  return request({
    url: '/dailytools/apiManage/history/clear/' + itemId,
    method: 'delete'
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

// 发送代理请求 (解决浏览器跨域问题，核心接口)
export function proxyRequest(data) {
  return request({
    url: '/dailytools/apiManage/proxy',
    method: 'post',
    data: data
  })
}
