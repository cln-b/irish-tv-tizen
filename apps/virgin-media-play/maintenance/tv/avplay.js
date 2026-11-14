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
    function wants(mime) { return (mime === 'application/dash+xml' || mime === 'video/mp4') && !!api(); }
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
    function clearSubtitle(driver) {
        clearTimeout(driver.vmSubtitleTimer);
        if(driver.vmSubtitleElement)driver.vmSubtitleElement.textContent='';
    }
    function subtitle(driver, milliseconds, value, type) {
        if(String(type||'0')!=='0')return;
        var text=String(value||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').trim();
        // Decode entities without putting upstream markup in the document.
        var decoder=document.createElement('textarea');decoder.innerHTML=text;text=decoder.value||decoder.textContent||text;
        clearSubtitle(driver);driver.vmSubtitleCue=text;
        if(!text)return;
        if(!driver.vmTextAvailable){driver.vmTextAvailable=true;console.log('VM native subtitle data received');if(window.vmNativeOptions&&window.vmNativeOptions.refresh)window.vmNativeOptions.refresh();}
        if(driver.vmTextVisible)driver.vmSubtitleElement.textContent=text;
        driver.vmSubtitleTimer=setTimeout(function(){driver.vmSubtitleCue='';clearSubtitle(driver);},Math.max(100,Number(milliseconds)||3000));
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
        driver.vmTextTrack=index;driver.vmTextVisible=index!==null;
        if(driver.vmSubtitleElement)driver.vmSubtitleElement.textContent=driver.vmTextVisible?(driver.vmSubtitleCue||''):'';
    }
    function tracks(driver, text) {
        if(text&&!driver.vmTextAvailable)return [];
        if(text&&driver._mimeType==='application/dash+xml')return [{id:0,language:'',label:'On',active:!!driver.vmTextVisible}];
        var items=[];
        try { items=api().getTotalTrackInfo(); } catch(ignore) {}
        var result=[];
        items.forEach(function(item) {
            if (text ? item.type!=='TEXT' : item.type!=='AUDIO') return;
            var extra={};try{extra=JSON.parse(item.extra_info || '{}');}catch(ignore){}
            var language=extra.track_lang || extra.language || 'en';
            result.push({id:item.index,language:language,label:language,
                active:(!text || driver.vmTextVisible) && driver[text?'vmTextTrack':'vmAudioTrack']===item.index,
                audioRoles:[],roles:[],type:text?'text':'variant',audioCodec:'mp4a.40.2'});
        });
        if(text&&driver.vmTextAvailable&&!result.length)result.push({id:0,language:'en',label:'English',active:!!driver.vmTextVisible});
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
        wrap('selectVariantTrack',function(track){api().setSelectTrack('AUDIO',track.id);driver.vmAudioTrack=track.id;});
        wrap('selectTextTrack',function(track){selectText(driver,track.id);});
        wrap('selectAudioTrack',function(track){if(track){api().setSelectTrack('AUDIO',track.id);driver.vmAudioTrack=track.id;}});
        wrap('selectAudioLanguage',function(language){
            var list=tracks(driver,false),track=list.filter(function(item){return item.language===language;})[0];
            if(track){api().setSelectTrack('AUDIO',track.id);driver.vmAudioTrack=track.id;}
        });
        wrap('selectTextLanguage',function(language){
            var track=tracks(driver,true).filter(function(item){return item.language===language;})[0];
            if(track)selectText(driver,track.id);
        });
        wrap('setTextTrackVisibility',function(visible){var list=tracks(driver,true);selectText(driver,visible&&list.length?list[0].id:null);});
    }
    function close(driver) {
        driver.vmNativeGeneration=(driver.vmNativeGeneration || 0)+1;
        clearSubtitle(driver);driver.vmSubtitleCue='';
        clearTimeout(driver.vmPrepareDeadline);
        driver.vmSeekPending=null;
        if(activeDriver!==driver)return;
        try {
            var state=api().getState();
            if(state==='PLAYING'||state==='PAUSED'||state==='READY')api().stop();
        } catch(ignore) {}
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
    function stage(driver,type,source,mime,root) {
        activeDriver=driver;driver.vmOptionsRoot=root;driver.vmTextVisible=false;driver.vmTextAvailable=false;driver.vmSubtitleCue='';driver.vmVideoHeight=0;
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
            if(previous&&time>previous.time&&driver.getState&&driver.getState()==='BUFFERING'&&player.getState()==='PLAYING')driver._toPlaying();
            notify("oncurrentplaytime",time);driver._onStatus();
            if(!driver.vmLastNativeProgress || Date.now()-driver.vmLastNativeProgress>12000){
                driver.vmLastNativeProgress=Date.now();
                console.log('VM AVPlay progress time='+Math.round(time/1000)+' state='+player.getState()+' duration='+Math.round(duration(driver)));
            }
        }
        // The preceding MP4 ad was owned by Shaka. Native playback starts only
        // after its detach and video release have completed.
        Promise.resolve(driver.vmDetach).then(function(){if(!valid())return;return sourceUrl(driver,source);}).then(function(playbackSource){
            if(!valid())return;
            return window.vmQuality?window.vmQuality.resolve(driver,playbackSource).then(function(){return playbackSource;}):playbackSource;
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
                    onbufferingcomplete:function(){if(!valid())return;console.log('VM AVPlay buffering elapsedMs='+(driver.vmBufferStart?Date.now()-driver.vmBufferStart:0));driver.vmBufferStart=null;reportState('buffering-complete',driver);if(player.getState()==='PLAYING')driver._toPlaying();},
                    oncurrentplaytime:status,
                    onsubtitlechange:function(ms,text,type){if(valid())subtitle(driver,ms,text,type);},
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
                        window.dispatchEvent(new Event('manifestloaded'));
                    }
                    if(typeof from==='number'&&from>0)requestSeek(driver,from,'beginPlaybackFrom',play,function(){fail('resume seek failed');});
                    else play();
                },function(error){fail(error && error.name || 'prepare failed');});
            } catch(error) {fail(error.name || 'open failed');}
        }).catch(function(error){fail(error.message || 'source failed');});
    }
    function stop(driver){close(driver);driver._toStopped();}
    function pause(driver){try{api().pause();driver._toPaused();}catch(error){console.log('VM AVPlay pause '+error.name);}}
    function resume(driver){try{api().play();driver._toPlaying();}catch(error){console.log('VM AVPlay resume '+error.name);}}
    function seek(driver,seconds){requestSeek(driver,seconds,'playFrom');}
    window.vmAvPlay={wants:wants,config:config,stage:stage,begin:begin,stop:stop,reset:reset,
        pause:pause,resume:resume,seek:seek,current:current,duration:duration,
        active:function(){return activeDriver&&activeDriver.vmNative?activeDriver:null;},
        audioTracks:function(){return activeDriver?tracks(activeDriver,false):[];},
        textTracks:function(){return activeDriver?tracks(activeDriver,true):[];},
        selectAudio:function(index){api().setSelectTrack('AUDIO',index);activeDriver.vmAudioTrack=index;},
        selectText:function(index){selectText(activeDriver,index);}
    };
}());
