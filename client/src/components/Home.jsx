import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Users, Clock } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState('');

  const handleJoinMeeting = () => {
    if (meetingId.trim()) {
      navigate(`/meeting/${meetingId.trim()}`);
    }
  };

  const handleCreateInstantMeeting = async () => {
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isInstant: true,
          title: 'Instant Meeting'
        }),
      });

      const data = await response.json();
      navigate(`/meeting/${data.meetingId}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Video className="w-12 h-12 text-blue-600 mr-4" />
            <h1 className="text-4xl font-bold text-gray-900">VideoMeet</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with friends and colleagues through high-quality video calls. 
            Start instant meetings or schedule them for later.
          </p>
        </div>

        {/* Main Actions */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-2 gap-8 mb-12">
            {/* Start Instant Meeting */}
            <div className="card text-center">
              <Video className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-4">Start Instant Meeting</h2>
              <p className="text-gray-600 mb-6">
                Start a video call immediately and share the link with others
              </p>
              <button 
                onClick={handleCreateInstantMeeting}
                className="btn btn-primary w-full"
              >
                <Video className="w-5 h-5" />
                Start Now
              </button>
            </div>

            {/* Schedule Meeting */}
            <div className="card text-center">
              <Calendar className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-4">Schedule Meeting</h2>
              <p className="text-gray-600 mb-6">
                Plan your video calls in advance and send invitations
              </p>
              <button 
                onClick={() => navigate('/create-meeting')}
                className="btn btn-success w-full"
              >
                <Calendar className="w-5 h-5" />
                Schedule
              </button>
            </div>
          </div>

          {/* Join Meeting */}
          <div className="card max-w-md mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-6">Join Meeting</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting ID or Link
                </label>
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="Enter meeting ID or paste link"
                  className="input"
                />
              </div>
              <button 
                onClick={handleJoinMeeting}
                className="btn btn-primary w-full"
                disabled={!meetingId.trim()}
              >
                <Users className="w-5 h-5" />
                Join Meeting
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-12 text-center">
            <button 
              onClick={() => navigate('/scheduled-meetings')}
              className="btn btn-secondary mr-4"
            >
              <Clock className="w-5 h-5" />
              View Scheduled Meetings
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-6xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">HD Video Calls</h3>
              <p className="text-gray-600">
                Crystal clear video quality for seamless communication
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Multiple Participants</h3>
              <p className="text-gray-600">
                Connect with multiple people in a single meeting
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Scheduling</h3>
              <p className="text-gray-600">
                Schedule meetings and share links with participants
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

