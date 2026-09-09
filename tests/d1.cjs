/* 使用實際 SQLite 執行 Worker SQL，模擬 D1 的呼叫介面。 */
const {DatabaseSync}=require('node:sqlite');
module.exports=()=>{
  const db=new DatabaseSync(':memory:');
  const prepare=sql=>{
    const statement=params=>({
      bind:(...values)=>statement(values),
      first:async()=>db.prepare(sql).get(...params) || null,
      all:async()=>({results:db.prepare(sql).all(...params)}),
      run:async()=>({meta:db.prepare(sql).run(...params)})
    });
    return statement([]);
  };
  return {db,env:{DB:{prepare,batch:async statements=>Promise.all(statements.map(s=>s.run()))}}};
};
