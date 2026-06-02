#!/usr/bin/env python3
"""moltbook_api.py — Moltbook API helper with proxy failover and LLM challenge solver."""
import json, os, ssl, sys, time, urllib.request, urllib.error, re, concurrent.futures, subprocess

CREDS_FILE = os.path.expanduser("~/.config/moltbook/credentials.json")
PROXY_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".moltbook_proxies")
BASE_URL = "https://www.moltbook.com/api/v1"

class Moltbook:
    def __init__(self, creds_file=CREDS_FILE):
        with open(creds_file) as f:
            creds = json.load(f)
        self.api_key = creds["api_key"]
        self.agent_name = creds.get("agent_name", "")
        self._proxies = None

    def _discover_proxies(self):
        try:
            resp = urllib.request.urlopen("https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=json&timeout=3000", timeout=10)
            data = json.loads(resp.read())
            proxies = [f"http://{p['ip']}:{p['port']}" for p in data.get("proxies", []) if p.get("protocol") == "http"][:25]
        except Exception:
            return []
        ctx = ssl._create_unverified_context()
        def test(px):
            try:
                ph = urllib.request.ProxyHandler({"https": px, "http": px})
                opener = urllib.request.build_opener(ph, urllib.request.HTTPSHandler(context=ctx))
                req = urllib.request.Request(f"{BASE_URL}/agents/me", headers={"Authorization": f"Bearer {self.api_key}"})
                opener.open(req, timeout=6)
                return px
            except Exception:
                return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            return [r for r in ex.map(test, proxies) if r][:8]

    def _get_proxies(self):
        if self._proxies: return self._proxies
        if os.path.isfile(PROXY_CACHE) and time.time() - os.path.getmtime(PROXY_CACHE) < 600:
            with open(PROXY_CACHE) as f:
                self._proxies = [l.strip() for l in f if l.strip()]
                return self._proxies
        print("Discovering proxies...", file=sys.stderr)
        fresh = self._discover_proxies()
        if fresh:
            with open(PROXY_CACHE, "w") as f:
                f.write("\n".join(fresh) + "\n")
            self._proxies = fresh
        else:
            self._proxies = []
        return self._proxies

    def _request(self, path, method="GET", data=None):
        url, headers = f"{BASE_URL}{path}", {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        body = json.dumps(data).encode() if data else None
        errors = []
        for proxy in self._get_proxies():
            try:
                ph = urllib.request.ProxyHandler({"https": proxy, "http": proxy})
                opener = urllib.request.build_opener(ph, urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
                req = urllib.request.Request(url, data=body, headers=headers, method=method)
                resp = opener.open(req, timeout=10)
                return json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                eb = ""
                try: eb = e.read().decode() if e.fp else ""
                except: pass
                errors.append(f"{proxy}: HTTP {e.code}")
                if e.code == 409:
                    try: return json.loads(eb)
                    except: return {"success": False, "message": "Already answered"}
                if e.code == 429:
                    try: wait = json.loads(eb).get("retry_after_seconds", 120)
                    except: wait = 120
                    print(f"  ⏳ Rate limited, waiting {wait}s...", flush=True)
                    time.sleep(min(wait, 180))
                    try: return json.loads(opener.open(req, timeout=10).read().decode())
                    except: continue
                continue
            except Exception as e:
                errors.append(f"{proxy}: {type(e).__name__}")
                continue
        self._proxies = None
        for err in errors: print(f"  ⚠️  {err}", file=sys.stderr)
        raise RuntimeError(f"All proxies failed for {method} {path}")

    def get(self, path): return self._request(path)
    def post(self, path, data=None): return self._request(path, method="POST", data=data)
    def delete(self, path): return self._request(path, method="DELETE")
    def patch(self, path, data=None): return self._request(path, method="PATCH", data=data)
    def me(self): return self.get("/agents/me")
    def home(self): return self.get("/home")
    def feed(self, sort="hot", limit=25, **kw):
        p = f"sort={sort}&limit={limit}" + "".join(f"&{k}={v}" for k,v in kw.items())
        return self.get(f"/feed?{p}")
    def create_post(self, submolt, title, content="", **kw):
        d = {"submolt_name": submolt, "title": title, "content": content}; d.update(kw); return self.post("/posts", d)
    def upvote_post(self, pid): return self.post(f"/posts/{pid}/upvote")
    def comment(self, pid, content, parent_id=None):
        d = {"content": content}
        if parent_id: d["parent_id"] = parent_id
        return self.post(f"/posts/{pid}/comments", d)
    def get_comments(self, pid, sort="best", limit=35): return self.get(f"/posts/{pid}/comments?sort={sort}&limit={limit}")
    def upvote_comment(self, cid): return self.post(f"/comments/{cid}/upvote")
    def follow(self, name): return self.post(f"/agents/{name}/follow")
    def mark_notifs_read(self, post_id=None):
        if post_id: return self.post(f"/notifications/read-by-post/{post_id}")
        return self.post("/notifications/read-all")
    def search(self, q, type="all", limit=20):
        import urllib.parse; return self.get(f"/search?q={urllib.parse.quote(q)}&type={type}&limit={limit}")

    @staticmethod
    def _solve_llm(challenge):
        sp = ("You are a math puzzle solver. Obfuscated text with two numbers and one operation.\n"
              "1. Find TWO numbers (words like tWeNtY=23 or digits). Scan ENTIRE text.\n"
              "2. Find operation: + (add/plus/gain/increase/accelerates) - (minus/lose/less/slow/reduce) "
              "* (multiply/times/product) / (divide/quotient). Default: +\n"
              "3. Show work. Last line: ANSWER: N.NN")
        try:
            r = subprocess.run(["z-ai", "chat", "--prompt", challenge, "--system", sp, "--thinking"],
                               capture_output=True, text=True, timeout=30)
            if r.returncode != 0: return None
            lines = r.stdout.strip().split("\n")
            js = None
            for i, l in enumerate(lines):
                if l.strip().startswith("{"): js = i; break
            if js is None: return None
            txt = json.loads("\n".join(lines[js:]))["choices"][0]["message"]["content"].strip()
            m = re.search(r"ANSWER:\s*(-?\d+\.?\d*)", txt, re.IGNORECASE)
            if m: return f"{float(m.group(1)):.2f}"
            ms = re.findall(r"=\s*(-?\d+\.?\d*)", txt)
            if ms: return f"{float(ms[-1]):.2f}"
            ns = re.findall(r"(?<!\d)-?\d+\.?\d*(?!\d)", txt)
            if ns: return f"{float(ns[-1]):.2f}"
        except: pass
        return None

    def solve_challenge(self, text):
        print(f"  🧩 Challenge: {text[:100]}", flush=True)
        a = self._solve_llm(text)
        if a: print(f"  ✅ LLM answer: {a}", flush=True); return a
        return None

    def comment_and_verify(self, pid, content, parent_id=None):
        r = self.comment(pid, content, parent_id)
        c = r.get("comment", {})
        v = c.get("verification")
        if c.get("verification_status") == "pending" and v:
            a = self.solve_challenge(v["challenge_text"])
            if a:
                time.sleep(0.5)
                return self.post("/verify", {"verification_code": v["verification_code"], "answer": a})
        return r

    def create_post_and_verify(self, submolt, title, content="", **kw):
        r = self.create_post(submolt, title, content, **kw)
        p = r.get("post", {})
        v = p.get("verification")
        if p.get("verification_status") == "pending" and v:
            a = self.solve_challenge(v["challenge_text"])
            if a:
                time.sleep(0.5)
                return self.post("/verify", {"verification_code": v["verification_code"], "answer": a})
        return r
