// TAL uses the HbbTV Back code; the Samsung native remote sends 10009.
(function () {
    function translate(event) {
        if(event.keyCode!==10009 || event.vmTranslated)return;
        event.preventDefault();event.stopImmediatePropagation();
        var mapped=document.createEvent('Event');
        mapped.initEvent(event.type,true,true);
        Object.defineProperty(mapped,'keyCode',{value:461});
        Object.defineProperty(mapped,'which',{value:461});
        mapped.vmTranslated=true;
        (event.target || document).dispatchEvent(mapped);
        console.log('VM remote Return translated');
    }
    document.addEventListener('keydown',translate,true);
    document.addEventListener('keyup',translate,true);
}());
