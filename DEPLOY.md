# 公网部署说明

这个项目已经准备好部署到 Render、Railway 或任何支持 Node.js / Docker 的云平台。

## 推荐方式：Render

Render 会把你的 GitHub 仓库部署成一个公网网址，朋友打开网址就能玩。

### 你需要先准备好

- GitHub 仓库已经上传项目文件。
- 仓库根目录里能看到这些文件：
  - `package.json`
  - `server.js`
  - `public/index.html`
  - `render.yaml`
- Render 账号已经登录。

### 方法 A：用 Blueprint 部署，推荐

项目已经带了 `render.yaml`，所以推荐用 Blueprint。

1. 打开 Render Dashboard。
2. 点击右上角 `New`。
3. 选择 `Blueprint`。
4. 如果还没连接 GitHub，点击 `Connect GitHub`。
5. 授权 Render 访问你的 GitHub。
6. 仓库权限建议选择 `Only select repositories`，然后勾选：
   `wuniii/mahjong-memory-party`
7. 回到 Render 后，选择仓库：
   `wuniii/mahjong-memory-party`
8. Render 会自动读取 `render.yaml`。
9. 确认服务名称类似：
   `mahjong-memory-party`
10. 点击 `Apply` / `Create Blueprint` / `Deploy`。
11. 等待部署日志运行完成。

部署成功后，Render 会给你一个类似这样的公网地址：

```text
https://mahjong-memory-party.onrender.com
```

打开这个地址，就可以进入游戏。

### 方法 B：不用 Blueprint，手动建 Web Service

如果 Blueprint 页面不好找，可以这样手动创建：

1. 打开 Render Dashboard。
2. 点击 `New`。
3. 选择 `Web Service`。
4. 选择 `Build and deploy from a Git repository`。
5. 连接 GitHub 仓库：
   `wuniii/mahjong-memory-party`
6. 填写设置：

```text
Name: mahjong-memory-party
Runtime: Node
Branch: main
Root Directory: 留空
Build Command: npm ci
Start Command: npm start
Health Check Path: /healthz
```

7. 选择合适的实例规格。试玩阶段可选免费或最低规格。
8. 点击 `Create Web Service`。
9. 等待部署完成。

### 怎么判断部署成功

进入 Render 的服务页面后，看 Deploy 日志。

如果看到类似这一行，说明服务已经跑起来：

```text
Mahjong Memory Party is running at http://localhost:xxxx
```

然后看页面顶部或服务详情里的公网地址，打开它。

再测试：

1. 打开公网地址。
2. 点击 `一键单人测试`。
3. 如果进入棋盘页面，说明网页和实时服务都正常。
4. 再把这个公网地址发给朋友。
5. 朋友加入同一个房间号，就能联机玩。

### 如果部署失败，优先检查这几处

#### 1. 仓库文件是不是放在根目录

GitHub 仓库首页应该直接看到：

```text
package.json
server.js
render.yaml
public/
```

如果这些文件被放进了额外的一层文件夹，例如：

```text
mahjong-memory-party/package.json
```

那 Render 的 Root Directory 就需要填那层文件夹名，或者把文件挪到仓库根目录。

#### 2. Build Command 是否正确

应该是：

```bash
npm ci
```

#### 3. Start Command 是否正确

应该是：

```bash
npm start
```

#### 4. Health Check Path 是否正确

应该是：

```text
/healthz
```

你也可以在部署成功后打开：

```text
https://你的Render网址/healthz
```

如果看到类似下面内容，说明服务健康：

```json
{"ok":true,"rooms":0,"uptime":123}
```

#### 5. 如果页面打开了但不能联机

通常是服务还在重启或休眠唤醒中，等 30-60 秒后刷新页面。

### 重要提醒

当前版本为了最快完成，房间数据保存在服务器内存里：

- Render 服务重启后，房间会清空。
- 免费服务如果休眠，唤醒后也可能重新开始。
- 这不影响朋友试玩，但不适合长期保存战绩。

如果后续要长期运营，可以再加数据库和持久化房间/战绩。

## 推荐方式二：Railway

1. 按 `GITHUB_UPLOAD.md` 把本项目上传到 GitHub。
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
