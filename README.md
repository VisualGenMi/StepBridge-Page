# StepBridge — 论文主页 / Project Page

一个可直接部署的静态论文主页，基于
**“Unifying Trajectory and Distribution Supervision for Efficient Two-Step Diffusion Generation”**
的正文、图表、VBench 数据与附录对比视频构建。

作者：Zhijun Song¹* · Yinbo Liu²* · Peng Zhang¹† · Yang Zhou¹ · Fei Wang¹ · Daiguo Zhou¹ · Jian Luan¹
（¹ MiLM Plus, Xiaomi Inc.，² School of Computer Science, Wuhan University；* 共同一作，† 项目负责人）

页面默认 **深色主题**，右上角可切换到亮色。

## 页面结构

| # | 区块 | 内容 |
| --- | --- | --- |
| — | Hero | 徽标 + 字标 + Project page 胶囊、论文标题、一句话摘要、作者与单位、等宽 tagline、按钮组、**3×2 对比视频墙**（6 对同时播放） |
| 02 | Method | **3.1 Steps and supervision**：两张 3D 图无缝上下叠放（走廊动画 + 三轨架构），共用一个图注；下方是角色卡、速度指标、方法卡、公式与论文原图 |
| 03 | Abstract | 两端对齐的摘要 + 右侧「摘要流程图」阅读指南 + TL;DR + 三条贡献 |
| 04 | Results | 五张变化卡（SMD / DMD / DMD2 / ADV / rCM）、gap-recovery 条形图、三张可切换的 VBench 表（主表 / ADV·rCM / 14B） |
| 05 | Qualitative | Figure 3–4，可点开放大（Figure 5/6 已按要求移除） |
| 06 | Analysis | 消融表、阶梯图、梯度几何、多样性表、效率对比 |
| 07 | Citation | BibTeX + 一键复制 |

## 1. 本地预览

```powershell
.\serve.cmd            # 双击也行：自动挑可用的 Python 并打开浏览器
# 或
python -m http.server 8899 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8899/>。当前会话已有一个预览服务在跑。

## 2. 部署到 GitHub（含合作者）

本地仓库已经初始化好了：`StepBridge-Page/` 下是 git 仓库，分支 `main`，已有首个 commit，
并配置了 Git Credential Manager（首次 push 会弹浏览器登录 GitHub）。

### 2.1 先在网页上建仓库

<https://github.com/new> → 填 `Repository name`（例如 `stepbridge`）→ **Public** →
**不要**勾选 “Add a README / .gitignore / license”（否则会和本地冲突）→ Create。

### 2.2 关联并推送

```powershell
cd C:\Users\yinboliu\Documents\StepBridge\StepBridge-Page
git remote add origin https://github.com/<你的用户名>/stepbridge.git
git push -u origin main
```

第一次 push 会弹出 GitHub 登录窗口（浏览器授权），授权后自动保存凭据。
仓库约 118 MB（视频 52 MB + 论文 PDF 56 MB），首次推送需要几分钟。

### 2.3 开启 GitHub Pages

仓库 **Settings → Pages**：

| 项 | 选择 |
| --- | --- |
| Source | `Deploy from a branch` |
| Branch | `main` |
| Folder | `/ (root)` |

保存后约 1–2 分钟生效，地址形如 **https://<你的用户名>.github.io/stepbridge/**

`.nojekyll` 已在根目录，防止 Jekyll 忽略 `assets/` 下的路径。

### 2.4 加合作者（共同维护）

仓库 **Settings → Collaborators → Add people**，输入对方的 GitHub 用户名或邮箱，
选择权限：

- **Write**：可以 commit / push，适合共同改页面；
- **Maintain / Admin**：可以改设置、加人，适合导师或主要负责人。

对方接受邮件邀请后即可：

```bash
git clone https://github.com/<你的用户名>/stepbridge.git
# 改完
git add -A && git commit -m "update results table" && git push
```

拉取别人改动：`git pull --rebase`。

### 2.5 之后每次更新

```powershell
cd StepBridge-Page
git add -A
git commit -m "update: 说明这次改了什么"
git push
```

Pages 会在 push 后自动重新发布，1 分钟内生效。

### 备选方案

- **不装 Git**：把 `../StepBridge-Page-github.zip` 解压后，在仓库页
  **Add file → Upload files** 拖进去；
- **拖拽即上线**：<https://app.netlify.com/drop> 直接拖 `StepBridge-Page` 文件夹，
  几秒得到 `https://xxx.netlify.app`（不需要 GitHub）；
- **自定义域名**：Pages 设置里填 Custom domain，并在仓库根目录放 `CNAME` 文件。

## 3. 需要替换的内容

