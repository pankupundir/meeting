import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, Link, Copy } from 'lucide-react';
import { format } from 'date-fns';

const CreateMeeting = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    description: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('https://meeting-sooty.vercel.app/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          startTime: formData.startTime,
          endTime: formData.endTime,
          isInstant: false
        }),
      });

      const data = await response.json();
      setCreatedMeeting(data);
    } catch (error) {
      console.error('Error creating meeting:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const copyMeetingLink = () => {
    const meetingLink = `${window.location.origin}/meeting/${createdMeeting.meetingId}`;
    navigator.clipboard.writeText(meetingLink);
    // You could add a toast notification here
  };

  const joinMeeting = () => {
    navigate(`/meeting/${createdMeeting.meetingId}`);
  };

  // Set default start time to current time + 1 hour
  const getDefaultStartTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  // Set default end time to start time + 1 hour
  const getDefaultEndTime = () => {
    const startTime = new Date(formData.startTime || getDefaultStartTime());
    startTime.setHours(startTime.getHours() + 1);
    return startTime.toISOString().slice(0, 16);
  };

  if (createdMeeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
        <div className="card max-w-2xl w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">Meeting Created Successfully!</h1>
          <p className="text-gray-600 mb-8">
            Your meeting has been scheduled and is ready to share.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold mb-2">Meeting Details:</h3>
            <p><strong>Title:</strong> {createdMeeting.meeting.title}</p>
            <p><strong>Start Time:</strong> {format(new Date(createdMeeting.meeting.startTime), 'PPP p')}</p>
            {createdMeeting.meeting.endTime && (
              <p><strong>End Time:</strong> {format(new Date(createdMeeting.meeting.endTime), 'PPP p')}</p>
            )}
            <p><strong>Meeting ID:</strong> {createdMeeting.meetingId}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <Link className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-sm text-gray-600">Meeting Link:</span>
              </div>
              <button
                onClick={copyMeetingLink}
                className="btn btn-secondary text-sm"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={joinMeeting}
                className="btn btn-primary flex-1"
              >
                <Users className="w-5 h-5" />
                Join Meeting Now
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn btn-secondary flex-1"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full">
        <div className="text-center mb-8">
          <Calendar className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Schedule a Meeting</h1>
          <p className="text-gray-600">
            Create a scheduled meeting and share the link with participants
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter meeting title"
              className="input"
              required
            />
          </div>

          <div className="grid grid-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                min={new Date().toISOString().slice(0, 16)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                min={formData.startTime || new Date().toISOString().slice(0, 16)}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Add a description for your meeting"
              rows={3}
              className="input resize-none"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isCreating}
              className="btn btn-primary flex-1"
            >
              {isCreating ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Create Meeting
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMeeting;

