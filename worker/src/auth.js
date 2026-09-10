const SESSION_COOKIE = '__Host-trip-session';
const SESSION_SECONDS = 12 * 60 * 60;
const cookie = (value, seconds) => `${SESSION_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
const sessionToken = request => (request.headers.get('cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1) || '';
const secret = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const result = (data, status=200, headers={}) => Response.json(data,{status,headers:{'cache-control':'no-store',...headers}});

// 比較固定長度雜湊，不因第一個不同字元提前結束。
function equalHash(a, b) {
  let diff = 0;
  for (let i=0;i<64;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff === 0;
}

export async function administrator(request, env) {
  const token = sessionToken(request);
  if (!token || !env.ADMIN_TOKEN) return null;
  const session = await env.DB.prepare('SELECT token_hash FROM admin_sessions WHERE id_hash = ? AND expires_at > ?')
    .bind(await hash(token), Date.now()).first();
  return session && equalHash(session.token_hash, await hash(env.ADMIN_TOKEN)) ? {role:'admin',name:'管理員'} : null;
}

export function loginPage(env) {
  if (!env.ADMIN_TOKEN) return result({error:'管理員 Token 尚未設定。'},503);
  return new Response(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>管理員登入｜日本旅遊手冊</title>
  <style>body{font:16px system-ui,sans-serif;background:#f6f4ef;color:#22382c;margin:0;min-height:100vh;display:grid;place-items:center}main{width:min(340px,85vw);padding:32px}h1{font-size:28px}p{line-height:1.7}a{color:inherit}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;border:1px solid #c7cdc7;border-radius:8px;margin-top:12px}button{background:#0e6158;color:white;cursor:pointer}#message{min-height:3em}</style></head><body><main><h1>管理員登入</h1><p>輸入管理員 Token，即可編輯行程與記帳。</p><form id="loginForm"><label for="token">管理員 Token</label><input id="token" type="password" autocomplete="current-password" required maxlength="4096"><button id="submit" type="submit">開啟管理模式</button></form><p id="message" role="status"></p><a href="https://okd8888.github.io/trip-japan/">返回旅行手冊</a></main>
  <script>
  document.getElementById('loginForm').onsubmit=async event=>{
    event.preventDefault();const input=document.getElementById('token'),button=document.getElementById('submit'),message=document.getElementById('message');
    button.disabled=true;message.textContent='驗證中…';
    try{
      const response=await fetch('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:input.value})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      input.value='';const code=new URLSearchParams(location.search).get('code');location.replace('/admin/'+(code?'?code='+encodeURIComponent(code):''));
    }catch(error){message.textContent=error.message||'登入失敗，請重試';}finally{button.disabled=false;}
  };
  </script></body></html>`, {headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-frame-options':'DENY'}});
}

export async function authenticate(request, env) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return result({error:'登入請求來源不正確'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return result({error:'請使用 JSON'},415);
  if (!env.ADMIN_TOKEN) return result({error:'管理員 Token 尚未設定'},503);
  const {success} = await env.LOGIN_LIMITER.limit({key:'admin-login:'+ (request.headers.get('cf-connecting-ip') || 'local')});
  if (!success) return result({error:'嘗試次數過多，請稍後再試'},429,{'retry-after':'60'});
  let token;
  try {
    const text = await request.text();
    if (text.length>8192) return result({error:'登入資料過大'},413);
    ({token} = JSON.parse(text));
  } catch (_) { return result({error:'登入資料格式錯誤'},400); }
  if (typeof token !== 'string' || !token || !equalHash(await hash(token),await hash(env.ADMIN_TOKEN))) return result({error:'Token 不正確'},401);
  const session = secret();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO admin_sessions (id_hash, token_hash, expires_at) VALUES (?, ?, ?)')
      .bind(await hash(session),await hash(env.ADMIN_TOKEN),Date.now()+SESSION_SECONDS*1000)
  ]);
  return result({ok:true},200,{'set-cookie':cookie(session,SESSION_SECONDS)});
}

export async function logout(request, env) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return result({error:'登出請求來源不正確'},403);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE id_hash = ?').bind(await hash(sessionToken(request))).run();
  return result({ok:true},200,{'set-cookie':cookie('',0)});
}