| 内容 | 位置 |
| --- | --- |
| 作者与单位 | `<div class="authors">`、`.affil`、`.authors__note`（* / † 说明） |
| 论文 PDF | `assets/pdf/StepBridge-paper.pdf` |
| arXiv / Code 链接 | hero 的 `.cta-row`（把 `Code` 的 `<span>` 换成 `<a>`） |
| BibTeX | `id="bibtex"` 的 `<pre>` |
| 社交预览图 | `assets/og.png`（1200×630）+ `<meta property="og:image">`，部署后建议写完整 URL |
| 视频播放列表 | `tools/build_videos.py` 的 `ORDER` / `TITLES` → 写入 `#videoData` |
| VBench 表格 | `tools/build_table.py` 的 `ROWS` / `RANKS` |
| 3D 动画数值 | `assets/js/steps3d.js` 的 `STAGES`、`assets/js/arch3d.js` 的 `RAILS` |

## 4. 素材与工具

```
StepBridge-Page/
├── index.html
├── serve.cmd
├── .nojekyll
├── assets/
│   ├── css/style.css        # 基础版式、Hero、3D 容器、作者、角色卡
│   ├── css/cinema.css       # 视频影院
│   ├── css/results.css      # gap-recovery 图 + 表格切换
│   ├── css/flow.css         # 摘要右侧流程图 + 正文编号联动
│   ├── css/hero.css         # 首屏徽标 / 字标 / tagline
│   ├── js/main.js           # 主题 / 目录 / 表格 / 灯箱 / BibTeX
│   ├── js/steps3d.js        # 3D 步数压缩（Canvas 2D）
│   ├── js/arch3d.js         # 3D 三轨架构（Canvas 2D）
│   ├── js/cinema.js         # 自动轮播影院
│   ├── figures/             # fig1–fig6, fig_ex（WebP）
│   ├── posters/             # 15 帧封面（完整帧，含烧录标题行）
│   ├── videos/              # 15 段对比视频（原始 1664×536，未裁切）
│   ├── pdf/                 # 论文 PDF
│   └── og.png
└── tools/
    ├── build_videos.py      # 生成 #videoData 播放列表
    ├── build_table.py       # 生成主结果表
    ├── restore_videos.py    # 还原完整帧视频 + 重出封面
    ├── render_figures.py    # 论文图 PDF → PNG
    ├── make_og.py           # 社交预览图
    ├── qa.mjs               # 页面自检（CDP，25 项）
    ├── test-steps.mjs       # 3D 自检（CDP，10 项）
    └── test-perf.mjs        # 帧率 + reduced-motion 自检
```

### 重新渲染素材

```powershell
pip install pymupdf pillow imageio-ffmpeg
python tools/render_figures.py    # 图 → assets/figures/*.png
python tools/restore_videos.py    # 还原完整帧视频 + 重出封面（源在 ../videos_original）
python tools/build_videos.py      # 刷新播放列表 JSON
python tools/make_og.py           # 社交预览
```

## 5. 首屏视频墙（3×2，一次 6 对）

视频被放到了 **Hero 里、标题正下方**，取代原来的 Figure 1 静态大图——毕竟是做视频的工作，
第一屏就该动起来。

- **6 对同屏**（3 列 × 2 行），15 段分 3 组，每 7.8 s 自动换组，也可点圆点 / 左右箭头；最后一组不足 6 个时**从头回绕补齐**，墙上永远排满；
- 每格是一段**左右拼接**的对比片，画面四周留 4px 米白卡边、`object-fit: contain` 不裁切；
- 列标签 `ORIGINAL` / `+ STEPBRIDGE` 是**页面自己画的 HTML 文字**，不是视频里的：

  | | 视频源 | 6 宫格实际尺寸 | 烧录字高 |
  |---|---|---|---|
  | 原始 | 1664×536，白条 56 行 | 约 423px 宽 | 9px → 缩放后 **2.3px** |
  | 现在 | 1664×480（只切掉白条） | 同上 | 由 HTML 绘制，始终 9–10px |

  2.3px 的文字经抗锯齿后变成断断续续的碎点，于是表现为“有的片段有字、有的没有、有的被切掉一半”——
  其实是同一段文字在缩略尺寸下糊掉了。**`tools/trim_caption.py`** 把 15 段视频统一裁掉顶部 56 行白条
  并重出封面，标签改由 CSS 渲染。原始 1664×536 素材仍在 `../videos_original/`，随时可以还原；
- **改了素材一定要改版本号**：视频是原地重编码、文件名没变，浏览器会继续用旧缓存——
  这正是“统一裁切之后仍有几个格子露出标题条”的原因（缓存里同时存在 536 版、516 版和 480 版）。
  现在 `cinema.js` 里 `V = "2"` 会给视频/封面加 `?v=2`，`index.html` 里 CSS/JS 也带 `?v=2`；
  **下次替换素材把两处 V 一起 +1** 即可。
  视频顶部本来就烧录了这两列的标题，正好当列标签，所以**不做任何裁切**；
