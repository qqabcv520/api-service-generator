// 请求外层包裹对象
export default interface HttpResult<T> {
  authorizedRequest: boolean;
  // 请求消耗时间
  costTime: number;
  // 错误信息
  errorInfos: Array<any>;
  // 返回数据体
  result: T;
  // 请求ID
  seqNo: string;
  // 请求是否成功
  success: boolean;
  targetUrl?: string;
}
