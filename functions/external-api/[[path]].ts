import { proxyJsonRequest, type ProxyContext } from '../_shared/proxy';

export function onRequestGet(context: ProxyContext): Promise<Response> {
  return proxyJsonRequest(context, {
    baseUrl: 'https://api.xygeng.cn/openapi',
    allowedPath: /^one$/,
  });
}
