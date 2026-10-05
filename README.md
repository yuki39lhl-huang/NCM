# maid in 彦斋

在自己的电脑上，把网易云音乐的 NCM 文件转成原始音质的 MP3 或 FLAC。封面写入 MP3，不会重新编码。

本工具与网易云音乐无关。请只转换你有权使用的文件。

## 下载便携版

不需要安装 Node.js 或 Electron，下载后双击即可使用。

[下载 Windows 便携版](https://github.com/yuki39lhl-huang/NCM-/releases/download/v1.0.0/maid-in-portable.zip)

也可以从 [Releases](https://github.com/yuki39lhl-huang/NCM-/releases/latest) 页面下载 `maid-in-portable.zip`。解压后的程序是 `maid in 彦斋.exe`，双击即可使用。GitHub 不能保留带空格和中文的下载文件名，所以发布页上的压缩包用了英文名。

第一次打开时，Windows 可能提示未知发布者，选择仍要运行。

使用步骤：

1. 添加 `.ncm` 文件，或把文件拖进窗口。
2. 选择输出目录。
3. 点击「开始转换」，阅读提示后选择「继续转换」。

## 拉取源码后运行

需要已安装 Node.js 20 或更高版本。

```bash
cd desktop
npm install
npm run dev
```

`npm run dev` 会打开开发窗口。转换逻辑在 `desktop/src/main/ncm.ts`。

## 自己打包便携版

在 `desktop` 目录执行：

```bash
npm install
npm run build:win
```

国内网络如果下载 Electron 运行时失败，可以先设置镜像再打包：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run build:win
```

打包结果在 `desktop/dist/maid in 彦斋.exe`。
