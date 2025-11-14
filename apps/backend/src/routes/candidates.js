const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { ObjectId } = require('mongodb');
const database = require('../database/connection');
const { authenticateCandidate, verifyToken } = require('../middleware/authMiddleware');
const { candidateSchemas, validateSchema } = require('../middleware/validation');
const Queue = require('bull');
const { Resend } = require('resend');

// Initialize Resend for direct email sending (only if API key is provided)
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('⚠️  RESEND_API_KEY not found. Email functionality will be disabled.');
}

// Simple email sending function (no Redis required)
async function sendEmailDirect(type, to, data) {
  // Check if Resend is initialized
  if (!resend) {
    const errorMsg = 'Email service not configured. RESEND_API_KEY environment variable is required.';
    console.error(`❌ ${errorMsg}`);
    console.error(`💡 To fix: Add RESEND_API_KEY to your .env file in apps/backend/.env`);
    return { success: false, error: errorMsg };
  }

  // Validate email address
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    const errorMsg = `Invalid email address: ${to}`;
    console.error(`❌ ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Normalize email address
  const normalizedEmail = to.toLowerCase().trim();
  console.log(`📧 Normalized email address: ${normalizedEmail}`);

  try {
    console.log(`📧 Preparing to send ${type} email to: ${normalizedEmail}`);
    const templates = {
      candidate_invitation: {
        subject: 'Invitation to Join FWC Infotech Talent Pool',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">FWC Infotech</h1>
              <p style="color: #6b7280; margin: 5px 0;">Talent Acquisition Portal</p>
            </div>
            
            <h2 style="color: #1f2937;">You're Invited to Join Our Talent Pool!</h2>
            
            <p>Dear ${data.candidateName || 'Candidate'},</p>
            
            <p>We are excited to invite you to join our talent pool at FWC Infotech. We believe your skills and experience could be a great fit for our organization.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">What's Next?</h3>
              <ol style="color: #374151;">
                <li><strong>Create Your Account:</strong> Click the link below to set up your candidate profile</li>
                <li><strong>Upload Your Resume:</strong> Share your professional background with us</li>
                <li><strong>Browse Opportunities:</strong> Explore current job openings that match your skills</li>
                <li><strong>Apply for Positions:</strong> Submit applications for roles that interest you</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.registrationLink}" 
                 style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Create Your Account
              </a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Note:</strong> This invitation is valid for 7 days. If you don't create an account within this time, you can still register later using your email address.
              </p>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact our HR team.</p>
            
            <p>We look forward to learning more about you!</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Best regards,<br>
              ${data.invitedByName || 'FWC Infotech HR Team'}<br>
              <strong>FWC Infotech Human Resources</strong>
            </p>
          </div>
        `
      },
      new_candidate_registered: {
        subject: 'New Candidate Registered - FWC Infotech',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">FWC Infotech</h1>
              <p style="color: #6b7280; margin: 5px 0;">Talent Acquisition Portal</p>
            </div>
            
            <h2 style="color: #1f2937;">New Candidate Registration</h2>
            
            <p>Hello HR Team,</p>
            
            <p>A new candidate has registered in our talent pool:</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Candidate Details</h3>
              <div style="color: #374151;">
                <p><strong>Name:</strong> ${data.candidateName}</p>
                <p><strong>Email:</strong> ${data.candidateEmail}</p>
                <p><strong>Registration Type:</strong> ${data.registrationType}</p>
                <p><strong>Registration Date:</strong> ${data.registrationDate}</p>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.candidateProfileLink}" 
                 style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View Candidate Profile
              </a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Next Steps:</strong> Review the candidate profile and consider screening them against current job openings.
              </p>
            </div>
            
            <p>Best regards,<br>
            <strong>FWC Infotech System</strong></p>
          </div>
        `
      },
      job_invitation: {
        subject: 'Job Opportunity - ${data.jobTitle} at ${data.companyName}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">FWC Infotech</h1>
              <p style="color: #6b7280; margin: 5px 0;">Talent Acquisition Portal</p>
            </div>
            
            <h2 style="color: #1f2937;">Job Opportunity for You!</h2>
            
            <p>Dear ${data.candidateName},</p>
            
            <p>${data.invitationMessage}</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Position Details</h3>
              <div style="color: #374151;">
                <p><strong>Job Title:</strong> ${data.jobTitle}</p>
                <p><strong>Department:</strong> ${data.department}</p>
                <p><strong>Company:</strong> ${data.companyName}</p>
              </div>
              
              <div style="margin-top: 15px;">
                <h4 style="color: #1f2937; margin-bottom: 10px;">Job Description:</h4>
                <p style="color: #374151; line-height: 1.6;">${data.jobDescription}</p>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.applicationLink}" 
                 style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Apply for This Position
              </a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Note:</strong> This invitation is personalized for you based on your profile and skills. We believe you would be a great addition to our team!
              </p>
            </div>
            
            <p>If you have any questions about this position, please don't hesitate to reach out.</p>
            
            <p>Best regards,<br>
            <strong>${data.invitedByName}</strong><br>
            <strong>FWC Infotech Human Resources Team</strong></p>
          </div>
        `
      }
    };

    const template = templates[type];
    if (!template) {
      throw new Error(`Email template not found for type: ${type}`);
    }

    // Use verified domain email if available, otherwise use default
    // For production, you should verify a domain at resend.com/domains
    const fromEmail = process.env.RESEND_FROM || 'FWC Infotech <onboarding@resend.dev>';
    console.log(`📧 Sending email from: ${fromEmail}`);
    console.log(`📧 Sending email to: ${normalizedEmail}`);
    
    const result = await resend.emails.send({
      from: fromEmail,
      to: [normalizedEmail], // Use normalized email
      subject: template.subject,
      html: template.html
    });

    if (result.error) {
      console.error('❌ Resend API error:', result.error);
      
      // Check for specific Resend testing mode error
      const errorMessage = result.error.message || '';
      if (errorMessage.includes('only send testing emails') || errorMessage.includes('verify a domain')) {
        // Extract verified email from error message if available
        const verifiedEmailMatch = errorMessage.match(/\(([^)]+@[^)]+)\)/);
        const verifiedEmail = verifiedEmailMatch ? verifiedEmailMatch[1] : null;
        
        let detailedError = `Resend is in testing mode. ${errorMessage}`;
        let solution = `\n\n🔧 TO FIX THIS AND SEND TO ANY EMAIL:\n`;
        solution += `1. Go to https://resend.com/domains\n`;
        solution += `2. Click "Add Domain" and enter your domain (e.g., fwc.co.in)\n`;
        solution += `3. Add the DNS records provided by Resend to your domain's DNS settings\n`;
        solution += `4. Wait for domain verification (usually 5-30 minutes)\n`;
        solution += `5. Update apps/backend/.env with:\n`;
        solution += `   RESEND_FROM="FWC Infotech <noreply@fwc.co.in>"\n`;
        solution += `6. Restart your backend server\n`;
        
        if (verifiedEmail) {
          solution += `\n⚠️  TEMPORARY WORKAROUND: You can currently only send to: ${verifiedEmail}\n`;
          solution += `   To send to other emails, domain verification is required.\n`;
        }
        
        detailedError += solution;
        console.error(`❌ ${detailedError}`);
        return { 
          success: false, 
          error: detailedError,
          requiresDomainVerification: true,
          verifiedEmail: verifiedEmail
        };
      }
      
      return { 
        success: false, 
        error: result.error.message || 'Resend API returned an error',
        errorDetails: result.error
      };
    }

    console.log('✅ Email sent successfully. Message ID:', result.data?.id);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred while sending email' 
    };
  }
}