- 卡片下方只保留 `标题 + 机型 + 方法`，放大按钮在悬停时出现，点击进入灯箱全屏；
- 文案压到一行，写在视频下方的状态条里：
  `Same prompt, same seed · left: base two-step · right: + StepBridge · click any pair to enlarge`，
  右侧是整组进度条；
- 首屏之外不再有独立的视频章节，导航里的 `Videos` 通过一个零高度锚点跳到这面墙；
- 手机（≤700px）自动单列，平板（≤1100px）两列；
- 只在可见时播放，切后台暂停，`prefers-reduced-motion` 下不自动换组、只显示首帧。

素材：`tools/restore_videos.py` 可把 `assets/videos/` 还原成完整 1664×536 原始帧（含烧录标题条）；`tools/trim_caption.py` 则是当前线上状态（1664×480，无标题条）。两者按需切换，改完刷新即可。

## 6. 两份 3D 图

### 6.1 步数压缩（`assets/js/steps3d.js`）

一条穿过潜空间的走廊，每道环形门 = 一次网络评估：50 步门环密集、4 步只剩 4 道、
2 步只剩 2 道并升起虚线拱桥表示端点锚定。下方 `50 ⟶ 4 ⟹ 2` 箭头流程条既是图例
也是档位选择器（点选后钉住 14 s，键盘 ← → 也行）。

### 6.2 三轨架构（`assets/js/arch3d.js`）

**先想清楚四件事，再画：**

| | 内容 | 画法 |
| --- | --- | --- |
| 输入 | prompt `c` + **独立采样**的两个噪声 `z_S, z_A` | 左端两簇抖动粒子；参考→学生的弧形箭头标 `4-step ckpt`（同一权重初始化） |
| 对齐①（轨迹，**双向**） | 学生给出**关键节点**，老师返回**该处速度** | 紫虚线向上（学生→老师，带箭头）；蓝实线向下（老师→学生，带箭头），两条弯曲方向相反，形成可见回路 |
| 对齐②（分布） | `p_θ → p_A`，**无样本级对应** | 端点张开成样本云，用**打乱顺序**的细线相连，锚定后紫云贴到暖云 |
| 输出 | `x̂ = G_θ(z_S, c)`，2 NFE | 学生轨末端单点 + `x̂ / 2 NFE`；三条轨里只有学生轨是实线彩带 |

**“区间速度”怎么体现**（这是 6.2 的核心）：

1. 每个粗粒度步内画**两个窗口**（全图 4 个），窗口从一点展开成一段区间 `w`；
2. 每个窗口上方画一条**割线 + 箭头**，即区间平均速度
   `v̄_S = (x̂(α+w) − x̂(α)) / (wΔσ)`，交替高度避免重叠，每组第一个标 `mean over w`；
3. 学生交给老师的是**窗口中点**（不是起点、不是终点），紫箭头落在教师轨上；
4. 老师返回的 `v_T` 用蓝实线画回学生轨，箭头落在中点上；
5. 教师轨刻度**只在窗口覆盖范围内**点亮变粗，窗口外保持灰暗。

这样“点监督 → 区间监督”的区别不再靠文字解释：肉眼就能看到目标是一条覆盖 `w` 的割线，
而不是一个点上的切线。

**统一的时钟**：三条轨（含 4 步参考）共用同一个 `u`（σ=1→0 的进度）。
学生走**两大步**，参考几乎匀速——同一段时间、同一段路，只有步数不同。

**节拍**：噪声输入 + `4-step ckpt` 闪烁 → 第一步推进，窗口展开、双向束触发 →
第二步重复 → 两轨同刻抵达 σ=0 → 样本云张开、锚定、收敛 → 循环。

**3D 网格地面**：三条轨下方铺一层透视网格（沿轨方向的平行线 + 向灭点收敛的横线），
透明度随景深衰减，中间叠一圈柔光；这样三轨有“站在地上”的空间感，而不是浮在黑底上。

**图注**：一段话讲完（Top 讲步数/门，Bottom 讲区间窗口与双向监督），
桌面端两端对齐、末行左对齐；手机上改回左对齐（窄栏两端对齐会拉开字距）。

**取舍**：老师轨刻度是灰的，只有被窗口覆盖的才亮，避免被读成“老师也在跑自己的轨迹”；
上行用学生色（紫）、下行用教师色（蓝），颜色本身就说明“谁发的”。

## 6.5 首屏徽标：Two-Step Bridge（`assets/css/hero.css`）

### 设计（先用文字定规则，再画）

一句话：**一次上升 + 一段平走 = 两步；一条虚线弦 = 端点锚定。**

