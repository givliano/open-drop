'use strict';

const mediaStreamConstraints = {
  video: true
};

// Set up to exchange only video.
const offerOptions = {
  offerToReceiveVideo: 1
};

// Define initial start time of the call (defined as connection between peers)
let startTime = null

// Define peer connections, streams and video elements.
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let remoteStream;

let localPeerConnection;
let remotePeerConnection;

// Handles success by adding the MediaStream to the video element.
function gotLocalMediaStream(mediaStream) {
  localVideo.srcObject = mediaStream;
  localStream = mediaStream;
  trace('Received local stream');
  callButton.disabled = false;
}

// Handles error by loggin a message to the console
function handleLocalMediaStreamError(error) {
  trace(`navigator.getUserMedia error: ${error.toString()}.`);
}

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event) {
  const mediaStream = event.streams[0];
  remoteVideo.srcObject = mediaStream;
  remoteStream = mediaStream;
  trace('Remote peer connection received remote stream.');
}

// Add behavior for video streams.

// Logs a message with the id and size of a video element.
function logVideoLoaded(event) {
  const video = event.target;
  trace(`${video.id} videoWidth: ${video.videoWidth}px,` + `videoHeight: ${video.videoHeight}px`);
}

// Logs a message with the id and size of a video element.
// This event is fired when video begins streamimg.
function logResizedVideo(event) {
  logVideoLoaded(event);

  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    startTime = null;
    trace(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
  }
}

localVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo.addEventListener('onresize', logResizedVideo);

// Define RTC peer connection behaviour.

// Connects with new peer candidate.
async function handleConnection(event) {
  const peerConnection = event.target;
  const iceCandidate = event.candidate;

  if (iceCandidate) {
    const newIceCandidate = new RTCIceCandidate(iceCandidate);
    const otherPeer = getOtherPeer(peerConnection);

    try {
      await otherPeer.addIceCandidate(newIceCandidate);
      handleConnectionSuccess(peerConnection);
    } catch (error) {
      handleConnectionFailure(peerConnection, error);
    }

    trace(`${getPeerName(peerConnection)} ICE candidate:\n` + `${event.candidate.candidate}`);
  }
}

// Logs that the connection succeeded.
function handleConnectionSuccess(peerConnection) {
  trace(`${getPeerName(peerConnection)} addIceCandidate success.`);
}

