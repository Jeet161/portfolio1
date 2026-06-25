// Use THREE from window
const THREE = window.THREE;

// ============================================================
// LASERFLOW BACKGROUND (Three.js · Qualifications Section)
// ============================================================
const LASER_VERT = `
precision highp float;
attribute vec3 position;
void main(){
  gl_Position = vec4(position, 1.0);
}`;

const LASER_FRAG = `
#ifdef GL_ES
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;
precision mediump int;
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform float uWispDensity;
uniform float uTiltScale;
uniform float uFlowTime;
uniform float uFogTime;
uniform float uBeamXFrac;
uniform float uBeamYFrac;
uniform float uFlowSpeed;
uniform float uVLenFactor;
uniform float uHLenFactor;
uniform float uFogIntensity;
uniform float uFogScale;
uniform float uWSpeed;
uniform float uWIntensity;
uniform float uFlowStrength;
uniform float uDecay;
uniform float uFalloffStart;
uniform float uFogFallSpeed;
uniform vec3 uColor;
uniform float uFade;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define EPS 1e-6
#define EDGE_SOFT (DT_LOCAL*4.0)
#define DT_LOCAL 0.0038
#define TAP_RADIUS 6
#define R_H 150.0
#define R_V 150.0
#define FLARE_HEIGHT 16.0
#define FLARE_AMOUNT 8.0
#define FLARE_EXP 2.0
#define TOP_FADE_START 0.1
#define TOP_FADE_EXP 1.0
#define FLOW_PERIOD 0.5
#define FLOW_SHARPNESS 1.5
#define W_BASE_X 1.5
#define W_LAYER_GAP 0.25
#define W_LANES 10
#define W_SIDE_DECAY 0.5
#define W_HALF 0.01
#define W_AA 0.15
#define W_CELL 20.0
#define W_SEG_MIN 0.01
#define W_SEG_MAX 0.55
#define W_CURVE_AMOUNT 15.0
#define W_CURVE_RANGE (FLARE_HEIGHT - 3.0)
#define W_BOTTOM_EXP 10.0
#define FOG_ON 1
#define FOG_CONTRAST 1.2
#define FOG_OCTAVES 5
#define FOG_BOTTOM_BIAS 0.8
#define FOG_TILT_MAX_X 0.35
#define FOG_TILT_SHAPE 1.5
#define FOG_BEAM_MIN 0.0
#define FOG_BEAM_MAX 0.75
#define FOG_MASK_GAMMA 0.5
#define FOG_EXPAND_SHAPE 12.2
#define FOG_EDGE_MIX 0.5
#define HFOG_EDGE_START 0.20
#define HFOG_EDGE_END 0.98
#define HFOG_EDGE_GAMMA 1.4
#define HFOG_Y_RADIUS 25.0
#define HFOG_Y_SOFT 60.0
#define EDGE_X0 0.22
#define EDGE_X1 0.995
#define EDGE_X_GAMMA 1.25
#define EDGE_LUMA_T0 0.0
#define EDGE_LUMA_T1 2.0
#define DITHER_STRENGTH 1.0

float g(float x){return x<=0.00031308?12.92*x:1.055*pow(x,1.0/2.4)-0.055;}
float bs(vec2 p,vec2 q,float powr){float d=distance(p,q),f=powr*uFalloffStart,r=(f*f)/(d*d+EPS);return powr*min(1.0,r);}
float bsa(vec2 p,vec2 q,float powr,vec2 s){vec2 d=p-q;float dd=(d.x*d.x)/(s.x*s.x)+(d.y*d.y)/(s.y*s.y),f=powr*uFalloffStart,r=(f*f)/(dd+EPS);return powr*min(1.0,r);}
float tri01(float x){float f=fract(x);return 1.0-abs(f*2.0-1.0);}
float tauWf(float t,float tmin,float tmax){float a=smoothstep(tmin,tmin+EDGE_SOFT,t),b=1.0-smoothstep(tmax-EDGE_SOFT,tmax,t);return max(0.0,a*b);}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+34.123);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);float a=h21(i),b=h21(i+vec2(1,0)),c=h21(i+vec2(0,1)),d=h21(i+vec2(1,1));vec2 u=f*f*(3.0-2.0*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm2(vec2 p){float v=0.0,amp=0.6;mat2 m=mat2(0.86,0.5,-0.5,0.86);for(int i=0;i<FOG_OCTAVES;++i){v+=amp*vnoise(p);p=m*p*2.03+17.1;amp*=0.52;}return v;}
float rGate(float x,float l){float a=smoothstep(0.0,W_AA,x),b=1.0-smoothstep(l,l+W_AA,x);return max(0.0,a*b);}
float flareY(float y){float t=clamp(1.0-(clamp(y,0.0,FLARE_HEIGHT)/max(FLARE_HEIGHT,EPS)),0.0,1.0);return pow(t,FLARE_EXP);}

float vWisps(vec2 uv,float topF){
  float y=uv.y,yf=(y+uFlowTime*uWSpeed)/W_CELL;
  float dRaw=clamp(uWispDensity,0.0,2.0),d=dRaw<=0.0?1.0:dRaw;
  float lanesF=floor(float(W_LANES)*min(d,1.0)+0.5);
  int lanes=int(max(1.0,lanesF));
  float sp=min(d,1.0),ep=max(d-1.0,0.0);
  float fm=flareY(max(y,0.0)),rm=clamp(1.0-(y/max(W_CURVE_RANGE,EPS)),0.0,1.0),cm=fm*rm;
  const float G=0.05;float xS=1.0+(FLARE_AMOUNT*W_CURVE_AMOUNT*G)*cm;
  float sPix=clamp(y/R_V,0.0,1.0),bGain=pow(1.0-sPix,W_BOTTOM_EXP),sum=0.0;
  for(int s=0;s<2;++s){
    float sgn=s==0?-1.0:1.0;
    for(int i=0;i<W_LANES;++i){
      if(i>=lanes) break;
      float off=W_BASE_X+float(i)*W_LAYER_GAP,xc=sgn*(off*xS);
      float dx=abs(uv.x-xc),lat=1.0-smoothstep(W_HALF,W_HALF+W_AA,dx),amp=exp(-off*W_SIDE_DECAY);
      float seed=h21(vec2(off,sgn*17.0)),yf2=yf+seed*7.0,ci=floor(yf2),fy=fract(yf2);
      float seg=mix(W_SEG_MIN,W_SEG_MAX,h21(vec2(ci,off*2.3)));
      float spR=h21(vec2(ci,off+sgn*31.0)),seg1=rGate(fy,seg)*step(spR,sp);
      if(ep>0.0){float spR2=h21(vec2(ci*3.1+7.0,off*5.3+sgn*13.0));float f2=fract(fy+0.5);seg1+=rGate(f2,seg*0.9)*step(spR2,ep);}
      sum+=amp*lat*seg1;
    }
  }
  float span=smoothstep(-3.0,0.0,y)*(1.0-smoothstep(R_V-6.0,R_V,y));
  return uWIntensity*sum*topF*bGain*span;
}

void mainImage(out vec4 fc,in vec2 frag){
  vec2 C=iResolution.xy*.5;float invW=1.0/max(C.x,1.0);
  float sc=512.0/iResolution.x*.4;
  vec2 uv=(frag-C)*sc,off=vec2(uBeamXFrac*iResolution.x*sc,uBeamYFrac*iResolution.y*sc);
  vec2 uvc=uv-off;
  float a=0.0,b=0.0;
  float basePhase=1.5*PI+uDecay*.5;float tauMin=basePhase-uDecay;float tauMax=basePhase;
  float cx=clamp(uvc.x/(R_H*uHLenFactor),-1.0,1.0),tH=clamp(TWO_PI-acos(cx),tauMin,tauMax);
  for(int k=-TAP_RADIUS;k<=TAP_RADIUS;++k){
    float tu=tH+float(k)*DT_LOCAL,wt=tauWf(tu,tauMin,tauMax);if(wt<=0.0) continue;
    float spd=max(abs(sin(tu)),0.02),u=clamp((basePhase-tu)/max(uDecay,EPS),0.0,1.0),env=pow(1.0-abs(u*2.0-1.0),0.8);
    vec2 p=vec2((R_H*uHLenFactor)*cos(tu),0.0);
    a+=wt*bs(uvc,p,env*spd);
  }
  float yPix=uvc.y,cy=clamp(-yPix/(R_V*uVLenFactor),-1.0,1.0),tV=clamp(TWO_PI-acos(cy),tauMin,tauMax);
  for(int k=-TAP_RADIUS;k<=TAP_RADIUS;++k){
    float tu=tV+float(k)*DT_LOCAL,wt=tauWf(tu,tauMin,tauMax);if(wt<=0.0) continue;
    float yb=(-R_V)*cos(tu),s=clamp(yb/R_V,0.0,1.0),spd=max(abs(sin(tu)),0.02);
    float env=pow(1.0-s,0.6)*spd;
    float cap=1.0-smoothstep(TOP_FADE_START,1.0,s);cap=pow(cap,TOP_FADE_EXP);env*=cap;
    float ph=s/max(FLOW_PERIOD,EPS)+uFlowTime*uFlowSpeed;
    float fl=pow(tri01(ph),FLOW_SHARPNESS);
    env*=mix(1.0-uFlowStrength,1.0,fl);
    float yp=(-R_V*uVLenFactor)*cos(tu),m=pow(smoothstep(FLARE_HEIGHT,0.0,yp),FLARE_EXP),wx=1.0+FLARE_AMOUNT*m;
    vec2 sig=vec2(wx,1.0),p=vec2(0.0,yp);
    float mask=step(0.0,yp);
    b+=wt*bsa(uvc,p,mask*env,sig);
  }
  float sPix=clamp(yPix/R_V,0.0,1.0),topA=pow(1.0-smoothstep(TOP_FADE_START,1.0,sPix),TOP_FADE_EXP);
  float L=a+b*topA;
  float w=vWisps(vec2(uvc.x,yPix),topA);
  float fog=0.0;
  vec2 fuv=uvc*uFogScale;
  float nx=((iMouse.x-C.x)*invW);
  float ax=abs(nx);
  float st=sign(nx)*mix(ax,pow(ax,FOG_TILT_SHAPE),0.35)*uTiltScale;
  st=clamp(st,-FOG_TILT_MAX_X,FOG_TILT_MAX_X);
  vec2 dir=normalize(vec2(st,1.0));
  fuv+=uFogTime*uFogFallSpeed*dir;
  vec2 prp=vec2(-dir.y,dir.x);
  fuv+=prp*(0.08*sin(dot(uvc,prp)*0.08+uFogTime*0.9));
  float n=fbm2(fuv+vec2(fbm2(fuv+vec2(7.3,2.1)),fbm2(fuv+vec2(-3.7,5.9)))*0.6);
  n=pow(clamp(n,0.0,1.0),FOG_CONTRAST);
  float m0=pow(smoothstep(FOG_BEAM_MIN,FOG_BEAM_MAX,L),FOG_MASK_GAMMA);
  float bm=1.0-pow(1.0-m0,FOG_EXPAND_SHAPE);bm=mix(bm*m0,bm,FOG_EDGE_MIX);
  float yP=1.0-smoothstep(HFOG_Y_RADIUS,HFOG_Y_RADIUS+HFOG_Y_SOFT,abs(yPix));
  float nxF=abs((frag.x-C.x)*invW),hE=1.0-smoothstep(HFOG_EDGE_START,HFOG_EDGE_END,nxF);hE=pow(clamp(hE,0.0,1.0),HFOG_EDGE_GAMMA);
  float hW=mix(1.0,hE,clamp(yP,0.0,1.0));
  float bBias=mix(1.0,1.0-sPix,FOG_BOTTOM_BIAS);
  float radialFade=1.0-smoothstep(0.0,0.7,length(uvc)/120.0);
  fog=n*uFogIntensity*1.8*bBias*bm*hW*radialFade;
  float LF=L+fog;
  float dith=(h21(frag)-0.5)*(DITHER_STRENGTH/255.0);
  float tone=g(LF+w);
  vec3 col=tone*uColor+dith;
  float alpha=clamp(g(L+w*0.6)+dith*0.6,0.0,1.0);
  float nxE=abs((frag.x-C.x)*invW),xF=pow(clamp(1.0-smoothstep(EDGE_X0,EDGE_X1,nxE),0.0,1.0),EDGE_X_GAMMA);
  float scene=LF+max(0.0,w)*0.5,hi=smoothstep(EDGE_LUMA_T0,EDGE_LUMA_T1,scene);
  float eM=mix(xF,1.0,hi);
  col*=eM;alpha*=eM;
  col*=uFade;alpha*=uFade;
  fc=vec4(col,alpha);
}

void main(){
  vec4 fc;
  mainImage(fc, gl_FragCoord.xy);
  gl_FragColor = fc;
}`;

