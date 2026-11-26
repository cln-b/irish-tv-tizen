const http=require('node:http');
const PORT=Number(process.env.TG4_HELPER_PORT||8787);
const SSO='https://sso.tg4.ie';
const USER='https://user.tg4.ie';
const routes=[
 {prefix:'/sso/register',target:SSO+'/register',methods:['POST']},
 {prefix:'/sso/associate',target:SSO+'/associate',methods:['POST']},
 {prefix:'/sso/token',target:SSO+'/token',methods:['POST']},
 {prefix:'/sso/api/v2/session/user/profile',target:SSO+'/api/v2/session/user/profile',methods:['GET']},
 {prefix:'/sso/api/v2/session/logout',target:SSO+'/api/v2/session/logout',methods:['DELETE']},
 {prefix:'/user/api/playlist/v3/watch_later',target:USER+'/api/playlist/v3/watch_later',methods:['GET','POST','DELETE']},
 {prefix:'/user/api/history/v2',target:USER+'/api/history/v2',methods:['POST']}
];
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'Content-Type, Authorization, Token-Type, Accept',
 'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS',
 'Cache-Control':'no-store'
};
function routeFor(path){
 for(const r of routes)if(path===r.prefix||path.indexOf(r.prefix+'/')===0)return r;
 return null;
}
function readBody(request){
 return new Promise((resolve,reject)=>{
  const chunks=[];request.on('data',c=>chunks.push(c));request.on('end',()=>resolve(Buffer.concat(chunks)));request.on('error',reject);
 });
}
const server=http.createServer(async(request,response)=>{
 const path=(request.url||'').split('?')[0];
 if(request.method==='OPTIONS'){response.writeHead(204,cors);response.end();return;}
 const route=routeFor(path);
 if(!route||route.methods.indexOf(request.method)<0){response.writeHead(404,{...cors,'Content-Type':'text/plain'});response.end('not found');return;}
 try{
  const headers={Accept:'application/json'};
  for(const name of ['content-type','authorization','token-type'])if(request.headers[name])headers[name]=request.headers[name];
  const init={method:request.method,headers,redirect:'manual'};
  if(request.method!=='GET')init.body=await readBody(request);
  const upstream=await fetch(route.target+(request.url||'').slice(path.length),init);
  const body=Buffer.from(await upstream.arrayBuffer());
  const headersOut={...cors,'Content-Type':upstream.headers.get('content-type')||'application/json'};
  for(const name of ['etag','last-modified'])if(upstream.headers.get(name))headersOut[name]=upstream.headers.get(name);
  response.writeHead(upstream.status,headersOut);response.end(body);
  console.log(request.method,path,'->',upstream.status);
 }catch(error){
  response.writeHead(502,{...cors,'Content-Type':'text/plain'});response.end('helper error');
  console.log(request.method,path,'-> helper error');
 }
});
server.listen(PORT,'0.0.0.0',()=>console.log('TG4 login helper listening on port '+PORT));