// Logs that the connection failed.
function handleConnectionFailure(peerConnection, error) {
  trace(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n` + `${error.toString()}.`);
}

// Logs changes to the connection state.
function handleConnectionChange(event) {
  const peerConnection = event.target;
  console.log('ICE state change event: ', event);
  trace(`${getPeerName(peerConnection)} ICE state: ` + `${peerConnection.iceConnectionState}.`);
}

// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
  trace(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when setting session description.
function setDescriptionSuccess(peerConnection, functionName) {
  const peerName = getPeerName(peerConnection);
  trace(`${peerName} ${functionName} complete.`);
}

// Logs success when localDescription is set.
function setLocalDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setLocalDescription');
}

// Logs offer creation and sets peer connection session descriptions.
function setRemoteDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setRemoteDescription');
}

// 1 - If successful, Local sets the local description using setLocalDescription(),
// and then sends this session description to Remote via their signaling channel.
// 2 - Remote sets the description Local sent him as the remote description using setRemoteDescription().
// 3 - Remote runs the RTCPeerConnection createAnswer() method, passing it the remote
// description he got from Local, so a local session can be generated that is compatible with hers.
// The createAnswer() promise passes on an RTCSessionDescription: Remote sets that as the local description and sends it to Local.
// 4 - When Local gets Remote's session description, she sets that as the remote description with setRemoteDescription().

// Logs offer creation and sets peer connection session description.
async function createdOffer(description) {
  trace(`Offer from localPeerConnection:\n${description.sdp}`);

  try {
    trace('localPeerConnection setLocalDescription start.');
    await localPeerConnection.setLocalDescription(description);
    setLocalDescriptionSuccess(localPeerConnection);
  } catch(error) {
    setSessionDescriptionError(error);
  }

  try {
    trace('remotePeerConnection setRemoteDescription start');
    await remotePeerConnection.setRemoteDescription(description);
    setRemoteDescriptionSuccess(remotePeerConnection);
  } catch(error) {
    setSessionDescriptionError(error);
  }

  try {
    trace('remotePeerConnection createAnswer start.');
    const remoteDescription = await remotePeerConnection.createAnswer()
    createdAnswer(remoteDescription);
  } catch (error) {
    setSessionDescriptionError(error);
  }
}

// Logs answer to offer creation and sets peer connection session descriptions.
async function createdAnswer(description) {
  trace(`Answer from remotePeerConnection:\n${description.sdp}`);

  try {
    trace('remotePeerConnection setLocalDescription start.');
    await remotePeerConnection.setLocalDescription(description)
    setLocalDescriptionSuccess(remotePeerConnection);
  } catch(error) {
    setSessionDescriptionError(error);
  }

  try {
    trace(`localPeerConnection setRemoteDescription start.`);
    await localPeerConnection.setRemoteDescription(description);
    setRemoteDescriptionSuccess(localPeerConnection);
  } catch (error) {
    setSessionDescriptionError(error);
  }
}

// Define and add behavior to buttons.

// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;

// Handles start button action: creates local MediaStream.
async function startAction() {
  trace('Requesting local stream.');

  try {
    startButton.disabled = true;
    const stream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    gotLocalMediaStream(stream);
  } catch (error) {
    handleLocalMediaStreamError(error);
  }
}

// Handles call button action: creates peer connection.
async function callAction() {
  callButton.disabled = true;
  hangupButton.disabled = false;

  trace('Starting call');
  startTime = window.performance.now();

  // Get local media stream tracks.
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();

  if (videoTracks.length > 0) {
    trace(`Using video device: ${videoTracks[0].label}.`);
  }

  if (audioTracks.length > 0) {
    trace(`Using audio device: ${audioTracks[0].label}`);
  }

  const servers = null; // Allows for RTC server configuration

  // Create peer connections and behavior.
  localPeerConnection = new RTCPeerConnection(servers);
  trace('Created local peer connection object localPeerConnection.');

  localPeerConnection.addEventListener('icecandidate', handleConnection);
  localPeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);

  remotePeerConnection = new RTCPeerConnection(servers);
  trace('Created remote peer connection object remotePeerConnection.');

  remotePeerConnection.addEventListener('icecandidate', handleConnection);
  remotePeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);
  remotePeerConnection.addEventListener('track', gotRemoteMediaStream);

  // Add local stream to connection and create offer to connect.
  localStream.getTracks().forEach(track => localPeerConnection.addTrack(track, localStream));
  // localPeerConnection.addTrack(localStream);
  trace('Added local stream to localPeerConnection.');

  try {
    trace('localPeerConnection createOffer start.');
    const localDescription = await localPeerConnection.createOffer(offerOptions)
    createdOffer(localDescription);
  } catch(error) {
    setSessionDescriptionError(error);
  }
}

// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
  localPeerConnection.close();
  remotePeerConnection.close();
  localPeerConnection = null;
  remotePeerConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  trace('Ending call.');
}

// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);

// Define helper functions.

// Gets the `other` peer connection
function getOtherPeer(peerConnection) {
  return (peerConnection === localPeerConnection) ? remotePeerConnection : localPeerConnection;
}

// Gets the name of a certain peer connection/
function getPeerName(peerConnection) {
  return (peerConnection === localPeerConnection) ? 'localPeerConnection' : 'remotePeerConnection';
}

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
  text = text.trim();
  const now = (window.performance.now() / 1000).toFixed(3);

  console.log(now, text);
}
