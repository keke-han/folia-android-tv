# deepmerge 本地安全修订

来源：TehShrike/deepmerge 4.3.1 的 dist/cjs.js；保留 MIT LICENSE 和类型声明。本分支修订号 4.3.1-tv.1 不是上游官方版本。

针对 GHSA-gcqx-w48m-w2h4 / CVE-2026-93753，在复制目标和合并来源两条路径均拒绝 __proto__、constructor、prototype 键，防止返回对象原型被污染。其它合并行为沿用上游；回归测试位于 test/unit/security/deepmergePatch.test.ts。

仅替换构建链 @rollup/plugin-node-resolve 使用的依赖，没有改写播放器设置合并工具。npm 本地包审计不代替该修订的源码审查与回归测试。未来切回上游官方修复版时，应移除此本地覆盖并重新验证构建。
