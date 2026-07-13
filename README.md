# Steam 价格转换 MV2

在 Steam 页面自动将外币价格转换为人民币（CNY）显示。专门兼容 Steam 内置 CEF 浏览器，无需 Tampermonkey 或其他依赖。

## 安装

### Steam 内置浏览器（CEF）

1. 打开 `steam://open/minigameslist` 或 `steam://open/console`
2. 在 Steam 启动项添加 `-cef-enable-debugging`（可选，用于调试）
3. 在 Steam 浏览器中打开 `chrome://extensions`
4. 开启「开发者模式」
5. **加载已解压的扩展** → 选择 `steam-price-mv2` 文件夹
6. 刷新 Steam 商店页面即可

> **注意**：Steam 内置浏览器不支持直接拖拽安装 `.crx` 文件，必须使用「加载已解压的扩展」。

### Chrome / Edge 浏览器

同样方式：`chrome://extensions` → 开发者模式 → 加载已解压的扩展。

## 功能

- **自动识别外币** — 支持 28 种货币符号（$、₴、€、£、₽ 等），自动匹配对应汇率
- **实时汇率** — 从 open.er-api.com 获取最新汇率，支持 160+ 种货币交叉换算
- **自动触发** — 页面加载、DOM 变化、滚动时自动翻译，无需手动操作
- **React 兼容** — 正确处理 Steam 的 React 渲染/重渲染，不丢失徽章
- **原价识别** — 自动跳过带删除线的原价，只翻译实际售价
- **同行显示** — 换算价格以绿色文字跟在原价后面

## 支持的货币

| 符号 | 代码 | 货币 |
|------|------|------|
| HK$ | HKD | 港币 |
| NT$ | TWD | 新台币 |
| A$ | AUD | 澳元 |
| S$ | SGD | 新加坡元 |
| R$ | BRL | 巴西雷亚尔 |
| MX$ | MXN | 墨西哥比索 |
| C$ | CAD | 加元 |
| zł | PLN | 波兰兹罗提 |
| ₴ | UAH | 乌克兰格里夫纳 |
| € | EUR | 欧元 |
| £ | GBP | 英镑 |
| ₽ | RUB | 俄罗斯卢布 |
| ₩ | KRW | 韩元 |
| ₺ | TRY | 土耳其里拉 |
| ₹ | INR | 印度卢比 |
| ₱ | PHP | 菲律宾比索 |
| ฿ | THB | 泰铢 |
| ₫ | VND | 越南盾 |
| ₪ | ILS | 以色列新谢克尔 |
| Kč | CZK | 捷克克朗 |
| Ft | HUF | 匈牙利福林 |
| lei | RON | 罗马尼亚列伊 |
| лв | BGN | 保加利亚列弗 |
| CHF | CHF | 瑞士法郎 |
| Rp | IDR | 印尼盾 |
| RM | MYR | 马来西亚令吉 |
| kr | SEK | 瑞典克朗 |
| $ | USD | 美元 |

## 技术说明

- **Manifest V2** — 兼容 Steam CEF 浏览器（不支持 MV3）
- **纯内容脚本** — 无后台页面，零资源占用
- **跨域请求** — 通过 `permissions` 白名单获取汇率 API
- **全量扫描策略** — 不依赖 CSS 选择器，直接扫描 DOM 文本节点识别价格
- **定期刷新** — 前 1 分钟每 8 秒转换一次，之后每 30 秒一次
- **滚动监听** — 滚动时 300ms 后自动转换新加载内容

## 文件结构

```
steam-price-mv2/
├── manifest.json       # Chrome 扩展清单
├── steam.js            # 内容脚本（核心逻辑）
├── icons/              # 扩展图标
│   ├── 48.png
│   └── 128.png
├── .gitignore
└── README.md
```

## 汇率 API

使用 [open.er-api.com](https://open.er-api.com) 提供的免费汇率接口，以 USD 为基准计算交叉汇率。

## License

MIT
