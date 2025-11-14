import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  BriefcaseIcon,
  UserGroupIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  CpuChipIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentArrowDownIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

// Job Postings Tab Component
export const JobPostingsTab = ({ jobPostings, onCreateJob, onUpdateJob, onDeleteJob, departments }) => {
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredJobs = jobPostings.filter(job => {
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus
    const matchesSearch = searchTerm === '' || 
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-green-100 text-green-800'
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800'
      case 'CLOSED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Jobs</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCreateJob}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Create Job</span>
          </button>
          <div className="text-sm text-gray-600">
            {filteredJobs.length} jobs
          </div>
        </div>
      </div>

      {/* Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <BriefcaseIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No job postings found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm ? 'Try adjusting your search criteria' : 'Create your first job posting to get started'}
          </p>
          <button
            onClick={onCreateJob}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create First Job
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <motion.div
              key={job._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                    <div className="flex items-center space-x-1">
                      <BuildingOfficeIcon className="w-4 h-4" />
                      <span>{job.department}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPinIcon className="w-4 h-4" />
                      <span>{job.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <CurrencyDollarIcon className="w-4 h-4" />
                      <span>${job.salaryMin?.toLocaleString()} - ${job.salaryMax?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ClockIcon className="w-4 h-4" />
                      <span>{job.employmentType}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{job.description}</p>

              {/* Job Stats */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>{job.currentApplications || 0} applications</span>
                <span>Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => onUpdateJob(job._id, job)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => onDeleteJob(job._id)}
                  className="flex-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// Candidates Tab Component
export const CandidatesTab = ({ candidates, onStartAIInterview, selectedJob, onInviteCandidate, onScreenResume }) => {
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Debug logging for candidates
  console.log('🔍 CandidatesTab - candidates prop:', candidates)
  console.log('🔍 CandidatesTab - candidates length:', candidates?.length)
  console.log('🔍 CandidatesTab - filterStatus:', filterStatus)
  console.log('🔍 CandidatesTab - searchTerm:', searchTerm)

  const filteredCandidates = candidates.filter(candidate => {
    const matchesStatus = filterStatus === 'all' || candidate.status === filterStatus
    const matchesSearch = searchTerm === '' || 
      candidate.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  console.log('🔍 CandidatesTab - filteredCandidates:', filteredCandidates)
  console.log('🔍 CandidatesTab - filteredCandidates length:', filteredCandidates?.length)

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'APPLIED': return 'bg-blue-100 text-blue-800'
      case 'SCREENING': return 'bg-yellow-100 text-yellow-800'
      case 'INTERVIEWED': return 'bg-purple-100 text-purple-800'
      case 'OFFERED': return 'bg-indigo-100 text-indigo-800'
      case 'HIRED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Candidates</option>
            <option value="ACTIVE">Active</option>
            <option value="APPLIED">Applied</option>
            <option value="SCREENING">Screening</option>
            <option value="INTERVIEWED">Interviewed</option>
            <option value="OFFERED">Offered</option>
            <option value="HIRED">Hired</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onInviteCandidate}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserGroupIcon className="w-4 h-4" />
            <span>Invite Candidate</span>
          </button>
          <div className="text-sm text-gray-600">
            {filteredCandidates.length} candidates
          </div>
        </div>
      </div>

      {/* Candidates Grid */}
      {filteredCandidates.length === 0 ? (
        <div className="text-center py-12">
          <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm ? 'Try adjusting your search criteria' : 'Start by inviting candidates or they can register themselves'}
          </p>
          <button
            onClick={onInviteCandidate}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserGroupIcon className="w-4 h-4 mr-2" />
            Invite First Candidate
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((candidate) => (
            <motion.div
              key={candidate._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-lg font-medium text-white">
                      {candidate.firstName?.[0]}{candidate.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {candidate.firstName} {candidate.lastName}
                    </h4>
                    <p className="text-sm text-gray-600">{candidate.email}</p>
                    {candidate.phone && (
                      <p className="text-xs text-gray-500">{candidate.phone}</p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(candidate.status)}`}>
                  {candidate.status}
                </span>
              </div>

              {/* Candidate Info */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Resume Status:</span>
                  <span className={`flex items-center space-x-1 ${
                    candidate.resumeUploaded ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {candidate.resumeUploaded ? (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Uploaded</span>
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="w-4 h-4" />
                        <span>Not Uploaded</span>
                      </>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Profile Complete:</span>
                  <span className={`flex items-center space-x-1 ${
                    candidate.profileComplete ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {candidate.profileComplete ? (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Complete</span>
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>Incomplete</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Registration:</span>
                  <span className="text-gray-700">
                    {new Date(candidate.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => onScreenResume(candidate)}
                  className={`w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                    candidate.resumeUploaded 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!candidate.resumeUploaded}
                  title={candidate.resumeUploaded ? 'Screen and analyze resume with AI' : 'Resume not uploaded'}
                >
                  <CpuChipIcon className="w-4 h-4" />
                  <span>Screen Resume</span>
                </button>
                <button
                  onClick={() => onStartAIInterview(candidate)}
                  className="w-full px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-1"
                  title="Start AI-powered interview"
                >
                  <VideoCameraIcon className="w-4 h-4" />
                  <span>AI Interview</span>
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Registered:</span>
                  <span>{new Date(candidate.createdAt).toLocaleDateString()}</span>
                </div>
                {candidate.invitedBy && (
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Invited by:</span>
                    <span>{candidate.invitedBy}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// AI Interviews Tab Component
export const AIInterviewsTab = ({ candidates }) => {
  const interviewedCandidates = candidates.filter(candidate => candidate.aiInterviewCompleted)

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <VideoCameraIcon className="w-16 h-16 mx-auto mb-4 text-purple-600" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Interview Sessions</h3>
        <p className="text-gray-600 mb-6">
          Manage and review AI-powered interview sessions with candidates
        </p>
      </div>

      {interviewedCandidates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {interviewedCandidates.map((candidate) => (
            <div key={candidate._id} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-purple-600">
                    {candidate.firstName?.[0]}{candidate.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {candidate.firstName} {candidate.lastName}
                  </h4>
                  <p className="text-sm text-gray-600">{candidate.email}</p>
                </div>
              </div>
              
              {candidate.aiInterviewScore && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">AI Interview Score</span>
                    <span className={`text-sm font-bold ${
                      candidate.aiInterviewScore >= 80 ? 'text-green-600' :
                      candidate.aiInterviewScore >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {candidate.aiInterviewScore}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        candidate.aiInterviewScore >= 80 ? 'bg-green-500' :
                        candidate.aiInterviewScore >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${candidate.aiInterviewScore}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <button className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  View Results
                </button>
                <button className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <VideoCameraIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Interviews Yet</h3>
          <p className="text-gray-500">AI interview sessions will appear here once candidates complete them.</p>
        </div>
      )}
    </div>
  )
}

// Analytics Tab Component
export const AnalyticsTab = ({ jobPostings, candidates, insights }) => {
  // Calculate comprehensive stats
  const stats = {
    totalApplications: candidates.length,
    aiInterviews: candidates.filter(c => c.aiInterviewCompleted).length,
    hireRate: candidates.length > 0 ? 
      ((candidates.filter(c => c.status === 'HIRED').length / candidates.length) * 100).toFixed(1) : 0,
    averageFitScore: candidates.length > 0 ? 
      (candidates.reduce((sum, c) => sum + (c.fitScore || 0), 0) / candidates.length).toFixed(1) : 0,
    totalJobs: jobPostings.length,
    activeJobs: jobPostings.filter(j => j.status === 'PUBLISHED').length,
    closedJobs: jobPostings.filter(j => j.status === 'CLOSED').length,
    draftJobs: jobPostings.filter(j => j.status === 'DRAFT').length,
    newCandidates: candidates.filter(c => {
      const createdDate = new Date(c.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return createdDate >= weekAgo
    }).length,
    shortlisted: candidates.filter(c => c.status === 'SHORTLISTED' || c.status === 'INTERVIEW_SCHEDULED').length,
    interviewed: candidates.filter(c => c.status === 'INTERVIEWED').length,
    offered: candidates.filter(c => c.status === 'OFFERED').length,
    hired: candidates.filter(c => c.status === 'HIRED').length,
    rejected: candidates.filter(c => c.status === 'REJECTED').length
  }

  // Calculate department breakdown
  const departmentBreakdown = jobPostings.reduce((acc, job) => {
    const dept = job.department || 'Unknown'
    if (!acc[dept]) {
      acc[dept] = { jobs: 0, candidates: 0 }
    }
    acc[dept].jobs += 1
    return acc
  }, {})

  // Calculate status distribution
  const statusDistribution = candidates.reduce((acc, candidate) => {
    const status = candidate.status || 'APPLIED'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  // Calculate monthly application trends (last 6 months)
  const monthlyTrends = Array.from({ length: 6 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - i))
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    
    const count = candidates.filter(c => {
      const createdDate = new Date(c.createdAt)
      return createdDate >= monthStart && createdDate <= monthEnd
    }).length

    return {
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      count
    }
  })

  const maxTrendCount = Math.max(...monthlyTrends.map(t => t.count), 1)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recruitment Analytics</h2>
        <p className="text-gray-600 mt-1">Comprehensive insights into your recruitment process</p>
      </div>

      {/* Key Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Applications</p>
              <p className="text-3xl font-bold mt-2">{stats.totalApplications}</p>
              <p className="text-blue-100 text-xs mt-1">All time</p>
            </div>
            <UserGroupIcon className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">AI Interviews</p>
              <p className="text-3xl font-bold mt-2">{stats.aiInterviews}</p>
              <p className="text-purple-100 text-xs mt-1">Completed</p>
            </div>
            <VideoCameraIcon className="w-10 h-10 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Hire Rate</p>
              <p className="text-3xl font-bold mt-2">{stats.hireRate}%</p>
              <p className="text-green-100 text-xs mt-1">Success rate</p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Avg Fit Score</p>
              <p className="text-3xl font-bold mt-2">{stats.averageFitScore}%</p>
              <p className="text-orange-100 text-xs mt-1">AI Analysis</p>
            </div>
            <StarIcon className="w-10 h-10 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Job Postings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Job Postings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalJobs}</p>
            </div>
            <BriefcaseIcon className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeJobs}</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Closed Jobs</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">{stats.closedJobs}</p>
            </div>
            <XCircleIcon className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Application Trends */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Application Trends (Last 6 Months)</h3>
        <div className="space-y-4">
          {monthlyTrends.map((trend, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-24 text-sm text-gray-600">{trend.month}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${(trend.count / maxTrendCount) * 100}%` }}
                >
                  {trend.count > 0 && (
                    <span className="text-xs font-medium text-white">{trend.count}</span>
                  )}
                </div>
              </div>
              <div className="w-12 text-right text-sm font-medium text-gray-700">{trend.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts and Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidate Status Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidate Status Distribution</h3>
          <div className="space-y-4">
            {Object.entries(statusDistribution).map(([status, count]) => {
              const percentage = stats.totalApplications > 0 ? ((count / stats.totalApplications) * 100).toFixed(1) : 0
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{status}</span>
                    <span className="text-sm text-gray-600">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Departments */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Departments by Job Postings</h3>
          <div className="space-y-3">
            {Object.entries(departmentBreakdown)
              .sort((a, b) => b[1].jobs - a[1].jobs)
              .slice(0, 5)
              .map(([dept, data]) => (
                <div key={dept} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-900">{dept}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">{data.candidates} candidates</span>
                    <span className="text-sm font-bold text-blue-600">{data.jobs} jobs</span>
                  </div>
                </div>
              ))}
            {Object.keys(departmentBreakdown).length === 0 && (
              <p className="text-gray-500 text-center py-4">No department data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Recruitment Funnel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Recruitment Funnel</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-blue-600">{stats.totalApplications}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Applied</p>
          </div>
          <div className="text-center">
            <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-yellow-600">{stats.shortlisted}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Shortlisted</p>
          </div>
          <div className="text-center">
            <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-purple-600">{stats.interviewed}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Interviewed</p>
          </div>
          <div className="text-center">
            <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-orange-600">{stats.offered}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Offered</p>
          </div>
          <div className="text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-green-600">{stats.hired}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Hired</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">New Candidates (Last 7 Days)</p>
            <p className="text-2xl font-bold text-blue-900 mt-2">{stats.newCandidates}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Hired This Month</p>
            <p className="text-2xl font-bold text-green-900 mt-2">{stats.hired}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">AI Interviews Completed</p>
            <p className="text-2xl font-bold text-purple-900 mt-2">{stats.aiInterviews}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
