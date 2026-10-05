# ThreadingHTTPServer 版：python3 -m http.server 是单线程的，页面并发要 ~30 个字体文件，
# 浏览器开 6 条连接 → 服务端串行处理 → 30s 内 load 事件不触发 → E2E 偶发 goto 超时。
# 这里只改测试工具的并发能力，不放宽任何断言。
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
port = int(sys.argv[1])
# 目录参数可省：省略时用进程 cwd（E2E 就是靠 spawn 的 cwd 指定仓库根的）
class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
