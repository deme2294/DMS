import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type { ChatRoom } from '../../../api/chatApi';
import { getRoleColor, getAvatarGradient } from '../types';
import styles from '../ChatPage.module.css';

interface InAppVideoConferenceProps {
  room: ChatRoom;
  currentUser: any;
  socket: Socket | null;
  onLeave: () => void;
  onSwitchToChat: () => void;
  onOpenInviteModal?: () => void;
  onStartNewVideoConference?: () => void;
  isWholePageMode?: boolean;
  onToggleWholePageMode?: () => void;
}

interface PeerConnectionState {
  socketId: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  peerConnection: RTCPeerConnection;
  remoteStream?: MediaStream;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// High-Definition Studio Voice Audio Processing
const HIGH_QUALITY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
  // @ts-ignore
  googEchoCancellation: true,
  // @ts-ignore
  googAutoGainControl: true,
  // @ts-ignore
  googNoiseSuppression: true,
  // @ts-ignore
  googHighpassFilter: true,
  // @ts-ignore
  googTypingNoiseDetection: true,
};

// Enhance Opus audio SDP to 128kbps crystal voice with in-band forward error correction
const enhanceOpusSDP = (sdp: string): string => {
  return sdp.replace(/a=fmtp:(\d+)(.*)/g, (fullMatch, pt, rest) => {
    if (sdp.includes(`a=rtpmap:${pt} opus/48000`)) {
      let params = rest;
      if (!params.includes('useinbandfec=')) params += ';useinbandfec=1';
      if (!params.includes('maxaveragebitrate=')) params += ';maxaveragebitrate=128000';
      if (!params.includes('sprop-stereo=')) params += ';sprop-stereo=1';
      if (!params.includes('stereo=')) params += ';stereo=1';
      if (!params.includes('cbr=')) params += ';cbr=1';
      if (!params.includes('minptime=')) params += ';minptime=10';
      return `a=fmtp:${pt}${params}`;
    }
    return fullMatch;
  });
};

// Synthesize pleasant, crystal-clear entrance chime via Web Audio API
const playAudioChime = (type: 'join' | 'leave') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'join') {
      // Harmonic 3-tone chime (C5 523.25Hz -> E5 659.25Hz -> G5 783.99Hz)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.5);
      });
    } else {
      // Subtle downward leave cue
      const freqs = [659.25, 523.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.45);
      });
    }
  } catch {
    // Graceful fallback if AudioContext requires user gesture
  }
};

