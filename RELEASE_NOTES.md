修复外网窗口受本机 hosts、Clash TUN 和内网 DNS 规则影响的问题。

- 外网代理现在绑定物理网卡出口，自己向配置的公网 DNS 查询并直连目标 IP，不再读取系统 hosts，也不再经过 Clash/VPN 的 DNS 与分流规则。
- 内网代理保持原样，仍然只使用内网 DNS，不会走物理网卡绑定或上游代理。
- 修复开启 Clash TUN 后，部分域名被解析到内网或错误 IP，导致 `ERR_CONNECTION_CLOSED` 的问题。
- 外网请求默认直连，不再自动交给本机 HTTP 代理；避免 Clash 的 `nameserver-policy`、`fake-ip-filter` 和 `use-system-hosts` 影响外网环境。
- 使用说明和应用内常见问题补充“外网忽略本机 hosts / Clash”的说明。