class LaserFlowBackground {
    constructor(containerId, opts = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.inView = false;
        const color = opts.color || '#FF79C6';
        const rgb = this._hex(color);
        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
        this.uniforms = { iTime: { value: 0 }, iResolution: { value: new THREE.Vector3(1, 1, 1) }, iMouse: { value: new THREE.Vector4(0, 0, 0, 0) }, uWispDensity: { value: opts.wispDensity ?? 1.2 }, uTiltScale: { value: opts.mouseTiltStrength ?? 0.01 }, uFlowTime: { value: 0 }, uFogTime: { value: 0 }, uBeamXFrac: { value: opts.horizontalBeamOffset ?? 0.1 }, uBeamYFrac: { value: opts.verticalBeamOffset ?? 0.0 }, uFlowSpeed: { value: opts.flowSpeed ?? 0.35 }, uVLenFactor: { value: opts.verticalSizing ?? 2.0 }, uHLenFactor: { value: opts.horizontalSizing ?? 0.5 }, uFogIntensity: { value: opts.fogIntensity ?? 0.6 }, uFogScale: { value: opts.fogScale ?? 0.3 }, uWSpeed: { value: opts.wispSpeed ?? 15.0 }, uWIntensity: { value: opts.wispIntensity ?? 5.0 }, uFlowStrength: { value: opts.flowStrength ?? 0.25 }, uDecay: { value: opts.decay ?? 1.1 }, uFalloffStart: { value: opts.falloffStart ?? 1.2 }, uFogFallSpeed: { value: opts.fogFallSpeed ?? 0.6 }, uColor: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) }, uFade: { value: 0 } };
        const mat = new THREE.RawShaderMaterial({ vertexShader: LASER_VERT, fragmentShader: LASER_FRAG, uniforms: this.uniforms, transparent: false, depthTest: false, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)), mat);
        mesh.frustumCulled = false;
        this.scene = new THREE.Scene(); this.scene.add(mesh);
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.clock = new THREE.Clock(); this.prevT = 0; this.fade = 0; this.mouseTarget = new THREE.Vector2(0, 0);
        window.addEventListener('mousemove', e => this._onMouse(e), { passive: true });
        window.addEventListener('touchstart', e => this._onTouch(e), { passive: false });
        window.addEventListener('touchmove', e => this._onTouch(e), { passive: false });
        const observer = new IntersectionObserver(es => { this.inView = es[0].isIntersecting; }, { threshold: 0.1 });
        observer.observe(this.container);
        const ro = new ResizeObserver(() => this._resize()); ro.observe(this.container);
        this._resize(); this._animate();
    }
    _hex(h) { const c = h.replace('#', ''); const n = parseInt(c, 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; }
    _onMouse(e) { if (!this.inView) return; const r = this.container.getBoundingClientRect(); const pr = window.devicePixelRatio || 1; this.mouseTarget.set((e.clientX - r.left) * pr, (r.height - (e.clientY - r.top)) * pr); }
    _onTouch(e) {
        if (!this.inView) return;
        const r = this.container.getBoundingClientRect();
        const pr = window.devicePixelRatio || 1;
        const touch = e.touches[0];
        this.mouseTarget.set((touch.clientX - r.left) * pr, (r.height - (touch.clientY - r.top)) * pr);
    }
    _resize() { const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1, pr = Math.min(window.devicePixelRatio || 1, 2); this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false); this.uniforms.iResolution.value.set(w * pr, h * pr, pr); }
    _animate() { requestAnimationFrame(() => this._animate()); if (!this.inView) return; const t = this.clock.getElapsedTime(), dt = Math.min(Math.max(t - this.prevT, 0.001), 0.033); this.prevT = t; this.uniforms.iTime.value = t; this.uniforms.uFlowTime.value += dt; this.uniforms.uFogTime.value += dt; if (this.fade < 1) { this.fade = Math.min(1, this.fade + dt); this.uniforms.uFade.value = this.fade; } const mu = this.uniforms.iMouse.value; mu.x += (this.mouseTarget.x - mu.x) * 0.08; mu.y += (this.mouseTarget.y - mu.y) * 0.08; this.renderer.render(this.scene, this.camera); }
}

