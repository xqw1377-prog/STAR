# 内部夹具阻击 · 单机部署清单

验收形态：**一台 Node 22 进程 + `PGLITE_DATA_DIR` 持久卷**。  
不是 Serverless、不是多副本、不是真源、不是真钱广播。

## 必须满足

- [ ] Node 版本与 `.nvmrc` 一致（22）
- [ ] `PGLITE_DATA_DIR` 指向可写持久目录（容器须挂卷）
- [ ] 生产未设 `STAR_ALLOW_WRITE=1`，或同时设了 `STAR_WRITE_TOKEN`
- [ ] 进程启动时目录可写（`db/client.ts` 会 `mkdir` + `access W_OK`，失败即拒启动）
- [ ] `GET /api/health` 返回 `ok: true` 且 `schema` 为 `star-raw@4`
- [ ] `GET /api/capability` 显示 `id: star-capability@6`、`model: EVENT-NARRATIVE-ASSET-MARKET-MONEY`、`money: NO-EVIDENCE`
- [ ] 页面横幅仍是夹具自动阻击 / DRY_RUN / 无广播
- [ ] `GET /api/snipe` 返回 `mode: DRY_RUN` 且会自动推进 tick

## 明确不做

- 多实例共享一份 `.pglite`（会坏）
- 无卷的容器（重启丢库）
- 启用 `solana-rpc`（许可证矩阵未放行）
- 钱包、广播、Micro-Live

## 运行

```bash
export PGLITE_DATA_DIR=/var/lib/star/pglite
npm ci
npm run build
npm start
```

Docker：仓库根 `Dockerfile`，数据卷挂到 `/data/pglite`。
