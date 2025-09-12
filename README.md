# VideoMeet - Video Chat Application

A Google Meet-like video chat application built with React, Node.js, Socket.io, and WebRTC. Users can create instant meetings, schedule meetings, and share meeting links with friends for video calls.

## Features

- 🎥 **HD Video Calls** - Crystal clear video quality using WebRTC
- 🎤 **Audio Controls** - Mute/unmute audio during calls
- 📹 **Video Controls** - Turn camera on/off during calls
- 🖥️ **Screen Sharing** - Share your screen with other participants
- ⚡ **Instant Meetings** - Start video calls immediately
- 📅 **Scheduled Meetings** - Plan meetings in advance
- 🔗 **Link Sharing** - Share meeting links with participants
- 👥 **Multiple Participants** - Support for multiple users in a single meeting
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Socket.io Client** - Real-time communication
- **WebRTC** - Peer-to-peer video/audio communication
- **React Router** - Client-side routing
- **Lucide React** - Beautiful icons
- **Date-fns** - Date manipulation

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **UUID** - Unique meeting ID generation
- **Node-cron** - Scheduled task management

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd video-meet
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Install client dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

## Running the Application

### Development Mode

Run both frontend and backend simultaneously:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend development server on `http://localhost:5173`

### Individual Services

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

### Production Mode

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```

## Usage

### Starting an Instant Meeting
1. Go to the home page
2. Click "Start Instant Meeting"
3. Enter your name when prompted
4. Share the meeting link with others

### Scheduling a Meeting
1. Click "Schedule Meeting" on the home page
2. Fill in meeting details (title, start time, end time)
3. Click "Create Meeting"
4. Copy and share the meeting link

### Joining a Meeting
1. Click "Join Meeting" on the home page
2. Enter the meeting ID or paste the meeting link
3. Enter your name
4. Click "Join Meeting"

### During a Meeting
- **Mute/Unmute**: Click the microphone button
- **Turn Camera On/Off**: Click the video camera button
- **Share Screen**: Click the monitor button
- **Leave Meeting**: Click the phone button

## API Endpoints

### Meetings
- `POST /api/meetings` - Create a new meeting
- `GET /api/meetings/:id` - Get meeting details
- `GET /api/meetings` - Get all scheduled meetings

### Socket Events
- `join-meeting` - Join a meeting room
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange
- `toggle-audio` - Toggle audio state
- `toggle-video` - Toggle video state
- `toggle-screen-share` - Toggle screen sharing

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

**Note**: WebRTC requires HTTPS in production environments.

## Environment Variables

Create a `.env` file in the server directory:

```env
PORT=3001
NODE_ENV=development
```

## Deployment

### Frontend (Vercel/Netlify)
1. Build the project: `npm run build`
2. Deploy the `client/dist` folder

### Backend (Heroku/Railway/DigitalOcean)
1. Set environment variables
2. Deploy the server directory
3. Update CORS settings for production domain

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Common Issues

**Camera/Microphone not working:**
- Ensure browser permissions are granted
- Check if other applications are using the camera/microphone
- Try refreshing the page

**Connection issues:**
- Check your internet connection
- Ensure firewall isn't blocking WebRTC traffic
- Try using a different browser

**Meeting not found:**
- Verify the meeting ID is correct
- Check if the meeting has expired
- Ensure the meeting was created successfully

## Future Enhancements

- [ ] Chat functionality during meetings
- [ ] Meeting recording
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Meeting analytics
- [ ] Mobile app
- [ ] Integration with calendar systems
- [ ] Advanced screen sharing options
- [ ] Meeting transcription
- [ ] Custom meeting themes

