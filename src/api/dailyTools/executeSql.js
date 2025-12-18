import request from '@/utils/request'

// 执行查询SQL
export function executeQuery(data) {
  return request({
    url: '/dailyTools/executeSql/query',
    method: 'post',
    data: data
  })
}

// 执行更新SQL
export function executeUpdate(data) {
  return request({
    url: '/dailyTools/executeSql/update',
    method: 'post',
    data: data
  })
}

// 执行插入SQL
export function executeInsert(data) {
  return request({
    url: '/dailyTools/executeSql/insert',
    method: 'post',
    data: data
  })
}

// 执行删除SQL
export function executeDelete(data) {
  return request({
    url: '/dailyTools/executeSql/delete',
    method: 'post',
    data: data
  })
}