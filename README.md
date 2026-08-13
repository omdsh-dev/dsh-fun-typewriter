# @deepseek-ai/dsh-fun-typewriter

为 DSH Web 增加打字机/机械键盘氛围音：助手流式输出敲击、发送回弹、完成提示、
错误低鸣、输入按键音，以及会话头部静音按钮和完整设置页。音效全部由 WebAudio
实时合成，不包含音频文件，也不访问任何外部服务。

## 安装

```bash
# 已登录私有 npm registry
dsh plugin --profile web add @deepseek-ai/dsh-fun-typewriter@0.0.1-rc.3

# 本地开发 checkout
dsh plugin --profile web add link:/path/to/dsh-fun-typewriter
```

包内已经声明 `dsh.bundle.patch`；`dsh plugin add` 会自动维护 Profile Bundle。
不要手工修改 profile manifest，也不要重复插入 `fun-typewriter` loader row，否则会
得到 `duplicate loader entry id`。

## 行为与权限

- 浏览器第一次用户手势后才创建 `AudioContext`，遵守自动播放策略；
- 设置包含总开关/音量、流式音色与节奏、发送/完成/错误/输入音开关；
- 设置通过插件自有的 `/plugins/dsh-fun-typewriter/api/settings` 读写，不依赖 DSH
  rc.3 配置面的 namespace allowlist；该端点仅接受 loopback 同源请求；
- 零音频资源、零第三方请求、零密钥。

## 兼容性

| 组件 | 支持范围 |
| --- | --- |
| DSH | `>=0.1.0-rc.3 <0.2.0` |
| Node.js | `>=22.19.0` |
| Profile | `web` |

宿主 API 使用 rc.3 的 `webServer` 服务名。客户端依赖 rc.3 的
`settings.section`、`conversation.input.dock` 和
`conversation.session.header.actions` slots。

## 开发

```bash
npm install --legacy-peer-deps
DSH_NODE_MODULES=/path/to/dsh-runtime/node_modules npm run setup:dsh-workspace
npm run typecheck
npm test
npm run build
npm pack
```

构建产出 `lib/index.js`（宿主）和 `lib/client.js`（浏览器 ModuleLoader 包）。

## License

BSD-3-Clause
