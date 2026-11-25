// Keep the HbbTV catalogue, ad decisions and player UI. Let Samsung's native
// player acquire the supplied PlayReady licence for the programme itself.
(function () {
    var activeDriver=null;
    function notify(name,value) {
        var adapter=window.vmNativeAnalytics;
        if(!adapter || typeof adapter[name]!=='function')return;
        try{adapter[name](value);}catch(ignore){window.vmNativeAnalytics=null;console.log('VM analytics observer recovered');}
    }
    function api() { return window.webapis && window.webapis.avplay; }
    function mseSupported() {
        try {
            return !!(window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function' &&
                window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'));
        } catch (ignore) { return false; }
    }
    function sourceUrl(driver,source) {
        var config=window.vmTimingProxy,owner=driver.vmOwner;
        if(!config || driver._mimeType!=='application/dash+xml' || !owner || !owner.isLive || !owner.isLive())return Promise.resolve(source);
        return new Promise(function(resolve,reject){
            var xhr=new XMLHttpRequest();
            xhr.open('POST',config.url+'/register',true);xhr.timeout=20000;
            xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('X-VM-Key',config.key);
            xhr.onload=function(){
                try{var result=JSON.parse(xhr.responseText);if(xhr.status!==200 || result.url.indexOf(config.url+'/s/')!==0)throw Error('Timing helper unavailable');
                    console.log('VM native normalized timeline ready');resolve(result.url);
                }catch(error){reject(error);}
            };
            xhr.onerror=xhr.ontimeout=function(){reject(Error('Timing helper unavailable'));};
            xhr.send(JSON.stringify({url:source}));
        });
    }
    function wants(mime,type,driver) {
        if(!((mime === 'application/dash+xml' || mime === 'video/mp4') && !!api()))return false;
        // MSE is DASH-only. MP4 ads and the native audio takeover must stay
        // on AVPlay regardless of the build mode or device capability.
        if(mime === 'video/mp4')return true;
        // The TAL source always passes type "video"; the live flag is captured
        // on the driver by the media-player-coupling build hook.
        var live = !!(driver && driver.vmIsLive) || type === 'live-video' || type === 'live-audio';
        if(!mseSupported()) {
            console.log('VM MSE gate: MediaSource unavailable, DASH stays on AVPlay');
            return true;
        }
        if(live) {
            console.log('VM MSE gate: routing live DASH to Shaka');
            try { if(localStorage.getItem('vm-live-mse') === 'off') return true; } catch(ignore) {}
            return false;
        }
        console.log('VM MSE gate: routing VOD DASH to Shaka');
        try { if(localStorage.getItem('vm-vod-mse') === 'off') return true; } catch(ignore) {}
        return false;
    }
    function current(driver) { try { return api().getCurrentTime()/1000; } catch (ignore) { return 0; } }
    function duration(driver) { try { return api().getDuration()/1000; } catch (ignore) { return 0; } }
    function reportVideo(){
        try{api().getCurrentStreamInfo().forEach(function(track){
            if(track.type!=='VIDEO')return;
            var data=JSON.parse(track.extra_info||'{}');
            if(activeDriver)activeDriver.vmVideoHeight=Number(data.Height||data.height||0);
            console.log('VM AVPlay video width='+Number(data.Width||data.width||0)+' height='+Number(data.Height||data.height||0)+' bitrate='+Number(data.Bit_rate||data.bitrate||0));
        });}catch(ignore){}
    }
    function reportState(label,driver) {
        var state='unknown',range='unknown';try{state=api().getState();range=String(api().getStreamingProperty('GET_LIVE_DURATION')).replace(/[^0-9|.,-]/g,'').slice(0,100);}catch(ignore){}
        var owner=driver.vmOwner,live=owner&&owner.isLive&&owner.isLive();
        console.log('VM AVPlay '+label+' state='+state+' time='+Math.round(current(driver)*1000)/1000+' source='+(driver._mimeType==='video/mp4'?'ad':live?'live':'vod')+' generation='+driver.vmNativeGeneration+' nativeRange='+range);
    }
    function requestSeek(driver,seconds,caller,success,failure) {
        var player=api(),generation=driver.vmNativeGeneration,range='n/a';
        try{range=player.getStreamingProperty('GET_LIVE_DURATION');}catch(ignore){}
        var request={id:(driver.vmSeekSerial||0)+1,caller:caller,target:seconds,completed:false};
        driver.vmSeekSerial=request.id;driver.vmSeekPending=request;
        console.log('VM AVPlay seek request id='+request.id+' caller='+caller+' target='+seconds+' current='+current(driver)+' liveRange='+range);
        function valid(){return driver.vmNative&&driver.vmNativeGeneration===generation;}
        try{player.seekTo(Math.round(seconds*1000),function(){
            if(!valid())return;request.completed=true;
            console.log('VM AVPlay seek success id='+request.id+' current='+current(driver));if(success)success();
        },function(error){
            if(!valid())return;if(driver.vmSeekPending===request)driver.vmSeekPending=null;
            console.log('VM AVPlay seek failed id='+request.id+' code='+(error&&error.name||'unknown'));if(failure)failure(error);
        });}catch(error){
            if(driver.vmSeekPending===request)driver.vmSeekPending=null;
            console.log('VM AVPlay seek threw id='+request.id+' code='+error.name);if(failure)failure(error);
        }
    }
    function config(driver, value) {
        var servers=value && value.drm && value.drm.servers;
        if (servers && servers['com.microsoft.playready']) driver.vmLicenseServer=servers['com.microsoft.playready'];
    }
    function preference(on) {
        try {
            if(typeof localStorage==='undefined')return false;
            if(typeof on==='boolean')localStorage.setItem('vm-subtitles',on?'on':'off');
            return localStorage.getItem('vm-subtitles')==='on';
        } catch (ignore) { return false; }
    }
    function clearCaptionElement(element) {
        if(!element)return;
        if(element.firstChild){while(element.firstChild)element.removeChild(element.firstChild);}
        else if(element.children){while(element.children.length)element.removeChild(element.children[element.children.length-1]);}
        element.textContent='';
    }
    function cancelHide(driver) {
        clearTimeout(driver.vmSubtitleTimer);
        driver.vmSubtitleTimer=null;
    }
    function hideCaption(driver) {
        cancelHide(driver);
        clearCaptionElement(driver.vmSubtitleElement);
        driver.vmSubtitleRendered=null;
    }
    function clearSubtitle(driver) { hideCaption(driver); }
    function paintCaption(driver) {
        var element=driver.vmSubtitleElement;
        if(!element)return;
        if(!driver.vmTextVisible){hideCaption(driver);return;}
        var image=driver.vmSubtitleImage,key=(image?'image:'+image:'text:'+(driver.vmSubtitleCue||''));
        if(driver.vmSubtitleRendered===key)return;
        if(image){
            clearCaptionElement(element);
            var node=document.createElement('img');
            node.src=image;node.style.cssText='max-width:100%;max-height:360px';
            element.appendChild(node);
        } else {
            // Rolling captions replace the text in place. Clearing the element
            // first produces a visible blank frame between every added word.
            element.textContent=driver.vmSubtitleCue||'';
        }
        driver.vmSubtitleRendered=key;
    }
    function imageSource(value) {
        var match=/^\s*<img[^>]+src=["']([^"']+)["']/i.exec(value);
        var source=match?match[1]:value.trim();
        return /^(data:image\/|https?:\/\/)/i.test(source)?source:null;
    }
    function markTextAvailable(driver) {
        if(driver.vmTextAvailable)return;
        driver.vmTextAvailable=true;console.log('VM native subtitle data received');
        if(window.vmNativeOptions&&window.vmNativeOptions.refresh)window.vmNativeOptions.refresh();
        if(driver.vmTextWanted&&!driver.vmTextVisible){
            var list=tracks(driver,true);
            if(list.length)selectText(driver,list[0].id);
        }
    }
    function subtitle(driver, milliseconds, value, type) {
        var raw=String(value||''),kind=String(type||'0');
        console.log('VM subtitle callback type='+kind+' length='+raw.length+' duration='+milliseconds+' position='+Math.round(current(driver)*1000)/1000);
        // Samsung uses 0 for text and 1 for image captions. Inspect either kind
        // before deciding that a programme has no usable subtitles.
        var image=kind==='1'?imageSource(raw):null;
        var text=image?'':String(raw).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').trim();
        if(!image){
            // Decode entities without putting upstream markup in the document.
            var decoder=document.createElement('textarea');decoder.innerHTML=text;text=decoder.value||decoder.textContent||text;
        }
        cancelHide(driver);driver.vmSubtitleCue=text;driver.vmSubtitleImage=image;
        if(!text&&!image){
            // A short gap between rolling TTML samples must not blank the line.
            driver.vmSubtitleTimer=setTimeout(function(){driver.vmSubtitleCue='';driver.vmSubtitleImage=null;hideCaption(driver);},250);
            return;
        }
        markTextAvailable(driver);
        if(driver.vmTextVisible)paintCaption(driver);
        // Native callbacks report only the current rolling sample, often 120-800ms.
        // Keep the line for at least 1.2s so the next sample can replace it in place.
        var hold=Number(milliseconds)||0;
        driver.vmSubtitleTimer=setTimeout(function(){driver.vmSubtitleCue='';driver.vmSubtitleImage=null;hideCaption(driver);},Math.max(1200,hold+400));
    }
    function restoreText(driver,index) {
        if(!driver)return;
        // State-only restore for a new programme source after an ad break.
        // Native callback mode is configured by begin() before prepareAsync.
        driver.vmTextTrack=index;driver.vmSubtitleTrackId=index;driver.vmTextVisible=index!==null;
        driver.vmTextWanted=index!==null;
        if(index!==null)preference(true);
        if(window.vmSubtitles)window.vmSubtitles.select(driver,index);
        paintCaption(driver);
    }
    function nativeAudioIndices() {
        var result=[];
        try { api().getTotalTrackInfo().forEach(function(item){if(item.type==='AUDIO')result.push(item.index);}); } catch(ignore){}
        return result;
    }
    function selectAudioIndex(driver,index,force) {
        if(!driver)throw Error('No active player');
        if(!force&&driver.vmAudioGuardUntil&&Date.now()<driver.vmAudioGuardUntil&&typeof driver.vmAudioTrack==='number'&&index!==driver.vmAudioTrack){
            console.log('VM automatic audio selection ignored id='+index+' keeping='+driver.vmAudioTrack);
            return;
        }
        var selected=tracks(driver,false).filter(function(track){return track.id===index;})[0];
        if(selected)driver.vmAudioIdentity={adaptationId:selected.adaptationId,label:selected.label,language:selected.language};
        var native=nativeAudioIndices(),owner=driver.vmOwner;
        var live=driver._mimeType==='application/dash+xml'&&owner&&owner.isLive&&owner.isLive();
        // On live DASH the single native AUDIO stream is already playing; asking
        // AVPlay to select it makes the native player seek and then fail with
        // PLAYER_ERROR_NOT_SUPPORTED_FILE. Manifest labels, including the AD
        // choice, are applied to the panel state only. VOD keeps native selection
        // where the platform supports it, but a native failure must never leave
        // the panel showing the previous choice.
        if(native.indexOf(index)>=0&&!live){
            try{api().setSelectTrack('AUDIO',index);}
            catch(error){console.log('VM native audio selection unavailable '+error.name+'; keeping manifest selection');}
        } else if(native.indexOf(index)>=0){
            console.log('VM live audio selection kept in manifest id='+index+' nativeAudio='+native.join(','));
        } else {
            console.log('VM synthetic audio selection id='+index+' nativeAudio='+native.join(','));
        }
        driver.vmAudioTrack=index;
        driver.vmAudioGuardUntil=0;
    }
    function restoreAudioIndex(driver) {
        var identity=driver&&driver.vmAudioIdentity;
        if(!identity)return;
        var list=tracks(driver,false),match=null,i;
        if(identity.adaptationId)for(i=0;i<list.length;i++)if(String(list[i].adaptationId||'')===String(identity.adaptationId)){match=list[i];break;}
        if(!match&&identity.label)for(i=0;i<list.length;i++)if(list[i].label===identity.label){match=list[i];break;}
        if(!match&&identity.language)for(i=0;i<list.length;i++)if(list[i].language===identity.language){match=list[i];break;}
        if(match&&match.id!==driver.vmAudioTrack)selectAudioIndex(driver,match.id,true);
    }
    function selectText(driver,index) {
        if(!driver)throw Error('No active player');
        if(index!==null){
            var available=tracks(driver,true).some(function(track){return track.id===index;});
            if(!available)throw Error('Subtitle data is not available');
            // Samsung does not support setSelectTrack(TEXT) for DASH. Keep its
            // default text stream and render the silent-subtitle callbacks.
            if(driver._mimeType!=='application/dash+xml')api().setSelectTrack('TEXT',index);
        }
        api().setSilentSubtitle(true);
        restoreText(driver,index);
        preference(index!==null);
    }
    function tracks(driver, text) {
        if(text&&driver._mimeType==='application/dash+xml'&&window.vmSubtitles){
            var manifest=window.vmSubtitles.tracks(driver);
            if(manifest.length)return manifest;
            if(driver.vmTextAvailable)return [{id:0,language:'',label:'On',active:!!driver.vmTextVisible,audioRoles:[],roles:[],type:'text'}];
            // A real DASH text candidate is only a reason to probe it, not proof
            // that the programme has captions. Selection loads caption segments.
            var candidates=window.vmSubtitles.candidates?window.vmSubtitles.candidates(driver):[];
            if(candidates.length)return [{id:0,language:candidates[0].language,label:candidates[0].label||candidates[0].language||'Subtitles',active:!!driver.vmTextVisible,audioRoles:[],roles:[],type:'text'}];
            return [];
        }
        if(text&&!driver.vmTextAvailable)return [];
        if(text&&driver._mimeType==='application/dash+xml')return [{id:0,language:'',label:'On',active:!!driver.vmTextVisible,audioRoles:[],roles:[],type:'text'}];
        var items=[];
        try { items=api().getTotalTrackInfo(); } catch(ignore) {}
        var usedIndices={},nextId=0;
        items.forEach(function(item){if(typeof item.index==='number'){usedIndices[item.index]=true;if(item.index>=nextId)nextId=item.index+1;}});
        var result=[];
        items.forEach(function(item) {
            if (text ? item.type!=='TEXT' : item.type!=='AUDIO') return;
            var extra={};try{extra=JSON.parse(item.extra_info || '{}');}catch(ignore){}
            var language=extra.track_lang || extra.language || 'en';
            result.push({id:item.index,language:language,label:language,
                active:(!text || driver.vmTextVisible) && driver[text?'vmTextTrack':'vmAudioTrack']===item.index,
                audioRoles:[],roles:[],type:text?'text':'variant',audioCodec:'mp4a.40.2',extraInfo:item.extra_info||'{}'});
        });
        if(text&&driver.vmTextAvailable&&!result.length)result.push({id:0,language:'en',label:'English',active:!!driver.vmTextVisible});
        if(!text){
            var manifest=window.vmSubtitles&&window.vmSubtitles.audioTracks?window.vmSubtitles.audioTracks(driver):[],used={};
            if(manifest.length){
                result.forEach(function(item,index){
                    var extra={};try{extra=JSON.parse(item.extraInfo||'{}');}catch(ignore){}
                    var external=String(extra.adaptation_id||extra.adaptationId||extra.track_id||extra.id||'');
                    var match=null,i;
                    for(i=0;i<manifest.length;i++)if(external&&String(manifest[i].adaptationId)===external){match=manifest[i];break;}
                    if(!match&&manifest[index]&&!used[manifest[index].id])match=manifest[index];
                    if(!match)for(i=0;i<manifest.length;i++)if(!used[manifest[i].id]&&manifest[i].language===item.language){match=manifest[i];break;}
                    if(match&&!used[match.id]){
                        used[match.id]=true;item.label=match.label;item.language=match.language;
                        item.adaptationId=match.adaptationId;item.roles=match.roles||[];
                    }
                });
                manifest.forEach(function(track){
                    if(used[track.id])return;
                    used[track.id]=true;
                    while(usedIndices[nextId]||result.some(function(item){return item.id===nextId;}))nextId++;
                    var id=nextId++;
                    usedIndices[id]=true;
                    result.push({id:id,language:track.language,label:track.label,active:driver.vmAudioTrack===id,
                        audioRoles:[],roles:track.roles||[],type:'variant',audioCodec:'mp4a.40.2',adaptationId:track.adaptationId});
                });
            }
        }
        if (!text && !result.length) result.push({id:0,language:'en',label:'English',active:true,audioRoles:[],roles:[]});
        if (!text && !result.some(function(item){return item.active;})) result[0].active=true;
        return result;
    }
    function wrapTracks(driver) {
        if(driver.vmTracksWrapped || !driver.shaka)return;
        driver.vmTracksWrapped=true;
        function wrap(name, native) {
            var original=driver.shaka[name];
            driver.shaka[name]=function(){return driver.vmNative?native.apply(null,arguments):original.apply(driver.shaka,arguments);};
        }
        wrap('getVariantTracks',function(){return tracks(driver,false);});
        wrap('getTextTracks',function(){return tracks(driver,true);});
        wrap('selectVariantTrack',function(track){selectAudioIndex(driver,track.id);});
        wrap('selectTextTrack',function(track){selectText(driver,track.id);});
        wrap('selectAudioTrack',function(track){if(track)selectAudioIndex(driver,track.id);});
        wrap('selectAudioLanguage',function(language){
            var list=tracks(driver,false),track=list.filter(function(item){return item.language===language;})[0];
            if(track)selectAudioIndex(driver,track.id);
        });
        wrap('selectTextLanguage',function(language){
            var track=tracks(driver,true).filter(function(item){return item.language===language;})[0];
            if(track)selectText(driver,track.id);
        });
        wrap('setTextTrackVisibility',function(visible){var list=tracks(driver,true);selectText(driver,visible&&list.length?list[0].id:null);});
    }
    function close(driver) {
        driver.vmNativeGeneration=(driver.vmNativeGeneration || 0)+1;
        clearSubtitle(driver);driver.vmSubtitleCue='';driver.vmSubtitleImage=null;
        if(window.vmSubtitles)window.vmSubtitles.clear(driver);
        clearTimeout(driver.vmPrepareDeadline);
        driver.vmSeekPending=null;driver.vmAudioGuardUntil=0;
        driver.vmStallClock=null;driver.vmStallSince=0;driver.vmLiveRecoveryPending=false;
        if(activeDriver!==driver)return;
        // An abrupt app kill can leave Samsung's native playback active even
        // when getState() reports IDLE/NONE in the new process. Stop before
        // close unconditionally so no stale audio survives into the ad source.
        try{api().stop();}catch(ignore){}
        try{api().close();}catch(ignore){}
    }
    function reset(driver) {
        close(driver);
        if(activeDriver===driver){activeDriver=null;if(window.vmNativeOptions)window.vmNativeOptions.close();}
        if(window.vmQuality)window.vmQuality.clear(driver);
        (driver.vmNativeElements || []).forEach(function(element){if(element.parentNode)element.parentNode.removeChild(element);});
        (driver.vmBackgrounds || []).forEach(function(item){item.element.style.backgroundColor=item.value;});
        driver.vmNativeElements=[];driver.vmBackgrounds=[];
        delete driver._mediaElement;delete driver._sourceElement;
        driver.vmNative=false;driver.vmNativeRetired=true;driver._readyToPlayFrom=false;
        driver._source=driver._type=driver._mimeType=driver._pendingSource=undefined;
        driver._clearSentinels();
    }
    // After an abrupt kill, Samsung can keep the previous programme's native
    // audio output alive in a new process. Opening and tearing down the first
    // MP4 source once makes the native engine take over that output before the
    // ad itself starts.
    function takeOverNativeAudio(driver,source) {
        if(driver._mimeType==='application/dash+xml'||driver.vmNativeAudioTakeoverDone||!api())return Promise.resolve();
        var player=api(),settled=false,deadline;
        return new Promise(function(resolve){
            function finish(){
                if(settled)return;
                settled=true;clearTimeout(deadline);
                try{player.stop();}catch(ignore){}
                try{player.close();}catch(ignore){}
                driver.vmNativeAudioTakeoverDone=true;
                console.log('VM AVPlay native audio takeover complete');
                resolve();
            }
            try{
                console.log('VM AVPlay native audio takeover begin');
                try{player.stop();}catch(ignore){}
                try{player.close();}catch(ignore){}
                player.open(source);
                player.setListener({});
                player.prepareAsync(function(){
                    try{player.play();}catch(ignore){}
                    setTimeout(finish,200);
                },finish);
                deadline=setTimeout(finish,10000);
            }catch(error){
                console.log('VM AVPlay native audio takeover failed '+error.name);
                finish();
            }
        });
    }
    function stage(driver,type,source,mime,root) {
        activeDriver=driver;driver.vmOptionsRoot=root;driver.vmTextVisible=false;driver.vmTextAvailable=false;driver.vmSubtitleCue='';driver.vmSubtitleImage=null;driver.vmSubtitleRendered=null;driver.vmSubCueText=null;
        driver.vmSubtitleTrackId=null;driver.vmTextWanted=preference();driver.vmSubtitles=null;driver.vmVideoHeight=0;
        driver.vmNative=true;driver.vmNativeRetired=false;driver.vmNativeErrorReported=false;driver.vmHealthyPlayback=0;driver.vmPreviousClock=null;driver._clearSentinels();
        driver._type=type;driver._source=source;driver._mimeType=mime;driver._readyToPlayFrom=false;
        wrapTracks(driver);
        var video=document.createElement('video'),object=document.createElement('object');
        video.id='mediaPlayerVideo';video.style.display='none';
        object.type='application/avplayer';
        object.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;background:transparent;z-index:0';
        root.insertBefore(object,root.firstChild);root.insertBefore(video,root.firstChild);
        var caption=document.createElement('div');caption.id='vm-native-subtitle';caption.style.cssText='position:absolute;left:8%;bottom:9%;width:84%;text-align:center;white-space:pre-line;color:white;font:32px Arial,sans-serif;text-shadow:2px 2px 3px black,-2px -2px 3px black;background:transparent;z-index:2147483630;pointer-events:none';root.appendChild(caption);driver.vmSubtitleElement=caption;
        driver._mediaElement=video;driver.vmNativeElements=[video,object,caption];driver.vmBackgrounds=[];
        for(var element=root;element;element=element.parentNode){
            if(!element.style)continue;
            driver.vmBackgrounds.push({element:element,value:element.style.backgroundColor});
            element.style.backgroundColor='transparent';
        }
        driver._toStopped();
        console.log('VM AVPlay staged type='+mime);
    }
    function begin(driver,from) {
        var player=api(),video=driver._mediaElement,source=driver._source;
        var owner=driver.vmOwner,live=owner&&owner.isLive&&owner.isLive();
        var audioIdentity=driver.vmAudioIdentity;
        driver._postBufferingState='PLAYING';driver._toBuffering();
        close(driver);
        var generation=driver.vmNativeGeneration,completeScheduled=false,errorScheduled=false;
        driver.vmHealthyPlayback=0;driver.vmPreviousClock=null;
        function valid(){return driver.vmNative && driver.vmNativeGeneration===generation && driver._mediaElement===video;}
        function fail(code){
            if(!valid()||errorScheduled)return;
            errorScheduled=true;clearTimeout(driver.vmPrepareDeadline);
            console.log('VM AVPlay error '+String(code));reportState('failure',driver);notify('onerror',code);
            setTimeout(function(){if(valid())driver._toError('Could not start programme playback.');},0);
        }
        function status(time){
            if(!valid())return;
            var owner=driver.vmOwner;
            if(driver._mimeType==='application/dash+xml'&&owner&&owner.capturePlayhead&&owner.isLive&&!owner.isLive()&&owner.getAdPlaying&&!owner.getAdPlaying()&&(!driver.vmLastProgressSave||Date.now()-driver.vmLastProgressSave>=30000)){
                driver.vmLastProgressSave=Date.now();try{owner.capturePlayhead();}catch(ignore){}
            }
            if(driver.vmSeekPending&&driver.vmSeekPending.completed){
                console.log('VM AVPlay seek first timestamp id='+driver.vmSeekPending.id+' time='+time/1000);driver.vmSeekPending=null;
            }
            var now=Date.now(),previous=driver.vmPreviousClock;
            if(previous){var delta=(time-previous.time)/1000;if(delta>0&&delta<=(now-previous.at)/1000+1)driver.vmHealthyPlayback+=delta;else driver.vmHealthyPlayback=0;}
            driver.vmPreviousClock={time:time,at:now};
            if(driver.vmHealthyPlayback>=60&&driver.vmOwner)driver.vmOwner.vmNativeRecoveryCount=0;
            // Samsung's old DASH engine can stop advancing across a live Period
            // boundary while still reporting PLAYING. The caption renderer adopts
            // the new Period and keeps emitting cues, so the visible symptom is
            // replaying/frozen video with normal subtitles. Reopen the same live
            // source once from the current edge after a sustained native stall;
            // this is reactive recovery, not a proactive refresh timer.
            if(live&&player.getState()==='PLAYING'&&time>0){
                var stalled=driver.vmStallClock;
                if(typeof stalled!=='number'||time>stalled+500){
                    driver.vmStallClock=time;driver.vmStallSince=now;
                } else if(!driver.vmLiveRecoveryPending&&now-(driver.vmStallSince||now)>=10000){
                    var budget=owner.vmNativeRecoveryCount||0;
                    if(budget<2){
                        owner.vmNativeRecoveryCount=budget+1;
                        driver.vmLiveRecoveryPending=true;
                        console.log('VM AVPlay live stall recovery after='+Math.round((now-driver.vmStallSince)/1000)+'s time='+Math.round(time/1000));
                        reportState('live-stall-restart',driver);
                        setTimeout(function(){if(valid())begin(driver,0);},0);
                    }
                }
            } else {
                driver.vmStallClock=null;driver.vmStallSince=0;
            }
            if(previous&&time>previous.time&&driver.getState&&driver.getState()==='BUFFERING'&&player.getState()==='PLAYING')driver._toPlaying();
            notify("oncurrentplaytime",time);driver._onStatus();
            if(!driver.vmLastNativeProgress || Date.now()-driver.vmLastNativeProgress>12000){
                driver.vmLastNativeProgress=Date.now();
                console.log('VM AVPlay progress time='+Math.round(time/1000)+' state='+player.getState()+' duration='+Math.round(duration(driver)));
            }
            if(window.vmSubtitles&&driver._mimeType==='application/dash+xml'){
                try{window.vmSubtitles.tick(driver,time/1000);}catch(ignore){}
            }
        }
        // The preceding MP4 ad was owned by Shaka. Native playback starts only
        // after its detach and video release have completed.
        Promise.resolve(driver.vmDetach).then(function(){if(!valid())return;return sourceUrl(driver,source);}).then(function(playbackSource){
            if(!valid())return;
            var quality=window.vmQuality?window.vmQuality.resolve(driver,playbackSource):Promise.resolve();
            var subtitles=window.vmSubtitles?window.vmSubtitles.begin(driver,playbackSource):Promise.resolve();
            return Promise.all([quality,subtitles]).then(function(){return playbackSource;});
        }).then(function(playbackSource){
            if(!valid())return;
            return takeOverNativeAudio(driver,playbackSource).then(function(){return playbackSource;});
        }).then(function(playbackSource){
            if(!valid())return;
            try {
                if(window.vmCaptureSource)window.vmCaptureSource(playbackSource,driver.vmOwner&&driver.vmOwner.isLive&&driver.vmOwner.isLive());
                player.open(playbackSource);
                // Callback mode must be configured while IDLE: READY after
                // prepareAsync is not a supported state for this call.
                try{player.setSilentSubtitle(true);}catch(error){console.log('VM native subtitle callback mode unavailable '+error.name);}
                if(window.vmQuality)window.vmQuality.apply(driver,player);
                player.setListener({
                    onbufferingstart:function(){if(!valid())return;driver.vmBufferStart=Date.now();driver.vmBufferBucket=-1;reportState('buffering-start',driver);driver._toBuffering();},
                    onbufferingprogress:function(percent){if(!valid())return;var bucket=Math.floor(Number(percent)/25);if(bucket!==driver.vmBufferBucket){driver.vmBufferBucket=bucket;console.log('VM AVPlay buffering percent='+percent);}},
                    onbufferingcomplete:function(){if(!valid())return;console.log('VM AVPlay buffering elapsedMs='+(driver.vmBufferStart?Date.now()-driver.vmBufferStart:0));driver.vmBufferStart=null;reportState('buffering-complete',driver);var nativeState=player.getState();if(nativeState==='PLAYING')driver._toPlaying();else if(nativeState==='PAUSED'&&driver.getState&&driver.getState()==='BUFFERING')driver._toPaused();},
                    oncurrentplaytime:status,
                    onsubtitlechange:function(ms,text,type,attributes){if(valid())subtitle(driver,ms,text,type);},
                    onstreamcompleted:function(){
                        if(!valid() || completeScheduled)return;
                        completeScheduled=true;notify('onstreamcompleted');
                        setTimeout(function(){if(valid())driver._toComplete();},0);
                    },
                    onerror:fail,
                    onerrormsg:function(code,message){
                        if(!valid())return;
                        var data={};try{data=JSON.parse(message);}catch(ignore){}
                        var fields=[];['error_code','codec','demux','resolution','fps'].forEach(function(key){
                            if(typeof data[key]==='string'||typeof data[key]==='number')fields.push(key+'='+String(data[key]).replace(/[^a-zA-Z0-9_.,x -]/g,'').slice(0,70));
                        });
                        console.log('VM AVPlay error-detail code='+String(code).replace(/[^a-zA-Z0-9_]/g,'').slice(0,70)+' '+fields.join(' '));reportState('error-detail',driver);
                    },
                    onevent:function(type){
                        if(valid() && /BITRATE|RESOLUTION|STREAMING/.test(String(type)))console.log('VM AVPlay event '+String(type));
                        if(valid() && /RESOLUTION|BITRATE/.test(String(type)))reportVideo();
                    },
                    ondrmevent:function(type,data){
                        if(!valid())return;
                        data=data || {};
                        console.log('VM AVPlay DRM type='+type+' name='+(data.name || '')+' code='+(data.error_code || data.code || ''));
                    }
                });
                player.setDisplayRect(0,0,1920,1080);
                if(driver.vmLicenseServer && driver._mimeType==='application/dash+xml'){
                    player.setDrm('PLAYREADY','SetProperties',JSON.stringify({
                        DeleteLicenseAfterUse:true,LicenseServer:driver.vmLicenseServer
                    }));
                    console.log('VM AVPlay PlayReady configured');
                }
                driver.vmPrepareDeadline=setTimeout(function(){fail('prepare timeout');},30000);
                player.prepareAsync(function(){
                    if(!valid()||errorScheduled)return;
                    clearTimeout(driver.vmPrepareDeadline);
                    driver._readyToPlayFrom=true;
                    function play(){
                        if(!valid()||errorScheduled)return;
                        player.play();driver._toPlaying();
                        console.log('VM AVPlay prepared and playing type='+driver._mimeType);reportState('prepared',driver);
                        reportVideo();
                        // Shaka's old track handler reselects the first variant on
                        // manifestloaded. Keep the user's audio choice across the
                        // source restart, then map it onto the new native indices.
                        if(audioIdentity)driver.vmAudioGuardUntil=Date.now()+1500;
                        window.dispatchEvent(new Event('manifestloaded'));
                        if(audioIdentity){
                            setTimeout(function(){if(valid())restoreAudioIndex(driver);},0);
                            setTimeout(function(){driver.vmAudioGuardUntil=0;},1500);
                        }
                    }
                    // Live DASH rejects a seek back to the position captured
                    // before the source restart. Reopening the same live source
                    // already joins the current edge, so only VOD resumes by seek.
                    if(typeof from==='number'&&from>0&&!live)requestSeek(driver,from,'beginPlaybackFrom',play,function(){fail('resume seek failed');});
                    else {
                        if(live&&typeof from==='number'&&from>0)console.log('VM AVPlay live restart resumes at current edge');
                        play();
                    }
                },function(error){fail(error && error.name || 'prepare failed');});
            } catch(error) {fail(error.name || 'open failed');}
        }).catch(function(error){fail(error.message || 'source failed');});
    }
    function stop(driver){close(driver);driver._toStopped();}
    function pause(driver){try{api().pause();driver._toPaused();}catch(error){console.log('VM AVPlay pause '+error.name);}}
    function resume(driver){try{api().play();driver._toPlaying();}catch(error){console.log('VM AVPlay resume '+error.name);}}
    function seek(driver,seconds){requestSeek(driver,seconds,'playFrom');}
    window.vmAvPlay={wants:wants,mseSupported:mseSupported,config:config,stage:stage,begin:begin,stop:stop,reset:reset,
        pause:pause,resume:resume,seek:seek,current:current,duration:duration,
        active:function(){return activeDriver&&activeDriver.vmNative?activeDriver:null;},
        audioTracks:function(){return activeDriver?tracks(activeDriver,false):[];},
        textTracks:function(){return activeDriver?tracks(activeDriver,true):[];},
        cue:function(driver,ms,text){if(driver&&driver.vmNative)subtitle(driver,ms,text,'0');},
        selectAudio:function(index){selectAudioIndex(activeDriver,index,true);},
        restoreText:function(driver,index){restoreText(driver,index);},
        selectText:function(index){selectText(activeDriver,index);}
    };
}());
