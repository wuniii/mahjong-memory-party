# 麻将翻翻乐派对

一个可爱麻将主题的多人在线记忆翻翻乐小游戏。

## 已实现功能

- 1-4 人实时房间联机，单人也可以直接开局测试
- 输入昵称即可游玩，无需注册
- 创建房间、加入房间、准备、开始游戏
- 首页提供“一键单人测试”按钮
- 房主选择棋盘大小：4x4 到 18x18
- 6x6 及以上棋盘会放大显示本回合翻开的牌，并高亮原位置
- 每局优先使用 34 种不重复牌面；超出后用糖果角标区分重复牌
- 经典翻两张找相同玩法
- 每回合翻 2 张，配对成功得分并继续行动
- 配对失败后展示 5 秒，然后自动盖回并切换到下一位玩家
- 胜利条件：全部配对完成后，配对最多者获胜
- 每人每局 3 个道具：透视、提示、冻结
- 快捷表情互动
- 游戏结束后房主可一键再来一局
- 同一浏览器断线后可重连回原座位
- 已准备公网部署配置：Render、Railway、Docker

## 启动方式

```bash
npm install
npm start
```

启动后打开：

```text
http://localhost:3000
```

## 自己一个人测试

方式一：打开首页后点击“一键单人测试”。

方式二：手动测试：

1. 输入昵称。
2. 选择棋盘大小。
3. 点击“创建房间”。
4. 点击“我准备好了”。
5. 点击“开始游戏”。

## 让局域网朋友加入

如果要让同一 Wi-Fi 下的朋友加入，请使用你电脑的局域网 IP，例如：

```text
http://你的电脑IP:3000
```

## 公网部署

项目已经包含公网部署配置：

- `render.yaml`：Render 部署
- `railway.json`：Railway 部署
- `Dockerfile`：Docker 部署
- `GITHUB_UPLOAD.md`：上传到 GitHub 的步骤
- `/healthz`：健康检查地址

详细步骤见：`DEPLOY.md`

## 自测命令

```bash
npm test
npm run test:solo
```

## 玩法说明

- 透视：短暂查看 2 张未翻开的牌。
- 提示：高亮一张有用的线索牌；如果你已经翻开一张牌，会优先提示它的配对牌。
- 冻结：下一位玩家跳过一次行动。

## 麻将牌素材

牌面与牌背使用 [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) 的 SVG 素材，采用 CC0 公共领域许可。完整说明见 `ASSETS.md`。

## 文件结构

```text
server.js              实时联机服务和游戏规则
public/index.html      页面结构
public/styles.css      可爱麻将主题样式
public/app.js          前端交互逻辑
public/assets/tiles    CC0 麻将牌 SVG 素材
scripts/smoke-test.js  多人联机流程自测
scripts/solo-test.js   单人开局流程自测
DEPLOY.md              公网部署说明
ASSETS.md              素材来源与许可说明
```

