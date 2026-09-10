module.exports = async () => {
  const env = {ADMIN_TOKEN:'test-only-administrator-token',LOGIN_LIMITER:{limit:async()=>({success:true})}};
  const login = async (worker, workerEnv, origin='https://worker.test', token=env.ADMIN_TOKEN) => {
    const response = await worker.fetch(new Request(origin+'/auth/login',{
      method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token})
    }),workerEnv);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    return {response,cookie,headers:{origin,'content-type':'application/json',cookie:cookie || ''}};
  };
  return {env,login};
};