// Configure multer for resume uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/resumes');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

// Candidate registration
router.post('/register', validateSchema(candidateSchemas.register), async (req, res) => {
  try {
    let { email, password, firstName, lastName, phone, invitationToken } = req.body;

    // Normalize email (lowercase and trim)
    email = email.toLowerCase().trim();

    // Check if candidate already exists
    const existingCandidate = await database.findOne('candidates', { email });
    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        message: 'Candidate with this email already exists'
      });
    }

    // Validate invitation token (REQUIRED)
    if (!invitationToken) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required. Please use the invitation link sent to your email.'
      });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fwc-hrms-super-secret-jwt-key-2024';
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(invitationToken, jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({
          success: false,
          message: 'Invitation token has expired. Please request a new invitation from HR.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation token. Please use the invitation link sent to your email.'
      });
    }

    // Verify email matches token
    if (decoded.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token does not match the provided email address.'
      });
    }

    // Check if invitation exists in database and is valid
    const invitation = await database.findOne('candidate_invitations', { 
      invitationToken,
      email 
    });

    if (!invitation) {
      return res.status(400).json({
        success: false,
        message: 'Invitation not found. Please use the invitation link sent to your email.'
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: invitation.status === 'ACCEPTED' 
          ? 'This invitation has already been used. Please contact HR if you need assistance.'
          : 'This invitation is no longer valid. Please request a new invitation from HR.'
      });
    }

    // Check if invitation has expired
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired. Please request a new invitation from HR.'
      });
    }

    // Update invitation status to ACCEPTED
    await database.updateOne(
      'candidate_invitations',
      { invitationToken, email },
      { 
        $set: { 
          status: 'ACCEPTED',
          acceptedAt: new Date()
        }
      }
    );

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create candidate (only via invitation)
    const candidate = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      status: 'ACTIVE',
      profileComplete: false,
      resumeUploaded: false,
      invitedBy: 'INVITATION',
      invitationId: invitation._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await database.insertOne('candidates', candidate);

    // Send notification to HR team about new candidate registration
    try {
      // Get HR team emails
      const hrUsers = await database.find('users', { 
        role: { $in: ['HR', 'ADMIN'] },
        isActive: true 
      });
      
      if (hrUsers.length > 0) {
        const hrEmails = hrUsers.map(user => user.email);
        
        // Send notification email to HR team
        const emailResult = await sendEmailDirect('new_candidate_registered', hrEmails, {
          candidateName: `${firstName} ${lastName}`,
          candidateEmail: email,
          registrationType: invitationToken ? 'Invited Candidate' : 'Self-Registered',
          registrationDate: new Date().toLocaleDateString(),
          candidateProfileLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/hr/candidates/${result.insertedId}`
        });
        
        if (emailResult.success) {
          console.log('HR notification sent successfully for new candidate:', email);
        } else {
          console.error('Failed to send HR notification:', emailResult.error);
        }
      }
    } catch (emailError) {
      console.error('Error sending HR notification:', emailError);
      // Don't fail registration if email fails
    }

    // Generate JWT token (jwtSecret already declared above)
    const token = jwt.sign(
      { 
        candidateId: result.insertedId.toString(),
        email: candidate.email,
        role: 'CANDIDATE'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Candidate registered successfully',
      data: {
        candidateId: result.insertedId,
        email: candidate.email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        token
      }
    });

  } catch (error) {
    console.error('Candidate registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Candidate login
router.post('/login', validateSchema(candidateSchemas.login), async (req, res) => {
  try {
    // Use validated body which already has normalized email
    const { email, password } = req.validatedBody || req.body;
    
    // Ensure email is normalized (validation should do this, but double-check)
    const normalizedEmail = email.toLowerCase().trim();

    // Find candidate - use normalized email
    let candidate = await database.findOne('candidates', { email: normalizedEmail });
    
    // If not found, try case-insensitive search as fallback
    if (!candidate) {
      const allCandidates = await database.find('candidates', {});
      candidate = allCandidates.find(c => c.email && c.email.toLowerCase().trim() === normalizedEmail);
    }

    if (!candidate) {
      console.error(`❌ Candidate not found for email: ${normalizedEmail}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Debug logging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 Candidate login attempt for: ${normalizedEmail}`);
      console.log(`   Found candidate: ${candidate.email}`);
      console.log(`   Status: ${candidate.status}`);
      console.log(`   Has password: ${!!candidate.password}`);
    }

    // No invitation check required - all candidates can login if they have valid credentials

    // Check password
    if (!candidate.password) {
      console.error(`❌ Candidate has no password set: ${candidate.email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password with better error handling
    let isPasswordValid = false;
    try {
      // Ensure password is a string
      const plainPassword = String(password || '').trim();
      const hashedPassword = String(candidate.password || '').trim();
      
      if (!plainPassword || !hashedPassword) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`❌ Empty password or hash for: ${candidate.email}`);
        }
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
      
      isPasswordValid = await bcrypt.compare(plainPassword, hashedPassword);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`   Password valid: ${isPasswordValid}`);
        console.log(`   Password length: ${plainPassword.length}`);
        console.log(`   Hash length: ${hashedPassword.length}`);
        console.log(`   Hash starts with: ${hashedPassword.substring(0, 10)}`);
      }
    } catch (compareError) {
      console.error(`❌ Password comparison error for ${candidate.email}:`, compareError);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    if (!isPasswordValid) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`❌ Password mismatch for: ${candidate.email}`);
        console.error(`   Attempted password: "${password}"`);
        console.error(`   Stored hash: ${candidate.password.substring(0, 20)}...`);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if candidate is active
    if (candidate.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Validate JWT_SECRET is available
    const jwtSecret = process.env.JWT_SECRET || 'fwc-hrms-super-secret-jwt-key-2024';
    if (!jwtSecret || jwtSecret === 'your-super-secret-jwt-key-change-this-in-production') {
      console.error('⚠️  JWT_SECRET not properly configured');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        candidateId: candidate._id.toString(),
        email: candidate.email,
        role: 'CANDIDATE'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        _id: candidate._id,
        candidateId: candidate._id,
        email: candidate.email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
        phone: candidate.phone,
        profileComplete: candidate.profileComplete,
        resumeUploaded: candidate.resumeUploaded,
        status: candidate.status,
        token
      }
    });

  } catch (error) {
    console.error('❌ Candidate login error:', error);
    console.error('   Error stack:', error.stack);
    
    // Provide more detailed error information in development
    const errorResponse = {
      success: false,
      message: 'Internal server error',
      ...(process.env.NODE_ENV !== 'production' && {
        error: error.message,
        stack: error.stack
      })
    };
    
    res.status(500).json(errorResponse);
  }
});

