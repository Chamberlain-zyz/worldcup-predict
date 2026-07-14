/* ==========================================================================
   engine.js - 比赛动画引擎（所有页面共享）
   物理 / 点球大战 / canvas 渲染 / 主循环 / 比赛流程
   通过 TEAM 适配器调用页面特定的球队渲染（队徽色块 or 国旗图片）

   用法：页面先定义全局 TEAM 适配器，再调用 initEngine(TEAM, opts)
   TEAM = {
     all,                         // 球队池数组（随机抽队用）
     name(t),                     // 显示名（记分牌 / 预览 / 点球条）
     titleName(t),                // 标题名（结果卡胜者行；世界杯带 emoji 国旗）
     badge(t, size, cls),         // 小徽章 HTML（记分牌 / 积分榜 / 预览）
     bigBadge(t),                 // 大徽章 HTML（结果卡）
     pensMark(t),                 // 点球条前缀标记 HTML
     drawOnCanvas(ctx, ball, R),  // canvas 内画球身份（已裁剪到圆内、已旋转）
   }
   opts = { onClearSelection, resetOverlay, allowExtra, allowPens }
     onClearSelection()           // 随机开局 / 比赛结束时清选队高亮（联赛用）
     resetOverlay                  // {title, body, btn} 清空预览时还原的遮罩（联赛取消选队用）
     allowExtra (默认 true)        // 90 平局是否进入加时；联赛设 false（平局各 1 分）
     allowPens  (默认 true)        // 120 平局是否进入点球大战；联赛设 false
   ========================================================================== */
