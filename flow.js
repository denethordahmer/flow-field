/* =========================================================================
   FLOW FIELD v3 — flow.js
   Bottom sheet · accordion rows · 15 color modes · custom picker

   v3 changes:
   - Auto colour schemes now keep the saturation and lightness of the colour
     you pick. Only the hue rotates, so your chosen shade sticks.
   - Warm, Cool and Noise are tinted by Color 1.
   - Duotone now uses Color 1 and Color 2.
   - Color 1 is relabelled "Base colour" in auto modes.
   - Background row dims with a note when Transparent is on.
   - Randomize no longer turns transparency on.
   - Colour picker cursor now stays under your finger (correct maths).
   ========================================================================= */
(function () {
  "use strict";

  var TWO_PI = Math.PI * 2;

  /* -----------------------------------------------------------------------
     DOM
  ----------------------------------------------------------------------- */
  var canvas  = document.getElementById("flowCanvas");
  var ctx     = canvas.getContext("2d");
  var sheet   = document.getElementById("sheet");
  var handle  = document.getElementById("sheetHandle");

  /* -----------------------------------------------------------------------
     SEEDED RANDOM
  ----------------------------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* -----------------------------------------------------------------------
     PERLIN NOISE
  ----------------------------------------------------------------------- */
  function makePerlin(rand) {
    var perm = new Uint8Array(256);
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (var i2 = 255; i2 > 0; i2--) {
      var j = Math.floor(rand() * (i2 + 1));
      var tmp = perm[i2]; perm[i2] = perm[j]; perm[j] = tmp;
    }
    var p = new Uint8Array(512);
    for (var i3 = 0; i3 < 512; i3++) p[i3] = perm[i3 & 255];

    function fade(t) { return t*t*t*(t*(t*6-15)+10); }
    function lerp(a,b,t){ return a+t*(b-a); }
    function grad(h,x,y){
      switch(h&7){
        case 0: return  x+y; case 1: return -x+y;
        case 2: return  x-y; case 3: return -x-y;
        case 4: return  x;   case 5: return -x;
        case 6: return  y;   default: return -y;
      }
    }
    return function(x,y){
      var X=Math.floor(x)&255, Y=Math.floor(y)&255;
      x-=Math.floor(x); y-=Math.floor(y);
      var u=fade(x), v=fade(y);
      var A=p[X]+Y, B=p[X+1]+Y;
      return lerp(
        lerp(grad(p[A],x,y),     grad(p[B],x-1,y),   u),
        lerp(grad(p[A+1],x,y-1), grad(p[B+1],x-1,y-1),u), v
      );
    };
  }

  /* -----------------------------------------------------------------------
     COLOR HELPERS
  ----------------------------------------------------------------------- */
  function hexToRgb(hex){
    var n=parseInt((hex||"#000").replace("#",""),16);
    return [(n>>16)&255,(n>>8)&255,n&255];
  }
  function rgbToHex(r,g,b){
    return "#"+[r,g,b].map(function(v){return("0"+Math.round(v).toString(16)).slice(-2);}).join("");
  }
  function hslToRgb(h,s,l){
    h=(((h%360)+360)%360)/360;s/=100;l/=100;
    if(s===0){var v=Math.round(l*255);return[v,v,v];}
    var q=l<0.5?l*(1+s):l+s-l*s,p2=2*l-q;
    function hue(t){
      if(t<0)t+=1;if(t>1)t-=1;
      if(t<1/6)return p2+(q-p2)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p2+(q-p2)*(2/3-t)*6;
      return p2;
    }
    return[Math.round(hue(h+1/3)*255),Math.round(hue(h)*255),Math.round(hue(h-1/3)*255)];
  }
  function rgbToHsl(r,g,b){
    r/=255;g/=255;b/=255;
    var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s=0,l=(mx+mn)/2;
    if(mx!==mn){
      var d=mx-mn;
      s=l>0.5?d/(2-mx-mn):d/(mx+mn);
      if(mx===r)      h=(g-b)/d+(g<b?6:0);
      else if(mx===g) h=(b-r)/d+2;
      else            h=(r-g)/d+4;
      h/=6;
    }
    return[h*360,s*100,l*100];
  }
  /* HSV helpers — used by the colour picker (h 0-360, s 0-1, v 0-1) */
  function hsvToRgb(h,s,v){
    h=(((h%360)+360)%360)/60;
    var i=Math.floor(h),f=h-i;
    var p=v*(1-s),q=v*(1-s*f),t=v*(1-s*(1-f)),r,g,b;
    switch(i%6){
      case 0:r=v;g=t;b=p;break;
      case 1:r=q;g=v;b=p;break;
      case 2:r=p;g=v;b=t;break;
      case 3:r=p;g=q;b=v;break;
      case 4:r=t;g=p;b=v;break;
      default:r=v;g=p;b=q;
    }
    return[Math.round(r*255),Math.round(g*255),Math.round(b*255)];
  }
  function rgbToHsv(r,g,b){
    r/=255;g/=255;b/=255;
    var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;
    if(d!==0){
      if(mx===r)      h=((g-b)/d)%6;
      else if(mx===g) h=(b-r)/d+2;
      else            h=(r-g)/d+4;
      h*=60; if(h<0)h+=360;
    }
    return[h,mx===0?0:d/mx,mx];
  }
  function lerpRgb(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
  function multiLerp(stops,t){
    if(t<=0)return stops[0];if(t>=1)return stops[stops.length-1];
    var seg=(stops.length-1)*t,i=Math.floor(seg);
    return lerpRgb(stops[i],stops[i+1],seg-i);
  }
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function smooth(a,b,t){var x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);}

  /* -----------------------------------------------------------------------
     COLOR MODE ENGINE
     Auto modes read hue, saturation and lightness from Color 1 (the base
     colour). Hue rotates; saturation and lightness stay as picked.
  ----------------------------------------------------------------------- */
  function pickColor(mode,t,c1,c2,c3,c4,nv,seedOffset){
    var hsl1=rgbToHsl(c1[0],c1[1],c1[2]);
    var h1=hsl1[0];
    /* a grey/white/black base has no real hue: give it a usable saturation */
    var S=hsl1[1]<6?65:hsl1[1];
    var L=clamp(hsl1[2],12,88);

    switch(mode){
      case "solid":         return c1;
      case "gradient":      return lerpRgb(c1,c2,t);
      case "tricolor":      return t<0.5?lerpRgb(c1,c2,t*2):lerpRgb(c2,c3,(t-0.5)*2);
      case "multistop":     return multiLerp([c1,c2,c3,c4],t);
      case "spectrum":      return hslToRgb(h1+t*360,S,L);
      case "monochrome":    return hslToRgb(h1,hsl1[1],clamp(hsl1[2]-35+t*70,4,96));
      case "duotone":       return lerpRgb(c1,c2,smooth(0.35,0.65,t));
      case "complementary": return hslToRgb(t<0.5?h1:h1+180,S,L);
      case "splitcomp":  {var hs=[h1,h1+150,h1+210];return hslToRgb(hs[Math.min(2,Math.floor(t*3))],S,L);}
      case "analogous":     return hslToRgb(h1-30+t*60,S,L);
      case "triadic":    {var ht=[h1,h1+120,h1+240];return hslToRgb(ht[Math.min(2,Math.floor(t*3))],S,L);}
      case "tetradic":   {var hq=[h1,h1+90,h1+180,h1+270];return hslToRgb(hq[Math.min(3,Math.floor(t*4))],S,L);}
      case "warm": {
        /* warm range is red to yellow (0-60). Base hue pulls the centre. */
        var wc=(h1>=0&&h1<=60)?h1:(h1>=210?0:60);
        return hslToRgb(wc-30+((seedOffset+t*60)%60),S,L);
      }
      case "cool": {
        /* cool range is cyan to violet. Base hue pulls the centre. */
        var cc=(h1>=150&&h1<=330)?clamp(h1,200,260):230;
        return hslToRgb(cc-50+((seedOffset+t*100)%100),S,L);
      }
      case "noise":         return hslToRgb(((nv+1)/2)*360+h1,S,L);
      default:              return c1;
    }
  }

  /* -----------------------------------------------------------------------
     READ STATE
  ----------------------------------------------------------------------- */
  function val(id){ return document.getElementById(id); }
  function fval(id){ return parseFloat(val(id).value)||0; }
  function ival(id){ return parseInt(val(id).value,10)||0; }

  var SIZES={square:[1500,1500],portrait:[900,1600],landscape:[1600,900],a17:[1080,2340],desktop:[1920,1080]};

  function readState(){
    var seed=ival("seed")||1;
    var sz=SIZES[val("size").value]||SIZES.square;
    var bgTrans=val("bgTransparent").value==="true";
    return{
      seed:seed, W:sz[0], H:sz[1],
      particles:ival("particles"),
      steps:ival("steps"),
      stepSize:fval("stepSize"),
      featureSize:ival("featureSize"),
      curl:fval("curl"),
      lineWidth:fval("lineWidth"),
      opacity:fval("opacity"),
      mode:val("colorMode").value,
      direction:val("direction").value,
      c1:hexToRgb(val("color1").value||"#3b82f6"),
      c2:hexToRgb(val("color2").value||"#a855f7"),
      c3:hexToRgb(val("color3").value||"#f472b6"),
      c4:hexToRgb(val("color4").value||"#34d399"),
      bgColor:val("bgColor").value||"#0d0f16",
      bgTransparent:bgTrans,
      seedOffset:seed%60
    };
  }

  /* -----------------------------------------------------------------------
     RENDER
  ----------------------------------------------------------------------- */
  var rafPending=false;
  function schedule(){
    if(rafPending)return;
    rafPending=true;
    requestAnimationFrame(function(){rafPending=false;render();});
  }

  function noiseScale(fs){ return 0.0065-(fs-1)*(0.0065-0.0006)/99; }

  function render(){
    var s=readState();
    canvas.width=s.W; canvas.height=s.H;
    if(s.bgTransparent){ ctx.clearRect(0,0,s.W,s.H); }
    else{ ctx.fillStyle=s.bgColor; ctx.fillRect(0,0,s.W,s.H); }

    var rand=mulberry32(s.seed);
    var noise=makePerlin(rand);
    var scale=noiseScale(s.featureSize);
    var cols=Math.max(1,Math.ceil(Math.sqrt(s.particles*(s.W/s.H))));
    var rows=Math.max(1,Math.ceil(s.particles/cols));
    var cellW=s.W/cols, cellH=s.H/rows;

    ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.lineWidth=s.lineWidth; ctx.globalAlpha=s.opacity;

    function posT(x,y){
      switch(s.direction){
        case "vertical":  return y/s.H;
        case "diagonal":  return(x/s.W+y/s.H)/2;
        case "radial":{var dx=x/s.W-0.5,dy=y/s.H-0.5;return Math.min(1,Math.sqrt(dx*dx+dy*dy)*2);}
        case "chaotic":   return rand();
        default:          return x/s.W;
      }
    }

    for(var r=0;r<rows;r++){
      for(var c=0;c<cols;c++){
        var px=c*cellW+rand()*cellW;
        var py=r*cellH+rand()*cellH;
        var nv=noise(px*scale,py*scale);
        var t=Math.max(0,Math.min(1,posT(px,py)));
        var col=pickColor(s.mode,t,s.c1,s.c2,s.c3,s.c4,nv,s.seedOffset);
        ctx.strokeStyle="rgb("+Math.round(col[0])+","+Math.round(col[1])+","+Math.round(col[2])+")";
        ctx.beginPath();
        var x=px,y=py; ctx.moveTo(x,y);
        for(var i=0;i<s.steps;i++){
          var angle=noise(x*scale,y*scale)*TWO_PI*s.curl;
          x+=Math.cos(angle)*s.stepSize;
          y+=Math.sin(angle)*s.stepSize;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  }

  /* -----------------------------------------------------------------------
     EXPORT
  ----------------------------------------------------------------------- */
  function exportPNG(){
    canvas.toBlob(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url; a.download="flowfield-"+val("seed").value+".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},1500);
    },"image/png");
  }

  /* -----------------------------------------------------------------------
     RANDOMIZE
     Shuffles every setting except Size. Transparency is always turned off
     so the Background picker never silently stops working.
  ----------------------------------------------------------------------- */
  function randomFrom(list){
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomHex(){
    var letters = "0123456789abcdef";
    var s = "#";
    for (var i = 0; i < 6; i++) s += letters[Math.floor(Math.random() * 16)];
    return s;
  }

  function setColorInput(id, hex){
    var el = val(id);
    if (el) el.value = hex;
    var dotId = id === "bgColor" ? "bgColorDot" : id + "Dot";
    var dot = document.getElementById(dotId);
    if (dot) dot.style.background = hex;
  }

  function setTransparent(on){
    val("bgTransparent").value = on ? "true" : "false";
    var tg = document.getElementById("bgTransparentToggle");
    tg.setAttribute("data-on", on ? "true" : "false");
    tg.textContent = on ? "On" : "Off";
    document.getElementById("bgTransparentVal").textContent = on ? "On" : "Off";
    syncBgRow();
  }

  function randomizeAll(){
    val("seed").value        = Math.floor(Math.random()*900000)+100000;
    val("particles").value   = Math.floor(600+Math.random()*2400);
    val("steps").value       = Math.floor(30+Math.random()*120);
    val("stepSize").value    = Math.floor(1+Math.random()*8);
    val("featureSize").value = Math.floor(20+Math.random()*70);
    val("curl").value        = (0.2+Math.random()*1.8).toFixed(2);
    val("lineWidth").value   = (0.5+Math.random()*2.5).toFixed(1);
    val("opacity").value     = (0.2+Math.random()*0.7).toFixed(2);

    val("colorMode").value = randomFrom(Object.keys(SELECT_LABELS.colorMode));
    val("direction").value = randomFrom(["horizontal","vertical","diagonal","radial","chaotic"]);

    setColorInput("color1", randomHex());
    setColorInput("color2", randomHex());
    setColorInput("color3", randomHex());
    setColorInput("color4", randomHex());
    setColorInput("bgColor", randomHex());

    setTransparent(false);

    syncColorRows();
    syncAllBadges();
    schedule();
  }

  /* -----------------------------------------------------------------------
     BOTTOM SHEET OPEN/CLOSE
  ----------------------------------------------------------------------- */
  handle.addEventListener("click", function(e){
    if(e.target.closest(".generateBtn")) return;
    sheet.classList.toggle("open");
  });

  /* -----------------------------------------------------------------------
     ACCORDION ROWS
  ----------------------------------------------------------------------- */
  var COLOR_ROWS=["color1","color2","color3","color4","bgColor"];

  document.querySelectorAll(".settingRow").forEach(function(row){
    row.addEventListener("click", function(e){
      if(e.target.closest(".settingControl") && row.classList.contains("active")) return;

      var wasActive=row.classList.contains("active");
      document.querySelectorAll(".settingRow.active").forEach(function(r){r.classList.remove("active");});
      if(!wasActive){
        row.classList.add("active");
        var key=row.getAttribute("data-key");
        if(COLOR_ROWS.indexOf(key)!==-1){
          row.classList.remove("active");
          var nameEl=row.querySelector(".settingName");
          openPicker(key, nameEl ? nameEl.textContent : key);
        }
      }
    });
  });

  /* -----------------------------------------------------------------------
     BADGE / LABEL SYNC
  ----------------------------------------------------------------------- */
  var SELECT_LABELS={
    colorMode:{
      solid:"Solid",gradient:"Gradient",tricolor:"Tri-color",multistop:"Multi-stop",
      spectrum:"Spectrum",monochrome:"Monochrome",duotone:"Duotone",
      complementary:"Complementary",splitcomp:"Split-comp",analogous:"Analogous",
      triadic:"Triadic",tetradic:"Tetradic",warm:"Warm",cool:"Cool",noise:"Noise"
    },
    direction:{horizontal:"Horizontal",vertical:"Vertical",diagonal:"Diagonal",radial:"Radial",chaotic:"Chaotic"},
    size:{square:"Square 1500×1500",portrait:"Portrait 900×1600",landscape:"Landscape 1600×900",a17:"A17 1080×2340",desktop:"Desktop 1920×1080"}
  };

  function syncBadge(inputId, badgeId){
    var el=document.getElementById(inputId);
    var badge=document.getElementById(badgeId);
    if(!el||!badge) return;
    badge.textContent=el.value;
  }

  function syncSelectBadge(selectId, badgeId, map){
    var el=document.getElementById(selectId);
    var badge=document.getElementById(badgeId);
    if(!el||!badge) return;
    badge.textContent=(map&&map[el.value])||el.options[el.selectedIndex].text;
  }

  function syncAllBadges(){
    syncBadge("particles","particlesVal");
    syncBadge("steps","stepsVal");
    syncBadge("stepSize","stepSizeVal");
    syncBadge("featureSize","featureSizeVal");
    syncBadge("curl","curlVal");
    syncBadge("lineWidth","lineWidthVal");
    syncBadge("opacity","opacityVal");
    syncBadge("seed","seedVal");
    syncSelectBadge("colorMode","colorModeVal",SELECT_LABELS.colorMode);
    syncSelectBadge("direction","directionVal",SELECT_LABELS.direction);
    syncSelectBadge("size","sizeVal",SELECT_LABELS.size);
  }

  /* -----------------------------------------------------------------------
     WIRE SLIDERS
  ----------------------------------------------------------------------- */
  ["particles","steps","stepSize","featureSize","curl","lineWidth","opacity","seed"].forEach(function(id){
    document.getElementById(id).addEventListener("input",function(){
      syncAllBadges();
      schedule();
    });
  });

  /* -----------------------------------------------------------------------
     WIRE SELECTS
  ----------------------------------------------------------------------- */
  var POSITION_MODES=["solid","gradient","tricolor","multistop","spectrum","monochrome",
                      "duotone","complementary","splitcomp","analogous","triadic","tetradic"];

  /* Modes where Color 1 acts as a base that the scheme is built from */
  var BASE_MODES=["spectrum","monochrome","complementary","splitcomp","analogous",
                  "triadic","tetradic","warm","cool","noise"];

  function syncColorRows(){
    var mode=val("colorMode").value;
    var needs={
      solid:[1,0,0,0],gradient:[1,1,0,0],tricolor:[1,1,1,0],multistop:[1,1,1,1],
      spectrum:[1,0,0,0],monochrome:[1,0,0,0],duotone:[1,1,0,0],complementary:[1,0,0,0],
      splitcomp:[1,0,0,0],analogous:[1,0,0,0],triadic:[1,0,0,0],tetradic:[1,0,0,0],
      warm:[1,0,0,0],cool:[1,0,0,0],noise:[1,0,0,0]
    };
    var show=needs[mode]||[1,0,0,0];
    ["color1Row","color2Row","color3Row","color4Row"].forEach(function(id,i){
      var r=document.getElementById(id);
      if(r) r.style.display=show[i]?"":"none";
    });
    var dr=document.getElementById("directionRow");
    if(dr) dr.style.display=POSITION_MODES.indexOf(mode)!==-1?"":"none";

    /* relabel Color 1 */
    var n1=document.querySelector("#color1Row .settingName");
    if(n1) n1.textContent=BASE_MODES.indexOf(mode)!==-1?"Base colour":"Color 1";
  }

  /* Dim the Background row when Transparent is on */
  function syncBgRow(){
    var row=document.querySelector('.settingRow[data-key="bgColor"]');
    if(!row) return;
    var on=val("bgTransparent").value==="true";
    row.classList.toggle("dimmed", on);
    if(on) row.setAttribute("data-note","Transparent is on");
    else row.removeAttribute("data-note");
  }

  document.getElementById("colorMode").addEventListener("change",function(){
    syncSelectBadge("colorMode","colorModeVal",SELECT_LABELS.colorMode);
    syncColorRows();
    schedule();
  });
  document.getElementById("direction").addEventListener("change",function(){
    syncSelectBadge("direction","directionVal",SELECT_LABELS.direction);
    schedule();
  });
  document.getElementById("size").addEventListener("change",function(){
    syncSelectBadge("size","sizeVal",SELECT_LABELS.size);
    schedule();
  });

  /* -----------------------------------------------------------------------
     TRANSPARENT BG TOGGLE
  ----------------------------------------------------------------------- */
  var bgToggle=document.getElementById("bgTransparentToggle");
  var bgTransInput=document.getElementById("bgTransparent");
  bgTransInput.value="false";

  bgToggle.addEventListener("click",function(e){
    e.stopPropagation();
    setTransparent(bgTransInput.value!=="true");
    schedule();
  });

  /* -----------------------------------------------------------------------
     TOP BAR BUTTONS
  ----------------------------------------------------------------------- */
  document.getElementById("btnRandomize").addEventListener("click",randomizeAll);
  document.getElementById("btnExport").addEventListener("click",exportPNG);
  document.getElementById("btnGenerate").addEventListener("click",function(){
    schedule();
    sheet.classList.remove("open");
  });

  /* -----------------------------------------------------------------------
     CUSTOM COLOR PICKER
     The square shows saturation left→right and brightness top→bottom
     (HSV), so the picker stores HSV and the cursor maths is exact.
  ----------------------------------------------------------------------- */
  var CP={
    overlay:   document.getElementById("colorPickerOverlay"),
    slCanvas:  document.getElementById("cpSLCanvas"),
    hueCanvas: document.getElementById("cpHueCanvas"),
    slCursor:  document.getElementById("cpSLCursor"),
    hueCursor: document.getElementById("cpHueCursor"),
    hexInput:  document.getElementById("cpHexInput"),
    hexPreview:document.getElementById("cpHexPreview"),
    presetsEl: document.getElementById("cpPresets"),
    title:     document.getElementById("cpTitle"),
    h:210, s:0.76, v:0.96,
    targetId:null,
    PRESETS:[
      "#3b82f6","#6366f1","#a855f7","#ec4899","#f43f5e",
      "#f97316","#eab308","#22c55e","#14b8a6","#06b6d4",
      "#ffffff","#94a3b8","#475569","#1e293b","#000000",
      "#fde68a","#bbf7d0","#bfdbfe","#ddd6fe","#fce7f3"
    ]
  };

  function cpSetFromHex(hex){
    var rgb=hexToRgb(hex);
    var hsv=rgbToHsv(rgb[0],rgb[1],rgb[2]);
    /* keep the current hue if the colour is grey (hue is meaningless) */
    if(hsv[1]>0.001 && hsv[2]>0.001) CP.h=hsv[0];
    CP.s=hsv[1]; CP.v=hsv[2];
  }

  function cpDrawHue(){
    var c=CP.hueCanvas;
    c.width=c.offsetWidth||300; c.height=c.offsetHeight||28;
    var cx=c.getContext("2d");
    var g=cx.createLinearGradient(0,0,c.width,0);
    for(var i=0;i<=12;i++) g.addColorStop(i/12,"hsl("+(i/12*360)+",100%,50%)");
    cx.fillStyle=g; cx.fillRect(0,0,c.width,c.height);
  }

  function cpDrawSL(){
    var c=CP.slCanvas;
    c.width=c.offsetWidth||300; c.height=c.offsetHeight||180;
    var cx=c.getContext("2d");
    var gH=cx.createLinearGradient(0,0,c.width,0);
    gH.addColorStop(0,"#ffffff");
    gH.addColorStop(1,"hsl("+CP.h+",100%,50%)");
    cx.fillStyle=gH; cx.fillRect(0,0,c.width,c.height);
    var gV=cx.createLinearGradient(0,0,0,c.height);
    gV.addColorStop(0,"rgba(0,0,0,0)"); gV.addColorStop(1,"rgba(0,0,0,1)");
    cx.fillStyle=gV; cx.fillRect(0,0,c.width,c.height);
  }

  function cpToHex(){ var rgb=hsvToRgb(CP.h,CP.s,CP.v); return rgbToHex(rgb[0],rgb[1],rgb[2]); }

  function cpUpdate(){
    var hw=CP.hueCanvas.width||300;
    var w=CP.slCanvas.width||300, h=CP.slCanvas.height||180;
    CP.hueCursor.style.left=(CP.h/360*hw)+"px";
    CP.slCursor.style.left=(CP.s*w)+"px";
    CP.slCursor.style.top=((1-CP.v)*h)+"px";
    var hex=cpToHex();
    CP.hexInput.value=hex.slice(1).toUpperCase();
    CP.hexPreview.style.background=hex;
  }

  function cpBuildPresets(){
    CP.presetsEl.innerHTML="";
    CP.PRESETS.forEach(function(hex){
      var btn=document.createElement("button");
      btn.className="cpPresetSwatch"; btn.style.background=hex;
      btn.addEventListener("click",function(){
        cpSetFromHex(hex); cpDrawSL(); cpUpdate();
      });
      CP.presetsEl.appendChild(btn);
    });
  }

  function openPicker(targetId, label){
    CP.targetId=targetId;
    CP.title.textContent="Pick: "+label;
    var el=document.getElementById(targetId);
    cpSetFromHex(el?el.value:"#3b82f6");
    CP.overlay.classList.remove("hidden");
    requestAnimationFrame(function(){cpDrawHue();cpDrawSL();cpUpdate();cpBuildPresets();});
  }

  function cpApply(){
    var hex=cpToHex();
    var el=document.getElementById(CP.targetId);
    if(el) el.value=hex;
    var dotId=CP.targetId==="bgColor"?"bgColorDot":CP.targetId+"Dot";
    var dot=document.getElementById(dotId);
    if(dot) dot.style.background=hex;
    CP.overlay.classList.add("hidden");
    schedule();
  }

  /* hue events */
  function cpHueX(e){var rect=CP.hueCanvas.getBoundingClientRect();var cx=e.touches?e.touches[0].clientX:e.clientX;return Math.max(0,Math.min(1,(cx-rect.left)/rect.width));}
  function onHue(e){e.preventDefault();CP.h=cpHueX(e)*360;cpDrawSL();cpUpdate();}
  CP.hueCanvas.addEventListener("mousedown",function(e){onHue(e);CP.hueCanvas.addEventListener("mousemove",onHue);});
  CP.hueCanvas.addEventListener("touchstart",function(e){onHue(e);CP.hueCanvas.addEventListener("touchmove",onHue,{passive:false});},{passive:false});
  document.addEventListener("mouseup",function(){CP.hueCanvas.removeEventListener("mousemove",onHue);});
  document.addEventListener("touchend",function(){CP.hueCanvas.removeEventListener("touchmove",onHue);});

  /* saturation / brightness square events */
  function cpSLXY(e){var rect=CP.slCanvas.getBoundingClientRect();var cx=e.touches?e.touches[0].clientX:e.clientX;var cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-rect.left)/rect.width,y:(cy-rect.top)/rect.height};}
  function onSL(e){
    e.preventDefault();
    var pos=cpSLXY(e);
    CP.s=Math.max(0,Math.min(1,pos.x));
    CP.v=1-Math.max(0,Math.min(1,pos.y));
    cpUpdate();
  }
  CP.slCanvas.addEventListener("mousedown",function(e){onSL(e);CP.slCanvas.addEventListener("mousemove",onSL);});
  CP.slCanvas.addEventListener("touchstart",function(e){onSL(e);CP.slCanvas.addEventListener("touchmove",onSL,{passive:false});},{passive:false});
  document.addEventListener("mouseup",function(){CP.slCanvas.removeEventListener("mousemove",onSL);});
  document.addEventListener("touchend",function(){CP.slCanvas.removeEventListener("touchmove",onSL);});

  /* hex input */
  CP.hexInput.addEventListener("input",function(){
    var v=CP.hexInput.value.replace(/[^0-9a-fA-F]/g,"");
    if(v.length===6){
      cpSetFromHex("#"+v);
      cpDrawSL();
      /* update cursors and preview without rewriting the text being typed */
      var hw=CP.hueCanvas.width||300, w=CP.slCanvas.width||300, h=CP.slCanvas.height||180;
      CP.hueCursor.style.left=(CP.h/360*hw)+"px";
      CP.slCursor.style.left=(CP.s*w)+"px";
      CP.slCursor.style.top=((1-CP.v)*h)+"px";
      CP.hexPreview.style.background="#"+v;
    }
  });

  document.getElementById("cpApply").addEventListener("click",cpApply);
  document.getElementById("cpCancel").addEventListener("click",function(){CP.overlay.classList.add("hidden");});
  CP.overlay.addEventListener("click",function(e){if(e.target===CP.overlay)CP.overlay.classList.add("hidden");});

  /* -----------------------------------------------------------------------
     INIT
  ----------------------------------------------------------------------- */
  syncAllBadges();
  syncColorRows();
  syncBgRow();
  schedule();

})();