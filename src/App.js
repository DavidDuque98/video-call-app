import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Container, CssBaseline, Box, Grid, IconButton } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import './App.css';

const socket = io('http://localhost:4000');

function App() {
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const streamRef = useRef();
  const analyserRef = useRef();
  const [otherUser, setOtherUser] = useState();
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('join room');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('other user', userID => {
      setOtherUser(userID);
      callUser(userID);
    });

    socket.on('user joined', userID => {
      setOtherUser(userID);
      callUser(userID);
    });

    socket.on('offer', handleReceiveCall);

    socket.on('answer', handleAnswer);

    socket.on('ice-candidate', handleNewICECandidateMsg);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        userVideo.current.srcObject = stream;
        streamRef.current = stream;

        userVideo.current.muted = true;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        const microphone = audioContext.createMediaStreamSource(stream);
        const scriptProcessor = audioContext.createScriptProcessor(256, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        scriptProcessor.onaudioprocess = () => {
          if (isMuted) {
            setIsSpeaking(false);
            return;
          }
          const array = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(array);
          const average = array.reduce((a, b) => a + b) / array.length;
          setIsSpeaking(average > 10);
        };

        socket.emit('join room');
      })
      .catch(error => {
        console.error('Error accessing media devices.', error);
        alert('Error accessing media devices: ' + error.message);
      });

    return () => socket.disconnect();
  }, [isMuted]);

  function callUser(userID) {
    peerRef.current = createPeer(userID);
    streamRef.current.getTracks().forEach(track => peerRef.current.addTrack(track, streamRef.current));
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.stunprotocol.org' }
      ]
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  function handleNegotiationNeededEvent(userID) {
    peerRef.current.createOffer().then(offer => {
      return peerRef.current.setLocalDescription(offer);
    }).then(() => {
      const payload = {
        target: userID,
        caller: socket.id,
        sdp: peerRef.current.localDescription
      };
      socket.emit('offer', payload);
    }).catch(e => console.log(e));
  }

  function handleReceiveCall(incoming) {
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current.setRemoteDescription(desc).then(() => {
      streamRef.current.getTracks().forEach(track => peerRef.current.addTrack(track, streamRef.current));
    }).then(() => {
      return peerRef.current.createAnswer();
    }).then(answer => {
      return peerRef.current.setLocalDescription(answer);
    }).then(() => {
      const payload = {
        target: incoming.caller,
        caller: socket.id,
        sdp: peerRef.current.localDescription
      };
      socket.emit('answer', payload);
    });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch(e => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser,
        candidate: e.candidate
      };
      socket.emit('ice-candidate', payload);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);
    peerRef.current.addIceCandidate(candidate).catch(e => console.log(e));
  }

  function handleTrackEvent(e) {
    partnerVideo.current.srcObject = e.streams[0];
    partnerVideo.current.muted = false;
  }

  function toggleMute() {
    const enabled = streamRef.current.getAudioTracks()[0].enabled;
    streamRef.current.getAudioTracks()[0].enabled = !enabled;
    setIsMuted(!enabled);
  }

  function toggleCamera() {
    const enabled = streamRef.current.getVideoTracks()[0].enabled;
    streamRef.current.getVideoTracks()[0].enabled = !enabled;
    setIsCameraOff(!enabled);
  }

  return (
    <div className="app">
      <div className="area">
        <ul className="circles">
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
        </ul>
      </div>
      <CssBaseline />
      <Container component="main" maxWidth="md" className="container">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Grid container spacing={2} justifyContent="center">
            <Grid item xs={12} sm={6} className="video-container">
              <video ref={userVideo} autoPlay playsInline className="video" muted />
            </Grid>
            <Grid item xs={12} sm={6} className="video-container">
              <video ref={partnerVideo} autoPlay playsInline className="video" />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }} className="controls">
            <IconButton onClick={toggleMute} color="primary" className="icon-button">
              {isMuted ? <MicOffIcon className="icon" /> : <MicIcon className="icon" />}
            </IconButton>
            <IconButton onClick={toggleCamera} color="primary" className="icon-button">
              {isCameraOff ? <VideocamOffIcon className="icon" /> : <VideocamIcon className="icon" />}
            </IconButton>
            <IconButton className={`icon-button ${isSpeaking ? "speaking" : ""}`}>
              {isSpeaking ? <VolumeUpIcon className="icon speaking-icon" /> : <VolumeOffIcon className="icon" />}
            </IconButton>
          </Box>
        </Box>
      </Container>
    </div>
  );
}

export default App;
