(function () {
  var worldwideId = '6384196213112';
  var protectedIds = ['6383454185112', '6383455473112'];
  var lastStream = null;

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function regionIsWorldwide(stream) { return String(stream && stream.region || '').toUpperCase() === 'WW'; }
  function isProtected(stream) { return protectedIds.indexOf(String(stream && stream.streamId)) >= 0; }
  function isOnDemand(stream) { return String(stream && stream.stream || '') === 'ONDEMAND'; }
  function playable(stream) {
    if (!stream || !stream.streamId) return false;
    return ['UPCOMING', 'DISABLED', 'OFFAIR'].indexOf(String(stream.state)) < 0;
  }
  // The ONDEMAND pop-up is a separate clear video ID, distinct from the
  // protected live channels. TG4 may label it IOI or WW; the frontend greys it
  // out while UPCOMING/DISABLED and opens it when playable.
  function keepApiStream(stream) {
    if (!stream || isProtected(stream)) return false;
    if (isOnDemand(stream)) return !!stream.streamId;
    return playable(stream) && regionIsWorldwide(stream);
  }
  function matches(stream, id, offset) {
    return String(stream && stream.streamId) === id && Number(stream && stream.offsetSeconds || 0) === offset;
  }
  function find(streams, predicate) {
    var i;
    for (i = 0; i < streams.length; i++) if (predicate(streams[i])) return streams[i];
    return null;
  }
  // Ireland metadata supplies programme details; identity and token come from
  // the clear Worldwide provider. currentShow, nextShow, artwork and times pass through.
  function synthesise(source, offset) {
    var channel = copy(source);
    channel.streamId = worldwideId;
    channel.region = 'WW';
    channel.offsetSeconds = offset;
    delete channel.liveToken;
    if (!channel.stream) channel.stream = 'TG4';
    return channel;
  }

  function mapStreams(streams) {
    var input = streams || [], output = [], apiStreams = [], i, stream;
    var primary, plusOne, source, seen = {}, key, deduped = [];

    for (i = 0; i < input.length; i++) {
      stream = input[i];
      if (!keepApiStream(stream)) continue;
      apiStreams.push(copy(stream));
    }
    primary = find(apiStreams, function (item) { return matches(item, worldwideId, 0); });
    plusOne = find(apiStreams, function (item) { return matches(item, worldwideId, 3600); });

    if (!primary) {
      source = find(input, function (item) {
        return playable(item) && matches(item, worldwideId, 0) && regionIsWorldwide(item);
      });
      if (!source) source = find(input, function (item) {
        return playable(item) && String(item.stream) === 'TG4' && Number(item.offsetSeconds || 0) === 0;
      });
      if (!source) source = find(input, function (item) {
        return playable(item) && String(item.stream) === 'TG4';
      });
      if (source) primary = synthesise(source, 0);
    }

    if (!plusOne) {
      source = find(input, function (item) {
        return playable(item) && String(item.stream) === 'TG4PLUSONE' && Number(item.offsetSeconds || 0) === 3600;
      });
      if (!source) source = find(input, function (item) {
        return playable(item) && String(item.stream) === 'TG4PLUSONE' && Number(item.offsetSeconds || 0) > 0;
      });
      if (source) plusOne = synthesise(source, Number(source.offsetSeconds || 0) || 3600);
    }

    if (primary) output.push(primary);
    if (plusOne) output.push(plusOne);
    for (i = 0; i < apiStreams.length; i++) {
      stream = apiStreams[i];
      if (matches(stream, worldwideId, 0) || matches(stream, worldwideId, 3600)) continue;
      output.push(stream);
    }
    for (i = 0; i < output.length; i++) {
      key = String(output[i].streamId) + ':' + Number(output[i].offsetSeconds || 0);
      if (seen[key]) continue;
      seen[key] = true;
      deduped.push(output[i]);
    }
    return {streams: deduped, primary: primary};
  }

  window.tg4Worldwide = {
    providerId: worldwideId,
    lastStream: function () { return lastStream ? copy(lastStream) : null; },
    epg: function (response) {
      var result = copy(response), mapped = mapStreams(response.streams || []);
      result.streams = mapped.streams;
      lastStream = mapped.primary ? copy(mapped.primary) : null;
      return result;
    },
    homeRails: function (rails) {
      // Replace API LIVE rails with one clear rail. Reuse each API stream's
      // currentShow, nextShow, artwork and times unchanged.
      var result = [], candidates = [], i, j, rail, items, mapped, fallback;

      for (i = 0; i < (rails || []).length; i++) {
        rail = rails[i];
        if (rail && rail.type === 'LIVE') {
          items = rail.items || [];
          for (j = 0; j < items.length; j++) if (items[j] && items[j].stream) candidates.push(items[j].stream);
          continue;
        }
        result.push(copy(rail));
      }
      if (!candidates.length && lastStream) candidates.push(copy(lastStream));
      if (!candidates.length) {
        fallback = {stream: 'TG4', streamId: worldwideId, region: 'WW', state: 'ONAIR', offsetSeconds: 0, currentShow: {title: 'Live'}};
        candidates.push(fallback);
      }
      mapped = mapStreams(candidates);
      result.push({
        id: 'tg4-live-rail',
        type: 'LIVE',
        titleEn: '',
        titleGa: '',
        subtitleEn: '',
        subtitleGa: '',
        items: mapped.streams.map(function (stream) { return {type: 'LIVE_STREAM', stream: stream}; })
      });
      return result;
    }
  };
}());
