// ==UserScript==
// @name         Steam 价格转换 (自包含 MV2)
// @description  在 Steam 页面自动将外币价格转换为人民币
// ==/UserScript==

(function() {
    'use strict';

    const CNY = '¥';
    let rates = {};
    let retryCount = 0;
    const MAX_RETRIES = 10;

    // ============================================================
    // 货币符号映射（按长度降序）
    // ============================================================
    const CURRENCY_MAP = [
        ['HK$','HKD'],['NT$','TWD'],['A$','AUD'],['S$','SGD'],
        ['R$','BRL'],['MX$','MXN'],['C$','CAD'],['zł','PLN'],
        ['₴','UAH'],['€','EUR'],['£','GBP'],['₽','RUB'],
        ['₩','KRW'],['₺','TRY'],['₹','INR'],['₱','PHP'],
        ['฿','THB'],['₫','VND'],['₪','ILS'],['Kč','CZK'],
        ['Ft','HUF'],['lei','RON'],['лв','BGN'],['CHF','CHF'],
        ['Rp','IDR'],['RM','MYR'],['kr','SEK'],['$','USD'],
    ];

    // 快速查找：符号 → 代码
    const symToCode = new Map(CURRENCY_MAP);
    // 快速查找：代码 → 符号
    const codeToSym = new Map(CURRENCY_MAP.map(([s, c]) => [c, s]));

    // ============================================================
    // 货币检测：返回 { code, sym } 或 null
    // ============================================================
    function detectCurrency(text) {
        for (const [sym, code] of CURRENCY_MAP) {
            if (text.includes(sym)) return { code, sym };
        }
        return null;
    }

    // ============================================================
    // 价格提取（只取货币符号附近的数字）
    // ============================================================
    function extractPrice(text, currencySym) {
        if (!text || !currencySym) return NaN;
        const idx = text.indexOf(currencySym);
        if (idx === -1) return NaN;
        // 取符号前后 10 个字符范围内的数字
        const start = Math.max(0, idx - 10);
        const end = Math.min(text.length, idx + currencySym.length + 10);
        const chunk = text.substring(start, end);
        const m = chunk.match(/(\d[\d\s,.]*(?:[.,]\d+)?)/);
        if (!m) return NaN;
        let s = m[1].trim().replace(/\s/g, '');
        if (!s) return NaN;
        const dot = s.lastIndexOf('.');
        const comma = s.lastIndexOf(',');
        if (comma > dot) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
        const val = parseFloat(s);
        if (isNaN(val) || val <= 0 || val > 100000) return NaN;
        return val;
    }

    // ============================================================
    // 获取汇率
    // ============================================================
    async function fetchRates() {
        try {
            const controller = new AbortController();
            const tOut = setTimeout(() => controller.abort(), 10000);
            const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
            clearTimeout(tOut);
            const data = await res.json();
            if (!data?.rates?.CNY) return false;
            const usdCny = data.rates.CNY;
            for (const [code, val] of Object.entries(data.rates)) {
                if (val > 0 && code !== 'CNY') rates[code] = usdCny / val;
            }
            rates['CNY'] = 1;
            return true;
        } catch(e) {
            return false;
        }
    }

    function toCny(val, code) {
        const r = rates[code];
        return r ? (val * r).toFixed(2) : null;
    }

    // 检测是否包含划掉的原价
    function hasStrikethrough(el) {
        if (el.tagName === 'S' || el.tagName === 'STRIKE') return true;
        if (el.querySelector('s, strike')) return true;
        try {
            const s = getComputedStyle(el);
            // 检查 text-decoration 简写和 text-decoration-line 属性
            return !!(s.textDecoration?.includes('line-through') ||
                s.textDecorationLine?.includes('line-through'));
        } catch(e) {
            return false;
        }
    }

    // 获取元素的直接文本（不含子元素的文本）
    function getDirectText(el) {
        let t = '';
        for (const node of el.childNodes) {
            if (node.nodeType === 3) t += node.textContent;
        }
        return t.trim();
    }

    // ============================================================
    // 核心转换
    // ============================================================
    async function convert() {
        if (Object.keys(rates).length < 5) return;
        const items = [];
        const seenPrices = new Set(); // 每次调用独立去重，React 重渲染后允许重新添加

        try {
            // ---- 策略 A: data-price-value ----
            document.querySelectorAll('[data-price-value]').forEach(el => {
                if (el.classList.contains('scp-done')) return;
                const raw = el.getAttribute('data-price-value');
                const cur = el.getAttribute('data-price-currency');
                if (!raw || !cur || cur === 'CNY') return;
                const val = parseFloat(raw) / 100;
                if (!isNaN(val) && val > 0) {
                    el.classList.add('scp-done');
                    const key = cur + '-' + val;
                    if (seenPrices.has(key)) return;
                    seenPrices.add(key);
                    items.push({ el, price: val, currency: cur });
                }
            });

            // ---- 策略 B: 全量扫描 ----
            let foundCount = 0;
            const allNodes = document.body.querySelectorAll('*');
            for (const el of allNodes) {
                if (el.classList.contains('scp-done')) continue;
                const tag = el.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') continue;

                const directText = getDirectText(el);
                if (!directText || directText.length > 60 || directText.includes(CNY)) continue;

                const detected = detectCurrency(directText);
                if (!detected) continue;

                const price = extractPrice(directText, detected.sym);
                if (isNaN(price) || price <= 0) continue;

                if (hasStrikethrough(el)) continue;
                // 类名包含 original 的也是原价
                if (el.matches && el.matches('[class*="original"]')) continue;
                if (el.querySelector('.scp-badge')) continue;

                const key = detected.code + '-' + price;
                if (seenPrices.has(key)) continue;
                seenPrices.add(key);
                el.classList.add('scp-done');
                items.push({ el, price, currency: detected.code });
                foundCount++;
            }

            if (items.length > 0) {
                console.log('[SteamPrice] 本次找到', items.length, '个价格');
            }
        } catch(e) {
            console.error('[SteamPrice] 扫描出错:', e.message);
        }

        // ---- 显示转换结果 ----
        for (const item of items) {
            try {
                const cny = toCny(item.price, item.currency);
                if (!cny || parseFloat(cny) <= 0) continue;

                const badge = document.createElement('span');
                badge.className = 'scp-badge';
                badge.textContent = `≈ ${CNY}${cny}`;
                badge.title = `1 ${item.currency} = ${CNY}${parseFloat(rates[item.currency]).toFixed(4)}`;
                badge.setAttribute('translate', 'no');
                // 徽章直接追加到元素内，inline 显示，和原价同行
                badge.style.cssText = 'color:#4ade80;font-weight:600;white-space:nowrap;text-decoration:none;';
                item.el.appendChild(badge);
                console.log('[SteamPrice]', item.currency, item.price, '→', '¥' + cny, item.el.className);
            } catch(e) {
                console.error('[SteamPrice] 显示出错:', e.message);
            }
        }
    }

    // ============================================================
    // 等待汇率就绪
    // ============================================================
    async function waitForRates() {
        while (retryCount < MAX_RETRIES) {
            const ok = await fetchRates();
            if (ok) {
                console.log('[SteamPrice] 汇率就绪，', Object.keys(rates).length, '种货币');
                return true;
            }
            retryCount++;
            await new Promise(r => setTimeout(r, 5000));
        }
        return false;
    }

    // ============================================================
    // 启动
    // ============================================================
    async function init() {
        const ready = await waitForRates();
        if (!ready) return;

        // 首次转换
        setTimeout(convert, 500);

        // 监听 DOM 变化
        let moTimer;
        new MutationObserver(() => {
            clearTimeout(moTimer);
            moTimer = setTimeout(convert, 800);
        }).observe(document.body, { childList: true, subtree: true });

        // 滚动触发（Steam 滚动加载更多内容）
        let scrollTimer;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(convert, 300);
        }, { passive: true });

        // 页面切换（历史记录）
        window.addEventListener('popstate', () => setTimeout(convert, 1500));

        // 定期刷新兜底：前 1 分钟每 8 秒，之后每 30 秒
        convert();
        let count = 0;
        const interval = setInterval(() => {
            convert();
            count++;
            if (count >= 8) { // 约 1 分钟后降频
                clearInterval(interval);
                setInterval(convert, 30000);
            }
        }, 8000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
