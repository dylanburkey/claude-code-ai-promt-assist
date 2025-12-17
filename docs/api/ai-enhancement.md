# AI Enhancement API

The AI Enhancement API provides intelligent suggestions and improvements for resource creation and project management using Cloudflare Workers AI.

## Endpoints

### Enhance Resource Creation
```http
POST /api/ai/enhance-resource
```

Provides AI-powered suggestions for improving resource definitions based on project context.

**Request Body:**
```json
{
  "project_context": {
    "name": "E-commerce Platform",
    "description": "Modern e-commerce platform with React and Stripe integration",
    "category": "web-development",
    "existing_resources": [
      {
        "type": "agent",
        "name": "Frontend Developer",
        "role": "React specialist"
      }
    ]
  },
  "resource_type": "agent",
  "resource_data": {
    "name": "Backend Developer",
    "role": "API Developer",
    "system_prompt": "Help with backend development tasks"
  }
}
```

**Response:**
```json
{
  "suggestions": "Consider expanding the system prompt to include specific technologies like Node.js, Express, and database management. Add error handling guidelines and API security best practices.",
  "enhanced_data": {
    "name": "Backend API Developer",
    "role": "Senior Backend Developer specializing in Node.js and API design",
    "system_prompt": "You are an expert backend developer with deep knowledge of Node.js, Express, database design, and API security. Help with server-side development tasks including API design, database optimization, error handling, and security implementation. Always consider scalability and maintainability in your recommendations.",
    "suggested_tags": ["nodejs", "express", "api", "database", "security"],
    "compatibility_score": 0.95
  },
  "recommendations": [
    "Add specific technology stack details",
    "Include security and error handling guidelines",
    "Consider API versioning and documentation practices"
  ],
  "context_analysis": {
    "project_fit": "high",
    "complementary_resources": ["Frontend Developer"],
    "potential_conflicts": []
  }
}
```

### Validate Resource Compatibility
```http
POST /api/ai/validate-compatibility
```

Analyzes compatibility between resources and provides recommendations for optimal combinations.

**Request Body:**
```json
{
  "project_context": {
    "name": "Mobile App Project",
    "description": "React Native mobile application",
    "category": "mobile-development"
  },
  "resources": [
    {
      "type": "agent",
      "id": "agent-1",
      "name": "React Native Developer"
    },
    {
      "type": "rule",
      "id": "rule-1", 
      "name": "Web Development Standards"
    }
  ]
}
```

**Response:**
```json
{
  "overall_compatibility": 0.75,
  "analysis": {
    "compatible_pairs": [
      {
        "resource1": "agent-1",
        "resource2": "rule-1",
        "compatibility_score": 0.75,
        "reasoning": "Web standards partially apply to React Native development"
      }
    ],
    "conflicts": [],
    "recommendations": [
      {
        "type": "suggestion",
        "message": "Consider adding mobile-specific development rules",
        "priority": "medium"
      }
    ]
  },
  "optimization_suggestions": [
    "Add React Native specific linting rules",
    "Include mobile performance guidelines",
    "Consider platform-specific (iOS/Android) requirements"
  ]
}
```

### Generate Project Context
```http
GET /api/ai/project-context/{projectId}
```

Generates AI context summary for a project based on its resources and configuration.

**Parameters:**
- `projectId` (number, required): Project ID

**Response:**
```json
{
  "project_id": 1,
  "context_summary": "E-commerce platform project focused on React frontend with Node.js backend. Includes payment processing with Stripe, user authentication, and product catalog management. Development follows modern web standards with emphasis on security and performance.",
  "key_technologies": ["React", "Node.js", "Stripe", "MongoDB"],
  "development_focus": ["Frontend Development", "API Design", "Payment Processing"],
  "resource_analysis": {
    "agents": {
      "count": 2,
      "primary": "Full-Stack Developer",
      "specializations": ["Frontend", "Backend", "Payment Integration"]
    },
    "rules": {
      "count": 5,
      "categories": ["Security", "Code Quality", "Performance"]
    },
    "hooks": {
      "count": 3,
      "types": ["Pre-commit", "Deployment", "Testing"]
    }
  },
  "ai_recommendations": [
    "Consider adding mobile-responsive design guidelines",
    "Include API rate limiting and security rules",
    "Add automated testing workflows"
  ]
}
```

### Batch Enhance Resources
```http
POST /api/ai/enhance-resources-batch
```

Enhances multiple resources simultaneously with cross-resource optimization.

**Request Body:**
```json
{
  "project_context": {
    "name": "Enterprise Web Application",
    "description": "Large-scale web application with microservices architecture"
  },
  "resources": [
    {
      "type": "agent",
      "data": {
        "name": "Frontend Developer",
        "role": "UI Developer"
      }
    },
    {
      "type": "agent", 
      "data": {
        "name": "Backend Developer",
        "role": "API Developer"
      }
    },
    {
      "type": "rule",
      "data": {
        "title": "Code Standards",
        "description": "Basic coding guidelines"
      }
    }
  ],
  "optimization_goals": [
    "consistency",
    "complementarity", 
    "comprehensive_coverage"
  ]
}
```

