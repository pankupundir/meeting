import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, Play, Copy, Trash2 } from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';

const ScheduledMeetings = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await fetch('https://meeting-sooty.vercel.app/api/meetings');
      const data = await response.json();
      setMeetings(data.meetings || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyMeetingLink = (meetingId) => {
    const meetingLink = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(meetingLink);
    // You could add a toast notification here
  };

  const joinMeeting = (meetingId) => {
    navigate(`/meeting/${meetingId}`);
  };

  const getMeetingStatus = (meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.startTime);
    const endTime = meeting.endTime ? new Date(meeting.endTime) : null;

    if (isBefore(now, startTime)) {
      return { status: 'upcoming', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    } else if (endTime && isAfter(now, endTime)) {
      return { status: 'ended', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    } else {
      return { status: 'live', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Calendar className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Scheduled Meetings</h1>
          <p className="text-gray-600">
            Manage your scheduled video meetings
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => navigate('/create-meeting')}
            className="btn btn-primary mr-4"
          >
            <Calendar className="w-5 h-5" />
            Schedule New Meeting
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Back to Home
          </button>
        </div>

        {/* Meetings List */}
        {meetings.length === 0 ? (
          <div className="card text-center max-w-md mx-auto">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Scheduled Meetings</h3>
            <p className="text-gray-600 mb-6">
              You don't have any scheduled meetings yet. Create one to get started!
            </p>
            <button
              onClick={() => navigate('/create-meeting')}
              className="btn btn-primary"
            >
              <Calendar className="w-5 h-5" />
              Schedule Meeting
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {meetings.map((meeting) => {
              const statusInfo = getMeetingStatus(meeting);
              return (
                <div key={meeting.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-xl font-semibold mr-3">{meeting.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.status === 'upcoming' && 'Upcoming'}
                          {statusInfo.status === 'live' && 'Live'}
                          {statusInfo.status === 'ended' && 'Ended'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-gray-600">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          <span>
                            {format(new Date(meeting.startTime), 'PPP p')}
                          </span>
                        </div>
                        {meeting.endTime && (
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            <span>
                              Ends: {format(new Date(meeting.endTime), 'PPP p')}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2" />
                          <span>
                            {meeting.participants?.length || 0} participants
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {statusInfo.status === 'live' && (
                      <button
                        onClick={() => joinMeeting(meeting.id)}
                        className="btn btn-success"
                      >
                        <Play className="w-4 h-4" />
                        Join Now
                      </button>
                    )}
                    
                    {statusInfo.status === 'upcoming' && (
                      <button
                        onClick={() => joinMeeting(meeting.id)}
                        className="btn btn-primary"
                      >
                        <Play className="w-4 h-4" />
                        Join Early
                      </button>
                    )}

                    <button
                      onClick={() => copyMeetingLink(meeting.id)}
                      className="btn btn-secondary"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this meeting?')) {
                          // Implement delete functionality
                          console.log('Delete meeting:', meeting.id);
                        }
                      }}
                      className="btn btn-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduledMeetings;

