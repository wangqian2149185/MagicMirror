# MagicMirror

[中文](#中文说明) | [English](#english-guide)

## 中文说明

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

---

## English Guide

[中文](#中文说明) | [English](#english-guide)

MagicMirror is a mobile-friendly personality portrait and self-reflection interview tool. It follows the guide in `assets/personality_portrait_guide.md`, asks open questions, 1-10 scoring questions, and YES/NO calibration questions, then generates a summary, an MBTI-style assessment, and polygon charts.

Results are for reference only. They are not medical, psychological, legal, financial, or professional advice.

## Scan To Use

Use the iPhone Camera app or Safari to scan this QR code and open the running MagicMirror app:

[https://wangqian2149185.github.io/MagicMirror/](https://wangqian2149185.github.io/MagicMirror/)

<p align="center">
  <a href="https://wangqian2149185.github.io/MagicMirror/">
    <img src="assets/magicmirror-qr.png" alt="MagicMirror GitHub Pages QR code" width="360" />
  </a>
</p>

## Use On iPhone

This is the no-App-Store, no-Apple-Developer-fee option.

1. Open Safari on iPhone.
2. Go to:

   ```text
   https://wangqian2149185.github.io/MagicMirror/
   ```

3. Wait for the page to load.
4. Tap the Safari share button.
5. Tap `Add to Home Screen`.
6. Keep the name as `MagicMirror`, then tap Add.
7. Open MagicMirror from the iPhone Home Screen.

## In-App Steps

1. On first launch, choose `中文` or `EN`.
2. If you do not have an API key, choose `Free Local`.
3. If you have an API key, choose a provider such as OpenAI, Anthropic, Gemini, or OpenRouter, then enter the model and API key.
4. Start the interview.
5. For open questions, type your answer. Voice input may work when the browser/device supports speech recognition.
6. For 1-10 scoring questions, tap one of the rising score buttons.
7. For YES/NO calibration questions, tap `YES` or `NO`.
8. After each section, MagicMirror summarizes the section locally or with AI, then uses YES/NO questions for calibration.
9. After all sections are complete, generate the report.
10. Review the three result pages: Summary, MBTI, and Polygon.
11. Tap `Copy Markdown` if you want to save the report in Notes, email, or a document.

## Free Local Mode

Free Local mode can complete the full interview, summary, MBTI page, and polygon charts without an API key.

Third-party API-key calls from the GitHub Pages web version may fail because of browser CORS restrictions. For the most reliable free setup, choose `Free Local`.

## Developer Setup

1. Install Node.js and npm.
2. Clone the repository:

   ```sh
   git clone https://github.com/wangqian2149185/MagicMirror.git
   cd MagicMirror
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

4. Run the local web app:

   ```sh
   npm run web
   ```

5. Build the GitHub Pages static version:

   ```sh
   npm run build:web
   ```

6. Run type checking:

   ```sh
   npm run typecheck
   ```

## GitHub Pages Deployment

The repository uses `.github/workflows/deploy-pages.yml`.

Every push to `main` automatically:

1. Installs dependencies.
2. Runs TypeScript checks.
3. Builds the Web/PWA version.
4. Deploys to GitHub Pages.

Public app URL:

```text
https://wangqian2149185.github.io/MagicMirror/
```

## Privacy

MagicMirror stores settings, interview progress, and reports in local browser or device storage.

If you choose Free Local mode, interview content does not need to be sent to a third-party model provider.

If you enter an API key and choose a cloud model, interview content is sent to the selected provider for summary and report generation. Each third-party provider handles data according to its own privacy policy.
