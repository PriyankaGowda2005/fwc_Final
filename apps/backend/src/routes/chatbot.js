const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI initialized successfully');
    console.log('📝 API Key length:', GEMINI_API_KEY.length, 'characters');
    console.log('📝 API Key starts with:', GEMINI_API_KEY.substring(0, 10) + '...');
  } catch (error) {
    console.error('⚠️  Error initializing Gemini AI:', error.message);
    console.error('Full error:', error);
    genAI = null;
  }
} else {
  console.warn('⚠️  WARNING: GEMINI_API_KEY is not set. Chatbot will use fallback responses.');
  console.warn('💡 Please set GEMINI_API_KEY in your .env file');
}

// Enhanced Company context for the chatbot - Industry-oriented
const COMPANY_CONTEXT = `You are an expert AI-powered virtual assistant for FWC Infotech, a leading provider of HRMS & AI-driven IT Solutions. Your role is to provide professional, industry-oriented guidance to potential clients, job seekers, and website visitors.

COMPANY PROFILE:
- Company Name: FWC Infotech
- Industry: Enterprise HRMS Solutions & AI-Powered IT Services
- Specialization: Human Resource Management Systems, AI-driven automation, Enterprise software solutions
- Market Position: Industry leader in HR technology transformation
- Target Clients: Enterprises, SMBs, HR departments, IT organizations

CORE PRODUCTS & SERVICES:

1. HRMS PLATFORM (Enterprise-Grade)
   - Complete employee lifecycle management from onboarding to offboarding
   - Multi-tenant architecture supporting organizations of all sizes
   - Cloud-based and on-premise deployment options
   - Real-time analytics and business intelligence

2. PAYROLL MANAGEMENT SYSTEM
   - Automated salary processing with tax compliance
   - Multi-country payroll support
   - Benefits administration and deductions management
   - Integration with accounting systems

3. ATTENDANCE & TIME TRACKING
   - Real-time clock-in/out with geolocation and biometric verification
   - Shift management and scheduling
   - Overtime calculation and compliance
   - Mobile app for remote workforce

4. LEAVE MANAGEMENT
   - Automated approval workflows with multi-level authorization
   - Calendar integration and conflict detection
   - Policy enforcement and compliance
   - Self-service portal for employees

5. PERFORMANCE MANAGEMENT
   - 360-degree feedback system
   - Goal setting and tracking (OKRs/KPIs)
   - Performance reviews and appraisals
   - Career development planning

6. RECRUITMENT & TALENT ACQUISITION
   - AI-powered resume screening and candidate matching
   - Automated interview scheduling
   - Candidate relationship management (CRM)
   - Job posting and applicant tracking system (ATS)

7. ANALYTICS & REPORTING
   - Real-time dashboards and KPIs
   - Predictive analytics for HR metrics
   - Custom report builder
   - Data visualization and insights

8. AI-POWERED FEATURES
   - Intelligent resume parsing and analysis
   - Automated interview assessments
   - Sentiment analysis for employee feedback
   - Predictive analytics for retention and performance

INDUSTRY EXPERTISE:
- Serves multiple industries: Technology, Finance, Healthcare, Manufacturing, Retail, Education
- Compliance: GDPR, SOC 2, ISO 27001 certified
- Integration: Works with 100+ third-party applications (Slack, Microsoft Teams, SAP, Oracle, etc.)
- Scalability: Supports organizations from 50 to 50,000+ employees

WEBSITE NAVIGATION:
- Home (/) - Main landing page
- Who we serve (/who-we-serve) - Target industries and client profiles
- What we do (/what-we-do) - Services and solutions overview
- Who we are (/who-we-are) - Company background and team
- Why choose us (/why-choose-us) - Competitive advantages and differentiators
- Contact (/contact) - Get in touch with sales/support
- Careers (/careers) - Job openings and career opportunities
- Features (/features) - Detailed feature list
- About (/about) - Company information

YOUR RESPONSIBILITIES:
1. Provide accurate, industry-specific information about HRMS solutions
2. Guide potential clients through our services and help them understand ROI
3. Assist job seekers with application process and career opportunities
4. Answer technical questions about our platform capabilities
5. Generate professional summaries, descriptions, and content
6. Handle inquiries professionally and route to appropriate departments
7. Provide industry insights and best practices when relevant

COMMUNICATION STYLE:
- Professional yet approachable
- Industry-focused with technical accuracy
- Solution-oriented responses
- Clear, concise, and actionable
- Use industry terminology appropriately
- Provide specific examples when relevant
- Always maintain FWC Infotech's brand voice

RESPONSE GUIDELINES:
- For service inquiries: Provide detailed, technical information with business value
- For job seekers: Be helpful and guide through application process
- For technical questions: Provide accurate, detailed answers
- For general queries: Be informative and suggest relevant next steps
- Always end with a helpful call-to-action when appropriate

Remember: You represent a leading HRMS solution provider. Be knowledgeable, professional, and demonstrate industry expertise in every interaction.`;

