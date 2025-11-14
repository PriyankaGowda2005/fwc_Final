import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCandidateAuth } from '../contexts/CandidateAuthContext'
import { resumeProcessingAPI } from '../services/api'
import api from '../services/api'
import Button from '../components/UI/Button'
import Icon from '../components/UI/Icon'
import Card from '../components/UI/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const CandidateResumeUpload = () => {
  const { candidate, uploadResume, loading, error } = useCandidateAuth()
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('idle') // idle, uploading, processing, success, error
  const [validationError, setValidationError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [resumeData, setResumeData] = useState(null)
  const [atsAnalysis, setAtsAnalysis] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [jobRecommendations, setJobRecommendations] = useState([])
  const [processingStatus, setProcessingStatus] = useState('')
  const [loadingResumeData, setLoadingResumeData] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch resume data and recommendations when candidate has uploaded resume
  useEffect(() => {
    if (candidate?.resumeUploaded && candidate?.resumeId) {
      fetchResumeData()
      fetchJobRecommendations()
    }
  }, [candidate?.resumeUploaded, candidate?.resumeId])

  const fetchResumeData = async () => {
    try {
      setLoadingResumeData(true)
      const response = await resumeProcessingAPI.getCandidateResume()
      if (response.data && response.data.success) {
        setResumeData(response.data.data?.resume || null)
        setAtsAnalysis(response.data.data?.atsAnalysis || null)
        setSuggestions(response.data.data?.suggestions || [])
      } else {
        // Resume might not be processed yet
        setResumeData(null)
        setAtsAnalysis(null)
        setSuggestions([])
      }
    } catch (error) {
      console.error('Error fetching resume data:', error)
      // Only show error if it's not a 404 (resume not found)
      if (error.response?.status !== 404) {
        toast.error('Failed to load resume analysis. Please try again.')
      }
      setResumeData(null)
      setAtsAnalysis(null)
      setSuggestions([])
    } finally {
      setLoadingResumeData(false)
    }
  }

  const fetchJobRecommendations = async () => {
    try {
      // Use candidate-specific endpoint (no candidateId needed)
      const response = await resumeProcessingAPI.getJobRecommendations()
      if (response.data && response.data.success) {
        setJobRecommendations(response.data.data?.recommendations || [])
      } else {
        setJobRecommendations([])
      }
    } catch (error) {
      console.error('Error fetching job recommendations:', error)
      // Don't show error toast for recommendations, just set empty array
      setJobRecommendations([])
    }
  }

  // Reset validation error when file changes
  useEffect(() => {
    if (uploadedFile) {
      setValidationError('')
    }
  }, [uploadedFile])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const validateFile = (file) => {
    const allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a PDF, DOC, or DOCX file only.'
    }

    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB.'
    }

    return null
  }

  const handleFile = async (file) => {
    const validation = validateFile(file)
    if (validation) {
      setValidationError(validation)
      setUploadStatus('error')
      return
    }

    setUploadedFile(file)
    setUploadStatus('uploading')
    setUploadProgress(0)
    setValidationError('')
    setProcessingStatus('Uploading resume...')

    // Realistic upload progress simulation
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + Math.random() * 10
      })
    }, 200)

    try {
      const result = await uploadResume(file)
      
      clearInterval(progressInterval)
      setUploadProgress(90)
      setProcessingStatus('Processing resume and extracting information...')
      setUploadStatus('processing')

      if (result.success) {
        // Update candidate context to reflect resume upload
        // The uploadResume function in context should already update this, but refresh profile to be sure
        try {
          const profileResponse = await api.get('/candidates/profile')
          if (profileResponse.data.success) {
            // Update local candidate state if needed
            // The context should handle this, but we ensure UI updates
          }
        } catch (error) {
          console.error('Error refreshing profile:', error)
        }

        // Wait a bit for processing, then check status
        setTimeout(async () => {
          setUploadProgress(100)
          setProcessingStatus('Resume processed successfully!')
          
          // Wait a bit for backend processing, then fetch data
          // Try multiple times with increasing delays in case processing takes longer
          const fetchWithRetry = async (retries = 3, delay = 3000) => {
            for (let i = 0; i < retries; i++) {
              await new Promise(resolve => setTimeout(resolve, delay))
              try {
                const response = await resumeProcessingAPI.getCandidateResume()
                if (response.data && response.data.success && response.data.data?.resume) {
                  // Resume is ready, fetch both data and recommendations
                  await fetchResumeData()
                  await fetchJobRecommendations()
                  break
                } else if (i === retries - 1) {
                  // Last retry, fetch anyway
                  await fetchResumeData()
                  await fetchJobRecommendations()
                }
              } catch (error) {
                if (i === retries - 1) {
                  // Last retry failed, try fetching anyway
                  console.error('Failed to fetch resume data after retries:', error)
                  await fetchResumeData()
                  await fetchJobRecommendations()
                }
              }
            }
          }
          fetchWithRetry()
          
          setUploadStatus('success')
          toast.success('Resume uploaded and processed! Skills extracted, ATS scores calculated.')
          
          setTimeout(() => {
            setUploadStatus('idle')
            setUploadedFile(null)
            setUploadProgress(0)
            setProcessingStatus('')
          }, 3000)
        }, 2000)
      } else {
        setUploadStatus('error')
        setValidationError(result.error || 'Upload failed. Please try again.')
      }
    } catch (error) {
      clearInterval(progressInterval)
      setUploadStatus('error')
      setValidationError('Upload failed. Please try again.')
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase()
    switch (extension) {
      case 'pdf':
        return 'document-text'
      case 'doc':
      case 'docx':
        return 'document'
      default:
        return 'document'
    }
  }

  const getFileTypeColor = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase()
    switch (extension) {
      case 'pdf':
        return 'text-red-600 bg-red-50'
      case 'doc':
      case 'docx':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getAtsScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const resetUpload = () => {
    setUploadStatus('idle')
    setUploadedFile(null)
    setUploadProgress(0)
    setValidationError('')
    setShowDetails(false)
    setProcessingStatus('')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Enhanced Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
          <Icon name="document-text" size="lg" className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {candidate?.resumeUploaded ? 'Manage Your Resume' : 'Upload Your Resume'}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {candidate?.resumeUploaded 
            ? 'Your resume has been processed. View extracted skills, ATS scores, and job recommendations below.'
            : 'Upload your resume to automatically extract skills, get ATS scores, and receive job recommendations.'
          }
        </p>
      </motion.div>

      {/* Resume Processing Results */}
      <AnimatePresence>
        {candidate?.resumeUploaded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Icon name="check-circle" size="lg" className="text-green-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">
                      Resume Successfully Processed
                    </h3>
                    <p className="text-green-700 mt-1">
                      Skills extracted, ATS scores calculated, and job recommendations ready!
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <Icon name={showDetails ? "eye-slash" : "eye"} size="sm" className="mr-2" />
                    {showDetails ? 'Hide' : 'View'} Details
                  </Button>
                </div>
              </div>
            </Card>

            {/* Detailed Results */}
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                {loadingResumeData ? (
                  <Card className="p-6">
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner />
                      <span className="ml-3 text-gray-600">Loading resume analysis...</span>
                    </div>
                  </Card>
                ) : (
                  <>
                    {/* ATS Score Analysis */}
                    {atsAnalysis && (
                      <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                            <Icon name="chart-bar" size="lg" className="mr-2 text-blue-600" />
                            ATS Score Analysis
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-gray-600 mb-1">Average Score</p>
                            <p className="text-3xl font-bold text-blue-600">{atsAnalysis.averageScore || 0}%</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm text-gray-600 mb-1">Best Match</p>
                            <p className="text-3xl font-bold text-green-600">{atsAnalysis.maxScore || 0}%</p>
                          </div>
                          {atsAnalysis.topJobMatch && (
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <p className="text-sm text-gray-600 mb-1">Top Job</p>
                              <p className="text-sm font-semibold text-purple-900 truncate">{atsAnalysis.topJobMatch.jobTitle}</p>
                              <p className="text-xs text-purple-700 mt-1">{atsAnalysis.topJobMatch.department}</p>
                            </div>
                          )}
                        </div>
                        {atsAnalysis.scores && atsAnalysis.scores.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Top Job Matches</h4>
                            <div className="space-y-2">
                              {atsAnalysis.scores.map((score, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="font-medium text-gray-900">{score.jobTitle}</p>
                                      <p className="text-xs text-gray-600">{score.department}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg ${getAtsScoreColor(score.score)}`}>
                                      <span className="text-lg font-bold">{score.score}%</span>
                                    </div>
                                  </div>
                                  {score.matchedSkills && score.matchedSkills.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-600 mb-1">Matched Skills:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {score.matchedSkills.slice(0, 5).map((skill, sIdx) => (
                                          <span key={sIdx} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                            {skill}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {score.missingSkills && score.missingSkills.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-600 mb-1">Missing Skills:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {score.missingSkills.slice(0, 3).map((skill, sIdx) => (
                                          <span key={sIdx} className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                                            {skill}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    )}

                    {/* Improvement Suggestions */}
                    {suggestions.length > 0 && (
                      <Card className="p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                          <Icon name="light-bulb" size="lg" className="mr-2 text-yellow-600" />
                          Improvement Suggestions
                        </h3>
                        <div className="space-y-3">
                          {suggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-lg border ${
                                suggestion.type === 'critical'
                                  ? 'bg-red-50 border-red-200'
                                  : suggestion.type === 'warning'
                                  ? 'bg-yellow-50 border-yellow-200'
                                  : 'bg-blue-50 border-blue-200'
                              }`}
                            >
                              <div className="flex items-start">
                                <Icon
                                  name={
                                    suggestion.type === 'critical'
                                      ? 'exclamation-circle'
                                      : suggestion.type === 'warning'
                                      ? 'exclamation-triangle'
                                      : 'information-circle'
                                  }
                                  size="md"
                                  className={`mr-3 mt-0.5 ${
                                    suggestion.type === 'critical'
                                      ? 'text-red-600'
                                      : suggestion.type === 'warning'
                                      ? 'text-yellow-600'
                                      : 'text-blue-600'
                                  }`}
                                />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h4>
                                  <p className="text-sm text-gray-700 mb-2">{suggestion.description}</p>
                                  <p className="text-sm font-medium text-gray-900">💡 {suggestion.action}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Extracted Skills */}
                    {resumeData?.extractedData?.skills && resumeData.extractedData.skills.length > 0 && (
                      <Card className="p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                          <Icon name="sparkles" size="lg" className="mr-2 text-purple-600" />
                          Extracted Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {resumeData.extractedData.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Job Recommendations */}
                    {jobRecommendations.length > 0 && (
                      <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                            <Icon name="briefcase" size="lg" className="mr-2 text-blue-600" />
                            Job Recommendations
                          </h3>
                          <span className="text-sm text-gray-500">
                            {jobRecommendations.length} matches found
                          </span>
                        </div>
                        <div className="space-y-3">
                          {jobRecommendations.slice(0, 5).map((job, idx) => (
                            <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{job.title}</h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {job.department} • {job.location}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">{job.matchReason}</p>
                                </div>
                                <div className={`px-4 py-2 rounded-lg border ${getAtsScoreColor(job.atsScore)}`}>
                                  <div className="text-2xl font-bold">{job.atsScore}%</div>
                                  <div className="text-xs">Match</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => window.location.href = '/candidate-portal/jobs'}
                          >
                            View All Jobs
                            <Icon name="arrow-right" size="sm" className="ml-2" />
                          </Button>
                        </div>
                      </Card>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-8">
          {/* Upload Zone */}
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
              dragActive
                ? 'border-blue-400 bg-blue-50 scale-105'
                : uploadStatus === 'success'
                ? 'border-green-400 bg-green-50'
                : uploadStatus === 'processing'
                ? 'border-purple-400 bg-purple-50'
                : uploadStatus === 'error'
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploadStatus && fileInputRef.current?.click()}
          >
            <AnimatePresence mode="wait">
              {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="space-y-6"
                >
                  <div className="relative">
                    <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <LoadingSpinner />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">{uploadProgress}%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {uploadStatus === 'processing' ? 'Processing Resume...' : `Uploading ${uploadedFile?.name}`}
                    </h3>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-sm text-gray-600">
                      {processingStatus || (uploadProgress < 50 ? 'Processing file...' : 
                       uploadProgress < 90 ? 'Uploading to server...' : 
                       'Finalizing upload...')}
                    </p>
                  </div>
                </motion.div>
              ) : uploadStatus === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="space-y-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.6 }}
                    className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center"
                  >
                    <Icon name="check-circle" size="xl" className="text-green-600" />
                  </motion.div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-green-900">
                      Upload & Processing Successful!
                    </h3>
                    <p className="text-green-700">
                      Skills extracted, ATS scores calculated, and job recommendations generated.
                    </p>
                  </div>
                </motion.div>
              ) : uploadStatus === 'error' ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="space-y-6"
                >
                  <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <Icon name="exclamation-triangle" size="xl" className="text-red-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-red-900">
                      Upload Failed
                    </h3>
                    <p className="text-red-700">
                      {validationError || error || 'Please try again with a valid file.'}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={resetUpload}
                    >
                      <Icon name="refresh" size="sm" className="mr-2" />
                      Try Again
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="space-y-6"
                >
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                  >
                    <Icon name="cloud-arrow-up" size="xl" className="text-blue-600" />
                  </motion.div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {candidate?.resumeUploaded ? 'Replace Your Resume' : 'Upload Your Resume'}
                    </h3>
                    <p className="text-gray-600">
                      Drag and drop your resume here, or click to browse files
                    </p>
                    <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Icon name="document-text" size="sm" className="text-red-500" />
                        <span>PDF</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Icon name="document" size="sm" className="text-blue-500" />
                        <span>DOC/DOCX</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Icon name="shield" size="sm" className="text-gray-500" />
                        <span>Max 10MB</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center space-x-4"
      >
        <Button
          variant="secondary"
          onClick={() => window.history.back()}
        >
          <Icon name="arrow-left" size="sm" className="mr-2" />
          Back to Dashboard
        </Button>
        {candidate?.resumeUploaded && (
          <Button
            variant="primary"
            onClick={() => window.location.href = '/candidate-portal/jobs'}
          >
            <Icon name="briefcase" size="sm" className="mr-2" />
            Browse Recommended Jobs
          </Button>
        )}
      </motion.div>
    </div>
  )
}

export default CandidateResumeUpload
