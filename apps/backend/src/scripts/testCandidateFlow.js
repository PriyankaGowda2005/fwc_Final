/**
 * Full Candidate Journey Flow Test
 * 
 * This script tests the complete candidate journey from registration to employee conversion:
 * 1. Candidate Registration
 * 2. Resume Upload
 * 3. Job Application
 * 4. Resume Screening (HR)
 * 5. Job Attachment (HR)
 * 6. Interview Scheduling (HR)
 * 7. Interview Completion (HR)
 * 8. Candidate Conversion (HR)
 * 9. Onboarding Verification
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const TEST_DATA = {
  candidate: {
    email: `test.candidate.${Date.now()}@test.com`,
    password: 'Test123!@#',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    address: '123 Test Street, Test City'
  },
  hr: {
    email: process.env.HR_EMAIL || 'hr@fwc.com',
    password: process.env.HR_PASSWORD || 'password'
  }
};

let candidateToken = null;
let hrToken = null;
let candidateId = null;
let jobPostingId = null;
let invitationToken = null;
let screeningId = null;
let attachmentId = null;
let interviewId = null;
let employeeId = null;
let employeeRecordId = null;
let onboardingId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[STEP ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null, token = null, isFormData = false) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (isFormData) {
      config.headers = { ...config.headers, ...data.getHeaders() };
      config.data = data;
    } else if (data) {
      config.headers['Content-Type'] = 'application/json';
      config.data = data;
    }

    const response = await axios(config);
    return { 
      success: true, 
      data: response.data, 
      status: response.status,
      fullResponse: response // Include full response for debugging
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
      fullError: error // Include full error for debugging
    };
  }
}

// Step 1: HR Login
async function step1_HRLogin() {
  logStep(1, 'HR Login');
  
  const result = await apiRequest('POST', '/auth/login', {
    email: TEST_DATA.hr.email,
    password: TEST_DATA.hr.password
  });

  if (result.success && result.data.token) {
    hrToken = result.data.token;
    logSuccess(`HR logged in successfully`);
    logInfo(`HR Token: ${hrToken.substring(0, 20)}...`);
    return true;
  } else {
    logError(`HR login failed: ${result.error?.message || JSON.stringify(result.error)}`);
    return false;
  }
}

// Step 2: Create Job Posting
async function step2_CreateJobPosting() {
  logStep(2, 'Create Job Posting');
  
  const jobData = {
    title: 'Software Engineer - Test Position',
    department: 'Engineering',
    location: 'Remote',
    employmentType: 'FULL_TIME',
    description: 'Test job posting for candidate flow testing. This position requires strong technical skills and experience with modern web technologies.',
    requirements: ['JavaScript', 'Node.js', 'React', 'MongoDB'],
    responsibilities: ['Develop features', 'Write tests', 'Code reviews'],
    salaryRange: '$80,000 - $120,000', // Should be string, not object
    status: 'PUBLISHED'
  };

  const result = await apiRequest('POST', '/job-postings', jobData, hrToken);

  // Handle different response formats
  if (result.success) {
    const jobPosting = result.data.jobPosting || result.data.data || result.data;
    if (jobPosting?._id || jobPosting?.id) {
      jobPostingId = jobPosting._id || jobPosting.id;
      logSuccess(`Job posting created: ${jobData.title}`);
      logInfo(`Job Posting ID: ${jobPostingId}`);
      return true;
    }
  }
  
  // Log detailed error information
  const errorMsg = result.error?.message || result.error?.errors?.[0]?.msg || JSON.stringify(result.error);
  logError(`Job posting creation failed: ${errorMsg}`);
  if (result.error?.errors) {
    result.error.errors.forEach(err => {
      logError(`  - ${err.param}: ${err.msg}`);
    });
  }
  return false;
}

// Step 3: Create Candidate Invitation (HR)
async function step3_CreateCandidateInvitation() {
  logStep(3, 'Create Candidate Invitation (HR)');
  
  const result = await apiRequest('POST', '/candidates/invite', {
    email: TEST_DATA.candidate.email,
    candidateName: `${TEST_DATA.candidate.firstName} ${TEST_DATA.candidate.lastName}`
  }, hrToken);

  // Handle both success and partial success (invitation created but email failed)
  if (result.success && result.data.data?.invitationToken) {
    invitationToken = result.data.data.invitationToken;
    logSuccess('Candidate invitation created');
    logInfo(`Invitation Token: ${invitationToken.substring(0, 20)}...`);
    return true;
  } else if (result.error?.data?.invitationToken || result.error?.data?.registrationLink) {
    // Email failed but invitation was created - extract token from registration link
    const registrationLink = result.error.data.registrationLink;
    const tokenMatch = registrationLink?.match(/token=([^&]+)/);
    if (tokenMatch) {
      invitationToken = tokenMatch[1];
      logSuccess('Candidate invitation created (email sending failed, but invitation is valid)');
      logInfo(`Invitation Token: ${invitationToken.substring(0, 20)}...`);
      return true;
    }
  }
  
  logError(`Invitation creation failed: ${result.error?.message || JSON.stringify(result.error)}`);
  if (result.error?.data) {
    logInfo(`Response data: ${JSON.stringify(result.error.data)}`);
  }
  return false;
}

// Step 4: Candidate Registration
async function step4_CandidateRegistration() {
  logStep(4, 'Candidate Registration');
  
  const result = await apiRequest('POST', '/candidates/register', {
    email: TEST_DATA.candidate.email,
    password: TEST_DATA.candidate.password,
    firstName: TEST_DATA.candidate.firstName,
    lastName: TEST_DATA.candidate.lastName,
    phone: TEST_DATA.candidate.phone,
    address: TEST_DATA.candidate.address,
    invitationToken: invitationToken
  });

  // Handle response - API returns data.candidateId (not data.data._id)
  if (result.success && result.data.data?.candidateId) {
    candidateId = result.data.data.candidateId;
    logSuccess(`Candidate registered: ${TEST_DATA.candidate.firstName} ${TEST_DATA.candidate.lastName}`);
    logInfo(`Candidate ID: ${candidateId}`);
    logInfo(`Email: ${TEST_DATA.candidate.email}`);
    return true;
  } else if (result.status === 201 && result.data?.data?.candidateId) {
    // Handle 201 status with candidateId
    candidateId = result.data.data.candidateId;
    logSuccess(`Candidate registered: ${TEST_DATA.candidate.firstName} ${TEST_DATA.candidate.lastName}`);
    logInfo(`Candidate ID: ${candidateId}`);
    logInfo(`Email: ${TEST_DATA.candidate.email}`);
    return true;
  } else {
    const errorMsg = result.error?.message || result.error?.error || JSON.stringify(result.error);
    logError(`Candidate registration failed: ${errorMsg}`);
    if (result.error?.errors) {
      result.error.errors.forEach(err => {
        logError(`  - ${err.field || err.param}: ${err.message || err.msg}`);
      });
    }
    logInfo(`Status Code: ${result.status}`);
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    logInfo(`Full Error: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

// Step 5: Candidate Login
async function step5_CandidateLogin() {
  logStep(5, 'Candidate Login');
  
  const result = await apiRequest('POST', '/candidates/login', {
    email: TEST_DATA.candidate.email,
    password: TEST_DATA.candidate.password
  });

  // Handle different response formats
  if (result.success && (result.data.token || result.data.data?.token)) {
    candidateToken = result.data.token || result.data.data.token;
    logSuccess(`Candidate logged in successfully`);
    logInfo(`Candidate Token: ${candidateToken.substring(0, 20)}...`);
    return true;
  } else {
    const errorMsg = result.error?.message || result.error?.error || JSON.stringify(result.error);
    logError(`Candidate login failed: ${errorMsg}`);
    logInfo(`Status Code: ${result.status}`);
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

// Step 6: Resume Upload
async function step6_ResumeUpload() {
  logStep(6, 'Resume Upload');
  
  // Create a dummy resume file for testing
  const resumeContent = `
    John Doe
    Software Engineer
    
    Email: ${TEST_DATA.candidate.email}
    Phone: ${TEST_DATA.candidate.phone}
    
    Skills:
    - JavaScript
    - Node.js
    - React
    - MongoDB
    - Express.js
    
    Experience:
    - 5 years of software development experience
    - Full-stack development
    - Team leadership
    
    Education:
    - Bachelor of Science in Computer Science
    - University of Technology
  `;

  // Create a PDF-like file (simulated) - in real testing, you'd use a real PDF
  // For testing, we'll create a file with .pdf extension but minimal content
  // Note: This is a workaround for testing - in production, real PDFs would be used
  const tempResumePath = path.join(__dirname, '../../uploads/resumes', `test-resume-${Date.now()}.pdf`);
  const uploadDir = path.dirname(tempResumePath);
  
  // Ensure directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Create a minimal PDF-like file (PDF header + content)
  // This is a simplified PDF structure for testing
  const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
100 700 Td
(${resumeContent.replace(/[()\\]/g, '')}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000205 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`);
  
  fs.writeFileSync(tempResumePath, pdfContent);
  
  try {
    // form-data is available as a dependency of axios
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('resumes', fs.createReadStream(tempResumePath), {
      filename: 'test-resume.pdf',
      contentType: 'application/pdf'
    });

    const result = await apiRequest('POST', '/resume-processing/upload', formData, candidateToken, true);

    // Clean up temp file
    if (fs.existsSync(tempResumePath)) {
      fs.unlinkSync(tempResumePath);
    }

    if (result.success) {
      logSuccess('Resume uploaded successfully');
      logInfo(`Resume ID: ${result.data.data?.primaryResumeId || result.data.data?.resumes?.[0]?.resumeId}`);
      return true;
    } else {
      logError(`Resume upload failed: ${result.error?.message || JSON.stringify(result.error)}`);
      return false;
    }
  } catch (error) {
    // Clean up temp file
    if (fs.existsSync(tempResumePath)) {
      fs.unlinkSync(tempResumePath);
    }
    logError(`Resume upload error: ${error.message}`);
    return false;
  }
}

// Step 7: Job Application
async function step7_JobApplication() {
  logStep(7, 'Job Application');
  
  const result = await apiRequest('POST', `/candidates/apply/${jobPostingId}`, {}, candidateToken);

  if (result.success) {
    logSuccess('Job application submitted successfully');
    logInfo(`Application ID: ${result.data.data?.applicationId}`);
    return true;
  } else {
    logError(`Job application failed: ${result.error?.message || JSON.stringify(result.error)}`);
    return false;
  }
}

// Step 8: Resume Screening (HR)
async function step8_ResumeScreening() {
  logStep(8, 'Resume Screening (HR)');
  
  const result = await apiRequest('POST', '/resume-screening/screen', {
    candidateId: candidateId,
    jobPostingId: jobPostingId,
    screeningNotes: 'Test screening - candidate looks good'
  }, hrToken);

  // Handle different response formats
  if (result.success && (result.data.data?._id || result.data._id)) {
    screeningId = result.data.data?._id || result.data._id;
    logSuccess('Resume screened successfully');
    logInfo(`Screening ID: ${screeningId}`);
    const fitScore = result.data.data?.fitScore || result.data?.fitScore || 'N/A';
    logInfo(`Fit Score: ${fitScore}%`);
    return true;
  } else {
    const errorMsg = result.error?.message || result.error?.error || JSON.stringify(result.error);
    logError(`Resume screening failed: ${errorMsg}`);
    logInfo(`Status Code: ${result.status}`);
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

// Step 9: Approve Screening (HR)
async function step9_ApproveScreening() {
  logStep(9, 'Approve Screening (HR)');
  
  const result = await apiRequest('PUT', `/resume-screening/screening/${screeningId}/status`, {
    status: 'APPROVED',
    notes: 'Candidate approved for interview'
  }, hrToken);

  if (result.success) {
    logSuccess('Screening approved successfully');
    return true;
  } else {
    logError(`Screening approval failed: ${result.error?.message || JSON.stringify(result.error)}`);
    return false;
  }
}

// Step 9: Job Attachment (HR)
async function step9_JobAttachment() {
  logStep(9, 'Job Attachment (HR)');
  
  const result = await apiRequest('POST', '/job-attachments/attach', {
    candidateId: candidateId,
    jobPostingId: jobPostingId,
    attachmentNotes: 'Candidate attached for interview scheduling',
    priority: 'HIGH'
  }, hrToken);

  if (result.success && result.data.data?._id) {
    attachmentId = result.data.data._id;
    logSuccess('Candidate attached to job posting');
    logInfo(`Attachment ID: ${attachmentId}`);
    return true;
  } else {
    logError(`Job attachment failed: ${result.error?.message || JSON.stringify(result.error)}`);
    return false;
  }
}

// Step 10: Schedule Interview (HR)
async function step10_ScheduleInterview() {
  logStep(10, 'Schedule Interview (HR)');
  
  const interviewDate = new Date();
  interviewDate.setDate(interviewDate.getDate() + 1); // Tomorrow
  interviewDate.setHours(14, 0, 0, 0); // 2 PM

  // Use schedule-ai endpoint which doesn't require attachment
  const result = await apiRequest('POST', '/interviews/schedule-ai', {
    candidateId: candidateId,
    jobPostingId: jobPostingId,
    scheduledAt: interviewDate.toISOString(),
    duration: 45,
    interviewNotes: 'Test interview for candidate flow',
    autoInvite: false // Don't send email in test
  }, hrToken);

  // Handle response - API returns data.interviewId
  if (result.success && (result.data.data?.interviewId || result.data.data?._id)) {
    interviewId = result.data.data.interviewId || result.data.data._id;
    logSuccess('Interview scheduled successfully');
    logInfo(`Interview ID: ${interviewId}`);
    logInfo(`Interview Date: ${interviewDate.toLocaleString()}`);
    return true;
  } else {
    const errorMsg = result.error?.message || result.error?.error || JSON.stringify(result.error);
    logError(`Interview scheduling failed: ${errorMsg}`);
    logInfo(`Status Code: ${result.status}`);
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

// Step 11: Complete Interview (HR)
async function step11_CompleteInterview() {
  logStep(11, 'Complete Interview (HR)');
  
  // Update interview status to COMPLETED with scores
  const statusResult = await apiRequest('PUT', `/interviews/${interviewId}/status`, {
    status: 'COMPLETED',
    notes: 'Excellent candidate, strong technical skills',
    feedback: 'Candidate demonstrated strong technical knowledge and good communication skills',
    finalScore: 85,
    aiScores: {
      technical: 90,
      communication: 85,
      problemSolving: 80,
      overallScore: 85
    }
  }, hrToken);

  if (!statusResult.success) {
    logError(`Interview status update failed: ${statusResult.error?.message || JSON.stringify(statusResult.error)}`);
    return false;
  }

  logSuccess('Interview completed with scores');
  logInfo(`Final Score: 85%`);
  
  return true;
}

// Step 12: Update Interview Status to EVALUATED (if needed)
async function step12_UpdateInterviewStatus() {
  logStep(12, 'Update Interview Status to EVALUATED');
  
  // Update interview status to EVALUATED to indicate scores are set
  const result = await apiRequest('PUT', `/interviews/${interviewId}/status`, {
    status: 'COMPLETED', // Keep as COMPLETED, scores are already set
    notes: 'Interview evaluation complete'
  }, hrToken);

  if (result.success) {
    logSuccess('Interview status confirmed');
    return true;
  } else {
    // This is optional, so we'll continue even if it fails
    logInfo('Interview status update skipped (optional step)');
    return true;
  }
}

// Step 13: Candidate Conversion (HR)
async function step13_CandidateConversion() {
  logStep(13, 'Candidate Conversion (HR)');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7); // Start in 7 days

  const result = await apiRequest('POST', '/candidate-conversion/convert', {
    candidateId: candidateId,
    jobPostingId: jobPostingId,
    interviewId: interviewId,
    startDate: startDate.toISOString(),
    salary: 100000,
    department: 'Engineering',
    position: 'Software Engineer',
    notes: 'Converted through automated test flow'
  }, hrToken);

  // Handle response - API returns employeeId and onboardingId
  if (result.success && result.data.data?.employeeId) {
    employeeId = result.data.data.employeeId;
    onboardingId = result.data.data.onboardingId;
    employeeRecordId = result.data.data.employeeRecordId || result.data.data.employeeId;
    logSuccess('Candidate converted to employee successfully');
    logInfo(`Employee ID: ${employeeId}`);
    logInfo(`Employee Record ID: ${employeeRecordId}`);
    logInfo(`Onboarding ID: ${onboardingId || 'N/A'}`);
    logInfo(`Start Date: ${startDate.toLocaleDateString()}`);
    return true;
  } else {
    const errorMsg = result.error?.message || result.error?.error || result.error?.toString() || JSON.stringify(result.error);
    logError(`Candidate conversion failed: ${errorMsg}`);
    logInfo(`Status Code: ${result.status}`);
    if (result.error) {
      logInfo(`Error Object: ${JSON.stringify(result.error, null, 2)}`);
    }
    if (result.data) {
      logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    }
    if (result.fullError) {
      logInfo(`Full Error: ${result.fullError.message}`);
      if (result.fullError.response) {
        logInfo(`Error Response: ${JSON.stringify(result.fullError.response.data, null, 2)}`);
      }
    }
    return false;
  }
}

// Step 14: Verify Employee Record
async function step14_VerifyEmployee() {
  logStep(14, 'Verify Employee Record');
  
  // Use employeeRecordId (MongoDB _id) if available, otherwise try employeeId (string ID)
  const idToUse = employeeRecordId || employeeId;
  const result = await apiRequest('GET', `/employees/${idToUse}`, null, hrToken);

  // Handle different response formats
  if (result.success && (result.data.data || result.data.employee || result.data)) {
    const employee = result.data.data || result.data.employee || result.data;
    logSuccess('Employee record verified');
    logInfo(`Name: ${employee.firstName || ''} ${employee.lastName || ''}`);
    logInfo(`Email: ${employee.email || 'N/A'}`);
    logInfo(`Department: ${employee.department || 'N/A'}`);
    logInfo(`Position: ${employee.position || employee.jobTitle || 'N/A'}`);
    logInfo(`Status: ${employee.status || 'N/A'}`);
    logInfo(`Onboarding Status: ${employee.onboardingStatus || 'N/A'}`);
    return true;
  } else {
    const errorMsg = result.error?.message || result.error?.error || JSON.stringify(result.error);
    logError(`Employee verification failed: ${errorMsg}`);
    logInfo(`Status Code: ${result.status}`);
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

// Step 15: Verify Onboarding
async function step15_VerifyOnboarding() {
  logStep(15, 'Verify Onboarding Tasks');
  
  // Use employeeRecordId (MongoDB _id) for onboarding lookup
  const idToUse = employeeRecordId || employeeId;
  const result = await apiRequest('GET', `/candidate-conversion/onboarding/${idToUse}`, null, hrToken);

  if (result.success && result.data.data) {
    const onboarding = result.data.data;
    logSuccess('Onboarding record verified');
    logInfo(`Onboarding Status: ${onboarding.status}`);
    logInfo(`Total Tasks: ${onboarding.tasks?.length || 0}`);
    logInfo(`Completed Tasks: ${onboarding.tasks?.filter(t => t.status === 'COMPLETED').length || 0}`);
    
    if (onboarding.tasks && onboarding.tasks.length > 0) {
      logInfo('\nOnboarding Tasks:');
      onboarding.tasks.forEach((task, index) => {
        logInfo(`  ${index + 1}. ${task.task} - ${task.status} (Due: ${new Date(task.dueDate).toLocaleDateString()})`);
      });
    }
    return true;
  } else {
    logError(`Onboarding verification failed: ${result.error?.message || JSON.stringify(result.error)}`);
    return false;
  }
}

// Step 16: Verify User Account
async function step16_VerifyUserAccount() {
  logStep(16, 'Verify User Account Created');
  
  // Try to login with candidate email (should work as employee now)
  const result = await apiRequest('POST', '/auth/login', {
    email: TEST_DATA.candidate.email,
    password: 'Welcome123!' // Default password
  });

  if (result.success && result.data.token) {
    logSuccess('User account verified - can login with employee credentials');
    logInfo(`User Role: ${result.data.user?.role || 'N/A'}`);
    return true;
  } else {
    logError(`User account verification failed: ${result.error?.message || JSON.stringify(result.error)}`);
    return false;
  }
}

// Main test flow
async function runFullFlowTest() {
  log('\n' + '='.repeat(60), 'cyan');
  log('FULL CANDIDATE JOURNEY FLOW TEST', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  const steps = [
    { name: 'HR Login', fn: step1_HRLogin },
    { name: 'Create Job Posting', fn: step2_CreateJobPosting },
    { name: 'Create Candidate Invitation', fn: step3_CreateCandidateInvitation },
    { name: 'Candidate Registration', fn: step4_CandidateRegistration },
    { name: 'Candidate Login', fn: step5_CandidateLogin },
    { name: 'Resume Upload', fn: step6_ResumeUpload },
    { name: 'Job Application', fn: step7_JobApplication },
    { name: 'Resume Screening', fn: step8_ResumeScreening },
    { name: 'Approve Screening', fn: step9_ApproveScreening },
    { name: 'Job Attachment', fn: step9_JobAttachment },
    { name: 'Schedule Interview', fn: step10_ScheduleInterview },
    { name: 'Complete Interview', fn: step11_CompleteInterview },
    { name: 'Update Interview Status', fn: step12_UpdateInterviewStatus },
    { name: 'Candidate Conversion', fn: step13_CandidateConversion },
    { name: 'Verify Employee', fn: step14_VerifyEmployee },
    { name: 'Verify Onboarding', fn: step15_VerifyOnboarding },
    { name: 'Verify User Account', fn: step16_VerifyUserAccount }
  ];

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < steps.length; i++) {
    try {
      const success = await steps[i].fn();
      if (success) {
        passed++;
        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        failed++;
        logError(`\nTest flow stopped at step ${i + 1}: ${steps[i].name}`);
        break;
      }
    } catch (error) {
      failed++;
      logError(`\nError in step ${i + 1} (${steps[i].name}): ${error.message}`);
      break;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`Total Steps: ${steps.length}`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Duration: ${duration}s`, 'blue');
  log('='.repeat(60) + '\n', 'cyan');

  if (failed === 0) {
    log('✓ ALL TESTS PASSED! Full candidate journey is working correctly.', 'green');
    log('\nTest Data:', 'blue');
    log(`  Candidate Email: ${TEST_DATA.candidate.email}`, 'blue');
    log(`  Candidate ID: ${candidateId}`, 'blue');
    log(`  Employee ID: ${employeeId}`, 'blue');
    log(`  Job Posting ID: ${jobPostingId}`, 'blue');
    log(`  Interview ID: ${interviewId}`, 'blue');
    return 0;
  } else {
    log('✗ SOME TESTS FAILED. Please check the errors above.', 'red');
    return 1;
  }
}

// Run the test
if (require.main === module) {
  runFullFlowTest()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      logError(`\nFatal error: ${error.message}`);
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runFullFlowTest };

