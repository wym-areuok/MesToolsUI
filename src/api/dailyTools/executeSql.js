import request from '@/utils/request'

// 执行查询SQL
export function executeQuery(data) {
  return request({
    url: '/dailytools/executeSql/query',
    method: 'post',
    data: data
  })
}

// 执行更新SQL
export function executeUpdate(data) {
  return request({
    url: '/dailytools/executeSql/update',
    method: 'put',
    data: data
  })
}

// 执行插入SQL
export function executeInsert(data) {
  return request({
    url: '/dailytools/executeSql/insert',
    method: 'post',
    data: data
  })
}

// 执行删除SQL
export function executeDelete(data) {
  return request({
    url: '/dailytools/executeSql/delete',
    method: 'delete',
    data: data
  })
}