// Configure multer for resume uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/chatbot');
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
    }
  }
});

// Generate intelligent fallback responses when Gemini API is not available
function generateFallbackResponse(message, queryType) {
  const lowerMessage = message.toLowerCase();
  
  // Service inquiries
  if (queryType === 'service_inquiry' || lowerMessage.includes('service') || lowerMessage.includes('hrms') || lowerMessage.includes('feature')) {
    return `Thank you for your interest in FWC Infotech's HRMS solutions! We offer comprehensive enterprise-grade Human Resource Management Systems including:

**Core Services:**
• **Employee Management & Lifecycle** - Complete employee lifecycle from onboarding to offboarding
• **Payroll Processing & Compliance** - Automated salary processing with tax compliance
• **Attendance & Time Tracking** - Real-time clock-in/out with geolocation and biometric verification
• **Performance Management** - 360-degree feedback, goal tracking, and performance reviews
• **AI-Powered Recruitment** - Intelligent resume screening and candidate matching
• **Analytics & Reporting** - Real-time dashboards and predictive analytics

**Key Features:**
- Cloud-based and on-premise deployment options
- Multi-tenant architecture supporting organizations of all sizes
- Integration with 100+ third-party applications
- GDPR, SOC 2, ISO 27001 certified
- Supports organizations from 50 to 50,000+ employees

Would you like more details about any specific service? You can also:
- Visit /features for detailed feature list
- Contact us at hr@fwc.co.in
- Schedule a demo through our contact page`;
  }
  
  // Job inquiries
  if (queryType === 'job_inquiry' || lowerMessage.includes('job') || lowerMessage.includes('career') || lowerMessage.includes('hiring')) {
    return `Great to hear you're interested in joining FWC Infotech! We're always looking for talented individuals to join our team.

**Current Opportunities:**
We have openings across various departments including:
- Engineering & Development
- Human Resources
- Sales & Business Development
- Customer Success
- Marketing

**How to Apply:**
1. Visit our Careers page at /careers to view all open positions
2. Browse job openings by department, location, or role type
3. Click "Apply Now" on any position that interests you
4. Upload your resume and complete the application form

**What We Offer:**
- Competitive compensation packages
- Flexible work arrangements
- Professional development opportunities
- Collaborative work environment
- Cutting-edge technology stack

For more information, visit /careers or email us at hr@fwc.co.in`;
  }
  
  // Contact inquiries
  if (queryType === 'contact_request' || lowerMessage.includes('contact') || lowerMessage.includes('reach') || lowerMessage.includes('email')) {
    return `We'd love to hear from you! Here are the best ways to get in touch with FWC Infotech:

**Contact Information:**
• **HR Email**: hr@fwc.co.in
• **Support Email**: support@fwc.co.in
• **Phone (India)**: +91 8026 597 566
• **Phone (Global)**: +1 (408) 914-2832
• **Website**: https://fwc.co.in

**Office Location:**
- 4th Floor, 1348, 7th Avenue, Opposite Yes Bank
- Jayanagara 9th Block, Jayanagar
- Bengaluru, Karnataka 560041, India

**Get Started:**
- Visit /contact to fill out our contact form
- Schedule a demo to see our HRMS platform in action
- Request a consultation with our sales team

We typically respond within 24 hours. For urgent matters, please call our support team directly.`;
  }
  
  // Technical questions
  if (queryType === 'technical_question' || lowerMessage.includes('api') || lowerMessage.includes('integration') || lowerMessage.includes('technical')) {
    return `I'd be happy to help with technical questions about our HRMS platform!

**Technical Capabilities:**
• RESTful API for seamless integrations
• Webhook support for real-time event notifications
• SDKs available for popular programming languages
• Comprehensive API documentation
• OAuth 2.0 and SSO support
• Database: MongoDB with scalable architecture
• Cloud deployment: AWS, Azure, GCP compatible

**Integration Options:**
- Pre-built connectors for 100+ applications (Slack, Teams, SAP, Oracle, etc.)
- Custom integration support
- Webhook-based event system
- Data import/export capabilities

**Security & Compliance:**
- SOC 2 Type II certified
- ISO 27001 compliant
- GDPR compliant
- End-to-end encryption
- Regular security audits

For detailed technical documentation or API access, please contact our technical team at support@fwc.co.in or visit /documentation`;
  }
  
  // General/Default response
  return `Hello! I'm here to help you learn about FWC Infotech and our enterprise HRMS solutions.

**What I can help you with:**
• Information about our HRMS services and features
• Job openings and career opportunities
• Technical questions about our platform
• Contact information and how to reach us
• Scheduling demos or consultations

**Quick Links:**
- **Services**: /what-we-do
- **Features**: /features
- **Careers**: /careers
- **Contact**: /contact
- **About Us**: /about

**Our Services Include:**
- Employee Management & Lifecycle
- Payroll Processing & Compliance
- Attendance & Time Tracking
- Performance Management
- AI-Powered Recruitment
- Analytics & Reporting

Feel free to ask me anything specific, or visit our contact page to speak directly with our team!`;
}

