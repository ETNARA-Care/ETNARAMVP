/** Cliente HTTP mínimo para el backend real de ETNARA. */
export interface ApiError { status:number; code?:string; message?:string; isNetworkError?:boolean; /** Reference of an unexpected server error (500), to find it in the server log. Never personal data. */ errorId?:string; }
const ERROR_ID=/^[0-9a-f-]{36}$/i;
function errorIdOf(body:unknown):string|undefined{const v=body&&typeof body==="object"&&"errorId" in body?(body as {errorId:unknown}).errorId:undefined;return typeof v==="string"&&ERROR_ID.test(v)?v:undefined;}
function apiBase():string{
  const raw=import.meta.env.VITE_API_URL;
  if (!raw) {
    const err:ApiError={status:0,message:"VITE_API_URL no está configurada."};
    throw err;
  }
  return raw.replace(/\/+$/,"");
}
function buildUrl(path:string):string{const normalized=path.startsWith("/")?path:`/${path}`;return `${apiBase()}${normalized}`;}
async function parseJsonSafely(response:Response):Promise<unknown>{const text=await response.text();if(!text)return null;try{return JSON.parse(text);}catch{return null;}}
/** Con señal débil un request puede quedarse colgado: a los 20 s cuenta como "sin señal" y se reintenta. */
const REQUEST_TIMEOUT_MS=20_000;
function requestSignal():AbortSignal|undefined{return typeof AbortSignal!=="undefined"&&"timeout" in AbortSignal?AbortSignal.timeout(REQUEST_TIMEOUT_MS):undefined;}
interface RequestOptions{method:"GET"|"POST"|"PUT"|"PATCH"|"DELETE";body?:unknown;token?:string|null;}
async function postBinary<T>(path:string,body:Blob,contentType:string,token:string):Promise<T>{let response:Response;try{response=await fetch(buildUrl(path),{method:"POST",headers:{"Content-Type":contentType,Authorization:`Bearer ${token}`},body});}catch{throw {status:0,isNetworkError:true} as ApiError;}const responseBody=await parseJsonSafely(response);if(!response.ok){const code=responseBody&&typeof responseBody==="object"&&"error" in responseBody&&typeof(responseBody as {error:unknown}).error==="string"?(responseBody as {error:string}).error:undefined;throw {status:response.status,code,errorId:errorIdOf(responseBody)} as ApiError;}return responseBody as T;}
/**
 * Private image bytes (activity photos): token in the header, never in the URL,
 * never cached by the browser. Returns a Blob the caller shows with an object URL.
 */
async function getBlob(path:string,token:string):Promise<Blob>{let response:Response;try{response=await fetch(buildUrl(path),{method:"GET",headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:requestSignal()});}catch{throw {status:0,isNetworkError:true} as ApiError;}if(!response.ok){const body=await parseJsonSafely(response);const code=body&&typeof body==="object"&&"error" in body&&typeof(body as {error:unknown}).error==="string"?(body as {error:string}).error:undefined;throw {status:response.status,code,errorId:errorIdOf(body)} as ApiError;}return response.blob();}
async function request<T>(path:string,options:RequestOptions):Promise<T>{const headers:Record<string,string>={"Content-Type":"application/json"};if(options.token)headers.Authorization=`Bearer ${options.token}`;let response:Response;try{response=await fetch(buildUrl(path),{method:options.method,headers,body:options.body!==undefined?JSON.stringify(options.body):undefined,signal:requestSignal()});}catch{throw {status:0,isNetworkError:true} as ApiError;}const body=await parseJsonSafely(response);if(!response.ok){const code=body&&typeof body==="object"&&"error" in body&&typeof(body as {error:unknown}).error==="string"?(body as {error:string}).error:undefined;throw {status:response.status,code,errorId:errorIdOf(body)} as ApiError;}return body as T;}
/**
 * Phase 12.4 · sin señal: la última respuesta de las lecturas que usa el
 * cuidador/a durante un turno se recuerda SOLO EN MEMORIA (nunca en disco).
 * Si la señal se cae, esas pantallas siguen mostrando lo último que llegó en
 * vez de un error. Se pierde al cerrar la app; nada de esto sale del teléfono.
 */
const OFFLINE_READABLE=/\/me\/shifts$|\/me\/worker-profile$|\/shifts\/[^/]+\/(visit-verification|care-events|service-location|journey)$|\/care-recipients(\/[^/]+\/(care-plan|location))?$/;
const lastResponses=new Map<string,unknown>();
const MAX_REMEMBERED=200;
async function getRemembering<T>(path:string,token?:string|null):Promise<T>{const key=`${token??""} ${path}`;const remember=OFFLINE_READABLE.test(path);try{const result=await request<T>(path,{method:"GET",token});if(remember){lastResponses.delete(key);lastResponses.set(key,result);if(lastResponses.size>MAX_REMEMBERED)lastResponses.delete(lastResponses.keys().next().value as string);rememberedListener?.();}return result;}catch(error){if(remember&&(error as ApiError).status===0&&lastResponses.has(key))return lastResponses.get(key) as T;const status=(error as ApiError).status;/* Access ended (e.g. unassigned): forget what was remembered, in memory and in the encrypted cache. */if(remember&&(status===401||status===403||status===404)&&lastResponses.delete(key))rememberedListener?.();throw error;}}
/** Al cerrar sesión: olvida las lecturas recordadas. */
export function forgetRememberedResponses():void{lastResponses.clear();}
/**
 * Phase 12.5: el caché cifrado de turnos (offline/shiftCache) lee y repone
 * estas lecturas. El cliente no sabe nada de cifrado ni de sesiones.
 */
let rememberedListener:(()=>void)|null=null;
export function onRemembered(listener:(()=>void)|null):void{rememberedListener=listener;}
export function exportRemembered(token:string):Array<[string,unknown]>{const prefix=`${token} `;return [...lastResponses.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key.slice(prefix.length),value]);}
export function importRemembered(token:string,entries:Array<[string,unknown]>):void{for(const [path,value] of entries){const key=`${token} ${path}`;if(!lastResponses.has(key))lastResponses.set(key,value);}}
export const apiClient={get:<T>(path:string,token?:string|null)=>getRemembering<T>(path,token),post:<T>(path:string,body?:unknown,token?:string|null)=>request<T>(path,{method:"POST",body,token}),put:<T>(path:string,body?:unknown,token?:string|null)=>request<T>(path,{method:"PUT",body,token}),patch:<T>(path:string,body?:unknown,token?:string|null)=>request<T>(path,{method:"PATCH",body,token}),delete:<T>(path:string,token?:string|null)=>request<T>(path,{method:"DELETE",token}),postBinary,getBlob};