| 视觉元素 | 含义 |
| --- | --- |
| 左端的几个散点 | 高斯噪声（σ = 1），尚未成形 |
| 一段陡的蓝色斜线 | 第 1 步：跨越大半条轨迹 |
| 中间的小圆环节点 | 唯一被保留的中间状态（2 步只有 1 个） |
| 一段平走的暖色横线 | 第 2 步：从中间状态落到终点 |
| 起点到终点的细虚线弦 | 端点锚定：冻结 4 步参考给出的落点约束 |
| 右端的发光圆点 | 干净 latent（σ = 0） |
| 绕圈旋转的外环文字 | `TWO-STEP · TRAJECTORY + DISTRIBUTION` |
| 蓝 → 紫 → 暖橙的渐变 | 与全文、3D 图、表格高亮同一套配色 |

定下的几条硬规则：

1. **只允许两段折线**——绝不画三步/四步的 W 形，否则"two-step"这个卖点就废了；
2. 折角要够大（约 60°），保证缩到 24px 仍能看出"上升 + 平走"；
3. 弦必须是**虚线且更细**，否则会被读成"第二条轨迹"而不是约束；
4. 端点用发光圆点，在小尺寸失去细节时仍能读出"着陆点"；
5. 环文字只放方法关键词，不放全名，避免小字糊成一圈。

### 用在哪

- 首屏：100px 徽标 + `StepBridge` 字标（渐变高光扫过）+ Project page 胶囊，三者一行；
- 导航栏：同一图形的 40×40 简化版（去环、去虚线，只留折线 + 端点）；
- favicon 与 `assets/og.png`：同款图形，保证分享卡片与页面同一身份。

### 实现

纯内联 SVG（120×120 网格），没有任何图片依赖：

- 环文字用 `<textPath>` 沿圆路径排布，整组 `rotate` 动画 44s 一圈；
- 折线用 `stroke-dasharray` 做 2.6s 的"描画"入场；
- 端点光晕是径向渐变 + `scale` 呼吸动画；
- 噪声点错相位闪烁；
- `prefers-reduced-motion` 下所有动画关闭，直接呈现静态造型。

## 7. 摘要素描图（`assets/css/flow.css`）

摘要右侧原本是空白，现在放了一张竖排流程图，把摘要逐句“翻译”成四步：

| 图上的编号 | 对应摘要中的句子 |
| --- | --- |
| ① The constraint | “...under a severely limited sampling budget” |
| ② Multi-step teacher / Few-step generator | “...may not fully align with the student's compressed sampling process” / “...lacks explicit guidance on the student's generation trajectory” |
| ③ StepBridge | “...combine trajectory-level and distribution-level supervision”，并列出 L_OPD 与 L_DMD |
| ④ Coordination | “...adaptive gradient scaling and asymmetric gradient projection” |

摘要正文里嵌了同样编号的 ①②③④ 小圆点：**悬停（或键盘聚焦）任意一个小圆点，右侧对应卡片会亮起**；
点击则会把图滚到视野中央并闪一下（窄屏下图在摘要上方，方便先看图再读字）。
连线是 SVG 虚线，带流动的 dash 动画；`prefers-reduced-motion` 下静止。

图表用 `position: sticky` 贴在右侧，滚动读摘要时始终可见；
≤980px 自动改为单列并把图移到摘要**之前**；≤700px 摘要取消两端对齐（手机上两端对齐会拉出难看的字距）。

## 8. 设计与实现备注

- 配色取自论文：`#285FA6`（bridge blue）、`#B86B4B`（bridge warm）、过渡紫 `#6A63A8`；
  表格高亮沿用论文红 / 蓝 / 绿语义。
- 字体：标题 Instrument Serif，正文 Inter，代码 JetBrains Mono；离线回退 Georgia / 系统字体。
- 摘要两端对齐并限制在 70ch 以内，避免长行难读。
- 论文 Figure 2 是白底插图，单独包成“纸片”卡片（浅米色底 + 弹窗放大），
  在深色页面里读起来像贴上去的一张纸，而不是突兀的色块。
- “Optimization, in four lines” 公式卡在两种主题下都保持深色，保证对比度。
- 页面总计约 108 MB（视频 50 MB、PDF 56 MB）；首屏只加载字体 + 一张图。
  若在意仓库体积，可删 `assets/pdf/`，Paper 按钮改指 arXiv。

## 9. 内容来源

- 方法与公式：`paper/<论文源码目录>/main.tex`（正文 + 附录）。
- 主表：论文 Table 1；多样性：Table 2；ADV / rCM：附录 Table S1；14B：附录 Table S3。
- 视频：`paper/videos/`，左半原始 2-step、右半加 StepBridge，prompt 与 seed 相同。

图表与视频版权归论文作者所有；页面代码可自由复用。
