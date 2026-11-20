# 本地搜索

本地搜索

版本：0.1.1；适用于 MyTools，不能作为独立网页调用宿主能力。

## 安装

在 MyTools 插件管理的 npm 安装入口输入 `@mytools-all/mytools-search@0.1.1`。也可以下载本仓库，在开发者页面选择“安装本地目录”。

## 开发

直接编辑本目录的 HTML、JavaScript 和样式，无需依赖宿主源码或其他插件仓库。修改后重新安装本地目录。运行 `npm test` 检查包内契约和逻辑。插件 API 规范见 [mytools](https://github.com/mytools-all/mytools/tree/main/docs)。

## 权限

声明的宿主能力：fs.searchstatus、fs.globalsearch、fs.searchpreview、fs.searchicons、shell.open、shell.reveal、clipboard.write、app.list、app.launch。目录和危险操作仍需用户授权。

## 许可

项目代码使用 MIT；随附的第三方代码遵循各自随附的许可证。

## 0.1.1 更新

已同步空搜索不显示结果的源码改动：打开页面、刷新或调整筛选时，搜索词为空均不发起文件搜索；清空搜索词立即清空结果，并忽略尚未返回的旧搜索或预览。保留结果展示改进。

本地安装使用独立插件目录；重新构建主程序不会自动同步本仓库。源码目录与已安装目录相互独立，更新后请关闭并重新打开插件。