function initTextAnimations() {
    // Only target elements that are pure text or specific headings
    const targets = document.querySelectorAll('.section-title, .hero-content h1');
    targets.forEach(target => {
        const text = target.textContent.trim();
        if (!text) return;

        target.innerHTML = '';
        [...text].forEach((char, i) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.setProperty('--char-delay', `${i * 0.02}s`);
            target.appendChild(span);
        });

        if (target.closest('.hero')) {
            target.classList.add('active');
        }
    });

    // For other reveal elements that might contain HTML (like the hero subtext), 
    // just ensure they have the 'active' class to trigger the CSS revealText animation
    const simpleReveals = document.querySelectorAll('.reveal-text:not(.section-title):not(h1)');
    simpleReveals.forEach(el => {
        if (el.closest('.hero')) {
            el.classList.add('active');
        }
    });
}


function initPillNav() {
    const nav = document.querySelector('.pill-nav-container');
    if (!nav) return;

    const items = nav.querySelectorAll('.pill-nav-link');
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const logoImg = nav.querySelector('.logo-icon');
    const ease = "power3.out";

    // Storage for timelines and tweens
    const tls = new Map();
    const activeTweens = new Map();

    const setupAnimations = () => {
        items.forEach((link, i) => {
            const circle = link.querySelector('.hover-circle');
            const label = link.querySelector('.pill-label');
            const labelH = link.querySelector('.pill-label-hover');

            if (!circle || !label || !labelH) return;

            const rect = link.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            const R = ((w * w) / 4 + h * h) / (2 * h);
            const D = Math.ceil(2 * R) + 2;
            const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
            const originY = D - delta;

            gsap.set(circle, {
                width: D,
                height: D,
                bottom: -delta,
                xPercent: -50,
                scale: 0,
                transformOrigin: `50% ${originY}px`
            });

            gsap.set(label, { y: 0 });
            gsap.set(labelH, { y: h + 12, opacity: 0 });

            const tl = gsap.timeline({ paused: true });
            tl.to(circle, { scale: 1.2, duration: 0.8, ease }, 0)
                .to(label, { y: -(h + 8), duration: 0.6, ease }, 0)
                .to(labelH, { y: 0, opacity: 1, duration: 0.6, ease }, 0.1);

            tls.set(link, tl);
        });
    };

    items.forEach(link => {
        link.addEventListener('mouseenter', () => {
            const tl = tls.get(link);
            if (!tl) return;
            activeTweens.get(link)?.kill();
            const twin = tl.tweenTo(tl.duration(), { duration: 0.4, ease, overwrite: 'auto' });
            activeTweens.set(link, twin);
        });
        link.addEventListener('mouseleave', () => {
            const tl = tls.get(link);
            if (!tl) return;
            activeTweens.get(link)?.kill();
            const twin = tl.tweenTo(0, { duration: 0.3, ease, overwrite: 'auto' });
            activeTweens.set(link, twin);
        });
    });

    const logoWrapper = nav.querySelector('.pill-nav-logo-link');
    if (logoWrapper && logoImg) {
        logoWrapper.addEventListener('mouseenter', () => {
            gsap.to(logoImg, {
                rotate: 360,
                duration: 0.8,
                ease: "elastic.out(1, 0.5)",
                overwrite: 'auto',
                onComplete: () => gsap.set(logoImg, { rotate: 0 })
            });
        });
    }

    const entrance = () => {
        const logo = nav.querySelector('.pill-nav-logo-wrapper');
        const listItems = nav.querySelectorAll('.pill-nav-item');

        if (logo) gsap.set(logo, { scale: 0, opacity: 0 });
        if (listItems.length) gsap.set(listItems, { opacity: 0, x: -20 });

        const mainTl = gsap.timeline({ delay: 0.2 });
        if (logo) mainTl.to(logo, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" });
        if (listItems.length) mainTl.to(listItems, { opacity: 1, x: 0, duration: 0.6, stagger: 0.05, ease: "power2.out" }, "-=0.4");
    };

    if (mobileToggle && mobileMenu) {
        let isOpen = false;
        mobileToggle.addEventListener('click', () => {
            isOpen = !isOpen;
            if (isOpen) {
                mobileMenu.style.display = 'block';
                gsap.to(mobileMenu, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
            } else {
                gsap.to(mobileMenu, { opacity: 0, y: -10, duration: 0.3, ease: "power3.in", onComplete: () => mobileMenu.style.display = 'none' });
            }
        });
    }

    setupAnimations();
    entrance();

    // MAGNETIC LOGO & LINKS
    const magnets = document.querySelectorAll('.pill-nav-logo-link, .pill-nav-link');
    magnets.forEach(m => {
        m.addEventListener('mousemove', (e) => {
            const rect = m.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            gsap.to(m, {
                x: x * 0.35,
                y: y * 0.35,
                duration: 0.6,
                ease: "power2.out"
            });
        });
        m.addEventListener('mouseleave', () => {
            gsap.to(m, {
                x: 0,
                y: 0,
                duration: 0.8,
                ease: "elastic.out(1, 0.4)"
            });
        });
    });



    window.addEventListener('resize', setupAnimations);
}


function initJourneyLine() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const progressLine = document.getElementById('journey-progress-line');
    const path = document.querySelector('.journey-line-path');
    const svg = document.querySelector('.journey-line-svg');
    const container = document.querySelector('.stepper-container');

    if (!progressLine || !path || !container) return;

    let pathLength = 0;

    const updatePath = () => {
        const h = container.offsetHeight;
        if (h === 0) return;

        svg.setAttribute('viewBox', `0 0 200 ${h}`);
        // Simplified path string
        const d = `M 100 0 C 0 ${h * 0.25}, 200 ${h * 0.25}, 100 ${h * 0.5} C 0 ${h * 0.75}, 200 ${h * 0.75}, 100 ${h}`;

        path.setAttribute('d', d);
        progressLine.setAttribute('d', d);

        pathLength = progressLine.getTotalLength();
        progressLine.style.strokeDasharray = pathLength;

        // Use GSAP set for cleaner state management
        if (!gsap.isTweening(progressLine)) {
            gsap.set(progressLine, { strokeDashoffset: pathLength });
        }
    };

    updatePath();

    // Use a debounced resize listener
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updatePath, 200);
    });

    gsap.to(progressLine, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
            trigger: container,
            start: "top center",
            end: "bottom center",
            scrub: 0.5, // Snappier response
            invalidateOnRefresh: true,
            onRefresh: updatePath
        }
    });
}

