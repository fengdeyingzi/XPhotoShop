# XPhotoShop

[![中文](https://img.shields.io/badge/语言-中文-blue)]()
[![JavaScript](https://img.shields.io/badge/语言-JavaScript-yellow)]()
[![HTML5](https://img.shields.io/badge/技术-HTML5-orange)]()

> 基于 Web 技术的轻量级像素图片编辑器，支持 PSD 文件格式和丰富的图层功能

## 🌟 项目简介

**XPhotoShop** 是一个使用纯 JavaScript 和 HTML5 开发的在线PhotoShop编辑器。没有使用任何第三方框架，插件化开发机制，主程序只实现基础的绘图功能和插件接口。

![image-main](main.png)

### 核心特性

**完整功能**：
- 支持打开/保存 PSD 文件
- 插件化开发模式（scripts文件夹），并完美兼容油猴插件，既可以通过油猴加载插件，也可以配置插件列表从内部加载插件
- 完整的图层系统（支持图层文件夹）
- 撤销/重做历史记录
- 支持通过插件无限拓展，任何你想到的工具都可以拓展成插件
- AI编程友好，提供文档说明

**目前已实现的插件功能**
- 基础图形绘制工具
- 选区、多边形选区、魔棒工具
- 移动、裁剪、矩形、圆角矩形、线段工具（画笔工具按shift画线）
- 颜色替换、添加轮廓功能
- 亮度/饱和度/色相调节
- 色轮插件
- 更多滤镜功能及绘图



## 🚀 快速开始

### 运行方式
使用vscode插件File Server打开 `index.html` 在浏览器中运行（或者使用其它本地服务器）
