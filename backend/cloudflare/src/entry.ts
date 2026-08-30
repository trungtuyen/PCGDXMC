import base from './index';

type Role='super_admin'|'national_admin'|'province_admin'|'commune_admin';
type AppUser={id:string;role:Role;provinceKey?:string;communeCode?:string};
type UserListItem={id:string;role:Role;provinceKey?:string;communeCode?:string};

function isMinistry(role:string){return role==='super_admin'||role==='national_admin'}
function canManage(actor:AppUser,target:{role:string;provinceKey?:string}){
  if(isMinistry(actor.role))return target.role==='province_admin';
  return actor.role==='province_admin'&&target.role==='commune_admin'&&target.provinceKey===actor.provinceKey;
}

async function callBase(request:Request,env:Env,ctx:ExecutionContext){return base.fetch(request,env,ctx)}
async function verifiedMe(request:Request,env:Env,ctx:ExecutionContext){
  const url=new URL(request.url);url.pathname='/v1/me';url.search='';
  const r=await callBase(new Request(url.toString(),{method:'GET',headers:request.headers}),env,ctx);
  if(!r.ok)return {response:r,user:null as AppUser|null};
  const body=await r.clone().json() as {user?:AppUser};
  return {response:r,user:body.user||null};
}

async function rawUserList(request:Request,env:Env,ctx:ExecutionContext){
  const url=new URL(request.url);url.pathname='/v1/admin/users';url.search='';
  const r=await callBase(new Request(url.toString(),{method:'GET',headers:request.headers}),env,ctx);
  if(!r.ok)return {response:r,users:[] as UserListItem[]};
  const body=await r.clone().json() as {users?:UserListItem[]};
  return {response:r,users:Array.isArray(body.users)?body.users:[]};
}

function filteredListResponse(source:Response,users:UserListItem[],actor:AppUser){
  const visible=isMinistry(actor.role)?users.filter(u=>u.role==='province_admin'):users.filter(u=>u.role==='commune_admin'&&u.provinceKey===actor.provinceKey);
  const headers=new Headers(source.headers);headers.set('Content-Type','application/json; charset=utf-8');headers.set('Cache-Control','no-store');
  return new Response(JSON.stringify({users:visible}),{status:source.status,headers});
}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url),path=url.pathname;
    const isAdminUsers=path==='/v1/admin/users';
    const patchMatch=path.match(/^\/v1\/admin\/users\/([0-9a-f-]+)$/i);

    if(request.method==='GET'&&isAdminUsers){
      const me=await verifiedMe(request,env,ctx);if(!me.user)return me.response;
      const listed=await rawUserList(request,env,ctx);if(!listed.response.ok)return listed.response;
      return filteredListResponse(listed.response,listed.users,me.user);
    }

    if(request.method==='POST'&&isAdminUsers){
      const me=await verifiedMe(request,env,ctx);if(!me.user)return me.response;
      let body:any={};try{body=await request.clone().json()}catch{return callBase(request,env,ctx)}
      const target={role:String(body?.role||''),provinceKey:String(body?.provinceKey||'')};
      if(!canManage(me.user,target))return new Response(JSON.stringify({error:'forbidden_role_assignment'}),{status:403,headers:me.response.headers});
      return callBase(request,env,ctx);
    }

    if(request.method==='PATCH'&&patchMatch){
      const me=await verifiedMe(request,env,ctx);if(!me.user)return me.response;
      const listed=await rawUserList(request,env,ctx);if(!listed.response.ok)return listed.response;
      const target=listed.users.find(u=>u.id===patchMatch[1]);
      if(!target)return new Response(JSON.stringify({error:'user_not_found'}),{status:404,headers:listed.response.headers});
      if(!canManage(me.user,{role:target.role,provinceKey:target.provinceKey}))return new Response(JSON.stringify({error:'forbidden'}),{status:403,headers:listed.response.headers});
      return callBase(request,env,ctx);
    }

    return callBase(request,env,ctx);
  }
} satisfies ExportedHandler<Env>;