// Consolidated initialization at the bottom of the file

// --- Interactive Waves Logic ---
class Grad {
    constructor(x, y, z) {
        this.x = x; this.y = y; this.z = z;
    }
    dot2(x, y) {
        return this.x * x + this.y * y;
    }
}

class Noise {
    constructor(seed = 0) {
        this.grad3 = [
            new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
            new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
            new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1)
        ];
        this.p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
        this.perm = new Array(512);
        this.gradP = new Array(512);
        this.seed(seed);
    }
    seed(seed) {
        if (seed > 0 && seed < 1) seed *= 65536;
        seed = Math.floor(seed);
        if (seed < 256) seed |= seed << 8;
        for (let i = 0; i < 256; i++) {
            let v = i & 1 ? this.p[i] ^ (seed & 255) : this.p[i] ^ ((seed >> 8) & 255);
            this.perm[i] = this.perm[i + 256] = v;
            this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
        }
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return (1 - t) * a + t * b; }
    perlin2(x, y) {
        let X = Math.floor(x), Y = Math.floor(y);
        x -= X; y -= Y;
        X &= 255; Y &= 255;
        const n00 = this.gradP[X + this.perm[Y]].dot2(x, y);
        const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1);
        const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y);
        const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1);
        const u = this.fade(x);
        return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y));
    }
}

class WavesBackground {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Performance optimization

        this.config = {
            lineColor: 'rgba(0, 0, 0, 0.75)', // Made darker as requested
            waveSpeedX: 0.012,
            waveSpeedY: 0.005,
            waveAmpX: 35,
            waveAmpY: 15,
            xGap: 20, // Increased gap for better performance
            yGap: 45, // Increased gap for better performance
            friction: 0.9,
            tension: 0.004,
            maxCursorMove: 100
        };

        this.mouse = { x: -1000, y: -1000, sx: 0, sy: 0, lx: 0, ly: 0, v: 0, vs: 0, a: 0, set: false };
        this.noise = new Noise(Math.random());
        this.lines = [];
        this.bounding = { width: 0, height: 0, left: 0, top: 0 };
        this.inView = false;

        // Use IntersectionObserver to pause animation
        const observer = new IntersectionObserver((entries) => {
            this.inView = entries[0].isIntersecting;
        }, { threshold: 0.01 });
        observer.observe(this.container);

        window.addEventListener('resize', () => this.onResize(), { passive: true });
        window.addEventListener('mousemove', (e) => this.onMouseMove(e), { passive: true });
        window.addEventListener('touchstart', (e) => this.onTouch(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.onTouch(e), { passive: false });

        this.onResize();
        this.animate(0);
    }

    onResize() {
        const rect = this.container.getBoundingClientRect();
        this.bounding = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };

        // Limit canvas resolution for performance
        const pr = Math.min(window.devicePixelRatio || 1, 1.5);
        this.canvas.width = rect.width * pr;
        this.canvas.height = rect.height * pr;
        this.ctx.scale(pr, pr);

        this.initLines();
    }

    onMouseMove(e) {
        if (!this.inView) return;
        this.mouse.x = e.clientX - this.bounding.left;
        this.mouse.y = e.clientY - this.bounding.top;
        if (!this.mouse.set) {
            this.mouse.sx = this.mouse.lx = this.mouse.x;
            this.mouse.sy = this.mouse.ly = this.mouse.y;
            this.mouse.set = true;
        }
    }

    onTouch(e) {
        if (!this.inView) return;
        const touch = e.touches[0];
        this.mouse.x = touch.clientX - this.bounding.left;
        this.mouse.y = touch.clientY - this.bounding.top;
        if (!this.mouse.set) {
            this.mouse.sx = this.mouse.lx = this.mouse.x;
            this.mouse.sy = this.mouse.ly = this.mouse.y;
            this.mouse.set = true;
        }
    }

    initLines() {
        this.lines = [];
        const { width, height } = this.bounding;
        const { xGap, yGap } = this.config;
        const oWidth = width + 200, oHeight = height + 30;
        const totalLines = Math.ceil(oWidth / xGap);
        const totalPoints = Math.ceil(oHeight / yGap);
        const xStart = (width - xGap * totalLines) / 2;
        const yStart = (height - yGap * totalPoints) / 2;

        for (let i = 0; i <= totalLines; i++) {
            const pts = [];
            for (let j = 0; j <= totalPoints; j++) {
                pts.push({
                    x: xStart + xGap * i, y: yStart + yGap * j,
                    wave: { x: 0, y: 0 },
                    cursor: { x: 0, y: 0, vx: 0, vy: 0 }
                });
            }
            this.lines.push(pts);
        }
    }

    moved(p, withCursor = true) {
        return {
            x: p.x + p.wave.x + (withCursor ? p.cursor.x : 0),
            y: p.y + p.wave.y + (withCursor ? p.cursor.y : 0)
        };
    }

    animate(t) {
        requestAnimationFrame((time) => this.animate(time));
        if (!this.inView) return;

        // Smooth mouse movement
        this.mouse.sx += (this.mouse.x - this.mouse.sx) * 0.08;
        this.mouse.sy += (this.mouse.y - this.mouse.sy) * 0.08;
        const dx = this.mouse.x - this.mouse.lx, dy = this.mouse.y - this.mouse.ly;
        const d = Math.hypot(dx, dy);
        this.mouse.vs += (d - this.mouse.vs) * 0.08;
        this.mouse.vs = Math.min(80, this.mouse.vs);
        this.mouse.lx = this.mouse.x; this.mouse.ly = this.mouse.y;
        this.mouse.a = Math.atan2(dy, dx);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.bounding.width, this.bounding.height);

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.config.lineColor;
        this.ctx.lineWidth = 1.8; // Made slightly thicker as requested

        const timeScale = t * 0.001; // Slower, more stable time ref
        const wsX = this.config.waveSpeedX;
        const wsY = this.config.waveSpeedY;
        const wAmpX = this.config.waveAmpX;
        const wAmpY = this.config.waveAmpY;
        const tension = this.config.tension;
        const friction = this.config.friction;
        const maxMove = this.config.maxCursorMove;
        const mouseVs = this.mouse.vs;
        const mouseA = this.mouse.a;

        for (let i = 0; i < this.lines.length; i++) {
            const pts = this.lines[i];

            for (let j = 0; j < pts.length; j++) {
                const p = pts[j];

                // Optimized Perlin call
                const n = this.noise.perlin2((p.x + t * wsX) * 0.0015, (p.y + t * wsY) * 0.0012) * 10;
                p.wave.x = Math.cos(n) * wAmpX;
                p.wave.y = Math.sin(n) * wAmpY;

                const mdx = p.x - this.mouse.sx, mdy = p.y - this.mouse.sy;
                const distSq = mdx * mdx + mdy * mdy; // Use squared distance for optimization
                const l = Math.max(150, mouseVs * 1.5);
                const lSq = l * l;

                if (distSq < lSq) {
                    const dist = Math.sqrt(distSq);
                    const s = 1 - dist / l;
                    const f = Math.cos(dist * 0.001) * s;
                    const push = f * l * mouseVs * 0.0005;
                    p.cursor.vx += Math.cos(mouseA) * push;
                    p.cursor.vy += Math.sin(mouseA) * push;
                }

                p.cursor.vx += (0 - p.cursor.x) * tension;
                p.cursor.vy += (0 - p.cursor.y) * tension;
                p.cursor.vx *= friction;
                p.cursor.vy *= friction;
                p.cursor.x += p.cursor.vx * 1.8;
                p.cursor.y += p.cursor.vy * 1.8;

                if (p.cursor.x > maxMove) p.cursor.x = maxMove;
                else if (p.cursor.x < -maxMove) p.cursor.x = -maxMove;
                if (p.cursor.y > maxMove) p.cursor.y = maxMove;
                else if (p.cursor.y < -maxMove) p.cursor.y = -maxMove;
            }

            // Draw line
            let p0 = this.moved(pts[0], true);
            this.ctx.moveTo(p0.x, p0.y);
            for (let j = 1; j < pts.length; j++) {
                const p1 = this.moved(pts[j], true);
                this.ctx.lineTo(p1.x, p1.y);
            }
        }
        this.ctx.stroke();
    }
}


