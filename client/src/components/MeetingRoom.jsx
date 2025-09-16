import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff, 
  Phone, 
  Users, 
  Settings,
  Copy,
  Share2
} from 'lucide-react';

const MeetingRoom = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [socket, setSocket] = useState(null);
  const [userName, setUserName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  // Media controls
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [focusedVideo, setFocusedVideo] = useState(null); // For focusing on a specific video
  const [videoLoading, setVideoLoading] = useState(false); // Track video loading state
  
  // WebRTC refs
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  
  // STUN servers for WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Effect to ensure video stream is set when component mounts
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(e => console.log('Video play failed on mount:', e));
    }
  }, [isConnected]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('https://meeting-sooty.vercel.app');
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('meeting-joined', (data) => {
      console.log('Meeting joined:', data);
      setMeeting(data.meeting);
      setParticipants(data.participants);
      setIsConnected(true);
      setIsJoining(false);
      setVideoLoading(false);
    });

    newSocket.on('user-joined', (participant) => {
      console.log('User joined:', participant);
      setParticipants(prev => [...prev, participant]);
      createPeerConnection(participant.id, true);
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data);
      setParticipants(prev => prev.filter(p => p.id !== data.userId));
      if (peerConnectionsRef.current[data.userId]) {
        peerConnectionsRef.current[data.userId].close();
        delete peerConnectionsRef.current[data.userId];
        delete remoteVideosRef.current[data.userId];
      }
    });

    newSocket.on('offer', async (data) => {
      console.log('Received offer from:', data.from);
      await handleOffer(data.offer, data.from);
    });

    newSocket.on('answer', async (data) => {
      console.log('Received answer from:', data.from);
      await handleAnswer(data.answer, data.from);
    });

    newSocket.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.from);
      await handleIceCandidate(data.candidate, data.from);
    });

    newSocket.on('user-audio-toggled', (data) => {
      // Handle remote user audio toggle
      const videoElement = remoteVideosRef.current[data.userId];
      if (videoElement) {
        videoElement.muted = !data.audioEnabled;
      }
    });

    newSocket.on('user-video-toggled', (data) => {
      // Handle remote user video toggle
      const videoElement = remoteVideosRef.current[data.userId];
      if (videoElement) {
        videoElement.style.display = data.videoEnabled ? 'block' : 'none';
      }
    });

    newSocket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      newSocket.close();
    };
  }, [meetingId]);

  const createPeerConnection = async (userId, isInitiator) => {
    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[userId] = peerConnection;

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', userId);
      const remoteStream = event.streams[0];
      const videoElement = remoteVideosRef.current[userId];
      if (videoElement) {
        videoElement.srcObject = remoteStream;
        videoElement.play().catch(e => console.log('Remote video play failed:', e));
        console.log('Remote video element updated for:', userId);
      } else {
        console.warn('Remote video element not found for:', userId);
        // Retry after a short delay
        setTimeout(() => {
          const retryElement = remoteVideosRef.current[userId];
          if (retryElement) {
            retryElement.srcObject = remoteStream;
            retryElement.play().catch(e => console.log('Remote video play failed on retry:', e));
          }
        }, 100);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          meetingId,
          candidate: event.candidate,
          target: userId
        });
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', {
          meetingId,
          offer,
          target: userId
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  };

  const handleOffer = async (offer, from) => {
    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[from] = peerConnection;

    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from (offer):', from);
      const remoteStream = event.streams[0];
      const videoElement = remoteVideosRef.current[from];
      if (videoElement) {
        videoElement.srcObject = remoteStream;
        videoElement.play().catch(e => console.log('Remote video play failed (offer):', e));
        console.log('Remote video element updated for (offer):', from);
      } else {
        console.warn('Remote video element not found for (offer):', from);
        // Retry after a short delay
        setTimeout(() => {
          const retryElement = remoteVideosRef.current[from];
          if (retryElement) {
            retryElement.srcObject = remoteStream;
            retryElement.play().catch(e => console.log('Remote video play failed on retry (offer):', e));
          }
        }, 100);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          meetingId,
          candidate: event.candidate,
          target: from
        });
      }
    };

    try {
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', {
        meetingId,
        answer,
        target: from
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer, from) => {
    const peerConnection = peerConnectionsRef.current[from];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  const handleIceCandidate = async (candidate, from) => {
    const peerConnection = peerConnectionsRef.current[from];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    }
  };

  const initializeMedia = async () => {
    try {
      console.log('Requesting media access...');
      
      // Try high quality first, fallback to lower quality if needed
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            facingMode: 'user',
            frameRate: { ideal: 30, max: 60 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('High quality stream obtained');
      } catch (highQualityError) {
        console.log('High quality failed, trying standard quality:', highQualityError);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        console.log('Standard quality stream obtained');
      }
      
      console.log('Media stream obtained:', stream);
      localStreamRef.current = stream;
      
      // Ensure video element is available and set the stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.log('Video play failed:', e));
        console.log('Local video element updated');
      } else {
        console.warn('Local video element not found, will retry when component mounts');
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      let errorMessage = 'Unable to access camera and microphone. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone access and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found. Please check your devices.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera or microphone is being used by another application.';
      } else {
        errorMessage += 'Please check your browser permissions and try again.';
      }
      
      setError(errorMessage);
      throw error;
    }
  };

  const joinMeeting = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      setIsJoining(true);
      setVideoLoading(true);
      setError(''); // Clear any previous errors
      console.log('Starting to join meeting...');
      
      // Initialize media first
      await initializeMedia();
      console.log('Media initialized, joining meeting...');
      
      // Join the meeting room
      socket.emit('join-meeting', {
        meetingId,
        userName: userName.trim()
      });
      
      console.log('Join meeting request sent');
    } catch (error) {
      console.error('Error joining meeting:', error);
      setIsJoining(false);
      setVideoLoading(false);
      if (!error.message.includes('Unable to access camera')) {
        setError('Failed to join meeting. Please try again.');
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        socket.emit('toggle-audio', {
          meetingId,
          audioEnabled: audioTrack.enabled
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        socket.emit('toggle-video', {
          meetingId,
          videoEnabled: videoTrack.enabled
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!screenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setScreenSharing(true);
        
        // Handle screen share end
        videoTrack.onended = () => {
          toggleScreenShare();
        };
      } else {
        // Stop screen sharing and return to camera
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        // Replace with camera track
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        setScreenSharing(false);
      }
      
      socket.emit('toggle-screen-share', {
        meetingId,
        screenSharing: !screenSharing
      });
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const leaveMeeting = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    
    navigate('/');
  };

  const copyMeetingLink = () => {
    const meetingLink = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(meetingLink);
  };

  // Show name input if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <Video className="w-16 h-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">Join Meeting</h1>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="input"
              onKeyPress={(e) => e.key === 'Enter' && joinMeeting()}
            />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={joinMeeting}
              className="btn btn-primary flex-1"
              disabled={!userName.trim() || isJoining}
            >
              <Video className="w-5 h-5" />
              {isJoining ? 'Joining...' : 'Join Meeting'}
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Video className="w-6 h-6 mr-2" />
          <h1 className="text-lg font-semibold">
            {meeting?.title || 'Video Meeting'}
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center text-sm text-gray-300">
            <Users className="w-4 h-4 mr-1" />
            {participants.length} participants
          </div>
          
          <button
            onClick={copyMeetingLink}
            className="btn btn-secondary text-sm"
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4">
        {focusedVideo ? (
          // Focused view - single large video
          <div className="h-full flex flex-col">
            <div className="flex-1 relative bg-gray-800 rounded-lg overflow-hidden mb-4">
              {focusedVideo === 'local' ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={(el) => {
                    remoteVideosRef.current[focusedVideo] = el;
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg text-lg font-medium">
                {focusedVideo === 'local' ? `You ${!videoEnabled ? '(Camera Off)' : ''}` : 
                 participants.find(p => p.id === focusedVideo)?.name}
              </div>
              <button
                onClick={() => setFocusedVideo(null)}
                className="absolute top-4 right-4 bg-black bg-opacity-70 hover:bg-opacity-90 p-2 rounded-lg"
                title="Exit focus mode"
              >
                <Users className="w-6 h-6" />
              </button>
            </div>
            
            {/* Thumbnail strip */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {/* Local video thumbnail */}
              <div 
                className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video min-w-[120px] cursor-pointer hover:ring-2 hover:ring-blue-500"
                onClick={() => setFocusedVideo('local')}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 px-1 py-0.5 rounded text-xs">
                  You
                </div>
              </div>
              
              {/* Remote video thumbnails */}
              {participants.map((participant) => (
                <div 
                  key={participant.id}
                  className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video min-w-[120px] cursor-pointer hover:ring-2 hover:ring-blue-500"
                  onClick={() => setFocusedVideo(participant.id)}
                >
                  <video
                    ref={(el) => {
                      remoteVideosRef.current[participant.id] = el;
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 px-1 py-0.5 rounded text-xs">
                    {participant.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Grid view - larger videos
          <div className="h-full">
            {participants.length === 0 ? (
              // Only local video - make it very large
              <div className="h-full flex items-center justify-center">
                <div className="relative bg-gray-800 rounded-lg overflow-hidden w-full max-w-4xl aspect-video">
                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-300">Loading video...</p>
                      </div>
                    </div>
                  )}
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    controls={false}
                    className="w-full h-full object-cover"
                    onLoadedData={() => setVideoLoading(false)}
                    onError={(e) => {
                      console.error('Video error:', e);
                      setVideoLoading(false);
                    }}
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg text-lg font-medium">
                    You {!videoEnabled && '(Camera Off)'}
                  </div>
                </div>
              </div>
            ) : participants.length === 1 ? (
              // Two videos - side by side, larger
              <div className="h-full flex gap-4">
                <div className="flex-1 relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    controls={false}
                    className="w-full h-full object-cover"
                    onError={(e) => console.error('Local video error:', e)}
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg text-lg font-medium">
                    You {!videoEnabled && '(Camera Off)'}
                  </div>
                  <button
                    onClick={() => setFocusedVideo('local')}
                    className="absolute top-4 right-4 bg-black bg-opacity-70 hover:bg-opacity-90 p-2 rounded-lg"
                    title="Focus on this video"
                  >
                    <Monitor className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={(el) => {
                      remoteVideosRef.current[participants[0].id] = el;
                    }}
                    autoPlay
                    playsInline
                    controls={false}
                    className="w-full h-full object-cover"
                    onError={(e) => console.error('Remote video error:', e)}
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg text-lg font-medium">
                    {participants[0].name}
                  </div>
                  <button
                    onClick={() => setFocusedVideo(participants[0].id)}
                    className="absolute top-4 right-4 bg-black bg-opacity-70 hover:bg-opacity-90 p-2 rounded-lg"
                    title="Focus on this video"
                  >
                    <Monitor className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              // Multiple videos - larger grid
              <div className="h-full grid grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Local Video */}
                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 px-3 py-1.5 rounded-lg text-sm font-medium">
                    You {!videoEnabled && '(Camera Off)'}
                  </div>
                  <button
                    onClick={() => setFocusedVideo('local')}
                    className="absolute top-3 right-3 bg-black bg-opacity-70 hover:bg-opacity-90 p-1.5 rounded-lg"
                    title="Focus on this video"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </div>

                {/* Remote Videos */}
                {participants.map((participant) => (
                  <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                    <video
                      ref={(el) => {
                        remoteVideosRef.current[participant.id] = el;
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 px-3 py-1.5 rounded-lg text-sm font-medium">
                      {participant.name}
                    </div>
                    <button
                      onClick={() => setFocusedVideo(participant.id)}
                      className="absolute top-3 right-3 bg-black bg-opacity-70 hover:bg-opacity-90 p-1.5 rounded-lg"
                      title="Focus on this video"
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${audioEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600 hover:bg-red-500'}`}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${videoEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600 hover:bg-red-500'}`}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full ${screenSharing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'}`}
            title={screenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {screenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          </button>

          <button
            onClick={leaveMeeting}
            className="p-3 rounded-full bg-red-600 hover:bg-red-500"
            title="Leave meeting"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