// Get all candidates (for HR/Admin)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { jobPostingId, status, page = 1, limit = 10 } = req.query;
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id;

    // Verify user has permission (user is already loaded by verifyToken middleware)
    const user = req.user;

    if (!['HR', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Build filter
    const filter = {};
    if (jobPostingId) filter.jobPostingId = jobPostingId;
    if (status) filter.status = status;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get candidates
    const candidates = await database.find(
      'candidates',
      filter,
      {
        sort: { createdAt: -1 },
        limit: parseInt(limit),
        skip: skip
      }
    );

    // Get total count for pagination
    const totalCandidates = await database.count('candidates', filter);

    res.json({
      success: true,
      data: {
        candidates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCandidates,
          pages: Math.ceil(totalCandidates / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get candidate profile
router.get('/profile', authenticateCandidate, async (req, res) => {
  try {
    const candidate = await database.findOne('candidates', { _id: req.candidateId });
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Remove password from response
    delete candidate.password;

    res.json({
      success: true,
      data: candidate
    });

  } catch (error) {
    console.error('Get candidate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update candidate profile
router.put('/profile', authenticateCandidate, validateSchema(candidateSchemas.updateProfile), async (req, res) => {
  try {
    const { firstName, lastName, phone, skills, experience, education } = req.body;

    const updateData = {
      firstName,
      lastName,
      phone,
      skills: skills || [],
      experience: experience || [],
      education: education || [],
      profileComplete: true,
      updatedAt: new Date()
    };

    const result = await database.updateOne(
      'candidates',
      { _id: req.candidateId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update candidate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Upload resume
router.post('/resume', authenticateCandidate, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file uploaded'
      });
    }

    const resumeData = {
      candidateId: req.candidateId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      uploadedAt: new Date(),
      status: 'UPLOADED',
      aiProcessed: false
    };

    // Save resume record
    const resumeResult = await database.insertOne('candidate_resumes', resumeData);

    // Update candidate record
    await database.updateOne(
      'candidates',
      { _id: req.candidateId },
      { 
        $set: { 
          resumeUploaded: true,
          resumeId: resumeResult.insertedId,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: 'Resume uploaded successfully',
      data: {
        resumeId: resumeResult.insertedId,
        fileName: resumeData.fileName,
        fileSize: resumeData.fileSize
      }
    });

  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get available job postings
router.get('/jobs', authenticateCandidate, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, location } = req.query;
    const skip = (page - 1) * limit;
    const candidateId = req.candidateId;

    let query = { status: 'PUBLISHED' };
    
    if (department) {
      query.department = { $regex: department, $options: 'i' };
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const jobs = await database.find('job_postings', query, {
      skip: parseInt(skip),
      limit: parseInt(limit),
      sort: { postedAt: -1 }
    });

    // Get candidate's applications to check which jobs they've applied for
    const applications = await database.find('candidate_applications', { candidateId });
    const appliedJobIds = applications.map(app => app.jobPostingId.toString());

    // Add applied status to each job
    const jobsWithAppliedStatus = jobs.map(job => ({
      ...job,
      applied: appliedJobIds.includes(job._id.toString())
    }));

    const totalJobs = await database.count('job_postings', query);

    res.json({
      success: true,
      data: {
        jobs: jobsWithAppliedStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalJobs / limit),
          totalJobs,
          hasNext: page * limit < totalJobs,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Apply for a job
router.post('/apply/:jobId', authenticateCandidate, validateSchema(candidateSchemas.jobApplication), async (req, res) => {
  try {
    const { jobId } = req.params;
    const candidateId = req.candidateId;

    // Check if job exists
    const job = await database.findOne('job_postings', { _id: new ObjectId(jobId) });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Check if candidate has uploaded resume
    const candidate = await database.findOne('candidates', { _id: candidateId });
    if (!candidate.resumeUploaded) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your resume before applying'
      });
    }

    // Check if already applied
    const existingApplication = await database.findOne('candidate_applications', {
      candidateId: candidateId,
      jobPostingId: new ObjectId(jobId)
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Create application
    const application = {
      candidateId,
      jobPostingId: new ObjectId(jobId),
      resumeId: candidate.resumeId,
      status: 'APPLIED',
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await database.insertOne('candidate_applications', application);

    // Update job posting application count
    await database.updateOne(
      'job_postings',
      { _id: new ObjectId(jobId) },
      { $inc: { currentApplications: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: result.insertedId,
        jobTitle: job.title,
        appliedAt: application.appliedAt
      }
    });

  } catch (error) {
    console.error('Job application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get candidate applications
router.get('/applications', authenticateCandidate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const candidateId = req.candidateId;

    const applications = await database.find('candidate_applications', 
      { candidateId },
      {
        skip: parseInt(skip),
        limit: parseInt(limit),
        sort: { appliedAt: -1 }
      }
    );

    // Populate job details for each application
    const populatedApplications = await Promise.all(
      applications.map(async (app) => {
        const job = await database.findOne('job_postings', { _id: app.jobPostingId });
        return {
          ...app,
          job: job ? {
            title: job.title,
            department: job.department,
            location: job.location,
            status: job.status
          } : null
        };
      })
    );

    const totalApplications = await database.count('candidate_applications', { candidateId });

    res.json({
      success: true,
      data: {
        applications: populatedApplications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalApplications / limit),
          totalApplications,
          hasNext: page * limit < totalApplications,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Initialize email queue
let emailQueue;
try {
  emailQueue = new Queue('email-notifications', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    }
  });
} catch (error) {
  console.warn('Email queue not available:', error.message);
}

// Validate invitation token (public endpoint for frontend)
router.get('/validate-invitation', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Token and email are required'
      });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fwc-hrms-super-secret-jwt-key-2024';
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.json({
          success: true,
          valid: false,
          message: 'Invitation token has expired. Please request a new invitation from HR.'
        });
      }
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid invitation token.'
      });
    }

    // Verify email matches token
    if (decoded.email !== email) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invitation token does not match the email address.'
      });
    }

    // Check if invitation exists in database
    const invitation = await database.findOne('candidate_invitations', { 
      invitationToken: token,
      email 
    });

    if (!invitation) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invitation not found.'
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'PENDING') {
      return res.json({
        success: true,
        valid: false,
        message: invitation.status === 'ACCEPTED' 
          ? 'This invitation has already been used.'
          : 'This invitation is no longer valid.'
      });
    }

    // Check if invitation has expired
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invitation has expired.'
      });
    }

    // Check if candidate already exists
    const existingCandidate = await database.findOne('candidates', { email });
    if (existingCandidate) {
      return res.json({
        success: true,
        valid: false,
        message: 'A candidate account with this email already exists.'
      });
    }

    return res.json({
      success: true,
      valid: true,
      message: 'Invitation is valid',
      data: {
        email: invitation.email,
        candidateName: invitation.candidateName,
        expiresAt: invitation.expiresAt
      }
    });

  } catch (error) {
    console.error('Validate invitation error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// HR: Send candidate invitation email
router.post('/invite', verifyToken, async (req, res) => {
  try {
    // Check if user has HR or ADMIN role
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. HR or Admin role required.'
      });
    }

    const { email, candidateName, invitedBy } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Check if candidate already exists
    const existingCandidate = await database.findOne('candidates', { email });
    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        message: 'Candidate with this email already exists'
      });
    }

    // Validate JWT_SECRET for invitation token
    const jwtSecret = process.env.JWT_SECRET || 'fwc-hrms-super-secret-jwt-key-2024';

    // Create invitation record
    const invitation = {
      email: email.toLowerCase().trim(), // Normalize email
      candidateName: candidateName || email.split('@')[0],
      invitedBy: req.user._id,
      invitedByName: invitedBy || req.user.name,
      status: 'PENDING',
      invitationToken: jwt.sign({ email: email.toLowerCase().trim() }, jwtSecret, { expiresIn: '7d' }),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const invitationResult = await database.insertOne('candidate_invitations', invitation);

    // Generate registration link with normalized email
    // Use FRONTEND_URL from env, or default to common development ports
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationLink = `${frontendUrl}/candidate-portal/register?token=${invitation.invitationToken}&email=${encodeURIComponent(invitation.email)}`;
    
    console.log(`🔗 Generated registration link: ${registrationLink}`);

    // Send email invitation directly to the provided email address
    let emailSent = false;
    let emailError = null;
    let emailMessageId = null;
    
    try {
      console.log(`📧 Attempting to send invitation email to: ${invitation.email}`);
      console.log(`📧 Registration link: ${registrationLink}`);
      
      // Check if RESEND_API_KEY is configured
      if (!process.env.RESEND_API_KEY) {
        emailError = 'Email service not configured. RESEND_API_KEY environment variable is required.';
        console.error(`❌ ${emailError}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to send invitation email',
          error: emailError,
          data: {
            invitationId: invitationResult.insertedId,
            email: invitation.email,
            candidateName: invitation.candidateName,
            registrationLink,
            emailSent: false
          }
        });
      }
      
      // Check if using default Resend testing email (onboarding@resend.dev)
      // This only works for verified test emails
      const isUsingTestEmail = !process.env.RESEND_FROM || 
                               process.env.RESEND_FROM.includes('onboarding@resend.dev');
      
      if (isUsingTestEmail) {
        console.warn('⚠️  Using Resend test email. Domain verification required for production use.');
        console.warn('💡 To send to any email: Verify domain at https://resend.com/domains and update RESEND_FROM');
      }
      
      const emailResult = await sendEmailDirect('candidate_invitation', invitation.email, {
        candidateName: invitation.candidateName,
        registrationLink,
        invitedByName: invitation.invitedByName
      });
      
      if (emailResult && emailResult.success) {
        emailSent = true;
        emailMessageId = emailResult.messageId;
        console.log(`✅ Email invitation sent successfully to: ${invitation.email}`);
        console.log(`📧 Message ID: ${emailMessageId || 'N/A'}`);
      } else {
        emailError = emailResult?.error || 'Unknown error occurred while sending email';
        console.error(`❌ Failed to send email to ${invitation.email}:`, emailError);
        
        // If domain verification is required, provide helpful instructions
        if (emailResult?.requiresDomainVerification) {
          console.error(`\n💡 SOLUTION: To fix this issue and send emails to any recipient:`);
          console.error(`   1. Go to https://resend.com/domains`);
          console.error(`   2. Click "Add Domain" and verify your domain (e.g., fwc.co.in)`);
          console.error(`   3. Add the DNS records provided by Resend to your domain's DNS settings`);
          console.error(`   4. Wait for domain verification (usually takes a few minutes)`);
          console.error(`   5. Update RESEND_FROM in apps/backend/.env to:`);
          console.error(`      RESEND_FROM="FWC Infotech <noreply@fwc.co.in>"`);
          console.error(`   6. Restart your backend server`);
          console.error(`\n   📝 Note: Until domain is verified, you can only send to verified test emails.\n`);
        }
      }
    } catch (error) {
      emailError = error.message || 'Unknown error occurred';
      console.error(`❌ Email sending exception for ${invitation.email}:`, error);
      console.error('Error stack:', error.stack);
    }

    // If email failed to send, return error response
    if (!emailSent) {
      console.error(`❌ Invitation created but email failed to send to: ${invitation.email}`);
      console.error(`   Error: ${emailError}`);
      console.error(`   Registration link: ${registrationLink}`);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send invitation email',
        error: emailError || 'Email service error. Please check RESEND_API_KEY configuration.',
        data: {
          invitationId: invitationResult.insertedId,
          email: invitation.email,
          candidateName: invitation.candidateName,
          expiresAt: invitation.expiresAt,
          emailSent: false,
          registrationLink,
          emailError: emailError
        }
      });
    }

    // Success response
    res.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitationId: invitationResult.insertedId,
        email: invitation.email,
        candidateName: invitation.candidateName,
        expiresAt: invitation.expiresAt,
        emailSent: true,
        emailMessageId: emailMessageId,
        registrationLink,
        emailError: null
      }
    });

  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get recent candidates for HR dashboard (HR only)
router.get('/recent', verifyToken, async (req, res) => {
  try {
    // Check if user has HR or ADMIN role
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. HR or Admin role required.'
      });
    }

    const { limit = 10, days = 7 } = req.query;
    
    // Calculate date range
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Get recent candidates
    const candidates = await database.find(
      'candidates',
      { 
        createdAt: { $gte: daysAgo },
        status: 'ACTIVE'
      },
      {
        sort: { createdAt: -1 },
        limit: parseInt(limit)
      }
    );

    // Get invitation details for each candidate
    const candidatesWithInvitations = await Promise.all(
      candidates.map(async (candidate) => {
        const invitation = await database.findOne('candidate_invitations', {
          email: candidate.email,
          status: 'ACCEPTED'
        });
        
        return {
          ...candidate,
          invitation: invitation ? {
            invitedBy: invitation.invitedByName,
            invitedAt: invitation.createdAt,
            registrationType: candidate.invitedBy
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        candidates: candidatesWithInvitations,
        total: candidatesWithInvitations.length,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Get recent candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all candidate invitations (HR only)
router.get('/invitations', verifyToken, async (req, res) => {
  try {
    // Check if user has HR or ADMIN role
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. HR or Admin role required.'
      });
    }

    const invitations = await database.find('candidate_invitations', {}, {
      sort: { createdAt: -1 }
    });

    res.json({
      success: true,
      data: invitations
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Proactive candidate screening (HR only)
router.post('/screen-candidate', verifyToken, async (req, res) => {
  try {
    // Check if user has HR or ADMIN role
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. HR or Admin role required.'
      });
    }

    const { candidateId, jobPostingId, screeningNotes } = req.body;

    if (!candidateId || !jobPostingId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job Posting ID are required'
      });
    }

    // Get candidate and job posting details
    const candidate = await database.findOne('candidates', { _id: candidateId });
    const jobPosting = await database.findOne('job_postings', { _id: jobPostingId });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Check if already screened for this job
    const existingScreening = await database.findOne('resume_screenings', {
      candidateId,
      jobPostingId
    });

    if (existingScreening) {
      return res.status(400).json({
        success: false,
        message: 'Candidate has already been screened for this job posting'
      });
    }

    // Create screening record
    const screening = {
      candidateId,
      jobPostingId,
      screenedBy: req.user._id,
      screenedByName: req.user.name,
      screeningDate: new Date(),
      status: 'SCREENED',
      screeningNotes: screeningNotes || '',
      fitScore: 0, // Will be calculated by AI or manual assessment
      aiAnalysis: null,
      manualAssessment: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const screeningResult = await database.insertOne('resume_screenings', screening);

    // Create candidate application if it doesn't exist
    const existingApplication = await database.findOne('candidate_applications', {
      candidateId,
      jobPostingId
    });

    if (!existingApplication) {
      const application = {
        candidateId,
        jobPostingId,
        resumeId: candidate.resumeId,
        status: 'SCREENED',
        appliedAt: new Date(),
        screeningId: screeningResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await database.insertOne('candidate_applications', application);
    }

    res.json({
      success: true,
      message: 'Candidate screening initiated successfully',
      data: {
        screeningId: screeningResult.insertedId,
        candidate: {
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email
        },
        jobPosting: {
          title: jobPosting.title,
          department: jobPosting.department
        }
      }
    });

  } catch (error) {
    console.error('Proactive screening error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Invite candidate to apply for specific job (HR only)
router.post('/invite-to-apply', verifyToken, async (req, res) => {
  try {
    // Check if user has HR or ADMIN role
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. HR or Admin role required.'
      });
    }

    const { candidateId, jobPostingId, invitationMessage } = req.body;

    if (!candidateId || !jobPostingId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job Posting ID are required'
      });
    }

    // Get candidate and job posting details
    const candidate = await database.findOne('candidates', { _id: candidateId });
    const jobPosting = await database.findOne('job_postings', { _id: jobPostingId });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Check if already invited
    const existingInvitation = await database.findOne('job_invitations', {
      candidateId,
      jobPostingId
    });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message: 'Candidate has already been invited to apply for this job'
      });
    }

    // Create job invitation record
    const invitation = {
      candidateId,
      jobPostingId,
      invitedBy: req.user._id,
      invitedByName: req.user.name,
      invitationDate: new Date(),
      invitationMessage: invitationMessage || `We believe you would be a great fit for the ${jobPosting.title} position.`,
      status: 'SENT',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const invitationResult = await database.insertOne('job_invitations', invitation);

    // Send email invitation to candidate
    try {
      const emailResult = await sendEmailDirect('job_invitation', candidate.email, {
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        jobTitle: jobPosting.title,
        department: jobPosting.department,
        companyName: 'FWC Infotech',
        invitationMessage: invitation.invitationMessage,
        jobDescription: jobPosting.description,
        applicationLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/candidate-portal/jobs/${jobPostingId}`,
        invitedByName: req.user.name
      });

      if (emailResult.success) {
        console.log('Job invitation email sent successfully to:', candidate.email);
      } else {
        console.error('Failed to send job invitation email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending job invitation email:', emailError);
    }

    res.json({
      success: true,
      message: 'Job invitation sent successfully',
      data: {
        invitationId: invitationResult.insertedId,
        candidate: {
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email
        },
        jobPosting: {
          title: jobPosting.title,
          department: jobPosting.department
        }
      }
    });

  } catch (error) {
    console.error('Job invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;