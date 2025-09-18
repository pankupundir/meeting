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
  // Removed organizer and waiting room functionality
  
  // Media controls
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenSharingUser, setScreenSharingUser] = useState(null); // Track who is sharing screen
  const [focusedVideo, setFocusedVideo] = useState(null); // For focusing on a specific video
  const [videoLoading, setVideoLoading] = useState(false); // Track video loading state
  const [forceRender, setForceRender] = useState(0); // Force re-render for video elements
  
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
      console.log('Setting local video stream');
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(e => console.log('Video play failed on mount:', e));
    } else {
      console.warn('Local video setup failed:', {
        hasStream: !!localStreamRef.current,
        hasVideoElement: !!localVideoRef.current
      });
    }
  }, [isConnected]);

  // Additional effect to ensure local video is set when stream becomes available
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject) {
      console.log('Setting local video stream (delayed)');
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(e => console.log('Video play failed (delayed):', e));
    }
  }, [localStreamRef.current, localVideoRef.current]);

  // Function to ensure video element is ready and set stream
  const ensureVideoElementReady = (userId, stream) => {
    const videoElement = remoteVideosRef.current[userId];
    console.log(`ensureVideoElementReady called for ${userId}:`, {
      videoElement: !!videoElement,
      stream: !!stream,
      streamTracks: stream ? stream.getTracks().length : 0
    });
    
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch(e => console.log('Video play failed:', e));
      console.log(`Video element ready and stream set for: ${userId}`);
      return true;
    } else {
      console.warn(`Cannot set stream for ${userId}:`, {
        videoElement: !!videoElement,
        stream: !!stream
      });
    }
    return false;
  };

  // Debug function to check video state
  const debugVideoState = () => {
    console.log('=== VIDEO STATE DEBUG ===');
    console.log('Participants:', participants.map(p => ({ id: p.id, name: p.name })));
    console.log('Peer connections:', Object.keys(peerConnectionsRef.current));
    console.log('Video elements:', Object.keys(remoteVideosRef.current));
    
    participants.forEach(participant => {
      const peerConnection = peerConnectionsRef.current[participant.id];
      const videoElement = remoteVideosRef.current[participant.id];
      console.log(`Participant ${participant.name} (${participant.id}):`, {
        hasPeerConnection: !!peerConnection,
        hasRemoteStream: !!peerConnection?.remoteStream,
        hasVideoElement: !!videoElement,
        videoSrcObject: !!videoElement?.srcObject,
        videoReadyState: videoElement?.readyState,
        connectionState: peerConnection?.connectionState
      });
    });
    console.log('=== END DEBUG ===');
  };

  // Effect to handle delayed stream assignment when video elements become available
  useEffect(() => {
    // Check if we have any pending streams that need to be assigned
    Object.entries(peerConnectionsRef.current).forEach(([userId, peerConnection]) => {
      if (peerConnection.remoteStream && !remoteVideosRef.current[userId]?.srcObject) {
        console.log(`Attempting to assign pending stream for: ${userId}`);
        ensureVideoElementReady(userId, peerConnection.remoteStream);
      }
    });
    
    // Debug video state
    debugVideoState();
  }, [forceRender, participants.length]);

  // Additional effect to periodically check and fix video streams
  useEffect(() => {
    const interval = setInterval(() => {
      participants.forEach(participant => {
        const peerConnection = peerConnectionsRef.current[participant.id];
        const videoElement = remoteVideosRef.current[participant.id];
        
        if (peerConnection?.remoteStream && videoElement && !videoElement.srcObject) {
          console.log(`Fixing missing stream for ${participant.name}`);
          ensureVideoElementReady(participant.id, peerConnection.remoteStream);
        }
      });
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, [participants]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('https://meeting-sooty.vercel.app');
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('meeting-joined', (data) => {
      console.log('Meeting joined:', data);
      setMeeting(data.meeting);
      // Filter out self from participants list to avoid duplicates
      const otherParticipants = data.participants.filter(p => p.id !== newSocket.id);
      setParticipants(otherParticipants);
      setIsConnected(true);
      setIsJoining(false);
      setVideoLoading(false);
      
      // Create peer connections with existing participants
      // Add delay to ensure media is initialized and video elements are created
      setTimeout(() => {
        otherParticipants.forEach(participant => {
          // Only initiate connection if our socket ID is smaller (to avoid duplicate connections)
          const shouldInitiate = newSocket.id < participant.id;
          console.log(`Creating peer connection with existing participant: ${participant.name}, shouldInitiate: ${shouldInitiate}`);
          createPeerConnection(participant.id, shouldInitiate);
        });
      }, 1000); // Delay to ensure everything is ready
    });

    newSocket.on('user-joined', (participant) => {
      console.log('User joined:', participant);
      setParticipants(prev => {
        // Check if participant already exists to avoid duplicates
        const exists = prev.find(p => p.id === participant.id);
        if (!exists) {
          // Force re-render to ensure video elements are created
          setForceRender(prev => prev + 1);
          return [...prev, participant];
        }
        return prev;
      });
      
      // Create peer connection with the new participant
      // Add a small delay to ensure the participant has initialized their media
      setTimeout(() => {
        // Only initiate connection if our socket ID is smaller (to avoid duplicate connections)
        const shouldInitiate = newSocket.id < participant.id;
        console.log(`Creating peer connection with new participant: ${participant.name}, shouldInitiate: ${shouldInitiate}`);
        createPeerConnection(participant.id, shouldInitiate);
      }, 500); // Reduced delay since new participant will also create connections
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
      console.log('Offer details:', {
        type: data.offer.type,
        sdp: data.offer.sdp ? data.offer.sdp.substring(0, 100) + '...' : 'no sdp'
      });
      await handleOffer(data.offer, data.from);
    });

    newSocket.on('answer', async (data) => {
      console.log('Received answer from:', data.from);
      console.log('Answer details:', {
        type: data.answer.type,
        sdp: data.answer.sdp ? data.answer.sdp.substring(0, 100) + '...' : 'no sdp'
      });
      await handleAnswer(data.answer, data.from);
    });

    newSocket.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.from);
      console.log('ICE candidate details:', {
        candidate: data.candidate.candidate,
        sdpMLineIndex: data.candidate.sdpMLineIndex,
        sdpMid: data.candidate.sdpMid
      });
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

    // Removed waiting room events - participants join directly

    newSocket.on('user-screen-share-toggled', (data) => {
      console.log('Screen share toggled by:', data.userId, 'sharing:', data.screenSharing);
      if (data.screenSharing) {
        setScreenSharingUser(data.userId);
      } else {
        setScreenSharingUser(null);
        // If the current user was sharing and stopped, also clear local state
        if (data.userId === newSocket.id) {
          setScreenSharing(false);
        }
      }
    });


    return () => {
      newSocket.close();
    };
  }, [meetingId]);

  const createPeerConnection = async (userId, isInitiator) => {
    console.log(`Creating peer connection with ${userId}, isInitiator: ${isInitiator}`);
    console.log('Local stream available:', !!localStreamRef.current);
    
    // Check if we already have a peer connection with this user
    if (peerConnectionsRef.current[userId]) {
      console.log(`Peer connection already exists with ${userId}, skipping creation`);
      return; // Don't create duplicate connections
    }
    
    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[userId] = peerConnection;

    // Add local stream to peer connection using modern WebRTC API
    if (localStreamRef.current) {
      // Use addStream for better compatibility
      peerConnection.addStream(localStreamRef.current);
      console.log(`Added local stream to peer connection with ${userId}`);
      
      // Also add tracks individually for modern browsers
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
        console.log(`Added ${track.kind} track to peer connection with ${userId}`);
      });
    } else {
      console.warn('No local stream available when creating peer connection with', userId);
    }

    // Handle remote stream - Modern WebRTC approach
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', userId);
      console.log('Stream details:', {
        streams: event.streams.length,
        tracks: event.streams[0]?.getTracks().length || 0,
        videoTracks: event.streams[0]?.getVideoTracks().length || 0,
        audioTracks: event.streams[0]?.getAudioTracks().length || 0,
        track: event.track ? event.track.kind : 'no track'
      });
      
      // Get the stream from the event
      const remoteStream = event.streams[0] || event.stream;
      
      if (!remoteStream) {
        console.error('No remote stream found in ontrack event');
        return;
      }
      
      // Store the stream for later use if video element is not ready
      peerConnection.remoteStream = remoteStream;
      
      // Create a new MediaStream with the received track
      const mediaStream = new MediaStream();
      mediaStream.addTrack(event.track);
      
      console.log(`Created MediaStream for ${userId} with track:`, event.track.kind);
      
      const videoElement = remoteVideosRef.current[userId];
      if (videoElement) {
        console.log(`Setting stream directly for ${userId}`);
        videoElement.srcObject = mediaStream;
        videoElement.play().catch(e => console.log('Remote video play failed:', e));
        console.log('Remote video element updated for:', userId);
      } else {
        console.warn('Remote video element not found for:', userId);
        // Retry multiple times with increasing delays
        let retryCount = 0;
        const maxRetries = 15; // Increased retries
        const retryInterval = 300; // Increased interval
        
        const retrySetStream = () => {
          const retryElement = remoteVideosRef.current[userId];
          if (retryElement) {
            console.log(`Setting stream on retry for ${userId}`);
            retryElement.srcObject = mediaStream;
            retryElement.play().catch(e => console.log('Remote video play failed on retry:', e));
            console.log('Remote video element updated on retry for:', userId);
          } else if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retry ${retryCount}/${maxRetries} for ${userId}`);
            setTimeout(retrySetStream, retryInterval * retryCount);
          } else {
            console.error('Failed to set remote stream after maximum retries for:', userId);
          }
        };
        
        setTimeout(retrySetStream, retryInterval);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${userId}:`, {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid
        });
        // Use the socket from state instead of the local variable
        if (socket) {
          socket.emit('ice-candidate', {
            meetingId,
            candidate: event.candidate,
            target: userId
          });
        }
      } else {
        console.log(`ICE gathering complete for ${userId}`);
      }
    };

    // Add connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed') {
        console.error(`Connection failed with ${userId}, attempting to reconnect...`);
        // Clean up and retry connection
        setTimeout(() => {
          if (peerConnectionsRef.current[userId]) {
            peerConnectionsRef.current[userId].close();
            delete peerConnectionsRef.current[userId];
            createPeerConnection(userId, isInitiator);
          }
        }, 2000);
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      try {
        console.log(`Creating offer for ${userId}`);
        const offer = await peerConnection.createOffer();
        console.log(`Offer created for ${userId}:`, {
          type: offer.type,
          sdp: offer.sdp ? offer.sdp.substring(0, 100) + '...' : 'no sdp'
        });
        await peerConnection.setLocalDescription(offer);
        console.log(`Local description set for ${userId}`);
        if (socket) {
          socket.emit('offer', {
            meetingId,
            offer,
            target: userId
          });
          console.log(`Offer sent to ${userId}`);
        }
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  };

  const handleOffer = async (offer, from) => {
    console.log(`Handling offer from ${from}`);
    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[from] = peerConnection;

    // Add local stream using modern WebRTC API
    if (localStreamRef.current) {
      // Use addStream for better compatibility
      peerConnection.addStream(localStreamRef.current);
      console.log(`Added local stream to peer connection for ${from}`);
      
      // Also add tracks individually for modern browsers
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
        console.log(`Added ${track.kind} track to peer connection for ${from}`);
      });
    } else {
      console.warn('No local stream available when handling offer from', from);
    }

    // Handle remote stream - Modern WebRTC approach
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from (offer):', from);
      console.log('Stream details (offer):', {
        streams: event.streams.length,
        tracks: event.streams[0]?.getTracks().length || 0,
        videoTracks: event.streams[0]?.getVideoTracks().length || 0,
        audioTracks: event.streams[0]?.getAudioTracks().length || 0,
        track: event.track ? event.track.kind : 'no track'
      });
      
      // Get the stream from the event
      const remoteStream = event.streams[0] || event.stream;
      
      if (!remoteStream) {
        console.error('No remote stream found in ontrack event (offer)');
        return;
      }
      
      // Store the stream for later use if video element is not ready
      peerConnection.remoteStream = remoteStream;
      
      // Create a new MediaStream with the received track
      const mediaStream = new MediaStream();
      mediaStream.addTrack(event.track);
      
      console.log(`Created MediaStream for ${from} with track:`, event.track.kind);
      
      const videoElement = remoteVideosRef.current[from];
      if (videoElement) {
        console.log(`Setting stream directly for ${from} (offer)`);
        videoElement.srcObject = mediaStream;
        videoElement.play().catch(e => console.log('Remote video play failed (offer):', e));
        console.log('Remote video element updated for (offer):', from);
      } else {
        console.warn('Remote video element not found for (offer):', from);
        // Retry multiple times with increasing delays
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 200;
        
        const retrySetStream = () => {
          const retryElement = remoteVideosRef.current[from];
          if (retryElement) {
            console.log(`Setting stream on retry for ${from} (offer)`);
            retryElement.srcObject = mediaStream;
            retryElement.play().catch(e => console.log('Remote video play failed on retry (offer):', e));
            console.log('Remote video element updated on retry (offer) for:', from);
          } else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(retrySetStream, retryInterval * retryCount);
          } else {
            console.error('Failed to set remote stream after maximum retries (offer) for:', from);
          }
        };
        
        setTimeout(retrySetStream, retryInterval);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (socket) {
          socket.emit('ice-candidate', {
            meetingId,
            candidate: event.candidate,
            target: from
          });
        }
      }
    };

    try {
      console.log(`Setting remote description for ${from}`);
      await peerConnection.setRemoteDescription(offer);
      console.log(`Remote description set for ${from}`);
      
      console.log(`Creating answer for ${from}`);
      const answer = await peerConnection.createAnswer();
      console.log(`Answer created for ${from}:`, {
        type: answer.type,
        sdp: answer.sdp ? answer.sdp.substring(0, 100) + '...' : 'no sdp'
      });
      
      await peerConnection.setLocalDescription(answer);
      console.log(`Local description set for ${from}`);
      
      if (socket) {
        socket.emit('answer', {
          meetingId,
          answer,
          target: from
        });
        console.log(`Answer sent to ${from}`);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer, from) => {
    console.log(`Handling answer from ${from}`);
    const peerConnection = peerConnectionsRef.current[from];
    if (peerConnection) {
      try {
        console.log(`Setting remote description (answer) for ${from}`);
        await peerConnection.setRemoteDescription(answer);
        console.log(`Remote description (answer) set for ${from}`);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    } else {
      console.error(`No peer connection found for ${from} when handling answer`);
    }
  };

  const handleIceCandidate = async (candidate, from) => {
    console.log(`Handling ICE candidate from ${from}`);
    const peerConnection = peerConnectionsRef.current[from];
    if (peerConnection) {
      try {
        console.log(`Adding ICE candidate for ${from}`);
        await peerConnection.addIceCandidate(candidate);
        console.log(`ICE candidate added for ${from}`);
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    } else {
      console.error(`No peer connection found for ${from} when handling ICE candidate`);
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
      if (socket) {
        socket.emit('join-meeting', {
          meetingId,
          userName: userName.trim()
        });
      }
      
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
        if (socket) {
          socket.emit('toggle-audio', {
            meetingId,
            audioEnabled: audioTrack.enabled
          });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        if (socket) {
          socket.emit('toggle-video', {
            meetingId,
            videoEnabled: videoTrack.enabled
          });
        }
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
        setScreenSharingUser(socket.id); // Set self as screen sharing user
        
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
        setScreenSharingUser(null); // Clear screen sharing user
      }
      
      if (socket) {
        socket.emit('toggle-screen-share', {
          meetingId,
          screenSharing: !screenSharing
        });
      }
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

  // Removed admission functions - participants join directly

  // Removed waiting room UI - participants join directly

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
            {participants.length + 1} participants
          </div>
          
          <button
            onClick={copyMeetingLink}
            className="btn btn-secondary text-sm"
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </button>
          
          <button
            onClick={debugVideoState}
            className="btn btn-secondary text-sm"
            title="Debug video state"
          >
            Debug
          </button>
        </div>
      </div>

      {/* Removed waiting participants panel - participants join directly */}

      {/* Video Grid */}
      <div className="flex-1 p-4">
        {screenSharingUser ? (
          // Screen sharing view - show only the screen share
          <div className="h-full flex flex-col">
            <div className="flex-1 relative bg-gray-800 rounded-lg overflow-hidden mb-4">
              {screenSharingUser === socket.id ? (
                // Local screen share
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                // Remote screen share
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideosRef.current[screenSharingUser] = el;
                      
                      // If we already have a stream for this participant, set it immediately
                      if (peerConnectionsRef.current[screenSharingUser]?.remoteStream) {
                        console.log(`Setting up screen share video element for ${screenSharingUser} with existing stream`);
                        ensureVideoElementReady(screenSharingUser, peerConnectionsRef.current[screenSharingUser].remoteStream);
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              )}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg text-lg font-medium">
                {screenSharingUser === socket.id ? 'You are sharing your screen' : 
                 `${participants.find(p => p.id === screenSharingUser)?.name || 'Someone'} is sharing their screen`}
              </div>
            </div>
            
            {/* Thumbnail strip for other participants */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {/* Local video thumbnail (if not sharing) */}
              {screenSharingUser !== socket.id && (
                <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video min-w-[120px]">
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
              )}
              
              {/* Remote video thumbnails (excluding screen sharer) */}
              {participants
                .filter(p => p.id !== screenSharingUser)
                .map((participant) => (
                <div 
                  key={participant.id}
                  className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video min-w-[120px]"
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
        ) : focusedVideo ? (
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
                    if (el) {
                      remoteVideosRef.current[focusedVideo] = el;
                      
                      // If we already have a stream for this participant, set it immediately
                      if (peerConnectionsRef.current[focusedVideo]?.remoteStream) {
                        console.log(`Setting up focused video element for ${focusedVideo} with existing stream`);
                        ensureVideoElementReady(focusedVideo, peerConnectionsRef.current[focusedVideo].remoteStream);
                      }
                    }
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
                      if (el) {
                        remoteVideosRef.current[participant.id] = el;
                        console.log(`Video element created for participant: ${participant.name} (${participant.id})`);
                        
                        // If we already have a stream for this participant, set it immediately
                        if (peerConnectionsRef.current[participant.id]?.remoteStream) {
                          console.log(`Setting up video element for ${participant.name} with existing stream`);
                          ensureVideoElementReady(participant.id, peerConnectionsRef.current[participant.id].remoteStream);
                        }
                      }
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
                    key={`video-${participants[0].id}-${forceRender}`}
                      ref={(el) => {
                        if (el) {
                          remoteVideosRef.current[participants[0].id] = el;
                          console.log(`Video element created for participant: ${participants[0].name} (${participants[0].id})`);
                          console.log(`Video element details:`, {
                            element: !!el,
                            srcObject: !!el.srcObject,
                            readyState: el.readyState,
                            hasPeerConnection: !!peerConnectionsRef.current[participants[0].id],
                            hasRemoteStream: !!peerConnectionsRef.current[participants[0].id]?.remoteStream
                          });
                          
                          // If we already have a stream for this participant, set it immediately
                          if (peerConnectionsRef.current[participants[0].id]?.remoteStream) {
                            console.log(`Setting up video element for ${participants[0].name} with existing stream`);
                            ensureVideoElementReady(participants[0].id, peerConnectionsRef.current[participants[0].id].remoteStream);
                          }
                        }
                      }}
                    autoPlay
                    playsInline
                    controls={false}
                    className="w-full h-full object-cover"
                    onLoadedData={() => {
                      console.log(`Video loaded for participant: ${participants[0].name}`);
                    }}
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
                  <div key={`${participant.id}-${forceRender}`} className="relative bg-gray-800 rounded-lg overflow-hidden">
                    <video
                      key={`video-${participant.id}-${forceRender}`}
                      ref={(el) => {
                        if (el) {
                          remoteVideosRef.current[participant.id] = el;
                          console.log(`Video element created for participant: ${participant.name} (${participant.id})`);
                          
                          // If we already have a stream for this participant, set it immediately
                          const existingStream = el.srcObject;
                          if (!existingStream && peerConnectionsRef.current[participant.id]?.remoteStream) {
                            console.log(`Setting up video element for ${participant.name} with existing stream`);
                            ensureVideoElementReady(participant.id, peerConnectionsRef.current[participant.id].remoteStream);
                          }
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      onLoadedData={() => {
                        console.log(`Video loaded for participant: ${participant.name}`);
                      }}
                      onError={(e) => {
                        console.error(`Video error for ${participant.name}:`, e);
                      }}
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