// Removed duplicate initialization


// --- Existing Logic ---

// Old cursor code removed — cursor is handled by initCustomCursor() below



// Reveal animations on scroll
const revealElements = document.querySelectorAll('.reveal');

const revealOnScroll = () => {
    revealElements.forEach(el => {
        const elementTop = el.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        if (elementTop < windowHeight - 150) {
            el.classList.add('active');
        }
    });
};

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

// Tilted Card Logic & Click to Flip Interaction
const projectCards = document.querySelectorAll('.project-card');

projectCards.forEach(card => {
    const inner = card.querySelector('.project-inner');
    const tooltip = card.querySelector('.project-tooltip');
    let rafId = null;

    const handleMove = (x, y) => {
        if (card.classList.contains('flipped')) return; // Ignore tilt updates if the card is flipped
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            const relX = x - rect.left;
            const relY = y - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((relY - centerY) / centerY) * -10;
            const rotateY = ((relX - centerX) / centerX) * 10;

            inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
            if (tooltip) {
                tooltip.style.left = `${x + 15}px`;
                tooltip.style.top = `${y + 15}px`;
            }
        });
    };

    const handleReset = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (card.classList.contains('flipped')) {
            inner.style.transform = `perspective(1600px) rotateY(180deg)`;
        } else {
            inner.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        }
    };

    card.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    card.addEventListener('mouseleave', handleReset);

    card.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    }, { passive: true });
    card.addEventListener('touchend', handleReset);

    // Toggle 3D Flip on Click (excluding the CTA card)
    if (!card.classList.contains('cta-project-card')) {
        card.addEventListener('click', () => {
            card.classList.add('flipping');
            card.classList.toggle('flipped');
            if (card.classList.contains('flipped')) {
                inner.style.transform = `perspective(1600px) rotateY(180deg)`;
            } else {
                inner.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1.05, 1.05, 1.05)`;
            }
            setTimeout(() => {
                card.classList.remove('flipping');
            }, 800);
        });
    }
});

// Premium CTA Glow Logic
const ctaButton = document.getElementById('cta-button');
if (ctaButton) {
    ctaButton.addEventListener('mousemove', (e) => {
        const rect = ctaButton.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctaButton.style.setProperty('--glow-x', `${x}px`);
        ctaButton.style.setProperty('--glow-y', `${y}px`);
    });
}

// Smooth hover for nav links
const navLinks = document.querySelectorAll('.nav-links a');
navLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
        cursor.style.transform = 'scale(3)';
        cursor.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        cursor.style.border = '1px solid #FFFFFF';
    });

    link.addEventListener('mouseleave', () => {
        cursor.style.transform = 'scale(1)';
        cursor.style.backgroundColor = '#FFFFFF';
        cursor.style.border = 'none';
    });
});

// Dynamic Text Rotator Logic
const dynamicText = document.getElementById('dynamic-text');
const phrases = [
    "I am a Creative Developer.",
    "I am a UI/UX Designer.",
    "I am a Full Stack Engineer.",
    "I am a Problem Solver."
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 80;

function typeEffect() {
    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
        dynamicText.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
        typingSpeed = 40;
    } else {
        dynamicText.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
        typingSpeed = 80;
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
        isDeleting = true;
        typingSpeed = 2500;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typingSpeed = 800;
    }

    setTimeout(typeEffect, typingSpeed);
}

// Start the effect
// Main Initialization Logic
document.addEventListener('DOMContentLoaded', () => {
    // Register Plugins
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }

    // Initialize Components
    initTextAnimations();
    initPillNav();
    initJourneyLine();
    initAboutTicker();
    initProjectFlips();

    // Backgrounds
    if (window.THREE) {
        // Hero Background
        const heroWave = document.getElementById('waves-container');
        if (heroWave) new WavesBackground('waves-container');

        // Other backgrounds (if containers exist)
        const laserContainer = document.getElementById('laserflow-container');
        if (laserContainer) {
            new LaserFlowBackground('laserflow-container', { color: '#ffffff', wispDensity: 1.2, fogIntensity: 0.6, horizontalBeamOffset: 0.1, flowSpeed: 0.35 });
        }
    }

    // Type Effect
    setTimeout(typeEffect, 1000);

    // CLICK RIPPLE EFFECT - Cinematic Flair
    document.addEventListener('click', (e) => {
        const ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        document.body.appendChild(ripple);

        const size = 100;
        gsap.set(ripple, {
            width: size,
            height: size,
            left: e.clientX - size / 2,
            top: e.clientY - size / 2,
            opacity: 0.4,
            scale: 0
        });

        gsap.to(ripple, {
            scale: 4,
            opacity: 0,
            duration: 1,
            ease: "power2.out",
            onComplete: () => ripple.remove()
        });
    });

    // Final Refresh
    setTimeout(() => {
        if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, 500);
});

function initAboutTicker() {
    const section = document.querySelector('#about');
    const track = document.querySelector('.ticker-track');

    if (section && track) {
        gsap.to(track, {
            xPercent: -100,
            x: "80vw",
            ease: "none",
            scrollTrigger: {
                trigger: section,
                pin: true,
                start: "top top",
                end: "+=2000",
                scrub: 1,
                invalidateOnRefresh: true
            }
        });
    }
}

window.addEventListener('load', () => {
    ScrollTrigger.refresh();
});

// EXPERIENCE HUB (PORTFOLIO OVERLAY) CONTROLS
function openPortfolio(initialTab = 'skills') {
    const overlay = document.getElementById('portfolio-overlay');
    if (!overlay) return;

    overlay.classList.add('active');
    document.body.classList.add('overlay-open');

    // Set initial tab
    switchHubTab(initialTab);

    // Push history state to allow "Back" button to close overlay
    if (window.history && window.history.pushState) {
        history.pushState({ overlayOpen: true }, "", "#hub");
    }
}

function closePortfolio(fromHistory = false) {
    const overlay = document.getElementById('portfolio-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;

    overlay.classList.remove('active');
    document.body.classList.remove('overlay-open');

    // If closing manually (not via back button) and hash exists, navigate back
    if (!fromHistory && window.location.hash === "#hub") {
        history.back();
    }
}

// Listen for browser back button
window.addEventListener('popstate', (e) => {
    closePortfolio(true);
});

function switchHubTab(tabId) {
    // Update views
    const views = document.querySelectorAll('.hub-view');
    views.forEach(view => view.classList.remove('active'));

    const activeView = document.getElementById(`hub-${tabId}-view`);
    if (activeView) activeView.classList.add('active');
    // Reset scroll position when switching tabs
    document.getElementById('portfolio-overlay').scrollTop = 0;

    // Trigger specific view logic
    if (tabId === 'qualifications') {
        setTimeout(() => {
            const line = document.getElementById('journey-progress-line-hub');
            const lineSec = document.getElementById('journey-progress-line-hub-secondary');

            // Kill existing ScrollTriggers to prevent duplicates
            ScrollTrigger.getAll().filter(st => st.vars.trigger === ".hub-stepper" || st.vars.trigger === ".skills-stepper").forEach(st => st.kill());

            if (line) {
                const len = line.getTotalLength();
                line.style.strokeDasharray = len;
                line.style.strokeDashoffset = len;
                gsap.killTweensOf(line);
                gsap.to(line, {
                    strokeDashoffset: 0,
                    ease: "none",
                    scrollTrigger: {
                        trigger: ".hub-stepper",
                        scroller: "#portfolio-overlay",
                        start: "top 40%",
                        end: "bottom 60%",
                        scrub: 1,
                        invalidateOnRefresh: true
                    }
                });
            }

            if (lineSec) {
                const lenSec = lineSec.getTotalLength();
                lineSec.style.strokeDasharray = lenSec;
                lineSec.style.strokeDashoffset = lenSec;
                gsap.killTweensOf(lineSec);
                gsap.to(lineSec, {
                    strokeDashoffset: 0,
                    ease: "none",
                    scrollTrigger: {
                        trigger: ".hub-stepper",
                        scroller: "#portfolio-overlay",
                        start: "top 40%",
                        end: "bottom 60%",
                        scrub: 1,
                        invalidateOnRefresh: true
                    }
                });
            }

            // Animate steps appearing — fire immediately when each step enters view
            const steps = document.querySelectorAll('.step');
            steps.forEach((step, i) => {
                gsap.fromTo(step,
                    { opacity: 0, x: i % 2 === 0 ? -50 : 50 },
                    {
                        opacity: 1,
                        x: 0,
                        duration: 0.6,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: step,
                            scroller: "#portfolio-overlay",
                            start: "top 100%",
                            end: "top 70%",
                            scrub: false,
                            toggleActions: "play none none none"
                        }
                    }
                );
            });
        }, 300);
    }
    // ── ADD THIS BLOCK inside switchHubTab(), after the existing 'qualifications' block ──
    // Place it right before the closing } of switchHubTab()

    if (tabId === 'skills') {
        setTimeout(() => {
            const line = document.getElementById('skills-progress-line');
            const lineSec = document.getElementById('skills-progress-line-secondary');

            ScrollTrigger.getAll()
                .filter(st => st.vars.trigger === ".hub-stepper" || st.vars.trigger === ".skills-stepper")
                .forEach(st => st.kill());

            if (line) {
                const len = line.getTotalLength();
                line.style.strokeDasharray = len;
                line.style.strokeDashoffset = len;
                gsap.killTweensOf(line);
                gsap.to(line, {
                    strokeDashoffset: 0,
                    ease: "none",
                    scrollTrigger: {
                        trigger: ".skills-stepper",
                        scroller: "#portfolio-overlay",
                        start: "top 40%",
                        end: "bottom 60%",
                        scrub: 1,
                        invalidateOnRefresh: true
                    }
                });
            }

            if (lineSec) {
                const lenSec = lineSec.getTotalLength();
                lineSec.style.strokeDasharray = lenSec;
                lineSec.style.strokeDashoffset = lenSec;
                gsap.killTweensOf(lineSec);
                gsap.to(lineSec, {
                    strokeDashoffset: 0,
                    ease: "none",
                    scrollTrigger: {
                        trigger: ".skills-stepper",
                        scroller: "#portfolio-overlay",
                        start: "top 40%",
                        end: "bottom 60%",
                        scrub: 1,
                        invalidateOnRefresh: true
                    }
                });
            }

            // Animate skill steps appearing (same as qualification steps)
            const skillSteps = document.querySelectorAll('.skill-step');
            skillSteps.forEach((step, i) => {
                gsap.fromTo(step,
                    { opacity: 0, x: i % 2 === 0 ? 50 : -50 },
                    {
                        opacity: 1,
                        x: 0,
                        scrollTrigger: {
                            trigger: step,
                            scroller: "#portfolio-overlay",
                            start: "top 85%",
                            end: "top 60%",
                            scrub: 1
                        }
                    }
                );
            });
        }, 300);
    }

}

function filterSkills(category) {
    // Update filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === category);
    });

    const cards = document.querySelectorAll('.skill-group-card');

    if (category === 'all') {
        gsap.to(cards, { opacity: 1, scale: 1, display: 'block', duration: 0.4, stagger: 0.05, ease: "power2.out" });
    } else {
        cards.forEach(card => {
            if (card.getAttribute('data-cat') === category) {
                gsap.to(card, { opacity: 1, scale: 1, display: 'block', duration: 0.4, ease: "power2.out" });
            } else {
                gsap.to(card, { opacity: 0, scale: 0.95, display: 'none', duration: 0.3, ease: "power2.in" });
            }
        });
    }
}

// Global Escape Key Listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePortfolio();
        closeVideoModal();
    }
});

// Video Modal Controls
function openVideoModal(videoId) {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('video-iframe');
    if (!modal || !iframe) return;

    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
}

function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('video-iframe');
    if (!modal || !iframe) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    iframe.src = '';

    // Only remove class if the main portfolio overlay is not open
    const portfolioOverlay = document.getElementById('portfolio-overlay');
    if (!portfolioOverlay || !portfolioOverlay.classList.contains('active')) {
        document.body.classList.remove('overlay-open');
    }
}

// Creative Mouse-Tracking for Skill Cards
document.addEventListener('mousemove', (e) => {
    // Only run if overlay is active
    const overlay = document.getElementById('portfolio-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;

    const cards = document.querySelectorAll('.skill-group-card');
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        // Check if card is in viewport before calculating
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mouse-x', `${x}%`);
            card.style.setProperty('--mouse-y', `${y}%`);
        }
    });
});

// ============================================================
// HIDE NAVBAR ON SCROLL DOWN / SHOW ON SCROLL UP
// ============================================================
(function initNavScroll() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    const scrollBar = document.getElementById('scroll-bar');

    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            // Update Scroll Progress
            if (scrollBar) {
                const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
                const progress = (window.scrollY / totalHeight) * 100;
                scrollBar.style.width = `${progress}%`;
            }

            // Don't hide if the hub overlay is open
            const overlay = document.getElementById('portfolio-overlay');
            if (overlay && overlay.classList.contains('active')) {
                ticking = false;
                return;
            }

            const currentScrollY = window.scrollY;

            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                // Scrolling DOWN — hide navbar
                nav.classList.add('nav-hidden');
            } else {
                // Scrolling UP — show navbar
                nav.classList.remove('nav-hidden');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        });
    }, { passive: true });
})();

// Project Filtering Logic
function initProjectFilters() {
    const filterBtns = document.querySelectorAll('.project-filters .filter-btn');
    const projectCards = document.querySelectorAll('.projects-grid .project-card:not(.cta-project-card)');

    if (!filterBtns.length) return;

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');

            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Filter logic
            projectCards.forEach(card => {
                const cat = card.getAttribute('data-cat');
                if (filter === 'all' || cat === filter) {
                    gsap.to(card, {
                        opacity: 1,
                        scale: 1,
                        display: 'block',
                        duration: 0.5,
                        ease: "power3.out"
                    });
                } else {
                    gsap.to(card, {
                        opacity: 0,
                        scale: 0.95,
                        display: 'none',
                        duration: 0.4,
                        ease: "power2.in"
                    });
                }
            });

            // Refresh ScrollTrigger after layout change
            setTimeout(() => {
                ScrollTrigger.refresh();
            }, 550);
        });
    });
}
initProjectFilters();

// Dynamic 3D Card Flipping Setup
function initProjectFlips() {
    const cards = document.querySelectorAll('.project-card:not(.cta-project-card)');
    cards.forEach((card, cardIndex) => {
        const inner = card.querySelector('.project-inner');
        if (!inner) return;

        const imgContainer = card.querySelector('.project-image-container');
        const overlay = card.querySelector('.project-overlay');
        if (!imgContainer || !overlay) return;

        const tags = overlay.querySelector('.tags');
        const num = overlay.querySelector('.project-num');
        const title = overlay.querySelector('h3');
        const desc = overlay.querySelector('p');
        const techSpans = tags ? Array.from(tags.querySelectorAll('span')) : [];

        // ── FRONT FACE ──────────────────────────────────────────
        const front = document.createElement('div');
        front.className = 'project-front';

        const imgClone = imgContainer.cloneNode(true);
        front.appendChild(imgClone);

        const frontOverlay = document.createElement('div');
        frontOverlay.className = 'project-overlay';
        if (tags) frontOverlay.appendChild(tags.cloneNode(true));
        if (num) frontOverlay.appendChild(num.cloneNode(true));
        if (title) frontOverlay.appendChild(title.cloneNode(true));

        // Tech count badge on front
        if (techSpans.length > 0) {
            const techBadge = document.createElement('div');
            techBadge.className = 'card-tech-count';
            techBadge.innerHTML = `<span class="tech-dot"></span>${techSpans.length} technologies`;
            frontOverlay.appendChild(techBadge);
        }

        front.appendChild(frontOverlay);

        // Flip hint on front
        const hintFront = document.createElement('div');
        hintFront.className = 'flip-hint';
        hintFront.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>Click to explore`;
        front.appendChild(hintFront);

        // ── BACK FACE ───────────────────────────────────────────
        const back = document.createElement('div');
        back.className = 'project-back';

        // Decorative dot-grid background
        const dotGrid = document.createElement('div');
        dotGrid.className = 'card-back-dotgrid';
        back.appendChild(dotGrid);

        // Glowing accent bar at top
        const accentBar = document.createElement('div');
        accentBar.className = 'card-back-accent';
        back.appendChild(accentBar);

        // Back content wrapper
        const backContent = document.createElement('div');
        backContent.className = 'project-back-content';

        // Project index label
        const indexLabel = document.createElement('div');
        indexLabel.className = 'card-back-index';
        indexLabel.textContent = num ? num.textContent : `0${cardIndex + 1}`;
        backContent.appendChild(indexLabel);

        // Title
        if (title) {
            const titleClone = title.cloneNode(true);
            backContent.appendChild(titleClone);
        }

        // Divider
        const divider = document.createElement('div');
        divider.className = 'card-back-divider';
        backContent.appendChild(divider);

        // Full description
        if (desc) {
            const descClone = desc.cloneNode(true);
            backContent.appendChild(descClone);
        }

        // Tech chip tags
        if (techSpans.length > 0) {
            const techSection = document.createElement('div');
            techSection.className = 'card-back-tech';
            const techLabel = document.createElement('span');
            techLabel.className = 'card-back-tech-label';
            techLabel.textContent = 'Stack';
            techSection.appendChild(techLabel);
            const chipRow = document.createElement('div');
            chipRow.className = 'card-back-chips';
            techSpans.forEach(s => {
                const chip = document.createElement('span');
                chip.className = 'card-back-chip';
                chip.textContent = s.textContent;
                chipRow.appendChild(chip);
            });
            techSection.appendChild(chipRow);
            backContent.appendChild(techSection);
        }

        // Project metadata (Role, Duration, Status, etc.)
        const role = card.getAttribute('data-role');
        const duration = card.getAttribute('data-duration');
        const status = card.getAttribute('data-status');
        const type = card.getAttribute('data-type');

        if (role || duration || status || type) {
            const metaContainer = document.createElement('div');
            metaContainer.className = 'card-back-metadata';

            if (role) {
                metaContainer.innerHTML += `<div><strong>Role:</strong> ${role}</div>`;
            }
            if (duration) {
                metaContainer.innerHTML += `<div><strong>Duration:</strong> ${duration}</div>`;
            }
            if (status) {
                metaContainer.innerHTML += `<div><strong>Status:</strong> ${status}</div>`;
            }
            if (type) {
                metaContainer.innerHTML += `<div><strong>Type:</strong> ${type}</div>`;
            }
            backContent.appendChild(metaContainer);
        }

        // Add watch video button if data-video is set (REMOVED: Play directly on card click)

        back.appendChild(backContent);

        // Flip back hint
        const hintBack = document.createElement('div');
        hintBack.className = 'flip-hint';
        hintBack.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/></svg>Click to close`;
        back.appendChild(hintBack);

        // ── REBUILD INNER ────────────────────────────────────────
        inner.innerHTML = '';
        inner.appendChild(front);
        inner.appendChild(back);
    });
}

// ============================================================
// SENIOR-LEVEL SECURITY HARDENING & "UNHACKABLE" VIBE
// ============================================================
(function securityShield() {
    // 1. Disable Right-Click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. Disable Keyboard Shortcuts for Inspect/Source
    document.addEventListener('keydown', e => {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && e.key === 'U')
        ) {
            e.preventDefault();
            console.warn('%cSECURITY ALERT: Unauthorized access attempt detected.', 'color: red; font-size: 16px; font-weight: bold;');
        }
    });

    // 3. Anti-Copy Protection
    document.addEventListener('copy', e => {
        e.preventDefault();
        console.log('%cCOPY PROTECTION: Content extraction is disabled.', 'color: #bc00dd; font-weight: bold;');
    });

    // 4. Senior Developer Console Message
    console.log(
        "%cJeet | Creative Engineer\n%cSystem secure. All assets protected by Jeet-Dev Core.\n%cInterested in how this works? Let's connect.",
        "color: #bc00dd; font-size: 24px; font-weight: bold;",
        "color: #888; font-size: 14px;",
        "color: #00ff00; font-size: 12px; font-style: italic;"
    );
})();

// ============================================================
// PREMIUM INTERACTIVE CURSOR (Senior Dev Polish)
// ============================================================
function initCustomCursor() {
    const cursor = document.createElement('div');
    const dot = document.createElement('div');
    cursor.className = 'custom-cursor';
    dot.className = 'cursor-dot';
    document.body.appendChild(cursor);
    document.body.appendChild(dot);

    // Dynamic Trail Dots
    const trailCount = 6;
    const trailDots = [];
    for (let i = 0; i < trailCount; i++) {
        const tDot = document.createElement('div');
        tDot.className = 'cursor-trail-dot';
        const size = 6 - (i * 0.7); // Taper sizes
        tDot.style.width = `${size}px`;
        tDot.style.height = `${size}px`;
        tDot.style.opacity = (1 - (i / trailCount)) * 0.55;
        document.body.appendChild(tDot);
        trailDots.push({
            el: tDot,
            x: 0,
            y: 0
        });
    }

    // Add Cursor Aura - Creative Flair (lerp-based, no per-frame tween spawning)
    const aura = document.createElement('div');
    aura.className = 'cursor-aura';
    document.body.appendChild(aura);

    // Center all cursor components perfectly using GSAP percent translations
    gsap.set([cursor, dot, aura, ...trailDots.map(d => d.el)], { xPercent: -50, yPercent: -50 });

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let auraX = 0, auraY = 0;

    // Force immediate activation
    document.body.classList.add('cursor-active');

    // Mobile check - Senior devs know not to show custom cursors on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.body.classList.remove('cursor-active');
        return;
    }

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Immediate dot movement
        gsap.set(dot, { x: mouseX, y: mouseY });
    });

    // Smooth trailing effect
    gsap.ticker.add(() => {
        const dt = 1.0 - Math.pow(1.0 - 0.15, gsap.ticker.deltaRatio());
        cursorX += (mouseX - cursorX) * dt;
        cursorY += (mouseY - cursorY) * dt;
        gsap.set(cursor, { x: cursorX, y: cursorY });

        const speed = 1.0 - Math.pow(1.0 - 0.08, gsap.ticker.deltaRatio());
        auraX += (mouseX - auraX) * speed;
        auraY += (mouseY - auraY) * speed;
        gsap.set(aura, { x: auraX, y: auraY });

        // Smooth chain lag trail dots
        let prevX = mouseX;
        let prevY = mouseY;
        trailDots.forEach((t, index) => {
            const ratio = 0.35 - (index * 0.04);
            const lerpRatio = 1.0 - Math.pow(1.0 - ratio, gsap.ticker.deltaRatio());
            t.x += (prevX - t.x) * lerpRatio;
            t.y += (prevY - t.y) * lerpRatio;
            gsap.set(t.el, { x: t.x, y: t.y });
            prevX = t.x;
            prevY = t.y;
        });
    });

    // Event Delegation: Premium consistency even for dynamically rendered elements
    const hoverSelector = '.project-card, .filter-btn, .pill-hotspot, .social-pill, .btn, .pill-nav-link, .pill-nav-logo-link, .contact-email-link, .hub-back-btn, .skill-step-badge, a, button, [role="button"]';

    document.body.addEventListener('mouseover', e => {
        const target = e.target.closest(hoverSelector);
        if (target) {
            cursor.classList.add('hover');
            dot.classList.add('hover');
            aura.classList.add('hover');
        }
    });

    document.body.addEventListener('mouseout', e => {
        const target = e.target.closest(hoverSelector);
        if (target) {
            const related = e.relatedTarget;
            if (!related || !target.contains(related)) {
                cursor.classList.remove('hover');
                dot.classList.remove('hover');
                aura.classList.remove('hover');
            }
        }
    });
}
initCustomCursor();

// --- SMOOTH PAGE ENTRANCE ---
window.addEventListener('load', () => {
    // Staggered entrance: fade body in, then animate key elements
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to('body', {
        opacity: 1,
        duration: 0.6,
    })
        .from('.pill-nav-container', {
            y: -30,
            opacity: 0,
            duration: 0.7,
            clearProps: 'all'
        }, '-=0.2')
        .from('.hero-content h1', {
            y: 40,
            opacity: 0,
            duration: 0.9,
            clearProps: 'all'
        }, '-=0.4')
        .from('.hero-content p', {
            y: 30,
            opacity: 0,
            duration: 0.8,
            clearProps: 'all'
        }, '-=0.6')
        .from('.hero-scroll-cta', {
            y: 20,
            opacity: 0,
            duration: 0.7,
            clearProps: 'all'
        }, '-=0.5')
        .from('.hero-identity-bar', {
            y: 20,
            opacity: 0,
            duration: 0.7,
            clearProps: 'all'
        }, '-=0.5');
});


// ── Smooth Magnification Dock ──
(function () {
    const dock = document.getElementById('heroDock');
    if (!dock) return;

    const items = dock.querySelectorAll('.dock-item');

    const maxDist = 100;
    const maxScale = 1.8;

    let mouseX = 0;
    let raf = null;

    // smoother transitions
    items.forEach(item => {
        item.style.transition =
            'width 0.22s cubic-bezier(0.25, 1, 0.5, 1), height 0.22s cubic-bezier(0.25, 1, 0.5, 1)';

        const svg = item.querySelector('svg');
        if (svg) {
            svg.style.transition =
                'width 0.22s cubic-bezier(0.25, 1, 0.5, 1), height 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
        }
    });

    function updateDock() {
        items.forEach(item => {
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const dist = Math.abs(mouseX - centerX);

            if (dist < maxDist) {

                // smoother curve
                const influence = 1 - dist / maxDist;
                const scale =
                    1 +
                    (maxScale - 1) *
                    Math.pow(influence, 2.5);

                const size = 44 * scale;
                const iconSize = 18 * scale;

                item.style.width = `${size}px`;
                item.style.height = `${size}px`;

                const svg = item.querySelector('svg');
                if (svg) {
                    svg.style.width = `${iconSize}px`;
                    svg.style.height = `${iconSize}px`;
                }

            } else {
                item.style.width = '44px';
                item.style.height = '44px';

                const svg = item.querySelector('svg');
                if (svg) {
                    svg.style.width = '18px';
                    svg.style.height = '18px';
                }
            }
        });

        raf = null;
    }

    dock.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;

        if (!raf) {
            raf = requestAnimationFrame(updateDock);
        }
    });

    dock.addEventListener('mouseleave', () => {
        items.forEach(item => {
            item.style.width = '44px';
            item.style.height = '44px';

            const svg = item.querySelector('svg');
            if (svg) {
                svg.style.width = '18px';
                svg.style.height = '18px';
            }
        });
    });
})();