window.initEngine = function(TEAM, opts){
  "use strict";
  opts = opts || {};
  const onClearSelection = opts.onClearSelection || function(){};
  const resetOverlay = opts.resetOverlay || null;

  // ---------- DOM ----------
  const canvas = document.getElementById("pitch");
  const ctx = canvas.getContext("2d");
  // 高清渲染：实际像素 1080×1080（录屏/截图更清晰），逻辑坐标保持 640（所有现有计算不变）
  // 注意：给 canvas.width/height 赋值会重置 context 状态，所以先设尺寸再 scale
  const LOGICAL = 640;
  canvas.width = 1080;
  canvas.height = 1080;
  ctx.scale(1080 / LOGICAL, 1080 / LOGICAL);
  const elFlagA=document.getElementById("flagA"), elNameA=document.getElementById("nameA"), elScoreA=document.getElementById("scoreA");
  const elFlagB=document.getElementById("flagB"), elNameB=document.getElementById("nameB"), elScoreB=document.getElementById("scoreB");
  const elClock=document.getElementById("clockMin"), elBar=document.getElementById("progressBar"),
        elClockMax=document.getElementById("clockMax"), elExtraTag=document.getElementById("extraTag");
  const elOverlay=document.getElementById("overlay"), elOverlayTitle=document.getElementById("overlayTitle"), elOverlayBody=document.getElementById("overlayBody");
  const elStartBtn=document.getElementById("startBtn");
  const elFlash=document.getElementById("goalFlash");
  const elPensBar=document.getElementById("pensBar"),
        elPensRowA=document.getElementById("pensRowA"), elPensRowB=document.getElementById("pensRowB");

  // ---------- 几何 ----------
  const W = LOGICAL, H = LOGICAL;
  const CX = W/2, CY = H/2;
  const R = 290;
  const BALL_R = 38;
  const GOAL_SPAN = 0.32;

  // ---------- 配置 / 常量 ----------
  const ALLOW_EXTRA = opts.allowExtra !== false;
  const ALLOW_PENS = opts.allowPens !== false;
  const FORCE_EXTRA = false;
  const FORCE_PENS = false;
  const T_REG = 60, T_EXTRA = 20, P_ACCEL = 1;
  const KICKOFF_PAUSE = 1.0;
  const TARGET_SP = 480;

  // ---------- 球队实力差异（速度差异）----------
  // 引擎经 TEAM.rating(t) 读取球队实力评分：
  //   联赛页 = 当前赛季积分 pts（+ 净胜球 gf-ga 微调）；欧冠页 = 联赛阶段积分；世界杯页无数据。
  // 两队 rating 不存在或相等 -> 两队速率都 = BASE，退回原始 50/50（与原引擎完全一致）。
  // 否则把 rating 差经 Elo logistic 映射成强队“进球份额” sAp，再按不对称度换算成两球目标速率：
  //   强队球更快 -> 单位时间飞更长 -> 更频繁撞墙（进球判定）-> 进球更多；弱队球慢、仍偶胜。
  // 只改速率、不改方向、不改进球判定，无“突然变向”，观感物理直觉。速率关于 BASE 对称，平均节奏不变。
  const BASE = 480;           // 基础速率（= TARGET_SP）。势均力敌时两队都用此速率
  const RATING_D  = 40;        // Elo 分母：越大越接近 50/50，越小差距拉得越开（主手感旋钮）
  const UPSET     = 0.30;     // 冷门旋钮(0~1)：把强队份额往 0.5 拉，保留爆冷空间
  const SPREAD    = 192;      // 最大速率差幅度：强队 BASE+SPREAD、弱队 BASE-SPREAD（±40%，差距明显但弱队不致过慢）
  const PEN_RATING_AMP = 0.15; // 点球命中率按实力份额浮动幅度（次要，常规时间速率差优先）

  const PEN_GOAL_P = 0.72,
        PEN_GC = -Math.PI/2,
        PEN_PREP = 0.5,
        PEN_FLIGHT = 0.85,
        PEN_RESOLVE = 0.9,
        PEN_GAP = 0.6;

  // ---------- 状态 ----------
  let state = null;
  let rafId = null;
  let lastT = 0;
  let pending = null;       // 已选定但尚未开战的双方 [tA, tB]

  // ---------- 工具 ----------
  function polar(r,a){return {x:Math.cos(a)*r, y:Math.sin(a)*r};}
  function lerp(a,b,t){return a+(b-a)*t;}
  function normAngle(a){
    while(a>Math.PI) a-=2*Math.PI;
    while(a<-Math.PI) a+=2*Math.PI;
    return a;
  }
  function accel(min0, min1, k){ return min0 + (min1-min0)*Math.pow(k, P_ACCEL); }

  function pickTwo(){
    const pool = TEAM.all.slice();
    const i = Math.floor(Math.random()*pool.length);
    const a = pool.splice(i,1)[0];
    const j = Math.floor(Math.random()*pool.length);
    const b = pool.splice(j,1)[0];
    return [a,b];
  }

  // 计算两队实力份额与目标速率。无 rating / rating 缺失 / 两队相等 -> [BASE, BASE]（50/50）。
  // sAp 为 tA 的“进球份额”（0~1，0.5=势均力敌）。速率按不对称度连续映射：
  //   势均力敌(asym=0) -> 两队速率皆 BASE（与原始 50/50 完全一致，视觉无变化）；
  //   越悬殊 -> 强队趋向 BASE+SPREAD、弱队趋向 BASE-SPREAD。
  function computeStrength(tA, tB){
    if(typeof TEAM.rating !== "function") return {sAp:0.5, speeds:[BASE, BASE]};
    let Ra, Rb;
    try { Ra = TEAM.rating(tA); Rb = TEAM.rating(tB); }
    catch(e){ return {sAp:0.5, speeds:[BASE, BASE]}; }
    if(!isFinite(Ra) || !isFinite(Rb) || Ra === Rb) return {sAp:0.5, speeds:[BASE, BASE]};
    const sA = 1 / (1 + Math.pow(10, -(Ra - Rb)/RATING_D));   // Elo logistic：tA 进球份额
    const sAp = lerp(sA, 0.5, UPSET);                          // 冷门旋钮：往 0.5 拉
    const sBp = 1 - sAp;
    const asym = Math.abs(sAp - 0.5) * 2;                       // 0=势均力敌 1=最悬殊
    const spStrong = BASE + SPREAD * asym;
    const spWeak   = BASE - SPREAD * asym;
    const spA = sAp >= sBp ? spStrong : spWeak;
    const spB = sAp >= sBp ? spWeak : spStrong;
    return {sAp:sAp, speeds:[spA, spB]};
  }

  function makeBall(ref, angleStart, isHome){
    const pos = polar(R*0.55, angleStart);
    const speed = BASE;
    const dir = angleStart + Math.PI + (Math.random()-0.5)*1.2;
    return {
      ref: ref,                 // 球队对象引用（CLUBS 项 or 国家数组）
      color: isHome ? "#ff5a5a" : "#4aa3ff",
      x: CX + pos.x, y: CY + pos.y,
      vx: Math.cos(dir)*speed,
      vy: Math.sin(dir)*speed,
      sp: BASE,                 // 该球目标速率：由 newMatch 按球队实力份额赋值（BASE=无偏置 50/50）
      spin: 0,
      spinV: (Math.random()-0.5)*4,
      score: 0
    };
  }

  // tA/tB 可选，不传则随机抽两队
  function newMatch(tA, tB){
    if(!tA || !tB){ const [a,b]=pickTwo(); tA=a; tB=b; }
    const goalCenter = -Math.PI/2;
    const balls = [
      makeBall(tA, Math.random()*Math.PI*2, true),
      makeBall(tB, Math.random()*Math.PI*2, false)
    ];
    const strength = computeStrength(tA, tB);
    balls[0].sp = strength.speeds[0];   // tA（主队/红）目标速率
    balls[1].sp = strength.speeds[1];   // tB（客队/蓝）目标速率
    return {
      teams:[tA,tB],
      balls:balls,
      strength: strength,       // 供点球阶段按份额微调命中率
      goalCenter: goalCenter,
      goalFlash:0,
      scoreA:0, scoreB:0,
      started:false,
      finished:false,
      realStart:0,
      realDuration:60,
      extra:false,
      extraStart:0,
      matchMin:0,
      prevMin:0,
      freezeUntil:0,
      freezeStart:0,
      freezeMin:0,
      pendingKickoff:null,
      rot:0
    };
  }

  function resetBallsToCenter(randomize){
    const balls = state.balls;
    const off = BALL_R + 6;
    const baseAng = Math.random()*Math.PI*2;
    for(let i=0;i<balls.length;i++){
      const s = i===0 ? -1 : 1;
      let outDir;
      if(randomize){
        const ang = baseAng + (s<0 ? 0 : Math.PI);
        balls[i].x = CX + Math.cos(ang)*off;
        balls[i].y = CY + Math.sin(ang)*off;
        outDir = ang + (Math.random()-0.5)*0.8;
      } else {
        balls[i].x = CX + s*off;
        balls[i].y = CY;
        outDir = (s<0 ? Math.PI : 0) + (Math.random()-0.5)*0.8;
      }
      balls[i].vx = Math.cos(outDir)*balls[i].sp;
      balls[i].vy = Math.sin(outDir)*balls[i].sp;
      balls[i].spin = 0;
      balls[i].spinV = (Math.random()-0.5)*4;
    }
  }

  function kickoffPause(min, resetRot){
    resetBallsToCenter(!resetRot);
    if(resetRot) state.rot = 0;
    state.matchMin = min;
    state.freezeMin = min;
    const now = performance.now()/1000;
    state.freezeStart = now;
    state.freezeUntil = now + KICKOFF_PAUSE;
  }

  function applyUI(st){
    const [tA,tB]=st.teams;
    if(tA && tB){
      elFlagA.innerHTML=TEAM.badge(tA, 42, "badge-dom");
      elNameA.textContent=TEAM.name(tA);
      elScoreA.textContent=st.scoreA;
      elFlagB.innerHTML=TEAM.badge(tB, 42, "badge-dom");
      elNameB.textContent=TEAM.name(tB);
      elScoreB.textContent=st.scoreB;
    }
  }

  // ---------- 物理更新 ----------
  function step(dt){
    if(!state || !state.started || state.finished) return;
    if(state.pens){ stepPens(dt); return; }

    const now = performance.now()/1000;

    if(state.freezeUntil){
      if(now < state.freezeUntil){
        state.matchMin = state.freezeMin;
        return;
      }
      const dur = now - state.freezeStart;
      state.realStart += dur;
      if(state.extra) state.extraStart += dur;
      state.freezeUntil = 0;
    }

    if(!state.extra){
      let t = now - state.realStart;
      if(t >= T_REG){
        t = T_REG;
        state.matchMin = 90;
        if(FORCE_PENS){
          enterPens();
          return;
        } else if(FORCE_EXTRA){
          state.extra = true;
          state.extraStart = now;
          kickoffPause(90, true);
          state.prevMin = 90;
          return;
        } else if(state.scoreA === state.scoreB && ALLOW_EXTRA){
          state.extra = true;
          state.extraStart = now;
          kickoffPause(90, true);
          state.prevMin = 90;
          return;
        } else {
          state.finished = true;
        }
      } else {
        state.matchMin = accel(0, 90, t/T_REG);
      }
    } else {
      let te = now - state.extraStart;
      if(te >= T_EXTRA){
        te = T_EXTRA;
        state.matchMin = 120;
        if(FORCE_PENS){
          enterPens();
          return;
        } else if(state.scoreA === state.scoreB && ALLOW_PENS){
          enterPens();
          return;
        } else {
          state.finished = true;
        }
      } else {
        state.matchMin = accel(90, 120, te/T_EXTRA);
      }
    }

    if(state.pendingKickoff != null){
      kickoffPause(state.pendingKickoff);
      state.pendingKickoff = null;
      return;
    }
    if(!state.extra){
      if(state.prevMin < 45 && state.matchMin >= 45){
        kickoffPause(45, true);
        flashMsg("下半场", KICKOFF_PAUSE*1000);
        state.prevMin = 45;
        return;
      }
    } else {
      if(state.prevMin < 105 && state.matchMin >= 105){
        kickoffPause(105, true);
        state.prevMin = 105;
        return;
      }
    }

    const balls = state.balls;
    const sub = 4;
    const h = dt/sub;
    for(let s=0;s<sub;s++){
      integrate(h);
      wallAndGoal();
      ballBall();
    }

    for(const b of balls){ b.spin += b.spinV*dt; }
    if(state.goalFlash>0) state.goalFlash -= dt;

    state.rot += dt * 0.35;
    state.prevMin = state.matchMin;
  }

  function integrate(h){
    for(const b of state.balls){
      b.x += b.vx*h;
      b.y += b.vy*h;
      const sp = Math.hypot(b.vx,b.vy) || 1;
      // 归一化到该球的目标速率 b.sp（强队快、弱队慢，体现实力差异；只改速率不改方向）
      b.vx = b.vx/sp*b.sp;
      b.vy = b.vy/sp*b.sp;
    }
  }

  function wallAndGoal(){
    const gc = state.goalCenter + state.rot;
    const g0 = gc - GOAL_SPAN/2, g1 = gc + GOAL_SPAN/2;
    const posts = [
      {x: CX+Math.cos(g0)*R, y: CY+Math.sin(g0)*R},
      {x: CX+Math.cos(g1)*R, y: CY+Math.sin(g1)*R}
    ];
    const maxDist = R - BALL_R;

    for(const b of state.balls){
      let hitPost = false;
      for(const p of posts){
        const px=b.x-p.x, py=b.y-p.y;
        const pd=Math.hypot(px,py);
        if(pd <= BALL_R && pd > 0.0001){
          const nx=px/pd, ny=py/pd;
          const dot=b.vx*nx + b.vy*ny;
          if(dot < 0){
            b.vx -= 2*dot*nx;
            b.vy -= 2*dot*ny;
          }
          b.x = p.x + nx*BALL_R;
          b.y = p.y + ny*BALL_R;
          b.spinV = (Math.random()-0.5)*8;
          hitPost = true;
        }
      }
      if(hitPost) continue;

      const dx=b.x-CX, dy=b.y-CY;
      const dist=Math.hypot(dx,dy);
      if(dist < maxDist) continue;

      const ang = Math.atan2(dy,dx);
      let diff = normAngle(ang - gc);
      const inGoal = Math.abs(diff) <= GOAL_SPAN/2;

      if(inGoal){
        if(dist >= R){
          scoreGoal(b);
          b.x = CX + Math.cos(ang)*maxDist*0.35;
          b.y = CY + Math.sin(ang)*maxDist*0.35;
          const sp = b.sp;   // 进球后反弹保持该球目标速率（实力差异不因进球而丢失）
          b.vx = -Math.cos(ang)*sp;
          b.vy = -Math.sin(ang)*sp;
        }
      } else {
        const nx=dx/dist, ny=dy/dist;
        const dot = b.vx*nx + b.vy*ny;
        b.vx -= 2*dot*nx;
        b.vy -= 2*dot*ny;
        b.x = CX + nx*maxDist;
        b.y = CY + ny*maxDist;
        const jitter = (Math.random()-0.5)*0.5;
        const cs=Math.cos(jitter), sn=Math.sin(jitter);
        const nvx=b.vx*cs - b.vy*sn, nvy=b.vx*sn + b.vy*cs;
        b.vx=nvx; b.vy=nvy;
        b.spinV = (Math.random()-0.5)*6;
      }
    }
  }

  function ballBall(){
    const a=state.balls[0], b=state.balls[1];
    const dx=b.x-a.x, dy=b.y-a.y;
    const dist=Math.hypot(dx,dy);
    const minD = BALL_R*2;
    if(dist>0 && dist<minD){
      const nx=dx/dist, ny=dy/dist;
      const overlap = minD - dist;
      a.x -= nx*overlap/2; a.y -= ny*overlap/2;
      b.x += nx*overlap/2; b.y += ny*overlap/2;
      const dvx=b.vx-a.vx, dvy=b.vy-a.vy;
      const dot=dvx*nx + dvy*ny;
      if(dot<0){
        a.vx += dot*nx; a.vy += dot*ny;
        b.vx -= dot*nx; b.vy -= dot*ny;
        const j=(Math.random()-0.5)*0.6;
        const cs=Math.cos(j), sn=Math.sin(j);
        [a,b].forEach(o=>{
          const nvx=o.vx*cs - o.vy*sn, nvy=o.vx*sn + o.vy*cs;
          o.vx=nvx; o.vy=nvy; o.spinV=(Math.random()-0.5)*8;
        });
        const boost=1.04;
        a.vx*=boost; a.vy*=boost; b.vx*=boost; b.vy*=boost;
      }
    }
  }

  function scoreGoal(b){
    b.score++;
    if(b===state.balls[0]) state.scoreA=b.score;
    else state.scoreB=b.score;
    state.goalFlash = 0.8;
    applyUI(state);
    elFlash.innerHTML = `GOAL!<span class="gname">${TEAM.name(b.ref)}</span>`;
    elFlash.classList.add("show");
    clearTimeout(state._flashTimer);
    state._flashTimer = setTimeout(()=>elFlash.classList.remove("show"), 900);
    state.pendingKickoff = state.matchMin;
  }

  function flashMsg(text, dur){
    elFlash.textContent = text;
    elFlash.classList.add("show");
    clearTimeout(state._flashTimer);
    state._flashTimer = setTimeout(()=>elFlash.classList.remove("show"), dur||900);
  }

  // ==================== 点球大战 ====================
  function enterPens(){
    state.goalCenter = PEN_GC - state.rot;
    state.pens = {
      phase:"prep", t:0,
      firstKicker: Math.random()<0.5?0:1,
      penA:0, penB:0,
      kicksA:[], kicksB:[],
      kicker:0, outcome:null, made:false, ballCorner:1,
      ballStartX:CX, ballStartY:CY, ballX:CX, ballY:CY,
      ballTargetX:CX, ballTargetY:CY,
      resolveSX:CX, resolveSY:CY, resolveTX:CX, resolveTY:CY,
      keeperAngle:PEN_GC, keeperDive:PEN_GC,
      ballSpin:0, ended:false, winner:null
    };
    setupKick();
    elPensBar.style.display="flex";
    renderPensBar();
    applyPensScoreboard();
  }

  function setupKick(){
    const p=state.pens;
    p.kicker = (p.kicksA.length === p.kicksB.length) ? p.firstKicker : (1 - p.firstKicker);
    // 点球命中率按实力份额微调（次要）：强队略高、弱队略低，以 PEN_GOAL_P 为中心浮动
    const sAp = (state.strength && isFinite(state.strength.sAp)) ? state.strength.sAp : 0.5;
    const share = p.kicker===0 ? sAp : (1 - sAp);
    const penP = Math.max(0.5, Math.min(0.9, PEN_GOAL_P + PEN_RATING_AMP*(share - 0.5)));
    p.made = Math.random() < penP;
    if(p.made) p.outcome="goal";
    else { const r=Math.random(); p.outcome = r<0.6?"save":(r<0.8?"post":"wide"); }
    p.ballCorner = Math.random()<0.5?-1:1;
    const half = GOAL_SPAN/2;
    const cornerAng = PEN_GC + p.ballCorner * half * 0.75;
    const kSign = (p.outcome==="save") ? p.ballCorner : -p.ballCorner;
    p.keeperDive = PEN_GC + kSign * half * 0.7;
    p.keeperAngle = PEN_GC;
    let tang, trad;
    if(p.outcome==="goal"){ tang=cornerAng; trad=R-6; }
    else if(p.outcome==="save"){ tang=cornerAng; trad=R-16; }
    else if(p.outcome==="post"){ tang=PEN_GC + p.ballCorner*half; trad=R-4; }
    else { tang=PEN_GC + p.ballCorner*(half+0.20); trad=R-2; }
    p.ballTargetX = CX + Math.cos(tang)*trad;
    p.ballTargetY = CY + Math.sin(tang)*trad;
    p.ballStartX=CX; p.ballStartY=CY;
    p.ballX=CX; p.ballY=CY; p.ballSpin=0;
    p.phase="prep"; p.t=0;
    renderPensBar();
  }

  function resolveKick(){
    const p=state.pens, team=p.kicker;
    if(team===0) p.kicksA.push(p.made); else p.kicksB.push(p.made);
    if(p.made){ if(team===0) p.penA++; else p.penB++; }
    if(p.made){
      elFlash.innerHTML = `GOAL!<span class="gname">${TEAM.name(state.teams[team])}</span>`;
      elFlash.classList.add("show");
      clearTimeout(state._flashTimer);
      state._flashTimer = setTimeout(()=>elFlash.classList.remove("show"), 900);
      state.goalFlash=0.8;
    }
    else if(p.outcome==="save") flashMsg("SAVE!");
    else if(p.outcome==="post") flashMsg("中柱!");
    else flashMsg("MISS!");
    if(p.made){
      const a=Math.atan2(p.ballTargetY-CY, p.ballTargetX-CX);
      p.resolveTX=CX+Math.cos(a)*(R+12); p.resolveTY=CY+Math.sin(a)*(R+12);
    } else if(p.outcome==="save"){
      p.resolveTX=CX; p.resolveTY=CY;
    } else if(p.outcome==="post"){
      p.resolveTX=p.ballTargetX + (p.ballCorner>0?34:-34); p.resolveTY=p.ballTargetY+24;
    } else {
      const a=Math.atan2(p.ballTargetY-CY, p.ballTargetX-CX);
      p.resolveTX=CX+Math.cos(a)*(R+24); p.resolveTY=CY+Math.sin(a)*(R+24);
    }
    p.resolveSX=p.ballX; p.resolveSY=p.ballY;
    renderPensBar();
    applyPensScoreboard();
  }

  function checkPensEnd(){
    const p=state.pens;
    const ka=p.kicksA.length, kb=p.kicksB.length;
    if(ka<=5 && kb<=5){
      const remA=5-ka, remB=5-kb;
      if(p.penA > p.penB + remB) return 0;
      if(p.penB > p.penA + remA) return 1;
      if(ka===5 && kb===5 && p.penA!==p.penB) return p.penA>p.penB?0:1;
      return null;
    }
    if(ka===kb && p.penA!==p.penB) return p.penA>p.penB?0:1;
    return null;
  }

  function finishPens(winner){
    state.pens.ended=true;
    state.pens.winner=winner;
    state.finished=true;
    renderPensBar();
    applyPensScoreboard();
  }

  function stepPens(dt){
    const p=state.pens;
    p.t += dt;
    p.ballSpin += dt*10;
    if(p.phase==="prep"){
      p.ballX=CX; p.ballY=CY; p.keeperAngle=PEN_GC;
      if(p.t>=PEN_PREP){ p.phase="flight"; p.t=0; }
    } else if(p.phase==="flight"){
      const k=Math.min(1, p.t/PEN_FLIGHT), e=k*k;
      p.ballX=lerp(p.ballStartX, p.ballTargetX, e);
      p.ballY=lerp(p.ballStartY, p.ballTargetY, e);
      p.keeperAngle=lerp(PEN_GC, p.keeperDive, k);
      if(k>=1){ p.phase="resolve"; p.t=0; resolveKick(); }
    } else if(p.phase==="resolve"){
      const k=Math.min(1, p.t/PEN_RESOLVE);
      p.ballX=lerp(p.resolveSX, p.resolveTX, k);
      p.ballY=lerp(p.resolveSY, p.resolveTY, k);
      if(state.goalFlash>0) state.goalFlash-=dt;
      if(p.t>=PEN_RESOLVE){ p.phase="gap"; p.t=0; }
    } else if(p.phase==="gap"){
      if(p.t>=PEN_GAP){
        const w=checkPensEnd();
        if(w!==null){ finishPens(w); return; }
        setupKick();
      }
    }
    const kb=state.balls[p.kicker];
    kb.x=p.ballX; kb.y=p.ballY; kb.spin=p.ballSpin;
  }

  function applyPensScoreboard(){
    if(!state.pens) return;
    elScoreA.textContent=`${state.scoreA}(${state.pens.penA})`;
    elScoreB.textContent=`${state.scoreB}(${state.pens.penB})`;
  }

  function renderPensBar(){
    if(!state.pens) return;
    const p=state.pens;
    const rows=[
      {el:elPensRowA, kicks:p.kicksA, tot:p.penA, t:state.teams[0], idx:0},
      {el:elPensRowB, kicks:p.kicksB, tot:p.penB, t:state.teams[1], idx:1}
    ];
    rows.forEach(r=>{
      const slots=r.kicks.map(m=>`<span class="pens-slot ${m?"make":"miss"}">${m?"✓":"✗"}</span>`).join("");
      const pending = (r.idx===p.kicker && !p.ended && (p.phase==="prep"||p.phase==="flight"))
        ? `<span class="pens-slot now">·</span>` : "";
      r.el.innerHTML =
        `${TEAM.pensMark(r.t)}<span class="pname">${TEAM.name(r.t)}</span>`+
        `<span class="pens-slots">${slots}${pending}</span><span class="pens-tot" style="font-weight:800;color:var(--gold);min-width:18px;text-align:right">${r.tot}</span>`;
    });
  }

  function drawKeeper(){
    const p=state.pens, rad=R-14, a=p.keeperAngle;
    ctx.save();
    ctx.translate(CX+Math.cos(a)*rad, CY+Math.sin(a)*rad);
    ctx.rotate(a+Math.PI/2);
    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.strokeStyle="#ffd34d"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.rect(-26,-6,52,12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-12,7,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ---------- 渲染 ----------
  function draw(){
    ctx.clearRect(0,0,W,H);

    const bg = ctx.createRadialGradient(CX,CY,40,CX,CY,R+30);
    bg.addColorStop(0,"#13763c");
    bg.addColorStop(1,"#06381c");
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.arc(CX,CY,R+18,0,Math.PI*2); ctx.fill();

    ctx.save();
    ctx.translate(CX,CY);
    ctx.rotate(state.rot);
    ctx.translate(-CX,-CY);

    ctx.save();
    ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.clip();
    ctx.globalAlpha=0.12;
    for(let i=-R;i<R;i+=36){
      ctx.fillStyle = (i/36)%2===0 ? "#ffffff" : "#000000";
      ctx.fillRect(CX-R, CY+i, R*2, 18);
    }
    ctx.restore();

    ctx.lineWidth=4; ctx.strokeStyle="rgba(255,255,255,.85)";
    ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.stroke();

    ctx.globalAlpha=.5; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(CX,CY,60,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CX-R,CY); ctx.lineTo(CX+R,CY); ctx.stroke();
    ctx.globalAlpha=1;

    ctx.restore();

    ctx.fillStyle="rgba(255,255,255,.85)";
    ctx.beginPath(); ctx.arc(CX,CY,4,0,Math.PI*2); ctx.fill();

    drawGoal(state.goalCenter + state.rot);

    if(state.pens){
      drawKeeper();
      drawBall(state.balls[state.pens.kicker]);
    } else {
      for(const b of state.balls) drawBall(b);
    }
  }

  function drawGoal(gc){
    const g0 = gc - GOAL_SPAN/2, g1 = gc + GOAL_SPAN/2;
    ctx.save();
    ctx.translate(CX,CY);
    ctx.rotate(gc);
    const depth = 26;
    ctx.fillStyle="rgba(255,255,255,.10)";
    ctx.beginPath();
    ctx.moveTo(Math.cos(-GOAL_SPAN/2)*R, Math.sin(-GOAL_SPAN/2)*R);
    ctx.arc(0,0,R,-GOAL_SPAN/2, GOAL_SPAN/2);
    ctx.lineTo(Math.cos(GOAL_SPAN/2)*(R-depth), Math.sin(GOAL_SPAN/2)*(R-depth));
    ctx.arc(0,0,R-depth, GOAL_SPAN/2, -GOAL_SPAN/2, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=1;
    for(let i=1;i<5;i++){
      const r = R - depth*i/5;
      ctx.beginPath(); ctx.arc(0,0,r,-GOAL_SPAN/2,GOAL_SPAN/2); ctx.stroke();
    }
    for(let i=1;i<6;i++){
      const a = -GOAL_SPAN/2 + GOAL_SPAN*i/6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*R, Math.sin(a)*R);
      ctx.lineTo(Math.cos(a)*(R-depth), Math.sin(a)*(R-depth));
      ctx.stroke();
    }
    ctx.restore();

    const flash = state.goalFlash>0;
    ctx.strokeStyle = flash ? "#ffd34d" : "#ffffff";
    ctx.lineWidth = flash ? 8 : 6;
    ctx.shadowColor = flash ? "#ffd34d" : "rgba(0,0,0,0.6)";
    ctx.shadowBlur = flash ? 24 : 6;
    ctx.beginPath();
    ctx.arc(CX,CY,R,g0,g1);
    ctx.stroke();
    ctx.shadowBlur=0;

    const postR = 7;
    const postOut = 14;
    [g0, g1].forEach(a=>{
      const ix = CX + Math.cos(a)*R,          iy = CY + Math.sin(a)*R;
      const ox = CX + Math.cos(a)*(R+postOut), oy = CY + Math.sin(a)*(R+postOut);
      ctx.strokeStyle = flash ? "#ffd34d" : "#ffffff";
      ctx.lineCap = "round";
      ctx.lineWidth = postR*2;
      ctx.shadowColor = flash ? "#ffd34d" : "rgba(0,0,0,0.6)";
      ctx.shadowBlur = flash ? 24 : 6;
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ox, oy);
      ctx.stroke();
    });
    ctx.shadowBlur=0;
    ctx.lineCap="butt";
  }

  function drawBall(b){
    ctx.save();
    ctx.translate(b.x,b.y);
    // 阴影
    ctx.fillStyle="rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(2,4,BALL_R,BALL_R*0.92,0,0,Math.PI*2); ctx.fill();

    // 球体（用队伍主色渐变）
    const g = ctx.createRadialGradient(-8,-8,4,0,0,BALL_R);
    g.addColorStop(0,"#ffffff"); g.addColorStop(1,b.color);
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(0,0,BALL_R,0,Math.PI*2); ctx.fill();

    // 旋转的球队身份（圆内裁剪 + 适配器绘制：队徽色块 / 国旗图）
    ctx.save();
    ctx.rotate(b.spin);
    ctx.beginPath(); ctx.arc(0,0,BALL_R-4,0,Math.PI*2); ctx.clip();
    TEAM.drawOnCanvas(ctx, b, BALL_R);
    ctx.restore();

    // 边框
    ctx.lineWidth=2; ctx.strokeStyle="rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.arc(0,0,BALL_R,0,Math.PI*2); ctx.stroke();
    // 高光
    ctx.fillStyle="rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.ellipse(-9,-10,8,5,-0.6,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ---------- 主循环 ----------
  function loop(ts){
    if(!lastT) lastT=ts;
    let dt=(ts-lastT)/1000; lastT=ts;
    if(dt>0.05) dt=0.05;

    step(dt);
    draw();
    updateClock();

    if(state && state.finished){
      finishMatch();
      return;
    }
    rafId=requestAnimationFrame(loop);
  }

  function updateClock(){
    if(!state) return;
    if(state.pens){
      elClock.textContent = "点球";
      elClockMax.textContent = "大战";
      elExtraTag.textContent = "";
      elBar.style.width = "100%";
      return;
    }
    const m=Math.floor(state.matchMin);
    elClock.textContent = m + "'";
    const maxMin = state.extra ? 120 : 90;
    elClockMax.textContent = "/ " + maxMin + "'";
    elExtraTag.textContent = state.extra ? "加时" : "";
    const denom = state.extra ? 120 : 90;
    elBar.style.width = (state.matchMin/denom*100).toFixed(1)+"%";
  }

  // ---------- 终场彩带（结果卡庆祝效果）----------
  function clearConfetti(){
    const old = elOverlay.querySelector(".confetti-layer");
    if(old) old.remove();
  }
  function spawnConfetti(){
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    const colors = ["#ffd34d","#ff5a5a","#4aa3ff","#3ddb6a","#ff8a4a","#ffffff"];
    for(let i=0;i<44;i++){
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.left = Math.random()*100 + "%";
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random()*0.5) + "s";
      c.style.animationDuration = (1.1 + Math.random()*1.3) + "s";
      c.style.width = (6 + Math.random()*6) + "px";
      c.style.height = (10 + Math.random()*8) + "px";
      layer.appendChild(c);
    }
    return layer;
  }

  function finishMatch(){
    applyUI(state);
    if(state.pens){
      const a=state.scoreA, b=state.scoreB, pa=state.pens.penA, pb=state.pens.penB;
      const [tA,tB]=state.teams;
      const w=state.pens.winner;
      const title=`${TEAM.titleName(state.teams[w])} 获胜（点球）`;
      elOverlayTitle.textContent="点球大战结束 ⚽";
      elOverlayBody.innerHTML =
        `<div class="final-result">
           <div class="final-team ${w===0?'winner':''}">
             ${TEAM.bigBadge(tA)}
             <div class="fname">${TEAM.name(tA)}</div>
           </div>
           <div class="final-score">
             ${a}<span class="pen"><small>点球</small>${pa}</span>
             <span class="sep">:</span>
             ${b}<span class="pen"><small>点球</small>${pb}</span>
           </div>
           <div class="final-team ${w===1?'winner':''}">
             ${TEAM.bigBadge(tB)}
             <div class="fname">${TEAM.name(tB)}</div>
           </div>
         </div>
         <div style="text-align:center">
           <span class="final-tag">点球 PENS</span>
         </div>
         <div class="final-winner-line">${title}</div>`;
      elStartBtn.textContent="再来一局";
      clearConfetti();
      elOverlay.appendChild(spawnConfetti());
      elOverlay.classList.remove("hidden");
      applyPensScoreboard();
      onClearSelection();
      return;
    }
    const a=state.scoreA, b=state.scoreB;
    const [tA,tB]=state.teams;
    let winIdx = a>b ? 0 : (b>a ? 1 : -1);
    const tag = winIdx>=0 ? "WIN" : "DRAW";
    const title = winIdx>=0
      ? `${TEAM.titleName(state.teams[winIdx])} 获胜`
      : (state.extra ? "加时仍平局" : "常规时间平局");
    elOverlayTitle.textContent = state.extra ? "加时结束 ⚽" : "终场哨响 ⚽";
    elOverlayBody.innerHTML =
      `<div class="final-result">
         <div class="final-team ${winIdx===0?'winner':''}">
           ${TEAM.bigBadge(tA)}
           <div class="fname">${TEAM.name(tA)}</div>
         </div>
         <div class="final-score">${a}<span class="sep">:</span>${b}</div>
         <div class="final-team ${winIdx===1?'winner':''}">
           ${TEAM.bigBadge(tB)}
           <div class="fname">${TEAM.name(tB)}</div>
         </div>
       </div>
       <div style="text-align:center">
         <span class="final-tag">${tag}</span>
       </div>
       <div class="final-winner-line">${title}</div>`;
    elStartBtn.textContent="再来一局";
    clearConfetti();
    if(winIdx >= 0) elOverlay.appendChild(spawnConfetti());
    elOverlay.classList.remove("hidden");
    onClearSelection();
  }

  // ---------- 控制 ----------
  function previewMatch(tA, tB){
    state = newMatch(tA, tB);
    applyUI(state);
    elPensBar.style.display="none";
    pending = [tA, tB];
    elOverlayTitle.textContent = "比赛已选定 ⚽";
    elOverlayBody.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:center;gap:12px;font-size:18px;font-weight:700;flex-wrap:wrap">
         ${TEAM.badge(tA,42,"badge-dom")}<span>${TEAM.name(tA)}</span>
         <span style="opacity:.5;font-size:14px;letter-spacing:2px">VS</span>
         ${TEAM.badge(tB,42,"badge-dom")}<span>${TEAM.name(tB)}</span>
       </div>
       <div style="opacity:.7;font-size:13px;margin-top:6px">点击下方按钮 / 按空格键开始模拟</div>`;
    elStartBtn.textContent = "开始模拟";
    clearConfetti();
    elOverlay.classList.remove("hidden");
    updateClock();
    draw();
  }

  function clearPreview(){
    pending = null;
    if(resetOverlay){
      elOverlayTitle.textContent = resetOverlay.title;
      elOverlayBody.innerHTML = resetOverlay.body;
      elStartBtn.textContent = resetOverlay.btn;
      clearConfetti();
      elOverlay.classList.remove("hidden");
    }
  }

  function start(tA, tB){
    state = newMatch(tA, tB);
    applyUI(state);
    elPensBar.style.display="none";
    clearConfetti();
    elOverlay.classList.add("hidden");
    state.realStart = performance.now()/1000;
    state.started = true;
    kickoffPause(0, true);
    lastT = 0;
    if(rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function doStart(){
    // 遮罩隐藏 = 比赛已开始，忽略重复触发
    // （按钮聚焦时按空格会先触发 keydown 开赛、再触发按钮原生 click，
    //   若不拦截第二次调用会以 pending=null 随机开赛，吞掉用户已选定的对阵）
    if(elOverlay.classList.contains("hidden")) return;
    if(pending){
      const [a,b]=pending; pending=null;
      start(a, b);
    } else {
      onClearSelection();
      start(null, null);
    }
  }
  elStartBtn.addEventListener("click", doStart);

  window.addEventListener("keydown", (e)=>{
    if(e.code!=="Space" && e.key!==" ") return;
    if(elOverlay.classList.contains("hidden")) return;
    e.preventDefault();
    doStart();
  });

  // 初始：不显示任何球队，仅绘制空球场
  state = {
    teams:[], balls:[], goalCenter: -Math.PI/2,
    goalFlash:0, scoreA:0, scoreB:0, started:false, finished:false,
    extra:false, matchMin:0, rot:0
  };
  elFlagA.textContent=""; elScoreA.textContent="0";
  elFlagB.textContent=""; elScoreB.textContent="0";
  draw();

  // ---------- 对外 API ----------
  return {
    previewMatch,
    clearPreview,
    start,
    doStart,
    draw,
    get state(){ return state; },
    get pending(){ return pending; },
    isOverlayHidden(){ return elOverlay.classList.contains("hidden"); }
  };
};
