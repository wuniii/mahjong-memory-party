# 上传到 GitHub

当前项目已经是本地 Git 仓库，分支名是 `main`，已经有本地版本记录。

## 第一步：在 GitHub 新建空仓库

1. 打开 GitHub。
2. 点击右上角 `+`，选择 `New repository`。
3. Repository name 建议填写：`mahjong-memory-party`。
4. Public / Private 都可以。
5. 不要勾选 `Add a README file`。
6. 不要添加 `.gitignore`。
7. 不要选择 License。
8. 点击 `Create repository`。

创建完成后，GitHub 会给你一个仓库地址，例如：

```text
https://github.com/你的用户名/mahjong-memory-party.git
```

## 第二步：把本地项目推送上去

在当前项目目录运行下面两行，把地址替换成你自己的 GitHub 仓库地址：

```bash
git remote add origin https://github.com/你的用户名/mahjong-memory-party.git
git push -u origin main
```

如果电脑弹出 GitHub 登录窗口，登录并确认即可。

## 第三步：部署到 Render

1. 打开 Render。
2. 选择 New > Blueprint。
3. 连接你的 GitHub 仓库。
4. 选择刚上传的 `mahjong-memory-party` 仓库。
5. Render 会自动读取项目里的 `render.yaml`。
6. 点击部署。
7. 部署完成后，Render 会给你一个公网网址。

## 第四步：试玩公网地址

部署完成后，把 Render 给你的网址发给朋友。

你自己也可以打开这个网址，点击“一键单人测试”先确认游戏正常。
