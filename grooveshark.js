function d(t) {
	console.log('ChromeGrooveShartScrobbler: ' + t);
}
(function(){
	var songToScrobble = detectedSong = {
		artist: null,
		track: null,
		album: null,
		duration: 0
	};
	var originalPlaying = playing = {
		isPlaying: false,
		startPlaying: 0,
		time: 0
	};
	var scrobbleTimeout = scrobbleInterval = null;
	
	function cleanTag(text) {
		var t = text;
		t = t.replace(/\[[^\]]+\]$/, ''); // [whatever]
		return t;
	}
	
	function checkForUpdates(){
		if (!playing.isPlaying || detectedSong === songToScrobble){
			return false;
		}
		// New song. New timers.
		songToScrobble = detectedSong;
		playing = originalPlaying;
		
		chrome.extension.sendRequest({type: 'validate', artist: songToScrobble.artist, track: songToScrobble.track, album: songToScrobble.album}, function(response) {
			if (response === true){
				d("Now playing: "+songToScrobble.artist+" - "+songToScrobble.track+" ("+songToScrobble.album+"). Duration: "+songToScrobble.duration);
				chrome.extension.sendRequest({type: 'nowPlaying', artist: songToScrobble.artist, track: songToScrobble.track, album: songToScrobble.album, duration: songToScrobble.duration});
			} else {
				d("SENDREQUEST: validate response FAIL");
				// "NOT RECOGNIZED BY THE SERVER"
			}
		});
	}
	
	function getDuration(){
		var nowPlayingDuration = document.getElementById("player_duration").innerText || null;
		if (nowPlayingDuration){
			nowPlayingDuration = nowPlayingDuration.split(":");
			return (parseInt(nowPlayingDuration[0])*60) + parseInt(nowPlayingDuration[1]);
		}
	}
	
	function setPlayingTime(){
		if (playing.startPlaying !== 0){
			playing.time = playing.time + (new Date().getTime() - playing.startPlaying);
		}
		playing.startPlaying = new Date().getTime();
	}
	
	document.getElementById("player_play_pause").addEventListener("DOMSubtreeModified", function(){
		switch (this.className){
			case "player_control play":
			case "player_control buffering play":
			case "player_control buffering":
				playing.isPlaying = false;
				setPlayingTime();
				break;
			case "player_control pause":
			case "player_control buffering pause":
				detectedSong.duration = getDuration();
				playing = {
					isPlaying: true,
					startPlaying: new Date().getTime(),
					time: playing.time
				};
				checkForUpdates();
				break;
		}
	});
	
	document.getElementById("playerDetails_nowPlaying").addEventListener("DOMSubtreeModified", function(){
		var nowPlayingArtist = this.querySelectorAll("a.artist")[0].title || null;
		var nowPlayingAlbum = this.querySelectorAll("a.album")[0].title || null;
		var nowPlayingTrack = this.querySelectorAll("a.song")[0].title || null;
		detectedSong = {
			artist: cleanTag(nowPlayingArtist),
			album: cleanTag(nowPlayingAlbum),
			track: cleanTag(nowPlayingTrack)
		};
		checkForUpdates(); // do we need this?
	});
	
	function sendScrobble(){
		chrome.extension.sendRequest({type: 'submit'});
		clearInterval(scrobbleInterval);
	}
	
	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		switch(request.type) {
			// called after track has been successfully marked as 'now playing' at the server
			case 'nowPlayingOK':
				// "NOW SCROBBLING"
				var min_time = (240 < (songToScrobble.duration/2)) ? 240 : (songToScrobble.duration/2); //The minimum time is 240 seconds or half the track's total length. Duration comes from updateNowPlaying()

				// cancel any previous timeout
				if (scrobbleTimeout !== null){
					clearTimeout(scrobbleTimeout);
				}
				if (scrobbleInterval !== null){
					clearInterval(scrobbleInterval);
				}
				scrobbleTimeout = setTimeout(function(){
					scrobbleInterval = setInterval(function(){
						setPlayingTime();
						console.log("playing: " + playing.time + " - min: " + min_time);
						if ((playing.time / 1000) >= min_time) sendScrobble();
					}, 1000);
				}, (min_time*1000)); 
				break;
			// not used yet
			case 'submitOK':
				// "submit ok"???
				break;

			// not used yet
			case 'submitFAIL':
				// "Can't submit track"
				break; 
		}
	});
	
	window.onunload = function(){
		if (scrobbleTimeout != null){
			window.clearTimeout(scrobbleTimeout);

			// reset the background scrobbler song data
			d("SENDREQUEST: RESET");
			chrome.extension.sendRequest({type: 'reset'});

			return true;
		}
	};
	
})();
