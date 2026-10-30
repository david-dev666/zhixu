# 知序

面向安卓的技术选择题练习应用。九个领域各 300 道题，支持混合练习、单选与多选、答案解析、学习进度和错题回顾。每道题下方可展开「问问 DeepSeek」，围绕题目连续追问；切换题目后重新开始对话。旧主页题库已移除。

## 浏览器开发

```sh
npm install
npm run api
```

另开终端：

```sh
npm run web -- --host localhost --port 8081
```

访问 http://localhost:8081。本地题库服务监听 127.0.0.1:8082，读取 `.env.local` 中的 `DEEPSEEK_API_KEY`。该文件必须保持在 `.gitignore` 中，不能提交。浏览器代码不包含 Key。

## 安卓预览

`npm start` 后使用兼容 Expo SDK 57 的 Expo Go 扫码。内置题库离线可用。本机私用安卓包可内置 `.env.local` 中的 Key，安装后无需再填。`npm install` 或 `npm run provision:key` 会生成被 Git 忽略的 `src/embedded-key.local.ts`，仅原生端引用；网页始终使用空的前端配置和本地服务。设置中仍可更换 Key。手动保存的配置和学习记录保存在设备本地应用存储，卸载应用会清除。

## 题库与验证

- `npm run generate:bank`：固定调用 `deepseek-flash`，每领域十个子主题各三十题；支持断点续跑。
- `npm run review:bank`：使用同一 Flash 模型审校全题库，支持断点续跑；会产生额外 API 费用。
- `npm run check:bank`：验证各领域题数、唯一标识、重复题干、题型和选项约束。
- `npm test`：验证判分、数据校验和随机抽题。
- `npm run typecheck`：TypeScript 检查。

题目的格式及答案结构经过程序校验，知识内容尚未逐题人工审校。练习记录和追加题目保存在本机，当前没有云同步。
