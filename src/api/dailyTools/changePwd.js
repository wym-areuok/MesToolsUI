import request from "@/utils/request";

// 修改当前用户密码
export function changeCurrentPwd(data) {
    return request({
        url: "/dailytools/changePwd/current",
        method: "put",
        data: data
    });
}

// 修改其他用户密码
export function changeOtherPwd(data) {
    return request({
        url: "/dailytools/changePwd/other",
        method: "put",
        data: data
    });
}