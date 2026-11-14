export function avplayHooks(text) {
    function hook(signature,body){
        if(text.split(signature).length!==2)throw Error('AVPlay integration changed: '+signature);
        text=text.replace(signature,signature+body);
    }
    hook('initMediaElement:function(t,i,n){',
        'if(window.vmAvPlay&&window.vmAvPlay.wants(n)){window.vmAvPlay.stage(this,t,i,n,e.getCurrentApplication().getRootWidget().outputElement);return;}this.vmNativeRetired=false;this.vmNativeErrorReported=false;');
    hook('_reportError:function _reportError(e){','if(this.vmNativeRetired){if(this.vmNativeErrorReported)return;this.vmNativeErrorReported=true;}');
    hook('configure:function configure(e){','if(window.vmAvPlay)window.vmAvPlay.config(this,e);');
    hook('beginPlayback:function beginPlayback(){','if(this.vmNative)return window.vmAvPlay.begin(this);');
    hook('beginPlaybackFrom:function beginPlaybackFrom(e){','if(this.vmNative)return window.vmAvPlay.begin(this,e);');
    hook('playFrom:function playFrom(e){','if(this.vmNative)return window.vmAvPlay.seek(this,e);');
    hook('pause:function pause(){','if(this.vmNative)return window.vmAvPlay.pause(this);');
    hook('resume:function(){','if(this.vmNative)return window.vmAvPlay.resume(this);');
    hook('stop:function stop(){','if(this.vmNative)return window.vmAvPlay.stop(this);');
    hook('reset:function reset(){','if(this.vmNative){window.vmAvPlay.reset(this);this._state=i.STATE.EMPTY;return;}');
    hook('_wipe:function _wipe(){','if(this.vmNative)return window.vmAvPlay.reset(this);');
    hook('getCurrentTime:function getCurrentTime(){','if(this.vmNative)return window.vmAvPlay.current(this);');
    hook('_getMediaDuration:function _getMediaDuration(){','if(this.vmNative)return window.vmAvPlay.duration(this);');
    hook('_getSeekableRange:function _getSeekableRange(){',
        'if(this.vmNative)return {start:0,end:Math.max(window.vmAvPlay.duration(this),window.vmAvPlay.current(this))};');
    hook('_setSentinels:function _setSentinels(e){','if(this.vmNative){this._clearSentinels();return;}');
    return text;
}
