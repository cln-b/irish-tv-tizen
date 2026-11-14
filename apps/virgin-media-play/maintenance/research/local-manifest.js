// A metadata-only continuous MPD view. Native AVPlay still fetches/decrypts
// every original media fragment directly. No media bytes are rewritten.
(function(){
 var NS='urn:mpeg:dash:schema:mpd:2011',resolver=document.implementation.createHTMLDocument(''),resolverBase=resolver.createElement('base'),resolverLink=resolver.createElement('a');resolver.head.appendChild(resolverBase);
 function name(node){return (node.localName||node.nodeName).split(':').pop();}
 function children(node,tag){var out=[];for(var i=0;i<node.childNodes.length;i++){var child=node.childNodes[i];if(child.nodeType===1&&(!tag||name(child)===tag))out.push(child);}return out;}
 function first(node,tag){return children(node,tag)[0]||null;}
 function seconds(value){var m=/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value||'');if(!m)throw Error('Unsupported period time');return Number(m[1]||0)*86400+Number(m[2]||0)*3600+Number(m[3]||0)*60+Number(m[4]||0);}
 function absolute(base,path){resolverBase.href=base;resolverLink.href=path;return resolverLink.href;}
 function baseFor(base,node){var b=first(node,'BaseURL');return b?absolute(base,(b.textContent||'').trim()):base;}
 function protection(node){return children(node,'ContentProtection').map(function(x){return new XMLSerializer().serializeToString(x);}).join('');}
 function describe(root,period,source){
  var list=[],periodBase=baseFor(baseFor(source,root),period),start=seconds(period.getAttribute('start')||'PT0S');
  children(period,'AdaptationSet').forEach(function(adaptation){
   var adaptationBase=baseFor(periodBase,adaptation);
   children(adaptation,'Representation').forEach(function(rep){
    var template=first(rep,'SegmentTemplate')||first(adaptation,'SegmentTemplate');
    if(!template||!first(template,'SegmentTimeline'))throw Error('Unsupported segment addressing');
    var scale=Number(template.getAttribute('timescale')||1),pto=Number(template.getAttribute('presentationTimeOffset')||0),base=baseFor(adaptationBase,rep);
    var key=[adaptation.getAttribute('id'),adaptation.getAttribute('mimeType'),adaptation.getAttribute('lang'),rep.getAttribute('id')].join('|');
    var init=absolute(base,template.getAttribute('initialization')),media=absolute(base,template.getAttribute('media'));
    var signature=[init,media,rep.getAttribute('codecs')||adaptation.getAttribute('codecs'),rep.getAttribute('bandwidth'),rep.getAttribute('width'),rep.getAttribute('height'),rep.getAttribute('frameRate'),rep.getAttribute('audioSamplingRate'),scale,protection(adaptation),protection(rep)].join('\n');
    var entries=[],number=Number(template.getAttribute('startNumber')||1),time=null;
    children(first(template,'SegmentTimeline'),'S').forEach(function(s){
     if(s.hasAttribute('t'))time=Number(s.getAttribute('t'));
     if(time===null)throw Error('Missing first segment clock');
     var duration=Number(s.getAttribute('d')),repeat=Number(s.getAttribute('r')||0);
     if(!isFinite(time)||!isFinite(number)||!isFinite(duration)||!isFinite(repeat)||duration<=0||repeat<0||repeat>1000||Math.floor(repeat)!==repeat)throw Error('Unsupported segment repeat');
     for(var i=0;i<=repeat;i++){entries.push({number:number++,time:time,duration:duration});time+=duration;}
    });
    if(!entries.length)throw Error('Empty segment timeline');
    list.push({key:key,rep:rep,template:template,scale:scale,pto:pto,start:start,signature:signature,init:init,media:media,entries:entries});
   });
  });return list;
 }
 function transform(xml,source,state){
  var doc=new DOMParser().parseFromString(xml,'application/xml'),root=doc.documentElement;
  if(!root||name(root)!=='MPD'||doc.getElementsByTagName('parsererror').length||root.getAttribute('type')!=='dynamic')throw Error('Invalid live manifest');
  var periods=children(root,'Period');if(!periods.length)throw Error('Missing period');
  var groups=periods.map(function(p){return describe(root,p,source);}),initial=groups[0];
  if(!state.anchor){
   state.anchor={start:periods[0].getAttribute('start')||'PT0S',seconds:initial[0].start,tracks:{},utc:{}};
   initial.forEach(function(t){state.anchor.tracks[t.key]={pto:t.pto,scale:t.scale,offset:t.start-t.pto/t.scale,signature:t.signature};});
   children(periods[0],'SupplementalProperty').forEach(function(p){state.anchor.utc[p.getAttribute('schemeIdUri')]=p.getAttribute('value');});
  }
  var anchor=state.anchor,output=periods[0].cloneNode(true),merged={},count=Object.keys(anchor.tracks).length;
  groups.forEach(function(group){
   if(group.length!==count)throw Error('Representation set changed');
   group.forEach(function(t){
    var ref=anchor.tracks[t.key];if(!ref||ref.signature!==t.signature||Math.abs(t.start-t.pto/t.scale-ref.offset)>.05)throw Error('Incompatible period');
    var dest=merged[t.key]||(merged[t.key]=[]);
    t.entries.forEach(function(entry){var last=dest[dest.length-1];if(last&&entry.number===last.number&&entry.time===last.time&&entry.duration===last.duration)return;
     if(last&&(entry.number!==last.number+1||entry.time<last.time+last.duration))throw Error('Segment identity or numbering discontinuity');dest.push(entry);
    });
   });
  });
  output.setAttribute('id','vm-continuous');output.setAttribute('start',anchor.start);output.removeAttribute('duration');
  describe(root,output,source).forEach(function(t){
   var ref=anchor.tracks[t.key],entries=merged[t.key],template=t.template.cloneNode(true),timeline=doc.createElementNS(NS,'SegmentTimeline');
   children(template,'SegmentTimeline').forEach(function(node){template.removeChild(node);});
   template.setAttribute('initialization',t.init);template.setAttribute('media',t.media);template.setAttribute('presentationTimeOffset',String(ref.pto));template.setAttribute('startNumber',String(entries[0].number));
   entries.forEach(function(entry){var s=doc.createElementNS(NS,'S');s.setAttribute('t',String(entry.time));s.setAttribute('d',String(entry.duration));timeline.appendChild(s);});
   template.appendChild(timeline);
   // Put a template on each Representation so shared adaptation templates
   // cannot accidentally be replaced with another representation's timeline.
   var old=first(t.rep,'SegmentTemplate');if(old)t.rep.removeChild(old);t.rep.appendChild(template);
  });
  children(output,'AdaptationSet').forEach(function(a){children(a,'SegmentTemplate').forEach(function(t){a.removeChild(t);});});
  // Preserve event payloads and their absolute presentation times. The SCTE
  // UTC mapping must remain tied to the pinned Period, not the newest period.
  children(output,'EventStream').forEach(function(e){output.removeChild(e);});
  periods.forEach(function(p){var delta=seconds(p.getAttribute('start')||'PT0S')-anchor.seconds;
   children(p,'EventStream').forEach(function(original){var es=original.cloneNode(true),scale=Number(es.getAttribute('timescale')||1);
    children(es,'Event').forEach(function(event){event.setAttribute('presentationTime',String(Number(event.getAttribute('presentationTime')||0)+Math.round(delta*scale)));});output.insertBefore(es,first(output,'AdaptationSet'));
   });
  });
  children(output,'SupplementalProperty').forEach(function(p){var scheme=p.getAttribute('schemeIdUri');
   if(scheme==='urn:scte:dash:utc-time'&&anchor.utc[scheme])p.setAttribute('value',anchor.utc[scheme]);
   if(/period-(continuity|connectivity)/.test(scheme))output.removeChild(p);
  });
  root.replaceChild(output,periods[0]);periods.slice(1).forEach(function(p){root.removeChild(p);});
  // All media/init references have been resolved to the original CDN. A
  // remote Location would make AVPlay abandon the local manifest on refresh.
  var all=Array.prototype.slice.call(root.getElementsByTagName('*'));
  all.forEach(function(node){if(node.namespaceURI===NS&&(name(node)==='BaseURL'||name(node)==='Location'))node.parentNode.removeChild(node);});
  root.removeAttribute('mediaPresentationDuration');
  return new XMLSerializer().serializeToString(doc);
 }
 window.vmLocalManifest={transform:transform,describe:describe};
}());
