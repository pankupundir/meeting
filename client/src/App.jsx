import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import MeetingRoom from './components/MeetingRoom';
import CreateMeeting from './components/CreateMeeting';
import ScheduledMeetings from './components/ScheduledMeetings';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create-meeting" element={<CreateMeeting />} />
          <Route path="/scheduled-meetings" element={<ScheduledMeetings />} />
          <Route path="/meeting/:meetingId" element={<MeetingRoom />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
