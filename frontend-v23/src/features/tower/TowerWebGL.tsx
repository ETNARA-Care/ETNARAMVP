import { useEffect, useRef, useState } from "react";
import type { TowerFloor } from "./floors";

interface Props { floors: readonly TowerFloor[]; onSelect: (departmentId: string) => void }
const vertex = `attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uMatrix;
varying vec3 vColor;
void main(){gl_Position=uMatrix*vec4(aPosition,1.0);vColor=aColor;}`;
const fragment = `precision mediump float;
varying vec3 vColor;
void main(){gl_FragColor=vec4(vColor,1.0);}`;
function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) throw Error("WebGL shader unavailable");
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error ?? "Shader error"); }
  return s;
}
function multiply(a: number[], b: number[]) {
  const o=Array(16).fill(0);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];
  return o;
}
function geometry(floors: readonly TowerFloor[]) {
  const positions:number[]=[], colors:number[]=[];
  function quad(a:number[],b:number[],c:number[],d:number[],color:number[]) {
    for(const p of [a,b,c,a,c,d]) {positions.push(...p);colors.push(...color);}
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:number[]) {
    const x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],color);
    quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],color.map(v=>v*.75));
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],color.map(v=>v*.82));
    quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],color.map(v=>v*.9));
    quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],color.map(v=>Math.min(1,v*1.2)));
  }
  box(0,-.9,0,8,.9,6,[.72,.69,.59]);
  floors.forEach((floor,i)=>{
    const width=6.1-i*.12,depth=4.6-i*.07,y=i*1.28;
    box(0,y,0,width,1.15,depth,[.10+i*.006,.21+i*.008,.32+i*.007]);
    box(0,y,0,width+.18,.09,depth+.18,[.48,.66,.52]);
    box(0,y+1.06,0,width+.18,.09,depth+.18,[.48,.66,.52]);
    for(let j=1;j<7;j++){const x=-width/2+j*width/7;box(x,y+.1,depth/2+.035,.035,.93,.04,[.66,.71,.72]);}
    // Subtle illuminated windows: emissive-looking warm bands in the front elevation.
    for(let j=0;j<5;j++){const x=-width/2+(j+.5)*width/5;box(x,y+.4,depth/2+.06,width/9,.18,.025,[.78,.60,.39]);}
    void floor;
  });
  box(0,floors.length*1.28,0,4.5,.7,3.6,[.75,.65,.43]);
  return {positions:new Float32Array(positions),colors:new Float32Array(colors)};
}
/** True WebGL-rendered geometric exterior; no external CDN or runtime dependencies. */
export default function TowerWebGL({floors,onSelect}:Props) {
  const canvas=useRef<HTMLCanvasElement>(null), [failed,setFailed]=useState(false);
  const rotation=useRef(.46);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const gl=element.getContext("webgl",{antialias:true,alpha:false});
    if(!gl){setFailed(true);return;}
    let program:WebGLProgram|null=null,positionBuffer:WebGLBuffer|null=null,colorBuffer:WebGLBuffer|null=null;
    let frame=0;
    try {
      program=gl.createProgram();if(!program)throw Error("WebGL program unavailable");
      const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("WebGL link failed");
      const g=geometry(floors);
      positionBuffer=gl.createBuffer();colorBuffer=gl.createBuffer();
      if(!positionBuffer||!colorBuffer)throw Error("WebGL buffer unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,g.positions,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.bufferData(gl.ARRAY_BUFFER,g.colors,gl.STATIC_DRAW);
      const p=gl.getAttribLocation(program,"aPosition"),c=gl.getAttribLocation(program,"aColor"),m=gl.getUniformLocation(program,"uMatrix");
      if(p<0||c<0||!m)throw Error("WebGL attribute unavailable");
      const render=()=>{
        const width=element.clientWidth,height=element.clientHeight;
        if(width===0||height===0)return;
        const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
        if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
        gl.viewport(0,0,w,h);gl.clearColor(.043,.086,.149,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(program);
        const aspect=w/h,f=1/Math.tan(Math.PI/7),near=.1,far=100;
        const proj=[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
        const a=rotation.current,co=Math.cos(a),si=Math.sin(a);
        const turn=[co,0,-si,0,0,1,0,0,si,0,co,0,0,0,0,1];
        const tilt=[1,0,0,0,0,.94,.34,0,0,-.34,.94,0,0,0,0,1];
        const move=[1,0,0,0,0,1,0,0,0,0,1,0,0,-5.4,-24,1];
        gl.uniformMatrix4fv(m,false,new Float32Array(multiply(proj,multiply(move,multiply(tilt,turn)))));
        gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(c,3,gl.FLOAT,false,0,0);
        gl.drawArrays(gl.TRIANGLES,0,g.positions.length/3);
      };
      let lastX:number|null=null;
      const down=(e:PointerEvent)=>{lastX=e.clientX;element.setPointerCapture(e.pointerId);};
      const movePointer=(e:PointerEvent)=>{if(lastX===null)return;rotation.current+=(e.clientX-lastX)*.008;lastX=e.clientX;render();};
      const up=()=>{lastX=null;};
      const resize=()=>{frame=requestAnimationFrame(render);};
      const observer=new ResizeObserver(resize);observer.observe(element);
      element.addEventListener("pointerdown",down);element.addEventListener("pointermove",movePointer);element.addEventListener("pointerup",up);element.addEventListener("pointercancel",up);
      render();
      return ()=>{cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener("pointerdown",down);element.removeEventListener("pointermove",movePointer);element.removeEventListener("pointerup",up);element.removeEventListener("pointercancel",up);if(positionBuffer)gl.deleteBuffer(positionBuffer);if(colorBuffer)gl.deleteBuffer(colorBuffer);if(program)gl.deleteProgram(program);};
    }catch{setFailed(true);if(positionBuffer)gl.deleteBuffer(positionBuffer);if(colorBuffer)gl.deleteBuffer(colorBuffer);if(program)gl.deleteProgram(program);}
  },[floors]);
  if(failed)return <p role="status" className="rounded-lg border p-4">El visor 3D no está disponible en este dispositivo. Utiliza el directorio 2D para navegar.</p>;
  return <div className="relative overflow-hidden rounded-xl bg-[#0b1626]"><canvas ref={canvas} aria-label="Modelo tridimensional de ETNARA Tower. Arrastra para girar." className="h-[480px] w-full touch-pan-y cursor-grab" /><div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">{floors.map(f=><button key={f.departmentId} type="button" onClick={()=>onSelect(f.departmentId)} className="rounded-md border border-white/25 bg-[#0b1626]/85 px-2 py-1 text-xs text-white hover:bg-[#294b45]">{f.number}</button>)}</div></div>;
}
