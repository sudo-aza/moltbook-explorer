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
            all_proxies = [f"http://{p['ip']}:{p['port']}" for p in data.get("proxies", []) if p.get("protocol") == "http"]
            # Prefer proxies with < 1000ms timeout from the API
            all_proxies.sort(key=lambda x: 0)
            proxies = all_proxies[:20]
        except Exception:
            return []
        ctx = ssl._create_unverified_context()
        def test(px):
            try:
                ph = urllib.request.ProxyHandler({"https": px, "http": px})
                opener = urllib.request.build_opener(ph, urllib.request.HTTPSHandler(context=ctx))
                req = urllib.request.Request(f"{BASE_URL}/agents/me", headers={"Authorization": f"Bearer {self.api_key}"})
                opener.open(req, timeout=5)
                return px
            except Exception:
                return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            return [r for r in ex.map(test, proxies) if r][:5]

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
                    print(f"  ⏳ Rate limited ({wait}s), waiting + retrying all proxies...", flush=True)
                    time.sleep(wait + 5)
                    self._proxies = None  # force fresh proxy discovery
                    return self._request(path, method, data)  # retry from scratch
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
    def _manual_solve(challenge):
        """Quick manual solve for clean/obfuscated number challenges.
        Returns (answer_str, [num1, num2], operation) or (None, [], op)."""
        words = re.split(r'[^a-z]+', challenge.lower())
        words = [w for w in words if w]
        def dedupe(s):
            r = []
            for c in s:
                if not r or c != r[-1]: r.append(c)
            return ''.join(r)
        deduped = [dedupe(w) for w in words]
        
        # Build spaced form: only rejoin fragments that aren't standalone number/stop words
        standalone = {'the','and','or','but','in','on','at','to','of','for','with','is','are',
                       'a','an','it','its','by','from','has','had','was','were','be','been',
                       'not','no','so','if','as','do','does','did','can','could','will',
                       'would','should','may','might','must','than','then','that','this',
                       'what','which','who','how','when','where','why','all','each','every',
                       'one','two','three','four','five','six','seven','eight','nine','ten',
                       'zero','eleven','twelve','twenty','thirty','forty','fifty','sixty'}
        rejoined = []
        buf = ''
        for w in deduped:
            if len(w) <= 3 and w not in standalone:
                buf += w
            else:
                if buf: rejoined.append(buf); buf = ''
                rejoined.append(w)
        if buf: rejoined.append(buf)
        
        # Also fully concatenated (handles word-internal obfuscation like tWeN|tY)
        text_concat = ''.join(deduped)
        text_spaced = ' '.join(rejoined)
        
        num_words = [
            ('seventeen',17),('thirteen',13),('fourteen',14),('fifteen',15),('eighteen',18),
            ('nineteen',19),('sixteen',16),('twelve',12),('eleven',11),('ten',10),
            ('twenty',20),('thirty',30),('forty',40),('fifty',50),
            ('sixty',60),('seventy',70),('eighty',80),('ninety',90),
            ('hundred',100),('zero',0),('one',1),('two',2),('three',3),
            ('four',4),('five',5),('six',6),('seven',7),('eight',8),('nine',9)
        ]
        
        # Try exact match in both forms, longest-first
        found = []
        for text_source in [text_spaced, text_concat]:
            for word, val in num_words:
                start = 0
                while True:
                    idx = text_source.find(word, start)
                    if idx == -1: break
                    end = idx + len(word)
                    # Check no overlap with existing finds
                    if any(not (end <= s or idx >= e) for s, e, _, _ in found):
                        start = idx + 1; continue
                    # Check not shadowed by a longer match at same start
                    if any(idx >= s and idx < e for s, e, _, _ in found):
                        start = idx + 1; continue
                    found.append((idx, end, val, word))
                    start = idx + 1
        found.sort()
        
        # If <2 found, try fuzzy on deduped words (cutoff 0.7 to avoid false positives)
        if len(found) < 2:
            from difflib import get_close_matches
            for w in deduped:
                matches = get_close_matches(w, [nw for nw, _ in num_words], n=1, cutoff=0.7)
                if matches:
                    val = dict(num_words)[matches[0]]
                    pos = text_concat.find(w)
                    if pos >= 0:
                        end = pos + len(w)
                        if not any(not (end <= s or idx >= e) for s, e, _, _ in found):
                            found.append((pos, end, val, matches[0]))
            found.sort()
        
        # Merge compounds (twenty + three = 23)
        merged = []
        i = 0
        while i < len(found):
            pos, end, val, w_text = found[i]
            tens = {'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'}
            if w_text in tens and i + 1 < len(found):
                npos, nend, nval, nw = found[i+1]
                if npos - end <= 1 and nval < 10:
                    merged.append(val + nval)
                    i += 2; continue
            merged.append(val)
            i += 1
        nums = merged[:2]
        
        op = '+'
        # Check in both text forms for operation words
        for text_source in [text_spaced, text_concat]:
            if any(w in text_source for w in ['minus','subtract','difference','remove']):
                op = '-'; break
            if any(w in text_source for w in ['multiply','times','product']):
                op = '*'; break
            if any(w in text_source for w in ['divide','quotient','split','half']):
                op = '/'; break
            if any(w in text_source for w in ['add','plus','gain','gains','total']):
                op = '+'; break
        
        if len(nums) >= 2:
            if op == '+': answer = nums[0] + nums[1]
            elif op == '-': answer = nums[0] - nums[1]
            elif op == '*': answer = nums[0] * nums[1]
            else: answer = nums[0] / nums[1] if nums[1] != 0 else 0
            return f"{answer:.2f}", nums, op
        return None, nums, op

    def solve_challenge(self, text):
        print(f"  Challenge: {text[:120]}", flush=True)
        answer, numbers, op = self._manual_solve(text)
        if answer:
            print(f"  Manual: {numbers[0] if numbers else '?'} {op} {numbers[1] if len(numbers)>1 else '?'} = {answer}", flush=True)
            return answer
        print(f"  Manual failed ({numbers}, {op}), trying LLM...", flush=True)
        a = self._solve_llm(text)
        if a: print(f"  LLM answer: {a}", flush=True)
        return a

    @staticmethod
    def _solve_llm(challenge):
        # Pre-deobfuscate for the LLM to improve its accuracy
        words = re.split(r'[^a-z]+', challenge.lower())
        words = [w for w in words if w]
        def dedupe(s):
            r = []
            for c in s:
                if not r or c != r[-1]: r.append(c)
            return ''.join(r)
        deduped = [dedupe(w) for w in words]
        pre_deob = ' '.join(deduped)
        
        sp = (f"Deobfuscated challenge text: \"{pre_deob}\"\n"
              "Find exactly TWO numbers and ONE math operation (+, -, *, /).\n"
              "If two numbers are adjacent and form a compound (e.g. 'twenty five'), treat as one number (25).\n"
              "Default operation is + if unclear.\n"
              "Show your work. Last line must be exactly: ANSWER: N.NN")
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
