import request from '@/utils/request'

//执行字符串处理操作
export function execute(data) {
  return request({
    url: '/dailytools/stringtool/execute',
    method: 'post',
    data: data
  })
}