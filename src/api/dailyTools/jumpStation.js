import request from '@/utils/request'

//获取站点List name-code
export function getStationList(query) {
    return request({
        url: '/dailytools/jumpStation/getStationList',
        method: 'get',
        params: query
    })
}
// 查询SN的信息
export function list(data) {
    return request({
        url: '/dailytools/jumpStation/list',
        method: 'post',
        data: data
    })
}

//执行跳站操作
export function execute(data) {
    return request({
        url: '/dailytools/jumpStation/execute',
        method: 'post',
        data: data
    })
}

