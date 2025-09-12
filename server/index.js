const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store active meetings and scheduled meetings
const activeMeetings = new Map();
const scheduledMeetings = new Map();

// Clean up expired meetings every hour
cron.schedule('0 * * * *', () => {
  const now = new Date();
  for (const [meetingId, meeting] of scheduledMeetings.entries()) {
    if (meeting.endTime && new Date(meeting.endTime) < now) {
      scheduledMeetings.delete(meetingId);
      activeMeetings.delete(meetingId);
    }
  }
});

// API Routes
app.post('/api/meetings', (req, res) => {
  const { title, startTime, endTime, isInstant } = req.body;
  const meetingId = uuidv4();
  
  const meeting = {
    id: meetingId,
    title: title || 'Instant Meeting',
    startTime: isInstant ? new Date() : new Date(startTime),
    endTime: isInstant ? null : new Date(endTime),
    isInstant,
    participants: [],
    createdAt: new Date()
  };

  if (isInstant) {
    activeMeetings.set(meetingId, meeting);
  } else {
    scheduledMeetings.set(meetingId, meeting);
  }

  res.json({ meetingId, meeting });
});

app.get('/api/meetings/:id', (req, res) => {
  const { id } = req.params;
  const meeting = activeMeetings.get(id) || scheduledMeetings.get(id);
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  res.json({ meeting });
});

app.get('/api/meetings', (req, res) => {
  const meetings = Array.from(scheduledMeetings.values());
  res.json({ meetings });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join meeting room
  socket.on('join-meeting', (data) => {
    const { meetingId, userName } = data;
    const meeting = activeMeetings.get(meetingId) || scheduledMeetings.get(meetingId);
    
    if (!meeting) {
      socket.emit('error', { message: 'Meeting not found' });
      return;
    }

    // Check if meeting is scheduled and not yet started
    if (!meeting.isInstant && new Date(meeting.startTime) > new Date()) {
      socket.emit('error', { message: 'Meeting has not started yet' });
      return;
    }

    // Check if meeting has ended
    if (meeting.endTime && new Date(meeting.endTime) < new Date()) {
      socket.emit('error', { message: 'Meeting has ended' });
      return;
    }

    socket.join(meetingId);
    
    // Add participant to meeting
    const participant = {
      id: socket.id,
      name: userName,
      joinedAt: new Date()
    };
    
    meeting.participants.push(participant);
    
    // Move from scheduled to active if it's time
    if (!meeting.isInstant && scheduledMeetings.has(meetingId)) {
      scheduledMeetings.delete(meetingId);
      activeMeetings.set(meetingId, meeting);
    }

    // Notify others in the room
    socket.to(meetingId).emit('user-joined', participant);
    
    // Send current participants to the new user
    socket.emit('meeting-joined', {
      meeting,
      participants: meeting.participants
    });

    console.log(`${userName} joined meeting ${meetingId}`);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    console.log('Offer received from:', socket.id, 'to:', data.target);
    if (data.target) {
      socket.to(data.target).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    } else {
      socket.to(data.meetingId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    console.log('Answer received from:', socket.id, 'to:', data.target);
    if (data.target) {
      socket.to(data.target).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    } else {
      socket.to(data.meetingId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    console.log('ICE candidate received from:', socket.id, 'to:', data.target);
    if (data.target) {
      socket.to(data.target).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    } else {
      socket.to(data.meetingId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  // Handle user actions
  socket.on('toggle-audio', (data) => {
    socket.to(data.meetingId).emit('user-audio-toggled', {
      userId: socket.id,
      audioEnabled: data.audioEnabled
    });
  });

  socket.on('toggle-video', (data) => {
    socket.to(data.meetingId).emit('user-video-toggled', {
      userId: socket.id,
      videoEnabled: data.videoEnabled
    });
  });

  socket.on('toggle-screen-share', (data) => {
    socket.to(data.meetingId).emit('user-screen-share-toggled', {
      userId: socket.id,
      screenSharing: data.screenSharing
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove participant from all meetings
    for (const [meetingId, meeting] of activeMeetings.entries()) {
      const participantIndex = meeting.participants.findIndex(p => p.id === socket.id);
      if (participantIndex !== -1) {
        const participant = meeting.participants[participantIndex];
        meeting.participants.splice(participantIndex, 1);
        
        // Notify others in the room
        socket.to(meetingId).emit('user-left', { userId: socket.id, participant });
        
        // Remove meeting if no participants left
        if (meeting.participants.length === 0 && meeting.isInstant) {
          activeMeetings.delete(meetingId);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
