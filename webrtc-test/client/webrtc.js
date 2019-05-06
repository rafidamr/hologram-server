(function(){
  var localStream, localElements, remoteElements;
  var uuid, peerConnection, serverConnection;
  
  var peerConnectionConfig = {
    'iceServers': [
      {'urls': 'stun:stun.stunprotocol.org:3478'},
      {'urls': 'stun:stun.l.google.com:19302'},
    ]
  };
  
  function pageReady() {
    uuid = createUUID();
    
    localElements  = document.querySelectorAll('.local-video');
    remoteElements = document.querySelectorAll('.remote-video');
    [localElements,remoteElements].forEach(function(elementGroup){
      console.log(elementGroup);
      elementGroup.forEach(function(elmVideo){
        elmVideo.autoplay = true;
        elmVideo.width    = 420;
        elmVideo.height   = 420;
        elmVideo.videoWidth    = 420;
        elmVideo.videoHeight   = 420;
       //elmVideo.muted    = true;
      });
    });
    
    serverConnection = new WebSocket(`wss://${window.location.hostname}:8443`);
    serverConnection.onmessage = onServerMessage;
    
    var constraints = {
      video: true,
      audio: false,
    };
    
    document.querySelectorAll('video').forEach(function(vdom){
      vdom.addEventListener('durationchange',function(){
        var maxSize = Math.max(vdom.videoWidth,vdom.videoHeight);
        ['width','height'].forEach(function(k){
          vdom[k] = maxSize;
        });
      })
    });
    
    if(navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
    } else {
      alert('Your browser does not support getUserMedia API');
    }
  }
  
  function getUserMediaSuccess(stream){
    localStream = stream;
    localElements.forEach(function(localVideo){
      localVideo.srcObject = stream;
      localVideo.muted = true;
    });
    start(true);
  }
  
  function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = onIceCandidate;
    peerConnection.ontrack = onRemoteStream;
    peerConnection.addStream(localStream);
    
    if(isCaller) {
      peerConnection.createOffer().then(createdDescription).catch(errorHandler);
    }
  }
  
  function onServerMessage(message) {
    if(!peerConnection) start(false);
    
    var signal = JSON.parse(message.data);
    
    // Ignore messages from ourself
    if(signal.uuid == uuid) return;
    
    if(signal.sdp) {
      var rtcs = new RTCSessionDescription(signal.sdp);
      peerConnection.setRemoteDescription(rtcs).then(function() {
        // Only create answers in response to offers
        if(signal.sdp.type == 'offer') {
           peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
        }
      }).catch(errorHandler);
    } else if(signal.ice) {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
  }
  
  function onIceCandidate(event) {
    if(event.candidate != null) {
      serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
    }
  }
  
  function createdDescription(description) {
    console.log('got description');
    
    peerConnection.setLocalDescription(description).then(function() {
      serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
    }).catch(errorHandler);
  }
  
  function onRemoteStream(event) {
    console.log('got remote stream');
    remoteElements.forEach(function(remoteVideo){
      remoteVideo.srcObject = event.streams[0];
    });
  }
  
  function errorHandler(error) {
    console.error(error);
  }
  
  // Taken from http://stackoverflow.com/a/105074/515584
  // Strictly speaking, it's not a real UUID, but it gets the job done here
  function createUUID() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }
  
  function nativeTreeWalker() {
    document.body.innerHTML = document.body.innerHTML
      .replace(/\>\s+\</g,'><')
      .replace(/\>\s+(\S)/g,">$1")
      .replace(/(\S)\s+\</g,"$1<");
  }
  document.addEventListener('DOMContentLoaded',function(){
    nativeTreeWalker();
    pageReady();
  });
}).call(this);
