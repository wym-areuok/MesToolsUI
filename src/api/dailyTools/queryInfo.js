import request from '@/utils/request'

// 查询资料列表
export function list(query) {
    return request({
        url: '/dailytools/queryInfo/list',
        method: 'get',
        params: query
    })
}

// 查询资料详细
export function getInfo(infoId) {
    return request({
        url: '/dailytools/queryInfo/' + infoId,
        method: 'get'
    })
}

// 新增资料
export function addInfo(data) {
    return request({
        url: '/dailytools/queryInfo',
        method: 'post',
        data: data
    })
}

// 修改资料
export function updateInfo(data) {
    return request({
        url: '/dailytools/queryInfo',
        method: 'put',
        data: data
    })
}

// 删除资料
export function deleteInfo(infoId) {
    return request({
        url: '/dailytools/queryInfo/' + infoId,
        method: 'delete'
    })
}