## 自我介绍（200-300字）

Pylon PENG，SAP Labs China 高级软件工程师，BDC&I Data Warehouse 团队，7 年企业级后端开发经验，专注数据平台与开发者工具。

工作之余深度投入 AI Agent 基础设施方向，是开源项目 SigCLI (sigcli.ai) 的作者——一个让 AI Agent 安全访问企业系统的认证 CLI 工具。项目通过浏览器 SSO 捕获凭证、AES-256-GCM 加密存储、本地 MITM 零信任代理等技术，解决了 AI Agent 接入 Jira、Slack、Outlook、Confluence 等系统时的身份认证难题。目前已开源 13 个平台 Skill，在公司内部及开源社区获得实际使用。

日常重度使用 Claude Code 进行开发，围绕 Agent 与企业系统集成积累了大量工程实践。同时组织 AI Agent 技术阅读小组，持续跟踪 Agent 架构、MCP 协议、多 Agent 协作等前沿方向。

GitHub: github.com/sigcli/sigcli

## 是否有演讲经历

无外部公开会议演讲经历。有内部技术分享经验（SAP 内部 tech talk、团队技术交流）。

## 演讲主题及大纲

1）演讲主题：AI Agent 的身份认证难题：从零信任代理到 Skill 生态的工程实践

2）主题摘要：当 AI Agent 需要访问企业系统（Jira、Slack、Outlook、Confluence 等）时，身份认证成为首要障碍。本次演讲分享基于开源项目 SigCLI 的工程实践，介绍如何通过浏览器 SSO 捕获、AES-256-GCM 加密存储、零信任 MITM 代理等技术手段，让 AI Agent 安全地代表用户操作企业系统，同时保证凭证永远不暴露给 AI 上下文窗口。

3）内容大纲：

1. AI Agent 接入企业系统的认证困境
   1.1 现状：粘贴 token 到 .env、shell 历史、AI 上下文的安全隐患
   1.2 企业 SSO 的复杂性：OAuth2、SAML、MFA、session 管理
   1.3 MCP 协议的认证空白：标准只定义了协议，没解决凭证

2. 解决方案：SigCLI 的三层安全模型
   2.1 浏览器 SSO 捕获：无头→可视自动切换，支持任意登录流程
   2.2 加密存储：AES-256-GCM at rest，凭证不出现在代码/历史中
   2.3 零信任代理：本地 MITM 代理在网络层注入凭证，AI 进程内存中无凭证

3. Skill 生态设计：让 AI Agent 操控系统
   3.1 Skill = Python 脚本 + SKILL.md 文档，AI 读文档调脚本
   3.2 实战案例：Outlook 邮件摘要、Jira 工单管理、Slack 消息处理
   3.3 一行命令安装：`npx @sigcli/skills`

4. 工程踩坑与经验
   4.1 反爬对抗：知乎 x-zse-96、Reddit bot detection
   4.2 Cookie TTL 管理与自动续期
   4.3 多平台认证差异（cookie vs OAuth2 vs API token）

5. 未来方向
   5.1 Agent 身份标准化：从 per-user 到 per-agent 的身份演进
   5.2 与 MCP 协议的融合可能
   5.3 企业级 Agent 治理需求

4）听众收益：
- 了解 AI Agent 接入企业系统的认证挑战及解决思路
- 学习零信任代理模式在 Agent 场景的具体实现
- 获得开源可用的 Skill 设计模式和工具链
- 理解 Agent 身份管理的未来趋势

## 一句金句（100字以内）

AI Agent 的能力天花板不是模型智能，而是能访问多少系统——解决身份认证，就是解锁 Agent 的全部潜力。
