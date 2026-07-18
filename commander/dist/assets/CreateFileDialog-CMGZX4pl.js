import{Kt as e,Lt as t,Pn as n,Rt as r,pr as i,qt as a,xi as o,zt as s}from"./dimensions-BXWdpyR8.js";import{E as c,It as l,U as u,d,n as f,r as p,u as m}from"./app-0Qw1L8E7.js";import{_ as h,g,v as _,w as v}from"./index-DOfMIYgA.js";import{t as y}from"./VTextField-BgMEtQkh.js";import{t as b}from"./VSelect-DtLzK1hj.js";import{t as x}from"./VAlert-DU6zk2DS.js";var S=Object.assign({"../../presets/macros/bits.yaml":`apis: []
tasks:
  - channel: alert
    message: \${event.userDisplayName} haut \${event.bits} Bits raus
    asset: bits
`,"../../presets/macros/end_alert_generic_animation.yaml":`apis: []
tasks:
  - channel: animation
    method: play
    data:
      target: generic_alert_animation
      startFrame: 363
      stopFrame: 477
      frameRate: 60
  - channel: function
    method: sleep
    data:
      time: 1900
`,"../../presets/macros/end_raid_animation.yaml":`apis: []
tasks:
  - channel: animation
    method: play
    data:
      target: raid_animation
      startFrame: 462
      stopFrame: 570
      frameRate: 60
  - channel: function
    method: sleep
    data:
      time: 1800
`,"../../presets/macros/follow.yaml":`apis: []
tasks:
  - channel: alert
    message: \${event.userDisplayName} folgt nun
    asset: follow
`,"../../presets/macros/idle_alert_generic_animation.yaml":`apis: []
tasks:
  - channel: animation
    method: play
    data:
      target: generic_alert_animation
      startFrame: 228
      stopFrame: 327
      frameRate: 60
      loop: true
`,"../../presets/macros/idle_raid_animation.yaml":`apis: []
tasks:
  - channel: animation
    method: play
    data:
      target: raid_animation
      startFrame: 207
      stopFrame: 430
      frameRate: 60
      loop: true
`,"../../presets/macros/raid.yaml":`apis: []
tasks:
  - channel: alert
    message: \${event.userDisplayName} raidet mit \${event.viewerCount} Leuten
    asset: raid
`,"../../presets/macros/song_request.yaml":`apis: []
tasks:
  - channel: condition
    method: if
    check: '''\${data.url}'' === '''''
  - channel: function
    method: send_message
    data:
      content: Bitte eine YouTube oder Deezer URL angeben.
  - channel: condition
    method: end_macro
  - channel: condition
    method: end_if
  - channel: condition
    method: if
    check: '''\${songrequest.enabled}'' !== ''true'''
  - channel: function
    method: send_message
    data:
      content: Songrequests sind aktuell deaktiviert.
  - channel: condition
    method: end_macro
  - channel: condition
    method: end_if
  - channel: condition
    method: if
    check: '''\${songrequest.query_blocked}'' === ''true'''
  - channel: function
    method: send_message
    data:
      content: Dieser Songrequest ist blockiert.
  - channel: condition
    method: end_macro
  - channel: condition
    method: end_if
  - channel: condition
    method: if
    check: '''\${songrequest.query_already_present}'' === ''true'''
  - channel: function
    method: send_message
    data:
      content: Dieser Songrequest ist bereits in der Queue.
  - channel: condition
    method: end_macro
  - channel: condition
    method: end_if
  - channel: function
    method: song_request
    data:
      url: \${data.url}
  - channel: function
    method: send_message
    data:
      content: Songrequest wurde hinzugefügt.
`,"../../presets/macros/song_request_toggle.yaml":`apis: []
tasks:
  - channel: function
    method: song_request_toggle
    data: {}
  - channel: function
    method: send_message
    data:
      content: 'Songrequests: \${songrequest.enabled}'
`,"../../presets/macros/start_alert_generic_animation.yaml":`apis: []
tasks:
  - channel: animation
    method: play
    data:
      target: generic_alert_animation
      startFrame: 0
      stopFrame: 191
      frameRate: 60
  - channel: function
    method: sleep
    data:
      time: 3200
`,"../../presets/macros/start_raid_animation.yaml":`apis: []
tasks:
  - channel: animation
    method: play
    data:
      target: raid_animation
      startFrame: 0
      stopFrame: 207
      frameRate: 60
  - channel: function
    method: sleep
    data:
      time: 3500
`,"../../presets/macros/sub.yaml":`apis: []
tasks:
  - channel: alert
    message: \${event.userDisplayName} abonniert im \${event.months}. Monat auf Stufe \${plan}
    asset: sub
`,"../../presets/macros/subcommunitygift.yaml":`apis: []
tasks:
  - channel: alert
    message: \${event.count} subs gifted from \${event.gifterDisplayName} on tier \${plan}
    asset: sub
`,"../../presets/macros/subgift.yaml":`apis: []
tasks:
  - channel: alert
    message: \${event.gifterDisplayName} schenkt \${event.userDisplayName} ein Abo auf Stufe \${plan}
    asset: sub
`,"../../presets/macros/tts.yaml":`apis: []
tasks:
  - channel: condition
    method: if
    check: '''\${data.text}'' === '''''
  - channel: function
    method: send_message
    data:
      content: Du musst einen Text angeben!
  - channel: condition
    method: end_macro
  - channel: condition
    method: end_if
  - channel: dummy_alert
    message: \${context.userName} sagt \${data.text}
    duration: tts
    icon: ''
    speak: true
    event_uuid: \${eventUuid}
`,"../../presets/macros/tts_channel_point.yaml":`apis: []
tasks:
  - channel: dummy_alert
    message: \${channelPoint.userName} sagt \${channelPoint.input}
    speak: true
  - channel: channel_point
    method: accept
`,"../../presets/overlay/alert.html":`<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script type="module" src="/dist/app.js"><\/script>
    <link rel="stylesheet" href="/dist/app.css">
    <meta charset="UTF-8">
    <title>Simple Alert Box</title>

    <style>
        :root {
            --alert-bg: rgb(18 18 18 / 0.92);
            --alert-border: var(--theme-color, #00e5ff);
            --alert-text: var(--theme-color, #00e5ff);
            --alert-muted: rgb(255 255 255 / 0.72);
        }

        html,
        body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: transparent;
        }

        .alert-overlay-root {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: 48px;
            font-family: 'Doto', system-ui, sans-serif;
        }

        .alert-box {
            min-width: 520px;
            max-width: 1200px;
            min-height: 180px;
            display: flex;
            align-items: center;
            gap: 32px;
            padding: 36px 44px;
            box-sizing: border-box;
            background: var(--alert-bg);
            border: 4px solid var(--alert-border);
            border-radius: 18px;
            box-shadow:
                    0 0 24px rgb(0 0 0 / 0.55),
                    0 0 28px rgb(from var(--alert-border) r g b / 0.35);
        }

        .alert-logo {
            flex: 0 0 auto;
            color: var(--alert-text);
            font-size: 96px;
            line-height: 1;
        }

        .alert-content {
            flex: 1 1 auto;
            color: var(--alert-text);
            font-size: clamp(48px, 5vw, 92px);
            font-weight: 600;
            line-height: 1.08;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .alert-content:empty::before {
            content: 'Alert message';
            color: var(--alert-muted);
        }

        .alert-media {
            width: 100%;
            max-width: 780px;
            max-height: 430px;
            object-fit: contain;
            border-radius: 12px;
        }

        [data-alert-active-type] {
            display: none;
        }
    </style>
</head>
<body>
<div
        data-alert-channel="general"
        data-controller="alert"
        class="alert-overlay-root">

    <div class="alert-box">
        <div data-alert-active-type="icon">
            <i class="alert-logo mdi mdi-alert" data-alert-target="element" data-alert-element-type="icon"></i>
        </div>

        <div class="alert-content" data-alert-active-type="text" data-alert-target="element" data-alert-element-type="content">
            Alert message
        </div>

        <video
                class="alert-media"
                data-alert-active-type="video"
                data-alert-target="element"
                data-alert-element-type="video"
                muted="muted"
                playsinline="playsinline">
            <source src="" type="video/mp4">
        </video>

        <img
                class="alert-media d-none"
                data-alert-active-type="image"
                data-alert-target="element"
                data-alert-element-type="image"
                alt="Alert image">

        <img
                class="alert-media d-none"
                data-alert-active-type="logo"
                data-alert-target="element"
                data-alert-element-type="logo"
                alt="Alert logo">

        <iframe
                class="alert-media d-none"
                data-alert-active-type="iframe"
                data-alert-target="element"
                data-alert-element-type="iframe"
                title="Alert iframe"></iframe>
    </div>
</div>
</body>
</html>
`}),C={props:{modelValue:{type:Boolean,default:!1},currentPath:{type:String,default:``},websocketMethod:{type:String,required:!0},presetFolder:{type:String,default:``},extension:{type:String,default:``},enforceExtension:{type:Boolean,default:!1},icon:{type:String,default:`mdi-file-plus`},title:{type:String,default:``},nameLabel:{type:String,default:``},presetLabel:{type:String,default:``},noPresetsLabel:{type:String,default:``},cancelLabel:{type:String,default:``},createLabel:{type:String,default:``}},emits:[`update:modelValue`,`created`],data(){return{name:``,selectedPreset:``,loading:!1}},computed:{normalizedPresetFolder(){return String(this.presetFolder??``).replace(/^@?\/?src\/?presets\/?/i,``).replace(/^@?\/?presets\/?/i,``).replace(/^\/+|\/+$/g,``)},normalizedExtension(){return String(this.extension??``).replace(/^\.+/,``).trim().toLowerCase()},extensionSuffix(){return!this.normalizedExtension||!this.enforceExtension?``:`.${this.normalizedExtension}`},presetItems(){let e=this.normalizedPresetFolder;return e?Object.keys(S).filter(t=>t.includes(`/presets/${e}/`)).sort((e,t)=>e.localeCompare(t)).map(e=>{let t=e.split(`/`).pop()?.replace(/\.(html|ya?ml)$/i,``)??e;return{title:this.formatPresetName(t),value:e}}):[]},canCreate(){return this.safeName.length>0&&(!this.presetItems.length||this.selectedPreset.length>0)},safeName(){return String(this.name??``).trim().replace(/^\/+/,``)},normalizedFileName(){let e=this.safeName,t=this.normalizedExtension;return t?this.enforceExtension?`${e.replace(/\.[^/.]+$/i,``)}.${t}`:e.toLowerCase().endsWith(`.${t}`)?e:`${e}.${t}`:e},targetPath(){return[String(this.currentPath??``).replace(/^\/+|\/+$/g,``),this.normalizedFileName].filter(Boolean).join(`/`)}},watch:{modelValue(e){e&&this.prepareDialog()},presetFolder(){this.selectedPreset=``,this.prepareDialog()}},mounted(){this.prepareDialog()},methods:{prepareDialog(){!this.selectedPreset&&this.presetItems.length&&(this.selectedPreset=this.presetItems[0].value)},close(){this.$emit(`update:modelValue`,!1),this.name=``,this.loading=!1},async requestWebsocket(e,t={},n=1e4){let r=v();if(!r)throw Error(`websocket is not connected`);let i=await r.request(e,t,n);return i?.params??i},getPresetContent(e){return e?String(S[e]??``):``},formatPresetName(e){return String(e??``).replace(/[-_]+/g,` `).replace(/\b\w/g,e=>e.toUpperCase())},async createFile(){if(!(!this.canCreate||this.loading)){this.loading=!0;try{await this.requestWebsocket(this.websocketMethod,{path:this.targetPath,content:this.getPresetContent(this.selectedPreset)}),this.$emit(`created`,this.targetPath),this.close()}catch(e){console.error(`file create failed`,e)}finally{this.loading=!1}}}}};function w(u,v,S,C,w,T){return n(),r(h,{"model-value":S.modelValue,"max-width":`520`,"onUpdate:modelValue":v[2]||=e=>u.$emit(`update:modelValue`,e)},{default:i(()=>[a(f,{color:`grey-darken-4`},{default:i(()=>[a(m,{class:`d-flex align-center ga-2`},{default:i(()=>[a(c,{icon:S.icon},null,8,[`icon`]),t(`span`,null,o(S.title||u.$t(`overlay.createFile`)),1)]),_:1}),a(p,null,{default:i(()=>[a(y,{modelValue:w.name,"onUpdate:modelValue":v[0]||=e=>w.name=e,label:S.nameLabel||u.$t(`file.name`),suffix:T.extensionSuffix,variant:`outlined`,density:`compact`,"hide-details":`auto`,class:`mb-3`,autofocus:``,onKeydown:l(T.createFile,[`enter`])},null,8,[`modelValue`,`label`,`suffix`,`onKeydown`]),T.presetItems.length?(n(),r(b,{key:0,modelValue:w.selectedPreset,"onUpdate:modelValue":v[1]||=e=>w.selectedPreset=e,items:T.presetItems,label:S.presetLabel||u.$t(`overlay.previewPreset`),variant:`outlined`,density:`compact`,"hide-details":`auto`,class:`mb-3`},null,8,[`modelValue`,`items`,`label`])):T.normalizedPresetFolder?(n(),r(x,{key:1,type:`info`,color:`grey-darken-3`,density:`compact`,variant:`tonal`,text:S.noPresetsLabel||u.$t(`file.noPresetsFound`)},null,8,[`text`])):s(``,!0)]),_:1}),a(d,null,{default:i(()=>[a(g),a(_,{variant:`text`,onClick:T.close},{default:i(()=>[e(o(S.cancelLabel||u.$t(`common.cancel`)),1)]),_:1},8,[`onClick`]),a(_,{color:`primary`,variant:`flat`,loading:w.loading,disabled:!T.canCreate,onClick:T.createFile},{default:i(()=>[e(o(S.createLabel||u.$t(`overlay.createFile`)),1)]),_:1},8,[`loading`,`disabled`,`onClick`])]),_:1})]),_:1})]),_:1},8,[`model-value`])}var T=u(C,[[`render`,w]]);export{T as t};