(function () {
  var worldwideId = '6384196213112';
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function programme(show) {
    if (!show) return show;
    var result = copy(show);
    if (result.availability && result.availability !== 'WORLDWIDE') {
      result.title = result.seriesTitle = 'TG4 Worldwide';
      result.descriptionEn = 'Some programmes are unavailable on the worldwide feed.';
      result.descriptionGa = result.descriptionEn;
    } else {
      result.title = 'TG4 Worldwide · ' + (result.title || result.seriesTitle || 'Live');
      result.seriesTitle = result.title;
    }
    return result;
  }
  window.tg4Worldwide = {
    providerId: worldwideId,
    epg: function (response) {
      var result = copy(response), streams = response.streams || [], selected = null, i;
      for (i = 0; i < streams.length; i++) {
        if (String(streams[i].streamId) === worldwideId && !streams[i].offsetSeconds) { selected = streams[i]; break; }
      }
      if (!selected) for (i = 0; i < streams.length; i++) {
        if (streams[i].stream === 'TG4' && !streams[i].offsetSeconds) { selected = streams[i]; break; }
      }
      result.streams = [];
      if (!selected) return result;
      var channel = copy(selected), ownToken = String(selected.streamId) === worldwideId;
      channel.stream = 'TG4';
      channel.streamId = worldwideId;
      channel.region = 'WW';
      channel.offsetSeconds = 0;
      // An Ireland token belongs to the Ireland stream. Worldwide metadata is
      // requested fresh by its own provider ID; no signed URL is bundled.
      if (!ownToken) delete channel.liveToken;
      channel.currentShow = programme(channel.currentShow);
      channel.nextShow = programme(channel.nextShow);
      result.streams.push(channel);
      return result;
    }
  };
}());