// Classify query type for better response handling
function classifyQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Service-related keywords
  const serviceKeywords = ['service', 'hrms', 'platform', 'solution', 'feature', 'product', 'system', 'software', 'module', 'functionality', 'capability', 'what can', 'how does', 'tell me about'];
  if (serviceKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'service_inquiry';
  }
  
  // Job/career-related keywords
  const jobKeywords = ['job', 'career', 'opening', 'position', 'vacancy', 'hiring', 'recruit', 'apply', 'application', 'opportunity', 'role', 'work at'];
  if (jobKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'job_inquiry';
  }
  
  // Technical keywords
  const technicalKeywords = ['api', 'integration', 'implement', 'deploy', 'technical', 'architecture', 'database', 'security', 'compliance', 'sso', 'oauth', 'rest', 'graphql', 'sdk', 'documentation'];
  if (technicalKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'technical_question';
  }
  
  // Contact/sales keywords
  const contactKeywords = ['contact', 'reach', 'call', 'email', 'phone', 'sales', 'demo', 'consultation', 'meeting', 'schedule', 'talk', 'speak', 'get in touch'];
  if (contactKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'contact_request';
  }
  
  // Default to general question
  return 'general_question';
}

// Get or create chat session
async function getOrCreateSession(sessionId, userId = null) {
  if (!database.isConnected) {
    return { sessionId, messages: [] };
  }

  try {
    let session = await database.findOne('chatbot_sessions', { sessionId });
    
    if (!session) {
      session = {
        sessionId,
        userId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await database.insertOne('chatbot_sessions', session);
    }
    
    return session;
  } catch (error) {
    console.error('Error getting/creating session:', error);
    return { sessionId, messages: [] };
  }
}

// Save message to session
async function saveMessage(sessionId, role, content, metadata = {}) {
  if (!database.isConnected) return;

  try {
    const message = {
      role,
      content,
      metadata,
      timestamp: new Date()
    };
    
    await database.updateOne(
      'chatbot_sessions',
      { sessionId },
      {
        $push: { messages: message },
        $set: { updatedAt: new Date() }
      }
    );
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

// Chat endpoint with enhanced Gemini API integration
router.post('/chat', [
  body('message').notEmpty().withMessage('Message is required'),
  body('sessionId').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  const { message, sessionId: providedSessionId } = req.body;
  const sessionId = providedSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Get or create session
    const session = await getOrCreateSession(sessionId);
    
    // Classify query type for better response handling
    const queryType = classifyQuery(message);
    
    // Check if Gemini AI is available
    if (!genAI) {
      console.error('❌ Gemini AI is not initialized. Check GEMINI_API_KEY in .env file');
      // Use intelligent fallback responses
      const fallbackResponse = generateFallbackResponse(message, queryType);
      await saveMessage(sessionId, 'user', message);
      await saveMessage(sessionId, 'assistant', fallbackResponse);
      
      return res.json({
        success: true,
        sessionId,
        response: fallbackResponse,
        timestamp: new Date(),
        note: 'Using fallback response - Gemini AI not available'
      });
    }
    
    console.log(`📨 Processing chat message: "${message.substring(0, 50)}..."`);
    console.log(`🔍 Query type: ${queryType}`);

    // Model initialization will be done in the retry loop with fallback

    // Build conversation history for context (last 10 messages for better context)
    const recentMessages = session.messages.slice(-10);
    const conversationHistory = recentMessages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    
    // Build comprehensive prompt with query-specific instructions
    const systemPrompt = `${COMPANY_CONTEXT}\n\n`;
    const historyContext = conversationHistory ? `Previous Conversation:\n${conversationHistory}\n\n` : '';
    const userQuery = `Current User Query: ${message}\n\n`;
    
    // Query-specific instructions
    let instruction = '';
    switch (queryType) {
      case 'service_inquiry':
        instruction = `This is a service inquiry. Provide detailed information about our HRMS services, features, benefits, and how they can help the user. Include specific examples and use cases. Be solution-oriented and highlight business value.`;
        break;
      case 'job_inquiry':
        instruction = `This is a job/career inquiry. Provide information about career opportunities, job openings, application process, and company culture. Be encouraging and helpful.`;
        break;
      case 'technical_question':
        instruction = `This is a technical question. Provide accurate, detailed technical information about our platform, integrations, implementation, and technical capabilities. Use industry terminology appropriately.`;
        break;
      case 'contact_request':
        instruction = `This is a contact or sales inquiry. Provide contact information, encourage them to reach out, and offer to help schedule a consultation or demo. Be warm and professional.`;
        break;
      case 'general_question':
        instruction = `This is a general question. Provide helpful, informative answers while maintaining relevance to our HRMS solutions and services. Be conversational yet professional.`;
        break;
      default:
        instruction = `Please provide a helpful, professional, and industry-oriented response. Be specific, accurate, and solution-focused. Address the user's query comprehensively.`;
    }

    const fullPrompt = `${systemPrompt}

${historyContext ? `CONVERSATION HISTORY:
${historyContext}` : ''}

USER QUESTION: ${message}

${instruction}

INSTRUCTIONS:
- Provide a direct, helpful, and conversational answer to the user's question
- Use the conversation history to maintain context
- Be specific and detailed in your response
- If the question is about our services, provide concrete examples and benefits
- If asking about contact info, provide our actual contact details
- Keep responses natural and engaging, not robotic
- Always end with a helpful follow-up question or suggestion when appropriate
- Never say "I don't know" - instead provide helpful guidance or redirect to resources

Please respond directly to the user's question now:`;

    // Generate response with retry logic and model fallback
    let responseText = '';
    let attempts = 0;
    const maxAttempts = 3;
    const modelsToTry = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.5-pro'];
    let currentModelIndex = 0;

    while (attempts < maxAttempts && currentModelIndex < modelsToTry.length) {
      try {
        // Try different models if one fails
        const currentModel = modelsToTry[currentModelIndex];
        console.log(`Attempting to use model: ${currentModel}`);
        
        const modelInstance = genAI.getGenerativeModel({ 
          model: currentModel,
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });

        const result = await modelInstance.generateContent(fullPrompt);
        const response = await result.response;
        responseText = response.text();
        
        // Validate response
        if (responseText && responseText.trim().length > 0) {
          console.log(`✅ Successfully generated response using ${currentModel}`);
          break;
        } else {
          throw new Error('Empty response from API');
        }
      } catch (apiError) {
        attempts++;
        console.error(`Gemini API attempt ${attempts} with ${modelsToTry[currentModelIndex]} failed:`, apiError.message);
        console.error('Full error:', apiError);
        
        // Try next model if available
        if (attempts >= maxAttempts && currentModelIndex < modelsToTry.length - 1) {
          currentModelIndex++;
          attempts = 0;
          console.log(`Switching to model: ${modelsToTry[currentModelIndex]}`);
          continue;
        }
        
        if (attempts >= maxAttempts || currentModelIndex >= modelsToTry.length - 1) {
          // Use intelligent fallback instead of generic error
          console.log('Using intelligent fallback response');
          responseText = generateFallbackResponse(message, queryType);
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    // Save messages
    await saveMessage(sessionId, 'user', message);
    await saveMessage(sessionId, 'assistant', responseText);

    res.json({
      success: true,
      sessionId,
      response: responseText,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Chatbot error:', error);
    console.error('Error stack:', error.stack);
    
    // Try to use fallback response
    try {
      const queryType = classifyQuery(req.body.message || '');
      const fallbackResponse = generateFallbackResponse(req.body.message || '', queryType);
      
      res.json({
        success: true,
        sessionId: req.body.sessionId || `session-${Date.now()}`,
        response: fallbackResponse,
        timestamp: new Date(),
        note: 'Using fallback due to error'
      });
    } catch (fallbackError) {
      // Last resort error response
      const errorResponse = `I apologize, but I encountered an issue processing your request. 

Here's how I can still help:
1. **Our Services**: We offer comprehensive HRMS solutions including Employee Management, Payroll, Attendance, Performance Reviews, and AI-powered Recruitment.

2. **Get in Touch**: 
   - Visit /contact for direct contact
   - Email: support@fwc.co.in
   - Phone: +91 8026 597 566
   - Our team is ready to assist you

3. **Try Again**: Please rephrase your question or try asking about:
   - Our HRMS platform features
   - Implementation and deployment options
   - Industry-specific solutions
   - Career opportunities

I'm here to help - please try your question again!`;

      res.status(500).json({
        success: false,
        message: 'Error processing chat message',
        response: errorResponse,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}));

// Resume upload and analysis
router.post('/resume/upload', upload.single('resume'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Resume file is required'
    });
  }

  try {
    const { sessionId, candidateName, candidateEmail } = req.body;
    
    // Read file content (for text extraction)
    const filePath = req.file.path;
    let fileContent = '';
    
    try {
      if (req.file.mimetype === 'text/plain') {
        fileContent = await fs.readFile(filePath, 'utf-8');
      } else {
        // For PDF/DOC files, we'd need a parser library
        // For now, just note the file was uploaded
        fileContent = `Resume file uploaded: ${req.file.originalname}`;
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }

    // Use Gemini to analyze resume
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Analyze this resume and extract key information in JSON format:
- candidateName
- email
- phone
- skills (array)
- experience (years)
- education
- summary

Resume content:
${fileContent.substring(0, 5000)}`;

    const result = await model.generateContent(prompt);
    const analysis = await result.response.text();

    // Save to database
    if (database.isConnected) {
      const resumeData = {
        sessionId: sessionId || `resume-${Date.now()}`,
        candidateName: candidateName || 'Unknown',
        candidateEmail: candidateEmail || '',
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        analysis,
        uploadedAt: new Date()
      };
      
      await database.insertOne('chatbot_resumes', resumeData);
    }

    res.json({
      success: true,
      message: 'Resume uploaded and analyzed successfully',
      analysis,
      file: {
        name: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing resume',
      error: error.message
    });
  }
}));

// Job application submission
router.post('/application/submit', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('jobId').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  const { name, email, jobId, coverLetter, resumeUrl, sessionId } = req.body;

  try {
    // Save application
    if (database.isConnected) {
      const application = {
        name,
        email,
        jobId,
        coverLetter,
        resumeUrl,
        sessionId,
        status: 'pending',
        submittedAt: new Date()
      };
      
      await database.insertOne('chatbot_applications', application);
    }

    // Generate acknowledgment message using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Generate a professional acknowledgment message for a job application:
- Applicant name: ${name}
- Position: ${jobId || 'General Application'}
- Company: FWC Infotech
- Tone: Professional, warm, and encouraging
- Include: Thank you, next steps, timeline expectations`;

    const result = await model.generateContent(prompt);
    const acknowledgment = await result.response.text();

    res.json({
      success: true,
      message: 'Application submitted successfully',
      acknowledgment,
      applicationId: `app-${Date.now()}`
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting application',
      error: error.message
    });
  }
}));

// Contact form submission
router.post('/contact', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').notEmpty().withMessage('Message is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  const { name, email, message, subject, phone, sessionId } = req.body;

  try {
    // Save contact inquiry
    if (database.isConnected) {
      const inquiry = {
        name,
        email,
        phone,
        subject: subject || 'General Inquiry',
        message,
        sessionId,
        status: 'new',
        createdAt: new Date()
      };
      
      await database.insertOne('chatbot_inquiries', inquiry);
    }

    // Generate response using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Generate a professional response to a contact inquiry:
- Inquirer name: ${name}
- Subject: ${subject || 'General Inquiry'}
- Message: ${message}
- Company: FWC Infotech
- Tone: Professional, helpful, and prompt
- Include: Thank you, acknowledgment, next steps`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    res.json({
      success: true,
      message: 'Contact inquiry submitted successfully',
      response,
      inquiryId: `inq-${Date.now()}`
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting contact inquiry',
      error: error.message
    });
  }
}));

// Get job openings
router.get('/jobs', asyncHandler(async (req, res) => {
  try {
    let jobs = [];
    
    if (database.isConnected) {
      jobs = await database.find('job_postings', { 
        status: 'active' 
      }, { 
        limit: 10,
        sort: { postedAt: -1 }
      });
    }

    // If no jobs in DB, return sample jobs
    if (jobs.length === 0) {
      jobs = [
        {
          _id: '1',
          title: 'Senior Full Stack Developer',
          department: 'Engineering',
          location: 'Remote',
          type: 'Full-time',
          description: 'We are looking for an experienced Full Stack Developer...'
        },
        {
          _id: '2',
          title: 'HR Business Partner',
          department: 'Human Resources',
          location: 'Bengaluru',
          type: 'Full-time',
          description: 'Join our HR team to help shape the future of HRMS...'
        }
      ];
    }

    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching job openings',
      error: error.message
    });
  }
}));

// Generate content (for SEO, summaries, etc.)
router.post('/generate-content', [
  body('type').isIn(['summary', 'tagline', 'description', 'testimonial']).withMessage('Invalid content type'),
  body('input').notEmpty().withMessage('Input is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  const { type, input } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    let prompt = '';
    switch (type) {
      case 'summary':
        prompt = `Summarize the following content into a concise, SEO-friendly summary (80-150 words):\n\n${input}`;
        break;
      case 'tagline':
        prompt = `Generate a catchy, professional tagline for FWC Infotech based on: ${input}`;
        break;
      case 'description':
        prompt = `Generate a professional service description for FWC Infotech: ${input}`;
        break;
      case 'testimonial':
        prompt = `Generate a professional testimonial for FWC Infotech based on: ${input}`;
        break;
    }

    const result = await model.generateContent(prompt);
    const content = await result.response.text();

    res.json({
      success: true,
      type,
      content
    });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating content',
      error: error.message
    });
  }
}));

// Test endpoint to verify Gemini API is working
router.get('/test', asyncHandler(async (req, res) => {
  try {
    if (!genAI) {
      return res.json({
        success: false,
        message: 'Gemini AI not initialized',
        hasApiKey: !!process.env.GEMINI_API_KEY,
        apiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say "Hello, I am working!" in one sentence.');
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      message: 'Gemini API is working!',
      testResponse: text,
      model: 'gemini-1.5-flash',
      hasApiKey: true,
      apiKeyLength: process.env.GEMINI_API_KEY.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gemini API test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hasApiKey: !!process.env.GEMINI_API_KEY
    });
  }
}));

module.exports = router;

