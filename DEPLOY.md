# 公网部署说明

这个项目已经准备好部署到 Render、Railway 或任何支持 Node.js / Docker 的云平台。

## 推荐方式一：Render

适合最简单上线，能直接得到一个公开网址。

1. 把本项目上传到 GitHub。
2. 打开 Render，选择 New > Blueprint。
3. 选择这个 GitHub 仓库。
4. Render 会读取 `render.yaml`。
5. 部署完成后，打开 Render 给你的公网网址即可游玩。

项目已包含：

- `render.yaml`：Render 自动部署配置
- `/healthz`：健康检查地址
- `PORT` 自适应：Render 分配什么端口，服务就监听什么端口

## 推荐方式二：Railway

1. 把本项目上传到 GitHub。
2. 在 Railway 创建新项目。
3. 选择 Deploy from GitHub repo。
4. 选择这个仓库。
5. Railway 会读取 `railway.json` 和 `Dockerfile`。
6. 部署完成后，在 Railway 里生成公开域名。

项目已包含：

- `railway.json`：Railway 部署配置
- `Dockerfile`：容器部署配置
- `/healthz`：健康检查地址

## 方式三：任意服务器

服务器需要安装 Node.js 20 或以上。

```bash
npm install
npm start
```

如果使用云服务器，请开放服务端口。默认端口是 3000，也可以通过环境变量修改：

```bash
PORT=8080 npm start
```

## 注意事项

当前版本为了最快完成，房间数据保存在服务器内存里：

- 服务重启后，房间会清空。
- 免费云平台如果休眠，房间也可能清空。
- 适合朋友试玩和 MVP 验证。

如果后续要长期运营，可以再加数据库和持久化房间/战绩。
