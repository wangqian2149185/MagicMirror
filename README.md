# MagicMirror

MagicMirror 是一个手机可用的人格画像 / 自我反思访谈工具。它会按照 `assets/personality_portrait_guide.md` 的问题引导用户回答开放题、1-10 评分题和 YES/NO 校准题，最后生成总结、MBTI 风格评估和多边形图。

结果仅供参考，不作为医学、心理、法律、财务或其他专业建议。

## 扫码直接使用

用 iPhone 相机或 Safari 扫描下面的二维码，直接打开运行中的 MagicMirror：

[https://wangqian2149185.github.io/MagicMirror/](https://wangqian2149185.github.io/MagicMirror/)

<p align="center">
  <a href="https://wangqian2149185.github.io/MagicMirror/">
    <img src="assets/magicmirror-qr.png" alt="MagicMirror GitHub Pages QR code" width="360" />
  </a>
</p>

## 直接在 iPhone 上使用

这是不需要 Apple Developer 年费、不需要 App Store 的使用方式。

1. 用 iPhone 打开 Safari。
2. 访问：

   ```text
   https://wangqian2149185.github.io/MagicMirror/
   ```

3. 等页面打开后，点击 Safari 底部的分享按钮。
4. 选择 `添加到主屏幕` / `Add to Home Screen`。
5. 名字保持 `MagicMirror`，点击添加。
6. 回到 iPhone 主屏幕，点击 MagicMirror 图标即可像 App 一样使用。

## App 内使用步骤

1. 第一次打开后，先选择语言：`中文` 或 `EN`。
2. 如果没有 API key，选择 `免费本地模式 / Free Local`。
3. 如果有 API key，可以选择 OpenAI、Anthropic、Gemini、OpenRouter 等 provider，并填写 model 和 API key。
4. 点击开始访谈。
5. 遇到开放题时，可以输入文字；在支持语音识别的环境下也可以使用语音输入。
6. 遇到 1-10 评分题时，点击从低到高排列的评分按钮。
7. 遇到 YES/NO 校准题时，点击 `YES` 或 `NO`。
8. 每个 section 完成后，MagicMirror 会根据前面的开放题和评分题做本地或 AI 总结，再用 YES/NO 问题校准。
9. 所有 section 完成后，点击生成报告。
10. 查看三页结果：总结、MBTI、多边形图。
11. 需要保存时，点击 `Copy Markdown`，把报告复制到备忘录、邮件或文档里。

## 免费本地模式说明

免费本地模式可以完整跑完访谈、生成总结、MBTI 页面和多边形图，不需要 API key。

如果在 GitHub Pages 网页版里使用第三方 API key，某些 provider 可能因为浏览器 CORS 限制而失败。最稳定的无成本方案是选择 `免费本地模式 / Free Local`。

## 更新后的图标

App / PWA 图标来自 `assets/icon.png`。GitHub Pages 每次部署时会自动把它复制成网页和 iPhone 主屏幕需要的图标文件。

## 开发者本地运行

1. 安装 Node.js 和 npm。
2. 克隆仓库：

   ```sh
   git clone https://github.com/wangqian2149185/MagicMirror.git
   cd MagicMirror
   ```

3. 安装依赖：

   ```sh
   npm install
   ```

4. 本地启动网页版：

   ```sh
   npm run web
   ```

5. 构建 GitHub Pages 静态版本：

   ```sh
   npm run build:web
   ```

6. 类型检查：

   ```sh
   npm run typecheck
   ```

## 自动部署到 GitHub Pages

仓库已经配置 `.github/workflows/deploy-pages.yml`。

每次 push 到 `main` 后，GitHub Actions 会自动：

1. 安装依赖。
2. 运行 TypeScript 检查。
3. 构建 Web/PWA 版本。
4. 发布到 GitHub Pages。

公开访问地址：

```text
https://wangqian2149185.github.io/MagicMirror/
```

## iPhone 原生开发版本

如果需要继续在 Xcode 里安装原生开发版本：

1. 安装 Xcode。
2. 用 USB 连接 iPhone，并信任这台 Mac。
3. 在项目目录运行：

   ```sh
   npm run ios
   ```

原生版本支持 iOS 原生语音识别。公开发布到 App Store 需要 Apple Developer Program 年费；当前推荐使用 GitHub Pages PWA 版本。

## 隐私说明

MagicMirror 会把设置、访谈进度和报告保存在本机浏览器或设备存储中。

如果选择免费本地模式，访谈内容不需要发送给第三方模型 provider。

如果填写 API key 并选择云模型，访谈内容会发送给所选 provider 用于生成总结和报告。第三方 provider 的数据处理规则以其自己的隐私政策为准。