export const InAppVideoConference: React.FC<InAppVideoConferenceProps> = ({
  room,
  currentUser,
  socket,
  onLeave,
  onSwitchToChat,
  onOpenInviteModal,
  onStartNewVideoConference,
  isWholePageMode,
  onToggleWholePageMode,
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<Map<string, PeerConnectionState>>(new Map());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [screenNotice, setScreenNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peersRef = useRef<Map<string, PeerConnectionState>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  // Keep peersRef in sync with state
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  // 1. Initialize Local Media Stream with High-Fidelity Audio
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    const startMedia = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Webcam & audio media devices are not supported or blocked in this browser context.');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
          audio: HIGH_QUALITY_AUDIO_CONSTRAINTS,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Play entrance sound cue for entering user
        playAudioChime('join');

        // Join video room via Socket.IO
        if (socket?.connected) {
          socket.emit('video-join', {
            roomId: room.id,
            peerInfo: {
              isMicMuted: false,
              isCameraOff: false,
              isScreenSharing: false,
            },
          });
        }
      } catch (err: any) {
        console.warn('[InAppVideo] getUserMedia failed, attempting HD audio-only:', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: HIGH_QUALITY_AUDIO_CONSTRAINTS });
          if (!isCancelled) {
            setLocalStream(stream);
            setIsCameraOff(true);
            playAudioChime('join');
            if (socket?.connected) {
              socket.emit('video-join', {
                roomId: room.id,
                peerInfo: { isMicMuted: false, isCameraOff: true, isScreenSharing: false },
              });
            }
          }
        } catch (err2: any) {
          console.error('[InAppVideo] No camera or mic available:', err2);
          setMediaError('Could not acquire local camera or microphone permissions.');
          setIsCameraOff(true);
          setIsMicMuted(true);
          if (socket?.connected) {
            socket.emit('video-join', {
              roomId: room.id,
              peerInfo: { isMicMuted: true, isCameraOff: true, isScreenSharing: false },
            });
          }
        }
      }
    };

    startMedia();

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (socket?.connected) {
        socket.emit('video-leave', { roomId: room.id });
      }
      peersRef.current.forEach((p) => p.peerConnection.close());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [room.id, socket]);

  // 2. Real-time Voice Activity Detection (Local & Remote Volume Levels)
  useEffect(() => {
    let animId: number;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    audioContextRef.current = ctx;

    let localAnalyser: AnalyserNode | null = null;
    let localSource: MediaStreamAudioSourceNode | null = null;

    if (localStream && !isMicMuted) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.enabled) {
        try {
          localSource = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
          localAnalyser = ctx.createAnalyser();
          localAnalyser.fftSize = 256;
          localSource.connect(localAnalyser);
        } catch (e) {
          console.warn('[VoiceActivity] Local analyser error:', e);
        }
      }
    }

    // Connect remote peer audio streams
    const remoteAnalysers: { socketId: string; analyser: AnalyserNode }[] = [];
    peers.forEach((peer, socketId) => {
      if (peer.remoteStream && !peer.isMicMuted) {
        const audioTrack = peer.remoteStream.getAudioTracks()[0];
        if (audioTrack && audioTrack.enabled) {
          try {
            const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            remoteAnalysers.push({ socketId, analyser });
          } catch (e) {
            console.warn('[VoiceActivity] Remote analyser error:', e);
          }
        }
      }
    });

    const dataArray = new Uint8Array(128);

    const checkAudioLevels = () => {
      if (localAnalyser && !isMicMuted) {
        localAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setIsLocalSpeaking(avg > 15);
      } else {
        setIsLocalSpeaking(false);
      }

      const activeSpeakers = new Set<string>();
      remoteAnalysers.forEach(({ socketId, analyser }) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        if (avg > 15) {
          activeSpeakers.add(socketId);
        }
      });
      setSpeakingPeers(activeSpeakers);

      animId = requestAnimationFrame(checkAudioLevels);
    };

    checkAudioLevels();

    return () => {
      cancelAnimationFrame(animId);
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    };
  }, [localStream, isMicMuted, peers]);

  // 3. WebRTC Peer Connection Helper with HD Audio & Transceiver Configuration
  const createPeerConnection = useCallback(
    (targetSocketId: string, peerUser: any): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local audio and video tracks
      const currentStream = screenStream || localStream;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => {
          pc.addTrack(track, currentStream);
        });
      }

      // Handle remote stream tracks
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        setPeers((prev) => {
          const next = new Map(prev);
          const existing = next.get(targetSocketId);
          if (existing) {
            next.set(targetSocketId, { ...existing, remoteStream });
          }
          return next;
        });
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket?.connected) {
          socket.emit('video-signal', {
            to: targetSocketId,
            signal: { candidate: event.candidate },
          });
        }
      };

      return pc;
    },
    [localStream, screenStream, socket]
  );

  // 4. Socket.IO Signaling Listeners with HD Opus Negotiation
  useEffect(() => {
    if (!socket) return;

    // A new user joined the video room
    const handleUserJoined = async ({ socketId, userId, username, firstName, lastName, role, peerInfo }: any) => {
      if (socketId === socket.id) return;

      // Play entrance chime when another participant joins
      playAudioChime('join');

      const pc = createPeerConnection(socketId, { id: userId, username, firstName, lastName, role });

      setPeers((prev) => {
        const next = new Map(prev);
        next.set(socketId, {
          socketId,
          user: { id: userId, username, firstName, lastName, role },
          peerConnection: pc,
          isMicMuted: peerInfo?.isMicMuted,
          isCameraOff: peerInfo?.isCameraOff,
          isScreenSharing: peerInfo?.isScreenSharing,
        });
        return next;
      });

      // Create and send WebRTC offer with Opus HD audio optimization
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        const enhancedSdp = enhanceOpusSDP(offer.sdp || '');
        await pc.setLocalDescription({ type: 'offer', sdp: enhancedSdp });
        socket.emit('video-signal', {
          to: socketId,
          signal: { sdp: pc.localDescription },
        });
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
      }
    };

    // Incoming WebRTC signal (SDP or ICE)
    const handleSignal = async ({ from, signal, user }: any) => {
      let peer = peersRef.current.get(from);
      let pc: RTCPeerConnection;

      if (!peer) {
        pc = createPeerConnection(from, user);
        peer = {
          socketId: from,
          user,
          peerConnection: pc,
        };
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(from, peer!);
          return next;
        });
      } else {
        pc = peer.peerConnection;
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            const enhancedSdp = enhanceOpusSDP(answer.sdp || '');
            await pc.setLocalDescription({ type: 'answer', sdp: enhancedSdp });
            socket.emit('video-signal', {
              to: from,
              signal: { sdp: pc.localDescription },
            });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('[WebRTC] Error handling signal:', err);
      }
    };

    // Peer changed mute/camera/screen state
    const handlePeerStateChanged = ({ socketId, isMicMuted, isCameraOff, isScreenSharing }: any) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(socketId);
        if (existing) {
          next.set(socketId, {
            ...existing,
            isMicMuted: isMicMuted ?? existing.isMicMuted,
            isCameraOff: isCameraOff ?? existing.isCameraOff,
            isScreenSharing: isScreenSharing ?? existing.isScreenSharing,
          });
        }
        return next;
      });
    };

    // User left video room
    const handleUserLeft = ({ socketId }: any) => {
      playAudioChime('leave');
      const peer = peersRef.current.get(socketId);
      if (peer) {
        peer.peerConnection.close();
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
      }
    };

    socket.on('video-user-joined', handleUserJoined);
    socket.on('video-signal', handleSignal);
    socket.on('video-peer-state-changed', handlePeerStateChanged);
    socket.on('video-user-left', handleUserLeft);

    return () => {
      socket.off('video-user-joined', handleUserJoined);
      socket.off('video-signal', handleSignal);
      socket.off('video-peer-state-changed', handlePeerStateChanged);
      socket.off('video-user-left', handleUserLeft);
    };
  }, [socket, createPeerConnection]);

  // 5. Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      const newMuted = !isMicMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
      setIsMicMuted(newMuted);
      socket?.emit('video-stream-state', {
        roomId: room.id,
        isMicMuted: newMuted,
        isCameraOff,
        isScreenSharing,
      });
    }
  };

  // 6. Toggle Camera
  const toggleCamera = () => {
    if (localStream) {
      const newOff = !isCameraOff;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !newOff;
      });
      setIsCameraOff(newOff);
      socket?.emit('video-stream-state', {
        roomId: room.id,
        isMicMuted,
        isCameraOff: newOff,
        isScreenSharing,
      });
    }
  };

  // 7. Native In-App Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing and revert to camera
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }
      setIsScreenSharing(false);

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        peersRef.current.forEach((peer) => {
          const sender = peer.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack).catch((e) => console.warn('replaceTrack err:', e));
          }
        });
      }

      socket?.emit('video-stream-state', {
        roomId: room.id,
        isMicMuted,
        isCameraOff,
        isScreenSharing: false,
      });
    } else {
      // Start native in-app display capture
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          setMediaError('Screen sharing is not supported in this browser context.');
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 30, max: 30 },
            },
            audio: true,
          });
        } catch (err1: any) {
          if (err1.name === 'NotAllowedError') {
            setScreenNotice('Screen sharing prompt was dismissed. Click "Share Screen" again whenever you are ready.');
            setTimeout(() => setScreenNotice(null), 5000);
            return;
          }
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 30, max: 30 },
            },
          });
        }

        setScreenStream(stream);
        setIsScreenSharing(true);
        setScreenNotice(null);

        const screenTrack = stream.getVideoTracks()[0];

        // Replace track for all active peer connections
        peersRef.current.forEach((peer) => {
          const sender = peer.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && screenTrack) {
            sender.replaceTrack(screenTrack).catch((e) => console.warn('replaceTrack screen err:', e));
          }
        });

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
          if (localStream) {
            const camTrack = localStream.getVideoTracks()[0];
            peersRef.current.forEach((peer) => {
              const sender = peer.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
              if (sender && camTrack) {
                sender.replaceTrack(camTrack).catch(() => {});
              }
            });
          }
          socket?.emit('video-stream-state', {
            roomId: room.id,
            isMicMuted,
            isCameraOff,
            isScreenSharing: false,
          });
        };

        socket?.emit('video-stream-state', {
          roomId: room.id,
          isMicMuted,
          isCameraOff,
          isScreenSharing: true,
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setScreenNotice('Screen sharing was cancelled.');
          setTimeout(() => setScreenNotice(null), 5000);
        } else {
          console.warn('Screen sharing error:', err);
          setMediaError('Could not start screen sharing: ' + (err.message || 'Permission denied'));
        }
      }
    }
  };

  // 8. Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const peerList = Array.from(peers.values());
  const hasActiveScreenShare = isScreenSharing || peerList.some((p) => p.isScreenSharing);

  return (
    <div ref={containerRef} className={styles.inAppConferenceContainer}>
      {/* Top Conference Action Bar */}
      <div className={styles.inAppConferenceHeader}>
        <div className={styles.inAppConferenceTitleGroup}>
          <span className={styles.inAppConferenceLiveDot} />
          <div>
            <h4 className={styles.inAppConferenceTitle}>
              {room.name || 'Help Desk Video Conference'}
            </h4>
            <div className={styles.inAppConferenceMeta}>
              <span className={styles.inAppHdAudioBadge} style={{ background: '#fce7f3', color: '#be185d', borderColor: '#fbcfe8' }}>
                🗓️ Session: Today ({new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})
              </span>
              <span className={styles.metaDivider}>•</span>
              <span className={styles.inAppHdAudioBadge}>🎙️ HD Audio ON</span>
              <span className={styles.metaDivider}>•</span>
              <span>🔒 Encrypted WebRTC</span>
              <span className={styles.metaDivider}>•</span>
              <span>{peerList.length + 1} Participant{peerList.length !== 0 ? 's' : ''}</span>
              {hasActiveScreenShare && (
                <>
                  <span className={styles.metaDivider}>•</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>🖥️ Screen Presentation Active</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.inAppConferenceHeaderActions}>
          {onStartNewVideoConference && (
            <button
              type="button"
              className={styles.inAppSwitchChatBtn}
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
              }}
              onClick={onStartNewVideoConference}
              title="Create a new video conference chat session with custom date (default today)"
            >
              📹 + New Video Chat
            </button>
          )}

          <button
            type="button"
            className={styles.inAppSwitchChatBtn}
            onClick={onSwitchToChat}
            title="Switch back to Text Chat conversation"
          >
            💬 View Chat
          </button>

          {onOpenInviteModal && (
            <button
              type="button"
              className={styles.inAppInviteBtn}
              onClick={onOpenInviteModal}
              title="Schedule event time and invite registered users"
            >
              🗓️ + Invite & Schedule
            </button>
          )}

          {onToggleWholePageMode && (
            <button
              type="button"
              className={`${styles.inAppFullscreenBtn} ${isWholePageMode ? styles.inAppFullscreenBtnActive : ''}`}
              onClick={onToggleWholePageMode}
              title={
                isWholePageMode
                  ? 'Exit whole page view (restore standard page)'
                  : 'Expand conference and screen share to whole page'
              }
            >
              {isWholePageMode ? '⊡ Normal Page' : '⛶ Whole Page'}
            </button>
          )}

          <button
            type="button"
            className={styles.inAppFullscreenBtn}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? '⤦ Exit Full' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {screenNotice && (
        <div className={styles.inAppScreenNotice}>
          <span>ℹ️ {screenNotice}</span>
          <button
            type="button"
            className={styles.inAppDismissNoticeBtn}
            onClick={() => setScreenNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {mediaError && (
        <div className={styles.inAppMediaWarning}>
          ⚠️ {mediaError} You can still participate in audio/chat and view others' shared screens.
        </div>
      )}

      {/* Main Video Stage Area */}
      <div className={`${styles.inAppVideoStage} ${hasActiveScreenShare ? styles.inAppVideoStagePresentation : ''}`}>
        {/* Screen Share Stage */}
        {isScreenSharing && screenStream && (
          <div className={styles.inAppScreenStageCard}>
            <div className={styles.inAppScreenBadge}>
              🖥️ You are sharing your screen
            </div>
            {onToggleWholePageMode && (
              <div className={styles.inAppScreenActions}>
                <button
                  type="button"
                  className={styles.inAppScreenExpandBtn}
                  onClick={onToggleWholePageMode}
                  title={isWholePageMode ? 'Restore standard page view' : 'Maximize screen share to whole page'}
                >
                  {isWholePageMode ? '⊡ Standard View' : '⛶ Whole Page Stage'}
                </button>
              </div>
            )}
            <video
              ref={(el) => {
                if (el && el.srcObject !== screenStream) {
                  el.srcObject = screenStream;
                }
              }}
              autoPlay
              playsInline
              muted
              className={styles.inAppScreenVideo}
            />
          </div>
        )}

        {/* Remote Peers Sharing Screen */}
        {peerList
          .filter((p) => p.isScreenSharing && p.remoteStream)
          .map((p) => (
            <div key={`screen-${p.socketId}`} className={styles.inAppScreenStageCard}>
              <div className={styles.inAppScreenBadge}>
                🖥️ {p.user.firstName} {p.user.lastName} is sharing screen
              </div>
              {onToggleWholePageMode && (
                <div className={styles.inAppScreenActions}>
                  <button
                    type="button"
                    className={styles.inAppScreenExpandBtn}
                    onClick={onToggleWholePageMode}
                    title={isWholePageMode ? 'Restore standard page view' : 'Maximize screen share to whole page'}
                  >
                    {isWholePageMode ? '⊡ Standard View' : '⛶ Whole Page Stage'}
                  </button>
                </div>
              )}
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && el.srcObject !== p.remoteStream) {
                    el.srcObject = p.remoteStream!;
                  }
                }}
                className={styles.inAppScreenVideo}
              />
            </div>
          ))}

        {/* Participants Video Tiles Grid */}
        <div className={`${styles.inAppVideoGrid} ${hasActiveScreenShare ? styles.inAppVideoGridStrip : ''}`}>
          {/* Local User Tile */}
          <div className={`${styles.inAppParticipantCard} ${isCameraOff ? styles.inAppParticipantCardOff : ''} ${isLocalSpeaking ? styles.inAppParticipantCardSpeaking : ''}`}>
            {!isCameraOff && localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={styles.inAppParticipantVideo}
              />
            ) : (
              <div className={styles.inAppAvatarPlaceholder}>
                <div
                  className={styles.inAppAvatar}
                  style={{ background: getAvatarGradient(`${currentUser?.first_name} ${currentUser?.last_name}`) }}
                >
                  {currentUser?.first_name?.[0] || 'U'}
                </div>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '6px' }}>
                  Camera is Off
                </span>
              </div>
            )}

            {/* Tile Footer Tag */}
            <div className={styles.inAppTileFooter}>
              <div className={styles.inAppTileUser}>
                <span>You ({currentUser?.first_name})</span>
                {isMicMuted ? (
                  <span className={styles.inAppMuteBadge}>🔇 Muted</span>
                ) : (
                  <span className={`${styles.inAppAudioLivePulse} ${isLocalSpeaking ? styles.inAppAudioSpeakingPulse : ''}`} title={isLocalSpeaking ? 'Speaking...' : 'Microphone Ready'} />
                )}
              </div>
              <span
                className={styles.inAppRoleBadge}
                style={{
                  background: getRoleColor(currentUser?.role || currentUser?.role_name).bg,
                  color: getRoleColor(currentUser?.role || currentUser?.role_name).text,
                  borderColor: getRoleColor(currentUser?.role || currentUser?.role_name).border,
                }}
              >
                {currentUser?.role || currentUser?.role_name || 'User'}
              </span>
            </div>
          </div>

          {/* Remote Peers Tiles */}
          {peerList.map((peer) => {
            const roleStyle = getRoleColor(peer.user.role);
            const isPeerSpeaking = speakingPeers.has(peer.socketId);
            return (
              <div
                key={peer.socketId}
                className={`${styles.inAppParticipantCard} ${peer.isCameraOff ? styles.inAppParticipantCardOff : ''} ${isPeerSpeaking ? styles.inAppParticipantCardSpeaking : ''}`}
              >
                {!peer.isCameraOff && peer.remoteStream ? (
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (el && el.srcObject !== peer.remoteStream) {
                        el.srcObject = peer.remoteStream!;
                      }
                    }}
                    className={styles.inAppParticipantVideo}
                  />
                ) : (
                  <div className={styles.inAppAvatarPlaceholder}>
                    <div
                      className={styles.inAppAvatar}
                      style={{ background: getAvatarGradient(`${peer.user.firstName} ${peer.user.lastName}`) }}
                    >
                      {peer.user.firstName?.[0] || 'U'}
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '6px' }}>
                      Camera Off
                    </span>
                  </div>
                )}

                <div className={styles.inAppTileFooter}>
                  <div className={styles.inAppTileUser}>
                    <span>{peer.user.firstName} {peer.user.lastName}</span>
                    {peer.isMicMuted ? (
                      <span className={styles.inAppMuteBadge}>🔇 Muted</span>
                    ) : (
                      <span className={`${styles.inAppAudioLivePulse} ${isPeerSpeaking ? styles.inAppAudioSpeakingPulse : ''}`} title={isPeerSpeaking ? 'Speaking...' : 'Audio Online'} />
                    )}
                  </div>
                  <span
                    className={styles.inAppRoleBadge}
                    style={{
                      background: roleStyle.bg,
                      color: roleStyle.text,
                      borderColor: roleStyle.border,
                    }}
                  >
                    {peer.user.role}
                  </span>
                </div>
              </div>
            );
          })}

          {peerList.length === 0 && (
            <div className={styles.inAppWaitingNotice}>
              <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>⏳</div>
              <h5 style={{ margin: '0 0 4px 0', color: '#ffffff' }}>Waiting for other members to join</h5>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Other registered participants can click "Video Conference" to join this call inside DMS.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Persistent Audio Outputs for All Connected Remote Peers (Guarantees uninterrupted audio regardless of camera status) */}
      {peerList.map((peer) => {
        if (!peer.remoteStream) return null;
        return (
          <audio
            key={`audio-stream-${peer.socketId}`}
            autoPlay
            playsInline
            ref={(el) => {
              if (el && peer.remoteStream && el.srcObject !== peer.remoteStream) {
                el.srcObject = peer.remoteStream;
                el.play().catch((err) => {
                  console.warn('[InAppVideo] Remote peer audio autoplay deferred:', err);
                });
              }
            }}
            style={{ display: 'none' }}
          />
        );
      })}

      {/* Floating Bottom Control Bar */}
      <div className={styles.inAppControlBar}>
        <button
          type="button"
          onClick={toggleMic}
          className={`${styles.inAppControlBtn} ${isMicMuted ? styles.inAppControlBtnOff : ''}`}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          <span className={styles.inAppControlIcon}>{isMicMuted ? '🔇' : '🎙️'}</span>
          <span className={styles.inAppControlLabel}>{isMicMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          className={`${styles.inAppControlBtn} ${isCameraOff ? styles.inAppControlBtnOff : ''}`}
          title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          <span className={styles.inAppControlIcon}>{isCameraOff ? '🚫' : '📹'}</span>
          <span className={styles.inAppControlLabel}>{isCameraOff ? 'Start Video' : 'Stop Video'}</span>
        </button>

        <button
          type="button"
          onClick={toggleScreenShare}
          className={`${styles.inAppControlBtn} ${isScreenSharing ? styles.inAppControlBtnActiveShare : ''}`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Your Screen (Window or Tab)'}
        >
          <span className={styles.inAppControlIcon}>🖥️</span>
          <span className={styles.inAppControlLabel}>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        {onOpenInviteModal && (
          <button
            type="button"
            onClick={onOpenInviteModal}
            className={styles.inAppControlBtn}
            title="Schedule Event Time & Invite Registered Users"
          >
            <span className={styles.inAppControlIcon}>🗓️</span>
            <span className={styles.inAppControlLabel}>Invite & Time</span>
          </button>
        )}

        {onStartNewVideoConference && (
          <button
            type="button"
            onClick={onStartNewVideoConference}
            className={styles.inAppControlBtn}
            title="Create or schedule a new video conference chat (default today)"
          >
            <span className={styles.inAppControlIcon}>📹</span>
            <span className={styles.inAppControlLabel}>New Call</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSwitchToChat}
          className={styles.inAppControlBtn}
          title="Open Text Chat panel"
        >
          <span className={styles.inAppControlIcon}>💬</span>
          <span className={styles.inAppControlLabel}>Text Chat</span>
        </button>

        <button
          type="button"
          onClick={onLeave}
          className={styles.inAppEndCallBtn}
          title="Leave Video Call"
        >
          <span className={styles.inAppControlIcon}>📞</span>
          <span className={styles.inAppControlLabel}>Leave Call</span>
        </button>
      </div>
    </div>
  );
};

export default InAppVideoConference;