**Response:**
```json
{
  "enhanced_resources": [
    {
      "original_index": 0,
      "type": "agent",
      "enhanced_data": {
        "name": "Senior Frontend Developer",
        "role": "Expert React/TypeScript Developer with UI/UX focus",
        "system_prompt": "You are a senior frontend developer specializing in React, TypeScript, and modern UI frameworks. Focus on component architecture, state management, accessibility, and performance optimization."
      },
      "enhancement_score": 0.88
    },
    {
      "original_index": 1,
      "type": "agent",
      "enhanced_data": {
        "name": "Senior Backend Developer", 
        "role": "Microservices Architecture Specialist",
        "system_prompt": "You are a senior backend developer expert in microservices architecture, API design, and distributed systems. Focus on scalable backend solutions, database optimization, and service integration."
      },
      "enhancement_score": 0.92
    },
    {
      "original_index": 2,
      "type": "rule",
      "enhanced_data": {
        "title": "Enterprise Development Standards",
        "description": "Comprehensive coding standards for enterprise web applications",
        "rule_text": "Follow TypeScript strict mode, implement comprehensive error handling, use consistent naming conventions, maintain 80%+ test coverage, and document all public APIs."
      },
      "enhancement_score": 0.85
    }
  ],
  "cross_resource_optimizations": [
    {
      "optimization_type": "consistency",
      "affected_resources": [0, 1, 2],
      "description": "Aligned all resources to use TypeScript and enterprise-grade practices"
    },
    {
      "optimization_type": "complementarity",
      "affected_resources": [0, 1],
      "description": "Frontend and backend agents configured for optimal collaboration"
    }
  ],
  "overall_enhancement_score": 0.88,
  "recommendations": [
    "Consider adding DevOps specialist agent for deployment automation",
    "Include security-focused rules for enterprise compliance",
    "Add integration testing guidelines"
  ]
}
```

## AI Context Integration

### Project Context Building

The AI system builds context from multiple sources:

**Project Information:**
- Name, description, and category
- Tags and metadata
- Timeline and priority

**Resource Analysis:**
- Existing agents and their specializations
- Applied rules and their categories
- Configured hooks and automation

**Usage Patterns:**
- Resource assignment frequency
- Successful project combinations
- Common enhancement requests

### Enhancement Algorithms

**Contextual Analysis:**
- Analyzes project type and requirements
- Identifies gaps in current resource coverage
- Suggests complementary resources

**Best Practice Integration:**
- Applies industry standards and conventions
- Incorporates proven patterns and practices
- Suggests modern tooling and approaches

**Compatibility Optimization:**
- Ensures resources work well together
- Identifies and resolves potential conflicts
- Optimizes for team collaboration

## Usage Examples

### Enhance Agent Creation
```bash
curl -X POST http://localhost:8787/api/ai/enhance-resource \
  -H "Content-Type: application/json" \
  -d '{
    "project_context": {
      "name": "React Dashboard",
      "description": "Admin dashboard with data visualization",
      "category": "web-development"
    },
    "resource_type": "agent",
    "resource_data": {
      "name": "Dashboard Developer",
      "role": "Frontend Developer"
    }
  }'
```

### Validate Resource Compatibility
```bash
curl -X POST http://localhost:8787/api/ai/validate-compatibility \
  -H "Content-Type: application/json" \
  -d '{
    "project_context": {
      "name": "E-commerce API",
      "category": "backend-development"
    },
    "resources": [
      {"type": "agent", "id": "backend-dev"},
      {"type": "rule", "id": "api-standards"}
    ]
  }'
```

### Get Project AI Context
```bash
curl http://localhost:8787/api/ai/project-context/123
```

## Error Responses

### AI Service Unavailable
```json
{
  "error": "AI service temporarily unavailable",
  "fallback_suggestions": [
    "Use existing resource templates",
    "Review similar successful projects",
    "Consult documentation for best practices"
  ],
  "retry_after": 300
}
```

### Invalid Context
```json
{
  "error": "Insufficient project context for meaningful suggestions",
  "required_fields": ["project_name", "project_description"],
  "recommendations": [
    "Provide more detailed project description",
    "Add project category and tags",
    "Include existing resource information"
  ]
}
```

### Rate Limit Exceeded
```json
{
  "error": "AI enhancement rate limit exceeded",
  "limit": 100,
  "reset_time": "2024-12-10T11:00:00Z",
  "suggestions": [
    "Use batch enhancement for multiple resources",
    "Cache enhancement results for reuse",
    "Consider upgrading to higher tier"
  ]
}
```

## Best Practices

### Effective Context Provision
- Provide detailed project descriptions
- Include relevant tags and categories
- Specify technology stack and requirements
- Mention team size and experience level

### Resource Enhancement Workflow
1. Start with basic resource definition
2. Use AI enhancement for improvements
3. Review and customize suggestions
4. Test compatibility with existing resources
5. Iterate based on project needs

### Optimization Strategies
- Use batch enhancement for related resources
- Leverage project context for better suggestions
- Regularly update AI context as project evolves
- Monitor enhancement effectiveness and adjust

### Performance Considerations
- Cache enhancement results for similar resources
- Use batch operations for multiple resources
- Implement fallback strategies for AI unavailability
- Monitor API usage and rate limits

## Integration with Project Workflows

### Resource Creation Flow
1. **Initial Creation**: User creates basic resource
2. **AI Enhancement**: System suggests improvements
3. **User Review**: User accepts, modifies, or rejects suggestions
4. **Compatibility Check**: System validates with existing resources
5. **Final Assignment**: Resource assigned to project with optimizations

### Project Analysis Flow
1. **Context Generation**: System analyzes project and resources
2. **Gap Identification**: AI identifies missing or weak areas
3. **Recommendation Generation**: System suggests improvements
4. **Implementation Guidance**: Provides step-by-step enhancement plan

### Continuous Improvement
- AI learns from user acceptance/rejection patterns
- System tracks successful resource combinations
- Regular updates improve suggestion quality
- User feedback enhances AI model performance