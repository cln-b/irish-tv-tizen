(function () {
  var worldwideId = '6384196213112';
  var lastStream = null;
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function normalise(stream) {
    var channel = copy(stream), ownToken = String(stream.streamId) === worldwideId;
    channel.stream = 'TG4';
    channel.streamId = worldwideId;
    channel.region = 'WW';
    channel.offsetSeconds = 0;
    // An Ireland token belongs to the Ireland stream; keep a token that is
    // already the Worldwide channel's own token.
    if (!ownToken) delete channel.liveToken;
    return channel;
  }
  function pick(streams) {
    var i;
    for (i = 0; i < streams.length; i++) {
      if (String(streams[i].streamId) === worldwideId && !streams[i].offsetSeconds) return streams[i];
    }
    for (i = 0; i < streams.length; i++) {
      if (streams[i].stream === 'TG4' && !streams[i].offsetSeconds) return streams[i];
    }
    return streams.length ? streams[0] : null;
  }
  // currentShow, nextShow, artwork and times stay as supplied by the API.
  window.tg4Worldwide = {
    providerId: worldwideId,
    lastStream: function () { return lastStream ? copy(lastStream) : null; },
    epg: function (response) {
      var result = copy(response), streams = response.streams || [], selected = pick(streams);
      result.streams = [];
      if (!selected) { lastStream = null; return result; }
      var channel = normalise(selected);
      result.streams.push(channel);
      lastStream = copy(channel);
      return result;
    },
    homeRails: function (rails) {
      // Replace API LIVE rail with one tile. Reuse the API stream's metadata
      // (currentShow, nextShow, artwork, times) unchanged
      var result = [], candidates = [], i, j, rail, items, stream, selected;
      for (i = 0; i < (rails || []).length; i++) {
        rail = rails[i];
        if (rail && rail.type === 'LIVE') {
          items = rail.items || [];
          for (j = 0; j < items.length; j++) if (items[j] && items[j].stream) candidates.push(items[j].stream);
          continue;
        }
        result.push(copy(rail));
      }
      selected = pick(candidates);
      stream = selected ? normalise(selected) : (lastStream ? copy(lastStream) : normalise({currentShow:{title:'Live'}}));
      result.push({id:'tg4-live-rail',type:'LIVE',titleEn:'',titleGa:'',subtitleEn:'',subtitleGa:'',items:[{type:'LIVE_STREAM',stream:stream}]});
      return result;
    }
  };
}());
