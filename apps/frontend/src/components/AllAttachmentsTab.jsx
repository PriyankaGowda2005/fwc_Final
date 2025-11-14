import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { jobAttachmentsAPI, jobPostingAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { 
  DocumentTextIcon,
  BriefcaseIcon,
  UserGroupIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const AllAttachmentsTab = ({ jobPostings = [], onScheduleInterview }) => {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('attachmentDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch all attachments for all jobs or a specific job
  const { data: allAttachmentsData, isLoading, error } = useQuery(
    ['all-attachments', selectedJobId, filterStatus, filterPriority, sortBy, sortOrder],
    async () => {
      if (selectedJobId === 'all') {
        // Fetch attachments for all jobs
        const promises = jobPostings.map(job => 
          jobAttachmentsAPI.getJobAttachments(job._id, {
            status: filterStatus !== 'all' ? filterStatus : undefined,
            priority: filterPriority !== 'all' ? filterPriority : undefined,
            sortBy,
            sortOrder
          }).catch(() => ({ data: { data: [] } })) // Handle errors gracefully
        );
        const results = await Promise.all(promises);
        const allAttachments = results.flatMap(result => result.data?.data || []);
        return { data: allAttachments };
      } else {
        // Fetch attachments for selected job
        const result = await jobAttachmentsAPI.getJobAttachments(selectedJobId, {
          status: filterStatus !== 'all' ? filterStatus : undefined,
          priority: filterPriority !== 'all' ? filterPriority : undefined,
          sortBy,
          sortOrder
        });
        return result;
      }
    },
    {
      enabled: jobPostings.length > 0,
      refetchInterval: 30000
    }
  );

  const attachments = allAttachmentsData?.data || [];

  // Update attachment status mutation
  const updateStatusMutation = useMutation(
    ({ attachmentId, data }) => jobAttachmentsAPI.updateAttachmentStatus(attachmentId, data),
    {
      onSuccess: () => {
        toast.success('Attachment status updated successfully!');
        queryClient.invalidateQueries(['all-attachments']);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to update status';
        toast.error(errorMessage);
      },
    }
  );

  // Remove attachment mutation
  const removeAttachmentMutation = useMutation(
    (attachmentId) => jobAttachmentsAPI.removeAttachment(attachmentId),
    {
      onSuccess: () => {
        toast.success('Attachment removed successfully!');
        queryClient.invalidateQueries(['all-attachments']);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to remove attachment';
        toast.error(errorMessage);
      },
    }
  );

  const handleStatusUpdate = async (attachmentId, status) => {
    await updateStatusMutation.mutateAsync({
      attachmentId,
      data: { status }
    });
  };

  const handleRemoveAttachment = async (attachmentId) => {
    if (window.confirm('Are you sure you want to remove this attachment?')) {
      await removeAttachmentMutation.mutateAsync(attachmentId);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ATTACHED': return 'bg-blue-100 text-blue-800';
      case 'SHORTLISTED': return 'bg-green-100 text-green-800';
      case 'INTERVIEW_SCHEDULED': return 'bg-yellow-100 text-yellow-800';
      case 'INTERVIEWED': return 'bg-purple-100 text-purple-800';
      case 'OFFERED': return 'bg-orange-100 text-orange-800';
      case 'HIRED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'NORMAL': return 'bg-blue-100 text-blue-800';
      case 'LOW': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Failed to load attachments</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">All Attachments</h3>
          <p className="text-sm text-gray-600">
            {attachments.length} candidate{attachments.length !== 1 ? 's' : ''} attached
            {selectedJobId !== 'all' && jobPostings.find(j => j._id === selectedJobId) && 
              ` to "${jobPostings.find(j => j._id === selectedJobId).title}"`
            }
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Jobs</option>
          {jobPostings.map(job => (
            <option key={job._id} value={job._id}>
              {job.title} - {job.department}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="ATTACHED">Attached</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
          <option value="INTERVIEWED">Interviewed</option>
          <option value="OFFERED">Offered</option>
          <option value="HIRED">Hired</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Priority</option>
          <option value="HIGH">High Priority</option>
          <option value="NORMAL">Normal Priority</option>
          <option value="LOW">Low Priority</option>
        </select>

        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-');
            setSortBy(field);
            setSortOrder(order);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="attachmentDate-desc">Newest First</option>
          <option value="attachmentDate-asc">Oldest First</option>
          <option value="fitScore-desc">Highest Score</option>
          <option value="fitScore-asc">Lowest Score</option>
          <option value="priority-desc">Priority (High to Low)</option>
          <option value="priority-asc">Priority (Low to High)</option>
        </select>
      </div>

      {/* Attachments Grid */}
      {attachments.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Attachments Found</h3>
          <p className="text-gray-600">
            {selectedJobId === 'all' 
              ? 'No candidates have been attached to any job posting yet.'
              : 'No candidates have been attached to this job posting yet.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {attachments.map((attachment) => (
            <motion.div
              key={attachment._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-lg font-medium text-blue-600">
                      {attachment.candidate?.name?.split(' ').map(n => n[0]).join('') || 
                       (attachment.candidate?.firstName?.[0] || '') + (attachment.candidate?.lastName?.[0] || '') || '??'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {attachment.candidate?.name || 
                       `${attachment.candidate?.firstName || ''} ${attachment.candidate?.lastName || ''}`.trim() || 
                       'Unknown Candidate'}
                    </h4>
                    <p className="text-sm text-gray-600 truncate">{attachment.candidate?.email}</p>
                    {attachment.jobPosting && (
                      <div className="flex items-center space-x-1 mt-1">
                        <BriefcaseIcon className="w-3 h-3 text-gray-400" />
                        <p className="text-xs text-gray-500 truncate">{attachment.jobPosting.title}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-1 ml-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(attachment.status)}`}>
                    {attachment.status}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(attachment.priority)}`}>
                    {attachment.priority}
                  </span>
                </div>
              </div>

              {/* Fit Score */}
              {attachment.fitScore && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Fit Score</span>
                    <span className={`text-sm font-bold ${getScoreColor(attachment.fitScore)}`}>
                      {attachment.fitScore}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        attachment.fitScore >= 80 ? 'bg-green-500' :
                        attachment.fitScore >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${attachment.fitScore}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Key Strengths */}
              {attachment.screening?.strengths && attachment.screening.strengths.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Key Strengths</h5>
                  <div className="space-y-1">
                    {attachment.screening.strengths.slice(0, 2).map((strength, index) => (
                      <div key={index} className="flex items-start text-xs text-green-700">
                        <CheckCircleIcon className="w-3 h-3 mt-0.5 mr-1 flex-shrink-0" />
                        <span className="line-clamp-2">{strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachment Notes */}
              {attachment.attachmentNotes && (
                <div className="mb-4 p-2 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800 line-clamp-2">{attachment.attachmentNotes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {/* Status Update Buttons */}
                <div className="flex space-x-1">
                  {attachment.status === 'ATTACHED' && (
                    <button
                      onClick={() => handleStatusUpdate(attachment._id, 'SHORTLISTED')}
                      disabled={updateStatusMutation.isLoading}
                      className="flex-1 px-3 py-2 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      Shortlist
                    </button>
                  )}
                  {attachment.status === 'SHORTLISTED' && onScheduleInterview && (
                    <button
                      onClick={() => onScheduleInterview(attachment)}
                      className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                    >
                      <CalendarIcon className="w-3 h-3" />
                      <span>Schedule Interview</span>
                    </button>
                  )}
                  {attachment.status === 'INTERVIEWED' && (
                    <button
                      onClick={() => handleStatusUpdate(attachment._id, 'OFFERED')}
                      disabled={updateStatusMutation.isLoading}
                      className="flex-1 px-3 py-2 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50"
                    >
                      Offer
                    </button>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveAttachment(attachment._id)}
                  disabled={removeAttachmentMutation.isLoading}
                  className="w-full px-3 py-2 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                >
                  <XCircleIcon className="w-3 h-3" />
                  <span>Remove Attachment</span>
                </button>
              </div>

              {/* Footer */}
              <div className="mt-3 text-xs text-gray-500">
                Attached: {new Date(attachment.attachmentDate).toLocaleDateString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllAttachmentsTab;

